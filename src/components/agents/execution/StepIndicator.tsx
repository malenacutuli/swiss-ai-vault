import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ExecutionStep } from '@/hooks/useAgentExecution';

interface StepIndicatorProps {
  steps: ExecutionStep[];
  currentStep: number;
  className?: string;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical progress line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />
      
      {/* Animated progress fill */}
      <div 
        className="absolute left-[15px] top-4 w-px bg-primary transition-all duration-500 ease-out"
        style={{
          height: `${Math.max(0, ((steps.filter(s => s.status === 'completed').length) / steps.length) * 100)}%`
        }}
      />

      <div className="space-y-1">
        {steps.map((step, index) => {
          const isActive = step.step_number === currentStep || step.status === 'executing';
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';
          const isPending = step.status === 'pending' || !step.status;

          return (
            <div
              key={step.id}
              className={cn(
                'relative flex items-start gap-4 p-3 rounded-lg transition-all duration-300',
                isActive && 'bg-primary/5',
                isFailed && 'bg-destructive/5',
                // Staggered animation on mount
                'animate-fade-in',
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Status Indicator - Swiss minimalist style */}
              <div className={cn(
                'relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium z-10 transition-all duration-300',
                isCompleted && 'bg-primary text-primary-foreground',
                isFailed && 'bg-destructive text-destructive-foreground',
                isActive && 'bg-primary/20 text-primary',
                isPending && 'bg-muted text-muted-foreground'
              )}>
                {isCompleted ? (
                  <span className="text-xs">✓</span>
                ) : isFailed ? (
                  <span className="text-xs">✕</span>
                ) : isActive ? (
                  <>
                    <span className="font-medium">{step.step_number}</span>
                    {/* Pulsing ring for active step */}
                    <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
                  </>
                ) : (
                  <span>{step.step_number}</span>
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isCompleted && 'text-foreground',
                    isActive && 'text-primary',
                    isFailed && 'text-destructive',
                    isPending && 'text-muted-foreground'
                  )}>
                    {step.description || step.tool_name || `Step ${step.step_number}`}
                  </span>
                  
                  {step.tool_name && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {step.tool_name}
                    </Badge>
                  )}
                </div>
                
                {/* Duration for completed steps */}
                {isCompleted && step.duration_ms && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed in {formatDuration(step.duration_ms)}
                  </p>
                )}
                
                {/* Active step indicator */}
                {isActive && (
                  <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Processing...
                  </p>
                )}
                
                {/* Error message */}
                {isFailed && step.error_message && (
                  <p className="text-xs text-destructive mt-1 line-clamp-2">
                    {step.error_message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
