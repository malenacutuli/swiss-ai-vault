import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const { prompt, imageBase64, aspectRatio, duration, action } = await req.json();

    // Handle status polling
    if (action === "status") {
      const { operationName } = await req.json();
      return await pollOperation(operationName, GOOGLE_GEMINI_API_KEY);
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[gemini-video] Starting video generation: "${prompt.slice(0, 50)}..."`);

    // Build request body for Veo 3.1
    const requestBody: any = {
      model: "models/veo-3.1-generate-preview",
      contents: [{
        parts: imageBase64 
          ? [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: imageBase64 } }
            ]
          : [{ text: prompt }]
      }],
      generationConfig: {
        videoDuration: duration || "8s",
        aspectRatio: aspectRatio || "16:9",
        numberOfVideos: 1,
      }
    };

    // Start async video generation
    const response = await fetch(
      `${GOOGLE_API_BASE}/models/veo-3.1-generate-preview:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[gemini-video] API error:", response.status, errorText);
      
      // Check for model availability - fall back to predictVideos endpoint
      if (response.status === 404 || errorText.includes("not found")) {
        return await startAsyncVideoGeneration(prompt, imageBase64, aspectRatio, duration, GOOGLE_GEMINI_API_KEY);
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Check if we got video data directly
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts?.[0]?.videoMetadata) {
      const videoUri = candidate.content.parts[0].fileData?.fileUri;
      return new Response(
        JSON.stringify({ 
          status: "complete",
          videoUri,
          duration: candidate.content.parts[0].videoMetadata.videoDuration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If async operation, return operation name for polling
    if (result.name) {
      return new Response(
        JSON.stringify({ 
          status: "processing",
          operationName: result.name,
          message: "Video generation started. Poll for status.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unexpected response format from Gemini");

  } catch (error) {
    console.error("[gemini-video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Video generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Alternative: Use predictVideos for async generation
async function startAsyncVideoGeneration(
  prompt: string,
  imageBase64: string | undefined,
  aspectRatio: string | undefined,
  duration: string | undefined,
  apiKey: string
) {
  console.log("[gemini-video] Using predictVideos endpoint for async generation");
  
  const requestBody: any = {
    instances: [{
      prompt,
    }],
    parameters: {
      aspectRatio: aspectRatio || "16:9",
      durationSeconds: parseInt(duration || "8"),
      sampleCount: 1,
    }
  };

  if (imageBase64) {
    requestBody.instances[0].image = {
      bytesBase64Encoded: imageBase64
    };
  }

  const response = await fetch(
    `${GOOGLE_API_BASE}/models/veo-3.1-generate-preview:predictVideos?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[gemini-video] predictVideos error:", response.status, errorText);
    throw new Error(`Video generation failed: ${response.status}`);
  }

  const result = await response.json();
  
  return new Response(
    JSON.stringify({ 
      status: "processing",
      operationName: result.name,
      message: "Video generation started. Poll for status.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Poll for operation completion
async function pollOperation(operationName: string, apiKey: string) {
  const response = await fetch(
    `${GOOGLE_API_BASE}/${operationName}?key=${apiKey}`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`Failed to poll operation: ${response.status}`);
  }

  const result = await response.json();

  if (result.done) {
    if (result.error) {
      return new Response(
        JSON.stringify({ 
          status: "failed",
          error: result.error.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videos = result.response?.generatedVideos || result.response?.videos || [];
    const videoData = videos[0];
    
    return new Response(
      JSON.stringify({ 
        status: "complete",
        videoUri: videoData?.video?.uri || videoData?.uri,
        videoBase64: videoData?.video?.videoBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ 
      status: "processing",
      operationName,
      progress: result.metadata?.progress || 0,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
