/**
 * GET /api/agent/health
 * Health check endpoint for Swiss Agents V2
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    manus: { status: string; latency?: number };
    supabase: { status: string; latency?: number };
    e2b?: { status: string; latency?: number };
  };
}

async function checkManus(apiKey: string): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  try {
    // Use the correct Manus API endpoint and authentication
    const response = await fetch('https://api.manus.im/v1/tasks?limit=1', {
      headers: { 'API_KEY': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    return {
      status: response.ok ? 'up' : 'error',
      latency,
    };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

async function checkSupabase(url: string, key: string): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    return {
      status: response.ok ? 'up' : 'error',
      latency,
    };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

async function checkE2B(apiKey: string): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.e2b.dev/health', {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    return {
      status: response.ok ? 'up' : 'error',
      latency,
    };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const manusApiKey = process.env.MANUS_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const e2bApiKey = process.env.E2B_API_KEY;

  // Check all services in parallel
  const [manusCheck, supabaseCheck, e2bCheck] = await Promise.all([
    manusApiKey ? checkManus(manusApiKey) : Promise.resolve({ status: 'not_configured', latency: 0 }),
    supabaseUrl && supabaseKey ? checkSupabase(supabaseUrl, supabaseKey) : Promise.resolve({ status: 'not_configured', latency: 0 }),
    e2bApiKey ? checkE2B(e2bApiKey) : Promise.resolve({ status: 'not_configured', latency: 0 }),
  ]);

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Manus is required
  if (manusCheck.status !== 'up') {
    overallStatus = 'unhealthy';
  }

  // Supabase is required
  if (supabaseCheck.status !== 'up') {
    overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // E2B is optional but degrades if down
  if (e2bApiKey && e2bCheck.status !== 'up') {
    overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    services: {
      manus: manusCheck,
      supabase: supabaseCheck,
      ...(e2bApiKey && { e2b: e2bCheck }),
    },
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(response);
}
