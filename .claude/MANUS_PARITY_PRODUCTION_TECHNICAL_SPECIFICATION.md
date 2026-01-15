# Manus-Parity Agentic Platform: Production Technical Specification

**Document Version:** 1.0  
**Status:** Implementation Ready  
**Audience:** Engineering Team  
**Scope:** Multi-tenant enterprise agentic platform with 100% Manus.ai parity

---

## 1. System Architecture (Truth-Level)

### 1.1 Service Architecture

The platform consists of **8 core services** with clear boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  (Authentication, rate limiting, request routing)           │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
   │  Run    │        │  Agent  │       │  Tool   │
   │ Service │        │ Service │       │ Service │
   └────┬────┘        └────┬────┘       └────┬────┘
        │                  │                  │
   ┌────▼──────────────────▼──────────────────▼────┐
   │           Message Queue (RabbitMQ)            │
   │  - run.created, run.started, run.completed   │
   │  - agent.spawned, agent.finished             │
   │  - tool.invoked, tool.completed              │
   └────┬──────────────────┬──────────────────┬────┘
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
   │  Worker │        │ Billing │       │  Audit  │
   │ Executor│        │ Engine  │       │ Logger  │
   └────┬────┘        └────┬────┘       └────┬────┘
        │                  │                  │
   ┌────▼──────────────────▼──────────────────▼────┐
   │          Data Layer (PostgreSQL)              │
   │  - runs, tasks, steps, artifacts              │
   │  - billing_ledger, credit_balances            │
   │  - audit_logs, events                         │
   └─────────────────────────────────────────────────┘
```

### 1.2 Service Responsibilities

#### Run Service
**Responsibility:** Orchestrate run lifecycle, manage state transitions, coordinate agents

**Key Operations:**
- Create run with initial context
- Transition run through states (pending → running → completed/failed)
- Spawn agents for wide research decomposition
- Manage run-level retries and resumability
- Track run artifacts and outputs

**Boundaries:**
- Does NOT execute tools directly (delegates to Tool Service)
- Does NOT manage individual agent state (delegates to Agent Service)
- Does NOT charge credits (delegates to Billing Service)

#### Agent Service
**Responsibility:** Manage individual agent lifecycle, handle agent-level retries, track agent state

**Key Operations:**
- Spawn agent with context window
- Execute agent loop (think → act → observe)
- Handle agent-level retries with exponential backoff
- Track agent state (pending → running → completed/failed)
- Manage agent artifacts and outputs

**Boundaries:**
- Does NOT coordinate multiple agents (delegates to Run Service)
- Does NOT execute tools directly (delegates to Tool Service)
- Does NOT manage billing (delegates to Billing Service)

#### Tool Service
**Responsibility:** Execute tools safely, handle tool retries, manage tool state

**Key Operations:**
- Execute tool with input validation
- Handle tool-level retries
- Manage tool state (pending → running → completed/failed)
- Track tool execution time and resource usage
- Capture tool outputs and errors

**Boundaries:**
- Does NOT manage run or agent state
- Does NOT handle billing
- Does NOT coordinate multiple tools

#### Worker Executor
**Responsibility:** Execute work items from queue, manage worker health, handle backpressure

**Key Operations:**
- Poll queue for work items
- Execute work item (run, agent, tool)
- Report completion/failure
- Handle worker crashes and recovery
- Implement autoscaling logic

**Boundaries:**
- Does NOT manage queue (uses RabbitMQ)
- Does NOT manage state transitions (delegates to services)

#### Billing Engine
**Responsibility:** Track credit usage, enforce limits, prevent double-charging

**Key Operations:**
- Reserve credits before run starts
- Charge credits on successful completion
- Refund credits on failure
- Enforce org/user credit limits
- Track credit usage per run/agent/tool

**Boundaries:**
- Does NOT execute runs or tools
- Does NOT manage user permissions

#### Audit Logger
**Responsibility:** Log all user actions for compliance, enable audit trail queries

**Key Operations:**
- Log all API calls
- Log all state transitions
- Log all billing events
- Log all permission checks
- Provide audit trail queries

**Boundaries:**
- Does NOT enforce permissions (delegates to API Gateway)
- Does NOT affect run execution

#### Collaboration Service
**Responsibility:** Manage shared workspaces, real-time sync, permission enforcement

**Key Operations:**
- Create shared workspace
- Manage workspace members
- Sync workspace state in real-time
- Enforce permission model
- Track workspace activity

**Boundaries:**
- Does NOT manage billing (delegates to Billing Engine)
- Does NOT execute runs

#### Integration Service
**Responsibility:** Manage external integrations (Gmail, Slack, Notion, etc.)

**Key Operations:**
- Store OAuth tokens securely
- Refresh tokens on expiry
- Execute integration operations
- Handle integration errors
- Audit integration access

**Boundaries:**
- Does NOT manage run state
- Does NOT handle billing

---

### 1.3 Run Lifecycle State Machine

```
┌─────────────┐
│   CREATED   │ (run created, awaiting start)
└──────┬──────┘
       │ start()
       ▼
┌─────────────┐
│  PENDING    │ (waiting for worker to pick up)
└──────┬──────┘
       │ worker picks up
       ▼
┌─────────────┐
│   RUNNING   │ (agents executing)
├─────┬───┬───┤
│     │   │   │ pause() → PAUSED
│     │   │   │ cancel() → CANCELLED
│     │   │   │ error → FAILED
│     │   │   │ complete → COMPLETED
└─────┴───┴───┘
       │
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌─────────────┐        ┌─────────────┐
│ COMPLETED   │        │   FAILED    │
└─────────────┘        └──────┬──────┘
                               │ retry()
                               ▼
                        ┌─────────────┐
                        │  RETRYING   │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   PENDING   │
                        └─────────────┘

┌─────────────┐        ┌─────────────┐
│   PAUSED    │◄──────►│  RESUMING   │
└─────────────┘        └─────────────┘
       │
       │ cancel() or timeout
       ▼
