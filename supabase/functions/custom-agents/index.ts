// supabase/functions/custom-agents/index.ts
// Custom Agent management service

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type AgentAction =
  | 'create'             // Create a new custom agent
  | 'update'             // Update an agent
  | 'delete'             // Delete/archive an agent
  | 'get'                // Get agent details
  | 'list'               // List user's agents
  | 'list_public'        // List public agents
  | 'get_config'         // Get agent config for execution
  | 'clone'              // Clone an agent
  | 'clone_template'     // Clone from template
  | 'list_templates'     // List available templates
  | 'get_versions'       // Get version history
  | 'restore_version'    // Restore to a previous version
  | 'publish'            // Publish agent (make active)
  | 'unpublish'          // Unpublish agent (make draft)
  | 'generate_share_link' // Generate share link

interface AgentRequest {
  action: AgentAction;
  // Agent params
  agent_id?: string;
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enabled_tools?: string[];
  tool_config?: Record<string, any>;
  context_instructions?: string;
  starter_prompts?: string[];
  visibility?: 'private' | 'workspace' | 'public';
  workspace_id?: string;
  // Capabilities
  can_search_web?: boolean;
  can_execute_code?: boolean;
  can_browse_web?: boolean;
  can_generate_images?: boolean;
  can_access_files?: boolean;
  // Version params
  version?: number;
  change_summary?: string;
  // Template params
  template_slug?: string;
  // List params
  category?: string;
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate
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

