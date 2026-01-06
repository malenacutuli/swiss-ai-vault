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

// Modal endpoint - check multiple possible env var names
const getModalEndpoint = (type: string = 'default'): string | null => {
  const endpoints: Record<string, string[]> = {
    default: ['MODAL_DOCUMENT_GEN_ENDPOINT', 'MODAL_DOCUMENT_GEN_URL', 'MODAL_ENDPOINT'],
    pptx: ['MODAL_PPTX_ENDPOINT', 'MODAL_DOCUMENT_GEN_ENDPOINT', 'MODAL_ENDPOINT'],
    docx: ['MODAL_DOCX_ENDPOINT', 'MODAL_DOCUMENT_GEN_ENDPOINT', 'MODAL_ENDPOINT'],
    xlsx: ['MODAL_XLSX_ENDPOINT', 'MODAL_DOCUMENT_GEN_ENDPOINT', 'MODAL_ENDPOINT'],
  };
  const varsToCheck = endpoints[type] || endpoints.default;
  
  for (const varName of varsToCheck) {
    const value = Deno.env.get(varName);
    if (value) {
      console.log(`[agent-worker] Using Modal endpoint from ${varName}`);
      return value;
    }
  }
  
  console.warn('[agent-worker] No Modal endpoint configured');
  return null;
};

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
          stepResult = await handleDocumentGeneration(pendingStep, task_id, supabase, user.id);
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

// Document generation handler with Modal fallback
async function handleDocumentGeneration(
  step: any,
  taskId: string,
  supabase: any,
  userId: string
): Promise<StepResult> {
  const { type, content, title, slides, document_type } = step.tool_input || {};
  const docType = type || document_type || 'md';
  
  console.log(`[agent-worker] Generating document: ${docType}`);

  // Try Modal first for PPTX/DOCX/XLSX
  if (['pptx', 'docx', 'xlsx'].includes(docType)) {
    const modalUrl = getModalEndpoint(docType);
    
    if (modalUrl) {
      try {
        const modalResponse = await fetch(modalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: docType,
            title: title || 'Document',
            content,
            slides,
          }),
        });

        if (modalResponse.ok) {
          const fileBuffer = await modalResponse.arrayBuffer();
          const filename = `${docType}-${Date.now()}.${docType}`;
          
          // Upload to storage
          const filePath = `${userId}/documents/${filename}`;
          await supabase.storage
            .from('agent-outputs')
            .upload(filePath, new Uint8Array(fileBuffer), {
              contentType: getMimeType(docType),
              upsert: true,
            });

          const { data: urlData } = supabase.storage
            .from('agent-outputs')
            .getPublicUrl(filePath);

          // Save output record
          await supabase.from('agent_outputs').insert({
            task_id: taskId,
            user_id: userId,
            output_type: docType,
            file_name: filename,
            file_path: filePath,
            download_url: urlData.publicUrl,
            storage_bucket: 'agent-outputs',
            mime_type: getMimeType(docType),
          });

          return {
            success: true,
            output: {
              filename,
              url: urlData.publicUrl,
              generated_by: 'modal',
            },
          };
        }
      } catch (modalError) {
        console.warn(`[agent-worker] Modal ${docType} generation failed:`, modalError);
      }
    }

    // Fallback: Return structured data for client-side generation
    console.log(`[agent-worker] Using client-side fallback for ${docType}`);
    
    const fallbackData = {
      type: docType,
      title: title || 'Generated Document',
      slides: slides || [],
      content: content || '',
      generated_by: 'fallback',
      requires_client_generation: true,
    };

    // Save as JSON for client to process
    const filename = `${docType}-data-${Date.now()}.json`;
    const filePath = `${userId}/documents/${filename}`;
    
    const jsonContent = JSON.stringify(fallbackData, null, 2);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(jsonContent);

    await supabase.storage
      .from('agent-outputs')
      .upload(filePath, buffer, {
        contentType: 'application/json',
        upsert: true,
      });

    const { data: urlData } = supabase.storage
      .from('agent-outputs')
      .getPublicUrl(filePath);

    // Save output record with flag for client processing
    await supabase.from('agent_outputs').insert({
      task_id: taskId,
      user_id: userId,
      output_type: 'json',
      file_name: filename,
      file_path: filePath,
      download_url: urlData.publicUrl,
      storage_bucket: 'agent-outputs',
      mime_type: 'application/json',
    });

    return {
      success: true,
      output: {
        filename,
        url: urlData.publicUrl,
        generated_by: 'fallback',
        requires_client_generation: true,
        data: fallbackData,
      },
    };
  }

  // For markdown and other simple types, generate directly
  const markdownContent = typeof content === 'string' 
    ? content 
    : formatAsMarkdown(title, content);
    
  const filename = `document-${Date.now()}.md`;
  const filePath = `${userId}/documents/${filename}`;
  
  const encoder = new TextEncoder();
  const buffer = encoder.encode(markdownContent);

  await supabase.storage
    .from('agent-outputs')
    .upload(filePath, buffer, {
      contentType: 'text/markdown',
      upsert: true,
    });

  const { data: urlData } = supabase.storage
    .from('agent-outputs')
    .getPublicUrl(filePath);

  await supabase.from('agent_outputs').insert({
    task_id: taskId,
    user_id: userId,
    output_type: 'md',
    file_name: filename,
    file_path: filePath,
    download_url: urlData.publicUrl,
    storage_bucket: 'agent-outputs',
    mime_type: 'text/markdown',
  });

  return {
    success: true,
    output: {
      filename,
      url: urlData.publicUrl,
      generated_by: 'direct',
      content_preview: markdownContent.substring(0, 500),
    },
  };
}

function getMimeType(type: string): string {
  const mimeTypes: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    md: 'text/markdown',
    json: 'application/json',
  };
  return mimeTypes[type] || 'application/octet-stream';
}

function formatAsMarkdown(title: string, content: any): string {
  let md = `# ${title || 'Document'}\n\n`;
  
  if (Array.isArray(content)) {
    content.forEach(item => {
      if (typeof item === 'string') {
        md += `${item}\n\n`;
      } else if (item.title && item.content) {
        md += `## ${item.title}\n\n`;
        if (Array.isArray(item.content)) {
          item.content.forEach((point: string) => {
            md += `- ${point}\n`;
          });
        } else {
          md += `${item.content}\n`;
        }
        md += '\n';
      }
    });
  } else if (typeof content === 'string') {
    md += content;
  }
  
  return md;
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
