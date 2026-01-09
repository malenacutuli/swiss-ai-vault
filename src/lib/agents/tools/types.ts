import { z } from 'zod';

// Tool categories matching Manus.im architecture
export type ToolCategory = 'shell' | 'file' | 'browser' | 'search' | 'webdev' | 'plan' | 'message';

// Safety classification for tools
export type ToolSafety = 'safe' | 'moderate' | 'dangerous';

// Rate limit configuration
export interface RateLimit {
  requests: number;
  windowMs: number;
}

// Tool execution context
export interface AgentContext {
  taskId: string;
  userId: string;
  sessionId?: string;
  workspacePath?: string;
  browserSessionId?: string;
  permissions: ToolCategory[];
  confirmationCallback?: (tool: string, params: unknown) => Promise<boolean>;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  truncated?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

// Tool definition
export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  schema: z.ZodSchema;
  safety: ToolSafety;
  rateLimit: RateLimit;
  requiresConfirmation: boolean;
  execute: (params: unknown, context: AgentContext) => Promise<ToolResult>;
}

// Tool registry type
export type ToolRegistry = Map<string, Tool>;

// Rate limit tracker
export interface RateLimitState {
  count: number;
  windowStart: number;
}

// Execution options
export interface ExecutionOptions {
  timeout?: number; // Default 30s
  maxOutputSize?: number; // Default 50KB
  skipRateLimit?: boolean;
  skipConfirmation?: boolean;
}

// Audit log entry
export interface ToolAuditEntry {
  toolName: string;
  taskId: string;
  userId: string;
  params: unknown;
  result: ToolResult;
  timestamp: Date;
  durationMs: number;
}
