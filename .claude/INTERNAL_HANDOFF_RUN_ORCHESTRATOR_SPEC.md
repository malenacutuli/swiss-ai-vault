# Internal Handoff: Run Orchestrator Specification

**Audience:** Senior engineering team rebuilding system from scratch  
**Scope:** Explicit state machines, invariants, failure modes, operational details  
**Assumptions:** Team understands agentic systems and distributed systems fundamentals

---

## 1. Run Orchestrator: Explicit State Machine

### 1.1 State Definitions

The run orchestrator manages a single **run** through its lifecycle. A run is the top-level execution unit that orchestrates agents, tasks, and tools.

```
State: CREATED
  Meaning: Run object exists, not yet started
  Invariants:
    - credits_reserved = 0
    - agent_count = 0
    - task_count = 0
    - no tasks/agents spawned yet
    - run_id is assigned
    - created_at is set
  Allowed Actions:
    - start() → PENDING
    - cancel() → CANCELLED
    - delete() (soft delete)
  Timeout: None (user must explicitly start)

State: PENDING
  Meaning: Run enqueued, waiting for worker to pick up
  Invariants:
    - credits_reserved > 0 (reserved from org balance)
    - agent_count = 0 (not yet spawned)
    - task_count = 0 (not yet created)
    - message enqueued in runs.high_priority or runs.normal queue
    - started_at is set
  Allowed Actions:
    - worker picks up → RUNNING
    - cancel() → CANCELLED (refund credits)
    - timeout after 24h → FAILED (refund credits)
  Timeout: 24 hours (configurable)

State: RUNNING
  Meaning: Worker executing run, agents/tasks spawned
  Invariants:
    - credits_reserved > 0
    - agent_count ≥ 1
    - task_count ≥ 0
    - at least one agent in PENDING or RUNNING state
    - no agent in COMPLETED state (yet)
    - last_heartbeat within 60 seconds
  Allowed Actions:
    - agent completes → check if all done → COMPLETED
    - agent fails (retryable) → retry agent
    - agent fails (non-retryable) → FAILED
    - pause() → PAUSED
    - cancel() → CANCELLED
    - timeout after 24h → FAILED (refund remaining credits)
  Timeout: 24 hours (configurable)
  Heartbeat: Worker must send heartbeat every 60s or run transitions to FAILED

State: PAUSED
  Meaning: Run suspended, agents paused mid-execution
  Invariants:
    - all agents in PAUSED state
    - credits_reserved > 0
    - agent state preserved (can resume)
    - no new work items enqueued
  Allowed Actions:
    - resume() → RESUMING
    - cancel() → CANCELLED
    - timeout after 7 days → CANCELLED (refund credits)
  Timeout: 7 days (configurable)

State: RESUMING
  Meaning: Run resuming from pause, re-enqueuing agents
  Invariants:
    - all agents transitioning from PAUSED → PENDING
    - credits_reserved > 0
    - agent state preserved
  Allowed Actions:
    - agents re-enqueued → RUNNING
    - error during resume → FAILED
  Timeout: 5 minutes (must complete resume or fail)

State: COMPLETED
  Meaning: Run finished successfully
  Invariants:
    - all agents in COMPLETED state
    - credits_charged ≤ credits_reserved
    - completed_at is set
    - duration_ms is set
    - all artifacts finalized
  Allowed Actions:
    - None (terminal state)
  Timeout: N/A (terminal)

State: FAILED
  Meaning: Run finished with error (non-retryable)
  Invariants:
    - at least one agent in FAILED state
    - last_error is set
    - credits_charged ≤ credits_reserved
    - remaining credits refunded
    - completed_at is set
    - duration_ms is set
  Allowed Actions:
    - retry() → RETRYING (if attempt_number < max_attempts)
    - None (terminal if max attempts exceeded)
  Timeout: N/A (terminal)

State: CANCELLED
  Meaning: Run cancelled by user or timeout
  Invariants:
    - all agents terminated
    - all remaining credits refunded
    - cancelled_at is set
    - duration_ms is set
  Allowed Actions:
    - None (terminal state)
  Timeout: N/A (terminal)

State: RETRYING
  Meaning: Run retrying after failure
  Invariants:
    - attempt_number incremented
    - credits_reserved reset for new attempt
    - agent_count reset to 0
    - all previous agent/task/step records preserved (for audit)
    - new run_attempt record created
  Allowed Actions:
    - worker picks up → PENDING
    - timeout after 24h → FAILED
  Timeout: 24 hours (same as PENDING)
```

### 1.2 State Transition Diagram

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
                    │   PENDING   │◄──────────────┐
                    └──────┬──────┘               │
                           │ worker picks up     │ resume()
                           ▼                     │
                    ┌─────────────┐              │
            ┌──────►│   RUNNING   │──────────────┼────────────┐
            │       └──────┬──────┘              │            │
            │              │                     │            │
            │              ├─ all agents done ───┼─► COMPLETED
            │              │                     │
            │              ├─ retryable error ───┼─► retry agent
            │              │                     │
            │              ├─ pause() ──────────►│ PAUSED
            │              │                     │    │
            │              ├─ cancel() ─────────►│ CANCELLED
            │              │                     │
            │              └─ timeout ──────────►│ FAILED
            │                                    │
            │       ┌─────────────┐              │
            └───────┤  RETRYING   │◄─────────────┘
                    └─────────────┘
                           │
                           └─► PENDING
