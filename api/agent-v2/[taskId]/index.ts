/**
 * GET /api/agent/[taskId]
 * Get task status and details
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { taskId } = req.query;

  if (!taskId || typeof taskId !== 'string') {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get task
  const { data: task, error: taskError } = await supabase
    .from('agent_tasks_v2')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Get task steps
  const { data: steps } = await supabase
    .from('agent_steps_v2')
    .select('*')
    .eq('task_id', taskId)
    .order('step_number', { ascending: true });

  res.status(200).json({
    task: {
      id: task.id,
      userId: task.user_id,
      prompt: task.prompt,
      state: task.state,
      plan: task.plan,
      currentPhaseId: task.current_phase_id,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      error: task.error,
      result: task.result,
    },
    steps: steps || [],
  });
}
