import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import {
  PlanningView,
  PlanApproval,
  ExecutionProgress,
  PausedView,
  CompletionView,
  ErrorView,
  OutputPreview,
} from './execution';
import { useState, useEffect, useRef } from 'react';

interface AgentExecutionPanelProps {
  prompt: string;
  taskType?: string;
  privacyTier?: string;
  onClose: () => void;
  className?: string;
}

export function AgentExecutionPanel({
  prompt,
  taskType,
  privacyTier,
  onClose,
  className,
}: AgentExecutionPanelProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const hasStarted = useRef(false);
  
  const execution = useAgentExecution({
    onComplete: () => {
      console.log('[AgentExecution] Task completed');
    },
    onError: (error) => {
      console.error('[AgentExecution] Task error:', error);
    },
  });

  // Start execution on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      execution.createTask(prompt, {
        taskType,
        privacyTier,
      });
    }
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await execution.retryTask();
    setIsRetrying(false);
  };

  const handleCreateSimilar = () => {
    execution.reset();
    execution.createTask(prompt, { taskType, privacyTier });
  };

  const handleDownloadAll = () => {
    execution.outputs.forEach(output => {
      execution.downloadOutput(output);
    });
  };

  // Determine if we should show split view (during execution with preview)
  const showSplitView = execution.isExecuting && execution.currentOutput;

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm',
      'flex flex-col',
      className
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-foreground truncate">
            {prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt}
          </h2>
          <p className="text-sm text-muted-foreground">
            {execution.status === 'planning' && 'Creating plan...'}
            {execution.status === 'awaiting_approval' && 'Review the plan'}
            {execution.status === 'executing' && 'Executing...'}
            {execution.status === 'paused' && 'Paused'}
            {execution.status === 'completed' && 'Completed'}
            {execution.status === 'failed' && 'Failed'}
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showSplitView ? (
          // Split view during execution with preview
          <div className="flex h-full">
            {/* Left Panel: Progress */}
            <div className="w-[40%] border-r border-border overflow-y-auto p-6">
              <ExecutionProgress
                task={execution.task!}
                steps={execution.steps}
                onPause={execution.pauseTask}
                onStop={execution.stopTask}
              />
            </div>
            
            {/* Right Panel: Preview */}
            <div className="flex-1 p-6">
              <OutputPreview
                output={execution.currentOutput}
                isLoading={execution.isExecuting && !execution.currentOutput}
              />
            </div>
          </div>
        ) : (
          // Single panel view for other states
          <div className="max-w-2xl mx-auto px-6 py-8 h-full overflow-y-auto">
            {/* Planning State */}
            {execution.isPlanning && (
              <PlanningView />
            )}

            {/* Approval State */}
            {execution.isAwaitingApproval && execution.task && (
              <PlanApproval
                task={execution.task}
                steps={execution.steps}
                onApprove={execution.approveAndStart}
                onReject={onClose}
              />
            )}

            {/* Executing State (without preview) */}
            {execution.isExecuting && !execution.currentOutput && execution.task && (
              <ExecutionProgress
                task={execution.task}
                steps={execution.steps}
                onPause={execution.pauseTask}
                onStop={execution.stopTask}
              />
            )}

            {/* Paused State */}
            {execution.isPaused && execution.task && (
              <PausedView
                task={execution.task}
                steps={execution.steps}
                onResume={execution.resumeTask}
                onStop={execution.stopTask}
              />
            )}

            {/* Completed State */}
            {execution.isCompleted && execution.task && (
              <CompletionView
                task={execution.task}
                outputs={execution.outputs}
                onDownload={execution.downloadOutput}
                onDownloadAll={handleDownloadAll}
                onCreateSimilar={handleCreateSimilar}
                onNewTask={onClose}
              />
            )}

            {/* Error State */}
            {execution.isFailed && execution.task && (
              <ErrorView
                task={execution.task}
                steps={execution.steps}
                error={execution.error || 'An error occurred'}
                onRetry={handleRetry}
                onBack={onClose}
                isRetrying={isRetrying}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
