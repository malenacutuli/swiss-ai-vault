import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AgentExecutor, 
  createAgentExecutor,
  type ExecutionPlan,
  type ExecutorConfig,
} from '@/lib/agents/AgentExecutor';

export interface AgentExecutorState {
  status: 'idle' | 'planning' | 'executing' | 'completed' | 'failed' | 'aborted';
  plan: ExecutionPlan | null;
  currentStep: number;
  progress: number;
  logs: AgentLog[];
  error: string | null;
  taskId: string | null;
}

export interface AgentLog {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
  step?: number;
}

export interface UseAgentExecutorOptions {
  userId: string;
  config?: Partial<ExecutorConfig>;
  onPlanCreated?: (plan: ExecutionPlan) => void;
  onStepComplete?: (step: number, output: string) => void;
  onComplete?: (success: boolean, result: unknown) => void;
  onError?: (error: string) => void;
}

export function useAgentExecutor(options: UseAgentExecutorOptions) {
  const { userId, config, onPlanCreated, onStepComplete, onComplete, onError } = options;

  const [state, setState] = useState<AgentExecutorState>({
    status: 'idle',
    plan: null,
    currentStep: 0,
    progress: 0,
    logs: [],
    error: null,
    taskId: null,
  });

  const executorRef = useRef<AgentExecutor | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to real-time logs
  const subscribeToLogs = useCallback((taskId: string) => {
    // Unsubscribe from previous channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`task-logs-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const log = payload.new as {
            id: string;
            log_type: string;
            content: string;
            timestamp: string;
            metadata?: { step?: number };
          };

          setState(prev => ({
            ...prev,
            logs: [...prev.logs, {
              id: log.id,
              type: log.log_type,
              content: log.content,
              timestamp: new Date(log.timestamp),
              step: log.metadata?.step,
            }],
          }));
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  // Subscribe to task updates
  const subscribeToTask = useCallback((taskId: string) => {
    const channel = supabase
      .channel(`task-updates-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const task = payload.new as {
            status: string;
            progress: number;
            current_step: number;
            error_message?: string;
          };

          setState(prev => ({
            ...prev,
            status: task.status as AgentExecutorState['status'],
            progress: task.progress,
            currentStep: task.current_step,
            error: task.error_message || null,
          }));

          if (task.status === 'completed') {
            onComplete?.(true, task);
          } else if (task.status === 'failed') {
            onError?.(task.error_message || 'Execution failed');
            onComplete?.(false, task);
          }
        }
      )
      .subscribe();

    return channel;
  }, [onComplete, onError]);

  // Create and execute a task
  const execute = useCallback(async (prompt: string): Promise<string | null> => {
    setState(prev => ({
      ...prev,
      status: 'planning',
      logs: [],
      error: null,
      plan: null,
      currentStep: 0,
      progress: 0,
    }));

    try {
      // Create task via edge function
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt,
          mode: 'agentic',
          params: { executor: 'manus' },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const taskId = data?.task?.id || data?.taskId;
      if (!taskId) {
        throw new Error('No task ID returned');
      }

      setState(prev => ({
        ...prev,
        taskId,
        status: 'executing',
      }));

      // Subscribe to real-time updates
      subscribeToLogs(taskId);
      subscribeToTask(taskId);

      // Create local executor for client-side operations
      executorRef.current = createAgentExecutor(taskId, userId, config);

      return taskId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start execution';
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMsg,
      }));
      onError?.(errorMsg);
      return null;
    }
  }, [userId, config, subscribeToLogs, subscribeToTask, onError]);

  // Execute locally (for testing/development)
  const executeLocal = useCallback(async (prompt: string): Promise<string | null> => {
    setState(prev => ({
      ...prev,
      status: 'planning',
      logs: [],
      error: null,
      plan: null,
      currentStep: 0,
      progress: 0,
    }));

    try {
      // Create task record
      const { data: task, error: taskError } = await supabase
        .from('agent_tasks')
        .insert({
          user_id: userId,
          prompt,
          status: 'executing',
          progress: 0,
          task_type: 'agentic',
        })
        .select()
        .single();

      if (taskError || !task) {
        throw new Error(taskError?.message || 'Failed to create task');
      }

      setState(prev => ({
        ...prev,
        taskId: task.id,
        status: 'executing',
      }));

      // Subscribe to logs
      subscribeToLogs(task.id);

      // Create and run executor
      const executor = createAgentExecutor(task.id, userId, config);
      executorRef.current = executor;

      // Execute in background
      executor.execute(prompt).then(result => {
        const plan = executor.getPlan();
        if (plan) {
          onPlanCreated?.(plan);
          setState(prev => ({ ...prev, plan }));
        }

        setState(prev => ({
          ...prev,
          status: result.success ? 'completed' : 'failed',
          error: result.error || null,
        }));

        onComplete?.(result.success, result.result);
      });

      return task.id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start execution';
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMsg,
      }));
      onError?.(errorMsg);
      return null;
    }
  }, [userId, config, subscribeToLogs, onPlanCreated, onComplete, onError]);

  // Abort execution
  const abort = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.abort();
    }
    
    setState(prev => ({
      ...prev,
      status: 'aborted',
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    executorRef.current = null;
    
    setState({
      status: 'idle',
      plan: null,
      currentStep: 0,
      progress: 0,
      logs: [],
      error: null,
      taskId: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    // State
    ...state,
    isExecuting: state.status === 'planning' || state.status === 'executing',
    
    // Actions
    execute,
    executeLocal,
    abort,
    reset,
    
    // Utilities
    getExecutor: () => executorRef.current,
  };
}
