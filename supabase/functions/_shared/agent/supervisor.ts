// Agent Supervisor Implementation
// Main execution orchestrator that runs the agent loop

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { invokeLLM, LLMMessage } from '../llm/index.ts';
import { AgentStateMachine, createStateMachine } from './state-machine.ts';
import { executeTransition, TransitionContext } from './transitions.ts';
import { ExecutionPlan, PlanPhase } from './planner.ts';
import { ToolRouter, ToolResult } from '../tools/router.ts';

// Supervisor context
export interface SupervisorContext {
  supabase: ReturnType<typeof createClient>;
  runId: string;
  userId: string;
  plan: ExecutionPlan;
  currentPhaseNumber: number;
  conversationHistory: LLMMessage[];
  stateMachine: AgentStateMachine;
  toolRouter: ToolRouter;
}

// Action decision from LLM
interface AgentAction {
  type: 'tool' | 'message' | 'phase_complete' | 'task_complete' | 'request_input';
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  message?: string;
  reasoning?: string;
}

// Execution result
export interface ExecutionResult {
  status: 'completed' | 'failed' | 'paused' | 'waiting_user';
  error?: string;
  final_message?: string;
}

// Main supervisor class
export class AgentSupervisor {
  private context: SupervisorContext;
  private maxIterations: number = 50;
  private maxContextTokens: number = 100000;

  constructor(context: SupervisorContext) {
    this.context = context;
  }

