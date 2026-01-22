/**
 * Manus-Parity React Hooks
 * 
 * Custom hooks for integrating the agent orchestrator with React components.
 * Provides real-time state management and event handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Task,
  TaskStatus,
  AgentState,
  AgentEvent,
  TaskPlan,
  Phase,
  CreateTaskRequest,
} from './types';
import { ManusApiClient, getApiClient } from './api-client';
import { AgentOrchestrator, createOrchestrator } from './orchestrator';

// =============================================================================
// useAgentTask Hook
// =============================================================================

export interface UseAgentTaskOptions {
  onEvent?: (event: AgentEvent) => void;
  autoConnect?: boolean;
}

export interface UseAgentTaskReturn {
  task: Task | null;
  status: TaskStatus | null;
  state: AgentState;
  plan: TaskPlan | null;
  currentPhase: Phase | null;
  events: AgentEvent[];
  isLoading: boolean;
  error: Error | null;
  createTask: (request: CreateTaskRequest) => Promise<string>;
  cancelTask: () => Promise<void>;
  refreshTask: () => Promise<void>;
}

export function useAgentTask(
  taskId: string | null,
  options: UseAgentTaskOptions = {}
): UseAgentTaskReturn {
  const { onEvent, autoConnect = true } = options;
  
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const apiClient = useRef<ManusApiClient>(getApiClient());
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  // Event handler
  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [...prev, event]);
    
    // Update task state based on event
    if (event.event === 'task.completed') {
      setTask(prev => prev ? { ...prev, status: 'completed' } : null);
    } else if (event.event === 'task.failed') {
      setTask(prev => prev ? { ...prev, status: 'failed' } : null);
    } else if (event.event === 'plan.updated') {
      setTask(prev => prev ? { ...prev, plan: event.data.plan as TaskPlan } : null);
    }
    
    onEvent?.(event);
  }, [onEvent]);

  // Initialize orchestrator when taskId changes
  useEffect(() => {
    if (taskId) {
      orchestratorRef.current = createOrchestrator({
        taskId,
        userId: 'current-user', // Would come from auth context
        onEvent: handleEvent,
      });
    }
    
    return () => {
      orchestratorRef.current = null;
    };
  }, [taskId, handleEvent]);

  // Connect to event stream
  useEffect(() => {
    if (taskId && autoConnect) {
      apiClient.current.connectToStream(taskId);
    }
    
    return () => {
      apiClient.current.disconnectFromStream();
    };
  }, [taskId, autoConnect]);

  // Fetch task data
  const refreshTask = useCallback(async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedTask = await apiClient.current.getTask(taskId);
      setTask(fetchedTask);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch task'));
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    if (taskId) {
      refreshTask();
    }
  }, [taskId, refreshTask]);

  // Create task
  const createTask = useCallback(async (request: CreateTaskRequest): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.current.createTask(request);
      return response.taskId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create task');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel task
  const cancelTask = useCallback(async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await apiClient.current.cancelTask(taskId);
      setTask(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to cancel task'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  return {
    task,
    status: task?.status || null,
    state: orchestratorRef.current?.getState() || 'IDLE',
    plan: task?.plan || null,
    currentPhase: orchestratorRef.current?.getCurrentPhase() || null,
    events,
    isLoading,
    error,
    createTask,
    cancelTask,
    refreshTask,
  };
}

// =============================================================================
// useAgentStream Hook
// =============================================================================

export interface UseAgentStreamReturn {
  events: AgentEvent[];
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export function useAgentStream(
  taskId: string | null,
  onEvent?: (event: AgentEvent) => void
): UseAgentStreamReturn {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const apiClient = useRef<ManusApiClient>(getApiClient());
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [...prev, event]);
    onEvent?.(event);
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!taskId) return;
    
    try {
      const url = `/api/agent/run/${taskId}/stream`;
      eventSourceRef.current = new EventSource(url);
      
      eventSourceRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AgentEvent;
          handleEvent(data);
        } catch (err) {
          console.error('Failed to parse event:', err);
        }
      };
      
      eventSourceRef.current.onerror = () => {
        setIsConnected(false);
        setError(new Error('Connection lost'));
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [taskId, handleEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-connect when taskId changes
  useEffect(() => {
    if (taskId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [taskId, connect, disconnect]);

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    clearEvents,
  };
}

// =============================================================================
// useTaskList Hook
// =============================================================================

export interface UseTaskListOptions {
  status?: TaskStatus;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseTaskListReturn {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useTaskList(options: UseTaskListOptions = {}): UseTaskListReturn {
  const { status, limit = 20, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const apiClient = useRef<ManusApiClient>(getApiClient());

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedTasks = await apiClient.current.listTasks({ status, limit, offset: 0 });
      setTasks(fetchedTasks);
      setOffset(fetchedTasks.length);
      setHasMore(fetchedTasks.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
    } finally {
      setIsLoading(false);
    }
  }, [status, limit]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const fetchedTasks = await apiClient.current.listTasks({ status, limit, offset });
      setTasks(prev => [...prev, ...fetchedTasks]);
      setOffset(prev => prev + fetchedTasks.length);
      setHasMore(fetchedTasks.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more tasks'));
    } finally {
      setIsLoading(false);
    }
  }, [status, limit, offset, hasMore, isLoading]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    tasks,
    isLoading,
    error,
    refresh,
    hasMore,
    loadMore,
  };
}

// =============================================================================
// useAgentHealth Hook
// =============================================================================

export interface UseAgentHealthReturn {
  isHealthy: boolean;
  status: Record<string, unknown> | null;
  isLoading: boolean;
  error: Error | null;
  checkHealth: () => Promise<void>;
}

export function useAgentHealth(autoCheck: boolean = true): UseAgentHealthReturn {
  const [isHealthy, setIsHealthy] = useState(false);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const apiClient = useRef<ManusApiClient>(getApiClient());

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [healthResult, statusResult] = await Promise.all([
        apiClient.current.checkHealth(),
        apiClient.current.getStatus(),
      ]);
      
      setIsHealthy(healthResult.status === 'healthy');
      setStatus(statusResult);
    } catch (err) {
      setIsHealthy(false);
      setError(err instanceof Error ? err : new Error('Health check failed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoCheck) {
      checkHealth();
    }
  }, [autoCheck, checkHealth]);

  return {
    isHealthy,
    status,
    isLoading,
    error,
    checkHealth,
  };
}
