import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, Download, FileText, Image, Table, Presentation } from 'lucide-react';
import type { AgentTask } from '@/hooks/useAgentTasks';
import { formatDistanceToNow } from 'date-fns';

interface AgentTaskCardProps {
  task: AgentTask;
  variant?: 'active' | 'recent';
  onView?: (task: AgentTask) => void;
  onDownload?: (task: AgentTask) => void;
}

const statusColors: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  planning: 'bg-info/20 text-info',
  executing: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
};

const outputTypeIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: Image,
  spreadsheet: Table,
  presentation: Presentation,
};

function getElapsedTime(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function AgentTaskCard({ task, variant = 'recent', onView, onDownload }: AgentTaskCardProps) {
  const isActive = variant === 'active';
  const progress = task.progress_percentage ?? 0;
  const currentStep = task.current_step ?? 0;
  const totalSteps = task.total_steps ?? 0;

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30',
      isActive && 'border-primary/30'
    )}>
      {/* Title */}
      <h3 className="font-medium text-foreground line-clamp-2 mb-2">
        {task.prompt.length > 80 ? `${task.prompt.slice(0, 80)}...` : task.prompt}
      </h3>

      {/* Active task: progress bar and step indicator */}
      {isActive && (
        <div className="space-y-2 mb-3">
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {currentStep}/{totalSteps}
              {task.plan_summary && `: ${task.plan_summary}`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getElapsedTime(task.started_at, null)}
            </span>
          </div>
        </div>
      )}

      {/* Recent task: status and timestamp */}
      {!isActive && (
        <div className="flex items-center gap-2 mb-3">
          <Badge className={cn('text-xs', statusColors[task.status] || statusColors.queued)}>
            {task.status}
          </Badge>
          {task.completed_at && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onView?.(task)}
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        {!isActive && task.status === 'completed' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDownload?.(task)}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
