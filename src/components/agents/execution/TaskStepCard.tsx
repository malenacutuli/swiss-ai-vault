import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { FileActionChip, parseToolToFileActions } from './FileActionChip';
import type { ExecutionStep } from '@/hooks/useAgentExecution';

interface TaskStepCardProps {
  step: ExecutionStep;
  stepNumber: number;
  isExpanded?: boolean;
}

export function TaskStepCard({ step, stepNumber, isExpanded = false }: TaskStepCardProps) {
  const [open, setOpen] = useState(isExpanded);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const isRunning = step.status === 'executing';
  const isCompleted = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isPending = step.status === 'pending' || !step.status;
  
  // Auto-expand running steps
  useEffect(() => {
    if (isRunning) setOpen(true);
  }, [isRunning]);
  
  // Track elapsed time for running steps
  useEffect(() => {
    if (!isRunning || !step.started_at) return;
    
    const startTime = new Date(step.started_at).getTime();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRunning, step.started_at]);
  
  // Format elapsed time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };
  
  // Parse file actions from step data
  const fileActions = parseToolToFileActions(step.tool_name, step.description);
  
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: stepNumber * 0.05 }}
        className={cn(
          'border rounded-xl overflow-hidden transition-all duration-200',
          isRunning && 'border-primary/30 bg-primary/[0.02] shadow-sm',
          isCompleted && 'border-border bg-card',
          isFailed && 'border-destructive/30 bg-destructive/[0.02]',
          isPending && 'border-border/50 bg-muted/30'
        )}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-4">
            {/* Swiss Minimalist Step Indicator - NO LUCIDE ICONS */}
            <div className="relative flex-shrink-0">
              {isCompleted && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">✓</span>
                </div>
              )}
              
              {isRunning && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <span className="text-primary text-sm font-semibold">{stepNumber}</span>
                  {/* Pulsing ring animation - CSS only */}
                  <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
                </div>
              )}
              
              {isFailed && (
                <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
                  <span className="text-destructive-foreground text-sm font-medium">✕</span>
                </div>
              )}
              
              {isPending && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">{stepNumber}</span>
                </div>
              )}
            </div>
            
            {/* Step Info */}
            <div className="flex-1 min-w-0 text-left">
              <p className={cn(
                'text-sm font-medium truncate',
                isCompleted && 'text-foreground',
                isRunning && 'text-primary',
                isFailed && 'text-destructive',
                isPending && 'text-muted-foreground'
              )}>
                {step.description || step.tool_name || `Step ${stepNumber}`}
              </p>
              
              {/* Running status with real-time elapsed */}
              {isRunning && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {formatTime(elapsedTime)}
                  </span>
                  <span className="inline-block w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Processing...
                  </span>
                </div>
              )}
              
              {/* Completed duration */}
              {isCompleted && step.duration_ms && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Completed in {(step.duration_ms / 1000).toFixed(1)}s
                </p>
              )}
              
              {/* Failed message preview */}
              {isFailed && step.error_message && (
                <p className="text-xs text-destructive mt-0.5 truncate">
                  {step.error_message}
                </p>
              )}
            </div>
            
            {/* Expand indicator - simple arrow, no icon */}
            <span className={cn(
              'text-muted-foreground transition-transform duration-200 text-xs',
              open && 'rotate-180'
            )}>
              ▼
            </span>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border/50"
              >
                <div className="p-4 pt-3 space-y-3">
                  {/* Tool name if different from description */}
                  {step.tool_name && step.description && step.tool_name !== step.description && (
                    <p className="text-xs text-muted-foreground">
                      Using <span className="font-medium text-foreground">{step.tool_name}</span>
                    </p>
                  )}
                  
                  {/* FILE ACTION CHIPS - Manus style */}
                  {fileActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {fileActions.map((action, i) => (
                        <FileActionChip key={i} action={action} />
                      ))}
                    </div>
                  )}
                  
                  {/* Error details */}
                  {isFailed && step.error_message && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <p className="text-xs text-destructive font-medium mb-1">Error</p>
                      <p className="text-sm text-destructive/90">{step.error_message}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}
