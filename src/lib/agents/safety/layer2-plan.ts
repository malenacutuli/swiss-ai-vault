/**
 * LAYER 2: PLANNING VALIDATION
 * 
 * Validates agent execution plans before they start.
 * - Maximum steps limit (50)
 * - Infinite loop detection
 * - Resource budget checking
 * - Dangerous operation sequence detection
 */

import type { AgentPlan, ValidationResult, ValidationError, ValidationWarning, SafetyConfig } from './types';
import { DEFAULT_SAFETY_CONFIG } from './types';
import { toolRegistry } from '../tools/registry';

// Maximum allowed steps in a plan
const MAX_PLAN_STEPS = 50;

// Maximum execution time budget (5 minutes)
const MAX_EXECUTION_TIME = 5 * 60 * 1000;

// Maximum cost budget ($1.00)
const MAX_COST_BUDGET = 1.0;

// Dangerous tool sequences
const DANGEROUS_SEQUENCES: Array<{ pattern: string[]; reason: string }> = [
  {
    pattern: ['file.delete', 'file.delete', 'file.delete'],
    reason: 'Multiple consecutive file deletions detected',
  },
  {
    pattern: ['shell.exec', 'shell.exec', 'shell.exec', 'shell.exec', 'shell.exec'],
    reason: 'Excessive shell command execution',
  },
  {
    pattern: ['browser.navigate', 'browser.click', 'browser.type'],
    reason: 'Automated form submission sequence (requires extra scrutiny)',
  },
];

export async function validatePlan(
  plan: AgentPlan,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): Promise<ValidationResult> {
  const startTime = performance.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // 1. Validate step count
    const stepCountResult = validateStepCount(plan, config.maxPlanSteps || MAX_PLAN_STEPS);
    errors.push(...stepCountResult.errors);
    warnings.push(...stepCountResult.warnings);

    // 2. Check for infinite loops
    const loopResult = detectInfiniteLoops(plan);
    errors.push(...loopResult.errors);
    warnings.push(...loopResult.warnings);

    // 3. Validate resource budget
    const budgetResult = validateResourceBudget(plan);
    errors.push(...budgetResult.errors);
    warnings.push(...budgetResult.warnings);

    // 4. Check for dangerous sequences
    const sequenceResult = detectDangerousSequences(plan);
    errors.push(...sequenceResult.errors);
    warnings.push(...sequenceResult.warnings);

    // 5. Validate tool availability
    const toolResult = validateToolAvailability(plan);
    errors.push(...toolResult.errors);
    warnings.push(...toolResult.warnings);

    // 6. Validate permissions
    const permResult = validatePermissions(plan);
    errors.push(...permResult.errors);
    warnings.push(...permResult.warnings);

    const hasErrors = errors.some(e => e.severity === 'critical' || e.severity === 'error');
    return createResult(!hasErrors, errors, warnings, startTime);

  } catch (error) {
    errors.push({
      code: 'PLAN_VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Plan validation failed',
      severity: 'critical',
    });
    return createResult(false, errors, warnings, startTime);
  }
}

function validateStepCount(
  plan: AgentPlan,
  maxSteps: number
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (plan.steps.length > maxSteps) {
    errors.push({
      code: 'TOO_MANY_STEPS',
      message: `Plan has ${plan.steps.length} steps, maximum allowed is ${maxSteps}`,
      severity: 'error',
    });
  } else if (plan.steps.length > maxSteps * 0.8) {
    warnings.push({
      code: 'STEP_COUNT_WARNING',
      message: `Plan has ${plan.steps.length} steps, approaching limit of ${maxSteps}`,
    });
  }

  if (plan.steps.length === 0) {
    errors.push({
      code: 'EMPTY_PLAN',
      message: 'Plan has no steps',
      severity: 'error',
    });
  }

  return { errors, warnings };
}

