import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Eye, 
  Download, 
  FileText, 
  Image, 
  Table, 
  Presentation,
  Check,
  X,
  Loader2,
  RefreshCw,
  Coins,
  Shield,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface AgentTaskOutput {
  id: string;
  outputType: string;
  fileName: string;
  downloadUrl: string;
}

export interface AgentTaskData {
  id: string;
  prompt: string;
  status: 'queued' | 'planning' | 'executing' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  planSummary?: string;
  resultSummary?: string;
  outputs?: AgentTaskOutput[];
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  creditsUsed?: number;
  privacyTier?: string;
  durationMs?: number;
}

interface AgentTaskCardProps {
  task: AgentTaskData;
  variant?: 'compact' | 'expanded';
  onView: () => void;
  onDownload?: () => void;
  onRetry?: () => void;
  className?: string;
}

const outputTypeIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: Image,
  spreadsheet: Table,
  presentation: Presentation,
  pptx: Presentation,
  docx: FileText,
  xlsx: Table,
  pdf: FileText,
};

function getElapsedTime(startedAt: string | undefined, completedAt: string | undefined): string {
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

function formatDuration(ms: number | undefined): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Status indicator component
function StatusIndicator({ status, currentStep, totalSteps, progressPercentage }: {
  status: AgentTaskData['status'];
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
}) {
  switch (status) {
    case 'queued':
      return (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-xs text-muted-foreground">Waiting...</span>
        </div>
      );
    case 'planning':
      return (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-info animate-pulse" />
          <span className="text-xs text-info">Planning...</span>
        </div>
      );
    case 'executing':
      return (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-primary">Step {currentStep}/{totalSteps}</span>
          <Progress value={progressPercentage} className="h-1 w-16" />
        </div>
      );
    case 'completed':
      return (
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">Completed</span>
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-2">
          <X className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs text-destructive">Failed</span>
        </div>
      );
    default:
      return null;
  }
}

// Compact variant component
function CompactCard({ task, onView, onDownload, onRetry, className }: AgentTaskCardProps) {
  const isActive = task.status === 'executing' || task.status === 'planning';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  return (
    <div 
      onClick={onView}
      className={cn(
        'group relative rounded-lg border bg-card p-4 cursor-pointer',
        'transition-all duration-200 ease-out',
        'hover:bg-muted/40 hover:border-muted-foreground/20',
        isActive && 'border-primary/30 ring-1 ring-primary/10',
        isFailed && 'border-destructive/30',
        className
      )}
    >
      {/* Active state glow */}
      {isActive && (
        <div className="absolute inset-0 rounded-lg bg-primary/5 animate-pulse pointer-events-none" />
      )}

      {/* Title */}
      <h3 className="font-medium text-foreground line-clamp-2 mb-3 pr-4">
        {task.prompt.length > 80 ? `${task.prompt.slice(0, 80)}...` : task.prompt}
      </h3>

      {/* Status */}
      <div className="mb-3">
        <StatusIndicator 
          status={task.status}
          currentStep={task.currentStep}
          totalSteps={task.totalSteps}
          progressPercentage={task.progressPercentage}
        />
      </div>

      {/* Plan summary for active tasks */}
      {isActive && task.planSummary && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
          {task.planSummary}
        </p>
      )}

      {/* Output icons for completed tasks */}
      {isCompleted && task.outputs && task.outputs.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {task.outputs.slice(0, 4).map((output) => {
            const Icon = outputTypeIcons[output.outputType.toLowerCase()] || FileText;
            return (
              <div 
                key={output.id}
                className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center"
                title={output.fileName}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            );
          })}
          {task.outputs.length > 4 && (
            <span className="text-xs text-muted-foreground">+{task.outputs.length - 4}</span>
          )}
        </div>
      )}

      {/* Error message for failed tasks */}
      {isFailed && task.errorMessage && (
        <p className="text-xs text-destructive/80 mb-3 line-clamp-1">
          {task.errorMessage}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {task.completedAt 
            ? formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })
            : getElapsedTime(task.startedAt, undefined)
          }
        </span>
        
        <div className="flex items-center gap-1">
          {isFailed && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {isCompleted && onDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </div>

      {/* Chevron indicator */}
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Expanded variant component
function ExpandedCard({ task, onView, onDownload, onRetry, className }: AgentTaskCardProps) {
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const isActive = task.status === 'executing' || task.status === 'planning';

  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      isActive && 'border-primary/30',
      isFailed && 'border-destructive/30',
      className
    )}>
      {/* Header */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-medium text-foreground flex-1">
            {task.prompt}
          </h3>
          <StatusIndicator 
            status={task.status}
            currentStep={task.currentStep}
            totalSteps={task.totalSteps}
            progressPercentage={task.progressPercentage}
          />
        </div>

        {/* Progress bar for active tasks */}
        {isActive && (
          <div className="space-y-2">
            <Progress value={task.progressPercentage} className="h-2" />
            {task.planSummary && (
              <p className="text-sm text-muted-foreground">{task.planSummary}</p>
            )}
          </div>
        )}

        {/* Result summary for completed tasks */}
        {isCompleted && task.resultSummary && (
          <p className="text-sm text-muted-foreground">{task.resultSummary}</p>
        )}

        {/* Error details for failed tasks */}
        {isFailed && task.errorMessage && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mt-3">
            <p className="text-sm text-destructive">{task.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Step Timeline (for active/completed tasks) */}
      {(isActive || isCompleted) && task.totalSteps > 0 && (
        <div className="px-5 py-4 border-b border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Steps</h4>
          <div className="flex items-center gap-1">
            {Array.from({ length: task.totalSteps }).map((_, i) => {
              const stepNum = i + 1;
              const isCompleted = stepNum < task.currentStep;
              const isCurrent = stepNum === task.currentStep;
              
              return (
                <div 
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    isCompleted && 'bg-success',
                    isCurrent && 'bg-primary animate-pulse',
                    !isCompleted && !isCurrent && 'bg-muted'
                  )}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Outputs */}
      {isCompleted && task.outputs && task.outputs.length > 0 && (
        <div className="px-5 py-4 border-b border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Outputs</h4>
          <div className="space-y-2">
            {task.outputs.map((output) => {
              const Icon = outputTypeIcons[output.outputType.toLowerCase()] || FileText;
              return (
                <div 
                  key={output.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <div className="h-8 w-8 rounded bg-card flex items-center justify-center border border-border">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-sm text-foreground truncate">
                    {output.fileName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => window.open(output.downloadUrl, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(task.durationMs) || getElapsedTime(task.startedAt, task.completedAt)}
          </span>
          {task.creditsUsed !== undefined && (
            <span className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" />
              {task.creditsUsed} credits
            </span>
          )}
          {task.privacyTier && (
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {task.privacyTier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFailed && onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={onRetry}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          {isCompleted && onDownload && (
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-primary hover:bg-primary/90"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Download All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onView}
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AgentTaskCard(props: AgentTaskCardProps) {
  const { variant = 'compact' } = props;
  
  if (variant === 'expanded') {
    return <ExpandedCard {...props} />;
  }
  
  return <CompactCard {...props} />;
}

// Legacy adapter for backwards compatibility with existing useAgentTasks hook
export function AgentTaskCardLegacy({ 
  task, 
  variant: legacyVariant = 'recent',
  onView,
  onDownload 
}: {
  task: {
    id: string;
    prompt: string;
    status: string;
    current_step: number | null;
    total_steps: number | null;
    progress_percentage: number | null;
    plan_summary: string | null;
    result_summary: string | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    credits_used: number | null;
    privacy_tier: string | null;
    duration_ms: number | null;
  };
  variant?: 'active' | 'recent';
  onView?: (task: any) => void;
  onDownload?: (task: any) => void;
}) {
  // Convert legacy task format to new format
  const convertedTask: AgentTaskData = {
    id: task.id,
    prompt: task.prompt,
    status: task.status as AgentTaskData['status'],
    currentStep: task.current_step ?? 0,
    totalSteps: task.total_steps ?? 0,
    progressPercentage: task.progress_percentage ?? 0,
    planSummary: task.plan_summary ?? undefined,
    resultSummary: task.result_summary ?? undefined,
    errorMessage: task.error_message ?? undefined,
    startedAt: task.started_at ?? undefined,
    completedAt: task.completed_at ?? undefined,
    creditsUsed: task.credits_used ?? undefined,
    privacyTier: task.privacy_tier ?? undefined,
    durationMs: task.duration_ms ?? undefined,
  };

  return (
    <AgentTaskCard
      task={convertedTask}
      variant="compact"
      onView={() => onView?.(task)}
      onDownload={onDownload ? () => onDownload(task) : undefined}
    />
  );
}
