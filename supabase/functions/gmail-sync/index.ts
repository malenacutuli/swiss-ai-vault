import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Labels to exclude by default for privacy
const EXCLUDED_LABELS_DEFAULT = ['CATEGORY_PERSONAL', 'CATEGORY_SOCIAL'];
const CONFIDENTIAL_KEYWORDS = ['confidential', 'private', 'secret', 'password'];

function decryptToken(encrypted: string): string {
  return atob(encrypted);
}

function encryptToken(token: string): string {
  return btoa(token);
}

// Refresh token if expired
async function getValidAccessToken(
  integration: any,
  supabase: any
): Promise<string> {
  const tokenExpiry = new Date(integration.token_expires_at);
  const now = new Date();
  
  // If token is still valid (with 5 min buffer), use it
  if (tokenExpiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return decryptToken(integration.encrypted_access_token);
  }

  console.log('Token expired, refreshing...');

  if (!integration.encrypted_refresh_token) {
    throw new Error('No refresh token available');
  }

  const refreshToken = decryptToken(integration.encrypted_refresh_token);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokenData = await tokenResponse.json();
  const newExpiry = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

  // Update stored token
  await supabase
    .from('chat_integrations')
    .update({
      encrypted_access_token: encryptToken(tokenData.access_token),
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return tokenData.access_token;
}

// Strip HTML tags
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Decode base64url
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

// Extract message body
function extractBody(payload: any): string {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart - look for text/plain first, then text/html
  if (payload.parts) {
    // First pass: look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    
    // Second pass: look for text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(decodeBase64Url(part.body.data));
      }
    }

    // Recursive for nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const body = extractBody(part);
        if (body) return body;
      }
    }
  }

  return '';
}

