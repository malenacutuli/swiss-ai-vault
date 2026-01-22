/**
 * GET /api/agent-v2/[taskId]
 * Get task status from Manus API
 * 
 * Documentation: https://open.manus.im/docs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MANUS_API_URL = process.env.MANUS_API_URL || 'https://api.manus.im/v1';
const MANUS_API_KEY = process.env.MANUS_API_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  try {
    // Get task status from Manus API
    const manusResponse = await fetch(`${MANUS_API_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'API_KEY': MANUS_API_KEY,
      },
    });

    if (!manusResponse.ok) {
      const errorText = await manusResponse.text();
      console.error('Manus API error:', manusResponse.status, errorText);
      
      res.status(manusResponse.status).json({
        error: 'Failed to get task status',
        details: errorText,
      });
      return;
    }

    const taskData = await manusResponse.json();
    
    res.status(200).json({
      success: true,
      task: taskData,
    });

  } catch (error) {
    console.error('Error getting task status:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
