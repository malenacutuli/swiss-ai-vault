import { useState, useEffect, useCallback } from 'react';
import { DistillationRunner, type RunnerState } from '@/lib/memory/distillation-runner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useDistillationRunner() {
  const [state, setState] = useState<RunnerState>(DistillationRunner.getState());
  const { toast } = useToast();

  useEffect(() => {
    return DistillationRunner.subscribe((newState, event) => {
      setState(newState);
      
      if (event === 'start') {
        toast({ 
          title: '🔬 Analysis Started', 
          description: 'You can navigate away - processing continues in background.' 
        });
      } else if (event === 'complete' && newState.succeeded > 0) {
        toast({ 
          title: '✨ Analysis Complete!', 
          description: `Extracted insights from ${newState.succeeded} items.` 
        });
      } else if (event === 'rate_limit_backoff') {
        toast({ 
          title: '⏰ Rate Limit', 
          description: 'Pausing 1 minute, then continuing automatically.' 
        });
      }
    });
  }, [toast]);

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
    hasResumable: DistillationRunner.hasResumable(),
    resumableCount: DistillationRunner.getResumableCount(),
    start,
    pause: DistillationRunner.pause,
    resume: DistillationRunner.resume,
    stop: DistillationRunner.stop,
    clear: DistillationRunner.clear,
  };
}
