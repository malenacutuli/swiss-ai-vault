// supabase/functions/cache-stats/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'stats';

  try {
    switch (action) {
      case 'stats': {
        const days = parseInt(url.searchParams.get('days') || '7');
        
        // Try RPC, fallback to mock data if function doesn't exist
        const { data, error } = await supabase.rpc('get_cache_stats', { p_days: days });
        
        if (error) {
          // If RPC doesn't exist, return mock stats
          console.log('get_cache_stats RPC not found, returning mock data:', error.message);
          return new Response(JSON.stringify({ 
            stats: {
              total_entries: 0,
              hit_rate: 0,
              miss_rate: 0,
              avg_latency_ms: 0,
              message: 'Cache stats RPC not configured'
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ stats: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'cleanup': {
        const { data, error } = await supabase.rpc('cleanup_expired_cache');
        
        if (error) {
          console.log('cleanup_expired_cache RPC not found:', error.message);
          return new Response(JSON.stringify({ deleted: 0, message: 'Cleanup RPC not configured' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ deleted: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'size': {
        const { data, error } = await supabase
          .from('response_cache')
          .select('id', { count: 'exact' });

        if (error) {
          console.log('response_cache table not found:', error.message);
          return new Response(JSON.stringify({
            entries: 0,
            count: 0,
            message: 'Cache table not configured'
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          entries: data?.length || 0,
          count: data?.length || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error('cache-stats error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