┌─────────────┐
│ CANCELLED   │
└─────────────┘
```

**State Transition Rules:**

| From | To | Condition | Action |
|------|----|-----------| -------|
| CREATED | PENDING | start() called | Reserve credits, enqueue work |
| PENDING | RUNNING | Worker picks up | Start agent execution |
| RUNNING | COMPLETED | All agents done, no errors | Release credits, mark complete |
| RUNNING | FAILED | Agent error, no retry | Refund credits, mark failed |
| RUNNING | PAUSED | pause() called | Suspend agent execution |
| RUNNING | RETRYING | Retryable error, attempts < max | Reset state, re-enqueue |
| PAUSED | RESUMING | resume() called | Resume agent execution |
| RESUMING | RUNNING | Resume successful | Continue execution |
| RUNNING | CANCELLED | cancel() called | Terminate agents, mark cancelled |
| FAILED | RETRYING | retry() called | Reset state, re-enqueue |

**Terminal States:** COMPLETED, FAILED, CANCELLED

---

### 1.4 Worker/Queue Model

#### Queue Architecture

```
┌──────────────────────────────────────────────────┐
│          RabbitMQ Message Broker                 │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  runs.high_priority (priority: 10)         │ │
│  │  - User-triggered runs                     │ │
│  │  - Max consumers: 20                       │ │
│  │  - TTL: 24 hours                           │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  runs.normal (priority: 5)                 │ │
│  │  - Scheduled/batch runs                    │ │
│  │  - Max consumers: 10                       │ │
│  │  - TTL: 24 hours                           │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  agents.work (priority: 7)                 │ │
│  │  - Agent execution tasks                   │ │
│  │  - Max consumers: 50                       │ │
│  │  - TTL: 1 hour                             │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  tools.work (priority: 6)                  │ │
│  │  - Tool execution tasks                    │ │
│  │  - Max consumers: 100                      │ │
│  │  - TTL: 30 minutes                         │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  billing.events (priority: 8)              │ │
│  │  - Credit charges/refunds                  │ │
│  │  - Max consumers: 5                        │ │
│  │  - TTL: 7 days                             │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  dead_letter (priority: 0)                 │ │
│  │  - Failed messages (after max retries)     │ │
│  │  - Max consumers: 1                        │ │
│  │  - TTL: 30 days                            │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Queue Message Format

```json
{
  "message_id": "msg_123456789",
  "idempotency_key": "idem_123456789",
  "timestamp": "2026-01-15T12:00:00Z",
  "type": "run.execute",
  "priority": 10,
  "retry_count": 0,
  "max_retries": 3,
  "backoff_ms": 1000,
  "payload": {
    "run_id": "run_123456789",
    "org_id": "org_123456789",
    "user_id": "user_123456789",
    "context": {
      "task": "research AI market trends",
      "max_agents": 10,
      "max_tokens": 100000
    }
  },
  "headers": {
    "correlation_id": "corr_123456789",
    "trace_id": "trace_123456789"
  }
}
```

#### Backpressure Strategy

```python
class BackpressureManager:
    """Manage queue backpressure and autoscaling"""
    
    def __init__(self):
        self.queue_depth_threshold = 1000
        self.worker_count_min = 5
        self.worker_count_max = 100
    
    async def check_backpressure(self, queue_name: str) -> bool:
        """Check if queue has backpressure"""
        queue_depth = await get_queue_depth(queue_name)
        
        if queue_depth > self.queue_depth_threshold:
            # Trigger autoscaling
            await autoscale_workers(queue_name, target_workers=50)
            return True
        
        return False
    
    async def handle_backpressure(self, message: Message):
        """Handle message when backpressure detected"""
        # Option 1: Delay message
        await delay_message(message, delay_ms=5000)
        
        # Option 2: Reject message (client retries)
        raise BackpressureException("Queue full, please retry")
        
        # Option 3: Prioritize message
        if message.priority >= 8:
            await requeue_with_priority(message, priority=10)
```

#### Autoscaling Rules

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue Depth | > 1000 | Scale up workers (+10) |
| Queue Depth | < 100 | Scale down workers (-5) |
| Worker CPU | > 80% | Scale up workers (+5) |
| Worker Memory | > 85% | Scale up workers (+5) |
| Message Latency | > 60s | Scale up workers (+10) |

---

### 1.5 Data Storage Strategy

#### Database (PostgreSQL)

**Primary Storage:**
- Runs, tasks, steps (transactional)
- Artifacts metadata (references to S3)
- Billing ledger (append-only)
- Audit logs (append-only)
- User/org/workspace data

**Retention Policies:**
- Runs: 90 days (then archive to S3)
- Artifacts: 30 days (then delete from S3)
- Audit logs: 7 years (compliance requirement)
- Billing ledger: 7 years (tax requirement)

#### Object Storage (S3)

**Primary Storage:**
- Artifact content (documents, images, videos)
- Run outputs (reports, presentations)
- Backup data (database snapshots)
- Archived runs (older than 90 days)

**Retention Policies:**
- Active artifacts: 30 days
- Archived artifacts: 1 year
- Backups: 30 days
- Audit logs: 7 years

#### Cache (Redis)

**Primary Storage:**
- Session data (TTL: 24 hours)
- Rate limit counters (TTL: 1 hour)
- Workspace state (TTL: 1 hour)
- Agent context (TTL: 1 hour)

**Eviction Policy:** LRU (Least Recently Used)

---

## 2. Database + Contracts

### 2.1 Table Schemas

#### Runs Table

```sql
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id),
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  task TEXT NOT NULL,
  
  -- State
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  -- Values: created, pending, running, completed, failed, paused, cancelled, retrying
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Agents
  agent_count INTEGER DEFAULT 0,
  max_agents INTEGER DEFAULT 10,
  
  -- Tokens
  tokens_used INTEGER DEFAULT 0,
  max_tokens INTEGER DEFAULT 100000,
  
  -- Retries
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Billing
  credits_reserved DECIMAL(10, 2),
  credits_charged DECIMAL(10, 2),
  
  -- Context
  context JSONB,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_runs_org_user (org_id, user_id),
  INDEX idx_runs_status (status),
  INDEX idx_runs_created_at (created_at DESC),
  UNIQUE INDEX idx_runs_idempotency (org_id, user_id, name, created_at)
);
```

