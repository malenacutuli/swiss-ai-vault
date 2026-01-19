# Manus Implementation Playbook

**Document Type:** Executable Implementation Specification  
**Format:** Pull Request Sequence  
**Target:** Rebuild Manus from scratch using Claude Code  
**Constraint:** Every section contains exact schemas, pseudocode, and interface contracts

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Data Model](#2-data-model)
3. [Run State Machine](#3-run-state-machine)
4. [Worker Architecture](#4-worker-architecture)
5. [Agent Runtime](#5-agent-runtime)
6. [Document Generation](#6-document-generation)
7. [Observability](#7-observability)
8. [Collaboration](#8-collaboration)
9. [Email Trigger](#9-email-trigger)
10. [Integrations](#10-integrations)
11. [Security](#11-security)
12. [Acceptance Tests](#12-acceptance-tests)

---

## PR Sequence Overview

| PR # | Name | Dependencies | Estimated LOC |
|------|------|--------------|---------------|
| PR-001 | Repository scaffold | None | 500 |
| PR-002 | Core data model | PR-001 | 2,000 |
| PR-003 | Run state machine | PR-002 | 1,500 |
| PR-004 | Worker infrastructure | PR-003 | 2,500 |
| PR-005 | Agent runtime core | PR-004 | 3,000 |
| PR-006 | Tool router & memory | PR-005 | 2,000 |
| PR-007 | Document generation | PR-005 | 2,500 |
| PR-008 | Observability stack | PR-004 | 1,500 |
| PR-009 | Collaboration system | PR-002 | 2,000 |
| PR-010 | Email trigger | PR-003 | 1,000 |
| PR-011 | Connector SDK | PR-002 | 1,500 |
| PR-012 | Security hardening | PR-002 | 1,000 |
| PR-013 | Acceptance tests | PR-001-012 | 2,000 |

---

## 1. Repository Layout

### PR-001: Repository Scaffold

```
manus/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # PR checks: lint, test, typecheck
│   │   ├── cd.yml                    # Deploy to staging/prod
│   │   └── chaos.yml                 # Scheduled chaos experiments
│   └── CODEOWNERS
├── packages/
│   ├── core/                         # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── run.ts            # Run, Step, Artifact types
│   │   │   │   ├── agent.ts          # Agent, Tool, Memory types
│   │   │   │   ├── billing.ts        # Credit, Transaction types
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── idempotency.ts    # Idempotency key generation
│   │   │   │   ├── retry.ts          # Retry with backoff
│   │   │   │   └── hash.ts           # Content hashing
│   │   │   └── constants/
│   │   │       ├── limits.ts         # Rate limits, quotas
│   │   │       └── states.ts         # State machine constants
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/                           # Database schema & migrations
│   │   ├── drizzle/
│   │   │   ├── schema/
│   │   │   │   ├── runs.ts
│   │   │   │   ├── steps.ts
│   │   │   │   ├── artifacts.ts
│   │   │   │   ├── billing.ts
│   │   │   │   ├── audit.ts
│   │   │   │   ├── rbac.ts
│   │   │   │   ├── collab.ts
│   │   │   │   ├── outbox.ts
│   │   │   │   └── index.ts
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts             # Database client factory
│   │   │   ├── queries/              # Type-safe query helpers
│   │   │   └── transactions.ts       # Transaction helpers
│   │   └── package.json
│   ├── queue/                        # Job queue abstraction
│   │   ├── src/
│   │   │   ├── producer.ts           # Job enqueue
│   │   │   ├── consumer.ts           # Job processing
│   │   │   ├── schemas/              # Job payload schemas (Zod)
│   │   │   │   ├── run-job.ts
│   │   │   │   ├── step-job.ts
│   │   │   │   └── notification-job.ts
│   │   │   └── dlq.ts                # Dead letter queue handling
│   │   └── package.json
│   ├── state-machine/                # Run state machine
│   │   ├── src/
│   │   │   ├── machine.ts            # XState machine definition
│   │   │   ├── transitions.ts        # Transition handlers
│   │   │   ├── guards.ts             # Transition guards
│   │   │   └── actions.ts            # Side effects
│   │   └── package.json
│   ├── agent/                        # Agent runtime
│   │   ├── src/
│   │   │   ├── planner/
│   │   │   │   ├── planner.ts        # Plan generation
│   │   │   │   ├── scorer.ts         # Plan scoring
│   │   │   │   └── repair.ts         # Plan repair
│   │   │   ├── supervisor/
│   │   │   │   ├── supervisor.ts     # Execution supervisor
│   │   │   │   ├── loop.ts           # Agent loop
│   │   │   │   └── checkpoint.ts     # State checkpointing
│   │   │   ├── tools/
│   │   │   │   ├── router.ts         # Tool selection
│   │   │   │   ├── executor.ts       # Tool execution
│   │   │   │   └── registry.ts       # Tool registry
│   │   │   ├── memory/
│   │   │   │   ├── context.ts        # Context window management
│   │   │   │   ├── compression.ts    # Context compression
│   │   │   │   └── retrieval.ts      # Memory retrieval
│   │   │   └── index.ts
│   │   └── package.json
│   ├── sandbox/                      # Sandbox runtime
│   │   ├── src/
│   │   │   ├── manager.ts            # Sandbox lifecycle
│   │   │   ├── executor.ts           # Code execution
│   │   │   ├── filesystem.ts         # FS operations
│   │   │   └── network.ts            # Network proxy
│   │   └── package.json
│   ├── docgen/                       # Document generation
│   │   ├── src/
│   │   │   ├── slides/
│   │   │   │   ├── pipeline.ts       # Slide generation pipeline
│   │   │   │   ├── templates/        # Slide templates
│   │   │   │   └── export.ts         # PPTX/PDF export
│   │   │   ├── charts/
│   │   │   │   ├── pipeline.ts       # Chart generation
│   │   │   │   └── renderers/        # Chart.js, D3, etc.
│   │   │   ├── documents/
│   │   │   │   ├── pipeline.ts       # Doc generation
│   │   │   │   └── templates/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── collab/                       # Collaboration
│   │   ├── src/
│   │   │   ├── crdt/
│   │   │   │   ├── yjs-provider.ts   # Yjs integration
│   │   │   │   └── awareness.ts      # Presence/cursors
│   │   │   ├── permissions.ts        # Access control
│   │   │   └── sync.ts               # Sync protocol
│   │   └── package.json
│   ├── connectors/                   # Integration connectors
│   │   ├── src/
│   │   │   ├── sdk/
│   │   │   │   ├── base.ts           # Base connector class
│   │   │   │   ├── oauth.ts          # OAuth flow
│   │   │   │   └── types.ts          # Connector types
│   │   │   ├── builtin/
│   │   │   │   ├── google/
│   │   │   │   ├── github/
│   │   │   │   ├── slack/
│   │   │   │   └── notion/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── observability/                # Metrics, traces, logs
│   │   ├── src/
│   │   │   ├── metrics.ts            # Prometheus metrics
│   │   │   ├── tracing.ts            # OpenTelemetry
│   │   │   ├── logging.ts            # Structured logging
│   │   │   └── slo.ts                # SLO definitions
│   │   └── package.json
│   └── email/                        # Email processing
│       ├── src/
│       │   ├── inbound/
│       │   │   ├── parser.ts         # Email parsing
│       │   │   ├── threading.ts      # Thread detection
│       │   │   └── intent.ts         # Intent extraction
│       │   ├── outbound/
│       │   │   ├── sender.ts         # Email sending
│       │   │   └── templates/        # Email templates
│       │   └── index.ts
│       └── package.json
├── apps/
│   ├── api/                          # Main API server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── runs.ts           # Run management
│   │   │   │   ├── billing.ts        # Billing endpoints
│   │   │   │   └── webhooks.ts       # Webhook handlers
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Authentication
│   │   │   │   ├── ratelimit.ts      # Rate limiting
│   │   │   │   └── tenant.ts         # Tenant context
│   │   │   └── server.ts
│   │   └── package.json
│   ├── worker/                       # Background workers
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   ├── run-handler.ts
│   │   │   │   ├── step-handler.ts
│   │   │   │   └── cleanup-handler.ts
│   │   │   └── worker.ts
│   │   └── package.json
│   ├── web/                          # Frontend app
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   └── scheduler/                    # Cron jobs
│       ├── src/
│       │   ├── jobs/
│       │   │   ├── stuck-run-detector.ts
│       │   │   ├── quota-reset.ts
│       │   │   └── cleanup.ts
│       │   └── scheduler.ts
│       └── package.json
├── infra/
│   ├── terraform/                    # Infrastructure as code
│   │   ├── modules/
│   │   │   ├── database/
│   │   │   ├── queue/
│   │   │   ├── sandbox/
│   │   │   └── observability/
│   │   └── environments/
│   │       ├── staging/
│   │       └── production/
│   ├── kubernetes/                   # K8s manifests
│   │   ├── base/
│   │   └── overlays/
│   └── docker/
│       ├── Dockerfile.api
│       ├── Dockerfile.worker
│       └── Dockerfile.sandbox
├── tools/
│   ├── scripts/
│   │   ├── migrate.ts                # DB migrations
│   │   ├── seed.ts                   # Test data
│   │   └── chaos.ts                  # Chaos experiments
│   └── generators/
│       └── connector.ts              # Connector scaffolding
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── load/
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Module Responsibilities

| Module | Responsibility | Key Exports |
|--------|---------------|-------------|
| `core` | Shared types, utilities, constants | `Run`, `Step`, `IdempotencyKey`, `RetryPolicy` |
| `db` | Schema, migrations, queries | `db`, `schema`, `queries` |
| `queue` | Job queue abstraction | `enqueue`, `consume`, `JobSchema` |
| `state-machine` | Run lifecycle management | `runMachine`, `transition` |
| `agent` | AI agent runtime | `Planner`, `Supervisor`, `ToolRouter` |
| `sandbox` | Isolated execution environment | `SandboxManager`, `execute` |
| `docgen` | Document generation | `generateSlides`, `generateChart` |
| `collab` | Real-time collaboration | `CollabProvider`, `sync` |
| `connectors` | External integrations | `Connector`, `ConnectorSDK` |
| `observability` | Metrics, traces, logs | `metrics`, `tracer`, `logger` |
| `email` | Email processing | `parseEmail`, `sendEmail` |

---

## 2. Data Model

### PR-002: Core Data Model

#### 2.1 Runs Table

```sql
-- runs: Core execution unit
CREATE TABLE runs (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(64) UNIQUE NOT NULL,  -- User-facing ID (run_xxx)
    
    -- Ownership
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- State
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- Values: pending, queued, planning, executing, paused, 
    --         waiting_user, completed, failed, cancelled, timeout
    
    -- Content
    prompt TEXT NOT NULL,
    prompt_hash VARCHAR(64) NOT NULL,  -- SHA-256 for dedup
    system_context JSONB,              -- System prompt additions
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "max_steps": 50,
    --   "max_duration_seconds": 3600,
    --   "max_credits": 100,
    --   "tools_enabled": ["browser", "code", "file"],
    --   "model": "claude-sonnet-4-20250514",
    --   "temperature": 0.7
    -- }
    
    -- Plan
    plan JSONB,
    -- {
    --   "goal": "...",
    --   "phases": [...],
    --   "current_phase_id": 1,
    --   "version": 3
    -- }
    
    -- Progress
    current_step_id UUID REFERENCES steps(id),
    step_count INTEGER NOT NULL DEFAULT 0,
    
    -- Billing
    credits_reserved INTEGER NOT NULL DEFAULT 0,
    credits_consumed INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    -- {
    --   "source": "web" | "api" | "email" | "scheduled",
    --   "client_ip": "...",
    --   "user_agent": "...",
    --   "parent_run_id": "..." (for sub-runs)
    -- }
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Indexes
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'queued', 'planning', 'executing', 'paused',
        'waiting_user', 'completed', 'failed', 'cancelled', 'timeout'
    ))
);

-- Indexes
CREATE INDEX idx_runs_tenant_status ON runs(tenant_id, status);
CREATE INDEX idx_runs_user_created ON runs(user_id, created_at DESC);
CREATE INDEX idx_runs_status_timeout ON runs(status, timeout_at) 
    WHERE status IN ('executing', 'paused', 'waiting_user');
CREATE INDEX idx_runs_prompt_hash ON runs(tenant_id, prompt_hash);
```

#### 2.2 Steps Table

```sql
-- steps: Individual execution steps within a run
CREATE TABLE steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Ordering
    sequence_number INTEGER NOT NULL,
    phase_id INTEGER,  -- Links to plan.phases[].id
    
    -- Type
    type VARCHAR(32) NOT NULL,
    -- Values: think, tool_call, tool_result, user_message, 
    --         assistant_message, error, checkpoint
    
    -- Content
    content JSONB NOT NULL,
    -- For tool_call:
    -- {
    --   "tool": "browser",
    --   "action": "navigate",
    --   "parameters": {...},
    --   "idempotency_key": "..."
    -- }
    -- For tool_result:
    -- {
    --   "tool": "browser",
    --   "success": true,
    --   "result": {...},
    --   "duration_ms": 1234
    -- }
    
    -- Status
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- Values: pending, executing, completed, failed, skipped
    
    -- Billing
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    credits_consumed INTEGER DEFAULT 0,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Error handling
    error JSONB,
    -- {
    --   "code": "TOOL_TIMEOUT",
    --   "message": "...",
    --   "retryable": true,
    --   "retry_count": 2
    -- }
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT unique_run_sequence UNIQUE (run_id, sequence_number)
);

-- Indexes
CREATE INDEX idx_steps_run_sequence ON steps(run_id, sequence_number);
CREATE INDEX idx_steps_run_status ON steps(run_id, status);
CREATE INDEX idx_steps_type ON steps(type) WHERE type = 'tool_call';
```

#### 2.3 Artifacts Table

```sql
-- artifacts: Files and outputs produced by runs
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES steps(id),
    
    -- Identity
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1024),  -- Path within sandbox
    
    -- Type
    type VARCHAR(32) NOT NULL,
    -- Values: file, image, document, chart, code, data
    mime_type VARCHAR(128),
    
    -- Storage
    storage_key VARCHAR(512) NOT NULL,  -- S3 key
    storage_url TEXT,                    -- Presigned URL (cached)
    url_expires_at TIMESTAMPTZ,
    
    -- Metadata
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64),  -- SHA-256
    metadata JSONB DEFAULT '{}',
    -- {
    --   "width": 1920,
    --   "height": 1080,
    --   "pages": 10,
    --   "generated_by": "docgen"
    -- }
    
    -- Visibility
    visibility VARCHAR(32) NOT NULL DEFAULT 'private',
    -- Values: private, run, tenant, public
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- For temporary artifacts
    
    CONSTRAINT unique_run_path UNIQUE (run_id, path)
);

-- Indexes
CREATE INDEX idx_artifacts_run ON artifacts(run_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_expires ON artifacts(expires_at) WHERE expires_at IS NOT NULL;
```

#### 2.4 Outbox Table (Transactional Outbox Pattern)

```sql
-- outbox: Reliable event publishing
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event
    event_type VARCHAR(64) NOT NULL,
    -- Values: run.created, run.completed, step.completed, 
    --         billing.charged, notification.send
    
    aggregate_type VARCHAR(32) NOT NULL,  -- runs, steps, billing
    aggregate_id UUID NOT NULL,
    
    -- Payload
    payload JSONB NOT NULL,
    
    -- Processing
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    -- Values: pending, processing, completed, failed
    
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ordering
    sequence_number BIGSERIAL NOT NULL
);

-- Indexes
CREATE INDEX idx_outbox_pending ON outbox(status, created_at) 
    WHERE status = 'pending';
CREATE INDEX idx_outbox_aggregate ON outbox(aggregate_type, aggregate_id);
```

#### 2.5 Billing Tables

```sql
-- credit_ledger: Double-entry credit accounting
CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Account
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_type VARCHAR(32) NOT NULL,
    -- Values: balance, reserved, consumed, refunded, purchased
    
    -- Transaction
    amount INTEGER NOT NULL,  -- Positive = credit, Negative = debit
    balance_after INTEGER NOT NULL,
    
    -- Reference
    reference_type VARCHAR(32),  -- run, purchase, refund, adjustment
    reference_id UUID,
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Idempotency
    idempotency_key VARCHAR(128) UNIQUE,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Audit
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_ledger_tenant_type ON credit_ledger(tenant_id, account_type);
CREATE INDEX idx_ledger_reference ON credit_ledger(reference_type, reference_id);
CREATE INDEX idx_ledger_created ON credit_ledger(tenant_id, created_at DESC);

-- credit_reservations: Active credit holds
CREATE TABLE credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    run_id UUID NOT NULL REFERENCES runs(id),
    
    amount INTEGER NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0,
    
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    -- Values: active, released, consumed
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    
    CONSTRAINT unique_run_reservation UNIQUE (run_id)
);

-- tenant_quotas: Usage limits
CREATE TABLE tenant_quotas (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
    
    -- Credit limits
    credit_balance INTEGER NOT NULL DEFAULT 0,
    credit_limit INTEGER NOT NULL DEFAULT 1000,
    
    -- Rate limits
    runs_per_hour INTEGER NOT NULL DEFAULT 100,
    concurrent_runs INTEGER NOT NULL DEFAULT 10,
    
    -- Storage limits
    storage_bytes_used BIGINT NOT NULL DEFAULT 0,
    storage_bytes_limit BIGINT NOT NULL DEFAULT 10737418240,  -- 10GB
    
    -- Reset
    quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2.6 Audit Tables

```sql
-- audit_log: Immutable audit trail
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor
    tenant_id UUID NOT NULL,
    user_id UUID,
    service_name VARCHAR(64),  -- For system actions
    
    -- Action
    action VARCHAR(64) NOT NULL,
    -- Values: run.create, run.cancel, settings.update, 
    --         connector.authorize, user.invite, etc.
    
    -- Target
    resource_type VARCHAR(32) NOT NULL,
    resource_id UUID,
    
    -- Details
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}',
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(64),
    
    -- Timing (immutable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Integrity
    checksum VARCHAR(64) NOT NULL,  -- SHA-256 of row content
    previous_checksum VARCHAR(64)    -- Chain to previous entry
);

-- Partitioned by month for performance
-- In production, use: PARTITION BY RANGE (created_at)

-- Indexes
CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);
```

#### 2.7 RBAC Tables

```sql
-- roles: Role definitions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),  -- NULL = system role
    
    name VARCHAR(64) NOT NULL,
    description TEXT,
    
    -- Permissions as array
    permissions TEXT[] NOT NULL DEFAULT '{}',
    -- Values: runs.create, runs.read, runs.cancel, runs.read_all,
    --         billing.read, billing.manage, settings.read, settings.manage,
    --         users.invite, users.manage, connectors.manage, admin.*
    
    -- Flags
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_role UNIQUE (tenant_id, name)
);

-- Default system roles
INSERT INTO roles (id, name, permissions, is_system, is_default) VALUES
    ('00000000-0000-0000-0000-000000000001', 'owner', 
     ARRAY['*'], TRUE, FALSE),
    ('00000000-0000-0000-0000-000000000002', 'admin', 
     ARRAY['runs.*', 'billing.*', 'settings.*', 'users.*', 'connectors.*'], TRUE, FALSE),
    ('00000000-0000-0000-0000-000000000003', 'member', 
     ARRAY['runs.create', 'runs.read', 'runs.cancel', 'billing.read', 'connectors.use'], TRUE, TRUE);

-- user_roles: Role assignments
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id),
    
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    PRIMARY KEY (user_id, tenant_id, role_id)
);

-- Indexes
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);
```

#### 2.8 Collaboration Tables

```sql
-- collab_sessions: Active collaboration sessions
CREATE TABLE collab_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Yjs document state
    doc_state BYTEA,  -- Yjs encoded state
    state_vector BYTEA,  -- For sync
    
    -- Participants
    participants JSONB NOT NULL DEFAULT '[]',
    -- [{ "user_id": "...", "cursor": {...}, "last_seen": "..." }]
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_run_session UNIQUE (run_id)
);

-- collab_updates: Update history for conflict resolution
CREATE TABLE collab_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
    
    -- Update
    update_data BYTEA NOT NULL,  -- Yjs update
    
    -- Origin
    user_id UUID REFERENCES users(id),
    client_id VARCHAR(64),
    
    -- Ordering
    sequence_number BIGSERIAL NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_collab_updates_session ON collab_updates(session_id, sequence_number);
```

#### 2.9 TypeScript Schema (Drizzle)

```typescript
// packages/db/drizzle/schema/runs.ts
import { pgTable, uuid, varchar, text, jsonb, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 64 }).notNull().unique(),
  
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  
  prompt: text('prompt').notNull(),
  promptHash: varchar('prompt_hash', { length: 64 }).notNull(),
  systemContext: jsonb('system_context'),
  
  config: jsonb('config').notNull().default({}),
  plan: jsonb('plan'),
  
  currentStepId: uuid('current_step_id').references(() => steps.id),
  stepCount: integer('step_count').notNull().default(0),
  
  creditsReserved: integer('credits_reserved').notNull().default(0),
  creditsConsumed: integer('credits_consumed').notNull().default(0),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  timeoutAt: timestamp('timeout_at', { withTimezone: true }),
  
  metadata: jsonb('metadata').default({}),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantStatusIdx: index('idx_runs_tenant_status').on(table.tenantId, table.status),
  userCreatedIdx: index('idx_runs_user_created').on(table.userId, table.createdAt),
  promptHashIdx: index('idx_runs_prompt_hash').on(table.tenantId, table.promptHash),
}));

// Type exports
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

// Status enum
export const RUN_STATUSES = [
  'pending',
  'queued', 
  'planning',
  'executing',
  'paused',
  'waiting_user',
  'completed',
  'failed',
  'cancelled',
  'timeout'
] as const;

export type RunStatus = typeof RUN_STATUSES[number];
```

---

## 3. Run State Machine

### PR-003: Run State Machine

#### 3.1 State Diagram

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                                                         │
                                    ▼                                                         │
┌─────────┐    enqueue    ┌────────┐    start     ┌──────────┐    plan_ready   ┌───────────┐ │
│ PENDING │──────────────▶│ QUEUED │─────────────▶│ PLANNING │────────────────▶│ EXECUTING │─┤
└─────────┘               └────────┘              └──────────┘                 └───────────┘ │
     │                         │                       │                            │  │  │  │
     │                         │                       │                            │  │  │  │
     │ cancel                  │ cancel                │ plan_failed                │  │  │  │
     │                         │                       │                            │  │  │  │
     ▼                         ▼                       ▼                            │  │  │  │
┌───────────┐            ┌───────────┐           ┌────────┐                        │  │  │  │
│ CANCELLED │◀───────────│ CANCELLED │◀──────────│ FAILED │◀───────────────────────┘  │  │  │
└───────────┘            └───────────┘           └────────┘         error              │  │  │
                                                      ▲                                │  │  │
                                                      │                                │  │  │
                                                      │ timeout                        │  │  │
                                                      │                                │  │  │
                                                 ┌─────────┐                           │  │  │
                                                 │ TIMEOUT │◀──────────────────────────┘  │  │
                                                 └─────────┘         timeout_reached      │  │
                                                                                          │  │
                              ┌────────────────────────────────────────────────────────────┘  │
                              │ need_user_input                                               │
                              ▼                                                               │
                        ┌──────────────┐                                                      │
                        │ WAITING_USER │──────────────────────────────────────────────────────┤
                        └──────────────┘         user_responded                               │
                              │                                                               │
                              │ cancel                                                        │
                              ▼                                                               │
                        ┌───────────┐                                                         │
                        │ CANCELLED │                                                         │
                        └───────────┘                                                         │
                                                                                              │
                              ┌────────────────────────────────────────────────────────────────┘
                              │ pause_requested
                              ▼
                        ┌────────┐
                        │ PAUSED │────────────────────────────────────────────────────────────┐
                        └────────┘         resume                                             │
                              │                                                               │
                              │ cancel                                                        │
                              ▼                                                               │
                        ┌───────────┐                                                         │
                        │ CANCELLED │                                                         │
                        └───────────┘                                                         │
                                                                                              │
                              ┌────────────────────────────────────────────────────────────────┘
                              │ goal_achieved
                              ▼
                        ┌───────────┐
                        │ COMPLETED │
                        └───────────┘
```

#### 3.2 XState Machine Definition

```typescript
// packages/state-machine/src/machine.ts
import { createMachine, assign } from 'xstate';

export interface RunContext {
  runId: string;
  tenantId: string;
  userId: string;
  
  // Plan
  plan: Plan | null;
  currentPhaseId: number;
  
  // Progress
  stepCount: number;
  maxSteps: number;
  
  // Billing
  creditsReserved: number;
  creditsConsumed: number;
  maxCredits: number;
  
  // Timing
  startedAt: number | null;
  timeoutAt: number | null;
  maxDurationMs: number;
  
  // Error tracking
  consecutiveErrors: number;
  lastError: Error | null;
  
  // Retry tracking
  retryCount: number;
  maxRetries: number;
}

export type RunEvent =
  | { type: 'ENQUEUE' }
  | { type: 'START' }
  | { type: 'PLAN_READY'; plan: Plan }
  | { type: 'PLAN_FAILED'; error: Error }
  | { type: 'STEP_COMPLETED'; step: Step }
  | { type: 'STEP_FAILED'; error: Error; retryable: boolean }
  | { type: 'NEED_USER_INPUT'; prompt: string }
  | { type: 'USER_RESPONDED'; response: string }
  | { type: 'GOAL_ACHIEVED'; result: any }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL'; reason?: string }
  | { type: 'TIMEOUT' }
  | { type: 'ERROR'; error: Error };

export const runMachine = createMachine<RunContext, RunEvent>({
  id: 'run',
  initial: 'pending',
  
  states: {
    pending: {
      on: {
        ENQUEUE: {
          target: 'queued',
          actions: ['reserveCredits', 'publishEvent']
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        }
      }
    },
    
    queued: {
      on: {
        START: {
          target: 'planning',
          actions: ['setStartTime', 'setTimeoutTime', 'publishEvent'],
          guard: 'hasAvailableCredits'
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        }
      }
    },
    
    planning: {
      entry: ['startPlanning'],
      on: {
        PLAN_READY: {
          target: 'executing',
          actions: ['setPlan', 'publishEvent']
        },
        PLAN_FAILED: {
          target: 'failed',
          actions: ['setError', 'releaseCredits', 'publishEvent']
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        },
        TIMEOUT: {
          target: 'timeout',
          actions: ['releaseCredits', 'publishEvent']
        }
      }
    },
    
    executing: {
      entry: ['executeNextStep'],
      on: {
        STEP_COMPLETED: [
          {
            target: 'executing',
            actions: ['recordStep', 'consumeCredits', 'publishEvent'],
            guard: 'hasMoreWork',
            reenter: true
          },
          {
            target: 'completed',
            actions: ['recordStep', 'consumeCredits', 'finalizeCredits', 'publishEvent'],
            guard: 'isGoalAchieved'
          }
        ],
        STEP_FAILED: [
          {
            target: 'executing',
            actions: ['incrementRetry', 'publishEvent'],
            guard: 'canRetry',
            reenter: true
          },
          {
            target: 'failed',
            actions: ['setError', 'releaseCredits', 'publishEvent']
          }
        ],
        NEED_USER_INPUT: {
          target: 'waiting_user',
          actions: ['publishEvent']
        },
        GOAL_ACHIEVED: {
          target: 'completed',
          actions: ['setResult', 'finalizeCredits', 'publishEvent']
        },
        PAUSE: {
          target: 'paused',
          actions: ['saveCheckpoint', 'publishEvent']
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        },
        TIMEOUT: {
          target: 'timeout',
          actions: ['saveCheckpoint', 'releaseCredits', 'publishEvent']
        },
        ERROR: {
          target: 'failed',
          actions: ['setError', 'releaseCredits', 'publishEvent']
        }
      }
    },
    
    waiting_user: {
      on: {
        USER_RESPONDED: {
          target: 'executing',
          actions: ['recordUserResponse', 'publishEvent']
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        },
        TIMEOUT: {
          target: 'timeout',
          actions: ['releaseCredits', 'publishEvent']
        }
      }
    },
    
    paused: {
      on: {
        RESUME: {
          target: 'executing',
          actions: ['restoreCheckpoint', 'publishEvent']
        },
        CANCEL: {
          target: 'cancelled',
          actions: ['releaseCredits', 'publishEvent']
        },
        TIMEOUT: {
          target: 'timeout',
          actions: ['releaseCredits', 'publishEvent']
        }
      }
    },
    
    completed: {
      type: 'final',
      entry: ['cleanup']
    },
    
    failed: {
      type: 'final',
      entry: ['cleanup', 'notifyFailure']
    },
    
    cancelled: {
      type: 'final',
      entry: ['cleanup']
    },
    
    timeout: {
      type: 'final',
      entry: ['cleanup', 'notifyTimeout']
    }
  }
}, {
  guards: {
    hasAvailableCredits: (context) => {
      return context.creditsReserved > 0;
    },
    
    hasMoreWork: (context) => {
      return context.stepCount < context.maxSteps &&
             context.creditsConsumed < context.maxCredits &&
             !isGoalAchieved(context);
    },
    
    isGoalAchieved: (context) => {
      return isGoalAchieved(context);
    },
    
    canRetry: (context, event) => {
      if (event.type !== 'STEP_FAILED') return false;
      return event.retryable && 
             context.retryCount < context.maxRetries &&
             context.consecutiveErrors < 3;
    }
  },
  
  actions: {
    reserveCredits: assign((context) => {
      // Implemented in transition handler
      return context;
    }),
    
    releaseCredits: assign((context) => {
      // Release unused reserved credits
      return {
        ...context,
        creditsReserved: 0
      };
    }),
    
    consumeCredits: assign((context, event) => {
      if (event.type !== 'STEP_COMPLETED') return context;
      const consumed = event.step.creditsConsumed || 0;
      return {
        ...context,
        creditsConsumed: context.creditsConsumed + consumed,
        creditsReserved: context.creditsReserved - consumed
      };
    }),
    
    setStartTime: assign({
      startedAt: () => Date.now()
    }),
    
    setTimeoutTime: assign((context) => ({
      timeoutAt: Date.now() + context.maxDurationMs
    })),
    
    setPlan: assign((context, event) => {
      if (event.type !== 'PLAN_READY') return context;
      return {
        ...context,
        plan: event.plan,
        currentPhaseId: 1
      };
    }),
    
    recordStep: assign((context, event) => {
      if (event.type !== 'STEP_COMPLETED') return context;
      return {
        ...context,
        stepCount: context.stepCount + 1,
        consecutiveErrors: 0,
        retryCount: 0
      };
    }),
    
    incrementRetry: assign((context) => ({
      retryCount: context.retryCount + 1,
      consecutiveErrors: context.consecutiveErrors + 1
    })),
    
    setError: assign((context, event) => {
      if (event.type !== 'STEP_FAILED' && event.type !== 'PLAN_FAILED' && event.type !== 'ERROR') {
        return context;
      }
      return {
        ...context,
        lastError: event.error
      };
    }),
    
    publishEvent: (context, event) => {
      // Publish to outbox for event sourcing
      publishToOutbox({
        eventType: `run.${event.type.toLowerCase()}`,
        aggregateType: 'runs',
        aggregateId: context.runId,
        payload: { context, event }
      });
    },
    
    saveCheckpoint: (context) => {
      // Save execution state for resume
      saveRunCheckpoint(context);
    },
    
    restoreCheckpoint: assign((context) => {
      return loadRunCheckpoint(context.runId) || context;
    }),
    
    cleanup: (context) => {
      // Release sandbox, cleanup temp files
      cleanupRun(context.runId);
    }
  }
});
```

#### 3.3 Transition Rules

```typescript
// packages/state-machine/src/transitions.ts

export interface TransitionRule {
  from: RunStatus[];
  to: RunStatus;
  event: string;
  guards: GuardFn[];
  actions: ActionFn[];
  idempotencyKey?: (context: RunContext, event: RunEvent) => string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  // PENDING -> QUEUED
  {
    from: ['pending'],
    to: 'queued',
    event: 'ENQUEUE',
    guards: [
      hasAvailableQuota,
      isNotDuplicate
    ],
    actions: [
      reserveCredits,
      enqueueJob
    ],
    idempotencyKey: (ctx) => `enqueue:${ctx.runId}`
  },
  
  // QUEUED -> PLANNING
  {
    from: ['queued'],
    to: 'planning',
    event: 'START',
    guards: [
      hasReservedCredits,
      workerAvailable
    ],
    actions: [
      setStartTime,
      setTimeoutTime,
      startPlanningJob
    ],
    idempotencyKey: (ctx) => `start:${ctx.runId}`
  },
  
  // PLANNING -> EXECUTING
  {
    from: ['planning'],
    to: 'executing',
    event: 'PLAN_READY',
    guards: [
      planIsValid
    ],
    actions: [
      savePlan,
      startExecutionLoop
    ],
    idempotencyKey: (ctx, evt) => `plan_ready:${ctx.runId}:${evt.plan.version}`
  },
  
  // EXECUTING -> EXECUTING (step completed, more work)
  {
    from: ['executing'],
    to: 'executing',
    event: 'STEP_COMPLETED',
    guards: [
      hasMoreWork,
      withinLimits
    ],
    actions: [
      recordStep,
      consumeCredits,
      continueExecution
    ],
    idempotencyKey: (ctx, evt) => `step:${ctx.runId}:${evt.step.sequenceNumber}`
  },
  
  // EXECUTING -> COMPLETED
  {
    from: ['executing'],
    to: 'completed',
    event: 'GOAL_ACHIEVED',
    guards: [],
    actions: [
      finalizeCredits,
      saveResult,
      notifyCompletion
    ],
    idempotencyKey: (ctx) => `complete:${ctx.runId}`
  },
  
  // ANY -> CANCELLED
  {
    from: ['pending', 'queued', 'planning', 'executing', 'paused', 'waiting_user'],
    to: 'cancelled',
    event: 'CANCEL',
    guards: [],
    actions: [
      releaseCredits,
      cleanup
    ],
    idempotencyKey: (ctx) => `cancel:${ctx.runId}`
  },
  
  // EXECUTING -> FAILED (non-retryable error)
  {
    from: ['executing', 'planning'],
    to: 'failed',
    event: 'ERROR',
    guards: [
      isNotRetryable
    ],
    actions: [
      releaseCredits,
      saveError,
      notifyFailure
    ],
    idempotencyKey: (ctx) => `fail:${ctx.runId}`
  }
];
```

#### 3.4 Idempotency Rules

```typescript
// packages/state-machine/src/idempotency.ts

export interface IdempotencyConfig {
  // Key generation
  keyPrefix: string;
  keyTTL: number;  // seconds
  
  // Deduplication window
  dedupeWindowMs: number;
  
  // Result caching
  cacheResult: boolean;
  resultTTL: number;
}

export const IDEMPOTENCY_CONFIGS: Record<string, IdempotencyConfig> = {
  'run.create': {
    keyPrefix: 'idem:run:create',
    keyTTL: 86400,           // 24 hours
    dedupeWindowMs: 60000,   // 1 minute
    cacheResult: true,
    resultTTL: 3600
  },
  'step.execute': {
    keyPrefix: 'idem:step:exec',
    keyTTL: 3600,            // 1 hour
    dedupeWindowMs: 5000,    // 5 seconds
    cacheResult: true,
    resultTTL: 300
  },
  'billing.charge': {
    keyPrefix: 'idem:billing:charge',
    keyTTL: 604800,          // 7 days
    dedupeWindowMs: 0,       // No dedupe window (always check)
    cacheResult: true,
    resultTTL: 604800
  }
};

export async function executeIdempotent<T>(
  key: string,
  config: IdempotencyConfig,
  operation: () => Promise<T>
): Promise<{ result: T; wasExecuted: boolean }> {
  const fullKey = `${config.keyPrefix}:${key}`;
  
  // Check for existing result
  const existing = await redis.get(fullKey);
  if (existing) {
    const cached = JSON.parse(existing);
    
    // Check if within dedupe window
    if (Date.now() - cached.timestamp < config.dedupeWindowMs) {
      return { result: cached.result, wasExecuted: false };
    }
    
    // Return cached result if available
    if (config.cacheResult && cached.result !== undefined) {
      return { result: cached.result, wasExecuted: false };
    }
  }
  
  // Acquire lock
  const lockKey = `${fullKey}:lock`;
  const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 30);
  
  if (!lockAcquired) {
    // Another process is executing, wait and return
    await sleep(100);
    return executeIdempotent(key, config, operation);
  }
  
  try {
    // Execute operation
    const result = await operation();
    
    // Cache result
    await redis.set(fullKey, JSON.stringify({
      result: config.cacheResult ? result : undefined,
      timestamp: Date.now(),
      status: 'completed'
    }), 'EX', config.keyTTL);
    
    return { result, wasExecuted: true };
  } catch (error) {
    // Cache error for dedupe
    await redis.set(fullKey, JSON.stringify({
      error: error.message,
      timestamp: Date.now(),
      status: 'failed'
    }), 'EX', 60);  // Short TTL for errors
    
    throw error;
  } finally {
    await redis.del(lockKey);
  }
}
```

#### 3.5 Retry Rules

```typescript
// packages/state-machine/src/retry.ts

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export const RETRY_POLICIES: Record<string, RetryPolicy> = {
  'tool.browser': {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED'],
    nonRetryableErrors: ['INVALID_URL', 'BLOCKED', 'AUTH_REQUIRED']
  },
  'tool.code': {
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
    retryableErrors: ['TIMEOUT', 'OOM'],
    nonRetryableErrors: ['SYNTAX_ERROR', 'SECURITY_VIOLATION']
  },
  'llm.invoke': {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['RATE_LIMITED', 'OVERLOADED', 'TIMEOUT'],
    nonRetryableErrors: ['INVALID_REQUEST', 'CONTENT_FILTERED']
  },
  'default': {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'INTERNAL_ERROR'],
    nonRetryableErrors: ['VALIDATION_ERROR', 'AUTH_ERROR', 'NOT_FOUND']
  }
};

export function shouldRetry(
  error: Error,
  attempt: number,
  policy: RetryPolicy
): { retry: boolean; delayMs: number } {
  // Check max attempts
  if (attempt >= policy.maxAttempts) {
    return { retry: false, delayMs: 0 };
  }
  
  // Check error type
  const errorCode = (error as any).code || 'UNKNOWN';
  
  if (policy.nonRetryableErrors.includes(errorCode)) {
    return { retry: false, delayMs: 0 };
  }
  
  if (!policy.retryableErrors.includes(errorCode) && 
      !policy.retryableErrors.includes('*')) {
    return { retry: false, delayMs: 0 };
  }
  
  // Calculate delay with exponential backoff + jitter
  const baseDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * baseDelay;
  const delay = Math.min(baseDelay + jitter, policy.maxDelayMs);
  
  return { retry: true, delayMs: delay };
}
```

#### 3.6 Stuck Detection Rules

```typescript
// packages/state-machine/src/stuck-detection.ts

export interface StuckDetectionRule {
  status: RunStatus;
  maxDurationMs: number;
  action: 'timeout' | 'retry' | 'alert' | 'escalate';
  alertThreshold: number;  // Alert after N occurrences
}

export const STUCK_DETECTION_RULES: StuckDetectionRule[] = [
  {
    status: 'queued',
    maxDurationMs: 5 * 60 * 1000,      // 5 minutes
    action: 'retry',
    alertThreshold: 3
  },
  {
    status: 'planning',
    maxDurationMs: 2 * 60 * 1000,      // 2 minutes
    action: 'timeout',
    alertThreshold: 1
  },
  {
    status: 'executing',
    maxDurationMs: 60 * 60 * 1000,     // 1 hour (configurable per run)
    action: 'timeout',
    alertThreshold: 1
  },
  {
    status: 'waiting_user',
    maxDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    action: 'timeout',
    alertThreshold: 0  // No alert, expected behavior
  },
  {
    status: 'paused',
    maxDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    action: 'timeout',
    alertThreshold: 0
  }
];

export async function detectStuckRuns(): Promise<StuckRun[]> {
  const stuckRuns: StuckRun[] = [];
  
  for (const rule of STUCK_DETECTION_RULES) {
    const cutoffTime = new Date(Date.now() - rule.maxDurationMs);
    
    const runs = await db.query.runs.findMany({
      where: and(
        eq(runs.status, rule.status),
        lt(runs.updatedAt, cutoffTime)
      ),
      limit: 100
    });
    
    for (const run of runs) {
      stuckRuns.push({
        run,
        rule,
        stuckDurationMs: Date.now() - run.updatedAt.getTime()
      });
    }
  }
  
  return stuckRuns;
}

export async function handleStuckRun(stuck: StuckRun): Promise<void> {
  const { run, rule } = stuck;
  
  switch (rule.action) {
    case 'timeout':
      await transitionRun(run.id, 'TIMEOUT', {
        reason: `Exceeded max duration for status ${rule.status}`
      });
      break;
    
    case 'retry':
      // Re-enqueue the job
      await enqueueJob('run', {
        runId: run.id,
        action: 'resume',
        attempt: (run.metadata.retryCount || 0) + 1
      });
      break;
    
    case 'alert':
      await sendAlert({
        type: 'stuck_run',
        severity: 'warning',
        runId: run.id,
        message: `Run stuck in ${rule.status} for ${stuck.stuckDurationMs}ms`
      });
      break;
    
    case 'escalate':
      await sendAlert({
        type: 'stuck_run',
        severity: 'critical',
        runId: run.id,
        message: `Run requires manual intervention`
      });
      break;
  }
}
```

---

## 4. Worker Architecture

### PR-004: Worker Infrastructure

#### 4.1 Queue Configuration

```typescript
// packages/queue/src/config.ts

export interface QueueConfig {
  name: string;
  concurrency: number;
  rateLimit?: {
    max: number;
    duration: number;  // ms
  };
  retries: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  timeout: number;
  priority: boolean;
  dlq: {
    enabled: boolean;
    maxRetries: number;
  };
}

export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  'runs': {
    name: 'runs',
    concurrency: 50,
    rateLimit: {
      max: 100,
      duration: 1000
    },
    retries: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    timeout: 3600000,  // 1 hour
    priority: true,
    dlq: {
      enabled: true,
      maxRetries: 3
    }
  },
  'steps': {
    name: 'steps',
    concurrency: 100,
    rateLimit: {
      max: 200,
      duration: 1000
    },
    retries: 3,
    backoff: {
      type: 'exponential',
      delay: 500
    },
    timeout: 300000,  // 5 minutes
    priority: false,
    dlq: {
      enabled: true,
      maxRetries: 5
    }
  },
  'notifications': {
    name: 'notifications',
    concurrency: 20,
    retries: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 30000,
    priority: false,
    dlq: {
      enabled: true,
      maxRetries: 10
    }
  },
  'cleanup': {
    name: 'cleanup',
    concurrency: 5,
    retries: 2,
    backoff: {
      type: 'fixed',
      delay: 5000
    },
    timeout: 600000,  // 10 minutes
    priority: false,
    dlq: {
      enabled: false,
      maxRetries: 0
    }
  }
};
```

#### 4.2 Job Payload Schemas

```typescript
// packages/queue/src/schemas/run-job.ts
import { z } from 'zod';

export const RunJobSchema = z.object({
  type: z.literal('run'),
  
  // Identity
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Action
  action: z.enum(['start', 'resume', 'cancel', 'timeout']),
  
  // Context
  checkpoint: z.object({
    stepNumber: z.number(),
    phaseId: z.number(),
    context: z.any()
  }).optional(),
  
  // Retry info
  attempt: z.number().default(1),
  previousError: z.string().optional(),
  
  // Priority (higher = more urgent)
  priority: z.number().min(0).max(100).default(50),
  
  // Scheduling
  scheduledFor: z.number().optional(),  // Unix timestamp
  
  // Idempotency
  idempotencyKey: z.string()
});

export type RunJob = z.infer<typeof RunJobSchema>;

// packages/queue/src/schemas/step-job.ts
export const StepJobSchema = z.object({
  type: z.literal('step'),
  
  // Identity
  runId: z.string().uuid(),
  stepId: z.string().uuid(),
  
  // Tool execution
  tool: z.string(),
  action: z.string(),
  parameters: z.record(z.any()),
  
  // Context
  contextWindow: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.any()
  })),
  
  // Limits
  timeout: z.number().default(300000),
  maxTokens: z.number().optional(),
  
  // Retry
  attempt: z.number().default(1),
  
  // Idempotency
  idempotencyKey: z.string()
});

