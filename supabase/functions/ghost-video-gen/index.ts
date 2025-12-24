import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VideoGenRequest {
  prompt?: string;
  model: string;
  mode: 'i2v' | 't2v';
  inputImage?: string;
  duration: number;
  resolution: string;
  style?: string;
  cameraMotion?: string;
  // For status check
  checkStatus?: boolean;
  taskId?: string;
}

// Model routing configuration
const VIDEO_MODEL_ROUTES: Record<string, { provider: string; creditCost: number; maxDuration: number }> = {
  // Google Veo
  'veo-3.1': { provider: 'google', creditCost: 150, maxDuration: 60 },
  'veo-3': { provider: 'google', creditCost: 120, maxDuration: 30 },
  'veo-2': { provider: 'google', creditCost: 80, maxDuration: 15 },
  // Runway
  'runway-gen3-alpha-turbo': { provider: 'runway', creditCost: 25, maxDuration: 10 },
  'runway-gen3-alpha': { provider: 'runway', creditCost: 50, maxDuration: 10 },
  // Legacy aliases
  'runway-gen3-turbo': { provider: 'runway', creditCost: 25, maxDuration: 10 },
  'runway-gen3': { provider: 'runway', creditCost: 50, maxDuration: 10 },
  // OpenAI Sora
  'sora': { provider: 'openai', creditCost: 100, maxDuration: 20 },
  'sora-turbo': { provider: 'openai', creditCost: 50, maxDuration: 10 },
  // Luma
  'dream-machine-1.5': { provider: 'luma', creditCost: 35, maxDuration: 5 },
  // Pika
  'pika-2.0': { provider: 'pika', creditCost: 30, maxDuration: 5 },
};

// Generate with Runway
async function generateWithRunway(
  prompt: string,
  model: string,
  mode: 'i2v' | 't2v',
  inputImage?: string,
  duration: number = 5
): Promise<{ taskId: string }> {
  const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY');
  if (!RUNWAY_API_KEY) {
    throw new Error('RUNWAY_API_KEY not configured');
  }

  const modelId = model.includes('turbo') ? 'gen3a_turbo' : 'gen3a_turbo';
  
  console.log(`[ghost-video-gen] Generating with Runway ${modelId}, mode: ${mode}`);

  const body: Record<string, unknown> = {
    promptText: prompt,
    model: modelId,
    duration: Math.min(duration, 10),
    watermark: false,
    ratio: '16:9',
  };

  if (mode === 'i2v' && inputImage) {
    body.promptImage = inputImage;
  }

  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNWAY_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ghost-video-gen] Runway error:', response.status, errorText);
    throw new Error(`Runway API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[ghost-video-gen] Runway response:', data);

  if (data.id) {
    return { taskId: data.id };
  }

  throw new Error('No task ID returned from Runway');
}

// Check Runway task status
async function checkRunwayStatus(taskId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY');
  if (!RUNWAY_API_KEY) {
    throw new Error('RUNWAY_API_KEY not configured');
  }

  const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${RUNWAY_API_KEY}`,
      'X-Runway-Version': '2024-11-06',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check task status: ${response.status}`);
  }

  const data = await response.json();
  console.log('[ghost-video-gen] Runway status:', data);

  if (data.status === 'SUCCEEDED' && data.output?.[0]) {
    return { status: 'completed', videoUrl: data.output[0] };
  }

  if (data.status === 'FAILED') {
    return { status: 'failed', error: data.failure || 'Generation failed' };
  }

  return { status: 'processing' };
}

// Generate with Luma
async function generateWithLuma(
  prompt: string,
  mode: 'i2v' | 't2v',
  inputImage?: string
): Promise<{ taskId: string }> {
  const LUMA_API_KEY = Deno.env.get('LUMA_API_KEY');
  if (!LUMA_API_KEY) {
    throw new Error('LUMA_API_KEY not configured');
  }

  console.log('[ghost-video-gen] Generating with Luma Dream Machine');

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: '16:9',
  };

  if (mode === 'i2v' && inputImage) {
    body.keyframes = {
      frame0: {
        type: 'image',
        url: inputImage,
      }
    };
  }

  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LUMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ghost-video-gen] Luma error:', response.status, errorText);
    throw new Error(`Luma API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[ghost-video-gen] Luma response:', data);

  if (data.id) {
    return { taskId: `luma:${data.id}` };
  }

  throw new Error('No task ID returned from Luma');
}