#### Tasks Table

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id),
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- State
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Values: pending, running, completed, failed, skipped
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Ordering
  sequence_number INTEGER NOT NULL,
  
  -- Retries
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_tasks_run_id (run_id),
  INDEX idx_tasks_status (status)
);
```

#### Steps Table

```sql
CREATE TABLE steps (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id),
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  
  -- State
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Values: pending, running, completed, failed
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Input/Output
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  
  -- Ordering
  sequence_number INTEGER NOT NULL,
  
  -- Retries
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_steps_task_id (task_id),
  INDEX idx_steps_status (status)
);
```

#### Artifacts Table

```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id),
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Storage
  s3_key VARCHAR(1024) NOT NULL,
  s3_url VARCHAR(2048) NOT NULL,
  file_size_bytes BIGINT,
  
  -- Content
  content_hash VARCHAR(64) NOT NULL,
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_artifacts_run_id (run_id),
  INDEX idx_artifacts_created_at (created_at DESC),
  UNIQUE INDEX idx_artifacts_s3_key (s3_key)
);
```

#### Billing Ledger Table (Append-Only)

```sql
CREATE TABLE billing_ledger (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  
  -- Transaction
  transaction_type VARCHAR(50) NOT NULL,
  -- Values: charge, refund, adjustment, purchase
  
  -- Amount
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Reference
  run_id UUID REFERENCES runs(id),
  invoice_id UUID REFERENCES invoices(id),
  
  -- Description
  description TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_billing_ledger_org_id (org_id),
  INDEX idx_billing_ledger_created_at (created_at DESC),
  INDEX idx_billing_ledger_run_id (run_id)
);
```

#### Credit Balances Table

```sql
CREATE TABLE credit_balances (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE REFERENCES orgs(id),
  
  -- Balance
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reserved DECIMAL(10, 2) NOT NULL DEFAULT 0,
  available DECIMAL(10, 2) GENERATED ALWAYS AS (balance - reserved) STORED,
  
  -- Limits
  monthly_limit DECIMAL(10, 2),
  
  -- Audit
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_credit_balances_org_id (org_id)
);
```

#### Audit Logs Table (Append-Only)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  user_id UUID REFERENCES users(id),
  
  -- Action
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  
  -- Details
  details JSONB,
  result VARCHAR(50),
  -- Values: success, failure, denied
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_audit_logs_org_id (org_id),
  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_created_at (created_at DESC),
  INDEX idx_audit_logs_action (action)
);
```

#### Workspaces Table

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Owner
  owner_id UUID NOT NULL REFERENCES users(id),
  
  -- Sharing
  is_shared BOOLEAN DEFAULT false,
  shared_link VARCHAR(255) UNIQUE,
  shared_link_expires_at TIMESTAMP,
  
  -- Permissions
  default_permission VARCHAR(50) DEFAULT 'viewer',
  -- Values: viewer, editor, admin
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_workspaces_org_id (org_id),
  INDEX idx_workspaces_owner_id (owner_id),
  UNIQUE INDEX idx_workspaces_shared_link (shared_link)
);
```

#### Workspace Members Table

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Role
  role VARCHAR(50) NOT NULL,
  -- Values: viewer, editor, admin
  
  -- Audit
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  UNIQUE INDEX idx_workspace_members_unique (workspace_id, user_id)
);
```

#### Email Ingestion Table

```sql
CREATE TABLE email_ingestions (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Email
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  
  -- Threading
  message_id VARCHAR(255) NOT NULL UNIQUE,
  in_reply_to VARCHAR(255),
  thread_id VARCHAR(255),
  
  -- Attachments
  attachment_count INTEGER DEFAULT 0,
  attachment_keys TEXT[],
  
  -- Processing
  status VARCHAR(50) DEFAULT 'pending',
  -- Values: pending, processing, completed, failed
  
  -- Task
  task_id UUID REFERENCES tasks(id),
  
  -- Audit
  received_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_email_ingestions_org_id (org_id),
  INDEX idx_email_ingestions_user_id (user_id),
  INDEX idx_email_ingestions_thread_id (thread_id),
  UNIQUE INDEX idx_email_ingestions_message_id (message_id)
);
```

#### OAuth Connectors Table

```sql
CREATE TABLE oauth_connectors (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Provider
  provider VARCHAR(100) NOT NULL,
  -- Values: gmail, slack, notion, calendar, etc.
  
  -- Credentials
  provider_user_id VARCHAR(255),
  access_token TEXT NOT NULL ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  token_expires_at TIMESTAMP,
  
  -- Scopes
  scopes TEXT[] NOT NULL,
  
  -- Metadata
  metadata JSONB,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_oauth_connectors_org_id (org_id),
  INDEX idx_oauth_connectors_user_id (user_id),
  INDEX idx_oauth_connectors_provider (provider),
  UNIQUE INDEX idx_oauth_connectors_unique (org_id, user_id, provider)
);
```

---

### 2.2 API Contracts

#### Run Management Endpoints

**Create Run**

```
POST /api/v1/runs

Request:
{
  "name": "Research AI market trends",
  "description": "Analyze recent AI market developments",
  "task": "research the latest AI market trends and provide insights",
  "max_agents": 10,
  "max_tokens": 100000,
  "context": {
    "industry": "AI/ML",
    "focus": "market trends"
  }
}

Response (201 Created):
{
  "id": "run_123456789",
  "org_id": "org_123456789",
  "user_id": "user_123456789",
  "status": "created",
  "name": "Research AI market trends",
  "created_at": "2026-01-15T12:00:00Z",
  "credits_reserved": 50.00,
  "_links": {
    "self": "/api/v1/runs/run_123456789",
    "start": "/api/v1/runs/run_123456789/start",
    "cancel": "/api/v1/runs/run_123456789/cancel"
  }
}
```

**Start Run**

```
POST /api/v1/runs/{run_id}/start

Request:
{}

Response (200 OK):
{
  "id": "run_123456789",
  "status": "pending",
  "started_at": "2026-01-15T12:00:01Z",
  "agent_count": 0,
  "tokens_used": 0
}
```

**Pause Run**

```
POST /api/v1/runs/{run_id}/pause

Request:
{}

Response (200 OK):
{
  "id": "run_123456789",
  "status": "paused",
  "paused_at": "2026-01-15T12:00:30Z",
  "agents_paused": 5
}
```

**Resume Run**

```
POST /api/v1/runs/{run_id}/resume

Request:
{}

Response (200 OK):
{
  "id": "run_123456789",
  "status": "running",
  "resumed_at": "2026-01-15T12:00:35Z"
}
```

**Cancel Run**

```
POST /api/v1/runs/{run_id}/cancel

Request:
{}

Response (200 OK):
{
  "id": "run_123456789",
  "status": "cancelled",
  "cancelled_at": "2026-01-15T12:00:40Z",
  "credits_refunded": 25.00
}
```

