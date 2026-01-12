// supabase/functions/agent-execute/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { Run, RunConfig, DEFAULT_RUN_CONFIG } from "../_shared/types/run.ts";
import { transitionRun } from "../_shared/state-machine/executor.ts";
import { executeToolCall } from "../_shared/tool-router/executor.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

interface ExecuteRequest {
  action: 'create' | 'start' | 'continue' | 'cancel' | 'respond';
  task_id?: string;
  prompt?: string;
  config?: Partial<RunConfig>;
  user_response?: string;
}

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const request: ExecuteRequest = await req.json();

    switch (request.action) {
      case 'create':
        return await handleCreate(supabase, user.id, request);
      case 'start':
        return await handleStart(supabase, user.id, request.task_id!);
      case 'continue':
        return await handleContinue(supabase, request.task_id!);
      case 'cancel':
        return await handleCancel(supabase, user.id, request.task_id!);
      case 'respond':
        return await handleUserResponse(supabase, request.task_id!, request.user_response!);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

  } catch (error) {
    console.error("Agent execute error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function handleCreate(
  supabase: any,
  userId: string,
  request: ExecuteRequest
): Promise<Response> {
  if (!request.prompt) {
    throw new Error("Prompt is required");
  }

  const config: RunConfig = {
    ...DEFAULT_RUN_CONFIG,
    ...request.config
  };

  // Create task record
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: userId,
      prompt: request.prompt,
      config,
      status: 'pending',
      step_count: 0,
      credits_reserved: 0,
      credits_consumed: 0,
      retry_count: 0,
      max_retries: 3,
      version: 1
    })
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    task_id: task.id,
    status: 'pending'
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleStart(
  supabase: any,
  userId: string,
  taskId: string
): Promise<Response> {
  // 1. Reserve credits
  const { data: reservationId, error: reserveError } = await supabase
    .rpc('reserve_credits', {
      p_tenant_id: userId,
      p_run_id: taskId,
      p_amount: 10,  // Initial reservation
      p_max_amount: 100,
      p_expires_in_seconds: 3600
    });

  if (reserveError) {
    return new Response(JSON.stringify({
      error: "Insufficient credits",
      details: reserveError.message
    }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 2. Transition to queued
  const { success, error } = await transitionRun(supabase, taskId, 'queued', {
    credits_reserved: 10,
    reservation_id: reservationId
  });

  if (!success) {
    // Release reservation on failure
    await supabase.rpc('release_reservation', { p_reservation_id: reservationId });
    throw new Error(error);
  }

  // 3. Generate plan
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  await transitionRun(supabase, taskId, 'planning');

  const plan = await generatePlan(task.prompt, task.config);

  // 4. Save plan and transition to executing
  await supabase
    .from('agent_tasks')
    .update({ plan })
    .eq('id', taskId);

  await transitionRun(supabase, taskId, 'executing', { plan });

  return new Response(JSON.stringify({
    success: true,
    task_id: taskId,
    status: 'executing',
    plan
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleContinue(
  supabase: any,
  taskId: string
): Promise<Response> {
  // This is called by the worker to execute next steps
  // Implemented in agent-worker function
  return new Response(JSON.stringify({
    success: true,
    message: "Use agent-worker for step execution"
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleCancel(
  supabase: any,
  userId: string,
  taskId: string
): Promise<Response> {
  // Verify ownership
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('user_id, reservation_id')
    .eq('id', taskId)
    .single();

  if (task?.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Not authorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Release credits
  if (task.reservation_id) {
    await supabase.rpc('release_reservation', {
      p_reservation_id: task.reservation_id,
      p_reason: 'user_cancelled'
    });
  }

  // Transition to cancelled
  await transitionRun(supabase, taskId, 'cancelled');

  return new Response(JSON.stringify({
    success: true,
    status: 'cancelled'
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleUserResponse(
  supabase: any,
  taskId: string,
  response: string
): Promise<Response> {
  // Save user response
  await supabase
    .from('agent_task_steps')
    .insert({
      task_id: taskId,
      type: 'user_response',
      content: { response },
      status: 'completed'
    });

  // Transition back to executing
  await transitionRun(supabase, taskId, 'executing');

  return new Response(JSON.stringify({
    success: true,
    status: 'executing'
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function generatePlan(prompt: string, config: RunConfig): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an AI task planner. Create an execution plan for: "${prompt}"

Return a JSON plan with this structure:
{
  "goal": "Brief goal statement",
  "phases": [
    {
      "id": 1,
      "title": "Phase title",
      "description": "What this phase accomplishes",
      "capabilities": {
        "web_browsing": false,
        "code_execution": false,
        "file_operations": false,
        "document_generation": false,
        "web_search": false,
        "image_generation": false
      },
      "estimated_steps": 3
    }
  ]
}

Requirements:
- Minimum 2 phases, maximum 15
- Last phase must be "Delivery"
- Be specific and actionable

Return ONLY valid JSON.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000
        }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse plan");
  }

  const plan = JSON.parse(jsonMatch[0]);

  return {
    id: crypto.randomUUID(),
    version: 1,
    ...plan,
    current_phase_id: 1,
    created_at: Date.now(),
    metadata: {
      attempt: 1,
      model: config.model
    }
  };
}
