import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageGenRequest {
  prompt: string;
  model: string;
  aspectRatio?: string;
  style?: string;
  negativePrompt?: string;
  seed?: number;
  count?: number;
  enhancePrompt?: boolean;
  referenceImage?: string; // base64 data URL for image-to-image
}

// Model routing configuration
const IMAGE_MODEL_ROUTES: Record<string, { provider: string; modelId: string; creditCost: number }> = {
  'auto': { provider: 'replicate', modelId: 'black-forest-labs/flux-schnell', creditCost: 2 },
  // Google Imagen
  'imagen-3': { provider: 'google', modelId: 'imagen-3', creditCost: 5 },
  'imagen-3-fast': { provider: 'google', modelId: 'imagen-3-fast', creditCost: 3 },
  // Flux
  'flux-1.1-pro-ultra': { provider: 'replicate', modelId: 'black-forest-labs/flux-1.1-pro-ultra', creditCost: 8 },
  'flux-1.1-pro': { provider: 'replicate', modelId: 'black-forest-labs/flux-1.1-pro', creditCost: 5 },
  'flux-schnell': { provider: 'replicate', modelId: 'black-forest-labs/flux-schnell', creditCost: 1 },
  // OpenAI
  'dall-e-3': { provider: 'openai', modelId: 'dall-e-3', creditCost: 4 },
  // Stability
  'sdxl': { provider: 'replicate', modelId: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b', creditCost: 1 },
  'sd3-medium': { provider: 'replicate', modelId: 'stability-ai/stable-diffusion-3', creditCost: 2 },
};

// Map aspect ratio to provider-specific formats
function getReplicateAspectRatio(aspectRatio: string): string {
  const map: Record<string, string> = {
    '1:1': '1:1',
    '3:4': '3:4',
    '4:3': '4:3',
    '16:9': '16:9',
    '9:16': '9:16',
  };
  return map[aspectRatio] || '1:1';
}

function getDalleSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '1:1': '1024x1024',
    '3:4': '1024x1792',
    '4:3': '1792x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
  };
  return map[aspectRatio] || '1024x1024';
}

// Enhance prompt with style
function applyStyle(prompt: string, style?: string): string {
  if (!style || style === 'none') return prompt;
  
  const styleModifiers: Record<string, string> = {
    photorealistic: 'photorealistic, highly detailed, 8k, professional photography',
    artistic: 'artistic, painterly, expressive brushstrokes, fine art',
    anime: 'anime style, cel shaded, vibrant colors, detailed',
    '3d-render': '3D render, octane render, ray tracing, highly detailed, photorealistic lighting',
  };

  return `${prompt}, ${styleModifiers[style] || ''}`;
}

// Generate with Replicate
async function generateWithReplicate(
  prompt: string,
  modelId: string,
  aspectRatio: string,
  negativePrompt?: string,
  seed?: number,
  count: number = 1,
  referenceImage?: string
): Promise<{ url: string; seed?: number }[]> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_KEY });

  // If reference image provided, use flux-redux for image-to-image
  if (referenceImage) {
    console.log(`[ghost-image-gen] Using image-to-image with reference`);
    
    const input: Record<string, unknown> = {
      prompt,
      image: referenceImage,
      prompt_strength: 0.8,
      num_outputs: count,
      output_format: 'webp',
      output_quality: 90,
    };

    if (seed) {
      input.seed = seed;
    }

    // Use flux-dev for image-to-image as it supports it well
    const output = await replicate.run('black-forest-labs/flux-dev' as `${string}/${string}`, { input });
    
    if (Array.isArray(output)) {
      return output.map((url, idx) => ({
        url: typeof url === 'string' ? url : url.url || url,
        seed: seed ? seed + idx : undefined,
      }));
    }
    
    return [{ url: output as string, seed }];
  }

  console.log(`[ghost-image-gen] Using Replicate model: ${modelId}`);

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: getReplicateAspectRatio(aspectRatio),
    num_outputs: count,
    output_format: 'webp',
    output_quality: 90,
  };

  if (negativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  if (seed) {
    input.seed = seed;
  }

  const output = await replicate.run(modelId as `${string}/${string}`, { input });
  
  if (Array.isArray(output)) {
    return output.map((url, idx) => ({
      url: typeof url === 'string' ? url : url.url || url,
      seed: seed ? seed + idx : undefined,
    }));
  }
  
  return [{ url: output as string, seed }];
}

