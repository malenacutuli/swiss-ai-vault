import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TaskStepCard } from './TaskStepCard';
import { SuggestedFollowups } from './SuggestedFollowups';
import { TaskRating } from './TaskRating';
import type { ExecutionTask, ExecutionStep } from '@/hooks/useAgentExecution';

interface TaskProgressPanelProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  isComplete: boolean;
  onPause?: () => void;
  onStop?: () => void;
  onDownloadAll?: () => void;
  onNewTask?: () => void;
  className?: string;
}

export function TaskProgressPanel({
  task,
  steps,
  isComplete,
  onPause,
  onStop,
  onDownloadAll,
  onNewTask,
  className,
}: TaskProgressPanelProps) {
  const [elapsed, setElapsed] = useState('0:00');
  
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progress = task.progress_percentage ?? (steps.length > 0 ? (completedCount / steps.length) * 100 : 0);
  
  // Update elapsed time
  useEffect(() => {
    if (!task.started_at || isComplete) return;
    
    const updateElapsed = () => {
      const start = new Date(task.started_at!).getTime();
      const now = Date.now();
      const diffMs = now - start;
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setElapsed(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [task.started_at, isComplete]);
  
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-shrink-0 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Task Progress</h3>
          <span className="text-xs text-muted-foreground font-mono tabular-nums bg-muted px-2 py-0.5 rounded">
            {completedCount} / {steps.length}
          </span>
        </div>
        
        {/* Minimal progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isComplete ? 'bg-primary' : 'bg-primary/80'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Time and ETA */}
        {!isComplete && (
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{elapsed}</span>
            <span>
              {progress > 0 && progress < 100 && (
                <>ETA: ~{Math.ceil((100 - progress) / (progress / (parseInt(elapsed.split(':')[0]) * 60 + parseInt(elapsed.split(':')[1]) || 1)))}s</>
              )}
            </span>
          </div>
        )}
      </div>
      
      {/* Steps List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-1 -mr-1">
        {steps.map((step, index) => (
          <TaskStepCard
            key={step.id}
            step={step}
            stepNumber={index + 1}
            isExpanded={step.status === 'executing'}
          />
        ))}
      </div>
      
      {/* Controls - During Execution */}
      {!isComplete && (onPause || onStop) && (
        <div className="flex-shrink-0 pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-4">
            {onPause && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPause}
                className="text-muted-foreground hover:text-foreground"
              >
                Pause
              </Button>
            )}
            <span className="text-muted-foreground">·</span>
            {onStop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStop}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Stop
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Completion Section */}
      {isComplete && (
        <div className="flex-shrink-0 pt-4 border-t border-border space-y-4">
          {/* Rating */}
          <TaskRating taskId={task.id} />
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {onDownloadAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadAll}
                className="flex-1"
              >
                Download All
              </Button>
            )}
            {onNewTask && (
              <Button
                size="sm"
                onClick={onNewTask}
                className="flex-1"
              >
                New Task
              </Button>
            )}
          </div>
          
          {/* Suggested Follow-ups */}
          <SuggestedFollowups task={task} />
        </div>
      )}
    </div>
  );
}