export type StepJob = z.infer<typeof StepJobSchema>;

// packages/queue/src/schemas/notification-job.ts
export const NotificationJobSchema = z.object({
  type: z.literal('notification'),
  
  // Target
  channel: z.enum(['email', 'webhook', 'push', 'in_app']),
  recipient: z.string(),
  
  // Content
  template: z.string(),
  data: z.record(z.any()),
  
  // Options
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  
  // Idempotency
  idempotencyKey: z.string()
});

export type NotificationJob = z.infer<typeof NotificationJobSchema>;
```

#### 4.3 Producer

```typescript
// packages/queue/src/producer.ts
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

export class JobProducer {
  private queues: Map<string, Queue> = new Map();
  private redis: Redis;
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }
  
  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const config = QUEUE_CONFIGS[name];
      if (!config) throw new Error(`Unknown queue: ${name}`);
      
      this.queues.set(name, new Queue(name, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: config.retries,
          backoff: config.backoff,
          removeOnComplete: {
            age: 3600,  // Keep completed jobs for 1 hour
            count: 1000
          },
          removeOnFail: {
            age: 86400  // Keep failed jobs for 24 hours
          }
        }
      }));
    }
    return this.queues.get(name)!;
  }
  
  async enqueue<T extends JobPayload>(
    queueName: string,
    job: T,
    options?: EnqueueOptions
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const config = QUEUE_CONFIGS[queueName];
    
    // Check rate limit
    if (config.rateLimit) {
      const allowed = await this.checkRateLimit(queueName, config.rateLimit);
      if (!allowed) {
        throw new RateLimitError(`Queue ${queueName} rate limit exceeded`);
      }
    }
    
    // Idempotency check
    if (job.idempotencyKey) {
      const existing = await this.redis.get(`job:idem:${job.idempotencyKey}`);
      if (existing) {
        return existing;  // Return existing job ID
      }
    }
    
    // Enqueue
    const bullJob = await queue.add(job.type, job, {
      priority: options?.priority ?? (config.priority ? job.priority : undefined),
      delay: options?.delay,
      jobId: job.idempotencyKey
    });
    
    // Store idempotency mapping
    if (job.idempotencyKey) {
      await this.redis.set(
        `job:idem:${job.idempotencyKey}`,
        bullJob.id!,
        'EX',
        86400  // 24 hour TTL
      );
    }
    
    return bullJob.id!;
  }
  
  async enqueueBatch<T extends JobPayload>(
    queueName: string,
    jobs: T[]
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    
    const bullJobs = await queue.addBulk(
      jobs.map(job => ({
        name: job.type,
        data: job,
        opts: {
          jobId: job.idempotencyKey
        }
      }))
    );
    
    return bullJobs.map(j => j.id!);
  }
  
  private async checkRateLimit(
    queueName: string,
    limit: { max: number; duration: number }
  ): Promise<boolean> {
    const key = `ratelimit:queue:${queueName}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.pexpire(key, limit.duration);
    }
    
    return current <= limit.max;
  }
}
```

#### 4.4 Consumer

```typescript
// packages/queue/src/consumer.ts
import { Worker, Job } from 'bullmq';

export interface JobHandler<T> {
  handle(job: T, context: JobContext): Promise<any>;
  onFailed?(job: T, error: Error): Promise<void>;
  onCompleted?(job: T, result: any): Promise<void>;
}

export class JobConsumer {
  private workers: Map<string, Worker> = new Map();
  private handlers: Map<string, JobHandler<any>> = new Map();
  
  registerHandler<T>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler);
  }
  
  start(queueName: string): void {
    const config = QUEUE_CONFIGS[queueName];
    
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          throw new Error(`No handler for job type: ${job.name}`);
        }
        
        const context: JobContext = {
          jobId: job.id!,
          attempt: job.attemptsMade + 1,
          maxAttempts: config.retries,
          queueName,
          timestamp: Date.now()
        };
        
        // Metrics
        metrics.jobStarted.inc({ queue: queueName, type: job.name });
        const startTime = Date.now();
        
        try {
          const result = await handler.handle(job.data, context);
          
          metrics.jobCompleted.inc({ queue: queueName, type: job.name });
          metrics.jobDuration.observe(
            { queue: queueName, type: job.name },
            Date.now() - startTime
          );
          
          if (handler.onCompleted) {
            await handler.onCompleted(job.data, result);
          }
          
          return result;
        } catch (error) {
          metrics.jobFailed.inc({ queue: queueName, type: job.name });
          
          if (handler.onFailed) {
            await handler.onFailed(job.data, error as Error);
          }
          
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: config.concurrency,
        limiter: config.rateLimit ? {
          max: config.rateLimit.max,
          duration: config.rateLimit.duration
        } : undefined
      }
    );
    
    // Event handlers
    worker.on('failed', async (job, error) => {
      if (job && job.attemptsMade >= config.retries) {
        // Move to DLQ
        if (config.dlq.enabled) {
          await this.moveToDLQ(queueName, job, error);
        }
      }
    });
    
    worker.on('error', (error) => {
      logger.error('Worker error', { queue: queueName, error });
    });
    
    this.workers.set(queueName, worker);
  }
  
  private async moveToDLQ(
    queueName: string,
    job: Job,
    error: Error
  ): Promise<void> {
    const dlqName = `${queueName}:dlq`;
    const dlqQueue = new Queue(dlqName, { connection: this.redis });
    
    await dlqQueue.add('dlq', {
      originalJob: job.data,
      originalQueue: queueName,
      error: {
        message: error.message,
        stack: error.stack
      },
      attempts: job.attemptsMade,
      failedAt: Date.now()
    });
    
    metrics.dlqMessages.inc({ queue: queueName });
  }
  
  async stop(): Promise<void> {
    await Promise.all(
      Array.from(this.workers.values()).map(w => w.close())
    );
  }
}
```

#### 4.5 Backpressure Control

```typescript
// packages/queue/src/backpressure.ts

export interface BackpressureConfig {
  // Queue depth thresholds
  warningThreshold: number;
  criticalThreshold: number;
  
  // Actions
  onWarning: 'log' | 'slow' | 'reject';
  onCritical: 'reject' | 'circuit_break';
  
  // Recovery
  recoveryThreshold: number;
  cooldownMs: number;
}

export const BACKPRESSURE_CONFIGS: Record<string, BackpressureConfig> = {
  'runs': {
    warningThreshold: 1000,
    criticalThreshold: 5000,
    onWarning: 'slow',
    onCritical: 'reject',
    recoveryThreshold: 500,
    cooldownMs: 30000
  },
  'steps': {
    warningThreshold: 5000,
    criticalThreshold: 20000,
    onWarning: 'log',
    onCritical: 'reject',
    recoveryThreshold: 2000,
    cooldownMs: 10000
  }
};

export class BackpressureController {
  private states: Map<string, BackpressureState> = new Map();
  
  async checkBackpressure(queueName: string): Promise<BackpressureResult> {
    const config = BACKPRESSURE_CONFIGS[queueName];
    if (!config) return { allowed: true, action: 'none' };
    
    const queue = new Queue(queueName, { connection: this.redis });
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const depth = waiting + active;
    
    // Update metrics
    metrics.queueDepth.set({ queue: queueName }, depth);
    
    // Check state
    const state = this.states.get(queueName) || { level: 'normal', since: Date.now() };
    
    if (depth >= config.criticalThreshold) {
      this.states.set(queueName, { level: 'critical', since: Date.now() });
      
      metrics.backpressureTriggered.inc({ queue: queueName, level: 'critical' });
      
      return {
        allowed: config.onCritical !== 'reject',
        action: config.onCritical,
        depth,
        threshold: config.criticalThreshold
      };
    }
    
    if (depth >= config.warningThreshold) {
      this.states.set(queueName, { level: 'warning', since: Date.now() });
      
      return {
        allowed: config.onWarning !== 'reject',
        action: config.onWarning,
        depth,
        threshold: config.warningThreshold,
        slowdownFactor: this.calculateSlowdown(depth, config)
      };
    }
    
    // Check recovery
    if (state.level !== 'normal' && depth <= config.recoveryThreshold) {
      const cooldownElapsed = Date.now() - state.since >= config.cooldownMs;
      if (cooldownElapsed) {
        this.states.set(queueName, { level: 'normal', since: Date.now() });
      }
    }
    
    return { allowed: true, action: 'none', depth };
  }
  
  private calculateSlowdown(depth: number, config: BackpressureConfig): number {
    // Linear slowdown between warning and critical
    const range = config.criticalThreshold - config.warningThreshold;
    const position = depth - config.warningThreshold;
    return Math.min(1, position / range);  // 0 to 1
  }
}
```

#### 4.6 DLQ Behavior

```typescript
// packages/queue/src/dlq.ts

export interface DLQConfig {
  // Retention
  retentionDays: number;
  
  // Alerting
  alertThreshold: number;
  alertInterval: number;
  
  // Reprocessing
  maxReprocessAttempts: number;
  reprocessDelay: number;
}

export const DLQ_CONFIG: DLQConfig = {
  retentionDays: 30,
  alertThreshold: 10,
  alertInterval: 300000,  // 5 minutes
  maxReprocessAttempts: 3,
  reprocessDelay: 3600000  // 1 hour
};

export class DLQManager {
  async getDLQStats(queueName: string): Promise<DLQStats> {
    const dlqName = `${queueName}:dlq`;
    const queue = new Queue(dlqName, { connection: this.redis });
    
    const [waiting, delayed, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);
    
    return {
      queue: queueName,
      dlqDepth: waiting + delayed,
      totalProcessed: completed,
      totalFailed: failed
    };
  }
  
  async reprocessDLQMessage(
    queueName: string,
    jobId: string
  ): Promise<void> {
    const dlqName = `${queueName}:dlq`;
    const dlqQueue = new Queue(dlqName, { connection: this.redis });
    const originalQueue = new Queue(queueName, { connection: this.redis });
    
    const job = await dlqQueue.getJob(jobId);
    if (!job) throw new Error(`DLQ job not found: ${jobId}`);
    
    const dlqData = job.data;
    
    // Check reprocess limit
    const attempts = dlqData.reprocessAttempts || 0;
    if (attempts >= DLQ_CONFIG.maxReprocessAttempts) {
      throw new Error(`Max reprocess attempts exceeded for job ${jobId}`);
    }
    
    // Re-enqueue to original queue
    await originalQueue.add(dlqData.originalJob.type, {
      ...dlqData.originalJob,
      _dlqReprocess: {
        originalJobId: jobId,
        attempt: attempts + 1,
        reprocessedAt: Date.now()
      }
    });
    
    // Update DLQ job
    await job.updateData({
      ...dlqData,
      reprocessAttempts: attempts + 1,
      lastReprocessedAt: Date.now()
    });
  }
  
  async purgeDLQ(queueName: string, olderThanDays?: number): Promise<number> {
    const dlqName = `${queueName}:dlq`;
    const queue = new Queue(dlqName, { connection: this.redis });
    
    const cutoff = olderThanDays 
      ? Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
      : Date.now() - (DLQ_CONFIG.retentionDays * 24 * 60 * 60 * 1000);
    
    const jobs = await queue.getJobs(['waiting', 'delayed']);
    let purged = 0;
    
    for (const job of jobs) {
      if (job.timestamp < cutoff) {
        await job.remove();
        purged++;
      }
    }
    
    return purged;
  }
}
```

---

## 5. Agent Runtime

### PR-005: Agent Runtime Core

#### 5.1 Planner

```typescript
// packages/agent/src/planner/planner.ts

export interface PlannerConfig {
  maxPlanningAttempts: number;
  planningTimeout: number;
  minPhases: number;
  maxPhases: number;
  requireCapabilities: boolean;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxPlanningAttempts: 3,
  planningTimeout: 30000,
  minPhases: 2,
  maxPhases: 15,
  requireCapabilities: true
};

export class Planner {
  constructor(
    private llm: LLMClient,
    private config: PlannerConfig = DEFAULT_PLANNER_CONFIG
  ) {}
  
  async createPlan(request: PlanRequest): Promise<Plan> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxPlanningAttempts; attempt++) {
      try {
        const plan = await this.generatePlan(request, attempt);
        const validation = this.validatePlan(plan, request);
        
        if (validation.valid) {
          return plan;
        }
        
        // Attempt repair
        const repaired = await this.repairPlan(plan, validation.issues, request);
        const revalidation = this.validatePlan(repaired, request);
        
        if (revalidation.valid) {
          return repaired;
        }
        
        lastError = new Error(`Plan validation failed: ${revalidation.issues.join(', ')}`);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxPlanningAttempts) {
          await sleep(1000 * attempt);  // Backoff
        }
      }
    }
    
    throw lastError || new Error('Planning failed');
  }
  
  private async generatePlan(request: PlanRequest, attempt: number): Promise<Plan> {
    const systemPrompt = this.buildPlanningPrompt(request, attempt);
    
    const response = await this.llm.invoke({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_plan',
          strict: true,
          schema: PLAN_SCHEMA
        }
      },
      timeout: this.config.planningTimeout
    });
    
    const planData = JSON.parse(response.choices[0].message.content);
    
    return {
      id: generateId('plan'),
      version: 1,
      goal: planData.goal,
      phases: planData.phases.map((p: any, i: number) => ({
        id: i + 1,
        title: p.title,
        description: p.description,
        capabilities: p.capabilities || {},
        estimatedSteps: p.estimated_steps || 5,
        status: 'pending'
      })),
      createdAt: Date.now(),
      metadata: {
        attempt,
        model: response.model,
        tokens: response.usage
      }
    };
  }
  
  private buildPlanningPrompt(request: PlanRequest, attempt: number): string {
    return `You are a task planner. Create a structured plan to achieve the user's goal.

## Rules
1. Break the task into ${this.config.minPhases}-${this.config.maxPhases} phases
2. Each phase should be a logical unit of work
3. Phases must be sequential (no parallel execution)
4. Include a final phase for delivering results to the user
5. Be specific about what each phase accomplishes

## Available Capabilities
${JSON.stringify(AVAILABLE_CAPABILITIES, null, 2)}

## Context
${request.context ? JSON.stringify(request.context) : 'None provided'}

${attempt > 1 ? `\n## Note\nThis is attempt ${attempt}. Previous attempts failed validation. Be more careful with phase definitions.` : ''}

Create a plan that achieves the user's goal efficiently.`;
  }
  
  validatePlan(plan: Plan, request: PlanRequest): ValidationResult {
    const issues: string[] = [];
    
    // Check phase count
    if (plan.phases.length < this.config.minPhases) {
      issues.push(`Too few phases: ${plan.phases.length} (min: ${this.config.minPhases})`);
    }
    if (plan.phases.length > this.config.maxPhases) {
      issues.push(`Too many phases: ${plan.phases.length} (max: ${this.config.maxPhases})`);
    }
    
    // Check goal coverage
    const goalCoverage = this.measureGoalCoverage(plan, request);
    if (goalCoverage < 0.7) {
      issues.push(`Insufficient goal coverage: ${(goalCoverage * 100).toFixed(0)}%`);
    }
    
    // Check phase validity
    for (const phase of plan.phases) {
      if (!phase.title || phase.title.length < 3) {
        issues.push(`Phase ${phase.id} has invalid title`);
      }
      if (this.config.requireCapabilities && Object.keys(phase.capabilities).length === 0) {
        issues.push(`Phase ${phase.id} has no capabilities defined`);
      }
    }
    
    // Check for delivery phase
    const hasDeliveryPhase = plan.phases.some(p => 
      p.title.toLowerCase().includes('deliver') ||
      p.title.toLowerCase().includes('result') ||
      p.title.toLowerCase().includes('present')
    );
    if (!hasDeliveryPhase) {
      issues.push('No delivery/result phase found');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      score: this.scorePlan(plan, request)
    };
  }
  
  private measureGoalCoverage(plan: Plan, request: PlanRequest): number {
    // Extract key concepts from goal
    const goalConcepts = extractConcepts(request.prompt);
    
    // Check how many are covered by phases
    const planText = plan.phases.map(p => `${p.title} ${p.description || ''}`).join(' ');
    const planConcepts = extractConcepts(planText);
    
    const covered = goalConcepts.filter(c => 
      planConcepts.some(pc => semanticSimilarity(c, pc) > 0.7)
    );
    
    return covered.length / goalConcepts.length;
  }
  
  scorePlan(plan: Plan, request: PlanRequest): PlanScore {
    const scores = {
      feasibility: this.scoreFeasibility(plan),
      completeness: this.measureGoalCoverage(plan, request),
      efficiency: this.scoreEfficiency(plan),
      clarity: this.scoreClarity(plan)
    };
    
    const weights = { feasibility: 0.3, completeness: 0.3, efficiency: 0.2, clarity: 0.2 };
    const composite = Object.entries(scores).reduce(
      (acc, [key, value]) => acc + value * weights[key as keyof typeof weights],
      0
    );
    
    return { ...scores, composite };
  }
  
  private scoreFeasibility(plan: Plan): number {
    let score = 1.0;
    
    for (const phase of plan.phases) {
      // Penalize phases with unknown capabilities
      const unknownCaps = Object.keys(phase.capabilities).filter(
        c => !AVAILABLE_CAPABILITIES.includes(c)
      );
      score -= unknownCaps.length * 0.1;
      
      // Penalize overly ambitious phases
      if ((phase.estimatedSteps || 5) > 20) {
        score -= 0.1;
      }
    }
    
    return Math.max(0, score);
  }
  
  private scoreEfficiency(plan: Plan): number {
    const totalSteps = plan.phases.reduce((acc, p) => acc + (p.estimatedSteps || 5), 0);
    
    // Optimal is 10-30 steps
    if (totalSteps < 10) return 0.8;  // Too simple, might miss things
    if (totalSteps <= 30) return 1.0;
    if (totalSteps <= 50) return 0.8;
    return 0.6;  // Too complex
  }
  
  private scoreClarity(plan: Plan): number {
    let score = 1.0;
    
    for (const phase of plan.phases) {
      // Penalize vague titles
      const vagueWords = ['do', 'handle', 'process', 'work on', 'deal with'];
      if (vagueWords.some(w => phase.title.toLowerCase().includes(w))) {
        score -= 0.1;
      }
      
      // Reward specific action verbs
      const actionVerbs = ['create', 'analyze', 'generate', 'extract', 'validate', 'implement'];
      if (actionVerbs.some(v => phase.title.toLowerCase().startsWith(v))) {
        score += 0.05;
      }
    }
    
    return Math.min(1, Math.max(0, score));
  }
}
```

#### 5.2 Plan Repair

```typescript
// packages/agent/src/planner/repair.ts

