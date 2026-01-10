import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ExecutionPhase } from '@/components/agents/execution/AgentExecutionPanel';

interface ExecutionState {
  phase: ExecutionPhase;
  currentStep: number;
  totalSteps: number;
  streamingText: string;
  thoughts: ThoughtEntry[];
  currentTool: ToolCall | null;
  isConnected: boolean;
}

interface ThoughtEntry {
  id: string;
  type: 'reasoning' | 'tool_selection' | 'result' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'success' | 'error';
}

interface UseAgentExecutionPanelOptions {
  taskId: string | null;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useAgentExecutionPanel({
  taskId,
  onPhaseChange,
  onComplete,
  onError,
}: UseAgentExecutionPanelOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<ExecutionState>({
    phase: 'idle',
    currentStep: 0,
    totalSteps: 0,
    streamingText: '',
    thoughts: [],
    currentTool: null,
    isConnected: false,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when taskId changes
  useEffect(() => {
    if (!taskId) {
      setState({
        phase: 'idle',
        currentStep: 0,
        totalSteps: 0,
        streamingText: '',
        thoughts: [],
        currentTool: null,
        isConnected: false,
      });
    }
  }, [taskId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`execution-panel-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          handleLogEntry(payload.new as LogEntry);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const task = payload.new as TaskUpdate;
          
          setState(prev => ({
            ...prev,
            currentStep: task.current_step ?? prev.currentStep,
            totalSteps: task.total_steps ?? prev.totalSteps,
          }));

          if (task.status === 'completed') {
            setState(prev => ({ ...prev, phase: 'completed' }));
            onComplete?.();
          } else if (task.status === 'failed') {
            setState(prev => ({ ...prev, phase: 'failed' }));
            onError?.(task.error_message || 'Task failed');
          }
        }
      )
      .subscribe((status) => {
        setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, onComplete, onError]);

  // Handle log entries
  const handleLogEntry = useCallback((log: LogEntry) => {
    setState(prev => {
      const newState = { ...prev };

      switch (log.log_type) {
        case 'phase_change':
          newState.phase = log.content as ExecutionPhase;
          onPhaseChange?.(newState.phase);
          break;

        case 'thinking':
          newState.phase = 'thinking';
          newState.streamingText = prev.streamingText + log.content;
          break;

        case 'reasoning':
          newState.thoughts = [...prev.thoughts, {
            id: log.id,
            type: 'reasoning',
            content: log.content,
            timestamp: new Date(log.timestamp),
            metadata: log.metadata,
          }];
          break;

        case 'tool_select':
          newState.phase = 'selecting';
          newState.currentTool = {
            name: log.metadata?.tool_name as string || 'unknown',
            params: log.metadata?.params as Record<string, unknown> || {},
            status: 'pending',
          };
          newState.thoughts = [...prev.thoughts, {
            id: log.id,
            type: 'tool_selection',
            content: `Selected tool: ${log.metadata?.tool_name}`,
            timestamp: new Date(log.timestamp),
            metadata: log.metadata,
          }];
          break;

        case 'tool_start':
          newState.phase = 'executing';
          if (prev.currentTool) {
            newState.currentTool = { ...prev.currentTool, status: 'running' };
          }
          break;

        case 'tool_complete':
          newState.phase = 'observing';
          if (prev.currentTool) {
            newState.currentTool = { 
              ...prev.currentTool, 
              status: 'success',
              result: log.content,
            };
          }
          newState.thoughts = [...prev.thoughts, {
            id: log.id,
            type: 'result',
            content: log.content,
            timestamp: new Date(log.timestamp),
            metadata: log.metadata,
          }];
          break;

        case 'tool_error':
          if (prev.currentTool) {
            newState.currentTool = { 
              ...prev.currentTool, 
              status: 'error',
              result: log.content,
            };
          }
          newState.thoughts = [...prev.thoughts, {
            id: log.id,
            type: 'error',
            content: log.content,
            timestamp: new Date(log.timestamp),
            metadata: log.metadata,
          }];
          break;

        case 'step_complete':
          newState.currentStep = prev.currentStep + 1;
          newState.streamingText = '';
          break;
      }

      return newState;
    });
  }, [onPhaseChange]);

  // Stop execution
  const stop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (taskId) {
      await supabase
        .from('agent_tasks')
        .update({ status: 'stopped' })
        .eq('id', taskId);
    }

    setState(prev => ({ ...prev, phase: 'stopped' }));
  }, [taskId]);

  // Clear thoughts
  const clearThoughts = useCallback(() => {
    setState(prev => ({ ...prev, thoughts: [], streamingText: '' }));
  }, []);

  return {
    ...state,
    stop,
    clearThoughts,
    isActive: !['idle', 'completed', 'failed', 'stopped'].includes(state.phase),
  };
}

// Type definitions for payload
interface LogEntry {
  id: string;
  log_type: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface TaskUpdate {
  status: string;
  current_step?: number;
  total_steps?: number;
  error_message?: string;
}

export default useAgentExecutionPanel;
