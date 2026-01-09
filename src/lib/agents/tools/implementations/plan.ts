import type { Tool, AgentContext, ToolResult } from '../types';
import { planUpdateSchema, planAdvanceSchema } from '../schemas/plan';

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
    
    console.log('[plan.update] Updating plan, mode:', validated.mode);
    
    return {
      success: true,
      output: {
        mode: validated.mode,
        section: validated.section,
        updated: true,
        contentLength: validated.content.length,
      },
    };
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
    
    console.log('[plan.advance] Completing task:', validated.taskId, 'next phase:', validated.nextPhase);
    
    return {
      success: true,
      output: {
        taskId: validated.taskId,
        completed: true,
        nextPhase: validated.nextPhase,
        notes: validated.notes,
      },
    };
  },
};
