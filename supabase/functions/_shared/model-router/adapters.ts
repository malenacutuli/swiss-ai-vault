// supabase/functions/_shared/model-router/adapters.ts
import { ChatMessage, ChatResponse, TokenUsage, PROVIDER_CONFIGS } from './types.ts';

export async function callProvider(
  provider: string,
  model: string,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    functions?: any[];
  }
): Promise<ChatResponse> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const apiKey = Deno.env.get(config.api_key_env);
  if (!apiKey) throw new Error(`API key not configured for ${provider}`);

  const start = Date.now();

  switch (config.format) {
    case 'google':
      return callGoogle(model, messages, options, apiKey, start);
    case 'anthropic':
      return callAnthropic(model, messages, options, apiKey, start);
    case 'openai':
    default:
      return callOpenAI(config.api_base, model, messages, options, apiKey, start);
  }
}

async function callGoogle(
  model: string,
  messages: ChatMessage[],
  options: any,
  apiKey: string,
  start: number
): Promise<ChatResponse> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const systemInstruction = messages.find(m => m.role === 'system');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction.content }] } : undefined,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.max_tokens ?? 4096
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error: ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  return {
    id: `google-${Date.now()}`,
    model,
    provider: 'google',
    content: candidate?.content?.parts?.[0]?.text || '',
    finish_reason: candidate?.finishReason || 'stop',
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    },
    latency_ms: Date.now() - start
  };
}

async function callAnthropic(
  model: string,
  messages: ChatMessage[],
  options: any,
  apiKey: string,
  start: number
): Promise<ChatResponse> {
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens || 4096,
      system: systemMessage,
      messages: chatMessages,
      temperature: options.temperature ?? 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();

  return {
    id: data.id,
    model,
    provider: 'anthropic',
    content: data.content?.[0]?.text || '',
    finish_reason: data.stop_reason || 'end_turn',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    latency_ms: Date.now() - start
  };
}

async function callOpenAI(
  apiBase: string,
  model: string,
  messages: ChatMessage[],
  options: any,
  apiKey: string,
  start: number
): Promise<ChatResponse> {
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 4096,
      ...(options.functions && { functions: options.functions })
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    id: data.id,
    model,
    provider: apiBase.includes('deepseek') ? 'deepseek' : apiBase.includes('x.ai') ? 'xai' : 'openai',
    content: choice?.message?.content || '',
    finish_reason: choice?.finish_reason || 'stop',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0
    },
    latency_ms: Date.now() - start
  };
}
