// supabase/functions/healthcare-prescriptions/index.ts
// Prescription management with controlled substance tracking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface PrescriptionInput {
  patient_id: string;
  record_id?: string;
  medication_name: string;
  medication_code?: string;
  dosage: string;
  dosage_form?: string;
  frequency: string;
  route?: string;
  start_date: string;
  end_date?: string;
  duration_days?: number;
  is_ongoing?: boolean;
  quantity?: number;
  quantity_unit?: string;
  refills_authorized?: number;
  pharmacy?: {
    name: string;
    address: string;
    phone: string;
  };
  instructions?: string;
  provider_notes?: string;
  is_controlled_substance?: boolean;
  dea_schedule?: string;
}

// Simple encryption
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

// Log audit event
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
  const { data: provider } = await supabase
    .from('healthcare_providers')
    .select('id, provider_type, is_active, license_number')
    .eq('user_id', user.id)
    .single();

  if (!provider || !provider.is_active) {
    return new Response(
      JSON.stringify({ error: "Active provider profile required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const prescriptionId = url.searchParams.get('id');
  const patientId = url.searchParams.get('patient_id');
  const accessReason = url.searchParams.get('reason') || 'prescription_management';

  try {
    switch (req.method) {
      case 'GET': {
        if (prescriptionId) {
          // Get single prescription
          const { data: prescription, error } = await supabase
            .from('healthcare_prescriptions')
            .select('*')
            .eq('id', prescriptionId)
            .single();

          if (error || !prescription) {
            return new Response(
              JSON.stringify({ error: "Prescription not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await logAudit(
            serviceClient,
            user.id,
            prescription.patient_id,
            'view',
            'prescription',
            prescriptionId,
            accessReason,
            req
          );

          // Decrypt pharmacy info and notes
          const decryptedPrescription = {
            ...prescription,
            pharmacy: prescription.pharmacy_encrypted
              ? JSON.parse(await decrypt(prescription.pharmacy_encrypted))
              : null,
            provider_notes: prescription.provider_notes_encrypted
              ? await decrypt(prescription.provider_notes_encrypted)
              : null,
            pharmacy_encrypted: undefined,
            provider_notes_encrypted: undefined
          };

          return new Response(
            JSON.stringify({ prescription: decryptedPrescription }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // List prescriptions
        const status = url.searchParams.get('status');
        const controlledOnly = url.searchParams.get('controlled') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = supabase
          .from('healthcare_prescriptions')
          .select(`
            id, patient_id, record_id, medication_name, medication_code,
            dosage, frequency, route, start_date, end_date,
            status, refills_remaining, is_controlled_substance, dea_schedule,
            created_at, updated_at
          `)
          .eq('provider_id', provider.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (patientId) {
          query = query.eq('patient_id', patientId);
        }

        if (status) {
          query = query.eq('status', status);
        }

        if (controlledOnly) {
          query = query.eq('is_controlled_substance', true);
        }

        const { data: prescriptions, error } = await query;

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          patientId || null,
          'view',
          'prescription',
          null,
          accessReason,
          req,
          { action: 'list', count: prescriptions?.length || 0, controlled_only: controlledOnly }
        );

        return new Response(
          JSON.stringify({ prescriptions: prescriptions || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'POST': {
        const body: PrescriptionInput = await req.json();

        // Validate required fields
        if (!body.patient_id || !body.medication_name || !body.dosage || !body.frequency || !body.start_date) {
          return new Response(
            JSON.stringify({ error: "Patient ID, medication name, dosage, frequency, and start date are required" }),
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

        // Extra validation for controlled substances
        if (body.is_controlled_substance) {
          if (!provider.license_number) {
            return new Response(
              JSON.stringify({ error: "License number required to prescribe controlled substances" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (!body.dea_schedule) {
            return new Response(
              JSON.stringify({ error: "DEA schedule required for controlled substances" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const prescriptionData = {
          patient_id: body.patient_id,
          provider_id: provider.id,
          record_id: body.record_id || null,
          medication_name: body.medication_name,
          medication_code: body.medication_code || null,
          dosage: body.dosage,
          dosage_form: body.dosage_form || null,
          frequency: body.frequency,
          route: body.route || 'oral',
          start_date: body.start_date,
          end_date: body.end_date || null,
          duration_days: body.duration_days || null,
          is_ongoing: body.is_ongoing || false,
          quantity: body.quantity || null,
          quantity_unit: body.quantity_unit || null,
          refills_authorized: body.refills_authorized || 0,
          refills_remaining: body.refills_authorized || 0,
          pharmacy_encrypted: body.pharmacy ? await encrypt(JSON.stringify(body.pharmacy)) : null,
          instructions: body.instructions || null,
          provider_notes_encrypted: body.provider_notes ? await encrypt(body.provider_notes) : null,
          is_controlled_substance: body.is_controlled_substance || false,
          dea_schedule: body.dea_schedule || null,
          status: 'active'
        };

        const { data: newPrescription, error } = await serviceClient
          .from('healthcare_prescriptions')
          .insert(prescriptionData)
          .select('id')
          .single();

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          body.patient_id,
          'create',
          'prescription',
          newPrescription.id,
          accessReason,
          req,
          {
            medication: body.medication_name,
            controlled: body.is_controlled_substance,
            dea_schedule: body.dea_schedule
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            prescription_id: newPrescription.id,
            message: "Prescription created successfully"
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'PUT': {
        if (!prescriptionId) {
          return new Response(
            JSON.stringify({ error: "Prescription ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const action = url.searchParams.get('action');

        // Handle refill action
        if (action === 'refill') {
          const { data: prescription } = await supabase
            .from('healthcare_prescriptions')
            .select('patient_id, refills_remaining, is_controlled_substance')
            .eq('id', prescriptionId)
            .single();

          if (!prescription) {
            return new Response(
              JSON.stringify({ error: "Prescription not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (prescription.refills_remaining <= 0) {
            return new Response(
              JSON.stringify({ error: "No refills remaining" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { error } = await supabase
            .from('healthcare_prescriptions')
            .update({
              refills_remaining: prescription.refills_remaining - 1
            })
            .eq('id', prescriptionId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            prescription.patient_id,
            'update',
            'prescription',
            prescriptionId,
            accessReason,
            req,
            { action: 'refill', controlled: prescription.is_controlled_substance }
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: "Refill processed",
              refills_remaining: prescription.refills_remaining - 1
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle discontinue action
        if (action === 'discontinue') {
          const body = await req.json();
          const { data: prescription } = await supabase
            .from('healthcare_prescriptions')
            .select('patient_id')
            .eq('id', prescriptionId)
            .single();

          const { error } = await supabase
            .from('healthcare_prescriptions')
            .update({
              status: 'discontinued',
              discontinued_at: new Date().toISOString(),
              discontinued_by: user.id,
              discontinue_reason: body.reason || null
            })
            .eq('id', prescriptionId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            prescription?.patient_id || null,
            'update',
            'prescription',
            prescriptionId,
            accessReason,
            req,
            { action: 'discontinue', reason: body.reason }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Prescription discontinued" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle e-prescribe action
        if (action === 'e-prescribe') {
          const { data: prescription } = await supabase
            .from('healthcare_prescriptions')
            .select('patient_id, medication_name, is_controlled_substance')
            .eq('id', prescriptionId)
            .single();

          // In production, integrate with e-prescribing service (Surescripts, etc.)
          const { error } = await supabase
            .from('healthcare_prescriptions')
            .update({
              e_prescribed: true,
              e_prescribe_sent_at: new Date().toISOString(),
              e_prescribe_status: 'sent'
            })
            .eq('id', prescriptionId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            prescription?.patient_id || null,
            'update',
            'prescription',
            prescriptionId,
            accessReason,
            req,
            { action: 'e-prescribe', medication: prescription?.medication_name }
          );

          return new Response(
            JSON.stringify({ success: true, message: "E-prescription sent" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Regular update
        const body: Partial<PrescriptionInput> = await req.json();
        const updateData: Record<string, unknown> = {};

        // Get current prescription for audit
        const { data: currentPrescription } = await supabase
          .from('healthcare_prescriptions')
          .select('patient_id')
          .eq('id', prescriptionId)
          .single();

        if (body.dosage !== undefined) updateData.dosage = body.dosage;
        if (body.frequency !== undefined) updateData.frequency = body.frequency;
        if (body.instructions !== undefined) updateData.instructions = body.instructions;
        if (body.end_date !== undefined) updateData.end_date = body.end_date;
        if (body.is_ongoing !== undefined) updateData.is_ongoing = body.is_ongoing;
        if (body.refills_authorized !== undefined) {
          updateData.refills_authorized = body.refills_authorized;
          updateData.refills_remaining = body.refills_authorized;
        }
        if (body.pharmacy !== undefined) {
          updateData.pharmacy_encrypted = body.pharmacy ? await encrypt(JSON.stringify(body.pharmacy)) : null;
        }
        if (body.provider_notes !== undefined) {
          updateData.provider_notes_encrypted = body.provider_notes ? await encrypt(body.provider_notes) : null;
        }

        const { error } = await supabase
          .from('healthcare_prescriptions')
          .update(updateData)
          .eq('id', prescriptionId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          currentPrescription?.patient_id || null,
          'update',
          'prescription',
          prescriptionId,
          accessReason,
          req,
          { fields_updated: Object.keys(body) }
        );

        return new Response(
          JSON.stringify({ success: true, message: "Prescription updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'DELETE': {
        if (!prescriptionId) {
          return new Response(
            JSON.stringify({ error: "Prescription ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: prescription } = await supabase
          .from('healthcare_prescriptions')
          .select('patient_id')
          .eq('id', prescriptionId)
          .single();

        // Soft delete - mark as cancelled
        const { error } = await supabase
          .from('healthcare_prescriptions')
          .update({ status: 'cancelled' })
          .eq('id', prescriptionId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          prescription?.patient_id || null,
          'delete',
          'prescription',
          prescriptionId,
          accessReason,
          req
        );

        return new Response(
          JSON.stringify({ success: true, message: "Prescription cancelled" }),
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
    console.error('Healthcare prescriptions error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
