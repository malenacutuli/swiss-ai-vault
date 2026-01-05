import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, MessageSquare, ArrowLeft } from 'lucide-react';
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
  // Find the failed step
  const failedStep = steps.find(s => s.status === 'failed');
  const completedSteps = steps.filter(s => s.status === 'completed').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Error Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Task Failed</h3>
          {completedSteps > 0 && (
            <p className="text-sm text-muted-foreground">
              Completed {completedSteps} of {steps.length} steps before failing
            </p>
          )}
        </div>
      </div>

      {/* Error Details */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">
          {failedStep ? `Failed at: ${failedStep.tool_name || failedStep.step_type}` : 'Error'}
        </p>
        <p className="text-sm text-muted-foreground">
          {error || task.error_message || 'An unexpected error occurred'}
        </p>
      </div>

      {/* Steps Summary */}
      {steps.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Execution Progress
          </h4>
          <div className="space-y-2">
            {steps.slice(0, 5).map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  step.status === 'completed' && 'text-success',
                  step.status === 'failed' && 'text-destructive',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                <span className="w-4 text-center">
                  {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
                </span>
                <span>{step.tool_name || step.step_type}</span>
              </div>
            ))}
            {steps.length > 5 && (
              <p className="text-xs text-muted-foreground ml-6">
                +{steps.length - 5} more steps
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
          {isRetrying ? 'Retrying...' : 'Retry Task'}
        </Button>
        
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => window.open('mailto:support@swissvault.ai', '_blank')}
        >
          <MessageSquare className="h-4 w-4" />
          Report Issue
        </Button>
      </div>
    </div>
  );
}
