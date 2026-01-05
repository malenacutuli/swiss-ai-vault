import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TaskStepCard } from './TaskStepCard';
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
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const remainingCount = steps.filter(s => s.status === 'pending' || !s.status).length;
  const progress = task.progress_percentage ?? 0;

  return (
    <div className={cn('space-y-8 animate-fade-in', className)}>
      {/* Paused Header - Swiss minimalist, no icons */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center animate-scale-in">
          <div className="flex gap-1.5">
            <div className="w-2 h-6 bg-muted-foreground rounded-sm" />
            <div className="w-2 h-6 bg-muted-foreground rounded-sm" />
          </div>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-xl font-medium text-foreground">Paused</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount} of {steps.length} steps completed · {remainingCount} remaining
          </p>
        </div>
      </div>

      {/* Progress visualization */}
      <div className="bg-muted/20 rounded-xl border border-border p-5">
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 -mr-1">
          {steps.map((step, index) => (
            <TaskStepCard
              key={step.id}
              step={step}
              stepNumber={index + 1}
              isExpanded={false}
            />
          ))}
        </div>
      </div>

      {/* Actions - Text only, minimal */}
      <div className="flex items-center justify-center gap-4">
        <Button 
          variant="ghost" 
          onClick={onStop}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Stop
        </Button>
        
        <span className="text-muted-foreground">·</span>
        
        <Button
          onClick={onResume}
          disabled={isResuming}
          className="min-w-[100px]"
        >
          {isResuming ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Resuming
            </span>
          ) : (
            'Resume'
          )}
        </Button>
      </div>
    </div>
  );
}
