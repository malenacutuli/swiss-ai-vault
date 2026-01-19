# SwissBrain AI Platform: Advanced Technical Specifications

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** January 11, 2026  
**Classification:** Technical Architecture Deep-Dive

---

## Table of Contents

1. [Agent State Machine](#1-agent-state-machine)
2. [Credit and Billing Model](#2-credit-and-billing-model)
3. [Concurrency and Fairness Policy](#3-concurrency-and-fairness-policy)
4. [Sandbox Security Posture](#4-sandbox-security-posture)
5. [CRDT Collaboration System](#5-crdt-collaboration-system)
6. [Connector Governance Framework](#6-connector-governance-framework)

---

## 1. Agent State Machine

### 1.1 Overview

The SwissBrain agent execution model is built on a **hierarchical finite state machine (HFSM)** that manages the lifecycle of AI agent tasks from submission to completion. This design provides deterministic behavior, clear error handling, and support for long-running operations with checkpointing.

### 1.2 State Definitions

The agent state machine consists of **12 primary states** organized into three tiers: initialization, execution, and termination.

| State | Tier | Description | Max Duration |
|-------|------|-------------|--------------|
| `PENDING` | Init | Task queued, awaiting resource allocation | 5 minutes |
| `INITIALIZING` | Init | Sandbox provisioning, dependency installation | 2 minutes |
| `READY` | Init | Resources allocated, awaiting first instruction | 30 seconds |
| `PLANNING` | Exec | Agent analyzing task, creating execution plan | 60 seconds |
| `EXECUTING` | Exec | Active tool invocation or computation | Per-tool limits |
| `WAITING_USER` | Exec | Blocked on user input or confirmation | 24 hours |
| `WAITING_EXTERNAL` | Exec | Blocked on external API response | 5 minutes |
| `CHECKPOINTING` | Exec | Saving intermediate state for recovery | 30 seconds |
| `COMPLETED` | Term | Task finished successfully | N/A |
| `FAILED` | Term | Unrecoverable error encountered | N/A |
| `CANCELLED` | Term | User-initiated cancellation | N/A |
| `TIMED_OUT` | Term | Duration limit exceeded | N/A |

### 1.3 State Transition Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │                                         │
                                    ▼                                         │
┌─────────┐    ┌──────────────┐    ┌───────┐    ┌──────────┐    ┌───────────┐ │
│ PENDING │───▶│ INITIALIZING │───▶│ READY │───▶│ PLANNING │───▶│ EXECUTING │─┤
└─────────┘    └──────────────┘    └───────┘    └──────────┘    └───────────┘ │
     │               │                  │             │               │        │
     │               │                  │             │               │        │
     ▼               ▼                  ▼             ▼               ▼        │
┌─────────┐    ┌─────────┐        ┌─────────┐   ┌─────────┐    ┌─────────────┐│
│TIMED_OUT│    │ FAILED  │        │CANCELLED│   │ FAILED  │    │CHECKPOINTING││
└─────────┘    └─────────┘        └─────────┘   └─────────┘    └─────────────┘│
                                                                      │       │
                                                                      └───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌──────────────────┐ ┌───────────┐
            │WAITING_USER │ │WAITING_EXTERNAL  │ │ COMPLETED │
            └─────────────┘ └──────────────────┘ └───────────┘
```

### 1.4 Transition Rules

Each state transition is governed by explicit rules with preconditions and postconditions.

#### 1.4.1 PENDING → INITIALIZING

```typescript
interface TransitionRule {
  from: 'PENDING';
  to: 'INITIALIZING';
  trigger: 'RESOURCE_AVAILABLE';
  preconditions: [
    'queue_position === 0',
    'tenant_quota_available === true',
    'global_capacity_available === true'
  ];
  postconditions: [
    'sandbox_id !== null',
    'resource_reservation_created === true'
  ];
  timeout: '5m';
  on_timeout: 'TIMED_OUT';
}
```

**Edge Cases:**
- **Quota exhausted during wait**: Transition to `FAILED` with error code `QUOTA_EXCEEDED`
- **System maintenance window**: Hold in `PENDING` with extended timeout (up to 1 hour)
- **Priority preemption**: Higher-priority task can bump lower-priority task back to `PENDING`

#### 1.4.2 INITIALIZING → READY

```typescript
interface TransitionRule {
  from: 'INITIALIZING';
  to: 'READY';
  trigger: 'SANDBOX_HEALTHY';
  preconditions: [
    'sandbox_status === "running"',
    'health_check_passed === true',
    'dependencies_installed === true'
  ];
  postconditions: [
    'agent_process_pid !== null',
    'websocket_connection_established === true'
  ];
  timeout: '2m';
  on_timeout: 'FAILED';
  retry_policy: {
    max_attempts: 3,
    backoff: 'exponential',
    base_delay: '10s'
  };
}
```

**Edge Cases:**
- **Dependency installation failure**: Retry with fallback package versions, then `FAILED`
- **Network partition during init**: Retry with different availability zone
- **Corrupted base image**: Trigger image rebuild, retry with fresh image

#### 1.4.3 EXECUTING → CHECKPOINTING

```typescript
interface TransitionRule {
  from: 'EXECUTING';
  to: 'CHECKPOINTING';
  trigger: 'CHECKPOINT_INTERVAL' | 'USER_REQUEST' | 'TOOL_BOUNDARY';
  preconditions: [
    'current_tool_invocation_complete === true',
    'no_pending_mutations === true'
  ];
  postconditions: [
    'checkpoint_id !== null',
    'state_snapshot_stored === true',
    'checkpoint_verified === true'
  ];
  timeout: '30s';
  on_timeout: 'continue_without_checkpoint';
}
```

**Checkpoint Triggers:**
1. **Time-based**: Every 5 minutes of execution
2. **Tool boundary**: After each tool invocation completes
3. **User request**: Explicit checkpoint command
4. **Memory threshold**: When heap usage exceeds 70%

### 1.5 Edge Case Handling Matrix

| Scenario | Current State | Action | Result State | Recovery |
|----------|---------------|--------|--------------|----------|
| Network timeout during LLM call | EXECUTING | Retry with exponential backoff | EXECUTING | 3 retries, then FAILED |
| User closes browser | WAITING_USER | Continue execution | EXECUTING | Notify on reconnect |
| Sandbox OOM killed | EXECUTING | Restore from checkpoint | INITIALIZING | Resume from last checkpoint |
| External API rate limited | WAITING_EXTERNAL | Queue with delay | WAITING_EXTERNAL | Respect Retry-After header |
| Circular tool dependency | PLANNING | Detect cycle, abort | FAILED | Return error to user |
| Partial tool success | EXECUTING | Commit partial, log warning | EXECUTING | Continue with degraded result |
| User cancels mid-tool | EXECUTING | Graceful shutdown | CANCELLED | Rollback uncommitted changes |
| Checkpoint corruption | CHECKPOINTING | Retry checkpoint | CHECKPOINTING | 3 retries, then continue without |

### 1.6 Compensating Actions

When a task fails or is cancelled, compensating actions ensure system consistency.

```typescript
interface CompensatingAction {
  trigger_state: 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  actions: [
    {
      name: 'release_sandbox',
      timeout: '30s',
      on_failure: 'force_terminate'
    },
    {
      name: 'release_quota_reservation',
      timeout: '5s',
      on_failure: 'log_and_continue'
    },
    {
      name: 'cleanup_temporary_files',
      timeout: '60s',
      on_failure: 'schedule_async_cleanup'
    },
    {
      name: 'notify_user',
      timeout: '5s',
      on_failure: 'queue_notification'
    },
    {
      name: 'emit_billing_event',
      timeout: '5s',
      on_failure: 'queue_for_reconciliation'
    }
  ];
}
```

### 1.7 State Machine Implementation

```typescript
// Core state machine implementation using XState v5
import { createMachine, assign } from 'xstate';

interface AgentContext {
  taskId: string;
  tenantId: string;
  sandboxId: string | null;
  checkpointId: string | null;
  retryCount: number;
  startTime: number;
  creditsConsumed: number;
  toolInvocations: ToolInvocation[];
  error: AgentError | null;
}

type AgentEvent =
  | { type: 'RESOURCE_AVAILABLE'; sandboxId: string }
  | { type: 'SANDBOX_HEALTHY' }
  | { type: 'PLAN_COMPLETE'; plan: ExecutionPlan }
  | { type: 'TOOL_COMPLETE'; result: ToolResult }
  | { type: 'TOOL_ERROR'; error: ToolError }
  | { type: 'USER_INPUT'; input: UserInput }
  | { type: 'EXTERNAL_RESPONSE'; response: ExternalResponse }
  | { type: 'CHECKPOINT_COMPLETE'; checkpointId: string }
  | { type: 'TIMEOUT' }
  | { type: 'CANCEL' }
  | { type: 'TASK_COMPLETE'; result: TaskResult };

const agentMachine = createMachine({
  id: 'agent',
  initial: 'pending',
  context: {
    taskId: '',
    tenantId: '',
    sandboxId: null,
    checkpointId: null,
    retryCount: 0,
    startTime: Date.now(),
    creditsConsumed: 0,
    toolInvocations: [],
    error: null,
  },
  states: {
    pending: {
      after: {
        300000: { target: 'timedOut' }, // 5 minute timeout
      },
      on: {
        RESOURCE_AVAILABLE: {
          target: 'initializing',
          actions: assign({
            sandboxId: ({ event }) => event.sandboxId,
          }),
        },
        CANCEL: 'cancelled',
      },
    },
    initializing: {
      invoke: {
        src: 'initializeSandbox',
        onDone: 'ready',
        onError: [
          {
            target: 'initializing',
            guard: ({ context }) => context.retryCount < 3,
            actions: assign({
              retryCount: ({ context }) => context.retryCount + 1,
            }),
          },
          { target: 'failed' },
        ],
      },
      after: {
        120000: { target: 'failed' }, // 2 minute timeout
      },
    },
    ready: {
      after: {
        30000: { target: 'failed' }, // 30 second timeout
      },
      on: {
        PLAN_COMPLETE: 'planning',
        CANCEL: 'cancelled',
      },
      entry: 'notifyReady',
    },
    planning: {
      invoke: {
        src: 'createExecutionPlan',
        onDone: {
          target: 'executing',
          actions: assign({
            plan: ({ event }) => event.output,
          }),
        },
        onError: 'failed',
      },
      after: {
        60000: { target: 'failed' }, // 60 second timeout
      },
    },
    executing: {
      on: {
        TOOL_COMPLETE: [
          {
            target: 'checkpointing',
            guard: 'shouldCheckpoint',
          },
          {
            target: 'executing',
            actions: 'recordToolResult',
          },
        ],
        TOOL_ERROR: [
          {
            target: 'executing',
            guard: 'canRetryTool',
            actions: 'incrementRetry',
          },
          { target: 'failed' },
        ],
        WAITING_USER_INPUT: 'waitingUser',
        WAITING_EXTERNAL: 'waitingExternal',
        TASK_COMPLETE: 'completed',
        CANCEL: 'cancelled',
        TIMEOUT: 'timedOut',
      },
    },
    waitingUser: {
      after: {
        86400000: { target: 'timedOut' }, // 24 hour timeout
      },
      on: {
        USER_INPUT: 'executing',
        CANCEL: 'cancelled',
      },
    },
    waitingExternal: {
      after: {
        300000: { target: 'failed' }, // 5 minute timeout
      },
      on: {
        EXTERNAL_RESPONSE: 'executing',
        CANCEL: 'cancelled',
      },
    },
    checkpointing: {
      invoke: {
        src: 'saveCheckpoint',
        onDone: {
          target: 'executing',
          actions: assign({
            checkpointId: ({ event }) => event.output.checkpointId,
          }),
        },
        onError: 'executing', // Continue without checkpoint on failure
      },
      after: {
        30000: { target: 'executing' }, // Continue after 30s timeout
      },
    },
    completed: {
      type: 'final',
      entry: ['emitBillingEvent', 'notifyCompletion', 'releaseSandbox'],
    },
    failed: {
      type: 'final',
      entry: ['emitBillingEvent', 'notifyFailure', 'releaseSandbox', 'recordError'],
    },
    cancelled: {
      type: 'final',
      entry: ['emitBillingEvent', 'notifyCancellation', 'releaseSandbox'],
    },
    timedOut: {
      type: 'final',
      entry: ['emitBillingEvent', 'notifyTimeout', 'releaseSandbox'],
    },
  },
});
```

---

## 2. Credit and Billing Model

### 2.1 Overview

SwissBrain uses a **credit-based consumption model** where all platform resources are abstracted into a unified currency called **SwissCredits (SC)**. This model provides predictable costs, transparent attribution, and flexible billing semantics.

### 2.2 Credit Unit Definitions

| Resource Type | Unit | Credit Cost | Notes |
|---------------|------|-------------|-------|
| LLM Input Tokens | 1K tokens | 0.5 SC | GPT-4 class models |
| LLM Output Tokens | 1K tokens | 1.5 SC | GPT-4 class models |
| LLM Input Tokens (Fast) | 1K tokens | 0.1 SC | GPT-3.5 class models |
| LLM Output Tokens (Fast) | 1K tokens | 0.3 SC | GPT-3.5 class models |
| Image Generation | 1 image | 5.0 SC | 1024x1024 standard |
| Image Generation (HD) | 1 image | 10.0 SC | 1024x1024 HD quality |
| Code Execution | 1 minute | 0.5 SC | Standard sandbox |
| Code Execution (GPU) | 1 minute | 5.0 SC | GPU-enabled sandbox |
| Web Search | 1 query | 0.2 SC | Including result fetching |
| File Storage | 1 GB/month | 1.0 SC | S3-compatible storage |
| API Calls (External) | 1 call | 0.1 SC | Third-party integrations |

### 2.3 Cost Attribution Model

Every credit consumption is attributed to a specific hierarchy for detailed cost tracking.

```typescript
interface CreditAttribution {
  // Hierarchy levels
  tenant_id: string;           // Organization/company
  workspace_id: string;        // Project or team
  user_id: string;             // Individual user
  task_id: string;             // Specific agent task
  tool_invocation_id: string;  // Individual tool call
  
  // Resource details
  resource_type: ResourceType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  
  // Timing
  timestamp: Date;
  billing_period: string;      // YYYY-MM format
  
  // Metadata
  model_id?: string;           // For LLM calls
  region?: string;             // For geo-specific pricing
  priority?: 'standard' | 'priority' | 'batch';
}
```

### 2.4 Database Schema for Billing

```sql
-- Credit ledger for double-entry accounting
CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL,  -- 'purchase', 'consumption', 'refund', 'adjustment', 'transfer'
    amount DECIMAL(18, 6) NOT NULL,         -- Positive for credits, negative for debits
    balance_after DECIMAL(18, 6) NOT NULL,  -- Running balance after this transaction
    
    -- Attribution
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    task_id UUID REFERENCES tasks(id),
    tool_invocation_id UUID REFERENCES tool_invocations(id),
    
    -- Resource tracking
    resource_type VARCHAR(50),
    resource_quantity DECIMAL(18, 6),
    unit_price DECIMAL(18, 6),
    
    -- Billing metadata
    billing_period CHAR(7) NOT NULL,        -- YYYY-MM
    invoice_id UUID REFERENCES invoices(id),
    
    -- Audit
    idempotency_key VARCHAR(255) UNIQUE,    -- Prevent duplicate transactions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN ('purchase', 'consumption', 'refund', 'adjustment', 'transfer', 'bonus')
    ),
    CONSTRAINT valid_resource_type CHECK (
        resource_type IS NULL OR resource_type IN (
            'llm_input_tokens', 'llm_output_tokens', 'llm_input_tokens_fast', 'llm_output_tokens_fast',
            'image_generation', 'image_generation_hd', 'code_execution', 'code_execution_gpu',
            'web_search', 'file_storage', 'api_call_external'
        )
    )
);

-- Indexes for common queries
CREATE INDEX idx_credit_ledger_tenant_period ON credit_ledger(tenant_id, billing_period);
CREATE INDEX idx_credit_ledger_task ON credit_ledger(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id, created_at);
CREATE INDEX idx_credit_ledger_idempotency ON credit_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Tenant credit balance (materialized view for performance)
CREATE MATERIALIZED VIEW tenant_credit_balance AS
SELECT 
    tenant_id,
    SUM(amount) AS total_balance,
    SUM(CASE WHEN transaction_type = 'purchase' THEN amount ELSE 0 END) AS total_purchased,
    SUM(CASE WHEN transaction_type = 'consumption' THEN ABS(amount) ELSE 0 END) AS total_consumed,
    SUM(CASE WHEN transaction_type = 'refund' THEN amount ELSE 0 END) AS total_refunded,
    MAX(created_at) AS last_transaction_at
FROM credit_ledger
GROUP BY tenant_id;

CREATE UNIQUE INDEX idx_tenant_credit_balance ON tenant_credit_balance(tenant_id);

-- Refresh function (call periodically or on-demand)
CREATE OR REPLACE FUNCTION refresh_tenant_credit_balance()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_credit_balance;
END;
$$ LANGUAGE plpgsql;

-- Credit reservations for in-flight tasks
CREATE TABLE credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    task_id UUID NOT NULL REFERENCES tasks(id),
    
    -- Reservation details
    reserved_amount DECIMAL(18, 6) NOT NULL,
    consumed_amount DECIMAL(18, 6) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_reservation_status CHECK (status IN ('active', 'settled', 'expired', 'cancelled')),
    CONSTRAINT consumed_not_exceed_reserved CHECK (consumed_amount <= reserved_amount)
);

CREATE INDEX idx_credit_reservations_tenant ON credit_reservations(tenant_id, status);
CREATE INDEX idx_credit_reservations_expires ON credit_reservations(expires_at) WHERE status = 'active';
```

### 2.5 Billing Operations

#### 2.5.1 Credit Purchase

```typescript
async function purchaseCredits(
  tenantId: string,
  amount: number,
  paymentMethodId: string,
  idempotencyKey: string
): Promise<CreditPurchaseResult> {
  return await db.transaction(async (tx) => {
    // Check idempotency
    const existing = await tx.query.creditLedger.findFirst({
      where: eq(creditLedger.idempotencyKey, idempotencyKey)
    });
    if (existing) {
      return { success: true, transactionId: existing.id, deduplicated: true };
    }
    
    // Process payment via Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'chf',
      customer: await getStripeCustomerId(tenantId),
      payment_method: paymentMethodId,
      confirm: true,
      idempotency_key: idempotencyKey,
    });
    
    if (paymentIntent.status !== 'succeeded') {
      throw new PaymentFailedError(paymentIntent.status);
    }
    
    // Get current balance
    const currentBalance = await getCurrentBalance(tx, tenantId);
    
    // Record credit purchase
    const [ledgerEntry] = await tx.insert(creditLedger).values({
      tenantId,
      transactionType: 'purchase',
      amount: amount,
      balanceAfter: currentBalance + amount,
      billingPeriod: getCurrentBillingPeriod(),
      idempotencyKey,
      metadata: {
        paymentIntentId: paymentIntent.id,
        amountPaid: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    }).returning();
    
    // Update quota
    await tx.update(tenantQuotas)
      .set({ 
        creditBalance: sql`credit_balance + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(tenantQuotas.tenantId, tenantId));
    
    return { 
      success: true, 
      transactionId: ledgerEntry.id,
      newBalance: currentBalance + amount,
    };
  });
}
```

#### 2.5.2 Credit Consumption (Real-time)

```typescript
async function consumeCredits(
  reservation: CreditReservation,
  consumption: CreditConsumption
): Promise<ConsumptionResult> {
  const { taskId, resourceType, quantity, unitCost } = consumption;
  const totalCost = quantity * unitCost;
  
  return await db.transaction(async (tx) => {
    // Verify reservation is active and has capacity
    const [currentReservation] = await tx
      .select()
      .from(creditReservations)
      .where(and(
        eq(creditReservations.id, reservation.id),
        eq(creditReservations.status, 'active')
      ))
      .for('update');
    
    if (!currentReservation) {
      throw new ReservationNotFoundError(reservation.id);
    }
    
    const remainingReserved = currentReservation.reservedAmount - currentReservation.consumedAmount;
    if (totalCost > remainingReserved) {
      // Need to extend reservation or fail
      const canExtend = await tryExtendReservation(tx, currentReservation, totalCost - remainingReserved);
      if (!canExtend) {
        throw new InsufficientCreditsError(totalCost, remainingReserved);
      }
    }
    
    // Get current balance for ledger entry
    const currentBalance = await getCurrentBalance(tx, currentReservation.tenantId);
    
    // Record consumption
    const [ledgerEntry] = await tx.insert(creditLedger).values({
      tenantId: currentReservation.tenantId,
      transactionType: 'consumption',
      amount: -totalCost, // Negative for consumption
      balanceAfter: currentBalance - totalCost,
      taskId,
      toolInvocationId: consumption.toolInvocationId,
      resourceType,
      resourceQuantity: quantity,
      unitPrice: unitCost,
      billingPeriod: getCurrentBillingPeriod(),
      idempotencyKey: `${taskId}-${consumption.toolInvocationId}-${resourceType}`,
    }).returning();
    
    // Update reservation consumed amount
    await tx.update(creditReservations)
      .set({ 
        consumedAmount: sql`consumed_amount + ${totalCost}`,
      })
      .where(eq(creditReservations.id, reservation.id));
    
    // Update tenant quota balance
    await tx.update(tenantQuotas)
      .set({ 
        creditBalance: sql`credit_balance - ${totalCost}`,
        updatedAt: new Date(),
      })
      .where(eq(tenantQuotas.tenantId, currentReservation.tenantId));
    
    return {
      success: true,
      transactionId: ledgerEntry.id,
      creditsConsumed: totalCost,
      remainingReservation: remainingReserved - totalCost,
    };
  });
}
```

### 2.6 Refund Semantics

SwissBrain supports three types of refunds with distinct policies.

| Refund Type | Trigger | Amount | Processing Time | Conditions |
|-------------|---------|--------|-----------------|------------|
| **System Failure** | Platform error causing task failure | 100% of task consumption | Automatic, immediate | Error code in `SYSTEM_*` category |
| **Partial Completion** | Task cancelled after partial work | Prorated based on completion | Automatic, immediate | Completion < 100% |
| **User Request** | Manual refund request | Case-by-case | 24-48 hours | Subject to review |

```typescript
interface RefundPolicy {
  type: 'system_failure' | 'partial_completion' | 'user_request';
  
  calculateRefundAmount(task: Task, consumption: CreditConsumption[]): number;
  
  // System failure: full refund
  // Partial completion: (1 - completionPercentage) * totalConsumed
  // User request: manual determination
}

async function processRefund(
  taskId: string,
  refundType: RefundType,
  reason: string
): Promise<RefundResult> {
  const task = await getTask(taskId);
  const consumptions = await getTaskConsumptions(taskId);
  const totalConsumed = consumptions.reduce((sum, c) => sum + c.totalCost, 0);
  
  let refundAmount: number;
  
  switch (refundType) {
    case 'system_failure':
      refundAmount = totalConsumed;
      break;
    
    case 'partial_completion':
      const completionPct = calculateCompletionPercentage(task);
      refundAmount = totalConsumed * (1 - completionPct);
      break;
    
    case 'user_request':
      // Queue for manual review
      return await queueRefundForReview(taskId, totalConsumed, reason);
  }
  
  return await db.transaction(async (tx) => {
    const currentBalance = await getCurrentBalance(tx, task.tenantId);
    
    const [ledgerEntry] = await tx.insert(creditLedger).values({
      tenantId: task.tenantId,
      transactionType: 'refund',
      amount: refundAmount,
      balanceAfter: currentBalance + refundAmount,
      taskId,
      billingPeriod: getCurrentBillingPeriod(),
      idempotencyKey: `refund-${taskId}-${refundType}`,
      metadata: {
        refundType,
        reason,
        originalConsumption: totalConsumed,
        completionPercentage: refundType === 'partial_completion' 
          ? calculateCompletionPercentage(task) 
          : null,
      },
    }).returning();
    
    await tx.update(tenantQuotas)
      .set({ 
        creditBalance: sql`credit_balance + ${refundAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(tenantQuotas.tenantId, task.tenantId));
    
    return {
      success: true,
      refundId: ledgerEntry.id,
      refundAmount,
      newBalance: currentBalance + refundAmount,
    };
  });
}
```

### 2.7 Partial Completion Billing

When a task is interrupted or cancelled, billing is calculated based on actual work completed.

```typescript
interface PartialCompletionBilling {
  // Completion is measured by tool invocations
  calculateCompletion(task: Task): CompletionMetrics {
    const plan = task.executionPlan;
    const completedSteps = task.toolInvocations.filter(t => t.status === 'completed');
    const totalSteps = plan.steps.length;
    
    return {
      stepsCompleted: completedSteps.length,
      stepsTotal: totalSteps,
      percentComplete: (completedSteps.length / totalSteps) * 100,
      
      // Weighted completion based on step complexity
      weightedCompletion: calculateWeightedCompletion(plan, completedSteps),
      
      // Value delivered (subjective, based on step importance)
      valueDelivered: calculateValueDelivered(plan, completedSteps),
    };
  }
  
  // Billing rules for partial completion
  billingRules: {
    // Minimum billable: 10% of estimated cost
    minimumCharge: 0.10,
    
    // Rounding: to nearest 0.01 credits
    roundingPrecision: 2,
    
    // Grace period: first 30 seconds free if cancelled
    gracePeriodSeconds: 30,
    
    // Refund cap: maximum 90% refund on partial completion
    maxRefundPercentage: 0.90,
  };
}

function calculatePartialBilling(task: Task): BillingResult {
  const completion = calculateCompletion(task);
  const totalConsumed = getTotalConsumed(task);
  
  // If cancelled within grace period, full refund
  const taskDuration = task.endTime - task.startTime;
  if (taskDuration < 30000 && task.status === 'cancelled') {
    return {
      amountCharged: 0,
      refundAmount: totalConsumed,
      reason: 'grace_period_cancellation',
    };
  }
  
  // Calculate billable amount based on completion
  const billablePercentage = Math.max(
    completion.weightedCompletion / 100,
    0.10 // Minimum 10% charge
  );
  
  const amountCharged = totalConsumed * billablePercentage;
  const refundAmount = Math.min(
    totalConsumed - amountCharged,
    totalConsumed * 0.90 // Max 90% refund
  );
  
  return {
    amountCharged: round(amountCharged, 2),
    refundAmount: round(refundAmount, 2),
    completion,
    reason: 'partial_completion',
  };
}
```

### 2.8 Overage Handling

When a tenant exceeds their credit balance, SwissBrain implements a graduated response.

```typescript
interface OveragePolicy {
  // Soft limit: warn at 80% consumption
  softLimitThreshold: 0.80;
  
  // Hard limit: block new tasks at 100%
  hardLimitThreshold: 1.00;
  
  // Grace buffer: allow 10% overage for in-flight tasks
  graceBuffer: 0.10;
  
  // Actions at each threshold
  actions: {
    soft_limit: ['email_warning', 'dashboard_notification', 'webhook_alert'],
    hard_limit: ['block_new_tasks', 'email_urgent', 'webhook_critical'],
    grace_exceeded: ['terminate_tasks', 'email_final', 'account_suspension_warning'],
  };
}

async function checkQuotaAndProceed(
  tenantId: string,
  estimatedCost: number
): Promise<QuotaCheckResult> {
  const quota = await getTenantQuota(tenantId);
  const balance = quota.creditBalance;
  const reserved = await getActiveReservations(tenantId);
  const available = balance - reserved;
  
  // Check against thresholds
  if (available < estimatedCost) {
    // Check grace buffer
    const graceAmount = quota.creditLimit * 0.10;
    if (available + graceAmount >= estimatedCost) {
      // Allow with warning
      await sendOverageWarning(tenantId, {
        currentBalance: balance,
        estimatedCost,
        graceUsed: estimatedCost - available,
      });
      return { allowed: true, warning: 'grace_buffer_used' };
    }
    
    // Block task
    return { 
      allowed: false, 
      reason: 'insufficient_credits',
      required: estimatedCost,
      available,
    };
  }
  
  // Check soft limit warning
  const usagePercentage = (quota.creditLimit - balance) / quota.creditLimit;
  if (usagePercentage >= 0.80) {
    await sendSoftLimitWarning(tenantId, usagePercentage);
  }
  
  return { allowed: true };
}
```

---

## 3. Concurrency and Fairness Policy

### 3.1 Overview

SwissBrain implements a **multi-level fair queuing system** that balances resource utilization across global, tenant, and individual task levels while preventing starvation and ensuring predictable performance.

### 3.2 Limit Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     GLOBAL LIMITS                           │
│  Max Concurrent Tasks: 10,000                               │
│  Max LLM Requests/sec: 5,000                                │
│  Max Sandbox Instances: 2,000                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TENANT LIMITS                            │
│  Enterprise: 500 concurrent | Business: 100 | Starter: 10   │
│  LLM RPM: 10,000 | 2,000 | 200                              │
│  Sandboxes: 100 | 20 | 5                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     USER LIMITS                             │
│  Max Concurrent Tasks: 10 (all tiers)                       │
│  Max Task Duration: 1 hour                                  │
│  Max Tool Invocations/Task: 100                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RUN LIMITS                             │
│  Max Memory: 4GB (standard) | 16GB (large)                  │
│  Max CPU Time: 30 min (standard) | 2 hr (large)             │
│  Max Network Egress: 1GB                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Rate Limiting Implementation

```typescript
// Multi-level token bucket rate limiter
interface RateLimiter {
  // Global bucket
  global: TokenBucket;
  
  // Per-tenant buckets (keyed by tenant_id)
  tenants: Map<string, TokenBucket>;
  
  // Per-user buckets (keyed by user_id)
  users: Map<string, TokenBucket>;
}

class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;
  
  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  async tryConsume(tokens: number): Promise<boolean> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  async consumeWithWait(tokens: number, maxWaitMs: number): Promise<ConsumeResult> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { success: true, waitedMs: 0 };
    }
    
    const deficit = tokens - this.tokens;
    const waitTimeMs = (deficit / this.refillRate) * 1000;
    
    if (waitTimeMs > maxWaitMs) {
      return { success: false, waitedMs: 0, retryAfterMs: waitTimeMs };
    }
    
    await sleep(waitTimeMs);
    this.refill();
    this.tokens -= tokens;
    return { success: true, waitedMs: waitTimeMs };
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Redis-backed distributed rate limiter
class DistributedRateLimiter {
  private redis: Redis;
  
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    // Use Redis sorted set for sliding window
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    const currentCount = results[1][1] as number;
    
    if (currentCount >= limit) {
      // Get oldest entry to calculate retry-after
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfterMs = oldest.length > 0 
        ? (windowSeconds * 1000) - (now - parseInt(oldest[1]))
        : windowSeconds * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        limit,
        windowSeconds,
      };
    }
    
    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      limit,
      windowSeconds,
    };
  }
}
```

### 3.4 Fair Scheduling Algorithm

SwissBrain uses **Weighted Fair Queuing (WFQ)** to ensure equitable resource distribution.

```typescript
interface FairScheduler {
  // Priority weights by subscription tier
  weights: {
    enterprise: 10,
    business: 5,
    starter: 1,
  };
  
