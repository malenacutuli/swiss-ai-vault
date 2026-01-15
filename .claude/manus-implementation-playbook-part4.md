# Manus Implementation Playbook Part 4: Critical Components

> **Author:** Manus AI  
> **Version:** 1.0  
> **Date:** January 2026  
> **Scope:** Tool Router Contract, Artifact Registry, Concurrency Model, Credit Enforcement

This document addresses four critical gaps that would cause production failures at scale: the canonical Tool Router interface, Artifact Registry with provenance, Concurrency/Locking model, and Credit Enforcement timing.

---

## Table of Contents

1. [Tool Router Contract](#1-tool-router-contract)
2. [Artifact Registry & Provenance](#2-artifact-registry--provenance)
3. [Concurrency & Locking Model](#3-concurrency--locking-model)
4. [Credit Enforcement Timing](#4-credit-enforcement-timing)
5. [Implementation Order](#5-implementation-order)

---

## 1. Tool Router Contract

### PR-025: Canonical Tool Execution Interface

The Tool Router is the **single point of entry** for all tool executions. Every tool call—whether browser automation, code execution, file generation, or connector action—flows through this interface.

#### 1.1 Core Interface Definitions

```typescript
// packages/tool-router/src/types.ts

/**
 * CANONICAL INTERFACE - DO NOT MODIFY WITHOUT MIGRATION PLAN
 * All tool executions MUST return this structure.
 */
export interface ToolExecutionResult {
  /** Tool-specific output data */
  output: unknown;
  
  /** Token usage for LLM-based tools */
  tokens_used?: {
    input: number;
    output: number;
    model?: string;
  };
  
  /** Artifact IDs created by this execution */
  artifacts?: string[];
  
  /** Execution logs (truncated to last 1000 lines) */
  logs?: string[];
  
  /** Execution metadata */
  metadata: {
    /** Actual execution duration in ms */
    duration_ms: number;
    
    /** Sandbox where execution occurred */
    sandbox_type: 'edge' | 'k8s_swiss' | 'k8s_eu' | 'modal' | 'local';
    
    /** Resource consumption */
    resources?: {
      cpu_ms: number;
      memory_mb_peak: number;
      network_bytes_in: number;
      network_bytes_out: number;
    };
    
    /** Retry information */
    retry_count: number;
    
    /** Idempotency key used */
    idempotency_key: string;
  };
  
  /** Error information (null if successful) */
  error?: ToolExecutionError | null;
}

export interface ToolExecutionError {
  /** Error code from failure taxonomy */
  code: ToolErrorCode;
  
  /** Human-readable message */
  message: string;
  
  /** Whether this error is retryable */
  retryable: boolean;
  
  /** Suggested retry delay in ms (if retryable) */
  retry_after_ms?: number;
  
  /** Stack trace (only in non-production) */
  stack?: string;
  
  /** Nested cause */
  cause?: ToolExecutionError;
}

/**
 * Failure Taxonomy - Exhaustive list of error codes
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export type ToolErrorCode =
  // Timeout errors
  | 'TIMEOUT_TOTAL'           // Total execution timeout exceeded
  | 'TIMEOUT_NETWORK'         // Network request timeout
  | 'TIMEOUT_LLM'             // LLM response timeout
  | 'TIMEOUT_SANDBOX_INIT'    // Sandbox initialization timeout
  
  // Resource errors
  | 'RESOURCE_MEMORY'         // OOM killed
  | 'RESOURCE_CPU'            // CPU quota exceeded
  | 'RESOURCE_DISK'           // Disk quota exceeded
  | 'RESOURCE_NETWORK'        // Network bandwidth exceeded
  
  // Permission errors
  | 'PERMISSION_DENIED'       // Action not allowed
  | 'PERMISSION_SCOPE'        // Missing OAuth scope
  | 'PERMISSION_TENANT'       // Cross-tenant access attempt
  | 'PERMISSION_RATE_LIMIT'   // Rate limit exceeded
  
  // Input errors
  | 'INPUT_VALIDATION'        // Schema validation failed
  | 'INPUT_SIZE'              // Input too large
  | 'INPUT_ENCODING'          // Invalid encoding
  | 'INPUT_MISSING'           // Required field missing
  
  // External errors
  | 'EXTERNAL_API'            // Third-party API error
  | 'EXTERNAL_UNAVAILABLE'    // External service unavailable
  | 'EXTERNAL_AUTH'           // External auth failed
  | 'EXTERNAL_RATE_LIMIT'     // External rate limit
  
  // Internal errors
  | 'INTERNAL_SANDBOX'        // Sandbox infrastructure error
  | 'INTERNAL_STORAGE'        // Storage system error
  | 'INTERNAL_QUEUE'          // Queue system error
  | 'INTERNAL_UNKNOWN';       // Unexpected error

/**
 * Tool execution context - immutable during execution
 */
export interface ToolExecutionContext {
  /** Run this tool belongs to */
  runId: string;
  
  /** Step within the run */
  stepId: string;
  
  /** Tenant executing the tool */
  tenantId: string;
  
  /** User who initiated the run */
  userId: string;
  
  /** Maximum execution time in ms */
  timeout: number;
  
  /** Credit budget remaining for this run */
  creditBudget: number;
  
  /** Idempotency key for this execution */
  idempotencyKey: string;
  
  /** Trace context for distributed tracing */
  traceContext: {
    traceId: string;
    spanId: string;
    sampled: boolean;
  };
  
  /** Feature flags active for this tenant */
  featureFlags: Record<string, boolean>;
}

/**
 * CANONICAL TOOL ROUTER INTERFACE
 */
export interface ToolRouter {
  /**
   * Execute a tool with full context and guarantees.
   * 
   * Guarantees:
   * - Idempotent: Same idempotencyKey returns cached result
   * - Timeout-bounded: Will not exceed context.timeout
   * - Credit-checked: Will fail fast if insufficient credits
   * - Traced: All executions are traced
   * - Audited: All executions are logged
   * 
   * @throws ToolExecutionError on failure
   */
  execute(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
  
  /**
   * Check if a tool execution would succeed without executing.
   * Used for pre-flight validation and credit estimation.
   */
  preflight(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<PreflightResult>;
  
  /**
   * Cancel an in-progress tool execution.
   * Returns true if cancellation was successful.
   */
  cancel(
    executionId: string,
    reason: string
  ): Promise<boolean>;
  
  /**
   * Get the status of a tool execution.
   */
  getStatus(
    executionId: string
  ): Promise<ToolExecutionStatus>;
}

export interface PreflightResult {
  /** Whether execution would succeed */
  canExecute: boolean;
  
  /** Reason if canExecute is false */
  reason?: string;
  
  /** Estimated credit cost */
  estimatedCredits: number;
  
  /** Estimated duration in ms */
  estimatedDurationMs: number;
  
  /** Which sandbox would be used */
  targetSandbox: SandboxType;
  
  /** Warnings (execution can proceed but with caveats) */
  warnings?: string[];
}

export type SandboxType = 'edge' | 'k8s_swiss' | 'k8s_eu' | 'modal' | 'local';

export interface ToolExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;  // 0-100
  startedAt?: Date;
  completedAt?: Date;
  result?: ToolExecutionResult;
}
```

#### 1.2 Tool Registry and Metadata

```typescript
// packages/tool-router/src/registry.ts

export interface ToolDefinition {
  /** Unique tool identifier */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Tool version (semver) */
  version: string;
  
  /** Input schema (JSON Schema) */
  inputSchema: JSONSchema;
  
  /** Output schema (JSON Schema) */
  outputSchema: JSONSchema;
  
  /** Tool category */
  category: ToolCategory;
  
  /** Execution configuration */
  execution: ToolExecutionConfig;
  
  /** Retry configuration */
  retry: ToolRetryConfig;
  
  /** Credit cost configuration */
  credits: ToolCreditConfig;
  
  /** Required permissions */
  permissions: string[];
  
  /** Feature flag that gates this tool */
  featureFlag?: string;
}

export type ToolCategory =
  | 'browser'      // Browser automation
  | 'code'         // Code execution
  | 'file'         // File operations
  | 'search'       // Web search
  | 'llm'          // LLM calls
  | 'connector'    // External integrations
  | 'document'     // Document generation
  | 'media'        // Image/video/audio
  | 'data'         // Data processing
  | 'system';      // System operations

export interface ToolExecutionConfig {
  /** Default timeout in ms */
  defaultTimeout: number;
  
  /** Maximum allowed timeout in ms */
  maxTimeout: number;
  
  /** Sandbox routing rules */
  sandboxRouting: SandboxRoutingRule[];
  
  /** Whether tool supports streaming output */
  supportsStreaming: boolean;
  
  /** Whether tool can produce artifacts */
  producesArtifacts: boolean;
  
  /** Maximum input size in bytes */
  maxInputSize: number;
  
  /** Maximum output size in bytes */
  maxOutputSize: number;
  
  /** Resource limits */
  resourceLimits: {
    memoryMb: number;
    cpuMillicores: number;
    diskMb: number;
    networkMbps: number;
  };
}

export interface SandboxRoutingRule {
  /** Condition for this rule */
  condition: SandboxRoutingCondition;
  
  /** Target sandbox if condition matches */
  target: SandboxType;
  
  /** Priority (higher = checked first) */
  priority: number;
}

export interface SandboxRoutingCondition {
  /** Tenant tier requirement */
  tenantTier?: 'free' | 'pro' | 'enterprise';
  
  /** Data residency requirement */
  dataResidency?: 'swiss' | 'eu' | 'us' | 'any';
  
  /** Minimum execution time estimate */
  minDurationMs?: number;
  
  /** Requires GPU */
  requiresGpu?: boolean;
  
  /** Requires specific network access */
  requiresNetwork?: string[];
  
  /** Custom predicate (tool-specific) */
  custom?: string;
}

/**
 * Retry Configuration per Tool
 * 
 * CRITICAL: Different tools have different retry semantics.
 * LLM calls are safe to retry. Payment calls are NOT.
 */
export interface ToolRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: number;
  
  /** Maximum delay between retries (ms) */
  maxDelayMs: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Jitter factor (0-1) */
  jitterFactor: number;
  
  /** Which error codes are retryable */
  retryableErrors: ToolErrorCode[];
  
  /** Which error codes should NOT be retried */
  nonRetryableErrors: ToolErrorCode[];
  
  /** Whether to retry on timeout */
  retryOnTimeout: boolean;
  
  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Failure threshold to open circuit */
    failureThreshold: number;
    
    /** Time window for failure counting (ms) */
    failureWindowMs: number;
    
    /** Time to wait before half-open (ms) */
    resetTimeoutMs: number;
  };
}

export interface ToolCreditConfig {
  /** Base credit cost per execution */
  baseCost: number;
  
  /** Cost per input token (for LLM tools) */
  inputTokenCost?: number;
  
  /** Cost per output token (for LLM tools) */
  outputTokenCost?: number;
  
  /** Cost per second of execution */
  perSecondCost?: number;
  
  /** Cost per MB of output */
  perMbOutputCost?: number;
  
  /** Minimum credit reservation */
  minReservation: number;
  
  /** Maximum credit consumption per execution */
  maxCost: number;
}

// Tool Registry Implementation
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  
  register(tool: ToolDefinition): void {
    // Validate tool definition
    this.validateToolDefinition(tool);
    
    // Check for conflicts
    if (this.tools.has(tool.name)) {
      const existing = this.tools.get(tool.name)!;
      if (existing.version === tool.version) {
        throw new Error(`Tool ${tool.name}@${tool.version} already registered`);
      }
    }
    
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.category === category);
  }
  
  private validateToolDefinition(tool: ToolDefinition): void {
    // Validate retry config makes sense
    if (tool.retry.maxAttempts < 1) {
      throw new Error('maxAttempts must be >= 1');
    }
    
    // Validate sandbox routing has default
    const hasDefault = tool.execution.sandboxRouting.some(
      r => Object.keys(r.condition).length === 0
    );
    if (!hasDefault) {
      throw new Error('Sandbox routing must have a default rule');
    }
    
    // Validate credit config
    if (tool.credits.minReservation > tool.credits.maxCost) {
      throw new Error('minReservation cannot exceed maxCost');
    }
  }
}
```

#### 1.3 Tool Router Implementation

```typescript
// packages/tool-router/src/router.ts

import { createHash } from 'crypto';
import { Span, trace } from '@opentelemetry/api';

export class ToolRouterImpl implements ToolRouter {
  private registry: ToolRegistry;
  private executionStore: ExecutionStore;
  private idempotencyStore: IdempotencyStore;
  private creditService: CreditService;
  private sandboxManager: SandboxManager;
  private lockManager: LockManager;
  private artifactRegistry: ArtifactRegistry;
  
  constructor(deps: ToolRouterDependencies) {
    this.registry = deps.registry;
    this.executionStore = deps.executionStore;
    this.idempotencyStore = deps.idempotencyStore;
    this.creditService = deps.creditService;
    this.sandboxManager = deps.sandboxManager;
    this.lockManager = deps.lockManager;
    this.artifactRegistry = deps.artifactRegistry;
  }
  
  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tracer = trace.getTracer('tool-router');
    
    return tracer.startActiveSpan(`tool.execute.${toolName}`, async (span: Span) => {
      span.setAttributes({
        'tool.name': toolName,
        'run.id': context.runId,
        'step.id': context.stepId,
        'tenant.id': context.tenantId,
      });
      
      const startTime = Date.now();
      const executionId = this.generateExecutionId(toolName, context);
      
      try {
        // 1. Check idempotency - return cached result if exists
        const cachedResult = await this.idempotencyStore.get(context.idempotencyKey);
        if (cachedResult) {
          span.setAttributes({ 'idempotency.hit': true });
          return cachedResult;
        }
        
        // 2. Get tool definition
        const tool = this.registry.get(toolName);
        if (!tool) {
          throw this.createError('INPUT_VALIDATION', `Unknown tool: ${toolName}`, false);
        }
        
        // 3. Check feature flag
        if (tool.featureFlag && !context.featureFlags[tool.featureFlag]) {
          throw this.createError('PERMISSION_DENIED', `Tool ${toolName} not enabled`, false);
        }
        
        // 4. Validate input
        const validationResult = this.validateInput(input, tool.inputSchema);
        if (!validationResult.valid) {
          throw this.createError('INPUT_VALIDATION', validationResult.error!, false);
        }
        
        // 5. Reserve credits
        const creditReservation = await this.creditService.reserve({
          tenantId: context.tenantId,
          runId: context.runId,
          stepId: context.stepId,
          amount: tool.credits.minReservation,
          maxAmount: Math.min(tool.credits.maxCost, context.creditBudget),
          toolName,
        });
        
        if (!creditReservation.success) {
          throw this.createError('PERMISSION_DENIED', 'Insufficient credits', false);
        }
        
        // 6. Acquire execution lock
        const lock = await this.lockManager.acquireStepLock(
          context.runId,
          context.stepId,
          context.timeout
        );
        
        if (!lock.acquired) {
          // Another worker is executing this step
          throw this.createError('INTERNAL_QUEUE', 'Step already being executed', true);
        }
        
        try {
          // 7. Route to appropriate sandbox
          const sandbox = await this.routeToSandbox(tool, context);
          span.setAttributes({ 'sandbox.type': sandbox.type });
          
          // 8. Execute with retry logic
          const result = await this.executeWithRetry(
            tool,
            input,
            context,
            sandbox,
            creditReservation
          );
          
          // 9. Normalize output
          const normalizedResult = this.normalizeOutput(result, tool);
          
          // 10. Register artifacts
          if (normalizedResult.artifacts?.length) {
            await this.registerArtifacts(
              normalizedResult.artifacts,
              context,
              toolName
            );
          }
          
          // 11. Finalize credits
          await this.creditService.finalize({
            reservationId: creditReservation.id,
            actualAmount: this.calculateActualCost(tool, normalizedResult),
          });
          
          // 12. Store idempotency result
          await this.idempotencyStore.set(
            context.idempotencyKey,
            normalizedResult,
            tool.execution.defaultTimeout * 2  // TTL
          );
          
          // 13. Record execution
          await this.executionStore.record({
            executionId,
            toolName,
            context,
            result: normalizedResult,
            duration: Date.now() - startTime,
          });
          
          span.setStatus({ code: 0 });
          return normalizedResult;
          
        } finally {
          // Always release lock
          await this.lockManager.releaseLock(lock.lockId);
        }
        
      } catch (error) {
        span.setStatus({ code: 2, message: error.message });
        span.recordException(error);
        
        // Convert to ToolExecutionError if needed
        const toolError = this.toToolError(error);
        
        // Record failed execution
        await this.executionStore.record({
          executionId,
          toolName,
          context,
          error: toolError,
          duration: Date.now() - startTime,
        });
        
        throw toolError;
      }
    });
  }
  
  private async executeWithRetry(
    tool: ToolDefinition,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    sandbox: Sandbox,
    creditReservation: CreditReservation
  ): Promise<ToolExecutionResult> {
    const retryConfig = tool.retry;
    let lastError: ToolExecutionError | null = null;
    let attempt = 0;
    
    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      
      try {
        // Check if we still have credits
        const remainingCredits = await this.creditService.getRemainingReservation(
          creditReservation.id
        );
        
        if (remainingCredits <= 0) {
          throw this.createError(
            'PERMISSION_DENIED',
            'Credit budget exhausted during execution',
            false
          );
        }
        
        // Check circuit breaker
        if (retryConfig.circuitBreaker) {
          const circuitState = await this.getCircuitState(tool.name, context.tenantId);
          if (circuitState === 'open') {
            throw this.createError(
              'EXTERNAL_UNAVAILABLE',
              'Circuit breaker open',
              true,
              retryConfig.circuitBreaker.resetTimeoutMs
            );
          }
        }
        
        // Execute in sandbox with timeout
        const result = await this.executeInSandbox(
          sandbox,
          tool,
          input,
          context,
          Math.min(context.timeout, tool.execution.maxTimeout)
        );
        
        // Success - reset circuit breaker
        if (retryConfig.circuitBreaker) {
          await this.recordCircuitSuccess(tool.name, context.tenantId);
        }
        
        return {
          ...result,
          metadata: {
            ...result.metadata,
            retry_count: attempt - 1,
            idempotency_key: context.idempotencyKey,
          },
        };
        
      } catch (error) {
        lastError = this.toToolError(error);
        
        // Record circuit breaker failure
        if (retryConfig.circuitBreaker) {
          await this.recordCircuitFailure(tool.name, context.tenantId);
        }
        
        // Check if retryable
        if (!this.isRetryable(lastError, retryConfig)) {
          throw lastError;
        }
        
        // Check if we have attempts left
        if (attempt >= retryConfig.maxAttempts) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt, retryConfig);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }
  
  private isRetryable(error: ToolExecutionError, config: ToolRetryConfig): boolean {
    // Explicit non-retryable errors
    if (config.nonRetryableErrors.includes(error.code)) {
      return false;
    }
    
    // Explicit retryable errors
    if (config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Timeout handling
    if (error.code.startsWith('TIMEOUT_')) {
      return config.retryOnTimeout;
    }
    
    // Default: use error's retryable flag
    return error.retryable;
  }
  
  private calculateRetryDelay(attempt: number, config: ToolRetryConfig): number {
    // Exponential backoff
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter
    const jitter = cappedDelay * config.jitterFactor * Math.random();
    
    return Math.floor(cappedDelay + jitter);
  }
  
  private async routeToSandbox(
    tool: ToolDefinition,
    context: ToolExecutionContext
  ): Promise<Sandbox> {
    // Get tenant info for routing decisions
    const tenant = await this.getTenantInfo(context.tenantId);
    
    // Sort rules by priority (descending)
    const sortedRules = [...tool.execution.sandboxRouting]
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.matchesCondition(rule.condition, tenant, context)) {
        return this.sandboxManager.getSandbox(rule.target);
      }
    }
    
    // Should never reach here if registry validation is correct
    throw this.createError('INTERNAL_SANDBOX', 'No matching sandbox route', false);
  }
  
  private matchesCondition(
    condition: SandboxRoutingCondition,
    tenant: TenantInfo,
    context: ToolExecutionContext
  ): boolean {
    // Empty condition = default rule
    if (Object.keys(condition).length === 0) {
      return true;
    }
    
    if (condition.tenantTier && tenant.tier !== condition.tenantTier) {
      return false;
    }
    
    if (condition.dataResidency && condition.dataResidency !== 'any') {
      if (tenant.dataResidency !== condition.dataResidency) {
        return false;
      }
    }
    
    // Add more condition checks as needed
    
    return true;
  }
  
  private normalizeOutput(
    result: RawToolResult,
    tool: ToolDefinition
  ): ToolExecutionResult {
    // Truncate logs
    const logs = result.logs?.slice(-1000);
    
    // Validate output against schema
    const outputValid = this.validateOutput(result.output, tool.outputSchema);
    if (!outputValid.valid) {
      // Log warning but don't fail - output normalization is best-effort
      console.warn(`Output validation failed for ${tool.name}: ${outputValid.error}`);
    }
    
    // Ensure artifacts are strings
    const artifacts = result.artifacts?.map(a => String(a));
    
    return {
      output: result.output,
      tokens_used: result.tokens_used,
      artifacts,
      logs,
      metadata: {
        duration_ms: result.duration_ms,
        sandbox_type: result.sandbox_type,
        resources: result.resources,
        retry_count: 0,  // Set by caller
        idempotency_key: '',  // Set by caller
      },
      error: null,
    };
  }
  
  async preflight(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<PreflightResult> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      return {
        canExecute: false,
        reason: `Unknown tool: ${toolName}`,
        estimatedCredits: 0,
        estimatedDurationMs: 0,
        targetSandbox: 'local',
      };
    }
    
    // Check feature flag
    if (tool.featureFlag && !context.featureFlags[tool.featureFlag]) {
      return {
        canExecute: false,
        reason: `Tool ${toolName} not enabled for tenant`,
        estimatedCredits: 0,
        estimatedDurationMs: 0,
        targetSandbox: 'local',
      };
    }
    
    // Validate input
    const validation = this.validateInput(input, tool.inputSchema);
    if (!validation.valid) {
      return {
        canExecute: false,
        reason: validation.error,
        estimatedCredits: 0,
        estimatedDurationMs: 0,
        targetSandbox: 'local',
      };
    }
    
    // Check credits
    const hasCredits = await this.creditService.checkAvailable(
      context.tenantId,
      tool.credits.minReservation
    );
    
    if (!hasCredits) {
      return {
        canExecute: false,
        reason: 'Insufficient credits',
        estimatedCredits: tool.credits.minReservation,
        estimatedDurationMs: tool.execution.defaultTimeout,
        targetSandbox: 'local',
      };
    }
    
    // Determine target sandbox
    const tenant = await this.getTenantInfo(context.tenantId);
    let targetSandbox: SandboxType = 'local';
    
    for (const rule of tool.execution.sandboxRouting) {
      if (this.matchesCondition(rule.condition, tenant, context)) {
        targetSandbox = rule.target;
        break;
      }
    }
    
    // Estimate cost
    const estimatedCredits = this.estimateCost(tool, input);
    
    // Collect warnings
    const warnings: string[] = [];
    
    if (context.timeout < tool.execution.defaultTimeout) {
      warnings.push(`Timeout (${context.timeout}ms) is less than recommended (${tool.execution.defaultTimeout}ms)`);
    }
    
    if (estimatedCredits > context.creditBudget * 0.5) {
      warnings.push('This execution may consume more than 50% of remaining credit budget');
    }
    
    return {
      canExecute: true,
      estimatedCredits,
      estimatedDurationMs: tool.execution.defaultTimeout,
      targetSandbox,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  async cancel(executionId: string, reason: string): Promise<boolean> {
    const execution = await this.executionStore.get(executionId);
    if (!execution) {
      return false;
    }
    
    if (execution.status !== 'running') {
      return false;
    }
    
    // Signal sandbox to cancel
    const cancelled = await this.sandboxManager.cancel(
      execution.sandboxId,
      reason
    );
    
    if (cancelled) {
      await this.executionStore.updateStatus(executionId, 'cancelled');
    }
    
    return cancelled;
  }
  
  async getStatus(executionId: string): Promise<ToolExecutionStatus> {
    const execution = await this.executionStore.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    return {
      executionId,
      status: execution.status,
      progress: execution.progress,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      result: execution.result,
    };
  }
  
  private generateExecutionId(toolName: string, context: ToolExecutionContext): string {
    return `exec_${toolName}_${context.stepId}_${Date.now()}`;
  }
  
  private createError(
    code: ToolErrorCode,
    message: string,
    retryable: boolean,
    retryAfterMs?: number
  ): ToolExecutionError {
    return {
      code,
      message,
      retryable,
      retry_after_ms: retryAfterMs,
    };
  }
  
  private toToolError(error: unknown): ToolExecutionError {
    if (error instanceof ToolExecutionError) {
      return error;
    }
    
    if (error instanceof Error) {
      return {
        code: 'INTERNAL_UNKNOWN',
        message: error.message,
        retryable: false,
        stack: error.stack,
      };
    }
    
    return {
      code: 'INTERNAL_UNKNOWN',
      message: String(error),
      retryable: false,
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 1.4 Pre-configured Tool Definitions

```typescript
// packages/tool-router/src/tools/index.ts

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Browser Automation
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL',
    version: '1.0.0',
    category: 'browser',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        waitFor: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url: { type: 'string' },
        screenshot: { type: 'string' },
      },
    },
    execution: {
      defaultTimeout: 30000,
      maxTimeout: 120000,
      sandboxRouting: [
        { condition: { dataResidency: 'swiss' }, target: 'k8s_swiss', priority: 100 },
        { condition: { dataResidency: 'eu' }, target: 'k8s_eu', priority: 90 },
        { condition: {}, target: 'edge', priority: 0 },
      ],
      supportsStreaming: false,
      producesArtifacts: true,
      maxInputSize: 1024,
      maxOutputSize: 10 * 1024 * 1024,  // 10MB for screenshots
      resourceLimits: { memoryMb: 512, cpuMillicores: 500, diskMb: 100, networkMbps: 10 },
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      retryableErrors: ['TIMEOUT_NETWORK', 'EXTERNAL_UNAVAILABLE'],
      nonRetryableErrors: ['INPUT_VALIDATION', 'PERMISSION_DENIED'],
      retryOnTimeout: true,
      circuitBreaker: { failureThreshold: 5, failureWindowMs: 60000, resetTimeoutMs: 30000 },
    },
    credits: {
      baseCost: 1,
      perSecondCost: 0.1,
      minReservation: 5,
      maxCost: 50,
    },
    permissions: ['browser:navigate'],
  },
  
  // Code Execution
  {
    name: 'code_execute',
    description: 'Execute code in a sandboxed environment',
    version: '1.0.0',
    category: 'code',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'bash'] },
        code: { type: 'string', maxLength: 100000 },
        timeout: { type: 'number', minimum: 1000, maximum: 300000 },
      },
      required: ['language', 'code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        exitCode: { type: 'number' },
        files: { type: 'array', items: { type: 'string' } },
      },
    },
    execution: {
      defaultTimeout: 60000,
      maxTimeout: 300000,
      sandboxRouting: [
        { condition: { dataResidency: 'swiss' }, target: 'k8s_swiss', priority: 100 },
        { condition: { requiresGpu: true }, target: 'modal', priority: 90 },
        { condition: {}, target: 'k8s_eu', priority: 0 },
      ],
      supportsStreaming: true,
      producesArtifacts: true,
      maxInputSize: 100 * 1024,  // 100KB
      maxOutputSize: 50 * 1024 * 1024,  // 50MB
      resourceLimits: { memoryMb: 2048, cpuMillicores: 2000, diskMb: 1024, networkMbps: 100 },
    },
    retry: {
      maxAttempts: 2,  // Code execution is less safe to retry
      baseDelayMs: 2000,
      maxDelayMs: 5000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.2,
      retryableErrors: ['TIMEOUT_SANDBOX_INIT', 'INTERNAL_SANDBOX'],
      nonRetryableErrors: ['INPUT_VALIDATION', 'RESOURCE_MEMORY', 'RESOURCE_CPU'],
      retryOnTimeout: false,  // Don't retry timeouts - code might have side effects
    },
    credits: {
      baseCost: 2,
      perSecondCost: 0.5,
      perMbOutputCost: 0.1,
      minReservation: 10,
      maxCost: 100,
    },
    permissions: ['code:execute'],
  },
  
  // LLM Invocation
  {
    name: 'llm_invoke',
    description: 'Invoke LLM for text generation',
    version: '1.0.0',
    category: 'llm',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        model: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        maxTokens: { type: 'number', minimum: 1, maximum: 128000 },
      },
      required: ['messages'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        finishReason: { type: 'string' },
        usage: {
          type: 'object',
          properties: {
            promptTokens: { type: 'number' },
            completionTokens: { type: 'number' },
          },
        },
      },
    },
    execution: {
      defaultTimeout: 120000,
      maxTimeout: 300000,
      sandboxRouting: [
        { condition: {}, target: 'edge', priority: 0 },  // LLM calls go through edge
      ],
      supportsStreaming: true,
      producesArtifacts: false,
      maxInputSize: 1024 * 1024,  // 1MB
      maxOutputSize: 1024 * 1024,  // 1MB
      resourceLimits: { memoryMb: 256, cpuMillicores: 100, diskMb: 0, networkMbps: 10 },
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      retryableErrors: ['TIMEOUT_LLM', 'EXTERNAL_RATE_LIMIT', 'EXTERNAL_UNAVAILABLE'],
      nonRetryableErrors: ['INPUT_VALIDATION', 'PERMISSION_DENIED', 'INPUT_SIZE'],
      retryOnTimeout: true,
    },
    credits: {
      baseCost: 0,
      inputTokenCost: 0.001,
      outputTokenCost: 0.003,
      minReservation: 1,
      maxCost: 500,
    },
    permissions: ['llm:invoke'],
  },
  
  // Document Generation
  {
    name: 'document_generate',
    description: 'Generate documents (PDF, PPTX, DOCX)',
    version: '1.0.0',
    category: 'document',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['pdf', 'pptx', 'docx', 'xlsx'] },
        template: { type: 'string' },
        data: { type: 'object' },
        options: { type: 'object' },
      },
      required: ['type', 'data'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string' },
        url: { type: 'string' },
        size: { type: 'number' },
        pageCount: { type: 'number' },
      },
    },
    execution: {
      defaultTimeout: 120000,
      maxTimeout: 600000,
      sandboxRouting: [
        { condition: { dataResidency: 'swiss' }, target: 'k8s_swiss', priority: 100 },
        { condition: {}, target: 'k8s_eu', priority: 0 },
      ],
      supportsStreaming: false,
      producesArtifacts: true,
      maxInputSize: 10 * 1024 * 1024,  // 10MB
      maxOutputSize: 100 * 1024 * 1024,  // 100MB
      resourceLimits: { memoryMb: 4096, cpuMillicores: 2000, diskMb: 2048, networkMbps: 50 },
    },
    retry: {
      maxAttempts: 2,
      baseDelayMs: 5000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
      retryableErrors: ['INTERNAL_SANDBOX', 'INTERNAL_STORAGE'],
      nonRetryableErrors: ['INPUT_VALIDATION', 'RESOURCE_MEMORY'],
      retryOnTimeout: false,
    },
    credits: {
      baseCost: 5,
      perSecondCost: 0.2,
      perMbOutputCost: 0.5,
      minReservation: 10,
      maxCost: 200,
    },
    permissions: ['document:generate'],
  },
  
  // Web Search
  {
    name: 'web_search',
    description: 'Search the web for information',
    version: '1.0.0',
    category: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 1000 },
        type: { type: 'string', enum: ['info', 'news', 'image', 'api', 'research'] },
        limit: { type: 'number', minimum: 1, maximum: 50 },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              snippet: { type: 'string' },
            },
          },
        },
      },
    },
    execution: {
      defaultTimeout: 30000,
      maxTimeout: 60000,
      sandboxRouting: [
        { condition: {}, target: 'edge', priority: 0 },
      ],
      supportsStreaming: false,
      producesArtifacts: false,
      maxInputSize: 2048,
      maxOutputSize: 1024 * 1024,
      resourceLimits: { memoryMb: 128, cpuMillicores: 100, diskMb: 0, networkMbps: 10 },
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      retryableErrors: ['TIMEOUT_NETWORK', 'EXTERNAL_RATE_LIMIT', 'EXTERNAL_UNAVAILABLE'],
      nonRetryableErrors: ['INPUT_VALIDATION'],
      retryOnTimeout: true,
    },
    credits: {
      baseCost: 1,
      minReservation: 1,
      maxCost: 10,
    },
    permissions: ['search:web'],
  },
];
```

---

## 2. Artifact Registry & Provenance

### PR-026: Content-Addressed Artifact Storage

Every output artifact must be traceable to its origin (run, step) and deduplicated via content addressing.

#### 2.1 Artifact Schema

```sql
-- packages/database/migrations/026_artifact_registry.sql

