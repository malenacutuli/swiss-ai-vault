import { z } from 'zod';

// browser.navigate - Navigate to URL
export const browserNavigateSchema = z.object({
  url: z.string().url().max(2000).describe('URL to navigate to'),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load').describe('Wait condition'),
  timeout: z.number().min(1000).max(60000).optional().default(30000).describe('Navigation timeout in milliseconds'),
});

export type BrowserNavigateParams = z.infer<typeof browserNavigateSchema>;

// browser.click - Click element
export const browserClickSchema = z.object({
  selector: z.string().min(1).max(500).describe('CSS selector or XPath of element to click'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button to use'),
  clickCount: z.number().min(1).max(3).optional().default(1).describe('Number of clicks'),
  delay: z.number().min(0).max(5000).optional().default(0).describe('Delay between clicks in milliseconds'),
});

export type BrowserClickParams = z.infer<typeof browserClickSchema>;

// browser.type - Type into input
export const browserTypeSchema = z.object({
  selector: z.string().min(1).max(500).describe('CSS selector or XPath of input element'),
  text: z.string().max(10000).describe('Text to type'),
  delay: z.number().min(0).max(500).optional().default(50).describe('Delay between keystrokes in milliseconds'),
  clear: z.boolean().optional().default(false).describe('Clear existing content before typing'),
});

export type BrowserTypeParams = z.infer<typeof browserTypeSchema>;

// browser.screenshot - Take screenshot
export const browserScreenshotSchema = z.object({
  selector: z.string().max(500).optional().describe('CSS selector for element screenshot (full page if omitted)'),
  fullPage: z.boolean().optional().default(false).describe('Capture full scrollable page'),
  format: z.enum(['png', 'jpeg', 'webp']).optional().default('png').describe('Image format'),
  quality: z.number().min(0).max(100).optional().default(80).describe('Image quality (jpeg/webp only)'),
});

export type BrowserScreenshotParams = z.infer<typeof browserScreenshotSchema>;
