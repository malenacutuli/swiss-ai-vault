// supabase/functions/audit-logs/index.ts
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
  const action = url.searchParams.get('action') || 'search';
  const orgId = url.searchParams.get('org_id');

  if (!orgId) {
    return new Response(
      JSON.stringify({ error: "Organization ID required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify user is org admin
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return new Response(
      JSON.stringify({ error: "Admin access required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    switch (action) {
      case 'search': {
        const actionFilter = url.searchParams.get('filter_action');
        const resourceType = url.searchParams.get('resource_type');
        const userId = url.searchParams.get('user_id');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');
        const searchTerm = url.searchParams.get('q');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const { data, error } = await serviceClient.rpc('search_audit_logs', {
          p_org_id: orgId,
          p_action: actionFilter || null,
          p_resource_type: resourceType || null,
          p_user_id: userId || null,
          p_start_date: startDate || null,
          p_end_date: endDate || null,
          p_search_term: searchTerm || null,
          p_limit: limit,
          p_offset: offset
        });

        if (error) throw error;

        return new Response(JSON.stringify({ logs: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'summary': {
        const days = parseInt(url.searchParams.get('days') || '30');

        const { data, error } = await serviceClient.rpc('get_audit_summary', {
          p_org_id: orgId,
          p_days: days
        });

        if (error) throw error;

        return new Response(JSON.stringify({ summary: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'actions': {
        const { data, error } = await serviceClient
          .from('audit_actions')
          .select('*')
          .order('category');

        if (error) throw error;

        return new Response(JSON.stringify({ actions: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'export': {
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        if (!startDate || !endDate) {
          throw new Error('Start and end dates required for export');
        }

        const { data, error } = await serviceClient.rpc('search_audit_logs', {
          p_org_id: orgId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_limit: 10000,
          p_offset: 0
        });

        if (error) throw error;

        // Return as CSV
        const csv = convertToCSV(data || []);

        return new Response(csv, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="audit-logs-${startDate}-${endDate}.csv"`
          }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = ['id', 'user_id', 'actor_email', 'action', 'resource_type', 'resource_id', 'status', 'created_at'];
  const rows = data.map(row =>
    headers.map(h => JSON.stringify(row[h] || '')).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
