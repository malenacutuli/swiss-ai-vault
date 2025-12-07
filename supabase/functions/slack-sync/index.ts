import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLACK_API_BASE = 'https://slack.com/api';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SYNC_DAYS = 30;
const RATE_LIMIT_DELAY = 1200; // ~50 requests per minute

// Decrypt access token (must match encryption in slack-oauth)
async function decryptAccessToken(encryptedToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('SLACK_CLIENT_SECRET') || 'default-key';
  
  try {
    const [ivHex, encryptedHex] = encryptedToken.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encryptedData = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('slack-oauth-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt access token');
  }
}

// Make Slack API request with rate limiting and retry
async function slackApiRequest(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<any> {
  const url = new URL(`${SLACK_API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }
      
      return data;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`Request failed, retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

// Generate embedding using OpenAI
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || !text.trim()) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000), // Limit to ~8k chars
      }),
    });
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

// Fetch user info for name lookup
async function fetchUsers(accessToken: string): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  let cursor = '';
  
  do {
    const params: Record<string, string> = { limit: '200' };
    if (cursor) params.cursor = cursor;
    
    const data = await slackApiRequest('users.list', accessToken, params);
    
    for (const user of data.members || []) {
      userMap.set(user.id, user.real_name || user.name || user.id);
    }
    
    cursor = data.response_metadata?.next_cursor || '';
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  } while (cursor);
  
  return userMap;
}

// Fetch all channels
async function fetchChannels(accessToken: string): Promise<any[]> {
  const channels: any[] = [];
  let cursor = '';
  
  do {
    const params: Record<string, string> = { 
      limit: '200',
      types: 'public_channel,private_channel',
    };
    if (cursor) params.cursor = cursor;
    
    const data = await slackApiRequest('conversations.list', accessToken, params);
    channels.push(...(data.channels || []));
    
    cursor = data.response_metadata?.next_cursor || '';
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  } while (cursor);
  
  return channels;
}

// Fetch messages for a channel
async function fetchChannelMessages(
  accessToken: string,
  channelId: string,
  oldestTimestamp: string
): Promise<any[]> {
  const messages: any[] = [];
  let cursor = '';
  
  do {
    const params: Record<string, string> = { 
      channel: channelId,
      limit: '100',
      oldest: oldestTimestamp,
    };
    if (cursor) params.cursor = cursor;
    
    const data = await slackApiRequest('conversations.history', accessToken, params);
    messages.push(...(data.messages || []));
    
    cursor = data.response_metadata?.next_cursor || '';
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  } while (cursor);
  
  return messages;
}

// Fetch thread replies
async function fetchThreadReplies(
  accessToken: string,
  channelId: string,
  threadTs: string
): Promise<any[]> {
  try {
    const data = await slackApiRequest('conversations.replies', accessToken, {
      channel: channelId,
      ts: threadTs,
      limit: '100',
    });
    return data.messages || [];
  } catch (error) {
    console.error(`Failed to fetch thread ${threadTs}:`, error);
    return [];
  }
}

// Process and filter messages
function processMessages(
  messages: any[],
  channelName: string,
  userMap: Map<string, string>
): Array<{
  text: string;
  metadata: Record<string, any>;
  sourceId: string;
}> {
  const processed: Array<{ text: string; metadata: Record<string, any>; sourceId: string }> = [];
  
  for (const msg of messages) {
    // Skip bot messages, system messages, and empty messages
    if (msg.subtype || msg.bot_id || !msg.text?.trim()) continue;
    
    const userName = userMap.get(msg.user) || msg.user || 'Unknown';
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
    
    processed.push({
      text: msg.text,
      metadata: {
        channel: channelName,
        user: userName,
        timestamp,
        thread_id: msg.thread_ts || null,
        reply_count: msg.reply_count || 0,
      },
      sourceId: msg.ts,
    });
  }
  
  return processed;
}

