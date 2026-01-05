import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get task_id from query params
    const url = new URL(req.url);
    const taskId = url.searchParams.get('task_id');

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'task_id query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query agent_tasks (RLS ensures user can only see their own tasks)
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.error('Task query error:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query agent_task_steps
    const { data: steps, error: stepsError } = await supabase
      .from('agent_task_steps')
      .select('*')
      .eq('task_id', taskId)
      .order('step_number', { ascending: true });

    if (stepsError) {
      console.error('Steps query error:', stepsError);
    }

    // Query agent_outputs if task is completed
    let outputs: any[] = [];
    if (task.status === 'completed') {
      const { data: outputData, error: outputError } = await supabase
        .from('agent_outputs')
        .select('*')
        .eq('task_id', taskId);

      if (outputError) {
        console.error('Outputs query error:', outputError);
      } else {
        outputs = outputData || [];
      }
    }

    // Calculate duration if started
    let durationMs = task.duration_ms;
    if (!durationMs && task.started_at) {
      const startTime = new Date(task.started_at).getTime();
      const endTime = task.completed_at 
        ? new Date(task.completed_at).getTime() 
        : Date.now();
      durationMs = endTime - startTime;
    }

    // Format response
    const response = {
      success: true,
      task: {
        id: task.id,
        status: task.status,
        progress_percentage: task.progress_percentage || 0,
        current_step: task.current_step || 0,
        total_steps: task.total_steps || 0,
        plan_summary: task.plan_summary,
        result_summary: task.result_summary,
        error_message: task.error_message,
        duration_ms: durationMs,
        tokens_used: task.tokens_used || 0,
        credits_used: task.credits_used || 0,
        started_at: task.started_at,
        completed_at: task.completed_at
      },
      steps: (steps || []).map((step: any) => ({
        step_number: step.step_number,
        description: step.description,
        status: step.status,
        tool_name: step.tool_name,
        duration_ms: step.duration_ms,
        error_message: step.error_message
      })),
      outputs: outputs.map((output: any) => ({
        id: output.id,
        type: output.output_type,
        file_name: output.file_name,
        file_size: output.file_size_bytes,
        download_url: output.download_url,
        preview_url: output.preview_url
      }))
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
