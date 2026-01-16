import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Cloud configuration
const PROJECT_ID = Deno.env.get("GOOGLE_CLOUD_PROJECT") || "swissvault";
const LOCATION = "europe-west6"; // Swiss region

// Token cache for Google API
let tokenCache: { token: string; expiry: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && Date.now() < tokenCache.expiry - 60000) {
    return tokenCache.token;
  }

  const credJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!credJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const creds = JSON.parse(credJson);

  // Create JWT header
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(
    JSON.stringify({
      iss: creds.client_email,
      sub: creds.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signInput = `${header}.${payload}`;

  // Sign JWT with private key
  const keyData = Uint8Array.from(
    atob(
      creds.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "")
    ),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signInput}.${sigB64}`;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  // Cache the token
  tokenCache = {
    token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.token;
}

// Call Vertex AI Gemini
// Available Gemini models in europe-west6
const GEMINI_MODEL = "gemini-1.5-flash-002";

async function callVertexAI(
  token: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = false
): Promise<string> {
  const geminiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const messages = [
    {
      role: "user",
      parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
    },
  ];

  const generationConfig: any = {
    temperature: 0.7,
    maxOutputTokens: 8192,
  };

  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: messages,
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[notebooklm-proxy] Vertex AI error:", response.status, errorText);
    throw new Error(`Vertex AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Generate TTS audio using Gemini TTS
async function generateTTSAudio(text: string, voice: string = "Kore"): Promise<{ audio: string; mimeType: string } | null> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) {
    console.warn("[notebooklm-proxy] GOOGLE_GEMINI_API_KEY not set, skipping TTS");
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text }],
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[notebooklm-proxy] TTS error:", errorText);
      return null;
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (audioData) {
      return {
        audio: audioData.data,
        mimeType: audioData.mimeType || "audio/mp3",
      };
    }
    return null;
  } catch (err) {
    console.error("[notebooklm-proxy] TTS generation failed:", err);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify JWT from Supabase
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (authErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, notebook_id, ...params } = body;
    
    console.log(`[notebooklm-proxy] Action: ${action}, Notebook: ${notebook_id || 'N/A'}, User: ${user.id}`);

    // Get Vertex AI access token
    const token = await getAccessToken();

    switch (action) {
      // ==================== NOTEBOOK MANAGEMENT ====================
      case "create_notebook":
        const { data: newNotebook, error: createErr } = await supabase
          .from("studio_notebooks")
          .insert({
            user_id: user.id,
            title: params.title,
          })
          .select()
          .single();

        if (createErr) throw createErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: { ...newNotebook, google_id: newNotebook.id },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "list_notebooks":
        const { data: notebooks, error: listErr } = await supabase
          .from("studio_notebooks")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (listErr) throw listErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: { notebooks: notebooks || [] },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "get_notebook":
        const { data: notebook, error: getErr } = await supabase
          .from("studio_notebooks")
          .select("*, studio_sources(*)")
          .eq("id", notebook_id)
          .single();

        if (getErr) throw getErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: notebook,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "delete_notebook":
        const { error: deleteErr } = await supabase
          .from("studio_notebooks")
          .delete()
          .eq("id", notebook_id)
          .eq("user_id", user.id);

        if (deleteErr) throw deleteErr;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Notebook deleted",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // ==================== SOURCE MANAGEMENT ====================
      case "add_sources":
        const sources = params.sources || [];
        const insertedSources = [];

        for (const source of sources) {
          const sourceType = source.pdf_url ? 'pdf' : 
                            source.youtube_url ? 'youtube' : 
                            source.web_url ? 'web' :
                            source.google_drive_id ? 'drive' : 'text';
          
          const { data: newSource, error: sourceErr } = await supabase
            .from("studio_sources")
            .insert({
              notebook_id,
              source_type: sourceType,
              title: source.title || source.web_url || source.youtube_url || source.pdf_url || 'Text source',
              source_url: source.web_url || source.youtube_url || source.pdf_url,
              full_text: source.text,
            })
            .select()
            .single();

          if (sourceErr) throw sourceErr;
          insertedSources.push(newSource);
        }

        // Update notebook updated_at
        await supabase
          .from("studio_notebooks")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", notebook_id);

        return new Response(
          JSON.stringify({
            success: true,
            data: { sources: insertedSources },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "list_sources":
        const { data: sourceList, error: sourcesErr } = await supabase
          .from("studio_sources")
          .select("*")
          .eq("notebook_id", notebook_id);

        if (sourcesErr) throw sourcesErr;

        return new Response(
          JSON.stringify({
            success: true,
            data: { sources: sourceList || [] },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "delete_source":
        const { error: removeErr } = await supabase
          .from("studio_sources")
          .delete()
          .eq("id", params.source_id);

        if (removeErr) throw removeErr;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Source removed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // ==================== GROUNDED CHAT ====================
      case "chat":
        // Get sources for context
        const { data: chatSources } = await supabase
          .from("studio_sources")
          .select("*")
          .eq("notebook_id", notebook_id);

        // Build grounded context
        const sourceContext = chatSources?.map((s: any, i: number) => 
          `[Source ${i + 1}: ${s.title}]\n${s.full_text || s.source_url || 'Content available'}`
        ).join("\n\n") || "";

        const chatSystemPrompt = `You are a research assistant with access to specific sources. Answer questions based ONLY on the provided sources. Include citations in the format [Source N: title] when referencing information. If the information isn't in the sources, say so.`;
        
        const chatUserPrompt = `Sources:\n\n${sourceContext}\n\nQuestion: ${params.query}`;

        const answer = await callVertexAI(token, chatSystemPrompt, chatUserPrompt);

        // Store in messages
        const sessionId = params.session_id || crypto.randomUUID();
        
        await supabase.from("studio_messages").insert([
          { notebook_id, session_id: sessionId, role: "user", content: params.query },
          { notebook_id, session_id: sessionId, role: "assistant", content: answer }
        ]);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              answer,
              session_id: sessionId,
              groundingMetadata: {
                groundingChunks: chatSources?.map((s: any) => ({
                  sourceId: s.id,
                  title: s.title,
                  uri: s.source_url
                })) || []
              }
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "create_session":
        const newSessionId = crypto.randomUUID();
        return new Response(
          JSON.stringify({
            success: true,
            data: { session_id: newSessionId, name: params.name || `Session ${Date.now()}` },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // ==================== ARTIFACT GENERATION ====================
      case "generate_podcast":
        return await generatePodcastArtifact(supabase, token, user.id, notebook_id, params);

      case "generate_quiz":
        return await generateArtifact(supabase, token, user.id, notebook_id, "quiz", params);

      case "generate_flashcards":
        return await generateArtifact(supabase, token, user.id, notebook_id, "flashcards", params);

      case "generate_mindmap":
        return await generateArtifact(supabase, token, user.id, notebook_id, "mindmap", params);

      case "generate_slides":
        return await generateArtifact(supabase, token, user.id, notebook_id, "slides", params);

      case "generate_report":
        return await generateArtifact(supabase, token, user.id, notebook_id, "report", params);

      case "generate_study_guide":
        return await generateArtifact(supabase, token, user.id, notebook_id, "study_guide", params);

      case "generate_faq":
        return await generateArtifact(supabase, token, user.id, notebook_id, "faq", params);

      case "generate_timeline":
        return await generateArtifact(supabase, token, user.id, notebook_id, "timeline", params);

      case "generate_table":
        return await generateArtifact(supabase, token, user.id, notebook_id, "table", params);

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error("[notebooklm-proxy] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Special podcast generation with TTS audio
async function generatePodcastArtifact(
  supabase: any,
  token: string,
  userId: string,
  notebookId: string,
  params: any
): Promise<Response> {
  // Get sources
  const { data: sources } = await supabase
    .from("studio_sources")
    .select("*")
    .eq("notebook_id", notebookId);

  if (!sources || sources.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "No sources found in notebook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sourceContext = sources.map((s: any, i: number) => 
    `[Source ${i + 1}: ${s.title}]\n${s.full_text || s.source_url || 'Content available'}`
  ).join("\n\n");

  // Generate podcast script
  const systemPrompt = `You are a podcast script writer. Create an engaging conversational podcast with two hosts (Alex and Jordan) discussing topics naturally. Return valid JSON.`;
  const userPrompt = `Based on these sources, create a podcast script:\n\n${sourceContext}\n\nReturn JSON with format:
{
  "title": "Podcast title",
  "description": "Brief description",
  "transcript": "Full transcript with Alex: and Jordan: labels",
  "segments": [
    { "speaker": "Alex", "text": "dialogue text", "timestamp": 0 },
    { "speaker": "Jordan", "text": "dialogue text", "timestamp": 5 }
  ],
  "duration_estimate": "5-7 minutes"
}`;

  const resultText = await callVertexAI(token, systemPrompt, userPrompt, true);
  
  let result;
  try {
    result = JSON.parse(resultText);
  } catch {
    // If JSON parsing fails, create structured result from text
    result = { 
      transcript: resultText,
      segments: parseDialogue(resultText)
    };
  }

  // Generate audio for each segment if segments exist
  const audioSegments: Array<{ speaker: string; audio: string; mimeType: string }> = [];
  const host1Voice = params.host1_voice || "Kore";
  const host2Voice = params.host2_voice || "Charon";

  if (result.segments && Array.isArray(result.segments)) {
    console.log(`[notebooklm-proxy] Generating TTS for ${result.segments.length} segments...`);
    
    for (const segment of result.segments.slice(0, 20)) { // Limit to 20 segments
      const voice = segment.speaker?.toLowerCase() === "jordan" ? host2Voice : host1Voice;
      const audioData = await generateTTSAudio(segment.text.slice(0, 4000), voice);
      
      if (audioData) {
        audioSegments.push({
          speaker: segment.speaker,
          audio: audioData.audio,
          mimeType: audioData.mimeType,
        });
      }
    }
    
    console.log(`[notebooklm-proxy] Generated ${audioSegments.length} audio segments`);
  }

  // Store the artifact output
  const { data: output } = await supabase.from("artifact_outputs").insert({
    notebook_id: notebookId,
    artifact_type: "podcast",
    storage_key: `${userId}/${notebookId}/podcast_${Date.now()}.json`,
    metadata: {
      ...result,
      hasAudio: audioSegments.length > 0,
      audioSegmentCount: audioSegments.length,
    },
    title: result.title || "Podcast",
  }).select().single();

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        ...result,
        audioSegments,
        hasAudio: audioSegments.length > 0,
        outputId: output?.id,
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Parse dialogue from transcript
function parseDialogue(text: string): Array<{ speaker: string; text: string; timestamp: number }> {
  const segments: Array<{ speaker: string; text: string; timestamp: number }> = [];
  const lines = text.split('\n');
  
  let timestamp = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(/^(Alex|Jordan|HOST[12]|Speaker [12]):\s*(.*)$/i);
    if (match) {
      const speaker = match[1].toLowerCase().includes('jordan') || match[1].includes('2') ? 'Jordan' : 'Alex';
      segments.push({
        speaker,
        text: match[2],
        timestamp,
      });
      timestamp += 5; // Estimate 5 seconds per segment
    }
  }
  
  return segments;
}

// Generate other artifacts using Vertex AI
async function generateArtifact(
  supabase: any,
  token: string,
  userId: string,
  notebookId: string,
  artifactType: string,
  params: any
): Promise<Response> {
  // Get sources
  const { data: sources } = await supabase
    .from("studio_sources")
    .select("*")
    .eq("notebook_id", notebookId);

  if (!sources || sources.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "No sources found in notebook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sourceContext = sources.map((s: any, i: number) => 
    `[Source ${i + 1}: ${s.title}]\n${s.full_text || s.source_url || 'Content available'}`
  ).join("\n\n");

  let systemPrompt: string;
  let userPrompt: string;

  switch (artifactType) {
    case "quiz":
      const quizCount = params.count || 10;
      systemPrompt = "You are an educational quiz creator. Generate challenging but fair multiple-choice questions. Return valid JSON.";
      userPrompt = `Based on these sources, create ${quizCount} quiz questions:\n\n${sourceContext}\n\nReturn JSON: { "questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "...", "difficulty": "medium" }] }`;
      break;

    case "flashcards":
      const cardCount = params.count || 20;
      systemPrompt = "You are a study materials creator. Generate effective flashcards for learning. Return valid JSON.";
      userPrompt = `Based on these sources, create ${cardCount} flashcards:\n\n${sourceContext}\n\nReturn JSON: { "cards": [{ "front": "Question or term", "back": "Answer or definition", "category": "topic" }] }`;
      break;

    case "mindmap":
      systemPrompt = "You are a knowledge organizer. Create mind maps that show relationships between concepts. Return valid JSON.";
      userPrompt = `Based on these sources, create a detailed mind map:\n\n${sourceContext}\n\nReturn JSON with this exact structure:
{
  "title": "Central concept",
  "nodes": [
    { "id": "1", "label": "Main Topic", "type": "central", "position": { "x": 0, "y": 0 } },
    { "id": "2", "label": "Subtopic 1", "type": "branch", "position": { "x": 200, "y": -100 } },
    { "id": "3", "label": "Detail 1.1", "type": "leaf", "position": { "x": 400, "y": -150 } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "label": "relates to" },
    { "id": "e2-3", "source": "2", "target": "3", "label": "includes" }
  ]
}`;
      break;

    case "slides":
      const slideCount = params.count || 10;
      systemPrompt = "You are a presentation designer. Create clear, engaging slides with key points. Return valid JSON.";
      userPrompt = `Based on these sources, create ${slideCount} presentation slides:\n\n${sourceContext}\n\nReturn JSON:
{
  "title": "Presentation Title",
  "slides": [
    { 
      "number": 1, 
      "layout": "title", 
      "title": "Main Title", 
      "subtitle": "Subtitle or tagline",
      "bullets": [],
      "notes": "Speaker notes for this slide"
    },
    { 
      "number": 2, 
      "layout": "content", 
      "title": "Section Title", 
      "bullets": ["Key point 1", "Key point 2", "Key point 3"],
      "notes": "Speaker notes"
    }
  ]
}`;
      break;

    case "report":
    case "study_guide":
      const docType = artifactType === 'study_guide' ? 'comprehensive study guide' : 'executive report';
      systemPrompt = `You are a ${docType} writer. Create comprehensive, well-organized documents. Return valid JSON.`;
      userPrompt = `Based on these sources, create a ${docType}:\n\n${sourceContext}\n\nReturn JSON:
{
  "title": "Document Title",
  "summary": "Executive summary paragraph",
  "sections": [
    { 
      "heading": "Section 1 Title", 
      "content": "Detailed section content...",
      "keyPoints": ["Point 1", "Point 2"]
    }
  ],
  "conclusion": "Concluding thoughts",
  "references": ["Source 1 citation", "Source 2 citation"]
}`;
      break;

    case "faq":
      const faqCount = params.count || 15;
      systemPrompt = "You are an FAQ creator. Generate helpful questions and comprehensive answers. Return valid JSON.";
      userPrompt = `Based on these sources, create ${faqCount} FAQs:\n\n${sourceContext}\n\nReturn JSON:
{
  "title": "Frequently Asked Questions",
  "categories": [
    {
      "name": "General",
      "questions": [
        { "question": "Question here?", "answer": "Detailed answer here." }
      ]
    }
  ]
}`;
      break;

    case "timeline":
      systemPrompt = "You are a historian. Create chronological timelines with key events. Return valid JSON.";
      userPrompt = `Based on these sources, create a timeline:\n\n${sourceContext}\n\nReturn JSON:
{
  "title": "Timeline Title",
  "events": [
    { 
      "date": "Date or period", 
      "title": "Event name", 
      "description": "What happened",
      "significance": "Why it matters"
    }
  ]
}`;
      break;

    case "table":
      systemPrompt = "You are a data analyst. Create comparative tables that organize information clearly. Return valid JSON.";
      userPrompt = `Based on these sources, create a comparison table:\n\n${sourceContext}\n\nReturn JSON:
{
  "title": "Comparison Table",
  "description": "Brief description of what's being compared",
  "columns": ["Column1", "Column2", "Column3"],
  "rows": [
    { "label": "Row 1", "values": ["Value 1", "Value 2", "Value 3"] }
  ]
}`;
      break;

    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }

  const resultText = await callVertexAI(token, systemPrompt, userPrompt, true);
  
  let result;
  try {
    result = JSON.parse(resultText);
  } catch {
    // If JSON parsing fails, wrap the text
    result = { content: resultText, parseError: true };
  }

  // Store the artifact output
  const { data: output } = await supabase.from("artifact_outputs").insert({
    notebook_id: notebookId,
    artifact_type: artifactType,
    storage_key: `${userId}/${notebookId}/${artifactType}_${Date.now()}.json`,
    metadata: result,
    title: result.title || artifactType,
  }).select().single();

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        ...result,
        outputId: output?.id,
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
