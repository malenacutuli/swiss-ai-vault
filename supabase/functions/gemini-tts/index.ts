import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const { text, voiceName, style } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
    
    // Build the content with optional style prefix
    const contentText = style ? `${style}: "${text}"` : text;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-tts",
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: contentText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || "Kore",
            },
          },
        },
      } as any,
    });

    const result = response.response;
    const candidate = result.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]) {
      throw new Error("No audio generated from Gemini TTS");
    }

    // Extract base64 audio data
    const part = candidate.content.parts[0] as any;
    const audioData = part.inlineData?.data;
    const mimeType = part.inlineData?.mimeType || "audio/mp3";

    if (!audioData) {
      throw new Error("No audio data in response");
    }

    console.log(`[gemini-tts] Generated audio for text: "${text.slice(0, 50)}..." voice: ${voiceName || "Kore"}`);

    return new Response(
      JSON.stringify({ 
        audio: audioData,
        mimeType,
        voiceName: voiceName || "Kore",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[gemini-tts] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "TTS generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
