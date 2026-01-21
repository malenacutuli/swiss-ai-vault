/**
 * Enhanced Agents Execution View V2
 * 
 * Integrates real-time streaming, terminal output, sandbox preview, and file browser
 * for a complete agent execution experience similar to Manus.im
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Send, 
  Monitor, 
  Terminal,
  Folder,
  Play,
  Pause,
  Square,
  Check,
  X,
  Circle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Sparkles,
  Code,
  FileText,
  Globe,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgentExecutionV2, ExecutionTask, ExecutionStep, TaskOutput, TerminalLine } from '@/hooks/useAgentExecutionV2';
import { AgentTerminal } from '@/components/agent/AgentTerminal';
import { SandboxPreview } from '@/components/agent/SandboxPreview';
import { FileBrowser, FileNode } from '@/components/agent/FileBrowser';

interface AgentsExecutionViewV2Props {
  taskId?: string;
  initialPrompt?: string;
  onComplete?: (task: ExecutionTask) => void;
  onNewTask?: () => void;
  className?: string;
}

export function AgentsExecutionViewV2({
  taskId,
  initialPrompt,
  onComplete,
  onNewTask,
  className,
}: AgentsExecutionViewV2Props) {
  // State
  const [inputValue, setInputValue] = useState(initialPrompt || '');
  const [rightPanel, setRightPanel] = useState<'terminal' | 'preview' | 'files'>('terminal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [files, setFiles] = useState<FileNode[]>([]);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Agent execution hook
  const {
    task,
    steps,
    logs,
    outputs,
    status,
    error,
    thinking,
    sandboxUrl,
    isIdle,
    isExecuting,
    isPlanning,
    isCompleted,
    isFailed,
    executeTask,
    loadTask,
    stopTask,
    pauseTask,
    resumeTask,
    reset,
  } = useAgentExecutionV2({
    onComplete: (completedTask) => {
      onComplete?.(completedTask);
    },
    onError: (errorMsg) => {
      console.error('Task error:', errorMsg);
    },
    onToolCall: (step) => {
      // Auto-switch to terminal on tool calls
      if (rightPanel !== 'terminal') {
        setRightPanel('terminal');
      }
    },
    onTerminalOutput: (line) => {
      // Auto-scroll terminal
    },
  });

  // Load existing task if taskId provided
  useEffect(() => {
    if (taskId && isIdle) {
      loadTask(taskId);
    }
  }, [taskId, isIdle, loadTask]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, thinking]);

  // Handle submit
  const handleSubmit = async () => {
    if (!inputValue.trim() || isExecuting) return;

    const prompt = inputValue.trim();
    setInputValue('');
    
    await executeTask({
      prompt,
      task_type: 'general',
      mode: 'agent',
    });
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Calculate progress
  const progress = task?.progress_percentage || 
    (steps.length > 0 ? (steps.filter(s => s.status === 'completed').length / steps.length) * 100 : 0);

  // Get status display
  const getStatusDisplay = () => {
    if (isPlanning) return { text: 'Planning...', color: 'text-yellow-500' };
    if (isExecuting) return { text: 'Executing...', color: 'text-blue-500' };
    if (isCompleted) return { text: 'Completed', color: 'text-green-500' };
    if (isFailed) return { text: 'Failed', color: 'text-red-500' };
    return { text: 'Ready', color: 'text-gray-500' };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={cn(
      "flex h-full bg-[#FAFAF8]",
      isFullscreen && "fixed inset-0 z-50",
      className
    )}>
      {/* LEFT PANEL - Chat/Steps */}
      <div className="w-1/2 flex flex-col border-r border-[#E5E5E5]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E5E5]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#722F37] to-[#8B3A44] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#2A2A2A]">SwissBrain Agent</h2>
              <p className={cn("text-xs", statusDisplay.color)}>{statusDisplay.text}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isExecuting && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs text-blue-600">Live</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={isExecuting}
              className="text-[#666]"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat/Steps Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Initial prompt */}
            {task?.prompt && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#666]" />
                </div>
                <div className="flex-1 bg-white rounded-lg p-3 border border-[#E5E5E5]">
                  <p className="text-sm text-[#2A2A2A]">{task.prompt}</p>
                </div>
              </div>
            )}

            {/* Planning phase */}
            {isPlanning && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#722F37] to-[#8B3A44] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 bg-white rounded-lg p-3 border border-[#E5E5E5]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#722F37] animate-spin" />
                    <span className="text-sm text-[#666]">Planning task execution...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Thinking */}
            {thinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#722F37] to-[#8B3A44] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 bg-[#FFF8F0] rounded-lg p-3 border border-[#FFE4CC]">
                  <p className="text-xs text-[#996633] mb-1">Thinking...</p>
                  <p className="text-sm text-[#664422]">{thinking}</p>
                </div>
              </div>
            )}

            {/* Execution Steps */}
            {steps.map((step, index) => (
              <ExecutionStepCard
                key={step.id}
                step={step}
                stepNumber={index + 1}
                totalSteps={steps.length}
              />
            ))}

            {/* Error */}
            {error && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1 bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Completion */}
            {isCompleted && task?.result_summary && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-sm text-green-700">{task.result_summary}</p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-[#E5E5E5]">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isExecuting ? "Agent is working..." : "Describe your task..."}
              disabled={isExecuting}
              className="min-h-[44px] max-h-[120px] resize-none bg-[#FAFAF8] border-[#E5E5E5] focus:border-[#722F37] focus:ring-[#722F37]/20"
              rows={1}
            />
            <Button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isExecuting}
              className="h-11 w-11 p-0 bg-[#722F37] hover:bg-[#5a252c] rounded-lg"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Terminal/Preview/Files */}
      <div className="w-1/2 flex flex-col bg-[#1A1A1A]">
        {/* Panel Header with Tabs */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#333]">
          <Tabs value={rightPanel} onValueChange={(v) => setRightPanel(v as any)} className="w-full">
            <div className="flex items-center justify-between w-full">
              <TabsList className="bg-[#2A2A2A] p-0.5">
                <TabsTrigger 
                  value="terminal" 
                  className="px-3 py-1 text-xs data-[state=active]:bg-[#444] data-[state=active]:text-white text-[#888]"
                >
                  <Terminal className="w-3 h-3 mr-1" />
                  Terminal
                </TabsTrigger>
                <TabsTrigger 
                  value="preview" 
                  className="px-3 py-1 text-xs data-[state=active]:bg-[#444] data-[state=active]:text-white text-[#888]"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Preview
                </TabsTrigger>
                <TabsTrigger 
                  value="files" 
                  className="px-3 py-1 text-xs data-[state=active]:bg-[#444] data-[state=active]:text-white text-[#888]"
                >
                  <Folder className="w-3 h-3 mr-1" />
                  Files
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-1">
                {sandboxUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-[#888] hover:text-white"
                    onClick={() => window.open(sandboxUrl, '_blank')}
                  >
                    Open Sandbox
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#666] hover:text-white"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Tabs>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          {rightPanel === 'terminal' && (
            <AgentTerminal
              lines={logs}
              isConnected={isExecuting}
              sandboxUrl={sandboxUrl || undefined}
              className="h-full rounded-none border-0"
            />
          )}

          {rightPanel === 'preview' && (
            <SandboxPreview
              url={sandboxUrl}
              isLoading={isPlanning || (isExecuting && !sandboxUrl)}
              className="h-full rounded-none border-0"
            />
          )}

          {rightPanel === 'files' && (
            <FileBrowser
              files={files}
              isLoading={isExecuting}
              className="h-full rounded-none border-0"
            />
          )}
        </div>

        {/* Playback Controls / Progress */}
        <div className="px-4 py-3 bg-[#111] border-t border-[#333]">
          <div className="flex items-center gap-4">
            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#888] hover:text-white hover:bg-[#333]"
                onClick={status === 'paused' ? resumeTask : pauseTask}
                disabled={!isExecuting && status !== 'paused'}
              >
                {status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#888] hover:text-red-500 hover:bg-[#333]"
                onClick={stopTask}
                disabled={!isExecuting}
              >
                <Square className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="flex-1">
              <div className="h-1 bg-[#333] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#722F37] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {isExecuting && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-400">live</span>
                </div>
              )}
              <span className="text-xs text-[#666]">
                {steps.filter(s => s.status === 'completed').length}/{steps.length} steps
              </span>
            </div>
          </div>

          {/* Completion */}
          {isCompleted && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-[#1a2f1a] rounded-lg border border-green-800/50">
              <Check className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-sm text-green-400">Task completed successfully</p>
                <p className="text-xs text-green-600">
                  {steps.length} steps completed
                  {task?.duration_ms && ` in ${(task.duration_ms / 1000).toFixed(1)}s`}
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

          {/* Outputs */}
          {outputs.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-[#666]">Outputs:</p>
              {outputs.map(output => (
                <a
                  key={output.id}
                  href={output.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 bg-[#222] rounded hover:bg-[#2a2a2a] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#722F37]" />
                  <span className="text-sm text-[#ccc] flex-1 truncate">{output.file_name}</span>
                  <span className="text-xs text-[#666]">{output.output_type}</span>
                </a>
              ))}
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
        return <Circle className="w-4 h-4 text-[#ccc]" />;
    }
  };

  const getToolIcon = () => {
    const toolName = step.tool_name?.toLowerCase() || '';
    if (toolName.includes('shell') || toolName.includes('exec')) return <Terminal className="w-3 h-3" />;
    if (toolName.includes('file') || toolName.includes('write')) return <FileText className="w-3 h-3" />;
    if (toolName.includes('browser') || toolName.includes('web')) return <Globe className="w-3 h-3" />;
    if (toolName.includes('code')) return <Code className="w-3 h-3" />;
    return <Settings className="w-3 h-3" />;
  };

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#722F37] to-[#8B3A44] flex items-center justify-center flex-shrink-0">
        {getToolIcon()}
      </div>
      <div className="flex-1 bg-white rounded-lg border border-[#E5E5E5] overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#FAFAF8] transition-colors"
        >
          {getStatusIcon()}
          <span className="flex-1 text-sm text-[#4A4A4A]">
            {step.description || step.tool_name || `Step ${stepNumber}`}
          </span>
          <span className="text-xs text-[#999]">
            {stepNumber}/{totalSteps}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#999]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#999]" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-0 border-t border-[#E5E5E5]">
            <div className="mt-3 text-xs text-[#666] space-y-2">
              {step.tool_name && (
                <div className="flex items-center gap-2">
                  <span className="text-[#999]">Tool:</span>
                  <code className="px-1.5 py-0.5 bg-[#F5F5F5] rounded text-[#722F37]">
                    {step.tool_name}
                  </code>
                </div>
              )}
              {step.tool_input && (
                <div>
                  <span className="text-[#999]">Input:</span>
                  <pre className="mt-1 p-2 bg-[#F5F5F5] rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(step.tool_input, null, 2)}
                  </pre>
                </div>
              )}
              {step.tool_output && (
                <div>
                  <span className="text-[#999]">Output:</span>
                  <pre className="mt-1 p-2 bg-[#F5F5F5] rounded text-[10px] overflow-x-auto max-h-[200px]">
                    {typeof step.tool_output === 'string' 
                      ? step.tool_output 
                      : JSON.stringify(step.tool_output, null, 2)}
                  </pre>
                </div>
              )}
              {step.duration_ms && (
                <p><span className="text-[#999]">Duration:</span> {step.duration_ms}ms</p>
              )}
              {step.error_message && (
                <p className="text-red-500">
                  <span className="text-[#999]">Error:</span> {step.error_message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentsExecutionViewV2;