-- Main artifact table with content addressing
CREATE TABLE artifacts (
  -- Primary key is content hash (SHA-256)
  id VARCHAR(64) PRIMARY KEY,  -- sha256 hex
  
  -- Content metadata
  content_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  filename VARCHAR(1024),
  
  -- Storage location
  storage_backend VARCHAR(50) NOT NULL,  -- 's3', 'gcs', 'azure', 'local'
  storage_path VARCHAR(2048) NOT NULL,
  storage_region VARCHAR(50),
  
  -- Encryption
  encrypted BOOLEAN NOT NULL DEFAULT true,
  encryption_key_id VARCHAR(255),
  
  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Reference counting for garbage collection
  reference_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Checksums for integrity
  md5_hash VARCHAR(32),
  sha1_hash VARCHAR(40),
  
  -- Indexes
  INDEX idx_artifacts_storage (storage_backend, storage_path),
  INDEX idx_artifacts_expires (expires_at) WHERE expires_at IS NOT NULL,
  INDEX idx_artifacts_deleted (deleted_at) WHERE deleted_at IS NOT NULL,
  INDEX idx_artifacts_last_accessed (last_accessed_at)
);

-- Provenance table - links artifacts to their creation context
CREATE TABLE artifact_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Artifact reference
  artifact_id VARCHAR(64) NOT NULL REFERENCES artifacts(id),
  
  -- Creation context
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  run_id UUID NOT NULL REFERENCES runs(id),
  step_id UUID NOT NULL REFERENCES steps(id),
  
  -- Tool that created this artifact
  tool_name VARCHAR(255) NOT NULL,
  tool_version VARCHAR(50) NOT NULL,
  
  -- Input hash for reproducibility
  input_hash VARCHAR(64) NOT NULL,
  
  -- Creation metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Unique constraint: same artifact can be created by different runs
  -- but each run/step can only create it once
  UNIQUE (artifact_id, run_id, step_id),
  
  -- Indexes
  INDEX idx_provenance_artifact (artifact_id),
  INDEX idx_provenance_run (run_id),
  INDEX idx_provenance_step (step_id),
  INDEX idx_provenance_tenant (tenant_id),
  INDEX idx_provenance_tool (tool_name, tool_version)
);

