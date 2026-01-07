import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════════════
// TASK TYPE ROUTING
// ═══════════════════════════════════════════════════════════════════════════

interface TaskRouting {
  backend: 'modal' | 'inference' | 'gemini-tts' | 'veo';
  model?: string;
  steps: Array<{ name: string; description: string }>;
}

const TASK_ROUTING: Record<string, TaskRouting> = {
  // Modal tasks (document generation)
  slides: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding presentation requirements' },
      { name: 'Planning structure', description: 'Creating slide outline' },
      { name: 'Generating content', description: 'Writing slide content' },
      { name: 'Designing slides', description: 'Applying visual styling' },
      { name: 'Formatting layout', description: 'Arranging elements' },
      { name: 'Compiling PPTX', description: 'Creating downloadable file' },
    ],
  },
  presentation: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding presentation requirements' },
      { name: 'Planning structure', description: 'Creating slide outline' },
      { name: 'Generating content', description: 'Writing slide content' },
      { name: 'Designing slides', description: 'Applying visual styling' },
      { name: 'Formatting layout', description: 'Arranging elements' },
      { name: 'Compiling PPTX', description: 'Creating downloadable file' },
    ],
  },
  document: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding document requirements' },
      { name: 'Planning structure', description: 'Creating document outline' },
      { name: 'Writing content', description: 'Generating text sections' },
      { name: 'Formatting document', description: 'Applying styles' },
      { name: 'Reviewing content', description: 'Quality check' },
      { name: 'Compiling DOCX', description: 'Creating downloadable file' },
    ],
  },
  report: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding document requirements' },
      { name: 'Planning structure', description: 'Creating document outline' },
      { name: 'Writing content', description: 'Generating text sections' },
      { name: 'Formatting document', description: 'Applying styles' },
      { name: 'Reviewing content', description: 'Quality check' },
      { name: 'Compiling DOCX', description: 'Creating downloadable file' },
    ],
  },
  spreadsheet: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding data requirements' },
      { name: 'Structuring data', description: 'Planning columns and rows' },
      { name: 'Generating content', description: 'Creating data entries' },
      { name: 'Adding formulas', description: 'Implementing calculations' },
      { name: 'Formatting cells', description: 'Applying styles' },
      { name: 'Compiling XLSX', description: 'Creating downloadable file' },
    ],
  },
  research: {
    backend: 'modal',
    steps: [
      { name: 'Analyzing request', description: 'Understanding research scope' },
      { name: 'Planning research', description: 'Identifying sources and methods' },
      { name: 'Gathering information', description: 'Collecting data' },
      { name: 'Analyzing findings', description: 'Processing information' },
      { name: 'Synthesizing results', description: 'Creating summary' },
      { name: 'Compiling report', description: 'Formatting final output' },
    ],
  },

  // Inference tasks (text-based AI generation)
  flashcards: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Identifying concepts', description: 'Extracting key topics' },
      { name: 'Creating flashcards', description: 'Generating Q&A pairs' },
      { name: 'Formatting output', description: 'Structuring results' },
    ],
  },
  quiz: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Identifying concepts', description: 'Extracting testable topics' },
      { name: 'Creating questions', description: 'Generating quiz items' },
      { name: 'Formatting output', description: 'Structuring results' },
    ],
  },
  mind_map: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Extracting hierarchy', description: 'Identifying relationships' },
      { name: 'Building structure', description: 'Creating node connections' },
      { name: 'Formatting output', description: 'Generating visual map' },
    ],
  },
  mindmap: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Extracting hierarchy', description: 'Identifying relationships' },
      { name: 'Building structure', description: 'Creating node connections' },
      { name: 'Formatting output', description: 'Generating visual map' },
    ],
  },
  general: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing request', description: 'Understanding requirements' },
      { name: 'Planning response', description: 'Structuring approach' },
      { name: 'Generating content', description: 'Creating response' },
      { name: 'Finalizing output', description: 'Formatting results' },
    ],
  },
  chat: {
    backend: 'inference',
    model: 'gemini-2.5-flash',
    steps: [
      { name: 'Analyzing request', description: 'Understanding requirements' },
      { name: 'Planning response', description: 'Structuring approach' },
      { name: 'Generating content', description: 'Creating response' },
      { name: 'Finalizing output', description: 'Formatting results' },
    ],
  },

  // Audio tasks
  audio_summary: {
    backend: 'gemini-tts',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Creating script', description: 'Writing audio narrative' },
      { name: 'Generating audio', description: 'Synthesizing speech' },
      { name: 'Compiling audio', description: 'Creating MP3 file' },
    ],
  },
  audio: {
    backend: 'gemini-tts',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Creating script', description: 'Writing audio narrative' },
      { name: 'Generating audio', description: 'Synthesizing speech' },
      { name: 'Compiling audio', description: 'Creating MP3 file' },
    ],
  },
  podcast: {
    backend: 'gemini-tts',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Creating dialogue', description: 'Writing conversation script' },
      { name: 'Generating voices', description: 'Synthesizing speakers' },
      { name: 'Mixing audio', description: 'Combining tracks' },
      { name: 'Compiling podcast', description: 'Creating MP3 file' },
    ],
  },

  // Video tasks
  video_summary: {
    backend: 'veo',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Planning video', description: 'Creating storyboard' },
      { name: 'Generating scenes', description: 'Creating video segments' },
      { name: 'Compiling video', description: 'Creating MP4 file' },
    ],
  },
  video: {
    backend: 'veo',
    steps: [
      { name: 'Analyzing content', description: 'Processing source material' },
      { name: 'Planning video', description: 'Creating storyboard' },
      { name: 'Generating scenes', description: 'Creating video segments' },
      { name: 'Compiling video', description: 'Creating MP4 file' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Detect task type from prompt
// ═══════════════════════════════════════════════════════════════════════════

function detectTaskType(prompt: string): string {
  const p = prompt.toLowerCase();
  
  // Document types
  if (p.includes('pitch deck') || p.includes('presentation') || p.includes('slide') || p.includes('pptx')) return 'slides';
  if (p.includes('document') || p.includes('report') || p.includes('docx') || p.includes('word')) return 'document';
  if (p.includes('spreadsheet') || p.includes('excel') || p.includes('xlsx') || p.includes('table')) return 'spreadsheet';
  
  // NotebookLM types
  if (p.includes('flashcard')) return 'flashcards';
  if (p.includes('quiz') || p.includes('test question')) return 'quiz';
  if (p.includes('mind map') || p.includes('mindmap')) return 'mind_map';
  if (p.includes('podcast') || p.includes('audio discussion')) return 'podcast';
  if (p.includes('audio') || p.includes('read aloud') || p.includes('narrate')) return 'audio_summary';
  if (p.includes('video')) return 'video_summary';
  
  // Research
  if (p.includes('research') || p.includes('analyze') || p.includes('investigate')) return 'research';
  
  return 'general';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Extract clean title from prompt
// ═══════════════════════════════════════════════════════════════════════════

function extractTitle(prompt: string): string {
  // Remove document markers to get the actual request
  let title = prompt;
  
  if (prompt.includes('--- User Request ---')) {
    title = prompt.split('--- User Request ---').pop() || prompt;
  } else if (prompt.includes('--- END OF DOCUMENTS ---')) {
    title = prompt.split('--- END OF DOCUMENTS ---').pop() || prompt;
  } else if (prompt.includes('--- END TEXT SOURCES ---')) {
    title = prompt.split('--- END TEXT SOURCES ---').pop() || prompt;
  } else if (prompt.includes('--- END URL SOURCES ---')) {
    title = prompt.split('--- END URL SOURCES ---').pop() || prompt;
  }
  
  // Clean and truncate
  return title.trim().slice(0, 200) || 'Untitled task';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get auth user
    const authHeader = req.headers.get("Authorization");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "") || ""
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body = await req.json();
    const { prompt, task_type: providedType, mode, params, memory_context } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine task type
    const detectedType = detectTaskType(prompt);
    const taskType = (providedType && providedType !== 'general') ? providedType : detectedType;
    
    // Get routing config
    const routing = TASK_ROUTING[taskType] || TASK_ROUTING.general;

    console.log('[agent-execute] Task config:', {
      providedType,
      detectedType,
      finalTaskType: taskType,
      backend: routing.backend,
      stepCount: routing.steps.length,
    });

    // Extract clean title
    const title = extractTitle(prompt);

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE TASK RECORD
    // ═══════════════════════════════════════════════════════════════════════

    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: user.id,
        prompt: prompt,
        task_type: taskType,
        status: "executing",
        progress: 0,
        current_step: 0,
        total_steps: routing.steps.length,
        model_used: routing.model || 'modal',
        params: params || {},
        memory_context: memory_context,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (taskError || !task) {
      console.error('[agent-execute] Failed to create task:', taskError);
      return new Response(
        JSON.stringify({ error: "Failed to create task", details: taskError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[agent-execute] Task created:', task.id);

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE STEP RECORDS
    // ═══════════════════════════════════════════════════════════════════════

    const steps = routing.steps.map((step, index) => ({
      task_id: task.id,
      step_number: index + 1,
      step_type: step.name.toLowerCase().replace(/\s+/g, '_'),
      title: step.name,
      description: step.description,
      status: "pending",
      created_at: new Date().toISOString(),
    }));

    await supabase.from("agent_task_steps").insert(steps);

    // ═══════════════════════════════════════════════════════════════════════
    // START ASYNC EXECUTION (non-blocking)
    // ═══════════════════════════════════════════════════════════════════════

    // Return immediately, execute in background using globalThis.EdgeRuntime
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(
        executeTaskAsync(supabase, task.id, taskType, prompt, memory_context, routing, user.id)
      );
    } else {
      // Fallback: execute inline if EdgeRuntime not available
      executeTaskAsync(supabase, task.id, taskType, prompt, memory_context, routing, user.id)
        .catch(err => console.error('[agent-execute] Background execution error:', err));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RETURN TASK OBJECT (not just taskId)
    // ═══════════════════════════════════════════════════════════════════════

    return new Response(
      JSON.stringify({
        success: true,
        task: {
          id: task.id,
          prompt: title,
          task_type: taskType,
          status: task.status,
          progress: task.progress,
          total_steps: task.total_steps,
          created_at: task.created_at,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error('[agent-execute] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC EXECUTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function executeTaskAsync(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  routing: TaskRouting,
  userId: string
) {
  try {
    // Update started_at
    await supabase
      .from("agent_tasks")
      .update({ started_at: new Date().toISOString() })
      .eq("id", taskId);

    // Route to correct backend
    switch (routing.backend) {
      case 'modal':
        await executeModalTask(supabase, taskId, taskType, prompt, memoryContext, userId);
        break;
      case 'inference':
        await executeInferenceTask(supabase, taskId, taskType, prompt, memoryContext, routing.model || 'gemini-2.5-flash', userId);
        break;
      case 'gemini-tts':
        await executeAudioTask(supabase, taskId, taskType, prompt, memoryContext, userId);
        break;
      case 'veo':
        await executeVideoTask(supabase, taskId, taskType, prompt, userId);
        break;
      default:
        await executeInferenceTask(supabase, taskId, taskType, prompt, memoryContext, 'gemini-2.5-flash', userId);
    }

  } catch (error: any) {
    console.error(`[executeTaskAsync] Task ${taskId} failed:`, error);
    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error_message: error.message,
      })
      .eq("id", taskId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL BACKEND (PPTX, DOCX, XLSX)
// ═══════════════════════════════════════════════════════════════════════════

async function executeModalTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  userId: string
) {
  const MODAL_ENDPOINT = Deno.env.get("MODAL_AGENTS_ENDPOINT") || 
    "https://axessible-labs--swissvault-agents-execute-task-endpoint.modal.run";

  // Update steps progressively
  const updateStep = async (stepNum: number, status: string) => {
    const updates: any = { status };
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    
    await supabase
      .from("agent_task_steps")
      .update(updates)
      .eq("task_id", taskId)
      .eq("step_number", stepNum);
    
    // Update task progress
    const progress = Math.round((stepNum / 6) * 100);
    await supabase
      .from("agent_tasks")
      .update({ progress, current_step: stepNum })
      .eq("id", taskId);
  };

  // Step 1-2: Analyzing and planning
  await updateStep(1, "running");
  await new Promise(r => setTimeout(r, 500));
  await updateStep(1, "completed");
  
  await updateStep(2, "running");
  await new Promise(r => setTimeout(r, 500));
  await updateStep(2, "completed");

  // Step 3-4: Call Modal
  await updateStep(3, "running");

  const modalResponse = await fetch(MODAL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_type: taskType,
      prompt: prompt,
      memory_context: memoryContext,
      user_id: userId,
      task_id: taskId,
    }),
  });

  if (!modalResponse.ok) {
    throw new Error(`Modal returned ${modalResponse.status}`);
  }

  await updateStep(3, "completed");
  await updateStep(4, "running");

  const result = await modalResponse.json();
  console.log('[Modal] Response keys:', Object.keys(result));

  await updateStep(4, "completed");

  // Step 5-6: Process output
  await updateStep(5, "running");

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLE ALL OUTPUT FORMATS
  // ═══════════════════════════════════════════════════════════════════════

  let downloadUrl: string | null = null;
  let fileName = `output_${taskId.slice(0, 8)}`;
  let fileType = 'unknown';
  let fileSize = 0;

  // Direct URL (preferred)
  if (result.file_url) {
    downloadUrl = result.file_url;
    fileName = result.file_name || fileName;
    fileType = result.file_type || 'file';
  }
  // Base64 PPTX
  else if (result.pptx_base64) {
    const decoded = Uint8Array.from(atob(result.pptx_base64), c => c.charCodeAt(0));
    fileSize = decoded.length;
    fileName = `${fileName}.pptx`;
    fileType = 'pptx';
    downloadUrl = await uploadToStorage(supabase, userId, taskId, fileName, decoded, 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  }
  // Base64 DOCX
  else if (result.docx_base64) {
    const decoded = Uint8Array.from(atob(result.docx_base64), c => c.charCodeAt(0));
    fileSize = decoded.length;
    fileName = `${fileName}.docx`;
    fileType = 'docx';
    downloadUrl = await uploadToStorage(supabase, userId, taskId, fileName, decoded,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  // Base64 XLSX
  else if (result.xlsx_base64) {
    const decoded = Uint8Array.from(atob(result.xlsx_base64), c => c.charCodeAt(0));
    fileSize = decoded.length;
    fileName = `${fileName}.xlsx`;
    fileType = 'xlsx';
    downloadUrl = await uploadToStorage(supabase, userId, taskId, fileName, decoded,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  // Text/Markdown content
  else if (result.content || result.markdown || result.text) {
    const content = result.content || result.markdown || result.text;
    const encoded = new TextEncoder().encode(content);
    fileSize = encoded.length;
    fileName = `${fileName}.md`;
    fileType = 'markdown';
    downloadUrl = await uploadToStorage(supabase, userId, taskId, fileName, encoded, 'text/markdown');
  }

  await updateStep(5, "completed");
  await updateStep(6, "running");

  // Save output record
  if (downloadUrl) {
    await supabase.from("agent_outputs").insert({
      task_id: taskId,
      user_id: userId,
      output_type: fileType,
      file_name: fileName,
      download_url: downloadUrl,
      file_size_bytes: fileSize,
      created_at: new Date().toISOString(),
    });
    console.log('[Modal] Output saved:', fileName);
  }

  await updateStep(6, "completed");

  // Mark task complete
  await supabase
    .from("agent_tasks")
    .update({
      status: "completed",
      progress: 100,
      current_step: 6,
      result: {
        output_url: downloadUrl,
        output_type: fileType,
        file_name: fileName,
        summary: result.summary || null,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

// ═══════════════════════════════════════════════════════════════════════════
// INFERENCE BACKEND (Flashcards, Quiz, Mind Map, General)
// ═══════════════════════════════════════════════════════════════════════════

async function executeInferenceTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  model: string,
  userId: string
) {
  const totalSteps = 4;
  
  const updateStep = async (stepNum: number, status: string) => {
    const updates: any = { status };
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    
    await supabase
      .from("agent_task_steps")
      .update(updates)
      .eq("task_id", taskId)
      .eq("step_number", stepNum);
    
    const progress = Math.round((stepNum / totalSteps) * 100);
    await supabase
      .from("agent_tasks")
      .update({ progress, current_step: stepNum })
      .eq("id", taskId);
  };

  // Step 1: Analyzing
  await updateStep(1, "running");
  await new Promise(r => setTimeout(r, 300));
  await updateStep(1, "completed");

  // Step 2: Planning
  await updateStep(2, "running");
  await new Promise(r => setTimeout(r, 300));
  await updateStep(2, "completed");

  // Step 3: Generate with ghost-inference
  await updateStep(3, "running");

  // Build system prompt based on task type
  const systemPrompts: Record<string, string> = {
    flashcards: `You are an expert educator. Create flashcards from the provided content. Each flashcard should have a clear question on the front and a concise answer on the back. Format as JSON array: [{"front": "...", "back": "..."}, ...]`,
    quiz: `You are an expert educator. Create a quiz from the provided content. Include multiple choice and short answer questions. Format as JSON: {"questions": [{"type": "multiple_choice", "question": "...", "options": [...], "correct": "..."}, ...]}`,
    mind_map: `You are an expert at organizing information. Create a hierarchical mind map from the provided content. Format as JSON: {"central": "main topic", "branches": [{"topic": "...", "children": [...]}]}`,
    mindmap: `You are an expert at organizing information. Create a hierarchical mind map from the provided content. Format as JSON: {"central": "main topic", "branches": [{"topic": "...", "children": [...]}]}`,
    general: `You are a helpful AI assistant. Respond to the user's request based on any provided context.`,
    chat: `You are a helpful AI assistant. Respond to the user's request based on any provided context.`,
  };

  const systemPrompt = systemPrompts[taskType] || systemPrompts.general;

  // Check if content was provided
  const hasDocuments = prompt.includes('--- UPLOADED DOCUMENTS ---') || 
                       prompt.includes('--- URL SOURCES ---') ||
                       prompt.includes('--- PASTED TEXT SOURCES ---') ||
                       prompt.includes('--- Document');

  const fullSystemPrompt = hasDocuments
    ? `${systemPrompt}\n\nIMPORTANT: The user has provided document content below. Use ONLY this content to generate your response. Do NOT claim you cannot access the documents - their text content is included in the prompt.`
    : systemPrompt;

  // Call ghost-inference
  const inferenceResponse = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-inference`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        task_type: taskType,
      }),
    }
  );

  const inferenceResult = await inferenceResponse.json();
  await updateStep(3, "completed");

  // Step 4: Format output
  await updateStep(4, "running");

  const responseContent = inferenceResult.choices?.[0]?.message?.content || 
                          inferenceResult.content ||
                          "No response generated";

  // Save as markdown file
  const fileName = `${taskType}_${taskId.slice(0, 8)}.md`;
  const encoded = new TextEncoder().encode(responseContent);
  const downloadUrl = await uploadToStorage(supabase, userId, taskId, fileName, encoded, 'text/markdown');

  // Create output record
  await supabase.from("agent_outputs").insert({
    task_id: taskId,
    user_id: userId,
    output_type: 'markdown',
    file_name: fileName,
    download_url: downloadUrl,
    file_size_bytes: encoded.length,
    created_at: new Date().toISOString(),
  });

  await updateStep(4, "completed");

  // Mark complete
  await supabase
    .from("agent_tasks")
    .update({
      status: "completed",
      progress: 100,
      current_step: totalSteps,
      result: {
        content: responseContent,
        output_url: downloadUrl,
        output_type: 'markdown',
      },
      result_summary: responseContent.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO BACKEND (Podcast, Audio Summary)
// ═══════════════════════════════════════════════════════════════════════════

async function executeAudioTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  userId: string
) {
  // For now, generate script and mark as needing audio generation
  // Full TTS implementation requires audio-briefing edge function
  
  const steps = taskType === 'podcast' ? 5 : 4;
  
  const updateStep = async (stepNum: number, status: string) => {
    const updates: any = { status };
    if (status === "running") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    
    await supabase
      .from("agent_task_steps")
      .update(updates)
      .eq("task_id", taskId)
      .eq("step_number", stepNum);
    
    const progress = Math.round((stepNum / steps) * 100);
    await supabase
      .from("agent_tasks")
      .update({ progress, current_step: stepNum })
      .eq("id", taskId);
  };

  // Generate script first
  await updateStep(1, "running");
  await updateStep(1, "completed");
  await updateStep(2, "running");

  const scriptPrompt = taskType === 'podcast'
    ? `Create a conversational podcast script with two hosts discussing the following content. Include natural dialogue, questions, and insights.`
    : `Create a narration script that summarizes the following content in a clear, engaging way suitable for audio.`;

  const inferenceResponse = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghost-inference`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: scriptPrompt },
          { role: "user", content: prompt },
        ],
        model: 'gemini-2.5-flash',
      }),
    }
  );

  const scriptResult = await inferenceResponse.json();
  const script = scriptResult.choices?.[0]?.message?.content || "Script generation failed";

  await updateStep(2, "completed");

  // Try to call audio-briefing for TTS
  await updateStep(3, "running");

  let audioUrl: string | null = null;
  try {
    const audioResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/audio-briefing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          text: script,
          voice: taskType === 'podcast' ? 'dialogue' : 'narrator',
          task_id: taskId,
          user_id: userId,
        }),
      }
    );

    if (audioResponse.ok) {
      const audioResult = await audioResponse.json();
      audioUrl = audioResult.audio_url;
    }
  } catch (audioErr) {
    console.warn('[Audio] TTS generation failed, saving script only:', audioErr);
  }

  await updateStep(3, "completed");

  // Step 4: Save output
  await updateStep(4, "running");

  // Always save script as markdown
  const scriptFileName = `${taskType}_script_${taskId.slice(0, 8)}.md`;
  const scriptEncoded = new TextEncoder().encode(script);
  const scriptUrl = await uploadToStorage(supabase, userId, taskId, scriptFileName, scriptEncoded, 'text/markdown');

  await supabase.from("agent_outputs").insert({
    task_id: taskId,
    user_id: userId,
    output_type: 'markdown',
    file_name: scriptFileName,
    download_url: scriptUrl,
    file_size_bytes: scriptEncoded.length,
    created_at: new Date().toISOString(),
  });

  // If audio was generated, save that too
  if (audioUrl) {
    await supabase.from("agent_outputs").insert({
      task_id: taskId,
      user_id: userId,
      output_type: 'audio',
      file_name: `${taskType}_${taskId.slice(0, 8)}.mp3`,
      download_url: audioUrl,
      created_at: new Date().toISOString(),
    });
  }

  await updateStep(4, "completed");

  if (steps === 5) {
    await updateStep(5, "running");
    await updateStep(5, "completed");
  }

  // Mark complete
  await supabase
    .from("agent_tasks")
    .update({
      status: "completed",
      progress: 100,
      result: {
        script: script,
        script_url: scriptUrl,
        audio_url: audioUrl,
        output_type: audioUrl ? 'audio' : 'script',
      },
      result_summary: script.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO BACKEND (Placeholder - Veo not yet available)
// ═══════════════════════════════════════════════════════════════════════════

async function executeVideoTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  userId: string
) {
  // Video generation not yet implemented
  // Mark as failed with clear message
  
  await supabase
    .from("agent_tasks")
    .update({
      status: "failed",
      error_message: "Video generation is not yet available. This feature is coming soon with Veo 3.1 integration.",
    })
    .eq("id", taskId);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Upload to Storage
// ═══════════════════════════════════════════════════════════════════════════

async function uploadToStorage(
  supabase: any,
  userId: string,
  taskId: string,
  fileName: string,
  data: Uint8Array,
  contentType: string
): Promise<string> {
  const path = `${userId}/${taskId}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from("agent-outputs")
    .upload(path, data, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[uploadToStorage] Error:', uploadError);
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from("agent-outputs")
    .getPublicUrl(path);

  return urlData.publicUrl;
}
