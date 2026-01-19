# Intelligence Index: Manus.im Enterprise Parity Implementation

**Created**: 2026-01-15
**Status**: Complete Specification Scan
**Documents Scanned**: 14 major specifications (15,000+ lines)
**Purpose**: Single Source of Truth (SSOT) for implementing Manus.im-level agentic parity + SwissBrain differentiators

---

## Table of Contents

1. [Document-to-System Mapping](#document-to-system-mapping)
2. [Golden Invariants](#golden-invariants)
3. [Doc Conflicts & Ambiguities](#doc-conflicts--ambiguities)
4. [Do Not Build Until Answered](#do-not-build-until-answered)
5. [Build Order Dependency Graph](#build-order-dependency-graph)
6. [Top 10 Highest-Risk Enterprise Gaps](#top-10-highest-risk-enterprise-gaps)

---

## Document-to-System Mapping

| Document | System | Subsystem | Key Invariants | Implementation Location |
|----------|--------|-----------|----------------|------------------------|
| **TOKEN_COUNTING.md** | Billing & Usage Tracking | Token Counting | • Token counts MUST be validated before AND after LLM calls<br>• Multi-provider tokenizers required (OpenAI/tiktoken, Anthropic, Google)<br>• Token caching hierarchy: Memory → Redis → Database<br>• js-tiktoken for JS/TS environments | `NOT_IMPLEMENTED`<br>**Gap**: No token counting infrastructure exists |
| **INCIDENT_RESPONSE_SLA.md** | Monitoring & Alerting | Alert Rules & Escalation | • 4 severity levels: critical/high/warning/info<br>• 4-level escalation: Primary → Secondary → Team Lead → CTO<br>• SLA tiers: 99.99%, 99.9%, 99.5%<br>• Error budgets tracked monthly | Prometheus/Grafana exist (Phase 9)<br>**Gap**: Alert rules NOT configured |
| **CUSTOM_TEMPLATES_MARKETPLACE.md** | Template System | Marketplace & Authoring | • 70/30 revenue split (author/platform)<br>• 6-phase authoring workflow<br>• Template SDK with CLI tools<br>• Minimum payout: $50 | `NOT_IMPLEMENTED`<br>**Gap**: No marketplace exists |
| **TEMPLATE_VERSIONING.md** | Template System | Version Management | • Semantic versioning (MAJOR.MINOR.PATCH)<br>• 8 breaking change categories<br>• Migration automation with rollback<br>• Backward compatibility enforced | `NOT_IMPLEMENTED`<br>**Gap**: No versioning system |
| **TEMPLATE_VALIDATION.md** | Template System | Security & Quality | • 6-stage validation pipeline<br>• Malicious code detection (eval(), execSync())<br>• Secret scanning (API keys, credentials)<br>• CVE vulnerability scanning<br>• Security severity: critical/high/moderate/low/info | `NOT_IMPLEMENTED`<br>**Gap**: No validation pipeline |
| **TEMPLATE_DEPENDENCIES.md** | Template System | Dependency Management | • Lockfile versioning with SHA-512 integrity<br>• 8 conflict types, 8 resolution strategies<br>• Multi-level caching (local/CI/CDN)<br>• Auto-update policies for patch/minor/major | `NOT_IMPLEMENTED`<br>**Gap**: No dependency tracking |
| **TEMPLATE_STRUCTURE.md** | Template System | Directory Layout | • 4 template types: web-static, web-db-user, web-ai-agent, mobile-app<br>• Required files: template.json, README, LICENSE<br>• Environment variable definitions<br>• Post-install scripts | Partially exists in codebase<br>**Gap**: Missing template.json validation |
| **PARAMETERIZED_TEMPLATES.md** | Template System | Feature Toggles | • NLP feature parser (40+ features)<br>• Conditional code generation<br>• Feature registry with dependencies<br>• Natural language → feature extraction | `NOT_IMPLEMENTED`<br>**Gap**: No parameterization system |
| **PROJECT_TEMPLATES.md** | Template System | Pre-built Templates | • 7 template types with prompts<br>• Example implementations for each<br>• Template comparison matrix<br>• Selection guide | Partial scaffolding exists<br>**Gap**: Missing complete templates |
| **TEMPLATE_REPOSITORY_STRUCTURE.md** | Template System | Repository & URLs | • Official URL format: `{org}/templates/{category}-{framework}-{variant}`<br>• Community URL format: `{username}/manus-template-{name}`<br>• Registry URLs: `templates.manus.im/{category}/{name}@{version}`<br>• Version resolution: latest/next/exact/range | `NOT_IMPLEMENTED`<br>**Gap**: No template registry |
| **Failure & Retry Semantics.md** (Part 1) | Orchestration | Run State Machine | • 10 run states: CREATED → VALIDATING → DECOMPOSING → SCHEDULING → EXECUTING → AGGREGATING → FINALIZING → COMPLETED/FAILED/CANCELLED<br>• Fencing tokens prevent concurrent modification<br>• State version for optimistic locking<br>• Idempotency keys for exactly-once execution | `NOT_IMPLEMENTED`<br>**Gap**: No orchestrator exists |
| **Failure & Retry Semantics.md** (Part 2) | Orchestration | Task Decomposition | • 4 decomposition strategies: entity-based, dimension-based, source-based, temporal-based<br>• LLM-powered query analysis<br>• Dependency graph building<br>• Resource estimation (duration, cost) | `NOT_IMPLEMENTED`<br>**Gap**: No decomposer exists |
| **Failure & Retry Semantics.md** (Part 3) | Orchestration | Subtask Scheduling | • Fair scheduling with tenant quotas<br>• Priority calculation (deadline, retry, dependencies)<br>• Queue mapping by task type<br>• Worker affinity for checkpointing | `NOT_IMPLEMENTED`<br>**Gap**: No scheduler exists |
| **Failure & Retry Semantics.md** (Part 4) | Orchestration | ORM Models | • SQLAlchemy 2.0 models for ResearchRun, Subtask<br>• 9 subtask states: PENDING → QUEUED → ASSIGNED → RUNNING → CHECKPOINTED → COMPLETED/FAILED/SKIPPED/CANCELLED<br>• Audit tables for state transitions<br>• Checkpoint recovery support | Database schema exists (`agent_runs`)<br>**Gap**: Missing orchestrator tables |
| **Circuit Breaker Webhook** (system reminder) | Collaboration | Backpressure Management | • 3 states: CLOSED, OPEN, HALF_OPEN<br>• Activation at 95% utilization<br>• Redis deactivation queue<br>• Flask webhook for Prometheus alerts<br>• Graceful deactivation with delays | `NOT_IMPLEMENTED`<br>**Gap**: No circuit breaker |
| **Collaboration Billing Semantics** (system reminder) | Collaboration | Credit Attribution | • **OWNER ALWAYS PAYS** (core invariant)<br>• Credit deduction happens when:<br>&nbsp;&nbsp;- Guests read presence<br>&nbsp;&nbsp;- Guests send operations<br>&nbsp;&nbsp;- Real-time updates broadcast<br>• Billing failure → workspace read-only | `NOT_IMPLEMENTED`<br>**Gap**: No collaboration billing |
| **Backpressure Monitoring** (system reminder) | Collaboration | Prometheus/Grafana | • Weighted backpressure: 30% WebSocket, 25% Redis, 25% OT queue, 20% memory<br>• 4 severity levels: NORMAL (<70%), ELEVATED (70-85%), HIGH (85-95%), CRITICAL (>95%)<br>• Recording rules for dashboard efficiency<br>• Alertmanager integration with PagerDuty | Prometheus/Grafana deployed<br>**Gap**: No backpressure metrics |
| **Phase 2B Implementation Plan** (system reminder) | Worker Infrastructure | Redis Queue & K8s Jobs | • Dual Redis clients: standard (worker) + upstash (API)<br>• Job queue with retry/DLQ logic<br>• S3 workspace for persistent files<br>• K8s job spawning for shell/code tools<br>• Redis pub/sub for real-time logs | Partial: Redis exists, E2B sandbox exists<br>**Gap**: No job queue, no S3 workspace |

---

## Golden Invariants

These are **CRITICAL** system invariants that **MUST ALWAYS HOLD**. Violating these invariants causes system corruption, billing fraud, or security breaches.

### Billing & Credits

1. **Owner ALWAYS Pays (Collaboration)**
   ```
   IF workspace.is_collaboration_enabled:
       THEN credit_attribution = workspace.owner_user_id
       NEVER guest_user_id
   ```
   **Why Critical**: Prevents billing fraud. Guests must never be charged for operations in shared workspaces.

2. **Idempotent Token Billing**
   ```
   record_token_call(idempotency_key, model, tokens):
       IF EXISTS(call WHERE idempotency_key = key):
           RETURN existing_record
       ELSE:
           INSERT AND RETURN new_record
   ```
   **Why Critical**: Prevents double-billing on retries. Each LLM call is billed exactly once.

3. **Token Count Validation (Before AND After)**
   ```
   BEFORE_LLM_CALL:
       estimated_tokens = count_tokens(messages, model)
       IF estimated_tokens > user.quota:
           REJECT "Insufficient credits"

   AFTER_LLM_RESPONSE:
       actual_tokens = response.usage.total_tokens
       record_token_call(idempotency_key, actual_tokens)
   ```
   **Why Critical**: Prevents over-billing (using estimates only) and under-billing (trusting pre-flight checks only).

4. **Billing Failure → Read-Only Mode**
   ```
   IF billing.deduct_credits() FAILS:
       workspace.set_mode(READ_ONLY)
       REJECT all write operations until billing succeeds
   ```
   **Why Critical**: Prevents unpaid work. System must not perform billable actions without successful payment.

### Orchestration & State Management

5. **Fencing Tokens Prevent Stale Writes**
   ```
   update_run(run_id, state_version, updates):
       UPDATE research_runs
       SET state = updates.state, state_version = state_version + 1
       WHERE id = run_id AND state_version = state_version

       IF rows_affected = 0:
           RAISE ConcurrencyError("Stale write detected")
   ```
   **Why Critical**: Prevents lost updates from concurrent workers. Uses optimistic locking with version numbers.

6. **State Transitions Are Validated**
   ```
   RUN_TRANSITIONS = {
       CREATED: {VALIDATING, CANCELLED},
       VALIDATING: {DECOMPOSING, FAILED, CANCELLED},
       DECOMPOSING: {SCHEDULING, FAILED, CANCELLED},
       # ... etc
   }

   transition_run_state(run, new_state):
       IF new_state NOT IN RUN_TRANSITIONS[run.state]:
           RAISE InvalidTransitionError
   ```
   **Why Critical**: Prevents invalid state combinations that could cause undefined behavior.

7. **Subtasks Respect Dependencies**
   ```
   is_subtask_ready(subtask, completed_subtask_ids):
       RETURN all(dep_id IN completed_subtask_ids FOR dep_id IN subtask.depends_on)
   ```
   **Why Critical**: Prevents execution of subtasks before their dependencies complete, which would cause invalid results.

8. **Exactly-Once Execution via Idempotency Keys**
   ```
   enqueue_subtask(run_id, subtask_index):
       idempotency_key = f"{run_id}:subtask:{subtask_index}"

       IF EXISTS(job WHERE idempotency_key = key):
           RETURN existing_job_id
       ELSE:
           INSERT job AND RETURN new_job_id
   ```
   **Why Critical**: Prevents duplicate work. Each subtask executes exactly once even if enqueued multiple times.

### Template System & Security

9. **Template Validation Before Execution**
   ```
   validate_template(template):
       1. Structure validation (required files exist)
       2. Security scanning (no eval(), no secrets)
       3. Dependency auditing (no CVEs)
       4. Code quality checks (ESLint, TypeScript)
       5. Metadata validation (template.json valid)
       6. Build verification (can install + build)

       IF any_stage_fails:
           REJECT template
   ```
   **Why Critical**: Prevents malicious code execution. Templates must be safe before users can instantiate them.

10. **Lockfile Integrity (SHA-512)**
    ```
    install_dependencies(lockfile):
        FOR EACH dependency IN lockfile:
            downloaded_hash = sha512(downloaded_package)
            IF downloaded_hash != lockfile.integrity_hash:
                RAISE SecurityError("Package tampered")
    ```
    **Why Critical**: Prevents supply chain attacks. Ensures downloaded packages match what was tested during validation.

### Collaboration & Real-Time

11. **Circuit Breaker Activates at 95% Capacity**
    ```
    backpressure_level = (
        0.30 * (websocket_connections / max_connections) +
        0.25 * (redis_channels / max_channels) +
        0.25 * (ot_queue_depth / ot_queue_capacity) +
        0.20 * (memory_used / memory_limit)
    )

    IF backpressure_level > 0.95:
        circuit_breaker.activate()
        REJECT new connections
        DROP low-priority operations
    ```
    **Why Critical**: Prevents cascading failure. System must shed load before reaching 100% capacity.

12. **Operational Transformation Preserves Convergence**
    ```
    apply_operation(doc, op, concurrent_ops):
        transformed_op = transform(op, concurrent_ops)
        new_doc_state = apply(doc, transformed_op)

        INVARIANT: Eventually all clients converge to same document state
    ```
    **Why Critical**: Prevents divergent document states in real-time collaboration.

---

## Doc Conflicts & Ambiguities

### 1. Token Counting Strategy Inconsistency

**Conflict**:
- TOKEN_COUNTING.md specifies: "Always count before AND after sending"
- Phase 2B Plan specifies: "Token counting happens after LLM response only"

**Location**:
- TOKEN_COUNTING.md: lines 45-67
- Phase 2B Plan: Redis queue section

**Impact**: **HIGH** - Affects billing accuracy

**Resolution Needed**:
Should we:
- **Option A**: Count twice (before for validation, after for billing) → More accurate, higher cost
- **Option B**: Count once (after only, rely on quota pre-check) → Simpler, risk of over-quota execution
- **Recommended**: Option A - Manus.im likely uses double counting for accuracy

---

### 2. Template Validation Stage Count Mismatch

**Conflict**:
- TEMPLATE_VALIDATION.md: Lists **6 validation stages**
- TEMPLATE_DEPENDENCIES.md: References **8 validation stages** (includes 2 additional dependency-specific stages)

**Location**:
- TEMPLATE_VALIDATION.md: lines 18-29
- TEMPLATE_DEPENDENCIES.md: lines 156-178

**Impact**: **MEDIUM** - Affects validation completeness

**Resolution Needed**:
Are dependency auditing stages part of the 6 stages or additional? Need to clarify canonical stage list.

---

### 3. State Machine Transition Ambiguity

**Conflict**:
- Failure & Retry Semantics.md defines state transitions for ResearchRun
- Existing `agent_runs` table in database has different state names: "created", "validating", "planning", "executing", "completed", "failed", "cancelled"

**Location**:
- Failure & Retry Semantics.md: lines 134-147
- Database: `agent_runs.status` column (see `app/db/schema.sql`)

**Impact**: **CRITICAL** - Breaking change to existing schema

**Resolution Needed**:
Migration strategy required:
- **Option A**: Add all new states as separate migration
- **Option B**: Map existing states to new states (e.g., "planning" → "decomposing")
- **Recommended**: Option B with backward compatibility flag

---

### 4. Orchestrator vs Existing Agent Execution

**Ambiguity**:
- Failure & Retry Semantics.md describes a full orchestrator with subtask decomposition
- Existing `app/agent/supervisor.py` has a different execution model (planning → tool execution → completion)

**Location**:
- Failure & Retry Semantics.md: Complete orchestrator specification
- `app/agent/supervisor.py`: Existing agent implementation

**Impact**: **CRITICAL** - Requires architectural decision

**Resolution Needed**:
Are we:
- **Option A**: Replacing existing agent with orchestrator (breaking change)
- **Option B**: Running orchestrator alongside existing agent (dual system)
- **Option C**: Migrating incrementally (feature flag)
- **Recommended**: Option C - Feature flag `use_orchestrator` to gradually migrate

---

### 5. Redis Client Duality (Standard vs Upstash)

**Ambiguity**:
- Phase 2B Plan specifies using TWO different Redis clients:
  - `redis` (standard) for worker process
  - `upstash-redis` (HTTP-based) for API

**Location**:
- Phase 2B Plan: `app/redis/clients.py` section

**Impact**: **MEDIUM** - Affects Redis connection architecture

**Resolution Needed**:
Why two clients?
- Upstash is serverless-optimized (HTTP-based, no persistent connections)
- Standard Redis is faster for long-lived worker processes
- **Clarification needed**: Is API deployed to serverless environment (e.g., Vercel, Cloudflare Workers)?

---

### 6. Template Marketplace Undefined Revenue Flow

**Ambiguity**:
- CUSTOM_TEMPLATES_MARKETPLACE.md specifies 70/30 revenue split
- No specification for:
  - Payment gateway integration (Stripe Connect? PayPal?)
  - Payout schedule (monthly? threshold-based?)
  - Tax handling (1099-K forms? VAT?)
  - Refund policy

**Location**:
- CUSTOM_TEMPLATES_MARKETPLACE.md: lines 189-216

**Impact**: **MEDIUM** - Affects marketplace launch

**Resolution Needed**:
Need separate specification for marketplace financial operations.

---

## Do Not Build Until Answered

Critical questions that **MUST** be resolved before implementation begins. Building without answers will result in rework.

### Orchestration & Execution

#### Q1: Orchestrator Replacement or Coexistence?

**Question**: Does the new orchestrator system (Failure & Retry Semantics) **replace** or **coexist** with the existing agent execution system (`app/agent/supervisor.py`)?

**Impact**: **CRITICAL** - Affects entire agent architecture

**Options**:
- **A) Full replacement**: Delete existing agent, implement orchestrator from scratch
- **B) Coexistence**: Run both systems, route based on feature flag
- **C) Incremental migration**: Gradually move functionality from old to new

**Needs Decision From**: Product/Engineering leadership

**Blocks**:
- PR1: Orchestration primitives
- Database migrations
- API route changes

---

#### Q2: Subtask Execution Environment?

**Question**: Where do subtasks execute?

**Current Understanding**:
- Phase 2B Plan mentions "K8s job spawning for shell/code tools"
- Existing code uses E2B sandbox for code execution
- Unclear if:
  - All subtasks run in K8s jobs?
  - Only shell/code tools run in K8s?
  - Research subtasks run in main worker process?

**Impact**: **HIGH** - Affects worker infrastructure design

**Needs Decision From**: Infrastructure team

**Blocks**:
- K8s job manifest design
- S3 workspace mounting strategy
- Resource quotas

---

#### Q3: Multi-Tenancy Isolation Level?

**Question**: What level of isolation is required for multi-tenancy?

**Options**:
- **A) Logical isolation**: Single database/Redis/S3, filter by tenant_id (current implementation)
- **B) Physical isolation**: Separate databases/Redis/S3 per tenant
- **C) Hybrid**: Shared infra for most, dedicated for enterprise tier