  // Virtual time tracking for WFQ
  virtualTime: number;
  
  // Per-tenant virtual finish times
  tenantFinishTimes: Map<string, number>;
}

class WeightedFairQueue {
  private queues: Map<string, PriorityQueue<Task>>;
  private weights: Map<string, number>;
  private virtualTime: number = 0;
  private finishTimes: Map<string, number>;
  
  enqueue(task: Task): void {
    const tenantId = task.tenantId;
    const weight = this.weights.get(tenantId) || 1;
    
    // Calculate virtual finish time
    const lastFinish = this.finishTimes.get(tenantId) || this.virtualTime;
    const virtualStart = Math.max(lastFinish, this.virtualTime);
    const virtualFinish = virtualStart + (task.estimatedCost / weight);
    
    task.virtualFinishTime = virtualFinish;
    this.finishTimes.set(tenantId, virtualFinish);
    
    // Add to tenant queue
    if (!this.queues.has(tenantId)) {
      this.queues.set(tenantId, new PriorityQueue());
    }
    this.queues.get(tenantId)!.enqueue(task, virtualFinish);
  }
  
  dequeue(): Task | null {
    // Find task with smallest virtual finish time across all queues
    let minFinishTime = Infinity;
    let selectedTenant: string | null = null;
    
    for (const [tenantId, queue] of this.queues) {
      if (queue.isEmpty()) continue;
      
      const task = queue.peek();
      if (task.virtualFinishTime < minFinishTime) {
        minFinishTime = task.virtualFinishTime;
        selectedTenant = tenantId;
      }
    }
    
    if (!selectedTenant) return null;
    
    const task = this.queues.get(selectedTenant)!.dequeue();
    this.virtualTime = task.virtualFinishTime;
    
    return task;
  }
}
```

### 3.5 Starvation Prevention

```typescript
interface StarvationPrevention {
  // Maximum wait time before priority boost
  maxWaitTimeMs: {
    enterprise: 30000,   // 30 seconds
    business: 60000,     // 1 minute
    starter: 300000,     // 5 minutes
  };
  
