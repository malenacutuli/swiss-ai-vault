import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Building2,
  Camera,
  UserPlus,
  Trash2,
  Loader2,
  Users,
  LogOut,
  AlertTriangle,
  Mail,
  Clock,
  X,
} from "lucide-react";
import {
  useCurrentOrganization,
  useOrganizationMembers,
  useOrganizationInvitations,
  useUpdateOrganization,
  useUpdateMemberRole,
  useRemoveMember,
  useDeleteOrganization,
  useLeaveOrganization,
  useUserOrgRole,
  useCreateInvitation,
  useDeleteInvitation,
} from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";

export function OrganizationSettings() {
  const { currentOrg, currentOrgId, setCurrentOrganization, isPersonalWorkspace } = useCurrentOrganization();
  const { members, loading: membersLoading, refetch: refetchMembers } = useOrganizationMembers(currentOrgId);
  const { invitations, loading: invitationsLoading, refetch: refetchInvitations } = useOrganizationInvitations(currentOrgId);
  const { updateOrganization, loading: updateLoading } = useUpdateOrganization();
  const { updateMemberRole, loading: roleLoading } = useUpdateMemberRole();
  const { removeMember, loading: removeLoading } = useRemoveMember();
  const { deleteOrganization, loading: deleteLoading } = useDeleteOrganization();
  const { leaveOrganization, loading: leaveLoading } = useLeaveOrganization();
  const { createInvitation, loading: inviteLoading } = useCreateInvitation();
  const { deleteInvitation, loading: deleteInviteLoading } = useDeleteInvitation();
  const { role: userRole, isAdmin, isOwner } = useUserOrgRole(currentOrgId);
  const { user } = useAuth();

  const [editedName, setEditedName] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null);
  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false);
  const [showLeaveOrgDialog, setShowLeaveOrgDialog] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  useEffect(() => {
    if (currentOrg?.name) {
      setEditedName(currentOrg.name);
    }
  }, [currentOrg?.name]);

  if (isPersonalWorkspace) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12">
          <EmptyState
            icon={Building2}
            title="Personal Workspace"
            subtitle="Organization settings are not available for your personal workspace. Create or switch to an organization to manage team settings."
          />
        </CardContent>
      </Card>
    );
  }

  const handleUpdateName = async () => {
    if (!currentOrgId || !editedName.trim()) return;
    await updateOrganization(currentOrgId, { name: editedName.trim() });
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const success = await updateMemberRole(memberId, newRole);
    if (success) refetchMembers();
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const success = await removeMember(memberToRemove);
    if (success) refetchMembers();
    setMemberToRemove(null);
  };

  const handleDeleteOrg = async () => {
    if (!currentOrgId || confirmDeleteText !== currentOrg?.name) return;
    const success = await deleteOrganization(currentOrgId);
    if (success) {
      await setCurrentOrganization(null);
      setShowDeleteOrgDialog(false);
    }
  };

  const handleLeaveOrg = async () => {
    if (!currentOrgId) return;
    const success = await leaveOrganization(currentOrgId);
    if (success) {
      await setCurrentOrganization(null);
      setShowLeaveOrgDialog(false);
    }
  };

  const handleInvite = async () => {
    if (!currentOrgId || !inviteEmail.trim()) return;
    const invitation = await createInvitation(currentOrgId, inviteEmail, inviteRole);
    if (invitation) {
      refetchInvitations();
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    }
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    const success = await deleteInvitation(invitationToRevoke);
    if (success) refetchInvitations();
    setInvitationToRevoke(null);
  };

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "default";
      case "member":
        return "secondary";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  const canLeave = userRole !== "owner";
  const canDelete = isOwner || (isAdmin && members.filter(m => m.role === 'owner').length === 0);

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Organization Details</CardTitle>
          <CardDescription>Manage your organization settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 rounded-xl">
                <AvatarFallback className="rounded-xl bg-primary/20 text-primary text-xl">
                  {currentOrg?.name?.slice(0, 2).toUpperCase() || "O"}
                </AvatarFallback>
              </Avatar>
              {isAdmin && (
                <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground">
                  <Camera className="h-3 w-3" />
                </button>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{currentOrg?.name}</p>
              <p className="text-sm text-muted-foreground">@{currentOrg?.slug}</p>
            </div>
          </div>

          {/* Name */}
          {isAdmin && (
            <div className="space-y-2">
              <Label className="text-foreground">Organization Name</Label>
              <div className="flex gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="bg-secondary border-border max-w-sm"
                />
                <Button
                  onClick={handleUpdateName}
                  disabled={updateLoading || editedName === currentOrg?.name}
                >
                  {updateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Slug (read-only) */}
          <div className="space-y-2">
            <Label className="text-foreground">Organization Slug</Label>
            <Input
              value={currentOrg?.slug || ""}
              disabled
              className="bg-muted border-border max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              The slug cannot be changed after creation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Members</CardTitle>
            <CardDescription>Manage organization members and their roles</CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsInviteModalOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members"
              subtitle="Invite team members to collaborate"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {getInitials(member.user?.full_name, member.user?.email || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {member.user?.full_name || "Unknown"}
                            {member.user_id === user?.id && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.user?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin && member.user_id !== user?.id && member.role !== 'owner' ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.id, value)}
                          disabled={roleLoading}
                        >
                          <SelectTrigger className="w-28 h-8 bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.joined_at || member.created_at)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {member.user_id !== user?.id && member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberToRemove(member.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {isAdmin && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            {invitationsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                ))}
              </div>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pending invitations
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(invitation.expires_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInvitationToRevoke(invitation.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="bg-card border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canLeave && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">Leave Organization</p>
                <p className="text-sm text-muted-foreground">
                  Remove yourself from this organization
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowLeaveOrgDialog(true)}
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave
              </Button>
            </div>
          )}
          
          {canDelete && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50">
              <div>
                <p className="font-medium text-foreground">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this organization and all its data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteOrgDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this organization. The invitation expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Can manage members and settings</SelectItem>
                  <SelectItem value="member">Member - Can access all resources</SelectItem>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviteLoading}>
              {inviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invitation Dialog */}
      <AlertDialog open={!!invitationToRevoke} onOpenChange={() => setInvitationToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invitation? The recipient will no longer be able to join the organization with this link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvitation}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteInviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Organization Dialog */}
      <AlertDialog open={showLeaveOrgDialog} onOpenChange={setShowLeaveOrgDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{currentOrg?.name}"? You will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrg}
              className="bg-destructive hover:bg-destructive/90"
            >
              {leaveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Dialog */}
      <AlertDialog open={showDeleteOrgDialog} onOpenChange={setShowDeleteOrgDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the organization "{currentOrg?.name}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-foreground">
              Type <span className="font-mono font-bold">{currentOrg?.name}</span> to confirm
            </Label>
            <Input
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              className="mt-2 bg-secondary border-border"
              placeholder="Organization name"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrg}
              disabled={confirmDeleteText !== currentOrg?.name || deleteLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
