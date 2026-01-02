import { useState, useEffect, useCallback } from 'react';
import { DistillationRunner, type RunnerState } from '@/lib/memory/distillation-runner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useDistillationRunner() {
  const [state, setState] = useState<RunnerState>(DistillationRunner.getState());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    return DistillationRunner.subscribe((newState, event) => {
      setState(newState);
      
      if (event === 'start') {
        toast({ 
          title: '🔬 Analysis Started', 
          description: `Processing ${newState.jobs.length} items with ${DistillationRunner.getConfig().concurrency}x concurrency.` 
        });
      } else if (event === 'complete' && newState.succeeded > 0) {
        const elapsedMin = newState.startedAt 
          ? Math.round((Date.now() - newState.startedAt) / 60000) 
          : 0;
        toast({ 
          title: '✨ Analysis Complete!', 
          description: `Extracted insights from ${newState.succeeded} items in ${elapsedMin} minutes.` 
        });
      } else if (event === 'rate_limit_backoff') {
        toast({ 
          title: '⏰ Rate Limit', 
          description: 'Pausing 10 seconds, then continuing automatically.' 
        });
      }
    });
  }, [toast]);

  // Track elapsed time
  useEffect(() => {
    if (!state.isRunning || state.isPaused) return;
    
    const interval = setInterval(() => {
      if (state.startedAt) {
        setElapsedSeconds(Math.floor((Date.now() - state.startedAt) / 1000));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [state.isRunning, state.isPaused, state.startedAt]);

  const start = useCallback(async (
    memories: Array<{ id: string; title: string; content: string; source: string }>,
    options?: { resume?: boolean }
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast({ 
        title: 'Please Sign In', 
        description: 'Authentication required to analyze memories.',
        variant: 'destructive' 
      });
      return;
    }
    DistillationRunner.start(session.access_token, memories, options);
  }, [toast]);

  const progress = state.jobs.length > 0 
    ? Math.round((state.processed / state.jobs.length) * 100) 
    : 0;

  const remaining = state.jobs.filter(j => j.status === 'pending').length;
  const total = state.jobs.length;

  return {
    state,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    progress,
    remaining,
    total,
    processed: state.processed,
    succeeded: state.succeeded,
    failed: state.failed,
    rateLimited: state.rateLimited,
    estimatedMinutes: state.estimatedMinutes,
    itemsPerSecond: state.itemsPerSecond,
    elapsedSeconds,
    hasResumable: DistillationRunner.hasResumable(),
    resumableCount: DistillationRunner.getResumableCount(),
    config: DistillationRunner.getConfig(),
    start,
    pause: DistillationRunner.pause,
    resume: DistillationRunner.resume,
    stop: DistillationRunner.stop,
    clear: DistillationRunner.clear,
  };
}