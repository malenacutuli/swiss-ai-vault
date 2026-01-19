import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontal,
  Settings,
  Users,
  LogOut,
  Trash2,
  Lock,
  Globe,
  UserPlus,
  Clock,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { Workspace, WorkspaceRole } from '@/hooks/useWorkspaces';

interface WorkspaceListProps {
  workspaces: Workspace[];
  isLoading?: boolean;
  onSelect: (workspace: Workspace) => void;
  onSettings: (workspace: Workspace) => void;
  onMembers: (workspace: Workspace) => void;
  onInvite: (workspace: Workspace) => void;
  onLeave: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onCreate: () => void;
}

const visibilityConfig = {
  private: { icon: Lock, label: 'Private', color: 'text-muted-foreground' },
  team: { icon: Users, label: 'Team', color: 'text-blue-500' },
  public: { icon: Globe, label: 'Public', color: 'text-green-500' },
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  editor: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  prompter: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const WORKSPACE_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

function getWorkspaceColor(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return WORKSPACE_COLORS[hash % WORKSPACE_COLORS.length];
}

export function WorkspaceList({
  workspaces,
  isLoading,
  onSelect,
  onSettings,
  onMembers,
  onInvite,
  onLeave,
  onDelete,
  onCreate,
}: WorkspaceListProps) {
  const [actionWorkspace, setActionWorkspace] = useState<{ workspace: Workspace; action: 'leave' | 'delete' } | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create New Workspace Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className="cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors h-full min-h-[180px] flex items-center justify-center"
            onClick={onCreate}
          >
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium">Create Workspace</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start a new collaborative space
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {workspaces.map((workspace, i) => {
            const visConfig = visibilityConfig[workspace.visibility];
            const VisibilityIcon = visConfig.icon;
            const isOwner = workspace.role === 'owner';
            const canManage = workspace.role === 'owner' || workspace.role === 'admin';

            return (
              <motion.div
                key={workspace.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className="group hover:shadow-md transition-all cursor-pointer h-full"
                  onClick={() => onSelect(workspace)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 rounded-lg">
                          <AvatarFallback className={cn('rounded-lg text-white', workspace.color || getWorkspaceColor(workspace.id))}>
                            {workspace.icon || workspace.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{workspace.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <VisibilityIcon className={cn('h-3 w-3', visConfig.color)} />
                            <span>{visConfig.label}</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(workspace); }}>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMembers(workspace); }}>
                            <Users className="h-4 w-4 mr-2" />
                            Members
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInvite(workspace); }}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Invite
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings(workspace); }}>
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {!isOwner && (
                            <DropdownMenuItem
                              className="text-amber-600"
                              onClick={(e) => { e.stopPropagation(); setActionWorkspace({ workspace, action: 'leave' }); }}
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Leave
                            </DropdownMenuItem>
                          )}
                          {isOwner && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); setActionWorkspace({ workspace, action: 'delete' }); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {workspace.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {workspace.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', roleColors[workspace.role || 'viewer'])}>
                          {workspace.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {workspace.member_count} member{workspace.member_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(workspace.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {workspaces.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-2">No workspaces yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a workspace to start collaborating with your team
          </p>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        </div>
      )}

      {/* Leave/Delete Confirmation */}
      <AlertDialog open={!!actionWorkspace} onOpenChange={() => setActionWorkspace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionWorkspace?.action === 'leave' ? 'Leave Workspace' : 'Delete Workspace'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionWorkspace?.action === 'leave'
                ? `Are you sure you want to leave "${actionWorkspace.workspace.name}"? You'll need a new invitation to rejoin.`
                : `Are you sure you want to delete "${actionWorkspace?.workspace.name}"? This action cannot be undone and all workspace data will be archived.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={actionWorkspace?.action === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-amber-600 hover:bg-amber-700'}
              onClick={() => {
                if (actionWorkspace) {
                  if (actionWorkspace.action === 'leave') {
                    onLeave(actionWorkspace.workspace);
                  } else {
                    onDelete(actionWorkspace.workspace);
                  }
                  setActionWorkspace(null);
                }
              }}
            >
              {actionWorkspace?.action === 'leave' ? 'Leave' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
