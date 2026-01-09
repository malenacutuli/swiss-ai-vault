import { z } from 'zod';

// plan.update - Update todo.md plan
export const planUpdateSchema = z.object({
  content: z.string().max(50000).describe('New content for todo.md'),
  mode: z.enum(['replace', 'append', 'prepend']).optional().default('replace').describe('How to update the plan'),
  section: z.string().max(100).optional().describe('Specific section to update (for append/prepend)'),
});

export type PlanUpdateParams = z.infer<typeof planUpdateSchema>;

// plan.advance - Mark task complete, advance phase
export const planAdvanceSchema = z.object({
  taskId: z.string().max(100).describe('ID or description of the task to mark complete'),
  notes: z.string().max(1000).optional().describe('Completion notes or summary'),
  nextPhase: z.string().max(100).optional().describe('Name of the next phase to advance to'),
  updateStatus: z.boolean().optional().default(true).describe('Update the task status in database'),
});

export type PlanAdvanceParams = z.infer<typeof planAdvanceSchema>;