    const params: AgentRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[custom-agents] User ${user.id} action: ${params.action}`);

    let result: any;

    switch (params.action) {
      // ===== CREATE =====
      case 'create': {
        if (!params.name) throw new Error('name is required');
        if (!params.system_prompt) throw new Error('system_prompt is required');

        const { data: createResult, error } = await supabase.rpc('create_custom_agent', {
          p_name: params.name,
          p_system_prompt: params.system_prompt,
          p_description: params.description || null,
          p_workspace_id: params.workspace_id || null,
          p_model: params.model || 'claude-3-5-sonnet',
          p_enabled_tools: params.enabled_tools || [],
          p_visibility: params.visibility || 'private',
        });

        if (error) throw error;
        if (!createResult?.success) {
          throw new Error(createResult?.error || 'Failed to create agent');
        }

        // Get full agent
        const { data: agent } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', createResult.agent_id)
          .single();

        // Update additional fields
        if (agent) {
          const updates: any = {};
          if (params.temperature !== undefined) updates.temperature = params.temperature;
          if (params.max_tokens !== undefined) updates.max_tokens = params.max_tokens;
          if (params.tool_config) updates.tool_config = params.tool_config;
          if (params.context_instructions) updates.context_instructions = params.context_instructions;
          if (params.starter_prompts) updates.starter_prompts = params.starter_prompts;
          if (params.can_search_web !== undefined) updates.can_search_web = params.can_search_web;
          if (params.can_execute_code !== undefined) updates.can_execute_code = params.can_execute_code;
          if (params.can_browse_web !== undefined) updates.can_browse_web = params.can_browse_web;
          if (params.can_generate_images !== undefined) updates.can_generate_images = params.can_generate_images;
          if (params.can_access_files !== undefined) updates.can_access_files = params.can_access_files;

          if (Object.keys(updates).length > 0) {
            await supabase.from('custom_agents').update(updates).eq('id', agent.id);
          }
        }

        result = { agent, slug: createResult.slug };
        break;
      }

      // ===== UPDATE =====
      case 'update': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const updates: Record<string, any> = {};
        if (params.name !== undefined) updates.name = params.name;
        if (params.description !== undefined) updates.description = params.description;
        if (params.system_prompt !== undefined) updates.system_prompt = params.system_prompt;
        if (params.model !== undefined) updates.model = params.model;
        if (params.temperature !== undefined) updates.temperature = params.temperature;
        if (params.max_tokens !== undefined) updates.max_tokens = params.max_tokens;
        if (params.enabled_tools !== undefined) updates.enabled_tools = params.enabled_tools;
        if (params.tool_config !== undefined) updates.tool_config = params.tool_config;
        if (params.context_instructions !== undefined) updates.context_instructions = params.context_instructions;
        if (params.starter_prompts !== undefined) updates.starter_prompts = params.starter_prompts;
        if (params.visibility !== undefined) updates.visibility = params.visibility;
        if (params.can_search_web !== undefined) updates.can_search_web = params.can_search_web;
        if (params.can_execute_code !== undefined) updates.can_execute_code = params.can_execute_code;
        if (params.can_browse_web !== undefined) updates.can_browse_web = params.can_browse_web;
        if (params.can_generate_images !== undefined) updates.can_generate_images = params.can_generate_images;
        if (params.can_access_files !== undefined) updates.can_access_files = params.can_access_files;

        const { data: updateResult, error } = await supabase.rpc('update_custom_agent', {
          p_agent_id: params.agent_id,
          p_updates: updates,
          p_change_summary: params.change_summary || null,
        });

        if (error) throw error;
        if (!updateResult?.success) {
          throw new Error(updateResult?.error || 'Failed to update agent');
        }

        // Get updated agent
        const { data: agent } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', params.agent_id)
          .single();

        result = { agent, version: updateResult.version };
        break;
      }

      // ===== DELETE =====
      case 'delete': {
        if (!params.agent_id) throw new Error('agent_id is required');

        // Archive instead of hard delete
        const { error } = await supabase
          .from('custom_agents')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', params.agent_id)
          .eq('user_id', user.id);

        if (error) throw error;

        result = { deleted: true };
        break;
      }

      // ===== GET =====
      case 'get': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const { data: agent, error } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', params.agent_id)
          .single();

        if (error || !agent) throw new Error('Agent not found');

        // Check access
        if (agent.user_id !== user.id && agent.visibility === 'private') {
          throw new Error('Access denied');
        }

        result = { agent };
        break;
      }

      // ===== LIST =====
      case 'list': {
        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;

        let query = supabase
          .from('custom_agents')
          .select('*')
          .eq('user_id', user.id)
          .neq('status', 'archived')
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (params.workspace_id) {
          query = query.eq('workspace_id', params.workspace_id);
        }

        const { data: agents, error } = await query;
        if (error) throw error;

        result = { agents: agents || [], limit, offset };
        break;
      }

      // ===== LIST_PUBLIC =====
      case 'list_public': {
        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;

        let query = supabase
          .from('custom_agents')
          .select('id, name, slug, description, icon, avatar_url, model, enabled_tools, starter_prompts, run_count, avg_satisfaction, created_at')
          .eq('visibility', 'public')
          .eq('status', 'active')
          .order('run_count', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data: agents, error } = await query;
        if (error) throw error;

        result = { agents: agents || [], limit, offset };
        break;
      }

      // ===== GET_CONFIG =====
      case 'get_config': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const { data: config, error } = await supabase.rpc('get_agent_config', {
          p_agent_id: params.agent_id,
        });

        if (error) throw error;
        if (!config) throw new Error('Agent not found or inactive');

        result = { config };
        break;
      }

      // ===== CLONE =====
      case 'clone': {
        if (!params.agent_id) throw new Error('agent_id is required');

        // Get source agent
        const { data: source } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', params.agent_id)
          .single();

        if (!source) throw new Error('Source agent not found');

        // Check access
        if (source.user_id !== user.id && source.visibility === 'private') {
          throw new Error('Access denied');
        }

        // Create clone
        const { data: createResult, error } = await supabase.rpc('create_custom_agent', {
          p_name: params.name || `${source.name} (Copy)`,
          p_system_prompt: source.system_prompt,
          p_description: source.description,
          p_workspace_id: params.workspace_id || null,
          p_model: source.model,
          p_enabled_tools: source.enabled_tools,
          p_visibility: 'private',
        });

        if (error) throw error;

        // Copy additional settings
        await supabase.from('custom_agents').update({
          temperature: source.temperature,
          max_tokens: source.max_tokens,
          tool_config: source.tool_config,
          context_instructions: source.context_instructions,
          starter_prompts: source.starter_prompts,
          can_search_web: source.can_search_web,
          can_execute_code: source.can_execute_code,
          can_browse_web: source.can_browse_web,
          can_generate_images: source.can_generate_images,
          can_access_files: source.can_access_files,
        }).eq('id', createResult.agent_id);

        // Get cloned agent
        const { data: agent } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', createResult.agent_id)
          .single();

        result = { agent };
        break;
      }

      // ===== CLONE_TEMPLATE =====
      case 'clone_template': {
        if (!params.template_slug) throw new Error('template_slug is required');

        const { data: cloneResult, error } = await supabase.rpc('clone_agent_from_template', {
          p_template_slug: params.template_slug,
          p_name: params.name || null,
          p_workspace_id: params.workspace_id || null,
        });

        if (error) throw error;
        if (!cloneResult?.success) {
          throw new Error(cloneResult?.error || 'Failed to clone template');
        }

        // Get agent
        const { data: agent } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', cloneResult.agent_id)
          .single();

        result = { agent };
        break;
      }

      // ===== LIST_TEMPLATES =====
      case 'list_templates': {
        let query = supabase
          .from('agent_templates')
          .select('*')
          .eq('status', 'active')
          .order('display_order', { ascending: true });

        if (params.category) {
          query = query.eq('category', params.category);
        }

        const { data: templates, error } = await query;
        if (error) throw error;

        result = { templates: templates || [] };
        break;
      }

      // ===== GET_VERSIONS =====
      case 'get_versions': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const { data: versions, error } = await supabase
          .from('custom_agent_versions')
          .select('*')
          .eq('agent_id', params.agent_id)
          .order('version', { ascending: false });

        if (error) throw error;

        result = { versions: versions || [] };
        break;
      }

      // ===== RESTORE_VERSION =====
      case 'restore_version': {
        if (!params.agent_id) throw new Error('agent_id is required');
        if (!params.version) throw new Error('version is required');

        // Get version
        const { data: version } = await supabase
          .from('custom_agent_versions')
          .select('*')
          .eq('agent_id', params.agent_id)
          .eq('version', params.version)
          .single();

        if (!version) throw new Error('Version not found');

        // Update agent to this version
        const { data: updateResult, error } = await supabase.rpc('update_custom_agent', {
          p_agent_id: params.agent_id,
          p_updates: {
            name: version.name,
            description: version.description,
            system_prompt: version.system_prompt,
            model: version.model,
            enabled_tools: version.enabled_tools,
            tool_config: version.tool_config,
          },
          p_change_summary: `Restored to version ${params.version}`,
        });

        if (error) throw error;

        result = { restored: true, new_version: updateResult.version };
        break;
      }

      // ===== PUBLISH =====
      case 'publish': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const { error } = await supabase
          .from('custom_agents')
          .update({ status: 'active', published_at: new Date().toISOString() })
          .eq('id', params.agent_id)
          .eq('user_id', user.id);

        if (error) throw error;

        result = { published: true };
        break;
      }

      // ===== UNPUBLISH =====
      case 'unpublish': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const { error } = await supabase
          .from('custom_agents')
          .update({ status: 'draft' })
          .eq('id', params.agent_id)
          .eq('user_id', user.id);

        if (error) throw error;

        result = { unpublished: true };
        break;
      }

      // ===== GENERATE_SHARE_LINK =====
      case 'generate_share_link': {
        if (!params.agent_id) throw new Error('agent_id is required');

        const shareToken = generateToken();

        const { error } = await supabase
          .from('custom_agents')
          .update({ share_token: shareToken })
          .eq('id', params.agent_id)
          .eq('user_id', user.id);

        if (error) throw error;

        result = { share_token: shareToken };
        break;
      }

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[custom-agents] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Generate token
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
