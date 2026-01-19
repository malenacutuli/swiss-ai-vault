// supabase/functions/slack-action/index.ts
// Slack Actions for Manus Parity - send_message, create_channel, search, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Slack API endpoints
const SLACK_API = 'https://slack.com/api';

// Action types
type SlackActionType =
  | 'send_message'
  | 'create_channel'
  | 'search_messages'
  | 'list_channels'
  | 'get_channel_history'
  | 'upload_file'
  | 'add_reaction'
  | 'get_user_info'
  | 'list_users';

interface SlackActionRequest {
  action: SlackActionType;
  // send_message params
  channel?: string;
  message?: string;
  thread_ts?: string;
  // create_channel params
  channel_name?: string;
  is_private?: boolean;
  // search params
  query?: string;
  // channel history params
  limit?: number;
  // file upload params
  filename?: string;
  file_content?: string;
  file_type?: string;
  // reaction params
  timestamp?: string;
  emoji?: string;
  // user info params
  user_id?: string;
  // Agent execution context
  run_id?: string;
  step_id?: string;
}

interface SlackActionResponse {
  success: boolean;
  action: SlackActionType;
  data?: any;
  error?: string;
}

// Decrypt stored credentials
async function decryptCredentials(encrypted: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SLACK_CLIENT_SECRET.slice(0, 32).padEnd(32, '0')),
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

// Get user's Slack token
async function getSlackToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_integrations')
    .select('encrypted_access_token')
    .eq('user_id', userId)
    .eq('integration_type', 'slack')
    .eq('is_active', true)
    .single();

  if (error || !data?.encrypted_access_token) {
    console.error('[slack-action] No Slack token found:', error);
    return null;
  }

  try {
    return await decryptCredentials(data.encrypted_access_token);
  } catch (e) {
    console.error('[slack-action] Failed to decrypt token:', e);
    return null;
  }
}

// Execute Slack API call
async function slackApiCall(
  token: string,
  method: string,
  body?: Record<string, any>
): Promise<any> {
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Slack API error');
  }

  return data;
}

// Action handlers
const actionHandlers: Record<SlackActionType, (token: string, params: SlackActionRequest) => Promise<any>> = {
  // Send a message to a channel
  async send_message(token, params) {
    if (!params.channel || !params.message) {
      throw new Error('channel and message are required');
    }

    const body: any = {
      channel: params.channel,
      text: params.message,
    };

    if (params.thread_ts) {
      body.thread_ts = params.thread_ts;
    }

    const result = await slackApiCall(token, 'chat.postMessage', body);

    return {
      message_ts: result.ts,
      channel: result.channel,
      message: params.message,
    };
  },

  // Create a new channel
  async create_channel(token, params) {
    if (!params.channel_name) {
      throw new Error('channel_name is required');
    }

    const method = params.is_private ? 'conversations.create' : 'conversations.create';
    const result = await slackApiCall(token, method, {
      name: params.channel_name.toLowerCase().replace(/\s+/g, '-'),
      is_private: params.is_private || false,
    });

    return {
      channel_id: result.channel.id,
      channel_name: result.channel.name,
      is_private: result.channel.is_private,
    };
  },

  // Search messages
  async search_messages(token, params) {
    if (!params.query) {
      throw new Error('query is required');
    }

    const result = await slackApiCall(token, 'search.messages', {
      query: params.query,
      count: params.limit || 20,
    });

    return {
      total: result.messages?.total || 0,
      matches: (result.messages?.matches || []).map((m: any) => ({
        text: m.text,
        user: m.user,
        channel: m.channel?.name,
        ts: m.ts,
        permalink: m.permalink,
      })),
    };
  },

  // List channels
  async list_channels(token, params) {
    const result = await slackApiCall(token, 'conversations.list', {
      types: 'public_channel,private_channel',
      limit: params.limit || 100,
    });

    return {
      channels: (result.channels || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
        num_members: c.num_members,
        purpose: c.purpose?.value,
      })),
    };
  },

  // Get channel history
  async get_channel_history(token, params) {
    if (!params.channel) {
      throw new Error('channel is required');
    }

    const result = await slackApiCall(token, 'conversations.history', {
      channel: params.channel,
      limit: params.limit || 50,
    });

    return {
      messages: (result.messages || []).map((m: any) => ({
        text: m.text,
        user: m.user,
        ts: m.ts,
        thread_ts: m.thread_ts,
        reply_count: m.reply_count,
      })),
      has_more: result.has_more,
    };
  },

  // Upload a file
  async upload_file(token, params) {
    if (!params.channel || !params.file_content) {
      throw new Error('channel and file_content are required');
    }

    // For file uploads, use multipart form
    const formData = new FormData();
    const blob = new Blob([params.file_content], { type: 'text/plain' });
    formData.append('file', blob, params.filename || 'file.txt');
    formData.append('channels', params.channel);
    if (params.filename) formData.append('filename', params.filename);

    const response = await fetch(`${SLACK_API}/files.upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.error);

    return {
      file_id: result.file.id,
      file_name: result.file.name,
      file_type: result.file.filetype,
      permalink: result.file.permalink,
    };
  },

  // Add reaction
  async add_reaction(token, params) {
    if (!params.channel || !params.timestamp || !params.emoji) {
      throw new Error('channel, timestamp, and emoji are required');
    }

    await slackApiCall(token, 'reactions.add', {
      channel: params.channel,
      timestamp: params.timestamp,
      name: params.emoji.replace(/:/g, ''),
    });

    return { success: true };
  },

  // Get user info
  async get_user_info(token, params) {
    if (!params.user_id) {
      throw new Error('user_id is required');
    }

    const result = await slackApiCall(token, 'users.info', {
      user: params.user_id,
    });

    return {
      id: result.user.id,
      name: result.user.name,
      real_name: result.user.real_name,
      email: result.user.profile?.email,
      title: result.user.profile?.title,
      status_text: result.user.profile?.status_text,
      is_bot: result.user.is_bot,
    };
  },

  // List users
  async list_users(token, params) {
    const result = await slackApiCall(token, 'users.list', {
      limit: params.limit || 100,
    });

    return {
      users: (result.members || [])
        .filter((u: any) => !u.deleted && !u.is_bot)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          real_name: u.real_name,
          email: u.profile?.email,
          title: u.profile?.title,
        })),
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
    const params: SlackActionRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[slack-action] User ${user.id} executing action: ${params.action}`);

    // Get user's Slack token
    const slackToken = await getSlackToken(supabase, user.id);
    if (!slackToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Slack not connected. Please connect Slack in settings.'
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

    const result = await handler(slackToken, params);

    // Log action for agent tracking
    if (params.run_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: params.run_id,
        step_id: params.step_id,
        output_type: 'slack_action',
        content: {
          action: params.action,
          result,
          executed_at: new Date().toISOString(),
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `slack_${params.action}`,
      resource_type: 'integration',
      resource_id: 'slack',
      metadata: {
        action: params.action,
        channel: params.channel,
        success: true,
      },
    }).catch(() => {}); // Non-critical

    const response: SlackActionResponse = {
      success: true,
      action: params.action,
      data: result,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[slack-action] Error:', error);

    const response: SlackActionResponse = {
      success: false,
      action: 'send_message',
      error: error.message || 'Action failed',
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
