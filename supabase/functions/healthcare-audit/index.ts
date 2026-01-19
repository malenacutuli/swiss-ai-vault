// supabase/functions/healthcare-audit/index.ts
// HIPAA-compliant audit log queries and reporting
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  // Get provider info
  const { data: provider } = await supabase
    .from('healthcare_providers')
    .select('id, provider_type, is_active')
    .eq('user_id', user.id)
    .single();

  if (!provider || !provider.is_active) {
    return new Response(
      JSON.stringify({ error: "Active provider profile required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'search';

  try {
    switch (action) {
      case 'search': {
        // Search audit logs for provider's patients
        const patientId = url.searchParams.get('patient_id');
        const actionFilter = url.searchParams.get('filter_action');
        const resourceType = url.searchParams.get('resource_type');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = serviceClient
          .from('healthcare_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by patient (provider can only see their patients)
        if (patientId) {
          // Verify patient belongs to provider
          const { data: patient } = await supabase
            .from('healthcare_patients')
            .select('id')
            .eq('id', patientId)
            .eq('provider_id', provider.id)
            .single();

          if (!patient) {
            return new Response(
              JSON.stringify({ error: "Patient not found or not authorized" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          query = query.eq('patient_id', patientId);
        } else {
          // Get all patients for this provider
          const { data: patients } = await supabase
            .from('healthcare_patients')
            .select('id')
            .eq('provider_id', provider.id);

          if (patients && patients.length > 0) {
            query = query.in('patient_id', patients.map(p => p.id));
          } else {
            // No patients, return empty
            return new Response(
              JSON.stringify({ logs: [], total: 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        if (actionFilter) {
          query = query.eq('action', actionFilter);
        }

        if (resourceType) {
          query = query.eq('resource_type', resourceType);
        }

        if (startDate) {
          query = query.gte('created_at', startDate);
        }

        if (endDate) {
          query = query.lte('created_at', endDate);
        }

        const { data: logs, error, count } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ logs: logs || [], total: count || logs?.length || 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'patient-summary': {
        // Get access summary for a specific patient
        const patientId = url.searchParams.get('patient_id');
        const days = parseInt(url.searchParams.get('days') || '30');

        if (!patientId) {
          return new Response(
            JSON.stringify({ error: "Patient ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify patient belongs to provider
        const { data: patient } = await supabase
          .from('healthcare_patients')
          .select('id')
          .eq('id', patientId)
          .eq('provider_id', provider.id)
          .single();

        if (!patient) {
          return new Response(
            JSON.stringify({ error: "Patient not found or not authorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: summary, error } = await serviceClient.rpc('get_patient_access_summary', {
          p_patient_id: patientId,
          p_days: days
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ summary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'provider-summary': {
        // Get provider's activity summary
        const days = parseInt(url.searchParams.get('days') || '30');
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get all patients for this provider
        const { data: patients } = await supabase
          .from('healthcare_patients')
          .select('id')
          .eq('provider_id', provider.id);

        const patientIds = patients?.map(p => p.id) || [];

        if (patientIds.length === 0) {
          return new Response(
            JSON.stringify({
              summary: {
                total_accesses: 0,
                by_action: {},
                by_resource_type: {},
                emergency_accesses: 0,
                unique_patients_accessed: 0
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get logs for provider's patients
        const { data: logs, error } = await serviceClient
          .from('healthcare_audit_logs')
          .select('action, resource_type, patient_id, is_emergency_access')
          .in('patient_id', patientIds)
          .gte('created_at', startDate);

        if (error) throw error;

        // Calculate summary
        const byAction: Record<string, number> = {};
        const byResourceType: Record<string, number> = {};
        const uniquePatients = new Set<string>();
        let emergencyAccesses = 0;

        for (const log of logs || []) {
          byAction[log.action] = (byAction[log.action] || 0) + 1;
          byResourceType[log.resource_type] = (byResourceType[log.resource_type] || 0) + 1;
          if (log.patient_id) uniquePatients.add(log.patient_id);
          if (log.is_emergency_access) emergencyAccesses++;
        }

        return new Response(
          JSON.stringify({
            summary: {
              total_accesses: logs?.length || 0,
              by_action: byAction,
              by_resource_type: byResourceType,
              emergency_accesses: emergencyAccesses,
              unique_patients_accessed: uniquePatients.size
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'emergency-accesses': {
        // Get all emergency/break-the-glass accesses
        const days = parseInt(url.searchParams.get('days') || '90');
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get all patients for this provider
        const { data: patients } = await supabase
          .from('healthcare_patients')
          .select('id')
          .eq('provider_id', provider.id);

        const patientIds = patients?.map(p => p.id) || [];

        if (patientIds.length === 0) {
          return new Response(
            JSON.stringify({ emergency_logs: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: logs, error } = await serviceClient
          .from('healthcare_audit_logs')
          .select('*')
          .in('patient_id', patientIds)
          .eq('is_emergency_access', true)
          .gte('created_at', startDate)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ emergency_logs: logs || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'export': {
        // Export audit logs as CSV (HIPAA compliance requirement)
        const patientId = url.searchParams.get('patient_id');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        if (!startDate || !endDate) {
          return new Response(
            JSON.stringify({ error: "Start and end dates required for export" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let query = serviceClient
          .from('healthcare_audit_logs')
          .select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false })
          .limit(10000);

        if (patientId) {
          // Verify patient belongs to provider
          const { data: patient } = await supabase
            .from('healthcare_patients')
            .select('id')
            .eq('id', patientId)
            .eq('provider_id', provider.id)
            .single();

          if (!patient) {
            return new Response(
              JSON.stringify({ error: "Patient not found or not authorized" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          query = query.eq('patient_id', patientId);
        } else {
          // Get all patients for this provider
          const { data: patients } = await supabase
            .from('healthcare_patients')
            .select('id')
            .eq('provider_id', provider.id);

          if (patients && patients.length > 0) {
            query = query.in('patient_id', patients.map(p => p.id));
          }
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        // Log the export action
        await serviceClient.from('healthcare_audit_logs').insert({
          user_id: user.id,
          patient_id: patientId || null,
          action: 'export',
          resource_type: 'audit_log',
          resource_id: null,
          access_reason: 'audit_report',
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
          user_agent: req.headers.get('user-agent'),
          details: {
            export_type: 'csv',
            start_date: startDate,
            end_date: endDate,
            record_count: logs?.length || 0
          }
        });

        // Convert to CSV
        const csv = convertToCSV(logs || []);

        return new Response(csv, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="healthcare-audit-logs-${startDate}-${endDate}.csv"`
          }
        });
      }

      case 'actions': {
        // Get list of all audit action types
        const actions = [
          { action: 'view', description: 'Record was viewed' },
          { action: 'create', description: 'Record was created' },
          { action: 'update', description: 'Record was updated' },
          { action: 'delete', description: 'Record was deleted' },
          { action: 'export', description: 'Data was exported' },
          { action: 'print', description: 'Data was printed' },
          { action: 'access_denied', description: 'Access was denied' },
          { action: 'login', description: 'User logged in' },
          { action: 'logout', description: 'User logged out' },
          { action: 'share', description: 'Data was shared' },
          { action: 'fax', description: 'Data was faxed' },
          { action: 'email', description: 'Data was emailed' },
          { action: 'consent_signed', description: 'Consent was signed' },
          { action: 'consent_revoked', description: 'Consent was revoked' },
          { action: 'emergency_access', description: 'Emergency/break-the-glass access' }
        ];

        const resourceTypes = [
          { type: 'patient', description: 'Patient record' },
          { type: 'record', description: 'Medical record' },
          { type: 'prescription', description: 'Prescription' },
          { type: 'appointment', description: 'Appointment' },
          { type: 'provider', description: 'Provider profile' },
          { type: 'document', description: 'Document' },
          { type: 'report', description: 'Report' },
          { type: 'audit_log', description: 'Audit log' },
          { type: 'system', description: 'System action' }
        ];

        return new Response(
          JSON.stringify({ actions, resource_types: resourceTypes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Healthcare audit error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = [
    'id', 'user_id', 'provider_id', 'patient_id', 'actor_email', 'actor_role',
    'action', 'resource_type', 'resource_id', 'access_reason',
    'is_emergency_access', 'ip_address', 'user_agent', 'status', 'created_at'
  ];

  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return String(value).replace(/"/g, '""');
    }).map(v => `"${v}"`).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
