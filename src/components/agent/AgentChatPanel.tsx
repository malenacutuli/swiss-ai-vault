/**
 * AgentChatPanel - Manus.im Parity Chat Interface
 * 
 * This component replicates the left-side chat panel from Manus.im
 * including progress indicators, knowledge badges, and real-time updates.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Mic,
  Paperclip,
  Github,
  Pause,
  Square,
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
  Brain,
  FileText,
  Code,
  Terminal,
  Globe,
  Database,
  Image as ImageIcon,
  File,
  Sparkles,
  BookOpen,
  Search,
  Edit3,
  Copy,
  RotateCcw,
  MoreHorizontal,
  User,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';

// Types
interface AgentAction {
  id: string;
  type: 'thinking' | 'reading' | 'writing' | 'executing' | 'searching' | 'browsing' | 'generating';
  description: string;
  file?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  source: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: AgentAction[];
  knowledge?: KnowledgeItem[];
  phase?: {
    current: number;
    total: number;
    name: string;
  };
  elapsedTime?: string;
  status?: 'thinking' | 'executing' | 'completed' | 'failed';
  preview?: {
    type: 'image' | 'code' | 'file';
    url?: string;
    content?: string;
    filename?: string;
  };
}

interface AgentChatPanelProps {
  taskId?: string;
  taskTitle?: string;
  messages: ChatMessage[];
  isExecuting?: boolean;
  currentPhase?: { current: number; total: number; name: string };
  elapsedTime?: string;
  onSendMessage?: (message: string, attachments?: File[]) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRetry?: () => void;
}

// Action Icon Component
const ActionIcon: React.FC<{ type: AgentAction['type'] }> = ({ type }) => {
  const icons = {
    thinking: Brain,
    reading: FileText,
    writing: Edit3,
    executing: Terminal,
    searching: Search,
    browsing: Globe,
    generating: Sparkles,
  };
  const Icon = icons[type] || Zap;
  return <Icon className="h-4 w-4" />;
};

// Status Badge Component
const StatusBadge: React.FC<{ status: ChatMessage['status'] }> = ({ status }) => {
  if (!status) return null;

  const config = {
    thinking: { icon: Loader2, label: 'Thinking', className: 'animate-spin text-blue-500' },
    executing: { icon: Zap, label: 'Executing', className: 'text-yellow-500' },
    completed: { icon: CheckCircle, label: 'Completed', className: 'text-green-500' },
    failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon className={cn("h-4 w-4", className)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
};

// Knowledge Badge Component
const KnowledgeBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <BookOpen className="h-3 w-3" />
      Knowledge recalled({count})
    </Badge>
  );
};

// Phase Progress Component
const PhaseProgress: React.FC<{
  current: number;
  total: number;
  name: string;
  elapsedTime?: string;
  status?: string;
}> = ({ current, total, name, elapsedTime, status }) => {
  return (
    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        {status === 'thinking' ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">{current}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground">{current}/{total}</span>
        </div>
        <Progress value={(current / total) * 100} className="h-1" />
      </div>
      {elapsedTime && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {elapsedTime}
        </div>
      )}
      {status && (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      )}
    </div>
  );
};

// Action Item Component
const ActionItem: React.FC<{ action: AgentAction; isExpanded?: boolean }> = ({ 
  action, 
  isExpanded = false 
}) => {
  const statusColors = {
    pending: 'text-muted-foreground',
    in_progress: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className={cn("mt-0.5", statusColors[action.status])}>
        {action.status === 'in_progress' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ActionIcon type={action.type} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{action.description}</p>
        {action.file && (
          <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded">
            {action.file}
          </code>
        )}
      </div>
      {action.status === 'completed' && (
        <CheckCircle className="h-4 w-4 text-green-500" />
      )}
    </div>
  );
};

// Chat Message Component
const ChatMessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const [isActionsExpanded, setIsActionsExpanded] = useState(true);

  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3 py-4", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <>
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/swiss-brain-icon.svg" />
            <AvatarFallback className="bg-red-600 text-white">S</AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Message Content */}
      <div className={cn("flex-1 space-y-2", isUser ? "items-end" : "items-start")}>
        {/* User Name & Badges */}
        <div className={cn("flex items-center gap-2", isUser ? "justify-end" : "justify-start")}>
          <span className="text-sm font-medium">
            {isUser ? 'You' : 'swiss'}
          </span>
          {!isUser && (
            <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
              Pro
            </Badge>
          )}
        </div>

        {/* Message Bubble */}
        <div className={cn(
          "rounded-lg p-3 max-w-[90%]",
          isUser 
            ? "bg-primary text-primary-foreground ml-auto" 
            : "bg-muted"
        )}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Knowledge Badge */}
        {message.knowledge && message.knowledge.length > 0 && (
          <KnowledgeBadge count={message.knowledge.length} />
        )}

        {/* Phase Progress */}
        {message.phase && (
          <PhaseProgress
            current={message.phase.current}
            total={message.phase.total}
            name={message.phase.name}
            elapsedTime={message.elapsedTime}
            status={message.status}
          />
        )}

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <Collapsible open={isActionsExpanded} onOpenChange={setIsActionsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                {isActionsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span className="text-xs">
                  {message.actions.length} action{message.actions.length !== 1 ? 's' : ''}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 pl-2 border-l-2 border-muted space-y-1">
                {message.actions.map((action) => (
                  <ActionItem key={action.id} action={action} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Preview */}
        {message.preview && (
          <div className="mt-2 rounded-lg overflow-hidden border">
            {message.preview.type === 'image' && message.preview.url && (
              <img 
                src={message.preview.url} 
                alt="Preview" 
                className="max-w-full h-auto"
              />
            )}
            {message.preview.type === 'code' && message.preview.content && (
              <pre className="p-3 bg-muted text-xs overflow-x-auto">
                <code>{message.preview.content}</code>
              </pre>
            )}
          </div>
        )}

        {/* Status */}
        {message.status && <StatusBadge status={message.status} />}
      </div>
    </div>
  );
};

// Main Agent Chat Panel Component
export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  taskId,
  taskTitle = 'Task',
  messages,
  isExecuting = false,
  currentPhase,
  elapsedTime,
  onSendMessage,
  onPause,
  onResume,
  onStop,
  onRetry,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() && attachments.length === 0) return;
    onSendMessage?.(inputValue, attachments);
    setInputValue('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      onResume?.();
    } else {
      onPause?.();
    }
    setIsPaused(!isPaused);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{taskTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExecuting && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={handlePauseResume}
                    >
                      {isPaused ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={onStop}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        <div className="py-4 space-y-2">
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {/* Typing Indicator */}
          {isExecuting && !isPaused && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                <File className="h-3 w-3" />
                {file.name}
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* GitHub Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 shrink-0">
                  <Github className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Connect GitHub</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send message to Swiss..."
              className="min-h-[44px] max-h-[200px] pr-20 resize-none"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice input</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full"
                onClick={handleSend}
                disabled={!inputValue.trim() && attachments.length === 0}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Hints */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>↵ send · ⇧↵ new line</span>
        </div>
      </div>
    </div>
  );
};

export default AgentChatPanel;
