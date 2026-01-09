import type { Tool, AgentContext, ToolResult, ExecutionOptions, RateLimitState, ToolAuditEntry } from './types';
import { toolRegistry } from './registry';

// Rate limit state tracker (in-memory, per-session)
const rateLimitStates = new Map<string, RateLimitState>();

// Default execution options
const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  timeout: 30000,
  maxOutputSize: 50 * 1024, // 50KB
  skipRateLimit: false,
  skipConfirmation: false,
};

// Generate rate limit key
function getRateLimitKey(toolName: string, userId: string): string {
  return `${toolName}:${userId}`;
}

// Check rate limit
function checkRateLimit(tool: Tool, userId: string): { allowed: boolean; resetIn?: number } {
  const key = getRateLimitKey(tool.name, userId);
  const state = rateLimitStates.get(key);
  const now = Date.now();
  
  if (!state) {
    rateLimitStates.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  // Check if window has expired
  if (now - state.windowStart > tool.rateLimit.windowMs) {
    rateLimitStates.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  // Check if limit exceeded
  if (state.count >= tool.rateLimit.requests) {
    const resetIn = tool.rateLimit.windowMs - (now - state.windowStart);
    return { allowed: false, resetIn };
  }
  
  // Increment count
  state.count++;
  return { allowed: true };
}

// Truncate output if too large
function truncateOutput(output: unknown, maxSize: number): { result: unknown; truncated: boolean } {
  const serialized = JSON.stringify(output);
  
  if (serialized.length <= maxSize) {
    return { result: output, truncated: false };
  }
  
  // Truncate and add indicator
  const truncated = serialized.substring(0, maxSize - 50);
  return {
    result: JSON.parse(truncated + '..."[TRUNCATED]"}'),
    truncated: true,
  };
}

// Execute with timeout
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Audit log function (in production, this would write to database)
function logAudit(entry: ToolAuditEntry): void {
  console.log('[ToolAudit]', JSON.stringify({
    tool: entry.toolName,
    task: entry.taskId,
    user: entry.userId,
    success: entry.result.success,
    duration: entry.durationMs,
    timestamp: entry.timestamp.toISOString(),
  }));
}

// Main tool executor
export async function executeTool(
  toolName: string,
  params: unknown,
  context: AgentContext,
  options: ExecutionOptions = {}
): Promise<ToolResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Get tool from registry
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return {
      success: false,
      error: `Tool not found: ${toolName}`,
    };
  }
  
  // Check permissions
  if (!context.permissions.includes(tool.category)) {
    return {
      success: false,
      error: `Permission denied: ${tool.category} tools not allowed`,
    };
  }
  
  // Check rate limit
  if (!opts.skipRateLimit) {
    const rateCheck = checkRateLimit(tool, context.userId);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil((rateCheck.resetIn || 0) / 1000)}s`,
      };
    }
  }
  
  // Request confirmation for dangerous tools
  if (tool.requiresConfirmation && !opts.skipConfirmation) {
    if (context.confirmationCallback) {
      const confirmed = await context.confirmationCallback(toolName, params);
      if (!confirmed) {
        return {
          success: false,
          error: 'User declined confirmation',
        };
      }
    }
  }
  
  // Validate input against schema
  try {
    tool.schema.parse(params);
  } catch (error) {
    return {
      success: false,
      error: `Invalid parameters: ${error instanceof Error ? error.message : 'Validation failed'}`,
    };
  }
  
  // Execute tool with timeout
  let result: ToolResult;
  try {
    result = await executeWithTimeout(
      tool.execute(params, context),
      opts.timeout,
      toolName
    );
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
  
  // Truncate output if needed
  if (result.output) {
    const { result: truncatedOutput, truncated } = truncateOutput(result.output, opts.maxOutputSize);
    result.output = truncatedOutput;
    result.truncated = truncated;
  }
  
  // Calculate duration
  const durationMs = Date.now() - startTime;
  result.durationMs = durationMs;
  
  // Log audit entry
  logAudit({
    toolName,
    taskId: context.taskId,
    userId: context.userId,
    params,
    result,
    timestamp: new Date(),
    durationMs,
  });
  
  return result;
}

// Get tool info without execution
export function getToolInfo(toolName: string): Tool | undefined {
  return toolRegistry.get(toolName);
}

// List all available tools
export function listTools(category?: string): Tool[] {
  const tools = Array.from(toolRegistry.values());
  if (category) {
    return tools.filter(t => t.category === category);
  }
  return tools;
}

// Get tools by safety level
export function getToolsBySafety(safety: 'safe' | 'moderate' | 'dangerous'): Tool[] {
  return Array.from(toolRegistry.values()).filter(t => t.safety === safety);
}

// Reset rate limits (for testing)
export function resetRateLimits(): void {
  rateLimitStates.clear();
}
