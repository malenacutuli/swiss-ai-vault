import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { task_id } = body;

    // Validate task_id
    if (!task_id || task_id === 'undefined' || task_id === 'null') {
      return new Response(
        JSON.stringify({ 
          task: null, 
          steps: [], 
          logs: [], 
          outputs: [],
          error: "Invalid task ID" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch task
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", task_id)
      .single();

    // Return gracefully if not found (race condition handling)
    if (taskError || !task) {
      return new Response(
        JSON.stringify({
          task: null,
          steps: [],
          logs: [],
          outputs: [],
          error: "Task not found - may still be creating",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch steps
    const { data: steps } = await supabase
      .from("agent_task_steps")
      .select("*")
      .eq("task_id", task_id)
      .order("step_number", { ascending: true });

    // Fetch logs
    const { data: logs } = await supabase
      .from("agent_task_logs")
      .select("*")
      .eq("task_id", task_id)
      .order("created_at", { ascending: true })
      .limit(100);

    // Fetch outputs
    const { data: outputs } = await supabase
      .from("agent_outputs")
      .select("*")
      .eq("task_id", task_id)
      .order("created_at", { ascending: true });

    return new Response(
      JSON.stringify({
        task,
        steps: steps || [],
        logs: logs || [],
        outputs: outputs || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('[agent-status] Error:', error);
    return new Response(
      JSON.stringify({ 
        task: null, 
        steps: [], 
        logs: [], 
        outputs: [],
        error: error.message 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