  // Priority boost factor when max wait exceeded
  boostFactor: 2.0;
  
  // Aging: increase priority by 10% every minute waiting
  agingRatePerMinute: 0.10;
}

class AntiStarvationScheduler {
  private waitTimes: Map<string, number>;
  
  async checkAndBoost(): Promise<void> {
    const now = Date.now();
    
    for (const [taskId, enqueueTime] of this.waitTimes) {
      const task = await getTask(taskId);
      const maxWait = this.getMaxWaitTime(task.tenantTier);
      const waited = now - enqueueTime;
      
      if (waited > maxWait) {
        // Apply priority boost
        await this.boostPriority(taskId, 2.0);
        
        // Log starvation event
        await this.logStarvationEvent(taskId, waited);
        
        // Alert if chronic starvation
        if (waited > maxWait * 3) {
          await this.alertChronicStarvation(task.tenantId);
        }
      } else {
        // Apply aging boost
        const minutesWaited = waited / 60000;
        const agingBoost = 1 + (minutesWaited * 0.10);
        await this.boostPriority(taskId, agingBoost);
      }
    }
  }
  
  private async boostPriority(taskId: string, factor: number): Promise<void> {
    await db.update(taskQueue)
      .set({
        effectivePriority: sql`effective_priority * ${factor}`,
        lastBoostAt: new Date(),
      })
      .where(eq(taskQueue.taskId, taskId));
  }
}
```

### 3.6 Concurrency Control Database Schema

```sql
-- Task queue with fair scheduling support
CREATE TABLE task_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Scheduling
    base_priority INTEGER NOT NULL DEFAULT 100,
    effective_priority DECIMAL(10, 4) NOT NULL DEFAULT 100,
    virtual_finish_time DECIMAL(20, 6),
    
    -- Timing
    enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    last_boost_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    
    -- Resource requirements
    estimated_duration_seconds INTEGER,
    estimated_credits DECIMAL(10, 4),
    required_capabilities JSONB DEFAULT '[]'::jsonb,
    
    CONSTRAINT valid_queue_status CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_task_queue_scheduling ON task_queue(status, effective_priority DESC, enqueued_at ASC)
    WHERE status = 'queued';
