// ============================================================
// FILE: supabase/functions/agent-logs/index.ts
// Real-time log polling for agent task terminal view
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse from request body first (supabase.functions.invoke sends body)
  let taskId: string | null = null;
  let afterSequence = 0;

  try {
    const body = await req.json();
    taskId = body.task_id;
    afterSequence = parseInt(body.after) || 0;
  } catch {
    // Fallback to URL params for backwards compatibility
    const url = new URL(req.url);
    taskId = url.searchParams.get("task_id");
    afterSequence = parseInt(url.searchParams.get("after") || "0");
  }

  if (!taskId) {
    return new Response(JSON.stringify({ error: "task_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify user owns this task
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(authHeader);

  const { data: task } = await supabase
    .from("agent_tasks")
    .select("user_id")
    .eq("id", taskId)
    .single();

  if (!task || task.user_id !== user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get logs after sequence number
  const { data: logs, error } = await supabase
    .from("agent_task_logs")
    .select("*")
    .eq("task_id", taskId)
    .gt("sequence_number", afterSequence)
    .order("sequence_number", { ascending: true });

  if (error) {
    console.error("[agent-logs] Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ logs: logs || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