```

### 1.3 Transition Rules (Strict)

**CREATED → PENDING:**
- Precondition: `start()` called
- Action: Reserve credits, enqueue work message
- Postcondition: `credits_reserved > 0`, message in queue
- Idempotency: If already PENDING, return existing run_id

**PENDING → RUNNING:**
- Precondition: Worker picks up message
- Action: Spawn initial agents, set `started_at`
- Postcondition: `agent_count ≥ 1`, all agents PENDING
- Idempotency: If already RUNNING, skip (worker sees existing agents)

**RUNNING → COMPLETED:**
- Precondition: All agents COMPLETED, no errors
- Action: Charge credits, finalize artifacts
- Postcondition: `credits_charged > 0`, `completed_at` set
- Idempotency: If already COMPLETED, return existing result

**RUNNING → FAILED:**
- Precondition: Non-retryable error OR max retries exceeded
- Action: Refund remaining credits, set `last_error`
- Postcondition: `credits_charged + refund = credits_reserved`, `last_error` set
- Idempotency: If already FAILED, return existing error

**RUNNING → PAUSED:**
- Precondition: `pause()` called
- Action: Pause all agents, stop enqueueing new work
- Postcondition: All agents PAUSED, no new work items
- Idempotency: If already PAUSED, no-op

**PAUSED → RESUMING:**
- Precondition: `resume()` called
- Action: Transition agents PAUSED → PENDING, re-enqueue
- Postcondition: All agents PENDING, messages in queue
- Idempotency: If already RESUMING, wait for completion

**RESUMING → RUNNING:**
- Precondition: All agents re-enqueued successfully
- Action: Resume execution
- Postcondition: Agents executing normally
- Idempotency: If already RUNNING, no-op

**RUNNING → CANCELLED:**
- Precondition: `cancel()` called
- Action: Terminate all agents, refund all credits
- Postcondition: All agents terminated, `credits_charged + refund = credits_reserved`
- Idempotency: If already CANCELLED, no-op

**FAILED → RETRYING:**
- Precondition: `retry()` called AND `attempt_number < max_attempts`
- Action: Increment attempt, reserve new credits, create new run_attempt
- Postcondition: `attempt_number++`, `credits_reserved` reset, `run_attempt` record created
- Idempotency: If already RETRYING, return existing attempt_number

**RETRYING → PENDING:**
- Precondition: Worker picks up retry message
- Action: Enqueue work for new attempt
- Postcondition: Agents PENDING for new attempt
- Idempotency: If already PENDING, skip

---

## 2. Control Loop Invariants

### 2.1 Primary Invariants (Always True)

These invariants must hold at every state transition. Violation is a critical bug.

**Invariant 1: Credit Conservation**
```
At any point in time:
  credits_reserved ≥ credits_charged
  credits_reserved ≥ 0
  credits_charged ≥ 0
  
On completion:
  credits_charged + credits_refunded = credits_reserved
  
Violation: Double-charging or credit loss
```

**Invariant 2: Agent Hierarchy**
```
For each run:
  agent_count = count(agents where run_id = this.run_id)
  
For each agent:
  task_count = count(tasks where agent_id = this.agent_id)
  
For each task:
  step_count = count(steps where task_id = this.task_id)
  
No agent exists without a run.
No task exists without an agent.
No step exists without a task.

Violation: Orphaned records
```

**Invariant 3: State Consistency**
```
If run.status = RUNNING:
  ∃ agent where agent.status ∈ {PENDING, RUNNING}
  
If run.status = COMPLETED:
  ∀ agent: agent.status = COMPLETED
  
If run.status = FAILED:
  ∃ agent where agent.status = FAILED
  
If run.status = CANCELLED:
  ∀ agent: agent.status ∈ {CANCELLED, COMPLETED, FAILED}
  
Violation: Inconsistent state
```

**Invariant 4: Artifact Ownership**
```
For each artifact:
  artifact.run_id must reference an existing run
  artifact.s3_key must be unique (no duplicates)
  artifact.created_at must be ≤ now()
  
If run.status = COMPLETED:
  ∀ artifact: artifact.expires_at is set
  
Violation: Orphaned or duplicate artifacts
```

**Invariant 5: Idempotency Key Uniqueness**
```
For each API call with idempotency_key:
  idempotency_key must be unique per (org_id, endpoint, 24h window)
  
If idempotency_key seen before:
  return cached response (exact same result)
  
Violation: Non-idempotent behavior
```

### 2.2 Derived Invariants (Computed from Primary)

**Invariant 6: Billing Ledger Append-Only**
```
billing_ledger table is append-only:
  No UPDATE or DELETE operations allowed
  Only INSERT allowed
  
For each billing_ledger entry:
  entry.created_at ≤ now()
  entry.amount > 0
  entry.org_id references existing org
  
Violation: Audit trail corruption
```

**Invariant 7: Heartbeat Freshness**
```
If run.status = RUNNING:
  run.last_heartbeat ≤ now()
  now() - run.last_heartbeat ≤ 60 seconds
  
If now() - run.last_heartbeat > 60 seconds:
  run transitions to FAILED
  
Violation: Zombie runs
```

**Invariant 8: Artifact Expiry**
```
If run.status = COMPLETED:
  ∀ artifact: artifact.expires_at = completed_at + 30 days
  
If now() > artifact.expires_at:
  artifact is deleted from S3
  artifact record marked as deleted
  
Violation: Artifact leakage
```

---

## 3. Partial Failure Propagation

### 3.1 Step-Level Failures

A **step** is the atomic unit of work (tool invocation).

```
Step Failure Modes:
  1. Tool timeout (> 30s)
  2. Tool crash (exit code != 0)
  3. Tool output invalid (unparseable JSON)
  4. Tool rate-limited (HTTP 429)
  5. Tool dependency missing (import error)
  6. Tool memory exceeded (OOM)
```

**Step-Level Retry Logic:**

```python
class StepExecutor:
    def execute_step(self, step_id: str, max_attempts: int = 3):
        """Execute step with retries"""
        
        for attempt in range(max_attempts):
            try:
                # Execute tool
                output = await self.run_tool(step_id)
                
                # Validate output
                if not self.validate_output(output):
                    raise InvalidOutputError()
                
                # Mark step complete
                await db.update_step(step_id, status='completed', output=output)
                return output
                
            except RetryableError as e:
                # Retryable: timeout, rate limit, transient error
                if attempt < max_attempts - 1:
                    delay_ms = 100 * (2 ** attempt)  # Exponential backoff
                    await asyncio.sleep(delay_ms / 1000)
                    continue
                else:
                    # Max retries exceeded
                    await db.update_step(step_id, status='failed', error=str(e))
                    raise
                    
            except NonRetryableError as e:
                # Non-retryable: invalid input, auth error, not found
                await db.update_step(step_id, status='failed', error=str(e))
                raise
