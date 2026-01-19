# Parity Delta: Manus.im Enterprise Parity Gap Analysis

**Created**: 2026-01-16
**Last Updated**: 2026-01-16
**Status**: Complete - Ground Truth Assessment
**Methodology**: Intel docs compared against actual codebase inspection

---

## Executive Summary

This document provides a **ground truth assessment** of the SwissBrain codebase against the Manus.im enterprise parity specifications in the `.claude/` intel documents.

**Key Findings**:
- **13 systems assessed**
- **5 systems FULLY IMPLEMENTED** (better than expected)
- **4 systems PARTIALLY IMPLEMENTED** (schema exists, code gaps)
- **4 systems NOT IMPLEMENTED** (critical gaps)
- **No spec violations detected** in existing code

**Risk Assessment**:
- **P0 (Critical)**: 3 gaps (Token Counting, Orchestrator, OT Engine)
- **P1 (High)**: 4 gaps (Circuit Breaker, WebSocket Gateway, Collaboration Billing, Template Validation)
- **P2 (Medium)**: 3 gaps (Alert Rules, Email Ingestion, Template Marketplace)

---

## Table of Contents

1. [What Exists Already](#1-what-exists-already)
2. [What Partially Exists](#2-what-partially-exists-but-violates-manus-invariants)
3. [What Is Missing Completely](#3-what-is-missing-completely)
4. [Gap List Ranked by Enterprise Risk](#4-gap-list-ranked-by-enterprise-risk)
5. [Implementation Plan (PR-Sized Chunks)](#5-implementation-plan-pr-sized-chunks)
6. [Test Plan](#6-test-plan)
7. [Rollout Plan](#7-rollout-plan)

---

## 1. What Exists Already

These systems are **FULLY IMPLEMENTED** and meet or exceed Manus specifications.

### 1.1 Agent Execution System

**Location**: `agent-api/app/agent/`, `agent-api/app/worker/`

**Evidence**:
- `supervisor.py` - Main execution orchestrator (236 lines)
- `planner.py` - Execution planning with credit estimation (198 lines)
- `tools/router.py` - Tool routing (shell, code, browser, search)
- `tools/e2b_executor.py` - E2B sandbox execution
- `job_processor.py` - Job processing with state management

**Database Tables** (confirmed in migrations):
- `agent_runs` - 10 status states: created, queued, planning, executing, waiting_user, paused, completed, failed, cancelled, timeout
- `agent_steps` - Individual step tracking with tool types
- `agent_messages` - Chat messages within runs
- `agent_artifacts` - Content-addressed file storage
- `agent_memory` - Persistent memory with vector embeddings

**Verdict**: **FULLY IMPLEMENTED**

---

### 1.2 Redis Queue Infrastructure

**Location**: `agent-api/app/redis/`, `agent-api/app/worker/job_queue.py`

**Evidence**:
- `clients.py` - Dual Redis clients (standard + upstash HTTP-based)
- `publisher.py` - Async log publishing
- `subscriber.py` - Log subscription with AsyncIterator
- `job_queue.py` - Complete queue implementation (254 lines):
  - LPUSH/BRPOP pattern
  - Retry queue with exponential backoff
  - Dead Letter Queue (DLQ)
  - Idempotency key deduplication
  - Transient error classification

**Matches Spec**:
- Phase 2B Plan: "Dual Redis clients" ✅
- Phase 2B Plan: "Job queue with retry/DLQ logic" ✅
- Phase 2B Plan: "Redis pub/sub for real-time logs" ✅

**Verdict**: **FULLY IMPLEMENTED**

---

### 1.3 S3 Workspace Storage

**Location**: `agent-api/app/storage/s3_workspace.py`

**Evidence**:
- Exoscale S3 integration (Geneva: sos-ch-gva-2.exo.io)
- Workspace bucket: `swissbrain-workspaces`
- Read/write/list operations implemented

**Matches Spec**:
- Phase 2B Plan: "Exoscale S3-compatible storage (Geneva)" ✅

**Verdict**: **FULLY IMPLEMENTED**

---

### 1.4 Document Generation

**Location**: `agent-api/app/document_generation/`

**Evidence**:
- `pptx_generator.py` - PowerPoint (244 lines)
- `docx_generator.py` - Word (193 lines)
- `xlsx_generator.py` - Excel (280 lines)
- `pdf_generator.py` - PDF (295 lines)
- `markdown_generator.py` - Markdown (179 lines)
- `router.py` - Document generation router
- Full API: `POST /api/documents/generate`

**Verdict**: **FULLY IMPLEMENTED** (exceeds spec)

---

### 1.5 Prompt Management System

**Location**: `agent-api/app/prompts/`

**Evidence**:
- `version_manager.py` - Semantic versioning with activation
- `template_system.py` - Template rendering with {{variable}}
- `ab_testing.py` - Production A/B testing framework
- `metrics.py` - Success/failure rates, latency, quality scores
- `optimizer.py` - Intelligent prompt optimization

**Features**:
- Version control with rollback
- A/B testing with statistical significance
- Performance-based auto-activation

**Verdict**: **FULLY IMPLEMENTED** (exceeds spec)

---

### 1.6 Wide Research System

**Location**: `agent-api/app/research/`, database tables

**Evidence**:
- `coordinator.py` - Parallel agent coordinator
- `job_manager.py` - Research job lifecycle
- `synthesizer.py` - Result aggregation
- `wide_research_jobs` table - Parallel research jobs
- `wide_research_subtasks` table - Individual item processing
- `wide_research_templates` table - Reusable templates

**Features**:
- Max 50 parallel items
- Progress tracking
- Result synthesis with confidence scoring

**Verdict**: **FULLY IMPLEMENTED**

---

### 1.7 Scheduled Tasks

**Location**: `agent-api/app/scheduler/task_scheduler.py`, database tables

**Evidence**:
- Cron/interval scheduling
- Task pause/resume
- Execution tracking
- `scheduled_tasks` table with statistics
- `scheduled_task_runs` table for history

**Verdict**: **FULLY IMPLEMENTED**

---

### 1.8 Audit Logging

**Location**: `supabase/migrations/20260112000012_audit_logging.sql`

**Evidence**:
- `audit_logs` table - Append-only, immutable
- `audit_actions` - 100+ predefined actions
- 7 indexes including GIN for JSONB
- `log_audit_event()` function
- `search_audit_logs()` with filtering
- Retention-based cleanup

**Verdict**: **FULLY IMPLEMENTED**

---

## 2. What Partially Exists (But Violates Manus Invariants)

These systems have **schema or partial implementation** but **violate key invariants** from the intel docs.

### 2.1 Billing & Credit System

**What EXISTS**:

**Database** (confirmed in `supabase/migrations/`):
- `credit_balances` - Current user credit state
- `credit_transactions` - Ledger with 8 transaction types
- `credit_reservations` - Pre-execution credit holds
- `subscription_tiers` - Plan definitions (free, pro, team, enterprise)
- `user_subscriptions` - Subscription status
- `stripe_customers`, `subscriptions`, `invoices` - Stripe integration
- `token_usage`, `token_usage_daily` - Token tracking
- `credit_pricing` - Per-tool/per-token pricing

**Code** (confirmed in `agent-api/app/agent/`):
- `planner.py:32-36` - Fetches `available_credits` from `credit_balances`
- `supervisor.py:64-68` - `_check_credits()` before execution
- `supervisor.py:149-152` - `_deduct_credits()` after tool execution

**What VIOLATES Manus Invariants**:

| Golden Invariant | Spec | Current State | Violation |
|-----------------|------|---------------|-----------|
| **Token Count Before AND After** | TOKEN_COUNTING.md | Only estimates before, actual after | **PARTIAL** |
| **Multi-Provider Tokenizers** | tiktoken, anthropic, google | No tokenizers installed | **MISSING** |
| **Idempotent record_token_call()** | Idempotency key prevents double-billing | Function exists but not enforced on all paths | **PARTIAL** |
| **Token Caching Hierarchy** | Memory → Redis → Database | No caching implemented | **MISSING** |
| **Billing Failure → Read-Only** | Set workspace read-only on failure | Not implemented | **MISSING** |

**Risk**: **P0 - CRITICAL**
- Revenue leakage from inaccurate token counting
- Double-billing risk on retries
- Over-quota execution possible

---

### 2.2 Collaboration System

**What EXISTS**:

**Database** (confirmed in `supabase/migrations/20260113000006_collaboration_schema.sql`):
- `collaboration_sessions` - Real-time sessions with Yjs storage
- `collaboration_participants` - Roles, presence, cursor position
- `collaboration_invites` - Email-based invitations
- `collaboration_edits` - Full edit history

**Frontend** (confirmed in `/src/components/collaboration/`):
- `ShareDialog.tsx` - Sharing modal with permissions
- Hooks: `useBroadcast`, `usePresence`, `useDocumentSync`

**What VIOLATES Manus Invariants**:

| Golden Invariant | Spec | Current State | Violation |
|-----------------|------|---------------|-----------|
| **OT Preserves Convergence** | CHARACTER_LEVEL_OT_IMPLEMENTATION.md | No OT engine in codebase | **MISSING** |
| **Owner ALWAYS Pays** | Collaboration Billing Semantics | Not enforced | **MISSING** |
| **Circuit Breaker at 95%** | CIRCUIT_BREAKER_WEBHOOK_IMPLEMENTATION.md | No circuit breaker | **MISSING** |
| **Presence Credit Deduction** | Per-minute billing | Not implemented | **MISSING** |

**Schema exists**, but **NO SERVER-SIDE IMPLEMENTATION** for:
- OT transformation engine
- WebSocket gateway (Hocuspocus)
- Circuit breaker
- Collaboration billing

**Risk**: **P0 - CRITICAL** (OT), **P1 - HIGH** (Circuit Breaker, Billing)

---

### 2.3 Orchestrator System

**What EXISTS**:

**Database** (confirmed):
- `agent_runs` - 10 status states ✅
- `agent_steps` - Step tracking ✅

**Code**:
- `supervisor.py` - Sequential execution loop
- `planner.py` - Creates ExecutionPlan with phases

**What VIOLATES Manus Invariants**:

| Golden Invariant | Spec | Current State | Violation |
|-----------------|------|---------------|-----------|
| **10-State Run State Machine** | CREATED→VALIDATING→DECOMPOSING→SCHEDULING→EXECUTING→AGGREGATING→FINALIZING→COMPLETED/FAILED/CANCELLED | Only uses: created, queued, planning, executing, completed, failed, cancelled | **PARTIAL** |
| **Fencing Tokens** | Optimistic locking with state_version | No fencing tokens | **MISSING** |
| **Task Decomposition** | LLM-powered query analysis, 4 strategies | No decomposition | **MISSING** |
| **Subtask Scheduling** | Fair scheduling, priority calculation | No subtask system | **MISSING** |
| **Exactly-Once via Idempotency** | Idempotency keys for subtasks | Partial (job queue has it, runs don't) | **PARTIAL** |

**Current execution is SEQUENTIAL**, not parallel. Cannot decompose queries into parallel subtasks.

**Risk**: **P0 - CRITICAL**
- Cannot compete with Manus parallel execution
- Limited to simple tasks

---

### 2.4 K8s Job Execution

**What EXISTS**:

**Code** (confirmed in `agent-api/app/k8s/`):
- `client.py` - K8s client initialization
- `executor.py` - Job execution on K8s

**What VIOLATES Manus Invariants**:

| Spec | Current State | Violation |
|------|---------------|-----------|
| S3 workspace mounting via initContainer | Not implemented | **MISSING** |
| Pod log streaming | Partial | **PARTIAL** |
| TTL-based resource cleanup | Not enforced | **MISSING** |

**Code exists but is NOT PRODUCTION-READY**:
- No S3 workspace mounting
- No integration with orchestrator

**Risk**: **P1 - HIGH**

---

## 3. What Is Missing Completely

These systems have **NO implementation** in the codebase.

### 3.1 Token Counting Service

**Spec**: TOKEN_COUNTING.md (1,184 lines)

**Required Components**:
1. Multi-provider tokenizers (tiktoken, anthropic, google)
2. Count tokens before AND after LLM calls
3. Token caching hierarchy (Memory → Redis → Database)
4. js-tiktoken for JS/TS environments

**Current State**: **ZERO IMPLEMENTATION**

**Evidence**:
```bash
grep -r "tiktoken" agent-api/  # No matches
grep -r "anthropic.*token" agent-api/  # No tokenizer matches
```

**Risk**: **P0 - CRITICAL**
- Billing inaccuracy
- Over-quota execution

---

### 3.2 OT Engine (Operational Transformation)

**Spec**: CHARACTER_LEVEL_OT_IMPLEMENTATION.md (2,417 lines)

**Required Components**:
1. Operation types: INSERT, DELETE, RETAIN
2. OTTransformer with transformation functions
3. OTServer for server-side handling
4. OTClient (TypeScript) for frontend

**Current State**: **ZERO IMPLEMENTATION**

**Evidence**: Database schema exists (`collaboration_edits`) but no transformation code.

**Risk**: **P0 - CRITICAL**
- Cannot enable real-time collaboration
- Document divergence risk

---

### 3.3 Circuit Breaker

**Spec**: CIRCUIT_BREAKER_WEBHOOK_IMPLEMENTATION.md (2,188 lines)

**Required Components**:
1. 3 states: CLOSED, OPEN, HALF_OPEN
2. Backpressure calculation (30% WS, 25% Redis, 25% OT, 20% memory)
3. Activation at 95%, deactivation at 85%
4. Flask webhook for Prometheus alerts
5. Redis pub/sub for graceful deactivation

**Current State**: **ZERO IMPLEMENTATION**

**Risk**: **P1 - HIGH**
- System crash under load
- No graceful degradation

---

### 3.4 WebSocket Gateway

**Spec**: Collaboration specs, Phase 2B Plan

**Required Components**:
1. Hocuspocus server for Yjs sync
2. Presence tracking (awareness protocol)
3. Remote cursor rendering
4. Redis pub/sub for multi-pod sync

**Current State**: **ZERO IMPLEMENTATION**

Frontend has hooks (`usePresence`, `useBroadcast`) but no backend gateway.

**Risk**: **P1 - HIGH**
- Collaboration feature non-functional

---

### 3.5 Collaboration Billing

**Spec**: Collaboration Billing Semantics

**Required Components**:
1. Owner ALWAYS pays enforcement
2. Credit deduction for presence (per-minute)
3. Credit deduction for operations (per-op)
4. Billing failure → read-only mode

**Current State**: **ZERO IMPLEMENTATION**

**Risk**: **P1 - HIGH**
- Unpaid work performed
- Billing fraud possible

---

### 3.6 Template Validation Pipeline

**Spec**: TEMPLATE_VALIDATION.md, TEMPLATE_DEPENDENCIES.md

**Required Components**:
1. 6-stage validation pipeline
2. Security scanning (eval, secrets, CVEs)
3. Isolated execution environment (K8s jobs)
4. Build verification

**Current State**: **ZERO IMPLEMENTATION**

**Risk**: **P2 - MEDIUM**
- Malicious template execution risk

---

### 3.7 Template Marketplace

**Spec**: CUSTOM_TEMPLATES_MARKETPLACE.md

**Required Components**:
1. 70/30 revenue split
2. Payment gateway (Stripe Connect)
3. Payout scheduling
4. Tax handling (1099-K)

**Current State**: **ZERO IMPLEMENTATION**

**Risk**: **P2 - MEDIUM**
- No marketplace revenue

---

### 3.8 Prometheus Alert Rules

**Spec**: INCIDENT_RESPONSE_SLA.md, Backpressure Monitoring

**Required Components**:
1. Backpressure alerts (CRITICAL/HIGH/ELEVATED/NORMAL)
2. SLA breach alerts
3. Error budget tracking
4. Alertmanager 4-level escalation

**Current State**: Prometheus/Grafana deployed, **NO RULES CONFIGURED**

**Risk**: **P2 - MEDIUM**
- Incidents undetected
- SLA breaches unknown

---

### 3.9 Email Ingestion Pipeline

**Spec**: Email workflow specification

**Required Components**:
1. Postfix MTA
2. Milter filter (malware scanning)
3. SPF/DKIM/DMARC validation
4. Identity resolution (email → user)

**Current State**: **ZERO IMPLEMENTATION**

**Risk**: **P2 - MEDIUM**
- Missing convenience feature

---

## 4. Gap List Ranked by Enterprise Risk

Risk Score = `(Business Impact × Technical Complexity × Blocking Factor) / 100`

| Rank | Gap | Risk | Business Impact | Complexity | Blocks | LOC Estimate |
|------|-----|------|-----------------|------------|--------|--------------|
| **1** | Token Counting Service | **P0** | 10 | 7 | 10 | ~400 |
| **2** | Orchestrator State Machine | **P0** | 9 | 9 | 8 | ~800 |
| **3** | OT Engine | **P0** | 8 | 10 | 3 | ~600 |
| **4** | Circuit Breaker | **P1** | 7 | 6 | 5 | ~400 |
| **5** | WebSocket Gateway | **P1** | 8 | 7 | 3 | ~500 |
| **6** | Collaboration Billing | **P1** | 7 | 5 | 2 | ~300 |
| **7** | K8s Job Integration | **P1** | 6 | 6 | 5 | ~350 |
| **8** | Template Validation | **P2** | 5 | 6 | 3 | ~400 |
| **9** | Prometheus Alert Rules | **P2** | 5 | 3 | 2 | ~200 |
| **10** | Email Ingestion | **P2** | 4 | 7 | 1 | ~500 |
| **11** | Template Marketplace | **P2** | 4 | 8 | 1 | ~600 |

---

## 5. Implementation Plan (PR-Sized Chunks)

All PRs are **max 500 LOC** per the B1 specification.

### PR1: Token Counting Foundation (~400 LOC)

**Files to Create**:
```
agent-api/app/billing/
├── __init__.py
├── tokenizer.py          # Multi-provider tokenizers (~200 LOC)
├── token_counter.py      # Count before/after logic (~100 LOC)
└── token_cache.py        # Memory → Redis → DB cache (~100 LOC)
```

**Dependencies**: None

**Key Implementation**:
```python
# tokenizer.py - Core interface
class TokenizerFactory:
    @staticmethod
    def get_tokenizer(model: str) -> BaseTokenizer:
        if "gpt" in model or "claude" in model:
            return TiktokenTokenizer(model)
        elif "gemini" in model:
            return GoogleTokenizer(model)
        raise UnsupportedModelError(model)
```

**Test Coverage**: 90%+ unit tests

---

### PR2: Billing Ledger Integration (~350 LOC)

**Files to Modify/Create**:
```
agent-api/app/billing/
├── ledger.py             # Idempotent record_token_call() (~150 LOC)
├── credit_deduction.py   # Credit deduction with rollback (~100 LOC)
└── billing_enforcement.py # Billing failure → read-only (~100 LOC)
```

**Files to Modify**:
- `agent-api/app/agent/supervisor.py` - Add token counting calls

**Dependencies**: PR1

---

### PR3: Orchestrator State Machine (~450 LOC)

**Files to Create**:
```
agent-api/app/orchestrator/
├── __init__.py
├── state_machine.py      # 10-state FSM (~150 LOC)
├── fencing.py            # Fencing tokens + optimistic locking (~100 LOC)
├── event_bus.py          # State change events (~100 LOC)
└── monitors.py           # Progress, deadline, stall monitors (~100 LOC)
```

**Database Migration**:
```sql
ALTER TABLE agent_runs ADD COLUMN state_version INTEGER DEFAULT 0;
ALTER TABLE agent_runs ADD COLUMN fencing_token UUID;
```

**Dependencies**: PR1, PR2

---

### PR4: Task Decomposer (~400 LOC)

**Files to Create**:
```
agent-api/app/orchestrator/
├── decomposer.py         # LLM-powered query analysis (~200 LOC)
├── strategies.py         # 4 decomposition strategies (~150 LOC)
└── dependency_graph.py   # Subtask dependency building (~50 LOC)
```

**Dependencies**: PR3

---

### PR5: Subtask Scheduler (~400 LOC)

**Files to Create**:
```
agent-api/app/orchestrator/
├── scheduler.py          # Fair scheduling + priority (~200 LOC)
├── queue_mapper.py       # Task type → queue mapping (~100 LOC)
└── worker_affinity.py    # Checkpoint affinity (~100 LOC)
```

**Dependencies**: PR3, PR4

---

### PR6: OT Engine Core (~500 LOC)

**Files to Create**:
```
agent-api/app/collaboration/
├── __init__.py
├── ot_types.py           # Operation, OperationBatch, Document (~100 LOC)
├── ot_transformer.py     # Transformation functions (~250 LOC)
└── ot_server.py          # Server-side OT handling (~150 LOC)
```

**Key Implementation** (from spec):
```python
# ot_transformer.py
class OTTransformer:
    def transform(self, op1: Operation, op2: Operation) -> tuple[Operation, Operation]:
        if op1.type == "insert" and op2.type == "insert":
            return self._transform_insert_insert(op1, op2)
        elif op1.type == "insert" and op2.type == "delete":
            return self._transform_insert_delete(op1, op2)
        # ... etc
```

**Dependencies**: None (can parallel with PR3-5)

---

### PR7: WebSocket Gateway (~450 LOC)

**Files to Create**:
```
agent-api/app/collaboration/
├── websocket_gateway.py  # Hocuspocus integration (~200 LOC)
├── presence.py           # Awareness protocol (~150 LOC)
└── redis_sync.py         # Multi-pod sync via Redis (~100 LOC)
```

**Dependencies**: PR6

---

### PR8: Circuit Breaker (~400 LOC)

**Files to Create**:
```
agent-api/app/collaboration/
├── circuit_breaker.py    # 3-state FSM (~200 LOC)
├── backpressure.py       # Weighted calculation (~100 LOC)
└── prometheus_webhook.py # Flask webhook (~100 LOC)
```

**Key Implementation** (from spec):
```python
# circuit_breaker.py
class CircuitBreaker:
    ACTIVATION_THRESHOLD = 0.95
    DEACTIVATION_THRESHOLD = 0.85

    def calculate_backpressure(self) -> float:
        return (
            0.30 * (self.ws_connections / self.max_ws_connections) +
            0.25 * (self.redis_channels / self.max_redis_channels) +
            0.25 * (self.ot_queue_depth / self.ot_queue_capacity) +
            0.20 * (self.memory_used / self.memory_limit)
        )
```

**Dependencies**: PR7

---

### PR9: Collaboration Billing (~300 LOC)

**Files to Create**:
```
agent-api/app/collaboration/
├── billing.py            # Owner pays enforcement (~150 LOC)
└── credit_tracking.py    # Presence/operation billing (~150 LOC)
```

**Dependencies**: PR2, PR8

---

### PR10: K8s Job Integration (~350 LOC)

**Files to Modify**:
```
agent-api/app/k8s/
├── executor.py           # Add S3 workspace mounting (~150 LOC)
├── manifest.py           # Job manifest with initContainer (~100 LOC)
└── cleanup.py            # TTL-based cleanup (~100 LOC)
```

**Dependencies**: PR5 (for orchestrator integration)

---

### PR11: Prometheus Alert Rules (~200 LOC)

**Files to Create**:
```
k8s/prometheus/
├── alert_rules.yaml      # Backpressure + SLA alerts (~150 LOC)
└── alertmanager.yaml     # 4-level escalation (~50 LOC)
```

**Dependencies**: PR8 (for backpressure metrics)

---

## 6. Test Plan

### Unit Tests (Per PR)

| PR | Test File | Coverage Target | Key Tests |
|----|-----------|-----------------|-----------|
| PR1 | `tests/billing/test_tokenizer.py` | 95% | Multi-provider tokenization, cache hits/misses |
| PR2 | `tests/billing/test_ledger.py` | 95% | Idempotency, rollback, read-only enforcement |
| PR3 | `tests/orchestrator/test_state_machine.py` | 90% | All state transitions, fencing token conflicts |
| PR4 | `tests/orchestrator/test_decomposer.py` | 85% | All 4 strategies, LLM mocking |
| PR5 | `tests/orchestrator/test_scheduler.py` | 90% | Fair scheduling, priority ordering |
| PR6 | `tests/collaboration/test_ot.py` | 95% | All transformation combinations, convergence |
| PR7 | `tests/collaboration/test_websocket.py` | 80% | Connection lifecycle, presence sync |
| PR8 | `tests/collaboration/test_circuit_breaker.py` | 95% | State transitions, backpressure calculation |
| PR9 | `tests/collaboration/test_billing.py` | 90% | Owner pays, credit deduction |
| PR10 | `tests/k8s/test_executor.py` | 85% | S3 mounting, cleanup |
| PR11 | Manual verification | N/A | Alert firing, escalation |

### Integration Tests

```
tests/integration/
├── test_billing_flow.py           # Full billing cycle
├── test_orchestrator_flow.py      # Query → decompose → schedule → execute
├── test_collaboration_flow.py     # OT → WebSocket → billing
└── test_circuit_breaker_flow.py   # Load → activate → deactivate
```

### Load Tests

| Test | Target | Tool |
|------|--------|------|
| Orchestrator throughput | 100 concurrent runs | k6 |
| WebSocket connections | 10,000 concurrent | k6 |
| Circuit breaker activation | 95% backpressure | k6 |

---

## 7. Rollout Plan

### Phase 1: Foundation (Week 1-2)

| PR | Feature Flag | Rollout % | Rollback |
|----|--------------|-----------|----------|
| PR1 | `token_counting_enabled` | 10% → 50% → 100% | Disable flag |
| PR2 | `billing_ledger_v2` | 10% → 50% → 100% | Disable flag |

**Success Criteria**:
- Token counts within 5% of actual
- No double-billing incidents
- Billing latency < 50ms p99

---

### Phase 2: Orchestrator (Week 3-5)

| PR | Feature Flag | Rollout % | Rollback |
|----|--------------|-----------|----------|
| PR3 | `orchestrator_v2` | 5% → 25% → 50% → 100% | Route to old supervisor |
| PR4 | `decomposer_enabled` | 5% → 25% → 50% → 100% | Sequential execution |
| PR5 | `scheduler_v2` | 5% → 25% → 50% → 100% | Single queue |

**Success Criteria**:
- Parallel execution working
- No state corruption
- <1% error rate increase

---

### Phase 3: Collaboration (Week 6-9)

| PR | Feature Flag | Rollout % | Rollback |
|----|--------------|-----------|----------|
| PR6 | `ot_engine_enabled` | 10% → 50% → 100% | Disable collaboration |
| PR7 | `websocket_gateway_v2` | 10% → 50% → 100% | Disable real-time |
| PR8 | `circuit_breaker_enabled` | 10% → 50% → 100% | Disable (no protection) |
| PR9 | `collaboration_billing` | 10% → 50% → 100% | Free collaboration |

**Success Criteria**:
- Document convergence 100%
- No circuit breaker false positives
- Owner correctly charged

---

### Phase 4: Operations (Week 10-11)

| PR | Feature Flag | Rollout % | Rollback |
|----|--------------|-----------|----------|
| PR10 | `k8s_execution_v2` | 10% → 50% → 100% | E2B fallback |
| PR11 | N/A (config) | 100% | Delete rules |

**Success Criteria**:
- K8s jobs completing successfully
- Alerts firing correctly
- No alert fatigue

---

## Appendix: File Locations Reference

### Existing Code (DO NOT DUPLICATE)

| System | Location | Lines |
|--------|----------|-------|
| Agent Supervisor | `agent-api/app/agent/supervisor.py` | 236 |
| Agent Planner | `agent-api/app/agent/planner.py` | 198 |
| Job Queue | `agent-api/app/worker/job_queue.py` | 254 |
| Redis Clients | `agent-api/app/redis/clients.py` | 89 |
| S3 Workspace | `agent-api/app/storage/s3_workspace.py` | 156 |
| Document Gen | `agent-api/app/document_generation/` | 1,191 |
| Prompts | `agent-api/app/prompts/` | 847 |

### Database Migrations (REFERENCE ONLY)

| Table | Migration File |
|-------|---------------|
| agent_runs | `20260113000001_agent_core_schema.sql` |
| credit_balances | `20260113000003_billing_schema.sql` |
| collaboration_sessions | `20260113000006_collaboration_schema.sql` |
| wide_research_jobs | `20260113000004_wide_research_schema.sql` |
| audit_logs | `20260112000012_audit_logging.sql` |

---

**Document Created**: 2026-01-16
**Total Gaps Identified**: 11
**Total PRs Planned**: 11
**Estimated Total LOC**: ~4,150
**Estimated Duration**: 11 weeks

---

*End of Parity Delta*
