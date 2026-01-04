// ===========================================
// GHOST COMPARE - Multi-Model Comparison
// Sends prompt to multiple models in parallel
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Model configurations - Real API model IDs
const MODEL_CONFIGS: Record<string, {
  provider: 'openai' | 'google' | 'swissvault';
  modelId: string;
  displayName: string;
}> = {
  // SwissVault (aliased to OpenAI for reliability)
  'swissvault-1.0': { provider: 'swissvault', modelId: 'gpt-4o-mini', displayName: 'SwissVault 1.0' },
  'swissvault-pro': { provider: 'swissvault', modelId: 'gpt-4o', displayName: 'SwissVault Pro' },
  'swissvault-code': { provider: 'swissvault', modelId: 'gpt-4o-mini', displayName: 'SwissVault Code' },
  'swissvault-fast': { provider: 'swissvault', modelId: 'gpt-4o-mini', displayName: 'SwissVault Fast' },
  // OpenAI
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o' },
  'gpt-4o-mini': { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
  'o1': { provider: 'openai', modelId: 'o1', displayName: 'o1' },
  'o1-mini': { provider: 'openai', modelId: 'o1-mini', displayName: 'o1 Mini' },
  'o3-mini': { provider: 'openai', modelId: 'o3-mini', displayName: 'o3 Mini' },
  'o3': { provider: 'openai', modelId: 'o3', displayName: 'o3' },
  'o4-mini': { provider: 'openai', modelId: 'o4-mini', displayName: 'o4 Mini' },
  'gpt-5.2': { provider: 'openai', modelId: 'gpt-5.2', displayName: 'GPT-5.2' },
  'gpt-5.2-mini': { provider: 'openai', modelId: 'gpt-5.2-mini', displayName: 'GPT-5.2 Mini' },
  // Google
  'gemini-3-pro': { provider: 'google', modelId: 'gemini-2.5-pro-preview-06-05', displayName: 'Gemini 3 Pro' },
  'gemini-3-flash': { provider: 'google', modelId: 'gemini-2.5-flash-preview-05-20', displayName: 'Gemini 3 Flash' },
  'gemini-2.5-pro': { provider: 'google', modelId: 'gemini-2.5-pro-preview-06-05', displayName: 'Gemini 2.5 Pro' },
  'gemini-2.5-flash': { provider: 'google', modelId: 'gemini-2.5-flash-preview-05-20', displayName: 'Gemini 2.5 Flash' },
  'gemini-2.5-flash-lite': { provider: 'google', modelId: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.5 Flash-Lite' },
  'gemini-2.0-flash': { provider: 'google', modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
  'gemini-2.0-pro': { provider: 'google', modelId: 'gemini-2.0-pro-exp', displayName: 'Gemini 2.0 Pro' },
  'gemini-1.5-pro': { provider: 'google', modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
};

// Provider API calls
async function callOpenAI(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callGoogle(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  );
  
  if (!response.ok) throw new Error(`Google error: ${response.status}`);
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
    const { prompt, models, systemPrompt } = await req.json();

    if (!prompt) throw new Error('Prompt is required');
    if (!models || models.length < 2) throw new Error('At least 2 models required');
    if (models.length > 4) throw new Error('Maximum 4 models allowed');

    console.log(`[ghost-compare] Comparing ${models.length} models: ${models.join(', ')}`);

    // Execute all model calls in parallel
    const results = await Promise.allSettled(
      models.map(async (modelKey: string) => {
        const config = MODEL_CONFIGS[modelKey];
        if (!config) throw new Error(`Unknown model: ${modelKey}`);

        const startTime = Date.now();
        let result: { text: string; tokens: number };

        const fullPrompt = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${prompt}` 
          : prompt;

        switch (config.provider) {
          case 'openai':
          case 'swissvault':
            if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
            result = await callOpenAI(fullPrompt, config.modelId, OPENAI_API_KEY);
            break;
          case 'google':
            if (!GOOGLE_API_KEY) throw new Error('Google API key not configured');
            result = await callGoogle(fullPrompt, config.modelId, GOOGLE_API_KEY);
            break;
          default:
            throw new Error(`Unsupported provider: ${config.provider}`);
        }

        const latency = Date.now() - startTime;

        return {
          model: modelKey,
          displayName: config.displayName,
          provider: config.provider,
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
        return {
          model: models[index],
          displayName: config?.displayName || models[index],
          provider: config?.provider || 'unknown',
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