// Check Luma status
async function checkLumaStatus(taskId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const LUMA_API_KEY = Deno.env.get('LUMA_API_KEY');
  if (!LUMA_API_KEY) {
    throw new Error('LUMA_API_KEY not configured');
  }

  const response = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${LUMA_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check task status: ${response.status}`);
  }

  const data = await response.json();

  if (data.state === 'completed' && data.assets?.video) {
    return { status: 'completed', videoUrl: data.assets.video };
  }

  if (data.state === 'failed') {
    return { status: 'failed', error: data.failure_reason || 'Generation failed' };
  }

  return { status: 'processing' };
}

// Generate with Replicate (fallback)
async function generateWithReplicate(
  prompt: string,
  mode: 'i2v' | 't2v',
  inputImage?: string
): Promise<{ videoUrl: string }> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }

  const Replicate = (await import("https://esm.sh/replicate@0.25.2")).default;
  const replicate = new Replicate({ auth: REPLICATE_API_KEY });

  console.log('[ghost-video-gen] Generating with Replicate');

  let output;
  
  if (mode === 'i2v' && inputImage) {
    output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
      {
        input: {
          input_image: inputImage,
          motion_bucket_id: 127,
          fps: 7,
          cond_aug: 0.02,
        }
      }
    );
  } else {
    output = await replicate.run(
      "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
      {
        input: {
          prompt,
          num_frames: 24,
          fps: 8,
        }
      }
    );
  }

  if (typeof output === 'string') {
    return { videoUrl: output };
  }

  if (Array.isArray(output) && output[0]) {
    return { videoUrl: output[0] };
  }

  throw new Error('No video URL returned');
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

    console.log(`[ghost-video-gen] User ${user.id.substring(0, 8)}... authenticated`);

    const body: VideoGenRequest = await req.json();

    // Handle status check
    if (body.checkStatus && body.taskId) {
      // Route to appropriate status checker
      if (body.taskId.startsWith('luma:')) {
        const status = await checkLumaStatus(body.taskId.replace('luma:', ''));
        return new Response(
          JSON.stringify(status),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const status = await checkRunwayStatus(body.taskId);
        return new Response(
          JSON.stringify(status),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const {
      prompt = '',
      model = 'runway-gen3-alpha-turbo',
      mode = 't2v',
      inputImage,
      duration = 5,
      resolution = '720p',
      style,
      cameraMotion,
    } = body;

    // Validate
    if (mode === 't2v' && !prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt required for text-to-video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'i2v' && !inputImage) {
      return new Response(
        JSON.stringify({ error: 'Image required for image-to-video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get model config
    const modelConfig = VIDEO_MODEL_ROUTES[model] || VIDEO_MODEL_ROUTES['runway-gen3-alpha-turbo'];
    const durationMultiplier = duration === 5 ? 1 : duration === 10 ? 1.75 : 2.5;
    const totalCost = Math.round(modelConfig.creditCost * durationMultiplier);

    // Check credits via RPC (includes admin bypass)
    const { data: usageCheck, error: usageError } = await supabase
      .rpc('check_user_usage', {
        p_user_id: user.id,
        p_usage_type: 'video',
        p_estimated_cost_cents: totalCost * 100
      });

    if (usageError) {
      console.error('[ghost-video-gen] Usage check error:', usageError);
    }

    // Log admin status
    if (usageCheck?.is_admin) {
      console.log(`[ghost-video-gen] Admin user detected - bypassing credit limits`);
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

    console.log(`[ghost-video-gen] Generating with model: ${model} (${modelConfig.provider}), mode: ${mode}, duration: ${duration}s`);

    // Build full prompt with style and camera motion
    let fullPrompt = prompt;
    if (style && style !== 'realistic') {
      fullPrompt = `${style} style, ${fullPrompt}`;
    }
    if (cameraMotion) {
      fullPrompt = `${fullPrompt}, ${cameraMotion} camera movement`;
    }

    let result;

    // Route to provider
    switch (modelConfig.provider) {
      case 'runway':
        result = await generateWithRunway(fullPrompt, model, mode, inputImage, duration);
        break;
      case 'luma':
        result = await generateWithLuma(fullPrompt, mode, inputImage);
        break;
      case 'google':
      case 'openai':
      case 'pika':
        // These are coming soon
        return new Response(
          JSON.stringify({ error: `${modelConfig.provider} video generation coming soon` }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      default:
        result = await generateWithReplicate(fullPrompt, mode, inputImage);
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
      modality: 'video',
      input_tokens: 0,
      output_tokens: 0,
      credits_used: usageCheck?.is_admin ? 0 : totalCost,
      duration_seconds: duration,
      resolution,
      was_free_tier: usageCheck?.is_admin || false,
    });

    console.log(`[ghost-video-gen] Job started, Admin: ${usageCheck?.is_admin}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ghost-video-gen] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
