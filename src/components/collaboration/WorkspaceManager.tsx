import { useState, useEffect } from 'react';
import {
  Building2, Plus, Users, Settings, Trash2, UserPlus, Shield, Crown,
  MoreVertical, Mail, Check, X, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  createWorkspace, getWorkspaces, addWorkspaceMember, removeWorkspaceMember,
  updateMemberRole, updateWorkspaceSettings,
  type TeamWorkspace, type TeamMember, type TeamRole
} from '@/lib/collaboration/team-workspace';

interface WorkspaceManagerProps {
  currentUserId: string;
  currentUserEmail: string;
  currentUserName: string;
  onWorkspaceSelect?: (workspace: TeamWorkspace) => void;
}

export function WorkspaceManager({
  currentUserId, currentUserEmail, currentUserName, onWorkspaceSelect
}: WorkspaceManagerProps) {
  const { toast } = useToast();
  
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<TeamWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'workspace' | 'member'; id: string } | null>(null);
  
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('viewer');
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);
  
  const loadWorkspaces = () => {
    setIsLoading(true);
    const loaded = getWorkspaces();
    setWorkspaces(loaded);
    if (loaded.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(loaded[0]);
    }
    setIsLoading(false);
  };
  
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);
    try {
      const workspace = createWorkspace(newWorkspaceName, currentUserId, currentUserEmail, currentUserName);
      setWorkspaces([...workspaces, workspace]);
      setSelectedWorkspace(workspace);
      setShowCreateDialog(false);
      setNewWorkspaceName('');
      toast({ title: 'Workspace created', description: `"${workspace.name}" is ready` });
    } catch {
      toast({ title: 'Failed to create workspace', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleInviteMember = async () => {
    if (!selectedWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      addWorkspaceMember(selectedWorkspace.id, {
        id: crypto.randomUUID(),
        email: inviteEmail,
        name: inviteEmail.split('@')[0],
        role: inviteRole,
        permissions: inviteRole === 'admin' ? ['view', 'comment', 'edit', 'admin'] : inviteRole === 'editor' ? ['view', 'comment', 'edit'] : ['view', 'comment']
      });
      loadWorkspaces();
      setShowInviteDialog(false);
      setInviteEmail('');
      toast({ title: 'Invitation sent', description: `Invited ${inviteEmail} as ${inviteRole}` });
    } catch {
      toast({ title: 'Failed to invite', variant: 'destructive' });
    } finally {
      setIsInviting(false);
    }
  };
  
  const handleRemoveMember = (memberId: string) => {
    if (!selectedWorkspace) return;
    removeWorkspaceMember(selectedWorkspace.id, memberId);
    loadWorkspaces();
    toast({ title: 'Member removed' });
    setDeleteConfirm(null);
  };
  
  const handleUpdateRole = (memberId: string, role: TeamRole) => {
    if (!selectedWorkspace) return;
    updateMemberRole(selectedWorkspace.id, memberId, role);
    loadWorkspaces();
    toast({ title: 'Role updated' });
  };
  
  const getRoleBadgeVariant = (role: TeamRole) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Workspaces</h2>
          <p className="text-sm text-muted-foreground">Collaborate securely with your team</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Workspace</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>Create a new team workspace for collaboration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Workspace name</Label>
                <Input placeholder="e.g., Research Team" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateWorkspace} disabled={isCreating || !newWorkspaceName.trim()}>
                {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">Create a workspace to start collaborating with your team</p>
            <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Create Workspace</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Your Workspaces</h3>
            {workspaces.map(workspace => (
              <Card
                key={workspace.id}
                className={cn("cursor-pointer transition-colors hover:border-primary/50", selectedWorkspace?.id === workspace.id && "border-primary")}
                onClick={() => { setSelectedWorkspace(workspace); onWorkspaceSelect?.(workspace); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{workspace.name}</h4>
                      <p className="text-sm text-muted-foreground">{workspace.members.length} members</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {selectedWorkspace && (
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedWorkspace.name}</CardTitle>
                    <CardDescription>Created {new Date(selectedWorkspace.createdAt).toLocaleDateString()}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
                      <Settings className="h-4 w-4 mr-2" />Settings
                    </Button>
                    <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />Invite
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">{selectedWorkspace.members.length}</span>
                    </div>
                    <div className="space-y-2">
                      {selectedWorkspace.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{member.name[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{member.name}</span>
                                {member.role === 'owner' && <Crown className="h-4 w-4 text-amber-500" />}
                              </div>
                              <span className="text-sm text-muted-foreground">{member.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                            {member.role !== 'owner' && member.id !== currentUserId && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'admin')}>
                                    <Shield className="h-4 w-4 mr-2" />Make Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'editor')}>
                                    Make Editor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'viewer')}>
                                    Make Viewer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm({ type: 'member', id: member.id })}>
                                    <Trash2 className="h-4 w-4 mr-2" />Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workspace Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{selectedWorkspace.stats.sharedItems}</p>
                      <p className="text-sm text-muted-foreground">Shared Items</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{selectedWorkspace.stats.totalSessions}</p>
                      <p className="text-sm text-muted-foreground">Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
      
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Invite someone to {selectedWorkspace?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="editor">Editor - Can edit</SelectItem>
                  <SelectItem value="viewer">Viewer - View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteMember} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>Configure {selectedWorkspace?.name} settings</DialogDescription>
          </DialogHeader>
          {selectedWorkspace && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require encryption</Label>
                  <p className="text-sm text-muted-foreground">All shared content must be encrypted</p>
                </div>
                <Switch checked={selectedWorkspace.settings.encryptionRequired} onCheckedChange={(checked) => { updateWorkspaceSettings(selectedWorkspace.id, { encryptionRequired: checked }); loadWorkspaces(); }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow external sharing</Label>
                  <p className="text-sm text-muted-foreground">Allow sharing outside the workspace</p>
                </div>
                <Switch checked={selectedWorkspace.settings.allowExternalSharing} onCheckedChange={(checked) => { updateWorkspaceSettings(selectedWorkspace.id, { allowExternalSharing: checked }); loadWorkspaces(); }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Audit logging</Label>
                  <p className="text-sm text-muted-foreground">Track all access and changes</p>
                </div>
                <Switch checked={selectedWorkspace.settings.auditLogEnabled} onCheckedChange={(checked) => { updateWorkspaceSettings(selectedWorkspace.id, { auditLogEnabled: checked }); loadWorkspaces(); }} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>This will revoke their access to the workspace and all shared content.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleRemoveMember(deleteConfirm.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
