// Agent State Machine - Manages agent run state transitions

export type AgentState = 
  | 'created'
  | 'queued'
  | 'planning'
  | 'executing'
  | 'waiting_input'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StateTransition {
  from: AgentState;
  to: AgentState;
  trigger: string;
  timestamp: string;
}

export interface AgentStateMachineContext {
  runId: string;
  currentState: AgentState;
  history: StateTransition[];
  metadata?: Record<string, any>;
}

export class AgentStateMachine {
  private context: AgentStateMachineContext;

  constructor(runId: string, initialState: AgentState = 'created') {
    this.context = {
      runId,
      currentState: initialState,
      history: [],
    };
  }

  get state(): AgentState {
    return this.context.currentState;
  }

  get runId(): string {
    return this.context.runId;
  }

  canTransition(to: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      'created': ['queued', 'cancelled'],
      'queued': ['planning', 'cancelled'],
      'planning': ['executing', 'failed', 'cancelled'],
      'executing': ['waiting_input', 'paused', 'completed', 'failed', 'cancelled'],
      'waiting_input': ['executing', 'cancelled', 'failed'],
      'paused': ['executing', 'cancelled'],
      'completed': [],
      'failed': ['created'], // retry creates new run
      'cancelled': [],
    };

    return validTransitions[this.context.currentState]?.includes(to) ?? false;
  }

  transition(to: AgentState, trigger: string): boolean {
    if (!this.canTransition(to)) {
      return false;
    }

    this.context.history.push({
      from: this.context.currentState,
      to,
      trigger,
      timestamp: new Date().toISOString(),
    });

    this.context.currentState = to;
    return true;
  }

  getHistory(): StateTransition[] {
    return [...this.context.history];
  }

  toJSON(): AgentStateMachineContext {
    return { ...this.context };
  }

  static fromJSON(data: AgentStateMachineContext): AgentStateMachine {
    const machine = new AgentStateMachine(data.runId, data.currentState);
    machine.context.history = data.history || [];
    machine.context.metadata = data.metadata;
    return machine;
  }
}

export function createStateMachine(runId: string, initialState?: AgentState): AgentStateMachine {
  return new AgentStateMachine(runId, initialState);
}
