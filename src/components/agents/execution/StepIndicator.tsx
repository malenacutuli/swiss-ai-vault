import { cn } from '@/lib/utils';
import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import type { ExecutionStep } from '@/hooks/useAgentExecution';

interface StepIndicatorProps {
  steps: ExecutionStep[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, index) => {
        const isActive = step.step_number === currentStep;
        const isCompleted = step.status === 'completed';
        const isFailed = step.status === 'failed';
        const isPending = step.status === 'pending' || !step.status;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-3 p-2 rounded-lg transition-colors',
              isActive && 'bg-primary/5 border border-primary/20',
              isCompleted && 'opacity-70',
              isFailed && 'bg-destructive/5 border border-destructive/20'
            )}
          >
            {/* Status Icon */}
            <div className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
              isCompleted && 'bg-success/20 text-success',
              isFailed && 'bg-destructive/20 text-destructive',
              isActive && 'bg-primary/20 text-primary',
              isPending && 'bg-muted text-muted-foreground'
            )}>
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" />
              ) : isFailed ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>{step.step_number}</span>
              )}
            </div>

            {/* Step Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium truncate',
                  isActive && 'text-primary',
                  isFailed && 'text-destructive',
                  isPending && 'text-muted-foreground'
                )}>
                  {step.tool_name || step.step_type}
                </span>
                {step.duration_ms && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(step.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {step.description}
                </p>
              )}
              {isFailed && step.error_message && (
                <p className="text-xs text-destructive mt-1">
                  {step.error_message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
