import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 30 Native Gemini Voices
const GEMINI_VOICES = {
  professional: ["Kore", "Charon", "Gacrux", "Enceladus"],
  friendly: ["Puck", "Algieba", "Fenrir", "Leda"],
  neutral: ["Aoede", "Orus", "Zephyr", "Nova"],
  expressive: ["Clio", "Calypso", "Atlas", "Helios"],
  warm: ["Lyra", "Vega", "Rigel", "Altair"],
  authoritative: ["Castor", "Pollux", "Regulus", "Antares"],
  youthful: ["Sirius", "Procyon", "Deneb", "Mira"],
  broadcast: ["Bellatrix", "Betelgeuse"],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { text, voice, voiceName, style } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const selectedVoice = voice || voiceName || "Kore";
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }
    
    // Build the content with optional style prefix
    const contentText = style ? `${style}: "${text}"` : text;
    
    console.log(`[gemini-tts] Generating audio for ${text.length} chars with voice: ${selectedVoice}`);
    
    // Call Gemini TTS API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: contentText }],
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gemini-tts] API error: ${errorText}`);
      throw new Error(`TTS error: ${errorText}`);
    }
    
    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (!audioData) {
      throw new Error("No audio data in response");
    }
    
    console.log(`[gemini-tts] Generated audio successfully for: "${text.slice(0, 50)}..."`);
    
    return new Response(JSON.stringify({
      audio: audioData.data,
      mimeType: audioData.mimeType || "audio/mp3",
      voice: selectedVoice,
      voiceName: selectedVoice,
      voices: GEMINI_VOICES,
      success: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[gemini-tts] Error: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