// Combine thread messages into context chunks
function combineThreads(
  messages: Array<{ text: string; metadata: Record<string, any>; sourceId: string }>
): Array<{ text: string; metadata: Record<string, any>; sourceId: string }> {
  const threadMap = new Map<string, typeof messages>();
  const standalone: typeof messages = [];
  
  for (const msg of messages) {
    const threadId = msg.metadata.thread_id;
    if (threadId && threadId !== msg.sourceId) {
      // This is a reply
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(msg);
    } else {
      standalone.push(msg);
    }
  }
  
  // Combine thread replies with parent messages
  const combined: typeof messages = [];
  for (const msg of standalone) {
    const replies = threadMap.get(msg.sourceId) || [];
    if (replies.length > 0) {
      const threadText = [
        `${msg.metadata.user}: ${msg.text}`,
        ...replies.map(r => `  ${r.metadata.user}: ${r.text}`)
      ].join('\n');
      
      combined.push({
        text: threadText,
        metadata: {
          ...msg.metadata,
          is_thread: true,
          reply_count: replies.length,
        },
        sourceId: msg.sourceId,
      });
    } else {
      combined.push(msg);
    }
  }
  
  return combined;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { integration_id } = await req.json();
    
    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'Missing integration_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting Slack sync for integration: ${integration_id}`);

    // Fetch integration
    const { data: integration, error: integrationError } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (integration.integration_type !== 'slack') {
      return new Response(JSON.stringify({ error: 'Not a Slack integration' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt access token
    const accessToken = await decryptAccessToken(integration.encrypted_access_token);
    console.log('Access token decrypted successfully');

    // Calculate oldest timestamp (30 days ago or last sync)
    const thirtyDaysAgo = Math.floor((Date.now() - SYNC_DAYS * 24 * 60 * 60 * 1000) / 1000).toString();
    const oldestTimestamp = integration.last_synced_at 
      ? Math.floor(new Date(integration.last_synced_at).getTime() / 1000).toString()
      : thirtyDaysAgo;

    // Update sync status to 'syncing'
    await supabase
      .from('chat_integrations')
      .update({ metadata: { ...integration.metadata, sync_status: 'syncing', sync_progress: 0 } })
      .eq('id', integration_id);

    // Fetch users for name lookup
    console.log('Fetching Slack users...');
    const userMap = await fetchUsers(accessToken);
    console.log(`Fetched ${userMap.size} users`);

    // Fetch channels
    console.log('Fetching Slack channels...');
    const channels = await fetchChannels(accessToken);
    console.log(`Found ${channels.length} channels`);

    let totalMessagesSynced = 0;
    let channelsSynced = 0;

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      const progress = Math.round((i / channels.length) * 100);
      
      // Update progress
      await supabase
        .from('chat_integrations')
        .update({ metadata: { ...integration.metadata, sync_status: 'syncing', sync_progress: progress, current_channel: channel.name } })
        .eq('id', integration_id);

      console.log(`Syncing channel: ${channel.name} (${i + 1}/${channels.length})`);

      try {
        // Fetch messages
        const messages = await fetchChannelMessages(accessToken, channel.id, oldestTimestamp);
        console.log(`  Found ${messages.length} messages`);

        if (messages.length === 0) continue;

        // Fetch thread replies for messages with threads
        const messagesWithThreads = messages.filter(m => m.reply_count > 0 && m.thread_ts);
        for (const msg of messagesWithThreads) {
          const replies = await fetchThreadReplies(accessToken, channel.id, msg.thread_ts);
          messages.push(...replies.slice(1)); // Skip first (parent) message
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }

        // Process messages
        let processed = processMessages(messages, channel.name, userMap);
        processed = combineThreads(processed);

        console.log(`  Processing ${processed.length} message chunks`);

        // Store messages and generate embeddings
        for (const msg of processed) {
          // Check for existing message (deduplication)
          const { data: existing } = await supabase
            .from('chat_integration_data')
            .select('id')
            .eq('integration_id', integration_id)
            .eq('external_id', msg.sourceId)
            .single();

          if (existing) continue;

          // Store in chat_integration_data
          const { error: insertError } = await supabase
            .from('chat_integration_data')
            .insert({
              integration_id,
              data_type: 'slack_message',
              external_id: msg.sourceId,
              title: `#${msg.metadata.channel}`,
              snippet: msg.text.substring(0, 200),
              encrypted_content: msg.text, // Plain text for now, could encrypt
              metadata: msg.metadata,
              synced_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Failed to insert message:', insertError);
            continue;
          }

          // Generate embedding and store in document_chunks for RAG
          const embedding = await generateEmbedding(msg.text);
          if (embedding) {
            await supabase
              .from('document_chunks')
              .insert({
                user_id: user.id,
                conversation_id: null, // Global context
                filename: `slack:${msg.metadata.channel}`,
                content: msg.text,
                chunk_index: 0,
                embedding: `[${embedding.join(',')}]`,
                metadata: {
                  source: 'slack',
                  integration_id,
                  ...msg.metadata,
                },
              });
          }

          totalMessagesSynced++;
        }

        channelsSynced++;
      } catch (channelError) {
        console.error(`Error syncing channel ${channel.name}:`, channelError);
      }
    }

    // Update integration with completion status
    await supabase
      .from('chat_integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...integration.metadata,
          sync_status: 'completed',
          sync_progress: 100,
          last_sync_messages: totalMessagesSynced,
          last_sync_channels: channelsSynced,
        },
      })
      .eq('id', integration_id);

    console.log(`Sync completed: ${totalMessagesSynced} messages from ${channelsSynced} channels`);

    return new Response(JSON.stringify({
      success: true,
      messages_synced: totalMessagesSynced,
      channels_synced: channelsSynced,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Slack sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
