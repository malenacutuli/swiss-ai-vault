// Agent Transitions - Handle state transitions and database updates

import { AgentState, AgentStateMachine } from './state-machine.ts';

export interface TransitionContext {
  runId: string;
  userId: string;
  fromState: AgentState;
  toState: AgentState;
  trigger: string;
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  success: boolean;
  newState?: AgentState;
  error?: string;
}

export async function executeTransition(
  supabase: any,
  context: TransitionContext
): Promise<TransitionResult> {
  const { runId, fromState, toState, trigger, metadata } = context;

  try {
    // Verify current state matches expected
    const { data: run, error: fetchError } = await supabase
      .from('agent_runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (run.status !== fromState) {
      return {
        success: false,
        error: `State mismatch: expected ${fromState}, got ${run.status}`,
      };
    }

    // Create state machine to validate transition
    const machine = new AgentStateMachine(runId, fromState);
    if (!machine.canTransition(toState)) {
      return {
        success: false,
        error: `Invalid transition from ${fromState} to ${toState}`,
      };
    }

    // Update state in database
    const updateData: Record<string, any> = {
      status: toState,
      updated_at: new Date().toISOString(),
    };

    // Add state-specific updates
    if (toState === 'executing') {
      updateData.started_at = updateData.started_at || new Date().toISOString();
    } else if (toState === 'completed' || toState === 'failed' || toState === 'cancelled') {
      updateData.completed_at = new Date().toISOString();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    const { error: updateError } = await supabase
      .from('agent_runs')
      .update(updateData)
      .eq('id', runId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log transition
    await supabase.from('agent_task_logs').insert({
      task_id: runId,
      log_type: 'state_transition',
      content: JSON.stringify({
        from: fromState,
        to: toState,
        trigger,
        timestamp: new Date().toISOString(),
      }),
    });

    return { success: true, newState: toState };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRunState(supabase: any, runId: string): Promise<AgentState | null> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('status')
    .eq('id', runId)
    .single();

  if (error || !data) return null;
  return data.status as AgentState;
}
