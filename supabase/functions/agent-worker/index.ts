import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerRequest {
  task_id: string;
}

interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { task_id } = await req.json() as WorkerRequest;

    if (!task_id) {
      return new Response(
        JSON.stringify({ error: 'task_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', task_id)
      .eq('user_id', user.id)
      .single();

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if task is in valid state
    if (task.status === 'completed' || task.status === 'failed') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          task_status: task.status,
          message: 'Task already finished' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get next pending step
    const { data: steps, error: stepsError } = await supabase
      .from('agent_task_steps')
      .select('*')
      .eq('task_id', task_id)
      .order('step_number', { ascending: true });

    if (stepsError) {
      throw new Error('Failed to fetch steps');
    }

    const pendingStep = steps?.find((s: any) => s.status === 'pending');

    if (!pendingStep) {
      // All steps completed - mark task as completed
      const duration = task.started_at 
        ? Date.now() - new Date(task.started_at).getTime() 
        : 0;

      await supabase
        .from('agent_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          progress_percentage: 100,
        })
        .eq('id', task_id);

      // Get outputs
      const { data: outputs } = await supabase
        .from('agent_outputs')
        .select('*')
        .eq('task_id', task_id);

      return new Response(
        JSON.stringify({
          success: true,
          task_status: 'completed',
          step_executed: null,
          next_step: null,
          outputs: (outputs || []).map((o: any) => ({
            id: o.id,
            type: o.output_type,
            file_name: o.file_name,
            download_url: o.download_url,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark step as executing
    const stepStartTime = Date.now();
    const fileActions: Array<{ type: string; target: string }> = [];
    
    // Helper to track file actions and update step
    const trackAction = async (type: string, target: string) => {
      fileActions.push({ type, target });
      await supabase
        .from('agent_task_steps')
        .update({
          current_action: `${type} ${target}`,
          file_actions: fileActions,
        })
        .eq('id', pendingStep.id);
    };
    
    await supabase
      .from('agent_task_steps')
      .update({ 
        status: 'executing', 
        started_at: new Date().toISOString(),
        current_action: 'Initializing...',
        file_actions: [],
      })
      .eq('id', pendingStep.id);

    // Execute the step based on tool
    let stepResult: StepResult;
    const toolName = pendingStep.tool_name || '';
    const toolInput = pendingStep.tool_input || {};

    console.log(`[Worker] Executing step ${pendingStep.step_number}: ${toolName}`);

    try {
      switch (toolName) {
        case 'web_search':
          await trackAction('searching', toolInput.query || 'web');
          stepResult = await executeWebSearch(supabaseUrl, authHeader, toolInput);
          break;
        case 'image_generator':
          await trackAction('generating', toolInput.filename || 'image.png');
          stepResult = await executeImageGen(supabaseUrl, authHeader, toolInput);
          break;
        case 'document_generator':
          const docName = toolInput.filename || toolInput.title || 'document';
          await trackAction('creating', docName);
          stepResult = await executeDocumentGen(toolInput);
          break;
        case 'memory_search':
          await trackAction('reading', 'memory');
          stepResult = await executeMemorySearch(supabaseUrl, authHeader, toolInput);
          break;
        case 'code_executor':
          await trackAction('executing', toolInput.command || 'code');
          stepResult = { success: true, output: { message: 'Code execution placeholder' } };
          break;
        case 'file_reader':
          await trackAction('reading', toolInput.filename || 'file');
          stepResult = { success: true, output: { message: 'File read placeholder' } };
          break;
        default:
          await trackAction('processing', toolName || 'task');
          stepResult = {
            success: true,
            output: { message: `Tool ${toolName} executed (placeholder)` },
          };
      }
    } catch (toolError: unknown) {
      const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed';
      stepResult = { success: false, error: errorMessage };
    }

    const stepDuration = Date.now() - stepStartTime;

    // Update step with final result and all file actions
    await supabase
      .from('agent_task_steps')
      .update({
        status: stepResult.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: stepDuration,
        tool_output: stepResult.output || null,
        error_message: stepResult.error || null,
        file_actions: fileActions,
        current_action: null,
      })
      .eq('id', pendingStep.id);

    // Calculate progress
    const completedCount = steps!.filter((s: any) => 
      s.status === 'completed' || s.id === pendingStep.id
    ).length;
    const progressPct = Math.round((completedCount / (task.total_steps || 1)) * 100);

    // Update task progress
    await supabase
      .from('agent_tasks')
      .update({
        current_step: pendingStep.step_number,
        progress_percentage: progressPct,
      })
      .eq('id', task_id);

    // Find next step
    const nextStep = steps?.find((s: any) => 
      s.step_number > pendingStep.step_number && s.status === 'pending'
    );

    return new Response(
      JSON.stringify({
        success: true,
        task_status: nextStep ? 'executing' : 'completing',
        step_executed: {
          step_number: pendingStep.step_number,
          tool_name: toolName,
          status: stepResult.success ? 'completed' : 'failed',
          duration_ms: stepDuration,
          error: stepResult.error || null,
        },
        next_step: nextStep?.step_number || null,
        outputs: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Worker] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Tool execution functions
async function executeWebSearch(
  supabaseUrl: string, 
  authHeader: string, 
  input: any
): Promise<StepResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ghost-web-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        query: input.query || input.search_query,
        max_results: input.max_results || 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Web search failed: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, output: data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Web search error';
    return { success: false, error: errorMessage };
  }
}

async function executeImageGen(
  supabaseUrl: string,
  authHeader: string,
  input: any
): Promise<StepResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ghost-image-gen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        model: input.model || 'flux-schnell',
        width: input.width || 1024,
        height: input.height || 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Image gen failed: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, output: data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Image gen error';
    return { success: false, error: errorMessage };
  }
}

async function executeDocumentGen(input: any): Promise<StepResult> {
  // Document generation via Modal endpoint
  const modalUrl = Deno.env.get('MODAL_DOCUMENT_GEN_URL');
  
  if (!modalUrl) {
    return { 
      success: true, 
      output: { message: 'Document generation placeholder - Modal not configured' } 
    };
  }

  try {
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: input.document_type || 'pptx',
        content: input.content,
        title: input.title,
      }),
    });

    if (!response.ok) {
      throw new Error(`Document gen failed: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, output: data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Document gen error';
    return { success: false, error: errorMessage };
  }
}

async function executeMemorySearch(
  supabaseUrl: string,
  authHeader: string,
  input: any
): Promise<StepResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/search-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        query: input.query,
        limit: input.limit || 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Memory search failed: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, output: data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Memory search error';
    return { success: false, error: errorMessage };
  }
}
