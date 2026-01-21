// supabase/functions/workspace-service/index.ts
// Workspace management service for collaboration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateToken, extractToken } from "../_shared/cross-project-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  try {
    // Authenticate using cross-project auth (supports both local and Lovable tokens)
    const token = extractToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authResult = await authenticateToken(token, supabase);
    if (!authResult.user) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error || 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = authResult.user;
    console.log(`[workspace-service] Authenticated via ${authResult.source}`);

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

        // Direct insert (more reliable with cross-project auth)
        const { data: workspace, error: createError } = await supabase
          .from('workspaces')
          .insert({
            owner_id: user.id,
            name: params.name,
            description: params.description || null,
            visibility: params.visibility || 'private',
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add owner as member
        await supabase.from('workspace_members').insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        });

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: workspace.id,
          user_id: user.id,
          activity_type: 'workspace_created',
        });

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

        // Check user has permission
        const { data: userMembership } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
          throw new Error('Permission denied');
        }

        // Create invite with unique token
        const inviteToken = generateToken() + generateToken();
        const { data: invite, error: inviteError } = await supabase
          .from('workspace_invites')
          .insert({
            workspace_id: params.workspace_id,
            email: params.email,
            role: params.role || 'viewer',
            created_by: user.id,
            message: params.message || null,
            invite_token: inviteToken,
          })
          .select()
          .single();

        if (inviteError) throw inviteError;

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: params.workspace_id,
          user_id: user.id,
          activity_type: 'member_invited',
          data: { email: params.email, role: params.role || 'viewer' },
        });

        result = {
          invite_id: invite.id,
          invite_token: invite.invite_token,
        };
        break;
      }

      // ===== ACCEPT_INVITE =====
      case 'accept_invite': {
        if (!params.invite_token) throw new Error('invite_token is required');

        // Get invite
        const { data: invite, error: inviteError } = await supabase
          .from('workspace_invites')
          .select('*')
          .eq('invite_token', params.invite_token)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .single();

        if (inviteError || !invite) {
          throw new Error('Invalid or expired invite');
        }

        // Update invite status
        await supabase
          .from('workspace_invites')
          .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
          .eq('id', invite.id);

        // Add member (upsert)
        await supabase
          .from('workspace_members')
          .upsert({
            workspace_id: invite.workspace_id,
            user_id: user.id,
            role: invite.role,
            invited_by: invite.created_by,
            status: 'active',
            accepted_at: new Date().toISOString(),
          }, { onConflict: 'workspace_id,user_id' });

        // Update member count
        const { count } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', invite.workspace_id)
          .eq('status', 'active');

        await supabase
          .from('workspaces')
          .update({ member_count: count || 1 })
          .eq('id', invite.workspace_id);

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: invite.workspace_id,
          user_id: user.id,
          activity_type: 'member_joined',
          data: { role: invite.role },
        });

        // Get workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', invite.workspace_id)
          .single();

        result = { workspace };
        break;
      }

      // ===== UPDATE_MEMBER_ROLE =====
      case 'update_member_role': {
        if (!params.workspace_id) throw new Error('workspace_id is required');
        if (!params.member_user_id) throw new Error('member_user_id is required');
        if (!params.role) throw new Error('role is required');

        // Check user has permission
        const { data: callerMember } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
          throw new Error('Permission denied');
        }

        // Get target member's current role
        const { data: targetMember } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', params.member_user_id)
          .single();

        if (!targetMember) {
          throw new Error('Member not found');
        }

        if (targetMember.role === 'owner') {
          throw new Error('Cannot change owner role');
        }

        if (callerMember.role === 'admin' && params.role === 'owner') {
          throw new Error('Only owner can transfer ownership');
        }

        // Update role
        await supabase
          .from('workspace_members')
          .update({ role: params.role, updated_at: new Date().toISOString() })
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', params.member_user_id);

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: params.workspace_id,
          user_id: user.id,
          activity_type: 'member_role_changed',
          target_type: 'member',
          target_id: params.member_user_id,
          data: { from_role: targetMember.role, to_role: params.role },
        });

        result = { updated: true };
        break;
      }

      // ===== REMOVE_MEMBER =====
      case 'remove_member': {
        if (!params.workspace_id) throw new Error('workspace_id is required');
        if (!params.member_user_id) throw new Error('member_user_id is required');

        // Check user has permission (or is removing themselves)
        const { data: callerMember } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (user.id !== params.member_user_id && (!callerMember || !['owner', 'admin'].includes(callerMember.role))) {
          throw new Error('Permission denied');
        }

        // Can't remove owner
        const { data: targetMember } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', params.member_user_id)
          .single();

        if (targetMember?.role === 'owner') {
          throw new Error('Cannot remove workspace owner');
        }

        // Remove member
        await supabase
          .from('workspace_members')
          .update({ status: 'removed', updated_at: new Date().toISOString() })
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', params.member_user_id);

        // Update member count
        const { count } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', params.workspace_id)
          .eq('status', 'active');

        await supabase
          .from('workspaces')
          .update({ member_count: count || 0 })
          .eq('id', params.workspace_id);

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: params.workspace_id,
          user_id: user.id,
          activity_type: user.id === params.member_user_id ? 'member_left' : 'member_removed',
          target_type: 'member',
          target_id: params.member_user_id,
        });

        result = { removed: true };
        break;
      }

      // ===== LEAVE =====
      case 'leave': {
        if (!params.workspace_id) throw new Error('workspace_id is required');

        // Can't leave if owner
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id)
          .single();

        if (memberData?.role === 'owner') {
          throw new Error('Owner cannot leave workspace. Transfer ownership first.');
        }

        // Remove self
        await supabase
          .from('workspace_members')
          .update({ status: 'removed', updated_at: new Date().toISOString() })
          .eq('workspace_id', params.workspace_id)
          .eq('user_id', user.id);

        // Update member count
        const { count } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', params.workspace_id)
          .eq('status', 'active');

        await supabase
          .from('workspaces')
          .update({ member_count: count || 0 })
          .eq('id', params.workspace_id);

        // Log activity
        await supabase.from('workspace_activity').insert({
          workspace_id: params.workspace_id,
          user_id: user.id,
          activity_type: 'member_left',
          target_type: 'member',
          target_id: user.id,
        });

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
          .select('id, user_id, role, status, last_active_at, created_at')
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

        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;

        const { data: activities, error } = await supabase
          .from('workspace_activity')
          .select('id, activity_type, user_id, target_type, target_id, data, created_at')
          .eq('workspace_id', params.workspace_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

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
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!member) return false;

  const role = member.role;

  switch (permission) {
    case 'view':
      return true;
    case 'prompt':
      return ['owner', 'admin', 'editor', 'prompter'].includes(role);
    case 'edit':
    case 'create_run':
      return ['owner', 'admin', 'editor'].includes(role);
    case 'manage_members':
    case 'manage_settings':
      return ['owner', 'admin'].includes(role);
    case 'delete':
      return role === 'owner';
    default:
      return false;
  }
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
