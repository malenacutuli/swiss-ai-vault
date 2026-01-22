/**
 * Vercel Serverless API - Status Endpoint
 * 
 * Provides comprehensive health check and system status for staging verification.
 * This endpoint is used to verify the deployment is working correctly.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  checks: {
    api: boolean;
    database: boolean;
    agentApi: boolean;
    e2b: boolean;
  };
  features: {
    wideResearch: boolean;
    documentGeneration: boolean;
    browserAutomation: boolean;
    collaboration: boolean;
  };
  buildInfo: {
    buildTime: string;
    commitHash: string;
    branch: string;
  };
}

// Track server start time for uptime calculation
const serverStartTime = Date.now();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentApiUrl = process.env.AGENT_API_URL || 'https://api.swissbrain.ai';
  
  // Perform health checks
  const checks = {
    api: true, // This endpoint is responding, so API is healthy
    database: await checkDatabase(),
    agentApi: await checkAgentApi(agentApiUrl),
    e2b: await checkE2B(),
  };

  // Determine overall status
  const allHealthy = Object.values(checks).every(v => v);
  const someHealthy = Object.values(checks).some(v => v);
  
  const status: SystemStatus = {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.VITE_APP_ENV || process.env.VERCEL_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    checks,
    features: {
      wideResearch: process.env.VITE_ENABLE_WIDE_RESEARCH === 'true',
      documentGeneration: process.env.VITE_ENABLE_DOCUMENT_GENERATION === 'true',
      browserAutomation: process.env.VITE_ENABLE_BROWSER_AUTOMATION === 'true',
      collaboration: true,
    },
    buildInfo: {
      buildTime: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown',
      commitHash: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    },
  };

  const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
  return res.status(httpStatus).json(status);
}

async function checkDatabase(): Promise<boolean> {
  // In a real implementation, this would check Supabase/database connectivity
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  return !!supabaseUrl;
}

async function checkAgentApi(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkE2B(): Promise<boolean> {
  // Check if E2B API key is configured
  return !!process.env.E2B_API_KEY;
}

export const config = {
  api: {
    bodyParser: false,
  },
};
