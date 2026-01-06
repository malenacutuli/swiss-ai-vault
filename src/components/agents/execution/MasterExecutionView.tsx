import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ExecutionTask, ExecutionStep, TaskOutput } from '@/hooks/useAgentExecution';

interface Props {
  task: ExecutionTask;
  steps: ExecutionStep[];
  outputs: TaskOutput[];
  suggestions?: string[];
  isComplete: boolean;
  onBack?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onDownloadAll?: () => void;
  onNewTask?: () => void;
}

export const MasterExecutionView: React.FC<Props> = ({
  task,
  steps,
  outputs,
  suggestions = [],
  isComplete,
  onBack,
  onPause,
  onStop,
  onDownloadAll,
  onNewTask,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (!isComplete && task.started_at) {
      const startTime = new Date(task.started_at).getTime();
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isComplete, task.started_at]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIndicator = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">✓</span>;
      case 'executing':
      case 'running':
        return (
          <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center relative">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
          </span>
        );
      case 'failed':
        return <span className="w-5 h-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center text-xs font-bold">✕</span>;
      default:
        return <span className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground">○</span>;
    }
  };

  // Get step name from step_type or tool_name
  const getStepName = (step: ExecutionStep) => {
    if (step.tool_name) {
      return step.tool_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return step.step_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {task.plan_summary || task.prompt.substring(0, 50)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {task.status === 'executing' && `Step ${task.current_step || 0} of ${task.total_steps || 0}`}
                {task.status === 'completed' && 'Completed'}
                {task.status === 'failed' && 'Failed'}
                {task.status === 'planning' && 'Planning...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-muted-foreground">
              {formatElapsed(task.duration_ms || elapsed)}
            </span>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium",
              task.status === 'completed' && "bg-primary/10 text-primary",
              task.status === 'executing' && "bg-accent/10 text-accent",
              task.status === 'failed' && "bg-destructive/10 text-destructive",
              task.status === 'planning' && "bg-muted text-muted-foreground"
            )}>
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${task.progress_percentage || 0}%` }}
          />
        </div>
      </header>

      {/* Two-Panel Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Steps Progress */}
        <div className="w-[400px] border-r border-border bg-card flex flex-col">
          <h2 className="px-4 py-3 text-sm font-medium text-foreground border-b border-border">Execution Progress</h2>
          
          <div className="flex-1 overflow-y-auto">
            {steps.map((step) => (
              <div key={step.id} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIndicator(step.status)}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getStepName(step)}
                      </p>
                      {step.status === 'executing' && step.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {step.duration_ms && (
                      <span className="font-mono text-xs">{formatDuration(step.duration_ms)}</span>
                    )}
                    <span>{expandedSteps.has(step.id) ? '−' : '+'}</span>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedSteps.has(step.id) && (
                  <div className="px-4 pb-4 pt-1 ml-8 border-l-2 border-muted">
                    {step.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {step.description}
                      </p>
                    )}

                    {/* Tool info */}
                    {step.tool_name && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground">
                          Tool: {step.tool_name}
                        </span>
                      </div>
                    )}

                    {/* Error */}
                    {step.error_message && (
                      <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                        {step.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Control Buttons */}
          {!isComplete && (
            <div className="p-4 border-t border-border flex gap-2">
              {onPause && (
                <button
                  onClick={onPause}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  Pause
                </button>
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  className="flex-1 px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Output/Preview */}
        <div className="flex-1 flex flex-col bg-background">
          <h2 className="px-4 py-3 text-sm font-medium text-foreground border-b border-border">Results</h2>
          
          {outputs.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {outputs.map((output, i) => (
                <div key={output.id || i} className="p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
                        {output.output_type?.toUpperCase() || 'FILE'}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {output.file_name || `Output ${i + 1}`}
                      </span>
                    </div>
                    {output.download_url && (
                      <a
                        href={output.download_url}
                        className="text-xs text-primary hover:underline"
                        download
                      >
                        Download
                      </a>
                    )}
                  </div>
                  {output.preview_url && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <img 
                        src={output.preview_url} 
                        alt={output.file_name}
                        className="max-h-40 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {isComplete 
                ? 'No output files generated' 
                : 'Output will appear here...'}
            </div>
          )}

          {/* Download All & New Task */}
          {isComplete && outputs.length > 0 && (
            <div className="p-4 border-t border-border flex gap-2">
              {onDownloadAll && (
                <button
                  onClick={onDownloadAll}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Download All
                </button>
              )}
              {onNewTask && (
                <button
                  onClick={onNewTask}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  New Task
                </button>
              )}
            </div>
          )}

          {/* Suggestions */}
          {isComplete && suggestions.length > 0 && (
            <div className="border-t border-border p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Suggested Follow-ups
              </h3>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    className="px-3 py-1.5 text-sm border border-border rounded-full hover:bg-muted transition-colors text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {task.status === 'failed' && task.error_message && (
        <div className="p-6 bg-destructive/5 border-t border-destructive/20">
          <h3 className="font-medium text-destructive mb-2">Task Failed</h3>
          <p className="text-sm text-destructive/80 mb-4">{task.error_message}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default MasterExecutionView;
