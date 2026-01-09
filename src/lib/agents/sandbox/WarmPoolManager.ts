/**
 * Warm Container Pool Manager
 * Provides near-instant (<800ms) sandbox startup by maintaining pre-initialized containers
 */

import { supabase } from '@/integrations/supabase/client';

// Pool configuration per region
interface PoolConfig {
  basePool: number;      // Minimum containers to maintain
  maxPool: number;       // Maximum containers allowed
  scalingFactor: number; // Multiplier when scaling up
  templates: string[];   // Supported templates
}

// Container state
export interface WarmContainer {
  id: string;
  template: string;
  status: 'warming' | 'warm' | 'assigned' | 'expired' | 'terminated';
  region: string;
  createdAt: Date;
  assignedAt?: Date;
  releasedAt?: Date;
  expiresAt: Date;
  userId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

// Pool statistics
export interface PoolStats {
  region: string;
  templates: Record<string, { 
    warm: number; 
    assigned: number;
    expired: number;
    target: number;
    hitRate: number;
  }>;
  totalWarm: number;
  totalAssigned: number;
  avgAcquisitionMs: number;
  coldStartRate: number;
}

// Acquisition result
export interface AcquisitionResult {
  container: WarmContainer | null;
  wasWarm: boolean;
  acquisitionTimeMs: number;
  fallbackReason?: string;
}

// Region configurations
const POOL_CONFIGS: Record<string, PoolConfig> = {
  'eu-central-2': {  // Swiss region (primary)
    basePool: 50,
    maxPool: 200,
    scalingFactor: 1.5,
    templates: ['web-static', 'web-server', 'web-db-user', 'python-data', 'generic'],
  },
  'eu-central-1': {  // Frankfurt (backup)
    basePool: 30,
    maxPool: 150,
    scalingFactor: 1.3,
    templates: ['web-static', 'web-server', 'generic'],
  },
  'us-east-1': {  // US East
    basePool: 20,
    maxPool: 100,
    scalingFactor: 1.2,
    templates: ['web-static', 'web-server', 'generic'],
  },
};

// Template distribution percentages
const TEMPLATE_DISTRIBUTION: Record<string, number> = {
  'web-static': 0.30,    // 30% of pool
  'web-server': 0.25,    // 25% of pool
  'web-db-user': 0.20,   // 20% of pool
  'python-data': 0.10,   // 10% of pool
  'generic': 0.15,       // 15% of pool
};

// Metrics tracking
interface PoolMetrics {
  acquisitions: number;
  warmHits: number;
  coldStarts: number;
  totalAcquisitionTimeMs: number;
  lastReplenishAt: Date | null;
}

export class WarmPoolManager {
  private region: string;
  private config: PoolConfig;
  private replenishInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private metrics: PoolMetrics = {
    acquisitions: 0,
    warmHits: 0,
    coldStarts: 0,
    totalAcquisitionTimeMs: 0,
    lastReplenishAt: null,
  };
  private isInitialized = false;

  constructor(region: string = 'eu-central-2') {
    this.region = region;
    this.config = POOL_CONFIGS[region] || POOL_CONFIGS['eu-central-2'];
  }

