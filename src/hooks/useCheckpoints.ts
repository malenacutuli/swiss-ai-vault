import { useState, useCallback, useEffect, useRef } from 'react';
import { checkpointManager, type Checkpoint, type CheckpointSummary, type CheckpointState } from '@/lib/agents/checkpoints';
import { agentsDevSupabase } from '@/integrations/supabase/agents-client-dev';
import { toast } from 'sonner';

// Server-side checkpoint types (from checkpoint_history table)
export interface ServerCheckpoint {
  id: string;
  version: number;
  step_number: number;
  checkpoint_type: 'manual' | 'auto' | 'pre_tool' | 'post_step';
  tokens_used: number;
  execution_time_ms: number;
  description?: string;
  is_valid: boolean;
  created_at: string;
}

export interface CheckpointRestoreResult {
  success: boolean;
  restored_version?: number;
  restored_step?: number;
  state_snapshot?: Record<string, unknown>;
  context_snapshot?: Record<string, unknown>;
  messages_snapshot?: unknown[];
  error?: string;
}

interface UseCheckpointsOptions {
  taskId?: string;
  runId?: string; // For server-side checkpoints
  autoCheckpoint?: boolean;
  checkpointInterval?: number; // ms, default 5 minutes
}

interface UseCheckpointsReturn {
  checkpoints: CheckpointSummary[];
  serverCheckpoints: ServerCheckpoint[];
  isLoading: boolean;
  isCreating: boolean;
  selectedCheckpoint: Checkpoint | null;

  // Local checkpoint actions
  createCheckpoint: (state: CheckpointState, reason?: string) => Promise<Checkpoint | null>;
  loadCheckpoint: (checkpointId: string) => Promise<Checkpoint | null>;
  deleteCheckpoint: (checkpointId: string) => Promise<boolean>;
  refreshCheckpoints: () => Promise<void>;

  // Server-side checkpoint actions (run-service)
  createServerCheckpoint: (stepNumber: number, stateSnapshot: Record<string, unknown>, options?: {
    type?: 'manual' | 'auto' | 'pre_tool' | 'post_step';
    context?: Record<string, unknown>;
    messages?: unknown[];
    description?: string;
  }) => Promise<{ success: boolean; checkpoint_id?: string; version?: number; error?: string }>;
  listServerCheckpoints: () => Promise<void>;
  restoreFromCheckpoint: (version?: number) => Promise<CheckpointRestoreResult>;
  configureAutoCheckpoint: (enabled: boolean, interval?: number) => Promise<boolean>;

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
  const { taskId, runId, autoCheckpoint = false, checkpointInterval = 5 * 60 * 1000 } = options;

  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [serverCheckpoints, setServerCheckpoints] = useState<ServerCheckpoint[]>([]);
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

  // ========== Server-Side Checkpoint Functions (run-service) ==========

  // Create a versioned server-side checkpoint
  const createServerCheckpoint = useCallback(async (
    stepNumber: number,
    stateSnapshot: Record<string, unknown>,
    options?: {
      type?: 'manual' | 'auto' | 'pre_tool' | 'post_step';
      context?: Record<string, unknown>;
      messages?: unknown[];
      description?: string;
    }
  ): Promise<{ success: boolean; checkpoint_id?: string; version?: number; error?: string }> => {
    if (!runId) {
      return { success: false, error: 'No run ID provided' };
    }

    setIsCreating(true);
    try {
      const { data, error } = await agentsDevSupabase.functions.invoke('run-service', {
        body: {
          action: 'checkpoint',
          run_id: runId,
          checkpoint_step: stepNumber,
          checkpoint_data: stateSnapshot,
          checkpoint_type: options?.type || 'manual',
          context_snapshot: options?.context,
          messages_snapshot: options?.messages,
          checkpoint_description: options?.description,
        },
      });

      if (error) {
        console.error('Failed to create server checkpoint:', error);
        toast.error('Failed to create checkpoint');
        return { success: false, error: error.message };
      }

      if (data?.success) {
        toast.success(`Checkpoint v${data.version} created`);
        await listServerCheckpoints();
        return {
          success: true,
          checkpoint_id: data.checkpoint_id,
          version: data.version,
        };
      }

      return { success: false, error: data?.error || 'Unknown error' };
    } catch (err) {
      console.error('Error creating server checkpoint:', err);
      return { success: false, error: String(err) };
    } finally {
      setIsCreating(false);
    }
  }, [runId]);

