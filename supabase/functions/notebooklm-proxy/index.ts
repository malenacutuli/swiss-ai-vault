import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Configuration
const PROJECT_ID = Deno.env.get("GOOGLE_CLOUD_PROJECT") || "swissvault";
const LOCATION = "europe-west6"; // Swiss data residency - CRITICAL
const BASE_URL = `https://${LOCATION}-discoveryengine.googleapis.com/v1alpha`;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token cache for Google API
let tokenCache: { token: string; expiry: number } | null = null;

// Get access token from service account
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

// Poll long-running operation
async function pollOperation(operationName: string, token: string): Promise<any> {
  const maxAttempts = 120; // 10 minutes max
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://${LOCATION}-discoveryengine.googleapis.com/v1alpha/${operationName}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const operation = await response.json();
    console.log(`[notebooklm-proxy] Poll ${i + 1}: done=${operation.done}`);
    
    if (operation.done) {
      if (operation.error) {
        throw new Error(operation.error.message || "Operation failed");
      }
      return operation.response || operation.result || operation;
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error("Operation timed out after 10 minutes");
}

// Format source for API
function formatSource(source: any) {
  if (source.pdf_url) {
    return { uriContent: { uri: source.pdf_url } };
  }
  if (source.google_drive_id) {
    return {
      googleDriveContent: {
        documentId: source.google_drive_id,
        mimeType: source.mime_type || "application/pdf"
      }
    };
  }
  if (source.youtube_url) {
    return { videoContent: { url: source.youtube_url } };
  }
  if (source.web_url) {
    return { webContent: { url: source.web_url } };
  }
  if (source.text) {
    return { textContent: { text: source.text } };
  }
  throw new Error("Unknown source type");
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
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
    
    const token = await getAccessToken();
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
    
    let endpoint: string;
    let method = "POST";
    let requestBody: any = null;

    switch (action) {
      // ==================== NOTEBOOK MANAGEMENT ====================
      case "create_notebook":
        // Store in local DB and optionally sync to Google
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

        // Call Gemini for grounded chat
        const geminiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;

        const chatResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `You are a research assistant with access to the following sources:\n\n${sourceContext}\n\nBased ONLY on these sources, answer the following question. Include citations in the format [Source N: title] when referencing information.\n\nQuestion: ${params.query}`
              }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
            }
          }),
        });

        const chatData = await chatResponse.json();
        const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

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
        return await generateWithGemini(token, notebook_id, supabase, user.id, "podcast", params);

      case "generate_quiz":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "quiz", params);

      case "generate_flashcards":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "flashcards", params);

      case "generate_mindmap":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "mindmap", params);

      case "generate_slides":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "slides", params);

      case "generate_report":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "report", params);

      case "generate_study_guide":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "study_guide", params);

      case "generate_faq":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "faq", params);

      case "generate_timeline":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "timeline", params);

      case "generate_table":
        return await generateWithGemini(token, notebook_id, supabase, user.id, "table", params);

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

// Generate artifacts using Gemini with structured output
async function generateWithGemini(
  token: string,
  notebookId: string,
  supabase: any,
  userId: string,
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

  let prompt: string;
  let jsonSchema: any;

  switch (artifactType) {
    case "podcast":
      prompt = `Based on the following sources, generate a podcast script with two hosts discussing the key topics. Make it engaging, conversational, and informative.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          transcript: { type: "string", description: "Full podcast transcript with speaker labels" },
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                speaker: { type: "string" },
                text: { type: "string" },
                timestamp: { type: "number" }
              }
            }
          }
        }
      };
      break;

    case "quiz":
      const quizCount = params.count || 10;
      prompt = `Based on the following sources, generate ${quizCount} multiple-choice quiz questions. Each question should have 4 options with one correct answer. Include explanations.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correctIndex: { type: "number" },
                explanation: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
              }
            }
          }
        }
      };
      break;

    case "flashcards":
      const cardCount = params.count || 20;
      prompt = `Based on the following sources, generate ${cardCount} flashcards for study. Each card should have a question/term on the front and the answer/definition on the back.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "mindmap":
      prompt = `Based on the following sources, generate a mind map with central topics, subtopics, and connections. Return as nodes and edges for graph visualization.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["central", "topic", "subtopic", "detail"] }
              }
            }
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                source: { type: "string" },
                target: { type: "string" },
                label: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "slides":
      const slideCount = params.count || 10;
      prompt = `Based on the following sources, generate ${slideCount} presentation slides. Include title, bullet points, and speaker notes for each slide.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "number" },
                layout: { type: "string" },
                title: { type: "string" },
                subtitle: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                notes: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "report":
    case "study_guide":
      prompt = `Based on the following sources, generate a comprehensive ${artifactType === 'study_guide' ? 'study guide' : 'executive report'}. Include key sections, summaries, and action items.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                content: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "faq":
      const faqCount = params.count || 20;
      prompt = `Based on the following sources, generate ${faqCount} frequently asked questions with detailed answers.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "timeline":
      prompt = `Based on the following sources, generate a chronological timeline of key events, dates, and milestones.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                title: { type: "string" },
                description: { type: "string" }
              }
            }
          }
        }
      };
      break;

    case "table":
      prompt = `Based on the following sources, generate a comparative data table with relevant columns and rows.\n\nSources:\n${sourceContext}`;
      jsonSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      };
      break;

    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }

  // Call Gemini with JSON mode
  const geminiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash:generateContent`;

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: prompt + "\n\nRespond with valid JSON only." }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      }
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error("[notebooklm-proxy] Gemini error:", data);
    throw new Error(data.error?.message || "Failed to generate content");
  }

  const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  let result;
  try {
    result = JSON.parse(resultText);
  } catch {
    // If JSON parsing fails, wrap the text
    result = { content: resultText };
  }

  // Store the artifact output
  await supabase.from("artifact_outputs").insert({
    notebook_id: notebookId,
    artifact_type: artifactType,
    storage_key: `${userId}/${notebookId}/${artifactType}_${Date.now()}.json`,
    metadata: result,
  });

  return new Response(
    JSON.stringify({ success: true, data: result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
