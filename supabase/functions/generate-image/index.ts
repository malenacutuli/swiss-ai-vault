// supabase/functions/generate-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createArtifact } from "../_shared/artifacts/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageRequest {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: 'photorealistic' | 'artistic' | 'digital-art' | 'sketch';
  run_id?: string;
  step_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get user if authenticated
  let userId: string | undefined;
  if (authHeader) {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    userId = user?.id;
  }

  try {
    const body: ImageRequest = await req.json();

    if (!body.prompt) {
      throw new Error('Prompt is required');
    }

    // Map aspect ratio to dimensions
    const dimensions: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 }
    };

    const { width, height } = dimensions[body.aspect_ratio || '1:1'];

    // Style prompts
    const stylePrompts: Record<string, string> = {
      'photorealistic': 'photorealistic, high detail, 8k resolution',
      'artistic': 'artistic, painterly, creative interpretation',
      'digital-art': 'digital art, vibrant colors, modern style',
      'sketch': 'pencil sketch, hand-drawn, artistic'
    };

    const enhancedPrompt = body.style
      ? `${body.prompt}, ${stylePrompts[body.style]}`
      : body.prompt;

    // Call Vertex AI Imagen 3
    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT');
    const location = 'europe-west6'; // Swiss region
    const accessToken = Deno.env.get('GOOGLE_ACCESS_TOKEN'); // Or use service account

    // For now, use Gemini's image generation endpoint
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    // Use Imagen 3 via Vertex AI
    const response = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: body.aspect_ratio || '1:1',
            negativePrompt: body.negative_prompt || '',
            outputOptions: {
              mimeType: 'image/png'
            }
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Imagen API error:', error);

      // Fallback to DALL-E if Imagen fails
      return await fallbackToDallE(supabase, body, userId);
    }

    const result = await response.json();
    const imageBase64 = result.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      throw new Error('No image generated');
    }

    // Decode base64 to bytes
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

    // Store as artifact
    const artifact = await createArtifact(supabase, {
      content: imageBytes,
      type: 'image',
      mime_type: 'image/png',
      file_name: `generated-${Date.now()}.png`,
      run_id: body.run_id || `gen-${Date.now()}`,
      step_id: body.step_id || `step-${Date.now()}`,
      tool_name: 'generate_image',
      metadata: {
        prompt: body.prompt,
        style: body.style,
        aspect_ratio: body.aspect_ratio,
        model: 'imagen-3.0'
      }
    });

    // Get signed URL for preview
    const { data: urlData } = await supabase.storage
      .from('artifacts')
      .createSignedUrl(artifact.artifact.storage_path, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        artifact_id: artifact.artifact.id,
        url: urlData?.signedUrl,
        metadata: {
          prompt: body.prompt,
          width,
          height,
          model: 'imagen-3.0'
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fallbackToDallE(supabase: any, body: ImageRequest, userId?: string) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('No image generation service available');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: body.prompt,
      n: 1,
      size: body.aspect_ratio === '16:9' ? '1792x1024' :
            body.aspect_ratio === '9:16' ? '1024x1792' : '1024x1024',
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DALL-E error: ${error}`);
  }

  const result = await response.json();
  const imageBase64 = result.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error('No image generated');
  }

  const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

  // Store as artifact
  const { createArtifact } = await import("../_shared/artifacts/registry.ts");
  const artifact = await createArtifact(supabase, {
    content: imageBytes,
    type: 'image',
    mime_type: 'image/png',
    file_name: `generated-${Date.now()}.png`,
    run_id: body.run_id || `gen-${Date.now()}`,
    step_id: body.step_id || `step-${Date.now()}`,
    tool_name: 'generate_image',
    metadata: {
      prompt: body.prompt,
      model: 'dall-e-3'
    }
  });

  const { data: urlData } = await supabase.storage
    .from('artifacts')
    .createSignedUrl(artifact.artifact.storage_path, 3600);

  return new Response(
    JSON.stringify({
      success: true,
      artifact_id: artifact.artifact.id,
      url: urlData?.signedUrl,
      metadata: {
        prompt: body.prompt,
        model: 'dall-e-3'
      }
    }),
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    }
  );
}
