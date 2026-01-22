/**
 * Agent Orchestrator
 * Implements the ReAct pattern with strict state machine for Manus parity
 */

import {
  Task,
  TaskState,
  VALID_TRANSITIONS,
  ExecutionPlan,
  PlanPhase,
  AgentAction,
  ToolCall,
  ToolResult,
  SSEEvent,
} from '../types/agent';
import { ManusClient, ManusMessage, MANUS_TOOLS } from './manus-client';

// ===========================================
// SYSTEM PROMPT (Manus-parity)
// ===========================================

const SYSTEM_PROMPT = `You are an autonomous AI agent that completes tasks through iterative planning and execution.

You operate in an agent loop with these steps:
1. Analyze context: Understand the user's intent and current state
2. Think: Reason about whether to update the plan, advance the phase, or take a specific action
3. Select tool: Choose the next tool based on the plan and state
4. Execute action: The tool will be executed in the sandbox environment
5. Receive observation: The result will be appended to the context
6. Iterate: Repeat until the task is fully completed
7. Deliver outcome: Send results to the user via message tool

CRITICAL RULES:
- You MUST respond with exactly one tool call per response
- You MUST use the 'plan' tool to create a plan before executing any other tools
- You MUST use the 'message' tool with type 'result' to deliver final results
- You MUST NOT skip phases or go backward in the plan
- You MUST advance phases using the 'plan' tool with action 'advance'

Available tools are provided in the tool definitions.`;

// ===========================================
// ORCHESTRATOR CLASS
// ===========================================

export interface OrchestratorConfig {
  manusApiKey: string;
  e2bApiKey?: string;
  maxIterations?: number;
  onEvent?: (event: SSEEvent) => void;
}

export class AgentOrchestrator {
  private manus: ManusClient;
  private e2bApiKey?: string;
  private maxIterations: number;
  private onEvent: (event: SSEEvent) => void;
  
  private task: Task | null = null;
  private messages: ManusMessage[] = [];
  private iteration = 0;

  constructor(config: OrchestratorConfig) {
    this.manus = new ManusClient({ apiKey: config.manusApiKey });
    this.e2bApiKey = config.e2bApiKey;
    this.maxIterations = config.maxIterations || 50;
    this.onEvent = config.onEvent || (() => {});
  }

  /**
   * Execute a task from start to completion
   */
  async executeTask(taskId: string, prompt: string, userId: string): Promise<Task> {
    // Initialize task
    this.task = {
      id: taskId,
      userId,
      prompt,
      state: 'idle',
      plan: null,
      currentPhaseId: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      result: null,
    };

    // Initialize conversation
    this.messages = [
      { role: 'user', content: prompt },
    ];

    // Emit task started event
    this.emit({
      type: 'task_started',
      timestamp: new Date().toISOString(),
      data: { taskId, prompt },
    });

    // Transition to planning
    await this.transitionState('planning');

    // Main execution loop
    try {
      while (this.iteration < this.maxIterations) {
        this.iteration++;

        // Check for terminal states
        if (this.isTerminalState()) {
          break;
        }

        // Get next action from Manus
        const action = await this.getNextAction();
        if (!action) {
          await this.handleError('Failed to determine next action');
          break;
        }

        // Execute the action
        const result = await this.executeAction(action);

        // Add result to conversation
        this.messages.push({
          role: 'assistant',
          content: JSON.stringify(result),
        });

        // Handle special actions
        if (action.type === 'task_complete') {
          await this.transitionState('completed');
          break;
        }

        if (action.type === 'request_input') {
          await this.transitionState('waiting_user');
          break;
        }
      }

      // Check if max iterations reached
      if (this.iteration >= this.maxIterations && !this.isTerminalState()) {
        await this.handleError('Maximum iterations reached');
      }

    } catch (error) {
      await this.handleError(error instanceof Error ? error.message : 'Unknown error');
    }

    return this.task;
  }

  /**
   * Resume a task after user input
   */
  async resumeTask(task: Task, userInput: string): Promise<Task> {
    this.task = task;
    
    // Add user input to conversation
    this.messages.push({
      role: 'user',
      content: userInput,
    });

    // Transition back to executing
    await this.transitionState('executing');

    // Continue execution loop
    return this.executeTask(task.id, task.prompt, task.userId);
  }

