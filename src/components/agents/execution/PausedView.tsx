import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, X } from 'lucide-react';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';

interface PausedViewProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  onResume: () => void;
  onStop: () => void;
  isResuming?: boolean;
  className?: string;
}

export function PausedView({
  task,
  steps,
  onResume,
  onStop,
  isResuming,
  className,
}: PausedViewProps) {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const remainingSteps = steps.filter(s => s.status === 'pending' || !s.status).length;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {/* Paused Icon */}
      <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-6">
        <div className="flex gap-1">
          <div className="w-2 h-6 bg-warning rounded-sm" />
          <div className="w-2 h-6 bg-warning rounded-sm" />
        </div>
      </div>

      {/* Status */}
      <h3 className="text-xl font-light text-foreground mb-2">
        Task Paused
      </h3>
      
      <p className="text-sm text-muted-foreground mb-6">
        {completedSteps} of {steps.length} steps completed • {remainingSteps} remaining
      </p>

      {/* Current Progress */}
      {task.plan_summary && (
        <div className="bg-muted/30 rounded-lg px-4 py-3 mb-8 max-w-md text-center">
          <p className="text-sm text-muted-foreground">
            Last activity: {task.plan_summary}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onStop}
          className="gap-2 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
          Stop Task
        </Button>
        
        <Button
          onClick={onResume}
          disabled={isResuming}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Play className="h-4 w-4" />
          {isResuming ? 'Resuming...' : 'Resume'}
        </Button>
      </div>
    </div>
  );
}
