/**
 * Manus-Parity Agent Orchestrator
 * 
 * Implements the ReAct (Reason + Act) pattern with strict state machine control.
 * This orchestrator manages the agent execution loop with 100% Manus parity.
 */

import {
  AgentState,
  AgentEvent,
  Task,
  TaskPlan,
  Phase,
  ToolCall,
  ToolResult,
  ALLOWED_TRANSITIONS,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
  ErrorCode,
  ApiError,
} from './types';

// =============================================================================
// STATE MACHINE
// =============================================================================

export class AgentStateMachine {
  private state: AgentState = 'IDLE';
  private retryCount: number = 0;
  private readonly retryConfig: RetryConfig;

  constructor(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.retryConfig = retryConfig;
  }

  getState(): AgentState {
    return this.state;
  }

  canTransition(to: AgentState, trigger: string): boolean {
    return ALLOWED_TRANSITIONS.some(
      t => t.from === this.state && t.to === to && t.trigger === trigger
    );
  }

  transition(to: AgentState, trigger: string): void {
    if (!this.canTransition(to, trigger)) {
      throw new Error(
        `Invalid state transition: ${this.state} -> ${to} (trigger: ${trigger})`
      );
    }
    
    console.log(`[StateMachine] ${this.state} -> ${to} (${trigger})`);
    this.state = to;
    
    // Reset retry count on successful transition
    if (trigger !== 'tool_failure_retry') {
      this.retryCount = 0;
    }
  }

  incrementRetry(): boolean {
    this.retryCount++;
    return this.retryCount <= this.retryConfig.maxRetries;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getRetryDelay(): number {
    const delay = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, this.retryCount - 1),
      this.retryConfig.maxDelayMs
    );
    return delay;
  }

  reset(): void {
    this.state = 'IDLE';
    this.retryCount = 0;
  }
}

// =============================================================================
// PLAN MANAGER
// =============================================================================

export class PlanManager {
  private plan: TaskPlan | null = null;

  getPlan(): TaskPlan | null {
    return this.plan;
  }

  createPlan(goal: string, phases: Omit<Phase, 'status'>[]): TaskPlan {
    this.plan = {
      goal,
      phases: phases.map(p => ({ ...p, status: 'pending' as const })),
      currentPhaseId: phases[0]?.id || 1,
    };
    
    // Mark first phase as in progress
    if (this.plan.phases.length > 0) {
      this.plan.phases[0].status = 'in_progress';
    }
    
    return this.plan;
  }

  updatePlan(goal: string, phases: Omit<Phase, 'status'>[], currentPhaseId: number): TaskPlan {
    this.plan = {
      goal,
      phases: phases.map(p => ({
        ...p,
        status: p.id < currentPhaseId ? 'completed' as const :
                p.id === currentPhaseId ? 'in_progress' as const : 'pending' as const,
      })),
      currentPhaseId,
    };
    return this.plan;
  }

  advancePhase(nextPhaseId: number): TaskPlan {
    if (!this.plan) {
      throw new Error('No plan exists to advance');
    }

    const currentPhase = this.plan.phases.find(p => p.id === this.plan!.currentPhaseId);
    const nextPhase = this.plan.phases.find(p => p.id === nextPhaseId);

    if (!currentPhase || !nextPhase) {
      throw new Error(`Invalid phase IDs: current=${this.plan.currentPhaseId}, next=${nextPhaseId}`);
    }

    if (nextPhaseId !== this.plan.currentPhaseId + 1) {
      throw new Error(`Cannot skip phases. Current: ${this.plan.currentPhaseId}, Next: ${nextPhaseId}`);
    }

    currentPhase.status = 'completed';
    nextPhase.status = 'in_progress';
    this.plan.currentPhaseId = nextPhaseId;

    return this.plan;
  }

  getCurrentPhase(): Phase | null {
    if (!this.plan) return null;
    return this.plan.phases.find(p => p.id === this.plan!.currentPhaseId) || null;
  }

  isComplete(): boolean {
    if (!this.plan) return false;
    return this.plan.phases.every(p => p.status === 'completed');
  }

  markCurrentPhaseFailed(): void {
    if (!this.plan) return;
    const currentPhase = this.getCurrentPhase();
    if (currentPhase) {
      currentPhase.status = 'failed';
    }
  }
}

// =============================================================================
// EVENT EMITTER
// =============================================================================

type EventHandler = (event: AgentEvent) => void;

export class EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  on(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  emit(eventType: AgentEvent['event'], data: Record<string, unknown>): void {
    const event: AgentEvent = {
      event: eventType,
      taskId: this.taskId,
      timestamp: new Date().toISOString(),
      data,
    };

    // Emit to specific handlers
    const handlers = this.handlers.get(eventType) || [];
    handlers.forEach(handler => handler(event));

    // Emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    wildcardHandlers.forEach(handler => handler(event));
  }
}

// =============================================================================
// AGENT ORCHESTRATOR
// =============================================================================

export interface OrchestratorConfig {
  taskId: string;
  userId: string;
  retryConfig?: RetryConfig;
  onEvent?: (event: AgentEvent) => void;
}

