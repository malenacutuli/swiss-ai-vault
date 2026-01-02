/**
 * Singleton Distillation Runner
 * - Survives React component unmounts
 * - Persists progress to localStorage
 * - Adaptive throttling (only delay on rate limit)
 * - Concurrent processing for speed
 */

// Types
interface DistillJob {
  id: string;
  memoryId: string;
  title: string;
  content: string;
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rate_limited';
  attempts: number;
  error?: string;
}

export interface RunnerState {
  isRunning: boolean;
  isPaused: boolean;
  jobs: DistillJob[];
  processed: number;
  succeeded: number;
  failed: number;
  rateLimited: number;
  startedAt: number | null;
}

type RunnerListener = (state: RunnerState, event: string) => void;

// Singleton state (lives outside React)
let state: RunnerState = {
  isRunning: false,
  isPaused: false,
  jobs: [],
  processed: 0,
  succeeded: 0,
  failed: 0,
  rateLimited: 0,
  startedAt: null,
};

let accessToken: string | null = null;
const listeners = new Set<RunnerListener>();
const STORAGE_KEY = 'swissvault_distill_progress';

// CRITICAL: Adaptive throttling config for gpt-4o-mini (500+ RPM)
const THROTTLE_CONFIG = {
  concurrency: 2,           // Process 2 at a time (conservative)
  baseDelay: 300,           // 300ms between requests (safe for 500 RPM)
  maxDelay: 30000,          // Max 30s backoff
  rateLimitBackoff: 30000,  // Wait 30s on rate limit (not 60s)
};

let currentDelay = THROTTLE_CONFIG.baseDelay;

// Persist to localStorage - ONLY IDs and status (not full content to avoid QuotaExceeded)
function persist() {
  try {
    // Only store minimal data - IDs and status, NOT content
    const minimalJobs = state.jobs.map(j => ({
      id: j.id,
      memoryId: j.memoryId,
      title: j.title.slice(0, 100), // Truncate title
      status: j.status,
      attempts: j.attempts,
      error: j.error,
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      jobs: minimalJobs,
      processed: state.processed,
      succeeded: state.succeeded,
      failed: state.failed,
    }));
  } catch (e) {
    console.error('[DistillRunner] Failed to persist:', e);
    // If localStorage fails, try to at least save counts
    try {
      localStorage.setItem(STORAGE_KEY + '_counts', JSON.stringify({
        processed: state.processed,
        succeeded: state.succeeded,
        failed: state.failed,
      }));
    } catch {}
  }
}

// Load from localStorage
function loadPersisted(): Partial<RunnerState> | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// Notify all listeners
function notify(event: string) {
  persist();
  listeners.forEach(fn => fn({ ...state }, event));
}

// Process single job
async function processJob(job: DistillJob): Promise<boolean> {
  if (!accessToken) return false;
  
  job.status = 'processing';
  job.attempts++;
  
  try {
    // Import distill function
    const { distillConversation, saveInsight } = await import('./distill');
    
    const insight = await distillConversation(
      {
        id: job.memoryId,
        title: job.title,
        content: job.content.slice(0, 8000),
        source: job.source,
      },
      accessToken
    );

    if (insight) {
      await saveInsight(insight);
      job.status = 'completed';
      state.succeeded++;
      return true;
    }
    
    job.status = 'failed';
    job.error = 'No insight generated';
    state.failed++;
    return false;
    
  } catch (error: unknown) {
    const err = error as Error & { isRateLimit?: boolean };
    if (err.isRateLimit || err.message?.includes('429') || err.message?.includes('limit')) {
      job.status = 'rate_limited';
      state.rateLimited++;
      return false;
    }
    job.status = 'failed';
    job.error = err.message;
    state.failed++;
    return false;
  }
}

// Process jobs with concurrency and adaptive delay
async function processBatch(jobs: DistillJob[]): Promise<void> {
  const results = await Promise.allSettled(
    jobs.map(async (job, index) => {
      // Stagger requests with adaptive delay
      await new Promise(r => setTimeout(r, index * currentDelay));
      const success = await processJob(job);
      
      // Adaptive delay adjustment
      if (success) {
        // Reduce delay on success (min = baseDelay)
        currentDelay = Math.max(currentDelay * 0.9, THROTTLE_CONFIG.baseDelay);
      }
      return success;
    })
  );
  
  // Check for rate limits in this batch
  const hasRateLimit = jobs.some(j => j.status === 'rate_limited');
  if (hasRateLimit) {
    // Increase delay on rate limit (max = maxDelay)
    currentDelay = Math.min(currentDelay * 3, THROTTLE_CONFIG.maxDelay);
    console.log(`[DistillRunner] Rate limit detected, increasing delay to ${currentDelay}ms`);
  }
  
  state.processed += jobs.length;
  notify('progress');
}

