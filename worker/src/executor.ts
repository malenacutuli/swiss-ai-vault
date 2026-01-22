/**
 * Agent Executor
 *
 * Wraps the agent execution logic for use in the worker service.
 * This is a Node.js compatible version of the Edge Function supervisor.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from 'anthropic';
import { v4 as uuidv4 } from 'uuid';

// LLM Message type
interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Execution plan types
interface PlanPhase {
  phase_number: number;
  name: string;
  description: string;
  required_capabilities: string[];
  estimated_credits: number;
  expected_outputs: string[];
}

interface ExecutionPlan {
  goal: string;
  phases: PlanPhase[];
  total_estimated_credits: number;
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
interface ExecutionResult {
  status: 'completed' | 'failed' | 'paused' | 'waiting_user';
  error?: string;
  final_message?: string;
}

// Executor options
interface ExecutorOptions {
  onProgress?: (progress: number) => Promise<void>;
  onLog?: (message: string) => Promise<void>;
}

export class AgentExecutor {
  private supabase: SupabaseClient;
  private taskId: string;
  private anthropic: Anthropic;
  private maxIterations = 100; // Higher limit for worker (no timeout constraints)

  constructor(supabase: SupabaseClient, taskId: string) {
    this.supabase = supabase;
    this.taskId = taskId;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async execute(options: ExecutorOptions = {}): Promise<ExecutionResult> {
    const { onProgress, onLog } = options;

    try {
      // Load task from database
      const { data: task, error: taskError } = await this.supabase
        .from('agent_runs')
        .select('*')
        .eq('id', this.taskId)
        .single();

      if (taskError || !task) {
        throw new Error(`Task not found: ${this.taskId}`);
      }

      await onLog?.(`Starting execution for task: ${task.prompt?.slice(0, 50)}...`);

      // Check if task needs planning
      let plan = task.plan as ExecutionPlan | null;

      if (!plan) {
        await onLog?.('Generating execution plan...');
        await this.updateStatus('planning');

        plan = await this.generatePlan(task.prompt);
        if (!plan) {
          throw new Error('Failed to generate execution plan');
        }

        await this.supabase
          .from('agent_runs')
          .update({ plan })
          .eq('id', this.taskId);

        await this.logToDb('plan_created', `Plan created with ${plan.phases.length} phases`);
      }

      // Update to executing status
      await this.updateStatus('executing');

      // Load conversation history
      const conversationHistory = await this.loadConversationHistory();

      // Main execution loop
      let currentPhaseNumber = task.current_phase || 1;
      let iterations = 0;

      while (iterations < this.maxIterations) {
        iterations++;

        // Check if task was cancelled/paused
        const { data: currentTask } = await this.supabase
          .from('agent_runs')
          .select('status')
          .eq('id', this.taskId)
          .single();

        if (currentTask?.status === 'cancelled') {
          await onLog?.('Task cancelled');
          return { status: 'paused' };
        }

        if (currentTask?.status === 'paused') {
          await onLog?.('Task paused');
          return { status: 'paused' };
        }

        // Get current phase
        const currentPhase = plan.phases.find(p => p.phase_number === currentPhaseNumber);
        if (!currentPhase) {
          // All phases complete
          await onLog?.('All phases completed');
          await this.updateStatus('completed');
          return { status: 'completed', final_message: 'All phases completed successfully' };
        }

        // Update progress
        const progress = Math.floor((currentPhaseNumber - 1) / plan.phases.length * 100);
        await onProgress?.(progress);

        // Decide next action
        await onLog?.(`Phase ${currentPhaseNumber}: ${currentPhase.name} - deciding action...`);

        const action = await this.decideNextAction(plan, currentPhase, conversationHistory);

        if (!action) {
          throw new Error('Failed to determine next action');
        }

        await onLog?.(`Action: ${action.type} - ${action.reasoning?.slice(0, 100)}`);

        // Execute action
        const result = await this.executeAction(action, currentPhase, conversationHistory);

        if (!result.success) {
          await onLog?.(`Action failed: ${result.error}`);
          throw new Error(result.error || 'Action execution failed');
        }

        // Handle action type
        if (action.type === 'task_complete') {
          await onLog?.('Task completed successfully');
          await this.updateStatus('completed');
          return { status: 'completed', final_message: action.message };
        }

        if (action.type === 'request_input') {
          await onLog?.(`Waiting for user input: ${action.message}`);
          await this.updateStatus('waiting_user');
          return { status: 'waiting_user', final_message: action.message };
        }

        if (action.type === 'phase_complete') {
          await onLog?.(`Phase ${currentPhaseNumber} complete, advancing to phase ${currentPhaseNumber + 1}`);
          currentPhaseNumber++;

          await this.supabase
            .from('agent_runs')
            .update({ current_phase: currentPhaseNumber })
            .eq('id', this.taskId);

          // Check if all phases done
          if (currentPhaseNumber > plan.phases.length) {
            await onLog?.('All phases completed');
            await this.updateStatus('completed');
            return { status: 'completed', final_message: 'All phases completed' };
          }
        }

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Max iterations reached
      await this.updateStatus('timeout');
      return { status: 'failed', error: 'Maximum iterations reached' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await onLog?.(`Execution error: ${errorMessage}`);

      await this.supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', this.taskId);

      return { status: 'failed', error: errorMessage };
    }
  }

  private async updateStatus(status: string): Promise<void> {
    const updates: Record<string, any> = { status, state: status };

    if (status === 'completed' || status === 'failed' || status === 'timeout') {
      updates.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from('agent_runs')
      .update(updates)
      .eq('id', this.taskId);
  }

  private async logToDb(logType: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.supabase.from('agent_task_logs').insert({
      run_id: this.taskId,
      log_type: logType,
      message,
      content: message,
      metadata,
    });
  }

  private async loadConversationHistory(): Promise<LLMMessage[]> {
    const { data: messages } = await this.supabase
      .from('agent_messages')
      .select('role, content')
      .eq('run_id', this.taskId)
      .order('created_at', { ascending: true });

    return (messages || []).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
  }

  private async generatePlan(prompt: string): Promise<ExecutionPlan | null> {
    try {
      const systemPrompt = `You are an expert AI task planner. Break down the user's request into a structured execution plan.

OUTPUT FORMAT:
Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "goal": "Clear statement of what we're trying to accomplish",
  "phases": [
    {
      "phase_number": 1,
      "name": "Phase name",
      "description": "Detailed description",
      "required_capabilities": ["shell", "code"],
      "estimated_credits": 10,
      "expected_outputs": ["List of outputs"]
    }
  ],
  "total_estimated_credits": 50
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\nCreate a plan for: ${prompt}` },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      // Try to parse JSON from response
      const text = content.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]) as ExecutionPlan;
    } catch (error) {
      console.error('[Executor] Plan generation error:', error);
      return null;
    }
  }

  private async decideNextAction(
    plan: ExecutionPlan,
    currentPhase: PlanPhase,
    conversationHistory: LLMMessage[]
  ): Promise<AgentAction | null> {
    try {
      const systemPrompt = `You are an AI agent executor. You are executing a multi-phase plan.

OVERALL GOAL: ${plan.goal}

CURRENT PHASE: Phase ${currentPhase.phase_number} - ${currentPhase.name}
DESCRIPTION: ${currentPhase.description}
EXPECTED OUTPUTS: ${currentPhase.expected_outputs.join(', ')}

AVAILABLE ACTIONS:
1. "tool" - Execute a tool (shell, code, browser, search, file operation)
2. "message" - Send a message to the user
3. "phase_complete" - Mark current phase complete
4. "task_complete" - Mark entire task complete (all phases done)
5. "request_input" - Ask user for input

OUTPUT FORMAT:
Return ONLY a JSON object (no markdown, no explanation):
{
  "type": "tool" | "message" | "phase_complete" | "task_complete" | "request_input",
  "tool_name": "name_of_tool",
  "tool_input": {},
  "message": "message to user",
  "reasoning": "why you chose this action"
}`;

      const messages = [
        ...conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Begin execution.' }],
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      const text = content.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]) as AgentAction;
    } catch (error) {
      console.error('[Executor] Decision error:', error);
      return null;
    }
  }

  private async executeAction(
    action: AgentAction,
    _currentPhase: PlanPhase,
    conversationHistory: LLMMessage[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (action.type === 'tool') {
        // Create step record
        const stepId = uuidv4();
        await this.supabase.from('agent_steps').insert({
          id: stepId,
          run_id: this.taskId,
          tool_name: action.tool_name,
          tool_input: action.tool_input,
          status: 'running',
          started_at: new Date().toISOString(),
        });

        // TODO: Implement actual tool execution
        // For now, simulate tool execution
        await new Promise(resolve => setTimeout(resolve, 1000));

        const toolOutput = {
          success: true,
          output: `Executed ${action.tool_name} with input: ${JSON.stringify(action.tool_input)}`,
        };

        // Update step
        await this.supabase
          .from('agent_steps')
          .update({
            status: 'completed',
            tool_output: toolOutput,
            completed_at: new Date().toISOString(),
          })
          .eq('id', stepId);

        // Add to conversation
        conversationHistory.push({
          role: 'assistant',
          content: `Tool ${action.tool_name} executed: ${JSON.stringify(toolOutput)}`,
        });

        await this.logToDb('tool_success', `${action.tool_name} executed successfully`);

        return { success: true };
      }

      if (action.type === 'message') {
        // Send message to user
        await this.supabase.from('agent_messages').insert({
          run_id: this.taskId,
          role: 'assistant',
          content: action.message,
        });

        conversationHistory.push({
          role: 'assistant',
          content: action.message || '',
        });

        return { success: true };
      }

      // Other action types (phase_complete, task_complete, request_input) are handled in main loop
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
      };
    }
  }
}
