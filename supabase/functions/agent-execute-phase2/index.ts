// Agent Execute Edge Function
// Main entry point for agent execution (create, start, stop, retry, resume)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AgentStateMachine, createStateMachine } from '../_shared/agent/state-machine.ts';
import { executeTransition, TransitionContext } from '../_shared/agent/transitions.ts';
import { AgentPlanner } from '../_shared/agent/planner.ts';
import { AgentSupervisor, SupervisorContext } from '../_shared/agent/supervisor.ts';
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
        return await handleCreate(supabase, userId, prompt, project_id, connector_ids);

      case 'start':
        return await handleStart(supabase, userId, run_id);

      case 'stop':
        return await handleStop(supabase, userId, run_id);

      case 'retry':
        return await handleRetry(supabase, userId, run_id);

      case 'resume':
        return await handleResume(supabase, userId, run_id, body.user_input);

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
  supabase: ReturnType<typeof createClient>,
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

  if (!balance || balance.available_credits <= 0) {
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

  // Store initial user message
  await supabase.from('agent_messages').insert({
    run_id: run.id,
    role: 'user',
    content: prompt,
  });

  // Link connectors if provided
  if (connectorIds && connectorIds.length > 0) {
    await supabase.from('agent_run_connectors').insert(
      connectorIds.map(connectorId => ({
        run_id: run.id,
        connector_id: connectorId,
      }))
    );
  }

  return new Response(
    JSON.stringify({
      run_id: run.id,
      status: run.status,
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
  supabase: ReturnType<typeof createClient>,
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

  // Check if run can be started
  if (run.status !== 'created' && run.status !== 'queued') {
    return new Response(
      JSON.stringify({
        error: `Cannot start run in status: ${run.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create state machine
  const stateMachine = await createStateMachine(supabase, runId);
  if (!stateMachine) {
    return new Response(JSON.stringify({ error: 'Failed to create state machine' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const transCtx: TransitionContext = {
    supabase,
    runId,
    userId,
    stateMachine,
  };

  // Transition to planning
  await executeTransition(transCtx, 'planning');

  // Create planner and generate plan
  const planner = new AgentPlanner(supabase, userId);
  const { plan, error: planError } = await planner.createPlan(run.prompt);

  if (!plan || planError) {
    await executeTransition(transCtx, 'failed', {
      error_message: `Planning failed: ${planError}`,
      error_code: 'PLANNING_FAILED',
    });

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
  supabase: ReturnType<typeof createClient>,
  userId: string,
  runId: string,
  plan: any,
  stateMachine: AgentStateMachine
) {
  try {
    // Create supervisor context
    const toolRouter = new ToolRouter(supabase);

    const supervisorCtx: SupervisorContext = {
      supabase,
      runId,
      userId,
      plan,
      currentPhaseNumber: 1,
      conversationHistory: [],
      stateMachine,
      toolRouter,
    };

    // Create and run supervisor
    const supervisor = new AgentSupervisor(supervisorCtx);
    await supervisor.execute();
  } catch (error) {
    console.error('Background execution error:', error);
  }
}

// Stop agent execution
async function handleStop(
  supabase: ReturnType<typeof createClient>,
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

  // Create state machine
  const stateMachine = await createStateMachine(supabase, runId);
  if (!stateMachine) {
    return new Response(JSON.stringify({ error: 'Failed to create state machine' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if can be cancelled
  if (!stateMachine.canCancel()) {
    return new Response(
      JSON.stringify({
        error: `Cannot cancel run in status: ${run.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const transCtx: TransitionContext = {
    supabase,
    runId,
    userId,
    stateMachine,
  };

  // Transition to cancelled
  await executeTransition(transCtx, 'cancelled');

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
  supabase: ReturnType<typeof createClient>,
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

  // Can only retry failed runs
  if (run.status !== 'failed') {
    return new Response(
      JSON.stringify({
        error: `Cannot retry run in status: ${run.status}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create new run with same prompt
  return handleCreate(supabase, userId, run.prompt, run.project_id);
}

// Resume paused/waiting run
async function handleResume(
  supabase: ReturnType<typeof createClient>,
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

  // Create state machine
  const stateMachine = await createStateMachine(supabase, runId);
  if (!stateMachine) {
    return new Response(JSON.stringify({ error: 'Failed to create state machine' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if can be resumed
  if (!stateMachine.canResume()) {
    return new Response(
      JSON.stringify({
        error: `Cannot resume run in status: ${run.status}`,
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

  const transCtx: TransitionContext = {
    supabase,
    runId,
    userId,
    stateMachine,
  };

  // Resume execution
  await executeTransition(transCtx, 'executing');

  // Continue execution in background
  const plan = run.execution_plan;
  executeInBackground(supabase, userId, runId, plan, stateMachine);

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
