/**
 * Conflict Resolution System for Multi-Agent Coordination
 * Uses vector clocks for causality tracking and various resolution strategies
 */

import { SharedStateManager } from './SharedState';
import { MessageBus, AgentMessage } from './MessageBus';

// Vector clock for tracking causality
export interface VectorClock {
  [agentId: string]: number;
}

// Contender in a conflict
export interface ConflictContender {
  agentId: string;
  vectorClock: VectorClock;
  value: any;
  timestamp: number;
}

// Conflict event types
export type ConflictType = 'concurrent_write' | 'resource_contention' | 'task_overlap';

// Conflict event structure
export interface ConflictEvent {
  id: string;
  type: ConflictType;
  resource: string;
  contenders: ConflictContender[];
  detectedAt: number;
  taskId?: string;
}

// Resolution result
export interface ResolutionResult {
  conflictId: string;
  strategy: 'causal_order' | 'automatic_merge' | 'priority_lock' | 'first_claim' | 'orchestrator_decision';
  winner?: ConflictContender;
  merged?: any;
  losers?: string[];
  timestamp: number;
}

// Agent priority levels
const AGENT_PRIORITIES: Record<string, number> = {
  orchestrator: 100,
  reviewer: 80,
  coder: 60,
  analyst: 40,
  researcher: 20,
  browser: 15,
  writer: 10,
};

/**
 * ConflictResolver handles conflicts between agents
 * Uses vector clocks for causality and various resolution strategies
 */
export class ConflictResolver {
  private stateManager: SharedStateManager;
  private orchestratorBus: MessageBus;
  private conflictHistory: Map<string, ResolutionResult> = new Map();
  private pendingConflicts: Map<string, ConflictEvent> = new Map();

  constructor(stateManager: SharedStateManager, orchestratorBus: MessageBus) {
    this.stateManager = stateManager;
    this.orchestratorBus = orchestratorBus;
  }

  /**
   * Compare two vector clocks to determine causality
   * Returns 'before' if a happened before b, 'after' if a happened after b, 'concurrent' if neither
   */
  compareVectorClocks(a: VectorClock, b: VectorClock): 'before' | 'after' | 'concurrent' {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    
    let aBeforeB = false;
    let bBeforeA = false;

    for (const key of allKeys) {
      const aVal = a[key] || 0;
      const bVal = b[key] || 0;
      
      if (aVal < bVal) aBeforeB = true;
      if (bVal < aVal) bBeforeA = true;
    }

    if (aBeforeB && !bBeforeA) return 'before';
    if (bBeforeA && !aBeforeB) return 'after';
    return 'concurrent';
  }

  /**
   * Merge two vector clocks (take max of each component)
   */
  mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
    const result: VectorClock = { ...a };
    
    for (const key of Object.keys(b)) {
      result[key] = Math.max(result[key] || 0, b[key]);
    }
    
