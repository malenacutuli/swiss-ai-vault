import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { StepIndicator } from './StepIndicator';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';
import { useState, useEffect } from 'react';

interface ExecutionProgressProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  onPause: () => void;
  onStop: () => void;
  isPausing?: boolean;
  className?: string;
}

function formatElapsedTime(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function estimateTimeRemaining(progress: number, startedAt: string | null): string {
  if (!startedAt || progress <= 0) return '--:--';
  const start = new Date(startedAt);
  const now = new Date();
  const elapsed = now.getTime() - start.getTime();
  const estimated = (elapsed / progress) * (100 - progress);
  const seconds = Math.floor(estimated / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `~${minutes}m`;
}

export function ExecutionProgress({
  task,
  steps,
  onPause,
  onStop,
  isPausing,
  className,
}: ExecutionProgressProps) {
  const [elapsed, setElapsed] = useState('0:00');
  const progress = task.progress_percentage ?? 0;
  const currentStep = task.current_step ?? 1;
  const totalSteps = task.total_steps ?? steps.length;
  
  // Find the currently executing step
  const activeStep = steps.find(s => s.status === 'executing');
  const completedSteps = steps.filter(s => s.status === 'completed').length;

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(task.started_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [task.started_at]);

  return (
    <div className={cn('space-y-6 animate-fade-in', className)}>
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <span>{elapsed}</span>
          </div>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        
        <Badge variant="secondary" className="font-mono">
          {Math.round(progress)}%
        </Badge>
      </div>

      {/* Progress Bar - Minimal */}
      <div className="space-y-2">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completedSteps} completed</span>
          <span>ETA: {estimateTimeRemaining(progress, task.started_at)}</span>
        </div>
      </div>

      {/* Current Action - Prominent */}
      {activeStep && (
        <div className="relative p-4 rounded-xl bg-primary/5 border border-primary/10 animate-scale-in">
          <div className="flex items-start gap-3">
            {/* Pulsing indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-medium">{activeStep.step_number}</span>
              </div>
              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {activeStep.description || activeStep.tool_name}
              </p>
              {activeStep.tool_name && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Using {activeStep.tool_name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="max-h-[280px] overflow-y-auto pr-1 -mr-1">
        <StepIndicator steps={steps} currentStep={currentStep} />
      </div>

      {/* Control Buttons - Text-based, minimal */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPause}
          disabled={isPausing}
          className="text-muted-foreground hover:text-foreground"
        >
          Pause
        </Button>
        <span className="text-muted-foreground">·</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Stop
        </Button>
      </div>
    </div>
  );
}