  // List server-side checkpoints for a run
  const listServerCheckpoints = useCallback(async () => {
    if (!runId) {
      setServerCheckpoints([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await agentsDevSupabase.functions.invoke('run-service', {
        body: {
          action: 'list_checkpoints',
          run_id: runId,
        },
      });

      if (error) {
        console.error('Failed to list server checkpoints:', error);
        return;
      }

      if (data?.success && Array.isArray(data.checkpoints)) {
        setServerCheckpoints(data.checkpoints);
      }
    } catch (err) {
      console.error('Error listing server checkpoints:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Restore from a specific checkpoint version
  const restoreFromCheckpoint = useCallback(async (
    version?: number
  ): Promise<CheckpointRestoreResult> => {
    if (!runId) {
      return { success: false, error: 'No run ID provided' };
    }

    setIsLoading(true);
    try {
      const { data, error } = await agentsDevSupabase.functions.invoke('run-service', {
        body: {
          action: 'restore_checkpoint',
          run_id: runId,
          checkpoint_version: version, // null = latest valid checkpoint
        },
      });

      if (error) {
        console.error('Failed to restore checkpoint:', error);
        toast.error('Failed to restore checkpoint');
        return { success: false, error: error.message };
      }

      if (data?.success) {
        toast.success(`Restored to checkpoint v${data.restored_version}`);
        return {
          success: true,
          restored_version: data.restored_version,
          restored_step: data.restored_step,
          state_snapshot: data.state_snapshot,
          context_snapshot: data.context_snapshot,
          messages_snapshot: data.messages_snapshot,
        };
      }

      return { success: false, error: data?.error || 'Unknown error' };
    } catch (err) {
      console.error('Error restoring checkpoint:', err);
      return { success: false, error: String(err) };
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Configure auto-checkpoint settings
  const configureAutoCheckpoint = useCallback(async (
    enabled: boolean,
    interval?: number
  ): Promise<boolean> => {
    if (!runId) {
      return false;
    }

    try {
      const { data, error } = await agentsDevSupabase.functions.invoke('run-service', {
        body: {
          action: 'configure_auto_checkpoint',
          run_id: runId,
          auto_checkpoint_enabled: enabled,
          auto_checkpoint_interval: interval,
        },
      });

      if (error) {
        console.error('Failed to configure auto-checkpoint:', error);
        toast.error('Failed to configure auto-checkpoint');
        return false;
      }

      if (data?.success) {
        toast.success(`Auto-checkpoint ${enabled ? 'enabled' : 'disabled'}`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error configuring auto-checkpoint:', err);
      return false;
    }
  }, [runId]);

  // Load server checkpoints when runId changes
  useEffect(() => {
    if (runId) {
      listServerCheckpoints();
    }
  }, [runId, listServerCheckpoints]);

  return {
    checkpoints,
    serverCheckpoints,
    isLoading,
    isCreating,
    selectedCheckpoint,
    // Local checkpoint actions
    createCheckpoint,
    loadCheckpoint,
    deleteCheckpoint,
    refreshCheckpoints,
    // Server-side checkpoint actions
    createServerCheckpoint,
    listServerCheckpoints,
    restoreFromCheckpoint,
    configureAutoCheckpoint,
    // Auto-checkpoint control
    startAutoCheckpoint,
    stopAutoCheckpoint,
    // Special checkpoints
    checkpointBeforeDangerous,
    checkpointOnPhaseComplete,
    checkpointOnPause,
    checkpointOnCompletion,
  };
}
