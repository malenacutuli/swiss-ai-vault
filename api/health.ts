/**
 * Health Check Endpoint
 * 
 * Returns the health status of the API and backend connectivity
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const AGENT_API_URL = process.env.AGENT_API_URL || 'https://api.swissbrain.ai';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghmmdochvlrnwbruyrqk.supabase.co';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    frontend: ServiceStatus;
    agentApi: ServiceStatus;
    supabase: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'unknown';
  latency?: number;
  error?: string;
}

async function checkService(url: string, timeout = 5000): Promise<ServiceStatus> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return {
      status: response.ok ? 'up' : 'down',
      latency: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: error.message || 'Connection failed',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Check services in parallel
  const [agentApiStatus, supabaseStatus] = await Promise.all([
    checkService(`${AGENT_API_URL}/health`),
    checkService(`${SUPABASE_URL}/rest/v1/`),
  ]);

  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    services: {
      frontend: { status: 'up' },
      agentApi: agentApiStatus,
      supabase: supabaseStatus,
    },
  };

  // Determine overall status
  const allServices = [agentApiStatus, supabaseStatus];
  const downCount = allServices.filter(s => s.status === 'down').length;
  
  if (downCount === allServices.length) {
    health.status = 'unhealthy';
  } else if (downCount > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  return res.status(statusCode).json(health);
}
