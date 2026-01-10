import type { Tool, AgentContext, ToolResult } from '../types';
import { browserNavigateSchema, browserClickSchema, browserTypeSchema, browserScreenshotSchema } from '../schemas/browser';
import { validateUrl } from '../safety';
import { supabase } from '@/integrations/supabase/client';

// browser.navigate - Navigate to URL
export const browserNavigate: Tool = {
  name: 'browser.navigate',
  description: 'Navigate the browser to a specified URL. Waits for the page to load.',
  category: 'browser',
  schema: browserNavigateSchema,
  safety: 'moderate',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = browserNavigateSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validateUrl(validated.url);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'URL blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[browser.navigate] Navigating to:', validated.url);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'browser_navigate',
          url: validated.url,
          task_id: context.taskId,
          user_id: context.userId,
          browser_session_id: context.browserSessionId,
          wait_for: validated.waitFor || 'load',
          timeout: validated.timeout || 30000,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      // Update browser session with current URL
      if (context.browserSessionId) {
        await supabase
          .from('agent_browser_sessions')
          .update({ current_url: validated.url, updated_at: new Date().toISOString() })
          .eq('session_id', context.browserSessionId);
      }
      
      return {
        success: true,
        output: {
          url: validated.url,
          title: data?.title || '',
          loadTime: durationMs,
          status: data?.status || 200,
        },
        durationMs,
        metadata: {
          browserSessionId: context.browserSessionId,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Navigation failed',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// browser.click - Click element
export const browserClick: Tool = {
  name: 'browser.click',
  description: 'Click on an element in the browser using a CSS selector or XPath.',
  category: 'browser',
  schema: browserClickSchema,
  safety: 'moderate',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = browserClickSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[browser.click] Clicking:', validated.selector);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'browser_click',
          selector: validated.selector,
          task_id: context.taskId,
          user_id: context.userId,
          browser_session_id: context.browserSessionId,
          button: validated.button || 'left',
          click_count: validated.clickCount || 1,
          delay: validated.delay || 0,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      return {
        success: true,
        output: {
          selector: validated.selector,
          clicked: true,
          button: validated.button || 'left',
          elementText: data?.elementText,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Click failed',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// browser.type - Type into input
export const browserType: Tool = {
  name: 'browser.type',
  description: 'Type text into an input field in the browser.',
  category: 'browser',
  schema: browserTypeSchema,
  safety: 'moderate',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = browserTypeSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[browser.type] Typing into:', validated.selector, 'text length:', validated.text.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'browser_type',
          selector: validated.selector,
          text: validated.text,
          task_id: context.taskId,
          user_id: context.userId,
          browser_session_id: context.browserSessionId,
          delay: validated.delay || 50,
          clear: validated.clear || false,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      return {
        success: true,
        output: {
          selector: validated.selector,
          typed: true,
          length: validated.text.length,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Type failed',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// browser.screenshot - Take screenshot
export const browserScreenshot: Tool = {
  name: 'browser.screenshot',
  description: 'Take a screenshot of the current browser page or a specific element.',
  category: 'browser',
  schema: browserScreenshotSchema,
  safety: 'safe',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = browserScreenshotSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[browser.screenshot] Taking screenshot, fullPage:', validated.fullPage);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'browser_screenshot',
          task_id: context.taskId,
          user_id: context.userId,
          browser_session_id: context.browserSessionId,
          selector: validated.selector,
          full_page: validated.fullPage || false,
          format: validated.format || 'png',
          quality: validated.quality || 80,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      return {
        success: true,
        output: {
          format: validated.format || 'png',
          fullPage: validated.fullPage || false,
          url: data?.url || data?.screenshot_url,
          size: data?.size,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Screenshot failed',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
