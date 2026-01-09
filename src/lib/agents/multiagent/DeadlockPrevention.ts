/**
 * Deadlock Prevention System for Multi-Agent Coordination
 * Uses wait-for graphs and cycle detection to prevent and resolve deadlocks
 */

import { supabase } from '@/integrations/supabase/client';
import { MessageBus } from './MessageBus';

// Lock information
export interface LockInfo {
  resource: string;
  holder: string;
  acquiredAt: number;
  expiresAt?: number;
}

// Wait-for edge in the graph
export interface WaitForEdge {
  waiting: string;
  waitingFor: string;
  resource: string;
  since: number;
}

// Deadlock detection result
export interface DeadlockResult {
  detected: boolean;
  cycle?: string[];
  victim?: string;
}

// Agent priority for victim selection
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
 * DeadlockPrevention handles detection and resolution of deadlocks
 * between agents competing for shared resources
 */
export class DeadlockPrevention {
  private waitForGraph: Map<string, Set<string>> = new Map();
  private resourceToEdge: Map<string, WaitForEdge> = new Map();
  private locks: Map<string, LockInfo> = new Map();
  private taskId: string;
  private messageBus?: MessageBus;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(taskId: string, messageBus?: MessageBus) {
    this.taskId = taskId;
    this.messageBus = messageBus;
    
    // Start periodic cleanup of stale locks
    this.cleanupInterval = setInterval(() => this.cleanupStaleLocks(), 30000);
  }

  /**
   * Attempt to acquire a lock on a resource
   * Returns true if lock was acquired, false if would cause deadlock
   */
  async acquireLock(
    agentId: string,
    resource: string,
    timeoutMs: number = 30000
  ): Promise<{ acquired: boolean; holder?: string }> {
    // Check if resource is already locked
    const existingLock = await this.getResourceHolder(resource);
    
    if (existingLock) {
      if (existingLock === agentId) {
        // Already own the lock
        return { acquired: true };
      }

      // Check if acquiring would cause deadlock
      const wouldDeadlock = await this.checkForDeadlock(agentId, resource);
      if (wouldDeadlock) {
        console.warn(`Deadlock prevented: ${agentId} waiting for ${resource} held by ${existingLock}`);
        return { acquired: false, holder: existingLock };
      }

      // Add to wait-for graph
      this.addWaitEdge(agentId, existingLock, resource);
      
      // Wait for lock to be released
      const acquired = await this.waitForLock(resource, agentId, timeoutMs);
      
      // Remove from wait-for graph
      this.removeWaitEdge(agentId, existingLock);
      
      if (!acquired) {
        return { acquired: false, holder: await this.getResourceHolder(resource) || undefined };
      }
    }

    // Acquire the lock
    const lock: LockInfo = {
      resource,
      holder: agentId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
    };

    this.locks.set(resource, lock);
    await this.persistLock(lock);

    return { acquired: true };
  }

  /**
   * Release a lock on a resource
   */
  async releaseLock(agentId: string, resource: string): Promise<boolean> {
    const lock = this.locks.get(resource);
    
    if (!lock || lock.holder !== agentId) {
      console.warn(`Agent ${agentId} attempted to release lock they don't hold on ${resource}`);
      return false;
    }

    this.locks.delete(resource);
    await this.deleteLock(resource);

    return true;
  }

  /**
   * Check if acquiring a resource would cause a deadlock
   */
  async checkForDeadlock(agentId: string, requestedResource: string): Promise<boolean> {
    const holder = await this.getResourceHolder(requestedResource);
    if (!holder) return false;
    if (holder === agentId) return false;

    // Temporarily add edge to check for cycle
    if (!this.waitForGraph.has(agentId)) {
      this.waitForGraph.set(agentId, new Set());
    }
    this.waitForGraph.get(agentId)!.add(holder);

    // Check for cycle
    const hasCycle = this.detectCycle(agentId, new Set());

    // Remove the temporary edge
    this.waitForGraph.get(agentId)!.delete(holder);

    return hasCycle;
  }

  /**
   * Detect cycle in wait-for graph using DFS
   */
  private detectCycle(start: string, visited: Set<string>, path: string[] = []): boolean {
    if (visited.has(start)) {
      return true;
    }

    visited.add(start);
    path.push(start);

    const dependencies = this.waitForGraph.get(start);
    if (!dependencies) return false;

    for (const dep of dependencies) {
      if (this.detectCycle(dep, new Set(visited), [...path])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find the cycle if one exists
   */
  findCycle(start: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string): string[] | null => {
      if (path.includes(node)) {
        // Found cycle, return the cycle portion
        const cycleStart = path.indexOf(node);
        return [...path.slice(cycleStart), node];
      }
      
      if (visited.has(node)) return null;
      
      visited.add(node);
      path.push(node);
      
      const dependencies = this.waitForGraph.get(node);
      if (dependencies) {
        for (const dep of dependencies) {
          const cycle = dfs(dep);
          if (cycle) return cycle;
        }
      }
      
      path.pop();
      return null;
    };
    
    return dfs(start);
  }

  /**
   * Resolve a detected deadlock by selecting a victim
   */
  async resolveDeadlock(cycle: string[]): Promise<string> {
    // Find lowest priority agent in cycle to preempt
    let lowestPriority = Infinity;
    let victim = cycle[0];

    for (const agentId of cycle) {
      const priority = this.getAgentPriority(agentId);
      if (priority < lowestPriority) {
        lowestPriority = priority;
        victim = agentId;
      }
    }

    // Force victim to release all resources
    await this.forceRelease(victim);

    // Notify victim
    if (this.messageBus) {
      try {
        const victimRole = victim.split('-')[0] as any;
        await this.messageBus.sendToAgent(victim, victimRole, {
          type: 'interrupt',
          taskId: this.taskId,
          payload: {
            action: 'preempted',
            reason: 'deadlock_resolution',
            cycle,
          },
          priority: 'critical',
          ttl: 60000,
        });
      } catch (error) {
        console.error(`Failed to notify victim ${victim}:`, error);
      }
    }

    return victim;
  }

  /**
   * Force an agent to release all held resources
   */
  async forceRelease(agentId: string): Promise<void> {
    const releasedResources: string[] = [];

    // Release all locks held by this agent
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.holder === agentId) {
        this.locks.delete(resource);
        await this.deleteLock(resource);
        releasedResources.push(resource);
      }
    }

    // Clear from wait-for graph
    this.waitForGraph.delete(agentId);

    // Remove any edges pointing to this agent
    for (const [waiting, waitingFor] of this.waitForGraph.entries()) {
      waitingFor.delete(agentId);
      if (waitingFor.size === 0) {
        this.waitForGraph.delete(waiting);
      }
    }

    console.log(`Force released resources from ${agentId}:`, releasedResources);
  }

