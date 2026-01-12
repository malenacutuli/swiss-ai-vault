// supabase/functions/_shared/model-router/router.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ChatRequest, ChatResponse, FALLBACK_CHAINS } from './types.ts';
import { callProvider } from './adapters.ts';

export async function routeRequest(request: ChatRequest): Promise<ChatResponse> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Determine model to use
  let modelId = request.model;
  let provider: string;

  if (!modelId) {
    // Use recommendation based on capability
    const capability = request.capability || 'chat';
    const { data } = await supabase.rpc('get_best_model', {
      p_capability: capability,
      p_user_tier: 'pro' // TODO: Get from user
    });

    if (data?.[0]) {
      modelId = data[0].model_id;
      provider = data[0].provider;
    } else {
      modelId = 'gemini-2.0-flash';
      provider = 'google';
    }
  } else {
    // Get provider from model
    const { data: model } = await supabase
      .from('ai_models')
      .select('provider')
      .eq('id', modelId)
      .single();

    provider = model?.provider || 'google';
  }

  // Get fallback chain
  const chainKey = request.capability || 'default';
  const chain = FALLBACK_CHAINS[chainKey] || FALLBACK_CHAINS.default;
  const modelsToTry = [modelId, ...chain.fallbacks.filter(m => m !== modelId)];

  let lastError: Error | null = null;

  // Try each model in order
  for (let i = 0; i < Math.min(modelsToTry.length, chain.max_retries + 1); i++) {
    const currentModel = modelsToTry[i];

    // Get provider for current model
    const { data: modelData } = await supabase
      .from('ai_models')
      .select('provider, is_available')
      .eq('id', currentModel)
      .single();

    if (!modelData?.is_available) continue;

    const currentProvider = modelData.provider;

    try {
      const response = await callProvider(
        currentProvider,
        currentModel,
        request.messages,
        {
          temperature: request.temperature,
          max_tokens: request.max_tokens,
          functions: request.functions
        }
      );

      // Record success
      await recordModelHealth(supabase, currentModel, true, response.latency_ms);

      // Track usage
      if (request.user_id) {
        await trackUsage(supabase, request.user_id, currentModel, response.usage, request.run_id);
      }

      return response;

    } catch (error) {
      lastError = error;
      console.error(`Model ${currentModel} failed:`, error.message);

      // Record failure
      await recordModelHealth(supabase, currentModel, false, 0, error.message);
    }
  }

  throw lastError || new Error('All models failed');
}

async function recordModelHealth(
  supabase: any,
  modelId: string,
  success: boolean,
  latencyMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    if (success) {
      await supabase.from('model_health').upsert({
        model_id: modelId,
        status: latencyMs > 5000 ? 'degraded' : 'healthy',
        latency_ms: latencyMs,
        last_success_at: new Date().toISOString(),
        failure_count: 0,
        checked_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
    } else {
      // Increment failure count
      const { data: current } = await supabase
        .from('model_health')
        .select('failure_count')
        .eq('model_id', modelId)
        .single();

      const newCount = (current?.failure_count || 0) + 1;
      const status = newCount >= 3 ? 'unhealthy' : newCount >= 1 ? 'degraded' : 'healthy';

      await supabase.from('model_health').upsert({
        model_id: modelId,
        status,
        failure_count: newCount,
        last_failure_at: new Date().toISOString(),
        checked_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
    }
  } catch (e) {
    console.error('Failed to record health:', e);
  }
}

async function trackUsage(
  supabase: any,
  userId: string,
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  runId?: string
): Promise<void> {
  try {
    await supabase.from('token_usage').insert({
      user_id: userId,
      model_id: modelId,
      run_id: runId,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens
    });
  } catch (e) {
    console.error('Failed to track usage:', e);
  }
}
