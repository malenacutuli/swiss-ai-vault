// Agent Status Edge Function
// Returns detailed run status with pagination

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Parse request body
    const body = await req.json();
    const {
      run_id,
      include_steps = true,
      include_messages = true,
      include_artifacts = true,
      include_logs = true,
      steps_limit = 50,
      messages_limit = 100,
      artifacts_limit = 20,
      logs_limit = 50,
    } = body;

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get run
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', run_id)
      .eq('user_id', userId)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: 'Run not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build response
    const response: Record<string, unknown> = {
      run,
      progress: calculateProgress(run),
    };

    // Include steps if requested
    if (include_steps) {
      const { data: steps } = await supabase
        .from('agent_steps')
        .select('*')
        .eq('run_id', run_id)
        .order('phase_number', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(steps_limit);

      response.steps = steps || [];
    }

    // Include messages if requested
    if (include_messages) {
      const { data: messages } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('run_id', run_id)
        .order('created_at', { ascending: true })
        .limit(messages_limit);

      response.messages = messages || [];
    }

    // Include artifacts if requested
    if (include_artifacts) {
      const { data: artifacts } = await supabase
        .from('agent_artifacts')
        .select('*')
        .eq('run_id', run_id)
        .order('created_at', { ascending: true })
        .limit(artifacts_limit);

      response.artifacts = artifacts || [];
    }

    // Include logs if requested
    if (include_logs) {
      const { data: logs } = await supabase
        .from('agent_task_logs')
        .select('*')
        .eq('run_id', run_id)
        .order('created_at', { ascending: true })
        .limit(logs_limit);

      response.logs = logs || [];
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Agent status error:', error);
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

// Calculate run progress
function calculateProgress(run: any): {
  percentage: number;
  current_phase: number;
  total_phases: number;
  status: string;
} {
  const plan = run.execution_plan;
  const totalPhases = plan?.phases?.length || 0;
  const currentPhase = run.current_phase || 0;

  let percentage = 0;
  if (totalPhases > 0) {
    if (run.status === 'completed') {
      percentage = 100;
    } else if (run.status === 'failed' || run.status === 'cancelled') {
      percentage = Math.floor((currentPhase / totalPhases) * 100);
    } else {
      percentage = Math.floor((currentPhase / totalPhases) * 100);
    }
  }

  return {
    percentage,
    current_phase: currentPhase,
    total_phases: totalPhases,
    status: run.status,
  };
}
