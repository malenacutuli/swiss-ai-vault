// supabase/functions/notion-action/index.ts
// Notion Actions for Manus Parity - create_page, update_page, search, add_to_database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_CLIENT_SECRET = Deno.env.get('NOTION_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Notion API endpoints
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Action types
type NotionActionType =
  | 'create_page'
  | 'update_page'
  | 'get_page'
  | 'archive_page'
  | 'search'
  | 'list_databases'
  | 'query_database'
  | 'add_to_database'
  | 'create_database'
  | 'get_block_children'
  | 'append_blocks';

interface NotionBlock {
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'toggle' | 'code' | 'quote' | 'callout' | 'divider';
  content?: string;
  checked?: boolean; // for to_do
  language?: string; // for code
}

interface NotionProperty {
  name: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'status';
  value: any;
}

interface NotionActionRequest {
  action: NotionActionType;
  // Page params
  page_id?: string;
  parent_id?: string; // page_id or database_id
  parent_type?: 'page' | 'database';
  title?: string;
  icon?: string; // emoji
  cover_url?: string;
  // Content
  blocks?: NotionBlock[];
  properties?: NotionProperty[];
  // Search params
  query?: string;
  filter?: { property?: string; value?: string };
  sort?: { property: string; direction: 'ascending' | 'descending' };
  page_size?: number;
  // Database params
  database_id?: string;
  // Block params
  block_id?: string;
  // Agent execution context
  run_id?: string;
  step_id?: string;
}

interface NotionActionResponse {
  success: boolean;
  action: NotionActionType;
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
    encoder.encode(NOTION_CLIENT_SECRET.slice(0, 32).padEnd(32, '0')),
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

// Get user's Notion token
async function getNotionToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_integrations')
    .select('encrypted_access_token, metadata')
    .eq('user_id', userId)
    .eq('integration_type', 'notion')
    .eq('is_active', true)
    .single();

  if (error || !data?.encrypted_access_token) {
    console.error('[notion-action] No Notion token found:', error);
    return null;
  }

  try {
    return await decryptCredentials(data.encrypted_access_token);
  } catch (e) {
    console.error('[notion-action] Failed to decrypt token:', e);
    return null;
  }
}

