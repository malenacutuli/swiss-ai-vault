// ===========================================
// GHOST COMPARE - Multi-Model Comparison
// Sends prompt to multiple models in parallel
// Supports multimodal (images + text) content
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Image attachment interface
interface ImageAttachment {
  base64: string;
  name: string;
  mimeType?: string;
}

// Model configurations with vision capability
const MODEL_CONFIGS: Record<string, {
  provider: 'openai' | 'google' | 'swissvault';
  modelId: string;
  displayName: string;
  supportsVision: boolean;
}> = {
  // SwissVault (aliased to underlying models)
  'swissvault-1.0': { provider: 'google', modelId: 'gemini-2.5-flash-lite', displayName: 'SwissVault 1.0', supportsVision: true },
  'swissvault-pro': { provider: 'openai', modelId: 'gpt-4o', displayName: 'SwissVault Pro', supportsVision: true },
  'swissvault-code': { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'SwissVault Code', supportsVision: true },
  'swissvault-fast': { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'SwissVault Fast', supportsVision: true },
  // OpenAI
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o', supportsVision: true },
  'gpt-4o-mini': { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', supportsVision: true },
  'o1': { provider: 'openai', modelId: 'o1', displayName: 'o1', supportsVision: false },
  'o1-mini': { provider: 'openai', modelId: 'o1-mini', displayName: 'o1 Mini', supportsVision: false },
  'o3-mini': { provider: 'openai', modelId: 'o3-mini', displayName: 'o3 Mini', supportsVision: false },
  'o3': { provider: 'openai', modelId: 'o1', displayName: 'o3', supportsVision: false },
  'o4-mini': { provider: 'openai', modelId: 'o1-mini', displayName: 'o4 Mini', supportsVision: false },
  'gpt-5.2': { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-5.2', supportsVision: true },
  'gpt-5.2-mini': { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-5.2 Mini', supportsVision: true },
  // Google
  'gemini-3-pro': { provider: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 3 Pro', supportsVision: true },
  'gemini-3-flash': { provider: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 3 Flash', supportsVision: true },
  'gemini-2.5-pro': { provider: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportsVision: true },
  'gemini-2.5-flash': { provider: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportsVision: true },
  'gemini-2.5-flash-lite': { provider: 'google', modelId: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', supportsVision: true },
  'gemini-2.0-flash': { provider: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.0 Flash (Legacy)', supportsVision: true },
  'gemini-2.0-pro': { provider: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.0 Pro (Legacy)', supportsVision: true },
  'gemini-1.5-pro': { provider: 'google', modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportsVision: true },
};

// OpenAI API call with multimodal support
async function callOpenAI(
  prompt: string, 
  modelId: string, 
  apiKey: string,
  images?: ImageAttachment[]
): Promise<{ text: string; tokens: number }> {
  // Build content - either simple string or multimodal array
  let content: any = prompt;
  
  if (images && images.length > 0) {
    content = [
      // Add images first
      ...images.map(img => ({
        type: 'image_url',
        image_url: { 
          url: img.base64,
          detail: 'auto' 
        }
      })),
      // Then the text prompt
      { type: 'text', text: prompt }
    ];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ghost-compare] OpenAI error: ${response.status}`, errorText);
    throw new Error(`OpenAI error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

// Google API call with multimodal support
async function callGoogle(
  prompt: string, 
  modelId: string, 
  apiKey: string,
  images?: ImageAttachment[]
): Promise<{ text: string; tokens: number }> {
  // Build parts array for multimodal content
  const parts: any[] = [];
  
  // Add images first if present
  if (images && images.length > 0) {
    images.forEach(img => {
      // Extract mime type and base64 data from data URL
      const match = img.base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      } else {
        // If not a data URL, assume it's raw base64 PNG
        parts.push({
          inline_data: {
            mime_type: img.mimeType || 'image/png',
            data: img.base64
          }
        });
      }
    });
  }
  
  // Add the text prompt
  parts.push({ text: prompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
      }),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ghost-compare] Google error: ${response.status}`, errorText);
    throw new Error(`Google error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokens: data.usageMetadata?.totalTokenCount || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API keys
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    
    const { prompt, models, systemPrompt, images } = await req.json();

    if (!prompt) throw new Error('Prompt is required');
    if (!models || models.length < 2) throw new Error('At least 2 models required');
    if (models.length > 4) throw new Error('Maximum 4 models allowed');

    const hasImages = images && images.length > 0;
    console.log(`[ghost-compare] Comparing ${models.length} models: ${models.join(', ')}, images: ${hasImages ? images.length : 0}`);

    // Execute all model calls in parallel
    const results = await Promise.allSettled(
      models.map(async (modelKey: string) => {
        const config = MODEL_CONFIGS[modelKey];
        if (!config) throw new Error(`Unknown model: ${modelKey}`);

        // Check if model supports vision when images are present
        if (hasImages && !config.supportsVision) {
          throw new Error(`Model ${modelKey} does not support vision`);
        }

        const startTime = Date.now();
        let result: { text: string; tokens: number };

        const fullPrompt = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${prompt}` 
          : prompt;

        // Only pass images to vision-capable models
        const modelImages = config.supportsVision ? images : undefined;

        switch (config.provider) {
          case 'openai':
          case 'swissvault':
            if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
            result = await callOpenAI(fullPrompt, config.modelId, OPENAI_API_KEY, modelImages);
            break;
          case 'google':
            if (!GOOGLE_API_KEY) throw new Error('Google API key not configured');
            result = await callGoogle(fullPrompt, config.modelId, GOOGLE_API_KEY, modelImages);
            break;
          default:
            throw new Error(`Unsupported provider: ${config.provider}`);
        }

        const latency = Date.now() - startTime;

        // Mask provider for SwissVault models (don't expose underlying Google/OpenAI)
        const displayProvider = modelKey.startsWith('swissvault') ? 'SwissVault' : config.provider;
        
        return {
          model: modelKey,
          displayName: config.displayName,
          provider: displayProvider,
          response: result.text,
          tokens: result.tokens,
          latency,
          status: 'complete' as const,
        };
      })
    );

    // Process results
    const responses = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const config = MODEL_CONFIGS[models[index]];
        const modelKey = models[index];
        // Mask provider for SwissVault models even in error case
        const displayProvider = modelKey.startsWith('swissvault') ? 'SwissVault' : (config?.provider || 'unknown');
        return {
          model: modelKey,
          displayName: config?.displayName || modelKey,
          provider: displayProvider,
          response: null,
          error: result.reason?.message || 'Unknown error',
          tokens: 0,
          latency: 0,
          status: 'error' as const,
        };
      }
    });

    console.log(`[ghost-compare] Complete. Success: ${responses.filter(r => r.status === 'complete').length}/${responses.length}`);

    return new Response(JSON.stringify({
      prompt,
      responses,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[ghost-compare] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