function detectInfiniteLoops(plan: AgentPlan): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Build dependency graph
  const deps = new Map<string, Set<string>>();
  for (const step of plan.steps) {
    deps.set(step.id, new Set(step.dependsOn || []));
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const dependencies = deps.get(nodeId) || new Set();
    for (const dep of dependencies) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const step of plan.steps) {
    if (hasCycle(step.id)) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected involving step ${step.id}`,
        field: step.id,
        severity: 'critical',
      });
      break;
    }
  }

  // Check for self-dependencies
  for (const step of plan.steps) {
    if (step.dependsOn?.includes(step.id)) {
      errors.push({
        code: 'SELF_DEPENDENCY',
        message: `Step ${step.id} depends on itself`,
        field: step.id,
        severity: 'error',
      });
    }
  }

  // Check for repeated identical steps (potential infinite loop indicator)
  const stepSignatures = plan.steps.map(s => `${s.toolName}:${JSON.stringify(s.params)}`);
  const signatureCounts = new Map<string, number>();
  for (const sig of stepSignatures) {
    signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  }

  for (const [sig, count] of signatureCounts) {
    if (count > 5) {
      warnings.push({
        code: 'REPEATED_STEP',
        message: `Step pattern repeated ${count} times: ${sig.substring(0, 50)}...`,
      });
    }
  }

  return { errors, warnings };
}

function validateResourceBudget(plan: AgentPlan): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Estimate execution time
  const estimatedTime = plan.estimatedDuration || estimateExecutionTime(plan);
  if (estimatedTime > MAX_EXECUTION_TIME) {
    errors.push({
      code: 'EXECUTION_TIME_EXCEEDED',
      message: `Estimated execution time ${estimatedTime}ms exceeds maximum ${MAX_EXECUTION_TIME}ms`,
      severity: 'error',
    });
  } else if (estimatedTime > MAX_EXECUTION_TIME * 0.8) {
    warnings.push({
      code: 'EXECUTION_TIME_WARNING',
      message: `Estimated execution time approaching limit`,
    });
  }

  // Estimate cost
  const estimatedCost = plan.estimatedCost || estimateCost(plan);
  if (estimatedCost > MAX_COST_BUDGET) {
    errors.push({
      code: 'COST_BUDGET_EXCEEDED',
      message: `Estimated cost $${estimatedCost.toFixed(2)} exceeds budget $${MAX_COST_BUDGET.toFixed(2)}`,
      severity: 'error',
    });
  } else if (estimatedCost > MAX_COST_BUDGET * 0.8) {
    warnings.push({
      code: 'COST_BUDGET_WARNING',
      message: `Estimated cost approaching budget limit`,
    });
  }

  return { errors, warnings };
}

function detectDangerousSequences(plan: AgentPlan): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const toolSequence = plan.steps.map(s => s.toolName);

  for (const { pattern, reason } of DANGEROUS_SEQUENCES) {
    if (containsSequence(toolSequence, pattern)) {
      if (pattern.some(p => p.includes('delete'))) {
        errors.push({
          code: 'DANGEROUS_SEQUENCE',
          message: reason,
          severity: 'error',
        });
      } else {
        warnings.push({
          code: 'SUSPICIOUS_SEQUENCE',
          message: reason,
        });
      }
    }
  }

  // Count dangerous operations
  const dangerousCount = plan.steps.filter(s => {
    const tool = toolRegistry.get(s.toolName);
    return tool?.safety === 'dangerous';
  }).length;

  if (dangerousCount > 3) {
    warnings.push({
      code: 'MANY_DANGEROUS_OPS',
      message: `Plan contains ${dangerousCount} dangerous operations`,
    });
  }

  return { errors, warnings };
}

function validateToolAvailability(plan: AgentPlan): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const step of plan.steps) {
    const tool = toolRegistry.get(step.toolName);
    if (!tool) {
      errors.push({
        code: 'TOOL_NOT_FOUND',
        message: `Tool ${step.toolName} not found in registry`,
        field: step.id,
        severity: 'error',
      });
    }
  }

  return { errors, warnings };
}

function validatePermissions(plan: AgentPlan): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Extract required permissions from steps
  const requiredPerms = new Set<string>();
  for (const step of plan.steps) {
    const tool = toolRegistry.get(step.toolName);
    if (tool) {
      requiredPerms.add(tool.category);
    }
  }

  // Check against declared permissions
  const declaredPerms = new Set(plan.requiredPermissions);
  for (const perm of requiredPerms) {
    if (!declaredPerms.has(perm)) {
      warnings.push({
        code: 'UNDECLARED_PERMISSION',
        message: `Plan uses ${perm} tools but permission not declared`,
      });
    }
  }

  return { errors, warnings };
}

// Helper: Check if array contains a subsequence
function containsSequence(arr: string[], pattern: string[]): boolean {
  for (let i = 0; i <= arr.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (arr[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// Helper: Estimate execution time based on steps
function estimateExecutionTime(plan: AgentPlan): number {
  let total = 0;
  for (const step of plan.steps) {
    const tool = toolRegistry.get(step.toolName);
    if (tool) {
      // Base time estimates per category
      const estimates: Record<string, number> = {
        shell: 5000,
        file: 1000,
        browser: 10000,
        search: 3000,
        webdev: 15000,
        plan: 500,
        message: 1000,
      };
      total += estimates[tool.category] || 2000;
    }
  }
  return total;
}

// Helper: Estimate cost based on steps
function estimateCost(plan: AgentPlan): number {
  let total = 0;
  for (const step of plan.steps) {
    const tool = toolRegistry.get(step.toolName);
    if (tool) {
      // Cost estimates per category (in dollars)
      const estimates: Record<string, number> = {
        shell: 0.01,
        file: 0.001,
        browser: 0.05,
        search: 0.02,
        webdev: 0.05,
        plan: 0.001,
        message: 0.001,
      };
      total += estimates[tool.category] || 0.01;
    }
  }
  return total;
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