export type RepairStrategy =
  | 'adjust_parameters'
  | 'split_phase'
  | 'merge_phases'
  | 'add_phase'
  | 'remove_phase'
  | 'reorder_phases'
  | 'regenerate';

export interface RepairAction {
  strategy: RepairStrategy;
  target?: number;  // Phase ID
  details: any;
}

export class PlanRepairer {
  constructor(private llm: LLMClient) {}
  
  async repairPlan(
    plan: Plan,
    issues: string[],
    request: PlanRequest
  ): Promise<Plan> {
    // Determine repair strategy
    const actions = this.determineRepairActions(plan, issues);
    
    if (actions.length === 0 || actions[0].strategy === 'regenerate') {
      // Full regeneration needed
      return this.regeneratePlan(plan, issues, request);
    }
    
    // Apply repairs
    let repairedPlan = { ...plan };
    
    for (const action of actions) {
      repairedPlan = await this.applyRepair(repairedPlan, action, request);
    }
    
    // Increment version
    repairedPlan.version = plan.version + 1;
    
    return repairedPlan;
  }
  
  private determineRepairActions(plan: Plan, issues: string[]): RepairAction[] {
    const actions: RepairAction[] = [];
    
    for (const issue of issues) {
      if (issue.includes('Too few phases')) {
        actions.push({
          strategy: 'add_phase',
          details: { position: 'middle' }
        });
      } else if (issue.includes('Too many phases')) {
        actions.push({
          strategy: 'merge_phases',
          details: { criteria: 'similar_capabilities' }
        });
      } else if (issue.includes('Insufficient goal coverage')) {
        actions.push({
          strategy: 'add_phase',
          details: { position: 'before_delivery', focus: 'missing_concepts' }
        });
      } else if (issue.includes('invalid title')) {
        const phaseId = parseInt(issue.match(/Phase (\d+)/)?.[1] || '0');
        actions.push({
          strategy: 'adjust_parameters',
          target: phaseId,
          details: { field: 'title' }
        });
      } else if (issue.includes('No delivery')) {
        actions.push({
          strategy: 'add_phase',
          details: { position: 'end', type: 'delivery' }
        });
      }
    }
    
    // If too many repairs needed, just regenerate
    if (actions.length > 3) {
      return [{ strategy: 'regenerate', details: {} }];
    }
    
    return actions;
  }
  
  private async applyRepair(
    plan: Plan,
    action: RepairAction,
    request: PlanRequest
  ): Promise<Plan> {
    switch (action.strategy) {
      case 'add_phase':
        return this.addPhase(plan, action.details, request);
      
      case 'merge_phases':
        return this.mergePhases(plan, action.details);
      
      case 'split_phase':
        return this.splitPhase(plan, action.target!, action.details);
      
      case 'adjust_parameters':
        return this.adjustParameters(plan, action.target!, action.details);
      
      case 'remove_phase':
        return this.removePhase(plan, action.target!);
      
      case 'reorder_phases':
        return this.reorderPhases(plan, action.details);
      
      default:
        return plan;
    }
  }
  
  private async addPhase(
    plan: Plan,
    details: { position: string; type?: string; focus?: string },
    request: PlanRequest
  ): Promise<Plan> {
    // Generate new phase using LLM
    const prompt = `Given this plan:
${JSON.stringify(plan.phases, null, 2)}

And this goal: ${request.prompt}

Generate ONE additional phase to ${details.focus || 'improve coverage'}.
Position: ${details.position}
${details.type ? `Type: ${details.type}` : ''}

Return JSON: { "title": "...", "description": "...", "capabilities": {...} }`;

    const response = await this.llm.invoke({
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    
    const newPhase = JSON.parse(response.choices[0].message.content);
    
    // Determine insertion index
    let insertIndex: number;
    switch (details.position) {
      case 'start':
        insertIndex = 0;
        break;
      case 'end':
        insertIndex = plan.phases.length;
        break;
      case 'middle':
        insertIndex = Math.floor(plan.phases.length / 2);
        break;
      case 'before_delivery':
        insertIndex = plan.phases.length - 1;
        break;
      default:
        insertIndex = plan.phases.length;
    }
    
    // Insert and renumber
    const phases = [...plan.phases];
    phases.splice(insertIndex, 0, {
      id: 0,  // Will be renumbered
      title: newPhase.title,
      description: newPhase.description,
      capabilities: newPhase.capabilities || {},
      status: 'pending'
    });
    
    // Renumber all phases
    phases.forEach((p, i) => { p.id = i + 1; });
    
    return { ...plan, phases };
  }
  
  private mergePhases(
    plan: Plan,
    details: { criteria: string }
  ): Plan {
    const phases = [...plan.phases];
    
    // Find phases to merge based on criteria
    for (let i = 0; i < phases.length - 1; i++) {
      const current = phases[i];
      const next = phases[i + 1];
      
      let shouldMerge = false;
      
      if (details.criteria === 'similar_capabilities') {
        const currentCaps = Object.keys(current.capabilities);
        const nextCaps = Object.keys(next.capabilities);
        const overlap = currentCaps.filter(c => nextCaps.includes(c));
        shouldMerge = overlap.length >= Math.min(currentCaps.length, nextCaps.length) * 0.7;
      }
      
      if (shouldMerge) {
        // Merge next into current
        phases[i] = {
          ...current,
          title: `${current.title} and ${next.title}`,
          description: `${current.description || ''}\n${next.description || ''}`.trim(),
          capabilities: { ...current.capabilities, ...next.capabilities }
        };
        phases.splice(i + 1, 1);
        break;  // Only merge one pair per call
      }
    }
    
    // Renumber
    phases.forEach((p, i) => { p.id = i + 1; });
    
    return { ...plan, phases };
  }
  
  private async regeneratePlan(
    plan: Plan,
    issues: string[],
    request: PlanRequest
  ): Promise<Plan> {
    const prompt = `The previous plan had these issues:
${issues.join('\n')}

Previous plan:
${JSON.stringify(plan.phases, null, 2)}

Create a better plan that addresses these issues.`;

    // Use the main planner with enhanced context
    const planner = new Planner(this.llm);
    return planner.createPlan({
      ...request,
      context: {
        ...request.context,
        previousPlanIssues: issues,
        previousPlan: plan
      }
    });
  }
}
```

#### 5.3 Supervisor

```typescript
// packages/agent/src/supervisor/supervisor.ts

export interface SupervisorConfig {
  maxStepsPerPhase: number;
  maxConsecutiveErrors: number;
  checkpointInterval: number;
  progressTimeout: number;
}

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  maxStepsPerPhase: 30,
  maxConsecutiveErrors: 3,
  checkpointInterval: 5,
  progressTimeout: 60000
};

export class Supervisor {
  private state: SupervisorState;
  
