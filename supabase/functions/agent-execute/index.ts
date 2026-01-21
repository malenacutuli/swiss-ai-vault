// Agent Execute Edge Function
// Main entry point for agent execution (create, start, stop, retry, resume)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AgentStateMachine, createStateMachine } from '../_shared/agent/state-machine.ts';
import { executeTransition, TransitionContext } from '../_shared/agent/transitions.ts';
import { AgentPlanner } from '../_shared/agent/planner.ts';
import { AgentSupervisor, SupervisorContext } from '../_shared/agent/supervisor.ts';
import { ToolRouter } from '../_shared/tools/router.ts';
import { authenticateToken, extractToken } from '../_shared/cross-project-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Permissive client type to avoid strict typing issues
type AnySupabaseClient = ReturnType<typeof createClient>;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role (for database operations)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[agent-execute] Creating Supabase client, URL:', supabaseUrl?.slice(0, 30));

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-supabase-service-role': 'true',
        },
      },
    });

    // Authenticate using cross-project auth (supports Lovable project tokens)
    const token = extractToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authResult = await authenticateToken(token, supabase);
    if (!authResult.user) {
      console.error('[agent-execute] Auth failed:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.user.id;
    console.log('[agent-execute] Authenticated user:', userId, 'source:', authResult.source);

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

  // Check/create credit balance (auto-provision for new users)
  let { data: balance } = await supabase
    .from('credit_balances')
    .select('available_credits')
    .eq('user_id', userId)
    .single();

  // Auto-create credit balance for new users
  if (!balance) {
    console.log('[agent-execute] Creating credit balance for new user:', userId);
    const { data: newBalance, error: createError } = await supabase
      .from('credit_balances')
      .insert({
        user_id: userId,
        available_credits: 10000, // Free tier: 10k credits
        total_credits: 10000,
        used_credits: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('[agent-execute] Failed to create credit balance:', createError);
      // Continue anyway for now - don't block execution
    } else {
      balance = newBalance;
    }
  }

  // Skip credit check if balance creation failed (allow execution for testing)
  if (balance && (balance as any).available_credits <= 0) {
    return new Response(
      JSON.stringify({ error: 'Insufficient credits' }),
      {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create agent run record (using actual schema columns)
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      workspace_id: projectId || null,
      prompt,
      status: 'created',
      state: 'created',
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

  // Auto-start the run (planning and execution)
  console.log('[agent-execute] Auto-starting run:', runData.id);

  // Update status to planning
  await supabase
    .from('agent_runs')
    .update({ status: 'planning', state: 'planning' })
    .eq('id', runData.id);

  // Create planner and generate plan (MUST await - Edge Functions kill unawaited promises)
  const planner = new AgentPlanner(supabase, userId);

  console.log('[agent-execute] Creating plan...');
  const { plan, error: planError } = await planner.createPlan(prompt);

  if (!plan || planError) {
    console.error('[agent-execute] Planning failed:', planError);
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        state: 'failed',
        error_message: `Planning failed: ${planError}`,
      })
      .eq('id', runData.id);

    return new Response(
      JSON.stringify({
        run_id: runData.id,
        taskId: runData.id,
        task: { ...runData, status: 'failed', error_message: planError },
        status: 'failed',
        error: planError,
        message: 'Planning failed',
      }),
      {
        status: 200, // Return 200 so client can show error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  console.log('[agent-execute] Plan created successfully, saving...');

  // Save plan to run
  await planner.savePlan(runData.id, plan);

  // Update to executing status
  await supabase
    .from('agent_runs')
    .update({ status: 'executing', state: 'executing' })
    .eq('id', runData.id);

  // Log plan created
  await supabase.from('agent_task_logs').insert({
    run_id: runData.id,
    log_type: 'plan_created',
    content: `Plan created with ${plan.phases.length} phases`,
    metadata: { phases: plan.phases.map((p: any) => p.name) },
  });

  // Create state machine for execution
  const stateMachine = await createStateMachine(supabase, runData.id);

  if (stateMachine) {
    // Start first phase of execution (supervisor loop)
    // We'll do one iteration here, then let polling continue
    console.log('[agent-execute] Starting execution...');

    try {
      const toolRouter = new ToolRouter(supabase);
      const supervisorCtx: SupervisorContext = {
        supabase,
        runId: runData.id,
        userId,
        plan,
        currentPhaseNumber: 1,
        conversationHistory: [],
        stateMachine,
        toolRouter,
      };

      const supervisor = new AgentSupervisor(supervisorCtx);

      // Execute the full agent loop (with timeout protection)
      const result = await Promise.race([
        supervisor.execute(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), 50000) // 50s timeout
        ),
      ]);

      console.log('[agent-execute] Execution result:', result);
    } catch (execError) {
      console.error('[agent-execute] Execution error:', execError);
      // Don't fail the whole run - let status polling show partial progress
      await supabase.from('agent_task_logs').insert({
        run_id: runData.id,
        log_type: 'execution_error',
        content: execError instanceof Error ? execError.message : 'Execution error',
      });
    }
  }

  // Return with current status
  const { data: updatedRun } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runData.id)
    .single();

  return new Response(
    JSON.stringify({
      run_id: runData.id,
      taskId: runData.id,
      task: updatedRun || { ...runData, status: 'executing' },
      status: updatedRun?.status || 'executing',
      plan,
      message: 'Agent run created and execution started',
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Background planning and execution
async function planAndExecute(
  supabase: any,
  userId: string,
  runId: string,
  prompt: string,
  planner: AgentPlanner,
  stateMachine: AgentStateMachine
) {
  try {
    console.log('[planAndExecute] Creating plan for run:', runId);

    const { plan, error: planError } = await planner.createPlan(prompt);

    if (!plan || planError) {
      console.error('[planAndExecute] Planning failed:', planError);
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          state: 'failed',
          error_message: `Planning failed: ${planError}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
      return;
    }

    console.log('[planAndExecute] Plan created, saving...');

    // Save plan to run
    await planner.savePlan(runId, plan);

    // Update status to executing
    await supabase
      .from('agent_runs')
      .update({ status: 'executing', state: 'executing' })
      .eq('id', runId);

    // Execute in background
    executeInBackground(supabase, userId, runId, plan, stateMachine);

  } catch (error) {
    console.error('[planAndExecute] Error:', error);
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        state: 'failed',
        error_message: error instanceof Error ? error.message : 'Planning failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
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

  // Create state machine (async with supabase as first argument)
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
  const { plan, error: planError } = await planner.createPlan(runData.prompt);

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
  supabase: any,
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
        error: `Cannot cancel run in status: ${runData.status}`,
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

  const transCtx: TransitionContext = {
    supabase,
    runId,
    userId,
    stateMachine,
  };

  // Resume execution
  await executeTransition(transCtx, 'executing');

  // Continue execution in background
  const plan = runData.plan;
  if (plan) {
    executeInBackground(supabase, userId, runId, plan, stateMachine);
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
