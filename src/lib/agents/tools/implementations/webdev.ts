import type { Tool, AgentContext, ToolResult } from '../types';
import { webdevInitSchema, webdevPreviewSchema } from '../schemas/webdev';

// webdev.init - Initialize project from template
export const webdevInit: Tool = {
  name: 'webdev.init',
  description: 'Initialize a new web development project from a template with optional features.',
  category: 'webdev',
  schema: webdevInitSchema,
  safety: 'moderate',
  rateLimit: { requests: 5, windowMs: 300000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = webdevInitSchema.parse(params);
    
    console.log('[webdev.init] Initializing project:', validated.name, 'template:', validated.template);
    
    return {
      success: true,
      output: {
        name: validated.name,
        template: validated.template,
        path: validated.path || `./${validated.name}`,
        features: validated.features || [],
        packageManager: validated.packageManager,
        initialized: true,
      },
    };
  },
};

// webdev.preview - Start dev server preview
export const webdevPreview: Tool = {
  name: 'webdev.preview',
  description: 'Start a development server to preview the web project in the browser.',
  category: 'webdev',
  schema: webdevPreviewSchema,
  safety: 'moderate',
  rateLimit: { requests: 10, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = webdevPreviewSchema.parse(params);
    
    console.log('[webdev.preview] Starting dev server on port:', validated.port);
    
    return {
      success: true,
      output: {
        port: validated.port,
        url: `http://localhost:${validated.port}`,
        status: 'running',
      },
    };
  },
};
