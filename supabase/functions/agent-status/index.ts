import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get task_id from query params OR body
    const url = new URL(req.url);
    let taskId = url.searchParams.get('task_id');
    
    // Also check request body for task_id
    if (!taskId && req.method === 'POST') {
      try {
        const body = await req.json();
        taskId = body.task_id || body.taskId;
      } catch {
        // Ignore parse errors
      }
    }

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'task_id parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch task with steps
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select(`
        *,
        steps:agent_task_steps(
          id,
          step_number,
          step_type,
          description,
          status,
          tool_name,
          tool_output,
          error_message,
          started_at,
          completed_at,
          duration_ms
        )
      `)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch outputs if completed
    let outputs: any[] = [];
    if (task.status === 'completed') {
      const { data: outputData } = await supabase
        .from('agent_outputs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      
      outputs = (outputData || []).map((o: any) => ({
        id: o.id,
        type: o.output_type,
        file_name: o.file_name,
        file_size: o.file_size_bytes,
        mime_type: o.mime_type,
        download_url: o.download_url || o.file_path,
        preview_url: o.preview_url,
        thumbnail_url: o.thumbnail_url,
        created_at: o.created_at,
      }));
    }

    // Sort steps by step_number
    const sortedSteps = (task.steps || [])
      .sort((a: any, b: any) => a.step_number - b.step_number)
      .map((step: any) => ({
        step_number: step.step_number,
        description: step.description,
        status: step.status,
        tool_name: step.tool_name,
        duration_ms: step.duration_ms,
        error_message: step.error_message,
      }));

    // Calculate actual progress
    const completedSteps = sortedSteps.filter((s: any) => s.status === 'completed').length;
    const actualProgress = task.total_steps > 0 
      ? Math.round((completedSteps / task.total_steps) * 100) 
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        task: {
          id: task.id,
          status: task.status,
          progress_percentage: actualProgress,
          current_step: completedSteps,
          total_steps: task.total_steps,
          plan_summary: task.plan_summary,
          result_summary: task.result_summary,
          error_message: task.error_message,
          duration_ms: task.duration_ms,
          tokens_used: task.tokens_used,
          credits_used: parseFloat(task.credits_used || '0'),
          privacy_tier: task.privacy_tier,
          started_at: task.started_at,
          completed_at: task.completed_at,
          created_at: task.created_at,
        },
        steps: sortedSteps,
        outputs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Agent status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