**Retry Run**

```
POST /api/v1/runs/{run_id}/retry

Request:
{}

Response (200 OK):
{
  "id": "run_123456789",
  "status": "retrying",
  "attempt_number": 2,
  "credits_reserved": 50.00
}
```

**Get Run**

```
GET /api/v1/runs/{run_id}

Response (200 OK):
{
  "id": "run_123456789",
  "org_id": "org_123456789",
  "user_id": "user_123456789",
  "status": "running",
  "name": "Research AI market trends",
  "task": "research the latest AI market trends and provide insights",
  "started_at": "2026-01-15T12:00:01Z",
  "agent_count": 5,
  "tokens_used": 25000,
  "credits_reserved": 50.00,
  "credits_charged": 0.00,
  "artifacts": [
    {
      "id": "art_123456789",
      "name": "research_report.md",
      "mime_type": "text/markdown",
      "s3_url": "https://s3.amazonaws.com/..."
    }
  ],
  "_links": {
    "self": "/api/v1/runs/run_123456789",
    "logs": "/api/v1/runs/run_123456789/logs",
    "artifacts": "/api/v1/runs/run_123456789/artifacts"
  }
}
```

**Stream Run Logs**

```
GET /api/v1/runs/{run_id}/logs?stream=true

Response (200 OK, Server-Sent Events):
data: {"timestamp": "2026-01-15T12:00:01Z", "level": "info", "message": "Run started"}
data: {"timestamp": "2026-01-15T12:00:02Z", "level": "info", "message": "Agent 1 spawned"}
data: {"timestamp": "2026-01-15T12:00:03Z", "level": "debug", "message": "Agent 1 thinking..."}
data: {"timestamp": "2026-01-15T12:00:05Z", "level": "info", "message": "Agent 1 completed"}
```

**Get Artifacts**

```
GET /api/v1/runs/{run_id}/artifacts

Response (200 OK):
{
  "artifacts": [
    {
      "id": "art_123456789",
      "name": "research_report.md",
      "mime_type": "text/markdown",
      "s3_url": "https://s3.amazonaws.com/...",
      "file_size_bytes": 45678,
      "created_at": "2026-01-15T12:00:30Z"
    },
    {
      "id": "art_987654321",
      "name": "presentation.pptx",
      "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "s3_url": "https://s3.amazonaws.com/...",
      "file_size_bytes": 2345678,
      "created_at": "2026-01-15T12:05:00Z"
    }
  ]
}
```

**Export Run**

```
POST /api/v1/runs/{run_id}/export

Request:
{
  "format": "pdf",
  "include_artifacts": true,
  "include_logs": false
}

Response (202 Accepted):
{
  "id": "export_123456789",
  "run_id": "run_123456789",
  "format": "pdf",
  "status": "processing",
  "created_at": "2026-01-15T12:00:00Z",
  "_links": {
    "download": "/api/v1/exports/export_123456789/download"
  }
}
```

---

## 3. Reliability + Idempotency

### 3.1 Idempotency Keys

Every API call must include an idempotency key to prevent duplicate operations:

```
POST /api/v1/runs

Headers:
  Idempotency-Key: idem_123456789

Request:
{
  "name": "Research AI market trends",
  "task": "research the latest AI market trends"
}

Response (201 Created):
{
  "id": "run_123456789",
  ...
}

# Retry with same idempotency key returns same response (idempotent)
Response (200 OK):
{
  "id": "run_123456789",
  ...
}
```

**Idempotency Key Format:**
- Length: 32-64 characters
- Format: `idem_` + UUID or hash
- Uniqueness: Per org + per endpoint
- Retention: 24 hours

**Implementation:**

```python
class IdempotencyManager:
    """Manage idempotent requests"""
    
    async def process_request(self, idempotency_key: str, request_data: Dict):
        """Process request with idempotency"""
        
        # Check if request already processed
        cached_response = await redis.get(f"idem:{idempotency_key}")
        if cached_response:
            return json.loads(cached_response)
        
        # Process request
        response = await process_business_logic(request_data)
        
        # Cache response
        await redis.setex(
            f"idem:{idempotency_key}",
            86400,  # 24 hours
            json.dumps(response)
        )
        
        return response
```

### 3.2 Retry Semantics

**Retryable Errors:**
- 408 Request Timeout
- 429 Rate Limited
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout

**Non-Retryable Errors:**
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 422 Unprocessable Entity

**Retry Strategy:**

```python
class RetryStrategy:
    """Exponential backoff with jitter"""
    
    def __init__(self, max_attempts: int = 3):
        self.max_attempts = max_attempts
        self.base_delay_ms = 100
        self.max_delay_ms = 30000
    
    def get_backoff_delay(self, attempt: int) -> int:
        """Calculate backoff delay with jitter"""
        # Exponential backoff: 100ms, 200ms, 400ms, 800ms, ...
        delay = self.base_delay_ms * (2 ** attempt)
        
        # Cap at max delay
        delay = min(delay, self.max_delay_ms)
        
        # Add jitter: ±10%
        jitter = delay * 0.1 * (2 * random.random() - 1)
        
        return int(delay + jitter)
    
    async def execute_with_retry(self, operation, *args, **kwargs):
        """Execute operation with retries"""
        last_error = None
        
        for attempt in range(self.max_attempts):
            try:
                return await operation(*args, **kwargs)
            except RetryableError as e:
                last_error = e
                
                if attempt < self.max_attempts - 1:
                    delay = self.get_backoff_delay(attempt)
                    await asyncio.sleep(delay / 1000)
                else:
                    raise
        
        raise last_error
```

### 3.3 Cancellation Semantics

Cancellation propagates through the run hierarchy:

```
Run Cancelled
    ↓
All Tasks Cancelled
    ↓
All Steps Cancelled
    ↓
All Tools Terminated
```

**Cancellation Implementation:**