```

**Step Failure → Task Failure:**

```
If step.status = FAILED:
  - Check task.failure_mode
  
  If task.failure_mode = 'fail-fast':
    → Task transitions to FAILED immediately
    → Task propagates failure to agent
    
  If task.failure_mode = 'continue':
    → Task skips this step, continues to next
    → If all steps skipped: Task status = SKIPPED
    → Task does NOT propagate failure
    
  If task.failure_mode = 'retry':
    → Task retries entire task (all steps from beginning)
    → Max task retries = 3
```

### 3.2 Task-Level Failures

A **task** is a sequence of steps (usually sequential).

```
Task Failure Modes:
  1. Step failed (non-retryable)
  2. Task timeout (> 1h)
  3. Task cancelled by user
  4. All steps skipped (no work done)
```

**Task Failure → Agent Failure:**

```
If task.status = FAILED:
  - Check agent.failure_mode
  
  If agent.failure_mode = 'fail-fast':
    → Agent transitions to FAILED immediately
    → Agent propagates failure to run
    
  If agent.failure_mode = 'continue':
    → Agent skips this task, continues to next
    → If all tasks skipped: Agent status = SKIPPED
    → Agent does NOT propagate failure
    
  If agent.failure_mode = 'retry':
    → Agent retries entire agent (all tasks from beginning)
    → Max agent retries = 3
```

### 3.3 Agent-Level Failures

An **agent** is a sequence of tasks (usually parallel-decomposable).

```
Agent Failure Modes:
  1. Task failed (non-retryable)
  2. Agent timeout (> 6h)
  3. Agent cancelled by user
  4. Agent context window exceeded
```

**Agent Failure → Run Failure:**

```
If agent.status = FAILED:
  - Check run.failure_mode
  
  If run.failure_mode = 'fail-fast':
    → Run transitions to FAILED immediately
    → Refund remaining credits
    → Mark run as failed
    
  If run.failure_mode = 'continue':
    → Run skips this agent, continues to next
    → If all agents skipped: Run status = SKIPPED
    → Run does NOT propagate failure
    → Continue with other agents
    
  If run.failure_mode = 'retry':
    → Run retries entire run (all agents from beginning)
    → Max run retries = 3
    → Reserve new credits for retry
```

### 3.4 Failure Propagation Rules

**Rule 1: Fail-Fast (Default)**
```
Step fails → Task fails → Agent fails → Run fails
Propagation: Immediate
Refund: All remaining credits
```

**Rule 2: Continue (Partial Failure OK)**
```
Step fails → Task skipped → Agent continues
Propagation: Skipped, not failed
Refund: None (charged for skipped work)
```

**Rule 3: Retry (Transient Errors)**
```
Step fails (retryable) → Retry step
Task fails (retryable) → Retry task
Agent fails (retryable) → Retry agent
Run fails (retryable) → Retry run

Max retries: 3 per level
Backoff: Exponential (100ms, 200ms, 400ms, ...)
```

---

## 4. Idempotency Guarantees

### 4.1 Idempotency Key Semantics

**Definition:** An idempotency key is a client-provided UUID that ensures exactly-once semantics for a request.

```
POST /api/v1/runs

Headers:
  Idempotency-Key: idem_550e8400-e29b-41d4-a716-446655440000

Request:
{
  "name": "Research AI market trends",
  "task": "..."
}

Response (201 Created):
{
  "id": "run_123456789",
  "status": "created",
  ...
}

# Retry with same idempotency key
POST /api/v1/runs

Headers:
  Idempotency-Key: idem_550e8400-e29b-41d4-a716-446655440000

Response (200 OK):  # Same response, no side effects
{
  "id": "run_123456789",
  "status": "created",
  ...
}
```

**Idempotency Key Storage:**

```sql
CREATE TABLE idempotency_cache (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,  -- SHA256 of request body
  response_body JSONB NOT NULL,
  response_status INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  
  UNIQUE INDEX idx_idem_key (org_id, idempotency_key, endpoint)
);
```

**Idempotency Implementation:**

```python
class IdempotencyMiddleware:
    async def process_request(self, request: Request) -> Response:
        """Check idempotency cache before processing"""
        
        idempotency_key = request.headers.get('Idempotency-Key')
        
        if not idempotency_key:
            # No idempotency key, process normally (not idempotent)
            return await self.next(request)
        
        # Check cache
        cached = await db.query(
            "SELECT response_body, response_status FROM idempotency_cache "
            "WHERE org_id = %s AND idempotency_key = %s AND endpoint = %s",
            [request.org_id, idempotency_key, request.path]
        )
        
        if cached:
            # Return cached response
            return Response(
                body=cached['response_body'],
                status=cached['response_status']
            )
        
        # Process request
        response = await self.next(request)
        
        # Cache response
        await db.insert('idempotency_cache', {
            'org_id': request.org_id,
            'idempotency_key': idempotency_key,
            'endpoint': request.path,
            'request_hash': sha256(request.body),
            'response_body': response.body,
            'response_status': response.status,
            'expires_at': datetime.utcnow() + timedelta(hours=24)
        })
        
        return response
```

### 4.2 Queue-Level Idempotency

**Problem:** Message may be enqueued multiple times due to network retries.

**Solution:** Message ID + deduplication window

```python
class QueueDeduplicator:
    async def enqueue(self, message: Message) -> str:
        """Enqueue message with deduplication"""
        
        message_id = message.message_id
        
        # Check if already enqueued
        existing = await redis.get(f"queue:dedup:{message_id}")
        
        if existing:
            # Already enqueued, return existing
            return existing
        
        # Enqueue message
        queue_position = await queue.enqueue(message)
        
        # Store dedup key (24h TTL)
        await redis.setex(
            f"queue:dedup:{message_id}",
            86400,
            queue_position
        )
        
        return queue_position