**Impact**: **MEDIUM** - Affects database schema and queries

**Needs Decision From**: Security/Compliance team

**Blocks**:
- Database schema design
- Row-level security policies
- Backup/restore strategies

---

### Billing & Credits

#### Q4: Token Counting Strategy?

**Question**: Count tokens before AND after LLM call, or only after?

**Conflict**: See "Doc Conflicts #1"

**Impact**: **HIGH** - Affects billing accuracy and system complexity

**Options**:
- **A) Double counting**: Before (validation) + After (billing)
  - **Pros**: Accurate, prevents over-quota execution
  - **Cons**: Higher cost (count twice), latency (tokenizer adds ~10-50ms)
- **B) Single counting**: After only, rely on quota buffer
  - **Pros**: Simpler, faster
  - **Cons**: Risk of over-quota execution, less accurate estimates

**Needs Decision From**: Finance/Product

**Blocks**:
- Token counting service implementation
- Billing ledger schema
- API quota enforcement

---

#### Q5: Credit Reconciliation Frequency?

**Question**: How often do we reconcile token usage with billing ledger?

**Options**:
- **A) Real-time**: Every LLM call updates ledger immediately
- **B) Batched**: Accumulate in Redis, flush to DB every N seconds
- **C) Deferred**: Record in local log, reconcile hourly/daily

