import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Optional: Get user for logging (but allow anonymous)
    const authHeader = req.headers.get('Authorization');
    let userId = 'anonymous';
    if (authHeader?.startsWith('Bearer ') && authHeader.length > 20) {
      userId = 'authenticated';
    }
    console.log(`[ghost-voice] Request from: ${userId}`);

    const { action, text, voice = 'alloy', speed = 1.0, audio, language } = await req.json();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Text-to-Speech
    if (action === 'tts' || (!action && text)) {
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Text is required for TTS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limit text length
      const truncatedText = text.slice(0, 4096);
      console.log('[TTS] Generating speech, length:', truncatedText.length, 'voice:', voice);

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: truncatedText,
          voice: voice,
          speed: Math.max(0.25, Math.min(4.0, speed)),
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TTS] OpenAI error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'TTS generation failed', details: errorText }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return audio as binary
      const audioBuffer = await response.arrayBuffer();
      console.log('[TTS] Success, audio size:', audioBuffer.byteLength);

      return new Response(audioBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      });
    }

    // Speech-to-Text
    if (action === 'stt') {
      if (!audio) {
        return new Response(
          JSON.stringify({ error: 'Audio is required for STT' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[STT] Transcribing audio, length:', audio.length);

      // Decode base64 audio
      const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));

      // Create form data
      const formData = new FormData();
      const blob = new Blob([binaryAudio], { type: 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      if (language) {
        formData.append('language', language);
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[STT] OpenAI error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'STT transcription failed', details: errorText }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      console.log('[STT] Success, text length:', result.text?.length);

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "tts" or "stt"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Voice] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Voice function failed', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
