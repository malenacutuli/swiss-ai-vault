import type { Tool, AgentContext, ToolResult } from '../types';
import { webdevInitSchema, webdevPreviewSchema } from '../schemas/webdev';
import { supabase } from '@/integrations/supabase/client';

// Template configurations
const TEMPLATE_CONFIGS: Record<string, { files: string[]; commands: string[] }> = {
  'react-vite': {
    files: ['package.json', 'vite.config.ts', 'index.html', 'src/main.tsx', 'src/App.tsx'],
    commands: ['npm create vite@latest {name} -- --template react-ts', 'cd {name} && npm install'],
  },
  'next-app': {
    files: ['package.json', 'next.config.js', 'tsconfig.json', 'app/page.tsx', 'app/layout.tsx'],
    commands: ['npx create-next-app@latest {name} --typescript --tailwind --app'],
  },
  'vue-vite': {
    files: ['package.json', 'vite.config.ts', 'index.html', 'src/main.ts', 'src/App.vue'],
    commands: ['npm create vite@latest {name} -- --template vue-ts', 'cd {name} && npm install'],
  },
  'svelte-kit': {
    files: ['package.json', 'svelte.config.js', 'vite.config.ts', 'src/routes/+page.svelte'],
    commands: ['npm create svelte@latest {name}', 'cd {name} && npm install'],
  },
  'express-api': {
    files: ['package.json', 'tsconfig.json', 'src/index.ts', 'src/routes/index.ts'],
    commands: ['mkdir {name} && cd {name} && npm init -y && npm install express typescript @types/express'],
  },
  'fastapi': {
    files: ['requirements.txt', 'main.py', 'app/__init__.py', 'app/routers/__init__.py'],
    commands: ['mkdir {name} && cd {name} && python -m venv venv && pip install fastapi uvicorn'],
  },
  'static-html': {
    files: ['index.html', 'css/style.css', 'js/main.js'],
    commands: ['mkdir {name} && cd {name} && mkdir css js'],
  },
};

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
    const startTime = Date.now();
    
    console.log('[webdev.init] Initializing project:', validated.name, 'template:', validated.template);
    
    const templateConfig = TEMPLATE_CONFIGS[validated.template];
    if (!templateConfig) {
      return {
        success: false,
        error: `Unknown template: ${validated.template}`,
      };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'webdev_init',
          name: validated.name,
          template: validated.template,
          task_id: context.taskId,
          user_id: context.userId,
          path: validated.path || `./${validated.name}`,
          features: validated.features || [],
          package_manager: validated.packageManager || 'npm',
          commands: templateConfig.commands.map(cmd => cmd.replace(/{name}/g, validated.name)),
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
          name: validated.name,
          template: validated.template,
          path: validated.path || `./${validated.name}`,
          features: validated.features || [],
          packageManager: validated.packageManager || 'npm',
          initialized: true,
          filesCreated: data?.files_created || templateConfig.files.length,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Project initialization failed',
        durationMs: Date.now() - startTime,
      };
    }
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
    const startTime = Date.now();
    
    console.log('[webdev.preview] Starting dev server on port:', validated.port);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'webdev_preview',
          task_id: context.taskId,
          user_id: context.userId,
          path: validated.path || context.workspacePath,
          port: validated.port || 3000,
          command: validated.command,
          env: validated.env || {},
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
      
      const previewUrl = data?.url || `http://localhost:${validated.port || 3000}`;
      
      // Update session with browser URL if available
      if (context.sessionId) {
        await supabase
          .from('agent_sessions')
          .update({ 
            browser_url: previewUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', context.sessionId);
      }
      
      return {
        success: true,
        output: {
          port: validated.port || 3000,
          url: previewUrl,
          status: 'running',
          pid: data?.pid,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to start dev server',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