  /**
   * Cancel a running task
   */
  async cancelTask(): Promise<void> {
    if (this.task && !this.isTerminalState()) {
      await this.transitionState('cancelled');
    }
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  private async getNextAction(): Promise<AgentAction | null> {
    try {
      // Emit thinking event
      this.emit({
        type: 'thinking',
        timestamp: new Date().toISOString(),
        data: { content: 'Analyzing context and determining next action...' },
      });

      // Call Manus API
      const response = await this.manus.createCompletion({
        model: 'manus-1.6-max',
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          ...this.messages,
        ],
        tools: MANUS_TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
        temperature: 0.7,
      });

      const choice = response.choices[0];
      if (!choice) return null;

      // Handle tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);

        return {
          type: 'tool',
          toolName: toolCall.function.name as any,
          toolInput: args,
          reasoning: choice.message.content || undefined,
        };
      }

      // Handle text response (shouldn't happen with tool_choice: auto)
      if (choice.message.content) {
        return {
          type: 'message',
          message: choice.message.content,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting next action:', error);
      return null;
    }
  }

  private async executeAction(action: AgentAction): Promise<ToolResult> {
    if (action.type !== 'tool' || !action.toolName || !action.toolInput) {
      return {
        toolCallId: 'unknown',
        success: false,
        output: 'Invalid action',
        error: 'Action must be a tool call',
      };
    }

    // Emit tool started event
    this.emit({
      type: 'tool_started',
      timestamp: new Date().toISOString(),
      data: {
        toolName: action.toolName,
        toolInput: action.toolInput,
      },
    });

    try {
      let result: ToolResult;

      switch (action.toolName) {
        case 'plan':
          result = await this.executePlanTool(action.toolInput);
          break;
        case 'message':
          result = await this.executeMessageTool(action.toolInput);
          break;
        case 'shell':
          result = await this.executeShellTool(action.toolInput);
          break;
        case 'file':
          result = await this.executeFileTool(action.toolInput);
          break;
        case 'search':
          result = await this.executeSearchTool(action.toolInput);
          break;
        default:
          result = await this.executeGenericTool(action.toolName, action.toolInput);
      }

      // Emit tool completed event
      this.emit({
        type: 'tool_completed',
        timestamp: new Date().toISOString(),
        data: {
          toolName: action.toolName,
          success: result.success,
          output: result.output,
        },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolCallId: action.toolName,
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  // ===========================================
  // TOOL IMPLEMENTATIONS
  // ===========================================

  private async executePlanTool(input: Record<string, unknown>): Promise<ToolResult> {
    const action = input.action as string;

    if (action === 'update') {
      const plan: ExecutionPlan = {
        goal: input.goal as string,
        phases: (input.phases as any[]).map((p, i) => ({
          id: p.id || i + 1,
          title: p.title,
          description: p.description,
          capabilities: p.capabilities || {},
          status: i === 0 ? 'active' : 'pending',
        })),
      };

      this.task!.plan = plan;
      this.task!.currentPhaseId = input.current_phase_id as number;

      // Transition to executing after plan is created
      if (this.task!.state === 'planning') {
        await this.transitionState('executing');
      }

      // Emit plan created event
      this.emit({
        type: 'plan_created',
        timestamp: new Date().toISOString(),
        data: { plan },
      });

      return {
        toolCallId: 'plan',
        success: true,
        output: `Plan created with ${plan.phases.length} phases. Current phase: ${this.task!.currentPhaseId}`,
      };
    }

    if (action === 'advance') {
      const nextPhaseId = input.next_phase_id as number;
      const currentPhase = this.task!.plan?.phases.find(p => p.id === this.task!.currentPhaseId);
      const nextPhase = this.task!.plan?.phases.find(p => p.id === nextPhaseId);

      if (currentPhase) {
        currentPhase.status = 'completed';
      }
      if (nextPhase) {
        nextPhase.status = 'active';
      }

      this.task!.currentPhaseId = nextPhaseId;

      // Emit phase events
      this.emit({
        type: 'phase_completed',
        timestamp: new Date().toISOString(),
        data: { phaseId: input.current_phase_id },
      });

      this.emit({
        type: 'phase_started',
        timestamp: new Date().toISOString(),
        data: { phaseId: nextPhaseId, title: nextPhase?.title },
      });

      return {
        toolCallId: 'plan',
        success: true,
        output: `Advanced to phase ${nextPhaseId}: ${nextPhase?.title}`,
      };
    }

    return {
      toolCallId: 'plan',
      success: false,
      output: '',
      error: `Unknown plan action: ${action}`,
    };
  }

  private async executeMessageTool(input: Record<string, unknown>): Promise<ToolResult> {
    const type = input.type as string;
    const text = input.text as string;
    const attachments = input.attachments as string[] | undefined;

    // Emit message event
    this.emit({
      type: 'message',
      timestamp: new Date().toISOString(),
      data: {
        role: 'assistant',
        content: text,
        messageType: type,
        attachments,
      },
    });

    // Handle result type - task completion
    if (type === 'result') {
      this.task!.result = {
        message: text,
        attachments: (attachments || []).map(path => ({
          type: 'file' as const,
          name: path.split('/').pop() || path,
          path,
        })),
      };

      return {
        toolCallId: 'message',
        success: true,
        output: 'Result delivered to user. Task completed.',
      };
    }

    return {
      toolCallId: 'message',
      success: true,
      output: `Message sent to user (type: ${type})`,
    };
  }

  private async executeShellTool(input: Record<string, unknown>): Promise<ToolResult> {
    // This would integrate with E2B sandbox
    // For now, return a placeholder
    const action = input.action as string;
    const command = input.command as string;

    // Emit tool output
    this.emit({
      type: 'tool_output',
      timestamp: new Date().toISOString(),
      data: {
        toolName: 'shell',
        output: `[Shell ${action}] ${command || ''}`,
        isPartial: false,
      },
    });

    return {
      toolCallId: 'shell',
      success: true,
      output: `Shell command executed: ${command}`,
    };
  }

  private async executeFileTool(input: Record<string, unknown>): Promise<ToolResult> {
    const action = input.action as string;
    const path = input.path as string;

    return {
      toolCallId: 'file',
      success: true,
      output: `File ${action} on ${path}`,
    };
  }

  private async executeSearchTool(input: Record<string, unknown>): Promise<ToolResult> {
    const type = input.type as string;
    const queries = input.queries as string[];

    return {
      toolCallId: 'search',
      success: true,
      output: `Search (${type}) for: ${queries.join(', ')}`,
    };
  }

  private async executeGenericTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    return {
      toolCallId: toolName,
      success: true,
      output: `Tool ${toolName} executed with input: ${JSON.stringify(input)}`,
    };
  }

  // ===========================================
  // STATE MANAGEMENT
  // ===========================================

  private async transitionState(newState: TaskState): Promise<void> {
    if (!this.task) return;

    const currentState = this.task.state;
    const validTransitions = VALID_TRANSITIONS[currentState];

    if (!validTransitions.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} -> ${newState}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }

    this.task.state = newState;
    this.task.updatedAt = new Date().toISOString();

    if (newState === 'completed' || newState === 'failed' || newState === 'cancelled') {
      this.task.completedAt = new Date().toISOString();
    }
  }

  private isTerminalState(): boolean {
    if (!this.task) return true;
    return ['completed', 'failed', 'cancelled'].includes(this.task.state);
  }

  private async handleError(message: string): Promise<void> {
    if (this.task) {
      this.task.error = message;
      await this.transitionState('failed');

      this.emit({
        type: 'task_failed',
        timestamp: new Date().toISOString(),
        data: { error: message },
      });
    }
  }

  private buildSystemPrompt(): string {
    let prompt = SYSTEM_PROMPT;

    if (this.task?.plan) {
      prompt += `\n\nCurrent Plan:\nGoal: ${this.task.plan.goal}\n`;
      prompt += `Phases:\n`;
      for (const phase of this.task.plan.phases) {
        const status = phase.id === this.task.currentPhaseId ? '→ CURRENT' : phase.status;
        prompt += `  ${phase.id}. ${phase.title} [${status}]\n`;
      }
    }

    return prompt;
  }

  private emit(event: SSEEvent): void {
    this.onEvent(event);
  }
}

export default AgentOrchestrator;
