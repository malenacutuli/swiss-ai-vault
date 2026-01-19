import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'prompter' | 'viewer';
export type WorkspaceVisibility = 'private' | 'team' | 'public';

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  visibility: WorkspaceVisibility;
  share_token?: string;
  settings: Record<string, any>;
  max_members: number;
  max_runs: number;
  member_count: number;
  run_count: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  role?: WorkspaceRole; // User's role in the workspace
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  last_active_at: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

export interface WorkspaceActivity {
  id: string;
  activity_type: string;
  user_id?: string;
  target_type?: string;
  target_id?: string;
  data: Record<string, any>;
  created_at: string;
}

interface UseWorkspacesReturn {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  activities: WorkspaceActivity[];
  isLoading: boolean;

  // Workspace actions
  createWorkspace: (name: string, description?: string, visibility?: WorkspaceVisibility) => Promise<Workspace | null>;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => Promise<boolean>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  getWorkspace: (workspaceId: string) => Promise<Workspace | null>;
  listWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;

  // Member actions
  inviteMember: (workspaceId: string, email: string, role?: WorkspaceRole, message?: string) => Promise<{ invite_id: string; invite_token: string } | null>;
  acceptInvite: (inviteToken: string) => Promise<Workspace | null>;
  updateMemberRole: (workspaceId: string, memberUserId: string, newRole: WorkspaceRole) => Promise<boolean>;
  removeMember: (workspaceId: string, memberUserId: string) => Promise<boolean>;
  leaveWorkspace: (workspaceId: string) => Promise<boolean>;
  listMembers: (workspaceId: string) => Promise<void>;

  // Activity
  getActivity: (workspaceId: string, limit?: number) => Promise<void>;

  // Share link
  generateShareLink: (workspaceId: string) => Promise<string | null>;
  revokeShareLink: (workspaceId: string) => Promise<boolean>;

  // Permission check
  hasPermission: (permission: string) => boolean;
}

