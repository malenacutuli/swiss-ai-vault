/**
 * LAYER 3: EXECUTION VALIDATION
 * 
 * Real-time validation during tool execution.
 * - Rate limit checking
 * - User confirmation for dangerous operations
 * - Resource availability checks
 * - Concurrent execution limits
 */

import type { Tool, AgentContext } from '../tools/types';
import type { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning, 
  SafetyConfig,
  CategoryRateLimits,
  ConfirmationRequest,
  ConfirmationResult,
} from './types';
import { DEFAULT_SAFETY_CONFIG, CATEGORY_RATE_LIMITS } from './types';

// In-memory rate limit tracking
const rateLimitStates = new Map<string, { count: number; windowStart: number }>();

// In-memory concurrent task tracking
const concurrentTasks = new Map<string, Set<string>>();

// Pending confirmations
const pendingConfirmations = new Map<string, {
  request: ConfirmationRequest;
  resolve: (result: ConfirmationResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

// Confirmation timeout (30 seconds)
const CONFIRMATION_TIMEOUT = 30000;

export async function validateExecution(
  tool: Tool,
  params: unknown,
  context: AgentContext,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<ValidationResult> {
  const startTime = performance.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // 1. Check rate limits
    const rateResult = checkRateLimit(tool, context.userId, CATEGORY_RATE_LIMITS);
    errors.push(...rateResult.errors);
    warnings.push(...rateResult.warnings);

    // 2. Check concurrent execution limits
    const concurrentResult = checkConcurrentLimit(context, config.maxConcurrentTasks);
    errors.push(...concurrentResult.errors);
    warnings.push(...concurrentResult.warnings);

    // 3. Handle dangerous operation confirmation
    if (tool.requiresConfirmation && tool.safety === 'dangerous') {
      const confirmResult = await handleConfirmation(tool, params, context);
      errors.push(...confirmResult.errors);
      warnings.push(...confirmResult.warnings);
    }

    // 4. Check resource availability
    const resourceResult = checkResourceAvailability(context);
    errors.push(...resourceResult.errors);
    warnings.push(...resourceResult.warnings);

    const hasErrors = errors.some(e => e.severity === 'critical' || e.severity === 'error');
    return createResult(!hasErrors, errors, warnings, startTime);

  } catch (error) {
    errors.push({
      code: 'EXECUTION_VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Execution validation failed',
      severity: 'critical',
    });
    return createResult(false, errors, warnings, startTime);
  }
}

function checkRateLimit(
  tool: Tool,
  userId: string,
  limits: CategoryRateLimits
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const categoryLimit = limits[tool.category];
  const key = `${userId}:${tool.category}`;
  const now = Date.now();

  let state = rateLimitStates.get(key);

  // Initialize or reset if window expired
  if (!state || now - state.windowStart > categoryLimit.windowMs) {
    state = { count: 0, windowStart: now };
    rateLimitStates.set(key, state);
  }

  // Check limit
  if (state.count >= categoryLimit.requests) {
    const resetIn = Math.ceil((categoryLimit.windowMs - (now - state.windowStart)) / 1000);
    errors.push({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded for ${tool.category} tools. Try again in ${resetIn}s`,
      severity: 'error',
    });
  } else if (state.count >= categoryLimit.requests * 0.8) {
    warnings.push({
      code: 'RATE_LIMIT_WARNING',
      message: `Approaching rate limit for ${tool.category} tools (${state.count}/${categoryLimit.requests})`,
    });
  }

  // Increment count
  state.count++;

  return { errors, warnings };
}

function checkConcurrentLimit(
  context: AgentContext,
  maxConcurrent: number
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const userTasks = concurrentTasks.get(context.userId) || new Set();

  if (userTasks.size >= maxConcurrent) {
    errors.push({
      code: 'CONCURRENT_LIMIT_EXCEEDED',
      message: `Maximum concurrent tasks (${maxConcurrent}) reached`,
      severity: 'error',
    });
  } else if (userTasks.size >= maxConcurrent - 1) {
    warnings.push({
      code: 'CONCURRENT_LIMIT_WARNING',
      message: `Approaching concurrent task limit (${userTasks.size}/${maxConcurrent})`,
    });
  }

  return { errors, warnings };
}

async function handleConfirmation(
  tool: Tool,
  params: unknown,
  context: AgentContext
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // If context has a confirmation callback, use it
  if (context.confirmationCallback) {
    try {
      const confirmed = await context.confirmationCallback(tool.name, params);
      if (!confirmed) {
        errors.push({
          code: 'USER_DENIED',
          message: 'User declined to confirm dangerous operation',
          severity: 'error',
        });
      }
    } catch (error) {
      errors.push({
        code: 'CONFIRMATION_ERROR',
        message: error instanceof Error ? error.message : 'Confirmation failed',
        severity: 'error',
      });
    }
  } else {
    // No callback, require explicit confirmation
    warnings.push({
      code: 'NO_CONFIRMATION_HANDLER',
      message: 'Dangerous operation requires confirmation but no handler available',
    });
  }

  return { errors, warnings };
}

function checkResourceAvailability(
  context: AgentContext
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if workspace is available
  if (!context.workspacePath) {
    warnings.push({
      code: 'NO_WORKSPACE',
      message: 'No workspace path configured',
    });
  }

  // Check browser session for browser tools
  if (!context.browserSessionId) {
    // Not an error, just a note
  }

  return { errors, warnings };
}

// Public API: Register task start
export function registerTaskStart(userId: string, taskId: string): void {
  if (!concurrentTasks.has(userId)) {
    concurrentTasks.set(userId, new Set());
  }
  concurrentTasks.get(userId)!.add(taskId);
}

// Public API: Register task end
export function registerTaskEnd(userId: string, taskId: string): void {
  concurrentTasks.get(userId)?.delete(taskId);
}

// Public API: Request confirmation from user
export function requestConfirmation(
  toolName: string,
  params: unknown,
  context: AgentContext,
  riskLevel: 'moderate' | 'high' | 'critical' = 'high'
): Promise<ConfirmationResult> {
  const id = `${context.taskId}:${Date.now()}`;
  
  const request: ConfirmationRequest = {
    id,
    toolName,
    params,
    reason: `Tool ${toolName} requires confirmation`,
    riskLevel,
    timeoutMs: CONFIRMATION_TIMEOUT,
    createdAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingConfirmations.delete(id);
      resolve({
        confirmed: false,
        userId: context.userId,
        timestamp: new Date(),
        reason: 'Confirmation timed out',
      });
    }, CONFIRMATION_TIMEOUT);

    pendingConfirmations.set(id, {
      request,
      resolve,
      reject,
      timeoutId,
    });
  });
}

// Public API: Respond to confirmation
export function respondToConfirmation(
  confirmationId: string,
  confirmed: boolean,
  userId: string,
  reason?: string
): boolean {
  const pending = pendingConfirmations.get(confirmationId);
  if (!pending) {
    return false;
  }

  clearTimeout(pending.timeoutId);
  pendingConfirmations.delete(confirmationId);

  pending.resolve({
    confirmed,
    userId,
    timestamp: new Date(),
    reason,
  });

  return true;
}

// Public API: Get pending confirmations for user
export function getPendingConfirmations(userId: string): ConfirmationRequest[] {
  const results: ConfirmationRequest[] = [];
  for (const [, { request }] of pendingConfirmations) {
    results.push(request);
  }
  return results;
}

// Public API: Reset rate limits (for testing)
export function resetRateLimits(): void {
  rateLimitStates.clear();
}

// Public API: Reset concurrent tasks (for testing)
export function resetConcurrentTasks(): void {
  concurrentTasks.clear();
}

function createResult(
  valid: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  startTime: number
): ValidationResult {
  return {
    valid,
    errors,
    warnings,
    durationMs: performance.now() - startTime,
  };
}
