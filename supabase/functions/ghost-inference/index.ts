import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Include any custom headers used by the web app (case-insensitive)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// ============================================
// ENDPOINT CONFIGURATION
// ============================================

// Open Source models → Modal (axessible-labs-- workspace)
const SWISS_ENDPOINTS: Record<string, string> = {
  // SwissVault branded fast/code models
  'swissvault-fast': 'https://axessible-labs--swissvault-fast-fast-chat.modal.run',
  'swissvault-code': 'https://axessible-labs--swissvault-code-code-chat.modal.run',
  // LLaMA models
  'llama3.1-8b': 'https://axessible-labs--swissvault-llama8b-llama8b-chat.modal.run',
  // Mistral models
  'mistral-7b': 'https://axessible-labs--swissvault-mistral-mistral-chat.modal.run',
  // Qwen models (ALL go through Modal, not Qwen API)
  'qwen2.5-3b': 'https://axessible-labs--swissvault-main-main-chat.modal.run',
  'qwen2.5-0.5b': 'https://axessible-labs--swissvault-fast-fast-chat.modal.run',
  'qwen2.5-coder-7b': 'https://axessible-labs--swissvault-code-code-chat.modal.run',
  // Future endpoints (uncomment when deployed on Modal)
  // 'qwen2.5-7b': 'https://axessible-labs--swissvault-qwen7b-qwen7b-chat.modal.run',
  // 'qwen2.5-72b': 'https://axessible-labs--swissvault-qwen72b-qwen72b-chat.modal.run',
  // 'llama3.3-70b': 'https://axessible-labs--swissvault-llama70b-llama70b-chat.modal.run',
  // 'deepseek-v3-oss': 'https://axessible-labs--swissvault-deepseek-deepseek-chat.modal.run',
};

// SwissVault branded models that route to OpenAI (hidden from user)
const SWISSVAULT_OPENAI_ALIASES: Record<string, string> = {
  'swissvault-1.0': 'gpt-4o-mini',
  'swissvault-pro': 'gpt-4o',
  'swissvault-code': 'gpt-4o-mini',
  'swissvault-fast': 'gpt-4o-mini',
};

// Commercial API models
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'o4-mini', 'gpt-5.2', 'gpt-5.2-mini'];
const ANTHROPIC_MODELS = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-sonnet-4', 'claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-3.5-sonnet', 'claude-3.5-haiku'];
const GOOGLE_MODELS = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-pro', 'gemini-3-flash'];
const XAI_MODELS = ['grok-4.1', 'grok-3', 'grok-2', 'grok-2-vision'];

// DeepSeek direct API (for commercial DeepSeek models - cheap API pricing)
const DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-v3', 'deepseek-v3.2', 'deepseek-coder-v2'];

// NOTE: Qwen models removed from direct API - ALL Qwen goes through Modal
// const QWEN_MODELS = ['qwen3-235b', 'qwen3-235b-thinking', 'qwen3-coder-480b'];

// Models that don't support streaming
const NON_STREAMING_MODELS = ['o1', 'o1-mini', 'o1-preview'];

// Models that need special parameter handling (no temperature/top_p)
const REASONING_MODELS = ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'o4-mini'];

// OpenAI model ID mapping (UI model → API model)
// NOTE: o1/o1-mini/o1-preview have been deprecated by OpenAI and replaced with o3/o4-mini
const OPENAI_MODEL_MAP: Record<string, string> = {
  'gpt-5.2': 'gpt-4.1',
  'gpt-5.2-mini': 'gpt-4.1-mini',
  'o4-mini': 'o4-mini-2025-04-16',
  'o3': 'o3-2025-04-16',
  'o3-mini': 'o3-mini-2025-01-31',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  // Legacy o1 models redirected to o3/o4-mini (o1 is deprecated)
  'o1': 'o3-2025-04-16',
  'o1-mini': 'o4-mini-2025-04-16',
  'o1-preview': 'o3-2025-04-16',
};