-- Artifact references - tracks which runs/steps reference artifacts
CREATE TABLE artifact_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  artifact_id VARCHAR(64) NOT NULL REFERENCES artifacts(id),
  
  -- Reference context
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  run_id UUID REFERENCES runs(id),
  step_id UUID REFERENCES steps(id),
  
  -- Reference type
  reference_type VARCHAR(50) NOT NULL,  -- 'output', 'input', 'attachment', 'cache'
  
  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  INDEX idx_references_artifact (artifact_id),
  INDEX idx_references_run (run_id),
  INDEX idx_references_tenant (tenant_id)
);

-- Artifact access log for audit
CREATE TABLE artifact_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  artifact_id VARCHAR(64) NOT NULL,  -- No FK for performance
  
  -- Access context
  tenant_id UUID NOT NULL,
  user_id UUID,
  run_id UUID,
  
  -- Access details
  access_type VARCHAR(50) NOT NULL,  -- 'read', 'download', 'stream', 'delete'
  access_ip INET,
  user_agent TEXT,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Timing
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_ms INT,
  bytes_transferred BIGINT,
  
  -- Partitioned by month for efficient cleanup
  INDEX idx_access_log_artifact (artifact_id, accessed_at),
  INDEX idx_access_log_tenant (tenant_id, accessed_at)
) PARTITION BY RANGE (accessed_at);

