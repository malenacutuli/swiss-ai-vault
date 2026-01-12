// supabase/functions/analytics/index.ts
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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'user';
  const days = parseInt(url.searchParams.get('days') || '30');

  try {
    switch (action) {
      case 'user': {
        const { data, error } = await serviceClient.rpc('get_user_analytics', {
          p_user_id: user.id,
          p_days: days
        });

        if (error) throw error;

        return new Response(JSON.stringify({ analytics: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'org': {
        const orgId = url.searchParams.get('org_id');
        if (!orgId) throw new Error('Organization ID required');

        // Verify admin access
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .single();

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          throw new Error('Admin access required');
        }

        const { data, error } = await serviceClient.rpc('get_org_analytics', {
          p_org_id: orgId,
          p_days: days
        });

        if (error) throw error;

        return new Response(JSON.stringify({ analytics: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'engagement': {
        const orgId = url.searchParams.get('org_id');
        if (!orgId) throw new Error('Organization ID required');

        // Verify admin access
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .single();

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          throw new Error('Admin access required');
        }

        const { data, error } = await serviceClient.rpc('get_engagement_metrics', {
          p_org_id: orgId,
          p_days: days
        });

        if (error) throw error;

        return new Response(JSON.stringify({ engagement: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'track': {
        const body = await req.json();
        const { activity_type, tokens, feature, org_id } = body;

        await serviceClient.rpc('track_user_activity', {
          p_user_id: user.id,
          p_org_id: org_id || null,
          p_activity_type: activity_type || 'session',
          p_tokens: tokens || 0,
          p_feature: feature || null
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'aggregate': {
        // Admin only - aggregate org metrics
        const orgId = url.searchParams.get('org_id');
        if (!orgId) throw new Error('Organization ID required');

        await serviceClient.rpc('aggregate_org_metrics', {
          p_org_id: orgId,
          p_date: new Date().toISOString().split('T')[0]
        });

        return new Response(JSON.stringify({ success: true }), {
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
