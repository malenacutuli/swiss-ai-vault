// supabase/functions/_shared/state-machine/transitions.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Run, RunStatus } from "../types/run.ts";
import { Phase } from "../types/plan.ts";

export interface StateTransition {
  from: RunStatus;
  to: RunStatus;
  guard?: (run: Run) => boolean;
  sideEffect?: (run: Run, supabase: SupabaseClient) => Promise<void>;
}

// Valid transitions (10-state machine)
export const VALID_TRANSITIONS: StateTransition[] = [
  // From pending
  { from: 'pending', to: 'queued', guard: (r) => r.credits_reserved > 0 },
  { from: 'pending', to: 'cancelled' },
  { from: 'pending', to: 'failed' },

  // From queued
  { from: 'queued', to: 'planning' },
  { from: 'queued', to: 'cancelled' },
  { from: 'queued', to: 'timeout' },

  // From planning
  { from: 'planning', to: 'executing', guard: (r) => r.plan !== null },
  { from: 'planning', to: 'failed' },
  { from: 'planning', to: 'cancelled' },

  // From executing
  { from: 'executing', to: 'executing' },  // Step progress
  { from: 'executing', to: 'paused' },
  { from: 'executing', to: 'waiting_user' },
  { from: 'executing', to: 'completed', guard: (r) => {
    if (!r.plan) return false;
    return r.plan.phases.every((p: Phase) => p.status === 'completed' || p.status === 'skipped');
  }},
  { from: 'executing', to: 'failed' },
  { from: 'executing', to: 'cancelled' },
  { from: 'executing', to: 'timeout' },

  // From paused
  { from: 'paused', to: 'executing' },
  { from: 'paused', to: 'cancelled' },

  // From waiting_user
  { from: 'waiting_user', to: 'executing' },
  { from: 'waiting_user', to: 'cancelled' },
  { from: 'waiting_user', to: 'timeout' },
];

export function isValidTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}

export function getTransition(from: RunStatus, to: RunStatus): StateTransition | undefined {
  return VALID_TRANSITIONS.find(t => t.from === from && t.to === to);
}