    return result;
  }

  /**
   * Increment an agent's clock component
   */
  incrementClock(clock: VectorClock, agentId: string): VectorClock {
    return {
      ...clock,
      [agentId]: (clock[agentId] || 0) + 1,
    };
  }

  /**
   * Main conflict resolution entry point
   */
  async resolveConflict(conflict: ConflictEvent): Promise<ResolutionResult> {
    this.pendingConflicts.set(conflict.id, conflict);

    try {
      let result: ResolutionResult;

      switch (conflict.type) {
        case 'concurrent_write':
          result = await this.resolveConcurrentWrite(conflict);
          break;
        case 'resource_contention':
          result = await this.resolveResourceContention(conflict);
          break;
        case 'task_overlap':
          result = await this.resolveTaskOverlap(conflict);
          break;
        default:
          result = await this.escalateToOrchestrator(conflict);
      }

      // Store resolution in history
      this.conflictHistory.set(conflict.id, result);
      this.pendingConflicts.delete(conflict.id);

      // Log resolution to state
      await this.logResolution(conflict, result);

      return result;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      this.pendingConflicts.delete(conflict.id);
      throw error;
    }
  }

  /**
   * Resolve concurrent write conflicts using vector clocks
   */
  private async resolveConcurrentWrite(conflict: ConflictEvent): Promise<ResolutionResult> {
    const { contenders, id } = conflict;

    // Sort by vector clock ordering
    const sorted = [...contenders].sort((a, b) => {
      const comparison = this.compareVectorClocks(a.vectorClock, b.vectorClock);
      if (comparison === 'before') return -1;
      if (comparison === 'after') return 1;
      // Tie-breaker: earlier timestamp wins
      return a.timestamp - b.timestamp;
    });

    // Check for true concurrency (no causal ordering)
    const concurrent: ConflictContender[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const comparison = this.compareVectorClocks(
        sorted[i - 1].vectorClock,
        sorted[i].vectorClock
      );
      if (comparison === 'concurrent') {
        if (!concurrent.includes(sorted[i - 1])) {
          concurrent.push(sorted[i - 1]);
        }
        concurrent.push(sorted[i]);
      }
    }

    if (concurrent.length === 0) {
      // Clear causal winner - use last value in causal order
      const winner = sorted[sorted.length - 1];
      return {
        conflictId: id,
        strategy: 'causal_order',
        winner,
        losers: sorted.slice(0, -1).map(c => c.agentId),
        timestamp: Date.now(),
      };
    }

    // Try to merge concurrent writes
    if (this.isMergeable(conflict.resource)) {
      const mergeResult = await this.attemptMerge(concurrent.map(c => c.value));
      if (mergeResult.success) {
        return {
          conflictId: id,
          strategy: 'automatic_merge',
          merged: mergeResult.value,
          timestamp: Date.now(),
        };
      }
    }

    // Escalate to orchestrator for manual resolution
    return this.escalateToOrchestrator(conflict);
  }

  /**
   * Resolve resource contention using priority-based locking
   */
  private async resolveResourceContention(conflict: ConflictEvent): Promise<ResolutionResult> {
    const { contenders, resource, id } = conflict;

    // Sort by agent priority, then by timestamp
    const sorted = [...contenders].sort((a, b) => {
      const priorityA = this.getAgentPriority(a.agentId);
      const priorityB = this.getAgentPriority(b.agentId);
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }
      
      return a.timestamp - b.timestamp; // Earlier timestamp wins
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Notify losers to wait
    for (const loser of losers) {
      try {
        // Extract role from agentId (e.g., "researcher-abc123" -> "researcher")
        const loserRole = loser.agentId.split('-')[0] as any;
        await this.orchestratorBus.sendToAgent(loser.agentId, loserRole, {
          type: 'interrupt',
          taskId: conflict.taskId || resource,
          payload: {
            action: 'wait',
            resource,
            holder: winner.agentId,
            retryAfterMs: 5000,
            reason: 'resource_contention',
          },
          priority: 'high',
          ttl: 60000,
        });
      } catch (error) {
        console.error(`Failed to notify agent ${loser.agentId}:`, error);
      }
    }

    return {
      conflictId: id,
      strategy: 'priority_lock',
      winner,
      losers: losers.map(l => l.agentId),
      timestamp: Date.now(),
    };
  }

  /**
   * Resolve task overlap - first claim wins
   */
  private async resolveTaskOverlap(conflict: ConflictEvent): Promise<ResolutionResult> {
    const { contenders, id } = conflict;

    // Sort by timestamp - first claim wins
    const sorted = [...contenders].sort((a, b) => a.timestamp - b.timestamp);
    const winner = sorted[0];

    // Notify other agents that task is already claimed
    for (const loser of sorted.slice(1)) {
      try {
        const loserRole = loser.agentId.split('-')[0] as any;
        await this.orchestratorBus.sendToAgent(loser.agentId, loserRole, {
          type: 'interrupt',
          taskId: conflict.taskId || conflict.resource,
          payload: {
            action: 'abort',
            reason: 'task_already_claimed',
            holder: winner.agentId,
          },
          priority: 'high',
          ttl: 60000,
        });
      } catch (error) {
        console.error(`Failed to notify agent ${loser.agentId}:`, error);
      }
    }

    return {
      conflictId: id,
      strategy: 'first_claim',
      winner,
      losers: sorted.slice(1).map(l => l.agentId),
      timestamp: Date.now(),
    };
  }

  /**
   * Escalate conflict to orchestrator for manual resolution
   */
  private async escalateToOrchestrator(conflict: ConflictEvent): Promise<ResolutionResult> {
    try {
      // Notify orchestrator about the conflict
      await this.orchestratorBus.broadcastToRole('orchestrator', {
        type: 'interrupt',
        taskId: conflict.taskId || conflict.resource,
        payload: {
          action: 'resolve_conflict',
          conflict,
        },
        priority: 'critical',
        ttl: 60000,
      });

      // Fallback: use timestamp-based resolution since we can't wait for response easily
      const sorted = [...conflict.contenders].sort((a, b) => a.timestamp - b.timestamp);
      return {
        conflictId: conflict.id,
        strategy: 'orchestrator_decision',
        winner: sorted[0],
        losers: sorted.slice(1).map(l => l.agentId),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to escalate to orchestrator:', error);
      
      // Fallback: use timestamp-based resolution
      const sorted = [...conflict.contenders].sort((a, b) => a.timestamp - b.timestamp);
      return {
        conflictId: conflict.id,
        strategy: 'first_claim',
        winner: sorted[0],
        losers: sorted.slice(1).map(l => l.agentId),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get agent priority for conflict resolution
   */
  private getAgentPriority(agentId: string): number {
    for (const [prefix, priority] of Object.entries(AGENT_PRIORITIES)) {
      if (agentId.startsWith(prefix)) {
        return priority;
      }
    }
    return 0;
  }

  /**
   * Check if a resource can be automatically merged
   */
  private isMergeable(resource: string): boolean {
    return (
      resource.endsWith('.md') ||
      resource.endsWith('.json') ||
      resource.startsWith('state.facts') ||
      resource.startsWith('state.context') ||
      resource.startsWith('artifacts.')
    );
  }

  /**
   * Attempt to merge multiple values
   */
  private async attemptMerge(values: any[]): Promise<{ success: boolean; value?: any }> {
    try {
      // Merge arrays - combine unique items
      if (values.every(Array.isArray)) {
        const merged = [...new Set(values.flat())];
        return { success: true, value: merged };
      }

      // Merge strings - concatenate with separator
      if (values.every(v => typeof v === 'string')) {
        const merged = values.join('\n\n---\n\n');
        return { success: true, value: merged };
      }

      // Merge objects - deep merge
      if (values.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
        const merged = this.deepMerge(values);
        return { success: true, value: merged };
      }

      return { success: false };
    } catch (error) {
      console.error('Merge failed:', error);
      return { success: false };
    }
  }

  /**
   * Deep merge multiple objects
   */
  private deepMerge(objects: object[]): object {
    return objects.reduce((acc, obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          typeof acc[key as keyof typeof acc] === 'object'
        ) {
          (acc as any)[key] = this.deepMerge([acc[key as keyof typeof acc] as object, value]);
        } else if (Array.isArray(value) && Array.isArray(acc[key as keyof typeof acc])) {
          (acc as any)[key] = [...new Set([...(acc[key as keyof typeof acc] as any[]), ...value])];
        } else {
          (acc as any)[key] = value;
        }
      }
      return acc;
    }, {} as object);
  }

  /**
   * Log resolution to shared state
   */
  private async logResolution(conflict: ConflictEvent, result: ResolutionResult): Promise<void> {
    try {
      await this.stateManager.appendToList('conflictResolutions', {
        conflictId: conflict.id,
        type: conflict.type,
        resource: conflict.resource,
        contenderCount: conflict.contenders.length,
        strategy: result.strategy,
        winnerId: result.winner?.agentId,
        timestamp: result.timestamp,
      });
    } catch (error) {
      console.error('Failed to log resolution:', error);
    }
  }

  /**
   * Get conflict history
   */
  getConflictHistory(): ResolutionResult[] {
    return Array.from(this.conflictHistory.values());
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): ConflictEvent[] {
    return Array.from(this.pendingConflicts.values());
  }
}

/**
 * Factory function to create a ConflictResolver
 */
export function createConflictResolver(
  stateManager: SharedStateManager,
  orchestratorBus: MessageBus
): ConflictResolver {
  return new ConflictResolver(stateManager, orchestratorBus);
}