```

### 4.3 Worker-Level Idempotency

**Problem:** Worker may crash after processing but before acknowledging message.

**Solution:** Exactly-once processing with state verification

```python
class WorkerExecutor:
    async def execute_work_item(self, work_item: WorkItem):
        """Execute work item with exactly-once semantics"""
        
        work_id = work_item.work_id
        
        # 1. Check if already processed
        existing_result = await db.query(
            "SELECT result FROM work_results WHERE work_id = %s",
            [work_id]
        )
        
        if existing_result:
            # Already processed, return cached result
            return existing_result['result']
        
        # 2. Mark as processing (atomic)
        await db.insert('work_results', {
            'work_id': work_id,
            'status': 'processing',
            'started_at': datetime.utcnow()
        })
        
        try:
            # 3. Process work
            result = await self.process(work_item)
            
            # 4. Store result (atomic)
            await db.update_work_result(work_id, {
                'status': 'completed',
                'result': result,
                'completed_at': datetime.utcnow()
            })
            
            # 5. Acknowledge message
            await queue.ack(work_item.message_id)
            
            return result
            
        except Exception as e:
            # 6. Mark as failed
            await db.update_work_result(work_id, {
                'status': 'failed',
                'error': str(e),
                'completed_at': datetime.utcnow()
            })
            
            # 7. Nack message (will retry)
            await queue.nack(work_item.message_id)
            
            raise
```

### 4.4 Billing-Level Idempotency

**Problem:** Charge may be applied multiple times if billing service crashes.

**Solution:** Append-only ledger + idempotency key

```python
class BillingEngine:
    async def charge_run(self, run_id: str, amount: Decimal, idempotency_key: str):
        """Charge credits with exactly-once semantics"""
        
        # 1. Check if already charged
        existing_charge = await db.query(
            "SELECT id FROM billing_ledger "
            "WHERE run_id = %s AND idempotency_key = %s AND transaction_type = 'charge'",
            [run_id, idempotency_key]
        )
        
        if existing_charge:
            # Already charged, skip
            return
        
        # 2. Verify balance
        balance = await self.get_balance(run_id)
        if balance.available < amount:
            raise InsufficientCreditsError()
        
        # 3. Create ledger entry (atomic)
        await db.insert('billing_ledger', {
            'id': uuid.uuid4(),
            'run_id': run_id,
            'transaction_type': 'charge',
            'amount': amount,
            'idempotency_key': idempotency_key,
            'created_at': datetime.utcnow()
        })
        
        # 4. Update balance (atomic)
        await db.update_credit_balance(
            run_id,
            balance=balance.balance - amount
        )
```

---

## 5. Sequential vs Parallel Execution

### 5.1 Strictly Sequential Operations

These operations **must** be sequential (no parallelism):

**1. Run State Transitions**
```
Reason: State machine requires ordering
  CREATED → PENDING → RUNNING → COMPLETED
  
Cannot skip: CREATED → RUNNING (must go through PENDING)
Cannot parallelize: Multiple state changes to same run

Implementation:
  Use database row-level lock (SELECT FOR UPDATE)
  
  BEGIN TRANSACTION;
  SELECT * FROM runs WHERE run_id = %s FOR UPDATE;
  -- Now we have exclusive lock
  UPDATE runs SET status = 'pending' WHERE run_id = %s;
  COMMIT;
```

**2. Billing Ledger Entries**
```
Reason: Append-only ledger requires strict ordering
  
Cannot parallelize: Multiple charges to same org
Cannot reorder: Ledger entries must be in chronological order

Implementation:
  Use database transaction isolation level SERIALIZABLE
  
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  BEGIN TRANSACTION;
  INSERT INTO billing_ledger (...) VALUES (...);
  UPDATE credit_balances SET balance = balance - %s WHERE org_id = %s;
  COMMIT;
```

**3. Agent Spawning**
```
Reason: Must ensure agent_count is accurate
  
Cannot parallelize: Multiple agents spawned for same run
Cannot reorder: Agents must be spawned in sequence

Implementation:
  Use database row-level lock
  
  BEGIN TRANSACTION;
  SELECT * FROM runs WHERE run_id = %s FOR UPDATE;
  INSERT INTO agents (...) VALUES (...);
  UPDATE runs SET agent_count = agent_count + 1 WHERE run_id = %s;
  COMMIT;
```

### 5.2 Opportunistically Parallel Operations

These operations **can** be parallel (with constraints):

**1. Agent Execution**
```
Parallelism: Up to max_agents (default 10)
Constraint: Agents must not share state
Constraint: Agents must not depend on each other

Implementation:
  Spawn agents in parallel:
  
  agents = []
  for subtask in subtasks:
    agent = await spawn_agent(run_id, subtask)
    agents.append(agent)
  
  # Wait for all agents to complete
  results = await asyncio.gather(*[agent.wait() for agent in agents])
```

**2. Task Execution (within Agent)**
```
Parallelism: Depends on task.parallelism_mode
  - 'sequential': Execute tasks one by one
  - 'parallel': Execute independent tasks in parallel
  - 'dag': Execute tasks respecting DAG dependencies

Constraint: Tasks with dependencies must respect ordering
Constraint: Tasks must not exceed max_concurrent_tasks per agent (default 5)

Implementation:
  # Sequential mode
  for task in tasks:
    await execute_task(task)
  
  # Parallel mode
  results = await asyncio.gather(*[execute_task(task) for task in tasks])
  
  # DAG mode
  completed = {}
  for task in topological_sort(tasks):
    if all(dep in completed for dep in task.dependencies):
      await execute_task(task)
      completed[task.id] = True
```

**3. Step Execution (within Task)**
```
Parallelism: Depends on step.parallelism_mode
  - 'sequential': Execute steps one by one (default)
  - 'parallel': Execute independent steps in parallel