// Get header value
function getHeader(headers: any[], name: string): string {
  const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

// Check if message should be excluded
function shouldExcludeMessage(subject: string, labels: string[], excludeLabels: string[]): boolean {
  // Check confidential keywords
  const lowerSubject = subject.toLowerCase();
  if (CONFIDENTIAL_KEYWORDS.some(kw => lowerSubject.includes(kw))) {
    return true;
  }

  // Check excluded labels
  if (labels.some(l => excludeLabels.includes(l))) {
    return true;
  }

  return false;
}

// Chunk text for RAG
function chunkText(text: string, maxTokens = 500): { content: string; index: number }[] {
  const chunks: { content: string; index: number }[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const estimatedTokens = (currentChunk + sentence).split(/\s+/).length * 1.3;
    
    if (estimatedTokens > maxTokens && currentChunk) {
      chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

// Generate embeddings
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration_id, options = {} } = await req.json();

    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'integration_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      query = '',
      max_results = 500,
      label_ids = [],
      exclude_labels = EXCLUDED_LABELS_DEFAULT,
      days_back = 30,
    } = options;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get integration
    const { data: integration, error: intError } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('id', integration_id)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(integration, supabase);
    const userId = integration.user_id;

    console.log(`Starting Gmail sync for user ${userId}`);

    // Build search query
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days_back);
    const afterQuery = `after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`;
    const fullQuery = query ? `${query} ${afterQuery}` : afterQuery;

    // List messages
    const listUrl = new URL(`${GMAIL_API_BASE}/messages`);
    listUrl.searchParams.set('maxResults', String(Math.min(max_results, 500)));
    listUrl.searchParams.set('q', fullQuery);
    if (label_ids.length > 0) {
      listUrl.searchParams.set('labelIds', label_ids.join(','));
    }

    const listResponse = await fetch(listUrl.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Gmail list failed:', errorText);
      throw new Error('Failed to list Gmail messages');
    }

    const listData = await listResponse.json();
    const messageIds = listData.messages || [];

    console.log(`Found ${messageIds.length} messages to process`);

    // Group messages by thread
    const threadMap = new Map<string, any[]>();
    let messagesProcessed = 0;

    for (const { id } of messageIds.slice(0, max_results)) {
      try {
        // Get full message
        const msgResponse = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) continue;

        const message = await msgResponse.json();
        const threadId = message.threadId;
        const headers = message.payload?.headers || [];
        const labels = message.labelIds || [];

        const subject = getHeader(headers, 'Subject');
        const from = getHeader(headers, 'From');
        const to = getHeader(headers, 'To');
        const date = getHeader(headers, 'Date');

        // Check exclusions
        if (shouldExcludeMessage(subject, labels, exclude_labels)) {
          console.log(`Skipping excluded message: ${subject.substring(0, 50)}`);
          continue;
        }

        const body = extractBody(message.payload);

        // Get attachments info
        const attachments: string[] = [];
        function findAttachments(parts: any[]) {
          if (!parts) return;
          for (const part of parts) {
            if (part.filename && part.filename.length > 0) {
              attachments.push(part.filename);
            }
            if (part.parts) findAttachments(part.parts);
          }
        }
        findAttachments(message.payload?.parts);

        const messageData = {
          id,
          threadId,
          from,
          to,
          subject,
          date,
          body: body.substring(0, 10000), // Limit body size
          labels,
          attachments,
          internalDate: message.internalDate,
        };

        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, []);
        }
        threadMap.get(threadId)!.push(messageData);
        messagesProcessed++;

        // Rate limiting
        if (messagesProcessed % 50 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }

      } catch (msgError) {
        console.error(`Error processing message ${id}:`, msgError);
      }
    }

    console.log(`Processed ${messagesProcessed} messages in ${threadMap.size} threads`);

    // Process and store threads
    let threadsSynced = 0;
    let totalChunks = 0;

    for (const [threadId, messages] of threadMap) {
      try {
        // Sort messages chronologically
        messages.sort((a, b) => Number(a.internalDate) - Number(b.internalDate));

        // Format thread content
        const threadSubject = messages[0].subject;
        const threadContent = messages.map(m => {
          return `From: ${m.from}\nTo: ${m.to}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}`;
        }).join('\n\n---\n\n');

        const allLabels = [...new Set(messages.flatMap(m => m.labels))];
        const allAttachments = [...new Set(messages.flatMap(m => m.attachments))];
        const messageIds = messages.map(m => m.id);

        // Check if thread already exists
        const { data: existing } = await supabase
          .from('chat_integration_data')
          .select('id')
          .eq('integration_id', integration_id)
          .eq('external_id', threadId)
          .maybeSingle();

        const integrationDataPayload = {
          integration_id,
          data_type: 'gmail_thread',
          external_id: threadId,
          title: threadSubject || 'No Subject',
          encrypted_content: btoa(unescape(encodeURIComponent(threadContent))),
          snippet: threadContent.substring(0, 200),
          metadata: {
            thread_id: threadId,
            message_ids: messageIds,
            labels: allLabels,
            has_attachments: allAttachments.length > 0,
            attachment_names: allAttachments,
            message_count: messages.length,
            first_date: messages[0].date,
            last_date: messages[messages.length - 1].date,
          },
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase
            .from('chat_integration_data')
            .update(integrationDataPayload)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('chat_integration_data')
            .insert(integrationDataPayload);
        }

        // Delete old chunks for this thread
        await supabase
          .from('document_chunks')
          .delete()
          .eq('user_id', userId)
          .eq('metadata->>source', 'gmail')
          .eq('metadata->>thread_id', threadId);

        // Create chunks for RAG
        const chunks = chunkText(threadContent);

        if (chunks.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batch.map(c => c.content));

            const chunkRecords = batch.map((chunk, idx) => ({
              user_id: userId,
              filename: `[Gmail] ${threadSubject || 'No Subject'}`,
              content: chunk.content,
              chunk_index: chunk.index,
              embedding: embeddings[idx],
              file_type: 'gmail',
              metadata: {
                source: 'gmail',
                thread_id: threadId,
                subject: threadSubject,
                message_count: messages.length,
              },
            }));

            await supabase.from('document_chunks').insert(chunkRecords);
            totalChunks += chunkRecords.length;
          }
        }

        threadsSynced++;

      } catch (threadError) {
        console.error(`Error processing thread ${threadId}:`, threadError);
      }
    }

    // Update last synced timestamp and history ID
    await supabase
      .from('chat_integrations')
      .update({ 
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...integration.metadata,
          last_history_id: listData.nextPageToken || null,
        },
      })
      .eq('id', integration_id);

    console.log(`Gmail sync complete: ${threadsSynced} threads, ${totalChunks} chunks`);

    return new Response(JSON.stringify({
      success: true,
      threads_synced: threadsSynced,
      messages_processed: messagesProcessed,
      total_chunks: totalChunks,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Gmail sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
