// Agent Execute V2 Edge Function
// Forwards requests to the Agent API backend for full execution with E2B sandbox
// This is the bridge between Supabase auth and the Python Agent API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authenticateToken, extractToken } from '../_shared/cross-project-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent API backend URL - should be set in Supabase secrets
const AGENT_API_URL = Deno.env.get('AGENT_API_URL') || 'https://api.swissbrain.ai';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
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
      return new Response(JSON.stringify({ error: authResult.error || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.user.id;
    const userEmail = authResult.user.email;
    console.log('[agent-execute-v2] Authenticated user:', userId);

    // Parse request body
    const body = await req.json();
    const { action, run_id, prompt, task_type, mode, params, memory_context } = body;

    // Check credits
    const { data: balance } = await supabase
      .from('credit_balances')
      .select('available_credits')
      .eq('user_id', userId)
      .single();

    if (!balance) {
      // Auto-create credit balance for new users
      await supabase.from('credit_balances').insert({
        user_id: userId,
        available_credits: 10000,
        total_credits: 10000,
        used_credits: 0,
      });
    } else if (balance.available_credits <= 0) {
      return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward to Agent API backend
    const agentApiEndpoint = `${AGENT_API_URL}/agent/execute`;
    
    console.log('[agent-execute-v2] Forwarding to Agent API:', agentApiEndpoint);

    const agentResponse = await fetch(agentApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        'X-User-Email': userEmail || '',
        'X-Supabase-Token': token,
        'Authorization': `Bearer ${Deno.env.get('AGENT_API_KEY') || ''}`,
      },
      body: JSON.stringify({
        action: action || 'create',
        run_id,
        prompt,
        task_type: task_type || 'general',
        mode: mode || task_type || 'general',
        params: params || {},
        memory_context,
        user_id: userId,
      }),
    });

    // Handle Agent API response
    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('[agent-execute-v2] Agent API error:', agentResponse.status, errorText);
      
      // Fallback: Create task in Supabase directly if Agent API is down
      if (agentResponse.status >= 500 || agentResponse.status === 0) {
        console.log('[agent-execute-v2] Agent API unavailable, creating task locally');
        return await createLocalTask(supabase, userId, prompt, task_type);
      }
      
      return new Response(JSON.stringify({ 
        error: 'Agent API error', 
        details: errorText,
        status: agentResponse.status 
      }), {
        status: agentResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentData = await agentResponse.json();
    console.log('[agent-execute-v2] Agent API response:', JSON.stringify(agentData).slice(0, 200));

    // Sync task to Supabase for frontend polling
    if (agentData.run_id || agentData.task?.id) {
      const taskId = agentData.run_id || agentData.task?.id;
      
      // Upsert to agent_runs table
      await supabase.from('agent_runs').upsert({
        id: taskId,
        user_id: userId,
        prompt,
        status: agentData.task?.status || 'executing',
        state: agentData.task?.state || 'executing',
        external_run_id: taskId,
      }, { onConflict: 'id' });
    }

    return new Response(JSON.stringify(agentData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[agent-execute-v2] Error:', error);
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

// Fallback: Create task locally when Agent API is unavailable
async function createLocalTask(
  supabase: any,
  userId: string,
  prompt: string,
  taskType?: string
) {
  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({
      user_id: userId,
      prompt,
      status: 'pending',
      state: 'pending',
      task_type: taskType || 'general',
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to create task', details: error }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Store user message
  await supabase.from('agent_messages').insert({
    run_id: run.id,
    role: 'user',
    content: prompt,
  });

  // Add to job queue for background processing
  await supabase.from('agent_job_queue').insert({
    run_id: run.id,
    user_id: userId,
    job_type: 'execute',
    status: 'pending',
    payload: { prompt, task_type: taskType },
  });

  return new Response(
    JSON.stringify({
      run_id: run.id,
      taskId: run.id,
      task: run,
      status: 'pending',
      message: 'Task queued for processing (Agent API unavailable)',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
