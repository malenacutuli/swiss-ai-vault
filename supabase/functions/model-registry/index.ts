// supabase/functions/model-registry/index.ts
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
  const action = url.searchParams.get('action') || 'list';

  try {
    switch (action) {
      case 'list': {
        const provider = url.searchParams.get('provider');
        const modelType = url.searchParams.get('type');
        const capability = url.searchParams.get('capability');

        let query = supabase
          .from('ai_models')
          .select(`
            id, provider, display_name, description, model_type,
            context_window, max_output_tokens, input_price_per_1k, output_price_per_1k,
            supports_vision, supports_functions, supports_streaming,
            rate_limit_rpm, is_available, tier_required, capabilities
          `)
          .eq('is_available', true)
          .order('provider')
          .order('display_name');

        if (provider) query = query.eq('provider', provider);
        if (modelType) query = query.eq('model_type', modelType);
        if (capability) query = query.contains('capabilities', [capability]);

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ models: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'get': {
        const modelId = url.searchParams.get('id');
        if (!modelId) throw new Error('Model ID required');

        const { data: model, error } = await supabase
          .from('ai_models')
          .select('*')
          .eq('id', modelId)
          .single();

        if (error) throw error;

        // Get health status
        const { data: health } = await supabase
          .from('model_health')
          .select('*')
          .eq('model_id', modelId)
          .order('checked_at', { ascending: false })
          .limit(1)
          .single();

        return new Response(JSON.stringify({ model, health }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'recommend': {
        const capability = url.searchParams.get('capability') || 'chat';
        const userTier = url.searchParams.get('tier') || 'free';
        const preferProvider = url.searchParams.get('prefer_provider');

        const { data, error } = await supabase
          .rpc('get_best_model', {
            p_capability: capability,
            p_user_tier: userTier,
            p_prefer_provider: preferProvider
          });

        if (error) throw error;

        return new Response(JSON.stringify({ recommendation: data?.[0] || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'health': {
        const { data, error } = await supabase
          .from('ai_models')
          .select(`
            id, provider, display_name, is_available,
            model_health (status, latency_ms, error_rate, checked_at)
          `)
          .order('provider');

        if (error) throw error;

        const healthStatus = data?.map(m => ({
          ...m,
          health: m.model_health?.[0] || { status: 'unknown' }
        }));

        return new Response(JSON.stringify({ models: healthStatus }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
