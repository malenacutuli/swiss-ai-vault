// Agent State Machine Implementation
// Matches Manus.im architecture for enterprise-grade execution

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// State definitions
export type AgentRunStatus =
  | 'created'
  | 'queued'
  | 'planning'
  | 'executing'
  | 'waiting_user'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type AgentStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

// Valid state transitions
const VALID_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  created: ['queued', 'cancelled'],
  queued: ['planning', 'cancelled', 'failed'],
  planning: ['executing', 'failed', 'cancelled', 'timeout'],
  executing: ['completed', 'failed', 'cancelled', 'timeout', 'waiting_user', 'paused'],
  waiting_user: ['executing', 'cancelled', 'timeout'],
  paused: ['executing', 'cancelled'],
  completed: [], // Terminal state
  failed: [], // Terminal state
  cancelled: [], // Terminal state
  timeout: [], // Terminal state
};

// State machine class
export class AgentStateMachine {
  private supabase: ReturnType<typeof createClient>;
  private runId: string;
  private currentStatus: AgentRunStatus;

  constructor(
    supabase: ReturnType<typeof createClient>,
    runId: string,
    currentStatus: AgentRunStatus
  ) {
    this.supabase = supabase;
    this.runId = runId;
    this.currentStatus = currentStatus;
  }

  // Check if transition is valid
  canTransition(toStatus: AgentRunStatus): boolean {
    return VALID_TRANSITIONS[this.currentStatus]?.includes(toStatus) ?? false;
  }

  // Perform state transition
  async transition(
    toStatus: AgentRunStatus,
    metadata?: {
      error_message?: string;
      error_code?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    // Validate transition
    if (!this.canTransition(toStatus)) {
      return {
        success: false,
        error: `Invalid transition from ${this.currentStatus} to ${toStatus}`,
      };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: toStatus,
    };

    // Set timestamps based on transition
    if (toStatus === 'queued') {
      // No additional fields
    } else if (toStatus === 'planning' || toStatus === 'executing') {
      if (this.currentStatus === 'created' || this.currentStatus === 'queued') {
        updateData.started_at = new Date().toISOString();
      }
    } else if (['completed', 'failed', 'cancelled', 'timeout'].includes(toStatus)) {
      updateData.completed_at = new Date().toISOString();
      if (metadata?.error_message) {
        updateData.error_message = metadata.error_message;
      }
      if (metadata?.error_code) {
        updateData.error_code = metadata.error_code;
      }
    }

    // Perform atomic update with optimistic locking
    const { data, error } = await (this.supabase
      .from('agent_runs') as any)
      .update(updateData)
      .eq('id', this.runId)
      .eq('status', this.currentStatus) // Optimistic lock
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'State transition failed - concurrent modification',
      };
    }

    // Log state transition
    await this.logTransition(this.currentStatus, toStatus, metadata);

    // Update local state
    this.currentStatus = toStatus;

    return { success: true };
  }

  // Log state transition for audit
  private async logTransition(
    fromStatus: AgentRunStatus,
    toStatus: AgentRunStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await (this.supabase.from('agent_task_logs') as any).insert({
      run_id: this.runId,
      log_type: 'state_transition',
      message: `State changed from ${fromStatus} to ${toStatus}`,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
        ...metadata,
      },
    });
  }

  // Get current status
  getStatus(): AgentRunStatus {
    return this.currentStatus;
  }

  // Check if in terminal state
  isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'timeout'].includes(this.currentStatus);
  }

  // Check if can be cancelled
  canCancel(): boolean {
    return this.canTransition('cancelled');
  }

  // Check if can be paused
  canPause(): boolean {
    return this.currentStatus === 'executing';
  }

  // Check if can be resumed
  canResume(): boolean {
    return this.currentStatus === 'paused' || this.currentStatus === 'waiting_user';
  }
}

// Factory function to create state machine from run ID
export async function createStateMachine(
  supabase: ReturnType<typeof createClient>,
  runId: string
): Promise<AgentStateMachine | null> {
  const { data, error } = await (supabase
    .from('agent_runs') as any)
    .select('status')
    .eq('id', runId)
    .single();

  if (error || !data) {
    return null;
  }

  return new AgentStateMachine(supabase, runId, (data as any).status as AgentRunStatus);
}

// Step state machine (simpler)
export class StepStateMachine {
  private supabase: ReturnType<typeof createClient>;
  private stepId: string;
  private currentStatus: AgentStepStatus;

  constructor(
    supabase: ReturnType<typeof createClient>,
    stepId: string,
    currentStatus: AgentStepStatus
  ) {
    this.supabase = supabase;
    this.stepId = stepId;
    this.currentStatus = currentStatus;
  }

  async start(): Promise<boolean> {
    if (this.currentStatus !== 'pending') return false;

    const { error } = await (this.supabase
      .from('agent_steps') as any)
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', this.stepId)
      .eq('status', 'pending');

    if (!error) {
      this.currentStatus = 'running';
      return true;
    }
    return false;
  }

  async complete(output: unknown): Promise<boolean> {
    if (this.currentStatus !== 'running') return false;

    const { error } = await (this.supabase
      .from('agent_steps') as any)
      .update({
        status: 'completed',
        tool_output: output,
        completed_at: new Date().toISOString(),
        duration_ms: await this.calculateDuration(),
      })
      .eq('id', this.stepId)
      .eq('status', 'running');

    if (!error) {
      this.currentStatus = 'completed';
      return true;
    }
    return false;
  }

  async fail(error: string): Promise<boolean> {
    if (this.currentStatus !== 'running') return false;

    const { error: dbError } = await (this.supabase
      .from('agent_steps') as any)
      .update({
        status: 'failed',
        error_message: error,
        completed_at: new Date().toISOString(),
        duration_ms: await this.calculateDuration(),
      })
      .eq('id', this.stepId)
      .eq('status', 'running');

    if (!dbError) {
      this.currentStatus = 'failed';
      return true;
    }
    return false;
  }

  private async calculateDuration(): Promise<number> {
    const { data } = await (this.supabase
      .from('agent_steps') as any)
      .select('started_at')
      .eq('id', this.stepId)
      .single();

    if ((data as any)?.started_at) {
      return Date.now() - new Date((data as any).started_at).getTime();
    }
    return 0;
  }
}