-- Create partitions for access log
CREATE TABLE artifact_access_log_2026_01 PARTITION OF artifact_access_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE artifact_access_log_2026_02 PARTITION OF artifact_access_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continue for each month

-- Deduplication index for content-based lookup
CREATE TABLE artifact_dedup_index (
  -- Composite key for deduplication
  tenant_id UUID NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,
  
  -- Result
  artifact_id VARCHAR(64) NOT NULL REFERENCES artifacts(id),
  
  -- Validity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  PRIMARY KEY (tenant_id, tool_name, input_hash),
  
  INDEX idx_dedup_artifact (artifact_id),
  INDEX idx_dedup_expires (expires_at) WHERE expires_at IS NOT NULL
);
```

#### 2.2 Artifact Registry Implementation

```typescript
// packages/artifact-registry/src/registry.ts

import { createHash } from 'crypto';
import { Readable } from 'stream';

export interface ArtifactMetadata {
  contentType: string;
  filename?: string;
  expiresAt?: Date;
  tags?: Record<string, string>;
}

export interface ArtifactProvenance {
  tenantId: string;
  runId: string;
  stepId: string;
  toolName: string;
  toolVersion: string;
  inputHash: string;
  createdBy?: string;
}

export interface StoredArtifact {
  id: string;  // SHA-256 hash
  url: string;
  size: number;
  contentType: string;
  filename?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ArtifactRegistry {
  /**
   * Store an artifact with content addressing.
   * Returns existing artifact if content already exists (deduplication).
   */
  store(
    content: Buffer | Readable,
    metadata: ArtifactMetadata,
    provenance: ArtifactProvenance
  ): Promise<StoredArtifact>;
  
  /**
   * Get artifact by ID (content hash).
   */
  get(artifactId: string, tenantId: string): Promise<StoredArtifact | null>;
  
  /**
   * Get download URL for artifact.
   * Returns signed URL with expiration.
   */
  getDownloadUrl(
    artifactId: string,
    tenantId: string,
    expiresInSeconds?: number
  ): Promise<string>;
  
  /**
   * Stream artifact content.
   */
  stream(artifactId: string, tenantId: string): Promise<Readable>;
  
  /**
   * Check if artifact exists (by content hash).
   */
  exists(contentHash: string): Promise<boolean>;
  
  /**
   * Find artifact by deduplication key.
   */
  findByDedup(
    tenantId: string,
    toolName: string,
    inputHash: string
  ): Promise<StoredArtifact | null>;
  
  /**
   * Add reference to artifact (prevents garbage collection).
   */
  addReference(
    artifactId: string,
    tenantId: string,
    runId: string,
    stepId: string,
    referenceType: 'output' | 'input' | 'attachment' | 'cache'
  ): Promise<void>;
  
  /**
   * Release reference to artifact.
   */
  releaseReference(referenceId: string): Promise<void>;
  
  /**
   * Get provenance chain for artifact.
   */
  getProvenance(artifactId: string): Promise<ArtifactProvenance[]>;
  
  /**
   * Delete artifact (marks for garbage collection).
   */
  delete(artifactId: string, tenantId: string): Promise<boolean>;
}

export class ArtifactRegistryImpl implements ArtifactRegistry {
  private db: Database;
  private storage: StorageBackend;
  private encryption: EncryptionService;
  
  constructor(deps: ArtifactRegistryDependencies) {
    this.db = deps.db;
    this.storage = deps.storage;
    this.encryption = deps.encryption;
  }
  
  async store(
    content: Buffer | Readable,
    metadata: ArtifactMetadata,
    provenance: ArtifactProvenance
  ): Promise<StoredArtifact> {
    // 1. Calculate content hash
    const { hash, size, buffer } = await this.hashContent(content);
    
    // 2. Check for existing artifact (deduplication)
    const existing = await this.db.query<Artifact>(
      'SELECT * FROM artifacts WHERE id = $1 AND deleted_at IS NULL',
      [hash]
    );
    
    if (existing) {
      // Artifact exists - just add provenance and reference
      await this.addProvenance(hash, provenance);
      await this.incrementReferenceCount(hash);
      
      return {
        id: hash,
        url: await this.getDownloadUrl(hash, provenance.tenantId),
        size: existing.size_bytes,
        contentType: existing.content_type,
        filename: existing.filename,
        createdAt: existing.created_at,
        expiresAt: existing.expires_at,
      };
    }
    
    // 3. Encrypt content
    const { encrypted, keyId } = await this.encryption.encrypt(buffer);
    
    // 4. Store in backend
    const storagePath = this.generateStoragePath(hash, provenance.tenantId);
    await this.storage.put(storagePath, encrypted, {
      contentType: 'application/octet-stream',  // Always encrypted
      metadata: {
        'x-artifact-id': hash,
        'x-content-type': metadata.contentType,
        'x-tenant-id': provenance.tenantId,
      },
    });
    
    // 5. Create artifact record
    await this.db.query(`
      INSERT INTO artifacts (
        id, content_type, size_bytes, filename,
        storage_backend, storage_path, storage_region,
        encrypted, encryption_key_id,
        expires_at, reference_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
    `, [
      hash,
      metadata.contentType,
      size,
      metadata.filename,
      this.storage.backend,
      storagePath,
      this.storage.region,
      true,
      keyId,
      metadata.expiresAt,
    ]);
    
    // 6. Add provenance
    await this.addProvenance(hash, provenance);
    
    // 7. Add to deduplication index
    await this.addToDedup(provenance, hash, metadata.expiresAt);
    
    return {
      id: hash,
      url: await this.getDownloadUrl(hash, provenance.tenantId),
      size,
      contentType: metadata.contentType,
      filename: metadata.filename,
      createdAt: new Date(),
      expiresAt: metadata.expiresAt,
    };
  }
  
  private async hashContent(
    content: Buffer | Readable
  ): Promise<{ hash: string; size: number; buffer: Buffer }> {
    if (Buffer.isBuffer(content)) {
      const hash = createHash('sha256').update(content).digest('hex');
      return { hash, size: content.length, buffer: content };
    }
    
    // Stream content and hash simultaneously
    const chunks: Buffer[] = [];
    const hasher = createHash('sha256');
    
    for await (const chunk of content) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      hasher.update(buf);
    }
    
    const buffer = Buffer.concat(chunks);
    const hash = hasher.digest('hex');
    
    return { hash, size: buffer.length, buffer };
  }
  
  private generateStoragePath(hash: string, tenantId: string): string {
    // Distribute across directories using hash prefix
    const prefix = hash.substring(0, 2);
    const subPrefix = hash.substring(2, 4);
    return `artifacts/${tenantId}/${prefix}/${subPrefix}/${hash}`;
  }
  
  private async addProvenance(
    artifactId: string,
    provenance: ArtifactProvenance
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO artifact_provenance (
        artifact_id, tenant_id, run_id, step_id,
        tool_name, tool_version, input_hash, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (artifact_id, run_id, step_id) DO NOTHING
    `, [
      artifactId,
      provenance.tenantId,
      provenance.runId,
      provenance.stepId,
      provenance.toolName,
      provenance.toolVersion,
      provenance.inputHash,
      provenance.createdBy,
    ]);
  }
  
  private async addToDedup(
    provenance: ArtifactProvenance,
    artifactId: string,
    expiresAt?: Date
  ): Promise<void> {
    // Default dedup TTL: 24 hours
    const dedupExpires = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await this.db.query(`
      INSERT INTO artifact_dedup_index (
        tenant_id, tool_name, input_hash, artifact_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, tool_name, input_hash) 
      DO UPDATE SET artifact_id = $4, expires_at = $5
    `, [
      provenance.tenantId,
      provenance.toolName,
      provenance.inputHash,
      artifactId,
      dedupExpires,
    ]);
  }
  
  async get(artifactId: string, tenantId: string): Promise<StoredArtifact | null> {
    // Verify tenant has access via provenance
    const artifact = await this.db.query<Artifact>(`
      SELECT a.* FROM artifacts a
      JOIN artifact_provenance p ON a.id = p.artifact_id
      WHERE a.id = $1 AND p.tenant_id = $2 AND a.deleted_at IS NULL
      LIMIT 1
    `, [artifactId, tenantId]);
    
    if (!artifact) {
      return null;
    }
    
    // Update last accessed
    await this.db.query(
      'UPDATE artifacts SET last_accessed_at = NOW() WHERE id = $1',
      [artifactId]
    );
    
    return {
      id: artifact.id,
      url: await this.getDownloadUrl(artifactId, tenantId),
      size: artifact.size_bytes,
      contentType: artifact.content_type,
      filename: artifact.filename,
      createdAt: artifact.created_at,
      expiresAt: artifact.expires_at,
    };
  }
  
  async getDownloadUrl(
    artifactId: string,
    tenantId: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const artifact = await this.db.query<Artifact>(
      'SELECT * FROM artifacts WHERE id = $1',
      [artifactId]
    );
    
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    
    // Log access
    await this.logAccess(artifactId, tenantId, 'download');
    
    // Generate signed URL
    return this.storage.getSignedUrl(artifact.storage_path, {
      expiresIn: expiresInSeconds,
      responseContentType: artifact.content_type,
      responseContentDisposition: artifact.filename
        ? `attachment; filename="${artifact.filename}"`
        : undefined,
    });
  }
  
  async stream(artifactId: string, tenantId: string): Promise<Readable> {
    const artifact = await this.db.query<Artifact>(`
      SELECT a.* FROM artifacts a
      JOIN artifact_provenance p ON a.id = p.artifact_id
      WHERE a.id = $1 AND p.tenant_id = $2 AND a.deleted_at IS NULL
      LIMIT 1
    `, [artifactId, tenantId]);
    
    if (!artifact) {
      throw new Error(`Artifact not found or access denied: ${artifactId}`);
    }
    
    // Log access
    await this.logAccess(artifactId, tenantId, 'stream');
    
    // Get encrypted stream
    const encryptedStream = await this.storage.getStream(artifact.storage_path);
    
    // Decrypt stream
    return this.encryption.decryptStream(encryptedStream, artifact.encryption_key_id);
  }
  
  async exists(contentHash: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM artifacts WHERE id = $1 AND deleted_at IS NULL) as exists',
      [contentHash]
    );
    return result?.exists ?? false;
  }
  
  async findByDedup(
    tenantId: string,
    toolName: string,
    inputHash: string
  ): Promise<StoredArtifact | null> {
    const dedup = await this.db.query<{ artifact_id: string }>(`
      SELECT artifact_id FROM artifact_dedup_index
      WHERE tenant_id = $1 AND tool_name = $2 AND input_hash = $3
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [tenantId, toolName, inputHash]);
    
    if (!dedup) {
      return null;
    }
    
    return this.get(dedup.artifact_id, tenantId);
  }
  
