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
  // Google Veo (LIVE - highest quality)
  'veo-3': { provider: 'veo', creditCost: 120, maxDuration: 30 },
  'veo-2': { provider: 'veo', creditCost: 80, maxDuration: 15 },
  // Runway
  'runway-gen3-alpha-turbo': { provider: 'runway', creditCost: 25, maxDuration: 10 },
  'runway-gen3-alpha': { provider: 'runway', creditCost: 50, maxDuration: 10 },
  // Legacy aliases
  'runway-gen3-turbo': { provider: 'runway', creditCost: 25, maxDuration: 10 },
  'runway-gen3': { provider: 'runway', creditCost: 50, maxDuration: 10 },
  // OpenAI Sora (coming soon)
  'sora': { provider: 'openai', creditCost: 100, maxDuration: 20 },
  'sora-turbo': { provider: 'openai', creditCost: 50, maxDuration: 10 },
  // Luma (disabled for now)
  'dream-machine-1.5': { provider: 'luma', creditCost: 35, maxDuration: 5 },
  // Pika (coming soon)
  'pika-2.0': { provider: 'pika', creditCost: 30, maxDuration: 5 },
  // Replicate models (working alternatives)
  'replicate-svd': { provider: 'replicate', creditCost: 15, maxDuration: 4 },
  'replicate-animatediff': { provider: 'replicate', creditCost: 10, maxDuration: 3 },
};

// Generate with Runway - Fixed to handle t2v and i2v properly
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

  // For text-to-video, Runway still uses the same endpoint but without promptImage
  // The key fix: only include promptImage for i2v mode, and ensure the body is clean
  const body: Record<string, unknown> = {
    promptText: prompt,
    model: modelId,
    duration: Math.min(duration, 10),
    watermark: false,
    ratio: '16:9',
  };

  // Only add promptImage for image-to-video mode
  if (mode === 'i2v') {
    if (!inputImage) {
      throw new Error('Image required for image-to-video mode');
    }
    body.promptImage = inputImage;
  }

  // Use the correct endpoint - Runway uses image_to_video for both modes
  // but for t2v the promptImage field is simply omitted
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
    
    // If Runway fails for t2v, suggest using Replicate models instead
    if (mode === 't2v') {
      throw new Error(`Runway text-to-video failed. Try using Replicate AnimateDiff instead.`);
    }
    throw new Error(`Runway API error: ${response.status} - ${errorText}`);
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

// Generate with Replicate - Primary video generation for reliability
async function generateWithReplicate(
  prompt: string,
  mode: 'i2v' | 't2v',
  inputImage?: string,
  modelId?: string
): Promise<{ videoUrl: string }> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }

  const Replicate = (await import("https://esm.sh/replicate@0.25.2")).default;
  const replicate = new Replicate({ auth: REPLICATE_API_KEY });

  console.log(`[ghost-video-gen] Generating with Replicate, mode: ${mode}, model: ${modelId}`);

  let output;
  
  if (mode === 'i2v' && inputImage) {
    // Stable Video Diffusion - Best for image-to-video
    console.log('[ghost-video-gen] Using Stable Video Diffusion for i2v');
    output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
      {
        input: {
          input_image: inputImage,
          motion_bucket_id: 127,
          fps: 14,
          cond_aug: 0.02,
          decoding_t: 7,
          video_length: "14_frames_with_svd",
        }
      }
    );
  } else {
    // AnimateDiff Lightning - Fast text-to-video
    console.log('[ghost-video-gen] Using AnimateDiff Lightning for t2v');
    output = await replicate.run(
      "bytedance/animatediff-lightning-4-step:cb8b76c636226d66848e498c0f2e86fc4a36a7d10adcf5b3f0e1b68e3a0b7d8f",
      {
        input: {
          prompt: prompt,
          n_prompt: "bad quality, blurry, distorted, deformed",
          steps: 4,
          guidance_scale: 1.0,
          video_length: 16,
          fps: 8,
          width: 512,
          height: 512,
        }
      }
    );
  }

  console.log('[ghost-video-gen] Replicate output type:', typeof output, Array.isArray(output) ? 'array' : '');

  if (typeof output === 'string') {
    return { videoUrl: output };
  }

  if (Array.isArray(output) && output[0]) {
    return { videoUrl: output[0] };
  }

  // Handle object output (some models return {video: url})
  if (output && typeof output === 'object') {
    const videoUrl = (output as Record<string, unknown>).video || (output as Record<string, unknown>).output;
    if (typeof videoUrl === 'string') {
      return { videoUrl };
    }
  }

  throw new Error('No video URL returned from Replicate');
}

