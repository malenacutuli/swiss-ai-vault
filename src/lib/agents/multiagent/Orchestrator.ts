/**
 * Orchestrator Agent - Coordinates multi-agent task execution
 * Decomposes tasks, dispatches agents, and synthesizes results
 */

import { 
  AGENT_DEFINITIONS, 
  AgentRole, 
  getAgentDefinition, 
  selectBestAgent 
} from './AgentRegistry';
import { 
  MessageBus, 
  createMessageBus, 
  AgentMessage 
} from './MessageBus';
import { 
  SharedStateManager, 
  createSharedState, 
  Phase, 
  Subtask,
  TaskStatus 
} from './SharedState';

export interface TaskPlan {
  objective: string;
  phases: Phase[];
  estimatedDuration: number;
  requiredCapabilities: string[];
}

export interface OrchestratorConfig {
  taskId: string;
  userId: string;
  objective: string;
  maxParallelAgents?: number;
  timeoutMs?: number;
  autoRetry?: boolean;
}

interface ActiveAgent {
  agentId: string;
  role: AgentRole;
  subtaskId: string;
  startedAt: number;
}

/**
 * Orchestrator class - Manages multi-agent task execution
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private messageBus: MessageBus;
  private sharedState: SharedStateManager;
  private activeAgents: Map<string, ActiveAgent> = new Map();
  private agentCounter = 0;
  private isRunning = false;
  private onProgressCallback?: (progress: number, message: string) => void;

  constructor(config: OrchestratorConfig) {
    this.config = {
      maxParallelAgents: 5,
      timeoutMs: 300000, // 5 minutes
      autoRetry: true,
      ...config,
    };

    const orchestratorId = `orchestrator-${config.taskId}`;
    this.messageBus = createMessageBus(orchestratorId, 'orchestrator', config.taskId);
    this.sharedState = createSharedState(config.taskId, config.userId);
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.messageBus.initialize();
    await this.sharedState.initialize();

    // Set up message handlers
    this.messageBus.onMessage('task_result', this.handleTaskResult.bind(this));
    this.messageBus.onMessage('error', this.handleAgentError.bind(this));
    this.messageBus.onMessage('heartbeat', this.handleHeartbeat.bind(this));
    this.messageBus.onMessage('progress', this.handleProgress.bind(this));

    // Register orchestrator
    await this.sharedState.registerAgent(`orchestrator-${this.config.taskId}`, 'orchestrator');

    console.log('[Orchestrator] Initialized');
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: number, message: string) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Create a task plan from the objective
   */
  async createPlan(objective: string): Promise<TaskPlan> {
    await this.sharedState.set('status', 'planning');
    
    // Analyze objective and create phases
    const phases: Phase[] = [];
    
    // Phase 1: Research (if needed)
    if (this.needsResearch(objective)) {
      phases.push({
        id: crypto.randomUUID(),
        title: 'Research',
        description: `Gather information related to: ${objective}`,
        status: 'pending',
        dependencies: [],
        subtasks: [
          {
            id: crypto.randomUUID(),
            title: 'Web Search',
            description: 'Search for relevant information',
            status: 'pending',
          },
        ],
      });
    }

    // Phase 2: Analysis
    if (this.needsAnalysis(objective)) {
      phases.push({
        id: crypto.randomUUID(),
        title: 'Analysis',
        description: 'Analyze gathered information',
        status: 'pending',
        dependencies: phases.length > 0 ? [phases[phases.length - 1].id] : [],
        subtasks: [
          {
            id: crypto.randomUUID(),
            title: 'Data Analysis',
            description: 'Process and analyze data',
            status: 'pending',
          },
        ],
      });
    }

    // Phase 3: Execution
    phases.push({
      id: crypto.randomUUID(),
      title: 'Execution',
      description: 'Execute the main task',
      status: 'pending',
      dependencies: phases.length > 0 ? [phases[phases.length - 1].id] : [],
      subtasks: [
        {
          id: crypto.randomUUID(),
          title: 'Main Task',
          description: objective,
          status: 'pending',
        },
      ],
    });

    // Phase 4: Review
    phases.push({
      id: crypto.randomUUID(),
      title: 'Review',
      description: 'Review and verify results',
      status: 'pending',
      dependencies: [phases[phases.length - 1].id],
      subtasks: [
        {
          id: crypto.randomUUID(),
          title: 'Quality Check',
          description: 'Verify output quality',
          status: 'pending',
        },
      ],
    });

    const plan: TaskPlan = {
      objective,
      phases,
      estimatedDuration: phases.length * 30000, // 30s per phase estimate
      requiredCapabilities: this.extractCapabilities(objective),
    };

    // Store plan in shared state
    await this.sharedState.set('plan', {
      phases,
      currentPhase: 0,
      totalPhases: phases.length,
    });

    await this.sharedState.set('objective', objective);

    return plan;
  }

  /**
   * Execute the task plan
   */
  async execute(plan?: TaskPlan): Promise<void> {
    if (!plan) {
      plan = await this.createPlan(this.config.objective);
    }

    this.isRunning = true;
    await this.sharedState.set('status', 'executing');

    try {
      for (let i = 0; i < plan.phases.length; i++) {
        if (!this.isRunning) break;

        const phase = plan.phases[i];
        
        // Check dependencies
        const canStart = await this.canStartPhase(phase, plan.phases);
        if (!canStart) {
          console.log(`[Orchestrator] Waiting for dependencies of phase: ${phase.title}`);
          continue;
        }

        await this.executePhase(phase, i, plan.phases.length);
      }

      if (this.isRunning) {
        await this.sharedState.set('status', 'completed');
        await this.sharedState.set('metrics.completedAt', new Date().toISOString());
        this.reportProgress(100, 'Task completed successfully');
      }
    } catch (error) {
      await this.handleError(error as Error);
    }
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    phase: Phase,
    phaseIndex: number,
    totalPhases: number
  ): Promise<void> {
    // Update phase status directly in state
    const plan = await this.sharedState.get<{ phases: Phase[] }>('plan');
    if (plan) {
      const updatedPhases = plan.phases.map((p) =>
        p.id === phase.id ? { ...p, status: 'in_progress' as const, startedAt: new Date().toISOString() } : p
      );
      await this.sharedState.set('plan.phases', updatedPhases);
    }

    const baseProgress = (phaseIndex / totalPhases) * 100;
    this.reportProgress(baseProgress, `Starting phase: ${phase.title}`);

    // Execute subtasks (potentially in parallel)
    const parallelSubtasks = this.groupParallelSubtasks(phase.subtasks);

    for (const subtaskGroup of parallelSubtasks) {
      await Promise.all(
        subtaskGroup.map((subtask) => this.executeSubtask(subtask, phase))
      );
    }

    // Update phase as completed
    const planAfter = await this.sharedState.get<{ phases: Phase[] }>('plan');
    if (planAfter) {
      const updatedPhases = planAfter.phases.map((p) =>
        p.id === phase.id ? { ...p, status: 'completed' as const, completedAt: new Date().toISOString() } : p
      );
      await this.sharedState.set('plan.phases', updatedPhases);
    }

    await this.sharedState.set('plan.currentPhase', phaseIndex + 1);
  }

  /**
   * Execute a single subtask by dispatching to an agent
   */
  private async executeSubtask(subtask: Subtask, phase: Phase): Promise<void> {
    // Find best agent for this subtask
    const requiredCapabilities = this.getSubtaskCapabilities(subtask, phase);
    const agentRole = selectBestAgent(requiredCapabilities);

    if (!agentRole) {
      throw new Error(`No agent available for subtask: ${subtask.title}`);
    }

    // Create agent instance
    const agentId = `${agentRole}-${this.config.taskId}-${++this.agentCounter}`;
    
    // Track active agent
    this.activeAgents.set(agentId, {
      agentId,
      role: agentRole,
      subtaskId: subtask.id,
      startedAt: Date.now(),
    });

    // Dispatch task to agent
    await this.messageBus.broadcastToRole(agentRole, {
      type: 'task_assignment',
      taskId: this.config.taskId,
      priority: 'normal',
      payload: {
        subtaskId: subtask.id,
        phaseId: phase.id,
        title: subtask.title,
        description: subtask.description,
        context: await this.sharedState.get('context'),
      },
    });
  }

  /**
   * Handle task result from an agent
   */
  private async handleTaskResult(message: AgentMessage): Promise<void> {
    const { subtaskId, result, error } = message.payload as {
      subtaskId: string;
      result?: unknown;
      error?: string;
    };

    // Find the phase containing this subtask
    const planData = await this.sharedState.get<{ phases: Phase[] }>('plan');
    if (!planData) return;

    for (const phase of planData.phases) {
      const foundSubtask = phase.subtasks.find((s) => s.id === subtaskId);
      if (foundSubtask) {
        // Remove from active agents
        const activeAgent = Array.from(this.activeAgents.values()).find(
          (a) => a.subtaskId === subtaskId
        );
        if (activeAgent) {
          this.activeAgents.delete(activeAgent.agentId);
        }

        break;
      }
    }
  }

  /**
   * Handle agent error
   */
  private async handleAgentError(message: AgentMessage): Promise<void> {
    const { subtaskId, error, recoverable } = message.payload as {
      subtaskId: string;
      error: string;
      recoverable: boolean;
    };

    console.error(`[Orchestrator] Agent error: ${error}`);

    if (recoverable && this.config.autoRetry) {
      // Find and retry the subtask
      const plan = await this.sharedState.get<{ phases: Phase[] }>('plan');
      if (plan) {
        for (const phase of plan.phases) {
          const subtask = phase.subtasks.find((s) => s.id === subtaskId);
          if (subtask) {
            await this.executeSubtask(subtask, phase);
            return;
          }
        }
      }
    }

    await this.handleError(new Error(error));
  }

  /**
   * Handle heartbeat from agents
   */
  private async handleHeartbeat(message: AgentMessage): Promise<void> {
    const { agentId, status } = message.payload as {
      agentId: string;
      status: string;
    };

    await this.sharedState.updateAgentStatus(agentId, {
      status: status as 'idle' | 'busy' | 'waiting' | 'error',
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * Handle progress updates from agents
   */
  private async handleProgress(message: AgentMessage): Promise<void> {
    const { subtaskId, progress, message: progressMessage } = message.payload as {
      subtaskId: string;
      progress: number;
      message: string;
    };

    // Could update UI with more granular progress
    console.log(`[Orchestrator] Progress for ${subtaskId}: ${progress}% - ${progressMessage}`);
  }

  /**
   * Handle errors
   */
  private async handleError(error: Error): Promise<void> {
    console.error('[Orchestrator] Task failed:', error);
    
    await this.sharedState.set('status', 'failed');
    await this.sharedState.set('error', {
      message: error.message,
      code: 'ORCHESTRATION_ERROR',
      recoverable: false,
      timestamp: new Date().toISOString(),
    });

    this.isRunning = false;
  }

  /**
   * Cancel the current execution
   */
  async cancel(): Promise<void> {
    this.isRunning = false;

    // Send interrupt to all active agents
    for (const [agentId, agent] of this.activeAgents) {
      await this.messageBus.sendToAgent(agentId, agent.role, {
        type: 'interrupt',
        taskId: this.config.taskId,
        priority: 'critical',
        payload: { reason: 'cancelled' },
      });
    }

    await this.sharedState.set('status', 'cancelled');
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    await this.cancel();
    await this.messageBus.shutdown();
    await this.sharedState.shutdown();
    this.activeAgents.clear();
  }

  /**
   * Report progress
   */
  private reportProgress(progress: number, message: string): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress, message);
    }
  }

  /**
   * Check if a phase can start (all dependencies complete)
   */
  private async canStartPhase(phase: Phase, allPhases: Phase[]): Promise<boolean> {
    for (const depId of phase.dependencies) {
      const depPhase = allPhases.find((p) => p.id === depId);
      if (depPhase && depPhase.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Group subtasks that can run in parallel
   */
  private groupParallelSubtasks(subtasks: Subtask[]): Subtask[][] {
    // For now, simple sequential grouping
    // Could be enhanced to detect independent subtasks
    return subtasks.map((s) => [s]);
  }

  /**
   * Get required capabilities for a subtask
   */
  private getSubtaskCapabilities(subtask: Subtask, phase: Phase): string[] {
    const title = subtask.title.toLowerCase();
    const capabilities: string[] = [];

    if (title.includes('search') || title.includes('research')) {
      capabilities.push('web_search');
    }
    if (title.includes('code') || title.includes('implement')) {
      capabilities.push('file_write', 'code_review');
    }
    if (title.includes('analyze') || title.includes('data')) {
      capabilities.push('data_process');
    }
    if (title.includes('review') || title.includes('check')) {
      capabilities.push('code_review', 'fact_check');
    }

    return capabilities.length > 0 ? capabilities : ['task_planning'];
  }

  /**
   * Check if objective needs research
   */
  private needsResearch(objective: string): boolean {
    const keywords = ['research', 'find', 'search', 'learn', 'discover', 'investigate'];
    return keywords.some((k) => objective.toLowerCase().includes(k));
  }

  /**
   * Check if objective needs analysis
   */
  private needsAnalysis(objective: string): boolean {
    const keywords = ['analyze', 'compare', 'evaluate', 'assess', 'measure', 'data'];
    return keywords.some((k) => objective.toLowerCase().includes(k));
  }

  /**
   * Extract required capabilities from objective
   */
  private extractCapabilities(objective: string): string[] {
    const capabilities: string[] = [];
    const lower = objective.toLowerCase();

    if (lower.includes('search') || lower.includes('find')) {
      capabilities.push('web_search');
    }
    if (lower.includes('code') || lower.includes('program')) {
      capabilities.push('file_write', 'code_review');
    }
    if (lower.includes('write') || lower.includes('document')) {
      capabilities.push('report_write');
    }
    if (lower.includes('analyze') || lower.includes('chart')) {
      capabilities.push('data_process', 'chart_generate');
    }

    return capabilities;
  }
}

/**
 * Factory function to create an orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
