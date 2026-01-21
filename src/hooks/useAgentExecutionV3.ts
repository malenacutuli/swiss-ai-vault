import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * SwissBrain Agent Execution Hook v3
 * 
 * This version connects DIRECTLY to the K8s Agent API at api.swissbrain.ai
 * instead of going through Supabase Edge Functions.
 * 
 * Architecture:
 * Frontend -> Agent API (K8s) -> BullMQ -> Worker -> E2B Sandbox
 *                    |
 *                    v
 *              SSE Streaming
 */

// Agent API endpoint (K8s backend)
const AGENT_API_URL = 'https://api.swissbrain.ai';

// Supabase for auth only
const SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';

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

export function useAgentExecutionV3(options: UseAgentExecutionOptions = {}) {
  // Core state
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Derived state
  const isIdle = status === 'idle';
  const isExecuting = status === 'executing' || status === 'planning' || status === 'running';
  const isPlanning = status === 'planning';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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
   * Start SSE streaming from Agent API
   */
  const startStreaming = useCallback(async (runId: string) => {
    if (!runId) {
      console.error('[startStreaming] Invalid runId');
      return;
    }

    stopExecution();
    abortControllerRef.current = new AbortController();

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Connect to Agent API SSE endpoint
      const streamUrl = `${AGENT_API_URL}/agent/stream/${runId}`;
      
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
        startPolling(runId);
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
                // Ignore parse errors
              }
            }
          }
        }
      };

      processStream().catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[startStreaming] Stream error:', err);
          startPolling(runId);
        }
      });

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[startStreaming] Error:', err);
        startPolling(runId);
      }
    }
  }, [stopExecution, getAuthToken]);

  /**
   * Handle SSE events
   */
  const handleStreamEvent = useCallback((data: any) => {
    const eventType = data.type || data.event;

    switch (eventType) {
      case 'status':
        setStatus(data.status);
        if (data.phase) setCurrentPhase(data.phase);
        break;

      case 'thinking':
        setThinking(data.content || data.thinking);
        break;

      case 'step':
        setSteps(prev => {
          const existing = prev.find(s => s.id === data.step.id);
          if (existing) {
            return prev.map(s => s.id === data.step.id ? { ...s, ...data.step } : s);
          }
          return [...prev, data.step];
        });
        optionsRef.current.onStepComplete?.(data.step);
        break;

      case 'terminal':
        const line: TerminalLine = {
          id: `${Date.now()}-${Math.random()}`,
          type: data.stream || 'stdout',
          content: data.content || data.output,
          timestamp: new Date().toISOString(),
        };
        setTerminalLines(prev => [...prev, line]);
        optionsRef.current.onTerminalOutput?.(line);
        break;

      case 'files':
        setFiles(data.files || []);
        break;

      case 'preview':
        setPreviewUrl(data.url);
        break;

      case 'output':
        setOutputs(prev => [...prev, data.output]);
        break;

      case 'task':
        setTask(data.task);
        break;

      case 'complete':
      case 'completed':
        setStatus('completed');
        setTask(prev => prev ? { ...prev, status: 'completed', ...data.task } : data.task);
        optionsRef.current.onComplete?.(data.task || task);
        break;

      case 'error':
      case 'failed':
        setStatus('failed');
        setError(data.error || data.message);
        optionsRef.current.onError?.(data.error || data.message);
        break;
    }
  }, [task]);

  /**
   * Fallback polling for status updates
   */
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback(async (runId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(`${AGENT_API_URL}/agent/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ run_id: runId }),
        });

        if (!response.ok) return;

        const data = await response.json();
        
        if (data.task) {
          setTask(data.task);
          setStatus(data.task.status || 'executing');
        }
        if (data.steps?.length > 0) setSteps(data.steps);
        if (data.terminal?.length > 0) {
          setTerminalLines(data.terminal.map((t: any, i: number) => ({
            id: `poll-${i}`,
            type: t.type || 'stdout',
            content: t.content,
            timestamp: t.timestamp || new Date().toISOString(),
          })));
        }
        if (data.files?.length > 0) setFiles(data.files);
        if (data.outputs?.length > 0) setOutputs(data.outputs);
        if (data.preview_url) setPreviewUrl(data.preview_url);

        // Stop on terminal states
        if (['completed', 'failed', 'cancelled'].includes(data.task?.status)) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          
          if (data.task.status === 'completed') {
            optionsRef.current.onComplete?.(data.task);
          } else if (data.task.status === 'failed') {
            optionsRef.current.onError?.(data.task.error_message || 'Task failed');
          }
        }
      } catch (err) {
        console.error('[polling] Error:', err);
      }
    }, 2000);
  }, [getAuthToken]);

  /**
   * Execute a new task
   */
  const executeTask = useCallback(async (params: ExecuteTaskParams) => {
    // Reset state
    setStatus('planning');
    setError(null);
    setTask(null);
    setSteps([]);
    setTerminalLines([]);
    setFiles([]);
    setOutputs([]);
    setPreviewUrl(null);
    setThinking('');
    setCurrentPhase('Planning');
    setShowExecutionView(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      console.log('[executeTask] Calling Agent API directly');

      // Call Agent API directly
      const response = await fetch(`${AGENT_API_URL}/agent/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
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
      const runId = data.run_id || data.task?.id || data.id;

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
      });
      setStatus('executing');

      // Add initial terminal line
      setTerminalLines([{
        id: 'init',
        type: 'system',
        content: `Task started: ${runId}`,
        timestamp: new Date().toISOString(),
      }]);

      // Start streaming
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
  }, [getAuthToken, startStreaming, toast]);

  /**
   * Cancel running task
   */
  const cancelTask = useCallback(async () => {
    if (!taskIdRef.current) return;

    stopExecution();
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      const token = await getAuthToken();
      if (!token) return;

      await fetch(`${AGENT_API_URL}/agent/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ run_id: taskIdRef.current }),
      });
    } catch (err) {
      console.error('[cancelTask] Error:', err);
    }

    setStatus('cancelled');
  }, [stopExecution, getAuthToken]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    stopExecution();
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setTask(null);
    setSteps([]);
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
    isCompleted,
    isFailed,

    // Actions
    executeTask,
    cancelTask,
    reset,
    setShowExecutionView,
  };
}
