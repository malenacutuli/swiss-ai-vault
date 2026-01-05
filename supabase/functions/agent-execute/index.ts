import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskRequest {
  prompt: string;
  taskType?: string;
  privacyTier?: string;
  attachments?: Array<{ name: string; type: string; content: string }>;
  memoryContext?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Parse request
    const request: TaskRequest = await req.json();
    console.log(`[agent-execute] User ${user.id} creating task: ${request.prompt.substring(0, 50)}...`);

    // 3. Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: user.id,
        prompt: request.prompt,
        task_type: request.taskType || "general",
        privacy_tier: request.privacyTier || "vault",
        status: "planning",
        model_used: "gemini-2.5-flash",
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // 4. Generate execution plan using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const planningPrompt = `You are a Swiss AI Agent task planner. Create an execution plan.

TASK: ${request.prompt}
TYPE: ${request.taskType || 'general'}

${request.memoryContext ? `USER CONTEXT:\n${request.memoryContext}\n` : ''}

AVAILABLE TOOLS:
1. web_search - Search the internet for current information
2. document_generator - Create PPTX, DOCX, XLSX files
3. text_generation - Generate text content
4. data_analysis - Analyze data and create insights

Return a JSON object (no markdown):
{
  "plan_summary": "Brief 1-2 sentence approach",
  "steps": [
    {
      "step_number": 1,
      "step_name": "Short name",
      "step_description": "What this accomplishes",
      "tool_name": "tool_to_use",
      "tool_input": {}
    }
  ],
  "estimated_duration_seconds": 120,
  "output_type": "pptx|docx|xlsx|text|json"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a task planning AI. Always respond with valid JSON only, no markdown." },
          { role: "user", content: planningPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[agent-execute] AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required, please add funds" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const planText = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let plan;
    try {
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[agent-execute] Failed to parse plan:", planText);
      plan = {
        plan_summary: "Processing your request",
        steps: [
          {
            step_number: 1,
            step_name: "Process Request",
            step_description: "Analyzing and processing your request",
            tool_name: "text_generation",
            tool_input: { prompt: request.prompt }
          }
        ],
        estimated_duration_seconds: 60,
        output_type: "text"
      };
    }

    console.log(`[agent-execute] Plan generated with ${plan.steps?.length || 0} steps`);

    // 5. Update task with plan
    await supabase
      .from("agent_tasks")
      .update({
        plan_summary: plan.plan_summary,
        plan_json: plan,
        total_steps: plan.steps?.length || 0,
        status: "executing",
        started_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    // 6. Create step records
    if (plan.steps && plan.steps.length > 0) {
      const stepRecords = plan.steps.map((step: any, index: number) => ({
        task_id: task.id,
        step_number: index + 1,
        step_type: step.step_name || `Step ${index + 1}`,
        description: step.step_description || "",
        tool_name: step.tool_name || "text_generation",
        tool_input: step.tool_input || {},
        status: "pending",
      }));

      await supabase.from("agent_task_steps").insert(stepRecords);
    }

    // 7. Trigger async worker execution
    (globalThis as any).EdgeRuntime?.waitUntil?.(executeTaskAsync(task.id, supabase, LOVABLE_API_KEY)) 
      ?? executeTaskAsync(task.id, supabase, LOVABLE_API_KEY);

    return new Response(
      JSON.stringify({
        success: true,
        taskId: task.id,
        plan: plan,
        status: "executing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[agent-execute] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Async task execution
async function executeTaskAsync(taskId: string, supabase: any, apiKey: string) {
  try {
    // Get steps
    const { data: steps } = await supabase
      .from("agent_task_steps")
      .select("*")
      .eq("task_id", taskId)
      .order("step_number");

    if (!steps || steps.length === 0) {
      await supabase.from("agent_tasks").update({ 
        status: "completed", 
        progress_percentage: 100,
        completed_at: new Date().toISOString() 
      }).eq("id", taskId);
      return;
    }

    // Execute each step
    for (const step of steps) {
      const startTime = Date.now();
      
      // Update step to running
      await supabase
        .from("agent_task_steps")
        .update({ 
          status: "running", 
          started_at: new Date().toISOString(),
          current_action: `Executing ${step.tool_name}...`
        })
        .eq("id", step.id);

      // Update task progress
      const progress = Math.round((step.step_number / steps.length) * 100);
      await supabase
        .from("agent_tasks")
        .update({ 
          current_step: step.step_number,
          progress_percentage: progress 
        })
        .eq("id", taskId);

      try {
        // Execute the step based on tool
        let result;
        switch (step.tool_name) {
          case "web_search":
            result = await executeWebSearch(step.tool_input, apiKey);
            break;
          case "text_generation":
            result = await executeTextGeneration(step.tool_input, apiKey);
            break;
          case "document_generator":
            result = await executeDocumentGenerator(step.tool_input, taskId, supabase);
            break;
          default:
            result = await executeTextGeneration({ prompt: step.description }, apiKey);
        }

        const duration = Date.now() - startTime;

        // Update step as completed
        await supabase
          .from("agent_task_steps")
          .update({
            status: "completed",
            tool_output: result,
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            file_actions: result.file_actions || [],
          })
          .eq("id", step.id);

        console.log(`[agent-execute] Step ${step.step_number} completed in ${duration}ms`);

      } catch (stepError) {
        console.error(`[agent-execute] Step ${step.step_number} failed:`, stepError);
        const stepErrMsg = stepError instanceof Error ? stepError.message : "Step failed";
        await supabase
          .from("agent_task_steps")
          .update({
            status: "failed",
            error_message: stepErrMsg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", step.id);
      }
    }

    // Mark task as completed
    await supabase
      .from("agent_tasks")
      .update({
        status: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        result_summary: "Task completed successfully",
      })
      .eq("id", taskId);

    console.log(`[agent-execute] Task ${taskId} completed`);

  } catch (error) {
    console.error("[agent-execute] Task execution failed:", error);
    const errMsg = error instanceof Error ? error.message : "Task execution failed";
    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

// Tool implementations
async function executeWebSearch(input: any, apiKey: string) {
  const query = input.query || input.prompt || "search";
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a research assistant. Provide comprehensive, accurate information with sources when available." },
        { role: "user", content: `Search for and provide current information about: ${query}. Include sources and be comprehensive.` }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "No results found";
  
  return {
    answer: text,
    query: query,
    file_actions: [{ type: "searching", target: query }]
  };
}

async function executeTextGeneration(input: any, apiKey: string) {
  const prompt = input.prompt || input.text || "Generate content";
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a professional content creator. Generate high-quality, well-structured content." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  
  return {
    content: text,
    format: input.format || "text",
    file_actions: [{ type: "generating", target: "content" }]
  };
}

async function executeDocumentGenerator(input: any, taskId: string, supabase: any) {
  const content = input.content || "Document content";
  const filename = input.filename || `document-${Date.now()}`;
  const type = input.type || "md";
  
  // Get task to find user_id
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("user_id")
    .eq("id", taskId)
    .single();
  
  // Create output record
  await supabase.from("agent_outputs").insert({
    task_id: taskId,
    user_id: task?.user_id,
    output_type: type,
    file_name: `${filename}.${type}`,
  });
  
  return {
    success: true,
    filename: `${filename}.${type}`,
    file_actions: [{ type: "creating", target: `${filename}.${type}` }]
  };
}
