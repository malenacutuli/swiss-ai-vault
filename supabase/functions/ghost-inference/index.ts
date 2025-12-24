import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// ENDPOINT CONFIGURATION
// ============================================

const SWISS_ENDPOINTS: Record<string, string> = {
  'swissvault-1.0': 'https://axessible-labs--swissvault-main-main-chat.modal.run',
  'swissvault-fast': 'https://axessible-labs--swissvault-fast-fast-chat.modal.run',
  'swissvault-code': 'https://axessible-labs--swissvault-code-code-chat.modal.run',
  'llama3.1-8b': 'https://axessible-labs--swissvault-llama8b-llama8b-chat.modal.run',
  'mistral-7b': 'https://axessible-labs--swissvault-mistral-mistral-chat.modal.run',
  // Aliases
  'qwen2.5-3b': 'https://axessible-labs--swissvault-main-main-chat.modal.run',
  'qwen2.5-0.5b': 'https://axessible-labs--swissvault-fast-fast-chat.modal.run',
  'qwen2.5-coder-7b': 'https://axessible-labs--swissvault-code-code-chat.modal.run',
};

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o1-preview', 'gpt-5.2', 'gpt-5.2-mini', 'o3'];
const ANTHROPIC_MODELS = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-sonnet-4', 'claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5'];
const GOOGLE_MODELS = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-3-pro'];
const XAI_MODELS = ['grok-4.1', 'grok-3', 'grok-2'];
const DEEPSEEK_MODELS = ['deepseek-v3.2', 'deepseek-v3', 'deepseek-coder-v2'];
const QWEN_MODELS = ['qwen3-235b', 'qwen3-235b-thinking', 'qwen3-coder-480b'];

// Models that don't support streaming
const NON_STREAMING_MODELS = ['o1', 'o1-mini', 'o1-preview'];

// Models that need special parameter handling (no temperature/top_p)
const REASONING_MODELS = ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getProvider(model: string): 'modal' | 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'qwen' {
  if (SWISS_ENDPOINTS[model]) return 'modal';
  if (OPENAI_MODELS.some(m => model.includes(m))) return 'openai';
  if (ANTHROPIC_MODELS.some(m => model.includes(m))) return 'anthropic';
  if (GOOGLE_MODELS.some(m => model.includes(m))) return 'google';
  if (XAI_MODELS.some(m => model.includes(m))) return 'xai';
  if (DEEPSEEK_MODELS.some(m => model.includes(m))) return 'deepseek';
  if (QWEN_MODELS.some(m => model.includes(m))) return 'qwen';
  // Default to modal for unknown models (assume Swiss-hosted)
  return 'modal';
}

function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case 'openai': return Deno.env.get('OPENAI_API_KEY');
    case 'anthropic': return Deno.env.get('ANTHROPIC_API_KEY');
    case 'google': return Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GEMINI_API_KEY');
    case 'xai': return Deno.env.get('XAI_API_KEY');
    case 'deepseek': return Deno.env.get('DEEPSEEK_API_KEY');
    case 'qwen': return Deno.env.get('QWEN_API_KEY') || Deno.env.get('DASHSCOPE_API_KEY');
    default: return undefined;
  }
}

function isReasoningModel(model: string): boolean {
  return REASONING_MODELS.some(m => model.includes(m));
}

function supportsStreaming(model: string): boolean {
  return !NON_STREAMING_MODELS.some(m => model.includes(m));
}

function estimateTokens(messages: any[]): number {
  const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  return Math.ceil(totalChars / 4);
}

// ============================================
// MODAL (SWISS) HANDLER - NON-STREAMING JSON
// ============================================

