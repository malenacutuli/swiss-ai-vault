// supabase/functions/voice/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'transcribe';

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    switch (action) {
      case 'transcribe': {
        // Expect audio file in request body
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
          throw new Error('Audio file required');
        }

        // Create form data for OpenAI
        const openaiForm = new FormData();
        openaiForm.append('file', audioFile);
        openaiForm.append('model', 'whisper-1');
        openaiForm.append('response_format', 'json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`
          },
          body: openaiForm
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Whisper error: ${error}`);
        }

        const result = await response.json();

        return new Response(
          JSON.stringify({ text: result.text }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'speak': {
        const body = await req.json();
        const { text, voice = 'alloy', speed = 1.0 } = body;

        if (!text) {
          throw new Error('Text is required');
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text.slice(0, 4096), // Max 4096 chars
            voice: voice, // alloy, echo, fable, onyx, nova, shimmer
            speed: speed  // 0.25 to 4.0
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`TTS error: ${error}`);
        }

        // Return audio as base64
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        return new Response(
          JSON.stringify({
            audio: base64Audio,
            format: 'mp3'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
