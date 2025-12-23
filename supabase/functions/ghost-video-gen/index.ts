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

// Runway Gen-3 API
async function generateWithRunway(
  prompt: string,
  model: string,
  mode: 'i2v' | 't2v',
  inputImage?: string,
  duration: number = 5
): Promise<{ taskId: string } | { videoUrl: string }> {
  const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY');
  if (!RUNWAY_API_KEY) {
    throw new Error('RUNWAY_API_KEY not configured');
  }

  const modelId = model === 'runway-gen3' ? 'gen3a_turbo' : 'gen3a_turbo';
  
  console.log(`[ghost-video-gen] Generating with Runway ${modelId}, mode: ${mode}`);

  const body: Record<string, unknown> = {
    promptText: prompt,
    model: modelId,
    duration: Math.min(duration, 10), // Runway max is 10s
    watermark: false,
    ratio: '16:9',
  };

  if (mode === 'i2v' && inputImage) {
    // For image-to-video, we need to upload the image first or use a URL
    if (inputImage.startsWith('data:')) {
      // Base64 image - Runway accepts this
      body.promptImage = inputImage;
    } else {
      body.promptImage = inputImage;
    }
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

  // Runway returns a task ID for async processing
  if (data.id) {
    return { taskId: data.id };
  }

  throw new Error('No task ID returned from Runway');
}

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

// Google Veo via Lovable AI Gateway
async function generateWithVeo(
  prompt: string,
  duration: number
): Promise<{ videoUrl: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log('[ghost-video-gen] Generating with Veo 2');

  // For now, Veo might not be available through Lovable AI gateway
  // This is a placeholder for when it becomes available
  throw new Error('Veo 2 is coming soon');
}

// Replicate video models as fallback
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
    // Image to video using Stable Video Diffusion
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
    // Text to video - use a different model
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
      const status = await checkRunwayStatus(body.taskId);
      return new Response(
        JSON.stringify(status),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      prompt = '',
      model = 'runway-gen3-turbo',
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

    // Calculate credit cost
    const baseCosts: Record<string, number> = {
      'runway-gen3-turbo': 20,
      'runway-gen3': 40,
      'veo-2': 50,
    };

    const durationMultiplier = duration === 5 ? 1 : duration === 10 ? 1.75 : 2.5;
    const totalCost = Math.round((baseCosts[model] || 20) * durationMultiplier);

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

    console.log(`[ghost-video-gen] Generating with model: ${model}, mode: ${mode}, duration: ${duration}s`);

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
    if (model.startsWith('runway')) {
      result = await generateWithRunway(fullPrompt, model, mode, inputImage, duration);
    } else if (model === 'veo-2') {
      result = await generateWithVeo(fullPrompt, duration);
    } else {
      // Fallback to Replicate
      result = await generateWithReplicate(fullPrompt, mode, inputImage);
    }

    // Deduct credits immediately
    await supabase.rpc('deduct_ghost_credits', {
      p_user_id: user.id,
      p_amount: totalCost,
    });

    // Log usage
    await supabase.from('ghost_usage').insert({
      user_id: user.id,
      model_id: model,
      modality: 'video',
      input_tokens: 0,
      output_tokens: 0,
      credits_used: totalCost,
      duration_seconds: duration,
      resolution,
    });

    console.log(`[ghost-video-gen] Job started, deducted ${totalCost} credits`);

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