async function callModal(
  endpoint: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number }
): Promise<{ content: string; usage?: any; responseTimeMs?: number }> {
  console.log('[Modal] Calling endpoint:', endpoint);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Modal] Error response:', response.status, errorText);
      throw new Error(`Modal error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[Modal] Response received, content length:', data.choices?.[0]?.message?.content?.length);
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      responseTimeMs: data.response_time_ms,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Modal request timed out after 120 seconds');
    }
    throw error;
  }
}

// ============================================
// OPENAI HANDLER
// ============================================

async function callOpenAI(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('openai');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  
  const isReasoning = isReasoningModel(model);
  const canStream = supportsStreaming(model) && options.stream;
  
  // Build request body with proper parameters
  // IMPORTANT: OpenAI now requires max_completion_tokens for ALL models
  const body: any = {
    model,
    messages,
    stream: canStream,
    max_completion_tokens: options.maxTokens || 4096,  // Always use max_completion_tokens
  };
  
  // Reasoning models (o1, o3) don't support temperature or top_p
  if (!isReasoning) {
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }
  }
  
  console.log('[OpenAI] Request:', { model, isReasoning, canStream, messageCount: messages.length });
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] Error:', response.status, errorText);
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }
  
  if (canStream && response.body) {
    return response.body;
  }
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// ============================================
// ANTHROPIC HANDLER
// ============================================

async function callAnthropic(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  
  // Map display names to API model names - CORRECTED model names
  const modelMap: Record<string, string> = {
    // Claude 3 family
    'claude-3-haiku': 'claude-3-haiku-20240307',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-opus': 'claude-3-opus-20240229',
    // Claude 3.5 family
    'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
    'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
    // Claude 4 family - CORRECT official names
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'claude-opus-4.5': 'claude-opus-4-20250514',  // Map to opus-4 until 4.5 exists
    'claude-sonnet-4.5': 'claude-sonnet-4-20250514',
    'claude-haiku-4.5': 'claude-3-5-haiku-20241022',  // Fallback to 3.5 haiku
    // Short aliases
    'claude-haiku': 'claude-3-5-haiku-20241022',
    'claude-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-opus': 'claude-3-opus-20240229',
  };
  
  const apiModel = modelMap[model] || model;
  
  // Extract system message
  let systemPrompt = '';
  const anthropicMessages = messages.filter(m => {
    if (m.role === 'system') {
      systemPrompt = m.content;
      return false;
    }
    return true;
  }).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  
  const body: any = {
    model: apiModel,
    max_tokens: options.maxTokens || 4096,
    messages: anthropicMessages,
    stream: options.stream || false,
  };
  
  if (systemPrompt) body.system = systemPrompt;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  
  console.log('[Anthropic] Request:', { model: apiModel, messageCount: anthropicMessages.length });
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Anthropic] Error:', response.status, errorText);
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }
  
  if (options.stream && response.body) {
    return response.body;
  }
  
  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    usage: {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

// ============================================
// GOOGLE HANDLER
// ============================================

async function callGoogle(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number }
): Promise<{ content: string; usage?: any }> {
  const apiKey = getApiKey('google');
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');
  
  const modelMap: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-2.0-flash-exp',
    'gemini-2.0-pro': 'gemini-2.0-pro-exp',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-3-pro': 'gemini-3-pro-preview',
  };
  
  const googleModel = modelMap[model] || model;
  
  // Convert to Gemini format
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  
  const systemInstruction = messages.find(m => m.role === 'system');
  
  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
    },
  };
  
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Google] Error:', response.status, errorText);
    throw new Error(`Google error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  };
}

// ============================================
// XAI HANDLER
// ============================================

async function callXAI(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('xai');
  if (!apiKey) throw new Error('XAI_API_KEY not configured');
  
  const modelMap: Record<string, string> = {
    'grok-4.1': 'grok-41-fast',
    'grok-3': 'grok-3',
    'grok-2': 'grok-2',
  };
  
  const xaiModel = modelMap[model] || model;
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: xaiModel,
      messages,
      stream: options.stream || false,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[xAI] Error:', response.status, errorText);
    throw new Error(`xAI error ${response.status}: ${errorText}`);
  }
  
  if (options.stream && response.body) {
    return response.body;
  }
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// ============================================
// DEEPSEEK HANDLER
// ============================================

async function callDeepSeek(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('deepseek');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: options.stream || false,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DeepSeek] Error:', response.status, errorText);
    throw new Error(`DeepSeek error ${response.status}: ${errorText}`);
  }
  
  if (options.stream && response.body) {
    return response.body;
  }
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// ============================================
// QWEN HANDLER
// ============================================

async function callQwen(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('qwen');
  if (!apiKey) throw new Error('QWEN_API_KEY not configured');
  
  const modelMap: Record<string, string> = {
    'qwen3-235b': 'qwen3-235b-a22b-instruct',
    'qwen3-235b-thinking': 'qwen3-235b-a22b-thinking',
    'qwen3-coder-480b': 'qwen3-coder-480b',
  };
  
  const qwenModel = modelMap[model] || model;
  
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: qwenModel,
      messages,
      stream: options.stream || false,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Qwen] Error:', response.status, errorText);
    throw new Error(`Qwen error ${response.status}: ${errorText}`);
  }
  
  if (options.stream && response.body) {
    return response.body;
  }
  
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// ============================================
// AUTO MODEL SELECTION
// ============================================

