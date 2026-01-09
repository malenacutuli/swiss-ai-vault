import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface TaskLog {
  id: string;
  task_id: string;
  content: string;
  log_type: string | null;
  sequence_number: number | null;
  timestamp: string | null;
  metadata?: Json | null;
}

interface UseTaskLogsOptions {
  pollInterval?: number;
}

export function useTaskLogs(taskId: string | null, options: UseTaskLogsOptions = {}) {
  const { pollInterval = 500 } = options;
  
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const lastSequenceRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!taskId) return;

    try {
      // Try edge function first for efficiency
      const { data, error } = await supabase.functions.invoke('agent-logs', {
        body: { 
          task_id: taskId, 
          after: lastSequenceRef.current 
        }
      });

      if (error) {
        // Fallback to direct query
        const { data: directData } = await supabase
          .from('agent_task_logs')
          .select('*')
          .eq('task_id', taskId)
          .gt('sequence_number', lastSequenceRef.current)
          .order('sequence_number', { ascending: true });

        if (directData && directData.length > 0) {
          setLogs(prev => [...prev, ...directData]);
          lastSequenceRef.current = directData[directData.length - 1].sequence_number || 0;
        }
        return;
      }

      if (data?.logs && data.logs.length > 0) {
        setLogs(prev => [...prev, ...data.logs]);
        lastSequenceRef.current = data.logs[data.logs.length - 1].sequence_number || 0;
      }
    } catch (err) {
      console.error('[useTaskLogs] Error fetching logs:', err);
    }
  }, [taskId]);

  // Initial fetch and polling
  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      setIsLive(true);
      lastSequenceRef.current = 0;
      return;
    }

    setIsLoading(true);
    fetchLogs().finally(() => setIsLoading(false));

    // Start polling
    intervalRef.current = setInterval(fetchLogs, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, pollInterval, fetchLogs]);

  // Subscribe to task status changes
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-logs-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus === 'completed' || newStatus === 'failed') {
            setIsLive(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            // Final fetch to get any remaining logs
            fetchLogs();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, fetchLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    lastSequenceRef.current = 0;
  }, []);

  return { 
    logs, 
    isLive, 
    isLoading,
    clearLogs,
    refetch: fetchLogs 
  };
}