**Impact**: **MEDIUM** - Affects database load and billing accuracy

**Needs Decision From**: Engineering/Finance

**Blocks**:
- Ledger write performance optimization
- Credit deduction logic
- Billing failure handling

---

### Template System

#### Q6: Template Validation Execution Environment?

**Question**: Where does template validation run?

**Security Concern**: Templates contain arbitrary code. Running validation in main cluster is dangerous.

**Options**:
- **A) Isolated K8s jobs**: Spawn ephemeral pod per validation
  - **Pros**: Complete isolation, resource limits
  - **Cons**: Slower (pod startup ~10-30s), higher cost
- **B) Sandboxed containers**: Gvisor/Firecracker in main cluster
  - **Pros**: Faster (~1-5s), lower cost
  - **Cons**: Complex setup, potential escape risks
- **C) External service**: Send to third-party (e.g., GitHub Actions, CircleCI)
  - **Pros**: No infra management
  - **Cons**: Latency, dependency on external service

**Impact**: **HIGH** - Affects validation pipeline design

**Needs Decision From**: Security/Infrastructure

**Blocks**:
- Validation pipeline implementation
- Resource quota planning
- Security hardening

---

#### Q7: Template Marketplace Payment Integration?

**Question**: Which payment gateway for marketplace?

**Options**:
- **A) Stripe Connect**: Industry standard for marketplaces
  - **Pros**: Handles payouts, tax forms, fraud detection
  - **Cons**: 2.9% + $0.30 per transaction + 0.25% for Connect
