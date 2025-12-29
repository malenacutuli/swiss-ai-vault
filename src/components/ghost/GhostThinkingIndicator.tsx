import React from 'react';
import { Loader2, Brain, Sparkles, Zap, Code, Lock, AlertTriangle, Clock } from '@/icons';
import { cn } from '@/lib/utils';
import type { StreamStatus } from '@/hooks/useGhostInference';

interface GhostThinkingIndicatorProps {
  status: StreamStatus;
  elapsedTime: number;
  model?: string;
  className?: string;
  onCancel?: () => void;
}

const STATUS_MESSAGES: Record<string, string[]> = {
  connecting: [
    'Connecting to Swiss servers...',
    'Establishing secure connection...',
  ],
  generating: [
    'Thinking...',
    'Analyzing your question...',
    'Generating response...',
    'Processing with zero logging...',
  ],
  stuck: [
    'Response taking longer than expected...',
    'Still waiting for response...',
  ],
  timeout: [
    'Request timed out...',
  ],
};

export function GhostThinkingIndicator({ 
  status, 
  elapsedTime, 
  model,
  className,
  onCancel,
}: GhostThinkingIndicatorProps) {
  const [messageIndex, setMessageIndex] = React.useState(0);
  
  // Rotate messages every 3 seconds
  React.useEffect(() => {
    if (status !== 'generating' && status !== 'connecting' && status !== 'stuck') return;
    
    const interval = setInterval(() => {
      setMessageIndex(prev => prev + 1);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [status]);
  
  // Don't show for terminal states
  if (!status || status === 'idle' || status === 'complete' || status === 'error') {
    return null;
  }
  
  const isWarningState = status === 'stuck' || status === 'timeout';
  const messages = STATUS_MESSAGES[status] || STATUS_MESSAGES.generating;
  const currentMessage = messages[messageIndex % messages.length];
  
  // Determine icon based on status and model
  const getStatusIcon = () => {
    if (status === 'stuck' || status === 'timeout') {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  };
  
  const getModelIcon = () => {
    if (model?.includes('code')) return <Code className="w-4 h-4 text-primary" />;
    if (model?.includes('fast')) return <Zap className="w-4 h-4 text-primary" />;
    if (model?.includes('swiss')) return <Lock className="w-4 h-4 text-primary" />;
    return <Brain className="w-4 h-4 text-primary" />;
  };
  
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      isWarningState && "bg-yellow-500/5 border border-yellow-500/20 rounded-lg",
      className
    )}>
      {/* Avatar with pulse animation */}
      <div className="relative">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isWarningState 
            ? "bg-yellow-500/20" 
            : "bg-gradient-to-br from-primary/20 to-primary/10"
        )}>
          {getStatusIcon()}
        </div>
        {!isWarningState && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary animate-pulse" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Status message with timer */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-sm",
            isWarningState ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground animate-pulse"
          )}>
            {currentMessage}
          </span>
          <span className={cn(
            "text-xs font-mono tabular-nums",
            isWarningState ? "text-yellow-600/70 dark:text-yellow-400/70" : "text-muted-foreground/70"
          )}>
            <Clock className="w-3 h-3 inline mr-1" />
            {elapsedTime.toFixed(1)}s
          </span>
        </div>
        
        {/* Progress dots or warning message */}
        {!isWarningState ? (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse"
                style={{
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onCancel && (
              <button 
                onClick={onCancel}
                className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline"
              >
                Cancel and retry
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Swiss privacy badge */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
        <span>🇨🇭</span>
        <span>Zero Retention</span>
      </div>
    </div>
  );
}