export class AgentOrchestrator {
  private readonly taskId: string;
  private readonly userId: string;
  private readonly stateMachine: AgentStateMachine;
  private readonly planManager: PlanManager;
  private readonly eventEmitter: EventEmitter;
  private readonly toolHistory: ToolCall[] = [];
  private readonly resultHistory: ToolResult[] = [];

  constructor(config: OrchestratorConfig) {
    this.taskId = config.taskId;
    this.userId = config.userId;
    this.stateMachine = new AgentStateMachine(config.retryConfig);
    this.planManager = new PlanManager();
    this.eventEmitter = new EventEmitter(config.taskId);

    if (config.onEvent) {
      this.eventEmitter.on('*', config.onEvent);
    }
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  getState(): AgentState {
    return this.stateMachine.getState();
  }

  getPlan(): TaskPlan | null {
    return this.planManager.getPlan();
  }

  // ---------------------------------------------------------------------------
  // Task Lifecycle
  // ---------------------------------------------------------------------------

  startTask(prompt: string): void {
    this.eventEmitter.emit('task.created', { prompt, userId: this.userId });
    this.stateMachine.transition('PLANNING', 'new_task');
  }

  createPlan(goal: string, phases: Omit<Phase, 'status'>[]): TaskPlan {
    const plan = this.planManager.createPlan(goal, phases);
    this.eventEmitter.emit('plan.updated', { plan });
    this.stateMachine.transition('EXECUTING', 'plan_created');
    this.eventEmitter.emit('phase.started', { phase: this.planManager.getCurrentPhase() });
    return plan;
  }

  updatePlan(goal: string, phases: Omit<Phase, 'status'>[], currentPhaseId: number): TaskPlan {
    const plan = this.planManager.updatePlan(goal, phases, currentPhaseId);
    this.eventEmitter.emit('plan.updated', { plan });
    this.eventEmitter.emit('phase.started', { phase: this.planManager.getCurrentPhase() });
    return plan;
  }

  advancePhase(nextPhaseId: number): TaskPlan {
    const plan = this.planManager.advancePhase(nextPhaseId);
    this.eventEmitter.emit('plan.updated', { plan });
    this.eventEmitter.emit('phase.started', { phase: this.planManager.getCurrentPhase() });
    return plan;
  }

  // ---------------------------------------------------------------------------
  // Tool Execution
  // ---------------------------------------------------------------------------

  recordToolCall(toolCall: ToolCall): void {
    this.toolHistory.push(toolCall);
    this.eventEmitter.emit('action.started', {
      toolName: toolCall.name,
      parameters: toolCall.parameters,
    });
  }

  recordToolResult(result: ToolResult): void {
    this.resultHistory.push(result);
    
    const toolCall = this.toolHistory.find(tc => tc.id === result.toolCallId);
    
    this.eventEmitter.emit('action.completed', {
      toolName: toolCall?.name,
      parameters: toolCall?.parameters,
      result,
    });

    this.eventEmitter.emit('observation.received', {
      toolCallId: result.toolCallId,
      success: result.success,
      output: result.output,
    });

    if (result.success) {
      // Stay in EXECUTING state (loop)
      // State machine already handles this
    } else {
      this.handleToolFailure(result);
    }
  }

  private handleToolFailure(result: ToolResult): void {
    if (this.stateMachine.incrementRetry()) {
      // Retry is allowed
      const delay = this.stateMachine.getRetryDelay();
      console.log(`[Orchestrator] Retrying in ${delay}ms (attempt ${this.stateMachine.getRetryCount()})`);
      // In real implementation, would schedule retry
    } else {
      // Max retries exceeded - escalate to user
      this.requestUserInput('Tool execution failed after multiple retries. Please provide guidance.');
    }
  }

  // ---------------------------------------------------------------------------
  // User Interaction
  // ---------------------------------------------------------------------------

  requestUserInput(message: string): void {
    this.stateMachine.transition('WAITING', 'user_input_needed');
    this.eventEmitter.emit('message.sent', { type: 'ask', text: message });
  }

  receiveUserInput(input: string): void {
    this.stateMachine.transition('EXECUTING', 'user_responds');
    this.eventEmitter.emit('observation.received', { type: 'user_input', input });
  }

  // ---------------------------------------------------------------------------
  // Task Completion
  // ---------------------------------------------------------------------------

  completeTask(result: { text: string; attachments: string[] }): void {
    this.stateMachine.transition('DELIVERING', 'task_complete');
    this.eventEmitter.emit('message.sent', { type: 'result', ...result });
    this.eventEmitter.emit('task.completed', { result });
    this.stateMachine.transition('IDLE', 'result_sent');
  }

  failTask(error: ApiError): void {
    this.planManager.markCurrentPhaseFailed();
    this.eventEmitter.emit('task.failed', { error });
    this.stateMachine.transition('FAILED', 'max_retries_exceeded');
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  getToolHistory(): ToolCall[] {
    return [...this.toolHistory];
  }

  getResultHistory(): ToolResult[] {
    return [...this.resultHistory];
  }

  isComplete(): boolean {
    return this.planManager.isComplete();
  }

  getCurrentPhase(): Phase | null {
    return this.planManager.getCurrentPhase();
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createOrchestrator(config: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