  async addReference(
    artifactId: string,
    tenantId: string,
    runId: string,
    stepId: string,
    referenceType: 'output' | 'input' | 'attachment' | 'cache'
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(`
        INSERT INTO artifact_references (
          artifact_id, tenant_id, run_id, step_id, reference_type
        ) VALUES ($1, $2, $3, $4, $5)
      `, [artifactId, tenantId, runId, stepId, referenceType]);
      
      await tx.query(
        'UPDATE artifacts SET reference_count = reference_count + 1 WHERE id = $1',
        [artifactId]
      );
    });
  }
  
  async releaseReference(referenceId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const ref = await tx.query<{ artifact_id: string }>(
        'UPDATE artifact_references SET released_at = NOW() WHERE id = $1 AND released_at IS NULL RETURNING artifact_id',
        [referenceId]
      );
      
      if (ref) {
        await tx.query(
          'UPDATE artifacts SET reference_count = reference_count - 1 WHERE id = $1',
          [ref.artifact_id]
        );
      }
    });
  }
  
  async getProvenance(artifactId: string): Promise<ArtifactProvenance[]> {
    const rows = await this.db.queryAll<ArtifactProvenanceRow>(`
      SELECT * FROM artifact_provenance
      WHERE artifact_id = $1
      ORDER BY created_at ASC
    `, [artifactId]);
    
    return rows.map(row => ({
      tenantId: row.tenant_id,
      runId: row.run_id,
      stepId: row.step_id,
      toolName: row.tool_name,
      toolVersion: row.tool_version,
      inputHash: row.input_hash,
      createdBy: row.created_by,
    }));
  }
  
  async delete(artifactId: string, tenantId: string): Promise<boolean> {
    // Verify tenant owns this artifact
    const hasAccess = await this.db.query<{ exists: boolean }>(`
      SELECT EXISTS(
        SELECT 1 FROM artifact_provenance
        WHERE artifact_id = $1 AND tenant_id = $2
      ) as exists
    `, [artifactId, tenantId]);
    
    if (!hasAccess?.exists) {
      return false;
    }
    
    // Soft delete - actual cleanup by garbage collector
    await this.db.query(
      'UPDATE artifacts SET deleted_at = NOW() WHERE id = $1',
      [artifactId]
    );
    
    return true;
  }
  
  private async logAccess(
    artifactId: string,
    tenantId: string,
    accessType: string
  ): Promise<void> {
    // Fire and forget - don't block on logging
    this.db.query(`
      INSERT INTO artifact_access_log (
        artifact_id, tenant_id, access_type, success, accessed_at
      ) VALUES ($1, $2, $3, true, NOW())
    `, [artifactId, tenantId, accessType]).catch(err => {
      console.error('Failed to log artifact access:', err);
    });
  }
  
  private async incrementReferenceCount(artifactId: string): Promise<void> {
    await this.db.query(
      'UPDATE artifacts SET reference_count = reference_count + 1, last_accessed_at = NOW() WHERE id = $1',
      [artifactId]
    );
  }
}

// Garbage Collector for artifacts
export class ArtifactGarbageCollector {
  private db: Database;
  private storage: StorageBackend;
  
  constructor(deps: { db: Database; storage: StorageBackend }) {
    this.db = deps.db;
    this.storage = deps.storage;
  }
  
  /**
   * Run garbage collection.
   * Should be run periodically (e.g., hourly).
   */
  async collect(): Promise<GCResult> {
    const result: GCResult = {
      scanned: 0,
      deleted: 0,
      bytesFreed: 0,
      errors: [],
    };
    
    // Find artifacts eligible for deletion:
    // 1. Soft-deleted more than 7 days ago
    // 2. Expired more than 1 day ago
    // 3. Zero references and not accessed in 30 days
    const candidates = await this.db.queryAll<Artifact>(`
      SELECT * FROM artifacts
      WHERE 
        (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days')
        OR (expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '1 day')
        OR (reference_count = 0 AND last_accessed_at < NOW() - INTERVAL '30 days')
      LIMIT 1000
    `);
    
    result.scanned = candidates.length;
    
    for (const artifact of candidates) {
      try {
        // Delete from storage
        await this.storage.delete(artifact.storage_path);
        
        // Delete from database
        await this.db.query('DELETE FROM artifacts WHERE id = $1', [artifact.id]);
        
        result.deleted++;
        result.bytesFreed += artifact.size_bytes;
      } catch (error) {
        result.errors.push({
          artifactId: artifact.id,
          error: error.message,
        });
      }
    }
    
    return result;
  }
}

interface GCResult {
  scanned: number;
  deleted: number;
  bytesFreed: number;
  errors: Array<{ artifactId: string; error: string }>;
}
```

---

## 3. Concurrency & Locking Model

### PR-027: Distributed Locking and Idempotency

Without proper locking, concurrent workers will cause double execution, double billing, and corrupted state.

#### 3.1 Lock Schema

```sql
-- packages/database/migrations/027_locking.sql

-- Advisory locks table for distributed locking
CREATE TABLE distributed_locks (
  -- Lock identifier
  lock_key VARCHAR(255) PRIMARY KEY,
  
  -- Lock holder
  holder_id VARCHAR(255) NOT NULL,  -- Worker ID
  holder_info JSONB,  -- Additional holder metadata
  
  -- Lock timing
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  renewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Lock metadata
  lock_type VARCHAR(50) NOT NULL,  -- 'run', 'step', 'tenant', 'global'
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  
  -- Fencing token for preventing stale locks
  fencing_token BIGINT NOT NULL DEFAULT 1,
  
  -- Indexes
  INDEX idx_locks_expires (expires_at),
  INDEX idx_locks_holder (holder_id),
  INDEX idx_locks_resource (resource_type, resource_id)
);

-- Step execution tracking for idempotency
CREATE TABLE step_executions (
  -- Composite primary key
  run_id UUID NOT NULL,
  step_id UUID NOT NULL,
  attempt INT NOT NULL DEFAULT 1,
  
  PRIMARY KEY (run_id, step_id, attempt),
  
  -- Execution state
  status VARCHAR(50) NOT NULL,  -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  
  -- Worker info
  worker_id VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Idempotency
  idempotency_key VARCHAR(255) NOT NULL,
  
  -- Result (for completed executions)
  result JSONB,
  error JSONB,
  
  -- Fencing token from lock
  fencing_token BIGINT,
  
  -- Indexes
  INDEX idx_step_exec_status (status),
  INDEX idx_step_exec_worker (worker_id),
  INDEX idx_step_exec_idempotency (idempotency_key),
  
  -- Foreign keys
  FOREIGN KEY (run_id) REFERENCES runs(id),
  FOREIGN KEY (step_id) REFERENCES steps(id)
);

-- Run-level mutex for preventing concurrent modifications
CREATE TABLE run_locks (
  run_id UUID PRIMARY KEY REFERENCES runs(id),
  
  -- Lock state
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_by VARCHAR(255),
  locked_at TIMESTAMP WITH TIME ZONE,
  lock_reason VARCHAR(255),
  
  -- Version for optimistic locking
  version INT NOT NULL DEFAULT 1,
  
  -- Indexes
  INDEX idx_run_locks_locked (locked) WHERE locked = true
);

