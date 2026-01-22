/**
 * POST /api/agent/create
 * Create a new agent task
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface CreateTaskRequest {
  prompt: string;
  attachments?: string[];
  options?: {
    maxIterations?: number;
    timeout?: number;
    model?: string;
  };
}

interface CreateTaskResponse {
  taskId: string;
  status: string;
  streamUrl: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const manusApiKey = process.env.MANUS_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase not configured' });
    return;
  }

  if (!manusApiKey) {
    res.status(500).json({ error: 'Manus API key not configured' });
    return;
  }

  // Parse request body
  const body = req.body as CreateTaskRequest;

  if (!body.prompt || typeof body.prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user from auth header (simplified - in production use proper JWT validation)
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    } catch {
      // Continue with anonymous user
    }
  }

  // Generate task ID
  const taskId = uuidv4();

  // Create task in database
  const { error: insertError } = await supabase
    .from('agent_tasks_v2')
    .insert({
      id: taskId,
      user_id: userId,
      prompt: body.prompt,
      state: 'idle',
      plan: null,
      current_phase_id: 0,
      options: body.options || {},
      attachments: body.attachments || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error('Failed to create task:', insertError);
    res.status(500).json({ error: 'Failed to create task', details: insertError.message });
    return;
  }

  // Return task info
  const response: CreateTaskResponse = {
    taskId,
    status: 'idle',
    streamUrl: `/api/agent/${taskId}/stream`,
  };

  res.status(201).json(response);
}
