import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Parse JSON body safely
    let task_id: string | undefined;
    let since: string | undefined;
    let after: number | undefined;
    
    try {
      const body = await req.json();
      task_id = body.task_id;
      since = body.since;
      after = body.after;
    } catch {
      // If body parsing fails, try URL params as fallback
      const url = new URL(req.url);
      task_id = url.searchParams.get("task_id") || undefined;
      since = url.searchParams.get("since") || undefined;
      const afterParam = url.searchParams.get("after");
      after = afterParam ? parseInt(afterParam, 10) : undefined;
    }
    
    if (!task_id) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`[agent-logs] Fetching logs for task ${task_id}, after=${after}, since=${since}`);
    
    // Build query
    let query = supabase
      .from("agent_task_logs")
      .select("*")
      .eq("task_id", task_id)
      .order("sequence_number", { ascending: true });
    
    // Support both 'after' (sequence_number) and 'since' (timestamp)
    if (after !== undefined && after !== null && !isNaN(after)) {
      query = query.gt("sequence_number", after);
    } else if (since) {
      query = query.gt("created_at", since);
    }
    
    const { data: logs, error } = await query;
    
    if (error) {
      console.error(`[agent-logs] Query error: ${error.message}`);
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }
    
    console.log(`[agent-logs] Returning ${logs?.length || 0} logs`);
    
    return new Response(JSON.stringify({
      logs: logs || [],
      count: logs?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[agent-logs] Error: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message,
      logs: [],
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