  // Main execution loop
  async execute(): Promise<ExecutionResult> {
    try {
      // Transition to executing state
      const transCtx: TransitionContext = {
        supabase: this.context.supabase,
        runId: this.context.runId,
        userId: this.context.userId,
        stateMachine: this.context.stateMachine,
      };

      await executeTransition(transCtx, 'executing');

      // Load conversation history from database
      await this.loadConversationHistory();

      let iterations = 0;

      while (iterations < this.maxIterations) {
        iterations++;

        // Check if run has been cancelled or paused
        const { data: run } = await this.context.supabase
          .from('agent_runs')
          .select('status')
          .eq('id', this.context.runId)
          .single();

        if (run?.status === 'cancelled') {
          return { status: 'paused' };
        }

        if (run?.status === 'paused') {
          return { status: 'paused' };
        }

        // Check credit availability
        const hasCredits = await this.checkCredits();
        if (!hasCredits) {
          await this.logError('Insufficient credits to continue');
          await executeTransition(transCtx, 'failed', {
            error_message: 'Insufficient credits',
            error_code: 'INSUFFICIENT_CREDITS',
          });
          return { status: 'failed', error: 'Insufficient credits' };
        }

        // Get current phase
        const currentPhase = this.context.plan.phases.find(
          p => p.phase_number === this.context.currentPhaseNumber
        );

        if (!currentPhase) {
          await this.logError(`Phase ${this.context.currentPhaseNumber} not found in plan`);
          await executeTransition(transCtx, 'failed', {
            error_message: 'Invalid phase number',
          });
          return { status: 'failed', error: 'Invalid phase number' };
        }

        // Decide next action using LLM
        const action = await this.decideNextAction(currentPhase);

        if (!action) {
          await this.logError('Failed to determine next action');
          await executeTransition(transCtx, 'failed', {
            error_message: 'Failed to determine next action',
          });
          return { status: 'failed', error: 'Failed to determine next action' };
        }

        // Log action reasoning
        if (action.reasoning) {
          await this.logInfo(`Agent reasoning: ${action.reasoning}`);
        }

        // Execute action
        const result = await this.executeAction(action, currentPhase);

        if (!result.success) {
          // Handle failure - could retry or replan
          await this.logError(`Action failed: ${result.error}`);

          // For now, fail the run (future: could trigger replanning)
          await executeTransition(transCtx, 'failed', {
            error_message: result.error || 'Action execution failed',
          });
          return { status: 'failed', error: result.error };
        }

        // Handle action result
        if (action.type === 'task_complete') {
          // Task is complete
          await this.logSuccess('Task completed successfully');
          await executeTransition(transCtx, 'completed');
          return {
            status: 'completed',
            final_message: action.message || 'Task completed',
          };
        }

        if (action.type === 'request_input') {
          // Need user input
          await this.logInfo(`Waiting for user input: ${action.message}`);
          await executeTransition(transCtx, 'waiting_user', {
            message: action.message,
          });
          return {
            status: 'waiting_user',
            final_message: action.message,
          };
        }

        if (action.type === 'phase_complete') {
          // Phase completed, advance to next
          await this.logPhaseAdvance(
            this.context.currentPhaseNumber,
            this.context.currentPhaseNumber + 1
          );
          this.context.currentPhaseNumber += 1;

          // Update run with new phase
          await this.context.supabase
            .from('agent_runs')
            .update({ current_phase: this.context.currentPhaseNumber })
            .eq('id', this.context.runId);

          // Check if all phases complete
          if (this.context.currentPhaseNumber > this.context.plan.phases.length) {
            await this.logSuccess('All phases completed');
            await executeTransition(transCtx, 'completed');
            return { status: 'completed', final_message: 'All phases completed' };
          }
        }

        // Trim context if needed
        await this.trimContextIfNeeded();

        // Small delay to prevent tight loops
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Max iterations reached
      await this.logError('Maximum iterations reached');
      await executeTransition(transCtx, 'timeout', {
        error_message: 'Maximum iterations reached',
      });
      return { status: 'failed', error: 'Maximum iterations reached' };

    } catch (error) {
      console.error('Supervisor execution error:', error);

      const transCtx: TransitionContext = {
        supabase: this.context.supabase,
        runId: this.context.runId,
        userId: this.context.userId,
        stateMachine: this.context.stateMachine,
      };

      await executeTransition(transCtx, 'failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Decide next action using LLM
  private async decideNextAction(currentPhase: PlanPhase): Promise<AgentAction | null> {
    try {
      const systemPrompt = this.buildDecisionSystemPrompt(currentPhase);

      // Build conversation with system prompt
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...this.context.conversationHistory,
      ];

      // Call LLM to decide action
      const response = await invokeLLM({
        messages,
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 2048,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'agent_action',
            strict: true,
            schema: {
              type: 'object',
              required: ['type', 'reasoning'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['tool', 'message', 'phase_complete', 'task_complete', 'request_input'],
                },
                tool_name: { type: 'string' },
                tool_input: { type: 'object' },
                message: { type: 'string' },
                reasoning: { type: 'string' },
              },
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      // Parse action
      try {
        const action = JSON.parse(content) as AgentAction;
        return action;
      } catch {
        // Try extracting from markdown
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          const action = JSON.parse(match[1]) as AgentAction;
          return action;
        }
        return null;
      }
    } catch (error) {
      console.error('Decision error:', error);
      return null;
    }
  }

  // Execute an action
  private async executeAction(
    action: AgentAction,
    currentPhase: PlanPhase
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (action.type === 'tool') {
        // Execute tool
        if (!action.tool_name || !action.tool_input) {
          return { success: false, error: 'Tool action missing name or input' };
        }

        // Create step in database
        const { data: step, error: stepError } = await this.context.supabase
          .from('agent_steps')
          .insert({
            run_id: this.context.runId,
            phase_number: this.context.currentPhaseNumber,
            tool_name: action.tool_name,
            tool_input: action.tool_input,
            status: 'pending',
          })
          .select()
          .single();

        if (stepError || !step) {
          return { success: false, error: 'Failed to create step' };
        }

        // Mark step as running
        await this.context.supabase
          .from('agent_steps')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .eq('id', step.id);

        // Execute tool via router
        const result = await this.context.toolRouter.execute(
          action.tool_name,
          action.tool_input,
          {
            runId: this.context.runId,
            userId: this.context.userId,
            stepId: step.id,
          }
        );

        // Deduct credits
        if (result.creditsUsed && result.creditsUsed > 0) {
          await this.deductCredits(result.creditsUsed);
        }

        // Update step with result
        await this.context.supabase
          .from('agent_steps')
          .update({
            status: result.success ? 'completed' : 'failed',
            tool_output: result.output,
            error_message: result.error,
            credits_used: result.creditsUsed || 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', step.id);

        // Handle artifacts if any
        if (result.artifacts && result.artifacts.length > 0) {
          await this.saveArtifacts(result.artifacts);
        }

        // Handle memory if any
        if (result.memory && result.memory.length > 0) {
          await this.saveMemory(result.memory);
        }

        // Add tool result to conversation
        this.context.conversationHistory.push({
          role: 'tool',
          content: JSON.stringify(result.output),
          tool_call_id: step.id,
          tool_name: action.tool_name,
        });

        // Log tool execution
        if (result.success) {
          await this.logToolSuccess(action.tool_name, result.creditsUsed || 0);
        } else {
          await this.logToolError(action.tool_name, result.error || 'Unknown error');
        }

        return { success: result.success, error: result.error };
      }

      if (action.type === 'message') {
        // Send message to user
        if (!action.message) {
          return { success: false, error: 'Message action missing message' };
        }

        await this.context.supabase
          .from('agent_messages')
          .insert({
            run_id: this.context.runId,
            role: 'assistant',
            content: action.message,
          });

        // Add to conversation
        this.context.conversationHistory.push({
          role: 'assistant',
          content: action.message,
        });

        return { success: true };
      }

      if (action.type === 'phase_complete' || action.type === 'task_complete' || action.type === 'request_input') {
        // These are handled in main loop
        return { success: true };
      }

      return { success: false, error: `Unknown action type: ${action.type}` };
    } catch (error) {
      console.error('Action execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Build decision system prompt
  private buildDecisionSystemPrompt(currentPhase: PlanPhase): string {
    return `You are an AI agent executor. You are currently executing a multi-phase plan.

OVERALL GOAL: ${this.context.plan.goal}

CURRENT PHASE: Phase ${currentPhase.phase_number} - ${currentPhase.name}
DESCRIPTION: ${currentPhase.description}
EXPECTED OUTPUTS: ${currentPhase.expected_outputs.join(', ')}
AVAILABLE CAPABILITIES: ${currentPhase.required_capabilities.join(', ')}

YOUR TASK:
Analyze the conversation history and decide what action to take next to advance this phase.

AVAILABLE ACTIONS:
1. "tool" - Execute a tool (shell, code, browser, search, file operation, etc.)
2. "message" - Send a message to the user
3. "phase_complete" - Mark current phase as complete and move to next phase
4. "task_complete" - Mark entire task as complete (all phases done)
5. "request_input" - Ask user for input/clarification

DECISION RULES:
- Focus on completing the current phase's expected outputs
- Use tools to gather information, execute code, or interact with systems
- Send messages to keep user informed of progress
- Only mark phase_complete when all expected outputs are achieved
- Only mark task_complete when ALL phases are done
- Request input if you need clarification or encounter ambiguity

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "type": "tool" | "message" | "phase_complete" | "task_complete" | "request_input",
  "tool_name": "name_of_tool",  // Only for type="tool"
  "tool_input": { /* tool parameters */ },  // Only for type="tool"
  "message": "message to user",  // For type="message" or "request_input"
  "reasoning": "why you chose this action"
}

IMPORTANT:
- Be concise but thorough in your reasoning
- Don't repeat actions that have already failed
- Learn from previous tool outputs
- Stay focused on the current phase goal`;
  }

  // Load conversation history from database
  private async loadConversationHistory(): Promise<void> {
    // Load messages
    const { data: messages } = await this.context.supabase
      .from('agent_messages')
      .select('role, content, created_at')
      .eq('run_id', this.context.runId)
      .order('created_at', { ascending: true });

    // Load steps for tool results
    const { data: steps } = await this.context.supabase
      .from('agent_steps')
      .select('id, tool_name, tool_output, created_at')
      .eq('run_id', this.context.runId)
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    // Merge and sort by timestamp
    const history: LLMMessage[] = [];

    messages?.forEach(msg => {
      history.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      });
    });

    steps?.forEach(step => {
      history.push({
        role: 'tool',
        content: JSON.stringify(step.tool_output),
        tool_call_id: step.id,
        tool_name: step.tool_name,
      });
    });

    this.context.conversationHistory = history;
  }

  // Trim context if it exceeds token limit
  private async trimContextIfNeeded(): Promise<void> {
    // Simple heuristic: 1 token ≈ 4 characters
    const estimatedTokens = this.context.conversationHistory.reduce(
      (sum, msg) => sum + Math.ceil(msg.content.length / 4),
      0
    );

    if (estimatedTokens > this.maxContextTokens) {
      // Keep last 50% of messages
      const keepCount = Math.floor(this.context.conversationHistory.length / 2);
      this.context.conversationHistory = this.context.conversationHistory.slice(-keepCount);

      await this.logInfo('Context trimmed due to size');
    }
  }

  // Credit management
  private async checkCredits(): Promise<boolean> {
    const { data } = await this.context.supabase
      .from('credit_balances')
      .select('available_credits')
      .eq('user_id', this.context.userId)
      .single();

    return (data?.available_credits || 0) > 0;
  }

  private async deductCredits(amount: number): Promise<void> {
    await this.context.supabase.rpc('consume_credits', {
      p_user_id: this.context.userId,
      p_amount: amount,
      p_run_id: this.context.runId,
    });

    // Update run total
    const { data: run } = await this.context.supabase
      .from('agent_runs')
      .select('total_credits_used')
      .eq('id', this.context.runId)
      .single();

    const currentTotal = run?.total_credits_used || 0;

    await this.context.supabase
      .from('agent_runs')
      .update({ total_credits_used: currentTotal + amount })
      .eq('id', this.context.runId);
  }

  // Artifact and memory management
  private async saveArtifacts(artifacts: Array<{
    id: string;
    filename: string;
    file_type: string;
    url: string;
  }>): Promise<void> {
    for (const artifact of artifacts) {
      await this.context.supabase
        .from('agent_artifacts')
        .insert({
          run_id: this.context.runId,
          artifact_type: artifact.file_type,
          filename: artifact.filename,
          storage_path: artifact.url,
          mime_type: artifact.file_type,
        });
    }
  }

  private async saveMemory(memory: Array<{
    type: 'fact' | 'preference' | 'context';
    content: string;
    importance: number;
  }>): Promise<void> {
    for (const item of memory) {
      await this.context.supabase
        .from('agent_memory')
        .insert({
          run_id: this.context.runId,
          user_id: this.context.userId,
          memory_type: item.type,
          content: item.content,
          importance_score: item.importance,
        });
    }
  }

  // Logging helpers
  private async logInfo(message: string): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'info',
      message,
    });
  }

  private async logSuccess(message: string): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'success',
      message,
    });
  }

  private async logError(message: string): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'error',
      message,
    });
  }

  private async logToolSuccess(toolName: string, creditsUsed: number): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'tool_success',
      message: `${toolName} executed successfully`,
      metadata: { tool_name: toolName, credits_used: creditsUsed },
    });
  }

  private async logToolError(toolName: string, error: string): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'tool_error',
      message: `${toolName} failed: ${error}`,
      metadata: { tool_name: toolName, error },
    });
  }

  private async logPhaseAdvance(fromPhase: number, toPhase: number): Promise<void> {
    await this.context.supabase.from('agent_task_logs').insert({
      run_id: this.context.runId,
      log_type: 'phase_advance',
      message: `Advanced from phase ${fromPhase} to phase ${toPhase}`,
      metadata: { from_phase: fromPhase, to_phase: toPhase },
    });
  }
}