- **B) PayPal Commerce**: Alternative with lower fees
  - **Pros**: Lower fees, global coverage
  - **Cons**: Less developer-friendly, more disputes
- **C) Crypto (USDC)**: No middleman
  - **Pros**: Instant settlement, low fees
  - **Cons**: Regulatory uncertainty, limited adoption

**Impact**: **MEDIUM** - Affects marketplace launch timeline

**Needs Decision From**: Finance/Legal

**Blocks**:
- Marketplace financial operations
- Payout scheduling
- Tax handling

---

### Collaboration

#### Q8: Collaboration Billing Credit Model?

**Question**: How are credits calculated for collaboration operations?

**Current Understanding**: "Owner ALWAYS pays", but:
- How much does guest **presence** cost? (per minute? per update?)
- How much does guest **operation** cost? (per character? per OT op?)
- How much does **broadcasting** cost? (per message? per user?)

**Impact**: **HIGH** - Affects collaboration pricing

**Needs Decision From**: Product/Finance

**Blocks**:
- Collaboration billing implementation
- Credit deduction logic
- Pricing page updates

---

#### Q9: Circuit Breaker Deactivation Criteria?

**Question**: When does circuit breaker deactivate?

**Current Spec**: "Deactivate after backpressure drops below 90% for 2 minutes"

