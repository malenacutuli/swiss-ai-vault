// src/lib/agents/PlanManager.ts
// Plan management for Swiss Agents

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface PlanStep {
  id: string;
  title: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
}

export interface TaskPlan {
  objective: string;
  steps: PlanStep[];
}

export class PlanManager {
  async savePlan(taskId: string, userId: string, plan: TaskPlan): Promise<string> {
    const planMarkdown = this.planToMarkdown(plan);
    
    // Convert steps to JSON-compatible format
    const stepsAsJson: Json = plan.steps.map(step => ({
      id: step.id,
      title: step.title,
      tool: step.tool,
      status: step.status,
      output: step.output ?? null,
      error: step.error ?? null
    }));
    
    const { data, error } = await supabase
      .from('agent_plans')
      .insert({
        task_id: taskId,
        user_id: userId,
        plan_title: plan.objective,
        plan_markdown: planMarkdown,
        total_phases: 1,
        total_tasks: plan.steps.length,
        completed_tasks: 0,
        current_phase: 0,
        status: 'active',
        metadata: { steps: stepsAsJson }
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save plan:', error);
      throw new Error(`Failed to save plan: ${error.message}`);
    }

    return data.id;
  }

  async loadPlan(taskId: string): Promise<TaskPlan | null> {
    const { data, error } = await supabase
      .from('agent_plans')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.parsePlan(data);
  }

  async updateStep(
    taskId: string, 
    stepIndex: number, 
    status: PlanStep['status'],
    output?: string
  ): Promise<void> {
    const plan = await this.loadPlan(taskId);
    if (!plan || !plan.steps[stepIndex]) return;

    plan.steps[stepIndex].status = status;
    if (output) {
      plan.steps[stepIndex].output = output;
    }

    const completedCount = plan.steps.filter(s => s.status === 'completed').length;
    
    // Convert steps to JSON-compatible format
    const stepsAsJson: Json = plan.steps.map(step => ({
      id: step.id,
      title: step.title,
      tool: step.tool,
      status: step.status,
      output: step.output ?? null,
      error: step.error ?? null
    }));

    await supabase
      .from('agent_plans')
      .update({
        plan_markdown: this.planToMarkdown(plan),
        completed_tasks: completedCount,
        metadata: { steps: stepsAsJson },
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId);
  }

  async completePlan(taskId: string): Promise<void> {
    await supabase
      .from('agent_plans')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId);
  }

  async failPlan(taskId: string, error: string): Promise<void> {
    await supabase
      .from('agent_plans')
      .update({
        status: 'failed',
        metadata: { error } as Json,
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId);
  }

  private planToMarkdown(plan: TaskPlan): string {
    let markdown = `# ${plan.objective}\n\n`;
    
    plan.steps.forEach((step, index) => {
      const statusIcon = this.getStatusIcon(step.status);
      markdown += `${index + 1}. ${statusIcon} ${step.title}\n`;
      if (step.output) {
        markdown += `   - Output: ${step.output}\n`;
      }
      if (step.error) {
        markdown += `   - Error: ${step.error}\n`;
      }
    });

    return markdown;
  }

  private getStatusIcon(status: PlanStep['status']): string {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⬜';
    }
  }

  private parsePlan(data: {
    plan_title: string | null;
    plan_markdown: string;
    metadata: Json | null;
  }): TaskPlan {
    const metadata = data.metadata as { steps?: Array<{ id: string; title: string; tool: string; status: string; output?: string; error?: string }> } | null;
    
    if (metadata?.steps) {
      return {
        objective: data.plan_title || 'Untitled Plan',
        steps: metadata.steps.map(s => ({
          id: s.id,
          title: s.title,
          tool: s.tool,
          status: s.status as PlanStep['status'],
          output: s.output,
          error: s.error
        }))
      };
    }

    // Parse from markdown if no metadata
    return this.parseMarkdown(data.plan_markdown);
  }

  private parseMarkdown(markdown: string): TaskPlan {
    const lines = markdown.split('\n');
    const objective = lines[0]?.replace(/^#\s*/, '') || 'Untitled Plan';
    
    const steps: PlanStep[] = [];
    let stepIndex = 0;

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*([✅🔄❌⏭️⬜])\s*(.+)$/);
      if (match) {
        const statusIcon = match[1];
        const title = match[2];
        
        steps.push({
          id: `step-${stepIndex++}`,
          title,
          tool: 'unknown',
          status: this.iconToStatus(statusIcon)
        });
      }
    }

    return { objective, steps };
  }

  private iconToStatus(icon: string): PlanStep['status'] {
    switch (icon) {
      case '✅': return 'completed';
      case '🔄': return 'running';
      case '❌': return 'failed';
      case '⏭️': return 'skipped';
      default: return 'pending';
    }
  }
}
