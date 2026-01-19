import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontal,
  UserMinus,
  Shield,
  Crown,
  Mail,
  Clock,
  X,
  UserPlus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole, Workspace } from '@/hooks/useWorkspaces';

interface WorkspaceMembersListProps {
  workspace: Workspace | null;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateRole: (memberUserId: string, newRole: WorkspaceRole) => Promise<boolean>;
  onRemoveMember: (memberUserId: string) => Promise<boolean>;
  onInvite: () => void;
  canManage: boolean;
}

const roleConfig: Record<WorkspaceRole, { label: string; color: string; icon: React.ElementType }> = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Crown },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Shield },
  editor: { label: 'Editor', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: Shield },
  prompter: { label: 'Prompter', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Shield },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Shield },
};

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'prompter', 'viewer'];

const inviteStatusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-700',
  revoked: 'bg-gray-100 text-gray-700',
};

export function WorkspaceMembersList({
  workspace,
  members,
  invites,
  currentUserId,
  open,
  onOpenChange,
  onUpdateRole,
  onRemoveMember,
  onInvite,
  canManage,
}: WorkspaceMembersListProps) {
  const [removeMember, setRemoveMember] = useState<WorkspaceMember | null>(null);

  const handleRemove = async () => {
    if (removeMember) {
      await onRemoveMember(removeMember.user_id);
      setRemoveMember(null);
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const activeMembers = members.filter(m => m.status === 'active');

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Members</SheetTitle>
            <SheetDescription>
              {workspace?.name} - {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {canManage && (
              <Button className="w-full mb-4" onClick={onInvite}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            )}

            <ScrollArea className="h-[calc(100vh-250px)]">
              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Pending Invites ({pendingInvites.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => (
                      <motion.div
                        key={invite.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{invite.email}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge className={cn('text-xs', roleConfig[invite.role].color)}>
                              {roleConfig[invite.role].label}
                            </Badge>
                            <span>
                              Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <Badge className={cn('text-xs', inviteStatusColors[invite.status])}>
                          {invite.status}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Members */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Members ({activeMembers.length})
                </h4>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {activeMembers.map((member, i) => {
                      const isCurrentUser = member.user_id === currentUserId;
                      const isOwner = member.role === 'owner';
                      const config = roleConfig[member.role];
                      const RoleIcon = config.icon;

                      return (
                        <motion.div
                          key={member.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.user?.raw_user_meta_data?.avatar_url} />
                            <AvatarFallback>
                              {member.user?.raw_user_meta_data?.full_name?.charAt(0) ||
                                member.user?.email?.charAt(0).toUpperCase() ||
                                '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {member.user?.raw_user_meta_data?.full_name || member.user?.email}
                              </span>
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge className={cn('text-xs gap-1', config.color)}>
                                <RoleIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                              {member.last_active_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>

                          {canManage && !isCurrentUser && !isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Change Role
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {ASSIGNABLE_ROLES.map((role) => (
                                      <DropdownMenuItem
                                        key={role}
                                        disabled={member.role === role}
                                        onClick={() => onUpdateRole(member.user_id, role)}
                                      >
                                        <Badge className={cn('text-xs mr-2', roleConfig[role].color)}>
                                          {roleConfig[role].label}
                                        </Badge>
                                        {member.role === role && '(current)'}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setRemoveMember(member)}
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeMember} onOpenChange={() => setRemoveMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {removeMember?.user?.raw_user_meta_data?.full_name || removeMember?.user?.email}
              </strong>{' '}
              from this workspace? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