  constructor(
    private run: Run,
    private toolRouter: ToolRouter,
    private memory: MemoryManager,
    private config: SupervisorConfig = DEFAULT_SUPERVISOR_CONFIG
  ) {
    this.state = {
      currentPhaseId: run.plan?.currentPhaseId || 1,
      stepCount: 0,
      consecutiveErrors: 0,
      lastProgressAt: Date.now(),
      checkpoints: []
    };
  }
  
  async execute(): Promise<ExecutionResult> {
    const plan = this.run.plan!;
    
    while (this.state.currentPhaseId <= plan.phases.length) {
      const phase = plan.phases.find(p => p.id === this.state.currentPhaseId)!;
      
      try {
        const phaseResult = await this.executePhase(phase);
        
        if (phaseResult.status === 'completed') {
          await this.advancePhase();
        } else if (phaseResult.status === 'needs_user_input') {
          return {
            status: 'waiting_user',
            prompt: phaseResult.userPrompt
          };
        } else if (phaseResult.status === 'failed') {
          return {
            status: 'failed',
            error: phaseResult.error
          };
        }
      } catch (error) {
        const handled = await this.handleError(error as Error, phase);
        if (!handled) {
          return {
            status: 'failed',
            error: error as Error
          };
        }
      }
    }
    
    return {
      status: 'completed',
      result: await this.gatherResults()
    };
  }
  
  private async executePhase(phase: Phase): Promise<PhaseResult> {
    let phaseSteps = 0;
    
    while (phaseSteps < this.config.maxStepsPerPhase) {
      // Check for stuck
      if (Date.now() - this.state.lastProgressAt > this.config.progressTimeout) {
        throw new StuckError(`No progress for ${this.config.progressTimeout}ms`);
      }
      
      // Get next action from LLM
      const context = await this.memory.getContext();
      const decision = await this.getNextAction(phase, context);
      
      if (decision.type === 'complete_phase') {
        return { status: 'completed' };
      }
      
      if (decision.type === 'need_user_input') {
        return {
          status: 'needs_user_input',
          userPrompt: decision.prompt
        };
      }
      
      if (decision.type === 'tool_call') {
        const result = await this.executeTool(decision.tool, decision.parameters);
        
        // Record step
        await this.recordStep({
          type: 'tool_call',
          tool: decision.tool,
          parameters: decision.parameters,
          result
        });
        
        // Update progress
        this.state.lastProgressAt = Date.now();
        this.state.consecutiveErrors = 0;
        phaseSteps++;
        this.state.stepCount++;
        
        // Checkpoint if needed
        if (this.state.stepCount % this.config.checkpointInterval === 0) {
          await this.saveCheckpoint();
        }
      }
    }
    
    // Max steps reached for phase
    throw new MaxStepsError(`Phase ${phase.id} exceeded max steps`);
  }
  
  private async getNextAction(
    phase: Phase,
    context: ContextWindow
  ): Promise<AgentDecision> {
    const systemPrompt = this.buildSystemPrompt(phase);
    
    const response = await this.llm.invoke({
      messages: [
        { role: 'system', content: systemPrompt },
        ...context.messages
      ],
      tools: this.toolRouter.getToolDefinitions(phase.capabilities),
      tool_choice: 'auto'
    });
    
    const message = response.choices[0].message;
    
    // Parse decision
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      return {
        type: 'tool_call',
        tool: toolCall.function.name,
        parameters: JSON.parse(toolCall.function.arguments)
      };
    }
    
    // Check for phase completion signal
    if (this.isPhaseComplete(message.content, phase)) {
      return { type: 'complete_phase' };
    }
    
    // Check for user input needed
    if (this.needsUserInput(message.content)) {
      return {
        type: 'need_user_input',
        prompt: this.extractUserPrompt(message.content)
      };
    }
    
    // Default: continue thinking
    return {
      type: 'think',
      thought: message.content
    };
  }
  
  private async executeTool(
    tool: string,
    parameters: any
  ): Promise<ToolResult> {
    const idempotencyKey = generateIdempotencyKey(this.run.id, tool, parameters);
    
    return executeIdempotent(
      idempotencyKey,
      IDEMPOTENCY_CONFIGS['step.execute'],
      async () => {
        return this.toolRouter.execute(tool, parameters, {
          runId: this.run.id,
          tenantId: this.run.tenantId,
          timeout: this.getToolTimeout(tool)
        });
      }
    );
  }
  
  private async handleError(error: Error, phase: Phase): Promise<boolean> {
    this.state.consecutiveErrors++;
    
    // Check if we should give up
    if (this.state.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      return false;
    }
    
    // Determine error type and recovery strategy
    const errorType = classifyError(error);
    
    switch (errorType) {
      case 'retryable':
        // Simple retry with backoff
        await sleep(1000 * this.state.consecutiveErrors);
        return true;
      
      case 'recoverable':
        // Try alternative approach
        await this.memory.addMessage({
          role: 'system',
          content: `Error occurred: ${error.message}. Try a different approach.`
        });
        return true;
      
      case 'stuck':
        // Attempt to replan
        const replanned = await this.attemptReplan(phase, error);
        return replanned;
      
      default:
        return false;
    }
  }
  
  private async attemptReplan(phase: Phase, error: Error): Promise<boolean> {
    try {
      const planner = new Planner(this.llm);
      const repairer = new PlanRepairer(this.llm);
      
      const newPlan = await repairer.repairPlan(
        this.run.plan!,
        [`Phase ${phase.id} failed: ${error.message}`],
        { prompt: this.run.prompt }
      );
      
      // Update run with new plan
      await updateRunPlan(this.run.id, newPlan);
      this.run.plan = newPlan;
      
      return true;
    } catch (replanError) {
      return false;
    }
  }
  
  private async saveCheckpoint(): Promise<void> {
    const checkpoint: Checkpoint = {
      id: generateId('ckpt'),
      runId: this.run.id,
      phaseId: this.state.currentPhaseId,
      stepCount: this.state.stepCount,
      memoryState: await this.memory.serialize(),
      createdAt: Date.now()
    };
    
    await saveCheckpoint(checkpoint);
    this.state.checkpoints.push(checkpoint.id);
  }
  
  private async advancePhase(): Promise<void> {
    this.state.currentPhaseId++;
    
    // Update run
    await updateRun(this.run.id, {
      'plan.currentPhaseId': this.state.currentPhaseId
    });
    
    // Publish event
    await publishEvent({
      type: 'run.phase_completed',
      runId: this.run.id,
      phaseId: this.state.currentPhaseId - 1
    });
  }
}
```

#### 5.4 Tool Router

```typescript
// packages/agent/src/tools/router.ts

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  capabilities: string[];
  timeout: number;
  costCredits: number;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'browser',
    description: 'Navigate web pages, click elements, fill forms, extract content',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['navigate', 'click', 'type', 'scroll', 'screenshot', 'extract']
        },
        url: { type: 'string' },
        selector: { type: 'string' },
        text: { type: 'string' },
        intent: { type: 'string', enum: ['navigational', 'informational', 'transactional'] }
      },
      required: ['action']
    },
    capabilities: ['web_browsing'],
    timeout: 60000,
    costCredits: 2,
    rateLimit: { max: 30, windowMs: 60000 }
  },
  {
    name: 'shell',
    description: 'Execute shell commands in sandbox',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['exec', 'view', 'send', 'kill'] },
        command: { type: 'string' },
        session: { type: 'string' },
        timeout: { type: 'number' }
      },
      required: ['action', 'session']
    },
    capabilities: ['code_execution'],
    timeout: 300000,
    costCredits: 1
  },
  {
    name: 'file',
    description: 'Read, write, edit files in sandbox',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write', 'edit', 'view', 'append'] },
        path: { type: 'string' },
        content: { type: 'string' },
        edits: { type: 'array' }
      },
      required: ['action', 'path']
    },
    capabilities: ['file_operations'],
    timeout: 30000,
    costCredits: 0.5
  },
  {
    name: 'search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['info', 'image', 'news', 'api', 'data', 'research'] },
        queries: { type: 'array', items: { type: 'string' }, maxItems: 3 },
        time: { type: 'string', enum: ['all', 'past_day', 'past_week', 'past_month', 'past_year'] }
      },
      required: ['type', 'queries']
    },
    capabilities: ['web_search'],
    timeout: 30000,
    costCredits: 1
  },
  {
    name: 'generate',
    description: 'Generate images using AI',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        style: { type: 'string' },
        size: { type: 'string', enum: ['1024x1024', '1792x1024', '1024x1792'] }
      },
      required: ['prompt']
    },
    capabilities: ['image_generation'],
    timeout: 120000,
    costCredits: 5
  },
  {
    name: 'slides',
    description: 'Create presentation slides',
    parameters: {
      type: 'object',
      properties: {
        content_file: { type: 'string' },
        slide_count: { type: 'number' },
        mode: { type: 'string', enum: ['html', 'image'] }
      },
      required: ['content_file', 'slide_count']
    },
    capabilities: ['slides_generation'],
    timeout: 300000,
    costCredits: 10
  }
];

export class ToolRouter {
  private executors: Map<string, ToolExecutor> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  
  constructor(private sandbox: SandboxManager) {
    this.registerExecutors();
  }
  
  private registerExecutors(): void {
    this.executors.set('browser', new BrowserExecutor(this.sandbox));
    this.executors.set('shell', new ShellExecutor(this.sandbox));
    this.executors.set('file', new FileExecutor(this.sandbox));
    this.executors.set('search', new SearchExecutor());
    this.executors.set('generate', new GenerateExecutor());
    this.executors.set('slides', new SlidesExecutor(this.sandbox));
  }
  
  getToolDefinitions(capabilities?: Record<string, boolean>): ToolDefinition[] {
    if (!capabilities) {
      return TOOL_DEFINITIONS;
    }
    
    return TOOL_DEFINITIONS.filter(tool => 
      tool.capabilities.every(cap => capabilities[cap] !== false)
    );
  }
  
  async execute(
    tool: string,
    parameters: any,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const definition = TOOL_DEFINITIONS.find(t => t.name === tool);
    if (!definition) {
      throw new Error(`Unknown tool: ${tool}`);
    }
    
    // Check rate limit
    if (definition.rateLimit) {
      const limiter = this.getRateLimiter(tool, context.tenantId, definition.rateLimit);
      const allowed = await limiter.check();
      if (!allowed) {
        throw new RateLimitError(`Tool ${tool} rate limit exceeded`);
      }
    }
    
    // Validate parameters
    const validation = validateParameters(parameters, definition.parameters);
    if (!validation.valid) {
      throw new ValidationError(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    // Execute with timeout
    const executor = this.executors.get(tool)!;
    const startTime = Date.now();
    
    try {
      const result = await withTimeout(
        executor.execute(parameters, context),
        definition.timeout
      );
      
      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        credits: definition.costCredits
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: classifyToolError(error as Error),
          message: (error as Error).message
        },
        duration: Date.now() - startTime,
        credits: definition.costCredits * 0.5  // Partial charge on failure
      };
    }
  }
  
  private getRateLimiter(
    tool: string,
    tenantId: string,
    config: { max: number; windowMs: number }
  ): RateLimiter {
    const key = `${tool}:${tenantId}`;
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new RateLimiter(config));
    }
    return this.rateLimiters.get(key)!;
  }
}
```

#### 5.5 Memory Manager

```typescript
// packages/agent/src/memory/context.ts

export interface MemoryConfig {
  maxTokens: number;
  reservedTokens: number;  // For system prompt and response
  compressionThreshold: number;
  summarizationModel: string;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxTokens: 128000,
  reservedTokens: 8000,
  compressionThreshold: 0.8,
  summarizationModel: 'claude-3-haiku'
};

export class MemoryManager {
  private messages: Message[] = [];
  private summaries: Summary[] = [];
  private artifacts: Map<string, ArtifactReference> = new Map();
  
  constructor(
    private config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
    private tokenCounter: TokenCounter
  ) {}
  
  async addMessage(message: Message): Promise<void> {
    this.messages.push(message);
    
    // Check if compression needed
    const usage = await this.getTokenUsage();
    if (usage.ratio > this.config.compressionThreshold) {
      await this.compress();
    }
  }
  
  async getContext(): Promise<ContextWindow> {
    const availableTokens = this.config.maxTokens - this.config.reservedTokens;
    
    // Build context from most recent messages
    const contextMessages: Message[] = [];
    let tokenCount = 0;
    
    // Always include summaries first
    for (const summary of this.summaries) {
      const summaryMessage: Message = {
        role: 'system',
        content: `[Previous context summary]\n${summary.content}`
      };
      const tokens = await this.tokenCounter.count(summaryMessage);
      if (tokenCount + tokens <= availableTokens) {
        contextMessages.push(summaryMessage);
        tokenCount += tokens;
      }
    }
    
    // Add recent messages (newest first, then reverse)
    const recentMessages: Message[] = [];
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      const tokens = await this.tokenCounter.count(message);
      
      if (tokenCount + tokens <= availableTokens) {
        recentMessages.unshift(message);
        tokenCount += tokens;
      } else {
        break;
      }
    }
    
    contextMessages.push(...recentMessages);
    
    return {
      messages: contextMessages,
      tokenCount,
      hasCompression: this.summaries.length > 0
    };
  }
  
  private async compress(): Promise<void> {
    // Find messages to summarize (older half)
    const midpoint = Math.floor(this.messages.length / 2);
    const toSummarize = this.messages.slice(0, midpoint);
    
    if (toSummarize.length < 5) return;  // Not enough to summarize
    
    // Generate summary
    const summary = await this.generateSummary(toSummarize);
    
    // Store summary and remove original messages
    this.summaries.push(summary);
    this.messages = this.messages.slice(midpoint);
  }
  
  private async generateSummary(messages: Message[]): Promise<Summary> {
    const content = messages.map(m => `${m.role}: ${truncate(m.content, 500)}`).join('\n');
    
    const response = await invokeLLM({
      model: this.config.summarizationModel,
      messages: [
        {
          role: 'system',
          content: `Summarize this conversation context concisely. 
                    Focus on: key decisions, important findings, current state, pending tasks.
                    Keep under 500 words.`
        },
        {
          role: 'user',
          content
        }
      ],
      max_tokens: 1000
    });
    
    return {
      id: generateId('sum'),
      content: response.choices[0].message.content,
      messageCount: messages.length,
      createdAt: Date.now()
    };
  }
  
  async serialize(): Promise<SerializedMemory> {
    return {
      messages: this.messages,
      summaries: this.summaries,
      artifacts: Object.fromEntries(this.artifacts)
    };
  }
  
  static async deserialize(data: SerializedMemory, config?: MemoryConfig): Promise<MemoryManager> {
    const manager = new MemoryManager(config);
    manager.messages = data.messages;
    manager.summaries = data.summaries;
    manager.artifacts = new Map(Object.entries(data.artifacts));
    return manager;
  }
  
  private async getTokenUsage(): Promise<{ count: number; ratio: number }> {
    let count = 0;
    for (const message of this.messages) {
      count += await this.tokenCounter.count(message);
    }
    for (const summary of this.summaries) {
      count += await this.tokenCounter.count({ role: 'system', content: summary.content });
    }
    
    return {
      count,
      ratio: count / (this.config.maxTokens - this.config.reservedTokens)
    };
  }
}
```

---

## 6. Document Generation

### PR-007: Document Generation

#### 6.1 Slides Pipeline

```typescript
// packages/docgen/src/slides/pipeline.ts

export interface SlidesPipelineConfig {
  maxSlides: number;
  defaultTemplate: string;
  imageQuality: 'draft' | 'standard' | 'high';
  chartRenderer: 'chartjs' | 'd3' | 'plotly';
}

export const DEFAULT_SLIDES_CONFIG: SlidesPipelineConfig = {
  maxSlides: 50,
  defaultTemplate: 'professional',
  imageQuality: 'standard',
  chartRenderer: 'chartjs'
};

export class SlidesPipeline {
  constructor(
    private config: SlidesPipelineConfig = DEFAULT_SLIDES_CONFIG,
    private imageGenerator: ImageGenerator,
    private chartRenderer: ChartRenderer
  ) {}
  
  async generate(request: SlidesRequest): Promise<GeneratedSlides> {
    // PHASE 1: Parse content outline
    const outline = await this.parseOutline(request.contentFile);
    
    // PHASE 2: Validate and normalize
    const normalized = this.normalizeOutline(outline);
    
    // PHASE 3: Generate slide content
    const slides = await this.generateSlideContent(normalized, request);
    
    // PHASE 4: Generate visuals
    const withVisuals = await this.generateVisuals(slides, request);
    
    // PHASE 5: Apply template
    const styled = await this.applyTemplate(withVisuals, request.template);
    
    // PHASE 6: Generate speaker notes
    const withNotes = request.includeSpeakerNotes 
      ? await this.generateSpeakerNotes(styled)
      : styled;
    
    // PHASE 7: Render
    const rendered = await this.render(withNotes, request.mode);
    
    return rendered;
  }
  
  private async parseOutline(contentFile: string): Promise<SlideOutline> {
    const content = await readFile(contentFile, 'utf-8');
    
    // Parse markdown structure
    const lines = content.split('\n');
    const slides: SlideOutlineItem[] = [];
    let currentSlide: SlideOutlineItem | null = null;
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        // Title slide
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          type: 'title',
          title: line.slice(2).trim(),
          content: []
        };
      } else if (line.startsWith('## ')) {
        // Section slide
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          type: 'section',
          title: line.slice(3).trim(),
          content: []
        };
      } else if (line.startsWith('### ')) {
        // Content slide
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          type: 'content',
          title: line.slice(4).trim(),
          content: []
        };
      } else if (line.startsWith('- ') && currentSlide) {
        // Bullet point
        currentSlide.content.push({
          type: 'bullet',
          text: line.slice(2).trim()
        });
      } else if (line.startsWith('```chart')) {
        // Chart definition
        const chartEnd = lines.indexOf('```', lines.indexOf(line) + 1);
        const chartDef = lines.slice(lines.indexOf(line) + 1, chartEnd).join('\n');
        if (currentSlide) {
          currentSlide.content.push({
            type: 'chart',
            definition: JSON.parse(chartDef)
          });
        }
      } else if (line.startsWith('![')) {
        // Image
        const match = line.match(/!\[(.*?)\]\((.*?)\)/);
        if (match && currentSlide) {
          currentSlide.content.push({
            type: 'image',
            alt: match[1],
            src: match[2]
          });
        }
      }
    }
    
    if (currentSlide) slides.push(currentSlide);
    
    return { slides };
  }
  
  private normalizeOutline(outline: SlideOutline): NormalizedOutline {
    const normalized: NormalizedSlide[] = [];
    
    for (const item of outline.slides) {
      // Validate content limits
      const validatedContent = this.validateSlideContent(item);
      
      normalized.push({
        ...item,
        content: validatedContent,
        layout: this.determineLayout(item)
      });
    }
    
    return { slides: normalized };
  }
  
  private validateSlideContent(slide: SlideOutlineItem): SlideContent[] {
    const rules = SLIDE_CONTENT_RULES[slide.type] || SLIDE_CONTENT_RULES['content'];
    const validated: SlideContent[] = [];
    
    // Limit bullets
    const bullets = slide.content.filter(c => c.type === 'bullet');
    if (bullets.length > rules.max_bullet_points) {
      // Split into multiple slides or summarize
      validated.push(...bullets.slice(0, rules.max_bullet_points));
    } else {
      validated.push(...bullets);
    }
    
    // Validate bullet length
    for (const item of validated) {
      if (item.type === 'bullet') {
        const words = item.text.split(' ');
        if (words.length > rules.max_words_per_bullet) {
          item.text = words.slice(0, rules.max_words_per_bullet).join(' ') + '...';
        }
      }
    }
    
    // Add non-bullet content
    validated.push(...slide.content.filter(c => c.type !== 'bullet'));
    
    return validated;
  }
  
  private determineLayout(slide: SlideOutlineItem): SlideLayout {
    const hasChart = slide.content.some(c => c.type === 'chart');
    const hasImage = slide.content.some(c => c.type === 'image');
    const bulletCount = slide.content.filter(c => c.type === 'bullet').length;
    
    if (slide.type === 'title') return 'title_centered';
    if (slide.type === 'section') return 'section_header';
    if (hasChart && bulletCount > 0) return 'split_chart_left';
    if (hasChart) return 'full_chart';
    if (hasImage && bulletCount > 0) return 'split_image_right';
    if (hasImage) return 'full_image';
    if (bulletCount > 4) return 'two_column';
    return 'single_column';
  }
  
  private async generateVisuals(
    slides: NormalizedSlide[],
    request: SlidesRequest
  ): Promise<NormalizedSlide[]> {

    const withVisuals: NormalizedSlide[] = [];
    
    for (const slide of slides) {
      const processedContent: SlideContent[] = [];
      
      for (const content of slide.content) {
        if (content.type === 'chart') {
          // Render chart
          const chartImage = await this.chartRenderer.render(
            content.definition,
            { quality: this.config.imageQuality }
          );
          processedContent.push({
            type: 'image',
            src: chartImage.path,
            alt: content.definition.title || 'Chart'
          });
        } else if (content.type === 'image' && content.src.startsWith('generate:')) {
          // AI-generated image
          const prompt = content.src.replace('generate:', '');
          const generated = await this.imageGenerator.generate({
            prompt,
            style: request.imageStyle || 'professional'
          });
          processedContent.push({
            type: 'image',
            src: generated.path,
            alt: content.alt
          });
        } else {
          processedContent.push(content);
        }
      }
      
      withVisuals.push({ ...slide, content: processedContent });
    }
    
    return withVisuals;
  }
  
  private async generateSpeakerNotes(slides: NormalizedSlide[]): Promise<NormalizedSlide[]> {
    const withNotes: NormalizedSlide[] = [];
    
    for (const slide of slides) {
      const notes = await this.generateNotesForSlide(slide);
      withNotes.push({ ...slide, speakerNotes: notes });
    }
    
    return withNotes;
  }
  
  private async generateNotesForSlide(slide: NormalizedSlide): Promise<string> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate concise speaker notes for this presentation slide.
                    Include: key talking points, transitions, timing suggestions.
                    Keep under 150 words.`
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: slide.title,
            content: slide.content.map(c => c.type === 'bullet' ? c.text : `[${c.type}]`)
          })
        }
      ],
      max_tokens: 300
    });
    
    return response.choices[0].message.content;
  }
  
  private async render(
    slides: NormalizedSlide[],
    mode: 'html' | 'image'
  ): Promise<GeneratedSlides> {
    if (mode === 'html') {
      return this.renderHTML(slides);
    } else {
      return this.renderImages(slides);
    }
  }
  
  private async renderHTML(slides: NormalizedSlide[]): Promise<GeneratedSlides> {
    const htmlSlides: RenderedSlide[] = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const html = this.slideToHTML(slide, i);
      htmlSlides.push({
        index: i,
        html,
        speakerNotes: slide.speakerNotes
      });
    }
    
    return {
      type: 'html',
      slides: htmlSlides,
      metadata: {
        slideCount: slides.length,
        generatedAt: Date.now()
      }
    };
  }
  
  private slideToHTML(slide: NormalizedSlide, index: number): string {
    const layoutClass = `layout-${slide.layout}`;
    
    return `
      <section class="slide ${layoutClass}" data-index="${index}">
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        <div class="slide-content">
          ${slide.content.map(c => this.contentToHTML(c)).join('\n')}
        </div>
      </section>
    `;
  }
  
  private contentToHTML(content: SlideContent): string {
    switch (content.type) {
      case 'bullet':
        return `<li class="bullet">${escapeHtml(content.text)}</li>`;
      case 'image':
        return `<img src="${content.src}" alt="${escapeHtml(content.alt)}" class="slide-image" />`;
      default:
        return '';
    }
  }
}

// Slide content validation rules
const SLIDE_CONTENT_RULES = {
  title: {
    max_bullet_points: 0,
    max_words_per_bullet: 0
  },
  section: {
    max_bullet_points: 3,
    max_words_per_bullet: 10
  },
  content: {
    max_bullet_points: 6,
    max_words_per_bullet: 15
  }
};
```