// DeepSeek model ID mapping (UI model → API model)
const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  'deepseek-chat': 'deepseek-chat',
  'deepseek-coder': 'deepseek-coder',
  'deepseek-reasoner': 'deepseek-reasoner',
  // Map UI variants to correct API IDs
  'deepseek-v3': 'deepseek-chat',
  'deepseek-v3.2': 'deepseek-chat',
  'deepseek-coder-v2': 'deepseek-coder',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getProvider(model: string): 'modal' | 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' {
  // SwissVault branded models that route to OpenAI (hidden)
  if (SWISSVAULT_OPENAI_ALIASES[model]) {
    console.log(`[Router] SwissVault model "${model}" → OpenAI alias "${SWISSVAULT_OPENAI_ALIASES[model]}"`);
    return 'openai';
  }
  
  // Open source models → Modal (includes Qwen, LLaMA, Mistral via Modal)
  if (SWISS_ENDPOINTS[model]) {
    console.log(`[Router] Model "${model}" → Modal endpoint`);
    return 'modal';
  }
  
  // Commercial APIs
  if (OPENAI_MODELS.some(m => model.includes(m))) return 'openai';
  if (ANTHROPIC_MODELS.some(m => model.includes(m))) return 'anthropic';
  if (GOOGLE_MODELS.some(m => model.includes(m))) return 'google';
  if (XAI_MODELS.some(m => model.includes(m))) return 'xai';
  
  // DeepSeek direct API (for commercial DeepSeek models like deepseek-chat)
  if (DEEPSEEK_MODELS.some(m => model.includes(m))) return 'deepseek';
  
  // Default fallback to Modal for unknown open source models
  console.log(`[Router] Unknown model "${model}" → fallback to Modal`);
  return 'modal';
}

function getApiKey(provider: string): string | undefined {
  switch (provider) {
    case 'openai': return Deno.env.get('OPENAI_API_KEY');
    case 'anthropic': return Deno.env.get('ANTHROPIC_API_KEY');
    case 'google': return Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GEMINI_API_KEY');
    case 'xai': return Deno.env.get('XAI_API_KEY');
    case 'deepseek': return Deno.env.get('DEEPSEEK_API_KEY');
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
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      // Multimodal: count text parts, estimate images
      for (const part of msg.content) {
        if (part.type === 'text') {
          totalChars += part.text?.length || 0;
        } else if (part.type === 'image_url') {
          // Images are roughly 1000 tokens
          totalChars += 4000; // ~1000 tokens
        }
      }
    }
  }
  return Math.ceil(totalChars / 4);
}

// Convert OpenAI multimodal format to Anthropic format
function convertToAnthropicFormat(content: any): any {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return content;
  }
  
  return content.map((part: any) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    if (part.type === 'image_url') {
      const url = part.image_url?.url || '';
      // Extract base64 data from data URL
      if (url.startsWith('data:')) {
        const matches = url.match(/data:([^;]+);base64,(.+)/);
        if (matches) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: matches[1],
              data: matches[2],
            },
          };
        }
      }
      // For regular URLs, use URL type
      return {
        type: 'image',
        source: {
          type: 'url',
          url: url,
        },
      };
    }
    return part;
  });
}

