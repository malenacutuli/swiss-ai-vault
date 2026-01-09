import { z } from 'zod';

// shell.exec - Execute shell command
export const shellExecSchema = z.object({
  command: z.string().min(1).max(10000).describe('The shell command to execute'),
  workingDir: z.string().optional().describe('Working directory for command execution'),
  timeout: z.number().min(1000).max(300000).optional().default(30000).describe('Execution timeout in milliseconds'),
  env: z.record(z.string()).optional().describe('Environment variables to set'),
});

export type ShellExecParams = z.infer<typeof shellExecSchema>;

// shell.view - View command output history
export const shellViewSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(10).describe('Number of recent commands to view'),
  sessionId: z.string().optional().describe('Filter by session ID'),
});

export type ShellViewParams = z.infer<typeof shellViewSchema>;
