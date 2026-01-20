// supabase/functions/healthcare-appointments/index.ts
// Appointment scheduling with conflict detection and reminders
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface AppointmentInput {
  patient_id: string;
  appointment_type: string;
  reason_for_visit?: string;
  notes?: string;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  is_telehealth?: boolean;
  telehealth_provider?: string;
  recurrence_rule?: string;
}

// Simple encryption for notes
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

// Generate telehealth URL
function generateTelehealthUrl(provider: string, appointmentId: string): string {
  switch (provider) {
    case 'doxy':
      return `https://doxy.me/swissbrain-${appointmentId.slice(0, 8)}`;
    case 'zoom':
      // In production, integrate with Zoom API
      return `https://zoom.us/j/${appointmentId.replace(/-/g, '').slice(0, 10)}`;
    default:
      return `https://app.swissbrain.ai/telehealth/${appointmentId}`;
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
  const appointmentId = url.searchParams.get('id');
  const patientId = url.searchParams.get('patient_id');
  const accessReason = url.searchParams.get('reason') || 'scheduling';

  try {
    switch (req.method) {
      case 'GET': {
        if (appointmentId) {
          // Get single appointment
          const { data: appointment, error } = await supabase
            .from('healthcare_appointments')
            .select(`
              *,
              patient:healthcare_patients(id, encrypted_first_name, encrypted_last_name)
            `)
            .eq('id', appointmentId)
            .single();

          if (error || !appointment) {
            return new Response(
              JSON.stringify({ error: "Appointment not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await logAudit(
            serviceClient,
            user.id,
            appointment.patient_id,
            'view',
            'appointment',
            appointmentId,
            accessReason,
            req
          );

          // Decrypt patient name and notes
          const decryptedAppointment = {
            ...appointment,
            notes: appointment.notes_encrypted ? await decrypt(appointment.notes_encrypted) : null,
            patient_name: appointment.patient
              ? `${await decrypt(appointment.patient.encrypted_first_name)} ${await decrypt(appointment.patient.encrypted_last_name)}`
              : null,
            patient: undefined, // Remove raw patient object
            notes_encrypted: undefined // Remove encrypted field
          };

          return new Response(
            JSON.stringify({ appointment: decryptedAppointment }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // List appointments
        const startDate = url.searchParams.get('start') || new Date().toISOString();
        const endDate = url.searchParams.get('end') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const status = url.searchParams.get('status');

        let query = supabase
          .from('healthcare_appointments')
          .select(`
            id, patient_id, appointment_type, reason_for_visit,
            scheduled_at, duration_minutes, end_at, status,
            is_telehealth, telehealth_url, checked_in_at,
            patient:healthcare_patients(id, encrypted_first_name, encrypted_last_name)
          `)
          .eq('provider_id', provider.id)
          .gte('scheduled_at', startDate)
          .lte('scheduled_at', endDate)
          .order('scheduled_at', { ascending: true });

        if (status) {
          query = query.eq('status', status);
        }

        if (patientId) {
          query = query.eq('patient_id', patientId);
        }

        const { data: appointments, error } = await query;

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          patientId || null,
          'view',
          'appointment',
          null,
          accessReason,
          req,
          { action: 'list', count: appointments?.length || 0 }
        );

        // Decrypt patient names
        const decryptedAppointments = await Promise.all(
          (appointments || []).map(async (apt) => {
            const patient = apt.patient as { encrypted_first_name?: string; encrypted_last_name?: string } | null;
            return {
              ...apt,
              patient_name: patient?.encrypted_first_name
                ? `${await decrypt(patient.encrypted_first_name)} ${await decrypt(patient.encrypted_last_name || '')}`
                : null,
              patient: undefined
            };
          })
        );

        return new Response(
          JSON.stringify({ appointments: decryptedAppointments }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'POST': {
        const body: AppointmentInput = await req.json();

        // Validate required fields
        if (!body.patient_id || !body.appointment_type || !body.scheduled_at) {
          return new Response(
            JSON.stringify({ error: "Patient ID, appointment type, and scheduled time are required" }),
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

        const durationMinutes = body.duration_minutes || 30;

        // Check for conflicts
        const { data: conflict } = await serviceClient.rpc('check_appointment_conflict', {
          p_provider_id: provider.id,
          p_scheduled_at: body.scheduled_at,
          p_duration_minutes: durationMinutes,
          p_exclude_appointment_id: null
        });

        if (conflict && conflict[0]?.has_conflict) {
          return new Response(
            JSON.stringify({
              error: "Appointment conflict detected",
              conflicting_appointment: {
                id: conflict[0].conflicting_appointment_id,
                start: conflict[0].conflicting_start,
                end: conflict[0].conflicting_end
              }
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create appointment
        const appointmentData: Record<string, unknown> = {
          patient_id: body.patient_id,
          provider_id: provider.id,
          appointment_type: body.appointment_type,
          reason_for_visit: body.reason_for_visit || null,
          notes_encrypted: body.notes ? await encrypt(body.notes) : null,
          scheduled_at: body.scheduled_at,
          duration_minutes: durationMinutes,
          timezone: body.timezone || 'UTC',
          is_telehealth: body.is_telehealth || false,
          telehealth_provider: body.is_telehealth ? (body.telehealth_provider || 'custom') : null,
          recurrence_rule: body.recurrence_rule || null,
          status: 'scheduled'
        };

        const { data: newAppointment, error } = await serviceClient
          .from('healthcare_appointments')
          .insert(appointmentData)
          .select('id')
          .single();

        if (error) throw error;

        // Generate telehealth URL if needed
        if (body.is_telehealth) {
          const telehealthUrl = generateTelehealthUrl(
            body.telehealth_provider || 'custom',
            newAppointment.id
          );

          await serviceClient
            .from('healthcare_appointments')
            .update({ telehealth_url: telehealthUrl })
            .eq('id', newAppointment.id);
        }

        await logAudit(
          serviceClient,
          user.id,
          body.patient_id,
          'create',
          'appointment',
          newAppointment.id,
          accessReason,
          req,
          { appointment_type: body.appointment_type, scheduled_at: body.scheduled_at }
        );

        return new Response(
          JSON.stringify({
            success: true,
            appointment_id: newAppointment.id,
            message: "Appointment scheduled successfully"
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'PUT': {
        if (!appointmentId) {
          return new Response(
            JSON.stringify({ error: "Appointment ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const action = url.searchParams.get('action');

        // Handle special actions
        if (action === 'check-in') {
          const { data: apt } = await supabase
            .from('healthcare_appointments')
            .select('patient_id')
            .eq('id', appointmentId)
            .single();

          const { error } = await supabase
            .from('healthcare_appointments')
            .update({
              status: 'checked_in',
              checked_in_at: new Date().toISOString()
            })
            .eq('id', appointmentId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            apt?.patient_id || null,
            'update',
            'appointment',
            appointmentId,
            accessReason,
            req,
            { action: 'check-in' }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Patient checked in" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (action === 'start') {
          const { data: apt } = await supabase
            .from('healthcare_appointments')
            .select('patient_id')
            .eq('id', appointmentId)
            .single();

          const { error } = await supabase
            .from('healthcare_appointments')
            .update({ status: 'in_progress' })
            .eq('id', appointmentId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            apt?.patient_id || null,
            'update',
            'appointment',
            appointmentId,
            accessReason,
            req,
            { action: 'start' }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Appointment started" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (action === 'complete') {
          const body = await req.json();
          const { data: apt } = await supabase
            .from('healthcare_appointments')
            .select('patient_id')
            .eq('id', appointmentId)
            .single();

          const { error } = await supabase
            .from('healthcare_appointments')
            .update({
              status: 'completed',
              created_record_id: body.record_id || null
            })
            .eq('id', appointmentId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            apt?.patient_id || null,
            'update',
            'appointment',
            appointmentId,
            accessReason,
            req,
            { action: 'complete', record_id: body.record_id }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Appointment completed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (action === 'cancel') {
          const body = await req.json();
          const { data: apt } = await supabase
            .from('healthcare_appointments')
            .select('patient_id')
            .eq('id', appointmentId)
            .single();

          const { error } = await supabase
            .from('healthcare_appointments')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: user.id,
              cancellation_reason: body.reason || null
            })
            .eq('id', appointmentId);

          if (error) throw error;

          await logAudit(
            serviceClient,
            user.id,
            apt?.patient_id || null,
            'update',
            'appointment',
            appointmentId,
            accessReason,
            req,
            { action: 'cancel', reason: body.reason }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Appointment cancelled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Regular update (reschedule)
        const body: Partial<AppointmentInput> = await req.json();
        const updateData: Record<string, unknown> = {};

        // Get current appointment for conflict check
        const { data: currentApt } = await supabase
          .from('healthcare_appointments')
          .select('patient_id, scheduled_at, duration_minutes')
          .eq('id', appointmentId)
          .single();

        if (body.scheduled_at) {
          // Check for conflicts if rescheduling
          const { data: conflict } = await serviceClient.rpc('check_appointment_conflict', {
            p_provider_id: provider.id,
            p_scheduled_at: body.scheduled_at,
            p_duration_minutes: body.duration_minutes || currentApt?.duration_minutes || 30,
            p_exclude_appointment_id: appointmentId
          });

          if (conflict && conflict[0]?.has_conflict) {
            return new Response(
              JSON.stringify({
                error: "Appointment conflict detected",
                conflicting_appointment: {
                  id: conflict[0].conflicting_appointment_id,
                  start: conflict[0].conflicting_start,
                  end: conflict[0].conflicting_end
                }
              }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          updateData.scheduled_at = body.scheduled_at;
          updateData.status = 'rescheduled';
        }

        if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes;
        if (body.appointment_type) updateData.appointment_type = body.appointment_type;
        if (body.reason_for_visit !== undefined) updateData.reason_for_visit = body.reason_for_visit;
        if (body.notes !== undefined) updateData.notes_encrypted = body.notes ? await encrypt(body.notes) : null;
        if (body.is_telehealth !== undefined) updateData.is_telehealth = body.is_telehealth;

        const { error } = await supabase
          .from('healthcare_appointments')
          .update(updateData)
          .eq('id', appointmentId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          currentApt?.patient_id || null,
          'update',
          'appointment',
          appointmentId,
          accessReason,
          req,
          { fields_updated: Object.keys(body) }
        );

        return new Response(
          JSON.stringify({ success: true, message: "Appointment updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'DELETE': {
        if (!appointmentId) {
          return new Response(
            JSON.stringify({ error: "Appointment ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: apt } = await supabase
          .from('healthcare_appointments')
          .select('patient_id')
          .eq('id', appointmentId)
          .single();

        // Soft delete - mark as cancelled
        const { error } = await supabase
          .from('healthcare_appointments')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancellation_reason: 'Deleted by provider'
          })
          .eq('id', appointmentId);

        if (error) throw error;

        await logAudit(
          serviceClient,
          user.id,
          apt?.patient_id || null,
          'delete',
          'appointment',
          appointmentId,
          accessReason,
          req
        );

        return new Response(
          JSON.stringify({ success: true, message: "Appointment cancelled" }),
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
    console.error('Healthcare appointments error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
