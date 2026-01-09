/**
 * Shared State Manager - Distributed state for multi-agent coordination
 * Uses Supabase for persistence with real-time sync
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AgentRole } from './AgentRegistry';

export type TaskStatus = 
  | 'pending'
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Phase {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  assignedRole?: AgentRole;
  dependencies: string[];
  subtasks: Subtask[];
  startedAt?: string;
  completedAt?: string;
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  result?: unknown;
  error?: string;
}

export interface Artifact {
  id: string;
  type: 'file' | 'data' | 'report' | 'screenshot' | 'code';
  name: string;
  content?: unknown;
  storageKey?: string;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentStatus {
  agentId: string;
  role: AgentRole;
  status: 'idle' | 'busy' | 'waiting' | 'error';
  currentTask?: string;
  lastHeartbeat: number;
  metrics?: {
    tasksCompleted: number;
    tasksFailed: number;
    avgDurationMs: number;
  };
}

export interface SharedState {
  taskId: string;
  userId: string;
  objective: string;
  status: TaskStatus;
  plan: {
    phases: Phase[];
    currentPhase: number;
    totalPhases: number;
  };
  artifacts: Record<string, Artifact>;
  agents: Record<string, AgentStatus>;
  context: {
    facts: string[];
    decisions: string[];
    constraints: string[];
    memory: Record<string, unknown>;
  };
  metrics: {
    startedAt?: string;
    completedAt?: string;
    totalDurationMs?: number;
    tokensUsed: number;
    creditsUsed: number;
  };
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
    timestamp: string;
  };
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

type StateChangeHandler = (path: string, value: unknown, oldValue: unknown) => void;

/**
 * SharedStateManager - Manages distributed state across agents
 */
export class SharedStateManager {
  private taskId: string;
  private userId: string;
  private localCache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheTTL: number;
  private channel: RealtimeChannel | null = null;
  private changeHandlers: StateChangeHandler[] = [];
  private isInitialized = false;

  constructor(taskId: string, userId: string, cacheTTL: number = 1000) {
    this.taskId = taskId;
    this.userId = userId;
    this.cacheTTL = cacheTTL;
  }

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<SharedState> {
    // Subscribe to state changes
    this.channel = supabase
      .channel(`state:${this.taskId}`)
      .on('broadcast', { event: 'state_change' }, ({ payload }) => {
        const { path, value, oldValue } = payload as {
          path: string;
          value: unknown;
          oldValue: unknown;
        };
        
        // Update local cache
        this.localCache.set(path, { value, timestamp: Date.now() });
        
        // Notify handlers
        this.changeHandlers.forEach((handler) => handler(path, value, oldValue));
      });

    await this.channel.subscribe();

    // Load or create initial state
    let state = await this.loadState();
    
    if (!state) {
      state = await this.createInitialState();
    }

    this.isInitialized = true;
    return state;
  }

  /**
   * Load state from database
   */
  private async loadState(): Promise<SharedState | null> {
    const { data, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', this.taskId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.taskToState(data);
  }

  /**
   * Create initial state
   */
  private async createInitialState(): Promise<SharedState> {
    const initialState: SharedState = {
      taskId: this.taskId,
      userId: this.userId,
      objective: '',
      status: 'pending',
      plan: {
        phases: [],
        currentPhase: 0,
        totalPhases: 0,
      },
      artifacts: {},
      agents: {},
      context: {
        facts: [],
        decisions: [],
        constraints: [],
        memory: {},
      },
      metrics: {
        tokensUsed: 0,
        creditsUsed: 0,
      },
    };

    return initialState;
  }

  /**
   * Convert database task to SharedState
   */
  private taskToState(data: any): SharedState {
    return {
      taskId: data.id,
      userId: data.user_id,
      objective: data.prompt || '',
      status: data.status || 'pending',
      plan: data.plan_json || {
        phases: [],
        currentPhase: data.current_step || 0,
        totalPhases: data.total_steps || 0,
      },
      artifacts: {},
      agents: {},
      context: data.memory_context || {
        facts: [],
        decisions: [],
        constraints: [],
        memory: {},
      },
      metrics: {
        startedAt: data.started_at,
        completedAt: data.completed_at,
        totalDurationMs: data.duration_ms,
        tokensUsed: data.tokens_used || 0,
        creditsUsed: data.credits_used || 0,
      },
      error: data.error_message ? {
        message: data.error_message,
        code: 'TASK_ERROR',
        recoverable: false,
        timestamp: new Date().toISOString(),
      } : undefined,
    };
  }

  /**
   * Get a value from state
   */
  async get<T>(path: string): Promise<T | null> {
    // Check cache first
    const cached = this.localCache.get(path);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value as T;
    }

    // Load from database
    const state = await this.loadState();
    if (!state) return null;

    // Navigate path
    const value = this.getValueByPath(state, path);
    
    if (value !== undefined) {
      this.localCache.set(path, { value, timestamp: Date.now() });
    }

    return (value as T) ?? null;
  }

