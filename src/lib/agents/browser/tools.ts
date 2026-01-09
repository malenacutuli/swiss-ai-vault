import { z } from 'zod';
import type { Tool } from '../tools/types';

/**
 * Browser navigation tool
 */
export const browserNavigate: Tool = {
  name: 'browser.navigate',
  description: 'Navigate to a URL in the browser. Returns page title, status code, and optional screenshot.',
  category: 'browser',
  schema: z.object({
    url: z.string().describe('The URL to navigate to'),
    waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']).default('domcontentloaded').describe('When to consider navigation complete'),
    screenshot: z.boolean().default(true).describe('Whether to capture a screenshot after navigation'),
    timeout: z.number().default(60000).describe('Navigation timeout in milliseconds'),
  }),
  safety: 'moderate',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    // Execution handled by backend Edge Function
    return { success: true, output: { message: 'Browser navigation executed on backend' } };
  },
};

/**
 * Browser click tool
 */
export const browserClick: Tool = {
  name: 'browser.click',
  description: 'Click on an element using a CSS selector. Can wait for navigation after click.',
  category: 'browser',
  schema: z.object({
    selector: z.string().describe('CSS selector for the element to click'),
    waitForNavigation: z.boolean().default(false).describe('Whether to wait for page navigation after click'),
    timeout: z.number().default(30000).describe('Timeout for finding the element'),
    button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button to use'),
  }),
  safety: 'moderate',
  rateLimit: { requests: 50, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser click executed on backend' } };
  },
};

/**
 * Browser type tool
 */
export const browserType: Tool = {
  name: 'browser.type',
  description: 'Type text into an input field. Can clear existing content first.',
  category: 'browser',
  schema: z.object({
    selector: z.string().describe('CSS selector for the input element'),
    text: z.string().describe('Text to type'),
    delay: z.number().default(50).describe('Delay between keystrokes in milliseconds'),
    clear: z.boolean().default(true).describe('Whether to clear the input before typing'),
  }),
  safety: 'moderate',
  rateLimit: { requests: 50, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser type executed on backend' } };
  },
};

/**
 * Browser screenshot tool
 */
export const browserScreenshot: Tool = {
  name: 'browser.screenshot',
  description: 'Take a screenshot of the current page or a specific element.',
  category: 'browser',
  schema: z.object({
    fullPage: z.boolean().default(false).describe('Whether to capture the full scrollable page'),
    selector: z.string().optional().describe('CSS selector to screenshot a specific element'),
    format: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
  }),
  safety: 'safe',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser screenshot executed on backend' } };
  },
};

/**
 * Browser scroll tool
 */
export const browserScroll: Tool = {
  name: 'browser.scroll',
  description: 'Scroll the page or an element in a specific direction.',
  category: 'browser',
  schema: z.object({
    direction: z.enum(['up', 'down', 'left', 'right']).describe('Direction to scroll'),
    amount: z.number().default(500).describe('Amount to scroll in pixels'),
    selector: z.string().optional().describe('CSS selector for scrollable element (defaults to page)'),
  }),
  safety: 'safe',
  rateLimit: { requests: 100, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser scroll executed on backend' } };
  },
};

/**
 * Browser extract tool
 */
export const browserExtract: Tool = {
  name: 'browser.extract',
  description: 'Extract content from the page: text, HTML, links, images, or tables.',
  category: 'browser',
  schema: z.object({
    extractType: z.enum(['text', 'html', 'attribute', 'links', 'images', 'tables']).describe('Type of content to extract'),
    selector: z.string().optional().describe('CSS selector to limit extraction scope'),
    attribute: z.string().optional().describe('Attribute name when extractType is "attribute"'),
    limit: z.number().default(100).describe('Maximum number of items to extract'),
  }),
  safety: 'safe',
  rateLimit: { requests: 50, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser extract executed on backend' } };
  },
};

/**
 * Browser wait tool
 */
export const browserWait: Tool = {
  name: 'browser.wait',
  description: 'Wait for an element to appear, navigation to complete, or a timeout.',
  category: 'browser',
  schema: z.object({
    selector: z.string().optional().describe('CSS selector to wait for'),
    state: z.enum(['attached', 'detached', 'visible', 'hidden']).default('visible').describe('Element state to wait for'),
    waitFor: z.enum(['navigation', 'load', 'networkidle']).optional().describe('Wait for navigation event instead of element'),
    timeout: z.number().default(30000).describe('Maximum time to wait in milliseconds'),
  }),
  safety: 'safe',
  rateLimit: { requests: 100, windowMs: 60000 },
  requiresConfirmation: false,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser wait executed on backend' } };
  },
};

/**
 * Browser fill form tool
 */
export const browserFillForm: Tool = {
  name: 'browser.fill_form',
  description: 'Fill multiple form fields at once and optionally submit.',
  category: 'browser',
  schema: z.object({
    fields: z.array(z.object({
      selector: z.string(),
      value: z.string(),
      type: z.enum(['text', 'select', 'checkbox', 'radio']).default('text'),
    })).describe('Form fields to fill'),
    submit: z.boolean().default(false).describe('Whether to submit the form after filling'),
    submitSelector: z.string().optional().describe('Selector for submit button (if submit is true)'),
  }),
  safety: 'moderate',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: true,
  async execute(params, context) {
    return { success: true, output: { message: 'Browser fill form executed on backend' } };
  },
};

/**
 * All browser tools
 */
export const browserTools: Tool[] = [
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  browserScroll,
  browserExtract,
  browserWait,
  browserFillForm,
];

/**
 * Get browser tool by name
 */
export function getBrowserTool(name: string): Tool | undefined {
  return browserTools.find(tool => tool.name === name);
}
