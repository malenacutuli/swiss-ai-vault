// supabase/functions/healthcare-patients/index.ts
// CRUD operations for patient management with HIPAA-compliant encryption and audit logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface PatientInput {
  first_name: string;
  last_name: string;
  dob: string;
  ssn?: string;
  mrn?: string;
  blood_type?: string;
  allergies?: string[];
  current_medications?: string[];
  medical_conditions?: string[];
  email?: string;
  phone?: string;
  address?: string;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  insurance_info?: {
    provider: string;
    policy_number: string;
    group_number: string;
  };
  gender?: string;
  preferred_language?: string;
}

// Simple encryption using Web Crypto API (AES-GCM)
// In production, use a proper key management service
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

  // Combine IV and encrypted data, encode as base64
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create Supabase clients
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get provider info for this user
  const { data: provider, error: providerError } = await supabase
    .from('healthcare_providers')
    .select('id, provider_type, is_active, hipaa_certified_at')
    .eq('user_id', user.id)
    .single();

  if (providerError || !provider) {
    return new Response(
      JSON.stringify({ error: "Provider profile required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!provider.is_active) {
    return new Response(
      JSON.stringify({ error: "Provider account inactive" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get('id');
  const action = url.searchParams.get('action') || 'list';
  const accessReason = url.searchParams.get('reason') || 'routine_care';

  try {
    switch (req.method) {
      case 'GET': {
        if (patientId) {
          // Get single patient
          const { data: patient, error } = await supabase
            .from('healthcare_patients')
            .select('*')
            .eq('id', patientId)
            .single();

          if (error || !patient) {
            return new Response(
              JSON.stringify({ error: "Patient not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Log access
          await logAudit(
            serviceClient,
            user.id,
            patientId,
            'view',
            'patient',
            patientId,
            accessReason,
            req
          );

          // Decrypt patient data for response
          const decryptedPatient = {
            id: patient.id,
            provider_id: patient.provider_id,
            first_name: await decrypt(patient.encrypted_first_name),
            last_name: await decrypt(patient.encrypted_last_name),
            dob: await decrypt(patient.encrypted_dob),
            ssn: patient.encrypted_ssn ? await decrypt(patient.encrypted_ssn) : null,
            mrn: patient.encrypted_mrn ? await decrypt(patient.encrypted_mrn) : null,
            blood_type: patient.blood_type,
            allergies: patient.allergies_encrypted ? JSON.parse(await decrypt(patient.allergies_encrypted)) : [],
            current_medications: patient.current_medications_encrypted ? JSON.parse(await decrypt(patient.current_medications_encrypted)) : [],
            medical_conditions: patient.medical_conditions_encrypted ? JSON.parse(await decrypt(patient.medical_conditions_encrypted)) : [],
            email: patient.encrypted_email ? await decrypt(patient.encrypted_email) : null,
            phone: patient.encrypted_phone ? await decrypt(patient.encrypted_phone) : null,
            address: patient.encrypted_address ? await decrypt(patient.encrypted_address) : null,
            emergency_contact: patient.emergency_contact_encrypted ? JSON.parse(await decrypt(patient.emergency_contact_encrypted)) : null,
            insurance_info: patient.insurance_info_encrypted ? JSON.parse(await decrypt(patient.insurance_info_encrypted)) : null,
            gender: patient.gender,
            preferred_language: patient.preferred_language,
            consent_signed_at: patient.consent_signed_at,
            is_active: patient.is_active,
            created_at: patient.created_at,
            updated_at: patient.updated_at
          };

          return new Response(
            JSON.stringify({ patient: decryptedPatient }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // List patients (returns limited info for privacy)
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const offset = parseInt(url.searchParams.get('offset') || '0');
          const search = url.searchParams.get('search');

          let query = supabase
            .from('healthcare_patients')
            .select('id, encrypted_first_name, encrypted_last_name, blood_type, gender, is_active, created_at, updated_at')
            .eq('provider_id', provider.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          const { data: patients, error } = await query;

          if (error) throw error;

          // Log list access
          await logAudit(
            serviceClient,
            user.id,
            null,
            'view',
            'patient',
            null,
            accessReason,
            req,
            { action: 'list', count: patients?.length || 0 }
          );

          // Decrypt names for listing
          const decryptedPatients = await Promise.all(
            (patients || []).map(async (p) => ({
              id: p.id,
              first_name: await decrypt(p.encrypted_first_name),
              last_name: await decrypt(p.encrypted_last_name),
              blood_type: p.blood_type,
              gender: p.gender,
              is_active: p.is_active,
              created_at: p.created_at,
              updated_at: p.updated_at
            }))
          );

          // Filter by search if provided
          let filteredPatients = decryptedPatients;
          if (search) {
            const searchLower = search.toLowerCase();
            filteredPatients = decryptedPatients.filter(p =>
              p.first_name.toLowerCase().includes(searchLower) ||
              p.last_name.toLowerCase().includes(searchLower)
            );
          }

          return new Response(
            JSON.stringify({ patients: filteredPatients }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case 'POST': {
        // Create new patient
        const body: PatientInput = await req.json();

        // Validate required fields
        if (!body.first_name || !body.last_name || !body.dob) {
          return new Response(
            JSON.stringify({ error: "First name, last name, and date of birth are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Encrypt sensitive data
        const encryptedData = {
          provider_id: provider.id,
          encrypted_first_name: await encrypt(body.first_name),
          encrypted_last_name: await encrypt(body.last_name),
          encrypted_dob: await encrypt(body.dob),
          encrypted_ssn: body.ssn ? await encrypt(body.ssn) : null,
          encrypted_mrn: body.mrn ? await encrypt(body.mrn) : null,
          blood_type: body.blood_type || null,
          allergies_encrypted: body.allergies ? await encrypt(JSON.stringify(body.allergies)) : null,
          current_medications_encrypted: body.current_medications ? await encrypt(JSON.stringify(body.current_medications)) : null,
          medical_conditions_encrypted: body.medical_conditions ? await encrypt(JSON.stringify(body.medical_conditions)) : null,
          encrypted_email: body.email ? await encrypt(body.email) : null,
          encrypted_phone: body.phone ? await encrypt(body.phone) : null,
          encrypted_address: body.address ? await encrypt(body.address) : null,
          emergency_contact_encrypted: body.emergency_contact ? await encrypt(JSON.stringify(body.emergency_contact)) : null,
          insurance_info_encrypted: body.insurance_info ? await encrypt(JSON.stringify(body.insurance_info)) : null,
          gender: body.gender || null,
          preferred_language: body.preferred_language || 'en'
        };

        const { data: newPatient, error } = await serviceClient
          .from('healthcare_patients')
          .insert(encryptedData)
          .select('id')
          .single();

        if (error) throw error;

        // Log creation
        await logAudit(
          serviceClient,
          user.id,
          newPatient.id,
          'create',
          'patient',
          newPatient.id,
          accessReason,
          req,
          { fields_provided: Object.keys(body) }
        );

        return new Response(
          JSON.stringify({
            success: true,
            patient_id: newPatient.id,
            message: "Patient created successfully"
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'PUT': {
        // Update patient
        if (!patientId) {
          return new Response(
            JSON.stringify({ error: "Patient ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const body: Partial<PatientInput> = await req.json();
        const updateData: Record<string, unknown> = {};

        // Encrypt any provided fields
        if (body.first_name) updateData.encrypted_first_name = await encrypt(body.first_name);
        if (body.last_name) updateData.encrypted_last_name = await encrypt(body.last_name);
        if (body.dob) updateData.encrypted_dob = await encrypt(body.dob);
        if (body.ssn !== undefined) updateData.encrypted_ssn = body.ssn ? await encrypt(body.ssn) : null;
        if (body.mrn !== undefined) updateData.encrypted_mrn = body.mrn ? await encrypt(body.mrn) : null;
        if (body.blood_type !== undefined) updateData.blood_type = body.blood_type;
        if (body.allergies !== undefined) updateData.allergies_encrypted = body.allergies ? await encrypt(JSON.stringify(body.allergies)) : null;
        if (body.current_medications !== undefined) updateData.current_medications_encrypted = body.current_medications ? await encrypt(JSON.stringify(body.current_medications)) : null;
        if (body.medical_conditions !== undefined) updateData.medical_conditions_encrypted = body.medical_conditions ? await encrypt(JSON.stringify(body.medical_conditions)) : null;
        if (body.email !== undefined) updateData.encrypted_email = body.email ? await encrypt(body.email) : null;
        if (body.phone !== undefined) updateData.encrypted_phone = body.phone ? await encrypt(body.phone) : null;
        if (body.address !== undefined) updateData.encrypted_address = body.address ? await encrypt(body.address) : null;
        if (body.emergency_contact !== undefined) updateData.emergency_contact_encrypted = body.emergency_contact ? await encrypt(JSON.stringify(body.emergency_contact)) : null;
        if (body.insurance_info !== undefined) updateData.insurance_info_encrypted = body.insurance_info ? await encrypt(JSON.stringify(body.insurance_info)) : null;
        if (body.gender !== undefined) updateData.gender = body.gender;
        if (body.preferred_language !== undefined) updateData.preferred_language = body.preferred_language;

        const { error } = await supabase
          .from('healthcare_patients')
          .update(updateData)
          .eq('id', patientId);

        if (error) throw error;

        // Log update
        await logAudit(
          serviceClient,
          user.id,
          patientId,
          'update',
          'patient',
          patientId,
          accessReason,
          req,
          { fields_updated: Object.keys(body) }
        );

        return new Response(
          JSON.stringify({ success: true, message: "Patient updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'DELETE': {
        // Soft delete (deactivate) patient
        if (!patientId) {
          return new Response(
            JSON.stringify({ error: "Patient ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from('healthcare_patients')
          .update({ is_active: false })
          .eq('id', patientId);

        if (error) throw error;

        // Log deletion
        await logAudit(
          serviceClient,
          user.id,
          patientId,
          'delete',
          'patient',
          patientId,
          accessReason,
          req
        );

        return new Response(
          JSON.stringify({ success: true, message: "Patient deactivated successfully" }),
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
    console.error('Healthcare patients error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
