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
}

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

// Route to different providers
async function generateWithReplicate(
  prompt: string,
  model: string,
  aspectRatio: string,
  negativePrompt?: string,
  seed?: number,
  count: number = 1
): Promise<{ url: string; seed?: number }[]> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_KEY });

  // Map model ID to Replicate model
  const modelMap: Record<string, string> = {
    'flux-1.1-pro': 'black-forest-labs/flux-1.1-pro',
    'flux-schnell': 'black-forest-labs/flux-schnell',
    'sdxl': 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    'sd3-medium': 'stability-ai/stable-diffusion-3',
    'auto': 'black-forest-labs/flux-schnell', // Default to fast model
  };

  const replicateModel = modelMap[model] || modelMap['auto'];
  
  console.log(`[ghost-image-gen] Using Replicate model: ${replicateModel}`);

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

  const output = await replicate.run(replicateModel as `${string}/${string}`, { input });
  
  // Handle different output formats
  if (Array.isArray(output)) {
    return output.map((url, idx) => ({
      url: typeof url === 'string' ? url : url.url || url,
      seed: seed ? seed + idx : undefined,
    }));
  }
  
  return [{ url: output as string, seed }];
}

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
      n: Math.min(count, 1), // DALL-E 3 only supports n=1
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

async function generateWithLovableAI(
  prompt: string
): Promise<{ url: string }[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

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

  if (!response.ok) {
    const error = await response.text();
    console.error('[ghost-image-gen] Lovable AI error:', error);
    throw new Error('Failed to generate image with Imagen');
  }

  const data = await response.json();
  const images = data.choices?.[0]?.message?.images || [];
  
  return images.map((img: { image_url: { url: string } }) => ({
    url: img.image_url.url,
  }));
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
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate credit cost
    const creditCosts: Record<string, number> = {
      'auto': 2,
      'flux-1.1-pro': 5,
      'flux-schnell': 1,
      'sdxl': 1,
      'sd3-medium': 2,
      'dall-e-3': 4,
      'imagen-3': 5,
    };

    const creditPerImage = creditCosts[model] || 2;
    const totalCost = creditPerImage * count;

    // Check credits
    const { data: credits, error: creditsError } = await supabase
      .from('ghost_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !credits || credits.balance < totalCost) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits', required: totalCost, available: credits?.balance || 0 }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ghost-image-gen] Generating with model: ${model}, count: ${count}`);

    // Apply style to prompt
    const styledPrompt = applyStyle(prompt, style);
    
    let images: { url: string; seed?: number }[];
    let actualModel = model;

    // Route to appropriate provider
    if (model === 'dall-e-3') {
      images = await generateWithOpenAI(styledPrompt, aspectRatio, count);
      actualModel = 'dall-e-3';
    } else if (model === 'imagen-3') {
      images = await generateWithLovableAI(styledPrompt);
      actualModel = 'imagen-3';
    } else {
      images = await generateWithReplicate(styledPrompt, model, aspectRatio, negativePrompt, seed, count);
      actualModel = model === 'auto' ? 'flux-schnell' : model;
    }

    // Deduct credits
    await supabase.rpc('deduct_ghost_credits', {
      p_user_id: user.id,
      p_amount: totalCost,
    });

    // Log usage (no prompt content for privacy)
    await supabase.from('ghost_usage').insert({
      user_id: user.id,
      model_id: actualModel,
      modality: 'image',
      input_tokens: 0,
      output_tokens: 0,
      credits_used: totalCost,
      resolution: aspectRatio,
    });

    console.log(`[ghost-image-gen] Generated ${images.length} images, deducted ${totalCost} credits`);

    return new Response(
      JSON.stringify({
        images,
        model: actualModel,
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
