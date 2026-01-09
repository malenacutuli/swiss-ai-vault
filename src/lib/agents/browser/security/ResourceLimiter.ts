/**
 * Resource Limiter for Browser Automation
 * 
 * Enforces limits on memory, pages, contexts, and timeouts
 * to prevent runaway resource consumption.
 */

export interface ResourceLimits {
  maxMemoryMB: number;
  maxPages: number;
  maxContexts: number;
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  maxConcurrentActions: number;
  maxSessionDurationMs: number;
  maxDownloadSizeMB: number;
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryMB: 1024,            // 1GB per browser
  maxPages: 10,                 // Max concurrent pages per session
  maxContexts: 5,               // Max browser contexts
  navigationTimeoutMs: 60000,   // 60s navigation timeout
  actionTimeoutMs: 30000,       // 30s action timeout
  maxConcurrentActions: 3,      // Max parallel actions
  maxSessionDurationMs: 3600000, // 1 hour max session
  maxDownloadSizeMB: 100,       // 100MB max download
};

export interface SessionResources {
  pageCount: number;
  actionCount: number;
  concurrentActions: number;
  startTime: number;
  lastActivityTime: number;
  totalBytesDownloaded: number;
}

export interface ResourceCheckResult {
  allowed: boolean;
  reason?: string;
  currentValue?: number;
  limit?: number;
}

export class ResourceLimiter {
  private limits: ResourceLimits;
  private sessions: Map<string, SessionResources> = new Map();
  private globalContextCount: number = 0;

  constructor(limits: Partial<ResourceLimits> = {}) {
    this.limits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
  }

  /**
   * Initialize tracking for a new session
   */
  initSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      pageCount: 0,
      actionCount: 0,
      concurrentActions: 0,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      totalBytesDownloaded: 0,
    });
    this.globalContextCount++;
  }

  /**
   * Check if a new context can be created
   */
  canCreateContext(): ResourceCheckResult {
    if (this.globalContextCount >= this.limits.maxContexts) {
      return {
        allowed: false,
        reason: `Maximum context limit reached`,
        currentValue: this.globalContextCount,
        limit: this.limits.maxContexts,
      };
    }
    return { allowed: true };
  }

  /**
   * Check if a new page can be created
   */
  canCreatePage(sessionId: string): ResourceCheckResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    if (session.pageCount >= this.limits.maxPages) {
      return {
        allowed: false,
        reason: `Maximum page limit reached for session`,
        currentValue: session.pageCount,
        limit: this.limits.maxPages,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if an action can be executed
   */
  canExecuteAction(sessionId: string): ResourceCheckResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    // Check session duration
    const sessionDuration = Date.now() - session.startTime;
    if (sessionDuration >= this.limits.maxSessionDurationMs) {
      return {
        allowed: false,
        reason: 'Session duration limit exceeded',
        currentValue: sessionDuration,
        limit: this.limits.maxSessionDurationMs,
      };
    }

    // Check concurrent actions
    if (session.concurrentActions >= this.limits.maxConcurrentActions) {
      return {
        allowed: false,
        reason: 'Maximum concurrent actions limit reached',
        currentValue: session.concurrentActions,
        limit: this.limits.maxConcurrentActions,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if download size is within limits
   */
  canDownload(sessionId: string, sizeBytes: number): ResourceCheckResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }

    const newTotal = session.totalBytesDownloaded + sizeBytes;
    const limitBytes = this.limits.maxDownloadSizeMB * 1024 * 1024;

    if (newTotal > limitBytes) {
      return {
        allowed: false,
        reason: 'Download size limit would be exceeded',
        currentValue: session.totalBytesDownloaded,
        limit: limitBytes,
      };
    }

    return { allowed: true };
  }

  /**
   * Register a new page creation
   */
  registerPage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pageCount++;
      session.lastActivityTime = Date.now();
    }
  }

  /**
   * Unregister a page
   */
  unregisterPage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pageCount = Math.max(0, session.pageCount - 1);
    }
  }

  /**
   * Register action start
   */
  registerActionStart(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.concurrentActions++;
      session.actionCount++;
      session.lastActivityTime = Date.now();
    }
  }

  /**
   * Register action end
   */
  registerActionEnd(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.concurrentActions = Math.max(0, session.concurrentActions - 1);
    }
  }

  /**
   * Register download bytes
   */
  registerDownload(sessionId: string, sizeBytes: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalBytesDownloaded += sizeBytes;
    }
  }

  /**
   * Clean up session resources
   */
  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.globalContextCount = Math.max(0, this.globalContextCount - 1);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionResources | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalContexts: number;
    totalSessions: number;
    limits: ResourceLimits;
  } {
    return {
      totalContexts: this.globalContextCount,
      totalSessions: this.sessions.size,
      limits: { ...this.limits },
    };
  }

  /**
   * Get navigation timeout
   */
  getNavigationTimeout(): number {
    return this.limits.navigationTimeoutMs;
  }

  /**
   * Get action timeout
   */
  getActionTimeout(): number {
    return this.limits.actionTimeoutMs;
  }

  /**
   * Check for stale sessions and clean them up
   */
  cleanupStaleSessions(maxIdleMs: number = 300000): string[] {
    const now = Date.now();
    const staleSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivityTime;
      const sessionDuration = now - session.startTime;

      if (idleTime > maxIdleMs || sessionDuration > this.limits.maxSessionDurationMs) {
        staleSessions.push(sessionId);
        this.sessions.delete(sessionId);
        this.globalContextCount = Math.max(0, this.globalContextCount - 1);
      }
    }

    return staleSessions;
  }
}

// Singleton instance with default limits
export const resourceLimiter = new ResourceLimiter();
