// Agent Logs Edge Function
// Supports both polling and SSE streaming for real-time logs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Type interfaces for query results
interface AgentLog {
  id: string;
  run_id: string;
  log_type: string;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface AgentRun {
  id: string;
  user_id: string;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with user auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Parse query parameters
    const url = new URL(req.url);
    const runId = url.searchParams.get('run_id');
    const mode = url.searchParams.get('mode') || 'polling'; // 'polling' or 'stream'
    const since = url.searchParams.get('since'); // ISO timestamp for cursor-based pagination
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!runId) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this run
    const { data: run } = await supabase
      .from('agent_runs')
      .select('user_id, status')
      .eq('id', runId)
      .single();

    const runData = run as AgentRun | null;
    if (!runData || runData.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Run not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Polling mode
    if (mode === 'polling') {
      return await handlePolling(supabase as any, runId, since, limit);
    }

    // SSE streaming mode
    if (mode === 'stream') {
      return await handleStreaming(supabase as any, runId, runData.status, req);
    }

    return new Response(JSON.stringify({ error: 'Invalid mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Agent logs error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Handle polling mode
async function handlePolling(
  supabase: any,
  runId: string,
  since: string | null,
  limit: number
) {
  // Build logs query
  let query = supabase
    .from('agent_task_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data: logs } = await query.limit(limit);
  const logsData = (logs || []) as AgentLog[];

  // Get the last timestamp for cursor
  const lastLog = logsData.length > 0 ? logsData[logsData.length - 1] : null;
  const nextCursor = lastLog ? lastLog.created_at : null;

  return new Response(
    JSON.stringify({
      logs: logsData,
      count: logsData.length,
      next_cursor: nextCursor,
      has_more: logsData.length === limit,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Handle SSE streaming mode
async function handleStreaming(
  supabase: any,
  runId: string,
  initialStatus: string,
  req: Request
) {
  const encoder = new TextEncoder();
  let lastTimestamp = new Date(0).toISOString();
  let intervalId: number | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', run_id: runId })}\n\n`)
      );

      // Set up polling interval (check for new logs every 1 second)
      intervalId = setInterval(async () => {
        try {
          // Fetch new logs since last timestamp
          const { data: logs } = await supabase
            .from('agent_task_logs')
            .select('*')
            .eq('run_id', runId)
            .gt('created_at', lastTimestamp)
            .order('created_at', { ascending: true })
            .limit(20);

          const logsData = (logs || []) as AgentLog[];
          if (logsData.length > 0) {
            for (const log of logsData) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`)
              );
            }
            // Update last timestamp
            lastTimestamp = logsData[logsData.length - 1].created_at;
          }

          // Check if run is complete
          const { data: run } = await supabase
            .from('agent_runs')
            .select('status')
            .eq('id', runId)
            .single();

          const runStatus = run as AgentRun | null;
          if (
            runStatus &&
            ['completed', 'failed', 'cancelled', 'timeout'].includes(runStatus.status)
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'complete', status: runStatus.status })}\n\n`
              )
            );
            controller.close();
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('SSE poll error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Polling error' })}\n\n`
            )
          );
        }
      }, 1000);

      // Clean up on connection close
      req.signal.addEventListener('abort', () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