-- Create trigger to auto-create run_lock on run creation
CREATE OR REPLACE FUNCTION create_run_lock()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO run_locks (run_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_run_lock
AFTER INSERT ON runs
FOR EACH ROW
EXECUTE FUNCTION create_run_lock();
```

#### 3.2 Lock Manager Implementation

```typescript
// packages/locking/src/manager.ts

export interface LockResult {
  acquired: boolean;
  lockId: string;
  fencingToken: number;
  expiresAt: Date;
  reason?: string;  // If not acquired
}

export interface LockManager {
  /**
   * Acquire a distributed lock.
   * Returns immediately if lock cannot be acquired.
   */
  acquireLock(
    key: string,
    options: LockOptions
  ): Promise<LockResult>;
  
  /**
   * Acquire a lock with waiting.
   * Will retry until timeout.
   */
  acquireLockWithWait(
    key: string,
    options: LockOptions & { waitTimeoutMs: number }
  ): Promise<LockResult>;
  
  /**
   * Release a lock.
   */
  releaseLock(lockId: string): Promise<boolean>;
  
  /**
   * Renew a lock's expiration.
   */
  renewLock(lockId: string, extensionMs: number): Promise<boolean>;
  
  /**
   * Acquire run-level mutex.
   */
  acquireRunLock(
    runId: string,
    workerId: string,
    reason: string
  ): Promise<LockResult>;
  
  /**
   * Acquire step-level execution lock.
   * Prevents double execution of the same step.
   */
  acquireStepLock(
    runId: string,
    stepId: string,
    timeoutMs: number
  ): Promise<LockResult>;
  
  /**
   * Check if step has already been executed.
   */
  isStepExecuted(runId: string, stepId: string): Promise<boolean>;
  
  /**
   * Record step execution start.
   */
  recordStepStart(
    runId: string,
    stepId: string,
    workerId: string,
    idempotencyKey: string,
    fencingToken: number
  ): Promise<void>;
  
  /**
   * Record step execution completion.
   */
  recordStepComplete(
    runId: string,
    stepId: string,
    result: unknown
  ): Promise<void>;
  
  /**
   * Record step execution failure.
   */
  recordStepFailure(
    runId: string,
    stepId: string,
    error: unknown
  ): Promise<void>;
}

export interface LockOptions {
  /** Lock holder identifier */
  holderId: string;
  
  /** Lock type for categorization */
  lockType: 'run' | 'step' | 'tenant' | 'global';
  
  /** Resource being locked */
  resourceType?: string;
  resourceId?: string;
  
  /** Lock duration in ms */
  ttlMs: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export class DistributedLockManager implements LockManager {
  private db: Database;
  private workerId: string;
  
  constructor(deps: { db: Database; workerId: string }) {
    this.db = deps.db;
    this.workerId = deps.workerId;
  }
  
  async acquireLock(key: string, options: LockOptions): Promise<LockResult> {
    const lockId = `${key}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + options.ttlMs);
    
    try {
      // Try to acquire lock using INSERT with conflict handling
      const result = await this.db.query<{ fencing_token: number }>(`
        INSERT INTO distributed_locks (
          lock_key, holder_id, holder_info, expires_at, lock_type,
          resource_type, resource_id, fencing_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
        ON CONFLICT (lock_key) DO UPDATE
        SET 
          holder_id = EXCLUDED.holder_id,
          holder_info = EXCLUDED.holder_info,
          acquired_at = NOW(),
          expires_at = EXCLUDED.expires_at,
          renewed_at = NOW(),
          fencing_token = distributed_locks.fencing_token + 1
        WHERE 
          distributed_locks.expires_at < NOW()  -- Only if expired
          OR distributed_locks.holder_id = EXCLUDED.holder_id  -- Or same holder
        RETURNING fencing_token
      `, [
        key,
        options.holderId,
        JSON.stringify(options.metadata || {}),
        expiresAt,
        options.lockType,
        options.resourceType,
        options.resourceId,
      ]);
      
      if (result) {
        return {
          acquired: true,
          lockId: key,
          fencingToken: result.fencing_token,
          expiresAt,
        };
      }
      
      // Lock held by another holder
      const holder = await this.db.query<{ holder_id: string; expires_at: Date }>(
        'SELECT holder_id, expires_at FROM distributed_locks WHERE lock_key = $1',
        [key]
      );
      
      return {
        acquired: false,
        lockId: '',
        fencingToken: 0,
        expiresAt: new Date(0),
        reason: `Lock held by ${holder?.holder_id} until ${holder?.expires_at}`,
      };
      
    } catch (error) {
      return {
        acquired: false,
        lockId: '',
        fencingToken: 0,
        expiresAt: new Date(0),
        reason: `Lock acquisition failed: ${error.message}`,
      };
    }
  }
  
  async acquireLockWithWait(
    key: string,
    options: LockOptions & { waitTimeoutMs: number }
  ): Promise<LockResult> {
    const deadline = Date.now() + options.waitTimeoutMs;
    let attempt = 0;
    
    while (Date.now() < deadline) {
      attempt++;
      
      const result = await this.acquireLock(key, options);
      if (result.acquired) {
        return result;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(
        100 * Math.pow(2, attempt) + Math.random() * 100,
        5000
      );
      
      await this.sleep(delay);
    }
    
    return {
      acquired: false,
      lockId: '',
      fencingToken: 0,
      expiresAt: new Date(0),
      reason: `Lock acquisition timed out after ${options.waitTimeoutMs}ms`,
    };
  }
  
  async releaseLock(lockId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM distributed_locks WHERE lock_key = $1 AND holder_id = $2',
      [lockId, this.workerId]
    );
    
    return result.rowCount > 0;
  }
  
  async renewLock(lockId: string, extensionMs: number): Promise<boolean> {
    const newExpiry = new Date(Date.now() + extensionMs);
    
    const result = await this.db.query(
      `UPDATE distributed_locks 
       SET expires_at = $1, renewed_at = NOW() 
       WHERE lock_key = $2 AND holder_id = $3`,
      [newExpiry, lockId, this.workerId]
    );
    
    return result.rowCount > 0;
  }
  
  async acquireRunLock(
    runId: string,
    workerId: string,
    reason: string
  ): Promise<LockResult> {
    try {
      // Use optimistic locking with version
      const result = await this.db.query<{ version: number }>(`
        UPDATE run_locks
        SET 
          locked = true,
          locked_by = $1,
          locked_at = NOW(),
          lock_reason = $2,
          version = version + 1
        WHERE 
          run_id = $3
          AND (locked = false OR locked_by = $1)
        RETURNING version
      `, [workerId, reason, runId]);
      
      if (result) {
        return {
          acquired: true,
          lockId: `run_${runId}`,
          fencingToken: result.version,
          expiresAt: new Date(Date.now() + 300000),  // 5 min default
        };
      }
      
      // Check who holds the lock
      const holder = await this.db.query<{ locked_by: string; lock_reason: string }>(
        'SELECT locked_by, lock_reason FROM run_locks WHERE run_id = $1',
        [runId]
      );
      
      return {
        acquired: false,
        lockId: '',
        fencingToken: 0,
        expiresAt: new Date(0),
        reason: `Run locked by ${holder?.locked_by}: ${holder?.lock_reason}`,
      };
      
    } catch (error) {
      return {
        acquired: false,
        lockId: '',
        fencingToken: 0,
        expiresAt: new Date(0),
        reason: `Run lock failed: ${error.message}`,
      };
    }
  }
  
  async acquireStepLock(
    runId: string,
    stepId: string,
    timeoutMs: number
  ): Promise<LockResult> {
    const lockKey = `step_${runId}_${stepId}`;
    
    return this.acquireLock(lockKey, {
      holderId: this.workerId,
      lockType: 'step',
      resourceType: 'step',
      resourceId: stepId,
      ttlMs: timeoutMs,
      metadata: { runId },
    });
  }
  
  async isStepExecuted(runId: string, stepId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(`
      SELECT EXISTS(
        SELECT 1 FROM step_executions
        WHERE run_id = $1 AND step_id = $2 AND status = 'completed'
      ) as exists
    `, [runId, stepId]);
    
    return result?.exists ?? false;
  }
  
  async recordStepStart(
    runId: string,
    stepId: string,
    workerId: string,
    idempotencyKey: string,
    fencingToken: number
  ): Promise<void> {
    // Get current attempt number
    const lastAttempt = await this.db.query<{ attempt: number }>(`
      SELECT MAX(attempt) as attempt FROM step_executions
      WHERE run_id = $1 AND step_id = $2
    `, [runId, stepId]);
    
    const attempt = (lastAttempt?.attempt ?? 0) + 1;
    
    await this.db.query(`
      INSERT INTO step_executions (
        run_id, step_id, attempt, status, worker_id,
        started_at, idempotency_key, fencing_token
      ) VALUES ($1, $2, $3, 'running', $4, NOW(), $5, $6)
    `, [runId, stepId, attempt, workerId, idempotencyKey, fencingToken]);
  }
  
  async recordStepComplete(
    runId: string,
    stepId: string,
    result: unknown
  ): Promise<void> {
    await this.db.query(`
      UPDATE step_executions
      SET status = 'completed', completed_at = NOW(), result = $1
      WHERE run_id = $2 AND step_id = $3 AND status = 'running'
    `, [JSON.stringify(result), runId, stepId]);
  }
  
  async recordStepFailure(
    runId: string,
    stepId: string,
    error: unknown
  ): Promise<void> {
    await this.db.query(`
      UPDATE step_executions
      SET status = 'failed', completed_at = NOW(), error = $1
      WHERE run_id = $2 AND step_id = $3 AND status = 'running'
    `, [JSON.stringify(error), runId, stepId]);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Lock renewal background task
export class LockRenewalService {
  private lockManager: LockManager;
  private activeLocks: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(lockManager: LockManager) {
    this.lockManager = lockManager;
  }
  
  /**
   * Start automatic renewal for a lock.
   * Renews at 50% of TTL.
   */
  startRenewal(lockId: string, ttlMs: number): void {
    const renewalInterval = ttlMs * 0.5;
    
    const timer = setInterval(async () => {
      const renewed = await this.lockManager.renewLock(lockId, ttlMs);
      if (!renewed) {
        // Lock lost - stop renewal
        this.stopRenewal(lockId);
      }
    }, renewalInterval);
    
    this.activeLocks.set(lockId, timer);
  }
  
  /**
   * Stop automatic renewal for a lock.
   */
  stopRenewal(lockId: string): void {
    const timer = this.activeLocks.get(lockId);
    if (timer) {
      clearInterval(timer);
      this.activeLocks.delete(lockId);
    }
  }
  
  /**
   * Stop all renewals (for shutdown).
   */
  stopAll(): void {
    for (const [lockId, timer] of this.activeLocks) {
      clearInterval(timer);
    }
    this.activeLocks.clear();
  }
}
```

#### 3.3 Double Execution Prevention

```typescript
// packages/worker/src/executor.ts

export class StepExecutor {
  private lockManager: LockManager;
  private toolRouter: ToolRouter;
  private creditService: CreditService;
  
  constructor(deps: StepExecutorDependencies) {
    this.lockManager = deps.lockManager;
    this.toolRouter = deps.toolRouter;
    this.creditService = deps.creditService;
  }
  
  /**
   * Execute a step with full concurrency protection.
   * 
   * Guarantees:
   * 1. No double execution (via step lock)
   * 2. No double billing (via idempotency)
   * 3. No corrupted state (via fencing tokens)
   */
  async executeStep(step: Step, run: Run): Promise<StepResult> {
    const idempotencyKey = this.generateIdempotencyKey(step, run);
    
    // 1. Check if already executed
    if (await this.lockManager.isStepExecuted(run.id, step.id)) {
      // Return cached result
      return this.getCachedResult(run.id, step.id);
    }
    
    // 2. Acquire step lock
    const lock = await this.lockManager.acquireStepLock(
      run.id,
      step.id,
      step.timeout || 60000
    );
    
    if (!lock.acquired) {
      // Another worker is executing this step
      // Wait for their result instead of executing ourselves
      return this.waitForStepCompletion(run.id, step.id, step.timeout);
    }
    
    // 3. Double-check after acquiring lock (another worker might have just finished)
    if (await this.lockManager.isStepExecuted(run.id, step.id)) {
      await this.lockManager.releaseLock(lock.lockId);
      return this.getCachedResult(run.id, step.id);
    }
    
    // 4. Record execution start with fencing token
    await this.lockManager.recordStepStart(
      run.id,
      step.id,
      this.workerId,
      idempotencyKey,
      lock.fencingToken
    );
    
    try {
      // 5. Execute the step
      const result = await this.toolRouter.execute(
        step.tool,
        step.input,
        {
          runId: run.id,
          stepId: step.id,
          tenantId: run.tenantId,
          userId: run.userId,
          timeout: step.timeout || 60000,
          creditBudget: run.creditBudget,
          idempotencyKey,
          traceContext: this.getTraceContext(),
          featureFlags: run.featureFlags,
        }
      );
      
      // 6. Record completion
      await this.lockManager.recordStepComplete(run.id, step.id, result);
      
      return {
        success: true,
        output: result.output,
        artifacts: result.artifacts,
        tokensUsed: result.tokens_used,
      };
      
    } catch (error) {
      // 7. Record failure
      await this.lockManager.recordStepFailure(run.id, step.id, error);
      
      throw error;
      
    } finally {
      // 8. Always release lock
      await this.lockManager.releaseLock(lock.lockId);
    }
  }
  
  private generateIdempotencyKey(step: Step, run: Run): string {
    // Deterministic key based on step content
    const content = JSON.stringify({
      runId: run.id,
      stepId: step.id,
      tool: step.tool,
      input: step.input,
      // Include run version to invalidate on replanning
      runVersion: run.version,
    });
    
    return createHash('sha256').update(content).digest('hex');
  }
  
  private async getCachedResult(runId: string, stepId: string): Promise<StepResult> {
    const execution = await this.db.query<StepExecution>(`
      SELECT * FROM step_executions
      WHERE run_id = $1 AND step_id = $2 AND status = 'completed'
      ORDER BY attempt DESC LIMIT 1
    `, [runId, stepId]);
    
    if (!execution) {
      throw new Error(`No completed execution found for step ${stepId}`);
    }
    
    return {
      success: true,
      output: execution.result.output,
      artifacts: execution.result.artifacts,
      tokensUsed: execution.result.tokens_used,
      cached: true,
    };
  }
  
  private async waitForStepCompletion(
    runId: string,
    stepId: string,
    timeoutMs: number
  ): Promise<StepResult> {
    const deadline = Date.now() + timeoutMs;
    
    while (Date.now() < deadline) {
      // Check if step completed
      const execution = await this.db.query<StepExecution>(`
        SELECT * FROM step_executions
        WHERE run_id = $1 AND step_id = $2
        ORDER BY attempt DESC LIMIT 1
      `, [runId, stepId]);
      
      if (execution?.status === 'completed') {
        return {
          success: true,
          output: execution.result.output,
          artifacts: execution.result.artifacts,
          tokensUsed: execution.result.tokens_used,
          cached: true,
        };
      }
      
      if (execution?.status === 'failed') {
        throw new Error(`Step failed: ${execution.error?.message}`);
      }
      
      // Wait before checking again
      await this.sleep(1000);
    }
    
    throw new Error(`Timeout waiting for step ${stepId} completion`);
  }
}
```

---

## 4. Credit Enforcement Timing

### PR-028: Real-time Credit Enforcement

Credits must be enforced in real-time to prevent overruns and ensure audit compliance.

#### 4.1 Credit Schema Extensions

```sql
-- packages/database/migrations/028_credit_enforcement.sql

-- Credit reservations for in-progress work
CREATE TABLE credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  run_id UUID NOT NULL REFERENCES runs(id),
  step_id UUID REFERENCES steps(id),
  
  -- Reservation details
  tool_name VARCHAR(255) NOT NULL,
  reserved_amount DECIMAL(20, 6) NOT NULL,
  max_amount DECIMAL(20, 6) NOT NULL,
  consumed_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- 'active', 'finalized', 'released', 'expired'
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  finalized_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  finalized_by VARCHAR(255),
  finalization_reason VARCHAR(255),
  
  -- Indexes
  INDEX idx_reservations_tenant (tenant_id),
  INDEX idx_reservations_run (run_id),
  INDEX idx_reservations_status (status) WHERE status = 'active',
  INDEX idx_reservations_expires (expires_at) WHERE status = 'active'
);

-- Credit checkpoints for mid-run enforcement
CREATE TABLE credit_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  run_id UUID NOT NULL REFERENCES runs(id),
  
  -- Checkpoint data
  checkpoint_type VARCHAR(50) NOT NULL,  -- 'periodic', 'step_complete', 'budget_warning', 'budget_exceeded'
  
  -- Balance at checkpoint
  total_consumed DECIMAL(20, 6) NOT NULL,
  total_reserved DECIMAL(20, 6) NOT NULL,
  remaining_budget DECIMAL(20, 6) NOT NULL,
  
  -- Thresholds
  budget_percentage_used DECIMAL(5, 2) NOT NULL,
  
  -- Action taken
  action_taken VARCHAR(50),  -- 'none', 'warning_sent', 'run_paused', 'run_cancelled'
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  INDEX idx_checkpoints_run (run_id, created_at)
);

-- Credit overrun log for audit
CREATE TABLE credit_overruns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  run_id UUID NOT NULL REFERENCES runs(id),
  step_id UUID REFERENCES steps(id),
  
  -- Overrun details
  tool_name VARCHAR(255) NOT NULL,
  reserved_amount DECIMAL(20, 6) NOT NULL,
  actual_amount DECIMAL(20, 6) NOT NULL,
  overrun_amount DECIMAL(20, 6) NOT NULL,
  
  -- Resolution
  resolution VARCHAR(50) NOT NULL,  -- 'absorbed', 'billed', 'refunded', 'disputed'
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  INDEX idx_overruns_tenant (tenant_id),
  INDEX idx_overruns_run (run_id),
  INDEX idx_overruns_resolution (resolution) WHERE resolution = 'disputed'
);
```

#### 4.2 Credit Service Implementation

```typescript
// packages/billing/src/credit-service.ts

export interface CreditReservation {
  id: string;
  success: boolean;
  reservedAmount: number;
  maxAmount: number;
  expiresAt: Date;
  reason?: string;
}

export interface CreditService {
  /**
   * Reserve credits for an operation.
   * Fails fast if insufficient credits.
   */
  reserve(params: {
    tenantId: string;
    runId: string;
    stepId?: string;
    amount: number;
    maxAmount: number;
    toolName: string;
  }): Promise<CreditReservation>;
  
  /**
   * Consume credits from a reservation.
   * Called periodically during long-running operations.
   */
  consume(reservationId: string, amount: number): Promise<ConsumeResult>;
  
  /**
   * Finalize a reservation with actual usage.
   */
  finalize(params: {
    reservationId: string;
    actualAmount: number;
  }): Promise<FinalizeResult>;
  
  /**
   * Release a reservation without consuming.
   */
  release(reservationId: string, reason: string): Promise<void>;
  
  /**
   * Check if tenant has available credits.
   */
  checkAvailable(tenantId: string, amount: number): Promise<boolean>;
  
  /**
   * Get remaining credits in a reservation.
   */
  getRemainingReservation(reservationId: string): Promise<number>;
  
  /**
   * Check run budget and take action if needed.
   */
  checkRunBudget(runId: string): Promise<BudgetCheckResult>;
  
  /**
   * Hard stop a run due to credit exhaustion.
   */
  hardStopRun(runId: string, reason: string): Promise<void>;
}

export interface ConsumeResult {
  success: boolean;
  consumed: number;
  remaining: number;
  budgetExhausted: boolean;
}

export interface FinalizeResult {
  success: boolean;
  finalAmount: number;
  overrun: boolean;
  overrunAmount?: number;
}

export interface BudgetCheckResult {
  status: 'ok' | 'warning' | 'critical' | 'exhausted';
  percentageUsed: number;
  remaining: number;
  action: 'none' | 'warning' | 'pause' | 'stop';
}

export class CreditServiceImpl implements CreditService {
  private db: Database;
  private eventBus: EventBus;
  private runManager: RunManager;
  
  // Budget thresholds
  private readonly WARNING_THRESHOLD = 0.75;  // 75%
  private readonly CRITICAL_THRESHOLD = 0.90;  // 90%
  private readonly STOP_THRESHOLD = 1.0;       // 100%
  
  constructor(deps: CreditServiceDependencies) {
    this.db = deps.db;
    this.eventBus = deps.eventBus;
    this.runManager = deps.runManager;
  }
  
  async reserve(params: {
    tenantId: string;
    runId: string;
    stepId?: string;
    amount: number;
    maxAmount: number;
    toolName: string;
  }): Promise<CreditReservation> {
    return this.db.transaction(async (tx) => {
      // 1. Get tenant's current balance
      const tenant = await tx.query<{ credit_balance: number; credit_limit: number }>(`
        SELECT credit_balance, credit_limit FROM tenants
        WHERE id = $1
        FOR UPDATE
      `, [params.tenantId]);
      
      if (!tenant) {
        return {
          id: '',
          success: false,
          reservedAmount: 0,
          maxAmount: 0,
          expiresAt: new Date(),
          reason: 'Tenant not found',
        };
      }
      
      // 2. Get total active reservations
      const activeReservations = await tx.query<{ total: number }>(`
        SELECT COALESCE(SUM(reserved_amount - consumed_amount), 0) as total
        FROM credit_reservations
        WHERE tenant_id = $1 AND status = 'active'
      `, [params.tenantId]);
      
      const totalReserved = activeReservations?.total ?? 0;
      const availableCredits = tenant.credit_balance - totalReserved;
      
      // 3. Check if we can reserve
      if (availableCredits < params.amount) {
        return {
          id: '',
          success: false,
          reservedAmount: 0,
          maxAmount: 0,
          expiresAt: new Date(),
          reason: `Insufficient credits. Available: ${availableCredits}, Requested: ${params.amount}`,
        };
      }
      
      // 4. Create reservation
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);  // 30 min default
      
      const reservation = await tx.query<{ id: string }>(`
        INSERT INTO credit_reservations (
          tenant_id, run_id, step_id, tool_name,
          reserved_amount, max_amount, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        params.tenantId,
        params.runId,
        params.stepId,
        params.toolName,
        params.amount,
        params.maxAmount,
        expiresAt,
      ]);
      
      return {
        id: reservation!.id,
        success: true,
        reservedAmount: params.amount,
        maxAmount: params.maxAmount,
        expiresAt,
      };
    });
  }
  
  async consume(reservationId: string, amount: number): Promise<ConsumeResult> {
    return this.db.transaction(async (tx) => {
      // 1. Get reservation with lock
      const reservation = await tx.query<CreditReservationRow>(`
        SELECT * FROM credit_reservations
        WHERE id = $1 AND status = 'active'
        FOR UPDATE
      `, [reservationId]);
      
      if (!reservation) {
        return {
          success: false,
          consumed: 0,
          remaining: 0,
          budgetExhausted: true,
        };
      }
      
      // 2. Check if consumption would exceed max
      const newConsumed = reservation.consumed_amount + amount;
      const budgetExhausted = newConsumed >= reservation.max_amount;
      
      if (newConsumed > reservation.max_amount) {
        // Log overrun but allow it (will be handled in finalization)
        await this.logOverrunAttempt(tx, reservation, amount);
      }
      
      // 3. Update consumption
      await tx.query(`
        UPDATE credit_reservations
        SET consumed_amount = $1
        WHERE id = $2
      `, [Math.min(newConsumed, reservation.max_amount), reservationId]);
      
      // 4. Check run budget
      const budgetCheck = await this.checkRunBudgetInternal(tx, reservation.run_id);
      
      if (budgetCheck.action === 'stop') {
        // Trigger hard stop
        await this.hardStopRunInternal(tx, reservation.run_id, 'Budget exhausted');
      }
      
      return {
        success: true,
        consumed: amount,
        remaining: reservation.max_amount - newConsumed,
        budgetExhausted,
      };
    });
  }
  
  async finalize(params: {
    reservationId: string;
    actualAmount: number;
  }): Promise<FinalizeResult> {
    return this.db.transaction(async (tx) => {
      // 1. Get reservation
      const reservation = await tx.query<CreditReservationRow>(`
        SELECT * FROM credit_reservations
        WHERE id = $1 AND status = 'active'
        FOR UPDATE
      `, [params.reservationId]);
      
      if (!reservation) {
        return {
          success: false,
          finalAmount: 0,
          overrun: false,
        };
      }
      
      // 2. Calculate overrun
      const overrun = params.actualAmount > reservation.reserved_amount;
      const overrunAmount = overrun 
        ? params.actualAmount - reservation.reserved_amount 
        : 0;
      
      // 3. Update tenant balance
      // Deduct actual amount, release unused reservation
      const balanceChange = params.actualAmount;
      
      await tx.query(`
        UPDATE tenants
        SET credit_balance = credit_balance - $1
        WHERE id = $2
      `, [balanceChange, reservation.tenant_id]);
      
      // 4. Finalize reservation
      await tx.query(`
        UPDATE credit_reservations
        SET 
          status = 'finalized',
          consumed_amount = $1,
          finalized_at = NOW(),
          finalization_reason = 'completed'
        WHERE id = $2
      `, [params.actualAmount, params.reservationId]);
      
      // 5. Record transaction
      await tx.query(`
        INSERT INTO credit_transactions (
          tenant_id, run_id, step_id, tool_name,
          amount, transaction_type, reservation_id
        ) VALUES ($1, $2, $3, $4, $5, 'debit', $6)
      `, [
        reservation.tenant_id,
        reservation.run_id,
        reservation.step_id,
        reservation.tool_name,
        params.actualAmount,
        params.reservationId,
      ]);
      
      // 6. Log overrun if any
      if (overrun) {
        await tx.query(`
          INSERT INTO credit_overruns (
            tenant_id, run_id, step_id, tool_name,
            reserved_amount, actual_amount, overrun_amount,
            resolution
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'absorbed')
        `, [
          reservation.tenant_id,
          reservation.run_id,
          reservation.step_id,
          reservation.tool_name,
          reservation.reserved_amount,
          params.actualAmount,
          overrunAmount,
        ]);
        
        // Emit event for monitoring
        this.eventBus.emit('credit.overrun', {
          tenantId: reservation.tenant_id,
          runId: reservation.run_id,
          toolName: reservation.tool_name,
          overrunAmount,
        });
      }
      
      return {
        success: true,
        finalAmount: params.actualAmount,
        overrun,
        overrunAmount: overrun ? overrunAmount : undefined,
      };
    });
  }
  
  async release(reservationId: string, reason: string): Promise<void> {
    await this.db.query(`
      UPDATE credit_reservations
      SET 
        status = 'released',
        finalized_at = NOW(),
        finalization_reason = $1
      WHERE id = $2 AND status = 'active'
    `, [reason, reservationId]);
  }
  
  async checkAvailable(tenantId: string, amount: number): Promise<boolean> {
    const result = await this.db.query<{ available: number }>(`
      SELECT 
        t.credit_balance - COALESCE(SUM(r.reserved_amount - r.consumed_amount), 0) as available
      FROM tenants t
      LEFT JOIN credit_reservations r ON r.tenant_id = t.id AND r.status = 'active'
      WHERE t.id = $1
      GROUP BY t.id
    `, [tenantId]);
    
    return (result?.available ?? 0) >= amount;
  }
  
  async getRemainingReservation(reservationId: string): Promise<number> {
    const result = await this.db.query<{ remaining: number }>(`
      SELECT (max_amount - consumed_amount) as remaining
      FROM credit_reservations
      WHERE id = $1 AND status = 'active'
    `, [reservationId]);
    
    return result?.remaining ?? 0;
  }
  
  async checkRunBudget(runId: string): Promise<BudgetCheckResult> {
    return this.db.transaction(async (tx) => {
      return this.checkRunBudgetInternal(tx, runId);
    });
  }
  
  private async checkRunBudgetInternal(
    tx: Transaction,
    runId: string
  ): Promise<BudgetCheckResult> {
    // Get run budget and consumption
    const run = await tx.query<{ credit_budget: number; tenant_id: string }>(`
      SELECT credit_budget, tenant_id FROM runs WHERE id = $1
    `, [runId]);
    
    if (!run) {
      return {
        status: 'exhausted',
        percentageUsed: 100,
        remaining: 0,
        action: 'stop',
      };
    }
    
    // Get total consumed for this run
    const consumed = await tx.query<{ total: number }>(`
      SELECT COALESCE(SUM(consumed_amount), 0) as total
      FROM credit_reservations
      WHERE run_id = $1 AND status IN ('active', 'finalized')
    `, [runId]);
    
    const totalConsumed = consumed?.total ?? 0;
    const percentageUsed = totalConsumed / run.credit_budget;
    const remaining = run.credit_budget - totalConsumed;
    
    // Determine status and action
    let status: BudgetCheckResult['status'];
    let action: BudgetCheckResult['action'];
    
    if (percentageUsed >= this.STOP_THRESHOLD) {
      status = 'exhausted';
      action = 'stop';
    } else if (percentageUsed >= this.CRITICAL_THRESHOLD) {
      status = 'critical';
      action = 'pause';
    } else if (percentageUsed >= this.WARNING_THRESHOLD) {
      status = 'warning';
      action = 'warning';
    } else {
      status = 'ok';
      action = 'none';
    }
    
    // Record checkpoint
    await tx.query(`
      INSERT INTO credit_checkpoints (
        run_id, checkpoint_type, total_consumed, total_reserved,
        remaining_budget, budget_percentage_used, action_taken
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      runId,
      status === 'exhausted' ? 'budget_exceeded' : 
        status === 'warning' ? 'budget_warning' : 'periodic',
      totalConsumed,
      0,  // TODO: Calculate active reservations
      remaining,
      percentageUsed * 100,
      action,
    ]);
    
    return {
      status,
      percentageUsed: percentageUsed * 100,
      remaining,
      action,
    };
  }
  
  async hardStopRun(runId: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.hardStopRunInternal(tx, runId, reason);
    });
  }
  
  private async hardStopRunInternal(
    tx: Transaction,
    runId: string,
    reason: string
  ): Promise<void> {
    // 1. Update run status
    await tx.query(`
      UPDATE runs
      SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = $1
      WHERE id = $2 AND status NOT IN ('completed', 'failed', 'cancelled')
    `, [reason, runId]);
    
    // 2. Release all active reservations
    await tx.query(`
      UPDATE credit_reservations
      SET 
        status = 'released',
        finalized_at = NOW(),
        finalization_reason = 'run_cancelled'
      WHERE run_id = $1 AND status = 'active'
    `, [runId]);
    
    // 3. Cancel any pending steps
    await tx.query(`
      UPDATE steps
      SET status = 'cancelled'
      WHERE run_id = $1 AND status = 'pending'
    `, [runId]);
    
    // 4. Emit event
    this.eventBus.emit('run.hard_stopped', {
      runId,
      reason,
      timestamp: new Date(),
    });
  }
  
  private async logOverrunAttempt(
    tx: Transaction,
    reservation: CreditReservationRow,
    attemptedAmount: number
  ): Promise<void> {
    console.warn(`Credit overrun attempt: reservation=${reservation.id}, ` +
      `max=${reservation.max_amount}, consumed=${reservation.consumed_amount}, ` +
      `attempted=${attemptedAmount}`);
  }
}

// Background job to expire stale reservations
export class ReservationExpiryJob {
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  async run(): Promise<{ expired: number }> {
    const result = await this.db.query(`
      UPDATE credit_reservations
      SET 
        status = 'expired',
        finalized_at = NOW(),
        finalization_reason = 'expired'
      WHERE status = 'active' AND expires_at < NOW()
    `);
    
    return { expired: result.rowCount };
  }
}
```

#### 4.3 Partial Credit Rollback

```typescript
// packages/billing/src/rollback.ts

export interface RollbackResult {
  success: boolean;
  refundedAmount: number;
  reason: string;
}

export class CreditRollbackService {
  private db: Database;
  private eventBus: EventBus;
  
  constructor(deps: { db: Database; eventBus: EventBus }) {
    this.db = deps.db;
    this.eventBus = deps.eventBus;
  }
  
  /**
   * Rollback credits for a partially completed run.
   * 
   * Rules:
   * 1. Completed steps are NOT refunded (work was done)
   * 2. Failed steps MAY be partially refunded (depends on failure point)
   * 3. Pending steps are fully refunded
   * 4. System errors get full refund
   */
  async rollbackRun(
    runId: string,
    reason: RollbackReason
  ): Promise<RollbackResult> {
    return this.db.transaction(async (tx) => {
      // 1. Get run details
      const run = await tx.query<RunRow>(`
        SELECT * FROM runs WHERE id = $1 FOR UPDATE
      `, [runId]);
      
      if (!run) {
        return {
          success: false,
          refundedAmount: 0,
          reason: 'Run not found',
        };
      }
      
      // 2. Calculate refund based on reason
      let refundAmount = 0;
      
      switch (reason.type) {
        case 'system_error':
          // Full refund for system errors
          refundAmount = await this.calculateFullRefund(tx, runId);
          break;
          
        case 'user_cancelled':
          // Refund only pending/unreserved credits
          refundAmount = await this.calculatePartialRefund(tx, runId);
          break;
          
        case 'budget_exceeded':
          // No refund - user exceeded their budget
          refundAmount = 0;
          break;
          
        case 'tool_failure':
          // Partial refund based on failure point
          refundAmount = await this.calculateToolFailureRefund(
            tx, 
            runId, 
            reason.stepId!,
            reason.failurePoint!
          );
          break;
      }
      
      if (refundAmount <= 0) {
        return {
          success: true,
          refundedAmount: 0,
          reason: 'No refund applicable',
        };
      }
      
      // 3. Issue refund
      await tx.query(`
        UPDATE tenants
        SET credit_balance = credit_balance + $1
        WHERE id = $2
      `, [refundAmount, run.tenant_id]);
      
      // 4. Record refund transaction
      await tx.query(`
        INSERT INTO credit_transactions (
          tenant_id, run_id, amount, transaction_type, notes
        ) VALUES ($1, $2, $3, 'refund', $4)
      `, [run.tenant_id, runId, refundAmount, reason.description]);
      
      // 5. Emit event
      this.eventBus.emit('credit.refund', {
        tenantId: run.tenant_id,
        runId,
        amount: refundAmount,
        reason: reason.type,
      });
      
      return {
        success: true,
        refundedAmount: refundAmount,
        reason: `Refunded ${refundAmount} credits: ${reason.description}`,
      };
    });
  }
  
  private async calculateFullRefund(
    tx: Transaction,
    runId: string
  ): Promise<number> {
    const result = await tx.query<{ total: number }>(`
      SELECT COALESCE(SUM(consumed_amount), 0) as total
      FROM credit_reservations
      WHERE run_id = $1 AND status = 'finalized'
    `, [runId]);
    
    return result?.total ?? 0;
  }
  
  private async calculatePartialRefund(
    tx: Transaction,
    runId: string
  ): Promise<number> {
    // Only refund active (unconsumed) reservations
    const result = await tx.query<{ total: number }>(`
      SELECT COALESCE(SUM(reserved_amount - consumed_amount), 0) as total
      FROM credit_reservations
      WHERE run_id = $1 AND status = 'active'
    `, [runId]);
    
    return result?.total ?? 0;
  }
  
  private async calculateToolFailureRefund(
    tx: Transaction,
    runId: string,
    stepId: string,
    failurePoint: number  // 0-1, how far through execution
  ): Promise<number> {
    // Get the step's reservation
    const reservation = await tx.query<CreditReservationRow>(`
      SELECT * FROM credit_reservations
      WHERE run_id = $1 AND step_id = $2
      ORDER BY created_at DESC LIMIT 1
    `, [runId, stepId]);
    
    if (!reservation) {
      return 0;
    }
    
    // Refund proportional to work not done
    const refundPercentage = 1 - failurePoint;
    const refundAmount = reservation.consumed_amount * refundPercentage;
    
    // Minimum refund threshold (don't refund tiny amounts)
    if (refundAmount < 0.01) {
      return 0;
    }
    
    return refundAmount;
  }
}

export interface RollbackReason {
  type: 'system_error' | 'user_cancelled' | 'budget_exceeded' | 'tool_failure';
  description: string;
  stepId?: string;
  failurePoint?: number;
}
```

---

## 5. Implementation Order

The recommended implementation order for Part 4:

| PR | Title | Dependencies | Estimated Effort |
|----|-------|--------------|------------------|
| PR-025 | Tool Router Contract | None | 2 weeks |
| PR-025a | Tool Registry | PR-025 | 3 days |
| PR-025b | Sandbox Routing | PR-025 | 1 week |
| PR-025c | Retry Logic | PR-025 | 3 days |
| PR-026 | Artifact Registry | None | 2 weeks |
| PR-026a | Content Addressing | PR-026 | 3 days |
| PR-026b | Provenance Tracking | PR-026 | 3 days |
| PR-026c | Garbage Collection | PR-026 | 3 days |
| PR-027 | Concurrency Model | None | 2 weeks |
| PR-027a | Distributed Locks | PR-027 | 1 week |
| PR-027b | Step Idempotency | PR-027 | 3 days |
| PR-028 | Credit Enforcement | PR-027 | 2 weeks |
| PR-028a | Real-time Checks | PR-028 | 3 days |
| PR-028b | Partial Rollback | PR-028 | 3 days |

**Total Estimated Effort:** 10-12 weeks

---

## 6. References

1. Distributed Locks with Redis - Martin Kleppmann
2. Idempotency Patterns - Stripe Engineering Blog
3. Content-Addressable Storage - IPFS Documentation
4. Fencing Tokens - Designing Data-Intensive Applications
5. Credit Systems Design - Uber Engineering
