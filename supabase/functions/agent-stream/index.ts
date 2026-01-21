// Agent Stream Edge Function
// Proxies SSE stream from Agent API backend to frontend
// Enables real-time execution updates like Manus.im

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authenticateToken, extractToken } from '../_shared/cross-project-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const AGENT_API_URL = Deno.env.get('AGENT_API_URL') || 'https://api.swissbrain.ai';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = extractToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authResult = await authenticateToken(token, supabase);
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.user.id;

    // Get run_id from query params or body
    const url = new URL(req.url);
    let runId = url.searchParams.get('run_id');
    
    if (!runId && req.method === 'POST') {
      const body = await req.json();
      runId = body.run_id;
    }

    if (!runId) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this run
    const { data: run } = await supabase
      .from('agent_runs')
      .select('user_id')
      .eq('id', runId)
      .single();

    if (!run || run.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Run not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[agent-stream] Starting stream for run:', runId);

    // Connect to Agent API SSE endpoint
    const streamUrl = `${AGENT_API_URL}/agent/stream/${runId}`;
    
    const agentResponse = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'X-User-ID': userId,
        'Authorization': `Bearer ${Deno.env.get('AGENT_API_KEY') || ''}`,
      },
    });

    if (!agentResponse.ok) {
      // Fallback to polling-based stream simulation
      console.log('[agent-stream] Agent API stream unavailable, using polling fallback');
      return createPollingStream(supabase, runId);
    }

    // Proxy the SSE stream
    const headers = new Headers({
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Create a TransformStream to proxy the response
    const { readable, writable } = new TransformStream();
    
    // Pipe the agent response to our response
    agentResponse.body?.pipeTo(writable).catch(console.error);

    return new Response(readable, { headers });

  } catch (error) {
    console.error('[agent-stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Polling-based stream fallback when Agent API is unavailable
function createPollingStream(supabase: any, runId: string): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = '';
      let lastStepCount = 0;
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes at 1 poll/second

      const poll = async () => {
        try {
          pollCount++;
          
          // Get run status
          const { data: run } = await supabase
            .from('agent_runs')
            .select('*')
            .eq('id', runId)
            .single();

          if (!run) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Run not found' })}\n\n`));
            controller.close();
            return;
          }

          // Send status update if changed
          if (run.status !== lastStatus) {
            lastStatus = run.status;
            controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({
              status: run.status,
              state: run.state,
              progress: run.progress_percentage || 0,
              current_phase: run.current_phase,
              total_phases: run.total_phases,
            })}\n\n`));
          }

          // Get steps
          const { data: steps } = await supabase
            .from('agent_task_steps')
            .select('*')
            .eq('run_id', runId)
            .order('step_number', { ascending: true });

          // Send new steps
          if (steps && steps.length > lastStepCount) {
            for (let i = lastStepCount; i < steps.length; i++) {
              controller.enqueue(encoder.encode(`event: step\ndata: ${JSON.stringify(steps[i])}\n\n`));
            }
            lastStepCount = steps.length;
          }

          // Get recent logs
          const { data: logs } = await supabase
            .from('agent_task_logs')
            .select('*')
            .eq('run_id', runId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (logs && logs.length > 0) {
            controller.enqueue(encoder.encode(`event: logs\ndata: ${JSON.stringify(logs)}\n\n`));
          }

          // Check terminal states
          if (['completed', 'failed', 'cancelled'].includes(run.status)) {
            // Send final result
            const { data: outputs } = await supabase
              .from('agent_task_outputs')
              .select('*')
              .eq('run_id', runId);

            controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({
              status: run.status,
              result: run.result_summary,
              outputs: outputs || [],
              duration_ms: run.duration_ms,
              credits_used: run.credits_used,
            })}\n\n`));
            
            controller.close();
            return;
          }

          // Continue polling
          if (pollCount < maxPolls) {
            setTimeout(poll, 1000);
          } else {
            controller.enqueue(encoder.encode(`event: timeout\ndata: ${JSON.stringify({ message: 'Stream timeout' })}\n\n`));
            controller.close();
          }

        } catch (error) {
          console.error('[polling-stream] Error:', error);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Polling error' })}\n\n`));
        }
      };

      // Start polling
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