// Generate with OpenAI
async function generateWithOpenAI(
  prompt: string,
  aspectRatio: string,
  count: number = 1
): Promise<{ url: string }[]> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: getDalleSize(aspectRatio),
      quality: 'hd',
      n: Math.min(count, 1),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ghost-image-gen] OpenAI error:', error);
    throw new Error('Failed to generate image with DALL-E');
  }

  const data = await response.json();
  return data.data.map((img: { url: string }) => ({ url: img.url }));
}

// Generate with Google Imagen (via Lovable AI or direct)
async function generateWithGoogle(
  prompt: string
): Promise<{ url: string }[]> {
  // Try Lovable AI gateway first
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_API_KEY) {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const images = data.choices?.[0]?.message?.images || [];
      
      return images.map((img: { image_url: { url: string } }) => ({
        url: img.image_url.url,
      }));
    }
  }

  // Fallback to direct Google API
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  throw new Error('Direct Imagen API not yet implemented');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ghost-image-gen] User ${user.id.substring(0, 8)}... authenticated`);

  const body: ImageGenRequest = await req.json();
    const {
      prompt,
      model = 'auto',
      aspectRatio = '1:1',
      style,
      negativePrompt,
      seed,
      count = 1,
      enhancePrompt,
      referenceImage,
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get model config
    const modelConfig = IMAGE_MODEL_ROUTES[model] || IMAGE_MODEL_ROUTES['auto'];
    const totalCost = modelConfig.creditCost * count;

    // Check credits via RPC (includes admin bypass)
    const { data: usageCheck, error: usageError } = await supabase
      .rpc('check_user_usage', {
        p_user_id: user.id,
        p_usage_type: 'image',
        p_estimated_cost_cents: totalCost * 100
      });

    if (usageError) {
      console.error('[ghost-image-gen] Usage check error:', usageError);
    }

    // Log admin status
    if (usageCheck?.is_admin) {
      console.log(`[ghost-image-gen] Admin user detected - bypassing credit limits`);
    }

    // Only block if explicitly not allowed AND not admin
    if (usageCheck && usageCheck.allowed === false && !usageCheck.is_admin) {
      return new Response(
        JSON.stringify({ 
          error: usageCheck.reason || 'Insufficient credits', 
          required: totalCost, 
          available: usageCheck.balance || 0 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ghost-image-gen] Generating with model: ${model} (${modelConfig.provider}), count: ${count}, hasReference: ${!!referenceImage}`);

    // Apply style to prompt
    const styledPrompt = applyStyle(prompt, style);
    
    let images: { url: string; seed?: number }[];

    // Route to appropriate provider
    switch (modelConfig.provider) {
      case 'openai':
        images = await generateWithOpenAI(styledPrompt, aspectRatio, count);
        break;
      case 'google':
        images = await generateWithGoogle(styledPrompt);
        break;
      case 'replicate':
      default:
        images = await generateWithReplicate(styledPrompt, modelConfig.modelId, aspectRatio, negativePrompt, seed, count, referenceImage);
        break;
    }

    // Deduct credits (skip for admin)
    if (!usageCheck?.is_admin) {
      await supabase.rpc('deduct_ghost_credits', {
        p_user_id: user.id,
        p_amount: totalCost,
      });
    }

    // Log usage
    await supabase.from('ghost_usage').insert({
      user_id: user.id,
      model_id: model,
      provider: modelConfig.provider,
      modality: 'image',
      input_tokens: 0,
      output_tokens: 0,
      credits_used: usageCheck?.is_admin ? 0 : totalCost,
      resolution: aspectRatio,
      was_free_tier: usageCheck?.is_admin || false,
    });

    console.log(`[ghost-image-gen] Generated ${images.length} images, Admin: ${usageCheck?.is_admin}`);

    return new Response(
      JSON.stringify({
        images,
        model: model,
        provider: modelConfig.provider,
        enhancedPrompt: enhancePrompt ? styledPrompt : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ghost-image-gen] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
