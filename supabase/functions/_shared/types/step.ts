// supabase/functions/_shared/types/step.ts

export interface Step {
  id: string;
  run_id: string;
  phase_id: number;
  sequence: number;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown> | null;
  status: StepStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  credits_consumed: number;
  tokens_used: { input: number; output: number };
  error: StepError | null;
  retry_count: number;
  idempotency_key: string;
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface StepError {
  code: string;
  message: string;
  recoverable: boolean;
  retry_after_ms?: number;
}
