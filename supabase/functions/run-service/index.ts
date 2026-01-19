// supabase/functions/run-service/index.ts
// Run Service for Manus Parity - Full state machine with pause, resume, retry

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Run states
type RunState =
  | 'created'
  | 'pending'
  | 'running'
  | 'paused'
  | 'resuming'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

// State transition map
const VALID_TRANSITIONS: Record<RunState, RunState[]> = {
  created: ['pending', 'cancelled'],
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'paused', 'cancelled', 'timeout'],
  paused: ['resuming', 'cancelled'],
  resuming: ['running', 'failed', 'cancelled'],
  retrying: ['running', 'failed', 'cancelled'],
  completed: [],
  failed: ['retrying'],
  cancelled: [],
  timeout: ['retrying'],
};

// Action types
type RunServiceAction =
  | 'create'      // Create a new run
  | 'start'       // Start a created run
  | 'pause'       // Pause a running run
  | 'resume'      // Resume a paused run
  | 'retry'       // Retry a failed/timeout run
  | 'cancel'      // Cancel any non-terminal run
  | 'complete'    // Mark run as completed
  | 'fail'        // Mark run as failed
  | 'checkpoint'  // Create a checkpoint
  | 'get'         // Get run status
  | 'list'        // List runs
  | 'add_step'    // Add a step to the run
  | 'update_step' // Update a step

interface RunServiceRequest {
  action: RunServiceAction;
  // Create params
  task_type?: string;
  task_input?: Record<string, any>;
  task_config?: {
    timeout_ms?: number;
    max_retries?: number;
    retry_delay_ms?: number;
  };
  // Run identifiers
  run_id?: string;
  // Completion params
  result?: Record<string, any>;
  error_message?: string;
  error_code?: string;
  error_details?: Record<string, any>;
  // Checkpoint params
  checkpoint_data?: Record<string, any>;
  checkpoint_step?: number;
  // Step params
  step_type?: string;
  step_name?: string;
  step_input?: Record<string, any>;
  step_output?: Record<string, any>;
  step_id?: string;
  // List params
  state_filter?: RunState[];
  limit?: number;
  offset?: number;
}

interface Run {
  id: string;
  user_id: string;
  task_type: string;
  task_input: Record<string, any>;
  state: RunState;
  previous_state?: RunState;
  state_changed_at: string;
  started_at?: string;
  completed_at?: string;
  result?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  checkpoint_data?: Record<string, any>;
  checkpoint_step: number;
  tokens_used: number;
  credits_charged: number;
  execution_time_ms: number;
  created_at: string;
  updated_at: string;
}

