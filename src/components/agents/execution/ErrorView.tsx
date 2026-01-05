import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
      {/* Error Header - Swiss minimalist */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-scale-in">
          <span className="text-2xl text-destructive">✕</span>
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
        <p className="text-sm font-medium text-destructive mb-2">Error Details</p>
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

      {/* Steps Summary - Minimal */}
      {steps.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Execution Progress
          </p>
          <div className="space-y-2">
            {steps.slice(0, 5).map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 text-sm',
                  step.status === 'completed' && 'text-primary',
                  step.status === 'failed' && 'text-destructive',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-muted">
                  {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✕' : step.step_number}
                </span>
                <span>{step.description || step.tool_name || step.step_type}</span>
              </div>
            ))}
            {steps.length > 5 && (
              <p className="text-xs text-muted-foreground ml-8">
                +{steps.length - 5} more steps
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="min-w-[100px]"
        >
          {isRetrying ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