```python
class CancellationManager:
    """Manage run cancellation"""
    
    async def cancel_run(self, run_id: str):
        """Cancel run and all subtasks"""
        
        # 1. Mark run as cancelled
        await db.update_run(run_id, status='cancelled')
        
        # 2. Cancel all tasks
        tasks = await db.get_tasks(run_id)
        for task in tasks:
            await self.cancel_task(task.id)
        
        # 3. Cancel all agents
        agents = await db.get_agents(run_id)
        for agent in agents:
            await self.cancel_agent(agent.id)
        
        # 4. Refund credits
        run = await db.get_run(run_id)
        if run.credits_reserved > run.credits_charged:
            refund_amount = run.credits_reserved - run.credits_charged
            await billing_engine.refund(run.org_id, refund_amount, run_id)
    
    async def cancel_task(self, task_id: str):
        """Cancel task and all steps"""
        
        # 1. Mark task as cancelled
        await db.update_task(task_id, status='cancelled')
        
        # 2. Cancel all steps
        steps = await db.get_steps(task_id)
        for step in steps:
            await self.cancel_step(step.id)
    
    async def cancel_step(self, step_id: str):
        """Cancel step and terminate tool"""
        
        # 1. Mark step as cancelled
        await db.update_step(step_id, status='cancelled')
        
        # 2. Terminate tool execution
        step = await db.get_step(step_id)
        if step.status == 'running':
            await tool_executor.terminate(step.id)
```

### 3.4 Exactly-Once Billing

Billing must be exactly-once to prevent double-charging:

```python
class BillingEngine:
    """Exactly-once billing"""
    
    async def charge_run(self, run_id: str, amount: Decimal):
        """Charge credits for run (exactly-once)"""
        
        # 1. Check if already charged
        existing_charge = await db.query(
            "SELECT * FROM billing_ledger WHERE run_id = %s AND transaction_type = 'charge'",
            [run_id]
        )
        
        if existing_charge:
            # Already charged, skip
            return
        
        # 2. Reserve credits
        org = await db.get_run(run_id).org
        balance = await self.get_balance(org.id)
        
        if balance.available < amount:
            raise InsufficientCreditsError()
        
        # 3. Create billing ledger entry (append-only)
        await db.insert('billing_ledger', {
            'id': uuid.uuid4(),
            'org_id': org.id,
            'transaction_type': 'charge',
            'amount': amount,
            'run_id': run_id,
            'created_at': datetime.utcnow()
        })
        
        # 4. Update balance
        await db.update_credit_balance(
            org.id,
            balance=balance.balance - amount
        )
        
        # 5. Log audit event
        await audit_logger.log(
            org_id=org.id,
            action='billing.charge',
            amount=amount,
            run_id=run_id
        )
```

---

## 4. Wide Research Implementation Details

### 4.1 Task Decomposition

The main agent decomposes the research task into independent subtasks:

```python
class ResearchDecomposer:
    """Decompose research task into subtasks"""
    
    async def decompose(self, task: str, max_agents: int) -> List[str]:
        """Decompose task into subtasks"""
        
        # 1. Use LLM to decompose task
        decomposition_prompt = f"""
        You are a research task decomposer. Break down this research task into 
        {min(max_agents, 10)} independent subtasks that can be executed in parallel.
        
        Task: {task}
        
        Return a JSON array of subtasks:
        [
          "subtask 1",
          "subtask 2",
          ...
        ]
        """
        
        response = await llm.invoke({
            'messages': [
                {'role': 'system', 'content': 'You are a research task decomposer.'},
                {'role': 'user', 'content': decomposition_prompt}
            ],
            'response_format': {'type': 'json_schema', ...}
        })
        
        subtasks = json.loads(response.content)
        
        # 2. Validate subtasks
        if len(subtasks) > max_agents:
            subtasks = subtasks[:max_agents]
        
        return subtasks
    
    async def spawn_agents(self, run_id: str, subtasks: List[str]) -> List[str]:
        """Spawn agents for each subtask"""
        
        agent_ids = []
        
        for i, subtask in enumerate(subtasks):
            # 1. Create agent
            agent_id = await db.insert('agents', {
                'id': uuid.uuid4(),
                'run_id': run_id,
                'subtask': subtask,
                'sequence_number': i,
                'status': 'pending'
            })
            
            # 2. Enqueue agent work
            await queue.enqueue('agents.work', {
                'agent_id': agent_id,
                'run_id': run_id,
                'subtask': subtask
            })
            
            agent_ids.append(agent_id)
        
        return agent_ids
```

### 4.2 Retrieval Pipeline

Each agent retrieves sources for its subtask:

```python
class RetrievalPipeline:
    """Retrieve sources for research subtask"""
    
    async def retrieve(self, query: str, max_sources: int = 10) -> List[Source]:
        """Retrieve sources for query"""
        
        # 1. Search multiple sources
        sources = []
        
        # Search web
        web_results = await self.search_web(query, max_results=5)
        sources.extend(web_results)
        
        # Search academic
        academic_results = await self.search_academic(query, max_results=3)
        sources.extend(academic_results)
        
        # Search news
        news_results = await self.search_news(query, max_results=2)
        sources.extend(news_results)
        
        # 2. Deduplicate sources
        sources = self._deduplicate_sources(sources)
        
        # 3. Score sources
        sources = await self._score_sources(sources, query)
        
        # 4. Rank sources
        sources = sorted(sources, key=lambda s: s.score, reverse=True)
        
        # 5. Return top sources
        return sources[:max_sources]
    
    def _deduplicate_sources(self, sources: List[Source]) -> List[Source]:
        """Remove duplicate sources"""
        
        seen_urls = set()
        unique_sources = []
        
        for source in sources:
            if source.url not in seen_urls:
                seen_urls.add(source.url)
                unique_sources.append(source)
        
        return unique_sources
    
    async def _score_sources(self, sources: List[Source], query: str) -> List[Source]:
        """Score sources by relevance and trust"""
        
        for source in sources:
            # 1. Relevance score (0-1)
            relevance = await self._calculate_relevance(source, query)
            
            # 2. Trust score (0-1)
            trust = await self._calculate_trust(source)
            
            # 3. Recency score (0-1)
            recency = await self._calculate_recency(source)
            
            # 4. Combined score
            source.score = (relevance * 0.5) + (trust * 0.3) + (recency * 0.2)
        
        return sources
```

### 4.3 Synthesis Pipeline

The main agent synthesizes results from all agents:

```python
class SynthesisPipeline:
    """Synthesize results from multiple agents"""
    
    async def synthesize(self, run_id: str, agent_results: List[Dict]) -> str:
        """Synthesize agent results into final report"""
        
        # 1. Collect all results
        all_findings = []
        all_sources = []
        
        for result in agent_results:
            all_findings.append(result['findings'])
            all_sources.extend(result['sources'])
        
        # 2. Merge findings
        merged_findings = await self._merge_findings(all_findings)
        
        # 3. Resolve conflicts
        resolved_findings = await self._resolve_conflicts(merged_findings)
        
        # 4. Generate synthesis prompt
        synthesis_prompt = f"""
        You are a research synthesis expert. Synthesize these findings into a 
        coherent research report with citations.
        
        Findings:
        {json.dumps(resolved_findings, indent=2)}
        
        Sources:
        {json.dumps(all_sources, indent=2)}
        
        Generate a comprehensive research report with:
        1. Executive summary
        2. Key findings
        3. Analysis
        4. Recommendations
        5. Citations (format: [1], [2], etc.)
        """
        
        # 5. Generate synthesis
        response = await llm.invoke({
            'messages': [
                {'role': 'system', 'content': 'You are a research synthesis expert.'},
                {'role': 'user', 'content': synthesis_prompt}
            ]
        })
        
        report = response.content
        
        # 6. Add citations
        report_with_citations = await self._add_citations(report, all_sources)
        
        return report_with_citations
    
    async def _merge_findings(self, findings_list: List[str]) -> Dict:
        """Merge findings from multiple agents"""
        
        merge_prompt = f"""
        Merge these research findings into a single coherent structure:
        
        {json.dumps(findings_list, indent=2)}
        
        Return a JSON object with merged findings.
        """
        
        response = await llm.invoke({
            'messages': [
                {'role': 'user', 'content': merge_prompt}
            ],
            'response_format': {'type': 'json_schema', ...}
        })
        
        return json.loads(response.content)
    
    async def _resolve_conflicts(self, findings: Dict) -> Dict:
        """Resolve conflicting findings"""
        
        conflict_resolution_prompt = f"""
        Review these findings and resolve any conflicts:
        
        {json.dumps(findings, indent=2)}
        
        For each conflict, provide the most accurate resolution based on evidence.
        Return a JSON object with resolved findings.
        """
        
        response = await llm.invoke({
            'messages': [
                {'role': 'user', 'content': conflict_resolution_prompt}
            ],
            'response_format': {'type': 'json_schema', ...}
        })
        
        return json.loads(response.content)
```

---

## 5. Presentation Generation Details

### 5.1 Slide Planning

```python
class SlidePlanner:
    """Plan presentation structure"""
    
    async def plan_slides(self, research_report: str, max_slides: int = 20) -> List[SlidePlan]:
        """Plan slide structure from research report"""
        
        planning_prompt = f"""
        Create a presentation slide plan from this research report:
        
        {research_report}
        
        Plan {max_slides} slides with:
        1. Title slide
        2. Agenda
        3. Key findings (3-5 slides)
        4. Analysis (3-5 slides)
        5. Recommendations (2-3 slides)
        6. Conclusion
        
        For each slide, provide:
        - Title
        - Content outline
        - Visual suggestions
        - Speaker notes
        
        Return a JSON array of slide plans.
        """
        
        response = await llm.invoke({
            'messages': [
                {'role': 'user', 'content': planning_prompt}
            ],
            'response_format': {'type': 'json_schema', ...}
        })
        
        slide_plans = json.loads(response.content)
        
        return [SlidePlan(**plan) for plan in slide_plans]
```

### 5.2 Visual Generation

```python
class VisualGenerator:
    """Generate visuals for presentation"""
    
    async def generate_visuals(self, slide_plans: List[SlidePlan]) -> Dict[str, str]:
        """Generate visuals for each slide"""
        
        visuals = {}
        
        for slide_plan in slide_plans:
            # 1. Generate visual prompt
            visual_prompt = f"""
            Generate a visual for this slide:
            
            Title: {slide_plan.title}
            Content: {slide_plan.content}
            Visual suggestion: {slide_plan.visual_suggestion}
            
            Create a professional, data-driven visual that supports the content.
            """
            
            # 2. Generate image
            image_url = await image_generator.generate(visual_prompt)
            
            # 3. Store visual
            visuals[slide_plan.id] = image_url
        
        return visuals
```

### 5.3 PPTX Export

```python
class PresentationExporter:
    """Export presentation to PPTX"""
    
    async def export_pptx(self, slide_plans: List[SlidePlan], visuals: Dict[str, str]) -> bytes:
        """Export presentation to PPTX"""
        
        # 1. Create presentation
        prs = Presentation()
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(7.5)
        
        # 2. Add slides
        for slide_plan in slide_plans:
            # Create slide
            slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout
            
            # Add title
            title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(9), Inches(1))
            title_frame = title_box.text_frame
            title_frame.text = slide_plan.title
            
            # Add visual
            if slide_plan.id in visuals:
                image_url = visuals[slide_plan.id]
                image_path = await download_image(image_url)
                slide.shapes.add_picture(image_path, Inches(1), Inches(1.5), width=Inches(8))
            
            # Add speaker notes
            notes_slide = slide.notes_slide
            text_frame = notes_slide.notes_text_frame
            text_frame.text = slide_plan.speaker_notes
        
        # 3. Save to bytes
        output = io.BytesIO()
        prs.save(output)
        output.seek(0)
        
        return output.getvalue()
```

---

## 6. Data → Visual Insights Details

### 6.1 File Ingestion

```python
class FileIngestionPipeline:
    """Ingest and validate data files"""
    
    ALLOWED_FORMATS = ['csv', 'xlsx', 'json', 'parquet']
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    async def ingest_file(self, file_path: str, file_name: str) -> pd.DataFrame:
        """Ingest and validate file"""
        
        # 1. Validate file size
        file_size = os.path.getsize(file_path)
        if file_size > self.MAX_FILE_SIZE:
            raise FileTooLargeError(f"File exceeds {self.MAX_FILE_SIZE} bytes")
        
        # 2. Validate file format
        file_ext = file_name.split('.')[-1].lower()
        if file_ext not in self.ALLOWED_FORMATS:
            raise UnsupportedFormatError(f"Format {file_ext} not supported")
        
        # 3. Load file
        if file_ext == 'csv':
            df = pd.read_csv(file_path)
        elif file_ext == 'xlsx':
            df = pd.read_excel(file_path)
        elif file_ext == 'json':
            df = pd.read_json(file_path)
        elif file_ext == 'parquet':
            df = pd.read_parquet(file_path)
        
        # 4. Validate data
        if df.empty:
            raise EmptyDatasetError("Dataset is empty")
        
        if len(df) > 1000000:
            raise DatasetTooLargeError("Dataset exceeds 1M rows")
        
        # 5. Clean data
        df = df.dropna(how='all')  # Remove empty rows
        df = df.drop_duplicates()  # Remove duplicates
        
        return df
```

