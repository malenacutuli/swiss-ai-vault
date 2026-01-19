\# Manus Implementation Playbook

\*\*Document Type:\*\* Executable Implementation Specification    
\*\*Format:\*\* Pull Request Sequence    
\*\*Target:\*\* Rebuild Manus from scratch using Claude Code    
\*\*Constraint:\*\* Every section contains exact schemas, pseudocode, and interface contracts

\---

\#\# Table of Contents

1\. \[Repository Layout\](\#1-repository-layout)  
2\. \[Data Model\](\#2-data-model)  
3\. \[Run State Machine\](\#3-run-state-machine)  
4\. \[Worker Architecture\](\#4-worker-architecture)  
5\. \[Agent Runtime\](\#5-agent-runtime)  
6\. \[Document Generation\](\#6-document-generation)  
7\. \[Observability\](\#7-observability)  
8\. \[Collaboration\](\#8-collaboration)  
9\. \[Email Trigger\](\#9-email-trigger)  
10\. \[Integrations\](\#10-integrations)  
11\. \[Security\](\#11-security)  
12\. \[Acceptance Tests\](\#12-acceptance-tests)

\---

\#\# PR Sequence Overview

| PR \# | Name | Dependencies | Estimated LOC |  
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

\---

\#\# 1\. Repository Layout

\#\#\# PR-001: Repository Scaffold

\`\`\`  
manus/  
├── .github/  
│   ├── workflows/  
│   │   ├── ci.yml                    \# PR checks: lint, test, typecheck  
│   │   ├── cd.yml                    \# Deploy to staging/prod  
│   │   └── chaos.yml                 \# Scheduled chaos experiments  
│   └── CODEOWNERS  
├── packages/  
│   ├── core/                         \# Shared types, utils, constants  
│   │   ├── src/  
│   │   │   ├── types/  
│   │   │   │   ├── run.ts            \# Run, Step, Artifact types  
│   │   │   │   ├── agent.ts          \# Agent, Tool, Memory types  
│   │   │   │   ├── billing.ts        \# Credit, Transaction types  
│   │   │   │   └── index.ts  
│   │   │   ├── utils/  
│   │   │   │   ├── idempotency.ts    \# Idempotency key generation  
│   │   │   │   ├── retry.ts          \# Retry with backoff  
│   │   │   │   └── hash.ts           \# Content hashing  
│   │   │   └── constants/  
│   │   │       ├── limits.ts         \# Rate limits, quotas  
│   │   │       └── states.ts         \# State machine constants  
│   │   ├── package.json  
│   │   └── tsconfig.json  
│   ├── db/                           \# Database schema & migrations  
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
│   │   │   ├── client.ts             \# Database client factory  
│   │   │   ├── queries/              \# Type-safe query helpers  
│   │   │   └── transactions.ts       \# Transaction helpers  
│   │   └── package.json  
│   ├── queue/                        \# Job queue abstraction  
│   │   ├── src/  
│   │   │   ├── producer.ts           \# Job enqueue  
│   │   │   ├── consumer.ts           \# Job processing  
│   │   │   ├── schemas/              \# Job payload schemas (Zod)  
│   │   │   │   ├── run-job.ts  
│   │   │   │   ├── step-job.ts  
│   │   │   │   └── notification-job.ts  
│   │   │   └── dlq.ts                \# Dead letter queue handling  
│   │   └── package.json  
│   ├── state-machine/                \# Run state machine  
│   │   ├── src/  
│   │   │   ├── machine.ts            \# XState machine definition  
│   │   │   ├── transitions.ts        \# Transition handlers  
│   │   │   ├── guards.ts             \# Transition guards  
│   │   │   └── actions.ts            \# Side effects  
│   │   └── package.json  
│   ├── agent/                        \# Agent runtime  
│   │   ├── src/  
│   │   │   ├── planner/  
│   │   │   │   ├── planner.ts        \# Plan generation  
│   │   │   │   ├── scorer.ts         \# Plan scoring  
│   │   │   │   └── repair.ts         \# Plan repair  
│   │   │   ├── supervisor/  
│   │   │   │   ├── supervisor.ts     \# Execution supervisor  
│   │   │   │   ├── loop.ts           \# Agent loop  
│   │   │   │   └── checkpoint.ts     \# State checkpointing  
│   │   │   ├── tools/  
│   │   │   │   ├── router.ts         \# Tool selection  
│   │   │   │   ├── executor.ts       \# Tool execution  
│   │   │   │   └── registry.ts       \# Tool registry  
│   │   │   ├── memory/  
│   │   │   │   ├── context.ts        \# Context window management  
│   │   │   │   ├── compression.ts    \# Context compression  
│   │   │   │   └── retrieval.ts      \# Memory retrieval  
│   │   │   └── index.ts  
│   │   └── package.json  
│   ├── sandbox/                      \# Sandbox runtime  
│   │   ├── src/  
│   │   │   ├── manager.ts            \# Sandbox lifecycle  
│   │   │   ├── executor.ts           \# Code execution  
│   │   │   ├── filesystem.ts         \# FS operations  
│   │   │   └── network.ts            \# Network proxy  
│   │   └── package.json  
│   ├── docgen/                       \# Document generation  
│   │   ├── src/  
│   │   │   ├── slides/  
│   │   │   │   ├── pipeline.ts       \# Slide generation pipeline  
│   │   │   │   ├── templates/        \# Slide templates  
│   │   │   │   └── export.ts         \# PPTX/PDF export  
│   │   │   ├── charts/  
│   │   │   │   ├── pipeline.ts       \# Chart generation  
│   │   │   │   └── renderers/        \# Chart.js, D3, etc.  
│   │   │   ├── documents/  
│   │   │   │   ├── pipeline.ts       \# Doc generation  
│   │   │   │   └── templates/  
│   │   │   └── index.ts  
│   │   └── package.json  
│   ├── collab/                       \# Collaboration  
│   │   ├── src/  
│   │   │   ├── crdt/  
│   │   │   │   ├── yjs-provider.ts   \# Yjs integration  
│   │   │   │   └── awareness.ts      \# Presence/cursors  
│   │   │   ├── permissions.ts        \# Access control  
│   │   │   └── sync.ts               \# Sync protocol  
│   │   └── package.json  
│   ├── connectors/                   \# Integration connectors  
│   │   ├── src/  
│   │   │   ├── sdk/  
│   │   │   │   ├── base.ts           \# Base connector class  
│   │   │   │   ├── oauth.ts          \# OAuth flow  
│   │   │   │   └── types.ts          \# Connector types  
│   │   │   ├── builtin/  
│   │   │   │   ├── google/  
│   │   │   │   ├── github/  
│   │   │   │   ├── slack/  
│   │   │   │   └── notion/  
│   │   │   └── index.ts  
│   │   └── package.json  
│   ├── observability/                \# Metrics, traces, logs  
│   │   ├── src/  
│   │   │   ├── metrics.ts            \# Prometheus metrics  
│   │   │   ├── tracing.ts            \# OpenTelemetry  
│   │   │   ├── logging.ts            \# Structured logging  
│   │   │   └── slo.ts                \# SLO definitions  
│   │   └── package.json  
│   └── email/                        \# Email processing  
│       ├── src/  
│       │   ├── inbound/  
│       │   │   ├── parser.ts         \# Email parsing  
│       │   │   ├── threading.ts      \# Thread detection  
│       │   │   └── intent.ts         \# Intent extraction  
│       │   ├── outbound/  
│       │   │   ├── sender.ts         \# Email sending  
│       │   │   └── templates/        \# Email templates  
│       │   └── index.ts  
│       └── package.json  
├── apps/  
│   ├── api/                          \# Main API server  
│   │   ├── src/  
│   │   │   ├── routes/  
│   │   │   │   ├── runs.ts           \# Run management  
│   │   │   │   ├── billing.ts        \# Billing endpoints  
│   │   │   │   └── webhooks.ts       \# Webhook handlers  
│   │   │   ├── middleware/  
│   │   │   │   ├── auth.ts           \# Authentication  
│   │   │   │   ├── ratelimit.ts      \# Rate limiting  
│   │   │   │   └── tenant.ts         \# Tenant context  
│   │   │   └── server.ts  
│   │   └── package.json  
│   ├── worker/                       \# Background workers  
│   │   ├── src/  
│   │   │   ├── handlers/  
│   │   │   │   ├── run-handler.ts  
│   │   │   │   ├── step-handler.ts  
│   │   │   │   └── cleanup-handler.ts  
│   │   │   └── worker.ts  
│   │   └── package.json  
│   ├── web/                          \# Frontend app  
│   │   ├── src/  
│   │   │   ├── pages/  
│   │   │   ├── components/  
│   │   │   └── lib/  
│   │   └── package.json  
│   └── scheduler/                    \# Cron jobs  
│       ├── src/  
│       │   ├── jobs/  
│       │   │   ├── stuck-run-detector.ts  
│       │   │   ├── quota-reset.ts  
│       │   │   └── cleanup.ts  
│       │   └── scheduler.ts  
│       └── package.json  
├── infra/  
│   ├── terraform/                    \# Infrastructure as code  
│   │   ├── modules/  
│   │   │   ├── database/  
│   │   │   ├── queue/  
│   │   │   ├── sandbox/  
│   │   │   └── observability/  
│   │   └── environments/  
│   │       ├── staging/  
│   │       └── production/  
│   ├── kubernetes/                   \# K8s manifests  
│   │   ├── base/  
│   │   └── overlays/  
│   └── docker/  
│       ├── Dockerfile.api  
│       ├── Dockerfile.worker  
│       └── Dockerfile.sandbox  
├── tools/  
│   ├── scripts/  
│   │   ├── migrate.ts                \# DB migrations  
│   │   ├── seed.ts                   \# Test data  
│   │   └── chaos.ts                  \# Chaos experiments  
│   └── generators/  
│       └── connector.ts              \# Connector scaffolding  
├── tests/  
│   ├── unit/  
│   ├── integration/  
│   ├── e2e/  
│   └── load/  
├── pnpm-workspace.yaml  
├── turbo.json  
└── package.json  
\`\`\`

\#\#\# Module Responsibilities

| Module | Responsibility | Key Exports |  
|--------|---------------|-------------|  
| \`core\` | Shared types, utilities, constants | \`Run\`, \`Step\`, \`IdempotencyKey\`, \`RetryPolicy\` |  
| \`db\` | Schema, migrations, queries | \`db\`, \`schema\`, \`queries\` |  
| \`queue\` | Job queue abstraction | \`enqueue\`, \`consume\`, \`JobSchema\` |  
| \`state-machine\` | Run lifecycle management | \`runMachine\`, \`transition\` |  
| \`agent\` | AI agent runtime | \`Planner\`, \`Supervisor\`, \`ToolRouter\` |  
| \`sandbox\` | Isolated execution environment | \`SandboxManager\`, \`execute\` |  
| \`docgen\` | Document generation | \`generateSlides\`, \`generateChart\` |  
| \`collab\` | Real-time collaboration | \`CollabProvider\`, \`sync\` |  
| \`connectors\` | External integrations | \`Connector\`, \`ConnectorSDK\` |  
| \`observability\` | Metrics, traces, logs | \`metrics\`, \`tracer\`, \`logger\` |  
| \`email\` | Email processing | \`parseEmail\`, \`sendEmail\` |

\---

\#\# 2\. Data Model

\#\#\# PR-002: Core Data Model

\#\#\#\# 2.1 Runs Table

\`\`\`sql  
\-- runs: Core execution unit  
CREATE TABLE runs (  
    \-- Identity  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    external\_id VARCHAR(64) UNIQUE NOT NULL,  \-- User-facing ID (run\_xxx)  
      
    \-- Ownership  
    tenant\_id UUID NOT NULL REFERENCES tenants(id),  
    user\_id UUID NOT NULL REFERENCES users(id),  
      
    \-- State  
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  
    \-- Values: pending, queued, planning, executing, paused,   
    \--         waiting\_user, completed, failed, cancelled, timeout  
      
    \-- Content  
    prompt TEXT NOT NULL,  
    prompt\_hash VARCHAR(64) NOT NULL,  \-- SHA-256 for dedup  
    system\_context JSONB,              \-- System prompt additions  
      
    \-- Configuration  
    config JSONB NOT NULL DEFAULT '{}',  
    \-- {  
    \--   "max\_steps": 50,  
    \--   "max\_duration\_seconds": 3600,  
    \--   "max\_credits": 100,  
    \--   "tools\_enabled": \["browser", "code", "file"\],  
    \--   "model": "claude-sonnet-4-20250514",  
    \--   "temperature": 0.7  
    \-- }  
      
    \-- Plan  
    plan JSONB,  
    \-- {  
    \--   "goal": "...",  
    \--   "phases": \[...\],  
    \--   "current\_phase\_id": 1,  
    \--   "version": 3  
    \-- }  
      
    \-- Progress  
    current\_step\_id UUID REFERENCES steps(id),  
    step\_count INTEGER NOT NULL DEFAULT 0,  
      
    \-- Billing  
    credits\_reserved INTEGER NOT NULL DEFAULT 0,  
    credits\_consumed INTEGER NOT NULL DEFAULT 0,  
      
    \-- Timing  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    started\_at TIMESTAMPTZ,  
    completed\_at TIMESTAMPTZ,  
    timeout\_at TIMESTAMPTZ,  
      
    \-- Metadata  
    metadata JSONB DEFAULT '{}',  
    \-- {  
    \--   "source": "web" | "api" | "email" | "scheduled",  
    \--   "client\_ip": "...",  
    \--   "user\_agent": "...",  
    \--   "parent\_run\_id": "..." (for sub-runs)  
    \-- }  
      
    \-- Versioning  
    version INTEGER NOT NULL DEFAULT 1,  
      
    \-- Indexes  
    CONSTRAINT valid\_status CHECK (status IN (  
        'pending', 'queued', 'planning', 'executing', 'paused',  
        'waiting\_user', 'completed', 'failed', 'cancelled', 'timeout'  
    ))  
);

\-- Indexes  
CREATE INDEX idx\_runs\_tenant\_status ON runs(tenant\_id, status);  
CREATE INDEX idx\_runs\_user\_created ON runs(user\_id, created\_at DESC);  
CREATE INDEX idx\_runs\_status\_timeout ON runs(status, timeout\_at)   
    WHERE status IN ('executing', 'paused', 'waiting\_user');  
CREATE INDEX idx\_runs\_prompt\_hash ON runs(tenant\_id, prompt\_hash);  
\`\`\`

\#\#\#\# 2.2 Steps Table

\`\`\`sql  
\-- steps: Individual execution steps within a run  
CREATE TABLE steps (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    run\_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
      
    \-- Ordering  
    sequence\_number INTEGER NOT NULL,  
    phase\_id INTEGER,  \-- Links to plan.phases\[\].id  
      
    \-- Type  
    type VARCHAR(32) NOT NULL,  
    \-- Values: think, tool\_call, tool\_result, user\_message,   
    \--         assistant\_message, error, checkpoint  
      
    \-- Content  
    content JSONB NOT NULL,  
    \-- For tool\_call:  
    \-- {  
    \--   "tool": "browser",  
    \--   "action": "navigate",  
    \--   "parameters": {...},  
    \--   "idempotency\_key": "..."  
    \-- }  
    \-- For tool\_result:  
    \-- {  
    \--   "tool": "browser",  
    \--   "success": true,  
    \--   "result": {...},  
    \--   "duration\_ms": 1234  
    \-- }  
      
    \-- Status  
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  
    \-- Values: pending, executing, completed, failed, skipped  
      
    \-- Billing  
    tokens\_input INTEGER DEFAULT 0,  
    tokens\_output INTEGER DEFAULT 0,  
    credits\_consumed INTEGER DEFAULT 0,  
      
    \-- Timing  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    started\_at TIMESTAMPTZ,  
    completed\_at TIMESTAMPTZ,  
    duration\_ms INTEGER,  
      
    \-- Error handling  
    error JSONB,  
    \-- {  
    \--   "code": "TOOL\_TIMEOUT",  
    \--   "message": "...",  
    \--   "retryable": true,  
    \--   "retry\_count": 2  
    \-- }  
    retry\_count INTEGER NOT NULL DEFAULT 0,  
      
    CONSTRAINT unique\_run\_sequence UNIQUE (run\_id, sequence\_number)  
);

\-- Indexes  
CREATE INDEX idx\_steps\_run\_sequence ON steps(run\_id, sequence\_number);  
CREATE INDEX idx\_steps\_run\_status ON steps(run\_id, status);  
CREATE INDEX idx\_steps\_type ON steps(type) WHERE type \= 'tool\_call';  
\`\`\`

\#\#\#\# 2.3 Artifacts Table

\`\`\`sql  
\-- artifacts: Files and outputs produced by runs  
CREATE TABLE artifacts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    run\_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
    step\_id UUID REFERENCES steps(id),  
      
    \-- Identity  
    name VARCHAR(255) NOT NULL,  
    path VARCHAR(1024),  \-- Path within sandbox  
      
    \-- Type  
    type VARCHAR(32) NOT NULL,  
    \-- Values: file, image, document, chart, code, data  
    mime\_type VARCHAR(128),  
      
    \-- Storage  
    storage\_key VARCHAR(512) NOT NULL,  \-- S3 key  
    storage\_url TEXT,                    \-- Presigned URL (cached)  
    url\_expires\_at TIMESTAMPTZ,  
      
    \-- Metadata  
    size\_bytes BIGINT NOT NULL,  
    checksum VARCHAR(64),  \-- SHA-256  
    metadata JSONB DEFAULT '{}',  
    \-- {  
    \--   "width": 1920,  
    \--   "height": 1080,  
    \--   "pages": 10,  
    \--   "generated\_by": "docgen"  
    \-- }  
      
    \-- Visibility  
    visibility VARCHAR(32) NOT NULL DEFAULT 'private',  
    \-- Values: private, run, tenant, public  
      
    \-- Timing  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    expires\_at TIMESTAMPTZ,  \-- For temporary artifacts  
      
    CONSTRAINT unique\_run\_path UNIQUE (run\_id, path)  
);

\-- Indexes  
CREATE INDEX idx\_artifacts\_run ON artifacts(run\_id);  
CREATE INDEX idx\_artifacts\_type ON artifacts(type);  
CREATE INDEX idx\_artifacts\_expires ON artifacts(expires\_at) WHERE expires\_at IS NOT NULL;  
\`\`\`

\#\#\#\# 2.4 Outbox Table (Transactional Outbox Pattern)

\`\`\`sql  
\-- outbox: Reliable event publishing  
CREATE TABLE outbox (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Event  
    event\_type VARCHAR(64) NOT NULL,  
    \-- Values: run.created, run.completed, step.completed,   
    \--         billing.charged, notification.send  
      
    aggregate\_type VARCHAR(32) NOT NULL,  \-- runs, steps, billing  
    aggregate\_id UUID NOT NULL,  
      
    \-- Payload  
    payload JSONB NOT NULL,  
      
    \-- Processing  
    status VARCHAR(16) NOT NULL DEFAULT 'pending',  
    \-- Values: pending, processing, completed, failed  
      
    processed\_at TIMESTAMPTZ,  
    error TEXT,  
    retry\_count INTEGER NOT NULL DEFAULT 0,  
      
    \-- Timing  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Ordering  
    sequence\_number BIGSERIAL NOT NULL  
);

\-- Indexes  
CREATE INDEX idx\_outbox\_pending ON outbox(status, created\_at)   
    WHERE status \= 'pending';  
CREATE INDEX idx\_outbox\_aggregate ON outbox(aggregate\_type, aggregate\_id);  
\`\`\`

\#\#\#\# 2.5 Billing Tables

\`\`\`sql  
\-- credit\_ledger: Double-entry credit accounting  
CREATE TABLE credit\_ledger (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Account  
    tenant\_id UUID NOT NULL REFERENCES tenants(id),  
    account\_type VARCHAR(32) NOT NULL,  
    \-- Values: balance, reserved, consumed, refunded, purchased  
      
    \-- Transaction  
    amount INTEGER NOT NULL,  \-- Positive \= credit, Negative \= debit  
    balance\_after INTEGER NOT NULL,  
      
    \-- Reference  
    reference\_type VARCHAR(32),  \-- run, purchase, refund, adjustment  
    reference\_id UUID,  
      
    \-- Metadata  
    description TEXT,  
    metadata JSONB DEFAULT '{}',  
      
    \-- Idempotency  
    idempotency\_key VARCHAR(128) UNIQUE,  
      
    \-- Timing  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Audit  
    created\_by UUID REFERENCES users(id)  
);

\-- Indexes  
CREATE INDEX idx\_ledger\_tenant\_type ON credit\_ledger(tenant\_id, account\_type);  
CREATE INDEX idx\_ledger\_reference ON credit\_ledger(reference\_type, reference\_id);  
CREATE INDEX idx\_ledger\_created ON credit\_ledger(tenant\_id, created\_at DESC);

\-- credit\_reservations: Active credit holds  
CREATE TABLE credit\_reservations (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID NOT NULL REFERENCES tenants(id),  
    run\_id UUID NOT NULL REFERENCES runs(id),  
      
    amount INTEGER NOT NULL,  
    consumed INTEGER NOT NULL DEFAULT 0,  
      
    status VARCHAR(16) NOT NULL DEFAULT 'active',  
    \-- Values: active, released, consumed  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    released\_at TIMESTAMPTZ,  
      
    CONSTRAINT unique\_run\_reservation UNIQUE (run\_id)  
);

\-- tenant\_quotas: Usage limits  
CREATE TABLE tenant\_quotas (  
    tenant\_id UUID PRIMARY KEY REFERENCES tenants(id),  
      
    \-- Credit limits  
    credit\_balance INTEGER NOT NULL DEFAULT 0,  
    credit\_limit INTEGER NOT NULL DEFAULT 1000,  
      
    \-- Rate limits  
    runs\_per\_hour INTEGER NOT NULL DEFAULT 100,  
    concurrent\_runs INTEGER NOT NULL DEFAULT 10,  
      
    \-- Storage limits  
    storage\_bytes\_used BIGINT NOT NULL DEFAULT 0,  
    storage\_bytes\_limit BIGINT NOT NULL DEFAULT 10737418240,  \-- 10GB  
      
    \-- Reset  
    quota\_reset\_at TIMESTAMPTZ NOT NULL DEFAULT NOW() \+ INTERVAL '1 month',  
      
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);  
\`\`\`

\#\#\#\# 2.6 Audit Tables

\`\`\`sql  
\-- audit\_log: Immutable audit trail  
CREATE TABLE audit\_log (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Actor  
    tenant\_id UUID NOT NULL,  
    user\_id UUID,  
    service\_name VARCHAR(64),  \-- For system actions  
      
    \-- Action  
    action VARCHAR(64) NOT NULL,  
    \-- Values: run.create, run.cancel, settings.update,   
    \--         connector.authorize, user.invite, etc.  
      
    \-- Target  
    resource\_type VARCHAR(32) NOT NULL,  
    resource\_id UUID,  
      
    \-- Details  
    old\_value JSONB,  
    new\_value JSONB,  
    metadata JSONB DEFAULT '{}',  
      
    \-- Context  
    ip\_address INET,  
    user\_agent TEXT,  
    request\_id VARCHAR(64),  
      
    \-- Timing (immutable)  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    \-- Integrity  
    checksum VARCHAR(64) NOT NULL,  \-- SHA-256 of row content  
    previous\_checksum VARCHAR(64)    \-- Chain to previous entry  
);

\-- Partitioned by month for performance  
\-- In production, use: PARTITION BY RANGE (created\_at)

\-- Indexes  
CREATE INDEX idx\_audit\_tenant\_created ON audit\_log(tenant\_id, created\_at DESC);  
CREATE INDEX idx\_audit\_resource ON audit\_log(resource\_type, resource\_id);  
CREATE INDEX idx\_audit\_action ON audit\_log(action, created\_at DESC);  
\`\`\`

\#\#\#\# 2.7 RBAC Tables

\`\`\`sql  
\-- roles: Role definitions  
CREATE TABLE roles (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    tenant\_id UUID REFERENCES tenants(id),  \-- NULL \= system role  
      
    name VARCHAR(64) NOT NULL,  
    description TEXT,  
      
    \-- Permissions as array  
    permissions TEXT\[\] NOT NULL DEFAULT '{}',  
    \-- Values: runs.create, runs.read, runs.cancel, runs.read\_all,  
    \--         billing.read, billing.manage, settings.read, settings.manage,  
    \--         users.invite, users.manage, connectors.manage, admin.\*  
      
    \-- Flags  
    is\_system BOOLEAN NOT NULL DEFAULT FALSE,  
    is\_default BOOLEAN NOT NULL DEFAULT FALSE,  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    CONSTRAINT unique\_tenant\_role UNIQUE (tenant\_id, name)  
);

\-- Default system roles  
INSERT INTO roles (id, name, permissions, is\_system, is\_default) VALUES  
    ('00000000-0000-0000-0000-000000000001', 'owner',   
     ARRAY\['\*'\], TRUE, FALSE),  
    ('00000000-0000-0000-0000-000000000002', 'admin',   
     ARRAY\['runs.\*', 'billing.\*', 'settings.\*', 'users.\*', 'connectors.\*'\], TRUE, FALSE),  
    ('00000000-0000-0000-0000-000000000003', 'member',   
     ARRAY\['runs.create', 'runs.read', 'runs.cancel', 'billing.read', 'connectors.use'\], TRUE, TRUE);

\-- user\_roles: Role assignments  
CREATE TABLE user\_roles (  
    user\_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
    role\_id UUID NOT NULL REFERENCES roles(id),  
      
    granted\_by UUID REFERENCES users(id),  
    granted\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    expires\_at TIMESTAMPTZ,  
      
    PRIMARY KEY (user\_id, tenant\_id, role\_id)  
);

\-- Indexes  
CREATE INDEX idx\_user\_roles\_tenant ON user\_roles(tenant\_id);  
\`\`\`

\#\#\#\# 2.8 Collaboration Tables

\`\`\`sql  
\-- collab\_sessions: Active collaboration sessions  
CREATE TABLE collab\_sessions (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    run\_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,  
      
    \-- Yjs document state  
    doc\_state BYTEA,  \-- Yjs encoded state  
    state\_vector BYTEA,  \-- For sync  
      
    \-- Participants  
    participants JSONB NOT NULL DEFAULT '\[\]',  
    \-- \[{ "user\_id": "...", "cursor": {...}, "last\_seen": "..." }\]  
      
    \-- Versioning  
    version INTEGER NOT NULL DEFAULT 0,  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
      
    CONSTRAINT unique\_run\_session UNIQUE (run\_id)  
);

\-- collab\_updates: Update history for conflict resolution  
CREATE TABLE collab\_updates (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    session\_id UUID NOT NULL REFERENCES collab\_sessions(id) ON DELETE CASCADE,  
      
    \-- Update  
    update\_data BYTEA NOT NULL,  \-- Yjs update  
      
    \-- Origin  
    user\_id UUID REFERENCES users(id),  
    client\_id VARCHAR(64),  
      
    \-- Ordering  
    sequence\_number BIGSERIAL NOT NULL,  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Indexes  
CREATE INDEX idx\_collab\_updates\_session ON collab\_updates(session\_id, sequence\_number);  
\`\`\`

\#\#\#\# 2.9 TypeScript Schema (Drizzle)

\`\`\`typescript  
// packages/db/drizzle/schema/runs.ts  
import { pgTable, uuid, varchar, text, jsonb, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const runs \= pgTable('runs', {  
  id: uuid('id').primaryKey().defaultRandom(),  
  externalId: varchar('external\_id', { length: 64 }).notNull().unique(),  
    
  tenantId: uuid('tenant\_id').notNull().references(() \=\> tenants.id),  
  userId: uuid('user\_id').notNull().references(() \=\> users.id),  
    
  status: varchar('status', { length: 32 }).notNull().default('pending'),  
    
  prompt: text('prompt').notNull(),  
  promptHash: varchar('prompt\_hash', { length: 64 }).notNull(),  
  systemContext: jsonb('system\_context'),  
    
  config: jsonb('config').notNull().default({}),  
  plan: jsonb('plan'),  
    
  currentStepId: uuid('current\_step\_id').references(() \=\> steps.id),  
  stepCount: integer('step\_count').notNull().default(0),  
    
  creditsReserved: integer('credits\_reserved').notNull().default(0),  
  creditsConsumed: integer('credits\_consumed').notNull().default(0),  
    
  createdAt: timestamp('created\_at', { withTimezone: true }).notNull().defaultNow(),  
  startedAt: timestamp('started\_at', { withTimezone: true }),  
  completedAt: timestamp('completed\_at', { withTimezone: true }),  
  timeoutAt: timestamp('timeout\_at', { withTimezone: true }),  
    
  metadata: jsonb('metadata').default({}),  
  version: integer('version').notNull().default(1),  
}, (table) \=\> ({  
  tenantStatusIdx: index('idx\_runs\_tenant\_status').on(table.tenantId, table.status),  
  userCreatedIdx: index('idx\_runs\_user\_created').on(table.userId, table.createdAt),  
  promptHashIdx: index('idx\_runs\_prompt\_hash').on(table.tenantId, table.promptHash),  
}));

// Type exports  
export type Run \= typeof runs.$inferSelect;  
export type NewRun \= typeof runs.$inferInsert;

// Status enum  
export const RUN\_STATUSES \= \[  
  'pending',  
  'queued',   
  'planning',  
  'executing',  
  'paused',  
  'waiting\_user',  
  'completed',  
  'failed',  
  'cancelled',  
  'timeout'  
\] as const;

export type RunStatus \= typeof RUN\_STATUSES\[number\];  
\`\`\`

\---

\#\# 3\. Run State Machine

\#\#\# PR-003: Run State Machine

\#\#\#\# 3.1 State Diagram

\`\`\`  
                                    ┌─────────────────────────────────────────────────────────┐  
                                    │                                                         │  
                                    ▼                                                         │  
┌─────────┐    enqueue    ┌────────┐    start     ┌──────────┐    plan\_ready   ┌───────────┐ │  
│ PENDING │──────────────▶│ QUEUED │─────────────▶│ PLANNING │────────────────▶│ EXECUTING │─┤  
└─────────┘               └────────┘              └──────────┘                 └───────────┘ │  
     │                         │                       │                            │  │  │  │  
     │                         │                       │                            │  │  │  │  
     │ cancel                  │ cancel                │ plan\_failed                │  │  │  │  
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
                                                 └─────────┘         timeout\_reached      │  │  
                                                                                          │  │  
                              ┌────────────────────────────────────────────────────────────┘  │  
                              │ need\_user\_input                                               │  
                              ▼                                                               │  
                        ┌──────────────┐                                                      │  
                        │ WAITING\_USER │──────────────────────────────────────────────────────┤  
                        └──────────────┘         user\_responded                               │  
                              │                                                               │  
                              │ cancel                                                        │  
                              ▼                                                               │  
                        ┌───────────┐                                                         │  
                        │ CANCELLED │                                                         │  
                        └───────────┘                                                         │  
                                                                                              │  
                              ┌────────────────────────────────────────────────────────────────┘  
                              │ pause\_requested  
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
                              │ goal\_achieved  
                              ▼  
                        ┌───────────┐  
                        │ COMPLETED │  
                        └───────────┘  
\`\`\`

\#\#\#\# 3.2 XState Machine Definition

\`\`\`typescript  
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

export type RunEvent \=  
  | { type: 'ENQUEUE' }  
  | { type: 'START' }  
  | { type: 'PLAN\_READY'; plan: Plan }  
  | { type: 'PLAN\_FAILED'; error: Error }  
  | { type: 'STEP\_COMPLETED'; step: Step }  
  | { type: 'STEP\_FAILED'; error: Error; retryable: boolean }  
  | { type: 'NEED\_USER\_INPUT'; prompt: string }  
  | { type: 'USER\_RESPONDED'; response: string }  
  | { type: 'GOAL\_ACHIEVED'; result: any }  
  | { type: 'PAUSE' }  
  | { type: 'RESUME' }  
  | { type: 'CANCEL'; reason?: string }  
  | { type: 'TIMEOUT' }  
  | { type: 'ERROR'; error: Error };

export const runMachine \= createMachine\<RunContext, RunEvent\>({  
  id: 'run',  
  initial: 'pending',  
    
  states: {  
    pending: {  
      on: {  
        ENQUEUE: {  
          target: 'queued',  
          actions: \['reserveCredits', 'publishEvent'\]  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    queued: {  
      on: {  
        START: {  
          target: 'planning',  
          actions: \['setStartTime', 'setTimeoutTime', 'publishEvent'\],  
          guard: 'hasAvailableCredits'  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    planning: {  
      entry: \['startPlanning'\],  
      on: {  
        PLAN\_READY: {  
          target: 'executing',  
          actions: \['setPlan', 'publishEvent'\]  
        },  
        PLAN\_FAILED: {  
          target: 'failed',  
          actions: \['setError', 'releaseCredits', 'publishEvent'\]  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        },  
        TIMEOUT: {  
          target: 'timeout',  
          actions: \['releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    executing: {  
      entry: \['executeNextStep'\],  
      on: {  
        STEP\_COMPLETED: \[  
          {  
            target: 'executing',  
            actions: \['recordStep', 'consumeCredits', 'publishEvent'\],  
            guard: 'hasMoreWork',  
            reenter: true  
          },  
          {  
            target: 'completed',  
            actions: \['recordStep', 'consumeCredits', 'finalizeCredits', 'publishEvent'\],  
            guard: 'isGoalAchieved'  
          }  
        \],  
        STEP\_FAILED: \[  
          {  
            target: 'executing',  
            actions: \['incrementRetry', 'publishEvent'\],  
            guard: 'canRetry',  
            reenter: true  
          },  
          {  
            target: 'failed',  
            actions: \['setError', 'releaseCredits', 'publishEvent'\]  
          }  
        \],  
        NEED\_USER\_INPUT: {  
          target: 'waiting\_user',  
          actions: \['publishEvent'\]  
        },  
        GOAL\_ACHIEVED: {  
          target: 'completed',  
          actions: \['setResult', 'finalizeCredits', 'publishEvent'\]  
        },  
        PAUSE: {  
          target: 'paused',  
          actions: \['saveCheckpoint', 'publishEvent'\]  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        },  
        TIMEOUT: {  
          target: 'timeout',  
          actions: \['saveCheckpoint', 'releaseCredits', 'publishEvent'\]  
        },  
        ERROR: {  
          target: 'failed',  
          actions: \['setError', 'releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    waiting\_user: {  
      on: {  
        USER\_RESPONDED: {  
          target: 'executing',  
          actions: \['recordUserResponse', 'publishEvent'\]  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        },  
        TIMEOUT: {  
          target: 'timeout',  
          actions: \['releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    paused: {  
      on: {  
        RESUME: {  
          target: 'executing',  
          actions: \['restoreCheckpoint', 'publishEvent'\]  
        },  
        CANCEL: {  
          target: 'cancelled',  
          actions: \['releaseCredits', 'publishEvent'\]  
        },  
        TIMEOUT: {  
          target: 'timeout',  
          actions: \['releaseCredits', 'publishEvent'\]  
        }  
      }  
    },  
      
    completed: {  
      type: 'final',  
      entry: \['cleanup'\]  
    },  
      
    failed: {  
      type: 'final',  
      entry: \['cleanup', 'notifyFailure'\]  
    },  
      
    cancelled: {  
      type: 'final',  
      entry: \['cleanup'\]  
    },  
      
    timeout: {  
      type: 'final',  
      entry: \['cleanup', 'notifyTimeout'\]  
    }  
  }  
}, {  
  guards: {  
    hasAvailableCredits: (context) \=\> {  
      return context.creditsReserved \> 0;  
    },  
      
    hasMoreWork: (context) \=\> {  
      return context.stepCount \< context.maxSteps &&  
             context.creditsConsumed \< context.maxCredits &&  
             \!isGoalAchieved(context);  
    },  
      
    isGoalAchieved: (context) \=\> {  
      return isGoalAchieved(context);  
    },  
      
    canRetry: (context, event) \=\> {  
      if (event.type \!== 'STEP\_FAILED') return false;  
      return event.retryable &&   
             context.retryCount \< context.maxRetries &&  
             context.consecutiveErrors \< 3;  
    }  
  },  
    
  actions: {  
    reserveCredits: assign((context) \=\> {  
      // Implemented in transition handler  
      return context;  
    }),  
      
    releaseCredits: assign((context) \=\> {  
      // Release unused reserved credits  
      return {  
        ...context,  
        creditsReserved: 0  
      };  
    }),  
      
    consumeCredits: assign((context, event) \=\> {  
      if (event.type \!== 'STEP\_COMPLETED') return context;  
      const consumed \= event.step.creditsConsumed || 0;  
      return {  
        ...context,  
        creditsConsumed: context.creditsConsumed \+ consumed,  
        creditsReserved: context.creditsReserved \- consumed  
      };  
    }),  
      
    setStartTime: assign({  
      startedAt: () \=\> Date.now()  
    }),  
      
    setTimeoutTime: assign((context) \=\> ({  
      timeoutAt: Date.now() \+ context.maxDurationMs  
    })),  
      
    setPlan: assign((context, event) \=\> {  
      if (event.type \!== 'PLAN\_READY') return context;  
      return {  
        ...context,  
        plan: event.plan,  
        currentPhaseId: 1  
      };  
    }),  
      
    recordStep: assign((context, event) \=\> {  
      if (event.type \!== 'STEP\_COMPLETED') return context;  
      return {  
        ...context,  
        stepCount: context.stepCount \+ 1,  
        consecutiveErrors: 0,  
        retryCount: 0  
      };  
    }),  
      
    incrementRetry: assign((context) \=\> ({  
      retryCount: context.retryCount \+ 1,  
      consecutiveErrors: context.consecutiveErrors \+ 1  
    })),  
      
    setError: assign((context, event) \=\> {  
      if (event.type \!== 'STEP\_FAILED' && event.type \!== 'PLAN\_FAILED' && event.type \!== 'ERROR') {  
        return context;  
      }  
      return {  
        ...context,  
        lastError: event.error  
      };  
    }),  
      
    publishEvent: (context, event) \=\> {  
      // Publish to outbox for event sourcing  
      publishToOutbox({  
        eventType: \`run.${event.type.toLowerCase()}\`,  
        aggregateType: 'runs',  
        aggregateId: context.runId,  
        payload: { context, event }  
      });  
    },  
      
    saveCheckpoint: (context) \=\> {  
      // Save execution state for resume  
      saveRunCheckpoint(context);  
    },  
      
    restoreCheckpoint: assign((context) \=\> {  
      return loadRunCheckpoint(context.runId) || context;  
    }),  
      
    cleanup: (context) \=\> {  
      // Release sandbox, cleanup temp files  
      cleanupRun(context.runId);  
    }  
  }  
});  
\`\`\`

\#\#\#\# 3.3 Transition Rules

\`\`\`typescript  
// packages/state-machine/src/transitions.ts

export interface TransitionRule {  
  from: RunStatus\[\];  
  to: RunStatus;  
  event: string;  
  guards: GuardFn\[\];  
  actions: ActionFn\[\];  
  idempotencyKey?: (context: RunContext, event: RunEvent) \=\> string;  
}

export const TRANSITION\_RULES: TransitionRule\[\] \= \[  
  // PENDING \-\> QUEUED  
  {  
    from: \['pending'\],  
    to: 'queued',  
    event: 'ENQUEUE',  
    guards: \[  
      hasAvailableQuota,  
      isNotDuplicate  
    \],  
    actions: \[  
      reserveCredits,  
      enqueueJob  
    \],  
    idempotencyKey: (ctx) \=\> \`enqueue:${ctx.runId}\`  
  },  
    
  // QUEUED \-\> PLANNING  
  {  
    from: \['queued'\],  
    to: 'planning',  
    event: 'START',  
    guards: \[  
      hasReservedCredits,  
      workerAvailable  
    \],  
    actions: \[  
      setStartTime,  
      setTimeoutTime,  
      startPlanningJob  
    \],  
    idempotencyKey: (ctx) \=\> \`start:${ctx.runId}\`  
  },  
    
  // PLANNING \-\> EXECUTING  
  {  
    from: \['planning'\],  
    to: 'executing',  
    event: 'PLAN\_READY',  
    guards: \[  
      planIsValid  
    \],  
    actions: \[  
      savePlan,  
      startExecutionLoop  
    \],  
    idempotencyKey: (ctx, evt) \=\> \`plan\_ready:${ctx.runId}:${evt.plan.version}\`  
  },  
    
  // EXECUTING \-\> EXECUTING (step completed, more work)  
  {  
    from: \['executing'\],  
    to: 'executing',  
    event: 'STEP\_COMPLETED',  
    guards: \[  
      hasMoreWork,  
      withinLimits  
    \],  
    actions: \[  
      recordStep,  
      consumeCredits,  
      continueExecution  
    \],  
    idempotencyKey: (ctx, evt) \=\> \`step:${ctx.runId}:${evt.step.sequenceNumber}\`  
  },  
    
  // EXECUTING \-\> COMPLETED  
  {  
    from: \['executing'\],  
    to: 'completed',  
    event: 'GOAL\_ACHIEVED',  
    guards: \[\],  
    actions: \[  
      finalizeCredits,  
      saveResult,  
      notifyCompletion  
    \],  
    idempotencyKey: (ctx) \=\> \`complete:${ctx.runId}\`  
  },  
    
  // ANY \-\> CANCELLED  
  {  
    from: \['pending', 'queued', 'planning', 'executing', 'paused', 'waiting\_user'\],  
    to: 'cancelled',  
    event: 'CANCEL',  
    guards: \[\],  
    actions: \[  
      releaseCredits,  
      cleanup  
    \],  
    idempotencyKey: (ctx) \=\> \`cancel:${ctx.runId}\`  
  },  
    
  // EXECUTING \-\> FAILED (non-retryable error)  
  {  
    from: \['executing', 'planning'\],  
    to: 'failed',  
    event: 'ERROR',  
    guards: \[  
      isNotRetryable  
    \],  
    actions: \[  
      releaseCredits,  
      saveError,  
      notifyFailure  
    \],  
    idempotencyKey: (ctx) \=\> \`fail:${ctx.runId}\`  
  }  
\];  
\`\`\`

\#\#\#\# 3.4 Idempotency Rules

\`\`\`typescript  
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

export const IDEMPOTENCY\_CONFIGS: Record\<string, IdempotencyConfig\> \= {  
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

export async function executeIdempotent\<T\>(  
  key: string,  
  config: IdempotencyConfig,  
  operation: () \=\> Promise\<T\>  
): Promise\<{ result: T; wasExecuted: boolean }\> {  
  const fullKey \= \`${config.keyPrefix}:${key}\`;  
    
  // Check for existing result  
  const existing \= await redis.get(fullKey);  
  if (existing) {  
    const cached \= JSON.parse(existing);  
      
    // Check if within dedupe window  
    if (Date.now() \- cached.timestamp \< config.dedupeWindowMs) {  
      return { result: cached.result, wasExecuted: false };  
    }  
      
    // Return cached result if available  
    if (config.cacheResult && cached.result \!== undefined) {  
      return { result: cached.result, wasExecuted: false };  
    }  
  }  
    
  // Acquire lock  
  const lockKey \= \`${fullKey}:lock\`;  
  const lockAcquired \= await redis.set(lockKey, '1', 'NX', 'EX', 30);  
    
  if (\!lockAcquired) {  
    // Another process is executing, wait and return  
    await sleep(100);  
    return executeIdempotent(key, config, operation);  
  }  
    
  try {  
    // Execute operation  
    const result \= await operation();  
      
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
\`\`\`

\#\#\#\# 3.5 Retry Rules

\`\`\`typescript  
// packages/state-machine/src/retry.ts

export interface RetryPolicy {  
  maxAttempts: number;  
  initialDelayMs: number;  
  maxDelayMs: number;  
  backoffMultiplier: number;  
  retryableErrors: string\[\];  
  nonRetryableErrors: string\[\];  
}

export const RETRY\_POLICIES: Record\<string, RetryPolicy\> \= {  
  'tool.browser': {  
    maxAttempts: 3,  
    initialDelayMs: 1000,  
    maxDelayMs: 10000,  
    backoffMultiplier: 2,  
    retryableErrors: \['TIMEOUT', 'NETWORK\_ERROR', 'RATE\_LIMITED'\],  
    nonRetryableErrors: \['INVALID\_URL', 'BLOCKED', 'AUTH\_REQUIRED'\]  
  },  
  'tool.code': {  
    maxAttempts: 2,  
    initialDelayMs: 500,  
    maxDelayMs: 2000,  
    backoffMultiplier: 2,  
    retryableErrors: \['TIMEOUT', 'OOM'\],  
    nonRetryableErrors: \['SYNTAX\_ERROR', 'SECURITY\_VIOLATION'\]  
  },  
  'llm.invoke': {  
    maxAttempts: 3,  
    initialDelayMs: 2000,  
    maxDelayMs: 30000,  
    backoffMultiplier: 2,  
    retryableErrors: \['RATE\_LIMITED', 'OVERLOADED', 'TIMEOUT'\],  
    nonRetryableErrors: \['INVALID\_REQUEST', 'CONTENT\_FILTERED'\]  
  },  
  'default': {  
    maxAttempts: 3,  
    initialDelayMs: 1000,  
    maxDelayMs: 30000,  
    backoffMultiplier: 2,  
    retryableErrors: \['TIMEOUT', 'NETWORK\_ERROR', 'INTERNAL\_ERROR'\],  
    nonRetryableErrors: \['VALIDATION\_ERROR', 'AUTH\_ERROR', 'NOT\_FOUND'\]  
  }  
};

export function shouldRetry(  
  error: Error,  
  attempt: number,  
  policy: RetryPolicy  
): { retry: boolean; delayMs: number } {  
  // Check max attempts  
  if (attempt \>= policy.maxAttempts) {  
    return { retry: false, delayMs: 0 };  
  }  
    
  // Check error type  
  const errorCode \= (error as any).code || 'UNKNOWN';  
    
  if (policy.nonRetryableErrors.includes(errorCode)) {  
    return { retry: false, delayMs: 0 };  
  }  
    
  if (\!policy.retryableErrors.includes(errorCode) &&   
      \!policy.retryableErrors.includes('\*')) {  
    return { retry: false, delayMs: 0 };  
  }  
    
  // Calculate delay with exponential backoff \+ jitter  
  const baseDelay \= policy.initialDelayMs \* Math.pow(policy.backoffMultiplier, attempt);  
  const jitter \= Math.random() \* 0.3 \* baseDelay;  
  const delay \= Math.min(baseDelay \+ jitter, policy.maxDelayMs);  
    
  return { retry: true, delayMs: delay };  
}  
\`\`\`

\#\#\#\# 3.6 Stuck Detection Rules

\`\`\`typescript  
// packages/state-machine/src/stuck-detection.ts

export interface StuckDetectionRule {  
  status: RunStatus;  
  maxDurationMs: number;  
  action: 'timeout' | 'retry' | 'alert' | 'escalate';  
  alertThreshold: number;  // Alert after N occurrences  
}

export const STUCK\_DETECTION\_RULES: StuckDetectionRule\[\] \= \[  
  {  
    status: 'queued',  
    maxDurationMs: 5 \* 60 \* 1000,      // 5 minutes  
    action: 'retry',  
    alertThreshold: 3  
  },  
  {  
    status: 'planning',  
    maxDurationMs: 2 \* 60 \* 1000,      // 2 minutes  
    action: 'timeout',  
    alertThreshold: 1  
  },  
  {  
    status: 'executing',  
    maxDurationMs: 60 \* 60 \* 1000,     // 1 hour (configurable per run)  
    action: 'timeout',  
    alertThreshold: 1  
  },  
  {  
    status: 'waiting\_user',  
    maxDurationMs: 24 \* 60 \* 60 \* 1000, // 24 hours  
    action: 'timeout',  
    alertThreshold: 0  // No alert, expected behavior  
  },  
  {  
    status: 'paused',  
    maxDurationMs: 7 \* 24 \* 60 \* 60 \* 1000, // 7 days  
    action: 'timeout',  
    alertThreshold: 0  
  }  
\];

export async function detectStuckRuns(): Promise\<StuckRun\[\]\> {  
  const stuckRuns: StuckRun\[\] \= \[\];  
    
  for (const rule of STUCK\_DETECTION\_RULES) {  
    const cutoffTime \= new Date(Date.now() \- rule.maxDurationMs);  
      
    const runs \= await db.query.runs.findMany({  
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
        stuckDurationMs: Date.now() \- run.updatedAt.getTime()  
      });  
    }  
  }  
    
  return stuckRuns;  
}

export async function handleStuckRun(stuck: StuckRun): Promise\<void\> {  
  const { run, rule } \= stuck;  
    
  switch (rule.action) {  
    case 'timeout':  
      await transitionRun(run.id, 'TIMEOUT', {  
        reason: \`Exceeded max duration for status ${rule.status}\`  
      });  
      break;  
      
    case 'retry':  
      // Re-enqueue the job  
      await enqueueJob('run', {  
        runId: run.id,  
        action: 'resume',  
        attempt: (run.metadata.retryCount || 0\) \+ 1  
      });  
      break;  
      
    case 'alert':  
      await sendAlert({  
        type: 'stuck\_run',  
        severity: 'warning',  
        runId: run.id,  
        message: \`Run stuck in ${rule.status} for ${stuck.stuckDurationMs}ms\`  
      });  
      break;  
      
    case 'escalate':  
      await sendAlert({  
        type: 'stuck\_run',  
        severity: 'critical',  
        runId: run.id,  
        message: \`Run requires manual intervention\`  
      });  
      break;  
  }  
}  
\`\`\`

\---

\#\# 4\. Worker Architecture

\#\#\# PR-004: Worker Infrastructure

\#\#\#\# 4.1 Queue Configuration

\`\`\`typescript  
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

export const QUEUE\_CONFIGS: Record\<string, QueueConfig\> \= {  
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
\`\`\`

\#\#\#\# 4.2 Job Payload Schemas

\`\`\`typescript  
// packages/queue/src/schemas/run-job.ts  
import { z } from 'zod';

export const RunJobSchema \= z.object({  
  type: z.literal('run'),  
    
  // Identity  
  runId: z.string().uuid(),  
  tenantId: z.string().uuid(),  
    
  // Action  
  action: z.enum(\['start', 'resume', 'cancel', 'timeout'\]),  
    
  // Context  
  checkpoint: z.object({  
    stepNumber: z.number(),  
    phaseId: z.number(),  
    context: z.any()  
  }).optional(),  
    
  // Retry info  
  attempt: z.number().default(1),  
  previousError: z.string().optional(),  
    
  // Priority (higher \= more urgent)  
  priority: z.number().min(0).max(100).default(50),  
    
  // Scheduling  
  scheduledFor: z.number().optional(),  // Unix timestamp  
    
  // Idempotency  
  idempotencyKey: z.string()  
});

export type RunJob \= z.infer\<typeof RunJobSchema\>;

// packages/queue/src/schemas/step-job.ts  
export const StepJobSchema \= z.object({  
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
    role: z.enum(\['system', 'user', 'assistant', 'tool'\]),  
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

export type StepJob \= z.infer\<typeof StepJobSchema\>;

// packages/queue/src/schemas/notification-job.ts  
export const NotificationJobSchema \= z.object({  
  type: z.literal('notification'),  
    
  // Target  
  channel: z.enum(\['email', 'webhook', 'push', 'in\_app'\]),  
  recipient: z.string(),  
    
  // Content  
  template: z.string(),  
  data: z.record(z.any()),  
    
  // Options  
  priority: z.enum(\['low', 'normal', 'high'\]).default('normal'),  
    
  // Idempotency  
  idempotencyKey: z.string()  
});

export type NotificationJob \= z.infer\<typeof NotificationJobSchema\>;  
\`\`\`

\#\#\#\# 4.3 Producer

\`\`\`typescript  
// packages/queue/src/producer.ts  
import { Queue, QueueEvents } from 'bullmq';  
import { Redis } from 'ioredis';

export class JobProducer {  
  private queues: Map\<string, Queue\> \= new Map();  
  private redis: Redis;  
    
  constructor(redisUrl: string) {  
    this.redis \= new Redis(redisUrl);  
  }  
    
  private getQueue(name: string): Queue {  
    if (\!this.queues.has(name)) {  
      const config \= QUEUE\_CONFIGS\[name\];  
      if (\!config) throw new Error(\`Unknown queue: ${name}\`);  
        
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
    return this.queues.get(name)\!;  
  }  
    
  async enqueue\<T extends JobPayload\>(  
    queueName: string,  
    job: T,  
    options?: EnqueueOptions  
  ): Promise\<string\> {  
    const queue \= this.getQueue(queueName);  
    const config \= QUEUE\_CONFIGS\[queueName\];  
      
    // Check rate limit  
    if (config.rateLimit) {  
      const allowed \= await this.checkRateLimit(queueName, config.rateLimit);  
      if (\!allowed) {  
        throw new RateLimitError(\`Queue ${queueName} rate limit exceeded\`);  
      }  
    }  
      
    // Idempotency check  
    if (job.idempotencyKey) {  
      const existing \= await this.redis.get(\`job:idem:${job.idempotencyKey}\`);  
      if (existing) {  
        return existing;  // Return existing job ID  
      }  
    }  
      
    // Enqueue  
    const bullJob \= await queue.add(job.type, job, {  
      priority: options?.priority ?? (config.priority ? job.priority : undefined),  
      delay: options?.delay,  
      jobId: job.idempotencyKey  
    });  
      
    // Store idempotency mapping  
    if (job.idempotencyKey) {  
      await this.redis.set(  
        \`job:idem:${job.idempotencyKey}\`,  
        bullJob.id\!,  
        'EX',  
        86400  // 24 hour TTL  
      );  
    }  
      
    return bullJob.id\!;  
  }  
    
  async enqueueBatch\<T extends JobPayload\>(  
    queueName: string,  
    jobs: T\[\]  
  ): Promise\<string\[\]\> {  
    const queue \= this.getQueue(queueName);  
      
    const bullJobs \= await queue.addBulk(  
      jobs.map(job \=\> ({  
        name: job.type,  
        data: job,  
        opts: {  
          jobId: job.idempotencyKey  
        }  
      }))  
    );  
      
    return bullJobs.map(j \=\> j.id\!);  
  }  
    
  private async checkRateLimit(  
    queueName: string,  
    limit: { max: number; duration: number }  
  ): Promise\<boolean\> {  
    const key \= \`ratelimit:queue:${queueName}\`;  
    const current \= await this.redis.incr(key);  
      
    if (current \=== 1\) {  
      await this.redis.pexpire(key, limit.duration);  
    }  
      
    return current \<= limit.max;  
  }  
}  
\`\`\`

\#\#\#\# 4.4 Consumer

\`\`\`typescript  
// packages/queue/src/consumer.ts  
import { Worker, Job } from 'bullmq';

export interface JobHandler\<T\> {  
  handle(job: T, context: JobContext): Promise\<any\>;  
  onFailed?(job: T, error: Error): Promise\<void\>;  
  onCompleted?(job: T, result: any): Promise\<void\>;  
}

export class JobConsumer {  
  private workers: Map\<string, Worker\> \= new Map();  
  private handlers: Map\<string, JobHandler\<any\>\> \= new Map();  
    
  registerHandler\<T\>(jobType: string, handler: JobHandler\<T\>): void {  
    this.handlers.set(jobType, handler);  
  }  
    
  start(queueName: string): void {  
    const config \= QUEUE\_CONFIGS\[queueName\];  
      
    const worker \= new Worker(  
      queueName,  
      async (job: Job) \=\> {  
        const handler \= this.handlers.get(job.name);  
        if (\!handler) {  
          throw new Error(\`No handler for job type: ${job.name}\`);  
        }  
          
        const context: JobContext \= {  
          jobId: job.id\!,  
          attempt: job.attemptsMade \+ 1,  
          maxAttempts: config.retries,  
          queueName,  
          timestamp: Date.now()  
        };  
          
        // Metrics  
        metrics.jobStarted.inc({ queue: queueName, type: job.name });  
        const startTime \= Date.now();  
          
        try {  
          const result \= await handler.handle(job.data, context);  
            
          metrics.jobCompleted.inc({ queue: queueName, type: job.name });  
          metrics.jobDuration.observe(  
            { queue: queueName, type: job.name },  
            Date.now() \- startTime  
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
    worker.on('failed', async (job, error) \=\> {  
      if (job && job.attemptsMade \>= config.retries) {  
        // Move to DLQ  
        if (config.dlq.enabled) {  
          await this.moveToDLQ(queueName, job, error);  
        }  
      }  
    });  
      
    worker.on('error', (error) \=\> {  
      logger.error('Worker error', { queue: queueName, error });  
    });  
      
    this.workers.set(queueName, worker);  
  }  
    
  private async moveToDLQ(  
    queueName: string,  
    job: Job,  
    error: Error  
  ): Promise\<void\> {  
    const dlqName \= \`${queueName}:dlq\`;  
    const dlqQueue \= new Queue(dlqName, { connection: this.redis });  
      
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
    
  async stop(): Promise\<void\> {  
    await Promise.all(  
      Array.from(this.workers.values()).map(w \=\> w.close())  
    );  
  }  
}  
\`\`\`

\#\#\#\# 4.5 Backpressure Control

\`\`\`typescript  
// packages/queue/src/backpressure.ts

export interface BackpressureConfig {  
  // Queue depth thresholds  
  warningThreshold: number;  
  criticalThreshold: number;  
    
  // Actions  
  onWarning: 'log' | 'slow' | 'reject';  
  onCritical: 'reject' | 'circuit\_break';  
    
  // Recovery  
  recoveryThreshold: number;  
  cooldownMs: number;  
}

export const BACKPRESSURE\_CONFIGS: Record\<string, BackpressureConfig\> \= {  
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
  private states: Map\<string, BackpressureState\> \= new Map();  
    
  async checkBackpressure(queueName: string): Promise\<BackpressureResult\> {  
    const config \= BACKPRESSURE\_CONFIGS\[queueName\];  
    if (\!config) return { allowed: true, action: 'none' };  
      
    const queue \= new Queue(queueName, { connection: this.redis });  
    const waiting \= await queue.getWaitingCount();  
    const active \= await queue.getActiveCount();  
    const depth \= waiting \+ active;  
      
    // Update metrics  
    metrics.queueDepth.set({ queue: queueName }, depth);  
      
    // Check state  
    const state \= this.states.get(queueName) || { level: 'normal', since: Date.now() };  
      
    if (depth \>= config.criticalThreshold) {  
      this.states.set(queueName, { level: 'critical', since: Date.now() });  
        
      metrics.backpressureTriggered.inc({ queue: queueName, level: 'critical' });  
        
      return {  
        allowed: config.onCritical \!== 'reject',  
        action: config.onCritical,  
        depth,  
        threshold: config.criticalThreshold  
      };  
    }  
      
    if (depth \>= config.warningThreshold) {  
      this.states.set(queueName, { level: 'warning', since: Date.now() });  
        
      return {  
        allowed: config.onWarning \!== 'reject',  
        action: config.onWarning,  
        depth,  
        threshold: config.warningThreshold,  
        slowdownFactor: this.calculateSlowdown(depth, config)  
      };  
    }  
      
    // Check recovery  
    if (state.level \!== 'normal' && depth \<= config.recoveryThreshold) {  
      const cooldownElapsed \= Date.now() \- state.since \>= config.cooldownMs;  
      if (cooldownElapsed) {  
        this.states.set(queueName, { level: 'normal', since: Date.now() });  
      }  
    }  
      
    return { allowed: true, action: 'none', depth };  
  }  
    
  private calculateSlowdown(depth: number, config: BackpressureConfig): number {  
    // Linear slowdown between warning and critical  
    const range \= config.criticalThreshold \- config.warningThreshold;  
    const position \= depth \- config.warningThreshold;  
    return Math.min(1, position / range);  // 0 to 1  
  }  
}  
\`\`\`

\#\#\#\# 4.6 DLQ Behavior

\`\`\`typescript  
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

export const DLQ\_CONFIG: DLQConfig \= {  
  retentionDays: 30,  
  alertThreshold: 10,  
  alertInterval: 300000,  // 5 minutes  
  maxReprocessAttempts: 3,  
  reprocessDelay: 3600000  // 1 hour  
};

export class DLQManager {  
  async getDLQStats(queueName: string): Promise\<DLQStats\> {  
    const dlqName \= \`${queueName}:dlq\`;  
    const queue \= new Queue(dlqName, { connection: this.redis });  
      
    const \[waiting, delayed, completed, failed\] \= await Promise.all(\[  
      queue.getWaitingCount(),  
      queue.getDelayedCount(),  
      queue.getCompletedCount(),  
      queue.getFailedCount()  
    \]);  
      
    return {  
      queue: queueName,  
      dlqDepth: waiting \+ delayed,  
      totalProcessed: completed,  
      totalFailed: failed  
    };  
  }  
    
  async reprocessDLQMessage(  
    queueName: string,  
    jobId: string  
  ): Promise\<void\> {  
    const dlqName \= \`${queueName}:dlq\`;  
    const dlqQueue \= new Queue(dlqName, { connection: this.redis });  
    const originalQueue \= new Queue(queueName, { connection: this.redis });  
      
    const job \= await dlqQueue.getJob(jobId);  
    if (\!job) throw new Error(\`DLQ job not found: ${jobId}\`);  
      
    const dlqData \= job.data;  
      
    // Check reprocess limit  
    const attempts \= dlqData.reprocessAttempts || 0;  
    if (attempts \>= DLQ\_CONFIG.maxReprocessAttempts) {  
      throw new Error(\`Max reprocess attempts exceeded for job ${jobId}\`);  
    }  
      
    // Re-enqueue to original queue  
    await originalQueue.add(dlqData.originalJob.type, {  
      ...dlqData.originalJob,  
      \_dlqReprocess: {  
        originalJobId: jobId,  
        attempt: attempts \+ 1,  
        reprocessedAt: Date.now()  
      }  
    });  
      
    // Update DLQ job  
    await job.updateData({  
      ...dlqData,  
      reprocessAttempts: attempts \+ 1,  
      lastReprocessedAt: Date.now()  
    });  
  }  
    
  async purgeDLQ(queueName: string, olderThanDays?: number): Promise\<number\> {  
    const dlqName \= \`${queueName}:dlq\`;  
    const queue \= new Queue(dlqName, { connection: this.redis });  
      
    const cutoff \= olderThanDays   
      ? Date.now() \- (olderThanDays \* 24 \* 60 \* 60 \* 1000\)  
      : Date.now() \- (DLQ\_CONFIG.retentionDays \* 24 \* 60 \* 60 \* 1000);  
      
    const jobs \= await queue.getJobs(\['waiting', 'delayed'\]);  
    let purged \= 0;  
      
    for (const job of jobs) {  
      if (job.timestamp \< cutoff) {  
        await job.remove();  
        purged++;  
      }  
    }  
      
    return purged;  
  }  
}  
\`\`\`

\---

\#\# 5\. Agent Runtime

\#\#\# PR-005: Agent Runtime Core

\#\#\#\# 5.1 Planner

\`\`\`typescript  
// packages/agent/src/planner/planner.ts

export interface PlannerConfig {  
  maxPlanningAttempts: number;  
  planningTimeout: number;  
  minPhases: number;  
  maxPhases: number;  
  requireCapabilities: boolean;  
}

export const DEFAULT\_PLANNER\_CONFIG: PlannerConfig \= {  
  maxPlanningAttempts: 3,  
  planningTimeout: 30000,  
  minPhases: 2,  
  maxPhases: 15,  
  requireCapabilities: true  
};

export class Planner {  
  constructor(  
    private llm: LLMClient,  
    private config: PlannerConfig \= DEFAULT\_PLANNER\_CONFIG  
  ) {}  
    
  async createPlan(request: PlanRequest): Promise\<Plan\> {  
    let lastError: Error | null \= null;  
      
    for (let attempt \= 1; attempt \<= this.config.maxPlanningAttempts; attempt++) {  
      try {  
        const plan \= await this.generatePlan(request, attempt);  
        const validation \= this.validatePlan(plan, request);  
          
        if (validation.valid) {  
          return plan;  
        }  
          
        // Attempt repair  
        const repaired \= await this.repairPlan(plan, validation.issues, request);  
        const revalidation \= this.validatePlan(repaired, request);  
          
        if (revalidation.valid) {  
          return repaired;  
        }  
          
        lastError \= new Error(\`Plan validation failed: ${revalidation.issues.join(', ')}\`);  
      } catch (error) {  
        lastError \= error as Error;  
          
        if (attempt \< this.config.maxPlanningAttempts) {  
          await sleep(1000 \* attempt);  // Backoff  
        }  
      }  
    }  
      
    throw lastError || new Error('Planning failed');  
  }  
    
  private async generatePlan(request: PlanRequest, attempt: number): Promise\<Plan\> {  
    const systemPrompt \= this.buildPlanningPrompt(request, attempt);  
      
    const response \= await this.llm.invoke({  
      messages: \[  
        { role: 'system', content: systemPrompt },  
        { role: 'user', content: request.prompt }  
      \],  
      response\_format: {  
        type: 'json\_schema',  
        json\_schema: {  
          name: 'task\_plan',  
          strict: true,  
          schema: PLAN\_SCHEMA  
        }  
      },  
      timeout: this.config.planningTimeout  
    });  
      
    const planData \= JSON.parse(response.choices\[0\].message.content);  
      
    return {  
      id: generateId('plan'),  
      version: 1,  
      goal: planData.goal,  
      phases: planData.phases.map((p: any, i: number) \=\> ({  
        id: i \+ 1,  
        title: p.title,  
        description: p.description,  
        capabilities: p.capabilities || {},  
        estimatedSteps: p.estimated\_steps || 5,  
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
    return \`You are a task planner. Create a structured plan to achieve the user's goal.

\#\# Rules  
1\. Break the task into ${this.config.minPhases}-${this.config.maxPhases} phases  
2\. Each phase should be a logical unit of work  
3\. Phases must be sequential (no parallel execution)  
4\. Include a final phase for delivering results to the user  
5\. Be specific about what each phase accomplishes

\#\# Available Capabilities  
${JSON.stringify(AVAILABLE\_CAPABILITIES, null, 2)}

\#\# Context  
${request.context ? JSON.stringify(request.context) : 'None provided'}

${attempt \> 1 ? \`\\n\#\# Note\\nThis is attempt ${attempt}. Previous attempts failed validation. Be more careful with phase definitions.\` : ''}

Create a plan that achieves the user's goal efficiently.\`;  
  }  
    
  validatePlan(plan: Plan, request: PlanRequest): ValidationResult {  
    const issues: string\[\] \= \[\];  
      
    // Check phase count  
    if (plan.phases.length \< this.config.minPhases) {  
      issues.push(\`Too few phases: ${plan.phases.length} (min: ${this.config.minPhases})\`);  
    }  
    if (plan.phases.length \> this.config.maxPhases) {  
      issues.push(\`Too many phases: ${plan.phases.length} (max: ${this.config.maxPhases})\`);  
    }  
      
    // Check goal coverage  
    const goalCoverage \= this.measureGoalCoverage(plan, request);  
    if (goalCoverage \< 0.7) {  
      issues.push(\`Insufficient goal coverage: ${(goalCoverage \* 100).toFixed(0)}%\`);  
    }  
      
    // Check phase validity  
    for (const phase of plan.phases) {  
      if (\!phase.title || phase.title.length \< 3\) {  
        issues.push(\`Phase ${phase.id} has invalid title\`);  
      }  
      if (this.config.requireCapabilities && Object.keys(phase.capabilities).length \=== 0\) {  
        issues.push(\`Phase ${phase.id} has no capabilities defined\`);  
      }  
    }  
      
    // Check for delivery phase  
    const hasDeliveryPhase \= plan.phases.some(p \=\>   
      p.title.toLowerCase().includes('deliver') ||  
      p.title.toLowerCase().includes('result') ||  
      p.title.toLowerCase().includes('present')  
    );  
    if (\!hasDeliveryPhase) {  
      issues.push('No delivery/result phase found');  
    }  
      
    return {  
      valid: issues.length \=== 0,  
      issues,  
      score: this.scorePlan(plan, request)  
    };  
  }  
    
  private measureGoalCoverage(plan: Plan, request: PlanRequest): number {  
    // Extract key concepts from goal  
    const goalConcepts \= extractConcepts(request.prompt);  
      
    // Check how many are covered by phases  
    const planText \= plan.phases.map(p \=\> \`${p.title} ${p.description || ''}\`).join(' ');  
    const planConcepts \= extractConcepts(planText);  
      
    const covered \= goalConcepts.filter(c \=\>   
      planConcepts.some(pc \=\> semanticSimilarity(c, pc) \> 0.7)  
    );  
      
    return covered.length / goalConcepts.length;  
  }  
    
  scorePlan(plan: Plan, request: PlanRequest): PlanScore {  
    const scores \= {  
      feasibility: this.scoreFeasibility(plan),  
      completeness: this.measureGoalCoverage(plan, request),  
      efficiency: this.scoreEfficiency(plan),  
      clarity: this.scoreClarity(plan)  
    };  
      
    const weights \= { feasibility: 0.3, completeness: 0.3, efficiency: 0.2, clarity: 0.2 };  
    const composite \= Object.entries(scores).reduce(  
      (acc, \[key, value\]) \=\> acc \+ value \* weights\[key as keyof typeof weights\],  
      0  
    );  
      
    return { ...scores, composite };  
  }  
    
  private scoreFeasibility(plan: Plan): number {  
    let score \= 1.0;  
      
    for (const phase of plan.phases) {  
      // Penalize phases with unknown capabilities  
      const unknownCaps \= Object.keys(phase.capabilities).filter(  
        c \=\> \!AVAILABLE\_CAPABILITIES.includes(c)  
      );  
      score \-= unknownCaps.length \* 0.1;  
        
      // Penalize overly ambitious phases  
      if ((phase.estimatedSteps || 5\) \> 20\) {  
        score \-= 0.1;  
      }  
    }  
      
    return Math.max(0, score);  
  }  
    
  private scoreEfficiency(plan: Plan): number {  
    const totalSteps \= plan.phases.reduce((acc, p) \=\> acc \+ (p.estimatedSteps || 5), 0);  
      
    // Optimal is 10-30 steps  
    if (totalSteps \< 10\) return 0.8;  // Too simple, might miss things  
    if (totalSteps \<= 30\) return 1.0;  
    if (totalSteps \<= 50\) return 0.8;  
    return 0.6;  // Too complex  
  }  
    
  private scoreClarity(plan: Plan): number {  
    let score \= 1.0;  
      
    for (const phase of plan.phases) {  
      // Penalize vague titles  
      const vagueWords \= \['do', 'handle', 'process', 'work on', 'deal with'\];  
      if (vagueWords.some(w \=\> phase.title.toLowerCase().includes(w))) {  
        score \-= 0.1;  
      }  
        
      // Reward specific action verbs  
      const actionVerbs \= \['create', 'analyze', 'generate', 'extract', 'validate', 'implement'\];  
      if (actionVerbs.some(v \=\> phase.title.toLowerCase().startsWith(v))) {  
        score \+= 0.05;  
      }  
    }  
      
    return Math.min(1, Math.max(0, score));  
  }  
}  
\`\`\`

\#\#\#\# 5.2 Plan Repair

\`\`\`typescript  
// packages/agent/src/planner/repair.ts

export type RepairStrategy \=  
  | 'adjust\_parameters'  
  | 'split\_phase'  
  | 'merge\_phases'  
  | 'add\_phase'  
  | 'remove\_phase'  
  | 'reorder\_phases'  
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
    issues: string\[\],  
    request: PlanRequest  
  ): Promise\<Plan\> {  
    // Determine repair strategy  
    const actions \= this.determineRepairActions(plan, issues);  
      
    if (actions.length \=== 0 || actions\[0\].strategy \=== 'regenerate') {  
      // Full regeneration needed  
      return this.regeneratePlan(plan, issues, request);  
    }  
      
    // Apply repairs  
    let repairedPlan \= { ...plan };  
      
    for (const action of actions) {  
      repairedPlan \= await this.applyRepair(repairedPlan, action, request);  
    }  
      
    // Increment version  
    repairedPlan.version \= plan.version \+ 1;  
      
    return repairedPlan;  
  }  
    
  private determineRepairActions(plan: Plan, issues: string\[\]): RepairAction\[\] {  
    const actions: RepairAction\[\] \= \[\];  
      
    for (const issue of issues) {  
      if (issue.includes('Too few phases')) {  
        actions.push({  
          strategy: 'add\_phase',  
          details: { position: 'middle' }  
        });  
      } else if (issue.includes('Too many phases')) {  
        actions.push({  
          strategy: 'merge\_phases',  
          details: { criteria: 'similar\_capabilities' }  
        });  
      } else if (issue.includes('Insufficient goal coverage')) {  
        actions.push({  
          strategy: 'add\_phase',  
          details: { position: 'before\_delivery', focus: 'missing\_concepts' }  
        });  
      } else if (issue.includes('invalid title')) {  
        const phaseId \= parseInt(issue.match(/Phase (\\d+)/)?.\[1\] || '0');  
        actions.push({  
          strategy: 'adjust\_parameters',  
          target: phaseId,  
          details: { field: 'title' }  
        });  
      } else if (issue.includes('No delivery')) {  
        actions.push({  
          strategy: 'add\_phase',  
          details: { position: 'end', type: 'delivery' }  
        });  
      }  
    }  
      
    // If too many repairs needed, just regenerate  
    if (actions.length \> 3\) {  
      return \[{ strategy: 'regenerate', details: {} }\];  
    }  
      
    return actions;  
  }  
    
  private async applyRepair(  
    plan: Plan,  
    action: RepairAction,  
    request: PlanRequest  
  ): Promise\<Plan\> {  
    switch (action.strategy) {  
      case 'add\_phase':  
        return this.addPhase(plan, action.details, request);  
        
      case 'merge\_phases':  
        return this.mergePhases(plan, action.details);  
        
      case 'split\_phase':  
        return this.splitPhase(plan, action.target\!, action.details);  
        
      case 'adjust\_parameters':  
        return this.adjustParameters(plan, action.target\!, action.details);  
        
      case 'remove\_phase':  
        return this.removePhase(plan, action.target\!);  
        
      case 'reorder\_phases':  
        return this.reorderPhases(plan, action.details);  
        
      default:  
        return plan;  
    }  
  }  
    
  private async addPhase(  
    plan: Plan,  
    details: { position: string; type?: string; focus?: string },  
    request: PlanRequest  
  ): Promise\<Plan\> {  
    // Generate new phase using LLM  
    const prompt \= \`Given this plan:  
${JSON.stringify(plan.phases, null, 2)}

And this goal: ${request.prompt}

Generate ONE additional phase to ${details.focus || 'improve coverage'}.  
Position: ${details.position}  
${details.type ? \`Type: ${details.type}\` : ''}

Return JSON: { "title": "...", "description": "...", "capabilities": {...} }\`;

    const response \= await this.llm.invoke({  
      messages: \[{ role: 'user', content: prompt }\],  
      response\_format: { type: 'json\_object' }  
    });  
      
    const newPhase \= JSON.parse(response.choices\[0\].message.content);  
      
    // Determine insertion index  
    let insertIndex: number;  
    switch (details.position) {  
      case 'start':  
        insertIndex \= 0;  
        break;  
      case 'end':  
        insertIndex \= plan.phases.length;  
        break;  
      case 'middle':  
        insertIndex \= Math.floor(plan.phases.length / 2);  
        break;  
      case 'before\_delivery':  
        insertIndex \= plan.phases.length \- 1;  
        break;  
      default:  
        insertIndex \= plan.phases.length;  
    }  
      
    // Insert and renumber  
    const phases \= \[...plan.phases\];  
    phases.splice(insertIndex, 0, {  
      id: 0,  // Will be renumbered  
      title: newPhase.title,  
      description: newPhase.description,  
      capabilities: newPhase.capabilities || {},  
      status: 'pending'  
    });  
      
    // Renumber all phases  
    phases.forEach((p, i) \=\> { p.id \= i \+ 1; });  
      
    return { ...plan, phases };  
  }  
    
  private mergePhases(  
    plan: Plan,  
    details: { criteria: string }  
  ): Plan {  
    const phases \= \[...plan.phases\];  
      
    // Find phases to merge based on criteria  
    for (let i \= 0; i \< phases.length \- 1; i++) {  
      const current \= phases\[i\];  
      const next \= phases\[i \+ 1\];  
        
      let shouldMerge \= false;  
        
      if (details.criteria \=== 'similar\_capabilities') {  
        const currentCaps \= Object.keys(current.capabilities);  
        const nextCaps \= Object.keys(next.capabilities);  
        const overlap \= currentCaps.filter(c \=\> nextCaps.includes(c));  
        shouldMerge \= overlap.length \>= Math.min(currentCaps.length, nextCaps.length) \* 0.7;  
      }  
        
      if (shouldMerge) {  
        // Merge next into current  
        phases\[i\] \= {  
          ...current,  
          title: \`${current.title} and ${next.title}\`,  
          description: \`${current.description || ''}\\n${next.description || ''}\`.trim(),  
          capabilities: { ...current.capabilities, ...next.capabilities }  
        };  
        phases.splice(i \+ 1, 1);  
        break;  // Only merge one pair per call  
      }  
    }  
      
    // Renumber  
    phases.forEach((p, i) \=\> { p.id \= i \+ 1; });  
      
    return { ...plan, phases };  
  }  
    
  private async regeneratePlan(  
    plan: Plan,  
    issues: string\[\],  
    request: PlanRequest  
  ): Promise\<Plan\> {  
    const prompt \= \`The previous plan had these issues:  
${issues.join('\\n')}

Previous plan:  
${JSON.stringify(plan.phases, null, 2)}

Create a better plan that addresses these issues.\`;

    // Use the main planner with enhanced context  
    const planner \= new Planner(this.llm);  
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
\`\`\`

\#\#\#\# 5.3 Supervisor

\`\`\`typescript  
// packages/agent/src/supervisor/supervisor.ts

export interface SupervisorConfig {  
  maxStepsPerPhase: number;  
  maxConsecutiveErrors: number;  
  checkpointInterval: number;  
  progressTimeout: number;  
}

export const DEFAULT\_SUPERVISOR\_CONFIG: SupervisorConfig \= {  
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
    private config: SupervisorConfig \= DEFAULT\_SUPERVISOR\_CONFIG  
  ) {  
    this.state \= {  
      currentPhaseId: run.plan?.currentPhaseId || 1,  
      stepCount: 0,  
      consecutiveErrors: 0,  
      lastProgressAt: Date.now(),  
      checkpoints: \[\]  
    };  
  }  
    
  async execute(): Promise\<ExecutionResult\> {  
    const plan \= this.run.plan\!;  
      
    while (this.state.currentPhaseId \<= plan.phases.length) {  
      const phase \= plan.phases.find(p \=\> p.id \=== this.state.currentPhaseId)\!;  
        
      try {  
        const phaseResult \= await this.executePhase(phase);  
          
        if (phaseResult.status \=== 'completed') {  
          await this.advancePhase();  
        } else if (phaseResult.status \=== 'needs\_user\_input') {  
          return {  
            status: 'waiting\_user',  
            prompt: phaseResult.userPrompt  
          };  
        } else if (phaseResult.status \=== 'failed') {  
          return {  
            status: 'failed',  
            error: phaseResult.error  
          };  
        }  
      } catch (error) {  
        const handled \= await this.handleError(error as Error, phase);  
        if (\!handled) {  
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
    
  private async executePhase(phase: Phase): Promise\<PhaseResult\> {  
    let phaseSteps \= 0;  
      
    while (phaseSteps \< this.config.maxStepsPerPhase) {  
      // Check for stuck  
      if (Date.now() \- this.state.lastProgressAt \> this.config.progressTimeout) {  
        throw new StuckError(\`No progress for ${this.config.progressTimeout}ms\`);  
      }  
        
      // Get next action from LLM  
      const context \= await this.memory.getContext();  
      const decision \= await this.getNextAction(phase, context);  
        
      if (decision.type \=== 'complete\_phase') {  
        return { status: 'completed' };  
      }  
        
      if (decision.type \=== 'need\_user\_input') {  
        return {  
          status: 'needs\_user\_input',  
          userPrompt: decision.prompt  
        };  
      }  
        
      if (decision.type \=== 'tool\_call') {  
        const result \= await this.executeTool(decision.tool, decision.parameters);  
          
        // Record step  
        await this.recordStep({  
          type: 'tool\_call',  
          tool: decision.tool,  
          parameters: decision.parameters,  
          result  
        });  
          
        // Update progress  
        this.state.lastProgressAt \= Date.now();  
        this.state.consecutiveErrors \= 0;  
        phaseSteps++;  
        this.state.stepCount++;  
          
        // Checkpoint if needed  
        if (this.state.stepCount % this.config.checkpointInterval \=== 0\) {  
          await this.saveCheckpoint();  
        }  
      }  
    }  
      
    // Max steps reached for phase  
    throw new MaxStepsError(\`Phase ${phase.id} exceeded max steps\`);  
  }  
    
  private async getNextAction(  
    phase: Phase,  
    context: ContextWindow  
  ): Promise\<AgentDecision\> {  
    const systemPrompt \= this.buildSystemPrompt(phase);  
      
    const response \= await this.llm.invoke({  
      messages: \[  
        { role: 'system', content: systemPrompt },  
        ...context.messages  
      \],  
      tools: this.toolRouter.getToolDefinitions(phase.capabilities),  
      tool\_choice: 'auto'  
    });  
      
    const message \= response.choices\[0\].message;  
      
    // Parse decision  
    if (message.tool\_calls && message.tool\_calls.length \> 0\) {  
      const toolCall \= message.tool\_calls\[0\];  
      return {  
        type: 'tool\_call',  
        tool: toolCall.function.name,  
        parameters: JSON.parse(toolCall.function.arguments)  
      };  
    }  
      
    // Check for phase completion signal  
    if (this.isPhaseComplete(message.content, phase)) {  
      return { type: 'complete\_phase' };  
    }  
      
    // Check for user input needed  
    if (this.needsUserInput(message.content)) {  
      return {  
        type: 'need\_user\_input',  
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
  ): Promise\<ToolResult\> {  
    const idempotencyKey \= generateIdempotencyKey(this.run.id, tool, parameters);  
      
    return executeIdempotent(  
      idempotencyKey,  
      IDEMPOTENCY\_CONFIGS\['step.execute'\],  
      async () \=\> {  
        return this.toolRouter.execute(tool, parameters, {  
          runId: this.run.id,  
          tenantId: this.run.tenantId,  
          timeout: this.getToolTimeout(tool)  
        });  
      }  
    );  
  }  
    
  private async handleError(error: Error, phase: Phase): Promise\<boolean\> {  
    this.state.consecutiveErrors++;  
      
    // Check if we should give up  
    if (this.state.consecutiveErrors \>= this.config.maxConsecutiveErrors) {  
      return false;  
    }  
      
    // Determine error type and recovery strategy  
    const errorType \= classifyError(error);  
      
    switch (errorType) {  
      case 'retryable':  
        // Simple retry with backoff  
        await sleep(1000 \* this.state.consecutiveErrors);  
        return true;  
        
      case 'recoverable':  
        // Try alternative approach  
        await this.memory.addMessage({  
          role: 'system',  
          content: \`Error occurred: ${error.message}. Try a different approach.\`  
        });  
        return true;  
        
      case 'stuck':  
        // Attempt to replan  
        const replanned \= await this.attemptReplan(phase, error);  
        return replanned;  
        
      default:  
        return false;  
    }  
  }  
    
  private async attemptReplan(phase: Phase, error: Error): Promise\<boolean\> {  
    try {  
      const planner \= new Planner(this.llm);  
      const repairer \= new PlanRepairer(this.llm);  
        
      const newPlan \= await repairer.repairPlan(  
        this.run.plan\!,  
        \[\`Phase ${phase.id} failed: ${error.message}\`\],  
        { prompt: this.run.prompt }  
      );  
        
      // Update run with new plan  
      await updateRunPlan(this.run.id, newPlan);  
      this.run.plan \= newPlan;  
        
      return true;  
    } catch (replanError) {  
      return false;  
    }  
  }  
    
  private async saveCheckpoint(): Promise\<void\> {  
    const checkpoint: Checkpoint \= {  
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
    
  private async advancePhase(): Promise\<void\> {  
    this.state.currentPhaseId++;  
      
    // Update run  
    await updateRun(this.run.id, {  
      'plan.currentPhaseId': this.state.currentPhaseId  
    });  
      
    // Publish event  
    await publishEvent({  
      type: 'run.phase\_completed',  
      runId: this.run.id,  
      phaseId: this.state.currentPhaseId \- 1  
    });  
  }  
}  
\`\`\`

\#\#\#\# 5.4 Tool Router

\`\`\`typescript  
// packages/agent/src/tools/router.ts

export interface ToolDefinition {  
  name: string;  
  description: string;  
  parameters: JSONSchema;  
  capabilities: string\[\];  
  timeout: number;  
  costCredits: number;  
  rateLimit?: {  
    max: number;  
    windowMs: number;  
  };  
}

export const TOOL\_DEFINITIONS: ToolDefinition\[\] \= \[  
  {  
    name: 'browser',  
    description: 'Navigate web pages, click elements, fill forms, extract content',  
    parameters: {  
      type: 'object',  
      properties: {  
        action: {  
          type: 'string',  
          enum: \['navigate', 'click', 'type', 'scroll', 'screenshot', 'extract'\]  
        },  
        url: { type: 'string' },  
        selector: { type: 'string' },  
        text: { type: 'string' },  
        intent: { type: 'string', enum: \['navigational', 'informational', 'transactional'\] }  
      },  
      required: \['action'\]  
    },  
    capabilities: \['web\_browsing'\],  
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
        action: { type: 'string', enum: \['exec', 'view', 'send', 'kill'\] },  
        command: { type: 'string' },  
        session: { type: 'string' },  
        timeout: { type: 'number' }  
      },  
      required: \['action', 'session'\]  
    },  
    capabilities: \['code\_execution'\],  
    timeout: 300000,  
    costCredits: 1  
  },  
  {  
    name: 'file',  
    description: 'Read, write, edit files in sandbox',  
    parameters: {  
      type: 'object',  
      properties: {  
        action: { type: 'string', enum: \['read', 'write', 'edit', 'view', 'append'\] },  
        path: { type: 'string' },  
        content: { type: 'string' },  
        edits: { type: 'array' }  
      },  
      required: \['action', 'path'\]  
    },  
    capabilities: \['file\_operations'\],  
    timeout: 30000,  
    costCredits: 0.5  
  },  
  {  
    name: 'search',  
    description: 'Search the web for information',  
    parameters: {  
      type: 'object',  
      properties: {  
        type: { type: 'string', enum: \['info', 'image', 'news', 'api', 'data', 'research'\] },  
        queries: { type: 'array', items: { type: 'string' }, maxItems: 3 },  
        time: { type: 'string', enum: \['all', 'past\_day', 'past\_week', 'past\_month', 'past\_year'\] }  
      },  
      required: \['type', 'queries'\]  
    },  
    capabilities: \['web\_search'\],  
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
        size: { type: 'string', enum: \['1024x1024', '1792x1024', '1024x1792'\] }  
      },  
      required: \['prompt'\]  
    },  
    capabilities: \['image\_generation'\],  
    timeout: 120000,  
    costCredits: 5  
  },  
  {  
    name: 'slides',  
    description: 'Create presentation slides',  
    parameters: {  
      type: 'object',  
      properties: {  
        content\_file: { type: 'string' },  
        slide\_count: { type: 'number' },  
        mode: { type: 'string', enum: \['html', 'image'\] }  
      },  
      required: \['content\_file', 'slide\_count'\]  
    },  
    capabilities: \['slides\_generation'\],  
    timeout: 300000,  
    costCredits: 10  
  }  
\];

export class ToolRouter {  
  private executors: Map\<string, ToolExecutor\> \= new Map();  
  private rateLimiters: Map\<string, RateLimiter\> \= new Map();  
    
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
    
  getToolDefinitions(capabilities?: Record\<string, boolean\>): ToolDefinition\[\] {  
    if (\!capabilities) {  
      return TOOL\_DEFINITIONS;  
    }  
      
    return TOOL\_DEFINITIONS.filter(tool \=\>   
      tool.capabilities.every(cap \=\> capabilities\[cap\] \!== false)  
    );  
  }  
    
  async execute(  
    tool: string,  
    parameters: any,  
    context: ExecutionContext  
  ): Promise\<ToolResult\> {  
    const definition \= TOOL\_DEFINITIONS.find(t \=\> t.name \=== tool);  
    if (\!definition) {  
      throw new Error(\`Unknown tool: ${tool}\`);  
    }  
      
    // Check rate limit  
    if (definition.rateLimit) {  
      const limiter \= this.getRateLimiter(tool, context.tenantId, definition.rateLimit);  
      const allowed \= await limiter.check();  
      if (\!allowed) {  
        throw new RateLimitError(\`Tool ${tool} rate limit exceeded\`);  
      }  
    }  
      
    // Validate parameters  
    const validation \= validateParameters(parameters, definition.parameters);  
    if (\!validation.valid) {  
      throw new ValidationError(\`Invalid parameters: ${validation.errors.join(', ')}\`);  
    }  
      
    // Execute with timeout  
    const executor \= this.executors.get(tool)\!;  
    const startTime \= Date.now();  
      
    try {  
      const result \= await withTimeout(  
        executor.execute(parameters, context),  
        definition.timeout  
      );  
        
      return {  
        success: true,  
        result,  
        duration: Date.now() \- startTime,  
        credits: definition.costCredits  
      };  
    } catch (error) {  
      return {  
        success: false,  
        error: {  
          code: classifyToolError(error as Error),  
          message: (error as Error).message  
        },  
        duration: Date.now() \- startTime,  
        credits: definition.costCredits \* 0.5  // Partial charge on failure  
      };  
    }  
  }  
    
  private getRateLimiter(  
    tool: string,  
    tenantId: string,  
    config: { max: number; windowMs: number }  
  ): RateLimiter {  
    const key \= \`${tool}:${tenantId}\`;  
    if (\!this.rateLimiters.has(key)) {  
      this.rateLimiters.set(key, new RateLimiter(config));  
    }  
    return this.rateLimiters.get(key)\!;  
  }  
}  
\`\`\`

\#\#\#\# 5.5 Memory Manager

\`\`\`typescript  
// packages/agent/src/memory/context.ts

export interface MemoryConfig {  
  maxTokens: number;  
  reservedTokens: number;  // For system prompt and response  
  compressionThreshold: number;  
  summarizationModel: string;  
}

export const DEFAULT\_MEMORY\_CONFIG: MemoryConfig \= {  
  maxTokens: 128000,  
  reservedTokens: 8000,  
  compressionThreshold: 0.8,  
  summarizationModel: 'claude-3-haiku'  
};

export class MemoryManager {  
  private messages: Message\[\] \= \[\];  
  private summaries: Summary\[\] \= \[\];  
  private artifacts: Map\<string, ArtifactReference\> \= new Map();  
    
  constructor(  
    private config: MemoryConfig \= DEFAULT\_MEMORY\_CONFIG,  
    private tokenCounter: TokenCounter  
  ) {}  
    
  async addMessage(message: Message): Promise\<void\> {  
    this.messages.push(message);  
      
    // Check if compression needed  
    const usage \= await this.getTokenUsage();  
    if (usage.ratio \> this.config.compressionThreshold) {  
      await this.compress();  
    }  
  }  
    
  async getContext(): Promise\<ContextWindow\> {  
    const availableTokens \= this.config.maxTokens \- this.config.reservedTokens;  
      
    // Build context from most recent messages  
    const contextMessages: Message\[\] \= \[\];  
    let tokenCount \= 0;  
      
    // Always include summaries first  
    for (const summary of this.summaries) {  
      const summaryMessage: Message \= {  
        role: 'system',  
        content: \`\[Previous context summary\]\\n${summary.content}\`  
      };  
      const tokens \= await this.tokenCounter.count(summaryMessage);  
      if (tokenCount \+ tokens \<= availableTokens) {  
        contextMessages.push(summaryMessage);  
        tokenCount \+= tokens;  
      }  
    }  
      
    // Add recent messages (newest first, then reverse)  
    const recentMessages: Message\[\] \= \[\];  
    for (let i \= this.messages.length \- 1; i \>= 0; i--) {  
      const message \= this.messages\[i\];  
      const tokens \= await this.tokenCounter.count(message);  
        
      if (tokenCount \+ tokens \<= availableTokens) {  
        recentMessages.unshift(message);  
        tokenCount \+= tokens;  
      } else {  
        break;  
      }  
    }  
      
    contextMessages.push(...recentMessages);  
      
    return {  
      messages: contextMessages,  
      tokenCount,  
      hasCompression: this.summaries.length \> 0  
    };  
  }  
    
  private async compress(): Promise\<void\> {  
    // Find messages to summarize (older half)  
    const midpoint \= Math.floor(this.messages.length / 2);  
    const toSummarize \= this.messages.slice(0, midpoint);  
      
    if (toSummarize.length \< 5\) return;  // Not enough to summarize  
      
    // Generate summary  
    const summary \= await this.generateSummary(toSummarize);  
      
    // Store summary and remove original messages  
    this.summaries.push(summary);  
    this.messages \= this.messages.slice(midpoint);  
  }  
    
  private async generateSummary(messages: Message\[\]): Promise\<Summary\> {  
    const content \= messages.map(m \=\> \`${m.role}: ${truncate(m.content, 500)}\`).join('\\n');  
      
    const response \= await invokeLLM({  
      model: this.config.summarizationModel,  
      messages: \[  
        {  
          role: 'system',  
          content: \`Summarize this conversation context concisely.   
                    Focus on: key decisions, important findings, current state, pending tasks.  
                    Keep under 500 words.\`  
        },  
        {  
          role: 'user',  
          content  
        }  
      \],  
      max\_tokens: 1000  
    });  
      
    return {  
      id: generateId('sum'),  
      content: response.choices\[0\].message.content,  
      messageCount: messages.length,  
      createdAt: Date.now()  
    };  
  }  
    
  async serialize(): Promise\<SerializedMemory\> {  
    return {  
      messages: this.messages,  
      summaries: this.summaries,  
      artifacts: Object.fromEntries(this.artifacts)  
    };  
  }  
    
  static async deserialize(data: SerializedMemory, config?: MemoryConfig): Promise\<MemoryManager\> {  
    const manager \= new MemoryManager(config);  
    manager.messages \= data.messages;  
    manager.summaries \= data.summaries;  
    manager.artifacts \= new Map(Object.entries(data.artifacts));  
    return manager;  
  }  
    
  private async getTokenUsage(): Promise\<{ count: number; ratio: number }\> {  
    let count \= 0;  
    for (const message of this.messages) {  
      count \+= await this.tokenCounter.count(message);  
    }  
    for (const summary of this.summaries) {  
      count \+= await this.tokenCounter.count({ role: 'system', content: summary.content });  
    }  
      
    return {  
      count,  
      ratio: count / (this.config.maxTokens \- this.config.reservedTokens)  
    };  
  }  
}  
\`\`\`

\---

\#\# 6\. Document Generation

\#\#\# PR-007: Document Generation

\#\#\#\# 6.1 Slides Pipeline

\`\`\`typescript  
// packages/docgen/src/slides/pipeline.ts

export interface SlidesPipelineConfig {  
  maxSlides: number;  
  defaultTemplate: string;  
  imageQuality: 'draft' | 'standard' | 'high';  
  chartRenderer: 'chartjs' | 'd3' | 'plotly';  
}

export const DEFAULT\_SLIDES\_CONFIG: SlidesPipelineConfig \= {  
  maxSlides: 50,  
  defaultTemplate: 'professional',  
  imageQuality: 'standard',  
  chartRenderer: 'chartjs'  
};

export class SlidesPipeline {  
  constructor(  
    private config: SlidesPipelineConfig \= DEFAULT\_SLIDES\_CONFIG,  
    private imageGenerator: ImageGenerator,  
    private chartRenderer: ChartRenderer  
  ) {}  
    
  async generate(request: SlidesRequest): Promise\<GeneratedSlides\> {  
    // PHASE 1: Parse content outline  
    const outline \= await this.parseOutline(request.contentFile);  
      
    // PHASE 2: Validate and normalize  
    const normalized \= this.normalizeOutline(outline);  
      
    // PHASE 3: Generate slide content  
    const slides \= await this.generateSlideContent(normalized, request);  
      
    // PHASE 4: Generate visuals  
    const withVisuals \= await this.generateVisuals(slides, request);  
      
    // PHASE 5: Apply template  
    const styled \= await this.applyTemplate(withVisuals, request.template);  
      
    // PHASE 6: Generate speaker notes  
    const withNotes \= request.includeSpeakerNotes   
      ? await this.generateSpeakerNotes(styled)  
      : styled;  
      
    // PHASE 7: Render  
    const rendered \= await this.render(withNotes, request.mode);  
      
    return rendered;  
  }  
    
  private async parseOutline(contentFile: string): Promise\<SlideOutline\> {  
    const content \= await readFile(contentFile, 'utf-8');  
      
    // Parse markdown structure  
    const lines \= content.split('\\n');  
    const slides: SlideOutlineItem\[\] \= \[\];  
    let currentSlide: SlideOutlineItem | null \= null;  
      
    for (const line of lines) {  
      if (line.startsWith('\# ')) {  
        // Title slide  
        if (currentSlide) slides.push(currentSlide);  
        currentSlide \= {  
          type: 'title',  
          title: line.slice(2).trim(),  
          content: \[\]  
        };  
      } else if (line.startsWith('\#\# ')) {  
        // Section slide  
        if (currentSlide) slides.push(currentSlide);  
        currentSlide \= {  
          type: 'section',  
          title: line.slice(3).trim(),  
          content: \[\]  
        };  
      } else if (line.startsWith('\#\#\# ')) {  
        // Content slide  
        if (currentSlide) slides.push(currentSlide);  
        currentSlide \= {  
          type: 'content',  
          title: line.slice(4).trim(),  
          content: \[\]  
        };  
      } else if (line.startsWith('- ') && currentSlide) {  
        // Bullet point  
        currentSlide.content.push({  
          type: 'bullet',  
          text: line.slice(2).trim()  
        });  
      } else if (line.startsWith('\`\`\`chart')) {  
        // Chart definition  
        const chartEnd \= lines.indexOf('\`\`\`', lines.indexOf(line) \+ 1);  
        const chartDef \= lines.slice(lines.indexOf(line) \+ 1, chartEnd).join('\\n');  
        if (currentSlide) {  
          currentSlide.content.push({  
            type: 'chart',  
            definition: JSON.parse(chartDef)  
          });  
        }  
      } else if (line.startsWith('\!\[')) {  
        // Image  
        const match \= line.match(/\!\\\[(.\*?)\\\]\\((.\*?)\\)/);  
        if (match && currentSlide) {  
          currentSlide.content.push({  
            type: 'image',  
            alt: match\[1\],  
            src: match\[2\]  
          });  
        }  
      }  
    }  
      
    if (currentSlide) slides.push(currentSlide);  
      
    return { slides };  
  }  
    
  private normalizeOutline(outline: SlideOutline): NormalizedOutline {  
    const normalized: NormalizedSlide\[\] \= \[\];  
      
    for (const item of outline.slides) {  
      // Validate content limits  
      const validatedContent \= this.validateSlideContent(item);  
        
      normalized.push({  
        ...item,  
        content: validatedContent,  
        layout: this.determineLayout(item)  
      });  
    }  
      
    return { slides: normalized };  
  }  
    
  private validateSlideContent(slide: SlideOutlineItem): SlideContent\[\] {  
    const rules \= SLIDE\_CONTENT\_RULES\[slide.type\] || SLIDE\_CONTENT\_RULES\['content'\];  
    const validated: SlideContent\[\] \= \[\];  
      
    // Limit bullets  
    const bullets \= slide.content.filter(c \=\> c.type \=== 'bullet');  
    if (bullets.length \> rules.max\_bullet\_points) {  
      // Split into multiple slides or summarize  
      validated.push(...bullets.slice(0, rules.max\_bullet\_points));  
    } else {  
      validated.push(...bullets);  
    }  
      
    // Validate bullet length  
    for (const item of validated) {  
      if (item.type \=== 'bullet') {  
        const words \= item.text.split(' ');  
        if (words.length \> rules.max\_words\_per\_bullet) {  
          item.text \= words.slice(0, rules.max\_words\_per\_bullet).join(' ') \+ '...';  
        }  
      }  
    }  
      
    // Add non-bullet content  
    validated.push(...slide.content.filter(c \=\> c.type \!== 'bullet'));  
      
    return validated;  
  }  
    
  private determineLayout(slide: SlideOutlineItem): SlideLayout {  
    const hasChart \= slide.content.some(c \=\> c.type \=== 'chart');  
    const hasImage \= slide.content.some(c \=\> c.type \=== 'image');  
    const bulletCount \= slide.content.filter(c \=\> c.type \=== 'bullet').length;  
      
    if (slide.type \=== 'title') return 'title\_centered';  
    if (slide.type \=== 'section') return 'section\_header';  
    if (hasChart && bulletCount \> 0\) return 'split\_chart\_left';  
    if (hasChart) return 'full\_chart';  
    if (hasImage && bulletCount \> 0\) return 'split\_image\_right';  
    if (hasImage) return 'full\_image';  
    if (bulletCount \> 4\) return 'two\_column';  
    return 'single\_column';  
  }  
    
  private async generateVisuals(  
    slides: NormalizedSlide\[\],  
    request: SlidesRequest  
  ): Promise\<NormalizedSlide\[\]\> {