  /**
   * Initialize the warm pool manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`[WarmPool] Initializing for region: ${this.region}`);

    // Start replenishment loop (every 5 seconds)
    this.replenishInterval = setInterval(
      () => this.replenishPool(),
      5000
    );

    // Start cleanup loop (every 30 seconds)
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredContainers(),
      30000
    );

    // Initial pool fill
    await this.replenishPool();

    this.isInitialized = true;
    console.log(`[WarmPool] Initialized successfully`);
  }

  /**
   * Acquire a warm container for a task
   */
  async acquireContainer(
    template: string,
    userId: string,
    taskId: string
  ): Promise<AcquisitionResult> {
    const startTime = Date.now();
    this.metrics.acquisitions++;

    try {
      // Try to get a warm container
      const { data: containers, error } = await supabase
        .from('sandbox_containers')
        .select('*')
        .eq('region', this.region)
        .eq('template', template)
        .eq('status', 'warm')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('[WarmPool] Error fetching container:', error);
        return this.handleColdStart(template, userId, taskId, startTime, error.message);
      }

      if (!containers || containers.length === 0) {
        return this.handleColdStart(template, userId, taskId, startTime, 'No warm containers available');
      }

      const container = containers[0];

      // Mark as assigned
      const { error: updateError } = await supabase
        .from('sandbox_containers')
        .update({
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          user_id: userId,
          task_id: taskId,
        })
        .eq('id', container.id)
        .eq('status', 'warm'); // Optimistic lock

      if (updateError) {
        console.error('[WarmPool] Error assigning container:', updateError);
        return this.handleColdStart(template, userId, taskId, startTime, updateError.message);
      }

      const acquisitionTimeMs = Date.now() - startTime;
      this.metrics.warmHits++;
      this.metrics.totalAcquisitionTimeMs += acquisitionTimeMs;

      // Track metric
      await this.trackMetric(template, 'warm_hit', 1);
      await this.trackMetric(template, 'acquisition_time_ms', acquisitionTimeMs);

      const warmContainer: WarmContainer = {
        id: container.id,
        template: container.template,
        status: 'assigned',
        region: container.region,
        createdAt: new Date(container.created_at),
        assignedAt: new Date(),
        expiresAt: new Date(container.expires_at),
        userId,
        taskId,
        metadata: container.metadata as Record<string, unknown>,
      };

      console.log(`[WarmPool] Acquired warm container ${container.id} in ${acquisitionTimeMs}ms`);

      return {
        container: warmContainer,
        wasWarm: true,
        acquisitionTimeMs,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return this.handleColdStart(template, userId, taskId, startTime, error);
    }
  }

