import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TaskProgressPanel } from './TaskProgressPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import type { ExecutionTask, ExecutionStep, TaskOutput } from '@/hooks/useAgentExecution';

interface MasterExecutionViewProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  outputs: TaskOutput[];
  isComplete: boolean;
  onPause?: () => void;
  onStop?: () => void;
  onDownloadAll?: () => void;
  onNewTask?: () => void;
  className?: string;
}

export function MasterExecutionView({
  task,
  steps,
  outputs,
  isComplete,
  onPause,
  onStop,
  onDownloadAll,
  onNewTask,
  className,
}: MasterExecutionViewProps) {
  const currentStep = steps.find(s => s.status === 'executing');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('flex h-full gap-6', className)}
    >
      {/* LEFT PANEL - Task Progress */}
      <div className="w-[380px] flex-shrink-0 overflow-hidden">
        <TaskProgressPanel
          task={task}
          steps={steps}
          isComplete={isComplete}
          onPause={onPause}
          onStop={onStop}
          onDownloadAll={onDownloadAll}
          onNewTask={onNewTask}
        />
      </div>
      
      {/* RIGHT PANEL - Live Preview */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <LivePreviewPanel
          steps={steps}
          outputs={outputs}
          currentStep={currentStep}
          onDownloadAll={onDownloadAll}
        />
      </div>
    </motion.div>
  );
}
