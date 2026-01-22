/**
 * POST /api/agent-v2/create
 * Create a new agent task using Manus API
 * 
 * Documentation: https://open.manus.ai/docs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Manus API configuration
const MANUS_API_URL = process.env.MANUS_API_URL || 'https://api.manus.ai/v1';
const MANUS_API_KEY = process.env.MANUS_API_KEY;

interface CreateTaskRequest {
  prompt: string;
  agentProfile?: 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max';
  taskMode?: 'chat' | 'adaptive' | 'agent';
  attachments?: Array<{
    type: 'file_id' | 'url' | 'base64';
    file_id?: string;
    url?: string;
    data?: string;
    mime_type?: string;
    file_name?: string;
  }>;
  projectId?: string;
  interactiveMode?: boolean;
}

interface ManusTaskResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check API key configuration
  if (!MANUS_API_KEY) {
    console.error('MANUS_API_KEY is not configured');
    res.status(500).json({ 
      error: 'Server configuration error',
      details: 'MANUS_API_KEY is not configured. Please add it to your Vercel environment variables.',
      help: 'Get your API key from https://manus.im/settings/api'
    });
    return;
  }

  // Parse request body
  const body = req.body as CreateTaskRequest;

  if (!body.prompt || typeof body.prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    console.log('Creating Manus task:', {
      prompt: body.prompt.substring(0, 100) + (body.prompt.length > 100 ? '...' : ''),
      agentProfile: body.agentProfile || 'manus-1.6',
      taskMode: body.taskMode || 'agent',
    });

    // Call Manus API to create task
    const manusResponse = await fetch(`${MANUS_API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API_KEY': MANUS_API_KEY,
      },
      body: JSON.stringify({
        prompt: body.prompt,
        agentProfile: body.agentProfile || 'manus-1.6',
        taskMode: body.taskMode || 'agent',
        attachments: body.attachments,
        projectId: body.projectId,
        interactiveMode: body.interactiveMode ?? false,
        createShareableLink: true,
      }),
    });

    if (!manusResponse.ok) {
      const errorText = await manusResponse.text();
      console.error('Manus API error:', manusResponse.status, errorText);
      
      // Parse error for better messaging
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.error || errorText;
      } catch {
        // Keep original error text
      }

      res.status(manusResponse.status).json({
        error: 'Manus API error',
        status: manusResponse.status,
        details: errorDetails,
      });
      return;
    }

    const taskData: ManusTaskResponse = await manusResponse.json();
    
    console.log('Manus task created successfully:', {
      task_id: taskData.task_id,
      task_title: taskData.task_title,
      task_url: taskData.task_url,
    });

    // Return task info
    res.status(201).json({
      success: true,
      task: {
        id: taskData.task_id,
        title: taskData.task_title,
        url: taskData.task_url,
        shareUrl: taskData.share_url,
        // For polling status
        statusUrl: `/api/agent-v2/${taskData.task_id}`,
      },
      // Direct link to Manus.im for viewing the task
      manusUrl: taskData.task_url,
    });

  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
