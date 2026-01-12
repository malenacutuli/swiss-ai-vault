// supabase/functions/agent-worker/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Run, RunStatus } from "../_shared/types/run.ts";
import { Step } from "../_shared/types/step.ts";
import { transitionRun, claimNextTask } from "../_shared/state-machine/executor.ts";
import { executeToolCall, ToolExecutionContext } from "../_shared/tool-router/executor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, run_id } = await req.json();

    switch (action) {
      case "poll":
        return await handlePoll(supabase);
      case "execute_step":
        return await handleExecuteStep(supabase, run_id);
      case "process_run":
        return await handleProcessRun(supabase, run_id);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Worker error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handlePoll(supabase: any): Promise<Response> {
  const task = await claimNextTask(supabase, WORKER_ID);

  if (!task) {
    return new Response(
      JSON.stringify({ message: "No tasks available" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Start processing the claimed task
  const result = await processRun(supabase, task);

  return new Response(
    JSON.stringify({ task_id: task.id, result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleProcessRun(supabase: any, runId: string): Promise<Response> {
  const { data: run, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", runId)
    .single();

  if (error || !run) {
    return new Response(
      JSON.stringify({ error: "Run not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = await processRun(supabase, run);

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processRun(supabase: any, run: Run): Promise<{ success: boolean; error?: string }> {
  const plan = run.plan;

  if (!plan || !plan.phases) {
    await transitionRun(supabase, run.id, "failed", { error: "No plan found" });
    return { success: false, error: "No plan found" };
  }

  try {
    // Find current phase
    const currentPhase = plan.phases.find((p: any) => p.status === "pending" || p.status === "in_progress");

    if (!currentPhase) {
      // All phases complete
      await transitionRun(supabase, run.id, "completed");
      await finalizeCredits(supabase, run.id, "completed");
      return { success: true };
    }

    // Mark phase as in_progress
    if (currentPhase.status === "pending") {
      currentPhase.status = "executing";
      await updatePlan(supabase, run.id, plan);
    }

    // Execute steps in phase - iterate over capability keys
    const capabilityKeys = Object.keys(currentPhase.capabilities || {}).filter(
      key => currentPhase.capabilities[key as keyof typeof currentPhase.capabilities]
    );
    
    for (const capability of capabilityKeys) {
      const stepResult = await executeStep(supabase, run, currentPhase, capability);

      if (!stepResult.success) {
        if (stepResult.needsUserInput) {
          await transitionRun(supabase, run.id, "waiting_user", {
            waiting_for: stepResult.waitingFor
          });
          return { success: true };
        }

        // Step failed
        await transitionRun(supabase, run.id, "failed", { error: stepResult.error });
        await finalizeCredits(supabase, run.id, "failed");
        return { success: false, error: stepResult.error };
      }

      // Consume credits for step
      await consumeStepCredits(supabase, run.id, stepResult.creditsUsed || 1);
    }

    // Mark phase complete
    currentPhase.status = "completed";
    await updatePlan(supabase, run.id, plan);

    // Check if more phases remain
    const remainingPhases = plan.phases.filter((p: any) => p.status === "pending");
    if (remainingPhases.length > 0) {
      // Continue with next phase (recursive or re-invoke)
      return await processRun(supabase, { ...run, plan });
    }

    // All done
    await transitionRun(supabase, run.id, "completed");
    await finalizeCredits(supabase, run.id, "completed");
    return { success: true };

  } catch (error: unknown) {
    console.error("Process run error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await transitionRun(supabase, run.id, "failed", { error: errorMessage });
    await finalizeCredits(supabase, run.id, "failed");
    return { success: false, error: errorMessage };
  }
}

async function executeStep(
  supabase: any,
  run: Run,
  phase: any,
  capability: string
): Promise<{ success: boolean; error?: string; needsUserInput?: boolean; waitingFor?: string; creditsUsed?: number }> {
  const stepId = crypto.randomUUID();

  // Create step record
  await supabase.from("agent_task_steps").insert({
    id: stepId,
    task_id: run.id,
    phase_id: phase.id,
    tool_name: capability,
    status: "running",
    started_at: new Date().toISOString()
  });

  try {
    // Map capability to tool
    const toolMapping: Record<string, string> = {
      "web_search": "search_web",
      "research": "search_web",
      "file_creation": "file_write",
      "code_execution": "shell_execute",
      "document_generation": "generate_document",
      "presentation": "generate_slides",
      "data_analysis": "shell_execute",
      "user_confirmation": "ask_user"
    };

    const toolName = toolMapping[capability] || capability;

    // Check if needs user input
    if (toolName === "ask_user") {
      await supabase.from("agent_task_steps").update({
        status: "waiting_user",
        updated_at: new Date().toISOString()
      }).eq("id", stepId);

      return { success: false, needsUserInput: true, waitingFor: capability };
    }

    // Build execution context
    const context: ToolExecutionContext = {
      runId: run.id,
      stepId,
      tenantId: run.user_id,
      userId: run.user_id,
      timeout: 60000,
      creditBudget: 10,
      idempotencyKey: `${run.id}-${stepId}-${toolName}`
    };

    // Execute tool
    const result = await executeToolCall(toolName, { phase: phase.title, capability }, context, supabase);

    // Update step as completed
    await supabase.from("agent_task_steps").update({
      status: "completed",
      tool_output: result.output,
      completed_at: new Date().toISOString(),
      credits_used: result.metadata?.duration_ms ? Math.ceil(result.metadata.duration_ms / 1000) : 1
    }).eq("id", stepId);

    // Store artifacts
    if (result.artifacts && result.artifacts.length > 0) {
      await supabase.from("agent_task_outputs").insert(
        result.artifacts.map((artifactId: string) => ({
          task_id: run.id,
          step_id: stepId,
          artifact_id: artifactId,
          created_at: new Date().toISOString()
        }))
      );
    }

    return { success: true, creditsUsed: 1 };

  } catch (error: unknown) {
    console.error("Step execution error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await supabase.from("agent_task_steps").update({
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString()
    }).eq("id", stepId);

    return { success: false, error: errorMessage };
  }
}

async function handleExecuteStep(supabase: any, runId: string): Promise<Response> {
  // Get run and find next pending step
  const { data: run } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run) {
    return new Response(
      JSON.stringify({ error: "Run not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = await processRun(supabase, run);

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function updatePlan(supabase: any, runId: string, plan: any): Promise<void> {
  await supabase
    .from("agent_tasks")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", runId);
}

async function consumeStepCredits(supabase: any, runId: string, amount: number): Promise<void> {
  // Get active reservation for this run
  const { data: reservation } = await supabase
    .from("credit_reservations")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "active")
    .single();

  if (reservation) {
    await supabase.rpc("consume_credits", {
      p_reservation_id: reservation.id,
      p_amount: amount
    });
  }
}

async function finalizeCredits(supabase: any, runId: string, reason: string): Promise<void> {
  const { data: reservation } = await supabase
    .from("credit_reservations")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "active")
    .single();

  if (reservation) {
    if (reason === "completed") {
      await supabase.rpc("finalize_reservation", {
        p_reservation_id: reservation.id,
        p_reason: reason
      });
    } else {
      await supabase.rpc("release_reservation", {
        p_reservation_id: reservation.id,
        p_reason: reason
      });
    }
  }
}
