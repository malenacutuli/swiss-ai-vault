import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TerminalLog {
  id: string;
  content: string;
  log_type: string;
  timestamp: string;
  sequence_number: number;
}

interface UseTerminalStreamOptions {
  taskId: string;
  onLog?: (log: TerminalLog) => void;
  enabled?: boolean;
}

interface UseTerminalStreamReturn {
  logs: TerminalLog[];
  isConnected: boolean;
  error: Error | null;
  clearLogs: () => void;
}

export function useTerminalStream({
  taskId,
  onLog,
  enabled = true,
}: UseTerminalStreamOptions): UseTerminalStreamReturn {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch existing logs on mount
  useEffect(() => {
    if (!enabled) return;

    const fetchExistingLogs = async () => {
      const { data, error: fetchError } = await supabase
        .from('agent_task_logs')
        .select('id, content, log_type, timestamp, sequence_number')
        .eq('task_id', taskId)
        .order('sequence_number', { ascending: true });

      if (fetchError) {
        console.error('Failed to fetch existing logs:', fetchError);
        setError(new Error(fetchError.message));
        return;
      }

      if (data) {
        const formattedLogs = data.map(log => ({
          id: log.id,
          content: log.content,
          log_type: log.log_type ?? 'info',
          timestamp: log.timestamp ?? new Date().toISOString(),
          sequence_number: log.sequence_number ?? 0,
        }));
        setLogs(formattedLogs);
      }
    };

    fetchExistingLogs();
  }, [taskId, enabled]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`terminal-stream-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const newLog = payload.new as {
            id: string;
            content: string;
            log_type: string | null;
            timestamp: string | null;
            sequence_number: number | null;
          };

          const formattedLog: TerminalLog = {
            id: newLog.id,
            content: newLog.content,
            log_type: newLog.log_type ?? 'info',
            timestamp: newLog.timestamp ?? new Date().toISOString(),
            sequence_number: newLog.sequence_number ?? 0,
          };

          setLogs(prev => [...prev, formattedLog]);
          onLog?.(formattedLog);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError(new Error('Failed to connect to terminal stream'));
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [taskId, enabled, onLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    isConnected,
    error,
    clearLogs,
  };
}

// Helper to format logs for terminal display
export function formatTerminalLog(log: TerminalLog): string {
  const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const prefix = `\x1b[38;2;113;113;122m[${timestamp}]\x1b[0m `;

  switch (log.log_type) {
    case 'error':
      return prefix + `\x1b[38;2;114;47;55m✕ ${log.content}\x1b[0m`;
    case 'success':
      return prefix + `\x1b[38;2;29;78;95m✓ ${log.content}\x1b[0m`;
    case 'command':
      return prefix + `\x1b[38;2;29;78;95m$ ${log.content}\x1b[0m`;
    case 'warning':
      return prefix + `\x1b[38;2;184;134;11m⚠ ${log.content}\x1b[0m`;
    case 'info':
      return prefix + `\x1b[38;2;113;113;122mℹ ${log.content}\x1b[0m`;
    case 'stdout':
      return prefix + log.content;
    case 'stderr':
      return prefix + `\x1b[38;2;114;47;55m${log.content}\x1b[0m`;
    default:
      return prefix + log.content;
  }
}