Constraint: Steps with dependencies must respect ordering
Constraint: Steps must not exceed max_concurrent_steps per task (default 3)

Implementation:
  # Sequential mode
  for step in steps:
    await execute_step(step)
  
  # Parallel mode
  results = await asyncio.gather(*[execute_step(step) for step in steps])
```

**4. Artifact Uploads**
```
Parallelism: Up to 10 concurrent uploads per run
Constraint: Artifact names must be unique per run
Constraint: Total artifact size must not exceed 10GB per run

Implementation:
  semaphore = asyncio.Semaphore(10)
  
  async def upload_artifact(artifact):
    async with semaphore:
      await s3.put_object(artifact)
  
  await asyncio.gather(*[upload_artifact(art) for art in artifacts])
```

---

## 6. Retry, Escalation, Abort, Re-plan Conditions

### 6.1 Retry Conditions

**Retry Decision Tree:**

```
if error is RetryableError:
  if attempt_number < max_attempts:
    if backoff_delay < max_delay:
      → RETRY with exponential backoff
    else:
      → ESCALATE (backoff exceeded)
  else:
    → ABORT (max attempts exceeded)
else:
  → ABORT (non-retryable error)
```

**Retryable Errors:**

```python
RETRYABLE_ERRORS = {
    # Network errors
    'ConnectionError': 'Transient network issue',
    'TimeoutError': 'Request timeout (< 30s)',
    'HTTPError(429)': 'Rate limited',
    'HTTPError(502)': 'Bad gateway',
    'HTTPError(503)': 'Service unavailable',
    'HTTPError(504)': 'Gateway timeout',
    
    # Resource errors
    'MemoryError': 'OOM (may recover)',
    'DiskError': 'Disk full (may recover)',
    
    # Transient LLM errors
    'LLMRateLimitError': 'LLM rate limit',
    'LLMTimeoutError': 'LLM timeout',
    'LLMServiceError': 'LLM service error',
}

NON_RETRYABLE_ERRORS = {
    # Input errors
    'ValueError': 'Invalid input',
    'TypeError': 'Type mismatch',
    'SchemaValidationError': 'Schema validation failed',
    
    # Auth errors
    'AuthenticationError': 'Invalid credentials',
    'AuthorizationError': 'Permission denied',
    'TokenExpiredError': 'Token expired (refresh failed)',
    
    # Not found errors
    'NotFoundError': 'Resource not found',
    'FileNotFoundError': 'File not found',
    
    # Business logic errors
    'InsufficientCreditsError': 'Insufficient credits',
    'QuotaExceededError': 'Quota exceeded',
    'FeatureNotEnabledError': 'Feature not enabled',
}
```

**Retry Logic:**

```python
class RetryStrategy:
    def __init__(self, max_attempts: int = 3, base_delay_ms: int = 100):
        self.max_attempts = max_attempts
        self.base_delay_ms = base_delay_ms
        self.max_delay_ms = 30000  # 30 seconds
    
    async def execute_with_retry(self, operation, *args, **kwargs):
        """Execute operation with retries"""
        
        last_error = None
        
        for attempt in range(self.max_attempts):
            try:
                return await operation(*args, **kwargs)
                
            except Exception as e:
                last_error = e
                
                # Check if retryable
                if not self.is_retryable(e):
                    raise  # Non-retryable, abort immediately
                
                # Check if max attempts exceeded
                if attempt >= self.max_attempts - 1:
                    raise  # Max attempts exceeded, abort
                
                # Calculate backoff
                delay_ms = self.calculate_backoff(attempt)
                
                # Log retry
                logger.warning(
                    f"Attempt {attempt + 1} failed: {e}. "
                    f"Retrying in {delay_ms}ms..."
                )
                
                # Wait before retry
                await asyncio.sleep(delay_ms / 1000)
        
        raise last_error
    
    def calculate_backoff(self, attempt: int) -> int:
        """Calculate exponential backoff with jitter"""
        
        # Exponential: 100ms, 200ms, 400ms, 800ms, ...
        delay = self.base_delay_ms * (2 ** attempt)
        
        # Cap at max delay
        delay = min(delay, self.max_delay_ms)
        
        # Add jitter: ±10%
        jitter = delay * 0.1 * (2 * random.random() - 1)
        
        return int(delay + jitter)
    
    def is_retryable(self, error: Exception) -> bool:
        """Check if error is retryable"""
        
        error_name = error.__class__.__name__
        
        return error_name in RETRYABLE_ERRORS
```

### 6.2 Escalation Conditions

**Escalation Decision Tree:**

```
if error is RetryableError:
  if attempt_number < max_attempts:
    if backoff_delay > max_delay:
      → ESCALATE (backoff exceeded, may indicate systemic issue)
    elif error_count_in_window > threshold:
      → ESCALATE (too many errors, may indicate systemic issue)
    elif error_rate > threshold:
      → ESCALATE (error rate too high, may indicate systemic issue)
    else:
      → RETRY
  else:
    → ESCALATE (max attempts exceeded, escalate to human)
else:
  → ABORT (non-retryable error)
```

**Escalation Triggers:**

```python
class EscalationManager:
    def __init__(self):
        self.error_window = 300  # 5 minutes
        self.error_threshold = 5  # 5 errors in window
        self.error_rate_threshold = 0.5  # 50% error rate
    
    async def should_escalate(self, run_id: str, error: Exception) -> bool:
        """Check if error should be escalated"""
        
        # 1. Check error count in window
        error_count = await self.get_error_count(run_id, self.error_window)
        if error_count > self.error_threshold:
            logger.error(
                f"Run {run_id} escalated: "
                f"{error_count} errors in {self.error_window}s"
            )
            return True
        
        # 2. Check error rate
        total_count = await self.get_total_count(run_id, self.error_window)
        if total_count > 0:
            error_rate = error_count / total_count
            if error_rate > self.error_rate_threshold:
                logger.error(
                    f"Run {run_id} escalated: "
                    f"error rate {error_rate:.1%} > {self.error_rate_threshold:.1%}"
                )
                return True
        
        return False
    
    async def escalate(self, run_id: str, error: Exception):
        """Escalate error to human"""
        
        # 1. Create escalation ticket
        ticket = await create_escalation_ticket(
            run_id=run_id,
            error=str(error),
            severity='high'
        )
        
        # 2. Notify on-call engineer
        await notify_oncall(
            message=f"Escalation ticket {ticket.id} for run {run_id}",
            severity='high'
        )
        
        # 3. Mark run as escalated
        await db.update_run(run_id, status='escalated', escalation_ticket_id=ticket.id)
