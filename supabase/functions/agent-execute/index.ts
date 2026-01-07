import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req: Request) => {
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
    
    const taskType = task_type || mode || 'general';
    const routing = TASK_ROUTING[taskType] || TASK_ROUTING.general;
    
    console.log(`[agent-execute] Task type: ${taskType}, Backend: ${routing.backend}`);
    
    // Generate execution plan
    const plan = generateExecutionPlan(taskType, prompt);
    
    // Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: user.id,
        prompt,
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
    
    // Start background execution for Modal tasks
    if (routing.backend === 'modal') {
      // Fire and forget - don't await
      executeModalTask(supabase, task.id, taskType, prompt, memory_context, params, user.id);
    }
    
    // Return FULL task object
    return new Response(JSON.stringify({
      task: {
        id: task.id,
        user_id: task.user_id,
        prompt: task.prompt,
        task_type: task.task_type,
        mode: task.mode,
        status: task.status,
        progress_percentage: task.progress_percentage,
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
    
    // Update task with result
    await supabase
      .from("agent_tasks")
      .update({
        status: "completed",
        progress_percentage: 100,
        result_summary: typeof result === 'string' ? result : JSON.stringify(result),
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    
    // Store output file if present
    if (result.file_url) {
      await supabase.from("agent_outputs").insert({
        task_id: taskId,
        user_id: userId,
        output_type: taskType,
        file_name: result.file_name || `output.${result.file_type || 'file'}`,
        download_url: result.file_url,
      });
    }
    
    // Log completion
    await supabase.from("agent_task_logs").insert({
      task_id: taskId,
      log_type: "success",
      content: `Task completed successfully`,
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
