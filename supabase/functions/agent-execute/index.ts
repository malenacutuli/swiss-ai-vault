import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// TASK TYPE TO BACKEND ROUTING
// ============================================

const TASK_ROUTING: Record<string, { backend: string; model?: string }> = {
  // Modal Tasks (Swiss Hosted)
  slides: { backend: 'modal', model: 'swissvault-agents' },
  presentation: { backend: 'modal', model: 'swissvault-agents' },
  document: { backend: 'modal', model: 'swissvault-agents' },
  spreadsheet: { backend: 'modal', model: 'swissvault-agents' },
  research: { backend: 'modal', model: 'swissvault-agents' },
  podcast: { backend: 'modal', model: 'swissvault-agents' },
  
  // Google-Required Tasks
  audio_summary: { backend: 'gemini-tts' },
  audio_overview: { backend: 'gemini-tts' },
  video_summary: { backend: 'veo' },
  video: { backend: 'veo' },
  deep_research: { backend: 'gemini-research' },
  grounded_search: { backend: 'gemini-grounded' },
  mind_map: { backend: 'gemini', model: 'gemini-2.5-flash' },
  flashcards: { backend: 'gemini', model: 'gemini-2.5-flash' },
  quiz: { backend: 'gemini', model: 'gemini-2.5-flash' },
  
  // General Chat (Gemini Default)
  chat: { backend: 'inference', model: 'gemini-2.5-flash' },
  general: { backend: 'inference', model: 'gemini-2.5-flash' },
};

// Modal endpoint
const MODAL_ENDPOINT = "https://axessible-labs--swissvault-agents-execute-task-endpoint.modal.run";

// ============================================
// SMART TASK TYPE DETECTION
// ============================================