  /**
   * Get agent priority for victim selection
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
   * Add an edge to the wait-for graph
   */
  private addWaitEdge(waiting: string, waitingFor: string, resource: string): void {
    if (!this.waitForGraph.has(waiting)) {
      this.waitForGraph.set(waiting, new Set());
    }
    this.waitForGraph.get(waiting)!.add(waitingFor);

    this.resourceToEdge.set(`${waiting}:${waitingFor}`, {
      waiting,
      waitingFor,
      resource,
      since: Date.now(),
    });
  }

  /**
   * Remove an edge from the wait-for graph
   */
  private removeWaitEdge(waiting: string, waitingFor: string): void {
    this.waitForGraph.get(waiting)?.delete(waitingFor);
    if (this.waitForGraph.get(waiting)?.size === 0) {
      this.waitForGraph.delete(waiting);
    }
    this.resourceToEdge.delete(`${waiting}:${waitingFor}`);
  }

  /**
   * Wait for a lock to be released
   */
  private async waitForLock(
    resource: string,
    agentId: string,
    timeoutMs: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeoutMs) {
      const holder = await this.getResourceHolder(resource);
      
      if (!holder || holder === agentId) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Get current holder of a resource
   */
  private async getResourceHolder(resource: string): Promise<string | null> {
    // Check local cache first
    const localLock = this.locks.get(resource);
    if (localLock) {
      // Check if expired
      if (localLock.expiresAt && Date.now() > localLock.expiresAt) {
        this.locks.delete(resource);
        await this.deleteLock(resource);
        return null;
      }
      return localLock.holder;
    }

    // Check persistent storage
    try {
      const { data } = await supabase
        .from('agent_messages')
        .select('payload')
        .eq('task_id', this.taskId)
        .eq('message_type', 'resource_lock')
        .eq('payload->>resource', resource)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.payload) {
        const payload = data.payload as any;
        if (payload.action === 'acquire' && (!payload.expiresAt || Date.now() < payload.expiresAt)) {
          return payload.holder;
        }
      }
    } catch {
      // No lock found
    }

    return null;
  }

  /**
   * Persist a lock to database
   */
  private async persistLock(lock: LockInfo): Promise<void> {
    try {
      await supabase.from('agent_messages').insert({
        task_id: this.taskId,
        message_type: 'resource_lock',
        sender: lock.holder,
        payload: {
          action: 'acquire',
          resource: lock.resource,
          holder: lock.holder,
          acquiredAt: lock.acquiredAt,
          expiresAt: lock.expiresAt,
        },
      });
    } catch (error) {
      console.error('Failed to persist lock:', error);
    }
  }

  /**
   * Delete a lock from database
   */
  private async deleteLock(resource: string): Promise<void> {
    try {
      await supabase.from('agent_messages').insert({
        task_id: this.taskId,
        message_type: 'resource_lock',
        sender: 'system',
        payload: {
          action: 'release',
          resource,
          releasedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error('Failed to delete lock:', error);
    }
  }

  /**
   * Clean up stale locks
   */
  private async cleanupStaleLocks(): Promise<void> {
    const now = Date.now();
    
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.expiresAt && now > lock.expiresAt) {
        this.locks.delete(resource);
        await this.deleteLock(resource);
        console.log(`Cleaned up stale lock on ${resource} held by ${lock.holder}`);
      }
    }
  }

  /**
   * Get current wait-for graph for visualization
   */
  getWaitForGraph(): { nodes: string[]; edges: WaitForEdge[] } {
    const nodes = new Set<string>();
    const edges: WaitForEdge[] = [];

    for (const [waiting, waitingForSet] of this.waitForGraph.entries()) {
      nodes.add(waiting);
      for (const waitingFor of waitingForSet) {
        nodes.add(waitingFor);
        const edge = this.resourceToEdge.get(`${waiting}:${waitingFor}`);
        if (edge) {
          edges.push(edge);
        }
      }
    }

    return { nodes: Array.from(nodes), edges };
  }

  /**
   * Get all current locks
   */
  getCurrentLocks(): LockInfo[] {
    return Array.from(this.locks.values());
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.waitForGraph.clear();
    this.resourceToEdge.clear();
    this.locks.clear();
  }
}

/**
 * Factory function to create a DeadlockPrevention instance
 */
export function createDeadlockPrevention(
  taskId: string,
  messageBus?: MessageBus
): DeadlockPrevention {
  return new DeadlockPrevention(taskId, messageBus);
}
