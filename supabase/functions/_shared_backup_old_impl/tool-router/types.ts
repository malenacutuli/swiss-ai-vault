// supabase/functions/_shared/tool-router/types.ts

export interface ToolExecutionResult {
  output: unknown;
  tokens_used?: { input: number; output: number; model?: string };
  artifacts?: string[];
  logs?: string[];
  metadata: {
    duration_ms: number;
    sandbox_type: 'edge' | 'k8s_swiss';
    retry_count: number;
    idempotency_key: string;
  };
  error?: ToolExecutionError | null;
}

export interface ToolExecutionError {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  retry_after_ms?: number;
}

export type ToolErrorCode =
  | 'TIMEOUT_TOTAL'
  | 'TIMEOUT_NETWORK'
  | 'RESOURCE_MEMORY'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_RATE_LIMIT'
  | 'INPUT_VALIDATION'
  | 'EXTERNAL_API'
  | 'EXTERNAL_UNAVAILABLE'
  | 'INTERNAL_SANDBOX'
  | 'INTERNAL_UNKNOWN';

export interface ToolExecutionContext {
  runId: string;
  stepId: string;
  tenantId: string;
  userId: string;
  timeout: number;
  creditBudget: number;
  idempotencyKey: string;
}

export interface ToolRoute {
  backend: 'edge' | 'k8s_swiss';
  timeout: number;
  credits: number;
  retryable: boolean;
  maxRetries: number;
}
