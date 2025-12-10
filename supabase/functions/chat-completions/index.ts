import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Model aliasing for deprecated models
const MODEL_ALIASES: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-20250514',
  'claude-3-5-sonnet': 'claude-sonnet-4-20250514',
  'claude-3-opus-20240229': 'claude-sonnet-4-20250514',
  'claude-opus-4-5-20251101': 'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001': 'claude-3-5-haiku-20241022',
};

function normalizeModelName(model: string): string {
  return MODEL_ALIASES[model] || model;
}

// Model routing configuration - only currently valid models
const MODEL_CONFIG: Record<string, { provider: string; isReasoning?: boolean }> = {
  // Anthropic (Valid models only)
  'claude-sonnet-4-20250514': { provider: 'anthropic' },
  'claude-3-5-haiku-20241022': { provider: 'anthropic' },
  
  // OpenAI (Including Reasoning Models)
  'o1': { provider: 'openai', isReasoning: true },
  'o1-mini': { provider: 'openai', isReasoning: true },
  'o1-pro': { provider: 'openai', isReasoning: true },
  'gpt-4o': { provider: 'openai' },
  'gpt-4o-mini': { provider: 'openai' },
  'gpt-4-turbo': { provider: 'openai' },
  
  // Google Gemini 2.0 (Latest)
  'gemini-2.0-flash-exp': { provider: 'google' },
  'gemini-2.0-flash-thinking-exp': { provider: 'google' },
  'gemini-1.5-pro': { provider: 'google' },
  'gemini-1.5-flash': { provider: 'google' },
};

// Open source models -> route to vLLM
const VLLM_MODELS = [
  'Qwen/Qwen2.5-0.5B-Instruct', 'Qwen/Qwen2.5-1.5B-Instruct',
  'Qwen/Qwen2.5-3B-Instruct', 'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen2.5-Coder-7B-Instruct',
  'meta-llama/Llama-3.2-1B-Instruct', 'meta-llama/Llama-3.2-3B-Instruct',
  'meta-llama/Llama-3.1-8B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'google/gemma-2-2b-it', 'google/gemma-2-9b-it',
  'microsoft/Phi-3.5-mini-instruct',
  'codellama/CodeLlama-7b-Instruct-hf',
  'deepseek-ai/deepseek-coder-7b-instruct-v1.5',
  // Short names
  'qwen2.5-0.5b', 'qwen2.5-1.5b', 'qwen2.5-3b', 'qwen2.5-7b', 'qwen2.5-coder-7b',
  'llama3.2-1b', 'llama3.2-3b', 'llama3.1-8b',
  'mistral-7b', 'gemma2-2b', 'gemma2-9b', 'phi3.5-mini',
  'codellama-7b', 'deepseek-coder-7b',
];

