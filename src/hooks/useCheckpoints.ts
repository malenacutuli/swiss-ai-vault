import { useState, useCallback, useEffect, useRef } from 'react';
import { checkpointManager, type Checkpoint, type CheckpointSummary, type CheckpointState } from '@/lib/agents/checkpoints';
import { toast } from 'sonner';

interface UseCheckpointsOptions {
  taskId?: string;
  autoCheckpoint?: boolean;
  checkpointInterval?: number; // ms, default 5 minutes
}

interface UseCheckpointsReturn {
  checkpoints: CheckpointSummary[];
  isLoading: boolean;
  isCreating: boolean;
  selectedCheckpoint: Checkpoint | null;
  
  // Actions
  createCheckpoint: (state: CheckpointState, reason?: string) => Promise<Checkpoint | null>;
  loadCheckpoint: (checkpointId: string) => Promise<Checkpoint | null>;
  deleteCheckpoint: (checkpointId: string) => Promise<boolean>;
  refreshCheckpoints: () => Promise<void>;
  
  // Auto-checkpoint control
  startAutoCheckpoint: (getState: () => CheckpointState) => void;
  stopAutoCheckpoint: () => void;
  
  // Special checkpoints
  checkpointBeforeDangerous: (state: CheckpointState, operationName: string) => Promise<Checkpoint | null>;
  checkpointOnPhaseComplete: (state: CheckpointState, phaseName: string) => Promise<Checkpoint | null>;
  checkpointOnPause: (state: CheckpointState) => Promise<Checkpoint | null>;
  checkpointOnCompletion: (state: CheckpointState, tokens: number, duration: number) => Promise<Checkpoint | null>;
}

export function useCheckpoints(options: UseCheckpointsOptions = {}): UseCheckpointsReturn {
  const { taskId, autoCheckpoint = false, checkpointInterval = 5 * 60 * 1000 } = options;
  
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  
  const autoCheckpointStarted = useRef(false);

  // Load checkpoints on mount and when taskId changes
  const refreshCheckpoints = useCallback(async () => {
    if (!taskId) {
      setCheckpoints([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const list = await checkpointManager.listCheckpoints(taskId);
      setCheckpoints(list);
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refreshCheckpoints();
  }, [refreshCheckpoints]);

  // Cleanup auto-checkpoint on unmount
  useEffect(() => {
    return () => {
      checkpointManager.stopAutoCheckpoint();
    };
  }, []);

  const createCheckpoint = useCallback(async (
    state: CheckpointState,
    reason?: string
  ): Promise<Checkpoint | null> => {
    if (!taskId) return null;
    
    setIsCreating(true);
    try {
      const checkpoint = await checkpointManager.createCheckpoint(taskId, state, 'auto', {
        checkpointReason: reason ?? 'Manual checkpoint',
      });
      
      if (checkpoint) {
        await refreshCheckpoints();
        toast.success('Checkpoint created');
      }
      
      return checkpoint;
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      toast.error('Failed to create checkpoint');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [taskId, refreshCheckpoints]);

  const loadCheckpoint = useCallback(async (checkpointId: string): Promise<Checkpoint | null> => {
    setIsLoading(true);
    try {
      const checkpoint = await checkpointManager.loadCheckpoint(checkpointId);
      setSelectedCheckpoint(checkpoint);
      return checkpoint;
    } catch (error) {
      console.error('Failed to load checkpoint:', error);
      toast.error('Failed to load checkpoint');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCheckpoint = useCallback(async (checkpointId: string): Promise<boolean> => {
    try {
      const success = await checkpointManager.deleteCheckpoint(checkpointId);
      if (success) {
        await refreshCheckpoints();
        toast.success('Checkpoint deleted');
      }
      return success;
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
      toast.error('Failed to delete checkpoint');
      return false;
    }
  }, [refreshCheckpoints]);

  const startAutoCheckpoint = useCallback((getState: () => CheckpointState) => {
    if (!taskId || autoCheckpointStarted.current) return;
    
    autoCheckpointStarted.current = true;
    checkpointManager.startAutoCheckpoint(taskId, getState, checkpointInterval);
  }, [taskId, checkpointInterval]);

  const stopAutoCheckpoint = useCallback(() => {
    autoCheckpointStarted.current = false;
    checkpointManager.stopAutoCheckpoint();
  }, []);

  const checkpointBeforeDangerous = useCallback(async (
    state: CheckpointState,
    operationName: string
  ): Promise<Checkpoint | null> => {
    if (!taskId) return null;
    
    const checkpoint = await checkpointManager.checkpointBeforeDangerous(taskId, state, operationName);
    if (checkpoint) {
      await refreshCheckpoints();
    }
    return checkpoint;
  }, [taskId, refreshCheckpoints]);

  const checkpointOnPhaseComplete = useCallback(async (
    state: CheckpointState,
    phaseName: string
  ): Promise<Checkpoint | null> => {
    if (!taskId) return null;
    
    const checkpoint = await checkpointManager.checkpointOnPhaseComplete(taskId, state, phaseName);
    if (checkpoint) {
      await refreshCheckpoints();
    }
    return checkpoint;
  }, [taskId, refreshCheckpoints]);

  const checkpointOnPause = useCallback(async (
    state: CheckpointState
  ): Promise<Checkpoint | null> => {
    if (!taskId) return null;
    
    const checkpoint = await checkpointManager.checkpointOnPause(taskId, state);
    if (checkpoint) {
      await refreshCheckpoints();
      toast.success('Checkpoint saved');
    }
    return checkpoint;
  }, [taskId, refreshCheckpoints]);

  const checkpointOnCompletion = useCallback(async (
    state: CheckpointState,
    tokens: number,
    duration: number
  ): Promise<Checkpoint | null> => {
    if (!taskId) return null;
    
    const checkpoint = await checkpointManager.checkpointOnCompletion(taskId, state, tokens, duration);
    if (checkpoint) {
      await refreshCheckpoints();
    }
    return checkpoint;
  }, [taskId, refreshCheckpoints]);

  return {
    checkpoints,
    isLoading,
    isCreating,
    selectedCheckpoint,
    createCheckpoint,
    loadCheckpoint,
    deleteCheckpoint,
    refreshCheckpoints,
    startAutoCheckpoint,
    stopAutoCheckpoint,
    checkpointBeforeDangerous,
    checkpointOnPhaseComplete,
    checkpointOnPause,
    checkpointOnCompletion,
  };
}
