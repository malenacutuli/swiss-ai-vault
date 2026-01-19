// supabase/functions/_shared/tool-router/executor.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  ToolExecutionResult,
  ToolExecutionContext,
  ToolExecutionError,
  ToolErrorCode
} from "./types.ts";
import { TOOL_ROUTES } from "./routes.ts";

// Re-export types for use by other functions
export type { ToolExecutionContext, ToolExecutionResult, ToolExecutionError };

const SWISS_API = "https://api.swissbrain.ai";

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext,
  supabase: SupabaseClient
): Promise<ToolExecutionResult> {
  const route = TOOL_ROUTES[toolName];

  if (!route) {
    throw createError('INPUT_VALIDATION', `Unknown tool: ${toolName}`, false);
  }

  // Check idempotency cache
  const cached = await checkIdempotencyCache(supabase, context.idempotencyKey);
  if (cached) {
    return cached;
  }

  const startTime = Date.now();
  let lastError: ToolExecutionError | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= route.maxRetries; attempt++) {
    try {
      let result: ToolExecutionResult;

      if (route.backend === 'k8s_swiss') {
        result = await executeViaSwissK8s(toolName, input, context, route.timeout);
      } else {
        result = await executeViaEdge(toolName, input, context, supabase);
      }

      // Cache successful result
      await cacheIdempotencyResult(supabase, context.idempotencyKey, result);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          retry_count: attempt,
          idempotency_key: context.idempotencyKey
        }
      };

    } catch (error) {
      lastError = error as ToolExecutionError;

      // Don't retry if not retryable or out of retries
      if (!route.retryable || !lastError.retryable || attempt >= route.maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(delay);
    }
  }

  throw lastError;
}

async function executeViaSwissK8s(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext,
  timeout: number
): Promise<ToolExecutionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(`${SWISS_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: toolName,
        parameters: input,
        run_id: context.runId,
        step_id: context.stepId,
        timeout_ms: timeout
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw createError(
        'INTERNAL_SANDBOX',
        error.message || `Swiss API error: ${response.status}`,
        response.status >= 500
      );
    }

    const data = await response.json();

    return {
      output: data.output,
      artifacts: data.artifacts || [],
      logs: data.logs || [],
      metadata: {
        duration_ms: Date.now() - startTime,
        sandbox_type: 'k8s_swiss',
        retry_count: 0,
        idempotency_key: context.idempotencyKey
      },
      error: null
    };

  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createError('TIMEOUT_TOTAL', `Tool execution timed out after ${timeout}ms`, true);
    }

    throw error;
  }
}

async function executeViaEdge(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext,
  supabase: SupabaseClient
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  // Route to appropriate edge function
  const edgeFunctionMap: Record<string, string> = {
    search_web: 'deep-research',
    search_images: 'deep-research',
    generate_image: 'image-generate',
    send_message: 'agent-message',
    ask_user: 'agent-user-input',
    update_plan: 'agent-message',
    complete_task: 'agent-message'
  };

  const functionName = edgeFunctionMap[toolName] || toolName;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`
    },
    body: JSON.stringify({
      tool: toolName,
      parameters: input,
      run_id: context.runId,
      step_id: context.stepId
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw createError(
      'EXTERNAL_API',
      error.message || `Edge function error: ${response.status}`,
      response.status >= 500
    );
  }

  const data = await response.json();

  return {
    output: data.output || data,
    artifacts: data.artifacts || [],
    logs: [],
    metadata: {
      duration_ms: Date.now() - startTime,
      sandbox_type: 'edge',
      retry_count: 0,
      idempotency_key: context.idempotencyKey
    },
    error: null
  };
}

function createError(code: ToolErrorCode, message: string, retryable: boolean): ToolExecutionError {
  return { code, message, retryable };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkIdempotencyCache(
  supabase: SupabaseClient,
  key: string
): Promise<ToolExecutionResult | null> {
  const { data } = await supabase
    .from('tool_execution_cache')
    .select('result')
    .eq('idempotency_key', key)
    .single();

  return data?.result || null;
}

async function cacheIdempotencyResult(
  supabase: SupabaseClient,
  key: string,
  result: ToolExecutionResult
): Promise<void> {
  await supabase
    .from('tool_execution_cache')
    .upsert({
      idempotency_key: key,
      result,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
}
