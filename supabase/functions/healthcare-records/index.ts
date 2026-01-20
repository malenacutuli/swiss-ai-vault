// supabase/functions/healthcare-records/index.ts
// Medical record management with HIPAA-compliant encryption and audit logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface RecordInput {
  patient_id: string;
  record_type: string;
  content: string;
  diagnosis?: string;
  notes?: string;
  treatment_plan?: string;
  icd10_codes?: string[];
  cpt_codes?: string[];
  loinc_codes?: string[];
  snomed_codes?: string[];
  visit_date: string;
  visit_type?: string;
  duration_minutes?: number;
  vital_signs?: Record<string, unknown>;
  attachment_ids?: string[];
}

// Simple encryption using Web Crypto API (AES-GCM)
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get("HEALTHCARE_ENCRYPTION_KEY") || "default-dev-key-change-in-production";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial.padEnd(32, '0').slice(0, 32));

  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text: string): Promise<string> {
  if (!text) return "";
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return "";
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return "[decryption failed]";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

// Log audit event for HIPAA compliance
async function logAudit(
  serviceClient: AnySupabaseClient,
  userId: string,
  patientId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  accessReason: string,
  request: Request,
  details: Record<string, unknown> = {}
) {
  try {
    await serviceClient.from('healthcare_audit_logs').insert({
      user_id: userId,
      patient_id: patientId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      access_reason: accessReason,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      user_agent: request.headers.get('user-agent'),
      request_id: request.headers.get('x-request-id'),
      details
    } as Record<string, unknown>);
  } catch (err) {
    console.error('[Audit] Failed to log:', err);
  }
}

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
  const { data: provider, error: providerError } = await supabase
    .from('healthcare_providers')
    .select('id, provider_type, is_active')
    .eq('user_id', user.id)
    .single();

  if (providerError || !provider || !provider.is_active) {
    return new Response(
      JSON.stringify({ error: "Active provider profile required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const recordId = url.searchParams.get('id');
  const patientId = url.searchParams.get('patient_id');
  const accessReason = url.searchParams.get('reason') || 'routine_care';

  try {
    switch (req.method) {
      case 'GET': {
        if (recordId) {
          // Get single record
          const { data: record, error } = await supabase
            .from('healthcare_records')
            .select('*')
            .eq('id', recordId)
            .single();

          if (error || !record) {
            return new Response(
              JSON.stringify({ error: "Record not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Log access
          await logAudit(
            serviceClient,
            user.id,
            record.patient_id,
            'view',
            'record',
            recordId,
            accessReason,
            req
          );

          // Decrypt record
          const decryptedRecord = {
            id: record.id,
            patient_id: record.patient_id,
            provider_id: record.provider_id,
            record_type: record.record_type,
            content: await decrypt(record.encrypted_content),
            diagnosis: record.encrypted_diagnosis ? await decrypt(record.encrypted_diagnosis) : null,
            notes: record.encrypted_notes ? await decrypt(record.encrypted_notes) : null,
            treatment_plan: record.encrypted_treatment_plan ? await decrypt(record.encrypted_treatment_plan) : null,
            icd10_codes: record.icd10_codes,
            cpt_codes: record.cpt_codes,
            loinc_codes: record.loinc_codes,
            snomed_codes: record.snomed_codes,
            visit_date: record.visit_date,
            visit_type: record.visit_type,
            duration_minutes: record.duration_minutes,
            vital_signs: record.vital_signs,
            attachment_ids: record.attachment_ids,
            status: record.status,
            signed_by: record.signed_by,
            signed_at: record.signed_at,
            created_at: record.created_at,
            updated_at: record.updated_at
          };

          return new Response(
            JSON.stringify({ record: decryptedRecord }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (patientId) {
          // List records for patient
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const offset = parseInt(url.searchParams.get('offset') || '0');
          const recordType = url.searchParams.get('type');

          let query = supabase
            .from('healthcare_records')
            .select('id, patient_id, provider_id, record_type, visit_date, visit_type, status, icd10_codes, created_at')
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false })
            .range(offset, offset + limit - 1);

          if (recordType) {
            query = query.eq('record_type', recordType);
          }

          const { data: records, error } = await query;

          if (error) throw error;

          // Log access
          await logAudit(
            serviceClient,
            user.id,
            patientId,
            'view',
            'record',
            null,
            accessReason,
            req,
            { action: 'list', count: records?.length || 0 }
          );

          return new Response(
            JSON.stringify({ records: records || [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // List recent records for provider
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          const { data: records, error } = await supabase
            .from('healthcare_records')
            .select('id, patient_id, record_type, visit_date, visit_type, status, created_at')
            .eq('provider_id', provider.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) throw error;

          // Log access
          await logAudit(
            serviceClient,
            user.id,
            null,
            'view',
            'record',
            null,
            accessReason,
            req,
            { action: 'list_provider_records', count: records?.length || 0 }
          );

          return new Response(
            JSON.stringify({ records: records || [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case 'POST': {
        const body: RecordInput = await req.json();

        // Validate required fields
        if (!body.patient_id || !body.record_type || !body.content || !body.visit_date) {
          return new Response(
            JSON.stringify({ error: "Patient ID, record type, content, and visit date are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify patient belongs to provider
        const { data: patient } = await supabase
          .from('healthcare_patients')
          .select('id')
          .eq('id', body.patient_id)
          .eq('provider_id', provider.id)
          .single();

        if (!patient) {
          return new Response(
            JSON.stringify({ error: "Patient not found or not authorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Encrypt content
        const encryptedData = {
          patient_id: body.patient_id,
          provider_id: provider.id,
          record_type: body.record_type,
          encrypted_content: await encrypt(body.content),
          encrypted_diagnosis: body.diagnosis ? await encrypt(body.diagnosis) : null,
          encrypted_notes: body.notes ? await encrypt(body.notes) : null,
          encrypted_treatment_plan: body.treatment_plan ? await encrypt(body.treatment_plan) : null,
          icd10_codes: body.icd10_codes || [],
          cpt_codes: body.cpt_codes || [],
          loinc_codes: body.loinc_codes || [],
          snomed_codes: body.snomed_codes || [],
          visit_date: body.visit_date,
          visit_type: body.visit_type || null,
          duration_minutes: body.duration_minutes || null,
          vital_signs: body.vital_signs || null,
          attachment_ids: body.attachment_ids || [],
          status: 'draft'
        };

        const { data: newRecord, error } = await serviceClient
          .from('healthcare_records')
          .insert(encryptedData)
          .select('id')
          .single();

        if (error) throw error;

        // Log creation
        await logAudit(
          serviceClient,
          user.id,
          body.patient_id,
          'create',
          'record',
          newRecord.id,
          accessReason,
          req,
          { record_type: body.record_type }
        );

        return new Response(
          JSON.stringify({
            success: true,
            record_id: newRecord.id,
            message: "Record created successfully"
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'PUT': {
        if (!recordId) {
          return new Response(
            JSON.stringify({ error: "Record ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const action = url.searchParams.get('action');

        // Handle sign action
        if (action === 'sign') {
          const { data: record, error: fetchError } = await supabase
            .from('healthcare_records')
            .select('id, patient_id, status')
            .eq('id', recordId)
            .single();

          if (fetchError || !record) {
            return new Response(
              JSON.stringify({ error: "Record not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { error } = await supabase
            .from('healthcare_records')
            .update({
              status: 'final',
              signed_by: user.id,
              signed_at: new Date().toISOString()
            })
            .eq('id', recordId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            record.patient_id,
            'update',
            'record',
            recordId,
            accessReason,
            req,
            { action: 'signed' }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Record signed successfully" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Regular update
        const body: Partial<RecordInput> = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.content) updateData.encrypted_content = await encrypt(body.content);
        if (body.diagnosis !== undefined) updateData.encrypted_diagnosis = body.diagnosis ? await encrypt(body.diagnosis) : null;
        if (body.notes !== undefined) updateData.encrypted_notes = body.notes ? await encrypt(body.notes) : null;
        if (body.treatment_plan !== undefined) updateData.encrypted_treatment_plan = body.treatment_plan ? await encrypt(body.treatment_plan) : null;
        if (body.icd10_codes !== undefined) updateData.icd10_codes = body.icd10_codes;
        if (body.cpt_codes !== undefined) updateData.cpt_codes = body.cpt_codes;
        if (body.loinc_codes !== undefined) updateData.loinc_codes = body.loinc_codes;
        if (body.snomed_codes !== undefined) updateData.snomed_codes = body.snomed_codes;
        if (body.visit_date) updateData.visit_date = body.visit_date;
        if (body.visit_type !== undefined) updateData.visit_type = body.visit_type;
        if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes;
        if (body.vital_signs !== undefined) updateData.vital_signs = body.vital_signs;
        if (body.attachment_ids !== undefined) updateData.attachment_ids = body.attachment_ids;

        // Get patient_id for audit
        const { data: record } = await supabase
          .from('healthcare_records')
          .select('patient_id')
          .eq('id', recordId)
          .single();

        const { error } = await supabase
          .from('healthcare_records')
          .update(updateData)
          .eq('id', recordId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          record?.patient_id || null,
          'update',
          'record',
          recordId,
          accessReason,
          req,
          { fields_updated: Object.keys(body) }
        );

        return new Response(
          JSON.stringify({ success: true, message: "Record updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'DELETE': {
        if (!recordId) {
          return new Response(
            JSON.stringify({ error: "Record ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get patient_id for audit
        const { data: record } = await supabase
          .from('healthcare_records')
          .select('patient_id')
          .eq('id', recordId)
          .single();

        // Soft delete - mark as deleted status
        const { error } = await supabase
          .from('healthcare_records')
          .update({ status: 'deleted' })
          .eq('id', recordId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          record?.patient_id || null,
          'delete',
          'record',
          recordId,
          accessReason,
          req
        );

        return new Response(
          JSON.stringify({ success: true, message: "Record marked as deleted" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Healthcare records error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