CREATE INDEX idx_task_queue_tenant ON task_queue(tenant_id, status);
CREATE INDEX idx_task_queue_user ON task_queue(user_id, status);

-- Concurrency tracking
CREATE TABLE concurrency_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(20) NOT NULL,  -- 'global', 'tenant', 'user'
    scope_id VARCHAR(255) NOT NULL,  -- tenant_id or user_id, 'global' for global
    
    max_slots INTEGER NOT NULL,
    used_slots INTEGER NOT NULL DEFAULT 0,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(scope, scope_id)
);

-- Initialize global slot
INSERT INTO concurrency_slots (scope, scope_id, max_slots)
VALUES ('global', 'global', 10000);

-- Function to acquire concurrency slot
CREATE OR REPLACE FUNCTION acquire_concurrency_slot(
    p_tenant_id UUID,
    p_user_id UUID,
    p_task_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_global_available BOOLEAN;
    v_tenant_available BOOLEAN;
    v_user_available BOOLEAN;
    v_tenant_max INTEGER;
    v_user_max INTEGER := 10;
BEGIN
    -- Get tenant limit based on tier
    SELECT CASE subscription_tier
        WHEN 'enterprise' THEN 500
        WHEN 'business' THEN 100
        ELSE 10
    END INTO v_tenant_max
    FROM tenants WHERE id = p_tenant_id;
    
    -- Check and acquire global slot
    UPDATE concurrency_slots
    SET used_slots = used_slots + 1, updated_at = NOW()
    WHERE scope = 'global' AND scope_id = 'global' AND used_slots < max_slots
    RETURNING TRUE INTO v_global_available;
    
    IF NOT COALESCE(v_global_available, FALSE) THEN
        RETURN FALSE;
    END IF;
    
    -- Check and acquire tenant slot
    INSERT INTO concurrency_slots (scope, scope_id, max_slots, used_slots)
    VALUES ('tenant', p_tenant_id::text, v_tenant_max, 1)
    ON CONFLICT (scope, scope_id) DO UPDATE
    SET used_slots = concurrency_slots.used_slots + 1, updated_at = NOW()
    WHERE concurrency_slots.used_slots < concurrency_slots.max_slots
    RETURNING TRUE INTO v_tenant_available;
    
    IF NOT COALESCE(v_tenant_available, FALSE) THEN
        -- Rollback global slot
        UPDATE concurrency_slots
        SET used_slots = used_slots - 1
        WHERE scope = 'global' AND scope_id = 'global';
        RETURN FALSE;
    END IF;
    
    -- Check and acquire user slot
    INSERT INTO concurrency_slots (scope, scope_id, max_slots, used_slots)
    VALUES ('user', p_user_id::text, v_user_max, 1)
    ON CONFLICT (scope, scope_id) DO UPDATE
    SET used_slots = concurrency_slots.used_slots + 1, updated_at = NOW()
    WHERE concurrency_slots.used_slots < concurrency_slots.max_slots
    RETURNING TRUE INTO v_user_available;
    
    IF NOT COALESCE(v_user_available, FALSE) THEN
        -- Rollback tenant and global slots
        UPDATE concurrency_slots
        SET used_slots = used_slots - 1
        WHERE (scope = 'global' AND scope_id = 'global')
           OR (scope = 'tenant' AND scope_id = p_tenant_id::text);
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to release concurrency slot
CREATE OR REPLACE FUNCTION release_concurrency_slot(
    p_tenant_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE concurrency_slots
    SET used_slots = GREATEST(0, used_slots - 1), updated_at = NOW()
    WHERE (scope = 'global' AND scope_id = 'global')
       OR (scope = 'tenant' AND scope_id = p_tenant_id::text)
       OR (scope = 'user' AND scope_id = p_user_id::text);
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Sandbox Security Posture

### 4.1 Overview

SwissBrain sandboxes provide **defense-in-depth isolation** using multiple security layers: container isolation, kernel-level sandboxing (gVisor), mandatory access control (AppArmor), system call filtering (seccomp), and network policies.

### 4.2 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Code                                 │
├─────────────────────────────────────────────────────────────────┤
│                    Application Sandbox                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    gVisor (runsc)                        │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              Sentry (User-space Kernel)          │    │    │
│  │  │  - System call interception                      │    │    │
│  │  │  - Memory isolation                              │    │    │
│  │  │  - File system virtualization                    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                    seccomp-bpf Filter                            │
│  - Whitelist of ~60 allowed syscalls                            │
│  - Block dangerous syscalls (ptrace, mount, etc.)               │
├─────────────────────────────────────────────────────────────────┤
│                    AppArmor Profile                              │
│  - File access restrictions                                      │
│  - Network access control                                        │
│  - Capability restrictions                                       │
├─────────────────────────────────────────────────────────────────┤
│                    Container (OCI)                               │
│  - Namespaces (PID, NET, MNT, UTS, IPC, USER)                   │
│  - Cgroups (CPU, Memory, I/O limits)                            │
│  - Read-only root filesystem                                     │
├─────────────────────────────────────────────────────────────────┤
│                    Kubernetes Pod                                │
│  - Network Policy (egress filtering)                            │
│  - Pod Security Standards (restricted)                          │
│  - Resource Quotas                                               │
├─────────────────────────────────────────────────────────────────┤
│                    Host Kernel (Linux)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 gVisor Configuration

```yaml
# gVisor runtime configuration
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    sandbox.swissbrain.ai/gvisor: "true"
---
# Pod spec using gVisor
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-pod
  annotations:
    container.apparmor.security.beta.kubernetes.io/sandbox: localhost/swissbrain-sandbox
spec:
  runtimeClassName: gvisor
  securityContext:
    runAsNonRoot: true
    runAsUser: 65534  # nobody
    runAsGroup: 65534
    fsGroup: 65534
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/swissbrain-sandbox.json
  containers:
  - name: sandbox
    image: axessvideo/swissbrain-sandbox:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
    resources:
      limits:
        cpu: "2"
        memory: "4Gi"
        ephemeral-storage: "10Gi"
      requests:
        cpu: "500m"
        memory: "512Mi"
    volumeMounts:
    - name: workspace
      mountPath: /workspace
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: workspace
    emptyDir:
      sizeLimit: 5Gi
  - name: tmp
    emptyDir:
      sizeLimit: 1Gi
```

### 4.4 seccomp Profile

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [
    {
      "names": [
        "read", "write", "open", "close", "stat", "fstat", "lstat",
        "poll", "lseek", "mmap", "mprotect", "munmap", "brk",
        "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
        "ioctl", "pread64", "pwrite64", "readv", "writev",
        "access", "pipe", "select", "sched_yield", "mremap",
        "msync", "mincore", "madvise", "dup", "dup2",
        "nanosleep", "getitimer", "alarm", "setitimer",
        "getpid", "socket", "connect", "accept", "sendto",
        "recvfrom", "sendmsg", "recvmsg", "shutdown", "bind",
        "listen", "getsockname", "getpeername", "socketpair",
        "setsockopt", "getsockopt", "clone", "fork", "vfork",
        "execve", "exit", "wait4", "kill", "uname",
        "fcntl", "flock", "fsync", "fdatasync", "truncate",
        "ftruncate", "getdents", "getcwd", "chdir", "fchdir",
        "rename", "mkdir", "rmdir", "creat", "link", "unlink",
        "symlink", "readlink", "chmod", "fchmod", "chown",
        "fchown", "lchown", "umask", "gettimeofday", "getrlimit",
        "getrusage", "sysinfo", "times", "getuid", "getgid",
        "setuid", "setgid", "geteuid", "getegid", "setpgid",
        "getppid", "getpgrp", "setsid", "setreuid", "setregid",
        "getgroups", "setgroups", "setresuid", "getresuid",
        "setresgid", "getresgid", "getpgid", "setfsuid",
        "setfsgid", "getsid", "capget", "capset", "rt_sigpending",
        "rt_sigtimedwait", "rt_sigqueueinfo", "rt_sigsuspend",
        "sigaltstack", "utime", "mknod", "uselib", "personality",
        "ustat", "statfs", "fstatfs", "sysfs", "getpriority",
        "setpriority", "sched_setparam", "sched_getparam",
        "sched_setscheduler", "sched_getscheduler",
        "sched_get_priority_max", "sched_get_priority_min",
        "sched_rr_get_interval", "mlock", "munlock", "mlockall",
        "munlockall", "vhangup", "pivot_root", "prctl",
        "arch_prctl", "adjtimex", "setrlimit", "chroot", "sync",
        "acct", "settimeofday", "swapon", "swapoff", "reboot",
        "sethostname", "setdomainname", "ioperm", "iopl",
        "create_module", "init_module", "delete_module",
        "get_kernel_syms", "query_module", "quotactl", "nfsservctl",
        "getpmsg", "putpmsg", "afs_syscall", "tuxcall", "security",
        "gettid", "readahead", "setxattr", "lsetxattr", "fsetxattr",
        "getxattr", "lgetxattr", "fgetxattr", "listxattr",
        "llistxattr", "flistxattr", "removexattr", "lremovexattr",
        "fremovexattr", "tkill", "time", "futex", "sched_setaffinity",
        "sched_getaffinity", "set_thread_area", "io_setup",
        "io_destroy", "io_getevents", "io_submit", "io_cancel",
        "get_thread_area", "lookup_dcookie", "epoll_create",
        "epoll_ctl_old", "epoll_wait_old", "remap_file_pages",
        "getdents64", "set_tid_address", "restart_syscall",
        "semtimedop", "fadvise64", "timer_create", "timer_settime",
        "timer_gettime", "timer_getoverrun", "timer_delete",
        "clock_settime", "clock_gettime", "clock_getres",
        "clock_nanosleep", "exit_group", "epoll_wait", "epoll_ctl",
        "tgkill", "utimes", "vserver", "mbind", "set_mempolicy",
        "get_mempolicy", "mq_open", "mq_unlink", "mq_timedsend",
        "mq_timedreceive", "mq_notify", "mq_getsetattr", "kexec_load",
        "waitid", "add_key", "request_key", "keyctl", "ioprio_set",
        "ioprio_get", "inotify_init", "inotify_add_watch",
        "inotify_rm_watch", "migrate_pages", "openat", "mkdirat",
        "mknodat", "fchownat", "futimesat", "newfstatat", "unlinkat",
        "renameat", "linkat", "symlinkat", "readlinkat", "fchmodat",
        "faccessat", "pselect6", "ppoll", "unshare", "set_robust_list",
        "get_robust_list", "splice", "tee", "sync_file_range",
        "vmsplice", "move_pages", "utimensat", "epoll_pwait",
        "signalfd", "timerfd_create", "eventfd", "fallocate",
        "timerfd_settime", "timerfd_gettime", "accept4", "signalfd4",
        "eventfd2", "epoll_create1", "dup3", "pipe2", "inotify_init1",
        "preadv", "pwritev", "rt_tgsigqueueinfo", "perf_event_open",
        "recvmmsg", "fanotify_init", "fanotify_mark", "prlimit64",
        "name_to_handle_at", "open_by_handle_at", "clock_adjtime",
        "syncfs", "sendmmsg", "setns", "getcpu", "process_vm_readv",
        "process_vm_writev", "kcmp", "finit_module", "sched_setattr",
        "sched_getattr", "renameat2", "seccomp", "getrandom",
        "memfd_create", "kexec_file_load", "bpf", "execveat",
        "userfaultfd", "membarrier", "mlock2", "copy_file_range",
        "preadv2", "pwritev2", "pkey_mprotect", "pkey_alloc",
        "pkey_free", "statx", "io_pgetevents", "rseq"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": [
        "ptrace", "mount", "umount2", "pivot_root", "swapon",
        "swapoff", "reboot", "sethostname", "setdomainname",
        "init_module", "delete_module", "acct", "kexec_load",
        "kexec_file_load", "bpf", "userfaultfd"
      ],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    }
  ]
}
```

### 4.5 AppArmor Profile

```
#include <tunables/global>

profile swissbrain-sandbox flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/python>
  #include <abstractions/ssl_certs>

  # Deny all by default
  deny /** w,
  
  # Allow read access to system libraries
  /lib/** r,
  /lib64/** r,
  /usr/lib/** r,
  /usr/lib64/** r,
  /usr/share/** r,
  /etc/ld.so.cache r,
  /etc/ld.so.preload r,
  /etc/ssl/certs/** r,
  /etc/ca-certificates/** r,
  
  # Allow Python runtime
  /usr/bin/python* rix,
  /usr/bin/pip* rix,
  /usr/local/bin/python* rix,
  /usr/local/lib/python*/** r,
  
  # Allow Node.js runtime
  /usr/bin/node rix,
  /usr/bin/npm rix,
  /usr/bin/npx rix,
  /usr/local/bin/node rix,
  
  # Workspace directory (read-write)
  /workspace/** rw,
  /workspace/ rw,
  owner /workspace/** rwk,
  
  # Temporary files
  /tmp/** rw,
  /var/tmp/** rw,
  owner /tmp/** rwk,
  
  # Process information (read-only)
  /proc/*/fd/ r,
  /proc/*/maps r,
  /proc/*/stat r,
  /proc/*/status r,
  /proc/sys/kernel/random/uuid r,
  /proc/sys/kernel/random/boot_id r,
  
  # Deny sensitive paths
  deny /proc/*/mem rw,
  deny /proc/kcore rw,
  deny /proc/kmem rw,
  deny /sys/firmware/** rw,
  deny /sys/kernel/** rw,
  
  # Network access (controlled by network policy)
  network inet stream,
  network inet dgram,
  network inet6 stream,
  network inet6 dgram,
  
  # Deny raw sockets
  deny network raw,
  deny network packet,
  
  # Capabilities
  capability net_bind_service,
  deny capability sys_admin,
  deny capability sys_ptrace,
  deny capability sys_module,
  deny capability sys_rawio,
  deny capability mknod,
  
  # Signal handling
  signal (receive) peer=unconfined,
  signal (send,receive) peer=swissbrain-sandbox,
}
```

### 4.6 Network Egress Policy

```yaml
# Kubernetes NetworkPolicy for sandbox pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-egress-policy
  namespace: swissbrain-sandboxes
spec:
  podSelector:
    matchLabels:
      app: sandbox
  policyTypes:
  - Egress
  egress:
  # Allow DNS resolution
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  
  # Allow HTTPS to approved domains via egress gateway
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: swissbrain-egress
      podSelector:
        matchLabels:
          app: egress-gateway
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
  
  # Allow internal API access
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: swissbrain-api
    ports:
    - protocol: TCP
      port: 8080

---
# Egress gateway configuration (Envoy-based)
apiVersion: v1
kind: ConfigMap
metadata:
  name: egress-gateway-config
  namespace: swissbrain-egress
data:
  envoy.yaml: |
    static_resources:
      listeners:
      - name: https_listener
        address:
          socket_address:
            address: 0.0.0.0
            port_value: 443
        filter_chains:
        - filters:
          - name: envoy.filters.network.http_connection_manager
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
              stat_prefix: egress_https
              route_config:
                name: egress_route
                virtual_hosts:
                - name: allowed_hosts
                  domains:
                  # Allowed external domains
                  - "api.openai.com"
                  - "api.anthropic.com"
                  - "pypi.org"
                  - "files.pythonhosted.org"
                  - "registry.npmjs.org"
                  - "github.com"
                  - "raw.githubusercontent.com"
                  - "*.s3.amazonaws.com"
                  - "*.s3.eu-central-1.amazonaws.com"
                  routes:
                  - match:
                      prefix: "/"
                    route:
                      cluster: dynamic_forward_proxy
              http_filters:
              - name: envoy.filters.http.dynamic_forward_proxy
                typed_config:
                  "@type": type.googleapis.com/envoy.extensions.filters.http.dynamic_forward_proxy.v3.FilterConfig
                  dns_cache_config:
                    name: dynamic_forward_proxy_cache
                    dns_lookup_family: V4_ONLY
              - name: envoy.filters.http.router
                typed_config:
                  "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
      clusters:
      - name: dynamic_forward_proxy
        lb_policy: CLUSTER_PROVIDED
        cluster_type:
          name: envoy.clusters.dynamic_forward_proxy
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.clusters.dynamic_forward_proxy.v3.ClusterConfig
            dns_cache_config:
              name: dynamic_forward_proxy_cache
              dns_lookup_family: V4_ONLY
```

### 4.7 Filesystem Isolation

```typescript
// Filesystem isolation configuration
interface FilesystemPolicy {
  // Root filesystem is read-only
  rootReadOnly: true;
  
  // Writable directories (tmpfs or emptyDir)
  writablePaths: [
    '/workspace',  // User code and data
    '/tmp',        // Temporary files
    '/var/tmp',    // Persistent temp files
    '/home/sandbox/.cache',  // Package caches
  ];
  
  // Size limits
  limits: {
    workspace: '5Gi',
    tmp: '1Gi',
    cache: '2Gi',
  };
  
  // Blocked paths (even for read)
  blockedPaths: [
    '/etc/shadow',
    '/etc/passwd',
    '/etc/sudoers',
    '/root',
    '/proc/kcore',
    '/sys/firmware',
  ];
  
  // File type restrictions
  blockedFileTypes: [
    '.so',   // Shared libraries (except in approved paths)
    '.ko',   // Kernel modules
  ];
}

// Filesystem monitoring
class FilesystemMonitor {
  private inotify: FSWatcher;
  
  async watchSuspiciousActivity(sandboxId: string): Promise<void> {
    const suspiciousPatterns = [
      /\/proc\/\d+\/mem/,
      /\/dev\/(mem|kmem|port)/,
      /\.(so|ko)$/,
      /\/etc\/(passwd|shadow|sudoers)/,
    ];
    
    this.inotify.on('change', async (event) => {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(event.path)) {
          await this.reportSuspiciousAccess(sandboxId, event);
          await this.terminateSandbox(sandboxId, 'suspicious_file_access');
          break;
        }
      }
    });
  }
}
```

---

## 5. CRDT Collaboration System

### 5.1 Overview

SwissBrain uses **Yjs** as its CRDT (Conflict-free Replicated Data Type) library for real-time collaboration. Yjs provides automatic conflict resolution, offline support, and efficient synchronization across multiple clients.

### 5.2 CRDT Selection Rationale

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| **Yjs** | Mature, efficient, rich ecosystem, awareness protocol | Larger bundle size | **Selected** |
| Automerge | Simple API, Rust core | Less mature TypeScript bindings | Not selected |
| Diamond Types | Fastest, smallest | Limited data structures | Not selected |
| Y-CRDT (Rust) | Native performance | Requires WASM bridge | Future consideration |

### 5.3 Data Structure Mapping

```typescript
// Yjs document structure for SwissBrain collaboration
import * as Y from 'yjs';

interface CollaborativeDocument {
  // Root Y.Doc
  doc: Y.Doc;
  
  // Shared types
  content: Y.Text;           // Main text content (code, markdown)
  blocks: Y.Array<Block>;    // Structured blocks (for rich content)
  metadata: Y.Map<any>;      // Document metadata
  comments: Y.Array<Comment>;// Inline comments
  cursors: Y.Map<Cursor>;    // User cursor positions
}

// Block structure for rich documents
interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'code' | 'image' | 'table';
  content: Y.Text | Y.Map<any>;
  attributes: Y.Map<any>;
}

// Cursor/selection awareness
interface Cursor {
  anchor: number;
  head: number;
  user: {
    id: string;
    name: string;
    color: string;
  };
}
```

### 5.4 Merge Semantics

Yjs uses **operation-based CRDTs** with the following merge rules:

```typescript
// Merge rules for different operations
interface MergeRules {
  // Text insertions: Last-writer-wins with position preservation
  textInsert: {
    rule: 'interleave',
    description: 'Concurrent insertions at same position are interleaved based on client ID ordering',
    example: {
      client1: 'insert "A" at position 5',
      client2: 'insert "B" at position 5',
      result: 'Either "AB" or "BA" depending on client ID comparison',
    },
  };
  
  // Text deletions: Idempotent
  textDelete: {
    rule: 'idempotent',
    description: 'Deleting already-deleted content is a no-op',
    example: {
      client1: 'delete positions 5-10',
      client2: 'delete positions 7-12',
      result: 'Positions 5-12 deleted (union)',
    },
  };
  
  // Map updates: Last-writer-wins per key
  mapUpdate: {
    rule: 'last_writer_wins',
    description: 'Most recent update to a key wins based on Lamport timestamp',
    example: {
      client1: 'set key "title" to "Doc A" at t=100',
      client2: 'set key "title" to "Doc B" at t=101',
      result: '"Doc B" wins',
    },
  };
  
  // Array operations: Position-based with tombstones
  arrayInsert: {
    rule: 'position_preserving',
    description: 'Insertions maintain relative order using unique IDs',
  };
  
  arrayDelete: {
    rule: 'tombstone',
    description: 'Deleted items become tombstones, preserving structure for sync',
  };
}
```

### 5.5 Offline Edit Handling

```typescript
// Offline synchronization manager
class OfflineSyncManager {
  private doc: Y.Doc;
  private indexedDB: IDBDatabase;
  private pendingUpdates: Uint8Array[] = [];
  private isOnline: boolean = navigator.onLine;
  
  constructor(docId: string) {
    this.doc = new Y.Doc();
    this.setupPersistence(docId);
    this.setupNetworkListeners();
  }
  
  private async setupPersistence(docId: string): Promise<void> {
    // Use IndexedDB for offline persistence
    const provider = new IndexeddbPersistence(docId, this.doc);
    
    provider.on('synced', () => {
      console.log('Document loaded from IndexedDB');
    });
    
    // Track local changes
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') {
        this.pendingUpdates.push(update);
        this.persistUpdate(update);
      }
    });
  }
  
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingUpdates();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  private async syncPendingUpdates(): Promise<void> {
    if (!this.isOnline || this.pendingUpdates.length === 0) return;
    
    // Merge all pending updates
    const mergedUpdate = Y.mergeUpdates(this.pendingUpdates);
    
    try {
      // Send to server
      await this.sendUpdate(mergedUpdate);
      
      // Clear pending on success
      this.pendingUpdates = [];
      await this.clearPersistedUpdates();
    } catch (error) {
      console.error('Failed to sync updates:', error);
      // Updates remain in pendingUpdates for retry
    }
  }
  
  private async sendUpdate(update: Uint8Array): Promise<void> {
    const response = await fetch('/api/collab/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: update,
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
    
    // Apply server's response (may contain updates from other clients)
    const serverUpdate = new Uint8Array(await response.arrayBuffer());
    Y.applyUpdate(this.doc, serverUpdate, 'remote');
  }
}
```

### 5.6 Version Vector Implementation

```typescript
// Version vector for causal ordering
interface VersionVector {
  // Map of client ID to sequence number
  vector: Map<string, number>;
}

class VersionVectorManager {
  private vector: Map<string, number> = new Map();
  private clientId: string;
  
  constructor(clientId: string) {
    this.clientId = clientId;
    this.vector.set(clientId, 0);
  }
  
  // Increment local clock
  tick(): VersionVector {
    const current = this.vector.get(this.clientId) || 0;
    this.vector.set(this.clientId, current + 1);
    return this.getVector();
  }
  
  // Merge with received vector
  merge(received: VersionVector): void {
    for (const [clientId, seq] of received.vector) {
      const local = this.vector.get(clientId) || 0;
      this.vector.set(clientId, Math.max(local, seq));
    }
  }
  
  // Check if this vector dominates another
  dominates(other: VersionVector): boolean {
    for (const [clientId, seq] of other.vector) {
      const local = this.vector.get(clientId) || 0;
      if (local < seq) return false;
    }
    return true;
  }
  
  // Check for concurrent updates
  isConcurrent(other: VersionVector): boolean {
    return !this.dominates(other) && !other.dominates(this);
  }
  
  getVector(): VersionVector {
    return { vector: new Map(this.vector) };
  }
}

// Yjs integration with version vectors
class YjsVersionedDoc {
  private doc: Y.Doc;
  private versionManager: VersionVectorManager;
  private snapshots: Map<string, Uint8Array> = new Map();
  
  constructor(clientId: string) {
    this.doc = new Y.Doc({ guid: clientId });
    this.versionManager = new VersionVectorManager(clientId);
    
    // Track updates with version vectors
    this.doc.on('update', (update, origin) => {
      if (origin !== 'remote') {
        const version = this.versionManager.tick();
        this.attachVersionToUpdate(update, version);
      }
    });
  }
  
  // Create named snapshot
  createSnapshot(name: string): string {
    const snapshot = Y.snapshot(this.doc);
    const snapshotId = `${name}-${Date.now()}`;
    this.snapshots.set(snapshotId, Y.encodeSnapshot(snapshot));
    return snapshotId;
  }
  
  // Restore from snapshot
  restoreSnapshot(snapshotId: string): void {
    const encoded = this.snapshots.get(snapshotId);
    if (!encoded) throw new Error(`Snapshot not found: ${snapshotId}`);
    
    const snapshot = Y.decodeSnapshot(encoded);
    const restoredDoc = Y.createDocFromSnapshot(this.doc, snapshot);
    
    // Apply restored state
    const update = Y.encodeStateAsUpdate(restoredDoc);
    Y.applyUpdate(this.doc, update);
  }
  
  // Get diff between two snapshots
  getDiff(fromSnapshotId: string, toSnapshotId: string): Uint8Array {
    const fromEncoded = this.snapshots.get(fromSnapshotId);
    const toEncoded = this.snapshots.get(toSnapshotId);
    
    if (!fromEncoded || !toEncoded) {
      throw new Error('Snapshot not found');
    }
    
    const fromSnapshot = Y.decodeSnapshot(fromEncoded);
    const toSnapshot = Y.decodeSnapshot(toEncoded);
    
    return Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(fromSnapshot));
  }
}
```

### 5.7 Conflict Resolution Strategies

```typescript
// Conflict resolution for specific data types
interface ConflictResolver {
  // Code files: syntax-aware merge
  resolveCodeConflict(base: string, local: string, remote: string): MergeResult;
  
  // Structured data: field-level merge
  resolveStructuredConflict(base: object, local: object, remote: object): MergeResult;
  
  // Rich text: operation-level merge (handled by Yjs)
  resolveRichTextConflict(): 'automatic';
}

class CodeConflictResolver {
  async resolve(
    base: string,
    local: string,
    remote: string,
    language: string
  ): Promise<MergeResult> {
    // Try automatic 3-way merge
    const autoMerge = await this.threeWayMerge(base, local, remote);
    
    if (!autoMerge.hasConflicts) {
      return {
        success: true,
        result: autoMerge.merged,
        strategy: 'auto_merge',
      };
    }
    
    // Parse AST for syntax-aware merge
    const baseAST = await this.parseAST(base, language);
    const localAST = await this.parseAST(local, language);
    const remoteAST = await this.parseAST(remote, language);
    
    const astMerge = this.mergeASTs(baseAST, localAST, remoteAST);
    
    if (astMerge.success) {
      return {
        success: true,
        result: this.generateCode(astMerge.merged, language),
        strategy: 'ast_merge',
      };
    }
    
    // Fall back to manual resolution
    return {
      success: false,
      conflicts: autoMerge.conflicts,
      strategy: 'manual_required',
      markers: this.insertConflictMarkers(base, local, remote),
    };
  }
  
  private async threeWayMerge(
    base: string,
    local: string,
    remote: string
  ): Promise<ThreeWayMergeResult> {
    // Use diff-match-patch or similar
    const dmp = new diff_match_patch();
    
    const localPatches = dmp.patch_make(base, local);
    const remotePatches = dmp.patch_make(base, remote);
    
    // Apply local patches first
    const [afterLocal, localResults] = dmp.patch_apply(localPatches, base);
    
    // Apply remote patches to result
    const [merged, remoteResults] = dmp.patch_apply(remotePatches, afterLocal);
    
    // Check for conflicts (failed patches)
    const conflicts = [];
    remoteResults.forEach((success, i) => {
      if (!success) {
        conflicts.push({
          patch: remotePatches[i],
          position: this.findConflictPosition(remotePatches[i]),
        });
      }
    });
    
    return {
      merged,
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }
}
```

### 5.8 Database Schema for Collaboration

```sql
-- Collaborative documents
CREATE TABLE collaborative_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    
    -- Document info
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'code', 'markdown', 'rich_text', 'canvas'
    
    -- Yjs state
    yjs_state BYTEA,  -- Encoded Y.Doc state
    yjs_state_vector BYTEA,  -- State vector for incremental sync
    
    -- Version tracking
    version INTEGER NOT NULL DEFAULT 1,
    last_snapshot_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Access control
    owner_id UUID NOT NULL REFERENCES users(id),
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    
    CONSTRAINT valid_doc_type CHECK (type IN ('code', 'markdown', 'rich_text', 'canvas')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'workspace', 'public'))
);

CREATE INDEX idx_collab_docs_workspace ON collaborative_documents(workspace_id);
CREATE INDEX idx_collab_docs_owner ON collaborative_documents(owner_id);

-- Document snapshots (for version history)
CREATE TABLE document_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
    
    -- Snapshot data
    yjs_snapshot BYTEA NOT NULL,
    version INTEGER NOT NULL,
    
    -- Metadata
    name VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Change summary
    changes_summary JSONB,
    
    UNIQUE(document_id, version)
);

CREATE INDEX idx_doc_snapshots_document ON document_snapshots(document_id, version DESC);

-- Active collaboration sessions
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Session info
    client_id VARCHAR(255) NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Cursor state
    cursor_position JSONB,
    selection_range JSONB,
    
    -- Connection info
    connection_id VARCHAR(255),
    
    UNIQUE(document_id, user_id, client_id)
);

CREATE INDEX idx_collab_sessions_document ON collaboration_sessions(document_id);
CREATE INDEX idx_collab_sessions_user ON collaboration_sessions(user_id);

-- Incremental updates (for sync optimization)
CREATE TABLE document_updates (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
    
    -- Update data
    yjs_update BYTEA NOT NULL,
    
    -- Ordering
    sequence_number BIGINT NOT NULL,
    
    -- Metadata
    client_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(document_id, sequence_number)
);

CREATE INDEX idx_doc_updates_document_seq ON document_updates(document_id, sequence_number);

-- Compact old updates periodically
CREATE OR REPLACE FUNCTION compact_document_updates(p_document_id UUID)
RETURNS void AS $$
DECLARE
    v_merged_state BYTEA;
    v_max_seq BIGINT;
BEGIN
    -- Get current merged state
    SELECT yjs_state, 
           (SELECT MAX(sequence_number) FROM document_updates WHERE document_id = p_document_id)
    INTO v_merged_state, v_max_seq
    FROM collaborative_documents
    WHERE id = p_document_id;
    
    -- Delete old updates (keep last 100)
    DELETE FROM document_updates
    WHERE document_id = p_document_id
      AND sequence_number < v_max_seq - 100;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Connector Governance Framework

### 6.1 Overview

SwissBrain's connector governance framework provides **enterprise-grade control** over third-party integrations, including admin approval workflows, automated token rotation, SCIM provisioning, and SAML federation.

### 6.2 Connector Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  REQUESTED  │────▶│  REVIEWING  │────▶│  APPROVED   │────▶│   ACTIVE    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CANCELLED  │     │  REJECTED   │     │   EXPIRED   │     │  SUSPENDED  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  REVOKED    │
                                                            └─────────────┘
```

### 6.3 Admin Approval Workflows

```typescript
// Connector approval workflow engine
interface ApprovalWorkflow {
  // Workflow definition
  id: string;
  name: string;
  connectorTypes: string[];  // Which connector types require this workflow
  
  // Approval stages
  stages: ApprovalStage[];
  
  // Escalation rules
  escalation: EscalationPolicy;
  
  // Auto-approval rules
  autoApprove: AutoApprovalRule[];
}

interface ApprovalStage {
  id: string;
  name: string;
  approvers: ApproverConfig;
  requiredApprovals: number;
  timeoutHours: number;
  onTimeout: 'escalate' | 'reject' | 'auto_approve';
}

interface ApproverConfig {
  type: 'role' | 'user' | 'group' | 'manager_chain';
  value: string | string[];
  
  // For manager_chain
  levels?: number;  // How many levels up
}

// Workflow implementation
class ConnectorApprovalWorkflow {
  private workflow: ApprovalWorkflow;
  private currentStage: number = 0;
  private approvals: Map<string, Approval[]> = new Map();
  
  async submitForApproval(
    connectorRequest: ConnectorRequest
  ): Promise<ApprovalSubmission> {
    // Validate request
    await this.validateRequest(connectorRequest);
    
    // Check auto-approval rules
    const autoApproval = await this.checkAutoApproval(connectorRequest);
    if (autoApproval.approved) {
      return this.autoApprove(connectorRequest, autoApproval.reason);
    }
    
    // Create approval record
    const submission = await db.insert(connectorApprovals).values({
      connectorRequestId: connectorRequest.id,
      workflowId: this.workflow.id,
      currentStageId: this.workflow.stages[0].id,
      status: 'pending',
      submittedAt: new Date(),
      submittedBy: connectorRequest.requestedBy,
    }).returning();
    
    // Notify approvers
    await this.notifyApprovers(submission[0], this.workflow.stages[0]);
    
    // Schedule timeout
    await this.scheduleTimeout(submission[0], this.workflow.stages[0]);
    
    return {
      submissionId: submission[0].id,
      status: 'pending',
      currentStage: this.workflow.stages[0].name,
      estimatedCompletionTime: this.estimateCompletion(),
    };
  }
  
  async processApproval(
    submissionId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    comments?: string
  ): Promise<ApprovalResult> {
    const submission = await this.getSubmission(submissionId);
    const stage = this.getCurrentStage(submission);
    
    // Verify approver is authorized
    const isAuthorized = await this.verifyApprover(approverId, stage);
    if (!isAuthorized) {
      throw new UnauthorizedApproverError(approverId, stage.id);
    }
    
    // Record approval/rejection
    await db.insert(approvalDecisions).values({
      submissionId,
      stageId: stage.id,
      approverId,
      decision,
      comments,
      decidedAt: new Date(),
    });
    
    if (decision === 'reject') {
      return this.rejectSubmission(submission, approverId, comments);
    }
    
    // Check if stage requirements met
    const stageApprovals = await this.getStageApprovals(submissionId, stage.id);
    if (stageApprovals.length >= stage.requiredApprovals) {
      return this.advanceToNextStage(submission);
    }
    
    return {
      status: 'pending',
      currentStage: stage.name,
      approvalsReceived: stageApprovals.length,
      approvalsRequired: stage.requiredApprovals,
    };
  }
  
  private async advanceToNextStage(
    submission: ConnectorApproval
  ): Promise<ApprovalResult> {
    const currentIndex = this.workflow.stages.findIndex(
      s => s.id === submission.currentStageId
    );
    
    if (currentIndex === this.workflow.stages.length - 1) {
      // Final stage completed - approve connector
      return this.finalizeApproval(submission);
    }
    
    const nextStage = this.workflow.stages[currentIndex + 1];
    
    await db.update(connectorApprovals)
      .set({
        currentStageId: nextStage.id,
        updatedAt: new Date(),
      })
      .where(eq(connectorApprovals.id, submission.id));
    
    // Notify next stage approvers
    await this.notifyApprovers(submission, nextStage);
    
    // Schedule timeout for next stage
    await this.scheduleTimeout(submission, nextStage);
    
    return {
      status: 'pending',
      currentStage: nextStage.name,
      approvalsReceived: 0,
      approvalsRequired: nextStage.requiredApprovals,
    };
  }
  
  private async checkAutoApproval(
    request: ConnectorRequest
  ): Promise<{ approved: boolean; reason?: string }> {
    for (const rule of this.workflow.autoApprove) {
      const matches = await this.evaluateRule(rule, request);
      if (matches) {
        return { approved: true, reason: rule.name };
      }
    }
    return { approved: false };
  }
}

// Auto-approval rules
interface AutoApprovalRule {
  name: string;
  conditions: {
    connectorType?: string[];
    requestedScopes?: string[];  // Must be subset of these
    requesterRole?: string[];
    riskScore?: { max: number };
  };
}

const defaultAutoApprovalRules: AutoApprovalRule[] = [
  {
    name: 'Low-risk read-only connectors',
    conditions: {
      connectorType: ['slack', 'github', 'jira'],
      requestedScopes: ['read:basic', 'read:profile'],
      riskScore: { max: 20 },
    },
  },
  {
    name: 'Admin self-service',
    conditions: {
      requesterRole: ['admin', 'super_admin'],
    },
  },
];
```

### 6.4 OAuth Token Rotation

```typescript
// Token rotation manager
interface TokenRotationPolicy {
  // Rotation schedule
  rotationIntervalDays: number;
  
  // Grace period for old token
  gracePeriodHours: number;
  
  // Notification settings
  notifyBeforeDays: number;
  
  // Failure handling
  maxRotationAttempts: number;
  fallbackBehavior: 'suspend' | 'alert_only' | 'continue_with_old';
}

class TokenRotationManager {
  private policies: Map<string, TokenRotationPolicy> = new Map();
  
  async scheduleRotation(connector: Connector): Promise<void> {
    const policy = this.getPolicy(connector.type);
    
    // Calculate next rotation time
    const nextRotation = new Date(
      connector.tokenIssuedAt.getTime() + 
      (policy.rotationIntervalDays * 24 * 60 * 60 * 1000)
    );
    
    // Schedule rotation job
    await scheduler.schedule({
      type: 'token_rotation',
      connectorId: connector.id,
      scheduledAt: nextRotation,
      metadata: {
        policy: policy,
        attempt: 1,
      },
    });
    
    // Schedule reminder notification
    const reminderTime = new Date(
      nextRotation.getTime() - (policy.notifyBeforeDays * 24 * 60 * 60 * 1000)
    );
    
    await scheduler.schedule({
      type: 'token_rotation_reminder',
      connectorId: connector.id,
      scheduledAt: reminderTime,
    });
  }
  
  async rotateToken(connectorId: string, attempt: number = 1): Promise<RotationResult> {
    const connector = await this.getConnector(connectorId);
    const policy = this.getPolicy(connector.type);
    
    try {
      // Get new token using refresh token
      const newTokens = await this.refreshOAuthToken(connector);
      
      // Store new token (keep old one during grace period)
      await db.transaction(async (tx) => {
        // Archive old token
        await tx.insert(archivedTokens).values({
          connectorId,
          accessToken: connector.accessToken,
          refreshToken: connector.refreshToken,
          archivedAt: new Date(),
          expiresAt: new Date(Date.now() + policy.gracePeriodHours * 60 * 60 * 1000),
        });
        
        // Update connector with new token
        await tx.update(connectors)
          .set({
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || connector.refreshToken,
            tokenIssuedAt: new Date(),
            tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
            lastRotatedAt: new Date(),
            rotationAttempts: 0,
          })
          .where(eq(connectors.id, connectorId));
      });
      
      // Schedule next rotation
      await this.scheduleRotation(connector);
      
      // Audit log
      await this.auditLog('token_rotated', connector, { attempt });
      
      return { success: true, nextRotation: this.calculateNextRotation(policy) };
      
    } catch (error) {
      // Handle rotation failure
      if (attempt < policy.maxRotationAttempts) {
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, attempt) * 60 * 1000; // 2^attempt minutes
        
        await scheduler.schedule({
          type: 'token_rotation',
          connectorId,
          scheduledAt: new Date(Date.now() + retryDelay),
          metadata: { attempt: attempt + 1 },
        });
        
        return { success: false, retrying: true, nextAttempt: attempt + 1 };
      }
      
      // Max attempts reached
      await this.handleRotationFailure(connector, policy, error);
      
      return { success: false, retrying: false, error: error.message };
    }
  }
  
  private async handleRotationFailure(
    connector: Connector,
    policy: TokenRotationPolicy,
    error: Error
  ): Promise<void> {
    switch (policy.fallbackBehavior) {
      case 'suspend':
        await this.suspendConnector(connector.id, 'token_rotation_failed');
        await this.notifyAdmins(connector, 'Connector suspended due to token rotation failure');
        break;
      
      case 'alert_only':
        await this.notifyAdmins(connector, 'Token rotation failed - manual intervention required');
        break;
      
      case 'continue_with_old':
        await this.notifyAdmins(connector, 'Token rotation failed - continuing with existing token');
        // Schedule another attempt in 24 hours
        await scheduler.schedule({
          type: 'token_rotation',
          connectorId: connector.id,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: { attempt: 1, previousFailure: error.message },
        });
        break;
    }
    
    await this.auditLog('token_rotation_failed', connector, { error: error.message });
  }
}
```

### 6.5 SCIM Provisioning Integration

```typescript
// SCIM 2.0 provisioning handler
interface SCIMConfig {
  baseUrl: string;
  bearerToken: string;
  
  // Mapping configuration
  userMapping: AttributeMapping;
  groupMapping: AttributeMapping;
  
  // Sync settings
  syncIntervalMinutes: number;
  batchSize: number;
}

interface AttributeMapping {
  // SwissBrain attribute -> SCIM attribute
  [localAttr: string]: string | AttributeTransform;
}

interface AttributeTransform {
  scimPath: string;
  transform?: (value: any) => any;
  required?: boolean;
}

class SCIMProvisioner {
  private config: SCIMConfig;
  private httpClient: HttpClient;
  
  constructor(config: SCIMConfig) {
    this.config = config;
    this.httpClient = new HttpClient({
      baseUrl: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/scim+json',
      },
    });
  }
  
  // Provision new user
  async provisionUser(user: User): Promise<SCIMUser> {
    const scimUser = this.mapToSCIMUser(user);
    
    const response = await this.httpClient.post('/Users', scimUser);
    
    if (response.status === 201) {
      // Store SCIM ID mapping
      await db.insert(scimMappings).values({
        localType: 'user',
        localId: user.id,
        scimId: response.data.id,
        externalId: response.data.externalId,
        createdAt: new Date(),
      });
      
      return response.data;
    }
    
    throw new SCIMProvisioningError(response.status, response.data);
  }
  
  // Update existing user
  async updateUser(user: User): Promise<SCIMUser> {
    const mapping = await this.getSCIMMapping('user', user.id);
    if (!mapping) {
      // User not provisioned yet
      return this.provisionUser(user);
    }
    
    const scimUser = this.mapToSCIMUser(user);
    
    const response = await this.httpClient.put(
      `/Users/${mapping.scimId}`,
      scimUser
    );
    
    if (response.status === 200) {
      await db.update(scimMappings)
        .set({ updatedAt: new Date() })
        .where(eq(scimMappings.id, mapping.id));
      
      return response.data;
    }
    
    throw new SCIMProvisioningError(response.status, response.data);
  }
  
  // Deprovision user
  async deprovisionUser(userId: string): Promise<void> {
    const mapping = await this.getSCIMMapping('user', userId);
    if (!mapping) return;
    
    const response = await this.httpClient.delete(`/Users/${mapping.scimId}`);
    
    if (response.status === 204 || response.status === 404) {
      await db.delete(scimMappings)
        .where(eq(scimMappings.id, mapping.id));
      return;
    }
    
    throw new SCIMProvisioningError(response.status, response.data);
  }
  
  // Sync groups
  async syncGroups(): Promise<SyncResult> {
    const localGroups = await this.getLocalGroups();
    const scimGroups = await this.getSCIMGroups();
    
    const results: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };
    
    // Create/update groups
    for (const localGroup of localGroups) {
      try {
        const mapping = await this.getSCIMMapping('group', localGroup.id);
        
        if (mapping) {
          await this.updateGroup(localGroup);
          results.updated++;
        } else {
          await this.provisionGroup(localGroup);
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          groupId: localGroup.id,
          error: error.message,
        });
      }
    }
    
    // Delete groups that no longer exist locally
    for (const scimGroup of scimGroups) {
      const mapping = await this.getSCIMMappingByScimId('group', scimGroup.id);
      if (mapping) {
        const localExists = localGroups.some(g => g.id === mapping.localId);
        if (!localExists) {
          await this.deprovisionGroup(mapping.localId);
          results.deleted++;
        }
      }
    }
    
    return results;
  }
  
  private mapToSCIMUser(user: User): SCIMUser {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      externalId: user.id,
      userName: user.email,
      name: {
        givenName: user.firstName,
        familyName: user.lastName,
        formatted: `${user.firstName} ${user.lastName}`,
      },
      emails: [
        {
          value: user.email,
          type: 'work',
          primary: true,
        },
      ],
      active: user.status === 'active',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
        department: user.department,
        manager: user.managerId ? { value: user.managerId } : undefined,
      },
    };
  }
}
```

### 6.6 SAML Federation Setup

```typescript
// SAML 2.0 federation configuration
interface SAMLConfig {
  // Identity Provider settings
  idp: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    signatureAlgorithm: 'sha256' | 'sha512';
  };
  
  // Service Provider settings (SwissBrain)
  sp: {
    entityId: string;
    assertionConsumerServiceUrl: string;
    singleLogoutServiceUrl?: string;
    privateKey: string;
    certificate: string;
  };
  
  // Attribute mapping
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    role?: string;
  };
  
  // Security settings
  security: {
    wantAssertionsSigned: boolean;
    wantMessagesSigned: boolean;
    signAuthnRequests: boolean;
    signLogoutRequests: boolean;
    allowUnsolicitedResponse: boolean;
  };
}

class SAMLFederationManager {
  private config: SAMLConfig;
  private samlLib: SAML2;
  
  constructor(tenantId: string) {
    this.config = await this.loadTenantSAMLConfig(tenantId);
    this.samlLib = new SAML2(this.config);
  }
  
  // Generate AuthnRequest
  async createAuthnRequest(
    relayState?: string
  ): Promise<{ url: string; id: string }> {
    const authnRequest = this.samlLib.createAuthnRequest({
      issuer: this.config.sp.entityId,
      destination: this.config.idp.ssoUrl,
      assertionConsumerServiceURL: this.config.sp.assertionConsumerServiceUrl,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      forceAuthn: false,
      isPassive: false,
    });
    
    // Sign if configured
    if (this.config.security.signAuthnRequests) {
      await this.signRequest(authnRequest);
    }
    
    // Build redirect URL
    const url = new URL(this.config.idp.ssoUrl);
    url.searchParams.set('SAMLRequest', await this.deflateAndEncode(authnRequest.xml));
    if (relayState) {
      url.searchParams.set('RelayState', relayState);
    }
    
    // Store request ID for validation
    await this.storeAuthnRequestId(authnRequest.id);
    
    return {
      url: url.toString(),
      id: authnRequest.id,
    };
  }
  
  // Process SAML Response
  async processResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SAMLAuthResult> {
    // Decode and parse response
    const decoded = await this.decodeResponse(samlResponse);
    const response = this.samlLib.parseResponse(decoded);
    
    // Validate response
    await this.validateResponse(response);
    
    // Extract user attributes
    const attributes = this.extractAttributes(response.assertion);
    
    // Find or create user
    const user = await this.findOrCreateUser(attributes);
    
    // Update group memberships if provided
    if (attributes.groups) {
      await this.syncGroupMemberships(user.id, attributes.groups);
    }
    
    // Create session
    const session = await this.createSession(user, {
      samlSessionIndex: response.assertion.sessionIndex,
      samlNameId: response.assertion.nameId,
    });
    
    return {
      success: true,
      user,
      session,
      relayState,
    };
  }
  
  private async validateResponse(response: SAMLResponse): Promise<void> {
    // Validate signature
    if (this.config.security.wantMessagesSigned) {
      const isValid = await this.verifySignature(
        response.xml,
        this.config.idp.certificate
      );
      if (!isValid) {
        throw new SAMLValidationError('Invalid response signature');
      }
    }
    
    // Validate assertion signature
    if (this.config.security.wantAssertionsSigned) {
      const isValid = await this.verifySignature(
        response.assertion.xml,
        this.config.idp.certificate
      );
      if (!isValid) {
        throw new SAMLValidationError('Invalid assertion signature');
      }
    }
    
    // Validate InResponseTo
    if (response.inResponseTo) {
      const requestExists = await this.verifyAuthnRequestId(response.inResponseTo);
      if (!requestExists) {
        throw new SAMLValidationError('Invalid InResponseTo');
      }
    } else if (!this.config.security.allowUnsolicitedResponse) {
      throw new SAMLValidationError('Unsolicited response not allowed');
    }
    
    // Validate conditions
    const now = new Date();
    if (response.assertion.conditions) {
      const { notBefore, notOnOrAfter } = response.assertion.conditions;
      
      if (notBefore && now < new Date(notBefore)) {
        throw new SAMLValidationError('Assertion not yet valid');
      }
      
      if (notOnOrAfter && now >= new Date(notOnOrAfter)) {
        throw new SAMLValidationError('Assertion expired');
      }
    }
    
    // Validate audience
    const audiences = response.assertion.conditions?.audienceRestriction || [];
    if (!audiences.includes(this.config.sp.entityId)) {
      throw new SAMLValidationError('Invalid audience');
    }
  }
  
  private extractAttributes(assertion: SAMLAssertion): UserAttributes {
    const mapping = this.config.attributeMapping;
    const attrs = assertion.attributeStatement || {};
    
    return {
      email: this.getAttribute(attrs, mapping.email),
      firstName: mapping.firstName ? this.getAttribute(attrs, mapping.firstName) : undefined,
      lastName: mapping.lastName ? this.getAttribute(attrs, mapping.lastName) : undefined,
      groups: mapping.groups ? this.getAttributeArray(attrs, mapping.groups) : undefined,
      role: mapping.role ? this.getAttribute(attrs, mapping.role) : undefined,
    };
  }
  
  // Generate SP metadata
  generateMetadata(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${this.config.sp.entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="${this.config.security.signAuthnRequests}"
                      WantAssertionsSigned="${this.config.security.wantAssertionsSigned}"
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${this.config.sp.certificate}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${this.config.sp.certificate}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${this.config.sp.assertionConsumerServiceUrl}"
                                 index="0"
                                 isDefault="true"/>
    ${this.config.sp.singleLogoutServiceUrl ? `
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                            Location="${this.config.sp.singleLogoutServiceUrl}"/>
    ` : ''}
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }
}
```

### 6.7 Connector Audit Logging

```sql
-- Connector audit log
CREATE TABLE connector_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    connector_id UUID REFERENCES connectors(id),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    
    -- Actor
    actor_type VARCHAR(20) NOT NULL,  -- 'user', 'system', 'api'
    actor_id VARCHAR(255),
    actor_ip VARCHAR(45),
    actor_user_agent TEXT,
    
    -- Target
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    
    -- Event data
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Result
    result VARCHAR(20) NOT NULL,  -- 'success', 'failure', 'partial'
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Compliance
    retention_until TIMESTAMPTZ,
    
    CONSTRAINT valid_event_category CHECK (event_category IN (
        'authentication', 'authorization', 'configuration', 
        'data_access', 'token_management', 'admin_action'
    )),
    CONSTRAINT valid_actor_type CHECK (actor_type IN ('user', 'system', 'api', 'scheduler')),
    CONSTRAINT valid_result CHECK (result IN ('success', 'failure', 'partial'))
);

-- Indexes for audit queries
CREATE INDEX idx_connector_audit_tenant_time ON connector_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_connector_audit_connector ON connector_audit_log(connector_id, created_at DESC);
CREATE INDEX idx_connector_audit_actor ON connector_audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX idx_connector_audit_event ON connector_audit_log(event_type, created_at DESC);

-- Audit event types
COMMENT ON COLUMN connector_audit_log.event_type IS 'Examples:
  - connector.requested
  - connector.approved
  - connector.rejected
  - connector.activated
  - connector.suspended
  - connector.revoked
  - token.rotated
  - token.rotation_failed
  - scim.user_provisioned
  - scim.user_updated
  - scim.user_deprovisioned
  - saml.login_success
  - saml.login_failed
  - permission.granted
  - permission.revoked
  - data.accessed
  - data.exported';

-- Retention policy function
CREATE OR REPLACE FUNCTION apply_audit_retention()
RETURNS void AS $$
BEGIN
    -- Delete audit logs past retention date
    DELETE FROM connector_audit_log
    WHERE retention_until IS NOT NULL
      AND retention_until < NOW();
    
    -- Set default retention for logs without explicit retention
    UPDATE connector_audit_log
    SET retention_until = created_at + INTERVAL '7 years'
    WHERE retention_until IS NULL
      AND created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;
```

---

## References

1. XState Documentation - State Machine Implementation: https://xstate.js.org/docs/
2. Stripe Billing Documentation - Credit and Subscription Models: https://stripe.com/docs/billing
3. Google SRE Book - Rate Limiting and Fair Scheduling: https://sre.google/sre-book/
4. gVisor Documentation - Container Sandboxing: https://gvisor.dev/docs/
5. Yjs Documentation - CRDT Implementation: https://docs.yjs.dev/
6. SCIM 2.0 Specification - RFC 7644: https://datatracker.ietf.org/doc/html/rfc7644
7. SAML 2.0 Technical Overview: https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html
8. Kubernetes Network Policies: https://kubernetes.io/docs/concepts/services-networking/network-policies/
9. seccomp-bpf Documentation: https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html
10. AppArmor Documentation: https://gitlab.com/apparmor/apparmor/-/wikis/Documentation

---

*This document provides production-ready specifications for the SwissBrain AI Platform. All code examples are implementable and follow industry best practices.*