  /**
   * Set a value in state
   */
  async set<T>(path: string, value: T): Promise<boolean> {
    const oldValue = await this.get(path);
    
    // Update local cache
    this.localCache.set(path, { value, timestamp: Date.now() });

    // Persist to database based on path
    const success = await this.persistValue(path, value);

    if (success) {
      // Broadcast change
      await this.channel?.send({
        type: 'broadcast',
        event: 'state_change',
        payload: { path, value, oldValue },
      });
    }

    return success;
  }

  /**
   * Persist value to database
   */
  private async persistValue(path: string, value: unknown): Promise<boolean> {
    try {
      const parts = path.split('.');
      const rootKey = parts[0];

      switch (rootKey) {
        case 'status':
          await supabase
            .from('agent_tasks')
            .update({ status: value as string, updated_at: new Date().toISOString() })
            .eq('id', this.taskId);
          break;

        case 'plan':
          const currentPlan = await this.get<SharedState['plan']>('plan') || { phases: [], currentPhase: 0, totalPhases: 0 };
          const updatedPlan = this.setValueByPath(currentPlan, parts.slice(1).join('.'), value) as SharedState['plan'];
          await supabase
            .from('agent_tasks')
            .update({
              plan_json: JSON.parse(JSON.stringify(updatedPlan)),
              current_step: updatedPlan?.currentPhase ?? 0,
              total_steps: updatedPlan?.totalPhases ?? 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.taskId);
          break;

        case 'context':
          const currentContext = await this.get<SharedState['context']>('context') || {};
          const updatedContext = this.setValueByPath(currentContext, parts.slice(1).join('.'), value);
          await supabase
            .from('agent_tasks')
            .update({
              memory_context: updatedContext,
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.taskId);
          break;

        case 'metrics':
          const updates: Record<string, unknown> = {};
          if (parts[1] === 'tokensUsed') updates.tokens_used = value;
          if (parts[1] === 'creditsUsed') updates.credits_used = value;
          if (parts[1] === 'completedAt') updates.completed_at = value;
          updates.updated_at = new Date().toISOString();
          
          await supabase
            .from('agent_tasks')
            .update(updates)
            .eq('id', this.taskId);
          break;

        case 'error':
          await supabase
            .from('agent_tasks')
            .update({
              error_message: (value as SharedState['error'])?.message,
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.taskId);
          break;

        default:
          console.warn(`[SharedState] Unknown path: ${path}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error('[SharedState] Failed to persist:', error);
      return false;
    }
  }

  /**
   * Append to a list in state
   */
  async appendToList<T>(path: string, item: T): Promise<void> {
    const list = (await this.get<T[]>(path)) || [];
    list.push(item);
    await this.set(path, list);
  }

  /**
   * Update an item in a list
   */
  async updateListItem<T extends { id: string }>(
    path: string,
    itemId: string,
    updates: Partial<T>
  ): Promise<boolean> {
    const list = (await this.get<T[]>(path)) || [];
    const index = list.findIndex((item) => item.id === itemId);
    
    if (index === -1) return false;
    
    list[index] = { ...list[index], ...updates };
    await this.set(path, list);
    return true;
  }

  /**
   * Register an agent in state
   */
  async registerAgent(agentId: string, role: AgentRole): Promise<void> {
    const status: AgentStatus = {
      agentId,
      role,
      status: 'idle',
      lastHeartbeat: Date.now(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgDurationMs: 0,
      },
    };

    await this.set(`agents.${agentId}`, status);
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    updates: Partial<AgentStatus>
  ): Promise<void> {
    const current = await this.get<AgentStatus>(`agents.${agentId}`);
    if (current) {
      await this.set(`agents.${agentId}`, {
        ...current,
        ...updates,
        lastHeartbeat: Date.now(),
      });
    }
  }

  /**
   * Add an artifact to state
   */
  async addArtifact(artifact: Omit<Artifact, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const fullArtifact: Artifact = {
      ...artifact,
      id,
      createdAt: new Date().toISOString(),
    };

    await this.set(`artifacts.${id}`, fullArtifact);
    return id;
  }

  /**
   * Watch for state changes
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.changeHandlers.push(handler);
    return () => {
      this.changeHandlers = this.changeHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Get the full current state
   */
  async getFullState(): Promise<SharedState | null> {
    return this.loadState();
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }
    this.localCache.clear();
    this.changeHandlers = [];
    this.isInitialized = false;
  }

  /**
   * Helper: Get value by dot-notation path
   */
  private getValueByPath(obj: unknown, path: string): unknown {
    if (!path) return obj;
    
    const parts = path.split('.');
    let current = obj as Record<string, unknown>;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part] as Record<string, unknown>;
    }
    
    return current;
  }

  /**
   * Helper: Set value by dot-notation path
   */
  private setValueByPath<T>(obj: T, path: string, value: unknown): T {
    if (!path) return value as T;
    
    const result = { ...obj } as Record<string, unknown>;
    const parts = path.split('.');
    let current = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      current[part] = { ...(current[part] as Record<string, unknown> || {}) };
      current = current[part] as Record<string, unknown>;
    }
    
    current[parts[parts.length - 1]] = value;
    return result as T;
  }
}

/**
 * Factory function to create a shared state manager
 */
export function createSharedState(taskId: string, userId: string): SharedStateManager {
  return new SharedStateManager(taskId, userId);
}
