/**
 * useAgent Hook
 * Main hook for agent task management with SSE streaming
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Task,
  TaskState,
  ExecutionPlan,
  SSEEvent,
  CreateTaskResponse,
} from '../types/agent';

// ===========================================
// TYPES
// ===========================================

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'info' | 'ask' | 'result';
  attachments?: string[];
}

export interface AgentStep {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface UseAgentState {
  taskId: string | null;
  state: TaskState;
  plan: ExecutionPlan | null;
  currentPhaseId: number;
  messages: AgentMessage[];
  steps: AgentStep[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  thinkingContent: string | null;
}

export interface UseAgentActions {
  createTask: (prompt: string, attachments?: string[]) => Promise<void>;
  cancelTask: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  reset: () => void;
}

export type UseAgentReturn = UseAgentState & UseAgentActions;

// ===========================================
// HOOK IMPLEMENTATION
// ===========================================

const API_BASE = '/api/agent';

export function useAgent(): UseAgentReturn {
  // State
  const [taskId, setTaskId] = useState<string | null>(null);
  const [state, setState] = useState<TaskState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [currentPhaseId, setCurrentPhaseId] = useState(0);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, []);

  // ===========================================
  // SSE EVENT HANDLERS
  // ===========================================

  const handleSSEEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const eventType = event.type || data.type;

      switch (eventType) {
        case 'task_started':
          setState('planning');
          break;

        case 'plan_created':
          setPlan(data.plan);
          setState('executing');
          if (data.plan.phases?.length > 0) {
            setCurrentPhaseId(data.plan.phases[0].id);
          }
          break;

        case 'phase_started':
          setCurrentPhaseId(data.phaseId);
          break;

        case 'phase_completed':
          // Update plan phase status
          setPlan(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              phases: prev.phases.map(p =>
                p.id === data.phaseId ? { ...p, status: 'completed' } : p
              ),
            };
          });
          break;

        case 'tool_started':
          setSteps(prev => [
            ...prev,
            {
              id: `step-${Date.now()}`,
              toolName: data.toolName,
              toolInput: data.toolInput,
              status: 'running',
              startedAt: new Date().toISOString(),
            },
          ]);
          setThinkingContent(null);
          break;

        case 'tool_output':
          // Update last step with output
          setSteps(prev => {
            const updated = [...prev];
            const lastStep = updated[updated.length - 1];
            if (lastStep) {
              lastStep.output = (lastStep.output || '') + data.output;
            }
            return updated;
          });
          break;

        case 'tool_completed':
          setSteps(prev => {
            const updated = [...prev];
            const lastStep = updated[updated.length - 1];
            if (lastStep) {
              lastStep.status = data.success ? 'completed' : 'failed';
              lastStep.completedAt = new Date().toISOString();
              if (!data.success) {
                lastStep.error = data.error;
              }
            }
            return updated;
          });
          break;

        case 'message':
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: data.role,
              content: data.content,
              timestamp: new Date().toISOString(),
              type: data.messageType,
              attachments: data.attachments,
            },
          ]);
          break;

        case 'thinking':
          setThinkingContent(data.content);
          break;

        case 'task_completed':
          setState('completed');
          setIsStreaming(false);
          break;

        case 'task_failed':
          setState('failed');
          setError(data.error);
          setIsStreaming(false);
          break;

        case 'stream_end':
          setIsStreaming(false);
          break;
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  }, []);

  // ===========================================
  // ACTIONS
  // ===========================================

  const createTask = useCallback(async (prompt: string, attachments?: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create task via API
      const response = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, attachments }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task');
      }

      const data: CreateTaskResponse = await response.json();
      setTaskId(data.taskId);

      // Add user message
      setMessages([{
        id: `msg-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      }]);

      // Connect to SSE stream
      setIsStreaming(true);
      const eventSource = new EventSource(`${API_BASE}/${data.taskId}/stream`);
      eventSourceRef.current = eventSource;

      // Set up event listeners
      eventSource.onmessage = handleSSEEvent;

      // Listen for specific event types
      const eventTypes = [
        'task_started',
        'plan_created',
        'phase_started',
        'phase_completed',
        'tool_started',
        'tool_output',
        'tool_completed',
        'message',
        'thinking',
        'task_completed',
        'task_failed',
        'stream_end',
      ];

      eventTypes.forEach(type => {
        eventSource.addEventListener(type, handleSSEEvent);
      });

      eventSource.onerror = (e) => {
        console.error('SSE error:', e);
        setIsStreaming(false);
        eventSource.close();
      };

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setState('failed');
    } finally {
      setIsLoading(false);
    }
  }, [handleSSEEvent]);

  const cancelTask = useCallback(async () => {
    if (!taskId) return;

    try {
      eventSourceRef.current?.close();
      abortControllerRef.current?.abort();

      await fetch(`${API_BASE}/${taskId}/cancel`, {
        method: 'POST',
      });

      setState('cancelled');
      setIsStreaming(false);
    } catch (e) {
      console.error('Error cancelling task:', e);
    }
  }, [taskId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!taskId || state !== 'waiting_user') return;

    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Resume task with user input
    // This would need a resume endpoint
  }, [taskId, state]);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    abortControllerRef.current?.abort();

    setTaskId(null);
    setState('idle');
    setPlan(null);
    setCurrentPhaseId(0);
    setMessages([]);
    setSteps([]);
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
    setThinkingContent(null);
  }, []);

  return {
    // State
    taskId,
    state,
    plan,
    currentPhaseId,
    messages,
    steps,
    isLoading,
    isStreaming,
    error,
    thinkingContent,
    // Actions
    createTask,
    cancelTask,
    sendMessage,
    reset,
  };
}

export default useAgent;
