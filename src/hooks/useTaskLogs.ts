import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Direct project URL for edge functions
const DIRECT_PROJECT_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';

export interface TaskLog {
  id: string;
  task_id: string;
  run_id?: string;
  content: string;
  message?: string;
  log_type: string | null;
  sequence_number: number | null;
  timestamp: string | null;
  created_at?: string;
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
  const lastTimestampRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!taskId) return;

    // TEMPORARILY DISABLED - using agent-status for logs instead
    // The agent-logs function has cross-project auth issues
    console.log('[useTaskLogs] Skipping agent-logs call (disabled)');
    return;
  }, [taskId]);

  // Initial fetch and polling
  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      setIsLive(true);
      lastTimestampRef.current = null;
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

  // Subscribe to task status changes (note: this may not work cross-project)
  useEffect(() => {
    if (!taskId) return;

    // For cross-project, we just rely on polling
    // The subscription would need to be on the Direct project which isn't supported here

    return () => {};
  }, [taskId, fetchLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    lastTimestampRef.current = null;
  }, []);

  return { 
    logs, 
    isLive, 
    isLoading,
    clearLogs,
    refetch: fetchLogs 
  };
}
