import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Read from request body
    const { task_id, since, after } = await req.json();
    
    if (!task_id) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Build query
    let query = supabase
      .from("agent_task_logs")
      .select("*")
      .eq("task_id", task_id)
      .order("sequence_number", { ascending: true });
    
    // Support both 'after' (sequence_number) and 'since' (timestamp)
    if (after !== undefined && after !== null) {
      query = query.gt("sequence_number", after);
    } else if (since) {
      query = query.gt("created_at", since);
    }
    
    const { data: logs, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }
    
    return new Response(JSON.stringify({
      logs: logs || [],
      count: logs?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return new Response(JSON.stringify({
      error: error.message,
      logs: [],
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
