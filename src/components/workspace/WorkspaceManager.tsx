import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaces, type Workspace, type WorkspaceRole } from '@/hooks/useWorkspaces';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceList } from './WorkspaceList';
import { WorkspaceSettings } from './WorkspaceSettings';
import { WorkspaceMembersList } from './WorkspaceMembersList';
import { WorkspaceInviteDialog } from './WorkspaceInviteDialog';
import { WorkspaceActivityFeed } from './WorkspaceActivityFeed';

export function WorkspaceManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const {
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
    setCurrentWorkspace,
    inviteMember,
    updateMemberRole,
    removeMember,
    leaveWorkspace,
    listMembers,
    getActivity,
    generateShareLink,
    revokeShareLink,
    hasPermission,
  } = useWorkspaces();

  // Dialog/sheet states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  // Handle URL params
  useEffect(() => {
    const workspaceId = searchParams.get('workspace');
    if (workspaceId) {
      loadWorkspace(workspaceId);
    }
  }, [searchParams]);

  const loadWorkspace = async (workspaceId: string) => {
    const workspace = await getWorkspace(workspaceId);
    if (workspace) {
      setSelectedWorkspace(workspace);
      setCurrentWorkspace(workspace);
      await listMembers(workspaceId);
      await getActivity(workspaceId);
    }
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    navigate(`/workspaces?workspace=${workspace.id}`);
  };

  const handleOpenSettings = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setIsCreating(false);
    setSettingsOpen(true);
  };

  const handleOpenMembers = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setCurrentWorkspace(workspace);
    await listMembers(workspace.id);
    setMembersOpen(true);
  };

  const handleOpenInvite = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setCurrentWorkspace(workspace);
    setInviteOpen(true);
  };

  const handleOpenActivity = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setCurrentWorkspace(workspace);
    await getActivity(workspace.id);
    setActivityOpen(true);
  };

  const handleCreateWorkspace = () => {
    setSelectedWorkspace(null);
    setIsCreating(true);
    setSettingsOpen(true);
  };

  const handleLeaveWorkspace = async (workspace: Workspace) => {
    await leaveWorkspace(workspace.id);
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    await deleteWorkspace(workspace.id);
  };

  const handleSaveSettings = async (workspaceId: string, updates: Partial<Workspace>): Promise<boolean> => {
    return await updateWorkspace(workspaceId, updates);
  };

  const handleInvite = async (email: string, role: WorkspaceRole, message?: string) => {
    if (!selectedWorkspace) return null;
    return await inviteMember(selectedWorkspace.id, email, role, message);
  };

  const handleUpdateMemberRole = async (memberUserId: string, newRole: WorkspaceRole): Promise<boolean> => {
    if (!selectedWorkspace) return false;
    return await updateMemberRole(selectedWorkspace.id, memberUserId, newRole);
  };

  const handleRemoveMember = async (memberUserId: string): Promise<boolean> => {
    if (!selectedWorkspace) return false;
    return await removeMember(selectedWorkspace.id, memberUserId);
  };

  const handleGenerateShareLink = async (): Promise<string | null> => {
    if (!selectedWorkspace) return null;
    return await generateShareLink(selectedWorkspace.id);
  };

  const handleRevokeShareLink = async (): Promise<boolean> => {
    if (!selectedWorkspace) return false;
    return await revokeShareLink(selectedWorkspace.id);
  };

  const canManageSelected = selectedWorkspace?.role === 'owner' || selectedWorkspace?.role === 'admin';

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-muted-foreground">
            Collaborate with your team in shared workspaces
          </p>
        </div>
        {selectedWorkspace && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenActivity(selectedWorkspace)}>
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenMembers(selectedWorkspace)}>
              <Users className="h-4 w-4 mr-2" />
              Members
            </Button>
            {canManageSelected && (
              <Button variant="outline" size="sm" onClick={() => handleOpenSettings(selectedWorkspace)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Workspace List */}
      <WorkspaceList
        workspaces={workspaces}
        isLoading={isLoading}
        onSelect={handleSelectWorkspace}
        onSettings={handleOpenSettings}
        onMembers={handleOpenMembers}
        onInvite={handleOpenInvite}
        onLeave={handleLeaveWorkspace}
        onDelete={handleDeleteWorkspace}
        onCreate={handleCreateWorkspace}
      />

      {/* Settings Dialog */}
      <WorkspaceSettings
        workspace={isCreating ? null : selectedWorkspace}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={handleSaveSettings}
        isNew={isCreating}
        onCreate={createWorkspace}
      />

      {/* Members Sheet */}
      <WorkspaceMembersList
        workspace={selectedWorkspace}
        members={members}
        invites={invites}
        currentUserId={user?.id}
        open={membersOpen}
        onOpenChange={setMembersOpen}
        onUpdateRole={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
        onInvite={() => {
          setMembersOpen(false);
          setInviteOpen(true);
        }}
        canManage={canManageSelected}
      />

      {/* Invite Dialog */}
      <WorkspaceInviteDialog
        workspace={selectedWorkspace}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
        onGenerateShareLink={handleGenerateShareLink}
        onRevokeShareLink={handleRevokeShareLink}
      />

      {/* Activity Feed Sheet */}
      <WorkspaceActivityFeed
        workspace={selectedWorkspace}
        activities={activities}
        open={activityOpen}
        onOpenChange={setActivityOpen}
      />
    </div>
  );
}
