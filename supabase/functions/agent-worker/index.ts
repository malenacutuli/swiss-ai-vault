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
          // Pass task prompt for format detection
          stepResult = await handleDocumentGeneration(pendingStep, task_id, supabase, user.id, task.prompt);
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

// ============================================
// DOCUMENT GENERATION WITH FORMAT DETECTION
// ============================================

interface SlideContent {
  title: string;
  content: string[];
  notes?: string;
  layout?: string;
}

interface DocSection {
  title: string;
  content: string;
  level?: number;
}

// Detect requested format from task prompt
function detectRequestedFormat(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('presentation') || 
      promptLower.includes('slides') || 
      promptLower.includes('pptx') ||
      promptLower.includes('powerpoint') ||
      promptLower.includes('deck')) {
    return 'pptx';
  }
  
  if (promptLower.includes('document') || 
      promptLower.includes('report') || 
      promptLower.includes('docx') ||
      promptLower.includes('word')) {
    return 'docx';
  }
  
  if (promptLower.includes('spreadsheet') || 
      promptLower.includes('excel') || 
      promptLower.includes('xlsx') ||
      promptLower.includes('table') ||
      promptLower.includes('data')) {
    return 'xlsx';
  }
  
  if (promptLower.includes('pdf')) {
    return 'pdf';
  }
  
  return 'md'; // Default fallback
}

// Main document generation handler
async function handleDocumentGeneration(
  step: any,
  taskId: string,
  supabase: any,
  userId: string,
  taskPrompt: string = ''
): Promise<StepResult> {
  const { type, content, title, slides, sections, rows, document_type } = step.tool_input || {};
  
  // Use explicit type if provided, otherwise detect from prompt
  const requestedFormat = type || document_type || detectRequestedFormat(taskPrompt);
  
  console.log(`[agent-worker] Document generation requested: ${requestedFormat}`);
  console.log(`[agent-worker] Content type:`, { 
    hasSlides: !!slides, 
    hasSections: !!sections, 
    hasRows: !!rows,
    hasContent: !!content 
  });

  // Store reasoning about format decision
  try {
    await supabase.from('agent_reasoning').insert({
      task_id: taskId,
      step_id: step.id,
      agent_type: 'executor',
      reasoning_text: `Detected document format: ${requestedFormat.toUpperCase()}. Task prompt analysis indicates user wants a ${requestedFormat === 'pptx' ? 'presentation' : requestedFormat === 'docx' ? 'document' : requestedFormat === 'xlsx' ? 'spreadsheet' : 'document'}.`,
      confidence_score: 0.9,
      decisions_made: [`Selected format: ${requestedFormat}`, `Title: ${title || 'Untitled'}`],
    });
  } catch (reasoningErr) {
    console.warn('[agent-worker] Failed to store reasoning:', reasoningErr);
  }

  // Try Modal first for PPTX/DOCX/XLSX
  if (['pptx', 'docx', 'xlsx'].includes(requestedFormat)) {
    const modalResult = await tryModalGeneration(requestedFormat, {
      title: title || 'Generated Document',
      content,
      slides: slides || generateSlidesFromContent(content, title),
      sections: sections || generateSectionsFromContent(content, title),
      rows: rows || [],
    }, taskId, userId, supabase);

    if (modalResult.success) {
      return modalResult;
    }

    console.log('[agent-worker] Modal unavailable, returning structured data for client-side generation');
  }

  // Return structured data for client-side generation
  const structuredSlides = slides || generateSlidesFromContent(content, title);
  const structuredSections = sections || generateSectionsFromContent(content, title);
  
  const structuredData = {
    type: requestedFormat,
    title: title || 'Generated Document',
    slides: structuredSlides,
    sections: structuredSections,
    rows: rows || [],
    content: content,
    requires_client_generation: true,
    generated_by: 'fallback',
  };

  // Save as JSON for client processing
  const filename = `${requestedFormat}-data-${Date.now()}.json`;
  const filePath = `${userId}/documents/${filename}`;
  
  const encoder = new TextEncoder();
  const buffer = encoder.encode(JSON.stringify(structuredData, null, 2));

  await supabase.storage
    .from('agent-outputs')
    .upload(filePath, buffer, {
      contentType: 'application/json',
      upsert: true,
    });

  const { data: urlData } = supabase.storage
    .from('agent-outputs')
    .getPublicUrl(filePath);

  // Save output record with target format metadata
  await supabase.from('agent_outputs').insert({
    task_id: taskId,
    user_id: userId,
    output_type: 'json',
    file_name: filename,
    file_path: filePath,
    download_url: urlData.publicUrl,
    storage_bucket: 'agent-outputs',
    mime_type: 'application/json',
    requested_format: requestedFormat,
    actual_format: 'json',
    conversion_status: 'pending_client',
  });

  return {
    success: true,
    output: {
      filename,
      url: urlData.publicUrl,
      format: 'json',
      target_format: requestedFormat,
      requires_client_generation: true,
      data: structuredData,
      slide_count: structuredSlides.length,
      section_count: structuredSections.length,
    },
  };
}

