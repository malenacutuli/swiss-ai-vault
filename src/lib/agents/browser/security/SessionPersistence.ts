/**
 * Session Persistence for Browser Automation
 * 
 * Saves and restores browser session state (cookies, storage)
 * to allow resuming sessions across browser restarts.
 */

import { supabase } from '@/integrations/supabase/client';

export interface StorageState {
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  currentUrl?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface PersistedSession {
  sessionId: string;
  userId: string;
  taskId?: string;
  storageState: StorageState;
  viewport: { width: number; height: number };
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class SessionPersistence {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Save session state to database
   */
  async saveSession(
    sessionId: string,
    state: StorageState,
    options: {
      taskId?: string;
      viewport?: { width: number; height: number };
      userAgent?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('agent_browser_sessions')
        .upsert({
          session_id: sessionId,
          user_id: this.userId,
          task_id: options.taskId,
          storage_state: state as unknown as Record<string, unknown>,
          cookies: state.cookies as unknown as Record<string, unknown>[],
          local_storage: state.localStorage,
          session_storage: state.sessionStorage,
          current_url: state.currentUrl,
          viewport_width: options.viewport?.width ?? 1920,
          viewport_height: options.viewport?.height ?? 1080,
          user_agent: options.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } as never, {
          onConflict: 'session_id',
        });

      if (error) {
        console.error('Failed to save browser session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to save browser session:', error);
      return false;
    }
  }

  /**
   * Load session state from database
   */
  async loadSession(sessionId: string): Promise<PersistedSession | null> {
    try {
      const { data, error } = await supabase
        .from('agent_browser_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', this.userId)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if session is expired
      if (new Date(data.expires_at!) < new Date()) {
        await this.deleteSession(sessionId);
        return null;
      }

      const storageState = data.storage_state as unknown as StorageState;

      return {
        sessionId: data.session_id,
        userId: data.user_id,
        taskId: data.task_id ?? undefined,
        storageState: {
          cookies: (data.cookies ?? []) as unknown as Cookie[],
          localStorage: (data.local_storage ?? {}) as Record<string, string>,
          sessionStorage: (data.session_storage ?? {}) as Record<string, string>,
          currentUrl: data.current_url ?? undefined,
        },
        viewport: {
          width: data.viewport_width ?? 1920,
          height: data.viewport_height ?? 1080,
        },
        userAgent: data.user_agent ?? undefined,
        isActive: data.is_active ?? false,
        createdAt: new Date(data.created_at!),
        updatedAt: new Date(data.updated_at!),
        expiresAt: new Date(data.expires_at!),
      };
    } catch (error) {
      console.error('Failed to load browser session:', error);
      return null;
    }
  }

  /**
   * List all active sessions for user
   */
  async listSessions(taskId?: string): Promise<PersistedSession[]> {
    try {
      let query = supabase
        .from('agent_browser_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false });

      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      return data.map(row => ({
        sessionId: row.session_id,
        userId: row.user_id,
        taskId: row.task_id ?? undefined,
        storageState: {
          cookies: (row.cookies ?? []) as unknown as Cookie[],
          localStorage: (row.local_storage ?? {}) as Record<string, string>,
          sessionStorage: (row.session_storage ?? {}) as Record<string, string>,
          currentUrl: row.current_url ?? undefined,
        },
        viewport: {
          width: row.viewport_width ?? 1920,
          height: row.viewport_height ?? 1080,
        },
        userAgent: row.user_agent ?? undefined,
        isActive: row.is_active ?? false,
        createdAt: new Date(row.created_at!),
        updatedAt: new Date(row.updated_at!),
        expiresAt: new Date(row.expires_at!),
      }));
    } catch (error) {
      console.error('Failed to list browser sessions:', error);
      return [];
    }
  }

  /**
   * Mark session as inactive
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('agent_browser_sessions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('session_id', sessionId)
        .eq('user_id', this.userId);

      return !error;
    } catch (error) {
      console.error('Failed to deactivate browser session:', error);
      return false;
    }
  }

  /**
   * Delete session from database
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('agent_browser_sessions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', this.userId);

      return !error;
    } catch (error) {
      console.error('Failed to delete browser session:', error);
      return false;
    }
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, hours: number = 24): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('agent_browser_sessions')
        .update({
          expires_at: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('session_id', sessionId)
        .eq('user_id', this.userId);

      return !error;
    } catch (error) {
      console.error('Failed to extend browser session:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('agent_browser_sessions')
        .delete()
        .eq('user_id', this.userId)
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup expired sessions:', error);
        return 0;
      }

      return data?.length ?? 0;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }
}

/**
 * Create a session persistence instance for a user
 */
export function createSessionPersistence(userId: string): SessionPersistence {
  return new SessionPersistence(userId);
}