**Unclear**:
- What if backpressure oscillates around 90%?
- Do we require **sustained** low backpressure, or just any reading below 90%?
- What about hysteresis? (e.g., activate at 95%, don't deactivate until 85%)

**Impact**: **MEDIUM** - Affects circuit breaker stability

**Needs Decision From**: Engineering/SRE

**Blocks**:
- Circuit breaker implementation
- Deactivation scheduling logic

---

### Infrastructure

#### Q10: S3 Workspace Storage Provider?

**Question**: Which S3-compatible provider for workspace storage?

**Phase 2B mentions**: "Exoscale S3-compatible storage (Geneva)"

**Considerations**:
- **Exoscale**: Swiss-based, GDPR-compliant, good for EU customers
- **AWS S3**: Most reliable, global, higher cost
- **Cloudflare R2**: Zero egress fees, fast, newer
- **Backblaze B2**: Cheapest, slower

**Impact**: **MEDIUM** - Affects storage costs and latency

**Needs Decision From**: Infrastructure/Finance

**Blocks**:
- S3 workspace implementation
- Backup/restore strategies
- Cost projections

---

## Build Order Dependency Graph

This graph shows the **correct order** to implement systems. Dependencies flow **top-to-bottom** (build top items first).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BUILD ORDER DEPENDENCY GRAPH                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│ PHASE 0: FOUNDATION (must build first)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Database Migrations                                                       │ │
│ │    - Add orchestrator tables (research_runs, subtasks, state_transitions)   │ │
│ │    - Add billing tables (token_ledger, credit_transactions)                 │ │
│ │    - Add collaboration tables (workspace_members, ot_operations)            │ │
│ │    - Add template tables (templates, template_versions, validations)        │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 2. Redis Queue Infrastructure                                                │ │
│ │    - Dual Redis clients (standard + upstash)                                │ │
│ │    - Job queue with retry/DLQ logic                                         │ │
│ │    - Redis pub/sub for real-time logs                                       │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 3. S3 Workspace Storage                                                      │ │
│ │    - S3 client setup (Exoscale/AWS/Cloudflare R2)                           │ │
│ │    - Workspace read/write/list operations                                   │ │
│ │    - Workspace sync (upload/download for K8s jobs)                          │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 1: TOKEN COUNTING & BILLING (critical for revenue)                        │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 4. Token Counting Service                                                    │ │
│ │    - Multi-provider tokenizers (OpenAI, Anthropic, Google)                  │ │
│ │    - js-tiktoken for JS/TS                                                   │ │
│ │    - Token caching (Memory → Redis → DB)                                    │ │
│ │    - Count before AND after LLM calls                                       │ │
│ │                                                                              │ │
│ │    Dependencies: None (can build immediately)                                │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 5. Billing Ledger                                                            │ │
│ │    - Idempotent record_token_call()                                          │ │
│ │    - Credit deduction logic                                                  │ │
│ │    - Billing failure → workspace read-only                                   │ │
│ │    - Credit reconciliation (real-time vs batched)                            │ │
│ │                                                                              │ │
│ │    Dependencies: Token Counting Service (#4)                                 │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 2: ORCHESTRATOR (enables parallel execution)                              │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 6. Orchestrator Core                                                         │ │
│ │    - Run state machine (10 states)                                           │ │
│ │    - Fencing tokens + optimistic locking                                     │ │
│ │    - Event bus for state changes                                             │ │
│ │    - Background monitors (progress, deadlines, stalled runs)                 │ │
│ │                                                                              │ │
│ │    Dependencies: Database migrations (#1), Redis queue (#2)                  │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 7. Task Decomposer                                                           │ │
│ │    - LLM-powered query analysis                                              │ │
│ │    - 4 decomposition strategies                                              │ │
│ │    - Dependency graph building                                               │ │
│ │    - Resource estimation                                                     │ │
│ │                                                                              │ │
│ │    Dependencies: Orchestrator Core (#6), Token Counting (#4)                 │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 8. Subtask Scheduler                                                         │ │
│ │    - Fair scheduling with tenant quotas                                      │ │
│ │    - Priority calculation                                                    │ │
│ │    - Queue mapping by task type                                              │ │
│ │    - Worker affinity for checkpointing                                       │ │
│ │                                                                              │ │
│ │    Dependencies: Orchestrator Core (#6), Task Decomposer (#7)                │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 9. Worker Process                                                            │ │
│ │    - Job queue consumer (BRPOP)                                              │ │
│ │    - Subtask execution                                                       │ │
│ │    - Checkpoint creation                                                     │ │
│ │    - Heartbeat updates                                                       │ │
│ │    - Error handling + retry                                                  │ │
│ │                                                                              │ │
│ │    Dependencies: Subtask Scheduler (#8), Redis queue (#2), S3 workspace (#3)│ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 10. K8s Job Spawning                                                         │ │
│ │     - K8s client setup                                                       │ │
│ │     - Job manifest generation                                                │ │
│ │     - S3 workspace mounting                                                  │ │
│ │     - Log streaming                                                          │ │
│ │     - Resource cleanup                                                       │ │
│ │                                                                              │ │
│ │     Dependencies: Worker Process (#9), S3 workspace (#3)                     │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 3: COLLABORATION (high complexity, high value)                            │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 11. OT Engine                                                                │ │
│ │     - Operational Transformation core                                        │ │
│ │     - Operation conflict resolution                                          │ │
│ │     - Document state convergence                                             │ │
│ │     - Operation history tracking                                             │ │
│ │                                                                              │ │
│ │     Dependencies: Database migrations (#1)                                   │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 12. WebSocket Gateway                                                        │ │
│ │     - WebSocket server (Hocuspocus)                                          │ │
│ │     - Presence tracking (awareness protocol)                                 │ │
│ │     - Remote cursor rendering                                                │ │
│ │     - Redis pub/sub for multi-pod sync                                       │ │
│ │                                                                              │ │
│ │     Dependencies: OT Engine (#11), Redis queue (#2)                          │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 13. Circuit Breaker                                                          │ │
│ │     - Backpressure monitoring (95% threshold)                                │ │
│ │     - WebSocket connection rejection                                         │ │
│ │     - Operation dropping (low-priority)                                      │ │
│ │     - Flask webhook for Prometheus                                           │ │
│ │     - Graceful deactivation                                                  │ │
│ │                                                                              │ │
│ │     Dependencies: WebSocket Gateway (#12), Prometheus/Grafana (Phase 9)     │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 14. Collaboration Billing                                                    │ │
│ │     - Owner ALWAYS pays enforcement                                          │ │
│ │     - Credit deduction for presence/operations                               │ │
│ │     - Billing failure → read-only mode                                       │ │
│ │     - Retry with exponential backoff                                         │ │
│ │                                                                              │ │
│ │     Dependencies: Circuit Breaker (#13), Billing Ledger (#5)                 │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 4: TEMPLATE SYSTEM (marketplace enabler)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 15. Template Validation Pipeline                                             │ │
│ │     - 6-stage validation                                                     │ │
│ │     - Security scanning (eval, secrets, CVEs)                                │ │
│ │     - Isolated execution environment                                         │ │
│ │     - Build verification                                                     │ │
│ │                                                                              │ │
│ │     Dependencies: K8s job spawning (#10) for isolated execution             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 16. Template Registry                                                        │ │
│ │     - Official template URLs                                                 │ │
│ │     - Community template submission                                          │ │
│ │     - Version resolution (latest/next/exact)                                 │ │
│ │     - CDN-backed template serving                                            │ │
│ │                                                                              │ │
│ │     Dependencies: Template Validation (#15)                                  │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 17. Template Marketplace                                                     │ │
│ │     - 70/30 revenue split                                                    │ │
│ │     - Payment gateway (Stripe Connect?)                                      │ │
│ │     - Payout scheduling                                                      │ │
│ │     - Tax handling (1099-K forms)                                            │ │
│ │                                                                              │ │
│ │     Dependencies: Template Registry (#16), Billing Ledger (#5)               │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 18. Template SDK & CLI                                                       │ │
│ │     - Template scaffolding                                                   │ │
│ │     - Local validation                                                       │ │
│ │     - Submission workflow                                                    │ │
│ │     - Version management                                                     │ │
│ │                                                                              │ │
│ │     Dependencies: Template Marketplace (#17)                                 │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 5: MONITORING & ALERTING (operational maturity)                           │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 19. Prometheus Alert Rules                                                   │ │
│ │     - Backpressure alerts (NORMAL/ELEVATED/HIGH/CRITICAL)                    │ │
│ │     - SLA breach alerts                                                      │ │
│ │     - Error budget tracking                                                  │ │
│ │     - Recording rules for efficiency                                         │ │
│ │                                                                              │ │
│ │     Dependencies: Prometheus/Grafana (Phase 9 - already deployed)           │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                  ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 20. Alertmanager Configuration                                               │ │
│ │     - 4-level escalation (Primary → Secondary → Team Lead → CTO)            │ │
│ │     - PagerDuty integration                                                  │ │
│ │     - Slack notifications                                                    │ │
│ │     - Notification templates                                                 │ │
│ │                                                                              │ │
│ │     Dependencies: Prometheus Alert Rules (#19)                               │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ PHASE 6: EMAIL & EXTERNAL INTEGRATIONS (deferred - lower priority)             │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 21. Email Ingestion Pipeline                                                 │ │
│ │     - Postfix MTA → Milter filter → Worker queue                            │ │
│ │     - SPF/DKIM/DMARC validation                                              │ │
│ │     - Malware scanning                                                       │ │
│ │     - Identity resolution (email → user)                                     │ │
│ │                                                                              │ │
│ │     Dependencies: Worker Process (#9), Redis queue (#2)                      │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘

Legend:
  ┌────┐
  │    │ = System component
  └────┘

  ↓ = Dependency (must build parent before child)
```

---

## Top 10 Highest-Risk Enterprise Gaps

These gaps represent the **biggest threats** to Manus-level parity. Ranked by **risk score** = `(business_impact × technical_complexity × blocking_factor)`.

### 1. ⚠️ **Token Counting & Billing** (Risk: 🔴 CRITICAL)

**Gap**: No token counting infrastructure exists. No billing ledger. No credit deduction.

**Business Impact**: **10/10**
Without accurate billing, we cannot charge customers correctly. This is an **immediate revenue risk**.

**Technical Complexity**: **7/10**
- Multi-provider tokenizers (OpenAI, Anthropic, Google)
- Token caching hierarchy (Memory → Redis → DB)
- Idempotent ledger writes
- Credit deduction with rollback on failure

**Blocking Factor**: **10/10**
**BLOCKS**: All billable features (orchestrator, collaboration, email ingestion, presentation generation)

**Evidence**:
- TOKEN_COUNTING.md: 1,184 lines of specification
- No `token_ledger` table in database
- No tokenizer clients in codebase (grep shows zero matches for "tiktoken" or "anthropic tokenizer")

**Recommendation**: **⚡ IMPLEMENT IMMEDIATELY (PR1)**

**Implementation Plan**:
1. **Week 1**: Token counting service
   - Install `tiktoken` (Python), `js-tiktoken` (TS)
   - Implement count_before() and count_after()
   - Add token caching (Redis)
2. **Week 2**: Billing ledger
   - Create `token_ledger` table
   - Implement idempotent `record_token_call()`
   - Add credit deduction logic
3. **Week 3**: Integration
   - Update all LLM call sites to use token counting
   - Add billing failure → read-only mode
   - Test reconciliation

**Estimated Time**: 3 weeks
**Risk if Deferred**: Revenue loss, billing disputes, unpaid LLM usage

---

### 2. ⚠️ **Orchestrator Missing** (Risk: 🔴 CRITICAL)

**Gap**: No orchestrator system. Current agent execution is single-threaded, cannot decompose queries into parallel subtasks.

**Business Impact**: **9/10**
Limits product to simple, sequential tasks. Cannot compete with Manus.im's parallel research execution.

**Technical Complexity**: **9/10**
- 10-state run state machine
- Task decomposition with LLM
- Subtask scheduling with dependencies
- Fencing tokens for concurrency safety
- Event bus for state changes
- Background monitors (3 concurrent loops)

**Blocking Factor**: **8/10**
**BLOCKS**: Wide research, presentation generation, data-to-insights pipeline

**Evidence**:
- Failure & Retry Semantics.md: 3,500+ lines of orchestrator specification
- Current `app/agent/supervisor.py`: Simple sequential execution (no decomposition)
- Database missing orchestrator tables: `research_runs`, `subtasks`, `state_transitions`

**Recommendation**: **⚡ IMPLEMENT IN PR1 (Foundation)**

**Implementation Plan**:
1. **Week 1**: Database schema
   - Create orchestrator tables
   - Add indexes for performance
   - Write migration scripts
2. **Week 2**: Core orchestrator
   - Implement run state machine
   - Add fencing token logic
   - Build event bus
3. **Week 3**: Task decomposer
   - LLM-powered query analysis
   - Decomposition strategies
   - Dependency graph building
4. **Week 4**: Subtask scheduler
   - Fair scheduling
   - Priority calculation
   - Queue mapping
5. **Week 5**: Worker process
   - Job queue consumer
   - Subtask execution
   - Checkpoint/recovery

**Estimated Time**: 5 weeks
**Risk if Deferred**: Product stuck at MVP level, cannot compete

---

### 3. ⚠️ **Real-Time Collaboration Missing** (Risk: 🟠 HIGH)

**Gap**: No collaboration features. No OT engine, no WebSocket gateway, no presence tracking.

**Business Impact**: **8/10**
Collaboration is a **key differentiator**. Without it, users cannot work together on research tasks.

**Technical Complexity**: **10/10**
- Operational Transformation (complex algorithm)
- WebSocket gateway with multi-pod sync
- Redis pub/sub for broadcasting
- Circuit breaker for backpressure
- Presence tracking (awareness protocol)
- Remote cursor rendering
- **OWNER ALWAYS PAYS** billing enforcement

**Blocking Factor**: **3/10**
**BLOCKS**: Nothing immediately (collaboration is standalone feature)

**Evidence**:
- Collaboration Billing Semantics: 2,000+ lines of specification
- Circuit Breaker: 1,900+ lines of production code
- Backpressure Monitoring: 1,140+ lines (PromQL, Grafana, Alertmanager)
- Zero collaboration code in codebase

**Recommendation**: **🔶 IMPLEMENT IN PR3 (After orchestrator + billing)**

**Implementation Plan**:
1. **Week 1-2**: OT engine
   - Operational Transformation core
   - Conflict resolution
   - Document convergence
2. **Week 3-4**: WebSocket gateway
   - Hocuspocus server
   - Presence tracking
   - Redis pub/sub sync
3. **Week 5**: Circuit breaker
   - Backpressure monitoring
   - Connection rejection
   - Operation dropping
4. **Week 6**: Collaboration billing
   - Owner pays enforcement
   - Credit deduction
   - Billing failure handling

**Estimated Time**: 6 weeks
**Risk if Deferred**: Missing key differentiator, lower market appeal

---

### 4. ⚠️ **Template System 80% Missing** (Risk: 🟠 HIGH)

**Gap**: Template infrastructure is incomplete. Missing: validation pipeline, marketplace, SDK, registry.

**Business Impact**: **7/10**
Templates enable rapid project creation. Marketplace enables creator economy. Without these, users have fewer projects and no monetization path.

**Technical Complexity**: **8/10**
- 6-stage validation pipeline
- Security scanning (malicious code, secrets, CVEs)
- Isolated execution environment (K8s jobs)
- Template registry with versioning
- Marketplace with payment gateway
- Template SDK & CLI

**Blocking Factor**: **4/10**
**BLOCKS**: Presentation generation (requires template system), marketplace launch

**Evidence**:
- 7 template specification documents (6,500+ lines total)
- Partial implementation: template.json parsing exists, but no validation or marketplace
- No template registry or CDN serving

**Recommendation**: **🔶 STUB WITH FEATURE FLAG (PR4)**

Create basic validation + registry in PR4, defer marketplace to later phase.

**Implementation Plan**:
1. **Week 1**: Validation pipeline (basic)
   - Structure validation
   - Security scanning (regex-based)
   - Build verification
2. **Week 2**: Template registry
   - Official template URLs
   - Version resolution
   - CDN serving (Cloudflare R2?)
3. **Week 3**: Community submission
   - Template upload
   - Async validation queue
   - Approval workflow
4. **Week 4-6**: Marketplace (DEFERRED)
   - Payment gateway (Stripe Connect)
   - 70/30 revenue split
   - Payout scheduling

**Estimated Time**: 3 weeks (basic), 6 weeks (full marketplace)
**Risk if Deferred**: Template quality issues, no marketplace revenue

---

### 5. ⚠️ **S3 Workspace Storage Missing** (Risk: 🟠 HIGH)

**Gap**: No persistent file storage. Agent file operations currently happen in-process or E2B sandbox, but no shared workspace.

**Business Impact**: **6/10**
Without workspace storage, users cannot save files across runs or share files in collaboration.

**Technical Complexity**: **4/10**
S3 integration is well-understood. Main work is:
- S3 client setup (boto3)
- Workspace read/write/list operations
- Workspace sync for K8s jobs (upload/download)
- Lifecycle policies (delete after 30 days?)

**Blocking Factor**: **9/10**
**BLOCKS**: Orchestrator K8s jobs (need workspace mounting), collaboration (shared files), presentation generation (asset storage)

**Evidence**:
- Phase 2B Plan: S3 workspace specification (500+ lines)
- No S3 client in codebase (grep shows no "boto3" or "s3_workspace")
- File operations currently in-memory only

**Recommendation**: **⚡ IMPLEMENT IN PR1 (Foundation)**

**Implementation Plan**:
1. **Week 1**: S3 client
   - Choose provider (Exoscale/AWS/Cloudflare R2)
   - Setup credentials + bucket
   - Implement read/write/list
2. **Week 2**: Workspace API
   - Create workspace on run creation
   - Implement sync (upload/download)
   - Add lifecycle policies
3. **Week 3**: Integration
   - Update tool implementations to use S3
   - Add workspace mounting to K8s jobs
   - Test large file handling

**Estimated Time**: 2 weeks
**Risk if Deferred**: Blocks orchestrator, collaboration, presentation gen

---

### 6. ⚠️ **Redis Job Queue Missing** (Risk: 🟠 HIGH)

**Gap**: Current agent execution uses FastAPI BackgroundTasks (in-process, not durable, not distributed).

**Business Impact**: **6/10**
Without durable job queue:
- Jobs lost on server restart
- No worker scaling (jobs tied to API process)
- No retry on failure
- No DLQ for dead jobs

**Technical Complexity**: **5/10**
- Dual Redis clients (standard + upstash)
- Job queue with LPUSH/BRPOP
- Retry logic with exponential backoff
- Dead letter queue (DLQ)
- Idempotency key deduplication

**Blocking Factor**: **9/10**
**BLOCKS**: Orchestrator, worker process, K8s job spawning

**Evidence**:
- Phase 2B Plan: Redis queue specification (800+ lines)
- Current code uses `background_tasks.add_task()` (see `app/routes/execute.py:45`)
- No Redis queue infrastructure exists

**Recommendation**: **⚡ IMPLEMENT IN PR1 (Foundation)**

**Implementation Plan**:
1. **Week 1**: Redis clients
   - Setup dual clients (standard + upstash)
   - Test connection pooling
   - Add health checks
2. **Week 2**: Job queue
   - Implement LPUSH/BRPOP pattern
   - Add retry queue
   - Add DLQ
3. **Week 3**: Integration
   - Replace BackgroundTasks with Redis enqueue
   - Update API routes
   - Test idempotency

**Estimated Time**: 2 weeks
**Risk if Deferred**: Blocks all async work, worker scaling impossible

---

### 7. ⚠️ **Prometheus Alert Rules Missing** (Risk: 🟡 MEDIUM)

**Gap**: Prometheus/Grafana deployed (Phase 9) but no alert rules configured. No escalation policies.

**Business Impact**: **5/10**
Without alerts, incidents go unnoticed until users complain. SLA breaches undetected.

**Technical Complexity**: **3/10**
- Write PromQL alert rules
- Configure Alertmanager routing
- Integrate PagerDuty/Slack
- Create dashboards

**Blocking Factor**: **2/10**
**BLOCKS**: Circuit breaker (needs backpressure alerts), production readiness

**Evidence**:
- INCIDENT_RESPONSE_SLA.md: 1,198 lines of alert specifications
- Backpressure Monitoring: 1,140 lines of PromQL queries + Grafana dashboards
- Prometheus deployed but `/etc/prometheus/rules/` directory empty

**Recommendation**: **🔶 IMPLEMENT IN PR4 (Monitoring)**

**Implementation Plan**:
1. **Week 1**: Alert rules
   - Backpressure alerts (CRITICAL/HIGH/ELEVATED/NORMAL)
   - SLA breach alerts
   - Error budget tracking
2. **Week 2**: Alertmanager
   - 4-level escalation
   - PagerDuty integration
   - Slack notifications
3. **Week 3**: Grafana dashboards
   - Backpressure dashboard
   - SLA dashboard
   - Error budget dashboard

**Estimated Time**: 2 weeks
**Risk if Deferred**: Incident response delayed, SLA breaches undetected

---

### 8. ⚠️ **Email Ingestion Missing** (Risk: 🟡 MEDIUM)

**Gap**: No "forward email to bot" workflow. Users cannot email tasks to the agent.

**Business Impact**: **4/10**
Email ingestion is a convenience feature, not core to product. But it's a **differentiator** vs competitors.

**Technical Complexity**: **7/10**
- Postfix MTA configuration
- Milter filter for malware scanning
- SPF/DKIM/DMARC validation
- Identity resolution (email → user)
- Task aliases (reply-to-task)

**Blocking Factor**: **1/10**
**BLOCKS**: Nothing (standalone feature)

**Evidence**:
- Email workflow specification in system reminder (1,500+ lines)
- Zero email infrastructure in codebase

**Recommendation**: **⏸️ DEFER TO PHASE 6 (Lower priority)**

Email ingestion is low priority compared to orchestrator, billing, and collaboration.

**Implementation Plan**:
1. **Week 1**: Postfix setup
2. **Week 2**: Milter filter
3. **Week 3**: Identity resolution
4. **Week 4**: Task aliases

**Estimated Time**: 4 weeks
**Risk if Deferred**: Low - this is a "nice to have" feature

---

### 9. ⚠️ **K8s Job Spawning Not Production-Ready** (Risk: 🟡 MEDIUM)

**Gap**: Phase 2B Plan includes K8s job spawning infrastructure, but it's **not yet implemented or tested**.

**Business Impact**: **6/10**
Without K8s job spawning, tool execution happens in main worker process (security risk, resource contention).

**Technical Complexity**: **6/10**
- K8s client setup
- Job manifest generation
- S3 workspace mounting (initContainer for download)
- Log streaming from pod
- Resource cleanup (TTL)

**Blocking Factor**: **5/10**
**BLOCKS**: Shell tool, code tool, browser automation tool (all need isolated execution)

**Evidence**:
- Phase 2B Plan: K8s executor specification (600+ lines)
- Partial implementation exists in `app/k8s/executor.py` but not tested or used

**Recommendation**: **🔶 IMPLEMENT IN PR2 (After orchestrator foundation)**

**Implementation Plan**:
1. **Week 1**: K8s client
   - Setup in-cluster config
   - Test job creation
2. **Week 2**: Job executor
   - Generate job manifest
   - Mount S3 workspace
   - Stream logs
3. **Week 3**: Integration
   - Update shell_tool to use K8s executor
   - Update code_tool to use K8s executor
   - Test resource cleanup

**Estimated Time**: 3 weeks
**Risk if Deferred**: Security risk (untrusted code in main process), resource contention

---

### 10. ⚠️ **Presentation Generation Missing** (Risk: 🟢 LOW)

**Gap**: No presentation generation pipeline. Users cannot generate slides/presentations from research.

**Business Impact**: **5/10**
Presentation generation is a **value-add feature** but not core to product. Users can manually create presentations.

**Technical Complexity**: **8/10**
- Research → outline → slide plan → design → visuals → speaker notes → export
- Template system integration
- Asset generation (charts, images)
- Deterministic naming (no "Untitled_1" garbage)
- Export to PPTX/PDF/Reveal.js

**Blocking Factor**: **1/10**
**BLOCKS**: Nothing (standalone feature)

**Evidence**:
- Presentation generation specification in system reminder (1,200+ lines)
- Zero implementation exists

**Recommendation**: **⏸️ DEFER TO PHASE 7 (Lower priority)**

Focus on core research capabilities first (orchestrator, billing, collaboration). Add presentation gen later as value-add.

**Implementation Plan**:
1. **Week 1-2**: Outline generation
2. **Week 3-4**: Slide design
3. **Week 5-6**: Asset generation
4. **Week 7**: Export formats

**Estimated Time**: 7 weeks
**Risk if Deferred**: Low - users can manually create presentations

---

## Summary Statistics

**Total Documents Scanned**: 14 major specifications
**Total Lines**: ~15,000+ lines of specifications
**Total Systems**: 6 major systems (Orchestration, Billing, Collaboration, Templates, Monitoring, Email)
**Total Subsystems**: 21 subsystems
**Golden Invariants**: 12 critical invariants
**Doc Conflicts**: 6 conflicts identified
**Questions Requiring Resolution**: 10 critical questions
**Build Dependencies**: 21 components in dependency graph
**Enterprise Gaps**: 10 high-risk gaps identified

---

## Recommended Build Order (PR Sequence)

Based on the dependency graph and risk analysis:

### PR1: Foundation (Weeks 1-3)
- Database migrations (orchestrator, billing, collaboration, template tables)
- Redis queue infrastructure
- S3 workspace storage
- Token counting service
- Billing ledger

**Justification**: These are **foundational** and **block everything else**.

---

### PR2: Orchestrator Core (Weeks 4-8)
- Orchestrator state machine
- Task decomposer
- Subtask scheduler
- Worker process
- K8s job spawning

**Justification**: **Highest business value**. Enables parallel execution, differentiates from competitors.

---

### PR3: Collaboration (Weeks 9-14)
- OT engine
- WebSocket gateway
- Circuit breaker
- Collaboration billing

**Justification**: **Key differentiator**. High complexity, but high value.

---

### PR4: Template System Basics (Weeks 15-17)
- Template validation pipeline (basic)
- Template registry
- Community submission

**Justification**: Enables presentation generation and improves template quality.

---

### PR5: Monitoring & Alerting (Weeks 18-19)
- Prometheus alert rules
- Alertmanager configuration
- Grafana dashboards

**Justification**: Production readiness. Required before scaling.

---

### PR6: Template Marketplace (Weeks 20-25) - OPTIONAL
- Payment gateway (Stripe Connect)
- 70/30 revenue split
- Payout scheduling

**Justification**: Enables creator economy, new revenue stream. Can be deferred if resources constrained.

---

### PR7: Email Ingestion (Weeks 26-29) - OPTIONAL
- Postfix MTA
- Milter filter
- Identity resolution
- Task aliases

**Justification**: Convenience feature, not critical. Can be deferred.

---

### PR8: Presentation Generation (Weeks 30-36) - OPTIONAL
- Research → outline → slides
- Template integration
- Asset generation
- Export formats

**Justification**: Value-add feature, not core. Can be deferred.

---

## Next Steps

1. **Review this Intel Index** with product/engineering leadership
2. **Resolve "Do Not Build Until Answered" questions** (10 critical questions)
3. **Create PARITY_DELTA.md** to map existing codebase against these specifications
4. **Begin PR1 implementation** (Foundation: Database, Redis, S3, Token Counting, Billing)

---

**Document Created**: 2026-01-15
**Last Updated**: 2026-01-15
**Status**: Complete - Ready for Review
**Total Lines**: 1,200+ lines

---

*End of Intelligence Index*
