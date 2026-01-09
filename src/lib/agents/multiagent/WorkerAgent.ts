/**
 * WorkerAgent - Base class for specialized worker agents
 * Handles task execution, communication, and lifecycle management
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  MessageBus, 
  createMessageBus, 
  AgentMessage 
} from './MessageBus';
import { 
  AgentRole, 
  getAgentDefinition,
  AgentDefinition 
} from './AgentRegistry';

export interface WorkerContext {
  taskId: string;
  subtaskId: string;
  phaseId: string;
  description: string;
  dependencies: Record<string, unknown>;
  memory: Record<string, unknown>;
}

export interface WorkerResult {
  success: boolean;
  data?: unknown;
  error?: string;
  artifacts?: Array<{
    type: string;
    name: string;
    content: unknown;
  }>;
  metrics?: {
    tokensUsed?: number;
    durationMs?: number;
  };
}

export type WorkerStatus = 'idle' | 'busy' | 'waiting' | 'error' | 'terminated';

export interface WorkerConfig {
  taskId: string;
  userId: string;
  role: AgentRole;
  agentId?: string;
}

/**
 * Abstract base class for worker agents
 */
export abstract class WorkerAgent {
  protected config: WorkerConfig;
  protected definition: AgentDefinition;
  protected messageBus: MessageBus;
  protected agentId: string;
  protected status: WorkerStatus = 'idle';
  protected currentContext: WorkerContext | null = null;
  protected startTime: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.definition = getAgentDefinition(config.role);
    this.agentId = config.agentId || `${config.role}-${config.taskId}-${crypto.randomUUID().slice(0, 8)}`;
    this.messageBus = createMessageBus(this.agentId, config.role, config.taskId);
  }

  /**
   * Initialize the worker agent
   */
  async initialize(): Promise<void> {
    await this.messageBus.initialize();

    // Set up message handlers
    this.messageBus.onMessage('task_assignment', this.handleTaskAssignment.bind(this));
    this.messageBus.onMessage('interrupt', this.handleInterrupt.bind(this));
    this.messageBus.onMessage('state_update', this.handleStateUpdate.bind(this));

    // Register in database
    await this.registerAgent();

    // Start heartbeat
    this.startHeartbeat();

    console.log(`[WorkerAgent] ${this.agentId} initialized`);
  }

  /**
   * Handle incoming task assignment
   */
  private async handleTaskAssignment(message: AgentMessage): Promise<void> {
    const { subtaskId, phaseId, title, description, context } = message.payload as {
      subtaskId: string;
      phaseId: string;
      title: string;
      description: string;
      context: Record<string, unknown>;
    };

    // Check if already busy
    if (this.status === 'busy') {
      console.log(`[WorkerAgent] ${this.agentId} is busy, ignoring assignment`);
      return;
    }

    this.status = 'busy';
    this.startTime = Date.now();
    await this.updateStatus('busy', subtaskId);

    // Build context
    this.currentContext = {
      taskId: this.config.taskId,
      subtaskId,
      phaseId,
      description,
      dependencies: context || {},
      memory: {},
    };

    // Set timeout
    this.setExecutionTimeout();

    try {
      // Report progress
      await this.reportProgress(0, `Starting: ${title}`);

      // Execute the task (implemented by subclass)
      const result = await this.executeTask(this.currentContext);

      // Report completion
      await this.reportResult(subtaskId, result);
      await this.reportProgress(100, `Completed: ${title}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WorkerAgent] ${this.agentId} error:`, error);
      
      await this.reportError(subtaskId, errorMessage, this.isRecoverableError(error));
    } finally {
      this.clearExecutionTimeout();
      this.status = 'idle';
      this.currentContext = null;
      await this.updateStatus('idle');
    }
  }

  /**
   * Handle interrupt signal
   */
  private async handleInterrupt(message: AgentMessage): Promise<void> {
    const { reason } = message.payload as { reason: string };
    
    console.log(`[WorkerAgent] ${this.agentId} interrupted: ${reason}`);
    
    this.status = 'terminated';
    this.clearExecutionTimeout();
    
    // Cleanup
    await this.onInterrupt(reason);
    await this.updateStatus('terminated');
  }

  /**
   * Handle state updates
   */
  private async handleStateUpdate(message: AgentMessage): Promise<void> {
    // Subclasses can override to react to state changes
    await this.onStateUpdate(message.payload as Record<string, unknown>);
  }

  /**
   * Abstract method - implement task execution logic
   */
  protected abstract executeTask(context: WorkerContext): Promise<WorkerResult>;

  /**
   * Optional hook for interrupt handling
   */
  protected async onInterrupt(reason: string): Promise<void> {
    // Subclasses can override
  }

  /**
   * Optional hook for state updates
   */
  protected async onStateUpdate(state: Record<string, unknown>): Promise<void> {
    // Subclasses can override
  }

  /**
   * Report task result to orchestrator
   */
  private async reportResult(subtaskId: string, result: WorkerResult): Promise<void> {
    const durationMs = Date.now() - this.startTime;

    await this.messageBus.broadcast({
      type: 'task_result',
      taskId: this.config.taskId,
      priority: 'normal',
      payload: {
        subtaskId,
        success: result.success,
        result: result.data,
        error: result.error,
        artifacts: result.artifacts,
        metrics: {
          ...result.metrics,
          durationMs,
        },
      },
    });

    // Update metrics in database
    await this.updateMetrics(result.success, durationMs);
  }

  /**
   * Report error to orchestrator
   */
  private async reportError(
    subtaskId: string, 
    error: string, 
    recoverable: boolean
  ): Promise<void> {
    await this.messageBus.broadcast({
      type: 'error',
      taskId: this.config.taskId,
      priority: 'high',
      payload: {
        subtaskId,
        error,
        recoverable,
        agentId: this.agentId,
        role: this.config.role,
      },
    });
  }

  /**
   * Report progress
   */
  protected async reportProgress(progress: number, message: string): Promise<void> {
    await this.messageBus.broadcast({
      type: 'progress',
      taskId: this.config.taskId,
      priority: 'low',
      payload: {
        subtaskId: this.currentContext?.subtaskId,
        progress,
        message,
        agentId: this.agentId,
      },
    });
  }

  /**
   * Register agent in database
   */
  private async registerAgent(): Promise<void> {
    try {
      await supabase.from('agent_instances').upsert({
        task_id: this.config.taskId,
        agent_id: this.agentId,
        role: this.config.role,
        status: 'idle',
        last_heartbeat: new Date().toISOString(),
      }, {
        onConflict: 'agent_id',
      });
    } catch (error) {
      console.error('[WorkerAgent] Failed to register:', error);
    }
  }

  /**
   * Update agent status in database
   */
  private async updateStatus(status: WorkerStatus, currentSubtask?: string): Promise<void> {
    try {
      await supabase
        .from('agent_instances')
        .update({
          status,
          current_subtask: currentSubtask || null,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('agent_id', this.agentId);
    } catch (error) {
      console.error('[WorkerAgent] Failed to update status:', error);
    }
  }

  /**
   * Update metrics after task completion
   */
  private async updateMetrics(success: boolean, durationMs: number): Promise<void> {
    try {
      // Fetch current metrics
      const { data } = await supabase
        .from('agent_instances')
        .select('metrics')
        .eq('agent_id', this.agentId)
        .single();

      if (data) {
        const currentMetrics = (data.metrics as Record<string, number>) || {
          tasksCompleted: 0,
          tasksFailed: 0,
          avgDurationMs: 0,
        };

        const totalTasks = currentMetrics.tasksCompleted + currentMetrics.tasksFailed;
        const newMetrics = {
          tasksCompleted: currentMetrics.tasksCompleted + (success ? 1 : 0),
          tasksFailed: currentMetrics.tasksFailed + (success ? 0 : 1),
          avgDurationMs: totalTasks > 0 
            ? (currentMetrics.avgDurationMs * totalTasks + durationMs) / (totalTasks + 1)
            : durationMs,
        };

        await supabase
          .from('agent_instances')
          .update({ metrics: newMetrics })
          .eq('agent_id', this.agentId);
      }
    } catch (error) {
      console.error('[WorkerAgent] Failed to update metrics:', error);
    }
  }

  /**
   * Start sending heartbeats
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.updateStatus(this.status, this.currentContext?.subtaskId);
    }, 10000); // Every 10 seconds
  }

  /**
   * Set execution timeout
   */
  private setExecutionTimeout(): void {
    const timeout = this.definition.timeoutMs;
    
    this.timeoutTimer = setTimeout(async () => {
      console.warn(`[WorkerAgent] ${this.agentId} timed out after ${timeout}ms`);
      
      if (this.currentContext) {
        await this.reportError(
          this.currentContext.subtaskId,
          `Task timed out after ${timeout}ms`,
          true
        );
      }
      
      this.status = 'error';
      await this.updateStatus('error');
    }, timeout);
  }

  /**
   * Clear execution timeout
   */
  private clearExecutionTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Network errors, rate limits are recoverable
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('rate limit') ||
             message.includes('429') ||
             message.includes('503');
    }
    return false;
  }

  /**
   * Get system prompt for this agent
   */
  protected getSystemPrompt(): string {
    return this.definition.systemPrompt;
  }

  /**
   * Get available tools for this agent
   */
  protected getAvailableTools(): string[] {
    return this.definition.capabilities;
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clearExecutionTimeout();
    
    await this.updateStatus('terminated');
    await this.messageBus.shutdown();
    
    console.log(`[WorkerAgent] ${this.agentId} shutdown complete`);
  }
}

/**
 * Factory function to create a worker agent
 */
export function createWorkerAgent(config: WorkerConfig): WorkerAgent {
  // This would be extended to return specific agent implementations
  throw new Error('Use specific agent implementations');
}
