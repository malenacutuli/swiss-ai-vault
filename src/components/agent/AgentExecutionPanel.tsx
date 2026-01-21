/**
 * AgentExecutionPanel - Real-time agent execution display
 * 
 * Shows:
 * - Current status and phase progress
 * - Tool calls with live output
 * - Agent messages
 * - Thinking/reasoning (ephemeral)
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Globe, 
  FileText, 
  Search, 
  Code, 
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
  Brain,
  Zap,
  FolderOpen
} from 'lucide-react';
import { useAgentStream, AgentToolCallEvent, AgentToolResultEvent, AgentMessageEvent } from '@/hooks/useAgentStream';
import { cn } from '@/lib/utils';

interface AgentExecutionPanelProps {
  runId: string | null;
  className?: string;
  onComplete?: (status: string) => void;
}

// Tool icon mapping
const toolIcons: Record<string, React.ElementType> = {
  shell: Terminal,
  code: Code,
  browser: Globe,
  search: Search,
  file_read: FileText,
  file_write: FileText,
  file_list: FolderOpen,
  message: MessageSquare,
  webdev_init_project: Zap,
  webdev_check_status: Zap,
  webdev_save_checkpoint: Zap,
  webdev_restart_server: Zap,
  webdev_add_feature: Zap,
};

// Status badge colors
const statusColors: Record<string, string> = {
  queued: 'bg-yellow-500/20 text-yellow-500',
  planning: 'bg-blue-500/20 text-blue-500',
  executing: 'bg-purple-500/20 text-purple-500',
  completed: 'bg-green-500/20 text-green-500',
  failed: 'bg-red-500/20 text-red-500',
  cancelled: 'bg-gray-500/20 text-gray-500',
  waiting_user: 'bg-orange-500/20 text-orange-500',
};

export function AgentExecutionPanel({ runId, className, onComplete }: AgentExecutionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    isConnected,
    isComplete,
    error,
    status,
    currentPhase,
    totalPhases,
    toolCalls,
    toolResults,
    messages,
    thinking,
  } = useAgentStream(runId, {
    onComplete,
  });
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [toolCalls, toolResults, messages, thinking]);
  
  // Get tool result for a tool call
  const getToolResult = (stepId: string): AgentToolResultEvent | undefined => {
    return toolResults.find(r => r.step_id === stepId);
  };
  
  if (!runId) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-muted-foreground', className)}>
        <p>No agent run selected</p>
      </div>
    );
  }
  
  return (
    <div className={cn('flex flex-col h-full bg-background border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          )} />
          
          {/* Status badge */}
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
            statusColors[status] || 'bg-gray-500/20 text-gray-500'
          )}>
            {status}
          </span>
          
          {/* Phase progress */}
          {totalPhases > 0 && (
            <span className="text-sm text-muted-foreground">
              Phase {currentPhase} of {totalPhases}
            </span>
          )}
        </div>
        
        {/* Error indicator */}
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>
      
      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Messages */}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <MessageBubble key={msg.message_id} message={msg} />
          ))}
        </AnimatePresence>
        
        {/* Tool calls */}
        <AnimatePresence mode="popLayout">
          {toolCalls.map((call) => (
            <ToolCallCard 
              key={call.step_id} 
              call={call} 
              result={getToolResult(call.step_id)}
            />
          ))}
        </AnimatePresence>
        
        {/* Thinking indicator */}
        <AnimatePresence>
          {thinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20"
            >
              <Brain className="w-5 h-5 text-purple-500 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm text-purple-500 font-medium">Thinking...</p>
                <p className="text-sm text-muted-foreground mt-1">{thinking}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Loading indicator */}
        {isConnected && !isComplete && !thinking && toolCalls.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {/* Completion message */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg',
              status === 'completed' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            )}
          >
            {status === 'completed' ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <div>
              <p className={cn(
                'font-medium',
                status === 'completed' ? 'text-green-500' : 'text-red-500'
              )}>
                {status === 'completed' ? 'Task Completed' : 'Task Failed'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 'completed' 
                  ? 'The agent has finished executing the task.'
                  : 'An error occurred during execution.'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Message bubble component
function MessageBubble({ message }: { message: AgentMessageEvent }) {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn(
        'max-w-[80%] px-4 py-2 rounded-lg',
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      )}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}

// Tool call card component
function ToolCallCard({ 
  call, 
  result 
}: { 
  call: AgentToolCallEvent; 
  result?: AgentToolResultEvent;
}) {
  const Icon = toolIcons[call.tool_name] || Code;
  const isRunning = call.status === 'running' && !result;
  const isSuccess = result?.success;
  const isFailed = result && !result.success;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'border rounded-lg overflow-hidden',
        isRunning && 'border-blue-500/50',
        isSuccess && 'border-green-500/50',
        isFailed && 'border-red-500/50'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-2',
        isRunning && 'bg-blue-500/10',
        isSuccess && 'bg-green-500/10',
        isFailed && 'bg-red-500/10',
        !result && !isRunning && 'bg-muted/50'
      )}>
        <Icon className={cn(
          'w-4 h-4',
          isRunning && 'text-blue-500 animate-pulse',
          isSuccess && 'text-green-500',
          isFailed && 'text-red-500'
        )} />
        <span className="font-mono text-sm font-medium">{call.tool_name}</span>
        
        {isRunning && (
          <Loader2 className="w-4 h-4 ml-auto animate-spin text-blue-500" />
        )}
        {isSuccess && (
          <CheckCircle className="w-4 h-4 ml-auto text-green-500" />
        )}
        {isFailed && (
          <XCircle className="w-4 h-4 ml-auto text-red-500" />
        )}
        
        {result?.duration_ms && (
          <span className="text-xs text-muted-foreground">
            {result.duration_ms}ms
          </span>
        )}
      </div>
      
      {/* Input */}
      {call.tool_input && Object.keys(call.tool_input).length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Input:</p>
          <pre className="text-xs font-mono overflow-x-auto">
            {JSON.stringify(call.tool_input, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Output */}
      {result?.output && (
        <div className="px-4 py-2 border-t">
          <p className="text-xs text-muted-foreground mb-1">Output:</p>
          <pre className="text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
            {typeof result.output === 'string' 
              ? result.output 
              : JSON.stringify(result.output, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Error */}
      {result?.error && (
        <div className="px-4 py-2 border-t bg-red-500/10">
          <p className="text-xs text-red-500 font-medium mb-1">Error:</p>
          <pre className="text-xs font-mono text-red-500 overflow-x-auto">
            {result.error}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

export default AgentExecutionPanel;
