import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Direct project URL for edge functions
const DIRECT_PROJECT_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';

export interface ExecutionTask {
  id: string;
  prompt?: string;
  title?: string;
  task_type?: string;
  status: string;
  progress?: number;
  progress_percentage?: number;
  current_step?: number;
  total_steps?: number;
  result?: any;
  result_summary?: string;
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  plan_summary?: string;
  plan_json?: any;
  duration_ms?: number;
  credits_used?: number;
  tokens_used?: number;
}

export interface ExecutionStep {
  id: string;
  step_number: number;
  name?: string;
  step_type?: string;
  description?: string;
  status: string;
  tool_name?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface TaskOutput {
  id: string;
  output_type: string;
  file_name: string;
  download_url: string;
  file_size_bytes?: number;
  content_preview?: string;
  mime_type?: string;
  preview_url?: string;
  conversion_status?: string;
  metadata?: Record<string, unknown>;
}

interface ExecuteTaskParams {
  prompt: string;
  task_type: string;
  mode?: string;
  params?: any;
  memory_context?: any;
}

interface UseAgentExecutionOptions {
  onComplete?: (task: ExecutionTask) => void;
  onError?: (error: string) => void;
}

export function useAgentExecution(options: UseAgentExecutionOptions = {}) {
  // ALL HOOKS AT TOP - UNCONDITIONAL
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showExecutionView, setShowExecutionView] = useState(false);

  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Derived state
  const isIdle = status === 'idle';
  const isExecuting = status === 'executing' || status === 'planning';
  const isPlanning = status === 'planning';
  const isAwaitingApproval = status === 'awaiting_approval';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Cleanup on unmount
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

