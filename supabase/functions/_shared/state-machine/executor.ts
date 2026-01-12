// supabase/functions/_shared/state-machine/executor.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Run, RunStatus } from "../types/run.ts";
import { getTransition, isValidTransition } from "./transitions.ts";

export interface TransitionResult {
  success: boolean;
  error?: string;
  previousStatus?: RunStatus;
  newStatus?: RunStatus;
}

export async function transitionRun(
  supabase: SupabaseClient,
  runId: string,
  toStatus: RunStatus,
  metadata?: Record<string, unknown>
): Promise<TransitionResult> {
  // 1. Get current run
  const { data: run, error: fetchError } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', runId)
    .single();

  if (fetchError || !run) {
    return { success: false, error: 'Run not found' };
  }

  const fromStatus = run.status as RunStatus;

  // 2. Validate transition
  if (!isValidTransition(fromStatus, toStatus)) {
    return {
      success: false,
      error: `Invalid transition: ${fromStatus} → ${toStatus}`
    };
  }

  // 3. Check guard condition
  const transition = getTransition(fromStatus, toStatus);
  if (transition?.guard && !transition.guard(run as Run)) {
    return {
      success: false,
      error: `Guard condition not met for ${fromStatus} → ${toStatus}`
    };
  }

  // 4. Prepare update payload
  const updatePayload: Record<string, unknown> = {
    status: toStatus,
    updated_at: new Date().toISOString(),
    version: run.version + 1,
    ...metadata
  };

  // Set timestamps based on transition
  if (toStatus === 'executing' && fromStatus === 'planning') {
    updatePayload.started_at = new Date().toISOString();
  }
  if (['completed', 'failed', 'cancelled', 'timeout'].includes(toStatus)) {
    updatePayload.completed_at = new Date().toISOString();
  }

  // 5. Execute transition with optimistic locking
  const { error: updateError, count } = await supabase
    .from('agent_tasks')
    .update(updatePayload)
    .eq('id', runId)
    .eq('version', run.version);  // Optimistic locking

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (count === 0) {
    return { success: false, error: 'Concurrent modification detected' };
  }

  // 6. Execute side effect (if any)
  if (transition?.sideEffect) {
    try {
      await transition.sideEffect(run as Run, supabase);
    } catch (sideEffectError) {
      console.error('Side effect failed:', sideEffectError);
    }
  }

  return {
    success: true,
    previousStatus: fromStatus,
    newStatus: toStatus
  };
}

// Claim next task from queue (for worker polling)
export async function claimNextTask(
  supabase: SupabaseClient,
  workerId: string
): Promise<Run | null> {
  const { data, error } = await supabase.rpc('claim_next_agent_task', {
    p_worker_id: workerId
  });

  if (error) {
    console.error('Failed to claim task:', error);
    return null;
  }

  return data as Run | null;
}
