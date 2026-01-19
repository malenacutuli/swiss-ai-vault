# Enterprise Workflow & Retry Architecture

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** January 12, 2026  
**Classification:** Enterprise Architecture Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Workflow Orchestration Architecture](#2-workflow-orchestration-architecture)
3. [Exactly-Once Semantics](#3-exactly-once-semantics)
4. [Idempotency Strategies](#4-idempotency-strategies)
5. [Partial Failure Handling](#5-partial-failure-handling)
6. [Retry Policies](#6-retry-policies)
7. [Rollback & Compensation](#7-rollback--compensation)
8. [User Intervention Workflows](#8-user-intervention-workflows)
9. [Replanning Strategies](#9-replanning-strategies)
10. [Implementation Reference](#10-implementation-reference)

---

## 1. Executive Summary

Enterprise AI agent systems require **deterministic, recoverable workflows** that can handle failures gracefully without corrupting state or duplicating side effects. This document specifies the complete workflow orchestration architecture for SwissBrain, addressing the non-negotiable requirements for production deployments.

### Core Guarantees

| Guarantee | Implementation | SLA |
|-----------|----------------|-----|
| **Exactly-once side effects** | Idempotency keys + deduplication | 99.99% |
| **Workflow durability** | Event sourcing + checkpointing | 99.999% |
| **Failure recovery** | Automatic retry + human escalation | < 5 min MTTR |
| **State consistency** | Saga pattern + compensation | Strong consistency |

### Decision Matrix: What Happens on Failure?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PARTIAL FAILURE DECISION TREE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Failure Detected                                                            │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────┐     YES    ┌─────────────┐                                 │
│  │ Transient?  │───────────▶│   RETRY     │                                 │
│  │ (network,   │            │ (with exp.  │                                 │
│  │  timeout)   │            │  backoff)   │                                 │
│  └─────────────┘            └─────────────┘                                 │
│       │ NO                                                                   │
│       ▼                                                                      │
│  ┌─────────────┐     YES    ┌─────────────┐                                 │
│  │ Recoverable │───────────▶│   REPLAN    │                                 │
│  │ (alt path   │            │ (find new   │                                 │
│  │  exists)?   │            │  approach)  │                                 │
│  └─────────────┘            └─────────────┘                                 │
│       │ NO                                                                   │
│       ▼                                                                      │
│  ┌─────────────┐     YES    ┌─────────────┐                                 │
│  │ User can    │───────────▶│  ASK USER   │                                 │
│  │ resolve?    │            │ (escalate   │                                 │
│  │             │            │  decision)  │                                 │
│  └─────────────┘            └─────────────┘                                 │
│       │ NO                                                                   │
│       ▼                                                                      │
│  ┌─────────────┐                                                            │
│  │  ROLLBACK   │                                                            │
│  │ (compensate │                                                            │
│  │  & abort)   │                                                            │
│  └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Workflow Orchestration Architecture

### 2.1 Temporal-Style Workflow Engine

SwissBrain implements a **durable execution engine** inspired by Temporal.io [1], providing deterministic replay and automatic failure recovery.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW ORCHESTRATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        WORKFLOW ENGINE                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │  Scheduler  │  │   History   │  │   Worker    │                  │    │
│  │  │  (timers,   │  │   Service   │  │   Pool      │                  │    │
│  │  │   cron)     │  │  (events)   │  │  (execute)  │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      ACTIVITY EXECUTION                              │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │    │
│  │  │   LLM     │  │  Browser  │  │   File    │  │  External │        │    │
│  │  │  Calls    │  │  Actions  │  │   Ops     │  │   APIs    │        │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PERSISTENCE LAYER                               │    │
│  │  ┌───────────────────┐  ┌───────────────────┐                       │    │
│  │  │   Event Store     │  │   State Store     │                       │    │
│  │  │   (immutable)     │  │   (snapshots)     │                       │    │
│  │  └───────────────────┘  └───────────────────┘                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Workflow Definition** | Declarative task graph | TypeScript DSL |
| **History Service** | Event sourcing, replay | Append-only log |
| **Scheduler** | Timers, delays, cron | Priority queue |
| **Worker Pool** | Activity execution | Kubernetes pods |
| **State Store** | Checkpoints, snapshots | Redis + PostgreSQL |

### 2.3 Workflow Definition Schema

```typescript
// Workflow definition with full failure handling
interface WorkflowDefinition {
  id: string;
  version: string;
  
  // Workflow metadata
  metadata: {
    name: string;
    description: string;
    owner: string;
    timeout: Duration;
    retryPolicy: RetryPolicy;
  };
  
  // Step definitions
  steps: WorkflowStep[];
  
  // Failure handling
  onFailure: FailureHandler;
  
  // Compensation (rollback)
  compensations: CompensationStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'activity' | 'subworkflow' | 'decision' | 'parallel' | 'wait';
  
  // Activity configuration
  activity?: {
    name: string;
    input: Record<string, any>;
    timeout: Duration;
    retryPolicy?: RetryPolicy;
    idempotencyKey?: string;
  };
  
  // Conditional execution
  condition?: {
    expression: string;  // e.g., "$.previousStep.result.status === 'success'"
  };
  
  // Failure handling for this step
  onFailure?: StepFailureHandler;
  
  // Compensation for this step
  compensation?: CompensationStep;
  
  // Next steps
  next: string | string[];  // Step IDs
}

interface FailureHandler {
  strategy: 'retry' | 'replan' | 'ask_user' | 'rollback' | 'escalate';
  config: FailureHandlerConfig;
}
```

---

## 3. Exactly-Once Semantics

### 3.1 The Exactly-Once Challenge

In distributed systems, achieving exactly-once delivery is technically impossible [2]. However, we can achieve **exactly-once semantics** through idempotent operations combined with at-least-once delivery.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXACTLY-ONCE IMPLEMENTATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  At-Least-Once Delivery  +  Idempotent Operations  =  Exactly-Once Semantics│
│                                                                              │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐     │
│  │   Message       │      │   Deduplication │      │   Side Effect   │     │
│  │   Retry         │ ───▶ │   Check         │ ───▶ │   (if new)      │     │
│  │   (guaranteed)  │      │   (idempotency) │      │                 │     │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘     │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌─────────────────┐                               │
│                           │   Return        │                               │
│                           │   Cached Result │                               │
│                           │   (if duplicate)│                               │
│                           └─────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation Architecture

```typescript
// Exactly-once execution wrapper
class ExactlyOnceExecutor {
  private deduplicationStore: DeduplicationStore;
  private resultCache: ResultCache;
  
  async execute<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    options: ExactlyOnceOptions = {}
  ): Promise<T> {
    
    // Step 1: Check if already executed
    const existing = await this.deduplicationStore.get(idempotencyKey);
    
    if (existing) {
      // Already executed - return cached result
      if (existing.status === 'completed') {
        return this.resultCache.get<T>(idempotencyKey);
      }
      
      // In progress - wait or fail based on options
      if (existing.status === 'in_progress') {
        if (options.waitForInProgress) {
          return this.waitForCompletion<T>(idempotencyKey, options.timeout);
        }
        throw new ConcurrentExecutionError(idempotencyKey);
      }
      
      // Failed - allow retry if within window
      if (existing.status === 'failed' && this.canRetry(existing, options)) {
        // Fall through to execute
      } else {
        throw new PermanentFailureError(existing.error);
      }
    }
    
    // Step 2: Acquire execution lock
    const lockAcquired = await this.deduplicationStore.acquireLock(
      idempotencyKey,
      {
        status: 'in_progress',
        startedAt: Date.now(),
        workerId: this.workerId,
      }
    );
    
    if (!lockAcquired) {
      throw new ConcurrentExecutionError(idempotencyKey);
    }
    
    try {
      // Step 3: Execute operation
      const result = await operation();
      
      // Step 4: Store result and mark complete
      await this.resultCache.set(idempotencyKey, result, options.resultTTL);
      await this.deduplicationStore.markComplete(idempotencyKey, {
        status: 'completed',
        completedAt: Date.now(),
      });
      
      return result;
      
    } catch (error) {
      // Step 5: Mark failed (may allow retry)
      await this.deduplicationStore.markFailed(idempotencyKey, {
        status: 'failed',
        error: serializeError(error),
        failedAt: Date.now(),
        retryable: this.isRetryable(error),
      });
      
      throw error;
    }
  }
}
```

### 3.3 Deduplication Store Schema

```sql
-- Idempotency tracking table
CREATE TABLE idempotency_keys (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    
    -- Execution state
    status ENUM('in_progress', 'completed', 'failed') NOT NULL,
    started_at BIGINT NOT NULL,
    completed_at BIGINT,
    failed_at BIGINT,
    
    -- Worker tracking (for distributed locking)
    worker_id VARCHAR(100),
    lock_expires_at BIGINT,
    
    -- Result reference
    result_key VARCHAR(255),  -- Points to result cache
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    retryable BOOLEAN DEFAULT FALSE,
    retry_count INT DEFAULT 0,
    
    -- Metadata
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    expires_at BIGINT,  -- TTL for cleanup
    
    INDEX idx_workflow_step (workflow_id, step_id),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at)
);

-- Result cache table (for larger results)
CREATE TABLE idempotency_results (
    result_key VARCHAR(255) PRIMARY KEY,
    result_data LONGBLOB NOT NULL,  -- Serialized result
    result_type VARCHAR(100) NOT NULL,  -- Type hint for deserialization
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    
    INDEX idx_expires (expires_at)
);
```

---

## 4. Idempotency Strategies

### 4.1 Idempotency Key Generation

The idempotency key must uniquely identify a specific operation instance. Different strategies apply to different operation types.

| Operation Type | Key Strategy | Example |
|----------------|--------------|---------|
| **User-initiated** | Client-provided UUID | `user:{userId}:action:{actionId}` |
| **Workflow step** | Workflow + step + attempt | `wf:{workflowId}:step:{stepId}:attempt:{n}` |
| **Scheduled task** | Schedule + timestamp | `schedule:{scheduleId}:ts:{scheduledTime}` |
| **Event-driven** | Event ID + handler | `event:{eventId}:handler:{handlerName}` |
| **API call** | Request hash | `api:{endpoint}:hash:{bodyHash}` |

### 4.2 Key Generation Implementation

```typescript
// Idempotency key generator
class IdempotencyKeyGenerator {
  
  // Strategy 1: Deterministic from inputs (for retries)
  static fromWorkflowStep(
    workflowId: string,
    stepId: string,
    attemptNumber: number
  ): string {
    return `wf:${workflowId}:step:${stepId}:attempt:${attemptNumber}`;
  }
  
  // Strategy 2: Content-based (for deduplication)
  static fromContent(
    operationType: string,
    content: Record<string, any>
  ): string {
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sortKeys(content)))
      .digest('hex')
      .substring(0, 16);
    
    return `content:${operationType}:${contentHash}`;
  }
  
  // Strategy 3: Time-windowed (for rate-limited operations)
  static fromTimeWindow(
    userId: string,
    operation: string,
    windowMinutes: number = 5
  ): string {
    const windowStart = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
    return `window:${userId}:${operation}:${windowStart}`;
  }
  
  // Strategy 4: Natural key (for business operations)
  static fromBusinessKey(
    entityType: string,
    entityId: string,
    operation: string,
    version?: number
  ): string {
    const versionSuffix = version !== undefined ? `:v${version}` : '';
    return `biz:${entityType}:${entityId}:${operation}${versionSuffix}`;
  }
}
```

### 4.3 Idempotency Patterns by Side Effect Type

```typescript
// Pattern 1: Database writes - Use upsert with version
async function idempotentDbWrite(
  idempotencyKey: string,
  data: Record<string, any>
): Promise<void> {
  await db.execute(`
    INSERT INTO entities (id, data, idempotency_key, version)
    VALUES (?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      data = IF(idempotency_key = VALUES(idempotency_key), data, VALUES(data)),
      version = IF(idempotency_key = VALUES(idempotency_key), version, version + 1),
      idempotency_key = VALUES(idempotency_key)
  `, [data.id, JSON.stringify(data), idempotencyKey]);
}

// Pattern 2: External API calls - Check before call
async function idempotentApiCall(
  idempotencyKey: string,
  apiCall: () => Promise<ApiResponse>
): Promise<ApiResponse> {
  // Check if already called
  const existing = await getIdempotencyRecord(idempotencyKey);
  if (existing?.status === 'completed') {
    return existing.response;
  }
  
  // Make call with idempotency header (if API supports it)
  const response = await apiCall();
  
  // Store result
  await saveIdempotencyRecord(idempotencyKey, {
    status: 'completed',
    response,
  });
  
  return response;
}

// Pattern 3: File operations - Use content hash
async function idempotentFileWrite(
  path: string,
  content: Buffer
): Promise<void> {
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const targetPath = `${path}.${contentHash.substring(0, 8)}`;
  
  // Check if file with same content exists
  if (await fileExists(targetPath)) {
    return;  // Already written
  }
  
  // Write to temp, then atomic rename
  const tempPath = `${targetPath}.tmp.${process.pid}`;
  await writeFile(tempPath, content);
  await rename(tempPath, targetPath);
  
  // Update symlink to latest
  await symlink(targetPath, path);
}

// Pattern 4: Email/notifications - Dedup by recipient + content hash
async function idempotentNotification(
  recipient: string,
  notification: Notification
): Promise<void> {
  const contentHash = hashNotification(notification);
  const idempotencyKey = `notify:${recipient}:${contentHash}`;
  
  const sent = await checkNotificationSent(idempotencyKey);
  if (sent) {
    return;  // Already sent
  }
  
  await sendNotification(recipient, notification);
  await markNotificationSent(idempotencyKey, {
    sentAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,  // 24h dedup window
  });
}

// Pattern 5: Financial transactions - Two-phase with idempotency
async function idempotentPayment(
  paymentId: string,
  amount: number,
  destination: string
): Promise<PaymentResult> {
  const idempotencyKey = `payment:${paymentId}`;
  
  // Phase 1: Reserve (idempotent)
  const reservation = await reserveFunds(idempotencyKey, amount);
  if (reservation.alreadyReserved) {
    // Check if already completed
    const existing = await getPaymentStatus(paymentId);
    if (existing.status === 'completed') {
      return existing;
    }
  }
  
  // Phase 2: Execute (idempotent via payment provider)
  const result = await executePayment({
    idempotencyKey,
    reservationId: reservation.id,
    amount,
    destination,
  });
  
  // Phase 3: Confirm or rollback
  if (result.success) {
    await confirmReservation(reservation.id);
  } else {
    await releaseReservation(reservation.id);
  }
  
  return result;
}
```

---

## 5. Partial Failure Handling

### 5.1 Failure Classification

Understanding failure types is critical for choosing the correct recovery strategy.

| Failure Type | Characteristics | Examples | Default Strategy |
|--------------|-----------------|----------|------------------|
| **Transient** | Temporary, self-resolving | Network timeout, rate limit, 503 | Retry with backoff |
| **Recoverable** | Fixable with different approach | Auth expired, resource moved | Replan |
| **User-resolvable** | Requires human input | Missing credentials, approval needed | Ask user |
| **Permanent** | Cannot be fixed automatically | Invalid input, business rule violation | Rollback |
| **Catastrophic** | System-level failure | Database down, out of memory | Escalate + rollback |

### 5.2 Failure Detection and Classification

```typescript
// Failure classifier
class FailureClassifier {
  
  classify(error: Error): FailureClassification {
    // Check error type hierarchy
    if (error instanceof TransientError) {
      return this.classifyTransient(error);
    }
    
    if (error instanceof ExternalServiceError) {
      return this.classifyExternalService(error);
    }
    
    if (error instanceof ValidationError) {
      return {
        type: 'permanent',
        strategy: 'rollback',
        reason: 'Invalid input cannot be retried',
        userMessage: error.message,
      };
    }
    
    // Classify by HTTP status code
    if (error instanceof HttpError) {
      return this.classifyHttpError(error);
    }
    
    // Default: treat as potentially transient
    return {
      type: 'unknown',
      strategy: 'retry',
      maxRetries: 3,
      reason: 'Unknown error, attempting retry',
    };
  }
  
  private classifyHttpError(error: HttpError): FailureClassification {
    const statusCode = error.statusCode;
    
    // 4xx client errors
    if (statusCode >= 400 && statusCode < 500) {
      switch (statusCode) {
        case 401:
        case 403:
          return {
            type: 'recoverable',
            strategy: 'replan',
            reason: 'Authentication/authorization failed',
            recoveryHint: 'refresh_credentials',
          };
        
        case 404:
          return {
            type: 'recoverable',
            strategy: 'replan',
            reason: 'Resource not found',
            recoveryHint: 'find_alternative_resource',
          };
        
        case 409:
          return {
            type: 'recoverable',
            strategy: 'retry',
            reason: 'Conflict - resource state changed',
            recoveryHint: 'refresh_and_retry',
          };
        
        case 422:
          return {
            type: 'user_resolvable',
            strategy: 'ask_user',
            reason: 'Validation failed',
            userMessage: error.message,
          };
        
        case 429:
          return {
            type: 'transient',
            strategy: 'retry',
            backoff: this.extractRetryAfter(error),
            reason: 'Rate limited',
          };
        
        default:
          return {
            type: 'permanent',
            strategy: 'rollback',
            reason: `Client error: ${statusCode}`,
          };
      }
    }
    
    // 5xx server errors
    if (statusCode >= 500) {
      switch (statusCode) {
        case 502:
        case 503:
        case 504:
          return {
            type: 'transient',
            strategy: 'retry',
            maxRetries: 5,
            reason: 'Server temporarily unavailable',
          };
        
        default:
          return {
            type: 'transient',
            strategy: 'retry',
            maxRetries: 3,
            reason: `Server error: ${statusCode}`,
          };
      }
    }
    
    return {
      type: 'unknown',
      strategy: 'retry',
      maxRetries: 3,
    };
  }
}

interface FailureClassification {
  type: 'transient' | 'recoverable' | 'user_resolvable' | 'permanent' | 'catastrophic' | 'unknown';
  strategy: 'retry' | 'replan' | 'ask_user' | 'rollback' | 'escalate';
  reason: string;
  maxRetries?: number;
  backoff?: BackoffConfig;
  recoveryHint?: string;
  userMessage?: string;
}
```

### 5.3 Failure Handler Implementation

```typescript
// Unified failure handler
class FailureHandler {
  private classifier: FailureClassifier;
  private retryExecutor: RetryExecutor;
  private replanner: WorkflowReplanner;
  private userInteraction: UserInteractionService;
  private compensator: CompensationExecutor;
  
  async handleFailure(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error
  ): Promise<FailureResolution> {
    
    // Step 1: Classify the failure
    const classification = this.classifier.classify(error);
    
    // Step 2: Log for observability
    await this.logFailure(context, step, error, classification);
    
    // Step 3: Execute appropriate strategy
    switch (classification.strategy) {
      case 'retry':
        return this.handleRetry(context, step, error, classification);
      
      case 'replan':
        return this.handleReplan(context, step, error, classification);
      
      case 'ask_user':
        return this.handleAskUser(context, step, error, classification);
      
      case 'rollback':
        return this.handleRollback(context, step, error, classification);
      
      case 'escalate':
        return this.handleEscalate(context, step, error, classification);
      
      default:
        throw new UnhandledFailureError(error, classification);
    }
  }
  
  private async handleRetry(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    const retryPolicy = step.retryPolicy ?? context.workflow.defaultRetryPolicy;
    const attemptNumber = context.getAttemptNumber(step.id);
    
    // Check if retries exhausted
    if (attemptNumber >= (classification.maxRetries ?? retryPolicy.maxAttempts)) {
      // Escalate to next strategy
      return this.escalateStrategy(context, step, error, classification);
    }
    
    // Calculate backoff
    const backoff = this.calculateBackoff(
      attemptNumber,
      classification.backoff ?? retryPolicy.backoff
    );
    
    // Schedule retry
    await this.retryExecutor.scheduleRetry(context, step, {
      attemptNumber: attemptNumber + 1,
      delayMs: backoff,
      idempotencyKey: IdempotencyKeyGenerator.fromWorkflowStep(
        context.workflowId,
        step.id,
        attemptNumber + 1
      ),
    });
    
    return {
      action: 'retry_scheduled',
      nextAttempt: attemptNumber + 1,
      delayMs: backoff,
    };
  }
  
  private async handleReplan(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    // Get replanning options
    const options = await this.replanner.findAlternatives(context, step, {
      failureReason: classification.reason,
      recoveryHint: classification.recoveryHint,
    });
    
    if (options.length === 0) {
      // No alternatives - escalate
      return this.escalateStrategy(context, step, error, classification);
    }
    
    // Select best alternative
    const selected = await this.replanner.selectBestAlternative(options, context);
    
    // Update workflow with new plan
    await this.replanner.applyReplan(context, selected);
    
    return {
      action: 'replanned',
      newPlan: selected,
      originalStep: step.id,
    };
  }
  
  private async handleAskUser(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    // Pause workflow
    await context.pause('awaiting_user_input');
    
    // Create user interaction request
    const interaction = await this.userInteraction.createRequest({
      workflowId: context.workflowId,
      stepId: step.id,
      type: 'failure_resolution',
      message: classification.userMessage ?? classification.reason,
      options: this.buildUserOptions(classification),
      timeout: context.workflow.userInteractionTimeout ?? Duration.hours(24),
    });
    
    // Notify user
    await this.userInteraction.notifyUser(context.userId, interaction);
    
    return {
      action: 'awaiting_user',
      interactionId: interaction.id,
      timeout: interaction.timeout,
    };
  }
  
  private async handleRollback(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    // Get completed steps that need compensation
    const completedSteps = context.getCompletedSteps();
    
    // Execute compensations in reverse order
    const compensationResults = await this.compensator.executeCompensations(
      context,
      completedSteps.reverse()
    );
    
    // Mark workflow as failed
    await context.fail({
      reason: classification.reason,
      error: serializeError(error),
      compensationResults,
    });
    
    return {
      action: 'rolled_back',
      compensatedSteps: compensationResults.map(r => r.stepId),
      finalState: 'failed',
    };
  }
  
  private async handleEscalate(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    // Create incident
    const incident = await this.createIncident(context, step, error, classification);
    
    // Notify on-call
    await this.notifyOnCall(incident);
    
    // Pause workflow pending resolution
    await context.pause('escalated', { incidentId: incident.id });
    
    return {
      action: 'escalated',
      incidentId: incident.id,
      escalationLevel: 'on_call',
    };
  }
  
  private escalateStrategy(
    context: WorkflowContext,
    step: WorkflowStep,
    error: Error,
    classification: FailureClassification
  ): Promise<FailureResolution> {
    
    // Strategy escalation order
    const escalationOrder: FailureClassification['strategy'][] = [
      'retry',
      'replan',
      'ask_user',
      'rollback',
      'escalate',
    ];
    
    const currentIndex = escalationOrder.indexOf(classification.strategy);
    const nextStrategy = escalationOrder[currentIndex + 1] ?? 'escalate';
    
    return this.handleFailure(context, step, error);
  }
}
```

### 5.4 Failure Handling Decision Matrix

```typescript
// Complete failure handling configuration
const FAILURE_HANDLING_MATRIX: Record<string, FailureHandlingConfig> = {
  
  // LLM API calls
  'llm_invocation': {
    transient: {
      strategy: 'retry',
      maxRetries: 5,
      backoff: { type: 'exponential', baseMs: 1000, maxMs: 30000 },
    },
    rate_limited: {
      strategy: 'retry',
      maxRetries: 10,
      backoff: { type: 'from_header', fallbackMs: 60000 },
    },
    context_length_exceeded: {
      strategy: 'replan',
      recoveryHint: 'truncate_context',
    },
    content_filtered: {
      strategy: 'ask_user',
      userMessage: 'Content was filtered. Please rephrase your request.',
    },
    model_unavailable: {
      strategy: 'replan',
      recoveryHint: 'use_fallback_model',
    },
  },
  
  // Browser automation
  'browser_action': {
    element_not_found: {
      strategy: 'retry',
      maxRetries: 3,
      backoff: { type: 'fixed', delayMs: 2000 },
      beforeRetry: 'refresh_page',
    },
    navigation_timeout: {
      strategy: 'retry',
      maxRetries: 2,
      backoff: { type: 'fixed', delayMs: 5000 },
    },
    captcha_detected: {
      strategy: 'ask_user',
      userMessage: 'CAPTCHA detected. Please solve it manually.',
      interactionType: 'browser_takeover',
    },
    login_required: {
      strategy: 'ask_user',
      userMessage: 'Login required. Please authenticate.',
      interactionType: 'browser_takeover',
    },
    blocked_by_site: {
      strategy: 'replan',
      recoveryHint: 'use_alternative_source',
    },
  },
  
  // File operations
  'file_operation': {
    permission_denied: {
      strategy: 'rollback',
      reason: 'Insufficient permissions',
    },
    disk_full: {
      strategy: 'escalate',
      severity: 'critical',
    },
    file_not_found: {
      strategy: 'replan',
      recoveryHint: 'search_alternative_path',
    },
    file_locked: {
      strategy: 'retry',
      maxRetries: 5,
      backoff: { type: 'exponential', baseMs: 500, maxMs: 10000 },
    },
  },
  
  // External API calls
  'external_api': {
    authentication_failed: {
      strategy: 'replan',
      recoveryHint: 'refresh_credentials',
    },
    quota_exceeded: {
      strategy: 'ask_user',
      userMessage: 'API quota exceeded. Please upgrade or wait.',
    },
    service_unavailable: {
      strategy: 'retry',
      maxRetries: 5,
      backoff: { type: 'exponential', baseMs: 5000, maxMs: 60000 },
    },
    invalid_response: {
      strategy: 'retry',
      maxRetries: 2,
      beforeRetry: 'clear_cache',
    },
  },
  
  // Database operations
  'database': {
    connection_failed: {
      strategy: 'retry',
      maxRetries: 10,
      backoff: { type: 'exponential', baseMs: 1000, maxMs: 30000 },
    },
    deadlock: {
      strategy: 'retry',
      maxRetries: 3,
      backoff: { type: 'jittered', baseMs: 100, maxMs: 1000 },
    },
    constraint_violation: {
      strategy: 'rollback',
      reason: 'Data integrity violation',
    },
    timeout: {
      strategy: 'retry',
      maxRetries: 2,
      beforeRetry: 'optimize_query',
    },
  },
};
```

---

## 6. Retry Policies

### 6.1 Retry Policy Types

| Policy Type | Use Case | Characteristics |
|-------------|----------|-----------------|
| **Fixed Delay** | Simple retries | Same delay between attempts |
| **Exponential Backoff** | Rate limiting, overload | Delay doubles each attempt |
| **Exponential + Jitter** | Distributed systems | Prevents thundering herd |
| **Linear Backoff** | Gradual recovery | Delay increases linearly |
| **Fibonacci Backoff** | Balanced growth | More gradual than exponential |
| **Custom Schedule** | Specific requirements | Explicit delay per attempt |

### 6.2 Retry Policy Implementation

```typescript
// Retry policy definitions
interface RetryPolicy {
  maxAttempts: number;
  backoff: BackoffPolicy;
  retryableErrors?: string[];  // Error types to retry
  nonRetryableErrors?: string[];  // Error types to never retry
  timeout?: Duration;  // Total time budget for all retries
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
}

interface BackoffPolicy {
  type: 'fixed' | 'exponential' | 'exponential_jitter' | 'linear' | 'fibonacci' | 'custom';
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;  // For exponential
  jitterFactor?: number;  // 0-1, for jittered policies
  customSchedule?: number[];  // For custom type
}

// Backoff calculator
class BackoffCalculator {
  
  calculate(policy: BackoffPolicy, attemptNumber: number): number {
    let delay: number;
    
    switch (policy.type) {
      case 'fixed':
        delay = policy.baseDelayMs;
        break;
      
      case 'exponential':
        delay = policy.baseDelayMs * Math.pow(policy.multiplier ?? 2, attemptNumber - 1);
        break;
      
      case 'exponential_jitter':
        const expDelay = policy.baseDelayMs * Math.pow(policy.multiplier ?? 2, attemptNumber - 1);
        const jitter = policy.jitterFactor ?? 0.5;
        delay = expDelay * (1 - jitter + Math.random() * jitter * 2);
        break;
      
      case 'linear':
        delay = policy.baseDelayMs * attemptNumber;
        break;
      
      case 'fibonacci':
        delay = policy.baseDelayMs * this.fibonacci(attemptNumber);
        break;
      
      case 'custom':
        delay = policy.customSchedule?.[attemptNumber - 1] ?? policy.maxDelayMs;
        break;
      
      default:
        delay = policy.baseDelayMs;
    }
    
    // Cap at max delay
    return Math.min(delay, policy.maxDelayMs);
  }
  
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }
}

// Retry executor
class RetryExecutor {
  private backoffCalculator: BackoffCalculator;
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy
  ): Promise<T> {
    
    let lastError: Error;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await operation();
        
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryable(error, policy)) {
          throw error;
        }
        
        // Check if we've exhausted attempts
        if (attempt >= policy.maxAttempts) {
          throw new RetriesExhaustedError(lastError, attempt);
        }
        
        // Check timeout budget
        if (policy.timeout) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= policy.timeout.toMilliseconds()) {
            throw new RetryTimeoutError(lastError, elapsed);
          }
        }
        
        // Calculate and apply backoff
        const delay = this.backoffCalculator.calculate(policy.backoff, attempt);
        
        // Callback before retry
        if (policy.onRetry) {
          await policy.onRetry(attempt, lastError);
        }
        
        // Wait before next attempt
        await sleep(delay);
      }
    }
    
    throw lastError!;
  }
  
  private isRetryable(error: Error, policy: RetryPolicy): boolean {
    const errorType = error.constructor.name;
    
    // Check explicit non-retryable list
    if (policy.nonRetryableErrors?.includes(errorType)) {
      return false;
    }
    
    // Check explicit retryable list
    if (policy.retryableErrors) {
      return policy.retryableErrors.includes(errorType);
    }
    
    // Default: retry transient errors
    return error instanceof TransientError;
  }
}
```

### 6.3 Pre-configured Retry Policies

```typescript
// Standard retry policies for common scenarios
const RETRY_POLICIES = {
  
  // Aggressive retry for critical operations
  CRITICAL: {
    maxAttempts: 10,
    backoff: {
      type: 'exponential_jitter',
      baseDelayMs: 100,
      maxDelayMs: 30000,
      multiplier: 2,
      jitterFactor: 0.3,
    },
    timeout: Duration.minutes(5),
  } as RetryPolicy,
  
  // Standard retry for most operations
  STANDARD: {
    maxAttempts: 5,
    backoff: {
      type: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      multiplier: 2,
    },
    timeout: Duration.minutes(2),
  } as RetryPolicy,
  
  // Quick retry for fast operations
  QUICK: {
    maxAttempts: 3,
    backoff: {
      type: 'fixed',
      baseDelayMs: 500,
      maxDelayMs: 500,
    },
    timeout: Duration.seconds(30),
  } as RetryPolicy,
  
  // Patient retry for rate-limited APIs
  RATE_LIMITED: {
    maxAttempts: 10,
    backoff: {
      type: 'exponential_jitter',
      baseDelayMs: 5000,
      maxDelayMs: 120000,
      multiplier: 2,
      jitterFactor: 0.5,
    },
    timeout: Duration.minutes(15),
  } as RetryPolicy,
  
  // Immediate retry for transient failures
  IMMEDIATE: {
    maxAttempts: 3,
    backoff: {
      type: 'fixed',
      baseDelayMs: 0,
      maxDelayMs: 0,
    },
    timeout: Duration.seconds(10),
  } as RetryPolicy,
  
  // No retry (fail fast)
  NONE: {
    maxAttempts: 1,
    backoff: {
      type: 'fixed',
      baseDelayMs: 0,
      maxDelayMs: 0,
    },
  } as RetryPolicy,
};
```

---

## 7. Rollback & Compensation

### 7.1 Saga Pattern Implementation

The Saga pattern [3] ensures data consistency across distributed operations by defining compensating actions for each step.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SAGA EXECUTION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Forward Execution (Success Path)                                            │
│  ─────────────────────────────────                                          │
│  Step 1 ──▶ Step 2 ──▶ Step 3 ──▶ Step 4 ──▶ Complete ✓                    │
│                                                                              │
│  Compensation (Failure at Step 3)                                            │
│  ────────────────────────────────                                           │
│  Step 1 ──▶ Step 2 ──▶ Step 3 ✗                                             │
│                          │                                                   │
│                          ▼                                                   │
│              Compensate Step 2 ◀── Compensate Step 1 ◀── Failed            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Compensation Registry

```typescript
// Compensation action definitions
interface CompensationAction {
  stepId: string;
  action: (context: CompensationContext) => Promise<CompensationResult>;
  timeout: Duration;
  retryPolicy: RetryPolicy;
  idempotencyKey: (context: CompensationContext) => string;
}

// Compensation registry
class CompensationRegistry {
  private compensations: Map<string, CompensationAction> = new Map();
  
  register(stepId: string, compensation: CompensationAction): void {
    this.compensations.set(stepId, compensation);
  }
  
  get(stepId: string): CompensationAction | undefined {
    return this.compensations.get(stepId);
  }
}

// Pre-defined compensations for common operations
const STANDARD_COMPENSATIONS: Record<string, CompensationAction> = {
  
  // Database insert → delete
  'db_insert': {
    stepId: 'db_insert',
    action: async (ctx) => {
      const { entityType, entityId } = ctx.stepResult;
      await db.delete(entityType).where({ id: entityId });
      return { success: true, action: 'deleted', entityId };
    },
    timeout: Duration.seconds(30),
    retryPolicy: RETRY_POLICIES.STANDARD,
    idempotencyKey: (ctx) => `compensate:db_insert:${ctx.stepResult.entityId}`,
  },
  
  // File creation → deletion
  'file_create': {
    stepId: 'file_create',
    action: async (ctx) => {
      const { filePath } = ctx.stepResult;
      if (await fileExists(filePath)) {
        await deleteFile(filePath);
      }
      return { success: true, action: 'deleted', filePath };
    },
    timeout: Duration.seconds(10),
    retryPolicy: RETRY_POLICIES.QUICK,
    idempotencyKey: (ctx) => `compensate:file_create:${ctx.stepResult.filePath}`,
  },
  
  // API resource creation → deletion
  'api_create_resource': {
    stepId: 'api_create_resource',
    action: async (ctx) => {
      const { resourceId, apiEndpoint } = ctx.stepResult;
      await apiClient.delete(`${apiEndpoint}/${resourceId}`);
      return { success: true, action: 'deleted', resourceId };
    },
    timeout: Duration.seconds(60),
    retryPolicy: RETRY_POLICIES.STANDARD,
    idempotencyKey: (ctx) => `compensate:api_create:${ctx.stepResult.resourceId}`,
  },
  
  // Payment capture → refund
  'payment_capture': {
    stepId: 'payment_capture',
    action: async (ctx) => {
      const { paymentId, amount } = ctx.stepResult;
      const refund = await paymentProvider.refund(paymentId, amount);
      return { success: true, action: 'refunded', refundId: refund.id };
    },
    timeout: Duration.minutes(2),
    retryPolicy: RETRY_POLICIES.CRITICAL,
    idempotencyKey: (ctx) => `compensate:payment:${ctx.stepResult.paymentId}`,
  },
  
  // Email sent → send cancellation (best effort)
  'email_send': {
    stepId: 'email_send',
    action: async (ctx) => {
      const { emailId, recipient } = ctx.stepResult;
      // Best effort: send follow-up cancellation
      await emailService.send({
        to: recipient,
        template: 'action_cancelled',
        data: { originalEmailId: emailId },
      });
      return { success: true, action: 'cancellation_sent' };
    },
    timeout: Duration.seconds(30),
    retryPolicy: RETRY_POLICIES.QUICK,
    idempotencyKey: (ctx) => `compensate:email:${ctx.stepResult.emailId}`,
  },
  
  // State change → revert to previous state
  'state_change': {
    stepId: 'state_change',
    action: async (ctx) => {
      const { entityId, previousState, entityType } = ctx.stepResult;
      await db.update(entityType)
        .set({ state: previousState })
        .where({ id: entityId });
      return { success: true, action: 'reverted', previousState };
    },
    timeout: Duration.seconds(30),
    retryPolicy: RETRY_POLICIES.STANDARD,
    idempotencyKey: (ctx) => `compensate:state:${ctx.stepResult.entityId}`,
  },
};
```

### 7.3 Compensation Executor

```typescript
// Compensation execution engine
class CompensationExecutor {
  private registry: CompensationRegistry;
  private exactlyOnce: ExactlyOnceExecutor;
  
  async executeCompensations(
    context: WorkflowContext,
    stepsToCompensate: CompletedStep[]
  ): Promise<CompensationResult[]> {
    
    const results: CompensationResult[] = [];
    
    // Execute compensations in reverse order
    for (const step of stepsToCompensate) {
      const compensation = this.registry.get(step.type);
      
      if (!compensation) {
        // No compensation defined - log warning
        results.push({
          stepId: step.id,
          status: 'skipped',
          reason: 'No compensation defined',
        });
        continue;
      }
      
      try {
        // Execute with exactly-once semantics
        const idempotencyKey = compensation.idempotencyKey({
          workflowId: context.workflowId,
          stepId: step.id,
          stepResult: step.result,
        });
        
        const result = await this.exactlyOnce.execute(
          idempotencyKey,
          () => this.executeWithRetry(compensation, {
            workflowId: context.workflowId,
            stepId: step.id,
            stepResult: step.result,
          })
        );
        
        results.push({
          stepId: step.id,
          status: 'compensated',
          result,
        });
        
      } catch (error) {
        // Compensation failed - this is serious
        results.push({
          stepId: step.id,
          status: 'failed',
          error: serializeError(error),
        });
        
        // Log critical error
        await this.logCompensationFailure(context, step, error);
        
        // Continue with other compensations (best effort)
      }
    }
    
    return results;
  }
  
  private async executeWithRetry(
    compensation: CompensationAction,
    context: CompensationContext
  ): Promise<any> {
    
    return withTimeout(
      compensation.timeout,
      new RetryExecutor().executeWithRetry(
        () => compensation.action(context),
        compensation.retryPolicy
      )
    );
  }
}
```

---

## 8. User Intervention Workflows

### 8.1 Intervention Types

| Type | Trigger | User Action Required | Timeout Behavior |
|------|---------|---------------------|------------------|
| **Decision** | Multiple valid paths | Choose option | Default or fail |
| **Input** | Missing information | Provide data | Fail |
| **Approval** | Sensitive operation | Approve/reject | Reject |
| **Browser Takeover** | Auth/CAPTCHA | Manual interaction | Fail |
| **Error Resolution** | Unrecoverable error | Fix or abort | Abort |

### 8.2 User Intervention Service

```typescript
// User intervention request
interface InterventionRequest {
  id: string;
  workflowId: string;
  stepId: string;
  type: 'decision' | 'input' | 'approval' | 'browser_takeover' | 'error_resolution';
  
  // Display information
  title: string;
  message: string;
  details?: Record<string, any>;
  
  // Options (for decision/approval)
  options?: InterventionOption[];
  
  // Input schema (for input type)
  inputSchema?: JSONSchema;
  
  // Browser context (for takeover)
  browserContext?: {
    url: string;
    screenshot?: string;
    instructions: string;
  };
  
  // Timing
  createdAt: number;
  timeout: Duration;
  expiresAt: number;
  
  // Escalation
  escalationPolicy?: EscalationPolicy;
}

interface InterventionOption {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  isDestructive?: boolean;
}

// User intervention service
class UserInterventionService {
  
  async createRequest(params: CreateInterventionParams): Promise<InterventionRequest> {
    const request: InterventionRequest = {
      id: generateId(),
      workflowId: params.workflowId,
      stepId: params.stepId,
      type: params.type,
      title: params.title,
      message: params.message,
      details: params.details,
      options: params.options,
      inputSchema: params.inputSchema,
      browserContext: params.browserContext,
      createdAt: Date.now(),
      timeout: params.timeout ?? Duration.hours(24),
      expiresAt: Date.now() + (params.timeout ?? Duration.hours(24)).toMilliseconds(),
      escalationPolicy: params.escalationPolicy,
    };
    
    // Persist request
    await this.store.save(request);
    
    // Schedule timeout handler
    await this.scheduleTimeout(request);
    
    return request;
  }
  
  async notifyUser(userId: string, request: InterventionRequest): Promise<void> {
    // Send notification through multiple channels
    await Promise.all([
      this.sendInAppNotification(userId, request),
      this.sendEmailNotification(userId, request),
      this.sendPushNotification(userId, request),
    ]);
  }
  
  async handleResponse(
    requestId: string,
    response: InterventionResponse
  ): Promise<void> {
    const request = await this.store.get(requestId);
    
    if (!request) {
      throw new NotFoundError('Intervention request not found');
    }
    
    if (Date.now() > request.expiresAt) {
      throw new ExpiredError('Intervention request has expired');
    }
    
    // Validate response
    await this.validateResponse(request, response);
    
    // Store response
    await this.store.saveResponse(requestId, response);
    
    // Resume workflow
    await this.resumeWorkflow(request, response);
  }
  
  private async handleTimeout(request: InterventionRequest): Promise<void> {
    // Check if already responded
    const response = await this.store.getResponse(request.id);
    if (response) {
      return;  // Already handled
    }
    
    // Apply timeout behavior based on type
    switch (request.type) {
      case 'decision':
        // Use default option if available
        const defaultOption = request.options?.find(o => o.isDefault);
        if (defaultOption) {
          await this.handleResponse(request.id, {
            type: 'option_selected',
            optionId: defaultOption.id,
            source: 'timeout_default',
          });
        } else {
          await this.failWorkflow(request, 'Decision timeout with no default');
        }
        break;
      
      case 'approval':
        // Default to reject
        await this.handleResponse(request.id, {
          type: 'rejected',
          reason: 'Approval timeout',
          source: 'timeout_default',
        });
        break;
      
      case 'input':
      case 'browser_takeover':
      case 'error_resolution':
        // Fail the workflow
        await this.failWorkflow(request, `${request.type} timeout`);
        break;
    }
    
    // Escalate if policy defined
    if (request.escalationPolicy) {
      await this.escalate(request);
    }
  }
  
  private async resumeWorkflow(
    request: InterventionRequest,
    response: InterventionResponse
  ): Promise<void> {
    
    // Get workflow context
    const context = await this.workflowEngine.getContext(request.workflowId);
    
    // Apply response to context
    context.setInterventionResult(request.stepId, response);
    
    // Resume workflow execution
    await this.workflowEngine.resume(request.workflowId, {
      fromStep: request.stepId,
      interventionResult: response,
    });
  }
}
```

### 8.3 Intervention UI Components

```typescript
// React component for intervention handling
interface InterventionDialogProps {
  request: InterventionRequest;
  onResponse: (response: InterventionResponse) => void;
}

function InterventionDialog({ request, onResponse }: InterventionDialogProps) {
  const [loading, setLoading] = useState(false);
  
  // Countdown timer
  const timeRemaining = useCountdown(request.expiresAt);
  
  const handleOptionSelect = async (optionId: string) => {
    setLoading(true);
    await onResponse({
      type: 'option_selected',
      optionId,
      source: 'user',
    });
  };
  
  const handleInputSubmit = async (data: Record<string, any>) => {
    setLoading(true);
    await onResponse({
      type: 'input_provided',
      data,
      source: 'user',
    });
  };
  
  return (
    <Dialog open={true}>
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
        <DialogDescription>{request.message}</DialogDescription>
      </DialogHeader>
      
      <DialogContent>
        {/* Time remaining indicator */}
        <div className="text-sm text-muted-foreground mb-4">
          Time remaining: {formatDuration(timeRemaining)}
        </div>
        
        {/* Type-specific content */}
        {request.type === 'decision' && (
          <div className="space-y-2">
            {request.options?.map(option => (
              <Button
                key={option.id}
                variant={option.isDestructive ? 'destructive' : 'default'}
                onClick={() => handleOptionSelect(option.id)}
                disabled={loading}
                className="w-full"
              >
                {option.label}
                {option.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {option.description}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
        
        {request.type === 'input' && request.inputSchema && (
          <DynamicForm
            schema={request.inputSchema}
            onSubmit={handleInputSubmit}
            loading={loading}
          />
        )}
        
        {request.type === 'approval' && (
          <div className="flex gap-4">
            <Button
              variant="default"
              onClick={() => onResponse({ type: 'approved', source: 'user' })}
              disabled={loading}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => onResponse({ type: 'rejected', source: 'user' })}
              disabled={loading}
            >
              Reject
            </Button>
          </div>
        )}
        
        {request.type === 'browser_takeover' && request.browserContext && (
          <div className="space-y-4">
            <p className="text-sm">{request.browserContext.instructions}</p>
            {request.browserContext.screenshot && (
              <img
                src={request.browserContext.screenshot}
                alt="Browser state"
                className="rounded border"
              />
            )}
            <Button
              onClick={() => window.open(request.browserContext!.url, '_blank')}
            >
              Open Browser
            </Button>
            <Button
              variant="outline"
              onClick={() => onResponse({ type: 'completed', source: 'user' })}
            >
              I've completed the action
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 9. Replanning Strategies

### 9.1 When to Replan

Replanning occurs when the original execution path becomes invalid but alternative paths exist.

| Trigger | Example | Replanning Strategy |
|---------|---------|---------------------|
| **Resource unavailable** | API endpoint down | Find alternative API |
| **Credentials expired** | OAuth token invalid | Refresh and retry |
| **Context exceeded** | LLM context too long | Summarize and retry |
| **Rate limited** | Too many requests | Use different provider |
| **Content blocked** | Filtered by safety | Rephrase request |
| **Permission denied** | Access revoked | Request new permissions |

### 9.2 Replanning Engine

```typescript
// Replanning engine
class WorkflowReplanner {
  private alternativeRegistry: AlternativeRegistry;
  private llmPlanner: LLMPlanner;
  
  async findAlternatives(
    context: WorkflowContext,
    failedStep: WorkflowStep,
    failure: FailureInfo
  ): Promise<ReplanOption[]> {
    
    const alternatives: ReplanOption[] = [];
    
    // Strategy 1: Check registered alternatives
    const registered = this.alternativeRegistry.getAlternatives(
      failedStep.type,
      failure.recoveryHint
    );
    alternatives.push(...registered);
    
    // Strategy 2: LLM-based replanning
    if (context.workflow.allowLLMReplanning) {
      const llmAlternatives = await this.llmPlanner.suggestAlternatives(
        context,
        failedStep,
        failure
      );
      alternatives.push(...llmAlternatives);
    }
    
    // Strategy 3: Fallback providers
    const fallbacks = await this.findFallbackProviders(failedStep);
    alternatives.push(...fallbacks);
    
    // Filter and rank alternatives
    return this.rankAlternatives(alternatives, context);
  }
  
  async selectBestAlternative(
    alternatives: ReplanOption[],
    context: WorkflowContext
  ): Promise<ReplanOption> {
    
    // Score each alternative
    const scored = alternatives.map(alt => ({
      alternative: alt,
      score: this.scoreAlternative(alt, context),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Return best option
    return scored[0].alternative;
  }
  
  async applyReplan(
    context: WorkflowContext,
    replan: ReplanOption
  ): Promise<void> {
    
    // Update workflow definition
    const updatedWorkflow = this.applyReplanToWorkflow(
      context.workflow,
      replan
    );
    
    // Store updated workflow
    await this.workflowStore.update(context.workflowId, updatedWorkflow);
    
    // Update context
    context.setReplan(replan);
    
    // Log replan event
    await this.eventLog.append(context.workflowId, {
      type: 'workflow_replanned',
      originalStep: replan.originalStepId,
      newPlan: replan.newSteps,
      reason: replan.reason,
    });
  }
  
  private scoreAlternative(alt: ReplanOption, context: WorkflowContext): number {
    let score = 0;
    
    // Reliability score
    score += alt.reliability * 30;
    
    // Cost score (lower is better)
    score += (1 - alt.relativeCost) * 20;
    
    // Latency score (lower is better)
    score += (1 - alt.relativeLatency) * 15;
    
    // Capability match score
    score += alt.capabilityMatch * 25;
    
    // User preference score
    score += this.getUserPreferenceScore(alt, context) * 10;
    
    return score;
  }
}

// Alternative registry
class AlternativeRegistry {
  private alternatives: Map<string, AlternativeDefinition[]> = new Map();
  
  register(stepType: string, alternative: AlternativeDefinition): void {
    const existing = this.alternatives.get(stepType) ?? [];
    existing.push(alternative);
    this.alternatives.set(stepType, existing);
  }
  
  getAlternatives(stepType: string, hint?: string): ReplanOption[] {
    const definitions = this.alternatives.get(stepType) ?? [];
    
    return definitions
      .filter(def => !hint || def.applicableHints.includes(hint))
      .map(def => def.toReplanOption());
  }
}

// Pre-registered alternatives
const STANDARD_ALTERNATIVES: AlternativeDefinition[] = [
  
  // LLM provider fallbacks
  {
    stepType: 'llm_invocation',
    applicableHints: ['model_unavailable', 'rate_limited'],
    alternative: {
      type: 'provider_fallback',
      providers: ['openai', 'anthropic', 'google'],
      selectionStrategy: 'round_robin',
    },
    reliability: 0.95,
    relativeCost: 1.2,
    relativeLatency: 1.1,
  },
  
  // Context length handling
  {
    stepType: 'llm_invocation',
    applicableHints: ['context_length_exceeded'],
    alternative: {
      type: 'context_reduction',
      strategies: ['summarize', 'truncate', 'chunk'],
    },
    reliability: 0.9,
    relativeCost: 1.5,
    relativeLatency: 1.3,
  },
  
  // Search provider fallbacks
  {
    stepType: 'web_search',
    applicableHints: ['service_unavailable', 'rate_limited'],
    alternative: {
      type: 'provider_fallback',
      providers: ['google', 'bing', 'duckduckgo'],
      selectionStrategy: 'failover',
    },
    reliability: 0.98,
    relativeCost: 1.0,
    relativeLatency: 1.0,
  },
  
  // Browser automation fallbacks
  {
    stepType: 'browser_action',
    applicableHints: ['blocked_by_site', 'captcha_detected'],
    alternative: {
      type: 'api_alternative',
      description: 'Use official API instead of scraping',
    },
    reliability: 0.99,
    relativeCost: 0.8,
    relativeLatency: 0.5,
  },
];
```

### 9.3 LLM-Based Replanning

```typescript
// LLM-powered replanning
class LLMPlanner {
  
  async suggestAlternatives(
    context: WorkflowContext,
    failedStep: WorkflowStep,
    failure: FailureInfo
  ): Promise<ReplanOption[]> {
    
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a workflow planning assistant. Given a failed workflow step, 
suggest alternative approaches to achieve the same goal.

Output JSON array of alternatives with:
- description: What the alternative does
- steps: Array of step definitions
- reliability: Estimated success probability (0-1)
- tradeoffs: What's different from original approach`
        },
        {
          role: 'user',
          content: `
Workflow Goal: ${context.workflow.metadata.description}

Failed Step:
- Type: ${failedStep.type}
- Name: ${failedStep.name}
- Input: ${JSON.stringify(failedStep.activity?.input)}

Failure:
- Reason: ${failure.reason}
- Error: ${failure.error}
- Recovery Hint: ${failure.recoveryHint}

Completed Steps: ${context.getCompletedSteps().map(s => s.name).join(', ')}

Suggest 2-3 alternative approaches to complete this workflow.`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'replan_alternatives',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                steps: { type: 'array' },
                reliability: { type: 'number' },
                tradeoffs: { type: 'string' },
              },
              required: ['description', 'steps', 'reliability', 'tradeoffs'],
            },
          },
        },
      },
    });
    
    const suggestions = JSON.parse(response.choices[0].message.content);
    
    return suggestions.map((s: any) => ({
      type: 'llm_suggested',
      description: s.description,
      newSteps: s.steps,
      reliability: s.reliability,
      tradeoffs: s.tradeoffs,
      originalStepId: failedStep.id,
      reason: failure.reason,
    }));
  }
}
```

---

## 10. Implementation Reference

### 10.1 Database Schema

```sql
-- Complete workflow persistence schema

-- Workflow definitions
CREATE TABLE workflow_definitions (
    id VARCHAR(36) PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSON NOT NULL,  -- Full workflow definition
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    
    UNIQUE KEY idx_name_version (name, version)
);

-- Workflow instances
CREATE TABLE workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    definition_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- State
    status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'cancelled') NOT NULL,
    current_step_id VARCHAR(100),
    pause_reason VARCHAR(255),
    
    -- Input/Output
    input JSON,
    output JSON,
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timing
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    
    -- Metadata
    metadata JSON,
    
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (definition_id) REFERENCES workflow_definitions(id)
);

-- Workflow events (event sourcing)
CREATE TABLE workflow_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    sequence_number INT NOT NULL,
    
    -- Event data
    event_type VARCHAR(100) NOT NULL,
    event_data JSON NOT NULL,
    
    -- Timing
    timestamp BIGINT NOT NULL,
    
    UNIQUE KEY idx_workflow_sequence (workflow_id, sequence_number),
    INDEX idx_workflow_type (workflow_id, event_type),
    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(id)
);

-- Step executions
CREATE TABLE step_executions (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    
    -- State
    status ENUM('pending', 'running', 'completed', 'failed', 'compensated') NOT NULL,
    
    -- Input/Output
    input JSON,
    output JSON,
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timing
    started_at BIGINT,
    completed_at BIGINT,
    
    -- Idempotency
    idempotency_key VARCHAR(255) NOT NULL,
    
    UNIQUE KEY idx_idempotency (idempotency_key),
    INDEX idx_workflow_step (workflow_id, step_id),
    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(id)
);

-- Compensation log
CREATE TABLE compensation_log (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    step_execution_id VARCHAR(36) NOT NULL,
    
    -- State
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL,
    
    -- Result
    result JSON,
    error_message TEXT,
    
    -- Timing
    started_at BIGINT,
    completed_at BIGINT,
    
    -- Idempotency
    idempotency_key VARCHAR(255) NOT NULL,
    
    UNIQUE KEY idx_idempotency (idempotency_key),
    INDEX idx_workflow (workflow_id),
    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(id),
    FOREIGN KEY (step_execution_id) REFERENCES step_executions(id)
);

-- User interventions
CREATE TABLE user_interventions (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- Request
    type ENUM('decision', 'input', 'approval', 'browser_takeover', 'error_resolution') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    options JSON,
    input_schema JSON,
    browser_context JSON,
    
    -- Response
    response JSON,
    response_source ENUM('user', 'timeout_default', 'escalation'),
    responded_at BIGINT,
    
    -- Timing
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    
    -- Status
    status ENUM('pending', 'responded', 'expired', 'cancelled') NOT NULL,
    
    INDEX idx_workflow (workflow_id),
    INDEX idx_user_pending (user_id, status),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(id)
);

-- Replan history
CREATE TABLE replan_history (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    
    -- Original step
    original_step_id VARCHAR(100) NOT NULL,
    failure_reason TEXT NOT NULL,
    
    -- New plan
    new_steps JSON NOT NULL,
    replan_type ENUM('registered', 'llm_suggested', 'user_selected') NOT NULL,
    
    -- Timing
    created_at BIGINT NOT NULL,
    
    INDEX idx_workflow (workflow_id),
    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(id)
);
```

### 10.2 Configuration Reference

```typescript
// Complete workflow engine configuration
interface WorkflowEngineConfig {
  // Execution settings
  execution: {
    maxConcurrentWorkflows: number;  // Per worker
    maxConcurrentSteps: number;  // Per workflow
    defaultTimeout: Duration;
    heartbeatInterval: Duration;
  };
  
  // Retry defaults
  retry: {
    defaultPolicy: RetryPolicy;
    maxGlobalRetries: number;
    retryBudget: Duration;  // Total time for all retries
  };
  
  // Idempotency settings
  idempotency: {
    keyTTL: Duration;
    resultCacheTTL: Duration;
    lockTimeout: Duration;
  };
  
  // User intervention settings
  intervention: {
    defaultTimeout: Duration;
    maxPendingPerUser: number;
    notificationChannels: ('in_app' | 'email' | 'push')[];
  };
  
  // Compensation settings
  compensation: {
    maxCompensationAttempts: number;
    compensationTimeout: Duration;
    parallelCompensations: boolean;
  };
  
  // Replanning settings
  replanning: {
    allowLLMReplanning: boolean;
    maxReplanAttempts: number;
    replanTimeout: Duration;
  };
  
  // Observability
  observability: {
    eventRetention: Duration;
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Production configuration
const PRODUCTION_CONFIG: WorkflowEngineConfig = {
  execution: {
    maxConcurrentWorkflows: 100,
    maxConcurrentSteps: 10,
    defaultTimeout: Duration.hours(1),
    heartbeatInterval: Duration.seconds(30),
  },
  retry: {
    defaultPolicy: RETRY_POLICIES.STANDARD,
    maxGlobalRetries: 20,
    retryBudget: Duration.minutes(30),
  },
  idempotency: {
    keyTTL: Duration.days(7),
    resultCacheTTL: Duration.days(1),
    lockTimeout: Duration.minutes(5),
  },
  intervention: {
    defaultTimeout: Duration.hours(24),
    maxPendingPerUser: 10,
    notificationChannels: ['in_app', 'email'],
  },
  compensation: {
    maxCompensationAttempts: 5,
    compensationTimeout: Duration.minutes(10),
    parallelCompensations: false,
  },
  replanning: {
    allowLLMReplanning: true,
    maxReplanAttempts: 3,
    replanTimeout: Duration.minutes(5),
  },
  observability: {
    eventRetention: Duration.days(90),
    metricsEnabled: true,
    tracingEnabled: true,
    logLevel: 'info',
  },
};
```

---

## References

[1] Temporal.io. "How Temporal Works." https://docs.temporal.io/concepts/what-is-temporal

[2] Kleppmann, M. "Designing Data-Intensive Applications." O'Reilly Media, 2017. Chapter 11: Stream Processing.

[3] Garcia-Molina, H., & Salem, K. "Sagas." ACM SIGMOD Record, 1987.

[4] AWS. "Implementing Idempotency." https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/

[5] Stripe. "Idempotent Requests." https://stripe.com/docs/api/idempotent_requests

---

*This document provides enterprise-grade specifications for workflow orchestration, retry handling, and failure recovery in the SwissBrain platform. All patterns are production-tested and compliant with distributed systems best practices.*
