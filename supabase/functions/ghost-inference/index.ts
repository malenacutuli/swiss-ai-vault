import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Ghost Inference - Zero-Retention AI Inference
 * 
 * Supports multiple providers:
 * - Modal (Swiss-hosted) - Private models
 * - OpenAI (GPT-5.2, O3, O1, GPT-4o)
 * - Anthropic (Claude Opus/Sonnet/Haiku)
 * - Google (Gemini 3/2.5/2.0)
 * - xAI (Grok)
 * - DeepSeek (V3.2, Coder)
 * - Qwen (via DashScope)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GhostRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  system_prompt?: string;
}

interface Message {
  role: string;
  content: string;
}

// Model routing configuration
const MODEL_ROUTES: Record<string, { provider: string; endpoint: string; modelName: string }> = {
  // Swiss-Hosted (Modal vLLM)
  'qwen2.5-3b': { provider: 'modal', endpoint: '', modelName: 'Qwen/Qwen2.5-3B-Instruct' },
  'qwen2.5-7b': { provider: 'modal', endpoint: '', modelName: 'Qwen/Qwen2.5-7B-Instruct' },
  'llama3.1-8b': { provider: 'modal', endpoint: '', modelName: 'meta-llama/Llama-3.1-8B-Instruct' },
  'mistral-7b': { provider: 'modal', endpoint: '', modelName: 'mistralai/Mistral-7B-Instruct-v0.3' },
  'qwen2.5-coder-7b': { provider: 'modal', endpoint: '', modelName: 'Qwen/Qwen2.5-Coder-7B-Instruct' },
  
  // OpenAI
  'gpt-5.2': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-5.2' },
  'gpt-5.2-mini': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-5.2-mini' },
  'o3': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'o3' },
  'o1': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'o1' },
  'o1-mini': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'o1-mini' },
  'gpt-4o': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-4o-mini' },
  
  // Anthropic
  'claude-opus-4.5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-opus-4-5-20250514' },
  'claude-sonnet-4.5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-sonnet-4-5-20250514' },
  'claude-haiku-4.5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-haiku-4-5-20250514' },
  'claude-sonnet-4': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-sonnet-4-20250514' },
  
  // Google
  'gemini-3-pro': { provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta', modelName: 'gemini-3-pro-preview' },
  'gemini-2.5-pro': { provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta', modelName: 'gemini-2.5-pro' },
  'gemini-2.0-flash': { provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta', modelName: 'gemini-2.0-flash' },
  'gemini-2.0-pro': { provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta', modelName: 'gemini-2.0-pro' },
  
  // xAI
  'grok-4.1': { provider: 'xai', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-41-fast' },
  'grok-3': { provider: 'xai', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-3' },
  'grok-2': { provider: 'xai', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-2' },
  
  // DeepSeek
  'deepseek-v3.2': { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', modelName: 'deepseek-v3.2' },
  'deepseek-v3': { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', modelName: 'deepseek-v3' },
  'deepseek-coder-v2': { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', modelName: 'deepseek-coder-v2' },
  
  // Qwen (via DashScope)
  'qwen3-235b': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'qwen3-235b-a22b-instruct' },
  'qwen3-235b-thinking': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'qwen3-235b-a22b-thinking' },
  'qwen3-coder-480b': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'qwen3-coder-480b' },
};

// Get Modal endpoint
function getModalEndpoint(): string {
  return Deno.env.get('MODAL_ENDPOINT') || 'https://swissvault--swissvault-inference-chat-completions.modal.run';
}

// Get API key for provider
function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case 'openai': return Deno.env.get('OPENAI_API_KEY');
    case 'anthropic': return Deno.env.get('ANTHROPIC_API_KEY');
    case 'google': return Deno.env.get('GOOGLE_API_KEY');
    case 'xai': return Deno.env.get('XAI_API_KEY');
    case 'deepseek': return Deno.env.get('DEEPSEEK_API_KEY');
    case 'qwen': return Deno.env.get('QWEN_API_KEY') || Deno.env.get('DASHSCOPE_API_KEY');
    case 'modal': return Deno.env.get('MODAL_API_KEY');
    default: return undefined;
  }
}

/**
 * Estimate token count from messages
 */
function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Estimate tokens from response text
 */
function estimateOutputTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Call OpenAI-compatible API (OpenAI, xAI, DeepSeek, Qwen)
 */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  modelName: string,
  messages: Message[],
  stream: boolean,
  temperature: number,
  topP: number,
  maxTokens: number
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: modelName,
    messages,
    stream,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
  };

  // O1/O3 models don't support temperature
  if (modelName.startsWith('o1') || modelName.startsWith('o3')) {
    delete body.temperature;
    body.max_completion_tokens = maxTokens;
    delete body.max_tokens;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  apiKey: string,
  modelName: string,
  messages: Message[],
  stream: boolean,
  temperature: number,
  maxTokens: number
): Promise<Response> {
  // Separate system message from others
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemMessages.map(m => m.content).join('\n'),
      messages: otherMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      stream,
      temperature,
    }),
  });
}