function detectTaskType(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  // Presentation/Slides detection
  if (
    promptLower.includes('presentation') ||
    promptLower.includes('pitch deck') ||
    promptLower.includes('slide') ||
    promptLower.includes('pptx') ||
    promptLower.includes('powerpoint')
  ) {
    return 'slides';
  }
  
  // Document detection
  if (
    promptLower.includes('document') ||
    promptLower.includes('report') ||
    promptLower.includes('docx') ||
    promptLower.includes('word doc')
  ) {
    return 'document';
  }
  
  // Spreadsheet detection
  if (
    promptLower.includes('spreadsheet') ||
    promptLower.includes('excel') ||
    promptLower.includes('xlsx') ||
    promptLower.includes('table') ||
    promptLower.includes('data analysis')
  ) {
    return 'spreadsheet';
  }
  
  // Research detection
  if (
    promptLower.includes('research') ||
    promptLower.includes('analyze') ||
    promptLower.includes('deep dive')
  ) {
    return 'research';
  }
  
  // Podcast detection
  if (
    promptLower.includes('podcast') ||
    promptLower.includes('audio summary')
  ) {
    return 'podcast';
  }
  
  // Default to general
  return 'general';
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// ============================================
// EXECUTION PLAN GENERATOR
// ============================================

function generateExecutionPlan(taskType: string, _prompt: string): { steps: any[]; totalSteps: number } {
  const baseSteps = [
    { step: 1, title: "Analyzing request", status: "pending" },
    { step: 2, title: "Planning execution", status: "pending" },
  ];
  
  const taskSpecificSteps: Record<string, any[]> = {
    slides: [
      { step: 3, title: "Generating content outline", status: "pending" },
      { step: 4, title: "Creating slide layouts", status: "pending" },
      { step: 5, title: "Adding visual elements", status: "pending" },
      { step: 6, title: "Compiling PPTX file", status: "pending" },
    ],
    presentation: [
      { step: 3, title: "Generating content outline", status: "pending" },
      { step: 4, title: "Creating slide layouts", status: "pending" },
      { step: 5, title: "Adding visual elements", status: "pending" },
      { step: 6, title: "Compiling PPTX file", status: "pending" },
    ],
    document: [
      { step: 3, title: "Structuring document", status: "pending" },
      { step: 4, title: "Writing content sections", status: "pending" },
      { step: 5, title: "Formatting and styling", status: "pending" },
      { step: 6, title: "Compiling DOCX file", status: "pending" },
    ],
    research: [
      { step: 3, title: "Searching knowledge base", status: "pending" },
      { step: 4, title: "Analyzing sources", status: "pending" },
      { step: 5, title: "Synthesizing findings", status: "pending" },
      { step: 6, title: "Generating report", status: "pending" },
    ],
    audio_summary: [
      { step: 3, title: "Processing source content", status: "pending" },
      { step: 4, title: "Generating script", status: "pending" },
      { step: 5, title: "Converting to audio", status: "pending" },
    ],
    quiz: [
      { step: 3, title: "Analyzing source material", status: "pending" },
      { step: 4, title: "Generating questions", status: "pending" },
      { step: 5, title: "Creating answer options", status: "pending" },
    ],
    flashcards: [
      { step: 3, title: "Extracting key concepts", status: "pending" },
      { step: 4, title: "Creating question-answer pairs", status: "pending" },
      { step: 5, title: "Formatting flashcards", status: "pending" },
    ],
    mind_map: [
      { step: 3, title: "Identifying main topics", status: "pending" },
      { step: 4, title: "Creating hierarchical structure", status: "pending" },
      { step: 5, title: "Generating visual map", status: "pending" },
    ],
  };
  
  const steps = [...baseSteps, ...(taskSpecificSteps[taskType] || [
    { step: 3, title: "Processing request", status: "pending" },
    { step: 4, title: "Generating output", status: "pending" },
  ])];
  
  return { steps, totalSteps: steps.length };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }
    
    // Parse request
    const { prompt, task_type, mode, params, memory_context } = await req.json();
    
    if (!prompt) {
      throw new Error("Missing prompt");
    }
    
    // Smart task type detection: use provided type if specific, otherwise detect from prompt
    const providedType = task_type || mode || 'general';
    const detectedType = detectTaskType(prompt);
    const taskType = providedType !== 'general' ? providedType : detectedType;
    const routing = TASK_ROUTING[taskType] || TASK_ROUTING.general;
    
    console.log(`[agent-execute] Provided: ${providedType}, Detected: ${detectedType}, Using: ${taskType}, Backend: ${routing.backend}`);
    
    // Generate execution plan
    const plan = generateExecutionPlan(taskType, prompt);
    
    // Extract clean title from prompt (removes document content)
    const extractCleanTitle = (fullPrompt: string): string => {
      // If prompt contains document markers, extract only the user request part
      if (fullPrompt.includes('--- User Request ---')) {
        const parts = fullPrompt.split('--- User Request ---');
        return parts[parts.length - 1].trim().slice(0, 200);
      }
      if (fullPrompt.includes('--- END OF DOCUMENTS ---')) {
        const parts = fullPrompt.split('--- END OF DOCUMENTS ---');
        return parts[parts.length - 1].trim().slice(0, 200);
      }
      if (fullPrompt.includes('--- UPLOADED DOCUMENTS ---')) {
        const parts = fullPrompt.split('--- UPLOADED DOCUMENTS ---');
        // Get text before the documents section
        const beforeDocs = parts[0].trim();
        if (beforeDocs.length > 10) return beforeDocs.slice(0, 200);
        // Or get text after all document content
        if (parts.length > 1) {
          const afterDocs = parts[parts.length - 1].split('===').pop()?.trim() || '';
          if (afterDocs.length > 10) return afterDocs.slice(0, 200);
        }
      }
      // No markers, use the prompt directly (limited)
      return fullPrompt.trim().slice(0, 200);
    };
    
    const cleanTitle = extractCleanTitle(prompt);
    
    // Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: user.id,
        prompt,
        plan_summary: cleanTitle, // Store clean title for display
        task_type: taskType,
        mode: mode || taskType,
        status: "executing",
        progress_percentage: 10,
        current_step: 1,
        total_steps: plan.totalSteps,
        model_used: routing.model || 'gemini-2.5-flash',
      })
      .select()
      .single();
    
    if (taskError) {
      console.error("[agent-execute] Task creation error:", taskError);
      throw new Error(`Failed to create task: ${taskError.message}`);
    }
    
    console.log(`[agent-execute] Created task: ${task.id}`);
    
    // Insert steps
    const stepsToInsert = plan.steps.map(step => ({
      task_id: task.id,
      step_number: step.step,
      step_type: step.title,
      description: step.title,
      status: step.status,
    }));
    
    await supabase.from("agent_task_steps").insert(stepsToInsert);
    
    // Log task start
    await supabase.from("agent_task_logs").insert({
      task_id: task.id,
      log_type: "info",
      content: `Task started: ${taskType}`,
      sequence_number: 1,
    });
    
    // Start background execution based on backend type
    if (routing.backend === 'modal') {
      // Fire and forget - don't await
      executeModalTask(supabase, task.id, taskType, prompt, memory_context, params, user.id);
    }

    if (routing.backend === 'inference' || routing.backend === 'gemini') {
      // Fire and forget - don't await
      executeInferenceTask(
        supabase,
        task.id,
        taskType,
        prompt,
        memory_context,
        routing.model || 'gemini-2.5-flash',
        user.id,
      );
    }
    
    // Return FULL task object matching frontend interface
    return new Response(JSON.stringify({
      task: {
        id: task.id,
        user_id: task.user_id,
        prompt: task.prompt,
        task_type: task.task_type,
        mode: task.mode,
        status: task.status,
        progress: task.progress_percentage || task.progress || 10,
        current_step: task.current_step,
        total_steps: task.total_steps,
        model_used: task.model_used,
        created_at: task.created_at,
      },
      plan: {
        steps: plan.steps,
        total_steps: plan.totalSteps,
      },
      success: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[agent-execute] Error: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message,
      code: "EXECUTION_ERROR",
      success: false,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================
// BACKGROUND MODAL EXECUTION
// ============================================

async function executeModalTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  params: any,
  userId: string
) {
  try {
    // Update to executing
    await supabase
      .from("agent_tasks")
      .update({ status: "executing", progress_percentage: 20 })
      .eq("id", taskId);
    
    // Log start
    await supabase.from("agent_task_logs").insert({
      task_id: taskId,
      log_type: "info",
      content: `Starting ${taskType} task execution via Modal`,
      sequence_number: 2,
    });
    
    // Call Modal endpoint
    const response = await fetch(MODAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: taskType,
        prompt,
        memory_context: memoryContext,
        ...params,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Modal error: ${await response.text()}`);
    }
    
    const result = await response.json();
    
    // Log what Modal actually returns
    console.log('[Modal] Response keys:', Object.keys(result));
    
    // Handle different output formats
    let downloadUrl: string | null = null;
    let fileName: string = 'output';
    let fileType: string = 'unknown';
    let fileSize: number = 0;

    // EXISTING: Direct URL
    if (result.file_url) {
      downloadUrl = result.file_url;
      fileName = result.file_name || 'output';
      fileType = result.file_type || 'file';
    }
    // Base64 DOCX
    else if (result.docx_base64) {
      const decoded = Uint8Array.from(atob(result.docx_base64), c => c.charCodeAt(0));
      fileSize = decoded.length;
      fileName = `${taskType}_${taskId.slice(0, 8)}.docx`;
      fileType = 'docx';
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('agent-outputs')
        .upload(`${userId}/${taskId}/${fileName}`, decoded, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        });
      
      if (uploadError) {
        console.error('[Modal] Storage upload error:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('agent-outputs')
        .getPublicUrl(`${userId}/${taskId}/${fileName}`);
      
      downloadUrl = urlData.publicUrl;
    }
    // Base64 PPTX
    else if (result.pptx_base64) {
      const decoded = Uint8Array.from(atob(result.pptx_base64), c => c.charCodeAt(0));
      fileSize = decoded.length;
      fileName = `${taskType}_${taskId.slice(0, 8)}.pptx`;
      fileType = 'pptx';
      
      const { error: uploadError } = await supabase.storage
        .from('agent-outputs')
        .upload(`${userId}/${taskId}/${fileName}`, decoded, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('agent-outputs')
        .getPublicUrl(`${userId}/${taskId}/${fileName}`);
      
      downloadUrl = urlData.publicUrl;
    }
    // Base64 XLSX
    else if (result.xlsx_base64) {
      const decoded = Uint8Array.from(atob(result.xlsx_base64), c => c.charCodeAt(0));
      fileSize = decoded.length;
      fileName = `${taskType}_${taskId.slice(0, 8)}.xlsx`;
      fileType = 'xlsx';
      
      const { error: uploadError } = await supabase.storage
        .from('agent-outputs')
        .upload(`${userId}/${taskId}/${fileName}`, decoded, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('agent-outputs')
        .getPublicUrl(`${userId}/${taskId}/${fileName}`);
      
      downloadUrl = urlData.publicUrl;
    }
    // Text/Markdown content
    else if (result.content || result.markdown || result.text) {
      const content = result.content || result.markdown || result.text;
      const textEncoder = new TextEncoder();
      const encoded = textEncoder.encode(content);
      fileSize = encoded.length;
      fileName = `${taskType}_${taskId.slice(0, 8)}.md`;
      fileType = 'markdown';
      
      const { error: uploadError } = await supabase.storage
        .from('agent-outputs')
        .upload(`${userId}/${taskId}/${fileName}`, encoded, {
          contentType: 'text/markdown',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('agent-outputs')
        .getPublicUrl(`${userId}/${taskId}/${fileName}`);
      
      downloadUrl = urlData.publicUrl;
    }

    // Create output record if we have a URL
    if (downloadUrl) {
      await supabase.from('agent_outputs').insert({
        task_id: taskId,
        user_id: userId,
        output_type: fileType,
        file_name: fileName,
        download_url: downloadUrl,
        file_size_bytes: fileSize,
        created_at: new Date().toISOString(),
      });
      
      console.log('[Modal] Output saved:', fileName, downloadUrl);
    } else {
      console.warn('[Modal] No recognizable output format in response:', Object.keys(result));
    }

    // Update task as completed with result summary
    await supabase.from('agent_tasks').update({
      status: 'completed',
      progress_percentage: 100,
      result: {
        output_url: downloadUrl,
        output_type: fileType,
        file_name: fileName,
      },
      result_summary: downloadUrl ? `Generated ${fileType}: ${fileName}` : JSON.stringify(result),
      completed_at: new Date().toISOString(),
    }).eq('id', taskId);
    
    // Log completion
    await supabase.from("agent_task_logs").insert({
      task_id: taskId,
      log_type: "success",
      content: downloadUrl ? `Task completed - Output: ${fileName}` : `Task completed`,
      sequence_number: 99,
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[Modal execution error] ${error.message}`);
    
    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    
    await supabase.from("agent_task_logs").insert({
      task_id: taskId,
      log_type: "error",
      content: error.message,
      sequence_number: 99,
    });
  }
}

// ============================================
// INFERENCE BACKEND EXECUTION
// ============================================

async function executeInferenceTask(
  supabase: any,
  taskId: string,
  taskType: string,
  prompt: string,
  memoryContext: any,
  model: string,
  _userId: string,
) {
  const startedMs = Date.now();
  let sequence = 2;

  const log = async (log_type: string, content: string) => {
    sequence += 1;
    await supabase.from("agent_task_logs").insert({
      task_id: taskId,
      log_type,
      content,
      sequence_number: sequence,
    });
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    await supabase
      .from("agent_tasks")
      .update({
        started_at: new Date().toISOString(),
        status: "executing",
        progress_percentage: 15,
        current_step: 1,
        model_used: model,
      })
      .eq("id", taskId);

    await log("info", `Starting inference task with model: ${model}`);

    // STEP 1: Analyzing request
    await updateStep(supabase, taskId, 1, "running");
    await log("command", `$ analyze_request --prompt \"${prompt.substring(0, 50)}...\"`);
    await sleep(400);
    await updateStep(supabase, taskId, 1, "completed");
    await supabase
      .from("agent_tasks")
      .update({ progress_percentage: 25, current_step: 1 })
      .eq("id", taskId);

    // STEP 2: Planning execution
    await updateStep(supabase, taskId, 2, "running");
    await log("command", `$ plan_execution --type \"${taskType}\" --model \"${model}\"`);
    await sleep(400);
    await updateStep(supabase, taskId, 2, "completed");
    await supabase
      .from("agent_tasks")
      .update({ progress_percentage: 40, current_step: 2 })
      .eq("id", taskId);

    // STEP 3: Processing request - Call ghost-inference
    await updateStep(supabase, taskId, 3, "running");
    await log("command", `$ ghost-inference --model ${model}`);
    await supabase
      .from("agent_tasks")
      .update({ progress_percentage: 55, current_step: 3 })
      .eq("id", taskId);

    // Check if prompt contains uploaded documents
    const hasDocuments = prompt.includes('--- UPLOADED DOCUMENTS ---') || 
                         prompt.includes('Document') || 
                         prompt.includes('sources:');
    
    const systemMessageBase = hasDocuments
      ? `You are a helpful AI assistant for SwissVault. The user has provided document content in their request. 
IMPORTANT: You have FULL ACCESS to all document content provided below. Analyze it thoroughly.
Do NOT say you cannot access files - the content IS provided in the prompt.
Use the ACTUAL content from the documents to fulfill the user's request.`
      : "You are a helpful AI assistant for SwissVault, a Swiss-hosted privacy-first AI platform. Provide clear, comprehensive, and well-formatted responses.";

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemMessageBase },
      { role: "user", content: prompt },
    ];

    if (memoryContext && Array.isArray(memoryContext) && memoryContext.length > 0) {
      const contextText = memoryContext
        .map((m: any) => m?.chunk || m?.content || "")
        .filter(Boolean)
        .join("\n\n");

      if (contextText) {
        messages[0].content += `\n\nRelevant context from user's memory:\n${contextText}`;
      }
    }

    const { data: inferenceResult, error: inferenceError } = await supabase.functions.invoke(
      "ghost-inference",
      {
        body: {
          messages,
          model,
          task_type: taskType,
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
    );

    if (inferenceError) {
      throw new Error(`Inference failed: ${inferenceError.message}`);
    }

    await log("output", `> Model: ${inferenceResult?.model || model}`);

    await updateStep(supabase, taskId, 3, "completed");
    await supabase
      .from("agent_tasks")
      .update({ progress_percentage: 75, current_step: 3 })
      .eq("id", taskId);

    // STEP 4: Generating output
    await updateStep(supabase, taskId, 4, "running");
    await log("command", `$ generate_output --format text`);

    const responseContent =
      inferenceResult?.choices?.[0]?.message?.content ||
      inferenceResult?.content ||
      inferenceResult?.text ||
      inferenceResult?.result ||
      "No response generated";

    await log("success", `✓ Response generated (${String(responseContent).length} characters)`);

    await updateStep(supabase, taskId, 4, "completed");

    await supabase
      .from("agent_tasks")
      .update({
        status: "completed",
        progress_percentage: 100,
        current_step: 4,
        result: {
          content: responseContent,
          model: inferenceResult?.model || model,
          provider: inferenceResult?.provider || "google",
          usage: inferenceResult?.usage || null,
        },
        result_summary: String(responseContent),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
      })
      .eq("id", taskId);

    await log("success", "Task completed successfully");
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[executeInferenceTask] Error: ${error.message}`);

    try {
      await log("error", `Error: ${error.message}`);
    } catch (_) {
      // ignore logging failures
    }

    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error_message: error.message,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
      })
      .eq("id", taskId);
  }
}

// Helper function to update step status
async function updateStep(
  supabase: any,
  taskId: string,
  stepNumber: number,
  status: string,
) {
  const updates: any = { status };

  if (status === "running") {
    updates.started_at = new Date().toISOString();
  } else if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from("agent_task_steps")
    .update(updates)
    .eq("task_id", taskId)
    .eq("step_number", stepNumber);
}

