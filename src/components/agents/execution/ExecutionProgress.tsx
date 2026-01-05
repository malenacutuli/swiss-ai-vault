import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Square, Clock, Loader2 } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';

interface ExecutionProgressProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  onPause: () => void;
  onStop: () => void;
  isPausing?: boolean;
  className?: string;
}

function formatElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '0s';
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function ExecutionProgress({
  task,
  steps,
  onPause,
  onStop,
  isPausing,
  className,
}: ExecutionProgressProps) {
  const progress = task.progress_percentage ?? 0;
  const currentStep = task.current_step ?? 1;
  const totalSteps = task.total_steps ?? steps.length;
  
  // Find the currently executing step
  const activeStep = steps.find(s => s.status === 'executing');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{formatElapsedTime(task.started_at)}</span>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <span className="text-2xl font-light text-foreground">
            {Math.round(progress)}%
          </span>
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-2" />

      {/* Current Action Indicator */}
      {activeStep && (
        <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-primary/5 border border-primary/10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-foreground">
            Agent is using: <span className="font-medium">{activeStep.tool_name || activeStep.step_type}</span>
          </span>
        </div>
      )}

      {/* Steps List */}
      <div className="max-h-[300px] overflow-y-auto">
        <StepIndicator steps={steps} currentStep={currentStep} />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onPause}
          disabled={isPausing}
          className="gap-2"
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
        <Button
          variant="outline"
          onClick={onStop}
          className="gap-2 text-destructive hover:text-destructive"
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>
      </div>
    </div>
  );
}
