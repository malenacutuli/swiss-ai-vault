import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

interface UseAgentExecutionOptions {
  onComplete?: (task: ExecutionTask) => void;
  onError?: (error: string) => void;
}

export function useAgentExecution(options: UseAgentExecutionOptions = {}) {
  const { user } = useAuth();
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [currentOutput, setCurrentOutput] = useState<TaskOutput | null>(null);
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

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
        body: { task_id: taskId },
      });

      if (response.error) {
        console.error('[AgentExecution] Status error:', response.error);
        throw new Error(response.error.message || 'Failed to fetch status');
      }

      const data = response.data;
      
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

      return data;
    } catch (err) {
      console.error('[AgentExecution] Fetch status error:', err);
      throw err;
    }
  }, [options, stopPolling]);

  const startPolling = useCallback((taskId: string) => {
    stopPolling();
    taskIdRef.current = taskId;
    
    // Initial fetch
    fetchTaskStatus(taskId);
    
    // Poll every 2 seconds
    pollingRef.current = setInterval(() => {
      fetchTaskStatus(taskId);
    }, 2000);
  }, [fetchTaskStatus, stopPolling]);

  const createTask = useCallback(async (
    prompt: string,
    taskOptions: {
      taskType?: string;
      mode?: string;
      privacyTier?: string;
      tools?: string[];
      memoryContext?: string;
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

    try {
      const response = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt,
          task_type: taskOptions.taskType || 'general',
          mode: taskOptions.mode || 'auto',
          privacy_tier: taskOptions.privacyTier || 'vault',
          tools: taskOptions.tools || ['web_search', 'document_generator', 'image_generator'],
          context: taskOptions.memoryContext ? {
            memory: taskOptions.memoryContext,
          } : undefined,
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
    setTask(null);
    setSteps([]);
    setOutputs([]);
    setCurrentOutput(null);
    setStatus('idle');
    setError(null);
    taskIdRef.current = null;
  }, [stopPolling]);

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
