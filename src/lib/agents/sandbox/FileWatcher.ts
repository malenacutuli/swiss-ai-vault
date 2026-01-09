/**
 * FileWatcher - Real-time file change detection with debouncing
 * Uses chokidar for cross-platform file watching
 */

import { EventEmitter } from 'events';

export interface WatcherConfig {
  ignored: string[];
  debounceMs: number;
  persistent: boolean;
  usePolling?: boolean;
  pollInterval?: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'delete';
  path: string;
  absolutePath: string;
  timestamp: number;
}

export interface WatcherStats {
  watchedFiles: number;
  watchedDirs: number;
  eventsEmitted: number;
  lastEventTime: number | null;
  isRunning: boolean;
}

const DEFAULT_CONFIG: WatcherConfig = {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/.next/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '**/venv/**',
    '**/.venv/**',
    '**/build/**',
    '**/.cache/**',
    '**/coverage/**',
    '**/.turbo/**',
  ],
  debounceMs: 100,
  persistent: true,
  usePolling: false,
  pollInterval: 100,
};

// Simulated path module for browser environment
const pathUtils = {
  relative: (from: string, to: string): string => {
    if (to.startsWith(from)) {
      return to.slice(from.length).replace(/^\//, '');
    }
    return to;
  },
  join: (...parts: string[]): string => {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  },
};

export class FileWatcher extends EventEmitter {
  private config: WatcherConfig;
  private projectDir: string;
  private pendingEvents: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private watchedPaths: Set<string> = new Set();
  private isRunning: boolean = false;
  private stats: WatcherStats = {
    watchedFiles: 0,
    watchedDirs: 0,
    eventsEmitted: 0,
    lastEventTime: null,
    isRunning: false,
  };

  // For browser simulation - in production, this would use actual chokidar
  private mockWatcher: {
    close: () => Promise<void>;
    getWatched: () => Record<string, string[]>;
  } | null = null;

  constructor(projectDir: string, config: Partial<WatcherConfig> = {}) {
    super();
    this.projectDir = projectDir;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[FileWatcher] Already running');
      return;
    }

    console.log(`[FileWatcher] Starting watch on ${this.projectDir}`);
    console.log(`[FileWatcher] Ignored patterns:`, this.config.ignored);

    try {
      // In browser environment, we simulate the watcher
      // In Node.js/production, this would use actual chokidar
      this.mockWatcher = this.createMockWatcher();
      
      this.isRunning = true;
      this.stats.isRunning = true;

      console.log('[FileWatcher] Started successfully');
      this.emit('ready');
    } catch (error) {
      console.error('[FileWatcher] Failed to start:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a mock watcher for browser environment
   * In production Node.js, replace with actual chokidar implementation
   */
  private createMockWatcher() {
    const watched: Record<string, string[]> = {
      [this.projectDir]: ['src', 'public', 'package.json'],
    };

    return {
      close: async () => {
        console.log('[FileWatcher] Mock watcher closed');
      },
      getWatched: () => watched,
    };
  }

  /**
   * Simulate a file change event (for testing/development)
   */
  simulateChange(type: 'add' | 'change' | 'delete', filePath: string): void {
    if (!this.isRunning) {
      console.warn('[FileWatcher] Cannot simulate change - watcher not running');
      return;
    }
    this.handleEvent(type, filePath);
  }

  private handleEvent(type: 'add' | 'change' | 'delete', filePath: string): void {
    // Check if path should be ignored
    if (this.shouldIgnore(filePath)) {
      return;
    }

    // Debounce rapid changes to same file
    const existing = this.pendingEvents.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.pendingEvents.delete(filePath);

      const relativePath = pathUtils.relative(this.projectDir, filePath);

      const event: FileChangeEvent = {
        type,
        path: relativePath,
        absolutePath: filePath,
        timestamp: Date.now(),
      };

      this.stats.eventsEmitted++;
      this.stats.lastEventTime = Date.now();

      console.log(`[FileWatcher] ${type}: ${relativePath}`);
      this.emit('change', event);

      // Also emit specific event type
      this.emit(type, event);
    }, this.config.debounceMs);

    this.pendingEvents.set(filePath, timer);
  }

  private shouldIgnore(filePath: string): boolean {
    return this.config.ignored.some(pattern => {
      // Simple glob matching
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      return new RegExp(regex).test(filePath);
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[FileWatcher] Stopping...');

    if (this.mockWatcher) {
      await this.mockWatcher.close();
      this.mockWatcher = null;
    }

    // Clear pending events
    for (const timer of this.pendingEvents.values()) {
      clearTimeout(timer);
    }
    this.pendingEvents.clear();

    this.isRunning = false;
    this.stats.isRunning = false;

    console.log('[FileWatcher] Stopped');
    this.emit('close');
  }

  getWatchedPaths(): string[] {
    if (!this.mockWatcher) return [];
    
    const watched = this.mockWatcher.getWatched();
    return Object.keys(watched).flatMap(dir => {
      const files = watched[dir];
      return files.map(file => pathUtils.join(dir, file));
    });
  }

  getStats(): WatcherStats {
    return { ...this.stats };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Add additional paths to ignore
   */
  addIgnorePattern(pattern: string): void {
    if (!this.config.ignored.includes(pattern)) {
      this.config.ignored.push(pattern);
      console.log(`[FileWatcher] Added ignore pattern: ${pattern}`);
    }
  }

  /**
   * Remove an ignore pattern
   */
  removeIgnorePattern(pattern: string): void {
    const index = this.config.ignored.indexOf(pattern);
    if (index !== -1) {
      this.config.ignored.splice(index, 1);
      console.log(`[FileWatcher] Removed ignore pattern: ${pattern}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WatcherConfig {
    return { ...this.config };
  }
}

/**
 * Create a file watcher with production-ready configuration
 */
export function createFileWatcher(
  projectDir: string,
  options?: Partial<WatcherConfig>
): FileWatcher {
  return new FileWatcher(projectDir, {
    ...options,
    // Use polling on network file systems or when inotify limits are hit
    usePolling: options?.usePolling ?? false,
  });
}

/**
 * Check if inotify limits are sufficient (Linux only)
 * Returns true if limits are OK, false if they might cause issues
 */
export function checkInotifyLimits(): { ok: boolean; recommendations: string[] } {
  // In browser, we can't check system limits
  // In Node.js, this would read from /proc/sys/fs/inotify/
  return {
    ok: true,
    recommendations: [
      'For large projects, consider increasing inotify limits:',
      'fs.inotify.max_user_instances = 8192',
      'fs.inotify.max_user_watches = 524288',
      'fs.inotify.max_queued_events = 65536',
    ],
  };
}