```

### 6.3 Abort Conditions

**Abort Decision Tree:**

```
if error is NonRetryableError:
  → ABORT (non-retryable error)
elif attempt_number >= max_attempts:
  → ABORT (max attempts exceeded)
elif credits_available < cost_of_next_attempt:
  → ABORT (insufficient credits)
elif run.cancelled:
  → ABORT (user cancelled)
elif run.timeout_exceeded:
  → ABORT (timeout exceeded)
else:
  → RETRY or ESCALATE
```

**Abort Triggers:**

```python
class AbortManager:
    async def should_abort(self, run_id: str, error: Exception) -> bool:
        """Check if run should be aborted"""
        
        # 1. Check if non-retryable error
        if not self.is_retryable(error):
            logger.error(f"Run {run_id} aborted: non-retryable error {error}")
            return True
        
        # 2. Check if max attempts exceeded
        run = await db.get_run(run_id)
        if run.attempt_number >= run.max_attempts:
            logger.error(f"Run {run_id} aborted: max attempts exceeded")
            return True
        
        # 3. Check if insufficient credits
        balance = await billing_engine.get_balance(run.org_id)
        if balance.available < 10:  # Minimum cost per attempt
            logger.error(f"Run {run_id} aborted: insufficient credits")
            return True
        
        # 4. Check if cancelled
        if run.status == 'cancelled':
            logger.error(f"Run {run_id} aborted: user cancelled")
            return True
        
        # 5. Check if timeout exceeded
        if datetime.utcnow() - run.started_at > timedelta(hours=24):
            logger.error(f"Run {run_id} aborted: timeout exceeded")
            return True
        
        return False
    
    async def abort(self, run_id: str, reason: str):
        """Abort run"""
        
        # 1. Terminate all agents
        agents = await db.get_agents(run_id)
        for agent in agents:
            await agent_executor.terminate(agent.id)
        
        # 2. Refund remaining credits
        run = await db.get_run(run_id)
        refund = run.credits_reserved - run.credits_charged
        if refund > 0:
            await billing_engine.refund(run.org_id, refund, run_id)
        
        # 3. Mark run as failed
        await db.update_run(run_id, {
            'status': 'failed',
            'last_error': reason,
            'completed_at': datetime.utcnow()
        })
```

### 6.4 Re-plan Conditions

**Re-plan Decision Tree:**

```
if run.status = RUNNING:
  if significant_failure_detected:
    if can_recover_with_new_plan:
      → RE-PLAN (decompose differently)
    else:
      → ABORT (cannot recover)
  else:
    → CONTINUE (no re-plan needed)
```

**Re-plan Triggers:**

```python
class ReplanManager:
    async def should_replan(self, run_id: str) -> bool:
        """Check if run should be re-planned"""
        
        run = await db.get_run(run_id)
        
        # 1. Check if too many agent failures
        failed_agents = await db.query(
            "SELECT COUNT(*) as count FROM agents "
            "WHERE run_id = %s AND status = 'failed'",
            [run_id]
        )
        
        if failed_agents[0]['count'] > run.agent_count * 0.5:
            # More than 50% of agents failed
            logger.warning(f"Run {run_id}: {failed_agents[0]['count']} agents failed, re-planning...")
            return True
        
        # 2. Check if too many task failures
        failed_tasks = await db.query(
            "SELECT COUNT(*) as count FROM tasks "
            "WHERE run_id IN (SELECT id FROM agents WHERE run_id = %s) "
            "AND status = 'failed'",
            [run_id]
        )
        
        if failed_tasks[0]['count'] > 10:
            # More than 10 tasks failed
            logger.warning(f"Run {run_id}: {failed_tasks[0]['count']} tasks failed, re-planning...")
            return True
        
        return False
    
    async def replan(self, run_id: str):
        """Re-plan run with different decomposition"""
        
        run = await db.get_run(run_id)
        
        # 1. Analyze failures
        failed_agents = await db.query(
            "SELECT * FROM agents WHERE run_id = %s AND status = 'failed'",
            [run_id]
        )
        
        failure_analysis = await self.analyze_failures(failed_agents)
        
        # 2. Generate new decomposition
        new_decomposition = await self.generate_new_decomposition(
            task=run.task,
            previous_decomposition=run.context['decomposition'],
            failure_analysis=failure_analysis,
            max_agents=run.max_agents
        )
        
        # 3. Update run context
        await db.update_run(run_id, {
            'context': {
                **run.context,
                'decomposition': new_decomposition,
                'replan_count': run.context.get('replan_count', 0) + 1
            }
        })
        
        # 4. Spawn new agents
        for i, subtask in enumerate(new_decomposition):
            agent = await db.insert('agents', {
                'run_id': run_id,
                'subtask': subtask,
                'sequence_number': i,
                'status': 'pending'
            })
            
            await queue.enqueue('agents.work', {
                'agent_id': agent.id,
                'run_id': run_id,
                'subtask': subtask
            })
```

---

## 7. Implementation Assumptions

### 7.1 Production System Assumptions

**Assumption 1: Database Transactions**
```
We assume PostgreSQL with ACID transactions.
Isolation level: READ COMMITTED (default)
For critical operations: SERIALIZABLE

