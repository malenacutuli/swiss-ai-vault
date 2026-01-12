// supabase/functions/email-ingest/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createArtifact } from "../_shared/artifacts/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface EmailPayload {
  message_id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  received_at?: string;
  // Security validation results from email provider
  spf_result?: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  dkim_result?: 'pass' | 'fail' | 'none';
  dmarc_result?: 'pass' | 'fail' | 'none';
}

interface Attachment {
  filename: string;
  content_type: string;
  size: number;
  content_base64: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify webhook secret
  const webhookSecret = req.headers.get('x-webhook-secret');
  const expectedSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET');

  if (expectedSecret && webhookSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const email: EmailPayload = await req.json();

    // Validate required fields
    if (!email.message_id || !email.from || !email.to?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message_id, from, to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security validation
    const securityCheck = validateEmailSecurity(email);
    if (!securityCheck.passed) {
      console.warn(`Email security check failed: ${securityCheck.reason}`);
      return new Response(
        JSON.stringify({ error: "Email failed security validation", reason: securityCheck.reason }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email address
    const recipientEmail = extractTaskEmail(email.to);
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "No valid task recipient found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = await findUserByTaskEmail(supabase, recipientEmail);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User not found for this email address" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate idempotency key
    const idempotencyKey = await generateIdempotencyKey(email.message_id, userId);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('email_ingestion')
      .select('id, run_id')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          run_id: existing.run_id,
          message: "Email already processed"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create email ingestion record
    const { data: ingestion, error: insertError } = await supabase
      .from('email_ingestion')
      .insert({
        message_id: email.message_id,
        idempotency_key: idempotencyKey,
        user_id: userId,
        from_address: email.from,
        to_addresses: email.to,
        cc_addresses: email.cc || [],
        subject: email.subject,
        body_text: email.body_text,
        body_html: email.body_html,
        attachments_count: email.attachments?.length || 0,
        status: 'processing',
        received_at: email.received_at || new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create ingestion record: ${insertError.message}`);
    }

    // Process attachments
    const artifactIds: string[] = [];
    if (email.attachments?.length) {
      for (const attachment of email.attachments) {
        try {
          const content = Uint8Array.from(atob(attachment.content_base64), c => c.charCodeAt(0));

          const result = await createArtifact(supabase, {
            content,
            type: getArtifactType(attachment.content_type),
            mime_type: attachment.content_type,
            file_name: attachment.filename,
            run_id: ingestion.id, // Temporary, will update after task creation
            step_id: ingestion.id,
            tool_name: 'email_ingest',
            metadata: {
              source: 'email',
              email_message_id: email.message_id,
              original_size: attachment.size
            }
          });

          artifactIds.push(result.artifact.id);
        } catch (e) {
          console.error(`Failed to process attachment ${attachment.filename}:`, e);
        }
      }
    }

    // Create agent task from email
    const prompt = buildTaskPrompt(email, artifactIds);

    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        user_id: userId,
        prompt,
        status: 'pending',
        config: {
          source: 'email',
          email_message_id: email.message_id,
          from_address: email.from,
          subject: email.subject,
          attachments: artifactIds
        }
      })
      .select()
      .single();

    if (taskError) {
      throw new Error(`Failed to create task: ${taskError.message}`);
    }

    // Update ingestion record with run_id
    await supabase
      .from('email_ingestion')
      .update({
        run_id: task.id,
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', ingestion.id);

    // Queue task for execution
    await supabase
      .from('agent_tasks')
      .update({ status: 'queued' })
      .eq('id', task.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: task.id,
        attachments_processed: artifactIds.length,
        message: "Email processed and task created"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Email ingestion error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function validateEmailSecurity(email: EmailPayload): { passed: boolean; reason?: string } {
  // Require at least SPF or DKIM pass
  const spfPass = email.spf_result === 'pass';
  const dkimPass = email.dkim_result === 'pass';
  const dmarcPass = email.dmarc_result === 'pass';

  if (!spfPass && !dkimPass) {
    return { passed: false, reason: 'Neither SPF nor DKIM passed' };
  }

  // Warn but allow if DMARC fails but SPF/DKIM pass
  if (!dmarcPass && (spfPass || dkimPass)) {
    console.warn('DMARC did not pass, but SPF/DKIM valid');
  }

  // Check for spoofing patterns
  const fromDomain = email.from.split('@')[1]?.toLowerCase();
  const suspiciousDomains = ['mailinator.com', 'tempmail.com', 'guerrillamail.com'];

  if (suspiciousDomains.some(d => fromDomain?.includes(d))) {
    return { passed: false, reason: 'Suspicious sender domain' };
  }

  return { passed: true };
}

function extractTaskEmail(toAddresses: string[]): string | null {
  // Look for task-{id}@swissbrain.ai or user-specific patterns
  for (const addr of toAddresses) {
    const lower = addr.toLowerCase();
    if (lower.includes('@swissbrain.ai') || lower.includes('@task.swissbrain.ai')) {
      return addr;
    }
  }
  return toAddresses[0] || null;
}

async function findUserByTaskEmail(supabase: any, email: string): Promise<string | null> {
  // Check if it's a task reply address (task-{encrypted_run_id}@swissbrain.ai)
  const taskMatch = email.match(/task-([a-zA-Z0-9]+)@/i);
  if (taskMatch) {
    // Decrypt and find original task owner
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('user_id')
      .eq('id', taskMatch[1])
      .single();

    if (task) return task.user_id;
  }

  // Otherwise, find user by their registered email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  return profile?.id || null;
}

async function generateIdempotencyKey(messageId: string, userId: string): Promise<string> {
  const data = `${messageId}:${userId}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getArtifactType(mimeType: string): 'file' | 'image' | 'document' | 'code' | 'data' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'data';
  if (mimeType.includes('text/') || mimeType.includes('javascript') || mimeType.includes('json')) return 'code';
  return 'file';
}

function buildTaskPrompt(email: EmailPayload, artifactIds: string[]): string {
  let prompt = `Email Task from ${email.from}\n\n`;
  prompt += `Subject: ${email.subject}\n\n`;

  if (email.body_text) {
    prompt += `Message:\n${email.body_text}\n\n`;
  }

  if (artifactIds.length > 0) {
    prompt += `Attachments (${artifactIds.length} files) have been uploaded and are available for processing.\n\n`;
  }

  prompt += `Please analyze this email and complete any requested tasks. If the email contains questions, provide thorough answers. If it contains documents to review, summarize the key points.`;

  return prompt;
}
