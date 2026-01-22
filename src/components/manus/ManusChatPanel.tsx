import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  Play, 
  PanelRightOpen, 
  PanelRightClose,
  Loader2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Code,
  Globe,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ChatMessage, ExecutionStep } from '@/hooks/useAgentExecution';

// Type aliases for compatibility
type AgentStep = ExecutionStep;
type AgentLog = any;

interface Task {
  id: string;
  title: string;
  prompt: string;
  status: string;
  plan_summary?: string;
  current_phase?: number;
  total_phases?: number;
  credits_used?: number;
}

interface ManusChatPanelProps {
  task: Task | null;
  messages: ChatMessage[];
  logs: AgentLog[];
  steps: AgentStep[];
  terminalLines: string[];
  thinking?: string;
  isExecuting: boolean;
  onSendMessage: (message: string) => void;
  onStop: () => void;
  onResume?: () => void;
  onToggleManagementPanel: () => void;
  showManagementPanel: boolean;
}

// Tool icon mapping
const toolIcons: Record<string, React.ReactNode> = {
  shell: <Terminal className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
  browser: <Globe className="w-4 h-4" />,
  search: <Search className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
};

export function ManusChatPanel({
  task,
  messages,
  logs,
  steps,
  terminalLines,
  thinking,
  isExecuting,
  onSendMessage,
  onStop,
  onResume,
  onToggleManagementPanel,
  showManagementPanel,
}: ManusChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, logs, steps, thinking]);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleStepExpanded = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getToolIcon = (toolName: string) => {
    const lowerName = toolName.toLowerCase();
    for (const [key, icon] of Object.entries(toolIcons)) {
      if (lowerName.includes(key)) {
        return icon;
      }
    }
    return <Code className="w-4 h-4" />;
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          {task && (
            <>
              <h2 className="font-medium text-gray-900 truncate max-w-[300px]">
                {task.title || 'Task'}
              </h2>
              {task.current_phase && task.total_phases && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Phase {task.current_phase}/{task.total_phases}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExecuting && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          )}
          {task?.status === 'paused' && onResume && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResume}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <Play className="w-4 h-4 mr-1" />
              Resume
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleManagementPanel}
          >
            {showManagementPanel ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelRightOpen className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {/* Task Prompt */}
          {task?.prompt && (
            <div className="flex justify-end">
              <div className="bg-gray-100 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                <p className="text-gray-900">{task.prompt}</p>
              </div>
            </div>
          )}

          {/* Plan Summary */}
          {task?.plan_summary && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-medium text-blue-900 mb-2">Plan</h3>
              <p className="text-sm text-blue-800">{task.plan_summary}</p>
            </div>
          )}

          {/* Steps/Tool Calls */}
          {steps.map((step) => (
            <div key={step.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleStepExpanded(step.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getToolIcon(step.tool_name)}
                  <span className="font-medium text-gray-900">{step.tool_name}</span>
                  {step.description && (
                    <span className="text-sm text-gray-500 truncate max-w-[200px]">
                      {step.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStepStatusIcon(step.status)}
                  {expandedSteps.has(step.id) ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>
              {expandedSteps.has(step.id) && (
                <div className="p-4 border-t border-gray-200">
                  {step.input && (
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-500 mb-1">Input</h4>
                      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                        {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.output && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">Output</h4>
                      <pre className="text-xs bg-gray-100 text-gray-800 p-3 rounded-lg overflow-x-auto max-h-[200px]">
                        {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 max-w-[80%]",
                  message.role === 'user'
                    ? 'bg-gray-100 rounded-tr-sm'
                    : 'bg-amber-50 border border-amber-100 rounded-tl-sm'
                )}
              >
                <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Thinking Indicator */}
          {thinking && (
            <div className="flex items-start gap-3">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{thinking}</span>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Output */}
          {terminalLines.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Terminal</span>
              </div>
              <pre className="text-xs text-green-400 font-mono overflow-x-auto max-h-[200px]">
                {terminalLines.slice(-50).join('\n')}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-[#E5E5E5]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isExecuting ? "Send a message..." : "Type a message..."}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="bg-black hover:bg-gray-800 text-white rounded-xl h-12 w-12"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ManusChatPanel;
