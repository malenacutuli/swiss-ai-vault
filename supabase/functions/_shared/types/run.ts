// supabase/functions/_shared/types/run.ts

export const RUN_STATUSES = [
  'pending',      // Created, not yet queued
  'queued',       // In queue, waiting for worker
  'planning',     // AI generating execution plan
  'executing',    // Running steps
  'paused',       // User paused
  'waiting_user', // Needs user input
  'completed',    // Successfully finished
  'failed',       // Error occurred
  'cancelled',    // User cancelled
  'timeout'       // Exceeded time limit
] as const;

export type RunStatus = typeof RUN_STATUSES[number];

export interface Run {
  id: string;
  external_id: string;
  tenant_id: string;
  user_id: string;
  status: RunStatus;
  prompt: string;
  prompt_hash: string;
  config: RunConfig;
  plan: Plan | null;
  current_phase_id: number | null;
  current_step_id: string | null;
  step_count: number;
  credits_reserved: number;
  credits_consumed: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  timeout_at: string | null;
  error: RunError | null;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, unknown>;
  version: number;
}

export interface RunConfig {
  max_steps: number;
  max_duration_seconds: number;
  max_credits: number;
  tools_enabled: string[];
  model: string;
  temperature: number;
  checkpoint_interval: number;
}

export interface RunError {
  code: string;
  message: string;
  step_id?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  max_steps: 50,
  max_duration_seconds: 3600,
  max_credits: 100,
  tools_enabled: [
    'browser_navigate', 'browser_screenshot', 'browser_click', 'browser_type',
    'shell_execute', 'shell_view',
    'file_read', 'file_write', 'file_edit',
    'search_web', 'search_images',
    'generate_slides', 'generate_document', 'generate_spreadsheet',
    'generate_image',
    'send_message', 'ask_user', 'update_plan', 'complete_task',
    'deploy_preview'
  ],
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  checkpoint_interval: 5
};