// Execute Notion API call
async function notionApiCall(
  token: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${NOTION_API}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[notion-action] Notion API error: ${response.status}`, errorData);
    throw new Error(errorData.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

// Convert simple block to Notion block format
function convertToNotionBlock(block: NotionBlock): any {
  const textContent = block.content ? [{
    type: 'text',
    text: { content: block.content },
  }] : [];

  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        paragraph: { rich_text: textContent },
      };
    case 'heading_1':
      return {
        type: 'heading_1',
        heading_1: { rich_text: textContent },
      };
    case 'heading_2':
      return {
        type: 'heading_2',
        heading_2: { rich_text: textContent },
      };
    case 'heading_3':
      return {
        type: 'heading_3',
        heading_3: { rich_text: textContent },
      };
    case 'bulleted_list_item':
      return {
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: textContent },
      };
    case 'numbered_list_item':
      return {
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: textContent },
      };
    case 'to_do':
      return {
        type: 'to_do',
        to_do: {
          rich_text: textContent,
          checked: block.checked || false,
        },
      };
    case 'toggle':
      return {
        type: 'toggle',
        toggle: { rich_text: textContent },
      };
    case 'code':
      return {
        type: 'code',
        code: {
          rich_text: textContent,
          language: block.language || 'plain text',
        },
      };
    case 'quote':
      return {
        type: 'quote',
        quote: { rich_text: textContent },
      };
    case 'callout':
      return {
        type: 'callout',
        callout: {
          rich_text: textContent,
          icon: { emoji: '💡' },
        },
      };
    case 'divider':
      return { type: 'divider', divider: {} };
    default:
      return {
        type: 'paragraph',
        paragraph: { rich_text: textContent },
      };
  }
}

// Convert property to Notion format
function convertToNotionProperty(prop: NotionProperty): any {
  switch (prop.type) {
    case 'title':
      return {
        title: [{ type: 'text', text: { content: String(prop.value) } }],
      };
    case 'rich_text':
      return {
        rich_text: [{ type: 'text', text: { content: String(prop.value) } }],
      };
    case 'number':
      return { number: Number(prop.value) };
    case 'select':
      return { select: { name: String(prop.value) } };
    case 'multi_select':
      const values = Array.isArray(prop.value) ? prop.value : [prop.value];
      return { multi_select: values.map(v => ({ name: String(v) })) };
    case 'date':
      return { date: { start: prop.value } };
    case 'checkbox':
      return { checkbox: Boolean(prop.value) };
    case 'url':
      return { url: String(prop.value) };
    case 'email':
      return { email: String(prop.value) };
    case 'phone_number':
      return { phone_number: String(prop.value) };
    case 'status':
      return { status: { name: String(prop.value) } };
    default:
      return {
        rich_text: [{ type: 'text', text: { content: String(prop.value) } }],
      };
  }
}

// Parse Notion page to simpler format
function parseNotionPage(page: any): any {
  const properties: Record<string, any> = {};

  for (const [key, prop] of Object.entries(page.properties || {})) {
    const p = prop as any;
    switch (p.type) {
      case 'title':
        properties[key] = p.title?.[0]?.plain_text || '';
        break;
      case 'rich_text':
        properties[key] = p.rich_text?.[0]?.plain_text || '';
        break;
      case 'number':
        properties[key] = p.number;
        break;
      case 'select':
        properties[key] = p.select?.name;
        break;
      case 'multi_select':
        properties[key] = p.multi_select?.map((s: any) => s.name) || [];
        break;
      case 'date':
        properties[key] = p.date?.start;
        break;
      case 'checkbox':
        properties[key] = p.checkbox;
        break;
      case 'url':
        properties[key] = p.url;
        break;
      case 'email':
        properties[key] = p.email;
        break;
      case 'status':
        properties[key] = p.status?.name;
        break;
      default:
        properties[key] = p;
    }
  }

  return {
    id: page.id,
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    archived: page.archived,
    icon: page.icon?.emoji || page.icon?.external?.url,
    cover: page.cover?.external?.url,
    parent_type: page.parent?.type,
    parent_id: page.parent?.page_id || page.parent?.database_id,
    properties,
  };
}

// Action handlers
const actionHandlers: Record<NotionActionType, (token: string, params: NotionActionRequest) => Promise<any>> = {
  // Create a new page
  async create_page(token, params) {
    if (!params.parent_id || !params.title) {
      throw new Error('parent_id and title are required');
    }

    const parentType = params.parent_type || 'page';
    const parent = parentType === 'database'
      ? { database_id: params.parent_id }
      : { page_id: params.parent_id };

    // Build properties
    const properties: any = {};
    if (parentType === 'page') {
      properties.title = {
        title: [{ type: 'text', text: { content: params.title } }],
      };
    } else {
      // For database, find title property
      properties.Name = {
        title: [{ type: 'text', text: { content: params.title } }],
      };
    }

    // Add custom properties
    if (params.properties) {
      for (const prop of params.properties) {
        properties[prop.name] = convertToNotionProperty(prop);
      }
    }

    const body: any = {
      parent,
      properties,
    };

    // Add icon
    if (params.icon) {
      body.icon = { type: 'emoji', emoji: params.icon };
    }

    // Add cover
    if (params.cover_url) {
      body.cover = { type: 'external', external: { url: params.cover_url } };
    }

    // Add content blocks
    if (params.blocks?.length) {
      body.children = params.blocks.map(convertToNotionBlock);
    }

    const result = await notionApiCall(token, 'POST', '/pages', body);
    return parseNotionPage(result);
  },

  // Update an existing page
  async update_page(token, params) {
    if (!params.page_id) {
      throw new Error('page_id is required');
    }

    const body: any = {};

    // Update properties
    if (params.properties?.length || params.title) {
      body.properties = {};

      if (params.title) {
        body.properties.title = {
          title: [{ type: 'text', text: { content: params.title } }],
        };
      }

      if (params.properties) {
        for (const prop of params.properties) {
          body.properties[prop.name] = convertToNotionProperty(prop);
        }
      }
    }

    // Update icon
    if (params.icon) {
      body.icon = { type: 'emoji', emoji: params.icon };
    }

    // Update cover
    if (params.cover_url) {
      body.cover = { type: 'external', external: { url: params.cover_url } };
    }

    const result = await notionApiCall(token, 'PATCH', `/pages/${params.page_id}`, body);
    return parseNotionPage(result);
  },

  // Get a page
  async get_page(token, params) {
    if (!params.page_id) {
      throw new Error('page_id is required');
    }

    const result = await notionApiCall(token, 'GET', `/pages/${params.page_id}`);
    return parseNotionPage(result);
  },

  // Archive a page
  async archive_page(token, params) {
    if (!params.page_id) {
      throw new Error('page_id is required');
    }

    const result = await notionApiCall(token, 'PATCH', `/pages/${params.page_id}`, {
      archived: true,
    });

    return {
      id: result.id,
      archived: true,
    };
  },

  // Search across Notion
  async search(token, params) {
    const body: any = {
      page_size: params.page_size || 20,
    };

    if (params.query) {
      body.query = params.query;
    }

    if (params.filter?.property === 'object') {
      body.filter = { property: 'object', value: params.filter.value };
    }

    if (params.sort) {
      body.sort = {
        direction: params.sort.direction,
        timestamp: 'last_edited_time',
      };
    }

    const result = await notionApiCall(token, 'POST', '/search', body);

    return {
      results: (result.results || []).map((item: any) => {
        if (item.object === 'page') {
          return { type: 'page', ...parseNotionPage(item) };
        }
        return {
          type: 'database',
          id: item.id,
          title: item.title?.[0]?.plain_text || 'Untitled',
          url: item.url,
        };
      }),
      has_more: result.has_more,
      next_cursor: result.next_cursor,
    };
  },

  // List databases the integration has access to
  async list_databases(token, params) {
    const body: any = {
      filter: { property: 'object', value: 'database' },
      page_size: params.page_size || 20,
    };

    const result = await notionApiCall(token, 'POST', '/search', body);

    return {
      databases: (result.results || []).map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        url: db.url,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time,
        properties: Object.keys(db.properties || {}),
      })),
      has_more: result.has_more,
    };
  },

  // Query a database
  async query_database(token, params) {
    if (!params.database_id) {
      throw new Error('database_id is required');
    }

    const body: any = {
      page_size: params.page_size || 20,
    };

    // Add filter if provided
    if (params.filter?.property && params.filter?.value) {
      body.filter = {
        property: params.filter.property,
        rich_text: { contains: params.filter.value },
      };
    }

    // Add sort if provided
    if (params.sort) {
      body.sorts = [{
        property: params.sort.property,
        direction: params.sort.direction,
      }];
    }

    const result = await notionApiCall(token, 'POST', `/databases/${params.database_id}/query`, body);

    return {
      results: (result.results || []).map(parseNotionPage),
      has_more: result.has_more,
      next_cursor: result.next_cursor,
    };
  },

  // Add a row to a database
  async add_to_database(token, params) {
    if (!params.database_id) {
      throw new Error('database_id is required');
    }

    // Get database schema to understand properties
    const dbInfo = await notionApiCall(token, 'GET', `/databases/${params.database_id}`);
    const dbProperties = dbInfo.properties || {};

    // Build properties
    const properties: any = {};

    // Find title property
    const titleProp = Object.entries(dbProperties).find(
      ([_, prop]) => (prop as any).type === 'title'
    );

    if (titleProp && params.title) {
      properties[titleProp[0]] = {
        title: [{ type: 'text', text: { content: params.title } }],
      };
    }

    // Add custom properties
    if (params.properties) {
      for (const prop of params.properties) {
        properties[prop.name] = convertToNotionProperty(prop);
      }
    }

    const body: any = {
      parent: { database_id: params.database_id },
      properties,
    };

    // Add content blocks
    if (params.blocks?.length) {
      body.children = params.blocks.map(convertToNotionBlock);
    }

    const result = await notionApiCall(token, 'POST', '/pages', body);
    return parseNotionPage(result);
  },

  // Create a new database
  async create_database(token, params) {
    if (!params.parent_id || !params.title) {
      throw new Error('parent_id and title are required');
    }

    const properties: any = {
      Name: { title: {} },
    };

    // Add custom property definitions
    if (params.properties) {
      for (const prop of params.properties) {
        switch (prop.type) {
          case 'rich_text':
            properties[prop.name] = { rich_text: {} };
            break;
          case 'number':
            properties[prop.name] = { number: {} };
            break;
          case 'select':
            const selectOptions = Array.isArray(prop.value) ? prop.value : [];
            properties[prop.name] = {
              select: { options: selectOptions.map(o => ({ name: o })) },
            };
            break;
          case 'multi_select':
            const multiOptions = Array.isArray(prop.value) ? prop.value : [];
            properties[prop.name] = {
              multi_select: { options: multiOptions.map(o => ({ name: o })) },
            };
            break;
          case 'date':
            properties[prop.name] = { date: {} };
            break;
          case 'checkbox':
            properties[prop.name] = { checkbox: {} };
            break;
          case 'url':
            properties[prop.name] = { url: {} };
            break;
          case 'email':
            properties[prop.name] = { email: {} };
            break;
          case 'status':
            properties[prop.name] = { status: {} };
            break;
        }
      }
    }

    const body = {
      parent: { page_id: params.parent_id },
      title: [{ type: 'text', text: { content: params.title } }],
      properties,
    };

    const result = await notionApiCall(token, 'POST', '/databases', body);

    return {
      id: result.id,
      title: result.title?.[0]?.plain_text,
      url: result.url,
      properties: Object.keys(result.properties || {}),
    };
  },

  // Get block children (content of a page)
  async get_block_children(token, params) {
    if (!params.block_id && !params.page_id) {
      throw new Error('block_id or page_id is required');
    }

    const blockId = params.block_id || params.page_id;
    const result = await notionApiCall(token, 'GET', `/blocks/${blockId}/children?page_size=100`);

    return {
      blocks: (result.results || []).map((block: any) => ({
        id: block.id,
        type: block.type,
        content: block[block.type]?.rich_text?.[0]?.plain_text || '',
        has_children: block.has_children,
      })),
      has_more: result.has_more,
      next_cursor: result.next_cursor,
    };
  },

  // Append blocks to a page
  async append_blocks(token, params) {
    if ((!params.block_id && !params.page_id) || !params.blocks?.length) {
      throw new Error('block_id (or page_id) and blocks are required');
    }

    const blockId = params.block_id || params.page_id;
    const children = params.blocks.map(convertToNotionBlock);

    const result = await notionApiCall(token, 'PATCH', `/blocks/${blockId}/children`, {
      children,
    });

    return {
      appended_count: result.results?.length || 0,
      blocks: (result.results || []).map((block: any) => ({
        id: block.id,
        type: block.type,
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
    const params: NotionActionRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notion-action] User ${user.id} executing action: ${params.action}`);

    // Get user's Notion token
    const notionToken = await getNotionToken(supabase, user.id);
    if (!notionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Notion not connected. Please connect Notion in settings.'
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

    const result = await handler(notionToken, params);

    // Log action for agent tracking
    if (params.run_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: params.run_id,
        step_id: params.step_id,
        output_type: 'notion_action',
        content: {
          action: params.action,
          result: {
            id: result.id,
            url: result.url,
            title: result.title || result.properties?.title,
          },
          executed_at: new Date().toISOString(),
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `notion_${params.action}`,
      resource_type: 'integration',
      resource_id: 'notion',
      metadata: {
        action: params.action,
        page_id: params.page_id,
        database_id: params.database_id,
        success: true,
      },
    });
    // Non-critical audit log - don't await or handle errors

    const response: NotionActionResponse = {
      success: true,
      action: params.action,
      data: result,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[notion-action] Error:', error);

    const response: NotionActionResponse = {
      success: false,
      action: 'search',
      error: error.message || 'Action failed',
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
