// supabase/functions/workspace-service/index.ts
// Workspace management service for collaboration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Lovable-managed project for cross-project auth validation
const LOVABLE_SUPABASE_URL = 'https://rljnrgscmosgkcjdvlrq.supabase.co';
const LOVABLE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsam5yZ3NjbW9zZ2tjamR2bHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDIxNzIsImV4cCI6MjA4MDQxODE3Mn0.C_Y5OyGaIH3QPX15QTfwafe-_y7YzHvO4z6HU55Y1-A';

type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'prompter' | 'viewer';

type WorkspaceAction =
  | 'create'              // Create a new workspace
  | 'update'              // Update workspace settings
  | 'delete'              // Delete/archive workspace
  | 'get'                 // Get workspace details
  | 'list'                // List user's workspaces
  | 'invite'              // Invite member by email
  | 'accept_invite'       // Accept invite by token
  | 'update_member_role'  // Change member role
  | 'remove_member'       // Remove member
  | 'leave'               // Leave workspace
  | 'list_members'        // List workspace members
  | 'get_activity'        // Get activity feed
  | 'generate_share_link' // Generate/regenerate share link
  | 'revoke_share_link';  // Revoke share link

interface WorkspaceRequest {
  action: WorkspaceAction;
  // Workspace params
  workspace_id?: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  visibility?: 'private' | 'team' | 'public';
  settings?: Record<string, any>;
  // Member params
  member_user_id?: string;
  email?: string;
  role?: WorkspaceRole;
  message?: string;
  // Invite params
  invite_token?: string;
  // List params
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate - try local project first, then Lovable project
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Try local project auth first
    let user = null;
    const { data: localAuth, error: localError } = await supabase.auth.getUser(token);

    if (!localError && localAuth?.user) {
      user = localAuth.user;
      console.log('[workspace-service] Authenticated via local project');
    } else {
      // Fallback: Try Lovable project auth (for cross-project requests)
      const lovableClient = createClient(LOVABLE_SUPABASE_URL, LOVABLE_ANON_KEY);
      const { data: lovableAuth, error: lovableError } = await lovableClient.auth.getUser(token);

      if (!lovableError && lovableAuth?.user) {
        user = lovableAuth.user;
        console.log('[workspace-service] Authenticated via Lovable project');
      }
    }

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params: WorkspaceRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[workspace-service] User ${user.id} action: ${params.action}`);

    let result: any;

    switch (params.action) {
      // ===== CREATE =====
      case 'create': {
        if (!params.name) {
          throw new Error('name is required');
        }

        // Use stored procedure
        const { data: createResult, error } = await supabase.rpc('create_workspace', {
          p_name: params.name,
          p_description: params.description || null,
          p_visibility: params.visibility || 'private',
        });

        if (error) throw error;
        if (!createResult?.success) {
          throw new Error(createResult?.error || 'Failed to create workspace');
        }

        // Get full workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', createResult.workspace_id)
          .single();

        result = { workspace };
        break;
      }

      // ===== UPDATE =====
      case 'update': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        // Check permission
        const hasPermission = await checkPermission(supabase, params.workspace_id, user.id, 'manage_settings');
        if (!hasPermission) {
          throw new Error('Permission denied');
        }

        const updates: any = { updated_at: new Date().toISOString() };
        if (params.name !== undefined) updates.name = params.name;
        if (params.description !== undefined) updates.description = params.description;
        if (params.icon !== undefined) updates.icon = params.icon;
        if (params.color !== undefined) updates.color = params.color;
        if (params.visibility !== undefined) updates.visibility = params.visibility;
        if (params.settings !== undefined) updates.settings = params.settings;

        const { data: workspace, error } = await supabase
          .from('workspaces')
          .update(updates)
          .eq('id', params.workspace_id)
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await logActivity(supabase, params.workspace_id, user.id, 'workspace_updated', null, null, { updates });

        result = { workspace };
        break;
      }

      // ===== DELETE =====
      case 'delete': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        // Only owner can delete
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', params.workspace_id)
          .single();

        if (!workspace || workspace.owner_id !== user.id) {
          throw new Error('Only the workspace owner can delete it');
        }

        // Archive instead of hard delete
        await supabase
          .from('workspaces')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', params.workspace_id);

        await logActivity(supabase, params.workspace_id, user.id, 'workspace_archived');

        result = { deleted: true };
        break;
      }

      // ===== GET =====
      case 'get': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        // Check if user has access
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        const { data: workspace, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', params.workspace_id)
          .single();

        if (error || !workspace) throw new Error('Workspace not found');

        // Check access
        if (!membership && workspace.visibility !== 'public') {
          throw new Error('Access denied');
        }

        result = { workspace, role: membership?.role || 'guest' };
        break;
      }

      // ===== LIST =====
      case 'list': {
        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;

        const { data: workspaces, error } = await supabase
          .from('workspace_members')
          .select(`
            role,
            workspace:workspaces (
              id, name, description, icon, color, visibility,
              owner_id, member_count, run_count, created_at, updated_at
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .range(offset, offset + limit - 1);

        if (error) throw error;

        result = {
          workspaces: workspaces?.map(w => ({ ...w.workspace, role: w.role })) || [],
          limit,
          offset,
        };
        break;
      }

