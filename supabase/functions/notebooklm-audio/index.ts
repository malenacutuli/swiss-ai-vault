import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AudioOverviewRequest {
  notebookId: string;
  style?: 'briefing' | 'deep_dive' | 'summary';
  duration?: 'short' | 'medium' | 'long';
  voices?: { host1?: string; host2?: string };
  taskId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const googleApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    let isAnonymous = true;
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        isAnonymous = false;
        userId = user.id;
      }
    }

    // Anonymous audio limit check
    if (isAnonymous) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
      const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const { data: check } = await supabase.rpc('check_anonymous_usage', {
        p_ip_hash: ipHash,
        p_usage_type: 'audio'
      });
      
      if (!check?.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Free audio limit reached. Create an account for more.',
          limit_reached: true,
          used: check?.used || 1,
          limit: check?.limit || 1
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const body: AudioOverviewRequest = await req.json();
    const { notebookId, style = 'briefing', duration = 'medium', taskId } = body;

    if (!notebookId) {
      return new Response(
        JSON.stringify({ success: false, error: "notebookId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get notebook with sources
    const { data: notebook, error: notebookError } = await supabase
      .from('notebooklm_notebooks')
      .select('*, notebooklm_sources(*)')
      .eq('id', notebookId)
      .single();

    if (notebookError || !notebook) {
      console.error("[notebooklm-audio] Notebook not found:", notebookError);
      return new Response(
        JSON.stringify({ success: false, error: "Notebook not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notebooklm-audio] Generating ${style} audio for notebook: ${notebook.title}`);
    console.log(`[notebooklm-audio] Sources count: ${notebook.notebooklm_sources?.length || 0}`);

    // Store reasoning
    if (taskId) {
      await supabase.from('agent_reasoning').insert({
        task_id: taskId,
        agent_type: 'synthesizer',
        reasoning_text: `Generating ${duration} ${style} audio overview from ${notebook.notebooklm_sources?.length || 0} sources. This will synthesize key insights into a conversational format.`,
        confidence_score: 0.9,
        decisions_made: [`Style: ${style}`, `Duration: ${duration}`, `Source count: ${notebook.notebooklm_sources?.length}`],
      });
    }

    // Prepare content for audio generation
    const sourceContent = notebook.notebooklm_sources?.map((s: any) => 
      `Source: ${s.title}\n${s.content_preview || s.processed_content || ''}`
    ).join('\n\n---\n\n') || 'No sources available';

    // Determine target length based on duration
    const durationGuide = {
      short: '2-3 minute',
      medium: '5-7 minute',
      long: '10-15 minute',
    };

    // Generate audio script using Gemini
    const scriptPrompt = `You are creating a ${style} podcast script about: "${notebook.title}"

Based on these sources:
${sourceContent}

Create a natural, engaging ${durationGuide[duration]} conversation between two hosts discussing the key insights.

Format your response as a dialogue:
HOST1: [dialogue]
HOST2: [dialogue]

Guidelines:
- Make it informative but conversational
- Include key facts and insights from the sources
- Use natural transitions between topics
- HOST1 should introduce topics, HOST2 should add depth and analysis
- End with a clear conclusion or takeaway

Begin the script now:`;

    console.log("[notebooklm-audio] Calling Gemini API for script generation...");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: scriptPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error("[notebooklm-audio] Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const script = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!script) {
      throw new Error("Failed to generate script - empty response from Gemini");
    }

    console.log(`[notebooklm-audio] Generated script: ${script.length} characters`);

    // Store output record
    const { data: output, error: outputError } = await supabase
      .from('notebooklm_outputs')
      .insert({
        notebook_id: notebook.id,
        task_id: taskId,
        output_type: 'audio_overview',
        content: script,
        metadata: {
          style,
          duration,
          source_count: notebook.notebooklm_sources?.length || 0,
          script_length: script.length,
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (outputError) {
      console.error("[notebooklm-audio] Failed to save output:", outputError);
    }

    // Store agent communication
    if (taskId) {
      await supabase.from('agent_communications').insert({
        task_id: taskId,
        from_agent: 'synthesizer',
        to_agent: 'executor',
        message_type: 'response',
        message_content: `Generated ${duration} ${style} audio script (${script.length} characters) from ${notebook.notebooklm_sources?.length || 0} sources.`,
      });
    }

    // Parse script into host dialogues for TTS
    const dialogues = parseScript(script);

    console.log(`[notebooklm-audio] Parsed ${dialogues.length} dialogue entries`);

    return new Response(
      JSON.stringify({
        success: true,
        output: {
          id: output?.id,
          type: 'audio_overview',
          script: script,
          dialogues: dialogues,
          style,
          duration,
          metadata: {
            sourceCount: notebook.notebooklm_sources?.length || 0,
            scriptLength: script.length,
            dialogueCount: dialogues.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[notebooklm-audio] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Parse script into structured dialogues
function parseScript(script: string): Array<{ speaker: string; text: string }> {
  const dialogues: Array<{ speaker: string; text: string }> = [];
  const lines = script.split('\n');
  
  let currentSpeaker = '';
  let currentText = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for speaker markers
    const hostMatch = trimmed.match(/^(HOST[12]|ALEX|JORDAN|Speaker [12]):\s*(.*)$/i);
    
    if (hostMatch) {
      // Save previous dialogue if exists
      if (currentSpeaker && currentText) {
        dialogues.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = hostMatch[1].toUpperCase();
      currentText = hostMatch[2];
    } else if (currentSpeaker) {
      // Continue previous speaker's text
      currentText += ' ' + trimmed;
    }
  }
  
  // Add final dialogue
  if (currentSpeaker && currentText) {
    dialogues.push({ speaker: currentSpeaker, text: currentText.trim() });
  }
  
  return dialogues;
}
