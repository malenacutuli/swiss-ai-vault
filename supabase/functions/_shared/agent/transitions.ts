// State transition handlers with side effects

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AgentStateMachine, AgentRunStatus } from './state-machine.ts';

export interface TransitionContext {
  supabase: ReturnType<typeof createClient>;
  runId: string;
  userId: string;
  stateMachine: AgentStateMachine;
}

// Transition handlers
export const transitionHandlers: Record<
  AgentRunStatus,
  (ctx: TransitionContext, metadata?: Record<string, unknown>) => Promise<void>
> = {
  created: async () => {
    // No side effects for created state
  },

  queued: async (ctx) => {
    // Add to BullMQ queue
    const { data: run } = await (ctx.supabase
      .from('agent_runs') as any)
      .select('*')
      .eq('id', ctx.runId)
      .single();

    if (run) {
      // Queue job (implemented in queue module)
      console.log(`Queuing run ${ctx.runId} for execution`);
    }
  },

  planning: async (ctx) => {
    // Initialize planning phase
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'info',
      message: 'Starting task planning...',
    });
  },

  executing: async (ctx) => {
    // Start execution
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'info',
      message: 'Executing task...',
    });
  },

  waiting_user: async (ctx, metadata) => {
    // Notify user that input is needed
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'user_input_required',
      message: metadata?.message as string || 'Waiting for user input...',
      metadata,
    });

    // Could trigger notification here
  },

  paused: async (ctx) => {
    // Log pause
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'info',
      message: 'Task paused by user',
    });
  },

  completed: async (ctx) => {
    // Finalize run
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'success',
      message: 'Task completed successfully',
    });

    // Release any reserved credits
    await releaseReservedCredits(ctx);
  },

  failed: async (ctx, metadata) => {
    // Log failure
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'error',
      message: metadata?.error_message as string || 'Task failed',
      metadata,
    });

    // Refund unused reserved credits
    await refundUnusedCredits(ctx);
  },

  cancelled: async (ctx) => {
    // Log cancellation
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'info',
      message: 'Task cancelled by user',
    });

    // Cancel any pending steps
    await cancelPendingSteps(ctx);

    // Refund unused reserved credits
    await refundUnusedCredits(ctx);
  },

  timeout: async (ctx) => {
    // Log timeout
    await (ctx.supabase.from('agent_task_logs') as any).insert({
      run_id: ctx.runId,
      log_type: 'error',
      message: 'Task timed out',
    });

    // Cancel any running steps
    await cancelPendingSteps(ctx);

    // Partial refund
    await refundUnusedCredits(ctx);
  },
};

// Helper functions
async function releaseReservedCredits(ctx: TransitionContext): Promise<void> {
  const { data: run } = await (ctx.supabase
    .from('agent_runs') as any)
    .select('total_credits_used')
    .eq('id', ctx.runId)
    .single();

  // Update credit balance
  await (ctx.supabase.rpc as any)('release_credits', {
    p_user_id: ctx.userId,
    p_amount: 0, // All credits consumed
    p_run_id: ctx.runId,
  });
}

async function refundUnusedCredits(ctx: TransitionContext): Promise<void> {
  const { data: balance } = await (ctx.supabase
    .from('credit_balances') as any)
    .select('reserved_credits')
    .eq('user_id', ctx.userId)
    .single();

  const balanceData = balance as any;
  if (balanceData?.reserved_credits && balanceData.reserved_credits > 0) {
    await (ctx.supabase.rpc as any)('release_credits', {
      p_user_id: ctx.userId,
      p_amount: balanceData.reserved_credits,
      p_run_id: ctx.runId,
    });
  }
}

async function cancelPendingSteps(ctx: TransitionContext): Promise<void> {
  await (ctx.supabase
    .from('agent_steps') as any)
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('run_id', ctx.runId)
    .in('status', ['pending', 'running']);
}

// Execute transition with side effects
export async function executeTransition(
  ctx: TransitionContext,
  toStatus: AgentRunStatus,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // Perform state transition
  const result = await ctx.stateMachine.transition(toStatus, metadata);

  if (!result.success) {
    return result;
  }

  // Execute side effects
  try {
    await transitionHandlers[toStatus](ctx, metadata);
  } catch (error) {
    console.error(`Side effect error for ${toStatus}:`, error);
    // Don't fail the transition for side effect errors
  }

  return { success: true };
}
