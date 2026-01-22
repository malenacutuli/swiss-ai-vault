import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import {
  PlanningView,
  PlanApproval,
  PausedView,
  CompletionView,
  ErrorView,
} from './execution';
import { MasterExecutionView } from './execution/MasterExecutionView';
import { useState, useEffect, useRef } from 'react';

interface AgentExecutionPanelProps {
  prompt: string;
  taskType?: string;
  privacyTier?: string;
  memoryContext?: string | null;
  onClose: () => void;
  className?: string;
}

export function AgentExecutionPanel({
  prompt,
  taskType,
  privacyTier,
  memoryContext,
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
        memoryContext: memoryContext || undefined,
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
      // Download via URL
      if (output.download_url) {
        window.open(output.download_url, '_blank');
      }
    });
  };

  // Use master execution view for executing state
  const showMasterView = execution.isExecuting && execution.task;

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-background',
      'flex flex-col',
      className
    )}>
      {/* Header - Minimal */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium text-foreground truncate">
            {prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {execution.status === 'planning' && 'Creating execution plan...'}
            {execution.status === 'awaiting_approval' && 'Review and approve the plan'}
            {execution.status === 'executing' && `Step ${execution.task?.current_step || 1} of ${execution.task?.total_steps || execution.steps.length}`}
            {execution.status === 'paused' && 'Execution paused'}
            {execution.status === 'completed' && 'Task completed successfully'}
            {execution.status === 'failed' && 'Task failed'}
          </p>
        </div>
        
        {/* Close button - text only, no icon */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          Close
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Planning State */}
        {execution.isPlanning && (
          <div className="max-w-2xl mx-auto px-6 py-8 h-full overflow-y-auto">
            <PlanningView />
          </div>
        )}

        {/* Approval State */}
        {execution.isAwaitingApproval && execution.task && (
          <div className="max-w-2xl mx-auto px-6 py-8 h-full overflow-y-auto">
            <PlanApproval
              task={execution.task}
              steps={execution.steps}
              onApprove={() => execution.sendMessage('approved')}
              onReject={onClose}
            />
          </div>
        )}

        {/* MASTER EXECUTION VIEW - Two-panel layout */}
        {showMasterView && (
          <div className="h-full p-6">
            <MasterExecutionView
              task={execution.task!}
              steps={execution.steps}
              outputs={execution.outputs}
              isComplete={false}
              onPause={execution.pauseTask}
              onStop={execution.stopTask}
              onDownloadAll={handleDownloadAll}
              onNewTask={onClose}
            />
          </div>
        )}

        {/* Paused State */}
        {execution.isPaused && execution.task && (
          <div className="max-w-2xl mx-auto px-6 py-8 h-full overflow-y-auto">
            <PausedView
              task={execution.task}
              steps={execution.steps}
              onResume={() => execution.sendMessage('resume')}
              onStop={execution.stopTask}
            />
          </div>
        )}

        {/* Completed State - Also uses master view */}
        {execution.isCompleted && execution.task && (
          <div className="h-full p-6">
            <MasterExecutionView
              task={execution.task}
              steps={execution.steps}
              outputs={execution.outputs}
              isComplete={true}
              onDownloadAll={handleDownloadAll}
              onNewTask={onClose}
            />
          </div>
        )}

        {/* Error State */}
        {execution.isFailed && execution.task && (
          <div className="max-w-2xl mx-auto px-6 py-8 h-full overflow-y-auto">
            <ErrorView
              task={execution.task}
              steps={execution.steps}
              error={execution.error || 'An error occurred'}
              onRetry={handleRetry}
              onBack={onClose}
              isRetrying={isRetrying}
            />
          </div>
        )}
      </div>
    </div>
  );
}
