import type { Tool, AgentContext, ToolResult } from '../tools/types';

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  durationMs: number;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// Agent plan for Layer 2 validation
export interface AgentPlan {
  id: string;
  taskId: string;
  steps: PlanStep[];
  estimatedDuration?: number;
  estimatedCost?: number;
  requiredPermissions: string[];
}

export interface PlanStep {
  id: string;
  toolName: string;
  params: unknown;
  dependsOn?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// Safety configuration
export interface SafetyConfig {
  maxInputSize: number;
  maxOutputSize: number;
  maxPlanSteps: number;
  maxConcurrentTasks: number;
  commandTimeout: number;
  enablePIIMasking: boolean;
  enableSecretMasking: boolean;
  strictMode: boolean;
}

// Rate limit configuration per category
export interface CategoryRateLimits {
  shell: RateLimitConfig;
  file: RateLimitConfig;
  browser: RateLimitConfig;
  search: RateLimitConfig;
  webdev: RateLimitConfig;
  plan: RateLimitConfig;
  message: RateLimitConfig;
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

// Confirmation request for dangerous operations
export interface ConfirmationRequest {
  id: string;
  toolName: string;
  params: unknown;
  reason: string;
  riskLevel: 'moderate' | 'high' | 'critical';
  timeoutMs: number;
  createdAt: Date;
}

export interface ConfirmationResult {
  confirmed: boolean;
  userId: string;
  timestamp: Date;
  reason?: string;
}

// Default safety configuration
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxInputSize: 100 * 1024, // 100KB
  maxOutputSize: 50 * 1024, // 50KB
  maxPlanSteps: 50,
  maxConcurrentTasks: 5,
  commandTimeout: 30000, // 30s
  enablePIIMasking: true,
  enableSecretMasking: true,
  strictMode: true,
};

// Rate limits per tool category
export const CATEGORY_RATE_LIMITS: CategoryRateLimits = {
  shell: { requests: 10, windowMs: 60000 },
  file: { requests: 50, windowMs: 60000 },
  browser: { requests: 20, windowMs: 60000 },
  search: { requests: 30, windowMs: 60000 },
  webdev: { requests: 10, windowMs: 60000 },
  plan: { requests: 30, windowMs: 60000 },
  message: { requests: 50, windowMs: 60000 },
};
