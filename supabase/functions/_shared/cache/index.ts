// supabase/functions/_shared/cache/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ChatMessage, ChatResponse } from "../model-router/types.ts";

export interface CacheConfig {
  enabled: boolean;
  ttlHours: number;
  maxTemperature: number; // Don't cache high-temperature responses
}

const DEFAULT_CONFIG: CacheConfig = {
  enabled: true,
  ttlHours: 24,
  maxTemperature: 0.3 // Only cache deterministic responses
};

export async function generateCacheKey(
  modelId: string,
  messages: ChatMessage[],
  temperature: number
): Promise<string> {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const systemHash = await hashString(systemMessage);
  const messagesHash = await hashString(JSON.stringify(userMessages));
  const promptHash = await hashString(userMessages[userMessages.length - 1]?.content || '');

  // Combine into cache key
  const keyData = `${modelId}:${systemHash}:${messagesHash}:${temperature}`;
  return hashString(keyData);
}

export async function getCachedResponse(
  supabase: any,
  cacheKey: string
): Promise<ChatResponse | null> {
  const { data, error } = await supabase.rpc('get_cached_response', {
    p_cache_key: cacheKey
  });

  if (error || !data) return null;

  return {
    id: `cache-${cacheKey.slice(0, 8)}`,
    model: data.model_id,
    provider: 'cache',
    content: data.content,
    finish_reason: 'cached',
    usage: data.token_usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    latency_ms: 0
  };
}

export async function storeCachedResponse(
  supabase: any,
  cacheKey: string,
  modelId: string,
  messages: ChatMessage[],
  temperature: number,
  response: ChatResponse,
  config: CacheConfig = DEFAULT_CONFIG
): Promise<void> {
  // Don't cache high-temperature responses
  if (temperature > config.maxTemperature) return;

  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const systemHash = await hashString(systemMessage);
  const messagesHash = await hashString(JSON.stringify(userMessages));
  const promptHash = await hashString(userMessages[userMessages.length - 1]?.content || '');

  try {
    await supabase.rpc('store_cached_response', {
      p_cache_key: cacheKey,
      p_model_id: modelId,
      p_prompt_hash: promptHash,
      p_system_hash: systemHash,
      p_messages_hash: messagesHash,
      p_temperature: temperature,
      p_response_content: response.content,
      p_response_metadata: {
        provider: response.provider,
        finish_reason: response.finish_reason,
        latency_ms: response.latency_ms,
        estimated_cost: calculateCost(modelId, response.usage)
      },
      p_token_usage: response.usage,
      p_ttl_hours: config.ttlHours
    });
  } catch (e) {
    console.error('Failed to store cache:', e);
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function calculateCost(modelId: string, usage: { prompt_tokens: number; completion_tokens: number }): number {
  // Simplified cost estimation - actual prices from model registry
  const prices: Record<string, { input: number; output: number }> = {
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-5-haiku': { input: 0.00025, output: 0.00125 },
    'deepseek-chat': { input: 0.00014, output: 0.00028 }
  };

  const price = prices[modelId] || { input: 0.001, output: 0.002 };
  return (usage.prompt_tokens * price.input / 1000) + (usage.completion_tokens * price.output / 1000);
}
