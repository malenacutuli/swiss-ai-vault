import { supabase } from '@/integrations/supabase/client';
import type { 
  Checkpoint, 
  CheckpointState, 
  CheckpointType, 
  CheckpointMetadata,
  CheckpointSummary 
} from './types';

const DEFAULT_KEEP_COUNT = 5;
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class CheckpointManager {
  private autoCheckpointInterval: NodeJS.Timeout | null = null;
  private lastCheckpointTime: number = 0;

  /**
   * Create a new checkpoint for a task
   */
  async createCheckpoint(
    taskId: string,
    state: CheckpointState,
    type: CheckpointType = 'auto',
    metadata?: Partial<CheckpointMetadata>
  ): Promise<Checkpoint | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user for checkpoint creation');
      return null;
    }

    const checkpointMetadata: CheckpointMetadata = {
      phaseCompleted: state.plan.currentPhase,
      tasksCompleted: state.plan.completedTasks,
      tokensUsed: metadata?.tokensUsed ?? 0,
      duration: metadata?.duration ?? 0,
      checkpointReason: metadata?.checkpointReason,
    };

    // Set expiration based on type (completion checkpoints never expire)
    const expiresAt = type === 'completion' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const insertData = {
      task_id: taskId,
      user_id: user.id,
      checkpoint_type: type,
      state: state as unknown as Record<string, unknown>,
      metadata: checkpointMetadata as unknown as Record<string, unknown>,
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabase
      .from('agent_checkpoints')
      .insert(insertData as never)
      .select()
      .single();

    if (error) {
      console.error('Failed to create checkpoint:', error);
      return null;
    }

    this.lastCheckpointTime = Date.now();

    // Cleanup old checkpoints after creating new one
    await this.deleteOldCheckpoints(taskId, DEFAULT_KEEP_COUNT);

    return this.mapToCheckpoint(data);
  }

  /**
   * Load a specific checkpoint by ID
   */
  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const { data, error } = await supabase
      .from('agent_checkpoints')
      .select('*')
      .eq('id', checkpointId)
      .single();

    if (error || !data) {
      console.error('Failed to load checkpoint:', error);
      return null;
    }

    return this.mapToCheckpoint(data);
  }

  /**
   * List all checkpoints for a task
   */
  async listCheckpoints(taskId: string): Promise<CheckpointSummary[]> {
    const { data, error } = await supabase
      .from('agent_checkpoints')
      .select('id, task_id, checkpoint_type, metadata, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Failed to list checkpoints:', error);
      return [];
    }

    return data.map(row => ({
      id: row.id,
      taskId: row.task_id,
      type: row.checkpoint_type as CheckpointType,
      phaseCompleted: (row.metadata as Record<string, unknown>)?.phaseCompleted as number ?? 0,
      tasksCompleted: (row.metadata as Record<string, unknown>)?.tasksCompleted as number ?? 0,
      createdAt: new Date(row.created_at!),
    }));
  }

  /**
   * Get the latest checkpoint for a task
   */
  async getLatestCheckpoint(taskId: string): Promise<Checkpoint | null> {
    const { data, error } = await supabase
      .from('agent_checkpoints')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToCheckpoint(data);
  }

  /**
   * Delete old checkpoints, keeping the most recent ones
   */
  async deleteOldCheckpoints(taskId: string, keepCount: number = DEFAULT_KEEP_COUNT): Promise<void> {
    // Get all checkpoints except completion type
    const { data: checkpoints } = await supabase
      .from('agent_checkpoints')
      .select('id, created_at')
      .eq('task_id', taskId)
      .neq('checkpoint_type', 'completion')
      .order('created_at', { ascending: false });

    if (!checkpoints || checkpoints.length <= keepCount) {
      return;
    }

    // Delete checkpoints beyond keepCount
    const toDelete = checkpoints.slice(keepCount).map(c => c.id);
    
    await supabase
      .from('agent_checkpoints')
      .delete()
      .in('id', toDelete);
  }

  /**
   * Delete a specific checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const { error } = await supabase
      .from('agent_checkpoints')
      .delete()
      .eq('id', checkpointId);

    return !error;
  }

  /**
   * Start auto-checkpoint timer
   */
  startAutoCheckpoint(
    taskId: string,
    getState: () => CheckpointState,
    intervalMs: number = CHECKPOINT_INTERVAL_MS
  ): void {
    this.stopAutoCheckpoint();
    
    this.autoCheckpointInterval = setInterval(async () => {
      const state = getState();
      await this.createCheckpoint(taskId, state, 'auto', {
        checkpointReason: 'Auto-checkpoint (5 min interval)',
      });
    }, intervalMs);
  }

  /**
   * Stop auto-checkpoint timer
   */
  stopAutoCheckpoint(): void {
    if (this.autoCheckpointInterval) {
      clearInterval(this.autoCheckpointInterval);
      this.autoCheckpointInterval = null;
    }
  }

  /**
   * Check if enough time has passed for a new checkpoint
   */
  shouldCheckpoint(minIntervalMs: number = 60000): boolean {
    return Date.now() - this.lastCheckpointTime >= minIntervalMs;
  }

  /**
   * Create checkpoint before dangerous operation
   */
  async checkpointBeforeDangerous(
    taskId: string,
    state: CheckpointState,
    operationName: string
  ): Promise<Checkpoint | null> {
    return this.createCheckpoint(taskId, state, 'pre_dangerous', {
      checkpointReason: `Before dangerous operation: ${operationName}`,
    });
  }

  /**
   * Create checkpoint on phase completion
   */
  async checkpointOnPhaseComplete(
    taskId: string,
    state: CheckpointState,
    phaseName: string
  ): Promise<Checkpoint | null> {
    return this.createCheckpoint(taskId, state, 'phase_complete', {
      checkpointReason: `Phase completed: ${phaseName}`,
    });
  }

  /**
   * Create checkpoint on user pause
   */
  async checkpointOnPause(
    taskId: string,
    state: CheckpointState
  ): Promise<Checkpoint | null> {
    return this.createCheckpoint(taskId, state, 'user_pause', {
      checkpointReason: 'User requested pause',
    });
  }

  /**
   * Create final completion checkpoint
   */
  async checkpointOnCompletion(
    taskId: string,
    state: CheckpointState,
    totalTokens: number,
    totalDuration: number
  ): Promise<Checkpoint | null> {
    return this.createCheckpoint(taskId, state, 'completion', {
      tokensUsed: totalTokens,
      duration: totalDuration,
      checkpointReason: 'Task completed successfully',
    });
  }

  private mapToCheckpoint(row: Record<string, unknown>): Checkpoint {
    const metadata = row.metadata as Record<string, unknown> ?? {};
    const state = row.state as Record<string, unknown>;
    
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      userId: row.user_id as string,
      type: row.checkpoint_type as CheckpointType,
      state: {
        plan: state.plan as Checkpoint['state']['plan'],
        files: (state.files ?? []) as Checkpoint['state']['files'],
        context: state.context as Checkpoint['state']['context'],
        toolHistory: (state.toolHistory ?? []) as Checkpoint['state']['toolHistory'],
      },
      metadata: {
        phaseCompleted: metadata.phaseCompleted as number ?? 0,
        tasksCompleted: metadata.tasksCompleted as number ?? 0,
        tokensUsed: metadata.tokensUsed as number ?? 0,
        duration: metadata.duration as number ?? 0,
        checkpointReason: metadata.checkpointReason as string | undefined,
      },
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
    };
  }
}

// Singleton instance
export const checkpointManager = new CheckpointManager();