  const pollTaskStatus = useCallback(async (taskId: string) => {
    if (!taskId || taskId === 'undefined') {
      console.error('[pollTaskStatus] Invalid taskId');
      return;
    }

    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        // Get token from main Supabase client
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('[pollTaskStatus] No session');
          return;
        }

        const response = await fetch(`${DIRECT_PROJECT_URL}/agent-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ run_id: taskId }),
        });

        if (!response.ok) {
          console.error('[pollTaskStatus] HTTP error:', response.status);
          return;
        }

        const data = await response.json();

        // Handle null task (race condition)
        if (!data?.task) {
          console.log('[pollTaskStatus] Task not ready, waiting...');
          return;
        }

        // Update state
        setTask(data.task);
        setStatus(data.task.status || 'executing');
        if (data.steps?.length > 0) setSteps(data.steps);
        if (data.logs?.length > 0) setLogs(data.logs);
        if (data.outputs?.length > 0) setOutputs(data.outputs);

        // Stop on terminal states
        if (['completed', 'failed', 'cancelled'].includes(data.task.status)) {
          stopPolling();
          if (data.task.status === 'completed') {
            optionsRef.current.onComplete?.(data.task);
          } else if (data.task.status === 'failed') {
            optionsRef.current.onError?.(data.task.error_message || 'Task failed');
          }
        }

      } catch (err) {
        console.error('[pollTaskStatus] Exception:', err);
      }
    }, 2000);
  }, [stopPolling]);

  const executeTask = useCallback(async (params: ExecuteTaskParams) => {
    setStatus('executing');
    setError(null);
    setTask(null);
    setSteps([]);
    setLogs([]);
    setOutputs([]);
    setShowExecutionView(true);

    try {
      // Get token from main Supabase client (Lovable project)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      console.log('[executeTask] Calling agent-execute with user token');

      const response = await fetch(`${DIRECT_PROJECT_URL}/agent-execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          prompt: params.prompt,
          task_type: params.task_type,
          mode: params.mode || params.task_type,
          params: params.params || {},
          memory_context: params.memory_context || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Extract task from response
      let taskId: string | null = null;

      if (data?.task?.id) {
        taskId = data.task.id;
        setTask(data.task);
        setStatus(data.task.status || 'executing');
        taskIdRef.current = taskId;
      } else if (data?.run_id) {
        taskId = data.run_id;
        taskIdRef.current = taskId;
      } else if (data?.taskId) {
        taskId = data.taskId;
        taskIdRef.current = taskId;
      }

      if (!taskId) {
        throw new Error('No task ID returned');
      }

      console.log('[executeTask] Task created:', taskId);

      // Small delay before polling
      await new Promise(r => setTimeout(r, 500));

      pollTaskStatus(taskId);

      toast({
        title: 'Task started',
        description: 'Your request is being processed.',
      });

      return data?.task || { id: taskId };

    } catch (err: any) {
      console.error('[executeTask] Error:', err);
      setError(err.message || 'An error occurred');
      setStatus('failed');
      setShowExecutionView(false);

      toast({
        title: 'Failed to start task',
        description: err.message,
        variant: 'destructive',
      });

      return null;
    }
  }, [pollTaskStatus, toast]);

  // Create task (alias for executeTask with different signature)
  const createTask = useCallback(async (
    prompt: string,
    taskOptions: {
      taskType?: string;
      privacyTier?: string;
      memoryContext?: string;
      attachments?: Array<{ name: string; url: string; type: string }>;
      connectedTools?: string[];
    } = {}
  ) => {
    setStatus('planning');
    
    return executeTask({
      prompt,
      task_type: taskOptions.taskType || 'general',
      mode: taskOptions.taskType,
      memory_context: taskOptions.memoryContext,
      params: { attachments: taskOptions.attachments },
    });
  }, [executeTask]);

  // Load existing task
  const loadTask = useCallback(async (taskId: string) => {
    if (!taskId || taskId === 'undefined') return;
    
    taskIdRef.current = taskId;
    setShowExecutionView(true);
    setStatus('executing');
    
    pollTaskStatus(taskId);
  }, [pollTaskStatus]);

  // Retry task
  const retryTask = useCallback(async () => {
    if (!task?.prompt) return;
    
    return createTask(task.prompt, {
      taskType: task.task_type || 'general',
    });
  }, [task, createTask]);

  // Approve and start (for approval flow - currently auto-approves)
  const approveAndStart = useCallback(async () => {
    console.log('[approveAndStart] Auto-approved');
  }, []);

  // Pause task
  const pauseTask = useCallback(async () => {
    if (!task?.id) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'paused' })
        .eq('id', task.id);
      
      setStatus('paused');
      stopPolling();
    } catch (err) {
      console.error('[pauseTask] Error:', err);
    }
  }, [task, stopPolling]);

  // Resume task
  const resumeTask = useCallback(async () => {
    if (!task?.id) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'executing' })
        .eq('id', task.id);
      
      setStatus('executing');
      pollTaskStatus(task.id);
    } catch (err) {
      console.error('[resumeTask] Error:', err);
    }
  }, [task, pollTaskStatus]);

  // Stop/cancel task
  const stopTask = useCallback(async () => {
    if (!task?.id) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);
      
      setStatus('failed');
      stopPolling();
    } catch (err) {
      console.error('[stopTask] Error:', err);
    }
  }, [task, stopPolling]);

  // Get signed URL for secure downloads
  const getSignedUrl = useCallback(async (storageKey: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('agent-outputs')
        .createSignedUrl(storageKey, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('[getSignedUrl] Error:', err);
      return null;
    }
  }, []);

  // Download output with signed URL
  const downloadOutput = useCallback(async (output: TaskOutput) => {
    // First try file_path for signed URL
    if (output.download_url?.includes('/storage/v1/')) {
      // Extract path from public URL and create signed URL
      const pathMatch = output.download_url.match(/\/agent-outputs\/(.+)$/);
      if (pathMatch) {
        const signedUrl = await getSignedUrl(pathMatch[1]);
        if (signedUrl) {
          window.open(signedUrl, '_blank');
          return;
        }
      }
    }
    
    // Fallback to direct URL
    if (output.download_url) {
      window.open(output.download_url, '_blank');
    }
  }, [getSignedUrl]);

  // Reset
  const reset = useCallback(() => {
    stopPolling();
    setTask(null);
    setSteps([]);
    setLogs([]);
    setOutputs([]);
    setStatus('idle');
    setError(null);
    setShowExecutionView(false);
    taskIdRef.current = null;
  }, [stopPolling]);

  return {
    // State
    task,
    steps,
    logs,
    outputs,
    status,
    error,
    showExecutionView,
    setShowExecutionView,
    
    // Derived state
    isIdle,
    isExecuting,
    isPlanning,
    isAwaitingApproval,
    isPaused,
    isCompleted,
    isFailed,
    
    // Actions
    executeTask,
    createTask,
    loadTask,
    retryTask,
    approveAndStart,
    pauseTask,
    resumeTask,
    stopTask,
    downloadOutput,
    getSignedUrl,
    pollTaskStatus,
    reset,
    stopPolling,
  };
}
