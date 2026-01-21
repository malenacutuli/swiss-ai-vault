import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send,
  Mic,
  ArrowUp,
  Loader2,
  ChevronUp,
  ChevronDown,
  Terminal,
  Monitor,
  Maximize2,
  Minimize2,
  Square,
  Play,
  Pause,
  RotateCcw,
  User,
  Bot,
  FileText,
  Image as ImageIcon,
  Code,
  ExternalLink,
  Copy,
  Check,
  X,
  Github
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  artifacts?: Artifact[];
}

interface Artifact {
  type: 'file' | 'image' | 'code' | 'link';
  name: string;
  url?: string;
  content?: string;
  language?: string;
}

interface Step {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
}

interface Task {
  id: string;
  prompt: string;
  status: 'created' | 'planning' | 'executing' | 'waiting_user' | 'paused' | 'completed' | 'failed';
  plan_summary?: string;
  current_phase?: string;
  current_step?: number;
  total_steps?: number;
}

interface SwissBrAInExecutionViewProps {
  task: Task | null;
  messages: Message[];
  steps: Step[];
  logs: string[];
  terminalLines?: string[];
  terminalOutput?: string;
  previewUrl?: string;
  thinking?: string;
  isStreaming?: boolean;
  isExecuting?: boolean;
  onSendMessage: (message: string) => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onToggleManagementPanel?: () => void;
  showManagementPanel?: boolean;
}