  /**
   * Handle cold start when no warm container is available
   */
  private async handleColdStart(
    template: string,
    userId: string,
    taskId: string,
    startTime: number,
    reason: string
  ): Promise<AcquisitionResult> {
    this.metrics.coldStarts++;
    
    // Create a new container (cold start)
    const containerId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const { error } = await supabase
      .from('sandbox_containers')
      .insert({
        id: containerId,
        region: this.region,
        template,
        status: 'assigned',
        user_id: userId,
        task_id: taskId,
        assigned_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    const acquisitionTimeMs = Date.now() - startTime;
    this.metrics.totalAcquisitionTimeMs += acquisitionTimeMs;

    // Track metrics
    await this.trackMetric(template, 'cold_start', 1);
    await this.trackMetric(template, 'acquisition_time_ms', acquisitionTimeMs);

    if (error) {
      console.error('[WarmPool] Error creating cold container:', error);
      return {
        container: null,
        wasWarm: false,
        acquisitionTimeMs,
        fallbackReason: error.message,
      };
    }

    const container: WarmContainer = {
      id: containerId,
      template,
      status: 'assigned',
      region: this.region,
      createdAt: now,
      assignedAt: now,
      expiresAt,
      userId,
      taskId,
    };

    console.log(`[WarmPool] Cold start for ${template}: ${reason} (${acquisitionTimeMs}ms)`);

    return {
      container,
      wasWarm: false,
      acquisitionTimeMs,
      fallbackReason: reason,
    };
  }

  /**
   * Release a container after use
   */
  async releaseContainer(containerId: string): Promise<void> {
    // Mark container as expired (don't reuse for security)
    const { error } = await supabase
      .from('sandbox_containers')
      .update({
        status: 'expired',
        released_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    if (error) {
      console.error('[WarmPool] Error releasing container:', error);
    } else {
      console.log(`[WarmPool] Released container ${containerId}`);
    }
  }

  /**
   * Replenish the warm pool
   */
  private async replenishPool(): Promise<void> {
    this.metrics.lastReplenishAt = new Date();

    for (const template of this.config.templates) {
      const currentCount = await this.getWarmCount(template);
      const targetCount = this.getTargetCount(template);
      const threshold = Math.floor(targetCount * 0.3);

      if (currentCount < threshold) {
        // Below 30% - urgent replenishment
        const needed = Math.min(
          targetCount - currentCount,
          5 // Max 5 at a time to avoid overload
        );

        if (needed > 0) {
          await this.createWarmContainers(template, needed);
          console.log(`[WarmPool] Replenished ${needed} ${template} containers (was ${currentCount}/${targetCount})`);
        }
      }
    }
  }

  /**
   * Get count of warm containers for a template
   */
  private async getWarmCount(template: string): Promise<number> {
    const { count, error } = await supabase
      .from('sandbox_containers')
      .select('*', { count: 'exact', head: true })
      .eq('region', this.region)
      .eq('template', template)
      .eq('status', 'warm');

    if (error) {
      console.error('[WarmPool] Error getting warm count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get target count for a template
   */
  private getTargetCount(template: string): number {
    const distribution = TEMPLATE_DISTRIBUTION[template] || 0.1;
    return Math.ceil(this.config.basePool * distribution);
  }

  /**
   * Create warm containers
   */
  private async createWarmContainers(template: string, count: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const containers = Array(count).fill(null).map(() => ({
      id: crypto.randomUUID(),
      region: this.region,
      template,
      status: 'warm' as const,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      metadata: {
        preInitialized: true,
        warmStartTime: now.toISOString(),
      },
    }));

    const { error } = await supabase
      .from('sandbox_containers')
      .insert(containers);

    if (error) {
      console.error('[WarmPool] Error creating warm containers:', error);
    }
  }

  /**
   * Clean up expired containers
   */
  private async cleanupExpiredContainers(): Promise<void> {
    const { data, error } = await supabase.rpc('cleanup_expired_containers');

    if (error) {
      console.error('[WarmPool] Error cleaning up containers:', error);
    } else if (data && data > 0) {
      console.log(`[WarmPool] Cleaned up ${data} expired containers`);
    }
  }

  /**
   * Track a metric
   */
  private async trackMetric(template: string, metricType: string, value: number): Promise<void> {
    await supabase
      .from('sandbox_pool_metrics')
      .insert({
        region: this.region,
        template,
        metric_type: metricType,
        value,
      });
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    const stats: PoolStats = {
      region: this.region,
      templates: {},
      totalWarm: 0,
      totalAssigned: 0,
      avgAcquisitionMs: 0,
      coldStartRate: 0,
    };

    // Get container counts
    const { data: poolData } = await supabase.rpc('get_pool_stats', { p_region: this.region });

    if (poolData) {
      for (const row of poolData) {
        const target = this.getTargetCount(row.template);
        const warm = Number(row.warm_count);
        const assigned = Number(row.assigned_count);
        const expired = Number(row.expired_count);
        const total = warm + assigned;
        
        stats.templates[row.template] = {
          warm,
          assigned,
          expired,
          target,
          hitRate: total > 0 ? (warm / total) * 100 : 0,
        };
        
        stats.totalWarm += warm;
        stats.totalAssigned += assigned;
      }
    }

    // Calculate metrics
    if (this.metrics.acquisitions > 0) {
      stats.avgAcquisitionMs = this.metrics.totalAcquisitionTimeMs / this.metrics.acquisitions;
      stats.coldStartRate = (this.metrics.coldStarts / this.metrics.acquisitions) * 100;
    }

    return stats;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (this.replenishInterval) {
      clearInterval(this.replenishInterval);
      this.replenishInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isInitialized = false;
    console.log('[WarmPool] Shutdown complete');
  }
}

// Singleton instance
let poolManagerInstance: WarmPoolManager | null = null;

export function getWarmPoolManager(region?: string): WarmPoolManager {
  if (!poolManagerInstance) {
    poolManagerInstance = new WarmPoolManager(region);
  }
  return poolManagerInstance;
}

export function resetWarmPoolManager(): void {
  if (poolManagerInstance) {
    poolManagerInstance.shutdown();
    poolManagerInstance = null;
  }
}