### 6.2 Auto-Analysis Pipeline

```python
class AutoAnalysisPipeline:
    """Automatically analyze dataset"""
    
    async def analyze(self, df: pd.DataFrame) -> Dict:
        """Analyze dataset"""
        
        analysis = {
            'eda': await self._exploratory_data_analysis(df),
            'anomalies': await self._detect_anomalies(df),
            'charts': await self._select_charts(df),
            'insights': await self._generate_insights(df)
        }
        
        return analysis
    
    async def _exploratory_data_analysis(self, df: pd.DataFrame) -> Dict:
        """Perform EDA"""
        
        return {
            'shape': df.shape,
            'dtypes': df.dtypes.to_dict(),
            'missing': df.isnull().sum().to_dict(),
            'statistics': df.describe().to_dict(),
            'correlations': df.corr().to_dict()
        }
    
    async def _detect_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        """Detect anomalies"""
        
        anomalies = []
        
        # 1. Detect outliers using IQR
        for column in df.select_dtypes(include=['number']).columns:
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1
            
            outliers = df[(df[column] < Q1 - 1.5 * IQR) | (df[column] > Q3 + 1.5 * IQR)]
            
            if not outliers.empty:
                anomalies.append({
                    'column': column,
                    'type': 'outlier',
                    'count': len(outliers),
                    'percentage': len(outliers) / len(df) * 100
                })
        
        return anomalies
    
    async def _select_charts(self, df: pd.DataFrame) -> List[Dict]:
        """Select appropriate charts"""
        
        charts = []
        
        # 1. For each numeric column, suggest line chart
        numeric_cols = df.select_dtypes(include=['number']).columns
        for col in numeric_cols[:5]:  # Limit to 5
            charts.append({
                'type': 'line',
                'title': f'{col} Over Time',
                'x_axis': df.index,
                'y_axis': col
            })
        
        # 2. For categorical columns, suggest bar chart
        categorical_cols = df.select_dtypes(include=['object']).columns
        for col in categorical_cols[:3]:  # Limit to 3
            charts.append({
                'type': 'bar',
                'title': f'{col} Distribution',
                'x_axis': col,
                'y_axis': 'count'
            })
        
        return charts
```

---

## 7. Multimodal Details

### 7.1 Video Ingestion Pipeline

```python
class VideoIngestionPipeline:
    """Ingest and process video files"""
    
    async def ingest_video(self, video_path: str) -> Dict:
        """Ingest video and extract components"""
        
        # 1. Extract transcript
        transcript = await self._extract_transcript(video_path)
        
        # 2. Extract keyframes
        keyframes = await self._extract_keyframes(video_path)
        
        # 3. Extract audio
        audio = await self._extract_audio(video_path)
        
        # 4. Perform diarization
        diarization = await self._perform_diarization(audio)
        
        return {
            'transcript': transcript,
            'keyframes': keyframes,
            'diarization': diarization
        }
    
    async def _extract_transcript(self, video_path: str) -> str:
        """Extract transcript using ASR"""
        
        # 1. Extract audio
        audio = await self._extract_audio(video_path)
        
        # 2. Transcribe audio
        transcript = await transcription_service.transcribe(audio)
        
        return transcript
    
    async def _extract_keyframes(self, video_path: str) -> List[str]:
        """Extract keyframes from video"""
        
        # 1. Open video
        cap = cv2.VideoCapture(video_path)
        
        # 2. Extract frames at regular intervals
        keyframes = []
        frame_count = 0
        interval = int(cap.get(cv2.CAP_PROP_FPS) * 5)  # Every 5 seconds
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % interval == 0:
                # Save keyframe
                keyframe_path = f"/tmp/keyframe_{frame_count}.jpg"
                cv2.imwrite(keyframe_path, frame)
                keyframes.append(keyframe_path)
            
            frame_count += 1
        
        cap.release()
        
        return keyframes
    
    async def _perform_diarization(self, audio_path: str) -> Dict:
        """Perform speaker diarization"""
        
        # Use pyannote.audio for diarization
        diarization = pipeline(audio_path)
        
        speakers = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in speakers:
                speakers[speaker] = []
            
            speakers[speaker].append({
                'start': turn.start,
                'end': turn.end
            })
        
        return speakers
```

### 7.2 Audio Processing

```python
class AudioProcessingPipeline:
    """Process audio files"""
    
    async def process_audio(self, audio_path: str) -> Dict:
        """Process audio"""
        
        # 1. Transcribe
        transcript = await transcription_service.transcribe(audio_path)
        
        # 2. Generate voice output
        voice_output = await text_to_speech_service.synthesize(transcript)
        
        # 3. Extract metadata
        metadata = await self._extract_metadata(audio_path)
        
        return {
            'transcript': transcript,
            'voice_output': voice_output,
            'metadata': metadata
        }
    
    async def _extract_metadata(self, audio_path: str) -> Dict:
        """Extract audio metadata"""
        
        audio = AudioSegment.from_file(audio_path)
        
        return {
            'duration_ms': len(audio),
            'sample_rate': audio.frame_rate,
            'channels': audio.channels,
            'bit_depth': audio.sample_width * 8
        }
```

### 7.3 Image Understanding

```python
class ImageUnderstandingPipeline:
    """Understand images"""
    
    async def understand_image(self, image_path: str) -> Dict:
        """Understand image"""
        
        # 1. Perform OCR
        ocr_text = await self._perform_ocr(image_path)
        
        # 2. Generate caption
        caption = await self._generate_caption(image_path)
        
        # 3. Detect layout
        layout = await self._detect_layout(image_path)
        
        return {
            'ocr_text': ocr_text,
            'caption': caption,
            'layout': layout
        }
    
    async def _perform_ocr(self, image_path: str) -> str:
        """Perform OCR"""
        
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        
        return text
    
    async def _generate_caption(self, image_path: str) -> str:
        """Generate image caption"""
        
        response = await vision_service.analyze_image(image_path)
        
        return response['caption']
```

---

