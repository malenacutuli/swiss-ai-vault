import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway URL
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Call Lovable AI Gateway
async function callLovableAI(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = false
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages,
    max_tokens: 8192,
  };

  // For JSON output, use tool calling
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[notebooklm-proxy] Lovable AI error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("API credits exhausted. Please add credits to your Lovable workspace.");
    }
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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

        const systemPrompt = `You are a research assistant with access to specific sources. Answer questions based ONLY on the provided sources. Include citations in the format [Source N: title] when referencing information. If the information isn't in the sources, say so.`;
        
        const userPrompt = `Sources:\n\n${sourceContext}\n\nQuestion: ${params.query}`;

        const answer = await callLovableAI(systemPrompt, userPrompt);

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
        return await generateArtifact(supabase, user.id, notebook_id, "podcast", params);

      case "generate_quiz":
        return await generateArtifact(supabase, user.id, notebook_id, "quiz", params);

      case "generate_flashcards":
        return await generateArtifact(supabase, user.id, notebook_id, "flashcards", params);

      case "generate_mindmap":
        return await generateArtifact(supabase, user.id, notebook_id, "mindmap", params);

      case "generate_slides":
        return await generateArtifact(supabase, user.id, notebook_id, "slides", params);

      case "generate_report":
        return await generateArtifact(supabase, user.id, notebook_id, "report", params);

      case "generate_study_guide":
        return await generateArtifact(supabase, user.id, notebook_id, "study_guide", params);

      case "generate_faq":
        return await generateArtifact(supabase, user.id, notebook_id, "faq", params);

      case "generate_timeline":
        return await generateArtifact(supabase, user.id, notebook_id, "timeline", params);

      case "generate_table":
        return await generateArtifact(supabase, user.id, notebook_id, "table", params);

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

// Generate artifacts using Lovable AI
async function generateArtifact(
  supabase: any,
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
    case "podcast":
      systemPrompt = "You are a podcast script writer. Generate engaging, conversational content with two hosts (Alex and Jordan) discussing topics naturally. Return valid JSON.";
      userPrompt = `Based on these sources, create a podcast script:\n\n${sourceContext}\n\nReturn JSON with format: { "transcript": "full transcript with speaker labels", "segments": [{ "speaker": "Alex", "text": "...", "timestamp": 0 }] }`;
      break;

    case "quiz":
      const quizCount = params.count || 10;
      systemPrompt = "You are an educational quiz creator. Generate challenging but fair multiple-choice questions. Return valid JSON.";
      userPrompt = `Based on these sources, create ${quizCount} quiz questions:\n\n${sourceContext}\n\nReturn JSON: { "questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "...", "difficulty": "medium" }] }`;
      break;

    case "flashcards":
      const cardCount = params.count || 20;
      systemPrompt = "You are a study materials creator. Generate effective flashcards for learning. Return valid JSON.";
      userPrompt = `Based on these sources, create ${cardCount} flashcards:\n\n${sourceContext}\n\nReturn JSON: { "cards": [{ "front": "Question or term", "back": "Answer or definition" }] }`;
      break;

    case "mindmap":
      systemPrompt = "You are a knowledge organizer. Create mind maps that show relationships between concepts. Return valid JSON.";
      userPrompt = `Based on these sources, create a mind map:\n\n${sourceContext}\n\nReturn JSON: { "nodes": [{ "id": "1", "label": "Main Topic", "type": "central" }], "edges": [{ "id": "e1", "source": "1", "target": "2", "label": "relates to" }] }`;
      break;

    case "slides":
      const slideCount = params.count || 10;
      systemPrompt = "You are a presentation designer. Create clear, engaging slides with key points. Return valid JSON.";
      userPrompt = `Based on these sources, create ${slideCount} presentation slides:\n\n${sourceContext}\n\nReturn JSON: { "title": "Presentation Title", "slides": [{ "number": 1, "layout": "title", "title": "...", "subtitle": "...", "bullets": ["point 1"], "notes": "Speaker notes" }] }`;
      break;

    case "report":
    case "study_guide":
      const docType = artifactType === 'study_guide' ? 'study guide' : 'executive report';
      systemPrompt = `You are a ${docType} writer. Create comprehensive, well-organized documents. Return valid JSON.`;
      userPrompt = `Based on these sources, create a ${docType}:\n\n${sourceContext}\n\nReturn JSON: { "title": "...", "content": "Executive summary", "sections": [{ "heading": "Section Title", "content": "Section content..." }] }`;
      break;

    case "faq":
      const faqCount = params.count || 20;
      systemPrompt = "You are an FAQ creator. Generate helpful questions and comprehensive answers. Return valid JSON.";
      userPrompt = `Based on these sources, create ${faqCount} FAQs:\n\n${sourceContext}\n\nReturn JSON: { "questions": [{ "question": "...", "answer": "..." }] }`;
      break;

    case "timeline":
      systemPrompt = "You are a historian. Create chronological timelines with key events. Return valid JSON.";
      userPrompt = `Based on these sources, create a timeline:\n\n${sourceContext}\n\nReturn JSON: { "events": [{ "date": "Date or period", "title": "Event name", "description": "Details" }] }`;
      break;

    case "table":
      systemPrompt = "You are a data analyst. Create comparative tables that organize information clearly. Return valid JSON.";
      userPrompt = `Based on these sources, create a comparison table:\n\n${sourceContext}\n\nReturn JSON: { "title": "Table Title", "columns": ["Column1", "Column2"], "rows": [["Cell1", "Cell2"]] }`;
      break;

    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }

  const resultText = await callLovableAI(systemPrompt, userPrompt, true);
  
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
