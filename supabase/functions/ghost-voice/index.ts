import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, text, voice, speed, audio, language } = await req.json();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (action === 'tts') {
      // Text-to-Speech
      if (!text) {
        throw new Error('Text is required for TTS');
      }

      console.log('Generating TTS:', { voice, speed, textLength: text.length });

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: text.substring(0, 4096), // Max 4096 chars
          voice: voice || 'alloy',
          speed: Math.max(0.25, Math.min(4.0, speed || 1.0)),
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI TTS error:', response.status, errorText);
        throw new Error(`OpenAI TTS error: ${response.status}`);
      }

      // Get audio as base64
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // Log usage
      if (userId) {
        try {
          await supabase.from('ghost_usage').insert({
            user_id: userId,
            model_id: 'tts-1-hd',
            input_tokens: text.length,
            output_tokens: 0,
            modality: 'tts',
            provider: 'openai',
          });
        } catch (e) {
          console.warn('Failed to log usage:', e);
        }
      }

      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'stt') {
      // Speech-to-Text
      if (!audio) {
        throw new Error('Audio is required for STT');
      }

      console.log('Transcribing audio:', { language, audioLength: audio.length });

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
        console.error('OpenAI STT error:', response.status, errorText);
        throw new Error(`OpenAI STT error: ${response.status}`);
      }

      const result = await response.json();

      // Log usage
      if (userId) {
        try {
          await supabase.from('ghost_usage').insert({
            user_id: userId,
            model_id: 'whisper-1',
            input_tokens: 0,
            output_tokens: result.text?.length || 0,
            modality: 'stt',
            provider: 'openai',
          });
        } catch (e) {
          console.warn('Failed to log usage:', e);
        }
      }

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Voice function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
