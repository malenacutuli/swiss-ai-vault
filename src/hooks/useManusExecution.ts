import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Manus.im API Execution Hook
 *
 * This hook routes agent execution to Manus.im API via Supabase Edge Functions.
 * It provides the same interface as useAgentExecution for easy switching.
 *
 * Architecture:
 * Frontend -> Supabase Edge Function (manus-execute) -> Manus.im API
 */

// Supabase Edge Functions URL
const SUPABASE_FUNCTIONS_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';

export interface ExecutionTask {
  id: string;
  run_id?: string;
  manus_task_id?: string;
  manus_task_url?: string;
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
  sandbox_id?: string;
  preview_url?: string;
}

export interface ExecutionStep {
  id: string;
  step_number: number;
  name?: string;
  step_type?: string;
  description?: string;
  status: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface TerminalLine {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'command';
  content: string;
  timestamp: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  children?: FileNode[];
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  message_type?: 'text' | 'request_input' | 'tool_call' | 'tool_result';
  metadata?: Record<string, unknown>;
}

interface ExecuteTaskParams {
  prompt: string;
  task_type: string;
  mode?: string;
  params?: any;
  memory_context?: any;
}

interface UseManusExecutionOptions {
  onComplete?: (task: ExecutionTask) => void;
  onError?: (error: string) => void;
  onStepComplete?: (step: ExecutionStep) => void;
  onTerminalOutput?: (line: TerminalLine) => void;
}

export function useManusExecution(options: UseManusExecutionOptions = {}) {
  // Core state
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showExecutionView, setShowExecutionView] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [thinking, setThinking] = useState<string>('');

  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const manusTaskIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Derived state
  const isIdle = status === 'idle';
  const isExecuting = status === 'executing' || status === 'planning' || status === 'running';
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