#### 6.2 Chart Pipeline

```typescript
// packages/docgen/src/charts/pipeline.ts

export interface ChartDefinition {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'area';
  title?: string;
  data: ChartData;
  options?: ChartOptions;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
}

export class ChartRenderer {
  constructor(
    private renderer: 'chartjs' | 'd3' | 'plotly' = 'chartjs'
  ) {}
  
  async render(
    definition: ChartDefinition,
    options: RenderOptions = {}
  ): Promise<RenderedChart> {
    // Validate data
    const validation = this.validateChartData(definition);
    if (!validation.valid) {
      throw new ChartValidationError(validation.errors);
    }
    
    // Select appropriate chart type
    const chartType = this.selectChartType(definition);
    
    // Generate chart
    switch (this.renderer) {
      case 'chartjs':
        return this.renderChartJS(definition, chartType, options);
      case 'd3':
        return this.renderD3(definition, chartType, options);
      case 'plotly':
        return this.renderPlotly(definition, chartType, options);
    }
  }
  
  private validateChartData(definition: ChartDefinition): ValidationResult {
    const errors: string[] = [];
    
    // Check data presence
    if (!definition.data || !definition.data.datasets) {
      errors.push('Missing chart data');
      return { valid: false, errors };
    }
    
    // Check label/data alignment
    const labelCount = definition.data.labels?.length || 0;
    for (const dataset of definition.data.datasets) {
      if (dataset.data.length !== labelCount) {
        errors.push(`Dataset "${dataset.label}" has ${dataset.data.length} points but ${labelCount} labels`);
      }
    }
    
    // Check for valid numbers
    for (const dataset of definition.data.datasets) {
      for (let i = 0; i < dataset.data.length; i++) {
        if (typeof dataset.data[i] !== 'number' || isNaN(dataset.data[i])) {
          errors.push(`Invalid data point at index ${i} in dataset "${dataset.label}"`);
        }
      }
    }
    
    // Check chart type validity
    const validTypes = ['bar', 'line', 'pie', 'doughnut', 'scatter', 'radar', 'area'];
    if (!validTypes.includes(definition.type)) {
      errors.push(`Invalid chart type: ${definition.type}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private selectChartType(definition: ChartDefinition): RecommendedChartType {
    const datasetCount = definition.data.datasets.length;
    const pointCount = definition.data.labels?.length || 0;
    const hasNegatives = definition.data.datasets.some(d => d.data.some(v => v < 0));
    
    // Data-driven recommendations
    if (definition.type === 'pie' && datasetCount > 1) {
      return { type: 'bar', reason: 'Pie charts work best with single dataset' };
    }
    
    if (definition.type === 'pie' && pointCount > 7) {
      return { type: 'bar', reason: 'Too many slices for pie chart' };
    }
    
    if (definition.type === 'line' && pointCount < 3) {
      return { type: 'bar', reason: 'Line charts need at least 3 points' };
    }
    
    if (hasNegatives && ['pie', 'doughnut'].includes(definition.type)) {
      return { type: 'bar', reason: 'Pie/doughnut cannot show negative values' };
    }
    
    return { type: definition.type, reason: null };
  }
  
  private async renderChartJS(
    definition: ChartDefinition,
    chartType: RecommendedChartType,
    options: RenderOptions
  ): Promise<RenderedChart> {
    const width = options.width || 800;
    const height = options.height || 600;
    
    // Create canvas using node-canvas
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Import Chart.js
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    
    // Create chart
    new Chart(ctx as any, {
      type: chartType.type,
      data: definition.data,
      options: {
        ...definition.options,
        responsive: false,
        animation: false,
        plugins: {
          title: {
            display: !!definition.title,
            text: definition.title
          }
        }
      }
    });
    
    // Export to PNG
    const buffer = canvas.toBuffer('image/png');
    const path = `/tmp/chart_${generateId()}.png`;
    await writeFile(path, buffer);
    
    return {
      path,
      width,
      height,
      format: 'png',
      chartType: chartType.type,
      warning: chartType.reason
    };
  }
}
```

#### 6.3 Deterministic Testing

```typescript
// packages/docgen/src/testing/deterministic.ts

export interface DeterministicTestConfig {
  seed: number;
  mockLLM: boolean;
  mockImages: boolean;
  snapshotDir: string;
}

export class DeterministicTestRunner {
  constructor(private config: DeterministicTestConfig) {}
  
  async runTest(testCase: SlideTestCase): Promise<TestResult> {
    // Set deterministic seed
    seedRandom(this.config.seed);
    
    // Create mocked dependencies
    const llm = this.config.mockLLM 
      ? new MockLLM(testCase.expectedLLMResponses)
      : new RealLLM();
    
    const imageGen = this.config.mockImages
      ? new MockImageGenerator(testCase.expectedImages)
      : new RealImageGenerator();
    
    // Run pipeline
    const pipeline = new SlidesPipeline(
      DEFAULT_SLIDES_CONFIG,
      imageGen,
      new ChartRenderer()
    );
    
    const result = await pipeline.generate(testCase.input);
    
    // Compare with snapshot
    const snapshotPath = `${this.config.snapshotDir}/${testCase.name}.json`;
    const comparison = await this.compareWithSnapshot(result, snapshotPath);
    
    return {
      passed: comparison.matches,
      differences: comparison.differences,
      result
    };
  }
  
  private async compareWithSnapshot(
    result: GeneratedSlides,
    snapshotPath: string
  ): Promise<SnapshotComparison> {
    // Normalize result for comparison (remove timestamps, etc.)
    const normalized = this.normalizeForSnapshot(result);
    
    try {
      const snapshot = JSON.parse(await readFile(snapshotPath, 'utf-8'));
      const differences = this.findDifferences(normalized, snapshot);
      
      return {
        matches: differences.length === 0,
        differences
      };
    } catch (error) {
      // No snapshot exists, create one
      await writeFile(snapshotPath, JSON.stringify(normalized, null, 2));
      return { matches: true, differences: [], newSnapshot: true };
    }
  }
  
  private normalizeForSnapshot(result: GeneratedSlides): any {
    return {
      type: result.type,
      slideCount: result.slides.length,
      slides: result.slides.map(s => ({
        index: s.index,
        htmlHash: hashString(s.html),
        hasNotes: !!s.speakerNotes
      }))
    };
  }
  
  private findDifferences(actual: any, expected: any, path = ''): Difference[] {
    const differences: Difference[] = [];
    
    if (typeof actual !== typeof expected) {
      differences.push({
        path,
        expected: typeof expected,
        actual: typeof actual,
        type: 'type_mismatch'
      });
      return differences;
    }
    
    if (Array.isArray(actual)) {
      if (actual.length !== expected.length) {
        differences.push({
          path: `${path}.length`,
          expected: expected.length,
          actual: actual.length,
          type: 'array_length'
        });
      }
      
      for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
        differences.push(...this.findDifferences(actual[i], expected[i], `${path}[${i}]`));
      }
    } else if (typeof actual === 'object' && actual !== null) {
      const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
      for (const key of allKeys) {
        differences.push(...this.findDifferences(actual[key], expected[key], `${path}.${key}`));
      }
    } else if (actual !== expected) {
      differences.push({
        path,
        expected,
        actual,
        type: 'value_mismatch'
      });
    }
    
    return differences;
  }
}

// Example test cases
export const SLIDE_TEST_CASES: SlideTestCase[] = [
  {
    name: 'basic_presentation',
    input: {
      contentFile: 'fixtures/basic_outline.md',
      mode: 'html',
      template: 'professional'
    },
    expectedLLMResponses: [
      { prompt: /speaker notes/i, response: 'This slide introduces the main topic...' }
    ],
    expectedImages: []
  },
  {
    name: 'chart_presentation',
    input: {
      contentFile: 'fixtures/chart_outline.md',
      mode: 'html',
      template: 'data'
    },
    expectedLLMResponses: [],
    expectedImages: [
      { prompt: /chart/, path: 'fixtures/mock_chart.png' }
    ]
  }
];
```

---

## 7. Observability

### PR-008: Observability Stack

#### 7.1 Metrics Definitions

```typescript
// packages/observability/src/metrics.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

// Run metrics
export const runMetrics = {
  created: new Counter({
    name: 'manus_runs_created_total',
    help: 'Total runs created',
    labelNames: ['tenant_id', 'source'],
    registers: [registry]
  }),
  
  completed: new Counter({
    name: 'manus_runs_completed_total',
    help: 'Total runs completed',
    labelNames: ['tenant_id', 'status'],
    registers: [registry]
  }),
  
  duration: new Histogram({
    name: 'manus_run_duration_seconds',
    help: 'Run duration in seconds',
    labelNames: ['tenant_id', 'status'],
    buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
    registers: [registry]
  }),
  
  active: new Gauge({
    name: 'manus_runs_active',
    help: 'Currently active runs',
    labelNames: ['tenant_id', 'status'],
    registers: [registry]
  }),
  
  steps: new Histogram({
    name: 'manus_run_steps_total',
    help: 'Steps per run',
    labelNames: ['tenant_id'],
    buckets: [1, 5, 10, 20, 50, 100, 200],
    registers: [registry]
  })
};