      // ===== INVITE =====
      case 'invite': {
        if (!params.workspace_id) throw new Error('workspace_id is required');
        if (!params.email) throw new Error('email is required');

        const { data: inviteResult, error } = await supabase.rpc('invite_workspace_member', {
          p_workspace_id: params.workspace_id,
          p_email: params.email,
          p_role: params.role || 'viewer',
          p_message: params.message || null,
        });

        if (error) throw error;
        if (!inviteResult?.success) {
          throw new Error(inviteResult?.error || 'Failed to send invite');
        }

        result = {
          invite_id: inviteResult.invite_id,
          invite_token: inviteResult.invite_token,
        };
        break;
      }

      // ===== ACCEPT_INVITE =====
      case 'accept_invite': {
        if (!params.invite_token) throw new Error('invite_token is required');

        const { data: acceptResult, error } = await supabase.rpc('accept_workspace_invite', {
          p_invite_token: params.invite_token,
        });

        if (error) throw error;
        if (!acceptResult?.success) {
          throw new Error(acceptResult?.error || 'Failed to accept invite');
        }

        // Get workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', acceptResult.workspace_id)
          .single();

        result = { workspace };
        break;
      }

      // ===== UPDATE_MEMBER_ROLE =====
      case 'update_member_role': {
        if (!params.workspace_id) throw new Error('workspace_id is required');
        if (!params.member_user_id) throw new Error('member_user_id is required');
        if (!params.role) throw new Error('role is required');

        const { data: updateResult, error } = await supabase.rpc('update_workspace_member_role', {
          p_workspace_id: params.workspace_id,
          p_member_user_id: params.member_user_id,
          p_new_role: params.role,
        });

        if (error) throw error;
        if (!updateResult?.success) {
          throw new Error(updateResult?.error || 'Failed to update role');
        }

        result = { updated: true };
        break;
      }

      // ===== REMOVE_MEMBER =====
      case 'remove_member': {
        if (!params.workspace_id) throw new Error('workspace_id is required');
        if (!params.member_user_id) throw new Error('member_user_id is required');

        const { data: removeResult, error } = await supabase.rpc('remove_workspace_member', {
          p_workspace_id: params.workspace_id,
          p_member_user_id: params.member_user_id,
        });

        if (error) throw error;
        if (!removeResult?.success) {
          throw new Error(removeResult?.error || 'Failed to remove member');
        }

        result = { removed: true };
        break;
      }

      // ===== LEAVE =====
      case 'leave': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        const { data: leaveResult, error } = await supabase.rpc('remove_workspace_member', {
          p_workspace_id: params.workspace_id,
          p_member_user_id: user.id,
        });

        if (error) throw error;
        if (!leaveResult?.success) {
          throw new Error(leaveResult?.error || 'Failed to leave workspace');
        }

        result = { left: true };
        break;
      }

      // ===== LIST_MEMBERS =====
      case 'list_members': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        // Check access
        const hasAccess = await checkPermission(supabase, params.workspace_id, user.id, 'view');
        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const { data: members, error } = await supabase
          .from('workspace_members')
          .select(`
            id, user_id, role, status, last_active_at, created_at,
            user:auth.users (
              id, email, raw_user_meta_data
            )
          `)
          .eq('workspace_id', params.workspace_id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Get pending invites
        const { data: invites } = await supabase
          .from('workspace_invites')
          .select('id, email, role, status, created_at, expires_at')
          .eq('workspace_id', params.workspace_id)
          .eq('status', 'pending');

        result = { members: members || [], invites: invites || [] };
        break;
      }

      // ===== GET_ACTIVITY =====
      case 'get_activity': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        const hasAccess = await checkPermission(supabase, params.workspace_id, user.id, 'view');
        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const { data: activities, error } = await supabase.rpc('get_workspace_activity', {
          p_workspace_id: params.workspace_id,
          p_limit: params.limit || 50,
          p_offset: params.offset || 0,
        });

        if (error) throw error;

        result = { activities: activities || [] };
        break;
      }

      // ===== GENERATE_SHARE_LINK =====
      case 'generate_share_link': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        const hasPermission = await checkPermission(supabase, params.workspace_id, user.id, 'manage_settings');
        if (!hasPermission) {
          throw new Error('Permission denied');
        }

        // Generate new share token
        const shareToken = generateToken();

        const { data: workspace, error } = await supabase
          .from('workspaces')
          .update({ share_token: shareToken })
          .eq('id', params.workspace_id)
          .select()
          .single();

        if (error) throw error;

        result = { share_token: shareToken };
        break;
      }

      // ===== REVOKE_SHARE_LINK =====
      case 'revoke_share_link': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        const hasPermission = await checkPermission(supabase, params.workspace_id, user.id, 'manage_settings');
        if (!hasPermission) {
          throw new Error('Permission denied');
        }

        await supabase
          .from('workspaces')
          .update({ share_token: null })
          .eq('id', params.workspace_id);

        result = { revoked: true };
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
    console.error('[workspace-service] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Check permission
async function checkPermission(
  supabase: any,
  workspaceId: string,
  userId: string,
  permission: string
): Promise<boolean> {
  const { data } = await supabase.rpc('check_workspace_permission', {
    p_workspace_id: workspaceId,
    p_permission: permission,
  });
  return data === true;
}

// Helper: Log activity
async function logActivity(
  supabase: any,
  workspaceId: string,
  userId: string,
  activityType: string,
  targetType?: string | null,
  targetId?: string | null,
  data?: Record<string, any>
): Promise<void> {
  await supabase.from('workspace_activity').insert({
    workspace_id: workspaceId,
    user_id: userId,
    activity_type: activityType,
    target_type: targetType,
    target_id: targetId,
    data: data || {},
  });
}

// Helper: Generate token
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