  /**
   * Get auth token from Supabase
   */
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  /**
   * Make authenticated request to Manus Edge Function
   */
  const manusRequest = useCallback(async (
    body: Record<string, any>
  ): Promise<Response> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return fetch(`${SUPABASE_FUNCTIONS_URL}/manus-execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }, [getAuthToken]);

  /**
   * Poll Manus task status
   */
  const pollManusStatus = useCallback(async (runId: string, manusTaskId: string) => {
    stopPolling();

    const addTerminalLine = (content: string, type: 'stdout' | 'system' = 'system') => {
      setTerminalLines(prev => [...prev, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp: new Date().toISOString(),
      }]);
    };

    pollingRef.current = setInterval(async () => {
      try {
        const response = await manusRequest({
          action: 'status',
          run_id: runId,
          task_id: manusTaskId,
        });

        if (!response.ok) {
          console.error('[pollManusStatus] HTTP error:', response.status);
          return;
        }

        const data = await response.json();
        const manusStatus = data.manus_status;

        if (!manusStatus) {
          console.log('[pollManusStatus] Status not ready...');
          return;
        }

        // Update task with Manus data
        setTask(prev => ({
          ...prev,
          id: runId,
          run_id: runId,
          manus_task_id: manusTaskId,
          manus_task_url: manusStatus.metadata?.task_url,
          status: data.status,
          credits_used: manusStatus.credit_usage,
          title: manusStatus.metadata?.task_title,
        } as ExecutionTask));

        setStatus(data.status === 'completed' ? 'completed' :
                  data.status === 'failed' ? 'failed' :
                  data.status === 'running' ? 'executing' : 'executing');

        // Extract messages from output
        if (manusStatus.output && Array.isArray(manusStatus.output)) {
          const newMessages: ChatMessage[] = [];

          for (const item of manusStatus.output) {
            if (item.content && Array.isArray(item.content)) {
              for (const content of item.content) {
                if (content.type === 'output_text' && content.text) {
                  newMessages.push({
                    id: item.id,
                    role: item.role,
                    content: content.text,
                    created_at: new Date().toISOString(),
                    message_type: 'text',
                  });

                  // Add to terminal
                  if (item.role === 'assistant') {
                    addTerminalLine(`[Manus] ${content.text}`, 'stdout');
                  }
                }
              }
            }
          }

          if (newMessages.length > 0) {
            setMessages(newMessages);
          }
        }

        // Stop polling on terminal states
        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          stopPolling();

          if (data.status === 'completed') {
            addTerminalLine(`Task completed! Credits used: ${manusStatus.credit_usage || 0}`);
            optionsRef.current.onComplete?.({
              id: runId,
              status: 'completed',
              credits_used: manusStatus.credit_usage,
              manus_task_url: manusStatus.metadata?.task_url,
            } as ExecutionTask);
          } else if (data.status === 'failed') {
            addTerminalLine(`Task failed: ${manusStatus.error || 'Unknown error'}`, 'system');
            optionsRef.current.onError?.(manusStatus.error || 'Task failed');
          }
        }

      } catch (err) {
        console.error('[pollManusStatus] Exception:', err);
      }
    }, 3000); // Poll every 3 seconds
  }, [stopPolling, manusRequest]);

  /**
   * Execute a new agent task via Manus.im
   */
  const executeTask = useCallback(async (params: ExecuteTaskParams) => {
    // Reset state
    setStatus('planning');
    setError(null);
    setTask(null);
    setSteps([]);
    setLogs([]);
    setTerminalLines([]);
    setFiles([]);
    setOutputs([]);
    setMessages([]);
    setPreviewUrl(null);
    setThinking('');
    setCurrentPhase('Sending to Manus.im');
    setShowExecutionView(true);

    const addTerminalLine = (content: string, type: 'stdout' | 'system' = 'system') => {
      setTerminalLines(prev => [...prev, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp: new Date().toISOString(),
      }]);
    };

    try {
      addTerminalLine('Connecting to Manus.im API...');

      const response = await manusRequest({
        action: 'create',
        prompt: params.prompt,
        project_id: params.params?.project_id,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const runId = data.run_id;
      const manusTaskId = data.manus_task_id;
      const manusTaskUrl = data.manus_task_url;

      if (!runId || !manusTaskId) {
        throw new Error('No task IDs returned from API');
      }

      taskIdRef.current = runId;
      manusTaskIdRef.current = manusTaskId;

      addTerminalLine(`Task created: ${manusTaskId}`);
      addTerminalLine(`View on Manus.im: ${manusTaskUrl}`);

      setTask({
        id: runId,
        run_id: runId,
        manus_task_id: manusTaskId,
        manus_task_url: manusTaskUrl,
        prompt: params.prompt,
        task_type: params.task_type,
        status: 'executing',
      });
      setStatus('executing');
      setCurrentPhase('Executing via Manus.im');

      // Start polling for status
      await pollManusStatus(runId, manusTaskId);

      return runId;

    } catch (err: any) {
      console.error('[executeTask] Error:', err);
      setStatus('failed');
      setError(err.message);
      addTerminalLine(`Error: ${err.message}`, 'system');
      optionsRef.current.onError?.(err.message);
      toast({
        title: 'Execution Failed',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  }, [manusRequest, pollManusStatus, toast]);

  /**
   * Cancel running task
   */
  const cancelTask = useCallback(async () => {
    if (!taskIdRef.current) return;

    stopPolling();

    try {
      await manusRequest({
        action: 'cancel',
        run_id: taskIdRef.current,
        task_id: manusTaskIdRef.current,
      });
    } catch (err) {
      console.error('[cancelTask] Error:', err);
    }

    setStatus('cancelled');
  }, [stopPolling, manusRequest]);

  /**
   * Create task (convenience wrapper for executeTask)
   */
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
    return executeTask({
      prompt,
      task_type: taskOptions.taskType || 'general',
      mode: taskOptions.taskType || 'general',
      params: {
        privacy_tier: taskOptions.privacyTier,
        attachments: taskOptions.attachments,
        connected_tools: taskOptions.connectedTools,
      },
      memory_context: taskOptions.memoryContext,
    });
  }, [executeTask]);

  /**
   * Load existing task by ID
   */
  const loadTask = useCallback(async (taskId: string) => {
    if (!taskId) return;

    taskIdRef.current = taskId;
    setShowExecutionView(true);
    setStatus('executing');

    // Fetch task from database to get manus_task_id
    const { data: run } = await supabase
      .from('agent_runs' as any)
      .select('*')
      .eq('id', taskId)
      .single();

    const runData = run as { metadata?: { manus_task_id?: string } } | null;
    if (runData && runData.metadata?.manus_task_id) {
      manusTaskIdRef.current = runData.metadata.manus_task_id;
      await pollManusStatus(taskId, runData.metadata.manus_task_id);
    }
  }, [pollManusStatus]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    stopPolling();
    setTask(null);
    setSteps([]);
    setLogs([]);
    setTerminalLines([]);
    setFiles([]);
    setOutputs([]);
    setMessages([]);
    setStatus('idle');
    setError(null);
    setShowExecutionView(false);
    setPreviewUrl(null);
    setThinking('');
    setCurrentPhase('');
    taskIdRef.current = null;
    manusTaskIdRef.current = null;
  }, [stopPolling]);

  /**
   * Send a message (not yet supported by Manus API)
   */
  const sendMessage = useCallback(async (content: string) => {
    console.warn('[sendMessage] Message sending not yet supported with Manus.im API');
    toast({
      title: 'Not Supported',
      description: 'Sending messages to running tasks is not yet supported with Manus.im',
      variant: 'default',
    });
  }, [toast]);

  /**
   * Retry failed task
   */
  const retryTask = useCallback(async () => {
    if (!task?.prompt) return;

    await executeTask({
      prompt: task.prompt,
      task_type: task.task_type || 'general',
    });
  }, [task, executeTask]);

  const stopTask = useCallback(async () => {
    await cancelTask();
  }, [cancelTask]);

  const pauseTask = useCallback(async () => {
    console.warn('[pauseTask] Pause not supported with Manus.im API');
  }, []);

  return {
    // State
    task,
    steps,
    logs,
    terminalLines,
    files,
    outputs,
    messages,
    status,
    error,
    showExecutionView,
    previewUrl,
    currentPhase,
    thinking,

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
    cancelTask,
    retryTask,
    reset,
    sendMessage,
    stopTask,
    pauseTask,
    setShowExecutionView,
  };
}
