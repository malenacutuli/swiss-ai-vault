// Manus.im API Execute Edge Function
// Routes agent execution to Manus.im API instead of K8s
//
// API Reference: https://open.manus.im/docs
// Base URL: https://api.manus.ai/v1
// Auth: API_KEY header

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authenticateToken, extractToken } from '../_shared/cross-project-auth.ts';

const MANUS_API_BASE = 'https://api.manus.ai/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManusTaskResponse {
  task_id: string;
  task_title?: string;
  task_url?: string;
  status?: string;
  error?: string;
}

interface ManusTaskStatus {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  model: string;
  metadata?: {
    task_title?: string;
    task_url?: string;
  };
  output?: Array<{
    id: string;
    status: string;
    role: 'user' | 'assistant';
    type: string;
    content?: Array<{
      type: string;
      text?: string;
      url?: string;
    }>;
  }>;
  credit_usage?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get API keys from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const manusApiKey = Deno.env.get('MANUS_API_KEY');

    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ error: 'MANUS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manus-execute] Creating Supabase client');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-supabase-service-role': 'true' },
      },
    });

    // Authenticate user
    const token = extractToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authResult = await authenticateToken(token, supabase);
    if (!authResult.user) {
      console.error('[manus-execute] Auth failed:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.user.id;
    console.log('[manus-execute] Authenticated user:', userId);

    // Parse request body
    const body = await req.json();
    const { action, run_id, task_id, prompt, project_id } = body;

    // Route to appropriate action
    switch (action) {
      case 'create':
        return await handleCreate(supabase, manusApiKey, userId, prompt, project_id);

      case 'status':
        return await handleStatus(supabase, manusApiKey, userId, run_id, task_id);

      case 'cancel':
        return await handleCancel(supabase, manusApiKey, userId, run_id, task_id);

      case 'list':
        return await handleList(supabase, manusApiKey, userId);

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[manus-execute] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Create new task via Manus.im API
async function handleCreate(
  supabase: any,
  manusApiKey: string,
  userId: string,
  prompt: string,
  projectId?: string
) {
  if (!prompt || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[manus-execute] Creating task via Manus.im API');

  // Step 1: Call Manus.im API to create task
  const manusResponse = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'API_KEY': manusApiKey,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!manusResponse.ok) {
    const errorText = await manusResponse.text();
    console.error('[manus-execute] Manus API error:', errorText);
    return new Response(
      JSON.stringify({ error: 'Manus API error', details: errorText }),
      { status: manusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const manusTask: ManusTaskResponse = await manusResponse.json();
  console.log('[manus-execute] Manus task created:', manusTask.task_id);

  // Step 2: Create local agent_runs record linked to Manus task
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      workspace_id: projectId || null,
      prompt,
      status: 'executing',
      state: 'executing',
      // Store Manus task reference in metadata
      metadata: {
        manus_task_id: manusTask.task_id,
        manus_task_url: manusTask.task_url,
        manus_task_title: manusTask.task_title,
        execution_backend: 'manus',
      },
    })
    .select()
    .single();

  if (runError || !run) {
    console.error('[manus-execute] Failed to create local run:', runError);
    return new Response(
      JSON.stringify({ error: 'Failed to create run record', details: runError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Step 3: Store initial user message
  await supabase.from('agent_messages').insert({
    run_id: run.id,
    role: 'user',
    content: prompt,
  });

  // Step 4: Log task creation
  await supabase.from('agent_task_logs').insert({
    run_id: run.id,
    log_type: 'manus_task_created',
    content: `Task created via Manus.im: ${manusTask.task_id}`,
    metadata: {
      manus_task_id: manusTask.task_id,
      manus_task_url: manusTask.task_url,
    },
  });

  return new Response(
    JSON.stringify({
      run_id: run.id,
      taskId: run.id,
      manus_task_id: manusTask.task_id,
      manus_task_url: manusTask.task_url,
      status: 'executing',
      message: 'Task created via Manus.im API',
      task: {
        ...run,
        manus_task_id: manusTask.task_id,
        manus_task_url: manusTask.task_url,
      },
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get task status from Manus.im API
async function handleStatus(
  supabase: any,
  manusApiKey: string,
  userId: string,
  runId?: string,
  manusTaskId?: string
) {
  // Get Manus task ID from local run if not provided
  let taskId = manusTaskId;

  if (runId && !taskId) {
    const { data: run } = await supabase
      .from('agent_runs')
      .select('metadata')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: 'Run not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    taskId = run.metadata?.manus_task_id;
  }

  if (!taskId) {
    return new Response(JSON.stringify({ error: 'task_id or run_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[manus-execute] Getting status for task:', taskId);

  // Call Manus.im API
  const manusResponse = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'API_KEY': manusApiKey,
    },
  });

  if (!manusResponse.ok) {
    const errorText = await manusResponse.text();
    return new Response(
      JSON.stringify({ error: 'Manus API error', details: errorText }),
      { status: manusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const manusStatus: ManusTaskStatus = await manusResponse.json();

  // Update local run status if we have a run_id
  if (runId) {
    const localStatus = mapManusStatus(manusStatus.status);
    const updateData: any = {
      status: localStatus,
      state: localStatus,
      updated_at: new Date().toISOString(),
    };

    if (localStatus === 'completed' || localStatus === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Extract final message from output
    const assistantMessages = manusStatus.output?.filter(o => o.role === 'assistant' && o.content);
    if (assistantMessages && assistantMessages.length > 0) {
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      const textContent = lastMessage.content?.find(c => c.type === 'output_text');
      if (textContent?.text) {
        // Store as assistant message
        const { data: existingMsg } = await supabase
          .from('agent_messages')
          .select('id')
          .eq('run_id', runId)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!existingMsg) {
          await supabase.from('agent_messages').insert({
            run_id: runId,
            role: 'assistant',
            content: textContent.text,
          });
        }
      }
    }

    await supabase.from('agent_runs').update(updateData).eq('id', runId);
  }

  return new Response(
    JSON.stringify({
      run_id: runId,
      manus_task_id: taskId,
      status: manusStatus.status,
      manus_status: manusStatus,
      credit_usage: manusStatus.credit_usage,
      output: manusStatus.output,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Cancel task via Manus.im API
async function handleCancel(
  supabase: any,
  manusApiKey: string,
  userId: string,
  runId?: string,
  manusTaskId?: string
) {
  let taskId = manusTaskId;

  if (runId && !taskId) {
    const { data: run } = await supabase
      .from('agent_runs')
      .select('metadata')
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: 'Run not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    taskId = run.metadata?.manus_task_id;
  }

  if (!taskId) {
    return new Response(JSON.stringify({ error: 'task_id or run_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[manus-execute] Cancelling task:', taskId);

  // Call Manus.im API to cancel
  const manusResponse = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'accept': 'application/json',
      'API_KEY': manusApiKey,
    },
  });

  // Update local run status
  if (runId) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'cancelled',
        state: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }

  return new Response(
    JSON.stringify({
      run_id: runId,
      manus_task_id: taskId,
      status: 'cancelled',
      message: 'Task cancelled',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// List recent tasks from Manus.im API
async function handleList(
  supabase: any,
  manusApiKey: string,
  userId: string
) {
  console.log('[manus-execute] Listing tasks from Manus.im');

  const manusResponse = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'API_KEY': manusApiKey,
    },
  });

  if (!manusResponse.ok) {
    const errorText = await manusResponse.text();
    return new Response(
      JSON.stringify({ error: 'Manus API error', details: errorText }),
      { status: manusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const manusTasks = await manusResponse.json();

  return new Response(
    JSON.stringify({
      tasks: manusTasks.data || manusTasks,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Map Manus status to our internal status
function mapManusStatus(manusStatus: string): string {
  switch (manusStatus?.toLowerCase()) {
    case 'pending':
    case 'queued':
      return 'queued';
    case 'running':
      return 'executing';
    case 'completed':
    case 'done':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'executing';
  }
}
