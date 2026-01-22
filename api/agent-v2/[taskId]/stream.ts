/**
 * GET /api/agent-v2/[taskId]/stream
 * Server-Sent Events stream for real-time task updates
 * 
 * Uses Manus Native Task API with polling for status updates.
 * Documentation: https://open.manus.im/docs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MANUS_API_URL = process.env.MANUS_API_URL || 'https://api.manus.im/v1';
const MANUS_API_KEY = process.env.MANUS_API_KEY;

// Poll interval in milliseconds
const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 600000; // 10 minutes max

interface ManusTaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_input';
  title?: string;
  message?: string;
  output?: {
    text?: string;
    files?: Array<{
      file_id: string;
      file_name: string;
      file_url: string;
    }>;
  };
  plan?: {
    phases: Array<{
      id: number;
      title: string;
      status: 'pending' | 'running' | 'completed';
    }>;
    current_phase?: number;
  };
  created_at?: string;
  updated_at?: string;
}

async function getManusTaskStatus(taskId: string): Promise<ManusTaskStatus> {
  const response = await fetch(`${MANUS_API_URL}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'API_KEY': MANUS_API_KEY!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manus API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { taskId } = req.query;

  if (!taskId || typeof taskId !== 'string') {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }

  if (!MANUS_API_KEY) {
    res.status(500).json({ 
      error: 'Server configuration error',
      details: 'MANUS_API_KEY is not configured'
    });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Helper to send SSE events
  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection event
  sendEvent('connected', { taskId, timestamp: new Date().toISOString() });

  const startTime = Date.now();
  let lastStatus: string | null = null;
  let lastPhase: number | null = null;

  try {
    // Poll for task status
    while (Date.now() - startTime < MAX_POLL_TIME) {
      const status = await getManusTaskStatus(taskId);

      // Send status update if changed
      if (status.status !== lastStatus) {
        sendEvent('status_changed', {
          status: status.status,
          title: status.title,
          message: status.message,
        });
        lastStatus = status.status;
      }

      // Send phase update if changed
      if (status.plan?.current_phase && status.plan.current_phase !== lastPhase) {
        const currentPhase = status.plan.phases?.find(p => p.id === status.plan!.current_phase);
        sendEvent('phase_update', {
          currentPhase: status.plan.current_phase,
          totalPhases: status.plan.phases?.length || 0,
          phaseTitle: currentPhase?.title,
          phases: status.plan.phases,
        });
        lastPhase = status.plan.current_phase;
      }

      // Check for terminal states
      if (status.status === 'completed') {
        sendEvent('task_completed', {
          taskId,
          output: status.output,
          message: status.message,
        });
        break;
      }

      if (status.status === 'failed') {
        sendEvent('task_failed', {
          taskId,
          error: status.message || 'Task failed',
        });
        break;
      }

      if (status.status === 'waiting_input') {
        sendEvent('waiting_input', {
          taskId,
          message: status.message,
        });
        // Don't break - keep polling in case user provides input via Manus UI
      }

      // Send heartbeat
      sendEvent('heartbeat', { timestamp: new Date().toISOString() });

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    // Timeout reached
    if (Date.now() - startTime >= MAX_POLL_TIME) {
      sendEvent('timeout', {
        taskId,
        message: 'Polling timeout reached. Task may still be running.',
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendEvent('error', { 
      taskId,
      error: errorMessage,
    });
  }

  // End stream
  sendEvent('stream_end', { taskId });
  res.end();
}
