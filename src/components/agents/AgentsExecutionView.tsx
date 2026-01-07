import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Pause, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Circle, 
  Loader2, 
  FileText, 
  Code,
  Monitor,
  Terminal,
  Maximize2,
  Minimize2,
  X,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskLogs } from '@/hooks/useTaskLogs';
import type { ExecutionTask, ExecutionStep, TaskOutput } from '@/hooks/useAgentExecution';

interface AgentsExecutionViewProps {
  task: ExecutionTask;
  steps: ExecutionStep[];
  outputs: TaskOutput[];
  onSendMessage: (message: string) => void;
  onCancel: () => void;
  onPause?: () => void;
  onNewTask?: () => void;
}

// Task type configuration
const TASK_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  slides: { label: 'Slides', icon: <FileText className="w-4 h-4" /> },
  research: { label: 'Research', icon: <Code className="w-4 h-4" /> },
  document: { label: 'Document', icon: <FileText className="w-4 h-4" /> },
  code: { label: 'Code', icon: <Code className="w-4 h-4" /> },
  podcast: { label: 'Podcast', icon: <Mic className="w-4 h-4" /> },
  default: { label: 'Task', icon: <FileText className="w-4 h-4" /> },
};

export function AgentsExecutionView({ 
  task, 
  steps,
  outputs,
  onSendMessage, 
  onCancel,
  onPause,
  onNewTask
}: AgentsExecutionViewProps) {
  const [rightPanel, setRightPanel] = useState<'terminal' | 'preview'>('terminal');
  const [message, setMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { logs, isLive } = useTaskLogs(task.id);
  const terminalRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const taskConfig = TASK_CONFIG[task.task_type || 'default'] || TASK_CONFIG.default;

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [steps]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  // Use task state as source of truth when completed
  const completedSteps = task?.status === 'completed' 
    ? (task.total_steps || steps.length || 4) 
    : steps.filter(s => s.status === 'completed').length;
  const currentStep = steps.find(s => s.status === 'executing' || s.status === 'running');
  const progress = task?.status === 'completed'
    ? 100
    : steps.length > 0 
      ? (completedSteps / steps.length) * 100 
      : (task?.progress_percentage || 0);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#FAFAF8] rounded-xl overflow-hidden border border-[#E5E5E5]">
      {/* LEFT PANEL - Chat */}
      <div className="w-1/2 flex flex-col bg-white border-r border-[#E5E5E5]">
        {/* Task Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#722F37]/10 flex items-center justify-center text-[#722F37]">
              {taskConfig.icon}
            </div>
            <span className="text-sm font-medium text-[#1A1A1A]">{taskConfig.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {onPause && (
              <Button variant="ghost" size="sm" onClick={onPause} className="h-8 w-8 p-0">
                <Pause className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User Message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#722F37] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              U
            </div>
            <div className="flex-1 bg-[#FAFAF8] rounded-xl p-4 border border-[#E5E5E5]">
              <p className="text-sm text-[#1A1A1A]">{task.prompt}</p>
            </div>
          </div>

          {/* Agent Response */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#722F37] to-[#1A365D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              S
            </div>
            <div className="flex-1 space-y-3">
              {/* Agent badge */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-[#722F37]">swiss</span>
                <span className="text-xs bg-[#722F37] text-white px-1.5 py-0.5 rounded">Pro</span>
              </div>

              {/* Initial response */}
              {task.plan_summary && (
                <div className="bg-[#FAFAF8] rounded-xl p-4 border border-[#E5E5E5]">
                  <p className="text-sm text-[#4A4A4A]">{task.plan_summary}</p>
                </div>
              )}

              {/* Execution Steps */}
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <ExecutionStepCard 
                    key={step.id} 
                    step={step} 
                    stepNumber={index + 1}
                    totalSteps={steps.length}
                  />
                ))}
              </div>

              {/* Show result when task is completed */}
              {task?.status === 'completed' && task?.result && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Result
                  </h4>
                  <div className="prose prose-sm max-w-none">
                    {typeof task.result === 'object' && task.result.content ? (
                      <div className="whitespace-pre-wrap text-gray-700">{task.result.content}</div>
                    ) : typeof task.result === 'string' ? (
                      <div className="whitespace-pre-wrap text-gray-700">{task.result}</div>
                    ) : (
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(task.result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Show error when task failed */}
              {task?.status === 'failed' && task?.error_message && (
                <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Error
                  </h4>
                  <p className="text-red-700">{task.error_message}</p>
                </div>
              )}

              {/* Current action indicator */}
              {currentStep && isLive && (
                <div className="flex items-center gap-2 text-sm text-[#666666]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#722F37]" />
                  <span>{currentStep.description || 'Processing...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled
              title="Upload files via Studio before starting a task"
              className="h-9 w-9 p-0 text-[#CCCCCC] cursor-not-allowed opacity-50"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send message to Swiss Agent"
              className="flex-1 border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-[#666666]">
              <Mic className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={handleSend}
              disabled={!message.trim()}
              className="h-9 w-9 p-0 bg-[#722F37] hover:bg-[#5a252c] rounded-full"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Terminal/Preview */}
      <div className="w-1/2 flex flex-col bg-[#1A1A1A]">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#333333]">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[#666666]" />
            <span className="text-sm text-[#CCCCCC]">SwissVault Computer</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-[#2A2A2A] rounded-lg p-0.5">
              <button
                onClick={() => setRightPanel('terminal')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  rightPanel === 'terminal'
                    ? "bg-[#444444] text-white"
                    : "text-[#888888] hover:text-white"
                )}
              >
                <Terminal className="w-3 h-3 inline mr-1" />
                Terminal
              </button>
              <button
                onClick={() => setRightPanel('preview')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  rightPanel === 'preview'
                    ? "bg-[#444444] text-white"
                    : "text-[#888888] hover:text-white"
                )}
              >
                <Monitor className="w-3 h-3 inline mr-1" />
                Preview
              </button>
            </div>

            {/* Window controls */}
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 text-[#666666] hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {rightPanel === 'terminal' ? (
          <div 
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
          >
            {logs.length === 0 && (
              <div className="text-[#666666]">
                <span className="text-green-400">ubuntu@swiss</span>
                <span className="text-white">:</span>
                <span className="text-blue-400">~</span>
                <span className="text-white">$ </span>
                <span className="text-[#888888]">Waiting for task execution...</span>
              </div>
            )}
            {logs.map((log, i) => (
              <div key={log.id || i} className="mb-1">
                {log.log_type === 'command' && (
                  <>
                    <span className="text-green-400">ubuntu@swiss</span>
                    <span className="text-white">:</span>
                    <span className="text-blue-400">~</span>
                    <span className="text-white">$ </span>
                  </>
                )}
                <span className={cn(
                  log.log_type === 'error' ? 'text-red-400' :
                  log.log_type === 'success' ? 'text-green-400' :
                  log.log_type === 'info' ? 'text-blue-400' :
                  'text-[#CCCCCC]'
                )}>
                  {log.content}
                </span>
              </div>
            ))}
            {isLive && (
              <div className="flex items-center">
                <span className="text-green-400">ubuntu@swiss</span>
                <span className="text-white">:</span>
                <span className="text-blue-400">~</span>
                <span className="text-white">$ </span>
                <span className="w-2 h-4 bg-white animate-pulse" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {outputs.length > 0 ? (
              <div className="space-y-4">
                {outputs.map(output => (
                  <div 
                    key={output.id}
                    className="bg-[#2A2A2A] rounded-lg p-4 border border-[#333333]"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#722F37]" />
                      <div>
                        <p className="text-sm text-white">{output.file_name}</p>
                        <p className="text-xs text-[#888888]">{output.output_type}</p>
                      </div>
                      {output.download_url && (
                        <a 
                          href={output.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-[#722F37] hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#666666] text-sm">
                No outputs yet
              </div>
            )}
          </div>
        )}

        {/* Playback Controls / Progress */}
        <div className="px-4 py-3 bg-[#111111] border-t border-[#333333]">
          <div className="flex items-center gap-4">
            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0 text-[#888888] hover:text-white hover:bg-[#333333]"
                onClick={onPause}
              >
                {task.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0 text-[#888888] hover:text-red-500 hover:bg-[#333333]"
                onClick={onCancel}
              >
                <Square className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="flex-1">
              <div className="h-1 bg-[#333333] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#722F37] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Live indicator */}
            {isLive && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400">live</span>
              </div>
            )}
          </div>

          {/* Completion indicator */}
          {task.status === 'completed' && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-[#1a2f1a] rounded-lg border border-green-800/50">
              <Check className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-sm text-green-400">Task completed successfully</p>
                <p className="text-xs text-green-600">
                  {task?.status === 'completed' 
                    ? `${task.total_steps || 4}/${task.total_steps || 4} steps completed`
                    : `${completedSteps}/${steps.length} steps completed`
                  }
                </p>
              </div>
              {onNewTask && (
                <Button 
                  size="sm" 
                  onClick={onNewTask}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                >
                  New Task
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Execution Step Card Component
interface ExecutionStepCardProps {
  step: ExecutionStep;
  stepNumber: number;
  totalSteps: number;
}

function ExecutionStepCard({ step, stepNumber, totalSteps }: ExecutionStepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'executing':
      case 'running':
        return <Loader2 className="w-4 h-4 text-[#722F37] animate-spin" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-[#CCCCCC]" />;
    }
  };

  return (
    <div className="bg-[#FAFAF8] rounded-lg border border-[#E5E5E5] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F0F0F0] transition-colors"
      >
        {getStatusIcon()}
        <span className="flex-1 text-sm text-[#4A4A4A]">
          {step.description || step.tool_name || `Step ${stepNumber}`}
        </span>
        <span className="text-xs text-[#999999]">
          {stepNumber}/{totalSteps}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#999999]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#999999]" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[#E5E5E5]">
          <div className="mt-3 text-xs text-[#666666] space-y-1">
            {step.tool_name && (
              <p><span className="text-[#999999]">Tool:</span> {step.tool_name}</p>
            )}
            {step.duration_ms && (
              <p><span className="text-[#999999]">Duration:</span> {step.duration_ms}ms</p>
            )}
            {step.error_message && (
              <p className="text-red-500"><span className="text-[#999999]">Error:</span> {step.error_message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
