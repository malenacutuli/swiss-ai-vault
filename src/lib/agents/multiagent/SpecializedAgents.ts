/**
 * ResearcherAgent - Specialized worker for web research and information gathering
 */

import { WorkerAgent, WorkerContext, WorkerResult, WorkerConfig } from './WorkerAgent';
import { supabase } from '@/integrations/supabase/client';

export class ResearcherAgent extends WorkerAgent {
  constructor(config: Omit<WorkerConfig, 'role'>) {
    super({ ...config, role: 'researcher' });
  }

  protected async executeTask(context: WorkerContext): Promise<WorkerResult> {
    await this.reportProgress(10, 'Analyzing research requirements...');

    try {
      // Call AI to perform research
      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'research',
          taskId: context.taskId,
          prompt: context.description,
          context: context.dependencies,
          agentRole: 'researcher',
          systemPrompt: this.getSystemPrompt(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await this.reportProgress(90, 'Compiling research results...');

      return {
        success: true,
        data: response.data?.result,
        artifacts: response.data?.sources?.map((s: any) => ({
          type: 'source',
          name: s.title || s.url,
          content: s,
        })),
        metrics: {
          tokensUsed: response.data?.tokensUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Research failed',
      };
    }
  }
}

/**
 * CoderAgent - Specialized worker for code generation and modification
 */
export class CoderAgent extends WorkerAgent {
  constructor(config: Omit<WorkerConfig, 'role'>) {
    super({ ...config, role: 'coder' });
  }

  protected async executeTask(context: WorkerContext): Promise<WorkerResult> {
    await this.reportProgress(10, 'Analyzing coding requirements...');

    try {
      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'code',
          taskId: context.taskId,
          prompt: context.description,
          context: context.dependencies,
          agentRole: 'coder',
          systemPrompt: this.getSystemPrompt(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await this.reportProgress(90, 'Finalizing code...');

      return {
        success: true,
        data: response.data?.result,
        artifacts: response.data?.files?.map((f: any) => ({
          type: 'code',
          name: f.path,
          content: f.content,
        })),
        metrics: {
          tokensUsed: response.data?.tokensUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Coding failed',
      };
    }
  }
}

/**
 * AnalystAgent - Specialized worker for data analysis
 */
export class AnalystAgent extends WorkerAgent {
  constructor(config: Omit<WorkerConfig, 'role'>) {
    super({ ...config, role: 'analyst' });
  }

  protected async executeTask(context: WorkerContext): Promise<WorkerResult> {
    await this.reportProgress(10, 'Preparing data analysis...');

    try {
      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'analyze',
          taskId: context.taskId,
          prompt: context.description,
          context: context.dependencies,
          agentRole: 'analyst',
          systemPrompt: this.getSystemPrompt(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await this.reportProgress(90, 'Generating insights...');

      return {
        success: true,
        data: response.data?.result,
        artifacts: response.data?.charts?.map((c: any) => ({
          type: 'chart',
          name: c.title,
          content: c,
        })),
        metrics: {
          tokensUsed: response.data?.tokensUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }
}

/**
 * ReviewerAgent - Specialized worker for quality assurance
 */
export class ReviewerAgent extends WorkerAgent {
  constructor(config: Omit<WorkerConfig, 'role'>) {
    super({ ...config, role: 'reviewer' });
  }

  protected async executeTask(context: WorkerContext): Promise<WorkerResult> {
    await this.reportProgress(10, 'Starting quality review...');

    try {
      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          action: 'review',
          taskId: context.taskId,
          prompt: context.description,
          context: context.dependencies,
          agentRole: 'reviewer',
          systemPrompt: this.getSystemPrompt(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await this.reportProgress(90, 'Compiling review feedback...');

      return {
        success: true,
        data: response.data?.result,
        artifacts: response.data?.issues?.map((i: any) => ({
          type: 'issue',
          name: i.title,
          content: i,
        })),
        metrics: {
          tokensUsed: response.data?.tokensUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Review failed',
      };
    }
  }
}

/**
 * Factory function to create specialized agents
 */
export function createSpecializedAgent(
  role: 'researcher' | 'coder' | 'analyst' | 'reviewer',
  config: Omit<WorkerConfig, 'role'>
): WorkerAgent {
  switch (role) {
    case 'researcher':
      return new ResearcherAgent(config);
    case 'coder':
      return new CoderAgent(config);
    case 'analyst':
      return new AnalystAgent(config);
    case 'reviewer':
      return new ReviewerAgent(config);
    default:
      throw new Error(`Unknown agent role: ${role}`);
  }
}