// Validate state transition
function isValidTransition(from: RunState, to: RunState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

// Calculate execution time
function calculateExecutionTime(run: Run): number {
  if (!run.started_at) return 0;
  const start = new Date(run.started_at).getTime();
  const end = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
  return end - start;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params: RunServiceRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[run-service] User ${user.id} action: ${params.action}`);

    let result: any;

    switch (params.action) {
      // ===== CREATE =====
      case 'create': {
        if (!params.task_type) {
          throw new Error('task_type is required');
        }

        const config = params.task_config || {};
        const timeout_ms = config.timeout_ms || 300000; // 5 min default

        const { data, error } = await supabase
          .from('agent_runs')
          .insert({
            user_id: user.id,
            task_type: params.task_type,
            task_input: params.task_input || {},
            task_config: config,
            state: 'created',
            max_retries: config.max_retries || 3,
            retry_delay_ms: config.retry_delay_ms || 1000,
            timeout_ms,
            timeout_at: new Date(Date.now() + timeout_ms).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        // Log event
        await supabase.from('agent_run_events').insert({
          run_id: data.id,
          event_type: 'state_change',
          to_state: 'created',
          triggered_by: 'user',
          user_id: user.id,
        });

        result = { run: data };
        break;
      }

      // ===== START =====
      case 'start': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (!run) throw new Error('Run not found');

        // Validate transition: created -> pending -> running
        if (run.state === 'created') {
          // First transition to pending
          await transitionState(supabase, params.run_id, 'pending', 'user', user.id);
        }

        // Then to running
        const { data: updated } = await transitionState(supabase, params.run_id, 'running', 'user', user.id);
        result = { run: updated };
        break;
      }

      // ===== PAUSE =====
      case 'pause': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (!run) throw new Error('Run not found');
        if (run.state !== 'running') throw new Error('Can only pause running runs');

        // Save checkpoint if provided
        if (params.checkpoint_data) {
          await supabase.from('agent_runs').update({
            checkpoint_data: params.checkpoint_data,
            checkpoint_step: params.checkpoint_step || 0,
            checkpoint_at: new Date().toISOString(),
          }).eq('id', params.run_id);
        }

        const { data: updated } = await transitionState(supabase, params.run_id, 'paused', 'user', user.id);
        result = { run: updated };
        break;
      }

      // ===== RESUME =====
      case 'resume': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (!run) throw new Error('Run not found');
        if (run.state !== 'paused') throw new Error('Can only resume paused runs');

        // Transition: paused -> resuming -> running
        await transitionState(supabase, params.run_id, 'resuming', 'user', user.id);
        const { data: updated } = await transitionState(supabase, params.run_id, 'running', 'system', user.id);

        result = {
          run: updated,
          checkpoint: run.checkpoint_data,
          checkpoint_step: run.checkpoint_step,
        };
        break;
      }

      // ===== RETRY =====
      case 'retry': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (!run) throw new Error('Run not found');
        if (!['failed', 'timeout'].includes(run.state)) {
          throw new Error('Can only retry failed or timeout runs');
        }
        if (run.retry_count >= run.max_retries) {
          throw new Error(`Max retries (${run.max_retries}) exceeded`);
        }

        // Transition: failed/timeout -> retrying -> running
        await transitionState(supabase, params.run_id, 'retrying', 'user', user.id, {
          retry_reason: params.error_message || 'Manual retry',
        });

        // Wait for retry delay
        if (run.retry_delay_ms > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(run.retry_delay_ms, 5000)));
        }

        const { data: updated } = await transitionState(supabase, params.run_id, 'running', 'system', user.id);

        result = {
          run: updated,
          retry_count: run.retry_count + 1,
          checkpoint: run.checkpoint_data,
          checkpoint_step: run.checkpoint_step,
        };
        break;
      }

      // ===== CANCEL =====
      case 'cancel': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (!run) throw new Error('Run not found');
        if (['completed', 'failed', 'cancelled', 'timeout'].includes(run.state)) {
          throw new Error('Cannot cancel a terminal state run');
        }

        const { data: updated } = await transitionState(supabase, params.run_id, 'cancelled', 'user', user.id);
        result = { run: updated };
        break;
      }

      // ===== COMPLETE =====
      case 'complete': {
        if (!params.run_id) throw new Error('run_id is required');

        // Update result and execution time
        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .single();

        if (!run) throw new Error('Run not found');

        await supabase.from('agent_runs').update({
          result: params.result || {},
          execution_time_ms: calculateExecutionTime(run),
        }).eq('id', params.run_id);

        const { data: updated } = await transitionState(supabase, params.run_id, 'completed', 'system', user.id);
        result = { run: updated };
        break;
      }

      // ===== FAIL =====
      case 'fail': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .single();

        if (!run) throw new Error('Run not found');

        await supabase.from('agent_runs').update({
          error_message: params.error_message,
          error_code: params.error_code,
          error_details: params.error_details,
          execution_time_ms: calculateExecutionTime(run),
        }).eq('id', params.run_id);

        const { data: updated } = await transitionState(supabase, params.run_id, 'failed', 'system', user.id, {
          error: params.error_message,
        });
        result = { run: updated };
        break;
      }

      // ===== CHECKPOINT =====
      case 'checkpoint': {
        if (!params.run_id) throw new Error('run_id is required');
        if (!params.checkpoint_data) throw new Error('checkpoint_data is required');

        await supabase.from('agent_runs').update({
          checkpoint_data: params.checkpoint_data,
          checkpoint_step: params.checkpoint_step || 0,
          checkpoint_at: new Date().toISOString(),
        }).eq('id', params.run_id);

        await supabase.from('agent_run_events').insert({
          run_id: params.run_id,
          event_type: 'checkpoint',
          triggered_by: 'system',
          event_data: {
            step: params.checkpoint_step,
            data_keys: Object.keys(params.checkpoint_data),
          },
        });

        result = { success: true, checkpoint_step: params.checkpoint_step };
        break;
      }

      // ===== GET =====
      case 'get': {
        if (!params.run_id) throw new Error('run_id is required');

        const { data: run, error } = await supabase
          .from('agent_runs')
          .select('*')
          .eq('id', params.run_id)
          .eq('user_id', user.id)
          .single();

        if (error || !run) throw new Error('Run not found');

        // Get steps
        const { data: steps } = await supabase
          .from('agent_run_steps')
          .select('*')
          .eq('run_id', params.run_id)
          .order('step_number', { ascending: true });

        // Get recent events
        const { data: events } = await supabase
          .from('agent_run_events')
          .select('*')
          .eq('run_id', params.run_id)
          .order('created_at', { ascending: false })
          .limit(20);

        result = { run, steps: steps || [], events: events || [] };
        break;
      }

      // ===== LIST =====
      case 'list': {
        let query = supabase
          .from('agent_runs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (params.state_filter && params.state_filter.length > 0) {
          query = query.in('state', params.state_filter);
        }

        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1);

        const { data: runs, error } = await query;
        if (error) throw error;

        result = { runs: runs || [], limit, offset };
        break;
      }

      // ===== ADD_STEP =====
      case 'add_step': {
        if (!params.run_id) throw new Error('run_id is required');
        if (!params.step_type) throw new Error('step_type is required');

        // Get current step count
        const { count } = await supabase
          .from('agent_run_steps')
          .select('*', { count: 'exact', head: true })
          .eq('run_id', params.run_id);

        const { data: step, error } = await supabase
          .from('agent_run_steps')
          .insert({
            run_id: params.run_id,
            step_number: (count || 0) + 1,
            step_type: params.step_type,
            step_name: params.step_name,
            input: params.step_input,
            state: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        result = { step };
        break;
      }

      // ===== UPDATE_STEP =====
      case 'update_step': {
        if (!params.step_id) throw new Error('step_id is required');

        const updates: any = {};
        if (params.step_output !== undefined) {
          updates.output = params.step_output;
          updates.state = 'completed';
          updates.completed_at = new Date().toISOString();
        }

        const { data: step, error } = await supabase
          .from('agent_run_steps')
          .update(updates)
          .eq('id', params.step_id)
          .select()
          .single();

        if (error) throw error;

        // Calculate duration
        if (step && step.started_at && step.completed_at) {
          const duration = new Date(step.completed_at).getTime() - new Date(step.started_at).getTime();
          await supabase.from('agent_run_steps').update({ duration_ms: duration }).eq('id', params.step_id);
        }

        result = { step };
        break;
      }

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[run-service] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Transition state
async function transitionState(
  supabase: any,
  runId: string,
  newState: RunState,
  triggeredBy: string,
  userId: string,
  eventData: Record<string, any> = {}
): Promise<{ data: Run | null; error: any }> {
  // Get current run
  const { data: run, error: fetchError } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (fetchError || !run) {
    return { data: null, error: fetchError || new Error('Run not found') };
  }

  // Validate transition
  if (!isValidTransition(run.state, newState)) {
    return { data: null, error: new Error(`Invalid transition from ${run.state} to ${newState}`) };
  }

  // Update run
  const updates: any = {
    previous_state: run.state,
    state: newState,
    state_changed_at: new Date().toISOString(),
  };

  // Set timing fields
  if (newState === 'running' && !run.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (['completed', 'failed', 'cancelled', 'timeout'].includes(newState)) {
    updates.completed_at = new Date().toISOString();
  }
  if (newState === 'paused') {
    updates.paused_at = new Date().toISOString();
  }
  if (newState === 'resuming') {
    updates.resumed_at = new Date().toISOString();
  }
  if (newState === 'retrying') {
    updates.last_retry_at = new Date().toISOString();
    updates.retry_count = run.retry_count + 1;
  }

  const { data: updated, error: updateError } = await supabase
    .from('agent_runs')
    .update(updates)
    .eq('id', runId)
    .select()
    .single();

  if (updateError) {
    return { data: null, error: updateError };
  }

  // Log event
  await supabase.from('agent_run_events').insert({
    run_id: runId,
    event_type: 'state_change',
    from_state: run.state,
    to_state: newState,
    triggered_by: triggeredBy,
    user_id: userId,
    event_data: eventData,
  });

  return { data: updated, error: null };
}
