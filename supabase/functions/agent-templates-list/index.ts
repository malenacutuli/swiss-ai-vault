import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth (optional for public templates)
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Parse query params
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const tier = url.searchParams.get("tier");
    const search = url.searchParams.get("search");

    // Build query
    let query = supabase
      .from("action_templates")
      .select("*")
      .eq("is_public", true)
      .order("usage_count", { ascending: false });

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (tier) {
      query = query.eq("tier", tier);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: templates, error } = await query;

    if (error) {
      throw error;
    }

    // Get categories with counts
    const { data: categories } = await supabase
      .from("action_templates")
      .select("category")
      .eq("is_public", true);

    const categoryCounts: Record<string, number> = {};
    (categories || []).forEach((t: { category: string }) => {
      if (t.category) {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      }
    });

    console.log(`[agent-templates-list] Found ${templates?.length || 0} templates`);

    return new Response(
      JSON.stringify({
        success: true,
        templates: templates || [],
        categories: Object.entries(categoryCounts).map(([name, count]) => ({
          name,
          count,
        })),
        total: templates?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[agent-templates-list] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