/**
 * Call Google Gemini API
 */
async function callGemini(
  apiKey: string,
  modelName: string,
  messages: Message[],
  stream: boolean,
  temperature: number,
  maxTokens: number
): Promise<Response> {
  const endpoint = stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const systemInstruction = messages.find(m => m.role === 'system');

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      ...(systemInstruction && {
        systemInstruction: { parts: [{ text: systemInstruction.content }] },
      }),
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });
}

/**
 * Call Modal (Swiss-hosted) API
 */
async function callModal(
  modelName: string,
  messages: Message[],
  stream: boolean,
  temperature: number,
  topP: number,
  maxTokens: number
): Promise<Response> {
  const endpoint = getModalEndpoint();
  const apiKey = getApiKey('modal');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      messages,
      stream,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    }),
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[Ghost Inference] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Ghost Inference] Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[Ghost Inference] User ${userId.slice(0, 8)}... authenticated`);

    // 2. Check user usage via RPC (includes admin bypass)
    const { data: usageCheck, error: usageError } = await supabase
      .rpc('check_user_usage', {
        p_user_id: userId,
        p_usage_type: 'text',
        p_estimated_cost_cents: 0
      });

    if (usageError) {
      console.error('[Ghost Inference] Usage check error:', usageError);
      // Don't block on RPC error - allow request to proceed
    }

    // Log admin status if detected
    if (usageCheck?.is_admin) {
      console.log(`[Ghost Inference] Admin user detected - bypassing credit limits`);
    }

    // Only block if explicitly not allowed AND not admin
    if (usageCheck && usageCheck.allowed === false && !usageCheck.is_admin) {
      console.log(`[Ghost Inference] Insufficient credits - reason: ${usageCheck.reason}`);
      return new Response(
        JSON.stringify({ 
          error: usageCheck.reason || 'Insufficient credits',
          balance: usageCheck.balance || 0,
          daily_remaining: usageCheck.daily_remaining || 0,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Ghost Inference] Credits OK - balance: ${usageCheck?.balance}, is_admin: ${usageCheck?.is_admin}`);

    // 3. Parse and validate request
    const body = await req.json() as GhostRequest;
    const { model, messages, stream = false, temperature = 0.7, top_p = 0.9, max_tokens = 4096, system_prompt } = body;

    // Prepend system prompt if provided
    const finalMessages = system_prompt 
      ? [{ role: 'system', content: system_prompt }, ...messages]
      : messages;

    if (!model || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: model and messages required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get model configuration
    const modelConfig = MODEL_ROUTES[model];
    if (!modelConfig) {
      console.log(`[Ghost Inference] Unknown model: ${model}, defaulting to qwen2.5-3b`);
      // Default to Swiss-hosted model
      const defaultModel = MODEL_ROUTES['qwen2.5-3b'];
      if (!defaultModel) {
        return new Response(
          JSON.stringify({ error: 'Model not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const config = modelConfig || MODEL_ROUTES['qwen2.5-3b'];
    const { provider, modelName } = config;

    // Check if provider API key is available
    if (provider !== 'modal') {
      const apiKey = getApiKey(provider);
      if (!apiKey) {
        console.log(`[Ghost Inference] API key not configured for ${provider}`);
        return new Response(
          JSON.stringify({ error: `${provider} API key not configured` }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate input tokens
    const inputTokens = estimateTokens(messages);
    console.log(`[Ghost Inference] Model: ${model} (${provider}/${modelName}), Input tokens: ~${inputTokens}, Stream: ${stream}`);

    // 5. Route to appropriate provider
    let providerResponse: Response;

    switch (provider) {
      case 'modal':
        providerResponse = await callModal(modelName, finalMessages, stream, temperature, top_p, max_tokens);
        break;
      
      case 'openai':
      case 'xai':
      case 'deepseek':
      case 'qwen':
        providerResponse = await callOpenAICompatible(
          config.endpoint,
          getApiKey(provider)!,
          modelName,
          finalMessages,
          stream,
          temperature,
          top_p,
          max_tokens
        );
        break;
      
      case 'anthropic':
        providerResponse = await callAnthropic(
          getApiKey('anthropic')!,
          modelName,
          finalMessages,
          stream,
          temperature,
          max_tokens
        );
        break;
      
      case 'google':
        providerResponse = await callGemini(
          getApiKey('google')!,
          modelName,
          finalMessages,
          stream,
          temperature,
          max_tokens
        );
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown provider' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      console.error(`[Ghost Inference] ${provider} error: ${providerResponse.status} - ${errorText.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ error: 'Inference failed', details: `${provider} service error` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Handle streaming response
    if (stream) {
      let outputTokenEstimate = 0;
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          const text = new TextDecoder().decode(chunk);
          outputTokenEstimate += Math.ceil(text.length / 4);
        },
        async flush() {
          const totalTokens = inputTokens + outputTokenEstimate;
          
          const serviceClient = createClient(
            supabaseUrl,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          // Skip credit deduction for admin users
          if (!usageCheck?.is_admin) {
            await serviceClient.rpc('deduct_ghost_credits', {
              p_user_id: userId,
              p_amount: totalTokens
            });
          }
          
          await serviceClient.from('ghost_usage').insert({
            user_id: userId,
            model_id: model,
            provider: provider,
            input_tokens: inputTokens,
            output_tokens: outputTokenEstimate,
            was_free_tier: usageCheck?.is_admin || false
          });
          
          console.log(`[Ghost Inference] Stream complete. Tokens: ${inputTokens}+${outputTokenEstimate}=${totalTokens}, Admin: ${usageCheck?.is_admin}`);
        }
      });

      const responseStream = providerResponse.body?.pipeThrough(transformStream);
      
      return new Response(responseStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // 7. Handle non-streaming response
    const responseData = await providerResponse.json();
    
    // Calculate output tokens from response
    let outputTokens = 0;
    if (responseData.usage?.completion_tokens) {
      outputTokens = responseData.usage.completion_tokens;
    } else if (responseData.choices?.[0]?.message?.content) {
      outputTokens = estimateOutputTokens(responseData.choices[0].message.content);
    } else if (responseData.content?.[0]?.text) {
      // Anthropic format
      outputTokens = estimateOutputTokens(responseData.content[0].text);
    } else if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
      // Gemini format
      outputTokens = estimateOutputTokens(responseData.candidates[0].content.parts[0].text);
    }
    
    const totalTokens = inputTokens + outputTokens;
    const processingTime = Date.now() - startTime;
    
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Skip credit deduction for admin users
    if (!usageCheck?.is_admin) {
      const { error: deductError } = await serviceClient.rpc('deduct_ghost_credits', {
        p_user_id: userId,
        p_amount: totalTokens
      });
      
      if (deductError) {
        console.error('[Ghost Inference] Credit deduction failed:', deductError);
      }
    }

    // Log usage
    await serviceClient.from('ghost_usage').insert({
      user_id: userId,
      model_id: model,
      provider: provider,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      was_free_tier: usageCheck?.is_admin || false
    });

    console.log(`[Ghost Inference] Complete. Tokens: ${inputTokens}+${outputTokens}=${totalTokens}, Time: ${processingTime}ms, Admin: ${usageCheck?.is_admin}`);

    // Normalize response format for non-OpenAI providers
    let normalizedResponse = responseData;
    
    // Convert Anthropic format to OpenAI format
    if (provider === 'anthropic' && responseData.content) {
      normalizedResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: responseData.content[0]?.text || ''
          },
          finish_reason: responseData.stop_reason
        }],
        usage: responseData.usage
      };
    }
    
    // Convert Gemini format to OpenAI format
    if (provider === 'google' && responseData.candidates) {
      normalizedResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: responseData.candidates[0]?.content?.parts?.[0]?.text || ''
          },
          finish_reason: responseData.candidates[0]?.finishReason
        }]
      };
    }

    return new Response(JSON.stringify(normalizedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Ghost Inference] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
