import { z } from 'zod';

// webdev.init - Initialize project from template
export const webdevInitSchema = z.object({
  template: z.enum([
    'react-vite',
    'next-app',
    'vue-vite',
    'svelte-kit',
    'express-api',
    'fastapi',
    'static-html',
  ]).describe('Project template to use'),
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).describe('Project name (lowercase, alphanumeric, hyphens only)'),
  path: z.string().max(500).optional().describe('Path to initialize project (defaults to workspace root)'),
  features: z.array(z.enum([
    'typescript',
    'tailwind',
    'shadcn',
    'prisma',
    'supabase',
    'auth',
    'testing',
  ])).optional().describe('Additional features to include'),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).optional().default('npm').describe('Package manager to use'),
});

export type WebdevInitParams = z.infer<typeof webdevInitSchema>;

// webdev.preview - Start dev server preview
export const webdevPreviewSchema = z.object({
  path: z.string().max(500).optional().describe('Project path (defaults to current workspace)'),
  port: z.number().min(1024).max(65535).optional().default(3000).describe('Port to run dev server on'),
  command: z.string().max(500).optional().describe('Custom start command (defaults to package.json scripts.dev)'),
  env: z.record(z.string()).optional().describe('Environment variables for the dev server'),
  open: z.boolean().optional().default(true).describe('Open browser after starting'),
});

export type WebdevPreviewParams = z.infer<typeof webdevPreviewSchema>;