If using different DB:
  - Ensure row-level locking for state transitions
  - Ensure atomic updates for credit balance
  - Ensure append-only semantics for billing ledger
```

**Assumption 2: Message Queue**
```
We assume RabbitMQ with:
  - Persistent messages (durable queues)
  - Manual acknowledgment (not auto-ack)
  - Dead-letter exchange for failed messages
  - Priority queues support

If using different queue:
  - Ensure at-least-once delivery semantics
  - Ensure message persistence
  - Ensure manual acknowledgment support
  - Ensure deduplication mechanism
```

**Assumption 3: Object Storage**
```
We assume AWS S3 with:
  - Versioning enabled
  - Server-side encryption
  - Lifecycle policies for expiry
  - Public read access (or CloudFront)

If using different storage:
  - Ensure versioning for audit trail
  - Ensure encryption at rest
  - Ensure automatic expiry mechanism
  - Ensure public URL generation
```

**Assumption 4: LLM Service**
```
We assume OpenAI API with:
  - Streaming support
  - Function calling support
  - JSON mode support
  - Rate limiting (429 errors)

If using different LLM:
  - Ensure streaming support for long outputs
  - Ensure tool/function calling support
  - Ensure structured output support
  - Ensure rate limit handling
```

**Assumption 5: Monitoring**
```
We assume Prometheus + Grafana with:
  - Custom metrics collection
  - Alerting rules
  - Dashboard support
  - 30-day retention

If using different monitoring:
  - Ensure custom metrics support
  - Ensure alerting support
  - Ensure long-term retention
```

### 7.2 Operational Assumptions

**Assumption 6: Worker Deployment**
```
We assume Kubernetes with:
  - Pod autoscaling (HPA)
  - Resource limits (CPU, memory)
  - Health checks (liveness, readiness)
  - Graceful shutdown (30s termination grace)

If using different deployment:
  - Ensure autoscaling mechanism
  - Ensure resource isolation
  - Ensure health checks
  - Ensure graceful shutdown
```

**Assumption 7: Logging**
```
We assume ELK stack with:
  - Structured JSON logging
  - 7-day retention (searchable)
  - 30-day retention (archived)
  - Real-time log streaming

If using different logging:
  - Ensure structured logging
  - Ensure long-term retention
  - Ensure real-time access
```

**Assumption 8: Network**
```
We assume:
  - Private network for internal communication
  - Public network for external APIs
  - Load balancer for API gateway
  - VPN for admin access

If using different network:
  - Ensure network isolation
  - Ensure load balancing
  - Ensure secure admin access
```

---

## 8. Edge Cases and Gotchas

### 8.1 Edge Case: Concurrent State Transitions

**Scenario:** Two workers try to transition same run simultaneously

```
Worker 1: RUNNING → COMPLETED
Worker 2: RUNNING → FAILED

Both read run.status = RUNNING
Both try to update

Result: Race condition, inconsistent state
```

**Solution:** Database row-level lock

```python
async def transition_run_state(run_id: str, new_status: str):
    """Transition run state with locking"""
    
    async with db.transaction():
        # Acquire exclusive lock
        run = await db.query(
            "SELECT * FROM runs WHERE run_id = %s FOR UPDATE",
            [run_id]
        )
        
        # Verify current state
        if run['status'] not in ALLOWED_TRANSITIONS[new_status]:
            raise InvalidStateTransitionError()
        
        # Update state
        await db.update_run(run_id, {'status': new_status})
```

### 8.2 Edge Case: Partial Agent Completion

**Scenario:** 5 agents spawned, 3 complete, 2 still running, then worker crashes

```
Agents: [COMPLETED, COMPLETED, COMPLETED, RUNNING, RUNNING]
Worker crashes

Result: Run stuck in RUNNING state, agents never complete
```

**Solution:** Heartbeat + timeout

```python
async def monitor_run(run_id: str):
    """Monitor run for timeouts"""
    
    while True:
        run = await db.get_run(run_id)
        
        if run.status != 'running':
            break
        
        # Check heartbeat
        if datetime.utcnow() - run.last_heartbeat > timedelta(seconds=60):
            # Heartbeat expired, mark as failed
            await db.update_run(run_id, {
                'status': 'failed',
                'last_error': 'Worker heartbeat timeout'
            })
            break
        
        await asyncio.sleep(10)
```

### 8.3 Edge Case: Credit Reservation Failure

**Scenario:** Org has 100 credits, run tries to reserve 150 credits

```
Reserve 150 credits
  → Check balance: 100 < 150
  → Fail
  
Result: Run created but never started (CREATED state)
```

**Solution:** Validate credits before creating run

```python
async def create_run(org_id: str, task: str, max_tokens: int = 100000):
    """Create run with credit validation"""
    
    # 1. Estimate cost
    estimated_cost = max_tokens * 0.001  # $0.001 per 1000 tokens
    
    # 2. Check balance
    balance = await billing_engine.get_balance(org_id)
    if balance.available < estimated_cost:
        raise InsufficientCreditsError(
            f"Need {estimated_cost}, have {balance.available}"
        )
    
    # 3. Create run
    run = await db.insert('runs', {
        'org_id': org_id,
        'task': task,
        'status': 'created'
    })
    
    return run
```

### 8.4 Edge Case: Artifact Expiry Race

**Scenario:** Artifact expires while user is downloading it

```
Artifact created at 2026-01-15 12:00:00
Expires at 2026-02-14 12:00:00
User starts download at 2026-02-14 11:59:59
Artifact deleted at 2026-02-14 12:00:00 (during download)

Result: Download fails mid-stream
```

**Solution:** Extend expiry on access

```python
async def get_artifact(artifact_id: str):
    """Get artifact with expiry extension"""
    
    artifact = await db.get_artifact(artifact_id)
    
    # Extend expiry by 1 hour
    await db.update_artifact(artifact_id, {
        'expires_at': datetime.utcnow() + timedelta(hours=1)
    })
    
    # Return artifact
    return artifact
