/**
 * AgentExecutor - Manus-style agentic execution loop
 * 
 * This executor implements a complete agent that:
 * 1. Creates a plan (todo.md style) using LLM
 * 2. Selects appropriate tools for each step
 * 3. Executes tools step-by-step
 * 4. Streams progress to terminal
 * 5. Handles errors and retries
 * 6. Delivers final results
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  executeTool, 
  getToolInfo, 
  listTools,
  validateSafety,
  type ToolResult,
  type AgentContext,
} from './tools';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanStep {
  number: number;
  title: string;
  description: string;
  tools: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: string;
}

export interface ExecutionPlan {
  title: string;
  objective: string;
  steps: PlanStep[];
  totalSteps: number;
  estimatedDuration: string;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  reasoning: string;
}

export interface ExecutorConfig {
  maxRetries: number;
  retryDelayMs: number;
  confirmDangerous: boolean;
  streamLogs: boolean;
  autoAdvance: boolean;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  confirmDangerous: true,
  streamLogs: true,
  autoAdvance: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// AGENT EXECUTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AgentExecutor {
  private taskId: string;
  private userId: string;
  private sessionId?: string;
  private config: ExecutorConfig;
  private plan: ExecutionPlan | null = null;
  private currentStep: number = 0;
  private sequenceNumber: number = 0;
  private aborted: boolean = false;

  constructor(
    taskId: string,
    userId: string,
    config: Partial<ExecutorConfig> = {}
  ) {
    this.taskId = taskId;
    this.userId = userId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN EXECUTION LOOP
  // ═══════════════════════════════════════════════════════════════════════

  async execute(prompt: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
      // 1. Create execution plan
      await this.streamLog('info', '🧠 Creating execution plan...');
      this.plan = await this.createPlan(prompt);
      
      if (!this.plan || this.plan.steps.length === 0) {
        throw new Error('Failed to create execution plan');
      }

      await this.streamLog('plan', this.formatPlanMarkdown());
      await this.savePlanToDatabase();

      // 2. Execute each step
      for (let i = 0; i < this.plan.steps.length; i++) {
        if (this.aborted) {
          await this.streamLog('warning', '⚠️ Execution aborted by user');
          break;
        }

        this.currentStep = i + 1;
        const step = this.plan.steps[i];
        
        await this.streamLog('progress', `\n📍 Step ${step.number}/${this.plan.totalSteps}: ${step.title}`);
        await this.streamLog('info', `   ${step.description}`);
        
        // Update step status
        await this.updateStepStatus(step.number, 'running');

        try {
          // 3. Select tool for this step
          const toolCall = await this.selectTool(step, prompt);
          
          if (!toolCall) {
            await this.streamLog('warning', `   ⏭️ No tool selected, skipping step`);
            await this.updateStepStatus(step.number, 'skipped');
            continue;
          }

          await this.streamLog('action', `   🔧 Using ${toolCall.tool}...`);
          
          // 4. Validate safety
          const tool = getToolInfo(toolCall.tool);
          if (!tool) {
            await this.streamLog('error', `   ❌ Unknown tool: ${toolCall.tool}`);
            await this.updateStepStatus(step.number, 'failed');
            continue;
          }

          const validation = validateSafety(tool, toolCall.params);
          if (!validation.allowed) {
            await this.streamLog('error', `   🚫 ${validation.reason}`);
            await this.updateStepStatus(step.number, 'failed');
            continue;
          }

          if (validation.requiresConfirmation && this.config.confirmDangerous) {
            await this.streamLog('warning', `   ⚠️ ${validation.reason}`);
            // In production, this would wait for user confirmation
            await this.streamLog('info', `   ✅ Auto-confirmed (development mode)`);
          }

          // 5. Execute tool with retries
          const result = await this.executeWithRetries(toolCall, tool);
          
          if (result.success) {
            const output = this.formatOutput(result.output);
            await this.streamLog('output', output);
            step.output = output;
            step.status = 'completed';
            await this.updateStepStatus(step.number, 'completed', output);
          } else {
            await this.streamLog('error', `   ❌ ${result.error}`);
            step.status = 'failed';
            await this.updateStepStatus(step.number, 'failed', result.error);
          }

          // Record tool execution
          await this.recordToolExecution(toolCall, result);

        } catch (stepError) {
          const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown error';
          await this.streamLog('error', `   ❌ Step failed: ${errorMsg}`);
          await this.updateStepStatus(step.number, 'failed', errorMsg);
        }

        // Update overall progress
        await this.updateTaskProgress();
      }

      // 6. Deliver results
      const success = this.plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
      
      if (success) {
        await this.streamLog('success', '\n✅ Task completed successfully!');
        await this.completeTask('completed');
      } else {
        const failedSteps = this.plan.steps.filter(s => s.status === 'failed');
        await this.streamLog('warning', `\n⚠️ Task completed with ${failedSteps.length} failed step(s)`);
        await this.completeTask('completed'); // Still mark as completed but with failures noted
      }

      return { success, result: this.plan };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.streamLog('error', `\n❌ Execution failed: ${errorMsg}`);
      await this.completeTask('failed', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLAN CREATION (LLM-powered)
  // ═══════════════════════════════════════════════════════════════════════

  private async createPlan(prompt: string): Promise<ExecutionPlan> {
    const availableTools = listTools().map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      safety: t.safety,
    }));

    const systemPrompt = `You are an AI planning agent. Create a structured execution plan for the given task.
You have access to these tools:
${JSON.stringify(availableTools, null, 2)}

Create a plan with 2-6 concrete steps. Each step should use one or more of the available tools.
Focus on actionable steps that can be executed by the tools.

Respond with a JSON object following this exact schema:
{
  "title": "Short task title",
  "objective": "What the task aims to achieve",
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "description": "What this step does",
      "tools": ["tool.name", "optional.second.tool"]
    }
  ],
  "estimatedDuration": "5-10 minutes"
}`;

    try {
      const response = await supabase.functions.invoke('agent-plan', {
        body: {
          prompt,
          systemPrompt,
          task_id: this.taskId,
        },
      });

      if (response.error) {
        console.error('[AgentExecutor] Plan creation error:', response.error);
        // Fallback to a simple default plan
        return this.createDefaultPlan(prompt);
      }

      const plan = response.data?.plan || response.data;
      
      // Validate and transform the plan
      return {
        title: plan.title || 'Task Execution',
        objective: plan.objective || prompt,
        steps: (plan.steps || []).map((s: any, i: number) => ({
          number: i + 1,
          title: s.title || `Step ${i + 1}`,
          description: s.description || '',
          tools: s.tools || [],
          status: 'pending' as const,
        })),
        totalSteps: plan.steps?.length || 0,
        estimatedDuration: plan.estimatedDuration || '5-10 minutes',
      };
    } catch (error) {
      console.error('[AgentExecutor] Plan creation failed:', error);
      return this.createDefaultPlan(prompt);
    }
  }

  private createDefaultPlan(prompt: string): ExecutionPlan {
    // Default plan when LLM fails
    const isCodeTask = prompt.includes('```') || 
                       prompt.toLowerCase().includes('code') ||
                       prompt.toLowerCase().includes('script');

    if (isCodeTask) {
      return {
        title: 'Code Execution',
        objective: prompt.substring(0, 100),
        steps: [
          { number: 1, title: 'Parse code', description: 'Extract and validate code', tools: ['file.read'], status: 'pending' },
          { number: 2, title: 'Execute code', description: 'Run in sandbox', tools: ['shell.exec'], status: 'pending' },
          { number: 3, title: 'Collect output', description: 'Gather results', tools: ['shell.view'], status: 'pending' },
        ],
        totalSteps: 3,
        estimatedDuration: '1-2 minutes',
      };
    }

    return {
      title: 'General Task',
      objective: prompt.substring(0, 100),
      steps: [
        { number: 1, title: 'Analyze request', description: 'Understand requirements', tools: ['search.web'], status: 'pending' },
        { number: 2, title: 'Execute task', description: 'Perform main action', tools: ['message.info'], status: 'pending' },
        { number: 3, title: 'Deliver results', description: 'Format and present output', tools: ['message.info'], status: 'pending' },
      ],
      totalSteps: 3,
      estimatedDuration: '2-5 minutes',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TOOL SELECTION (LLM-powered)
  // ═══════════════════════════════════════════════════════════════════════

  private async selectTool(step: PlanStep, originalPrompt: string): Promise<ToolCall | null> {
    // If step already has specific tools, use the first one
    if (step.tools.length > 0) {
      const toolName = step.tools[0];
      const tool = getToolInfo(toolName);
      
      if (tool) {
        // Generate parameters based on step context
        const params = await this.generateToolParams(toolName, step, originalPrompt);
        return {
          tool: toolName,
          params,
          reasoning: `Using ${toolName} for: ${step.description}`,
        };
      }
    }

    // Otherwise, ask LLM to select tool
    const availableTools = listTools().map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));

    try {
      const response = await supabase.functions.invoke('agent-plan', {
        body: {
          prompt: `Select the best tool for this step:
Step: ${step.title}
Description: ${step.description}
Original task: ${originalPrompt.substring(0, 200)}

Available tools: ${JSON.stringify(availableTools)}

Respond with JSON:
{
  "tool": "tool.name",
  "params": { ... parameters for the tool ... },
  "reasoning": "Why this tool was selected"
}`,
          task_id: this.taskId,
        },
      });

      if (response.error || !response.data) {
        return null;
      }

      return response.data as ToolCall;
    } catch (error) {
      console.error('[AgentExecutor] Tool selection failed:', error);
      return null;
    }
  }

  private async generateToolParams(
    toolName: string, 
    step: PlanStep, 
    originalPrompt: string
  ): Promise<Record<string, unknown>> {
    // Generate sensible default parameters based on tool type
    switch (toolName) {
      case 'shell.exec':
        // Extract command from prompt if present
        const codeMatch = originalPrompt.match(/```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/);
        return {
          command: codeMatch ? codeMatch[1].trim() : 'echo "Hello from agent"',
          workingDir: '/home/sandbox',
          timeout: 30000,
        };
      
      case 'file.read':
        return {
          path: './README.md',
          encoding: 'utf8',
        };
      
      case 'file.write':
        return {
          path: './output.txt',
          content: step.description,
          createDirs: true,
        };
      
      case 'browser.navigate':
        const urlMatch = originalPrompt.match(/https?:\/\/[^\s]+/);
        return {
          url: urlMatch ? urlMatch[0] : 'https://example.com',
          waitFor: 'load',
        };
      
      case 'search.web':
        return {
          query: step.description,
          maxResults: 5,
        };
      
      case 'search.code':
        return {
          query: step.description,
          maxResults: 10,
        };
      
      case 'message.info':
        return {
          content: step.description,
          level: 'info',
        };
      
      default:
        return {};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTION WITH RETRIES
  // ═══════════════════════════════════════════════════════════════════════

  private async executeWithRetries(
    toolCall: ToolCall, 
    tool: ReturnType<typeof getToolInfo>
  ): Promise<ToolResult> {
    if (!tool) {
      return { success: false, error: 'Tool not found' };
    }

    const context: AgentContext = {
      taskId: this.taskId,
      userId: this.userId,
      sessionId: this.sessionId,
      workspacePath: '/home/sandbox',
      permissions: ['shell', 'file', 'browser', 'search', 'webdev', 'plan', 'message'],
    };

    let lastError: string = '';
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await executeTool(toolCall.tool, toolCall.params, context);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error || 'Unknown error';
        
        if (attempt < this.config.maxRetries) {
          await this.streamLog('warning', `   ⚠️ Attempt ${attempt} failed, retrying...`);
          await this.delay(this.config.retryDelayMs * attempt);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Execution error';
        
        if (attempt < this.config.maxRetries) {
          await this.streamLog('warning', `   ⚠️ Attempt ${attempt} failed: ${lastError}`);
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    return { success: false, error: `Failed after ${this.config.maxRetries} attempts: ${lastError}` };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOGGING & STATUS UPDATES
  // ═══════════════════════════════════════════════════════════════════════

  private async streamLog(
    type: 'info' | 'plan' | 'progress' | 'action' | 'output' | 'success' | 'error' | 'warning',
    content: string
  ): Promise<void> {
    if (!this.config.streamLogs) return;

    this.sequenceNumber++;

    try {
      await supabase.from('agent_task_logs').insert({
        task_id: this.taskId,
        log_type: type,
        content,
        sequence_number: this.sequenceNumber,
        timestamp: new Date().toISOString(),
        metadata: { 
          region: 'ch-gva-2',
          step: this.currentStep,
        },
      });
    } catch (error) {
      console.error('[AgentExecutor] Failed to stream log:', error);
    }
  }

  private async updateStepStatus(
    stepNumber: number, 
    status: string, 
    output?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'running') {
      updates.started_at = new Date().toISOString();
    }
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    if (output) {
      updates.output_data = { output };
    }

    await supabase
      .from('agent_task_steps')
      .update(updates)
      .eq('task_id', this.taskId)
      .eq('step_number', stepNumber);
  }

  private async updateTaskProgress(): Promise<void> {
    if (!this.plan) return;

    const completedSteps = this.plan.steps.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length;
    
    const progress = Math.round((completedSteps / this.plan.totalSteps) * 100);

    await supabase
      .from('agent_tasks')
      .update({
        progress,
        current_step: this.currentStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.taskId);
  }

  private async completeTask(status: 'completed' | 'failed', errorMessage?: string): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      progress: 100,
      completed_at: new Date().toISOString(),
    };

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    if (this.plan) {
      updates.result = {
        plan: this.plan,
        steps: this.plan.steps.map(s => ({
          number: s.number,
          title: s.title,
          status: s.status,
          output: s.output,
        })),
      };
    }

    await supabase
      .from('agent_tasks')
      .update(updates)
      .eq('id', this.taskId);
  }

  private async savePlanToDatabase(): Promise<void> {
    if (!this.plan) return;

    await supabase.from('agent_plans').upsert({
      task_id: this.taskId,
      user_id: this.userId,
      plan_title: this.plan.title,
      plan_markdown: this.formatPlanMarkdown(),
      total_phases: 1,
      total_tasks: this.plan.totalSteps,
      completed_tasks: 0,
      current_phase: 1,
      status: 'active',
      metadata: {
        objective: this.plan.objective,
        estimatedDuration: this.plan.estimatedDuration,
      },
    });
  }

  private async recordToolExecution(toolCall: ToolCall, result: ToolResult): Promise<void> {
    await supabase.from('agent_tool_executions').insert([{
      task_id: this.taskId,
      tool_name: toolCall.tool,
      tool_category: toolCall.tool.split('.')[0],
      input_params: JSON.parse(JSON.stringify(toolCall.params)),
      output_result: JSON.parse(JSON.stringify(result.output || null)),
      status: result.success ? 'success' : 'failed',
      execution_time_ms: result.durationMs || 0,
      user_id: this.userId,
      error_message: result.error,
    }]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════

  private formatPlanMarkdown(): string {
    if (!this.plan) return '';

    let md = `# ${this.plan.title}\n\n`;
    md += `**Objective:** ${this.plan.objective}\n\n`;
    md += `**Estimated Duration:** ${this.plan.estimatedDuration}\n\n`;
    md += `## Steps\n\n`;

    for (const step of this.plan.steps) {
      const status = step.status === 'completed' ? '✅' :
                     step.status === 'running' ? '🔄' :
                     step.status === 'failed' ? '❌' :
                     step.status === 'skipped' ? '⏭️' : '⬜';
      
      md += `${status} **Step ${step.number}:** ${step.title}\n`;
      md += `   ${step.description}\n`;
      if (step.tools.length > 0) {
        md += `   Tools: ${step.tools.join(', ')}\n`;
      }
      md += '\n';
    }

    return md;
  }

  private formatOutput(output: unknown): string {
    if (typeof output === 'string') {
      return `   📄 ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`;
    }
    if (typeof output === 'object' && output !== null) {
      return `   📄 ${JSON.stringify(output, null, 2).substring(0, 500)}`;
    }
    return `   📄 ${String(output)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC CONTROL METHODS
  // ═══════════════════════════════════════════════════════════════════════

  abort(): void {
    this.aborted = true;
  }

  getPlan(): ExecutionPlan | null {
    return this.plan;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function createAgentExecutor(
  taskId: string,
  userId: string,
  config?: Partial<ExecutorConfig>
): AgentExecutor {
  return new AgentExecutor(taskId, userId, config);
}