## 8. Email + Collaboration

### 8.1 Email Ingestion

```python
class EmailIngestionService:
    """Ingest and process emails"""
    
    async def ingest_email(self, email_data: Dict) -> str:
        """Ingest email and create task"""
        
        # 1. Verify sender
        sender = email_data['from']
        org_id = await self._verify_sender(sender)
        
        if not org_id:
            raise UnauthorizedSenderError(f"Sender {sender} not authorized")
        
        # 2. Extract message
        subject = email_data['subject']
        body = email_data['body']
        message_id = email_data['message_id']
        
        # 3. Handle attachments
        attachments = []
        for attachment in email_data.get('attachments', []):
            attachment_key = await self._store_attachment(attachment)
            attachments.append(attachment_key)
        
        # 4. Create task from email
        task_id = await self._create_task_from_email(
            org_id=org_id,
            subject=subject,
            body=body,
            attachments=attachments
        )
        
        # 5. Store email ingestion record
        await db.insert('email_ingestions', {
            'id': uuid.uuid4(),
            'org_id': org_id,
            'from_address': sender,
            'subject': subject,
            'body': body,
            'message_id': message_id,
            'attachment_count': len(attachments),
            'attachment_keys': attachments,
            'task_id': task_id,
            'status': 'completed'
        })
        
        return task_id
    
    async def _verify_sender(self, sender: str) -> Optional[str]:
        """Verify sender is authorized"""
        
        # Check if sender is registered user
        user = await db.query(
            "SELECT org_id FROM users WHERE email = %s",
            [sender]
        )
        
        if user:
            return user[0]['org_id']
        
        return None
```

### 8.2 Real-Time Collaboration

```python
class CollaborationService:
    """Manage real-time collaboration"""
    
    async def sync_workspace(self, workspace_id: str, changes: Dict):
        """Sync workspace changes in real-time"""
        
        # 1. Apply changes to workspace
        await db.update_workspace(workspace_id, changes)
        
        # 2. Broadcast changes to all members
        members = await db.get_workspace_members(workspace_id)
        
        for member in members:
            # Send update via WebSocket
            await websocket_manager.send_to_user(
                user_id=member.user_id,
                message={
                    'type': 'workspace.updated',
                    'workspace_id': workspace_id,
                    'changes': changes
                }
            )
```

---

## 9. Security & Compliance

### 9.1 Threat Model

**Key Threats:**

1. **SSRF (Server-Side Request Forgery)**
   - Mitigation: Validate URLs, block private IP ranges
   - Implementation: URL validation middleware

2. **Prompt Injection**
   - Mitigation: Sanitize user inputs, use parameterized prompts
   - Implementation: Input validation, prompt templating

3. **Sandbox Escape**
   - Mitigation: Run tools in isolated containers, resource limits
   - Implementation: Docker containers, cgroups

4. **Token Leakage**
   - Mitigation: Encrypt tokens at rest, use short-lived tokens
   - Implementation: Encryption, token rotation

### 9.2 Audit Requirements

**Events to Log:**
- User login/logout
- API calls (method, endpoint, user, timestamp)
- State transitions (run status changes)
- Billing events (charges, refunds)
- Permission checks (allowed/denied)
- Data access (who accessed what data)

**Audit Log Retention:** 7 years (compliance requirement)

---

## 10. Implementation Hand-off

### Step 0: Repository Map

```
swissbrain-platform/
├── api/
│   ├── routes/
│   │   ├── runs.py
│   │   ├── agents.py
│   │   ├── tools.py
│   │   ├── billing.py
│   │   └── auth.py
│   ├── middleware/
│   │   ├── auth.py
│   │   ├── idempotency.py
│   │   └── audit.py
│   └── main.py
├── services/
│   ├── run_service.py
│   ├── agent_service.py
│   ├── tool_service.py
│   ├── billing_service.py
│   ├── research_service.py
│   ├── presentation_service.py
│   └── collaboration_service.py
├── workers/
│   ├── run_executor.py
│   ├── agent_executor.py
│   ├── tool_executor.py
│   └── billing_processor.py
├── models/
│   ├── run.py
│   ├── agent.py
│   ├── task.py
│   ├── step.py
│   └── artifact.py
├── database/
│   ├── migrations/
│   ├── schema.py
│   └── queries.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── load/
└── k8s/
    ├── deployment.yaml
    ├── service.yaml
    └── configmap.yaml
```

### Step 1: Database Migrations

```bash
# Create migration files
alembic revision --autogenerate -m "Create runs table"
alembic revision --autogenerate -m "Create agents table"
alembic revision --autogenerate -m "Create billing_ledger table"

# Apply migrations
alembic upgrade head
```

### Step 2: API Endpoints

```bash
# Implement run endpoints
# POST /api/v1/runs
# GET /api/v1/runs/{run_id}
# POST /api/v1/runs/{run_id}/start
# POST /api/v1/runs/{run_id}/cancel

# Implement agent endpoints
# GET /api/v1/runs/{run_id}/agents
# GET /api/v1/agents/{agent_id}

# Implement billing endpoints
# GET /api/v1/billing/balance
# GET /api/v1/billing/ledger
```

### Step 3: Worker/Queue

```bash
# Implement run executor
# Implement agent executor
# Implement tool executor
# Implement billing processor

# Set up RabbitMQ queues
# Set up worker autoscaling
```

### Step 4: Tool Contracts

```bash
# Define tool interface
# Implement tool registry
# Implement tool executor
# Add tool validation
```

### Step 5: UI and Streaming

```bash
# Implement run dashboard
# Implement real-time log streaming
# Implement artifact viewer
# Implement collaboration UI
```

### Step 6: Tests, Load Tests, Chaos Gates

```bash
# Unit tests (90% coverage)
# Integration tests (all APIs)
# Load tests (1000 concurrent runs)
# Chaos tests (failure scenarios)
```

---

## Conclusion

This specification provides the complete technical blueprint for building a Manus-parity agentic platform. Every section includes concrete schemas, pseudocode, and implementation details to enable your engineering team to implement without guesswork.

**Key Principles:**
- **Exactly-once semantics** for billing and artifact creation
- **Idempotency** at every layer
- **Parallel execution** for wide research
- **Real-time collaboration** for shared workspaces
- **Enterprise-grade reliability** with retries and cancellation
- **Complete audit trail** for compliance

Ready to implement!
