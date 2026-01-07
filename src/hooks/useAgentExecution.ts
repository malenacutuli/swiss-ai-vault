import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Task types that route to Modal for specialized GPU-accelerated processing
export const MODAL_ROUTED_TYPES = [
  'slides',
  'presentation',
  'document',
  'spreadsheet',
  'research',
  'podcast',
  'flashcards',
  'quiz',
  'mindmap',
  'audio',
  'video',
];

export type ExecutionStatus = 
  | 'idle' 
  | 'planning' 
  | 'awaiting_approval' 
  | 'executing' 
  | 'paused'
  | 'completed' 
  | 'failed';

export interface ExecutionStep {
  id: string;
  step_number: number;
  step_type: string;
  tool_name: string | null;
  description: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface TaskOutput {
  id: string;
  file_name: string;
  output_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  download_url: string | null;
  preview_url: string | null;
  created_at: string | null;
  requested_format?: string | null;
  actual_format?: string | null;
  conversion_status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionTask {
  id: string;
  prompt: string;
  status: string;
  task_type: string | null;
  mode: string | null;
  privacy_tier: string | null;
  current_step: number | null;
  total_steps: number | null;
  progress_percentage: number | null;
  plan_summary: string | null;
  plan_json: any | null;
  result_summary: string | null;
  error_message: string | null;
  credits_used: number | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  log_type: string | null;
  content: string;
  sequence_number: number | null;
  timestamp: string | null;
}

interface UseAgentExecutionOptions {
  onComplete?: (task: ExecutionTask) => void;
  onError?: (error: string) => void;
}

export function useAgentExecution(options: UseAgentExecutionOptions = {}) {
  const { user } = useAuth();
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [currentOutput, setCurrentOutput] = useState<TaskOutput | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const channelsRef = useRef<{ task: ReturnType<typeof supabase.channel> | null; logs: ReturnType<typeof supabase.channel> | null; steps: ReturnType<typeof supabase.channel> | null; outputs: ReturnType<typeof supabase.channel> | null }>({
    task: null,
    logs: null,
    steps: null,
    outputs: null,
  });

  // Map task status to execution status
  const mapTaskStatus = useCallback((taskStatus: string): ExecutionStatus => {
    if (taskStatus === 'queued' || taskStatus === 'planning') return 'planning';
    if (taskStatus === 'awaiting_approval') return 'awaiting_approval';
    if (taskStatus === 'executing') return 'executing';
    if (taskStatus === 'paused') return 'paused';
    if (taskStatus === 'completed') return 'completed';
    if (taskStatus === 'failed') return 'failed';
    return 'idle';
  }, []);

  // Clean up realtime subscriptions
  const cleanupChannels = useCallback(() => {
    if (channelsRef.current.task) {
      supabase.removeChannel(channelsRef.current.task);
      channelsRef.current.task = null;
    }
    if (channelsRef.current.logs) {
      supabase.removeChannel(channelsRef.current.logs);
      channelsRef.current.logs = null;
    }
    if (channelsRef.current.steps) {
      supabase.removeChannel(channelsRef.current.steps);
      channelsRef.current.steps = null;
    }
    if (channelsRef.current.outputs) {
      supabase.removeChannel(channelsRef.current.outputs);
      channelsRef.current.outputs = null;
    }
  }, []);

  // Subscribe to realtime updates for task
  const subscribeToTask = useCallback((taskId: string) => {
    cleanupChannels();
    console.log('[AgentExecution] Setting up realtime subscriptions for task:', taskId);

    // Subscribe to task updates
    channelsRef.current.task = supabase
      .channel(`task-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          console.log('[AgentExecution] Task update received:', payload.new);
          const newTask = payload.new as ExecutionTask;
          setTask(newTask);
          
          const newStatus = mapTaskStatus(newTask.status);
          setStatus(newStatus);

          if (newTask.status === 'completed') {
            options.onComplete?.(newTask);
          } else if (newTask.status === 'failed') {
            setError(newTask.error_message || 'Task failed');
            options.onError?.(newTask.error_message || 'Task failed');
          }
        }
      )
      .subscribe();

    // Subscribe to new logs
    channelsRef.current.logs = supabase
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
          console.log('[AgentExecution] New log received:', payload.new);
          setLogs((prev) => [...prev, payload.new as TaskLog]);
        }
      )
      .subscribe();

    // Subscribe to step updates
    channelsRef.current.steps = supabase
      .channel(`task-steps-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_task_steps',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          console.log('[AgentExecution] Step update received:', payload);
          if (payload.eventType === 'INSERT') {
            setSteps((prev) => [...prev, payload.new as ExecutionStep]);
          } else if (payload.eventType === 'UPDATE') {
            setSteps((prev) =>
              prev.map((step) =>
                step.id === (payload.new as ExecutionStep).id
                  ? (payload.new as ExecutionStep)
                  : step
              )
            );
          }
        }
      )
      .subscribe();

    // Subscribe to new outputs
    channelsRef.current.outputs = supabase
      .channel(`task-outputs-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_outputs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          console.log('[AgentExecution] New output received:', payload.new);
          const newOutput = payload.new as TaskOutput;
          setOutputs((prev) => [...prev, newOutput]);
          setCurrentOutput(newOutput);
        }
      )
      .subscribe();
  }, [cleanupChannels, mapTaskStatus, options]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupChannels();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [cleanupChannels]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchTaskStatus = useCallback(async (taskId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('agent-status', {
        body: { taskId },
      });

      if (response.error) {
        console.error('[AgentExecution] Status error:', response.error);
        throw new Error(response.error.message || 'Failed to fetch status');
      }

      const data = response.data;
      
      if (!data?.success) {
        console.error('[AgentExecution] Status check failed:', data?.error);
        return null;
      }
      
      // Update task
      if (data.task) {
        setTask(data.task);
        
        // Map task status to execution status
        const taskStatus = data.task.status;
        if (taskStatus === 'queued' || taskStatus === 'planning') {
          setStatus('planning');
        } else if (taskStatus === 'awaiting_approval') {
          setStatus('awaiting_approval');
          stopPolling(); // Stop polling while awaiting approval
        } else if (taskStatus === 'executing') {
          setStatus('executing');
        } else if (taskStatus === 'paused') {
          setStatus('paused');
          stopPolling();
        } else if (taskStatus === 'completed') {
          setStatus('completed');
          stopPolling();
          options.onComplete?.(data.task);
        } else if (taskStatus === 'failed') {
          setStatus('failed');
          setError(data.task.error_message || 'Task failed');
          stopPolling();
          options.onError?.(data.task.error_message || 'Task failed');
        }
      }

      // Update steps
      if (data.steps) {
        setSteps(data.steps);
      }

      // Update outputs
      if (data.outputs) {
        setOutputs(data.outputs);
        if (data.outputs.length > 0) {
          setCurrentOutput(data.outputs[data.outputs.length - 1]);
        }
      }

      // Update suggestions
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }

      return data;
    } catch (err) {
      console.error('[AgentExecution] Fetch status error:', err);
      return null;
    }
  }, [options, stopPolling]);

  // Start realtime subscriptions (replaces polling for instant updates)
  const startRealtimeSubscription = useCallback((taskId: string) => {
    stopPolling(); // Stop any legacy polling
    taskIdRef.current = taskId;
    
    // Initial fetch to get current state
    fetchTaskStatus(taskId);
    
    // Set up realtime subscriptions for instant updates
    subscribeToTask(taskId);
  }, [fetchTaskStatus, stopPolling, subscribeToTask]);

  // Legacy polling fallback (kept for backward compatibility)
  const startPolling = useCallback((taskId: string) => {
    // Use realtime by default
    startRealtimeSubscription(taskId);
  }, [startRealtimeSubscription]);

  const createTask = useCallback(async (
    prompt: string,
    taskOptions: {
      taskType?: string;
      mode?: string;
      privacyTier?: string;
      tools?: string[];
      memoryContext?: string;
      attachments?: Array<{ name: string; url: string; type: string }>;
      connectedTools?: string[];
      templateId?: string;
    } = {}
  ) => {
    if (!user) {
      toast.error('Please sign in to create tasks');
      return null;
    }

    setStatus('planning');
    setError(null);
    setSteps([]);
    setOutputs([]);
    setCurrentOutput(null);
    setSuggestions([]);

    try {
      console.log('[useAgentExecution] Creating task:', {
        prompt: prompt.substring(0, 50),
        options: taskOptions,
      });

      // Determine if this should route to Modal for specialized processing
      const taskType = taskOptions.taskType || 'general';
      const shouldRouteToModal = MODAL_ROUTED_TYPES.includes(taskType);

      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt,
          taskType,
          privacyTier: taskOptions.privacyTier || 'vault',
          memoryContext: taskOptions.memoryContext,
          attachments: taskOptions.attachments,
          connectedTools: taskOptions.connectedTools || taskOptions.tools || [],
          templateId: taskOptions.templateId,
          route_to_modal: shouldRouteToModal,
        },
      });

      if (response.error) {
        // Handle specific error types
        const errorMsg = response.error.message || 'Failed to create task';
        if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (errorMsg.includes('402') || errorMsg.includes('Credits required')) {
          throw new Error('Please add credits to continue using this feature.');
        }
        throw new Error(errorMsg);
      }

      const data = response.data;
      
      // Handle both response formats: task object or taskId
      if (data.task) {
        setTask(data.task);
        taskIdRef.current = data.task.id;
        startPolling(data.task.id);
        return data.task;
      } else if (data.taskId) {
        // Backward compatibility: if only taskId is returned, fetch task
        taskIdRef.current = data.taskId;
        startPolling(data.taskId);
        // Create minimal task object from available data
        const minimalTask: ExecutionTask = {
          id: data.taskId,
          prompt: prompt,
          status: data.status || 'executing',
          task_type: taskOptions.taskType || 'general',
          mode: taskOptions.mode || null,
          privacy_tier: taskOptions.privacyTier || 'vault',
          current_step: 0,
          total_steps: data.plan?.steps?.length || 0,
          progress_percentage: 0,
          plan_summary: data.plan?.plan_summary || null,
          plan_json: data.plan || null,
          result_summary: null,
          error_message: null,
          credits_used: null,
          tokens_used: null,
          duration_ms: null,
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          completed_at: null,
        };
        setTask(minimalTask);
        return minimalTask;
      }

      throw new Error('Invalid response from server');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setStatus('failed');
      setError(message);
      toast.error(message);
      return null;
    }
  }, [user, startPolling]);

  const approveAndStart = useCallback(async () => {
    if (!taskIdRef.current) {
      toast.error('No task to approve');
      return false;
    }

    try {
      // Update task status to executing
      const { error: updateError } = await supabase
        .from('agent_tasks')
        .update({ status: 'executing', started_at: new Date().toISOString() })
        .eq('id', taskIdRef.current);

      if (updateError) throw updateError;

      setStatus('executing');
      
      // Start the worker
      const response = await supabase.functions.invoke('agent-worker', {
        body: { task_id: taskIdRef.current },
      });

      if (response.error) {
        console.error('[AgentExecution] Worker error:', response.error);
      }

      // Resume polling
      startPolling(taskIdRef.current);
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start task';
      toast.error(message);
      return false;
    }
  }, [startPolling]);

  const pauseTask = useCallback(async () => {
    if (!taskIdRef.current) return false;

    try {
      const { error: updateError } = await supabase
        .from('agent_tasks')
        .update({ status: 'paused' })
        .eq('id', taskIdRef.current);

      if (updateError) throw updateError;

      setStatus('paused');
      stopPolling();
      toast.info('Task paused');
      return true;
    } catch (err) {
      toast.error('Failed to pause task');
      return false;
    }
  }, [stopPolling]);

  const resumeTask = useCallback(async () => {
    if (!taskIdRef.current) return false;

    try {
      const { error: updateError } = await supabase
        .from('agent_tasks')
        .update({ status: 'executing' })
        .eq('id', taskIdRef.current);

      if (updateError) throw updateError;

      setStatus('executing');
      
      // Continue execution
      await supabase.functions.invoke('agent-worker', {
        body: { task_id: taskIdRef.current },
      });

      startPolling(taskIdRef.current);
      toast.info('Task resumed');
      return true;
    } catch (err) {
      toast.error('Failed to resume task');
      return false;
    }
  }, [startPolling]);

  const stopTask = useCallback(async () => {
    if (!taskIdRef.current) return false;

    try {
      const { error: updateError } = await supabase
        .from('agent_tasks')
        .update({ 
          status: 'failed', 
          error_message: 'Stopped by user',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskIdRef.current);

      if (updateError) throw updateError;

      setStatus('failed');
      setError('Stopped by user');
      stopPolling();
      toast.info('Task stopped');
      return true;
    } catch (err) {
      toast.error('Failed to stop task');
      return false;
    }
  }, [stopPolling]);

  const retryTask = useCallback(async () => {
    if (!task) return false;

    // Create a new task with the same prompt
    const newTask = await createTask(task.prompt, {
      taskType: task.task_type || undefined,
      mode: task.mode || undefined,
      privacyTier: task.privacy_tier || undefined,
    });

    return !!newTask;
  }, [task, createTask]);

  const reset = useCallback(() => {
    stopPolling();
    cleanupChannels(); // Clean up realtime subscriptions
    setTask(null);
    setSteps([]);
    setOutputs([]);
    setLogs([]);
    setCurrentOutput(null);
    setSuggestions([]);
    setStatus('idle');
    setError(null);
    taskIdRef.current = null;
  }, [stopPolling, cleanupChannels]);

  const downloadOutput = useCallback(async (output: TaskOutput) => {
    if (!output.download_url) {
      toast.error('Download not available');
      return;
    }

    try {
      window.open(output.download_url, '_blank');
    } catch (err) {
      toast.error('Failed to download');
    }
  }, []);

  return {
    // State
    task,
    steps,
    outputs,
    logs,
    suggestions,
    currentOutput,
    status,
    error,
    
    // Computed
    isIdle: status === 'idle',
    isPlanning: status === 'planning',
    isAwaitingApproval: status === 'awaiting_approval',
    isExecuting: status === 'executing',
    isPaused: status === 'paused',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    isRunning: status === 'planning' || status === 'executing',
    
    // Actions
    createTask,
    approveAndStart,
    pauseTask,
    resumeTask,
    stopTask,
    retryTask,
    reset,
    downloadOutput,
  };
}