// Generate with Google Veo via Vertex AI
async function generateWithVeo(
  prompt: string,
  mode: 'i2v' | 't2v',
  inputImage?: string,
  duration: number = 5,
  aspectRatio: string = '16:9',
  model: string = 'veo-2'
): Promise<{ taskId: string } | { videoUrl: string }> {
  // Try Vertex AI first (requires service account)
  const GOOGLE_PROJECT_ID = Deno.env.get('GOOGLE_CLOUD_PROJECT') || Deno.env.get('GOOGLE_PROJECT_ID');
  const GOOGLE_ACCESS_TOKEN = Deno.env.get('GOOGLE_ACCESS_TOKEN');
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  
  const veoModel = model === 'veo-3' ? 'veo-003' : 'veo-002';
  
  console.log(`[ghost-video-gen] Generating with Google Veo ${veoModel}, mode: ${mode}, duration: ${duration}s`);

  // Method 1: Vertex AI (production - requires GCP project)
  if (GOOGLE_PROJECT_ID && GOOGLE_ACCESS_TOKEN) {
    const location = 'us-central1';
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${location}/publishers/google/models/${veoModel}:predict`;

    const instance: Record<string, unknown> = {
      prompt,
      duration_seconds: Math.min(duration, model === 'veo-3' ? 30 : 15),
      aspect_ratio: aspectRatio,
    };

    // Add image for i2v mode
    if (mode === 'i2v' && inputImage) {
      // Veo supports image conditioning
      if (inputImage.startsWith('data:')) {
        const base64Data = inputImage.split(',')[1];
        instance.image = { bytesBase64Encoded: base64Data };
      } else {
        instance.image = { uri: inputImage };
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          sampleCount: 1,
          safetyFilterLevel: 'block_some',
          personGeneration: 'allow_adult',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ghost-video-gen] Veo Vertex AI error:', response.status, errorText);
      // Fall through to try alternative method
    } else {
      const data = await response.json();
      console.log('[ghost-video-gen] Veo response:', JSON.stringify(data).substring(0, 500));

      // Veo returns async operation - check if completed or needs polling
      if (data.name) {
        // Long-running operation - return task ID for polling
        return { taskId: `veo:${data.name}` };
      }

      if (data.predictions?.[0]?.video?.uri) {
        return { videoUrl: data.predictions[0].video.uri };
      }

      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return { videoUrl: `data:video/mp4;base64,${data.predictions[0].bytesBase64Encoded}` };
      }
    }
  }

  // Method 2: Generative Language API (simpler, uses API key)
  if (GOOGLE_API_KEY) {
    console.log('[ghost-video-gen] Trying Veo via Generative Language API');
    
    const glEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:generateVideo?key=${GOOGLE_API_KEY}`;
    
    const glResponse = await fetch(glEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        config: {
          duration_seconds: Math.min(duration, 15),
          aspect_ratio: aspectRatio,
          sample_count: 1,
        },
      }),
    });

    if (glResponse.ok) {
      const glData = await glResponse.json();
      
      if (glData.name) {
        return { taskId: `veo:${glData.name}` };
      }

      if (glData.video?.uri) {
        return { videoUrl: glData.video.uri };
      }
    } else {
      console.error('[ghost-video-gen] Veo GL API error:', glResponse.status);
    }
  }

  throw new Error('Google Veo requires GOOGLE_CLOUD_PROJECT + GOOGLE_ACCESS_TOKEN or GOOGLE_API_KEY');
}

// Check Veo generation status
async function checkVeoStatus(taskId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const GOOGLE_ACCESS_TOKEN = Deno.env.get('GOOGLE_ACCESS_TOKEN');
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');

  // The taskId is the operation name from Vertex AI
  const operationName = taskId.replace('veo:', '');
  
  // Try Vertex AI endpoint
  if (GOOGLE_ACCESS_TOKEN) {
    const response = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/${operationName}`, {
      headers: {
        'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.done) {
        if (data.error) {
          return { status: 'failed', error: data.error.message };
        }
        
        const videoUri = data.response?.predictions?.[0]?.video?.uri ||
                        data.response?.predictions?.[0]?.uri;
        
        if (videoUri) {
          return { status: 'completed', videoUrl: videoUri };
        }
        
        // Check for base64 response
        if (data.response?.predictions?.[0]?.bytesBase64Encoded) {
          return { 
            status: 'completed', 
            videoUrl: `data:video/mp4;base64,${data.response.predictions[0].bytesBase64Encoded}` 
          };
        }
      }
      
      return { status: 'processing' };
    }
  }

  // Try Generative Language API
  if (GOOGLE_API_KEY) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GOOGLE_API_KEY}`,
    );

    if (response.ok) {
      const data = await response.json();
      
      if (data.done) {
        if (data.error) {
          return { status: 'failed', error: data.error.message };
        }
        if (data.response?.video?.uri) {
          return { status: 'completed', videoUrl: data.response.video.uri };
        }
      }
      
      return { status: 'processing' };
    }
  }

  return { status: 'processing' };
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
      let status;
      
      // Route to appropriate status checker
      if (body.taskId.startsWith('veo:')) {
        status = await checkVeoStatus(body.taskId);
      } else if (body.taskId.startsWith('luma:')) {
        status = await checkLumaStatus(body.taskId.replace('luma:', ''));
      } else {
        status = await checkRunwayStatus(body.taskId);
      }
      
      return new Response(
        JSON.stringify(status),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      case 'replicate':
        // Direct Replicate models - most reliable
        result = await generateWithReplicate(fullPrompt, mode, inputImage, model);
        break;
      case 'veo':
        result = await generateWithVeo(fullPrompt, mode, inputImage, duration, '16:9', model);
        break;
      case 'luma':
        // Luma disabled until API key is added
        return new Response(
          JSON.stringify({ error: 'Luma Dream Machine coming soon. Try Replicate SVD or AnimateDiff instead.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      case 'openai':
      case 'pika':
        // These are coming soon
        return new Response(
          JSON.stringify({ error: `${modelConfig.provider} video generation coming soon` }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      default:
        // Fallback to Replicate
        result = await generateWithReplicate(fullPrompt, mode, inputImage, model);
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
