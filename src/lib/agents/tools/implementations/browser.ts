import type { Tool, AgentContext, ToolResult } from '../types';
import { browserNavigateSchema, browserClickSchema, browserTypeSchema, browserScreenshotSchema } from '../schemas/browser';

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
    
    console.log('[browser.navigate] Navigating to:', validated.url);
    
    return {
      success: true,
      output: {
        url: validated.url,
        title: `[Simulated] Page at ${validated.url}`,
        loadTime: 1500,
      },
      metadata: {
        browserSessionId: context.browserSessionId,
      },
    };
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
    
    console.log('[browser.click] Clicking:', validated.selector);
    
    return {
      success: true,
      output: {
        selector: validated.selector,
        clicked: true,
        button: validated.button,
      },
    };
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
    
    console.log('[browser.type] Typing into:', validated.selector, 'text length:', validated.text.length);
    
    return {
      success: true,
      output: {
        selector: validated.selector,
        typed: true,
        length: validated.text.length,
      },
    };
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
    
    console.log('[browser.screenshot] Taking screenshot, fullPage:', validated.fullPage);
    
    return {
      success: true,
      output: {
        format: validated.format,
        fullPage: validated.fullPage,
        url: '[Simulated screenshot URL]',
      },
    };
  },
};