// Step metrics
export const stepMetrics = {
  executed: new Counter({
    name: 'manus_steps_executed_total',
    help: 'Total steps executed',
    labelNames: ['tool', 'status'],
    registers: [registry]
  }),
  
  duration: new Histogram({
    name: 'manus_step_duration_seconds',
    help: 'Step duration in seconds',
    labelNames: ['tool'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [registry]
  }),
  
  errors: new Counter({
    name: 'manus_step_errors_total',
    help: 'Step errors',
    labelNames: ['tool', 'error_code'],
    registers: [registry]
  })
};

// LLM metrics
export const llmMetrics = {
  requests: new Counter({
    name: 'manus_llm_requests_total',
    help: 'LLM API requests',
    labelNames: ['model', 'status'],
    registers: [registry]
  }),
  
  tokens: new Counter({
    name: 'manus_llm_tokens_total',
    help: 'LLM tokens used',
    labelNames: ['model', 'type'],  // type: input/output
    registers: [registry]
  }),
  
  latency: new Histogram({
    name: 'manus_llm_latency_seconds',
    help: 'LLM request latency',
    labelNames: ['model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [registry]
  }),
  
  rateLimited: new Counter({
    name: 'manus_llm_rate_limited_total',
    help: 'LLM rate limit hits',
    labelNames: ['model'],
    registers: [registry]
  })
};

// Queue metrics
export const queueMetrics = {
  depth: new Gauge({
    name: 'manus_queue_depth',
    help: 'Queue depth',
    labelNames: ['queue'],
    registers: [registry]
  }),
  
  processed: new Counter({
    name: 'manus_queue_processed_total',
    help: 'Jobs processed',
    labelNames: ['queue', 'status'],
    registers: [registry]
  }),
  
  latency: new Histogram({
    name: 'manus_queue_latency_seconds',
    help: 'Job processing latency',
    labelNames: ['queue'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
    registers: [registry]
  }),
  
  dlqSize: new Gauge({
    name: 'manus_dlq_size',
    help: 'Dead letter queue size',
    labelNames: ['queue'],
    registers: [registry]
  })
};

// Billing metrics
export const billingMetrics = {
  creditsConsumed: new Counter({
    name: 'manus_credits_consumed_total',
    help: 'Credits consumed',
    labelNames: ['tenant_id', 'type'],  // type: llm/tool/storage
    registers: [registry]
  }),
  
  creditsRemaining: new Gauge({
    name: 'manus_credits_remaining',
    help: 'Credits remaining',
    labelNames: ['tenant_id'],
    registers: [registry]
  })
};
```

#### 7.2 SLO Definitions

```typescript
// packages/observability/src/slo.ts

export interface SLODefinition {
  name: string;
  description: string;
  target: number;  // 0-1
  window: '30d' | '7d' | '1d';
  indicator: SLIDefinition;
  burnRateAlerts: BurnRateAlert[];
}

export interface SLIDefinition {
  type: 'availability' | 'latency' | 'throughput' | 'error_rate';
  query: string;  // PromQL
  threshold?: number;
}

export interface BurnRateAlert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  shortWindow: string;
  longWindow: string;
  burnRate: number;
}

export const SLO_DEFINITIONS: SLODefinition[] = [
  {
    name: 'run_success_rate',
    description: 'Percentage of runs that complete successfully',
    target: 0.95,
    window: '30d',
    indicator: {
      type: 'availability',
      query: `
        sum(rate(manus_runs_completed_total{status="completed"}[5m]))
        /
        sum(rate(manus_runs_completed_total[5m]))
      `
    },
    burnRateAlerts: [
      {
        name: 'run_success_rate_critical',
        severity: 'critical',
        shortWindow: '5m',
        longWindow: '1h',
        burnRate: 14.4  // 2% of monthly budget in 1 hour
      },
      {
        name: 'run_success_rate_warning',
        severity: 'warning',
        shortWindow: '30m',
        longWindow: '6h',
        burnRate: 6  // 5% of monthly budget in 6 hours
      }
    ]
  },
  {
    name: 'run_latency_p99',
    description: '99th percentile run completion time under 1 hour',
    target: 0.99,
    window: '30d',
    indicator: {
      type: 'latency',
      query: `
        histogram_quantile(0.99, 
          sum(rate(manus_run_duration_seconds_bucket[5m])) by (le)
        )
      `,
      threshold: 3600  // 1 hour
    },
    burnRateAlerts: [
      {
        name: 'run_latency_critical',
        severity: 'critical',
        shortWindow: '5m',
        longWindow: '1h',
        burnRate: 14.4
      }
    ]
  },
  {
    name: 'api_availability',
    description: 'API endpoint availability',
    target: 0.999,
    window: '30d',
    indicator: {
      type: 'availability',
      query: `
        sum(rate(http_requests_total{status!~"5.."}[5m]))
        /
        sum(rate(http_requests_total[5m]))
      `
    },
    burnRateAlerts: [
      {
        name: 'api_availability_critical',
        severity: 'critical',
        shortWindow: '2m',
        longWindow: '15m',
        burnRate: 14.4
      },
      {
        name: 'api_availability_warning',
        severity: 'warning',
        shortWindow: '15m',
        longWindow: '1h',
        burnRate: 6
      }
    ]
  },
  {
    name: 'llm_latency_p95',
    description: '95th percentile LLM response time under 30s',
    target: 0.95,
    window: '7d',
    indicator: {
      type: 'latency',
      query: `
        histogram_quantile(0.95,
          sum(rate(manus_llm_latency_seconds_bucket[5m])) by (le)
        )
      `,
      threshold: 30
    },
    burnRateAlerts: [
      {
        name: 'llm_latency_warning',
        severity: 'warning',
        shortWindow: '10m',
        longWindow: '1h',
        burnRate: 6
      }
    ]
  }
];

// Generate Prometheus recording rules
export function generateRecordingRules(): string {
  const rules: string[] = [];
  
  for (const slo of SLO_DEFINITIONS) {
    // SLI recording rule
    rules.push(`
- record: sli:${slo.name}
  expr: ${slo.indicator.query.replace(/\n/g, ' ').trim()}
`);
    
    // Error budget recording rule
    rules.push(`
- record: error_budget:${slo.name}
  expr: 1 - sli:${slo.name}
`);
    
    // Burn rate rules for each alert
    for (const alert of slo.burnRateAlerts) {
      rules.push(`
- record: burn_rate:${slo.name}:${alert.shortWindow}
  expr: |
    (
      1 - (
        sum(increase(manus_runs_completed_total{status="completed"}[${alert.shortWindow}]))
        /
        sum(increase(manus_runs_completed_total[${alert.shortWindow}]))
      )
    ) / (1 - ${slo.target})
`);
    }
  }
  
  return rules.join('\n');
}

// Generate alerting rules
export function generateAlertingRules(): string {
  const alerts: string[] = [];
  
  for (const slo of SLO_DEFINITIONS) {
    for (const alert of slo.burnRateAlerts) {
      alerts.push(`
- alert: ${alert.name}
  expr: |
    burn_rate:${slo.name}:${alert.shortWindow} > ${alert.burnRate}
    and
    burn_rate:${slo.name}:${alert.longWindow} > ${alert.burnRate}
  for: 2m
  labels:
    severity: ${alert.severity}
    slo: ${slo.name}
  annotations:
    summary: "SLO ${slo.name} burning error budget too fast"
    description: "Burn rate is {{ $value }} (threshold: ${alert.burnRate})"
`);
    }
  }
  
  return alerts.join('\n');
}
```

#### 7.3 Tracing

```typescript
// packages/observability/src/tracing.ts
import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export const tracer = trace.getTracer('manus', '1.0.0');

export interface TraceContext {
  traceId: string;
  spanId: string;
  runId?: string;
  tenantId?: string;
}

export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  return tracer.startActiveSpan(name, options || {}, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Trace decorators
export function Traced(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = spanName || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      return withSpan(name, async (span) => {
        // Add method arguments as attributes
        span.setAttribute('args', JSON.stringify(args).slice(0, 1000));
        return originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
}

// Run tracing
export async function traceRun<T>(
  runId: string,
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan('run.execute', async (span) => {
    span.setAttributes({
      'run.id': runId,
      'tenant.id': tenantId
    });
    
    return fn();
  }, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'run.id': runId,
      'tenant.id': tenantId
    }
  });
}

// Step tracing
export async function traceStep<T>(
  stepId: string,
  tool: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`step.${tool}`, async (span) => {
    span.setAttributes({
      'step.id': stepId,
      'step.tool': tool
    });
    
    return fn();
  }, {
    kind: SpanKind.INTERNAL
  });
}

// LLM tracing
export async function traceLLM<T>(
  model: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan('llm.invoke', async (span) => {
    span.setAttributes({
      'llm.model': model
    });
    
    const result = await fn();
    
    // Add token counts if available
    if ((result as any).usage) {
      span.setAttributes({
        'llm.tokens.input': (result as any).usage.prompt_tokens,
        'llm.tokens.output': (result as any).usage.completion_tokens
      });
    }
    
    return result;
  }, {
    kind: SpanKind.CLIENT
  });
}
```

#### 7.4 Dashboards

```typescript
// packages/observability/src/dashboards.ts

export interface GrafanaDashboard {
  title: string;
  uid: string;
  panels: GrafanaPanel[];
}

export const DASHBOARDS: GrafanaDashboard[] = [
  {
    title: 'Manus Overview',
    uid: 'manus-overview',
    panels: [
      {
        title: 'Active Runs',
        type: 'stat',
        query: 'sum(manus_runs_active)',
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Run Success Rate (24h)',
        type: 'gauge',
        query: `
          sum(increase(manus_runs_completed_total{status="completed"}[24h]))
          /
          sum(increase(manus_runs_completed_total[24h]))
        `,
        thresholds: [
          { value: 0.9, color: 'red' },
          { value: 0.95, color: 'yellow' },
          { value: 0.99, color: 'green' }
        ],
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Runs Created (Rate)',
        type: 'timeseries',
        query: 'sum(rate(manus_runs_created_total[5m]))',
        position: { x: 0, y: 4, w: 12, h: 6 }
      },
      {
        title: 'Run Duration Distribution',
        type: 'heatmap',
        query: 'sum(rate(manus_run_duration_seconds_bucket[5m])) by (le)',
        position: { x: 0, y: 10, w: 12, h: 6 }
      },
      {
        title: 'Error Rate by Tool',
        type: 'timeseries',
        query: `
          sum(rate(manus_step_errors_total[5m])) by (tool)
          /
          sum(rate(manus_steps_executed_total[5m])) by (tool)
        `,
        position: { x: 0, y: 16, w: 12, h: 6 }
      }
    ]
  },
  {
    title: 'Manus SLOs',
    uid: 'manus-slos',
    panels: [
      {
        title: 'Run Success Rate SLO',
        type: 'timeseries',
        queries: [
          { expr: 'sli:run_success_rate', legend: 'Current' },
          { expr: '0.95', legend: 'Target (95%)' }
        ],
        position: { x: 0, y: 0, w: 12, h: 6 }
      },
      {
        title: 'Error Budget Remaining',
        type: 'gauge',
        query: `
          1 - (
            (1 - sli:run_success_rate) / (1 - 0.95)
          )
        `,
        thresholds: [
          { value: 0, color: 'red' },
          { value: 0.25, color: 'yellow' },
          { value: 0.5, color: 'green' }
        ],
        position: { x: 0, y: 6, w: 6, h: 4 }
      },
      {
        title: 'Burn Rate (1h)',
        type: 'stat',
        query: 'burn_rate:run_success_rate:1h',
        thresholds: [
          { value: 1, color: 'green' },
          { value: 6, color: 'yellow' },
          { value: 14.4, color: 'red' }
        ],
        position: { x: 6, y: 6, w: 6, h: 4 }
      }
    ]
  },
  {
    title: 'Manus LLM Performance',
    uid: 'manus-llm',
    panels: [
      {
        title: 'LLM Request Rate',
        type: 'timeseries',
        query: 'sum(rate(manus_llm_requests_total[5m])) by (model)',
        position: { x: 0, y: 0, w: 12, h: 6 }
      },
      {
        title: 'LLM Latency P95',
        type: 'timeseries',
        query: `
          histogram_quantile(0.95,
            sum(rate(manus_llm_latency_seconds_bucket[5m])) by (le, model)
          )
        `,
        position: { x: 0, y: 6, w: 12, h: 6 }
      },
      {
        title: 'Token Usage',
        type: 'timeseries',
        query: 'sum(rate(manus_llm_tokens_total[5m])) by (model, type)',
        position: { x: 0, y: 12, w: 12, h: 6 }
      },
      {
        title: 'Rate Limit Hits',
        type: 'timeseries',
        query: 'sum(rate(manus_llm_rate_limited_total[5m])) by (model)',
        position: { x: 0, y: 18, w: 12, h: 6 }
      }
    ]
  }
];
```

#### 7.5 Chaos Gates

```typescript
// packages/observability/src/chaos.ts

export interface ChaosExperiment {
  name: string;
  description: string;
  target: ChaosTarget;
  fault: ChaosFault;
  duration: string;
  steadyStateHypothesis: SteadyStateCheck[];
  rollbackOnFailure: boolean;
}

export interface ChaosTarget {
  type: 'pod' | 'service' | 'network' | 'disk';
  selector: Record<string, string>;
  namespace: string;
}

export interface ChaosFault {
  type: 'kill' | 'cpu' | 'memory' | 'network_delay' | 'network_loss' | 'disk_fill';
  parameters: Record<string, any>;
}

export interface SteadyStateCheck {
  name: string;
  type: 'prometheus' | 'http' | 'k8s';
  query: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  threshold: number;
}

export const CHAOS_EXPERIMENTS: ChaosExperiment[] = [
  {
    name: 'worker-pod-failure',
    description: 'Kill random worker pods to test resilience',
    target: {
      type: 'pod',
      selector: { app: 'manus-worker' },
      namespace: 'manus'
    },
    fault: {
      type: 'kill',
      parameters: {
        mode: 'one',  // Kill one random pod
        gracePeriod: 0
      }
    },
    duration: '5m',
    steadyStateHypothesis: [
      {
        name: 'run_success_rate_above_90',
        type: 'prometheus',
        query: 'sli:run_success_rate',
        operator: '>=',
        threshold: 0.90
      },
      {
        name: 'queue_depth_stable',
        type: 'prometheus',
        query: 'sum(manus_queue_depth{queue="runs"})',
        operator: '<',
        threshold: 1000
      }
    ],
    rollbackOnFailure: true
  },
  {
    name: 'database-latency',
    description: 'Inject network latency to database',
    target: {
      type: 'network',
      selector: { app: 'manus-api' },
      namespace: 'manus'
    },
    fault: {
      type: 'network_delay',
      parameters: {
        latency: '100ms',
        jitter: '20ms',
        destination: 'db.manus.svc.cluster.local'
      }
    },
    duration: '10m',
    steadyStateHypothesis: [
      {
        name: 'api_latency_acceptable',
        type: 'prometheus',
        query: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
        operator: '<',
        threshold: 5
      }
    ],
    rollbackOnFailure: true
  },
  {
    name: 'llm-provider-failure',
    description: 'Simulate LLM provider outage',
    target: {
      type: 'network',
      selector: { app: 'manus-worker' },
      namespace: 'manus'
    },
    fault: {
      type: 'network_loss',
      parameters: {
        loss: '100%',
        destination: 'api.anthropic.com'
      }
    },
    duration: '5m',
    steadyStateHypothesis: [
      {
        name: 'graceful_degradation',
        type: 'prometheus',
        query: 'sum(rate(manus_runs_completed_total{status="failed",reason="llm_unavailable"}[5m]))',
        operator: '<',
        threshold: 10
      },
      {
        name: 'retry_queue_growing',
        type: 'prometheus',
        query: 'sum(manus_queue_depth{queue="runs:retry"})',
        operator: '>',
        threshold: 0
      }
    ],
    rollbackOnFailure: false  // Let it run to test retry behavior
  },
  {
    name: 'sandbox-resource-exhaustion',
    description: 'Exhaust sandbox CPU to test limits',
    target: {
      type: 'pod',
      selector: { app: 'manus-sandbox' },
      namespace: 'manus-sandboxes'
    },
    fault: {
      type: 'cpu',
      parameters: {
        workers: 4,
        load: 100
      }
    },
    duration: '3m',
    steadyStateHypothesis: [
      {
        name: 'sandbox_timeout_handling',
        type: 'prometheus',
        query: 'sum(rate(manus_step_errors_total{error_code="TIMEOUT"}[5m]))',
        operator: '>',
        threshold: 0  // Expect timeouts
      },
      {
        name: 'no_sandbox_crashes',
        type: 'prometheus',
        query: 'sum(rate(manus_sandbox_crashes_total[5m]))',
        operator: '==',
        threshold: 0
      }
    ],
    rollbackOnFailure: true
  }
];

// Chaos gate for CI/CD
export async function runChaosGate(
  experiment: ChaosExperiment
): Promise<ChaosResult> {
  // Check steady state before
  const beforeChecks = await runSteadyStateChecks(experiment.steadyStateHypothesis);
  if (!beforeChecks.passed) {
    return {
      passed: false,
      phase: 'pre-check',
      reason: 'System not in steady state before experiment',
      checks: beforeChecks
    };
  }
  
  // Run experiment
  try {
    await injectFault(experiment.target, experiment.fault);
    await sleep(parseDuration(experiment.duration));
  } catch (error) {
    if (experiment.rollbackOnFailure) {
      await rollbackFault(experiment.target, experiment.fault);
    }
    throw error;
  }
  
  // Check steady state during
  const duringChecks = await runSteadyStateChecks(experiment.steadyStateHypothesis);
  
  // Rollback
  await rollbackFault(experiment.target, experiment.fault);
  
  // Wait for recovery
  await sleep(60000);
  
  // Check steady state after
  const afterChecks = await runSteadyStateChecks(experiment.steadyStateHypothesis);
  
  return {
    passed: duringChecks.passed && afterChecks.passed,
    phase: 'complete',
    checks: {
      before: beforeChecks,
      during: duringChecks,
      after: afterChecks
    }
  };
}
```

---

## 8. Collaboration

### PR-009: Collaboration System

#### 8.1 Realtime Model

```typescript
// packages/collab/src/crdt/yjs-provider.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export interface CollabDocument {
  runId: string;
  doc: Y.Doc;
  provider: WebsocketProvider;
  awareness: Awareness;
}

export class CollabProvider {
  private documents: Map<string, CollabDocument> = new Map();
  
  async connect(
    runId: string,
    userId: string,
    wsUrl: string
  ): Promise<CollabDocument> {
    if (this.documents.has(runId)) {
      return this.documents.get(runId)!;
    }
    
    const doc = new Y.Doc();
    
    const provider = new WebsocketProvider(
      wsUrl,
      `run:${runId}`,
      doc,
      {
        params: {
          userId,
          runId
        }
      }
    );
    
    // Set up awareness (cursors, presence)
    provider.awareness.setLocalStateField('user', {
      id: userId,
      color: generateUserColor(userId),
      name: await getUserName(userId)
    });
    
    const collabDoc: CollabDocument = {
      runId,
      doc,
      provider,
      awareness: provider.awareness
    };
    
    this.documents.set(runId, collabDoc);
    
    return collabDoc;
  }
  
  disconnect(runId: string): void {
    const doc = this.documents.get(runId);
    if (doc) {
      doc.provider.destroy();
      doc.doc.destroy();
      this.documents.delete(runId);
    }
  }
  
  // Get shared types
  getMessages(runId: string): Y.Array<Message> {
    const doc = this.documents.get(runId);
    if (!doc) throw new Error(`Not connected to run ${runId}`);
    return doc.doc.getArray('messages');
  }
  
  getArtifacts(runId: string): Y.Map<Artifact> {
    const doc = this.documents.get(runId);
    if (!doc) throw new Error(`Not connected to run ${runId}`);
    return doc.doc.getMap('artifacts');
  }
  
  getPlan(runId: string): Y.Map<any> {
    const doc = this.documents.get(runId);
    if (!doc) throw new Error(`Not connected to run ${runId}`);
    return doc.doc.getMap('plan');
  }
}
```

#### 8.2 Conflict Resolution

```typescript
// packages/collab/src/conflict.ts

export type ConflictResolutionStrategy = 
  | 'human_wins'      // Human edits always take precedence
  | 'ai_wins'         // AI edits always take precedence
  | 'last_write'      // Most recent edit wins
  | 'merge'           // Attempt to merge changes
  | 'ask_user';       // Prompt user to resolve

export interface ConflictResolutionConfig {
  defaultStrategy: ConflictResolutionStrategy;
  fieldStrategies: Record<string, ConflictResolutionStrategy>;
  mergeTimeout: number;
}

export const DEFAULT_CONFLICT_CONFIG: ConflictResolutionConfig = {
  defaultStrategy: 'human_wins',
  fieldStrategies: {
    'messages': 'merge',           // Messages can be merged
    'plan': 'human_wins',          // Human controls plan
    'artifacts': 'last_write',     // Latest artifact version
    'settings': 'human_wins'       // Human controls settings
  },
  mergeTimeout: 5000
};

export class ConflictResolver {
  constructor(private config: ConflictResolutionConfig = DEFAULT_CONFLICT_CONFIG) {}
  
  async resolve(
    conflict: Conflict,
    context: ConflictContext
  ): Promise<ResolvedConflict> {
    const strategy = this.config.fieldStrategies[conflict.field] 
      || this.config.defaultStrategy;
    
    switch (strategy) {
      case 'human_wins':
        return this.resolveHumanWins(conflict);
      
      case 'ai_wins':
        return this.resolveAIWins(conflict);
      
      case 'last_write':
        return this.resolveLastWrite(conflict);
      
      case 'merge':
        return this.resolveMerge(conflict, context);
      
      case 'ask_user':
        return this.resolveAskUser(conflict, context);
    }
  }
  
  private resolveHumanWins(conflict: Conflict): ResolvedConflict {
    // Find the human edit
    const humanEdit = conflict.edits.find(e => e.source === 'human');
    const aiEdit = conflict.edits.find(e => e.source === 'ai');
    
    if (humanEdit) {
      return {
        winner: humanEdit,
        loser: aiEdit,
        strategy: 'human_wins',
        merged: false
      };
    }
    
    // No human edit, use AI
    return {
      winner: aiEdit!,
      strategy: 'human_wins',
      merged: false
    };
  }
  
  private resolveLastWrite(conflict: Conflict): ResolvedConflict {
    const sorted = [...conflict.edits].sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      winner: sorted[0],
      loser: sorted[1],
      strategy: 'last_write',
      merged: false
    };
  }
  
  private async resolveMerge(
    conflict: Conflict,
    context: ConflictContext
  ): Promise<ResolvedConflict> {
    // For messages, we can append both
    if (conflict.field === 'messages') {
      const merged = this.mergeMessages(conflict.edits);
      return {
        winner: { value: merged, source: 'merged', timestamp: Date.now() },
        strategy: 'merge',
        merged: true
      };
    }
    
    // For text content, use operational transform
    if (conflict.type === 'text') {
      try {
        const merged = await this.mergeText(conflict.edits, context);
        return {
          winner: { value: merged, source: 'merged', timestamp: Date.now() },
          strategy: 'merge',
          merged: true
        };
      } catch (error) {
        // Merge failed, fall back to human_wins
        return this.resolveHumanWins(conflict);
      }
    }
    
    // Default to human_wins for complex types
    return this.resolveHumanWins(conflict);
  }
  
  private mergeMessages(edits: Edit[]): Message[] {
    // Collect all messages and dedupe by ID
    const messageMap = new Map<string, Message>();
    
    for (const edit of edits) {
      for (const message of edit.value as Message[]) {
        if (!messageMap.has(message.id)) {
          messageMap.set(message.id, message);
        }
      }
    }
    
    // Sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  private async mergeText(edits: Edit[], context: ConflictContext): Promise<string> {
    // Use 3-way merge with common ancestor
    const ancestor = context.commonAncestor as string;
    const humanEdit = edits.find(e => e.source === 'human')?.value as string;
    const aiEdit = edits.find(e => e.source === 'ai')?.value as string;
    
    if (!humanEdit || !aiEdit) {
      return humanEdit || aiEdit || ancestor;
    }
    
    // Compute diffs
    const humanDiff = computeDiff(ancestor, humanEdit);
    const aiDiff = computeDiff(ancestor, aiEdit);
    
    // Check for overlapping changes
    const overlaps = findOverlaps(humanDiff, aiDiff);
    
    if (overlaps.length > 0) {
      // Cannot auto-merge, human wins
      throw new Error('Overlapping changes detected');
    }
    
    // Apply both diffs
    let result = ancestor;
    result = applyDiff(result, humanDiff);
    result = applyDiff(result, aiDiff);
    
    return result;
  }
  
  private async resolveAskUser(
    conflict: Conflict,
    context: ConflictContext
  ): Promise<ResolvedConflict> {
    // Emit event to UI
    const resolution = await context.promptUser({
      type: 'conflict_resolution',
      conflict,
      options: conflict.edits.map(e => ({
        label: `${e.source === 'human' ? 'Your' : 'AI'} version`,
        value: e.value,
        timestamp: e.timestamp
      }))
    });
    
    // Wait for user response with timeout
    const userChoice = await Promise.race([
      resolution,
      sleep(this.config.mergeTimeout).then(() => null)
    ]);
    
    if (userChoice === null) {
      // Timeout, use human_wins
      return this.resolveHumanWins(conflict);
    }
    
    return {
      winner: conflict.edits.find(e => e.value === userChoice)!,
      strategy: 'ask_user',
      merged: false,
      userResolved: true
    };
  }
}
```

#### 8.3 Permissions

```typescript
// packages/collab/src/permissions.ts

export type CollabPermission = 
  | 'view'           // Can view run and artifacts
  | 'comment'        // Can add comments
  | 'edit'           // Can edit artifacts
  | 'control'        // Can pause/resume/cancel run
  | 'admin';         // Full control including sharing

export interface CollabAccess {
  userId: string;
  runId: string;
  permissions: CollabPermission[];
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
}

export const PERMISSION_HIERARCHY: Record<CollabPermission, CollabPermission[]> = {
  'view': [],
  'comment': ['view'],
  'edit': ['view', 'comment'],
  'control': ['view'],
  'admin': ['view', 'comment', 'edit', 'control']
};

export class CollabPermissionManager {
  async checkPermission(
    userId: string,
    runId: string,
    permission: CollabPermission
  ): Promise<boolean> {
    const access = await this.getAccess(userId, runId);
    if (!access) return false;
    
    // Check if permission is granted directly or via hierarchy
    return this.hasPermission(access.permissions, permission);
  }
  
  private hasPermission(
    granted: CollabPermission[],
    required: CollabPermission
  ): boolean {
    if (granted.includes(required)) return true;
    
    // Check if any granted permission implies the required one
    for (const perm of granted) {
      const implied = PERMISSION_HIERARCHY[perm];
      if (implied.includes(required)) return true;
    }
    
    return false;
  }
  
  async grantAccess(
    runId: string,
    targetUserId: string,
    permissions: CollabPermission[],
    grantedBy: string
  ): Promise<CollabAccess> {
    // Check if granter has admin permission
    const canGrant = await this.checkPermission(grantedBy, runId, 'admin');
    if (!canGrant) {
      throw new PermissionError('Cannot grant access without admin permission');
    }
    
    // Check if granting would exceed their own permissions
    const granterAccess = await this.getAccess(grantedBy, runId);
    for (const perm of permissions) {
      if (!this.hasPermission(granterAccess!.permissions, perm)) {
        throw new PermissionError(`Cannot grant permission you don't have: ${perm}`);
      }
    }
    
    const access: CollabAccess = {
      userId: targetUserId,
      runId,
      permissions,
      grantedBy,
      grantedAt: Date.now()
    };
    
    await this.saveAccess(access);
    
    // Audit log
    await auditLog({
      action: 'collab.access_granted',
      actor: grantedBy,
      target: targetUserId,
      resource: runId,
      details: { permissions }
    });
    
    return access;
  }
  
  async revokeAccess(
    runId: string,
    targetUserId: string,
    revokedBy: string
  ): Promise<void> {
    // Check if revoker has admin permission
    const canRevoke = await this.checkPermission(revokedBy, runId, 'admin');
    if (!canRevoke) {
      throw new PermissionError('Cannot revoke access without admin permission');
    }
    
    await this.deleteAccess(targetUserId, runId);
    
    // Audit log
    await auditLog({
      action: 'collab.access_revoked',
      actor: revokedBy,
      target: targetUserId,
      resource: runId
    });
  }
}
```

#### 8.4 Owner Pays Credits

```typescript
// packages/collab/src/billing.ts

export interface CreditAttribution {
  runId: string;
  ownerId: string;  // Who pays
  consumerId: string;  // Who triggered the consumption
  amount: number;
  reason: string;
  timestamp: number;
}

export class CollabBillingManager {
  async attributeCredits(
    runId: string,
    consumerId: string,
    amount: number,
    reason: string
  ): Promise<CreditAttribution> {
    // Get run owner
    const run = await getRun(runId);
    const ownerId = run.userId;
    
    // Check owner has sufficient credits
    const ownerQuota = await getQuota(run.tenantId);
    if (ownerQuota.creditBalance < amount) {
      throw new InsufficientCreditsError(
        `Owner ${ownerId} has insufficient credits for run ${runId}`
      );
    }
    
    // Charge owner
    await chargeCredits(run.tenantId, amount, {
      runId,
      consumerId,
      reason
    });
    
    const attribution: CreditAttribution = {
      runId,
      ownerId,
      consumerId,
      amount,
      reason,
      timestamp: Date.now()
    };
    
    // Record attribution for reporting
    await recordAttribution(attribution);
    
    return attribution;
  }
  
  async getRunCostBreakdown(runId: string): Promise<CostBreakdown> {
    const attributions = await getAttributions(runId);
    
    // Group by consumer
    const byConsumer = new Map<string, number>();
    for (const attr of attributions) {
      const current = byConsumer.get(attr.consumerId) || 0;
      byConsumer.set(attr.consumerId, current + attr.amount);
    }
    
    // Group by reason
    const byReason = new Map<string, number>();
    for (const attr of attributions) {
      const current = byReason.get(attr.reason) || 0;
      byReason.set(attr.reason, current + attr.amount);
    }
    
    return {
      runId,
      totalCredits: attributions.reduce((sum, a) => sum + a.amount, 0),
      byConsumer: Object.fromEntries(byConsumer),
      byReason: Object.fromEntries(byReason),
      attributions
    };
  }
  
  // Enforce limits on collaborator consumption
  async checkCollaboratorLimit(
    runId: string,
    consumerId: string,
    amount: number
  ): Promise<boolean> {
    const run = await getRun(runId);
    
    // Owner has no limit
    if (consumerId === run.userId) return true;
    
    // Check collaborator's consumption so far
    const consumed = await getConsumerTotal(runId, consumerId);
    const limit = run.config.collaboratorCreditLimit || 100;
    
    return (consumed + amount) <= limit;
  }
}
```

---

## 9. Email Trigger

### PR-010: Email Trigger System

#### 9.1 Inbound Parsing

```typescript
// packages/email/src/inbound/parser.ts

export interface ParsedEmail {
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  body: {
    text: string;
    html?: string;
  };
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  receivedAt: number;
  
  // Extracted metadata
  threadId?: string;
  inReplyTo?: string;
  references: string[];
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export class EmailParser {
  async parse(rawEmail: string): Promise<ParsedEmail> {
    const { simpleParser } = await import('mailparser');
    const parsed = await simpleParser(rawEmail);
    
    return {
      id: parsed.messageId || generateId('email'),
      from: this.parseAddress(parsed.from),
      to: this.parseAddresses(parsed.to),
      cc: this.parseAddresses(parsed.cc),
      subject: parsed.subject || '',
      body: {
        text: parsed.text || '',
        html: parsed.html || undefined
      },
      attachments: this.parseAttachments(parsed.attachments),
      headers: this.parseHeaders(parsed.headers),
      receivedAt: parsed.date?.getTime() || Date.now(),
      threadId: this.extractThreadId(parsed),
      inReplyTo: parsed.inReplyTo,
      references: this.parseReferences(parsed.references)
    };
  }
  
  private parseAddress(addr: any): EmailAddress {
    if (!addr) return { email: '' };
    const first = Array.isArray(addr.value) ? addr.value[0] : addr.value;
    return {
      email: first?.address || '',
      name: first?.name
    };
  }
  
  private parseAddresses(addrs: any): EmailAddress[] {
    if (!addrs) return [];
    const values = Array.isArray(addrs.value) ? addrs.value : [addrs.value];
    return values.map((v: any) => ({
      email: v?.address || '',
      name: v?.name
    }));
  }
  
  private parseAttachments(attachments: any[]): EmailAttachment[] {
    if (!attachments) return [];
    return attachments.map(att => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      content: att.content
    }));
  }
  
  private extractThreadId(parsed: any): string | undefined {
    // Try to extract from References or In-Reply-To
    if (parsed.references) {
      const refs = Array.isArray(parsed.references) 
        ? parsed.references 
        : [parsed.references];
      if (refs.length > 0) {
        return refs[0];  // First reference is usually thread root
      }
    }
    return parsed.inReplyTo;
  }
  
  private parseReferences(refs: any): string[] {
    if (!refs) return [];
    return Array.isArray(refs) ? refs : [refs];
  }
}
```

#### 9.2 Threading Rules

```typescript
// packages/email/src/inbound/threading.ts

export interface EmailThread {
  id: string;
  rootMessageId: string;
  subject: string;
  participants: EmailAddress[];
  messages: ThreadMessage[];
  runId?: string;  // Associated run if any
  createdAt: number;
  updatedAt: number;
}

