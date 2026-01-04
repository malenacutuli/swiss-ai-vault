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

// Model configurations - Updated January 2026
const MODEL_CONFIGS: Record<string, {
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'xai' | 'mistral' | 'meta';
  modelId: string;
  displayName: string;
}> = {
  // OpenAI
  'gpt-5.2': { provider: 'openai', modelId: 'gpt-5.2', displayName: 'GPT-5.2' },
  'gpt-5': { provider: 'openai', modelId: 'gpt-5', displayName: 'GPT-5' },
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o' },
  'o3': { provider: 'openai', modelId: 'o3', displayName: 'o3' },
  'o4-mini': { provider: 'openai', modelId: 'o4-mini', displayName: 'o4-mini' },
  // Anthropic
  'claude-4.5-opus': { provider: 'anthropic', modelId: 'claude-opus-4-5-20251101', displayName: 'Claude 4.5 Opus' },
  'claude-4-sonnet': { provider: 'anthropic', modelId: 'claude-sonnet-4-5', displayName: 'Claude 4 Sonnet' },
  'claude-3.5-haiku': { provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
  // Google
  'gemini-3.0-pro': { provider: 'google', modelId: 'gemini-3.0-pro', displayName: 'Gemini 3.0 Pro' },
  'gemini-2.5-pro': { provider: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
  'gemini-2.5-flash': { provider: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
  // DeepSeek
  'deepseek-r1': { provider: 'deepseek', modelId: 'deepseek-reasoner', displayName: 'DeepSeek R1' },
  'deepseek-v3': { provider: 'deepseek', modelId: 'deepseek-chat', displayName: 'DeepSeek V3' },
  // xAI
  'grok-3': { provider: 'xai', modelId: 'grok-3', displayName: 'Grok 3' },
  // Mistral
  'mistral-large': { provider: 'mistral', modelId: 'mistral-large-latest', displayName: 'Mistral Large 2' },
  // Meta (via Together API)
  'llama-4': { provider: 'meta', modelId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', displayName: 'Llama 4' },
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

async function callAnthropic(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  
  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.content?.[0]?.text || '',
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
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

async function callDeepSeek(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  });
  
  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callXAI(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  });
  
  if (!response.ok) throw new Error(`xAI error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callMeta(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  // Meta Llama via Together API
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  });
  
  if (!response.ok) throw new Error(`Meta/Together error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callMistral(prompt: string, modelId: string, apiKey: string): Promise<{ text: string; tokens: number }> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  });
  
  if (!response.ok) throw new Error(`Mistral error: ${response.status}`);
  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API keys
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
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
            if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
            result = await callOpenAI(fullPrompt, config.modelId, OPENAI_API_KEY);
            break;
          case 'anthropic':
            if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured');
            result = await callAnthropic(fullPrompt, config.modelId, ANTHROPIC_API_KEY);
            break;
          case 'google':
            if (!GOOGLE_API_KEY) throw new Error('Google API key not configured');
            result = await callGoogle(fullPrompt, config.modelId, GOOGLE_API_KEY);
            break;
          case 'deepseek':
            if (!DEEPSEEK_API_KEY) throw new Error('DeepSeek API key not configured');
            result = await callDeepSeek(fullPrompt, config.modelId, DEEPSEEK_API_KEY);
            break;
          case 'xai':
            if (!XAI_API_KEY) throw new Error('xAI API key not configured');
            result = await callXAI(fullPrompt, config.modelId, XAI_API_KEY);
            break;
          case 'mistral':
            if (!MISTRAL_API_KEY) throw new Error('Mistral API key not configured');
            result = await callMistral(fullPrompt, config.modelId, MISTRAL_API_KEY);
            break;
          case 'meta':
            if (!TOGETHER_API_KEY) throw new Error('Together API key not configured for Meta models');
            result = await callMeta(fullPrompt, config.modelId, TOGETHER_API_KEY);
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
