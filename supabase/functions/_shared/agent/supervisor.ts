// Agent Supervisor - Orchestrates tool execution and phase management

import { ExecutionPlan, PlanPhase } from './planner.ts';
import { executeTransition, TransitionContext } from './transitions.ts';

export interface SupervisorContext {
  runId: string;
  userId: string;
  plan: ExecutionPlan;
  currentPhaseIndex: number;
  phaseResults: Record<string, any>;
}

export interface PhaseResult {
  phaseId: string;
  success: boolean;
  output?: any;
  error?: string;
  duration_ms?: number;
}

export interface SupervisorResult {
  success: boolean;
  completed: boolean;
  currentPhase?: string;
  results?: Record<string, PhaseResult>;
  error?: string;
}

export class AgentSupervisor {
  private supabase: any;
  private context: SupervisorContext;

  constructor(supabase: any, context: SupervisorContext) {
    this.supabase = supabase;
    this.context = context;
  }

  async executeNextPhase(): Promise<PhaseResult> {
    const { plan, currentPhaseIndex } = this.context;
    
    if (currentPhaseIndex >= plan.phases.length) {
      return {
        phaseId: 'complete',
        success: true,
        output: 'All phases completed',
      };
    }

    const phase = plan.phases[currentPhaseIndex];
    const startTime = Date.now();

    try {
      // Log phase start
      await this.logPhaseStart(phase);

      // Execute phase tools
      const output = await this.executePhaseTools(phase);

      // Store result
      this.context.phaseResults[phase.id] = output;
      this.context.currentPhaseIndex++;

      // Update progress in database
      await this.updateProgress();

      return {
        phaseId: phase.id,
        success: true,
        output,
        duration_ms: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        phaseId: phase.id,
        success: false,
        error: err.message,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async executePhaseTools(phase: PlanPhase): Promise<any> {
    // Placeholder for actual tool execution
    // In a real implementation, this would route to specific tool handlers
    const results: Record<string, any> = {};

    for (const toolName of phase.tools) {
      results[toolName] = {
        executed: true,
        timestamp: new Date().toISOString(),
      };
    }

    return results;
  }

  private async logPhaseStart(phase: PlanPhase): Promise<void> {
    await this.supabase.from('agent_task_logs').insert({
      task_id: this.context.runId,
      log_type: 'phase_start',
      content: JSON.stringify({
        phaseId: phase.id,
        phaseName: phase.name,
        tools: phase.tools,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async updateProgress(): Promise<void> {
    const { runId, plan, currentPhaseIndex } = this.context;
    const progress = Math.round((currentPhaseIndex / plan.total_phases) * 100);

    await this.supabase
      .from('agent_runs')
      .update({
        current_phase: currentPhaseIndex,
        progress_percentage: progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }

  async runToCompletion(): Promise<SupervisorResult> {
    const results: Record<string, PhaseResult> = {};

    while (this.context.currentPhaseIndex < this.context.plan.phases.length) {
      const result = await this.executeNextPhase();
      results[result.phaseId] = result;

      if (!result.success) {
        // Transition to failed state
        await executeTransition(this.supabase, {
          runId: this.context.runId,
          userId: this.context.userId,
          fromState: 'executing',
          toState: 'failed',
          trigger: 'phase_failure',
          metadata: { failedPhase: result.phaseId, error: result.error },
        } as TransitionContext);

        return {
          success: false,
          completed: false,
          currentPhase: result.phaseId,
          results,
          error: result.error,
        };
      }
    }

    // Transition to completed state
    await executeTransition(this.supabase, {
      runId: this.context.runId,
      userId: this.context.userId,
      fromState: 'executing',
      toState: 'completed',
      trigger: 'all_phases_complete',
    } as TransitionContext);

    return {
      success: true,
      completed: true,
      results,
    };
  }

  getContext(): SupervisorContext {
    return { ...this.context };
  }
}
