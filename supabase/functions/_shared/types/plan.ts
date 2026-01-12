// supabase/functions/_shared/types/plan.ts

export interface Plan {
  id: string;
  version: number;
  goal: string;
  phases: Phase[];
  current_phase_id: number;
  created_at: number;
  metadata: PlanMetadata;
}

export interface PlanMetadata {
  attempt: number;
  model: string;
  tokens: { input: number; output: number };
  generation_time_ms: number;
}

export interface Phase {
  id: number;
  title: string;
  description: string;
  capabilities: PhaseCapabilities;
  estimated_steps: number;
  status: PhaseStatus;
  started_at?: string;
  completed_at?: string;
  steps_completed: number;
}

export type PhaseStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface PhaseCapabilities {
  web_browsing: boolean;
  code_execution: boolean;
  file_operations: boolean;
  document_generation: boolean;
  web_search: boolean;
  image_generation: boolean;
}

export const PLAN_CONSTRAINTS = {
  MIN_PHASES: 2,
  MAX_PHASES: 15,
  MIN_GOAL_LENGTH: 10,
  MAX_GOAL_LENGTH: 2000,
  REQUIRED_FINAL_PHASE: 'delivery'
} as const;
