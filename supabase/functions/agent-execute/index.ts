// Agent Execute Edge Function
// Main entry point for agent execution (create, start, stop, retry, resume)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AgentStateMachine, createStateMachine } from '../_shared/agent/state-machine.ts';
import { executeTransition } from '../_shared/agent/transitions.ts';
import { AgentPlanner } from '../_shared/agent/planner.ts';
import { AgentSupervisor } from '../_shared/agent/supervisor.ts';
import { ToolRouter } from '../_shared/tools/router.ts';

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
    const { action, run_id, prompt, project_id, connector_ids } = body;

    // Route to appropriate action handler
    switch (action) {
      case 'create':
        return await handleCreate(supabase as any, userId, prompt, project_id, connector_ids);

      case 'start':
        return await handleStart(supabase as any, userId, run_id);

      case 'stop':
        return await handleStop(supabase as any, userId, run_id);

      case 'retry':
        return await handleRetry(supabase as any, userId, run_id);

      case 'resume':
        return await handleResume(supabase as any, userId, run_id, body.user_input);

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Agent execute error:', error);
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

// Create new agent run
async function handleCreate(
  supabase: any,
  userId: string,
  prompt: string,
  projectId?: string,
  connectorIds?: string[]
) {
  // Validate prompt
  if (!prompt || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check credit balance
  const { data: balance } = await supabase
    .from('credit_balances')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  if (!balance || (balance as any).available_credits <= 0) {
    return new Response(
      JSON.stringify({ error: 'Insufficient credits' }),
      {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create agent run record
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      prompt,
      status: 'created',
      current_phase: 0,
      total_credits_used: 0,
    })
    .select()
    .single();

  if (runError || !run) {
    return new Response(
      JSON.stringify({ error: 'Failed to create run', details: runError }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const runData = run as any;

  // Store initial user message
  await supabase.from('agent_messages').insert({
    run_id: runData.id,
    role: 'user',
    content: prompt,
  });

  // Link connectors if provided
  if (connectorIds && connectorIds.length > 0) {
    await supabase.from('agent_run_connectors').insert(
      connectorIds.map((connectorId: string) => ({
        run_id: runData.id,
        connector_id: connectorId,
      }))
    );
  }

  return new Response(
    JSON.stringify({
      run_id: runData.id,
      status: runData.status,
      message: 'Agent run created successfully',
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Start agent execution
async function handleStart(
  supabase: any,
  userId: string,
  runId: string
) {
  if (!runId) {
    return new Response(JSON.stringify({ error: 'run_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get run
  const { data: run } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const runData = run as any;

  // Check if run can be started
  if (runData.status !== 'created' && runData.status !== 'queued') {
    return new Response(
      JSON.stringify({
        error: `Cannot start run in status: ${runData.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create state machine
  const stateMachine = createStateMachine(runId, runData.status);

  // Transition to planning
  stateMachine.transition('planning', 'user_start');

  // Update status in database
  await supabase
    .from('agent_runs')
    .update({ status: 'planning', updated_at: new Date().toISOString() })
    .eq('id', runId);

  // Create planner and generate plan
  const planner = new AgentPlanner(supabase, userId);
  const { plan, error: planError } = await planner.createPlan(runData.prompt);

  if (!plan || planError) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: `Planning failed: ${planError}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return new Response(
      JSON.stringify({ error: 'Planning failed', details: planError }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Save plan to run
  await planner.savePlan(runId, plan);

  // Start execution in background (don't wait)
  executeInBackground(supabase, userId, runId, plan, stateMachine);

  return new Response(
    JSON.stringify({
      run_id: runId,
      status: 'executing',
      plan,
      message: 'Agent execution started',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Execute agent in background
async function executeInBackground(
  supabase: any,
  userId: string,
  runId: string,
  plan: any,
  stateMachine: AgentStateMachine
) {
  try {
    // Update to executing
    await supabase
      .from('agent_runs')
      .update({ status: 'executing', started_at: new Date().toISOString() })
      .eq('id', runId);

    // Create supervisor and run
    const supervisor = new AgentSupervisor(supabase, {
      runId,
      userId,
      plan,
      currentPhaseIndex: 0,
      phaseResults: {},
    });

    await supervisor.runToCompletion();
  } catch (error) {
    console.error('Background execution error:', error);
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Execution failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
}

// Stop agent execution
async function handleStop(
  supabase: any,
  userId: string,
  runId: string
) {
  if (!runId) {
    return new Response(JSON.stringify({ error: 'run_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get run
  const { data: run } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const runData = run as any;

  // Create state machine
  const stateMachine = createStateMachine(runId, runData.status);

  // Check if can be cancelled
  if (!stateMachine.canTransition('cancelled')) {
    return new Response(
      JSON.stringify({
        error: `Cannot cancel run in status: ${runData.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Transition to cancelled
  await supabase
    .from('agent_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  return new Response(
    JSON.stringify({
      run_id: runId,
      status: 'cancelled',
      message: 'Agent execution stopped',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Retry failed run
async function handleRetry(
  supabase: any,
  userId: string,
  runId: string
) {
  if (!runId) {
    return new Response(JSON.stringify({ error: 'run_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get run
  const { data: run } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const runData = run as any;

  // Can only retry failed runs
  if (runData.status !== 'failed') {
    return new Response(
      JSON.stringify({
        error: `Cannot retry run in status: ${runData.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create new run with same prompt
  return handleCreate(supabase, userId, runData.prompt, runData.project_id);
}

// Resume paused/waiting run
async function handleResume(
  supabase: any,
  userId: string,
  runId: string,
  userInput?: string
) {
  if (!runId) {
    return new Response(JSON.stringify({ error: 'run_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get run
  const { data: run } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const runData = run as any;

  // Create state machine
  const stateMachine = createStateMachine(runId, runData.status);

  // Check if can be resumed
  if (!stateMachine.canTransition('executing')) {
    return new Response(
      JSON.stringify({
        error: `Cannot resume run in status: ${runData.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // If user input provided, store it
  if (userInput) {
    await supabase.from('agent_messages').insert({
      run_id: runId,
      role: 'user',
      content: userInput,
    });
  }

  // Resume execution
  await supabase
    .from('agent_runs')
    .update({ status: 'executing', updated_at: new Date().toISOString() })
    .eq('id', runId);

  // Continue execution in background
  const plan = runData.execution_plan;
  if (plan) {
    const sm = createStateMachine(runId, 'executing');
    executeInBackground(supabase, userId, runId, plan, sm);
  }

  return new Response(
    JSON.stringify({
      run_id: runId,
      status: 'executing',
      message: 'Agent execution resumed',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