export interface ThreadMessage {
  id: string;
  emailId: string;
  from: EmailAddress;
  body: string;
  receivedAt: number;
}

export class EmailThreader {
  async findOrCreateThread(email: ParsedEmail): Promise<EmailThread> {
    // Strategy 1: Match by References/In-Reply-To
    if (email.inReplyTo || email.references.length > 0) {
      const thread = await this.findByReferences(email);
      if (thread) {
        return this.addToThread(thread, email);
      }
    }
    
    // Strategy 2: Match by subject (Re: prefix)
    const normalizedSubject = this.normalizeSubject(email.subject);
    const thread = await this.findBySubject(normalizedSubject, email.from.email);
    if (thread) {
      return this.addToThread(thread, email);
    }
    
    // Strategy 3: Create new thread
    return this.createThread(email);
  }
  
  private normalizeSubject(subject: string): string {
    // Remove Re:, Fwd:, etc.
    return subject
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .replace(/^\[.*?\]\s*/g, '')  // Remove [tags]
      .trim()
      .toLowerCase();
  }
  
  private async findByReferences(email: ParsedEmail): Promise<EmailThread | null> {
    const messageIds = [email.inReplyTo, ...email.references].filter(Boolean);
    
    for (const messageId of messageIds) {
      const thread = await db.query.emailThreads.findFirst({
        where: or(
          eq(emailThreads.rootMessageId, messageId),
          sql`${messageId} = ANY(${emailThreads.messageIds})`
        )
      });
      
      if (thread) return thread;
    }
    
    return null;
  }
  
  private async findBySubject(
    normalizedSubject: string,
    fromEmail: string
  ): Promise<EmailThread | null> {
    // Look for recent threads with same subject from same sender
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);  // 7 days
    
    return db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.normalizedSubject, normalizedSubject),
        sql`${fromEmail} = ANY(${emailThreads.participantEmails})`,
        gt(emailThreads.updatedAt, new Date(cutoff))
      ),
      orderBy: desc(emailThreads.updatedAt)
    });
  }
  
  private async createThread(email: ParsedEmail): Promise<EmailThread> {
    const thread: EmailThread = {
      id: generateId('thread'),
      rootMessageId: email.id,
      subject: email.subject,
      participants: [email.from, ...email.to, ...email.cc],
      messages: [{
        id: generateId('msg'),
        emailId: email.id,
        from: email.from,
        body: email.body.text,
        receivedAt: email.receivedAt
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await db.insert(emailThreads).values(thread);
    return thread;
  }
  
  private async addToThread(
    thread: EmailThread,
    email: ParsedEmail
  ): Promise<EmailThread> {
    const message: ThreadMessage = {
      id: generateId('msg'),
      emailId: email.id,
      from: email.from,
      body: email.body.text,
      receivedAt: email.receivedAt
    };
    
    // Add new participants
    const existingEmails = new Set(thread.participants.map(p => p.email));
    const newParticipants = [email.from, ...email.to, ...email.cc]
      .filter(p => !existingEmails.has(p.email));
    
    await db.update(emailThreads)
      .set({
        messages: [...thread.messages, message],
        participants: [...thread.participants, ...newParticipants],
        updatedAt: new Date()
      })
      .where(eq(emailThreads.id, thread.id));
    
    return {
      ...thread,
      messages: [...thread.messages, message],
      participants: [...thread.participants, ...newParticipants],
      updatedAt: Date.now()
    };
  }
}
```

#### 9.3 Deduplication and Idempotency

```typescript
// packages/email/src/inbound/dedupe.ts

export interface DedupeConfig {
  windowMs: number;  // Time window for duplicate detection
  hashFields: ('from' | 'subject' | 'body')[];
}

export const DEFAULT_DEDUPE_CONFIG: DedupeConfig = {
  windowMs: 60 * 60 * 1000,  // 1 hour
  hashFields: ['from', 'subject', 'body']
};

export class EmailDeduplicator {
  constructor(private config: DedupeConfig = DEFAULT_DEDUPE_CONFIG) {}
  
  async isDuplicate(email: ParsedEmail): Promise<boolean> {
    const hash = this.computeHash(email);
    const key = `email:dedupe:${hash}`;
    
    // Check if we've seen this hash recently
    const existing = await redis.get(key);
    if (existing) {
      return true;
    }
    
    // Mark as seen
    await redis.set(key, email.id, 'PX', this.config.windowMs);
    return false;
  }
  
  private computeHash(email: ParsedEmail): string {
    const parts: string[] = [];
    
    if (this.config.hashFields.includes('from')) {
      parts.push(email.from.email.toLowerCase());
    }
    if (this.config.hashFields.includes('subject')) {
      parts.push(email.subject.toLowerCase().trim());
    }
    if (this.config.hashFields.includes('body')) {
      // Use first 500 chars of body
      parts.push(email.body.text.slice(0, 500).toLowerCase().trim());
    }
    
    return hashString(parts.join('|'));
  }
  
  async getIdempotencyKey(email: ParsedEmail): Promise<string> {
    // Use Message-ID if available
    if (email.id && !email.id.startsWith('email_')) {
      return `email:idem:${email.id}`;
    }
    
    // Fall back to content hash
    const hash = this.computeHash(email);
    return `email:idem:${hash}`;
  }
  
  async processIdempotent(
    email: ParsedEmail,
    processor: (email: ParsedEmail) => Promise<ProcessResult>
  ): Promise<ProcessResult> {
    const key = await this.getIdempotencyKey(email);
    
    // Check for existing result
    const existing = await redis.get(key);
    if (existing) {
      return JSON.parse(existing);
    }
    
    // Process
    const result = await processor(email);
    
    // Cache result
    await redis.set(key, JSON.stringify(result), 'EX', 86400);  // 24 hours
    
    return result;
  }
}
```

#### 9.4 Intent Extraction

```typescript
// packages/email/src/inbound/intent.ts

export type EmailIntent =
  | 'new_task'           // Start a new run
  | 'reply_to_run'       // Continue existing run
  | 'cancel_run'         // Cancel a run
  | 'status_inquiry'     // Ask about run status
  | 'feedback'           // Provide feedback
  | 'unsubscribe'        // Opt out
  | 'unknown';           // Cannot determine

export interface IntentResult {
  intent: EmailIntent;
  confidence: number;
  extractedData: Record<string, any>;
}

export class IntentExtractor {
  async extract(email: ParsedEmail, thread?: EmailThread): Promise<IntentResult> {
    // Rule-based extraction first
    const ruleResult = this.extractByRules(email, thread);
    if (ruleResult.confidence > 0.9) {
      return ruleResult;
    }
    
    // Fall back to LLM
    return this.extractByLLM(email, thread);
  }
  
  private extractByRules(email: ParsedEmail, thread?: EmailThread): IntentResult {
    const subject = email.subject.toLowerCase();
    const body = email.body.text.toLowerCase();
    
    // Check for unsubscribe
    if (subject.includes('unsubscribe') || body.includes('unsubscribe me')) {
      return { intent: 'unsubscribe', confidence: 0.95, extractedData: {} };
    }
    
    // Check for cancel
    if (subject.includes('cancel') || body.match(/\b(cancel|stop|abort)\s+(the\s+)?(run|task)/i)) {
      const runIdMatch = body.match(/run[_-]?([a-z0-9]+)/i);
      return {
        intent: 'cancel_run',
        confidence: 0.9,
        extractedData: { runId: runIdMatch?.[1] }
      };
    }
    
    // Check for status inquiry
    if (body.match(/\b(status|progress|update|how.+going)\b/i)) {
      return { intent: 'status_inquiry', confidence: 0.8, extractedData: {} };
    }
    
    // Check if reply to existing thread with run
    if (thread?.runId) {
      return {
        intent: 'reply_to_run',
        confidence: 0.85,
        extractedData: { runId: thread.runId }
      };
    }
    
    // Default to new task
    return { intent: 'new_task', confidence: 0.6, extractedData: {} };
  }
  
  private async extractByLLM(
    email: ParsedEmail,
    thread?: EmailThread
  ): Promise<IntentResult> {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Classify this email's intent. Options:
            - new_task: User wants to start a new AI task
            - reply_to_run: User is responding to an ongoing task
            - cancel_run: User wants to cancel a task
            - status_inquiry: User is asking about task status
            - feedback: User is providing feedback
            - unsubscribe: User wants to stop receiving emails
            - unknown: Cannot determine intent
            
            Also extract any relevant data (run IDs, task descriptions, etc.)`
        },
        {
          role: 'user',
          content: JSON.stringify({
            subject: email.subject,
            body: email.body.text.slice(0, 2000),
            hasThread: !!thread,
            threadRunId: thread?.runId
          })
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'intent_result',
          schema: {
            type: 'object',
            properties: {
              intent: { type: 'string' },
              confidence: { type: 'number' },
              extractedData: { type: 'object' }
            },
            required: ['intent', 'confidence']
          }
        }
      }
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
}
```

#### 9.5 Outbound Replies

```typescript
// packages/email/src/outbound/sender.ts

export interface OutboundEmail {
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  body: {
    text: string;
    html?: string;
  };
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
  runId?: string;
}

export class EmailSender {
  constructor(
    private transport: EmailTransport,
    private templates: EmailTemplates
  ) {}
  
  async sendRunUpdate(
    run: Run,
    updateType: 'started' | 'completed' | 'failed' | 'needs_input',
    recipient: EmailAddress
  ): Promise<void> {
    const template = this.templates.get(`run_${updateType}`);
    
    const email: OutboundEmail = {
      to: [recipient],
      subject: template.subject({ run }),
      body: {
        text: template.text({ run }),
        html: template.html({ run })
      },
      runId: run.id
    };
    
    // If this is a reply to an email-triggered run, set threading headers
    if (run.metadata.sourceEmailId) {
      email.inReplyTo = run.metadata.sourceEmailId;
      email.references = run.metadata.emailReferences || [];
    }
    
    await this.send(email);
  }
  
  async send(email: OutboundEmail): Promise<string> {
    // Generate Message-ID
    const messageId = `<${generateId()}.${Date.now()}@manus.im>`;
    
    // Build email
    const mailOptions = {
      from: 'Manus <noreply@manus.im>',
      to: email.to.map(a => a.name ? `${a.name} <${a.email}>` : a.email).join(', '),
      cc: email.cc?.map(a => a.name ? `${a.name} <${a.email}>` : a.email).join(', '),
      subject: email.subject,
      text: email.body.text,
      html: email.body.html,
      attachments: email.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType
      })),
      messageId,
      inReplyTo: email.inReplyTo,
      references: email.references?.join(' '),
      headers: {
        'X-Manus-Run-ID': email.runId
      }
    };
    
    await this.transport.sendMail(mailOptions);
    
    // Record sent email
    await recordSentEmail({
      messageId,
      runId: email.runId,
      to: email.to,
      subject: email.subject,
      sentAt: Date.now()
    });
    
    return messageId;
  }
}
```

---

## 10. Integrations

### PR-011: Connector SDK

#### 10.1 Base Connector

```typescript
// packages/connectors/src/sdk/base.ts

export interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  authType: 'oauth2' | 'api_key' | 'basic' | 'custom';
  scopes?: string[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface ConnectorCredentials {
  type: string;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export abstract class BaseConnector {
  abstract config: ConnectorConfig;
  
  protected credentials: ConnectorCredentials | null = null;
  protected tenantId: string | null = null;
  
  // Lifecycle
  abstract initialize(tenantId: string, credentials: ConnectorCredentials): Promise<void>;
  abstract validateCredentials(): Promise<boolean>;
  abstract refreshCredentials?(): Promise<ConnectorCredentials>;
  
  // Actions
  abstract getActions(): ConnectorAction[];
  abstract executeAction(action: string, params: any): Promise<any>;
  
  // Rate limiting
  protected async checkRateLimit(): Promise<boolean> {
    if (!this.config.rateLimit) return true;
    
    const key = `ratelimit:connector:${this.config.id}:${this.tenantId}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.pexpire(key, this.config.rateLimit.windowMs);
    }
    
    return current <= this.config.rateLimit.requests;
  }
  
  // Audit logging
  protected async auditAction(action: string, params: any, result: any): Promise<void> {
    await auditLog({
      action: `connector.${this.config.id}.${action}`,
      actor: this.tenantId!,
      details: {
        params: this.sanitizeParams(params),
        success: !result.error
      }
    });
  }
  
  private sanitizeParams(params: any): any {
    // Remove sensitive fields
    const sanitized = { ...params };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

export interface ConnectorAction {
  name: string;
  description: string;
  parameters: JSONSchema;
  returns: JSONSchema;
  requiredScopes?: string[];
}
```

#### 10.2 OAuth Flow

```typescript
// packages/connectors/src/sdk/oauth.ts

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

export class OAuthManager {
  constructor(private config: OAuthConfig) {}
  
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state
    });
    
    return `${this.config.authorizationUrl}?${params}`;
  }
  
  async exchangeCode(code: string): Promise<ConnectorCredentials> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri
      })
    });
    
    if (!response.ok) {
      throw new OAuthError(`Token exchange failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      type: 'oauth2',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      metadata: {
        scope: data.scope,
        tokenType: data.token_type
      }
    };
  }
  
  async refreshToken(refreshToken: string): Promise<ConnectorCredentials> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    
    if (!response.ok) {
      throw new OAuthError(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      type: 'oauth2',
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
  }
}
```

#### 10.3 Credential Storage

```typescript
// packages/connectors/src/sdk/credentials.ts

export interface StoredCredential {
  id: string;
  tenantId: string;
  connectorId: string;
  userId: string;
  
  // Encrypted credential data
  encryptedData: string;
  encryptionKeyId: string;
  
  // Metadata (not encrypted)
  scopes: string[];
  expiresAt?: number;
  
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export class CredentialStore {
  constructor(
    private encryption: EncryptionService,
    private keyManager: KeyManager
  ) {}
  
  async store(
    tenantId: string,
    connectorId: string,
    userId: string,
    credentials: ConnectorCredentials
  ): Promise<string> {
    // Get current encryption key
    const keyId = await this.keyManager.getCurrentKeyId();
    const key = await this.keyManager.getKey(keyId);
    
    // Encrypt credentials
    const encryptedData = await this.encryption.encrypt(
      JSON.stringify(credentials),
      key
    );
    
    const stored: StoredCredential = {
      id: generateId('cred'),
      tenantId,
      connectorId,
      userId,
      encryptedData,
      encryptionKeyId: keyId,
      scopes: credentials.metadata?.scope?.split(' ') || [],
      expiresAt: credentials.expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await db.insert(credentials).values(stored);
    
    // Audit
    await auditLog({
      action: 'connector.credential_stored',
      actor: userId,
      resource: connectorId,
      details: { scopes: stored.scopes }
    });
    
    return stored.id;
  }
  
  async retrieve(
    tenantId: string,
    connectorId: string,
    userId: string
  ): Promise<ConnectorCredentials | null> {
    const stored = await db.query.credentials.findFirst({
      where: and(
        eq(credentials.tenantId, tenantId),
        eq(credentials.connectorId, connectorId),
        eq(credentials.userId, userId)
      )
    });
    
    if (!stored) return null;
    
    // Get decryption key
    const key = await this.keyManager.getKey(stored.encryptionKeyId);
    
    // Decrypt
    const decrypted = await this.encryption.decrypt(stored.encryptedData, key);
    const creds = JSON.parse(decrypted) as ConnectorCredentials;
    
    // Update last used
    await db.update(credentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(credentials.id, stored.id));
    
    return creds;
  }
  
  async rotate(
    credentialId: string,
    newCredentials: ConnectorCredentials
  ): Promise<void> {
    const stored = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });
    
    if (!stored) throw new Error('Credential not found');
    
    // Get current encryption key
    const keyId = await this.keyManager.getCurrentKeyId();
    const key = await this.keyManager.getKey(keyId);
    
    // Encrypt new credentials
    const encryptedData = await this.encryption.encrypt(
      JSON.stringify(newCredentials),
      key
    );
    
    await db.update(credentials)
      .set({
        encryptedData,
        encryptionKeyId: keyId,
        expiresAt: newCredentials.expiresAt,
        updatedAt: new Date()
      })
      .where(eq(credentials.id, credentialId));
    
    // Audit
    await auditLog({
      action: 'connector.credential_rotated',
      actor: stored.userId,
      resource: stored.connectorId
    });
  }
  
  async revoke(credentialId: string, revokedBy: string): Promise<void> {
    const stored = await db.query.credentials.findFirst({
      where: eq(credentials.id, credentialId)
    });
    
    if (!stored) throw new Error('Credential not found');
    
    await db.delete(credentials).where(eq(credentials.id, credentialId));
    
    // Audit
    await auditLog({
      action: 'connector.credential_revoked',
      actor: revokedBy,
      resource: stored.connectorId
    });
  }
}
```

#### 10.4 Example: Google Connector

```typescript
// packages/connectors/src/builtin/google/index.ts

export class GoogleConnector extends BaseConnector {
  config: ConnectorConfig = {
    id: 'google',
    name: 'Google Workspace',
    description: 'Connect to Google Drive, Docs, Sheets, and Calendar',
    icon: 'google',
    authType: 'oauth2',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    rateLimit: {
      requests: 100,
      windowMs: 60000
    }
  };
  
  private oauth: OAuthManager;
  private drive: any;
  
  constructor() {
    super();
    this.oauth = new OAuthManager({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scopes: this.config.scopes!,
      redirectUri: `${process.env.APP_URL}/api/connectors/google/callback`
    });
  }
  
  async initialize(tenantId: string, credentials: ConnectorCredentials): Promise<void> {
    this.tenantId = tenantId;
    this.credentials = credentials;
    
    // Initialize Google APIs client
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken
    });
    
    this.drive = google.drive({ version: 'v3', auth });
  }
  
  async validateCredentials(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async refreshCredentials(): Promise<ConnectorCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    return this.oauth.refreshToken(this.credentials.refreshToken);
  }
  
  getActions(): ConnectorAction[] {
    return [
      {
        name: 'listFiles',
        description: 'List files in Google Drive',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            pageSize: { type: 'number', default: 10 },
            folderId: { type: 'string', description: 'Folder ID to list' }
          }
        },
        returns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              mimeType: { type: 'string' }
            }
          }
        },
        requiredScopes: ['https://www.googleapis.com/auth/drive.readonly']
      },
      {
        name: 'getFileContent',
        description: 'Get content of a Google Doc or Sheet',
        parameters: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            format: { type: 'string', enum: ['text', 'html', 'pdf'] }
          },
          required: ['fileId']
        },
        returns: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            mimeType: { type: 'string' }
          }
        },
        requiredScopes: ['https://www.googleapis.com/auth/documents.readonly']
      }
    ];
  }
  
  async executeAction(action: string, params: any): Promise<any> {
    // Check rate limit
    const allowed = await this.checkRateLimit();
    if (!allowed) {
      throw new RateLimitError('Google API rate limit exceeded');
    }
    
    let result: any;
    
    switch (action) {
      case 'listFiles':
        result = await this.listFiles(params);
        break;
      case 'getFileContent':
        result = await this.getFileContent(params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Audit
    await this.auditAction(action, params, result);
    
    return result;
  }
  
  private async listFiles(params: {
    query?: string;
    pageSize?: number;
    folderId?: string;
  }): Promise<any[]> {
    let q = params.query || '';
    if (params.folderId) {
      q = `'${params.folderId}' in parents${q ? ` and ${q}` : ''}`;
    }
    
    const response = await this.drive.files.list({
      q,
      pageSize: params.pageSize || 10,
      fields: 'files(id, name, mimeType, modifiedTime, size)'
    });
    
    return response.data.files;
  }
  
  private async getFileContent(params: {
    fileId: string;
    format?: string;
  }): Promise<{ content: string; mimeType: string }> {
    // Get file metadata first
    const file = await this.drive.files.get({
      fileId: params.fileId,
      fields: 'mimeType'
    });
    
    const mimeType = file.data.mimeType;
    
    // Export based on type
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportMime = params.format === 'html' 
        ? 'text/html' 
        : 'text/plain';
      const response = await this.drive.files.export({
        fileId: params.fileId,
        mimeType: exportMime
      });
      return { content: response.data, mimeType: exportMime };
    }
    
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const response = await this.drive.files.export({
        fileId: params.fileId,
        mimeType: 'text/csv'
      });
      return { content: response.data, mimeType: 'text/csv' };
    }
    
    // For other files, download directly
    const response = await this.drive.files.get({
      fileId: params.fileId,
      alt: 'media'
    });
    return { content: response.data, mimeType };
  }
}
```

---

## 11. Security

### PR-012: Security Hardening

#### 11.1 Tenant Isolation

```typescript
// packages/core/src/security/tenant-isolation.ts

export interface TenantContext {
  tenantId: string;
  userId: string;
  permissions: string[];
  quotas: TenantQuotas;
}

export class TenantIsolationMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Extract tenant from JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedError('Missing authorization token');
    }
    
    const decoded = await verifyJWT(token);
    const tenantId = decoded.tenantId;
    
    // Set tenant context
    const context: TenantContext = {
      tenantId,
      userId: decoded.userId,
      permissions: decoded.permissions,
      quotas: await getQuotas(tenantId)
    };
    
    // Store in async local storage for downstream access
    tenantStorage.run(context, () => next());
  }
}

// Database query wrapper with tenant isolation
export function withTenantScope<T>(
  query: (tenantId: string) => Promise<T>
): Promise<T> {
  const context = tenantStorage.getStore();
  if (!context) {
    throw new Error('No tenant context available');
  }
  
  return query(context.tenantId);
}

// Row-level security policies (PostgreSQL)
export const RLS_POLICIES = `
-- Enable RLS on all tenant tables
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation_runs ON runs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_steps ON steps
  USING (run_id IN (
    SELECT id FROM runs WHERE tenant_id = current_setting('app.tenant_id')::uuid
  ));

CREATE POLICY tenant_isolation_artifacts ON artifacts
  USING (run_id IN (
    SELECT id FROM runs WHERE tenant_id = current_setting('app.tenant_id')::uuid
  ));

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_id::text, true);
END;
$$ LANGUAGE plpgsql;
`;

// Sandbox isolation
export interface SandboxIsolationConfig {
  runtime: 'gvisor' | 'firecracker' | 'kata';
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
  seccompProfile: string;
  apparmorProfile: string;
}

export const SANDBOX_ISOLATION_CONFIG: SandboxIsolationConfig = {
  runtime: 'gvisor',
  networkPolicy: {
    egress: {
      allowed: [
        { cidr: '0.0.0.0/0', ports: [80, 443] }  // HTTP/HTTPS only
      ],
      denied: [
        { cidr: '10.0.0.0/8' },      // Private networks
        { cidr: '172.16.0.0/12' },
        { cidr: '192.168.0.0/16' },
        { cidr: '169.254.0.0/16' }   // Link-local
      ]
    },
    ingress: {
      allowed: []  // No inbound connections
    }
  },
  resourceLimits: {
    cpu: '2',
    memory: '4Gi',
    ephemeralStorage: '10Gi',
    pids: 1000
  },
  seccompProfile: 'runtime/default',
  apparmorProfile: 'manus-sandbox'
};
```

#### 11.2 Encryption

```typescript
// packages/core/src/security/encryption.ts

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  keyRotationDays: number;
  kmsProvider: 'aws' | 'gcp' | 'vault';
}

export class EncryptionService {
  constructor(
    private config: EncryptionConfig,
    private kms: KMSClient
  ) {}
  
  async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }
  
  async decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
    const [ivB64, authTagB64, encrypted] = ciphertext.split(':');
    
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export class KeyManager {
  private keys: Map<string, CryptoKey> = new Map();
  
  constructor(private kms: KMSClient) {}
  
  async getCurrentKeyId(): Promise<string> {
    // Get current key from KMS
    const response = await this.kms.describeKey({
      KeyId: 'alias/manus-data-key'
    });
    return response.KeyMetadata!.KeyId!;
  }
  
  async getKey(keyId: string): Promise<CryptoKey> {
    if (this.keys.has(keyId)) {
      return this.keys.get(keyId)!;
    }
    
    // Fetch from KMS
    const response = await this.kms.generateDataKey({
      KeyId: keyId,
      KeySpec: 'AES_256'
    });
    
    const key = response.Plaintext as Buffer;
    this.keys.set(keyId, key);
    
    return key;
  }
  
  async rotateKey(): Promise<string> {
    // Create new key in KMS
    const response = await this.kms.createKey({
      Description: `Manus data key - ${new Date().toISOString()}`,
      KeyUsage: 'ENCRYPT_DECRYPT',
      KeySpec: 'SYMMETRIC_DEFAULT'
    });
    
    const newKeyId = response.KeyMetadata!.KeyId!;
    
    // Update alias to point to new key
    await this.kms.updateAlias({
      AliasName: 'alias/manus-data-key',
      TargetKeyId: newKeyId
    });
    
    return newKeyId;
  }
}
```

#### 11.3 Secret Handling

```typescript
// packages/core/src/security/secrets.ts

export interface SecretConfig {
  provider: 'vault' | 'aws-secrets' | 'gcp-secrets';
  ttl: number;
  cacheEnabled: boolean;
}

export class SecretManager {
  private cache: Map<string, CachedSecret> = new Map();
  
  constructor(
    private config: SecretConfig,
    private provider: SecretProvider
  ) {}
  
  async getSecret(path: string): Promise<string> {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(path);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }
    
    // Fetch from provider
    const secret = await this.provider.get(path);
    
    // Cache
    if (this.config.cacheEnabled) {
      this.cache.set(path, {
        value: secret,
        expiresAt: Date.now() + this.config.ttl
      });
    }
    
    return secret;
  }
  
  async setSecret(path: string, value: string): Promise<void> {
    await this.provider.set(path, value);
    
    // Invalidate cache
    this.cache.delete(path);
    
    // Audit
    await auditLog({
      action: 'secret.updated',
      resource: path,
      // Don't log the value!
      details: { path }
    });
  }
  
  // Mask secrets in logs/errors
  maskSecrets(text: string, secrets: string[]): string {
    let masked = text;
    for (const secret of secrets) {
      masked = masked.replace(new RegExp(escapeRegex(secret), 'g'), '[REDACTED]');
    }
    return masked;
  }
}

// Environment variable injection for sandboxes
export async function injectSecrets(
  sandboxId: string,
  secretPaths: string[]
): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};
  
  for (const path of secretPaths) {
    const value = await secretManager.getSecret(path);
    const envName = pathToEnvName(path);
    secrets[envName] = value;
  }
  
  // Audit
  await auditLog({
    action: 'secrets.injected',
    resource: sandboxId,
    details: { paths: secretPaths }
  });
  
  return secrets;
}
```

#### 11.4 Audit Immutability

```typescript
// packages/core/src/security/audit.ts

export interface AuditEntry {
  id: string;
  timestamp: number;
  
  // Actor
  tenantId: string;
  userId?: string;
  serviceId?: string;
  
  // Action
  action: string;
  resource: string;
  resourceId?: string;
  
  // Details
  details: Record<string, any>;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  
  // Integrity
  checksum: string;
  previousChecksum?: string;
}

export class ImmutableAuditLog {
  private lastChecksum: string | null = null;
  
  async append(entry: Omit<AuditEntry, 'id' | 'checksum' | 'previousChecksum'>): Promise<AuditEntry> {
    const id = generateId('audit');
    const timestamp = Date.now();
    
    // Get previous checksum for chaining
    const previousChecksum = this.lastChecksum || await this.getLastChecksum(entry.tenantId);
    
    // Compute checksum
    const checksumData = JSON.stringify({
      id,
      timestamp,
      ...entry,
      previousChecksum
    });
    const checksum = hashString(checksumData);
    
    const fullEntry: AuditEntry = {
      id,
      timestamp,
      ...entry,
      checksum,
      previousChecksum
    };
    
    // Write to append-only storage
    await this.write(fullEntry);
    
    this.lastChecksum = checksum;
    
    return fullEntry;
  }
  
  private async write(entry: AuditEntry): Promise<void> {
    // Write to database (append-only table)
    await db.insert(auditLog).values(entry);
    
    // Also write to immutable storage (S3 with object lock)
    await s3.putObject({
      Bucket: 'manus-audit-logs',
      Key: `${entry.tenantId}/${entry.timestamp}/${entry.id}.json`,
      Body: JSON.stringify(entry),
      ObjectLockMode: 'GOVERNANCE',
      ObjectLockRetainUntilDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)  // 7 years
    });
  }
  
  async verify(tenantId: string, startTime?: number, endTime?: number): Promise<VerificationResult> {
    const entries = await db.query.auditLog.findMany({
      where: and(
        eq(auditLog.tenantId, tenantId),
        startTime ? gte(auditLog.timestamp, startTime) : undefined,
        endTime ? lte(auditLog.timestamp, endTime) : undefined
      ),
      orderBy: asc(auditLog.timestamp)
    });
    
    const issues: VerificationIssue[] = [];
    let previousChecksum: string | null = null;
    
    for (const entry of entries) {
      // Verify checksum
      const expectedChecksum = hashString(JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp,
        tenantId: entry.tenantId,
        userId: entry.userId,
        serviceId: entry.serviceId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
        previousChecksum: entry.previousChecksum
      }));
      
      if (entry.checksum !== expectedChecksum) {
        issues.push({
          type: 'checksum_mismatch',
          entryId: entry.id,
          expected: expectedChecksum,
          actual: entry.checksum
        });
      }
      
      // Verify chain
      if (previousChecksum && entry.previousChecksum !== previousChecksum) {
        issues.push({
          type: 'chain_broken',
          entryId: entry.id,
          expected: previousChecksum,
          actual: entry.previousChecksum
        });
      }
      
      previousChecksum = entry.checksum;
    }
    
    return {
      verified: issues.length === 0,
      entriesChecked: entries.length,
      issues
    };
  }
}
```

---

## 12. Acceptance Tests

### PR-013: Acceptance Tests

#### 12.1 End-to-End Test Cases

```typescript
// tests/e2e/run-lifecycle.test.ts

describe('Run Lifecycle', () => {
  let client: ManusClient;
  let testTenant: Tenant;
  
  beforeAll(async () => {
    testTenant = await createTestTenant();
    client = new ManusClient({
      baseUrl: process.env.API_URL,
      apiKey: testTenant.apiKey
    });
  });
  
  afterAll(async () => {
    await cleanupTestTenant(testTenant.id);
  });
  
  test('should create and complete a simple run', async () => {
    // Create run
    const run = await client.runs.create({
      prompt: 'What is 2 + 2?'
    });
    
    expect(run.id).toBeDefined();
    expect(run.status).toBe('pending');
    
    // Wait for completion
    const completed = await client.runs.waitForCompletion(run.id, {
      timeout: 60000
    });
    
    expect(completed.status).toBe('completed');
    expect(completed.result).toContain('4');
  });
  
  test('should handle run cancellation', async () => {
    // Create long-running run
    const run = await client.runs.create({
      prompt: 'Write a 10000 word essay about the history of computing'
    });
    
    // Wait for it to start
    await waitFor(() => run.status === 'executing', { timeout: 30000 });
    
    // Cancel
    await client.runs.cancel(run.id);
    
    // Verify cancelled
    const cancelled = await client.runs.get(run.id);
    expect(cancelled.status).toBe('cancelled');
  });
  
  test('should handle run timeout', async () => {
    // Create run with short timeout
    const run = await client.runs.create({
      prompt: 'Perform an infinite loop',
      config: {
        maxDurationSeconds: 5
      }
    });
    
    // Wait for timeout
    const timedOut = await client.runs.waitForCompletion(run.id, {
      timeout: 30000
    });
    
    expect(timedOut.status).toBe('timeout');
  });
  
  test('should respect credit limits', async () => {
    // Set low credit limit
    await client.billing.setQuota({
      creditLimit: 1
    });
    
    // Try to create expensive run
    await expect(client.runs.create({
      prompt: 'Generate 100 images',
      config: {
        maxCredits: 100
      }
    })).rejects.toThrow('Insufficient credits');
  });
  
  test('should handle user input requests', async () => {
    // Create run that needs input
    const run = await client.runs.create({
      prompt: 'Ask me for my name and then greet me'
    });
    
    // Wait for input request
    const waitingRun = await waitFor(
      () => client.runs.get(run.id),
      (r) => r.status === 'waiting_user',
      { timeout: 60000 }
    );
    
    expect(waitingRun.userPrompt).toContain('name');
    
    // Provide input
    await client.runs.respond(run.id, {
      message: 'My name is Alice'
    });
    
    // Wait for completion
    const completed = await client.runs.waitForCompletion(run.id);
    
    expect(completed.status).toBe('completed');
    expect(completed.result).toContain('Alice');
  });
  
  test('should generate artifacts', async () => {
    const run = await client.runs.create({
      prompt: 'Create a simple bar chart showing sales data'
    });
    
    const completed = await client.runs.waitForCompletion(run.id);
    
    expect(completed.artifacts).toHaveLength(1);
    expect(completed.artifacts[0].type).toBe('image');
    expect(completed.artifacts[0].mimeType).toBe('image/png');
    
    // Verify artifact is downloadable
    const response = await fetch(completed.artifacts[0].url);
    expect(response.ok).toBe(true);
  });
});

// tests/e2e/collaboration.test.ts

describe('Collaboration', () => {
  test('should allow sharing runs', async () => {
    const owner = await createTestUser();
    const collaborator = await createTestUser();
    
    // Owner creates run
    const run = await owner.client.runs.create({
      prompt: 'Help me write a document'
    });
    
    // Share with collaborator
    await owner.client.runs.share(run.id, {
      userId: collaborator.id,
      permissions: ['view', 'comment']
    });
    
    // Collaborator can view
    const sharedRun = await collaborator.client.runs.get(run.id);
    expect(sharedRun.id).toBe(run.id);
    
    // Collaborator cannot cancel
    await expect(
      collaborator.client.runs.cancel(run.id)
    ).rejects.toThrow('Permission denied');
  });
  
  test('should handle concurrent edits', async () => {
    const owner = await createTestUser();
    const collaborator = await createTestUser();
    
    const run = await owner.client.runs.create({
      prompt: 'Create a shared document'
    });
    
    await owner.client.runs.share(run.id, {
      userId: collaborator.id,
      permissions: ['edit']
    });
    
    // Both connect to collab session
    const ownerSession = await owner.client.collab.connect(run.id);
    const collabSession = await collaborator.client.collab.connect(run.id);
    
    // Simulate concurrent edits
    await Promise.all([
      ownerSession.edit({ path: 'doc.content', value: 'Owner edit' }),
      collabSession.edit({ path: 'doc.content', value: 'Collaborator edit' })
    ]);
    
    // Human edit should win
    const finalState = await owner.client.collab.getState(run.id);
    expect(finalState.doc.content).toBe('Owner edit');
  });
});

// tests/e2e/email-trigger.test.ts

describe('Email Trigger', () => {
  test('should create run from email', async () => {
    const testEmail = {
      from: 'user@example.com',
      to: 'run@manus.im',
      subject: 'Please analyze this data',
      body: 'Attached is a CSV file with sales data. Please create a summary report.',
      attachments: [{
        filename: 'sales.csv',
        content: 'date,amount\n2024-01-01,100\n2024-01-02,150'
      }]
    };
    
    // Send email via test endpoint
    await sendTestEmail(testEmail);
    
    // Wait for run to be created
    const runs = await waitFor(
      () => client.runs.list({ source: 'email' }),
      (r) => r.length > 0,
      { timeout: 30000 }
    );
    
    expect(runs[0].prompt).toContain('analyze');
    expect(runs[0].metadata.sourceEmail).toBe(testEmail.from);
  });
  
  test('should thread email replies', async () => {
    // Create initial run via email
    const email1 = await sendTestEmail({
      from: 'user@example.com',
      to: 'run@manus.im',
      subject: 'Help me plan a trip',
      body: 'I want to visit Paris'
    });
    
    // Wait for run
    const run = await waitForRunFromEmail(email1.messageId);
    
    // Send reply
    await sendTestEmail({
      from: 'user@example.com',
      to: 'run@manus.im',
      subject: 'Re: Help me plan a trip',
      body: 'Actually, I changed my mind. Let\'s go to London instead.',
      inReplyTo: email1.messageId
    });
    
    // Verify reply was added to same run
    const updatedRun = await client.runs.get(run.id);
    expect(updatedRun.messages).toHaveLength(2);
    expect(updatedRun.messages[1].content).toContain('London');
  });
});
```

#### 12.2 Load Test Parameters

```typescript
// tests/load/config.ts

export interface LoadTestConfig {
  name: string;
  duration: string;
  vus: number;  // Virtual users
  rampUp: string;
  thresholds: Record<string, string[]>;
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number;  // Percentage of traffic
  action: () => Promise<void>;
}

export const LOAD_TEST_CONFIGS: LoadTestConfig[] = [
  {
    name: 'baseline',
    duration: '10m',
    vus: 100,
    rampUp: '2m',
    thresholds: {
      'http_req_duration': ['p(95)<500', 'p(99)<1000'],
      'http_req_failed': ['rate<0.01'],
      'run_completion_time': ['p(95)<60000']
    },
    scenarios: [
      {
        name: 'simple_runs',
        weight: 70,
        action: async () => {
          await client.runs.create({
            prompt: 'What is the capital of France?'
          });
        }
      },
      {
        name: 'complex_runs',
        weight: 20,
        action: async () => {
          await client.runs.create({
            prompt: 'Research and summarize the latest news about AI'
          });
        }
      },
      {
        name: 'document_generation',
        weight: 10,
        action: async () => {
          await client.runs.create({
            prompt: 'Create a presentation about climate change'
          });
        }
      }
    ]
  },
  {
    name: 'stress',
    duration: '30m',
    vus: 500,
    rampUp: '5m',
    thresholds: {
      'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
      'http_req_failed': ['rate<0.05'],
      'run_completion_time': ['p(95)<300000']
    },
    scenarios: [
      {
        name: 'mixed_load',
        weight: 100,
        action: async () => {
          const type = Math.random();
          if (type < 0.5) {
            await client.runs.create({ prompt: 'Simple question' });
          } else if (type < 0.8) {
            await client.runs.create({ prompt: 'Medium complexity task' });
          } else {
            await client.runs.create({ prompt: 'Complex multi-step task' });
          }
        }
      }
    ]
  },
  {
    name: 'spike',
    duration: '15m',
    vus: 1000,
    rampUp: '30s',  // Sudden spike
    thresholds: {
      'http_req_duration': ['p(95)<5000'],
      'http_req_failed': ['rate<0.1'],
      'queue_depth': ['max<10000']
    },
    scenarios: [
      {
        name: 'burst_traffic',
        weight: 100,
        action: async () => {
          await client.runs.create({ prompt: 'Spike test request' });
        }
      }
    ]
  },
  {
    name: 'soak',
    duration: '4h',
    vus: 50,
    rampUp: '10m',
    thresholds: {
      'http_req_duration': ['p(95)<1000'],
      'http_req_failed': ['rate<0.001'],
      'memory_usage': ['max<80%'],
      'cpu_usage': ['avg<70%']
    },
    scenarios: [
      {
        name: 'sustained_load',
        weight: 100,
        action: async () => {
          await client.runs.create({ prompt: 'Soak test request' });
          await sleep(randomBetween(1000, 5000));
        }
      }
    ]
  }
];

// k6 script generator
export function generateK6Script(config: LoadTestConfig): string {
  return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const runCompletionTime = new Trend('run_completion_time');
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '${config.rampUp}', target: ${config.vus} },
    { duration: '${config.duration}', target: ${config.vus} },
    { duration: '2m', target: 0 }
  ],
  thresholds: ${JSON.stringify(config.thresholds)}
};

export default function() {
  const scenario = selectScenario(${JSON.stringify(config.scenarios.map(s => ({ name: s.name, weight: s.weight })))});
  
  switch (scenario) {
    ${config.scenarios.map(s => `
    case '${s.name}':
      ${s.name}();
      break;
    `).join('')}
  }
}

function selectScenario(scenarios) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const s of scenarios) {
    cumulative += s.weight;
    if (rand < cumulative) return s.name;
  }
  return scenarios[0].name;
}

${config.scenarios.map(s => `
function ${s.name}() {
  const start = Date.now();
  
  const createRes = http.post(
    '${process.env.API_URL}/api/runs',
    JSON.stringify({ prompt: 'Test prompt for ${s.name}' }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + __ENV.API_KEY } }
  );
  
  check(createRes, {
    'run created': (r) => r.status === 201
  }) || errorRate.add(1);
  
  if (createRes.status === 201) {
    const runId = createRes.json('id');
    
    // Poll for completion
    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 60) {
      sleep(1);
      const statusRes = http.get(
        '${process.env.API_URL}/api/runs/' + runId,
        { headers: { 'Authorization': 'Bearer ' + __ENV.API_KEY } }
      );
      
      if (statusRes.json('status') === 'completed' || statusRes.json('status') === 'failed') {
        completed = true;
        runCompletionTime.add(Date.now() - start);
      }
      attempts++;
    }
  }
}
`).join('')}
`;
}
```

---

## Appendix: Interface Contracts Summary

### API Endpoints

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/runs` | POST | `{ prompt, config? }` | `Run` |
| `/api/runs/:id` | GET | - | `Run` |
| `/api/runs/:id` | DELETE | - | `{ success: true }` |
| `/api/runs/:id/respond` | POST | `{ message }` | `Run` |
| `/api/runs/:id/artifacts` | GET | - | `Artifact[]` |
| `/api/billing/usage` | GET | `?start&end` | `UsageReport` |
| `/api/connectors/:id/auth` | GET | - | `{ authUrl }` |
| `/api/connectors/:id/callback` | GET | `?code&state` | Redirect |