export function useWorkspaces(): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to call workspace-service
  const callService = useCallback(async (action: string, params: Record<string, any> = {}): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('workspace-service', {
      body: { action, ...params },
    });

    if (error) {
      console.error(`[useWorkspaces] ${action} error:`, error);
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Unknown error');
    }

    return data;
  }, []);

  // ===== Workspace Actions =====

  const createWorkspace = useCallback(async (
    name: string,
    description?: string,
    visibility: WorkspaceVisibility = 'private'
  ): Promise<Workspace | null> => {
    setIsLoading(true);
    try {
      const data = await callService('create', { name, description, visibility });
      const workspace = data.workspace as Workspace;
      setWorkspaces(prev => [{ ...workspace, role: 'owner' }, ...prev]);
      toast.success('Workspace created');
      return workspace;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  const updateWorkspace = useCallback(async (
    workspaceId: string,
    updates: Partial<Workspace>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const data = await callService('update', { workspace_id: workspaceId, ...updates });
      const workspace = data.workspace as Workspace;

      setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, ...workspace } : w));
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(prev => prev ? { ...prev, ...workspace } : null);
      }

      toast.success('Workspace updated');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workspace');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callService, currentWorkspace]);

  const deleteWorkspace = useCallback(async (workspaceId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callService('delete', { workspace_id: workspaceId });
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(null);
      }
      toast.success('Workspace archived');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callService, currentWorkspace]);

  const getWorkspace = useCallback(async (workspaceId: string): Promise<Workspace | null> => {
    setIsLoading(true);
    try {
      const data = await callService('get', { workspace_id: workspaceId });
      return { ...data.workspace, role: data.role } as Workspace;
    } catch (error: any) {
      console.error('Failed to get workspace:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  const listWorkspaces = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await callService('list');
      setWorkspaces(data.workspaces || []);
    } catch (error: any) {
      console.error('Failed to list workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  // ===== Member Actions =====

  const inviteMember = useCallback(async (
    workspaceId: string,
    email: string,
    role: WorkspaceRole = 'viewer',
    message?: string
  ): Promise<{ invite_id: string; invite_token: string } | null> => {
    try {
      const data = await callService('invite', { workspace_id: workspaceId, email, role, message });
      toast.success(`Invitation sent to ${email}`);
      return { invite_id: data.invite_id, invite_token: data.invite_token };
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
      return null;
    }
  }, [callService]);

  const acceptInvite = useCallback(async (inviteToken: string): Promise<Workspace | null> => {
    setIsLoading(true);
    try {
      const data = await callService('accept_invite', { invite_token: inviteToken });
      const workspace = data.workspace as Workspace;
      setWorkspaces(prev => [...prev, workspace]);
      toast.success(`Joined ${workspace.name}`);
      return workspace;
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  const updateMemberRole = useCallback(async (
    workspaceId: string,
    memberUserId: string,
    newRole: WorkspaceRole
  ): Promise<boolean> => {
    try {
      await callService('update_member_role', { workspace_id: workspaceId, member_user_id: memberUserId, role: newRole });
      setMembers(prev => prev.map(m => m.user_id === memberUserId ? { ...m, role: newRole } : m));
      toast.success('Member role updated');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
      return false;
    }
  }, [callService]);

  const removeMember = useCallback(async (workspaceId: string, memberUserId: string): Promise<boolean> => {
    try {
      await callService('remove_member', { workspace_id: workspaceId, member_user_id: memberUserId });
      setMembers(prev => prev.filter(m => m.user_id !== memberUserId));
      toast.success('Member removed');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
      return false;
    }
  }, [callService]);

  const leaveWorkspace = useCallback(async (workspaceId: string): Promise<boolean> => {
    try {
      await callService('leave', { workspace_id: workspaceId });
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(null);
      }
      toast.success('Left workspace');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave workspace');
      return false;
    }
  }, [callService, currentWorkspace]);

  const listMembers = useCallback(async (workspaceId: string): Promise<void> => {
    try {
      const data = await callService('list_members', { workspace_id: workspaceId });
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (error: any) {
      console.error('Failed to list members:', error);
    }
  }, [callService]);

  // ===== Activity =====

  const getActivity = useCallback(async (workspaceId: string, limit: number = 50): Promise<void> => {
    try {
      const data = await callService('get_activity', { workspace_id: workspaceId, limit });
      setActivities(data.activities || []);
    } catch (error: any) {
      console.error('Failed to get activity:', error);
    }
  }, [callService]);

  // ===== Share Link =====

  const generateShareLink = useCallback(async (workspaceId: string): Promise<string | null> => {
    try {
      const data = await callService('generate_share_link', { workspace_id: workspaceId });
      toast.success('Share link generated');
      return data.share_token;
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate share link');
      return null;
    }
  }, [callService]);

  const revokeShareLink = useCallback(async (workspaceId: string): Promise<boolean> => {
    try {
      await callService('revoke_share_link', { workspace_id: workspaceId });
      toast.success('Share link revoked');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke share link');
      return false;
    }
  }, [callService]);

  // ===== Permission Check =====

  const hasPermission = useCallback((permission: string): boolean => {
    if (!currentWorkspace?.role) return false;

    const role = currentWorkspace.role;
    const permissionMatrix: Record<string, WorkspaceRole[]> = {
      view: ['owner', 'admin', 'editor', 'prompter', 'viewer'],
      prompt: ['owner', 'admin', 'editor', 'prompter'],
      edit: ['owner', 'admin', 'editor'],
      create_run: ['owner', 'admin', 'editor'],
      manage_members: ['owner', 'admin'],
      manage_settings: ['owner', 'admin'],
      delete: ['owner'],
    };

    return permissionMatrix[permission]?.includes(role) || false;
  }, [currentWorkspace]);

  // Load workspaces on mount
  useEffect(() => {
    listWorkspaces();
  }, [listWorkspaces]);

  return {
    workspaces,
    currentWorkspace,
    members,
    invites,
    activities,
    isLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    getWorkspace,
    listWorkspaces,
    setCurrentWorkspace,
    inviteMember,
    acceptInvite,
    updateMemberRole,
    removeMember,
    leaveWorkspace,
    listMembers,
    getActivity,
    generateShareLink,
    revokeShareLink,
    hasPermission,
  };
}
