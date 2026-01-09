/**
 * Swiss Agents Safety Rails
 * 
 * 4-layer safety system for agent tool execution:
 * - Layer 1: Input validation
 * - Layer 2: Plan validation
 * - Layer 3: Execution validation
 * - Layer 4: Output validation
 */

// Types
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AgentPlan,
  PlanStep,
  SafetyConfig,
  CategoryRateLimits,
  RateLimitConfig,
  ConfirmationRequest,
  ConfirmationResult,
} from './types';

export { DEFAULT_SAFETY_CONFIG, CATEGORY_RATE_LIMITS } from './types';

// Layer 1: Input Validation
export { validateInput } from './layer1-input';

// Layer 2: Plan Validation
export { validatePlan } from './layer2-plan';

// Layer 3: Execution Validation
export { 
  validateExecution,
  registerTaskStart,
  registerTaskEnd,
  requestConfirmation,
  respondToConfirmation,
  getPendingConfirmations,
  resetRateLimits,
  resetConcurrentTasks,
} from './layer3-execution';

// Layer 4: Output Validation
export { 
  validateOutput, 
  sanitizeOutput,
  type SanitizedOutput,
} from './layer4-output';

// Blacklist utilities
export {
  BLOCKED_COMMANDS,
  BLOCKED_PATTERNS,
  isCommandBlocked,
  hasSQLInjection,
  hasPathTraversal,
  maskPII,
  maskSecrets,
} from './blacklist';

// Unified validation function
import type { Tool, AgentContext, ToolResult } from '../tools/types';
import type { ValidationResult, SafetyConfig, AgentPlan } from './types';
import { DEFAULT_SAFETY_CONFIG } from './types';
import { validateInput } from './layer1-input';
import { validatePlan } from './layer2-plan';
import { validateExecution } from './layer3-execution';
import { validateOutput, sanitizeOutput } from './layer4-output';

export interface FullValidationResult {
  valid: boolean;
  inputValidation: ValidationResult;
  planValidation?: ValidationResult;
  executionValidation?: ValidationResult;
  outputValidation?: ValidationResult;
  totalDurationMs: number;
}

/**
 * Validate all layers for a tool execution
 */
export async function validateAll(
  tool: Tool,
  params: unknown,
  context: AgentContext,
  plan?: AgentPlan,
  result?: ToolResult,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<FullValidationResult> {
  const startTime = performance.now();

  // Layer 1: Input
  const inputValidation = await validateInput(tool, params, config);
  
  // Layer 2: Plan (optional)
  let planValidation: ValidationResult | undefined;
  if (plan) {
    planValidation = await validatePlan(plan, config);
  }

  // Layer 3: Execution (only if input passed)
  let executionValidation: ValidationResult | undefined;
  if (inputValidation.valid) {
    executionValidation = await validateExecution(tool, params, context, config);
  }

  // Layer 4: Output (only if we have a result)
  let outputValidation: ValidationResult | undefined;
  if (result) {
    outputValidation = await validateOutput(result, config);
  }

  const valid = 
    inputValidation.valid &&
    (!planValidation || planValidation.valid) &&
    (!executionValidation || executionValidation.valid) &&
    (!outputValidation || outputValidation.valid);

  return {
    valid,
    inputValidation,
    planValidation,
    executionValidation,
    outputValidation,
    totalDurationMs: performance.now() - startTime,
  };
}

/**
 * Quick pre-execution validation (Layer 1 + 3)
 */
export async function validatePreExecution(
  tool: Tool,
  params: unknown,
  context: AgentContext,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<{ valid: boolean; errors: string[] }> {
  const inputResult = await validateInput(tool, params, config);
  if (!inputResult.valid) {
    return {
      valid: false,
      errors: inputResult.errors.map(e => e.message),
    };
  }

  const execResult = await validateExecution(tool, params, context, config);
  if (!execResult.valid) {
    return {
      valid: false,
      errors: execResult.errors.map(e => e.message),
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Post-execution sanitization and validation (Layer 4)
 */
export async function sanitizeAndValidate(
  result: ToolResult,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<{ valid: boolean; sanitized: ToolResult; warnings: string[] }> {
  const validation = await validateOutput(result, config);
  const sanitized = sanitizeOutput(result, config);

  return {
    valid: validation.valid,
    sanitized: {
      ...result,
      output: sanitized.output,
      truncated: sanitized.truncated,
      metadata: {
        ...result.metadata,
        piiMasked: sanitized.piiMasked,
        secretsMasked: sanitized.secretsMasked,
      },
    },
    warnings: validation.warnings.map(w => w.message),
  };
}