### Event Types

| Event | Payload |
|-------|---------|
| `run.created` | `{ runId, tenantId, prompt }` |
| `run.started` | `{ runId, startedAt }` |
| `run.completed` | `{ runId, result, duration }` |
| `run.failed` | `{ runId, error }` |
| `run.cancelled` | `{ runId, reason }` |
| `step.completed` | `{ runId, stepId, tool, result }` |
| `billing.charged` | `{ tenantId, amount, runId }` |

### Job Schemas

| Queue | Job Type | Required Fields |
|-------|----------|-----------------|
| `runs` | `run` | `runId, tenantId, action` |
| `steps` | `step` |
 `stepId, runId, tool, params` |
| `outbox` | `event` | `eventType, payload, destinations` |
| `dlq` | `failed` | `originalJob, error, attempts` |

---

## Implementation Order (PR Sequence)

Execute PRs in this order for minimal dependency conflicts:

```
Week 1-2: Foundation
├── PR-001: Repository Setup
├── PR-002: Data Model (schema + migrations)
└── PR-003: Run State Machine

Week 3-4: Core Runtime
├── PR-004: Worker Architecture
├── PR-005: Agent Runtime
└── PR-006: Document Generation

Week 5-6: Operations
├── PR-007: Observability
├── PR-008: Security Hardening
└── PR-009: Collaboration

Week 7-8: Integrations
├── PR-010: Email Trigger
├── PR-011: Connector SDK
└── PR-012: Acceptance Tests

Week 9+: Polish
├── Performance tuning
├── Chaos engineering validation
└── Production hardening
```

---

## Configuration Reference

### Environment Variables

```bash
# Core
DATABASE_URL=postgres://user:pass@host:5432/manus
REDIS_URL=redis://host:6379
JWT_SECRET=<random-256-bit>

# LLM
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Storage
S3_BUCKET=manus-artifacts
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG...
INBOUND_EMAIL_DOMAIN=run.manus.im

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
PROMETHEUS_PUSH_GATEWAY=http://prometheus-pushgateway:9091

# Security
KMS_KEY_ID=alias/manus-data-key
VAULT_ADDR=https://vault.internal:8200
VAULT_TOKEN=hvs...

# Feature Flags
ENABLE_CHAOS_EXPERIMENTS=false
ENABLE_EMAIL_TRIGGER=true
MAX_CONCURRENT_RUNS_PER_TENANT=10
```

### Kubernetes Resource Recommendations

| Component | Replicas | CPU | Memory | Storage |
|-----------|----------|-----|--------|---------|
| API | 3-10 | 500m-2 | 512Mi-2Gi | - |
| Worker | 5-50 | 1-4 | 2Gi-8Gi | - |
| Sandbox | Dynamic | 2 | 4Gi | 10Gi |
| PostgreSQL | 3 | 2-8 | 8Gi-32Gi | 100Gi-1Ti |
| Redis | 3 | 1-2 | 4Gi-16Gi | - |
| Prometheus | 2 | 1-2 | 4Gi-16Gi | 100Gi |

---

## Glossary

| Term | Definition |
|------|------------|
| **Run** | A single task execution from user prompt to completion |
| **Step** | An atomic operation within a run (tool invocation) |
| **Artifact** | A file or output produced by a run |
| **Tenant** | An isolated customer account |
| **Sandbox** | Isolated execution environment for agent code |
| **Outbox** | Transactional event queue for reliable delivery |
| **DLQ** | Dead letter queue for failed jobs |
| **SLO** | Service level objective (target reliability) |
| **SLI** | Service level indicator (measured metric) |
| **Burn Rate** | Rate of error budget consumption |

---

*This playbook is designed to be executed as a series of pull requests. Each PR should be reviewed, tested, and merged before proceeding to the next. Total estimated implementation time: 8-12 weeks with a team of 3-5 engineers.*