// Sanitize messages for Anthropic to prevent empty content errors
function sanitizeMessagesForAnthropic(messages: any[]): any[] {
  return messages.map(msg => {
    const newMsg = { ...msg };
    
    // Handle array content (multimodal with images)
    if (Array.isArray(newMsg.content)) {
      const hasText = newMsg.content.some((part: any) => 
        part.type === 'text' && part.text?.trim()
      );
      
      // If no text but has images, add default analysis request
      if (!hasText) {
        const hasImages = newMsg.content.some((part: any) => 
          part.type === 'image' || part.type === 'image_url'
        );
        if (hasImages) {
          newMsg.content = [
            ...newMsg.content,
            { type: 'text', text: 'Please analyze the attached image(s).' }
          ];
        }
      }
    }
    // Handle empty string content
    else if (typeof newMsg.content === 'string' && !newMsg.content.trim()) {
      newMsg.content = 'Please respond.';
    }
    
    return newMsg;
  });
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
  
  // Get Modal secret for authentication
  const modalSecret = Deno.env.get('MODAL_SECRET');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
  
  try {
    // Build headers WITH authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // CRITICAL FIX: Add auth header if MODAL_SECRET is configured
    if (modalSecret) {
      headers['Authorization'] = `Bearer ${modalSecret}`;
      console.log('[Modal] Using authentication');
    } else {
      console.warn('[Modal] No MODAL_SECRET configured - request may fail');
    }
    
    const startTime = Date.now();
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Modal] Error response:', response.status, errorText);
      throw new Error(`Modal inference failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;
    
    console.log('[Modal] Success, response time:', responseTimeMs, 'ms');
    console.log('[Modal] Raw response structure:', JSON.stringify(data).substring(0, 1000));
    
    // Handle different response formats from vLLM / Modal endpoints
    let content = '';
    
    // Format 1: OpenAI-compatible format (choices[].message.content)
    // NOTE: content can be an empty string, so we must check for property existence, not truthiness.
    if (data.choices?.[0]?.message && Object.prototype.hasOwnProperty.call(data.choices[0].message, 'content')) {
      content = typeof data.choices[0].message.content === 'string' ? data.choices[0].message.content : '';
      console.log('[Modal] Extracted from choices[0].message.content');
    }
    // Format 2: vLLM streaming-style (choices[].delta.content)
    else if (data.choices?.[0]?.delta && Object.prototype.hasOwnProperty.call(data.choices[0].delta, 'content')) {
      content = typeof data.choices[0].delta.content === 'string' ? data.choices[0].delta.content : '';
      console.log('[Modal] Extracted from choices[0].delta.content');
    }
    // Format 3: Direct content field
    else if (Object.prototype.hasOwnProperty.call(data, 'content')) {
      content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      console.log('[Modal] Extracted from data.content');
    }
    // Format 4: Text field (some older APIs)
    else if (Object.prototype.hasOwnProperty.call(data, 'text')) {
      content = typeof data.text === 'string' ? data.text : JSON.stringify(data.text);
      console.log('[Modal] Extracted from data.text');
    }
    // Format 5: Generated text (HuggingFace style)
    else if (Object.prototype.hasOwnProperty.call(data, 'generated_text')) {
      content = typeof data.generated_text === 'string' ? data.generated_text : JSON.stringify(data.generated_text);
      console.log('[Modal] Extracted from data.generated_text');
    }
    // Format 6: Output field
    else if (Object.prototype.hasOwnProperty.call(data, 'output')) {
      content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      console.log('[Modal] Extracted from data.output');
    }
    // Format 7: Response is a string directly
    else if (typeof data === 'string') {
      content = data;
      console.log('[Modal] Data is raw string');
    }
    // Format 8: Check for nested response structure
    else if (Object.prototype.hasOwnProperty.call(data, 'response')) {
      content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
      console.log('[Modal] Extracted from data.response');
    }
    // Format 9: Check for result field
    else if (Object.prototype.hasOwnProperty.call(data, 'result')) {
      content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
      console.log('[Modal] Extracted from data.result');
    }

    // If the upstream returned an empty completion, fail fast with a clearer error.
    if (!content || content.trim().length === 0) {
      const finishReason = data?.choices?.[0]?.finish_reason;
      console.error('[Modal] Empty completion from upstream:', JSON.stringify({ finish_reason: finishReason, model: data?.model, id: data?.id }));
      throw new Error(`Empty completion from model${finishReason ? ` (finish_reason=${finishReason})` : ''}`);
    }

    console.log('[Modal] Extracted content length:', content.length);
    
    return {
      content,
      usage: data.usage,
      responseTimeMs,
    };
    
  } catch (error: any) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      console.error('[Modal] Request timed out after 120 seconds');
      throw new Error('Model is warming up. Please try again in 30-60 seconds.');
    }
    
    console.error('[Modal] Fetch error:', error);
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
  
  // Map UI model to OpenAI API model
  const apiModel = OPENAI_MODEL_MAP[model] || model;
  const isReasoning = isReasoningModel(model);
  const canStream = supportsStreaming(model) && options.stream;
  
  // Sanitize messages for OpenAI - ensure valid image formats
  const sanitizedMessages = messages.map(msg => {
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.filter((part: any) => {
          // Keep text parts
          if (part.type === 'text') return true;
          // Only keep image_url parts with valid image MIME types
          if (part.type === 'image_url') {
            const url = part.image_url?.url || '';
            // Check if it's a valid image data URL or HTTP URL
            if (url.startsWith('data:image/')) return true;
            if (url.startsWith('http://') || url.startsWith('https://')) return true;
            // Skip invalid MIME types (e.g., data:application/pdf)
            console.log('[OpenAI] Skipping invalid image_url:', url.substring(0, 50));
            return false;
          }
          return true;
        })
      };
    }
    return msg;
  });
  
  // Build request body with proper parameters
  // IMPORTANT: OpenAI now requires max_completion_tokens for ALL models
  const body: any = {
    model: apiModel,
    messages: sanitizedMessages,
    stream: canStream,
    max_completion_tokens: options.maxTokens || 4096,
  };
  
  // Reasoning models (o1, o3, o4) don't support temperature or top_p
  if (!isReasoning) {
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.topP !== undefined) {
      body.top_p = options.topP;
    }
  }
  
  console.log('[OpenAI] Request:', { model, apiModel, isReasoning, canStream, messageCount: sanitizedMessages.length });
  
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
// ANTHROPIC STREAM TRANSFORMER
// Transform Anthropic SSE to OpenAI-compatible SSE format
// ============================================

function transformAnthropicStream(anthropicStream: ReadableStream): ReadableStream {
  const reader = anthropicStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          // Send final [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const event = JSON.parse(data);
            
            // Handle different Anthropic event types
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              // Transform to OpenAI format
              const openAIEvent = {
                id: `chatcmpl-anthropic-${Date.now()}`,
                object: 'chat.completion.chunk',
                choices: [{
                  index: 0,
                  delta: { content: event.delta.text },
                  finish_reason: null,
                }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIEvent)}\n\n`));
            } else if (event.type === 'message_stop') {
              // Send stop event
              const stopEvent = {
                id: `chatcmpl-anthropic-${Date.now()}`,
                object: 'chat.completion.chunk',
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: 'stop',
                }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopEvent)}\n\n`));
            }
            // Skip other event types (message_start, content_block_start, etc.)
          } catch (e) {
            // Skip unparseable lines
            console.log('[Anthropic Stream] Skipping unparseable line:', data.substring(0, 50));
          }
        }
      } catch (error) {
        console.error('[Anthropic Stream] Transform error:', error);
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
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
  
  // Map display names to API model names - UPDATED for current Anthropic model IDs
  // NOTE: Claude 3/3.5 models deprecated, redirected to Claude 4 equivalents
  const modelMap: Record<string, string> = {
    // Claude 4 family - current models
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'claude-sonnet-4.5': 'claude-sonnet-4-5-20250514',
    'claude-opus-4.5': 'claude-opus-4-5-20251101',
    'claude-haiku-4.5': 'claude-3-5-haiku-20241022',
    // Legacy Claude 3.5 → redirect to Claude 4 (3.5-sonnet deprecated)
    'claude-3.5-sonnet': 'claude-sonnet-4-20250514',
    'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
    // Legacy Claude 3 → redirect to Claude 4
    'claude-3-haiku': 'claude-3-5-haiku-20241022',
    'claude-3-sonnet': 'claude-sonnet-4-20250514',
    'claude-3-opus': 'claude-opus-4-20250514',
    // Short aliases → current best equivalents
    'claude-haiku': 'claude-3-5-haiku-20241022',
    'claude-sonnet': 'claude-sonnet-4-20250514',
    'claude-opus': 'claude-opus-4-20250514',
  };
  
  const apiModel = modelMap[model] || model;
  
  // CRITICAL FIX: Sanitize messages to prevent empty content error
  const sanitizedMessages = sanitizeMessagesForAnthropic(messages);
  
  console.log('[Anthropic] Model:', apiModel, '| Stream:', options.stream);
  console.log('[Anthropic] Messages:', sanitizedMessages.length);
  
  // Extract system message and convert multimodal content
  let systemPrompt = '';
  const anthropicMessages = sanitizedMessages.filter(m => {
    if (m.role === 'system') {
      systemPrompt = typeof m.content === 'string' ? m.content : '';
      return false;
    }
    return true;
  }).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: convertToAnthropicFormat(m.content),
  }));
  
  const body: any = {
    model: apiModel,
    max_tokens: options.maxTokens || 4096,
    messages: anthropicMessages,
    stream: options.stream || false,
  };
  
  if (systemPrompt) body.system = systemPrompt;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  
  console.log('[Anthropic] Sending request to API...');
  
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
  
  console.log('[Anthropic] Response OK, stream:', options.stream);
  
  // CRITICAL FIX: Transform Anthropic stream to OpenAI-compatible format
  if (options.stream && response.body) {
    console.log('[Anthropic] Transforming stream to OpenAI format');
    return transformAnthropicStream(response.body);
  }
  
  const data = await response.json();
  console.log('[Anthropic] Non-streaming response received');
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
  
  // Map display names to actual Google API model names
  // NOTE: gemini-3-* models don't exist yet, redirecting to 2.5-pro
  const modelMap: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-2.0-flash-exp',
    'gemini-2.0-pro': 'gemini-2.0-pro-exp',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite-preview-06-17',
    // gemini-3 models don't exist - redirect to best available
    'gemini-3-pro': 'gemini-2.5-pro-preview-06-05',
    'gemini-3-flash': 'gemini-2.5-flash-preview-05-20',
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
    
    // Check for 403 "no credits" or permission errors
    if (response.status === 403 || errorText.includes('permission') || errorText.includes('credits')) {
      throw new Error(`xai_credits_required: Your xAI account needs credits. Purchase at console.x.ai`);
    }
    
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
// DEEPSEEK HANDLER (with model ID mapping)
// ============================================

async function callDeepSeek(
  model: string,
  messages: any[],
  options: { maxTokens?: number; temperature?: number; topP?: number; stream?: boolean }
): Promise<{ content: string; usage?: any } | ReadableStream> {
  const apiKey = getApiKey('deepseek');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
  
  // CRITICAL FIX: Map UI model ID to DeepSeek API model ID
  const actualModel = DEEPSEEK_MODEL_MAP[model] || 'deepseek-chat';
  
  console.log('[DeepSeek] UI model:', model);
  console.log('[DeepSeek] API model:', actualModel);
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: actualModel,  // Use mapped model ID
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
  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID().slice(0, 8);
  console.log(`[Ghost Inference] [${requestId}] Request started`);
  
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
      const endpoint = SWISS_ENDPOINTS[model] || SWISS_ENDPOINTS['swissvault-fast'];
      
      console.log('[Modal] Selected endpoint for model', model, ':', endpoint);
      
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
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ==========================================
    // OPENAI
    // ==========================================
    if (provider === 'openai') {
      try {
        // Resolve SwissVault aliases to actual OpenAI model
        const actualModel = SWISSVAULT_OPENAI_ALIASES[model] || model;
        const canStream = supportsStreaming(actualModel) && stream;
        console.log(`[OpenAI] Routing ${model} -> ${actualModel}, stream: ${canStream}`);
        const result = await callOpenAI(actualModel, finalMessages, { ...options, stream: canStream });
        
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
    
    // Unknown provider - fallback to Modal
    console.warn(`[Ghost Inference] Unknown provider for model ${model}, falling back to Modal`);
    const fallbackEndpoint = SWISS_ENDPOINTS['swissvault-fast'];
    try {
      const result = await callModal(fallbackEndpoint, finalMessages, options);
      return new Response(
        JSON.stringify({
          id: `chatcmpl-fallback-${Date.now()}`,
          object: 'chat.completion',
          model,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: result.content },
            finish_reason: 'stop',
          }],
          usage: result.usage,
          response_time_ms: result.responseTimeMs || (Date.now() - startTime),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: unknown) {
      return new Response(
        JSON.stringify({ error: 'Unknown model provider', model, details: error instanceof Error ? error.message : String(error) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: unknown) {
    console.error(`[Ghost Inference] [${requestId}] Fatal error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
