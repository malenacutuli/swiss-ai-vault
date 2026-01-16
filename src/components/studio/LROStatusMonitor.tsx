import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface LROStatus {
  done: boolean;
  metadata?: {
    progress?: number;
    stage?: string;
    estimatedTimeRemaining?: number;
  };
  result?: any;
  error?: { message: string; code?: string };
}

interface LROStatusMonitorProps {
  operationName: string;
  pollInterval?: number;
  maxAttempts?: number;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number, stage: string) => void;
  className?: string;
}

export function LROStatusMonitor({
  operationName,
  pollInterval = 5000,
  maxAttempts = 60,
  onComplete,
  onError,
  onProgress,
  className,
}: LROStatusMonitorProps) {
  const [status, setStatus] = useState<LROStatus | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isPolling, setIsPolling] = useState(true);

  const pollOperation = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('notebooklm-proxy', {
        body: {
          action: 'poll_operation',
          operation_name: operationName,
        },
      });

      if (error) throw new Error(error.message);

      const lroStatus: LROStatus = data?.data || data;
      setStatus(lroStatus);
      setAttempt(prev => prev + 1);

      if (lroStatus.metadata) {
        onProgress?.(
          lroStatus.metadata.progress || (attempt / maxAttempts) * 100,
          lroStatus.metadata.stage || 'Processing...'
        );
      }

      if (lroStatus.done) {
        setIsPolling(false);
        if (lroStatus.error) {
          onError?.(lroStatus.error.message);
        } else {
          onComplete?.(lroStatus.result);
        }
        return true;
      } else if (attempt >= maxAttempts) {
        setIsPolling(false);
        onError?.('Operation timed out');
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error('[LROStatusMonitor] Poll error:', err);
      // Don't stop polling on transient errors
      return false;
    }
  }, [operationName, attempt, maxAttempts, onComplete, onError, onProgress]);

  useEffect(() => {
    if (!isPolling || !operationName) return;

    // Initial poll
    pollOperation();

    const interval = setInterval(async () => {
      const shouldStop = await pollOperation();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [operationName, isPolling, pollInterval, pollOperation]);

  const retry = () => {
    setAttempt(0);
    setStatus(null);
    setIsPolling(true);
  };

  const progress = status?.metadata?.progress || (attempt / maxAttempts) * 100;
  const stage = status?.metadata?.stage || 'Processing...';

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {/* Status Header */}
      <div className="flex items-center gap-2 mb-3">
        {isPolling && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {status?.done && !status?.error && (
          <Check className="w-4 h-4 text-green-500" />
        )}
        {status?.error && (
          <AlertCircle className="w-4 h-4 text-destructive" />
        )}
        
        <span className="text-sm font-medium text-foreground">{stage}</span>
      </div>

      {/* Progress Bar */}
      {isPolling && (
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}% complete</span>
            {status?.metadata?.estimatedTimeRemaining && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ~{Math.ceil(status.metadata.estimatedTimeRemaining / 60)} min remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error with Retry */}
      {status?.error && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-destructive">{status.error.message}</p>
          <button
            onClick={retry}
            className="flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
