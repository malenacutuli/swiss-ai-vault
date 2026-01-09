import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  AlertCircle,
  Clock,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { TodoPlan, Phase, Task, TaskStatus, PhaseStatus } from '@/lib/agents/planning';

interface PlanVisualizerProps {
  plan: TodoPlan;
  className?: string;
  showElapsedTime?: boolean;
  compact?: boolean;
}

export function PlanVisualizer({ 
  plan, 
  className,
  showElapsedTime = true,
  compact = false,
}: PlanVisualizerProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => {
    // Auto-expand current phase
    const currentPhase = plan.phases[plan.currentPhase - 1];
    return new Set(currentPhase ? [currentPhase.id] : []);
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const progress = plan.totalTasks > 0 
    ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
    : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">{plan.title}</h3>
          <Badge variant="outline" className="text-xs">
            {plan.completedTasks}/{plan.totalTasks} tasks
          </Badge>
        </div>
        
        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-2">
        {plan.phases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            isExpanded={expandedPhases.has(phase.id)}
            isCurrent={phase.number === plan.currentPhase}
            onToggle={() => togglePhase(phase.id)}
            showElapsedTime={showElapsedTime}
            compact={compact}
          />
        ))}
      </div>

      {/* Summary */}
      {!compact && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          {plan.inProgressTasks > 0 && (
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span>{plan.inProgressTasks} in progress</span>
            </div>
          )}
          {plan.blockedTasks > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span>{plan.blockedTasks} blocked</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PhaseCardProps {
  phase: Phase;
  isExpanded: boolean;
  isCurrent: boolean;
  onToggle: () => void;
  showElapsedTime: boolean;
  compact: boolean;
}

function PhaseCard({ 
  phase, 
  isExpanded, 
  isCurrent, 
  onToggle,
  showElapsedTime,
  compact,
}: PhaseCardProps) {
  const completedTasks = phase.tasks.filter(t => t.status === 'completed').length;
  const phaseProgress = phase.tasks.length > 0 
    ? Math.round((completedTasks / phase.tasks.length) * 100)
    : 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn(
        "rounded-lg border transition-colors",
        isCurrent && "border-primary/50 bg-primary/5",
        phase.status === 'completed' && "border-green-500/30 bg-green-500/5",
        phase.status === 'pending' && "border-muted opacity-60"
      )}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3">
            {/* Expand icon */}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}

            {/* Phase status icon */}
            <PhaseStatusIcon status={phase.status} />

            {/* Phase info */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium text-sm",
                  phase.status === 'completed' && "text-green-600 dark:text-green-400"
                )}>
                  Phase {phase.number}: {phase.name}
                </span>
                {isCurrent && (
                  <Badge variant="default" className="text-[10px] h-4 px-1.5">
                    Current
                  </Badge>
                )}
              </div>
              {!compact && (
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={phaseProgress} className="h-1 flex-1 max-w-24" />
                  <span className="text-xs text-muted-foreground">
                    {completedTasks}/{phase.tasks.length}
                  </span>
                </div>
              )}
            </div>

            {/* Time elapsed */}
            {showElapsedTime && phase.duration && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(phase.duration)}
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/50">
            {phase.tasks.map((task) => (
              <TaskRow key={task.id} task={task} showDuration={showElapsedTime} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface TaskRowProps {
  task: Task;
  showDuration: boolean;
}

function TaskRow({ task, showDuration }: TaskRowProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 py-1.5 px-2 rounded text-sm",
      task.status === 'completed' && "text-muted-foreground",
      task.status === 'blocked' && "text-destructive/80 bg-destructive/5"
    )}>
      <TaskStatusIcon status={task.status} />
      
      <div className="flex-1 min-w-0">
        <span className={cn(
          task.status === 'completed' && "line-through"
        )}>
          {task.description}
        </span>
        
        {task.tool && (
          <span className="inline-flex items-center gap-1 ml-2 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3" />
            {task.tool}
          </span>
        )}
      </div>

      {showDuration && task.duration && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDuration(task.duration)}
        </span>
      )}
    </div>
  );
}

function PhaseStatusIcon({ status }: { status: PhaseStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    case 'active':
      return <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />;
    case 'pending':
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />;
  }
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0 mt-0.5" />;
    case 'blocked':
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
    case 'pending':
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}
