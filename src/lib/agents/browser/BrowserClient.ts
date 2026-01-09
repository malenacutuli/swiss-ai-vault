import { supabase } from '@/integrations/supabase/client';
import type { 
  BrowserSession, 
  BrowserAction, 
  BrowserActionResult,
  NavigateParams,
  ClickParams,
  TypeParams,
  ScreenshotParams,
  ScrollParams,
  ExtractParams,
  WaitParams,
  PageInfo,
} from './types';

/**
 * BrowserClient - Frontend client for browser automation
 * 
 * This client communicates with the backend Edge Function that runs
 * actual Playwright automation. The browser runs server-side, not in the browser.
 */
export class BrowserClient {
  private sessionId: string | null = null;
  private taskId: string;
  private userId: string;

  constructor(taskId: string, userId: string) {
    this.taskId = taskId;
    this.userId = userId;
  }

  /**
   * Initialize a new browser session
   */
  async createSession(): Promise<BrowserSession> {
    const { data, error } = await supabase.functions.invoke('browser-automation', {
      body: {
        action: 'create_session',
        taskId: this.taskId,
        userId: this.userId,
      },
    });

    if (error) {
      throw new Error(`Failed to create browser session: ${error.message}`);
    }

    this.sessionId = data.sessionId;
    
    // Record session in database
    await this.recordSession(data.sessionId, 'active');
    
    return {
      id: data.sessionId,
      taskId: this.taskId,
      userId: this.userId,
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
  }

  /**
   * Execute a browser action
   */
  async execute(action: BrowserAction): Promise<BrowserActionResult> {
    if (!this.sessionId) {
      await this.createSession();
    }

    const startedAt = new Date();

    try {
      const { data, error } = await supabase.functions.invoke('browser-automation', {
        body: {
          action: action.type,
          sessionId: this.sessionId,
          taskId: this.taskId,
          params: action.params,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const completedAt = new Date();
      const result: BrowserActionResult = {
        success: true,
        sessionId: this.sessionId!,
        action: action.type,
        data: data,
        timing: {
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        },
      };

      // Log the action to database
      await this.logAction(action, result);

      return result;
    } catch (error) {
      const completedAt = new Date();
      const result: BrowserActionResult = {
        success: false,
        sessionId: this.sessionId!,
        action: action.type,
        timing: {
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.logAction(action, result);
      return result;
    }
  }

  // Convenience methods for common actions
  async navigate(params: NavigateParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'navigate', params });
  }

  async click(params: ClickParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'click', params });
  }

  async type(params: TypeParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'type', params });
  }

  async screenshot(params: ScreenshotParams = {}): Promise<BrowserActionResult> {
    return this.execute({ type: 'screenshot', params });
  }

  async scroll(params: ScrollParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'scroll', params });
  }

  async extract(params: ExtractParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'extract', params });
  }

  async wait(params: WaitParams): Promise<BrowserActionResult> {
    return this.execute({ type: 'wait', params });
  }

  async back(): Promise<BrowserActionResult> {
    return this.execute({ type: 'back' });
  }

  async forward(): Promise<BrowserActionResult> {
    return this.execute({ type: 'forward' });
  }

  async refresh(): Promise<BrowserActionResult> {
    return this.execute({ type: 'refresh' });
  }

  /**
   * Get current page info
   */
  async getPageInfo(): Promise<PageInfo | null> {
    const result = await this.execute({ 
      type: 'extract', 
      params: { extractType: 'text' } 
    });
    
    if (!result.success) return null;
    
    return {
      url: result.data?.url || '',
      title: result.data?.title || '',
      content: result.data?.content,
    };
  }

  /**
   * Close the browser session
   */
  async close(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await supabase.functions.invoke('browser-automation', {
        body: {
          action: 'close_session',
          sessionId: this.sessionId,
        },
      });

      await this.recordSession(this.sessionId, 'closed');
    } catch (error) {
      console.error('Failed to close browser session:', error);
    } finally {
      this.sessionId = null;
    }
  }

  /**
   * Record session in database
   */
  private async recordSession(sessionId: string, status: 'active' | 'idle' | 'closed'): Promise<void> {
    try {
      // Update browser_sessions table
      const now = new Date().toISOString();
      
      if (status === 'active') {
        await supabase.from('browser_sessions').insert({
          id: sessionId,
          task_id: this.taskId,
          user_id: this.userId,
          status: 'active',
          created_at: now,
          last_action_at: now,
        } as never);
      } else {
        await supabase.from('browser_sessions').update({
          status,
          closed_at: status === 'closed' ? now : null,
          last_action_at: now,
        } as never).eq('id', sessionId);
      }
    } catch (error) {
      console.error('Failed to record browser session:', error);
    }
  }

  /**
   * Log action to database
   */
  private async logAction(action: BrowserAction, result: BrowserActionResult): Promise<void> {
    try {
      await supabase.from('browser_actions').insert({
        session_id: this.sessionId,
        action_type: action.type,
        action_data: action.params as Record<string, unknown>,
        result: {
          success: result.success,
          data: result.data,
          error: result.error,
        },
        screenshot_url: result.data?.screenshotStorageKey,
        created_at: result.timing.startedAt.toISOString(),
      } as never);
    } catch (error) {
      console.error('Failed to log browser action:', error);
    }
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }
}

/**
 * Create a browser client for a task
 */
export function createBrowserClient(taskId: string, userId: string): BrowserClient {
  return new BrowserClient(taskId, userId);
}
