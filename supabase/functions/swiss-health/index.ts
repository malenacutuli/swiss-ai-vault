// supabase/functions/swiss-health/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SWISS_API = "https://api.swissbrain.ai";

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  message?: string;
  timestamp: string;
}

interface SystemHealth {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: string;
  version: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  const runTests = url.searchParams.get('test') === 'true';

  try {
    const checks: HealthCheckResult[] = [];

    // 1. Check Swiss K8s API connectivity
    const swissApiCheck = await checkSwissApi();
    checks.push(swissApiCheck);

    // 2. Check Python execution (if requested)
    if (runTests) {
      const pythonCheck = await checkPythonExecution();
      checks.push(pythonCheck);
    }

    // 3. Check Supabase connectivity
    const supabaseCheck = await checkSupabase(supabase);
    checks.push(supabaseCheck);

    // 4. Check Redis (Upstash)
    const redisCheck = await checkRedis();
    checks.push(redisCheck);

    // 5. Check AI providers
    if (detailed) {
      const geminiCheck = await checkGemini();
      checks.push(geminiCheck);
    }

    // Calculate overall status
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');

    const overall_status = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    // Store health metrics
    await storeHealthMetrics(supabase, checks, overall_status);

    const health: SystemHealth = {
      overall_status,
      checks,
      timestamp: new Date().toISOString(),
      version: Deno.env.get('DEPLOYMENT_VERSION') || '1.0.0'
    };

    const statusCode = overall_status === 'healthy' ? 200 : overall_status === 'degraded' ? 200 : 503;

    return new Response(
      JSON.stringify(health),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: unknown) {
    console.error("Health check error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        overall_status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkSwissApi(): Promise<HealthCheckResult> {
  const start = Date.now();
  const service = 'swiss_k8s_api';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${SWISS_API}/health`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok) {
      return {
        service,
        status: latency > 2000 ? 'degraded' : 'healthy',
        latency_ms: latency,
        message: latency > 2000 ? 'High latency detected' : 'Swiss K8s API responding',
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        service,
        status: 'unhealthy',
        latency_ms: latency,
        message: `API returned ${response.status}`,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? (error.name === 'AbortError' ? 'Timeout after 10s' : error.message)
      : String(error);
    return {
      service,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkPythonExecution(): Promise<HealthCheckResult> {
  const start = Date.now();
  const service = 'swiss_python_sandbox';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${SWISS_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'python_execute',
        parameters: {
          code: 'import sys; print(f"Python {sys.version_info.major}.{sys.version_info.minor}")'
        },
        run_id: 'health-check',
        step_id: 'health-check',
        timeout_ms: 15000
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok) {
      const result = await response.json();
      const output = result.output || result.stdout || '';

      if (output.includes('Python')) {
        return {
          service,
          status: latency > 5000 ? 'degraded' : 'healthy',
          latency_ms: latency,
          message: output.trim(),
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      service,
      status: 'unhealthy',
      latency_ms: latency,
      message: 'Python execution failed',
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? (error.name === 'AbortError' ? 'Timeout after 30s' : error.message)
      : String(error);
    return {
      service,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkSupabase(supabase: any): Promise<HealthCheckResult> {
  const start = Date.now();
  const service = 'supabase';

  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const latency = Date.now() - start;

    if (error) {
      return {
        service,
        status: 'unhealthy',
        latency_ms: latency,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }

    return {
      service,
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency_ms: latency,
      message: 'Database connection OK',
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      service,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  const service = 'redis_upstash';

  const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (!redisUrl || !redisToken) {
    return {
      service,
      status: 'degraded',
      latency_ms: 0,
      message: 'Redis not configured',
      timestamp: new Date().toISOString()
    };
  }

  try {
    const response = await fetch(`${redisUrl}/ping`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        service,
        status: latency > 500 ? 'degraded' : 'healthy',
        latency_ms: latency,
        message: 'Redis PONG',
        timestamp: new Date().toISOString()
      };
    }

    return {
      service,
      status: 'unhealthy',
      latency_ms: latency,
      message: `Redis returned ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      service,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkGemini(): Promise<HealthCheckResult> {
  const start = Date.now();
  const service = 'gemini_api';

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      service,
      status: 'degraded',
      latency_ms: 0,
      message: 'Gemini API key not configured',
      timestamp: new Date().toISOString()
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );

    const latency = Date.now() - start;

    if (response.ok) {
      return {
        service,
        status: latency > 2000 ? 'degraded' : 'healthy',
        latency_ms: latency,
        message: 'Gemini API accessible',
        timestamp: new Date().toISOString()
      };
    }

    return {
      service,
      status: 'unhealthy',
      latency_ms: latency,
      message: `Gemini returned ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      service,
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

async function storeHealthMetrics(
  supabase: any,
  checks: HealthCheckResult[],
  overallStatus: string
): Promise<void> {
  try {
    await supabase.from('health_metrics').insert({
      overall_status: overallStatus,
      checks: checks,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to store health metrics:', e);
  }
}
