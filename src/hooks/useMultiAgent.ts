/**
 * useMultiAgent Hook - React hook for multi-agent task coordination
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Orchestrator,
  createOrchestrator,
  SharedStateManager,
  createSharedState,
  SharedState,
  TaskPlan,
  Phase,
  AgentStatus,
} from '@/lib/agents/multiagent';

interface UseMultiAgentOptions {
  taskId: string;
  userId: string;
  objective?: string;
  autoStart?: boolean;
}

interface UseMultiAgentReturn {
  // State
  isInitialized: boolean;
  isRunning: boolean;
  status: SharedState['status'] | null;
  progress: number;
  progressMessage: string;
  plan: TaskPlan | null;
  phases: Phase[];
  currentPhase: number;
  agents: Record<string, AgentStatus>;
  error: SharedState['error'] | null;

  // Actions
  initialize: () => Promise<void>;
  createPlan: (objective: string) => Promise<TaskPlan>;
  execute: (plan?: TaskPlan) => Promise<void>;
  cancel: () => Promise<void>;
  shutdown: () => Promise<void>;
}

export function useMultiAgent({
  taskId,
  userId,
  objective,
  autoStart = false,
}: UseMultiAgentOptions): UseMultiAgentReturn {
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const stateManagerRef = useRef<SharedStateManager | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<SharedState['status'] | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});
  const [error, setError] = useState<SharedState['error'] | null>(null);

  // Initialize orchestrator and state manager
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      // Create state manager for watching changes
      stateManagerRef.current = createSharedState(taskId, userId);
      await stateManagerRef.current.initialize();

      // Create orchestrator
      orchestratorRef.current = createOrchestrator({
        taskId,
        userId,
        objective: objective || '',
      });

      // Set up progress callback
      orchestratorRef.current.onProgress((prog, msg) => {
        setProgress(prog);
        setProgressMessage(msg);
      });

      await orchestratorRef.current.initialize();

      // Watch for state changes
      stateManagerRef.current.onStateChange((path, value) => {
        if (path === 'status') {
          setStatus(value as SharedState['status']);
          setIsRunning(value === 'executing');
        } else if (path.startsWith('plan.')) {
          const fullPlan = stateManagerRef.current?.get<SharedState['plan']>('plan');
          if (fullPlan) {
            fullPlan.then((p) => {
              if (p) {
                setPhases(p.phases);
                setCurrentPhase(p.currentPhase);
              }
            });
          }
        } else if (path.startsWith('agents.')) {
          const allAgents = stateManagerRef.current?.get<Record<string, AgentStatus>>('agents');
          if (allAgents) {
            allAgents.then((a) => a && setAgents(a));
          }
        } else if (path === 'error') {
          setError(value as SharedState['error']);
        }
      });

      setIsInitialized(true);

      // Auto-start if configured
      if (autoStart && objective) {
        const taskPlan = await orchestratorRef.current.createPlan(objective);
        setPlan(taskPlan);
        await orchestratorRef.current.execute(taskPlan);
      }
    } catch (err) {
      console.error('[useMultiAgent] Initialization failed:', err);
      setError({
        message: err instanceof Error ? err.message : 'Initialization failed',
        code: 'INIT_ERROR',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });
    }
  }, [taskId, userId, objective, autoStart, isInitialized]);

  // Create a task plan
  const createPlan = useCallback(async (obj: string): Promise<TaskPlan> => {
    if (!orchestratorRef.current) {
      throw new Error('Orchestrator not initialized');
    }

    const taskPlan = await orchestratorRef.current.createPlan(obj);
    setPlan(taskPlan);
    setPhases(taskPlan.phases);
    return taskPlan;
  }, []);

  // Execute the plan
  const execute = useCallback(async (taskPlan?: TaskPlan): Promise<void> => {
    if (!orchestratorRef.current) {
      throw new Error('Orchestrator not initialized');
    }

    setIsRunning(true);
    setProgress(0);
    setError(null);

    try {
      await orchestratorRef.current.execute(taskPlan || plan || undefined);
    } catch (err) {
      console.error('[useMultiAgent] Execution failed:', err);
      setError({
        message: err instanceof Error ? err.message : 'Execution failed',
        code: 'EXEC_ERROR',
        recoverable: false,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsRunning(false);
    }
  }, [plan]);

  // Cancel execution
  const cancel = useCallback(async (): Promise<void> => {
    if (orchestratorRef.current) {
      await orchestratorRef.current.cancel();
      setIsRunning(false);
    }
  }, []);

  // Shutdown
  const shutdown = useCallback(async (): Promise<void> => {
    if (orchestratorRef.current) {
      await orchestratorRef.current.shutdown();
      orchestratorRef.current = null;
    }
    if (stateManagerRef.current) {
      await stateManagerRef.current.shutdown();
      stateManagerRef.current = null;
    }
    setIsInitialized(false);
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shutdown();
    };
  }, [shutdown]);

  return {
    // State
    isInitialized,
    isRunning,
    status,
    progress,
    progressMessage,
    plan,
    phases,
    currentPhase,
    agents,
    error,

    // Actions
    initialize,
    createPlan,
    execute,
    cancel,
    shutdown,
  };
}