// Try Modal for document generation
async function tryModalGeneration(
  format: string,
  data: any,
  taskId: string,
  userId: string,
  supabase: any
): Promise<StepResult> {
  const modalUrl = getModalEndpoint(format);
  
  if (!modalUrl) {
    return { success: false, error: 'No Modal endpoint configured' };
  }

  try {
    console.log(`[agent-worker] Calling Modal for ${format} generation`);
    
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: format, ...data }),
    });

    if (!response.ok) {
      console.warn(`[agent-worker] Modal returned ${response.status}`);
      return { success: false, error: `Modal returned ${response.status}` };
    }

    const fileBuffer = await response.arrayBuffer();
    const filename = `${format}-${Date.now()}.${format}`;
    const filePath = `${userId}/documents/${filename}`;

    await supabase.storage
      .from('agent-outputs')
      .upload(filePath, new Uint8Array(fileBuffer), {
        contentType: getMimeType(format),
        upsert: true,
      });

    const { data: urlData } = supabase.storage
      .from('agent-outputs')
      .getPublicUrl(filePath);

    await supabase.from('agent_outputs').insert({
      task_id: taskId,
      user_id: userId,
      output_type: format,
      file_name: filename,
      file_path: filePath,
      download_url: urlData.publicUrl,
      storage_bucket: 'agent-outputs',
      mime_type: getMimeType(format),
      requested_format: format,
      actual_format: format,
      conversion_status: 'complete',
    });

    return {
      success: true,
      output: {
        filename,
        url: urlData.publicUrl,
        format,
        generated_by: 'modal',
      },
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Modal generation failed';
    console.error('[agent-worker] Modal generation failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Generate slides from unstructured content
function generateSlidesFromContent(content: any, title: string): SlideContent[] {
  const slides: SlideContent[] = [];
  
  // Title slide
  slides.push({
    title: title || 'Presentation',
    content: ['Generated by SwissVault AI'],
    layout: 'title',
  });

  if (typeof content === 'string') {
    // Split content into logical sections
    const paragraphs = content.split('\n\n').filter((p: string) => p.trim());
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      if (para.startsWith('#')) {
        // Header becomes slide title
        const headerMatch = para.match(/^#+\s*(.+)/);
        if (headerMatch) {
          slides.push({
            title: headerMatch[1],
            content: [],
            layout: 'content',
          });
        }
      } else if (para.startsWith('-') || para.startsWith('*')) {
        // Bullet points
        const bullets = para.split('\n').map((b: string) => b.replace(/^[-*]\s*/, '').trim());
        if (slides.length > 1) {
          slides[slides.length - 1].content.push(...bullets);
        } else {
          slides.push({
            title: 'Key Points',
            content: bullets,
            layout: 'content',
          });
        }
      } else if (para.length > 50) {
        // Regular paragraph becomes a slide
        slides.push({
          title: `Section ${slides.length}`,
          content: [para.substring(0, 200) + (para.length > 200 ? '...' : '')],
          layout: 'content',
        });
      }
    }
  } else if (Array.isArray(content)) {
    content.forEach((item: any, i: number) => {
      if (typeof item === 'string') {
        slides.push({
          title: `Point ${i + 1}`,
          content: [item],
          layout: 'content',
        });
      } else if (item.title) {
        slides.push({
          title: item.title,
          content: Array.isArray(item.content) ? item.content : [item.content || ''],
          layout: item.layout || 'content',
        });
      }
    });
  }

  // Ensure at least 3 slides
  while (slides.length < 3) {
    slides.push({
      title: 'Additional Information',
      content: ['Content to be added'],
      layout: 'content',
    });
  }

  return slides;
}

// Generate sections from content
function generateSectionsFromContent(content: any, title: string): DocSection[] {
  const sections: DocSection[] = [];
  
  sections.push({
    title: title || 'Document',
    content: '',
    level: 1,
  });

  if (typeof content === 'string') {
    const parts = content.split('\n\n');
    parts.forEach((part: string, i: number) => {
      if (part.trim()) {
        sections.push({
          title: `Section ${i + 1}`,
          content: part.trim(),
          level: 2,
        });
      }
    });
  } else if (Array.isArray(content)) {
    content.forEach((item: any, i: number) => {
      if (typeof item === 'string') {
        sections.push({
          title: `Section ${i + 1}`,
          content: item,
          level: 2,
        });
      } else if (item.title) {
        sections.push({
          title: item.title,
          content: Array.isArray(item.content) ? item.content.join('\n\n') : (item.content || ''),
          level: item.level || 2,
        });
      }
    });
  }

  return sections;
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
