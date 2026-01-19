import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  UserMinus,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Share,
  Clock,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { WorkspaceActivity, Workspace } from '@/hooks/useWorkspaces';

interface WorkspaceActivityFeedProps {
  workspace: Workspace | null;
  activities: WorkspaceActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadMore?: () => void;
}

const activityConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  member_joined: { icon: UserPlus, color: 'text-green-500 bg-green-100 dark:bg-green-900', label: 'joined the workspace' },
  member_left: { icon: UserMinus, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900', label: 'left the workspace' },
  member_removed: { icon: UserMinus, color: 'text-red-500 bg-red-100 dark:bg-red-900', label: 'was removed' },
  member_role_changed: { icon: Settings, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900', label: 'role was changed' },
  run_started: { icon: Play, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900', label: 'started a run' },
  run_completed: { icon: CheckCircle, color: 'text-green-500 bg-green-100 dark:bg-green-900', label: 'completed a run' },
  run_failed: { icon: XCircle, color: 'text-red-500 bg-red-100 dark:bg-red-900', label: 'run failed' },
  workspace_updated: { icon: Edit, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900', label: 'updated workspace settings' },
  workspace_created: { icon: Activity, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900', label: 'created the workspace' },
  invite_sent: { icon: Share, color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900', label: 'sent an invitation' },
  invite_accepted: { icon: UserPlus, color: 'text-green-500 bg-green-100 dark:bg-green-900', label: 'accepted an invitation' },
};

const defaultConfig = { icon: Activity, color: 'text-gray-500 bg-gray-100 dark:bg-gray-900', label: 'performed an action' };

function getActivityConfig(type: string) {
  return activityConfig[type] || defaultConfig;
}

function formatActivityMessage(activity: WorkspaceActivity): string {
  const config = getActivityConfig(activity.activity_type);
  const data = activity.data || {};

  switch (activity.activity_type) {
    case 'member_role_changed':
      return `role changed from ${data.old_role || 'unknown'} to ${data.new_role || 'unknown'}`;
    case 'run_started':
      return `started run "${data.run_name || 'Untitled'}"`;
    case 'run_completed':
      return `completed run "${data.run_name || 'Untitled'}"`;
    case 'run_failed':
      return `run "${data.run_name || 'Untitled'}" failed`;
    case 'workspace_updated':
      return `updated ${data.fields?.join(', ') || 'settings'}`;
    case 'invite_sent':
      return `invited ${data.email || 'someone'}`;
    default:
      return config.label;
  }
}

export function WorkspaceActivityFeed({
  workspace,
  activities,
  open,
  onOpenChange,
  onLoadMore,
}: WorkspaceActivityFeedProps) {
  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, WorkspaceActivity[]>);

  const sortedDates = Object.keys(groupedActivities).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const formatDateHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>
            Recent activity in {workspace?.name}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-150px)] mt-6">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">No activity yet</h3>
              <p className="text-sm text-muted-foreground">
                Activity will appear here as team members use this workspace.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((dateStr) => (
                <div key={dateStr}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
                    {formatDateHeader(dateStr)}
                  </h4>
                  <div className="space-y-3">
                    {groupedActivities[dateStr].map((activity, i) => {
                      const config = getActivityConfig(activity.activity_type);
                      const ActivityIcon = config.icon;
                      const message = formatActivityMessage(activity);

                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-start gap-3"
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                              config.color
                            )}
                          >
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">
                                {activity.data?.user_name || 'Someone'}
                              </span>{' '}
                              {message}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
