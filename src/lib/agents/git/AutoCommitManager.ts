// Auto-Commit Manager with Debouncing
// Automatically commits agent-generated changes with intelligent batching

import { GitManager, CommitInfo, FileChange } from './GitManager';

export interface AutoCommitConfig {
  enabled: boolean;
  debounceMs: number;           // Time to wait before committing (default: 2000ms)
  maxBatchSize: number;         // Max files per commit (default: 50)
  maxWaitMs: number;            // Max time to wait before forcing commit (default: 30000ms)
  excludePatterns: string[];    // Patterns to exclude from commits
  messagePrefix: string;        // Prefix for commit messages
}

export interface PendingChange {
  path: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  description?: string;
}

export interface CommitResult {
  success: boolean;
  commit?: CommitInfo;
  filesCommitted: number;
  error?: string;
}

type CommitCallback = (result: CommitResult) => void;

const DEFAULT_CONFIG: AutoCommitConfig = {
  enabled: true,
  debounceMs: 2000,
  maxBatchSize: 50,
  maxWaitMs: 30000,
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    '*.log',
    '.env*',
    'dist/**',
    '.next/**',
    '__pycache__/**',
    '*.pyc',
  ],
  messagePrefix: '[Agent]',
};

export class AutoCommitManager {
  private git: GitManager;
  private config: AutoCommitConfig;
  private pendingChanges: Map<string, PendingChange> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private firstChangeTime: number | null = null;
  private commitCallbacks: Set<CommitCallback> = new Set();
  private isCommitting = false;
  private commitQueue: (() => Promise<void>)[] = [];

  constructor(git: GitManager, config?: Partial<AutoCommitConfig>) {
    this.git = git;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a file change
   */
  recordChange(path: string, type: PendingChange['type'], description?: string): void {
    if (!this.config.enabled) return;
    if (this.isExcluded(path)) return;

    const now = Date.now();
    
    // Track first change time for max wait
    if (this.firstChangeTime === null) {
      this.firstChangeTime = now;
      this.startMaxWaitTimer();
    }

    // Update or add pending change
    this.pendingChanges.set(path, {
      path,
      type,
      timestamp: now,
      description,
    });

    // Reset debounce timer
    this.resetDebounceTimer();

    // Check batch size
    if (this.pendingChanges.size >= this.config.maxBatchSize) {
      this.flushNow();
    }
  }

  /**
   * Force immediate commit of pending changes
   */
  async flushNow(): Promise<CommitResult> {
    this.clearTimers();
    return this.commitPendingChanges();
  }

  /**
   * Subscribe to commit events
   */
  onCommit(callback: CommitCallback): () => void {
    this.commitCallbacks.add(callback);
    return () => this.commitCallbacks.delete(callback);
  }

  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Get pending changes
   */
  getPendingChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values());
  }

  /**
   * Clear all pending changes without committing
   */
  clearPending(): void {
    this.clearTimers();
    this.pendingChanges.clear();
    this.firstChangeTime = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoCommitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable auto-commit
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clearTimers();
    }
  }

  /**
   * Check if path should be excluded
   */
  private isExcluded(path: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      // Simple glob matching
      const regex = new RegExp(
        '^' + pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.') + '$'
      );
      return regex.test(path);
    });
  }

  /**
   * Reset debounce timer
   */
  private resetDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.commitPendingChanges();
    }, this.config.debounceMs);
  }

  /**
   * Start max wait timer
   */
  private startMaxWaitTimer(): void {
    if (this.maxWaitTimer) return;
    
    this.maxWaitTimer = setTimeout(() => {
      if (this.pendingChanges.size > 0) {
        this.commitPendingChanges();
      }
    }, this.config.maxWaitMs);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }

  /**
   * Commit pending changes
   */
  private async commitPendingChanges(): Promise<CommitResult> {
    if (this.pendingChanges.size === 0) {
      return { success: true, filesCommitted: 0 };
    }

    // Prevent concurrent commits
    if (this.isCommitting) {
      return new Promise<CommitResult>((resolve) => {
        this.commitQueue.push(async () => {
          const result = await this.commitPendingChanges();
          resolve(result);
        });
      });
    }

    this.isCommitting = true;
    this.clearTimers();

    const changes = Array.from(this.pendingChanges.values());
    const message = this.generateCommitMessage(changes);

    try {
      // Stage all changes
      await this.git.stageAll();

      // Commit
      const commit = await this.git.commit(message);

      if (!commit) {
        const result: CommitResult = {
          success: true,
          filesCommitted: 0,
        };
        this.notifyCallbacks(result);
        return result;
      }

      // Clear pending changes
      this.pendingChanges.clear();
      this.firstChangeTime = null;

      const result: CommitResult = {
        success: true,
        commit,
        filesCommitted: changes.length,
      };

      this.notifyCallbacks(result);
      return result;

    } catch (error) {
      const result: CommitResult = {
        success: false,
        filesCommitted: 0,
        error: error instanceof Error ? error.message : 'Commit failed',
      };
      this.notifyCallbacks(result);
      return result;

    } finally {
      this.isCommitting = false;

      // Process queued commits
      const nextCommit = this.commitQueue.shift();
      if (nextCommit) {
        nextCommit();
      }
    }
  }

  /**
   * Generate commit message from changes
   */
  private generateCommitMessage(changes: PendingChange[]): string {
    const { messagePrefix } = this.config;
    
    // Group by type
    const created = changes.filter(c => c.type === 'create');
    const updated = changes.filter(c => c.type === 'update');
    const deleted = changes.filter(c => c.type === 'delete');

    // Generate summary
    const parts: string[] = [];
    
    if (created.length > 0) {
      parts.push(`Add ${this.summarizeFiles(created)}`);
    }
    if (updated.length > 0) {
      parts.push(`Update ${this.summarizeFiles(updated)}`);
    }
    if (deleted.length > 0) {
      parts.push(`Remove ${this.summarizeFiles(deleted)}`);
    }

    const summary = parts.join(', ') || 'Update files';
    
    // Check for descriptions
    const descriptions = changes
      .filter(c => c.description)
      .map(c => `- ${c.description}`)
      .slice(0, 5);

    if (descriptions.length > 0) {
      return `${messagePrefix} ${summary}\n\n${descriptions.join('\n')}`;
    }

    return `${messagePrefix} ${summary}`;
  }

  /**
   * Summarize file changes for commit message
   */
  private summarizeFiles(changes: PendingChange[]): string {
    if (changes.length === 1) {
      return this.getFileName(changes[0].path);
    }
    
    if (changes.length <= 3) {
      return changes.map(c => this.getFileName(c.path)).join(', ');
    }

    // Group by directory or extension
    const extensions = new Map<string, number>();
    for (const change of changes) {
      const ext = this.getExtension(change.path) || 'files';
      extensions.set(ext, (extensions.get(ext) || 0) + 1);
    }

    const summary = Array.from(extensions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([ext, count]) => `${count} ${ext}`)
      .join(', ');

    return `${changes.length} files (${summary})`;
  }

  /**
   * Get file name from path
   */
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  /**
   * Get file extension
   */
  private getExtension(path: string): string {
    const match = path.match(/\.([^.]+)$/);
    return match ? `.${match[1]}` : '';
  }

  /**
   * Notify all callbacks of commit result
   */
  private notifyCallbacks(result: CommitResult): void {
    this.commitCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (e) {
        console.error('[AutoCommit] Callback error:', e);
      }
    });
  }
}

// Factory function
export function createAutoCommitManager(
  git: GitManager,
  config?: Partial<AutoCommitConfig>
): AutoCommitManager {
  return new AutoCommitManager(git, config);
}