```

### 8.5 Edge Case: Idempotency Key Collision

**Scenario:** Two different requests with same idempotency key

```
Request 1: Create run "Research AI"
Request 2: Create run "Research ML"

Both have idempotency_key = "idem_123"

Result: Request 2 gets response from Request 1 (wrong result)
```

**Solution:** Include request hash in idempotency check

```python
async def process_request(request: Request):
    """Process request with idempotency"""
    
    idempotency_key = request.headers.get('Idempotency-Key')
    request_hash = sha256(request.body)
    
    # Check cache
    cached = await db.query(
        "SELECT response_body FROM idempotency_cache "
        "WHERE org_id = %s AND idempotency_key = %s AND request_hash = %s",
        [request.org_id, idempotency_key, request_hash]
    )
    
    if cached:
        return cached['response_body']
    
    # Process request
    response = await process_business_logic(request)
    
    # Cache response
    await db.insert('idempotency_cache', {
        'org_id': request.org_id,
        'idempotency_key': idempotency_key,
        'request_hash': request_hash,
        'response_body': response
    })
    
    return response
```

---

## 9. Operational Runbooks

### 9.1 Runbook: Stuck Run (RUNNING > 24h)

**Symptom:** Run in RUNNING state for > 24 hours

**Diagnosis:**
```bash
# 1. Check run status
SELECT * FROM runs WHERE run_id = 'run_123' AND status = 'running';

# 2. Check agents
SELECT * FROM agents WHERE run_id = 'run_123';

# 3. Check last heartbeat
SELECT * FROM runs WHERE run_id = 'run_123' AND last_heartbeat < NOW() - INTERVAL '60 seconds';

# 4. Check worker logs
kubectl logs -l app=worker -n agents --tail=100 | grep run_123
```

**Recovery:**
```bash
# 1. Terminate agents
UPDATE agents SET status = 'cancelled' WHERE run_id = 'run_123';

# 2. Refund credits
INSERT INTO billing_ledger (org_id, transaction_type, amount, run_id) 
VALUES (org_id, 'refund', credits_reserved - credits_charged, 'run_123');

# 3. Mark run as failed
UPDATE runs SET status = 'failed', last_error = 'Timeout' WHERE run_id = 'run_123';
```

### 9.2 Runbook: Double-Charge Bug

**Symptom:** Org charged twice for same run

**Diagnosis:**
```bash
# 1. Check billing ledger
SELECT * FROM billing_ledger WHERE run_id = 'run_123' AND transaction_type = 'charge';

# 2. Check run status
SELECT * FROM runs WHERE run_id = 'run_123';

# 3. Check idempotency keys
SELECT * FROM billing_ledger WHERE run_id = 'run_123';
```

**Recovery:**
```bash
# 1. Create refund entry
INSERT INTO billing_ledger (org_id, transaction_type, amount, run_id) 
VALUES (org_id, 'refund', duplicate_charge_amount, 'run_123');

# 2. Update balance
UPDATE credit_balances SET balance = balance + duplicate_charge_amount WHERE org_id = org_id;

# 3. Notify user
Send email: "We detected a duplicate charge and have refunded ${amount}"
```

---

## 10. Testing Strategy

### 10.1 State Machine Tests

```python
def test_state_transitions():
    """Test all valid state transitions"""
    
    # CREATED → PENDING
    run = create_run()
    assert run.status == 'created'
    run.start()
    assert run.status == 'pending'
    
    # PENDING → RUNNING
    worker.execute(run)
    assert run.status == 'running'
    
    # RUNNING → COMPLETED
    complete_all_agents(run)
    assert run.status == 'completed'
    
    # Invalid transition
    with pytest.raises(InvalidStateTransitionError):
        run.pause()  # Cannot pause completed run
```

### 10.2 Idempotency Tests

```python
def test_idempotency():
    """Test idempotent requests"""
    
    # First request
    response1 = api.create_run(
        idempotency_key='idem_123',
        name='Research AI'
    )
    
    # Second request (same key, same body)
    response2 = api.create_run(
        idempotency_key='idem_123',
        name='Research AI'
    )
    
    # Should return same response
    assert response1 == response2
    assert response1.run_id == response2.run_id
```

### 10.3 Failure Propagation Tests

```python
def test_failure_propagation():
    """Test failure propagation through hierarchy"""
    
    # Step fails
    step = create_step()
    step.fail(error='Tool timeout')
    
    # Task should fail
    task = step.task
    assert task.status == 'failed'
    
    # Agent should fail
    agent = task.agent
    assert agent.status == 'failed'
    
    # Run should fail
    run = agent.run
    assert run.status == 'failed'
```

### 10.4 Billing Tests

```python
def test_exactly_once_billing():
    """Test exactly-once billing semantics"""
    
    # Charge once
    billing_engine.charge_run(
        run_id='run_123',
        amount=50.0,
        idempotency_key='idem_charge_123'
    )
    
    # Check balance
    balance1 = billing_engine.get_balance(org_id)
    
    # Charge again (same idempotency key)
    billing_engine.charge_run(
        run_id='run_123',
        amount=50.0,
        idempotency_key='idem_charge_123'
    )
    
    # Balance should be same (not double-charged)
    balance2 = billing_engine.get_balance(org_id)
    assert balance1 == balance2
```

---

## Conclusion

This handoff document specifies the exact control loop invariants, state machines, and operational details for the run orchestrator. The key principles are:

1. **Strict state machine** with explicit transitions
2. **Invariants** that must always hold
3. **Idempotency** at every layer (API, queue, worker, billing)
4. **Failure propagation** through hierarchy
5. **Retry semantics** with exponential backoff
6. **Exactly-once billing** with append-only ledger
7. **Heartbeat monitoring** for stuck runs
8. **Row-level locking** for concurrent updates

Implement these exactly as specified. Deviation from these invariants will result in data corruption, double-charging, or stuck runs.

---

**Questions? Escalate to platform team.**
