import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TaskStepCard } from './TaskStepCard';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';

interface ErrorViewProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  error: string;
  onRetry: () => void;
  onBack: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function ErrorView({
  task,
  steps,
  error,
  onRetry,
  onBack,
  isRetrying,
  className,
}: ErrorViewProps) {
  const failedStep = steps.find(s => s.status === 'failed');
  const completedCount = steps.filter(s => s.status === 'completed').length;

  return (
    <div className={cn('space-y-8 animate-fade-in', className)}>
      {/* Error Header - Swiss minimalist, no icons */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-scale-in">
          <span className="text-2xl text-destructive font-medium">✕</span>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-xl font-medium text-foreground">Task Failed</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount > 0 
              ? `Completed ${completedCount} of ${steps.length} steps before failure`
              : 'An error occurred during execution'
            }
          </p>
        </div>
      </div>

      {/* Error Details */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
        <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-2">Error Details</p>
        <p className="text-sm text-foreground">
          {error || task.error_message || 'An unexpected error occurred'}
        </p>
        
        {failedStep && (
          <div className="mt-4 pt-4 border-t border-destructive/10">
            <p className="text-xs text-muted-foreground mb-1">Failed at step {failedStep.step_number}</p>
            <p className="text-sm text-foreground">
              {failedStep.description || failedStep.tool_name}
            </p>
          </div>
        )}
      </div>

      {/* Steps Summary - Using TaskStepCard */}
      {steps.length > 0 && (
        <div className="bg-muted/20 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Execution Progress
          </p>
          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 -mr-1">
            {steps.map((step, index) => (
              <TaskStepCard
                key={step.id}
                step={step}
                stepNumber={index + 1}
                isExpanded={step.status === 'failed'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions - Text only, minimal */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          Back
        </Button>
        
        <span className="text-muted-foreground">·</span>
        
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="min-w-[100px]"
        >
          {isRetrying ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Retrying
            </span>
          ) : (
            'Retry Task'
          )}
        </Button>
      </div>
    </div>
  );
}