// Main processing loop
async function runLoop() {
  console.log('[DistillRunner] Starting loop with model: gpt-4o-mini (500+ RPM)');
  
  while (state.isRunning && !state.isPaused) {
    const pending = state.jobs.filter(j => j.status === 'pending');
    
    if (pending.length === 0) {
      // Check rate-limited jobs that can be retried
      const rateLimited = state.jobs.filter(j => j.status === 'rate_limited' && j.attempts < 3);
      if (rateLimited.length > 0) {
        console.log(`[DistillRunner] Waiting ${THROTTLE_CONFIG.rateLimitBackoff / 1000}s for rate limit backoff...`);
        notify('rate_limit_backoff');
        await new Promise(r => setTimeout(r, THROTTLE_CONFIG.rateLimitBackoff));
        rateLimited.forEach(j => { j.status = 'pending'; });
        continue;
      }
      break; // All done
    }

    // Process batch concurrently
    const batch = pending.slice(0, THROTTLE_CONFIG.concurrency);
    await processBatch(batch);

    // Brief pause between batches
    await new Promise(r => setTimeout(r, currentDelay));
  }

  state.isRunning = false;
  notify('complete');
  console.log('[DistillRunner] Complete:', { succeeded: state.succeeded, failed: state.failed });

  // Browser notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && state.succeeded > 0) {
    try {
      new Notification('SwissVault Analysis Complete', {
        body: `Analyzed ${state.succeeded} items.`,
        icon: '/favicon.ico',
      });
    } catch (e) {
      // Notification API may fail silently in some contexts
    }
  }
}

// Public API
export const DistillationRunner = {
  subscribe(listener: RunnerListener): () => void {
    listeners.add(listener);
    listener({ ...state }, 'subscribe');
    return () => listeners.delete(listener);
  },

  getState(): RunnerState {
    return { ...state };
  },

  hasResumable(): boolean {
    const saved = loadPersisted();
    return saved?.jobs?.some((j: DistillJob) => j.status === 'pending' || j.status === 'rate_limited') || false;
  },

  getResumableCount(): number {
    const saved = loadPersisted();
    return saved?.jobs?.filter((j: DistillJob) => j.status === 'pending' || j.status === 'rate_limited').length || 0;
  },

  async start(
    token: string, 
    memories: Array<{ id: string; title: string; content: string; source: string }>, 
    options?: { resume?: boolean }
  ) {
    if (state.isRunning) {
      console.log('[DistillRunner] Already running');
      return;
    }
    
    accessToken = token;

    if (options?.resume) {
      const saved = loadPersisted();
      if (saved?.jobs?.length) {
        // Reset rate_limited jobs to pending for retry
        const resumedJobs = (saved.jobs as DistillJob[]).map(j => 
          j.status === 'rate_limited' || j.status === 'processing' 
            ? { ...j, status: 'pending' as const } 
            : j
        );
        state = { 
          ...state, 
          ...saved,
          jobs: resumedJobs, 
          isRunning: true, 
          isPaused: false, 
          startedAt: Date.now() 
        };
        notify('resume');
        runLoop();
        return;
      }
    }

    // Create new jobs
    state = {
      isRunning: true,
      isPaused: false,
      jobs: memories.map(m => ({
        id: crypto.randomUUID(),
        memoryId: m.id,
        title: m.title,
        content: m.content,
        source: m.source,
        status: 'pending' as const,
        attempts: 0,
      })),
      processed: 0,
      succeeded: 0,
      failed: 0,
      rateLimited: 0,
      startedAt: Date.now(),
    };

    notify('start');
    
    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    runLoop();
  },

  pause() {
    if (state.isRunning && !state.isPaused) {
      state.isPaused = true;
      notify('pause');
      console.log('[DistillRunner] Paused');
    }
  },

  resume() {
    if (state.isPaused) {
      state.isPaused = false;
      notify('resume');
      console.log('[DistillRunner] Resumed');
      runLoop();
    }
  },

  stop() {
    state.isRunning = false;
    state.isPaused = false;
    localStorage.removeItem(STORAGE_KEY);
    notify('stop');
    console.log('[DistillRunner] Stopped');
  },

  clear() {
    state = { 
      isRunning: false, 
      isPaused: false, 
      jobs: [], 
      processed: 0, 
      succeeded: 0, 
      failed: 0, 
      rateLimited: 0, 
      startedAt: null 
    };
    localStorage.removeItem(STORAGE_KEY);
    notify('clear');
  },
};