export function SwissBrAInExecutionView({
  task,
  messages,
  steps,
  logs,
  terminalLines = [],
  terminalOutput = '',
  previewUrl,
  thinking,
  isStreaming = false,
  isExecuting = false,
  onSendMessage,
  onStop,
  onPause,
  onResume,
  onRetry,
  onToggleManagementPanel,
  showManagementPanel,
}: SwissBrAInExecutionViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview'>('terminal');
  const [isComputerExpanded, setIsComputerExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isStreaming) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isWaitingForUser = task?.status === 'waiting_user';
  const isRunning = task?.status === 'executing' || task?.status === 'planning';
  const isCompleted = task?.status === 'completed';
  const isFailed = task?.status === 'failed';

  return (
    <div className="flex h-full bg-[#FAFAFA]">
      {/* Left Panel - Chat */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#E5E5E5]">
        {/* Task Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#666666]" />
            </div>
            <div>
              <h2 className="font-medium text-[#1A1A1A] line-clamp-1">{task?.prompt || 'New Task'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-xs text-[#D35400]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {task?.current_phase || 'Processing...'}
                  </span>
                )}
                {isWaitingForUser && (
                  <span className="text-xs text-yellow-600">Waiting for your response</span>
                )}
                {isCompleted && (
                  <span className="text-xs text-green-600">Completed</span>
                )}
                {isFailed && (
                  <span className="text-xs text-red-600">Failed</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Task Controls */}
          <div className="flex items-center gap-2">
            {isRunning && onPause && (
              <Button variant="ghost" size="sm" onClick={onPause} className="h-8">
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </Button>
            )}
            {task?.status === 'paused' && onResume && (
              <Button variant="ghost" size="sm" onClick={onResume} className="h-8">
                <Play className="w-4 h-4 mr-1" />
                Resume
              </Button>
            )}
            {(isRunning || task?.status === 'paused') && onStop && (
              <Button variant="ghost" size="sm" onClick={onStop} className="h-8 text-red-600 hover:text-red-700">
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
            {isFailed && onRetry && (
              <Button variant="ghost" size="sm" onClick={onRetry} className="h-8">
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>

        {/* Plan Summary (Collapsible) */}
        {task?.plan_summary && (
          <div className="border-b border-[#E5E5E5] bg-white">
            <button
              onClick={() => setIsPlanExpanded(!isPlanExpanded)}
              className="flex items-center justify-between w-full px-6 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
            >
              <span className="text-sm font-medium text-[#666666]">
                Task Plan {task?.total_steps ? `(${task?.current_step || 0}/${task?.total_steps} steps)` : ''}
              </span>
              {isPlanExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#999999]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#999999]" />
              )}
            </button>
            <AnimatePresence>
              {isPlanExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 text-sm text-[#666666] whitespace-pre-wrap">
                    {task?.plan_summary}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#999999]">
              <p>Task execution will appear here...</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#D35400] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === 'user'
                      ? "bg-[#D35400] text-white"
                      : "bg-white border border-[#E5E5E5]"
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="text-sm text-[#1A1A1A] prose prose-sm max-w-none">
                      <Streamdown>{message.content}</Streamdown>
                    </div>
                  )}
                  
                  {/* Artifacts */}
                  {message.artifacts && message.artifacts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.artifacts.map((artifact, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-[#F5F5F5] rounded-lg"
                        >
                          {artifact.type === 'file' && <FileText className="w-4 h-4 text-[#666666]" />}
                          {artifact.type === 'image' && <ImageIcon className="w-4 h-4 text-[#666666]" />}
                          {artifact.type === 'code' && <Code className="w-4 h-4 text-[#666666]" />}
                          {artifact.type === 'link' && <ExternalLink className="w-4 h-4 text-[#666666]" />}
                          <span className="text-xs text-[#666666] flex-1 truncate">{artifact.name}</span>
                          {artifact.url && (
                            <a
                              href={artifact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#D35400] hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#666666]" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D35400] flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-[#E5E5E5] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D35400]" />
                  <span className="text-sm text-[#666666]">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Waiting for user indicator */}
          {isWaitingForUser && !isStreaming && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm text-yellow-700">Waiting for your response...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-[#E5E5E5] bg-white p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send message to SwissBrAIn"
                className="w-full px-4 py-3 pr-12 text-sm border border-[#E5E5E5] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#D35400]/20 focus:border-[#D35400] min-h-[48px] max-h-[120px]"
                rows={1}
                disabled={isStreaming}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#999999] hover:text-[#666666]"
                >
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isStreaming}
              className={cn(
                "h-12 w-12 rounded-xl p-0",
                inputValue.trim()
                  ? "bg-[#D35400] hover:bg-[#B84700] text-white"
                  : "bg-[#E5E5E5] text-[#999999] cursor-not-allowed"
              )}
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          {/* GitHub connection hint */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-[#999999]">
            <Github className="w-3.5 h-3.5" />
            <span>Connect GitHub for code tasks</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Computer/Preview */}
      <div className={cn(
        "flex flex-col bg-[#1A1A1A] transition-all duration-300",
        isComputerExpanded ? "w-[500px]" : "w-16"
      )}>
        {/* Computer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333]">
          {isComputerExpanded ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">SwissVault Computer</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('terminal')}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md transition-colors",
                    activeTab === 'terminal'
                      ? "bg-[#333333] text-white"
                      : "text-[#999999] hover:text-white"
                  )}
                >
                  <Terminal className="w-3.5 h-3.5 inline mr-1.5" />
                  Terminal
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md transition-colors",
                    activeTab === 'preview'
                      ? "bg-[#333333] text-white"
                      : "text-[#999999] hover:text-white"
                  )}
                >
                  <Monitor className="w-3.5 h-3.5 inline mr-1.5" />
                  Preview
                </button>
                <button
                  onClick={() => setIsComputerExpanded(false)}
                  className="p-1.5 text-[#999999] hover:text-white ml-2"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setIsComputerExpanded(true)}
              className="w-full flex items-center justify-center p-2 text-[#999999] hover:text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Computer Content */}
        {isComputerExpanded && (
          <div className="flex-1 overflow-hidden">
            {activeTab === 'terminal' ? (
              <div className="h-full p-4 font-mono text-sm text-green-400 overflow-y-auto">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#999999]">
                    <span className="text-[#D35400]">ubuntu@swiss</span>
                    <span>:</span>
                    <span className="text-blue-400">~</span>
                    <span>$</span>
                  </div>
                  {terminalLines.length > 0 ? (
                    terminalLines.map((line, index) => (
                      <div key={index} className="text-green-400">{line}</div>
                    ))
                  ) : terminalOutput ? (
                    <pre className="whitespace-pre-wrap text-green-400">{terminalOutput}</pre>
                  ) : (
                    <span className="text-[#666666]">Waiting for task execution...</span>
                  )}
                  {logs.map((log, index) => (
                    <div key={index} className="text-[#999999]">{log}</div>
                  ))}
                </div>
                
                {/* Blinking cursor */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[#D35400]">ubuntu@swiss</span>
                  <span className="text-[#999999]">:</span>
                  <span className="text-blue-400">~</span>
                  <span className="text-[#999999]">$</span>
                  <span className="w-2 h-4 bg-green-400 animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="h-full bg-white">
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-none"
                    title="Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[#999999]">
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live indicator */}
        {isComputerExpanded && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#333333]">
            <div className="flex items-center gap-2">
              <button className="p-1.5 text-[#999999] hover:text-white">
                <Pause className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-[#999999] hover:text-white">
                <Square className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-[#999999]">live</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