function selectAutoModel(messages: any[]): string {
  const fullText = messages.map(m => m.content || '').join(' ').toLowerCase();
  const wordCount = fullText.split(/\s+/).length;
  
  // Code detection
  const codeKeywords = ['code', 'debug', 'function', 'error', 'programming', 'javascript', 'python', 'typescript'];
  if (codeKeywords.some(kw => fullText.includes(kw))) {
    return 'swissvault-code';
  }
  
  // Simple/fast queries
  if (wordCount < 30) {
    return 'swissvault-fast';
  }
  
  // Default
  return 'swissvault-1.0';
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    // 1. Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
    }

    // Only block if explicitly not allowed AND not admin
    if (usageCheck && usageCheck.allowed === false && !usageCheck.is_admin) {
      console.log(`[Ghost Inference] Insufficient credits - reason: ${usageCheck.reason}`);
      return new Response(
        JSON.stringify({ 
          error: usageCheck.reason || 'Insufficient credits',
          balance: usageCheck.balance || 0,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request
    const { model: requestedModel, messages, max_tokens, temperature, top_p, stream, system_prompt } = await req.json();
    
    // Handle auto model selection
    let model = requestedModel || 'swissvault-1.0';
    if (model === 'auto') {
      model = selectAutoModel(messages);
      console.log('[Ghost Inference] Auto selected model:', model);
    }
    
    // Prepend system prompt if provided
    const finalMessages = system_prompt 
      ? [{ role: 'system', content: system_prompt }, ...messages]
      : messages;
    
    const provider = getProvider(model);
    console.log('[Ghost Inference] Request:', { model, provider, stream, messageCount: messages?.length });
    
    const options = { maxTokens: max_tokens, temperature, topP: top_p, stream };
    
    // ==========================================
    // MODAL (SWISS-HOSTED) - Always non-streaming JSON
    // ==========================================
    if (provider === 'modal') {
      const endpoint = SWISS_ENDPOINTS[model] || SWISS_ENDPOINTS['swissvault-1.0'];
      
      try {
        const result = await callModal(endpoint, finalMessages, options);
        const inputTokens = estimateTokens(finalMessages);
        const outputTokens = Math.ceil((result.content?.length || 0) / 4);
        
        // Log usage
        const serviceClient = createClient(
          supabaseUrl,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        try {
          if (!usageCheck?.is_admin) {
            await serviceClient.rpc('deduct_ghost_credits', {
              p_user_id: userId,
              p_amount: inputTokens + outputTokens
            });
          }
        } catch (creditErr) {
          console.error('[Ghost Inference] Credit deduction error:', creditErr);
        }
        
        try {
          await serviceClient.from('ghost_usage').insert({
            user_id: userId,
            model_id: model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            provider: 'modal',
            modality: 'text',
            generation_time_ms: result.responseTimeMs || (Date.now() - startTime),
          });
        } catch (usageErr) {
          console.error('[Ghost Inference] Usage log error:', usageErr);
        }
        
        // Return as JSON (NOT SSE) - this is the key fix!
        return new Response(
          JSON.stringify({
            id: `chatcmpl-swiss-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage || { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
            response_time_ms: result.responseTimeMs || (Date.now() - startTime),
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json', // NOT text/event-stream!
            },
          }
        );
      } catch (error: unknown) {
        console.error('[Modal] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'Swiss inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // OPENAI
    // ==========================================
    if (provider === 'openai') {
      try {
        const canStream = supportsStreaming(model) && stream;
        const result = await callOpenAI(model, finalMessages, { ...options, stream: canStream });
        
        if (result instanceof ReadableStream) {
          return new Response(result, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-openai-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[OpenAI] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'OpenAI inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // ANTHROPIC
    // ==========================================
    if (provider === 'anthropic') {
      try {
        const result = await callAnthropic(model, finalMessages, options);
        
        if (result instanceof ReadableStream) {
          return new Response(result, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });
        }
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-anthropic-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[Anthropic] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'Anthropic inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // GOOGLE
    // ==========================================
    if (provider === 'google') {
      try {
        const result = await callGoogle(model, finalMessages, options);
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-google-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[Google] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'Google inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // XAI
    // ==========================================
    if (provider === 'xai') {
      try {
        const result = await callXAI(model, finalMessages, options);
        
        if (result instanceof ReadableStream) {
          return new Response(result, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });
        }
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-xai-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[xAI] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'xAI inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // DEEPSEEK
    // ==========================================
    if (provider === 'deepseek') {
      try {
        const result = await callDeepSeek(model, finalMessages, options);
        
        if (result instanceof ReadableStream) {
          return new Response(result, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });
        }
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-deepseek-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[DeepSeek] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'DeepSeek inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // QWEN
    // ==========================================
    if (provider === 'qwen') {
      try {
        const result = await callQwen(model, finalMessages, options);
        
        if (result instanceof ReadableStream) {
          return new Response(result, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });
        }
        
        return new Response(
          JSON.stringify({
            id: `chatcmpl-qwen-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: result.content },
              finish_reason: 'stop',
            }],
            usage: result.usage,
            response_time_ms: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: unknown) {
        console.error('[Qwen] Call failed:', error);
        return new Response(
          JSON.stringify({ error: 'Qwen inference failed', details: error instanceof Error ? error.message : String(error) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Unknown provider
    return new Response(
      JSON.stringify({ error: 'Unknown model provider', model }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('[Ghost Inference] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Inference failed', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
