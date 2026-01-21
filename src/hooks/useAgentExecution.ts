import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * SwissBrain Agent Execution Hook
 * 
 * This hook connects directly to the K8s Agent API at api.swissbrain.ai
 * for agent execution, with Supabase used only for authentication.
 * 
 * Architecture:
 * Frontend -> Agent API (K8s) -> Redis/BullMQ -> Worker -> E2B Sandbox
 */

// Agent API endpoint (K8s backend) - can be overridden via env
const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'https://api.swissbrain.ai';

// Supabase Edge Functions URL (for fallback/legacy)
const SUPABASE_FUNCTIONS_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';

// Feature flag: use direct Agent API (true) or Supabase Edge Functions (false)
const USE_DIRECT_API = true;

export interface ExecutionTask {
  id: string;
  run_id?: string;
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
  // Sandbox info
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
  onStepComplete?: (step: ExecutionStep) => void;
  onTerminalOutput?: (line: TerminalLine) => void;
}

export function useAgentExecution(options: UseAgentExecutionOptions = {}) {
  // Core state
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showExecutionView, setShowExecutionView] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [thinking, setThinking] = useState<string>('');

  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef<string | null>(null);
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const stopExecution = useCallback(() => {
    stopPolling();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [stopPolling]);

  /**
   * Get auth token from Supabase
   */
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  /**
   * Make authenticated request to Agent API
   */
  const apiRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const baseUrl = USE_DIRECT_API ? AGENT_API_URL : SUPABASE_FUNCTIONS_URL;
    const url = `${baseUrl}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  }, [getAuthToken]);

  /**
   * Handle SSE stream events
   */
  const handleStreamEvent = useCallback((data: any) => {
    const eventType = data.type || data.event;

    switch (eventType) {
      case 'status':
        setStatus(data.status);
        if (data.phase) setCurrentPhase(data.phase);
        if (data.progress) {
          setTask(prev => prev ? { ...prev, progress: data.progress } : null);
        }
        break;

      case 'thinking':
        setThinking(data.content || data.thinking || '');
        break;

      case 'step':
        setSteps(prev => {
          const existing = prev.find(s => s.id === data.step?.id);
          if (existing) {
            return prev.map(s => s.id === data.step.id ? { ...s, ...data.step } : s);
          }
          return data.step ? [...prev, data.step] : prev;
        });
        if (data.step) {
          optionsRef.current.onStepComplete?.(data.step);
        }
        break;

      case 'terminal':
      case 'output':
        if (data.stream || data.type === 'terminal') {
          const line: TerminalLine = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: data.stream || 'stdout',
            content: data.content || data.output || data.data || '',
            timestamp: new Date().toISOString(),
          };
          setTerminalLines(prev => [...prev, line]);
          optionsRef.current.onTerminalOutput?.(line);
        }
        break;

      case 'files':
        setFiles(data.files || []);
        break;

      case 'preview':
        setPreviewUrl(data.url);
        break;

      case 'artifact':
      case 'file':
        if (data.output || data.artifact) {
          setOutputs(prev => [...prev, data.output || data.artifact]);
        }
        break;

      case 'task':
        setTask(prev => ({ ...prev, ...data.task }));
        break;

      case 'log':
        setLogs(prev => [...prev, data.log || data]);
        break;

      case 'complete':
      case 'completed':
        setStatus('completed');
        setTask(prev => prev ? { ...prev, status: 'completed', ...data.task } : data.task);
        stopExecution();
        optionsRef.current.onComplete?.(data.task || task);
        break;

      case 'error':
      case 'failed':
        setStatus('failed');
        setError(data.error || data.message || 'Task failed');
        stopExecution();
        optionsRef.current.onError?.(data.error || data.message || 'Task failed');
        break;
    }
  }, [task, stopExecution]);

  /**
   * Start SSE streaming for real-time updates
   */
  const startStreaming = useCallback(async (taskId: string) => {
    if (!taskId || taskId === 'undefined') {
      console.error('[startStreaming] Invalid taskId');
      return;
    }

    stopExecution();
    abortControllerRef.current = new AbortController();

    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('[startStreaming] No session, falling back to polling');
        pollTaskStatus(taskId);
        return;
      }

      // Try SSE streaming first
      const streamUrl = `${AGENT_API_URL}/agent/run/${taskId}/stream`;
      
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${token}`,
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        console.error('[startStreaming] Stream not available, falling back to polling');
        pollTaskStatus(taskId);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.slice(5).trim());
                handleStreamEvent(data);
              } catch (e) {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        }
      };

      processStream().catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[startStreaming] Stream error:', err);
          pollTaskStatus(taskId);
        }
      });

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[startStreaming] Error:', err);
        pollTaskStatus(taskId);
      }
    }
  }, [stopExecution, getAuthToken, handleStreamEvent]);

  /**
   * Poll task status (fallback when streaming unavailable)
   */
  const pollTaskStatus = useCallback(async (taskId: string) => {
    if (!taskId || taskId === 'undefined') {
      console.error('[pollTaskStatus] Invalid taskId');
      return;
    }

    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const response = await apiRequest('/agent/status', {
          method: 'POST',
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
        if (data.terminal?.length > 0) {
          setTerminalLines(data.terminal.map((t: any, i: number) => ({
            id: `poll-${i}`,
            type: t.type || 'stdout',
            content: t.content,
            timestamp: t.timestamp || new Date().toISOString(),
          })));
        }
        if (data.files?.length > 0) setFiles(data.files);
        if (data.preview_url) setPreviewUrl(data.preview_url);

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
  }, [stopPolling, apiRequest]);

  /**
   * Execute a new agent task
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
    setPreviewUrl(null);
    setThinking('');
    setCurrentPhase('Planning');
    setShowExecutionView(true);

    try {
      console.log('[executeTask] Calling Agent API at', AGENT_API_URL);

      const response = await apiRequest('/agent/execute', {
        method: 'POST',
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
        throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Extract task/run ID from response
      const runId = data.run_id || data.task?.id || data.task?.run_id || data.id;

      if (!runId) {
        throw new Error('No run_id returned from API');
      }

      taskIdRef.current = runId;
      setTask({
        id: runId,
        run_id: runId,
        prompt: params.prompt,
        task_type: params.task_type,
        status: 'executing',
        ...data.task,
      });
      setStatus('executing');

      // Add initial terminal line
      setTerminalLines([{
        id: 'init',
        type: 'system',
        content: `Task started: ${runId}`,
        timestamp: new Date().toISOString(),
      }]);

      // Start streaming/polling
      await startStreaming(runId);

      return runId;

    } catch (err: any) {
      console.error('[executeTask] Error:', err);
      setStatus('failed');
      setError(err.message);
      optionsRef.current.onError?.(err.message);
      toast({
        title: 'Execution Failed',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  }, [apiRequest, startStreaming, toast]);

  /**
   * Cancel running task
   */
  const cancelTask = useCallback(async () => {
    if (!taskIdRef.current) return;

    stopExecution();

    try {
      await apiRequest('/agent/cancel', {
        method: 'POST',
        body: JSON.stringify({ run_id: taskIdRef.current }),
      });
    } catch (err) {
      console.error('[cancelTask] Error:', err);
    }

    setStatus('cancelled');
  }, [stopExecution, apiRequest]);

  /**
   * Retry failed task
   */
  const retryTask = useCallback(async () => {
    if (!taskIdRef.current) return;

    setStatus('executing');
    setError(null);

    try {
      const response = await apiRequest('/agent/execute', {
        method: 'POST',
        body: JSON.stringify({
          action: 'retry',
          run_id: taskIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      await startStreaming(taskIdRef.current);
    } catch (err: any) {
      setStatus('failed');
      setError(err.message);
    }
  }, [apiRequest, startStreaming]);

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
    if (!taskId || taskId === 'undefined') return;
    
    taskIdRef.current = taskId;
    setShowExecutionView(true);
    setStatus('executing');
    
    // Add initial terminal line
    setTerminalLines([{
      id: 'load',
      type: 'system',
      content: `Loading task: ${taskId}`,
      timestamp: new Date().toISOString(),
    }]);
    
    // Start streaming/polling for the existing task
    await startStreaming(taskId);
  }, [startStreaming]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    stopExecution();
    setTask(null);
    setSteps([]);
    setLogs([]);
    setTerminalLines([]);
    setFiles([]);
    setOutputs([]);
    setStatus('idle');
    setError(null);
    setShowExecutionView(false);
    setPreviewUrl(null);
    setThinking('');
    setCurrentPhase('');
    taskIdRef.current = null;
  }, [stopExecution]);

  return {
    // State
    task,
    steps,
    logs,
    terminalLines,
    files,
    outputs,
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
    setShowExecutionView,
  };
}
