import type { Tool, AgentContext, ToolResult } from '../types';
import { planUpdateSchema, planAdvanceSchema } from '../schemas/plan';
import { supabase } from '@/integrations/supabase/client';

// plan.update - Update todo.md plan
export const planUpdate: Tool = {
  name: 'plan.update',
  description: 'Update the task plan (todo.md) with new content. Supports replace, append, or prepend modes.',
  category: 'plan',
  schema: planUpdateSchema,
  safety: 'safe',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = planUpdateSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[plan.update] Updating plan, mode:', validated.mode);
    
    try {
      // Fetch existing plan
      const { data: existingPlan } = await supabase
        .from('agent_plans')
        .select('*')
        .eq('task_id', context.taskId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      let newContent = validated.content;
      
      if (existingPlan) {
        const currentContent = existingPlan.plan_markdown || '';
        
        switch (validated.mode || 'replace') {
          case 'append':
            newContent = currentContent + '\n' + validated.content;
            break;
          case 'prepend':
            newContent = validated.content + '\n' + currentContent;
            break;
          case 'replace':
          default:
            newContent = validated.content;
        }
        
        // Update existing plan
        await supabase
          .from('agent_plans')
          .update({
            plan_markdown: newContent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPlan.id);
      } else {
        // Create new plan
        await supabase
          .from('agent_plans')
          .insert({
            task_id: context.taskId,
            user_id: context.userId,
            plan_markdown: newContent,
            status: 'active',
          });
      }
      
      // Also update the session's todo_md for quick access
      if (context.sessionId) {
        await supabase
          .from('agent_sessions')
          .update({ todo_md: newContent })
          .eq('id', context.sessionId);
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        success: true,
        output: {
          mode: validated.mode || 'replace',
          section: validated.section,
          updated: true,
          contentLength: newContent.length,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update plan',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// plan.advance - Mark task complete, advance phase
export const planAdvance: Tool = {
  name: 'plan.advance',
  description: 'Mark a task as complete and optionally advance to the next phase.',
  category: 'plan',
  schema: planAdvanceSchema,
  safety: 'safe',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = planAdvanceSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[plan.advance] Completing task:', validated.taskId, 'next phase:', validated.nextPhase);
    
    try {
      // Fetch current plan
      const { data: plan } = await supabase
        .from('agent_plans')
        .select('*')
        .eq('task_id', context.taskId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (plan) {
        // Parse the markdown to update task status
        let markdown = plan.plan_markdown || '';
        
        // Try to mark the task as complete in the markdown
        // Look for patterns like "- [ ] Task" and convert to "- [x] Task"
        const taskPattern = new RegExp(`- \\[ \\] .*${validated.taskId}.*`, 'i');
        markdown = markdown.replace(taskPattern, (match) => 
          match.replace('- [ ]', '- [x]')
        );
        
        // Update phase if specified
        let currentPhase = plan.current_phase || 1;
        if (validated.nextPhase) {
          currentPhase += 1;
        }
        
        // Update the plan
        await supabase
          .from('agent_plans')
          .update({
            plan_markdown: markdown,
            current_phase: currentPhase,
            completed_tasks: (plan.completed_tasks || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plan.id);
      }
      
      // Update task status if requested
      if (validated.updateStatus !== false) {
        await supabase
          .from('agent_tasks')
          .update({
            current_step: (await supabase
              .from('agent_tasks')
              .select('current_step')
              .eq('id', context.taskId)
              .single()
            ).data?.current_step || 0 + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', context.taskId);
      }
      
      const durationMs = Date.now() - startTime;
      
      return {
        success: true,
        output: {
          taskId: validated.taskId,
          completed: true,
          nextPhase: validated.nextPhase,
          notes: validated.notes,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to advance plan',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
