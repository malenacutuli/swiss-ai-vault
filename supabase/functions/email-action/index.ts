// supabase/functions/email-action/index.ts
// Email Actions for Manus Parity - send, draft, search, reply via Gmail API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Gmail API endpoints
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Action types
type EmailActionType =
  | 'send'
  | 'draft'
  | 'search'
  | 'reply'
  | 'forward'
  | 'get_message'
  | 'list_messages'
  | 'list_labels'
  | 'get_thread';

interface EmailActionRequest {
  action: EmailActionType;
  // send/draft/reply params
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  html_body?: string;
  // reply/forward params
  thread_id?: string;
  message_id?: string;
  // search params
  query?: string;
  max_results?: number;
  // get params
  id?: string;
  // Agent execution context
  run_id?: string;
  step_id?: string;
}

interface EmailActionResponse {
  success: boolean;
  action: EmailActionType;
  data?: any;
  error?: string;
}

// Decrypt stored credentials (same as gmail-oauth)
async function decryptCredentials(encrypted: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(GOOGLE_CLIENT_SECRET.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

// Get user's Gmail token
async function getGmailToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_integrations')
    .select('encrypted_access_token, encrypted_refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('integration_type', 'gmail')
    .eq('is_active', true)
    .single();

  if (error || !data?.encrypted_access_token) {
    console.error('[email-action] No Gmail token found:', error);
    return null;
  }

  try {
    // Check if token is expired
    if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
      console.log('[email-action] Token expired, attempting refresh');
      // Token refresh would happen here - for now return existing token
      // In production, implement refresh logic
    }
    return await decryptCredentials(data.encrypted_access_token);
  } catch (e) {
    console.error('[email-action] Failed to decrypt token:', e);
    return null;
  }
}

// Execute Gmail API call
async function gmailApiCall(
  token: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${GMAIL_API}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[email-action] Gmail API error: ${response.status}`, errorText);
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}

// Create RFC 2822 formatted email
function createRawEmail(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `boundary_${Date.now()}`;

  let email = '';
  email += `To: ${params.to.join(', ')}\r\n`;
  if (params.cc?.length) email += `Cc: ${params.cc.join(', ')}\r\n`;
  if (params.bcc?.length) email += `Bcc: ${params.bcc.join(', ')}\r\n`;
  email += `Subject: ${params.subject}\r\n`;
  email += `MIME-Version: 1.0\r\n`;

  if (params.inReplyTo) {
    email += `In-Reply-To: ${params.inReplyTo}\r\n`;
    email += `References: ${params.references || params.inReplyTo}\r\n`;
  }

  if (params.htmlBody) {
    email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    email += `--${boundary}\r\n`;
    email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    email += `${params.body}\r\n\r\n`;
    email += `--${boundary}\r\n`;
    email += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    email += `${params.htmlBody}\r\n\r\n`;
    email += `--${boundary}--`;
  } else {
    email += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    email += params.body;
  }

  // Base64url encode
  return btoa(email)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Parse email message
function parseMessage(message: any): any {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

  let body = '';
  let htmlBody = '';

  // Extract body from parts
  const extractBody = (part: any) => {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (message.payload) {
    extractBody(message.payload);
  }

  return {
    id: message.id,
    thread_id: message.threadId,
    snippet: message.snippet,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body,
    html_body: htmlBody,
    labels: message.labelIds,
    message_id: getHeader('Message-ID'),
  };
}

// Action handlers
const actionHandlers: Record<EmailActionType, (token: string, params: EmailActionRequest) => Promise<any>> = {
  // Send an email
  async send(token, params) {
    if (!params.to?.length || !params.subject || !params.body) {
      throw new Error('to, subject, and body are required');
    }

    const raw = createRawEmail({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      htmlBody: params.html_body,
    });

    const result = await gmailApiCall(token, 'POST', '/messages/send', { raw });

    return {
      message_id: result.id,
      thread_id: result.threadId,
      labels: result.labelIds,
      sent_to: params.to,
      subject: params.subject,
    };
  },

  // Create a draft
  async draft(token, params) {
    if (!params.to?.length || !params.subject || !params.body) {
      throw new Error('to, subject, and body are required');
    }

    const raw = createRawEmail({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      htmlBody: params.html_body,
    });

    const result = await gmailApiCall(token, 'POST', '/drafts', {
      message: { raw },
    });

    return {
      draft_id: result.id,
      message_id: result.message?.id,
      thread_id: result.message?.threadId,
    };
  },

  // Search messages
  async search(token, params) {
    if (!params.query) {
      throw new Error('query is required');
    }

    const maxResults = params.max_results || 20;
    const endpoint = `/messages?q=${encodeURIComponent(params.query)}&maxResults=${maxResults}`;

    const result = await gmailApiCall(token, 'GET', endpoint);

    // Fetch details for each message
    const messages = [];
    for (const msg of (result.messages || []).slice(0, 10)) {
      try {
        const details = await gmailApiCall(token, 'GET', `/messages/${msg.id}?format=metadata`);
        const headers = details.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

        messages.push({
          id: details.id,
          thread_id: details.threadId,
          snippet: details.snippet,
          from: getHeader('From'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
        });
      } catch (e) {
        console.error(`[email-action] Failed to fetch message ${msg.id}:`, e);
      }
    }

    return {
      total_results: result.resultSizeEstimate || messages.length,
      messages,
      query: params.query,
    };
  },

  // Reply to a message
  async reply(token, params) {
    if (!params.thread_id || !params.body) {
      throw new Error('thread_id and body are required');
    }

    // Get the original message to extract headers
    const thread = await gmailApiCall(token, 'GET', `/threads/${params.thread_id}?format=metadata`);
    const lastMessage = thread.messages?.[thread.messages.length - 1];

    if (!lastMessage) {
      throw new Error('Could not find thread');
    }

    const headers = lastMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

    const originalFrom = getHeader('From');
    const originalSubject = getHeader('Subject') || '';
    const messageId = getHeader('Message-ID');

    // Determine reply-to address
    const replyTo = params.to?.length ? params.to : [originalFrom];
    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;

    const raw = createRawEmail({
      to: replyTo,
      cc: params.cc,
      subject,
      body: params.body,
      htmlBody: params.html_body,
      inReplyTo: messageId,
      references: messageId,
    });

    const result = await gmailApiCall(token, 'POST', '/messages/send', {
      raw,
      threadId: params.thread_id,
    });

    return {
      message_id: result.id,
      thread_id: result.threadId,
      replied_to: originalFrom,
      subject,
    };
  },

  // Forward a message
  async forward(token, params) {
    if (!params.message_id || !params.to?.length) {
      throw new Error('message_id and to are required');
    }

    // Get original message
    const original = await gmailApiCall(token, 'GET', `/messages/${params.message_id}?format=full`);
    const parsed = parseMessage(original);

    const forwardBody = params.body
      ? `${params.body}\n\n---------- Forwarded message ----------\nFrom: ${parsed.from}\nDate: ${parsed.date}\nSubject: ${parsed.subject}\n\n${parsed.body}`
      : `---------- Forwarded message ----------\nFrom: ${parsed.from}\nDate: ${parsed.date}\nSubject: ${parsed.subject}\n\n${parsed.body}`;

    const raw = createRawEmail({
      to: params.to,
      cc: params.cc,
      subject: `Fwd: ${parsed.subject}`,
      body: forwardBody,
    });

    const result = await gmailApiCall(token, 'POST', '/messages/send', { raw });

    return {
      message_id: result.id,
      thread_id: result.threadId,
      forwarded_to: params.to,
      original_from: parsed.from,
      subject: `Fwd: ${parsed.subject}`,
    };
  },

  // Get a single message
  async get_message(token, params) {
    if (!params.id) {
      throw new Error('id is required');
    }

    const result = await gmailApiCall(token, 'GET', `/messages/${params.id}?format=full`);
    return parseMessage(result);
  },

  // List recent messages
  async list_messages(token, params) {
    const maxResults = params.max_results || 20;
    const query = params.query || 'in:inbox';
    const endpoint = `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;

    const result = await gmailApiCall(token, 'GET', endpoint);

    const messages = [];
    for (const msg of (result.messages || []).slice(0, 10)) {
      try {
        const details = await gmailApiCall(token, 'GET', `/messages/${msg.id}?format=metadata`);
        const headers = details.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

        messages.push({
          id: details.id,
          thread_id: details.threadId,
          snippet: details.snippet,
          from: getHeader('From'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          labels: details.labelIds,
        });
      } catch (e) {
        console.error(`[email-action] Failed to fetch message ${msg.id}:`, e);
      }
    }

    return {
      messages,
      total: result.resultSizeEstimate || messages.length,
    };
  },

  // List labels
  async list_labels(token, _params) {
    const result = await gmailApiCall(token, 'GET', '/labels');

    return {
      labels: (result.labels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        messages_total: l.messagesTotal,
        messages_unread: l.messagesUnread,
      })),
    };
  },

  // Get a thread
  async get_thread(token, params) {
    if (!params.thread_id) {
      throw new Error('thread_id is required');
    }

    const result = await gmailApiCall(token, 'GET', `/threads/${params.thread_id}?format=full`);

    return {
      id: result.id,
      snippet: result.snippet,
      messages: (result.messages || []).map(parseMessage),
    };
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const params: EmailActionRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[email-action] User ${user.id} executing action: ${params.action}`);

    // Get user's Gmail token
    const gmailToken = await getGmailToken(supabase, user.id);
    if (!gmailToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gmail not connected. Please connect Gmail in settings.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute action
    const handler = actionHandlers[params.action];
    if (!handler) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action: ${params.action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await handler(gmailToken, params);

    // Log action for agent tracking
    if (params.run_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: params.run_id,
        step_id: params.step_id,
        output_type: 'email_action',
        content: {
          action: params.action,
          result: {
            ...result,
            body: undefined, // Don't log email body content
          },
          executed_at: new Date().toISOString(),
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `email_${params.action}`,
      resource_type: 'integration',
      resource_id: 'gmail',
      metadata: {
        action: params.action,
        to: params.to,
        subject: params.subject,
        success: true,
      },
    });
    // Non-critical audit log - don't await or handle errors

    const response: EmailActionResponse = {
      success: true,
      action: params.action,
      data: result,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[email-action] Error:', error);

    const response: EmailActionResponse = {
      success: false,
      action: 'send',
      error: error.message || 'Action failed',
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
