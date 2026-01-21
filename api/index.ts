/**
 * API Index - Root endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).json({
    name: 'SwissBrain API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      agent: '/api/agent/*',
    },
    timestamp: new Date().toISOString(),
  });
}