function getProvider(model: string): 'openai' | 'anthropic' | 'google' | 'vllm' {
  if (MODEL_CONFIG[model]) return MODEL_CONFIG[model].provider as any;
  if (model.startsWith('sv-')) return 'vllm';
  if (model.startsWith('gpt-') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  if (VLLM_MODELS.includes(model)) return 'vllm';
  const vllmPrefixes = ['qwen', 'llama', 'mistral', 'gemma', 'phi', 'deepseek', 'codellama'];
  if (vllmPrefixes.some(p => model.toLowerCase().includes(p))) return 'vllm';
  return 'openai';
}

async function callAnthropic(messages: any[], model: string, options: any) {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  let systemPrompt = '';
  const anthropicMessages = messages.filter(m => {
    if (m.role === 'system') { systemPrompt = m.content; return false; }
    return true;
  }).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const requestBody: any = {
    model: model.trim(),
    max_tokens: options.maxTokens || 4096,
    messages: anthropicMessages,
  };
  if (systemPrompt) requestBody.system = systemPrompt;
  if (options.temperature !== undefined) requestBody.temperature = options.temperature;

  console.log('[Anthropic] Request:', { model: requestBody.model, messageCount: anthropicMessages.length });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log('[Anthropic] Response status:', response.status);

  if (!response.ok) {
    let errorMessage = `Anthropic API error: ${response.status}`;
    try { const err = JSON.parse(responseText); errorMessage = err.error?.message || errorMessage; } catch {}
    throw new Error(errorMessage);
  }

  const data = JSON.parse(responseText);
  return {
    id: data.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [{ index: 0, message: { role: 'assistant', content: data.content[0]?.text || '' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0, total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) },
  };
}

async function callOpenAI(messages: any[], model: string, options: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const isReasoning = MODEL_CONFIG[model]?.isReasoning || model.startsWith('o1');
  const requestBody: any = { model, messages };

  if (isReasoning) {
    requestBody.max_completion_tokens = options.maxTokens || 4096;
  } else {
    requestBody.max_tokens = options.maxTokens || 4096;
    if (options.temperature !== undefined) requestBody.temperature = options.temperature;
  }

  console.log('[OpenAI] Request:', { model, isReasoning });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  return await response.json();
}

async function callGoogle(messages: any[], model: string, options: any) {
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const systemInstruction = messages.find(m => m.role === 'system');
  const requestBody: any = {
    contents,
    generationConfig: { maxOutputTokens: options.maxTokens || 4096, temperature: options.temperature || 0.7 },
  };
  if (systemInstruction) requestBody.systemInstruction = { parts: [{ text: systemInstruction.content }] };

  console.log('[Google] Request:', { model });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    id: `gemini-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: data.usageMetadata?.promptTokenCount || 0, completion_tokens: data.usageMetadata?.candidatesTokenCount || 0, total_tokens: data.usageMetadata?.totalTokenCount || 0 },
  };
}

async function callVLLM(messages: any[], model: string, options: any) {
  const VLLM_ENDPOINT = Deno.env.get('VLLM_ENDPOINT');
  
  if (!VLLM_ENDPOINT) {
    console.error('[vLLM] VLLM_ENDPOINT not configured');
    throw new Error('Open-source models are temporarily unavailable. Please select Claude, GPT, or Gemini.');
  }

  console.log('[vLLM] Calling Modal endpoint:', { 
    endpoint: VLLM_ENDPOINT.substring(0, 50) + '...', 
    model,
    maxTokens: options.maxTokens || 1024 
  });

  // 90-second timeout to handle Modal cold starts (can take 30-60s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[vLLM] Request timeout after 90 seconds');
    controller.abort();
  }, 90000);

  try {
    const startTime = Date.now();
    
    const response = await fetch(VLLM_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        model, 
        messages, 
        max_tokens: options.maxTokens || 1024, 
        temperature: options.temperature || 0.7,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[vLLM] Response received in ${duration}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[vLLM] Error response:', response.status, errorText);
      
      if (response.status === 503 || response.status === 504) {
        throw new Error('The model is warming up. Please wait 30-60 seconds and try again.');
      }
      
      throw new Error(`Model error (${response.status}): ${errorText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    console.log('[vLLM] Success:', { 
      model,
      duration: `${duration}ms`,
      hasContent: !!data.choices?.[0]?.message?.content 
    });
    
    return data;
    
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[vLLM] Request aborted - timeout after 90s');
      throw new Error(
        'The model is taking too long to start (cold start). ' +
        'Open-source models may need 30-60 seconds to warm up on first use. ' +
        'Please try again, or select a commercial model (Claude, GPT, Gemini).'
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[vLLM] Request failed:', errorMessage);
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Verify authentication - JWT is required (verify_jwt = true in config.toml)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validate the user session
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("EXTERNAL_SUPABASE_PUBLISHABLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[chat-completions] Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Only log user ID when NOT in zero-retention mode (checked after parsing body)
    const body = await req.json();
    const { model: rawModel, messages, max_tokens, temperature, rag_context, zero_retention } = body;
    
    // Conditional logging based on zero-retention mode
    if (!zero_retention) {
      console.log('[chat-completions] Authenticated user:', user.id);
    } else {
      console.log('[chat-completions] Zero-retention mode active - minimal logging');
    }

    if (!rawModel || !messages) {
      return new Response(JSON.stringify({ error: 'Missing model or messages' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Normalize model name (handle deprecated aliases)
    const model = normalizeModelName(rawModel);
    if (model !== rawModel && !zero_retention) {
      console.log('[chat-completions] Aliased model:', rawModel, '->', model);
    }

    // Only log detailed request info when NOT in zero-retention mode
    if (!zero_retention) {
      console.log('[chat-completions] Model:', model, 'Provider:', getProvider(model), 'RAG context:', rag_context ? 'yes' : 'no');
    }

    // Inject RAG context as system message if provided
    let processedMessages = [...messages];
    if (rag_context) {
      // Check if there's already a system message
      const hasSystemMessage = processedMessages.some(m => m.role === 'system');
      if (hasSystemMessage) {
        // Prepend RAG context to existing system message
        processedMessages = processedMessages.map(m => 
          m.role === 'system' 
            ? { ...m, content: `${rag_context}\n\n---\n\n${m.content}` }
            : m
        );
      } else {
        // Add RAG context as new system message at the beginning
        processedMessages.unshift({ role: 'system', content: rag_context });
      }
      if (!zero_retention) {
        console.log('[chat-completions] Injected RAG context into messages');
      }
    }

    const options = { maxTokens: max_tokens, temperature };
    let result;
    const provider = getProvider(model);

    switch (provider) {
      case 'anthropic': result = await callAnthropic(processedMessages, model, options); break;
      case 'google': result = await callGoogle(processedMessages, model, options); break;
      case 'vllm': result = await callVLLM(processedMessages, model, options); break;
      default: result = await callOpenAI(processedMessages, model, options); break;
    }

    // Track which model actually responded (from API response or requested)
    const actualModelUsed = result.model || model;

    // Build response headers with zero-retention indicators and model tracking
    const responseHeaders: Record<string, string> = { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'X-Zero-Retention': zero_retention ? 'true' : 'false',
      'X-Storage-Mode': zero_retention ? 'local-only' : 'encrypted-cloud',
      'X-Model-Requested': rawModel,
      'X-Model-Used': actualModelUsed,
      'X-Provider': provider,
    };

    return new Response(JSON.stringify(result), { headers: responseHeaders });
  } catch (error: unknown) {
    // Only log errors with details when NOT in zero-retention mode
    // Note: We can't check zero_retention here as it may have failed during parsing
    console.error('[chat-completions] Error:', error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: { message: errorMessage } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
