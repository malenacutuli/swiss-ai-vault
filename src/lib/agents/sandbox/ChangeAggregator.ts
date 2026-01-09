/**
 * ChangeAggregator - Batches and aggregates file changes for efficient processing
 * Reduces noise from rapid file changes and provides summarized change sets
 */

export interface FileChange {
  type: 'add' | 'change' | 'delete';
  path: string;
  absolutePath?: string;
  timestamp: number;
}

export interface AggregatedFile {
  path: string;
  type: 'add' | 'modify' | 'delete';
  changeCount: number;
  firstChange: number;
  lastChange: number;
}

export interface AggregatedChanges {
  files: AggregatedFile[];
  timestamp: number;
  totalChanges: number;
  duration: number;
}

export interface AggregatorConfig {
  flushIntervalMs: number;
  maxBatchSize: number;
  maxBatchAge: number;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  flushIntervalMs: 1000,
  maxBatchSize: 100,
  maxBatchAge: 5000,
};

export class ChangeAggregator {
  private changes: Map<string, FileChange[]> = new Map();
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private onFlush: (changes: AggregatedChanges) => Promise<void>;
  private config: AggregatorConfig;
  private batchStartTime: number | null = null;
  private totalChangesProcessed: number = 0;
  private isRunning: boolean = false;

  constructor(
    onFlush: (changes: AggregatedChanges) => Promise<void>,
    config: Partial<AggregatorConfig> = {}
  ) {
    this.onFlush = onFlush;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.warn('[ChangeAggregator] Already running');
      return;
    }

    const interval = intervalMs ?? this.config.flushIntervalMs;
    console.log(`[ChangeAggregator] Starting with ${interval}ms flush interval`);

    this.flushInterval = setInterval(() => this.flush(), interval);
    this.isRunning = true;
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[ChangeAggregator] Stopping...');

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining changes
    this.flush();
    this.isRunning = false;

    console.log('[ChangeAggregator] Stopped');
  }

  addChange(change: FileChange): void {
    const key = change.path;
    const existing = this.changes.get(key) || [];
    existing.push(change);
    this.changes.set(key, existing);

    // Track batch start time
    if (this.batchStartTime === null) {
      this.batchStartTime = Date.now();
    }

    // Force flush if batch is too large
    if (this.getTotalPendingChanges() >= this.config.maxBatchSize) {
      console.log('[ChangeAggregator] Max batch size reached, forcing flush');
      this.flush();
    }

    // Force flush if batch is too old
    if (
      this.batchStartTime &&
      Date.now() - this.batchStartTime >= this.config.maxBatchAge
    ) {
      console.log('[ChangeAggregator] Max batch age reached, forcing flush');
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.changes.size === 0) {
      return;
    }

    const flushStart = Date.now();
    const batchDuration = this.batchStartTime
      ? flushStart - this.batchStartTime
      : 0;

    const aggregated: AggregatedChanges = {
      files: [],
      timestamp: flushStart,
      totalChanges: 0,
      duration: batchDuration,
    };

    for (const [path, changes] of this.changes.entries()) {
      // Determine final state based on first and last change
      const firstChange = changes[0];
      const lastChange = changes[changes.length - 1];

      let finalType: 'add' | 'modify' | 'delete';

      if (firstChange.type === 'add' && lastChange.type === 'delete') {
        // Created and deleted - no net change, skip
        continue;
      } else if (lastChange.type === 'delete') {
        finalType = 'delete';
      } else if (firstChange.type === 'add') {
        finalType = 'add';
      } else {
        finalType = 'modify';
      }

      aggregated.files.push({
        path,
        type: finalType,
        changeCount: changes.length,
        firstChange: firstChange.timestamp,
        lastChange: lastChange.timestamp,
      });

      aggregated.totalChanges += changes.length;
    }

    // Clear changes before async flush to prevent duplicates
    this.changes.clear();
    this.batchStartTime = null;

    if (aggregated.files.length > 0) {
      this.totalChangesProcessed += aggregated.totalChanges;

      console.log(
        `[ChangeAggregator] Flushing ${aggregated.files.length} files ` +
          `(${aggregated.totalChanges} changes) over ${batchDuration}ms`
      );

      try {
        await this.onFlush(aggregated);
      } catch (error) {
        console.error('[ChangeAggregator] Flush handler error:', error);
      }
    }
  }

  /**
   * Get count of pending changes
   */
  getTotalPendingChanges(): number {
    let count = 0;
    for (const changes of this.changes.values()) {
      count += changes.length;
    }
    return count;
  }

  /**
   * Get count of pending files
   */
  getPendingFileCount(): number {
    return this.changes.size;
  }

  /**
   * Get total changes processed since start
   */
  getTotalProcessed(): number {
    return this.totalChangesProcessed;
  }

  /**
   * Check if aggregator is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current pending changes without flushing
   */
  getPendingChanges(): Map<string, FileChange[]> {
    return new Map(this.changes);
  }

  /**
   * Force immediate flush
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Clear all pending changes without flushing
   */
  clear(): void {
    this.changes.clear();
    this.batchStartTime = null;
  }

  /**
   * Get aggregator statistics
   */
  getStats(): {
    pendingFiles: number;
    pendingChanges: number;
    totalProcessed: number;
    isRunning: boolean;
    batchAge: number | null;
  } {
    return {
      pendingFiles: this.getPendingFileCount(),
      pendingChanges: this.getTotalPendingChanges(),
      totalProcessed: this.totalChangesProcessed,
      isRunning: this.isRunning,
      batchAge: this.batchStartTime ? Date.now() - this.batchStartTime : null,
    };
  }
}

/**
 * Create a change aggregator with default configuration
 */
export function createChangeAggregator(
  onFlush: (changes: AggregatedChanges) => Promise<void>,
  config?: Partial<AggregatorConfig>
): ChangeAggregator {
  return new ChangeAggregator(onFlush, config);
}

/**
 * Utility to format aggregated changes for display
 */
export function formatAggregatedChanges(changes: AggregatedChanges): string {
  const added = changes.files.filter((f) => f.type === 'add').length;
  const modified = changes.files.filter((f) => f.type === 'modify').length;
  const deleted = changes.files.filter((f) => f.type === 'delete').length;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} added`);
  if (modified > 0) parts.push(`${modified} modified`);
  if (deleted > 0) parts.push(`${deleted} deleted`);

  return parts.join(', ') || 'No changes';
}
