/**
 * Vercel Serverless API Proxy for Agent Requests
 * 
 * This proxy forwards agent API requests to the backend while handling:
 * - CORS headers
 * - Authentication token forwarding
 * - SSE streaming support
 * - Error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Backend API URL - can be overridden via environment variable
const AGENT_API_URL = process.env.AGENT_API_URL || 'https://api.swissbrain.ai';

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // Get the path from the catch-all route
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  // Build the target URL
  const targetUrl = `${AGENT_API_URL}/agent/${pathString}`;
  
  try {
    // Forward headers (excluding host)
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== 'host' && typeof value === 'string') {
        headers[key] = value;
      }
    }

    // Make the request to the backend
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' 
        ? JSON.stringify(req.body) 
        : undefined,
    });

    // Check if this is an SSE stream
    const contentType = response.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    // Set CORS headers
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Handle SSE streaming
    if (isSSE && response.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamError) {
        console.error('SSE stream error:', streamError);
      } finally {
        res.end();
      }
      return;
    }

    // Handle regular responses
    const data = await response.text();
    res.status(response.status);
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(data);
      return res.json(json);
    } catch {
      return res.send(data);
    }

  } catch (error: any) {
    console.error('Proxy error:', error);
    
    // Set CORS headers even on error
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res.status(502).json({
      error: 'Bad Gateway',
      message: error.message || 'Failed to connect to backend API',
      target: targetUrl,
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
};
