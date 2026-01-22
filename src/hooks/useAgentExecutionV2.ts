/**
 * Enhanced Agent Execution Hook with SSE Streaming
 * 
 * This hook provides real-time agent execution updates via Server-Sent Events (SSE)
 * with fallback to polling for environments that don't support SSE.
 * 
 * Features:
 * - Real-time streaming updates via SSE
 * - Automatic fallback to polling
 * - Tool call and result tracking
 * - Terminal output streaming
 * - File output management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// API endpoints
const SUPABASE_FUNCTIONS_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';
const AGENT_API_URL = import.meta.env.VITE_API_URL || 'https://api.swissbrain.ai';

// Types
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
  sandbox_id?: string;
  sandbox_url?: string;
}

export interface ExecutionStep {
  id: string;
  step_number: number;
  name?: string;
  step_type?: string;
  description?: string;
  status: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
  tool_output?: any;
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

export interface TerminalLine {
  id: string;
  content: string;
  type: 'stdout' | 'stderr' | 'command' | 'system';
  timestamp: string;
}

interface ExecuteTaskParams {
  prompt: string;
  task_type: string;
  mode?: string;
  params?: any;
  memory_context?: any;
  attachments?: Array<{ name: string; url: string; type: string }>;
}

interface UseAgentExecutionOptions {
  onComplete?: (task: ExecutionTask) => void;
  onError?: (error: string) => void;
  onToolCall?: (step: ExecutionStep) => void;
  onTerminalOutput?: (line: TerminalLine) => void;
  useStreaming?: boolean;
}

export function useAgentExecutionV2(options: UseAgentExecutionOptions = {}) {
  const { useStreaming = true } = options;
  
  // State
  const [task, setTask] = useState<ExecutionTask | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [logs, setLogs] = useState<TerminalLine[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);

  const { toast } = useToast();
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Derived state
  const isIdle = status === 'idle';
  const isExecuting = ['executing', 'running', 'planning'].includes(status);
  const isPlanning = status === 'planning';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Cleanup
  useEffect(() => {
    return () => {
      stopPolling();
      disconnectStream();
    };
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Disconnect SSE stream
  const disconnectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Add terminal line
  const addTerminalLine = useCallback((content: string, type: TerminalLine['type'] = 'stdout') => {
    const line: TerminalLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      timestamp: new Date().toISOString(),
    };
    setLogs(prev => [...prev, line]);
    optionsRef.current.onTerminalOutput?.(line);
  }, []);

  // Connect to SSE stream
  const connectStream = useCallback(async (taskId: string) => {
    disconnectStream();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Build SSE URL
      const streamUrl = `${AGENT_API_URL}/agent/run/${taskId}/stream?token=${encodeURIComponent(session.access_token)}`;
      
      console.log('[AgentExecution] Connecting to SSE stream:', streamUrl);
      addTerminalLine(`Connecting to agent stream...`, 'system');
      
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[AgentExecution] SSE connected');
        addTerminalLine(`Connected to agent`, 'system');
      };

      eventSource.onerror = (err) => {
        console.error('[AgentExecution] SSE error:', err);
        // Fallback to polling
        if (eventSource.readyState === EventSource.CLOSED) {
          addTerminalLine(`Stream disconnected, falling back to polling`, 'system');
          startPolling(taskId);
        }
      };

      // Status updates
      eventSource.addEventListener('status', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setStatus(data.status);
        setTask(prev => prev ? { ...prev, status: data.status, current_step: data.current_phase } : null);
        addTerminalLine(`Status: ${data.status}`, 'system');
      });

      // Tool calls
      eventSource.addEventListener('tool_call', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const step: ExecutionStep = {
          id: data.step_id,
          step_number: steps.length + 1,
          tool_name: data.tool_name,
          tool_input: data.tool_input,
          status: 'executing',
          description: `Executing ${data.tool_name}`,
        };
        setSteps(prev => [...prev, step]);
        addTerminalLine(`> ${data.tool_name}(${JSON.stringify(data.tool_input).slice(0, 100)}...)`, 'command');
        optionsRef.current.onToolCall?.(step);
      });

      // Tool results
      eventSource.addEventListener('tool_result', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setSteps(prev => prev.map(s => 
          s.id === data.step_id 
            ? { ...s, status: data.success ? 'completed' : 'failed', tool_output: data.output, error_message: data.error }
            : s
        ));
        if (data.success) {
          addTerminalLine(`✓ ${data.tool_name} completed (${data.duration_ms}ms)`, 'stdout');
        } else {
          addTerminalLine(`✗ ${data.tool_name} failed: ${data.error}`, 'stderr');
        }
      });

      // Terminal output
      eventSource.addEventListener('terminal', (e) => {
        const data = JSON.parse(e.data);
        addTerminalLine(data.content, data.type || 'stdout');
      });

      // Agent thinking
      eventSource.addEventListener('thinking', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setThinking(data.content);
      });

      // Messages
      eventSource.addEventListener('message', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        if (data.role === 'assistant') {
          setTask(prev => prev ? { ...prev, result_summary: data.content } : null);
        }
      });

      // Sandbox info
      eventSource.addEventListener('sandbox', (e) => {
        const data = JSON.parse(e.data);
        setSandboxUrl(data.url);
        setTask(prev => prev ? { ...prev, sandbox_id: data.sandbox_id, sandbox_url: data.url } : null);
        addTerminalLine(`Sandbox ready: ${data.url}`, 'system');
      });

      // File outputs
      eventSource.addEventListener('output', (e) => {
        const data = JSON.parse(e.data);
        const output: TaskOutput = {
          id: data.id || `output-${Date.now()}`,
          output_type: data.type,
          file_name: data.file_name,
          download_url: data.url,
          mime_type: data.mime_type,
        };
        setOutputs(prev => [...prev, output]);
        addTerminalLine(`Output: ${data.file_name}`, 'system');
      });

      // Completion
      eventSource.addEventListener('complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setStatus(data.status);
        setTask(prev => prev ? { ...prev, status: data.status, result: data.result } : null);
        addTerminalLine(`Task ${data.status}: ${data.message}`, 'system');
        eventSource.close();
        
        if (data.status === 'completed') {
          optionsRef.current.onComplete?.(task!);
        }
      });

      // Error
      eventSource.addEventListener('error', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setError(data.message);
          setStatus('failed');
          addTerminalLine(`Error: ${data.message}`, 'stderr');
          optionsRef.current.onError?.(data.message);
        } catch {
          // Non-JSON error
        }
      });

    } catch (err: any) {
      console.error('[AgentExecution] Failed to connect stream:', err);
      // Fallback to polling
      startPolling(taskId);
    }
  }, [addTerminalLine, disconnectStream, steps.length, task]);

  // Start polling (fallback)
  const startPolling = useCallback(async (taskId: string) => {
    stopPolling();
    
    pollingRef.current = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/agent-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ run_id: taskId }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data?.task) return;

        setTask(data.task);
        setStatus(data.task.status || 'executing');
        if (data.steps?.length > 0) setSteps(data.steps);
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
        console.error('[AgentExecution] Polling error:', err);
      }
    }, 2000);
  }, [stopPolling]);

  // Execute task
  const executeTask = useCallback(async (params: ExecuteTaskParams) => {
    setStatus('planning');
    setError(null);
    setTask(null);
    setSteps([]);
    setLogs([]);
    setOutputs([]);
    setThinking(null);
    setSandboxUrl(null);

    addTerminalLine(`Starting task: ${params.prompt.slice(0, 50)}...`, 'system');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Create task via Supabase function
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/agent-execute`, {
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
          attachments: params.attachments || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Extract task ID
      const taskId = data?.task?.id || data?.run_id || data?.taskId;
      if (!taskId) {
        throw new Error('No task ID returned');
      }

      taskIdRef.current = taskId;
      setTask(data.task || { id: taskId, status: 'planning', prompt: params.prompt });
      setStatus('executing');

      addTerminalLine(`Task created: ${taskId}`, 'system');

      // Connect to stream or start polling
      await new Promise(r => setTimeout(r, 500));
      
      if (useStreaming) {
        connectStream(taskId);
      } else {
        startPolling(taskId);
      }

      toast({
        title: 'Task started',
        description: 'Your request is being processed.',
      });

      return data?.task || { id: taskId };

    } catch (err: any) {
      console.error('[AgentExecution] Error:', err);
      setError(err.message || 'An error occurred');
      setStatus('failed');
      addTerminalLine(`Error: ${err.message}`, 'stderr');

      toast({
        title: 'Failed to start task',
        description: err.message,
        variant: 'destructive',
      });

      return null;
    }
  }, [addTerminalLine, connectStream, startPolling, toast, useStreaming]);

  // Create task (convenience wrapper)
  const createTask = useCallback(async (
    prompt: string,
    taskOptions: {
      taskType?: string;
      privacyTier?: string;
      memoryContext?: string;
      attachments?: Array<{ name: string; url: string; type: string }>;
    } = {}
  ) => {
    return executeTask({
      prompt,
      task_type: taskOptions.taskType || 'general',
      mode: taskOptions.taskType,
      memory_context: taskOptions.memoryContext,
      attachments: taskOptions.attachments,
    });
  }, [executeTask]);

  // Load existing task
  const loadTask = useCallback(async (taskId: string) => {
    if (!taskId) return;
    
    taskIdRef.current = taskId;
    setStatus('executing');
    addTerminalLine(`Loading task: ${taskId}`, 'system');
    
    if (useStreaming) {
      connectStream(taskId);
    } else {
      startPolling(taskId);
    }
  }, [addTerminalLine, connectStream, startPolling, useStreaming]);

  // Stop task
  const stopTask = useCallback(async () => {
    if (!taskIdRef.current) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'cancelled' })
        .eq('id', taskIdRef.current);
      
      setStatus('failed');
      stopPolling();
      disconnectStream();
      addTerminalLine('Task cancelled', 'system');
    } catch (err) {
      console.error('[AgentExecution] Stop error:', err);
    }
  }, [addTerminalLine, disconnectStream, stopPolling]);

  // Pause task
  const pauseTask = useCallback(async () => {
    if (!taskIdRef.current) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'paused' })
        .eq('id', taskIdRef.current);
      
      setStatus('paused');
      addTerminalLine('Task paused', 'system');
    } catch (err) {
      console.error('[AgentExecution] Pause error:', err);
    }
  }, [addTerminalLine]);

  // Resume task
  const resumeTask = useCallback(async () => {
    if (!taskIdRef.current) return;
    
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'executing' })
        .eq('id', taskIdRef.current);
      
      setStatus('executing');
      addTerminalLine('Task resumed', 'system');
      
      if (useStreaming) {
        connectStream(taskIdRef.current);
      } else {
        startPolling(taskIdRef.current);
      }
    } catch (err) {
      console.error('[AgentExecution] Resume error:', err);
    }
  }, [addTerminalLine, connectStream, startPolling, useStreaming]);

  // Reset
  const reset = useCallback(() => {
    stopPolling();
    disconnectStream();
    setTask(null);
    setSteps([]);
    setLogs([]);
    setOutputs([]);
    setStatus('idle');
    setError(null);
    setThinking(null);
    setSandboxUrl(null);
    taskIdRef.current = null;
  }, [disconnectStream, stopPolling]);

  // Download output
  const downloadOutput = useCallback(async (output: TaskOutput) => {
    if (output.download_url) {
      window.open(output.download_url, '_blank');
    }
  }, []);

  return {
    // State
    task,
    steps,
    logs,
    outputs,
    status,
    error,
    thinking,
    sandboxUrl,
    
    // Derived state
    isIdle,
    isExecuting,
    isPlanning,
    isCompleted,
    isFailed,
    
    // Actions
    executeTask,
    createTask,
    loadTask,
    stopTask,
    pauseTask,
    resumeTask,
    downloadOutput,
    reset,
  };
}

export default useAgentExecutionV2;
