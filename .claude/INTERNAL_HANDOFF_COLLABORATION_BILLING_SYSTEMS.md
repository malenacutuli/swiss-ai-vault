# Internal Handoff: Collaboration, Billing, and Hard Truths

**From:** Manus Technical Lead  
**To:** Engineering team rebuilding system from scratch  
**Tone:** Brutally honest. This is what we learned the hard way.

---

## Part 1: Real-Time Collaboration Model

### 1.1 Single Source of Truth

The **workspace document** is the single source of truth. Everything else is derived or cached.

```sql
CREATE TABLE workspace_documents (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Content
  content JSONB NOT NULL,  -- Full document state
  content_hash VARCHAR(64) NOT NULL,  -- SHA256 of content
  
  -- Versioning
  version_number BIGINT NOT NULL,  -- Monotonically increasing
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Audit
  updated_by UUID REFERENCES users(id),
  
  UNIQUE INDEX idx_workspace_version (workspace_id, version_number)
);

CREATE TABLE workspace_edits (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Edit
  user_id UUID NOT NULL REFERENCES users(id),
  operation JSONB NOT NULL,  -- { type: 'insert'|'delete'|'replace', path: [...], value: ... }
  
  -- Versioning
  base_version BIGINT NOT NULL,  -- Version this edit was based on
  result_version BIGINT NOT NULL,  -- Version after applying this edit
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Deduplication
  idempotency_key VARCHAR(255) UNIQUE,
  
  INDEX idx_workspace_edits (workspace_id, result_version)
);
```

**Invariant: Version Monotonicity**
```
For each workspace:
  workspace_documents.version_number is strictly increasing
  workspace_edits.result_version is strictly increasing
  
If edit E1 applied before edit E2:
  E1.result_version < E2.result_version
```

### 1.2 Concurrent Edit Merging (Operational Transformation)

We use **Operational Transformation (OT)** with a central server as arbiter. This is NOT CRDT—we chose OT because it's simpler to reason about and debug.

**Why not CRDT?** CRDTs are mathematically elegant but operationally opaque. When something goes wrong at 3am, you can't easily trace why two clients diverged. OT is deterministic and auditable.

**How OT Works:**

```python
class WorkspaceOT:
    """Operational Transformation for workspace edits"""
    
    async def apply_edit(self, workspace_id: str, edit: Edit) -> Edit:
        """Apply edit, transforming against concurrent edits"""
        
        # 1. Get current version
        current_doc = await db.get_workspace_document(workspace_id)
        current_version = current_doc.version_number
        
        # 2. Check if edit is based on current version
        if edit.base_version == current_version:
            # No concurrent edits, apply directly
            new_content = await self.apply_operation(
                current_doc.content,
                edit.operation
            )
            
            new_version = current_version + 1
            
        else:
            # Concurrent edits detected
            # Get all edits between base_version and current_version
            concurrent_edits = await db.query(
                "SELECT * FROM workspace_edits "
                "WHERE workspace_id = %s AND result_version > %s AND result_version <= %s "
                "ORDER BY result_version ASC",
                [workspace_id, edit.base_version, current_version]
            )
            
            # Transform incoming edit against all concurrent edits
            transformed_edit = edit.operation
            for concurrent_edit in concurrent_edits:
                transformed_edit = await self.transform(
                    transformed_edit,
                    concurrent_edit.operation
                )
            
            # Apply transformed edit
            new_content = await self.apply_operation(
                current_doc.content,
                transformed_edit
            )
            
            new_version = current_version + 1
        
        # 3. Store new version
        await db.insert('workspace_documents', {
            'workspace_id': workspace_id,
            'content': new_content,
            'content_hash': sha256(new_content),
            'version_number': new_version,
            'updated_by': edit.user_id
        })
        
        # 4. Store edit record
        await db.insert('workspace_edits', {
            'workspace_id': workspace_id,
            'user_id': edit.user_id,
            'operation': edit.operation,
            'base_version': edit.base_version,
            'result_version': new_version,
            'idempotency_key': edit.idempotency_key
        })
        
        # 5. Broadcast to all connected clients
        await websocket_manager.broadcast(
            workspace_id,
            {
                'type': 'edit_applied',
                'edit': {
                    'operation': transformed_edit,
                    'base_version': edit.base_version,
                    'result_version': new_version
                }
            }
        )
        
        return {
            'new_version': new_version,
            'new_content': new_content
        }
    
    async def transform(self, op1: Operation, op2: Operation) -> Operation:
        """Transform op1 against op2 (both concurrent)"""
        
        # This is the hard part. OT transformation rules depend on operation type.
        # We support: insert, delete, replace
        
        # Example: Two concurrent inserts at different positions
        if op1.type == 'insert' and op2.type == 'insert':
            if op1.path == op2.path:
                # Both inserting at same position
                # Use user_id as tiebreaker (deterministic)
                if op1.user_id < op2.user_id:
                    # op1 goes first
                    return op1
                else:
                    # op2 goes first, op1 needs adjustment
                    return {
                        'type': 'insert',
                        'path': op1.path,
                        'value': op1.value,
                        'index_offset': 1  # Adjust position
                    }
            else:
                # Different positions, no conflict
                return op1
        
        # Example: Insert vs Delete at same position
        elif op1.type == 'insert' and op2.type == 'delete':
            if op1.path == op2.path:
                # Insert wins (user is adding content)
                return op1
            else:
                return op1
        
        # ... more transformation rules ...
        
        return op1
```

**Critical Assumption:** We assume all clients are connected to the same server. If a client goes offline and makes edits, those edits are lost. We don't support offline-first collaboration.

### 1.3 Conflicting Prompts

When two users issue conflicting prompts (e.g., "make slide 3 about AI" vs "delete slide 3"), we use **pessimistic locking**.

```python
class PromptConflictManager:
    """Handle conflicting prompts"""
    
    async def apply_prompt(self, workspace_id: str, prompt: Prompt, user_id: str):
        """Apply prompt with conflict detection"""
        
        # 1. Acquire workspace lock
        lock = await redis.set(
            f"workspace:lock:{workspace_id}",
            user_id,
            ex=30,  # 30 second timeout
            nx=True  # Only if not exists
        )
        
        if not lock:
            # Workspace locked by another user
            current_holder = await redis.get(f"workspace:lock:{workspace_id}")
            raise WorkspaceLockedException(
                f"Workspace locked by {current_holder}. Try again in 30s."
            )
        
        try:
            # 2. Get current state
            doc = await db.get_workspace_document(workspace_id)
            
            # 3. Validate prompt against current state
            # (e.g., can't delete slide 3 if only 2 slides exist)
            if not await self.validate_prompt(prompt, doc):
                raise InvalidPromptError(f"Prompt invalid for current state")
            
            # 4. Execute prompt (LLM-based transformation)
            new_content = await self.execute_prompt(prompt, doc.content)
            
            # 5. Store new version
            new_version = doc.version_number + 1
            await db.insert('workspace_documents', {
                'workspace_id': workspace_id,
                'content': new_content,
                'version_number': new_version,
                'updated_by': user_id
            })
            
            # 6. Broadcast update
            await websocket_manager.broadcast(
                workspace_id,
                {
                    'type': 'prompt_applied',
                    'prompt': prompt.text,
                    'new_version': new_version
                }
            )
            
        finally:
            # 7. Release lock
            await redis.delete(f"workspace:lock:{workspace_id}")
```

**Hard Truth:** Pessimistic locking is not elegant, but it works. Optimistic conflict resolution for LLM-generated content is a nightmare because you can't easily merge two different LLM outputs. We tried CRDT + LLM synthesis and it was a disaster.

### 1.4 Permissions and Credit Enforcement

**Permission Model:**
```
- Owner: Full control, pays for all credits
- Editor: Can edit content, but owner pays
- Viewer: Read-only
```

**Credit Enforcement:**

```python
class CreditEnforcer:
    """Enforce credit consumption in shared workspaces"""
    
    async def execute_prompt(self, workspace_id: str, prompt: Prompt, user_id: str):
        """Execute prompt with credit enforcement"""
        
        workspace = await db.get_workspace(workspace_id)
        owner = workspace.owner_id
        
        # 1. Estimate cost
        estimated_cost = await self.estimate_cost(prompt)
        
        # 2. Check owner's balance (not user's balance)
        owner_balance = await billing_engine.get_balance(owner)
        if owner_balance.available < estimated_cost:
            raise InsufficientCreditsError(
                f"Owner has {owner_balance.available}, need {estimated_cost}"
            )
        
        # 3. Reserve credits from owner
        reservation = await billing_engine.reserve(
            org_id=workspace.owner_org_id,
            amount=estimated_cost,
            run_id=prompt.run_id
        )
        
        try:
            # 4. Execute prompt
            result = await self.execute_prompt_internal(prompt)
            
            # 5. Charge actual cost
            actual_cost = result.tokens_used * 0.001
            await billing_engine.charge(
                org_id=workspace.owner_org_id,
                amount=actual_cost,
                run_id=prompt.run_id
            )
            
            # 6. Log who triggered the charge
            await audit_logger.log(
                org_id=workspace.owner_org_id,
                action='prompt_executed',
                user_id=user_id,
                workspace_id=workspace_id,
                cost=actual_cost
            )
            
        except Exception as e:
            # 7. Refund on failure
            await billing_engine.refund(
                org_id=workspace.owner_org_id,
                amount=estimated_cost,
                run_id=prompt.run_id
            )
            raise
```

**Critical Assumption:** Only the workspace owner is charged, regardless of who triggered the action. This prevents users from griefing each other by running expensive prompts.

### 1.5 Preventing Fork Explosions

A "fork" is when a user creates a copy of a workspace. Without controls, this can explode into thousands of copies.

```python
class ForkLimiter:
    """Prevent fork explosions"""
    
    FORK_LIMITS = {
        'free': 5,  # 5 forks per user
        'pro': 50,
        'enterprise': 1000
    }
    
    async def create_fork(self, workspace_id: str, user_id: str) -> str:
        """Create fork with limits"""
        
        # 1. Check fork count
        user = await db.get_user(user_id)
        fork_count = await db.query(
            "SELECT COUNT(*) as count FROM workspaces "
            "WHERE forked_from_id = %s AND owner_id = %s",
            [workspace_id, user_id]
        )
        
        limit = self.FORK_LIMITS.get(user.plan, 5)
        if fork_count[0]['count'] >= limit:
            raise ForkLimitExceededError(
                f"User has {fork_count[0]['count']} forks, limit is {limit}"
            )
        
        # 2. Create fork
        original = await db.get_workspace(workspace_id)
        fork = await db.insert('workspaces', {
            'name': f"{original.name} (fork)",
            'owner_id': user_id,
            'forked_from_id': workspace_id,
            'content': original.content,
            'version_number': 1
        })
        
        # 3. Log fork
        await audit_logger.log(
            org_id=user.org_id,
            action='workspace_forked',
            user_id=user_id,
            source_workspace_id=workspace_id,
            fork_workspace_id=fork.id
        )
        
        return fork.id
```

**Hard Truth:** We've seen users create 10,000+ forks by accident (e.g., running a script). The fork limiter prevents this, but it's a band-aid. The real solution is better UX to prevent accidental forks.

### 1.6 Optimistic vs Pessimistic

**We use PESSIMISTIC locking for prompts, OPTIMISTIC for edits.**

**Why?**
- Edits (text changes) are low-conflict and fast. Optimistic works well.
- Prompts (LLM transformations) are high-conflict and slow. Pessimistic prevents confusion.

**Pathological Case: The Merge Disaster**

```
Scenario:
  User A: "Make slide 3 about AI"
  User B: "Delete slide 3"
  
  Both issued within 100ms
  
  Without locking:
    A's prompt runs: slide 3 becomes "AI Overview"
    B's delete runs: slide 3 deleted
    
    Result: Slide 3 is deleted, but A thinks it was edited
    A sees "AI Overview" in their local cache
    B sees nothing
    
    Conflict: Unresolvable
```

**With pessimistic locking:**
```
  User A acquires lock, runs prompt
  User B waits 30 seconds, then gets lock, runs delete
  
  Result: Deterministic, auditable
```

---

## Part 2: Billing System (Real Incidents Included)

### 2.1 Token Counting Strategy

**We count tokens THREE times:**

1. **Estimation (before execution):** Rough estimate based on input size
2. **Execution (during LLM call):** Actual tokens from LLM API
3. **Reconciliation (after completion):** Final audit

```python
class TokenCounter:
    """Count tokens at three stages"""
    
    async def estimate_tokens(self, prompt: str) -> int:
        """Estimate tokens before execution"""
        
        # Use tiktoken for estimation
        # Assumption: ~1 token per 4 characters
        estimated = len(prompt) // 4
        
        # Add buffer for response
        estimated += 1000  # Assume ~1000 token response
        
        return estimated
    
    async def count_actual_tokens(self, llm_response: Dict) -> int:
        """Count actual tokens from LLM response"""
        
        # OpenAI returns usage in response
        return llm_response['usage']['total_tokens']
    
    async def reconcile_tokens(self, run_id: str, actual_tokens: int):
        """Reconcile estimated vs actual tokens"""
        
        run = await db.get_run(run_id)
        estimated_tokens = run.tokens_estimated
        actual_tokens = actual_tokens
        
        # Calculate variance
        variance = (actual_tokens - estimated_tokens) / estimated_tokens
        
        # Log variance
        await db.insert('token_reconciliation', {
            'run_id': run_id,
            'estimated_tokens': estimated_tokens,
            'actual_tokens': actual_tokens,
            'variance_pct': variance * 100
        })
        
        # Alert if variance > 50%
        if abs(variance) > 0.5:
            await alert_team(
                f"Run {run_id}: Token variance {variance:.1%}"
            )
```

### 2.2 Reservation vs Finalization

**Reservation:** Happens when run starts. Credits are held but not charged.

**Finalization:** Happens when run completes. Credits are actually charged.

```python
class BillingLifecycle:
    """Credit lifecycle"""
    
    async def start_run(self, run_id: str, org_id: str):
        """Reserve credits when run starts"""
        
        # 1. Estimate cost
        estimated_cost = 50.0  # $50 for typical run
        
        # 2. Check balance
        balance = await billing_engine.get_balance(org_id)
        if balance.available < estimated_cost:
            raise InsufficientCreditsError()
        
        # 3. Reserve credits
        await db.insert('credit_reservations', {
            'org_id': org_id,
            'run_id': run_id,
            'amount': estimated_cost,
            'status': 'reserved',
            'created_at': datetime.utcnow()
        })
        
        # 4. Update balance
        await db.update_credit_balance(
            org_id,
            reserved=balance.reserved + estimated_cost
        )
    
    async def complete_run(self, run_id: str, org_id: str, actual_cost: float):
        """Finalize credits when run completes"""
        
        # 1. Get reservation
        reservation = await db.query(
            "SELECT * FROM credit_reservations WHERE run_id = %s",
            [run_id]
        )
        
        if not reservation:
            raise ReservationNotFoundError()
        
        reserved_amount = reservation[0]['amount']
        
        # 2. Calculate refund/charge
        if actual_cost < reserved_amount:
            refund = reserved_amount - actual_cost
            
            # Create refund entry
            await db.insert('billing_ledger', {
                'org_id': org_id,
                'transaction_type': 'refund',
                'amount': refund,
                'run_id': run_id
            })
            
            # Update balance
            balance = await billing_engine.get_balance(org_id)
            await db.update_credit_balance(
                org_id,
                balance=balance.balance + refund,
                reserved=balance.reserved - reserved_amount
            )
        
        elif actual_cost > reserved_amount:
            # Charge additional
            additional = actual_cost - reserved_amount
            
            # Check if we have balance
            balance = await billing_engine.get_balance(org_id)
            if balance.available < additional:
                # This should never happen if estimation is good
                # But if it does, we have a problem
                await escalate_billing_issue(run_id, additional)
                raise BillingException("Insufficient balance for actual cost")
            
            # Create charge entry
            await db.insert('billing_ledger', {
                'org_id': org_id,
                'transaction_type': 'charge',
                'amount': additional,
                'run_id': run_id
            })
            
            # Update balance
            balance = await billing_engine.get_balance(org_id)
            await db.update_credit_balance(
                org_id,
                balance=balance.balance - additional,
                reserved=balance.reserved - reserved_amount
            )
        
        else:
            # Exact match
            balance = await billing_engine.get_balance(org_id)
            await db.update_credit_balance(
                org_id,
                reserved=balance.reserved - reserved_amount
            )
        
        # 3. Mark reservation as finalized
        await db.update_credit_reservation(
            run_id,
            status='finalized',
            actual_cost=actual_cost
        )
```

### 2.3 Partial Task Failure

When a task fails midway, we need to handle credits carefully.

```python
class PartialFailureHandler:
    """Handle partial task failures"""
    
    async def handle_task_failure(self, task_id: str, run_id: str):
        """Handle task failure and credit reconciliation"""
        
        task = await db.get_task(task_id)
        run = await db.get_run(run_id)
        
        # 1. Count completed steps
        completed_steps = await db.query(
            "SELECT COUNT(*) as count FROM steps WHERE task_id = %s AND status = 'completed'",
            [task_id]
        )
        
        total_steps = await db.query(
            "SELECT COUNT(*) as count FROM steps WHERE task_id = %s",
            [task_id]
        )
        
        completion_ratio = completed_steps[0]['count'] / total_steps[0]['count']
        
        # 2. Calculate proportional refund
        # If 50% of steps completed, refund 50% of task cost
        task_cost = task.estimated_cost
        refund_amount = task_cost * (1 - completion_ratio)
        
        # 3. Create refund entry
        await db.insert('billing_ledger', {
            'org_id': run.org_id,
            'transaction_type': 'partial_refund',
            'amount': refund_amount,
            'run_id': run_id,
            'task_id': task_id,
            'reason': f"Task failed after {completion_ratio:.1%} completion"
        })
        
        # 4. Update balance
        balance = await billing_engine.get_balance(run.org_id)
        await db.update_credit_balance(
            run.org_id,
            balance=balance.balance + refund_amount
        )
        
        # 5. Log incident
        await audit_logger.log(
            org_id=run.org_id,
            action='partial_failure_refund',
            task_id=task_id,
            refund_amount=refund_amount
        )
```

### 2.4 Refund Handling

Refunds are tricky. We have three types:

1. **Automatic Refunds:** Task failed, refund immediately
2. **Manual Refunds:** Support team grants refund (rare)
3. **Dispute Refunds:** User disputes charge (very rare)

```python
class RefundManager:
    """Handle refunds"""
    
    async def create_refund(self, run_id: str, reason: str, refund_amount: float):
        """Create refund"""
        
        run = await db.get_run(run_id)
        
        # 1. Verify refund is valid
        if refund_amount <= 0:
            raise InvalidRefundError("Refund amount must be positive")
        
        if refund_amount > run.credits_charged:
            raise InvalidRefundError("Refund exceeds charged amount")
        
        # 2. Create refund entry
        await db.insert('billing_ledger', {
            'id': uuid.uuid4(),
            'org_id': run.org_id,
            'transaction_type': 'refund',
            'amount': refund_amount,
            'run_id': run_id,
            'reason': reason,
            'created_by': 'system',
            'created_at': datetime.utcnow()
        })
        
        # 3. Update balance
        balance = await billing_engine.get_balance(run.org_id)
        await db.update_credit_balance(
            run.org_id,
            balance=balance.balance + refund_amount
        )
        
        # 4. Notify user
        await notify_user(
            user_id=run.user_id,
            message=f"Refund of ${refund_amount:.2f} applied to your account"
        )
        
        # 5. Log refund
        await audit_logger.log(
            org_id=run.org_id,
            action='refund_issued',
            run_id=run_id,
            amount=refund_amount,
            reason=reason
        )
```

### 2.5 Abuse Detection

We monitor for suspicious patterns.

```python
class AbuseDetector:
    """Detect billing abuse"""
    
    async def check_for_abuse(self, org_id: str):
        """Check for suspicious patterns"""
        
        # 1. Check for high variance
        reconciliations = await db.query(
            "SELECT * FROM token_reconciliation "
            "WHERE run_id IN (SELECT id FROM runs WHERE org_id = %s) "
            "AND created_at > NOW() - INTERVAL '24 hours' "
            "ORDER BY created_at DESC LIMIT 100",
            [org_id]
        )
        
        high_variance_count = sum(
            1 for r in reconciliations
            if abs(r['variance_pct']) > 100  # >100% variance
        )
        
        if high_variance_count > 10:
            await alert_team(
                f"Org {org_id}: {high_variance_count} runs with >100% token variance"
            )
        
        # 2. Check for rapid refunds
        refunds = await db.query(
            "SELECT COUNT(*) as count FROM billing_ledger "
            "WHERE org_id = %s AND transaction_type = 'refund' "
            "AND created_at > NOW() - INTERVAL '1 hour'",
            [org_id]
        )
        
        if refunds[0]['count'] > 50:
            await alert_team(
                f"Org {org_id}: {refunds[0]['count']} refunds in 1 hour"
            )
        
        # 3. Check for impossible token counts
        runs = await db.query(
            "SELECT * FROM runs WHERE org_id = %s "
            "AND tokens_used > 1000000 "  # >1M tokens
            "AND created_at > NOW() - INTERVAL '1 hour'",
            [org_id]
        )
        
        if len(runs) > 5:
            await alert_team(
                f"Org {org_id}: {len(runs)} runs with >1M tokens in 1 hour"
            )
```

### 2.6 Real Billing Incident: The Token Estimation Disaster

**Date:** March 15, 2024  
**Impact:** $50,000 in incorrect charges  
**Root Cause:** Token estimation was wildly off

**What Happened:**

```
We estimated tokens as: len(prompt) // 4

But OpenAI's actual token count was often 10x higher because:
  1. We didn't account for system prompts
  2. We didn't account for JSON formatting overhead
  3. We didn't account for image tokens (1 image = 1000+ tokens)

Result:
  - Estimated: 5,000 tokens = $0.05
  - Actual: 50,000 tokens = $0.50
  
  For 100,000 runs, this was $45,000 in undercharges
```

**How We Fixed It:**

```python
# Before (broken)
def estimate_tokens(prompt):
    return len(prompt) // 4

# After (fixed)
def estimate_tokens(prompt, context=None, images=None):
    # 1. Count prompt tokens
    prompt_tokens = len(prompt) // 4
    
    # 2. Add system prompt overhead
    system_overhead = 500
    
    # 3. Add context tokens
    context_tokens = len(context) // 4 if context else 0
    
    # 4. Add image tokens (1 image = 1000+ tokens)
    image_tokens = len(images) * 1000 if images else 0
    
    # 5. Add response buffer (assume 2000 token response)
    response_buffer = 2000
    
    # 6. Add safety margin (20%)
    total = (prompt_tokens + system_overhead + context_tokens + 
             image_tokens + response_buffer) * 1.2
    
    return int(total)
```

**The Fix:**

1. We recalculated all historical runs
2. We issued refunds to affected customers ($50,000 total)
3. We added token reconciliation alerts (variance > 50%)
4. We added abuse detection for high variance
5. We added tests for token estimation accuracy

**Lesson:** Never trust your estimation. Always reconcile against actual usage. The gap between estimated and actual is a signal of bugs.

---

## Part 3: Planning, Wide Research, and Presentation Generation

### 3.1 Planning System

**Plan Schema:**

```json
{
  "id": "plan_123",
  "run_id": "run_123",
  
  "stages": [
    {
      "id": "stage_1",
      "name": "research",
      "type": "wide_research",
      "status": "pending",
      
      "config": {
        "max_agents": 10,
        "max_sources_per_agent": 5,
        "max_tokens": 50000
      },
      
      "dependencies": [],
      "retry_policy": {
        "max_attempts": 3,
        "backoff_multiplier": 2
      }
    },
    {
      "id": "stage_2",
      "name": "synthesis",
      "type": "synthesis",
      "status": "pending",
      
      "dependencies": ["stage_1"],
      "config": {
        "max_tokens": 10000,
        "conflict_resolution": "voting"
      }
    },
    {
      "id": "stage_3",
      "name": "presentation_generation",
      "type": "presentation_generation",
      "status": "pending",
      
      "dependencies": ["stage_2"],
      "config": {
        "slide_count": 15,
        "template": "corporate",
        "include_speaker_notes": true
      }
    }
  ],
  
  "version": 1,
  "created_at": "2026-01-15T12:00:00Z",
  "updated_at": "2026-01-15T12:00:00Z"
}
```

**Mandatory Fields:**
- `id`, `run_id`, `stages` (at least one stage)
- Each stage must have: `id`, `name`, `type`, `status`, `dependencies`

**Advisory Fields:**
- `config` (defaults applied if missing)
- `retry_policy` (defaults to 3 attempts, 2x backoff)

**Re-Plan vs Retry:**

```
RETRY: Same plan, same stage, try again
  Triggered by: Transient error (timeout, rate limit)
  Max retries: 3 per stage
  Backoff: Exponential (100ms, 200ms, 400ms, ...)

RE-PLAN: Different plan, different stages
  Triggered by: Fundamental failure (wrong decomposition, hallucination)
  Max replans: 2 per run
  Action: Orchestrator calls planner to generate new plan
```

**Plans are IMMUTABLE:**

```python
class PlanManager:
    """Manage plans"""
    
    async def create_plan(self, run_id: str, task: str) -> Plan:
        """Create plan"""
        
        # Call planner
        plan = await planner.generate_plan(task)
        
        # Store plan
        await db.insert('plans', {
            'id': plan.id,
            'run_id': run_id,
            'plan': plan,
            'version': 1,
            'created_at': datetime.utcnow()
        })
        
        return plan
    
    async def update_plan(self, plan_id: str, changes: Dict):
        """Update plan (creates new version)"""
        
        # Get current plan
        current = await db.get_plan(plan_id)
        
        # Create new version
        new_plan = {
            **current.plan,
            **changes
        }
        
        # Store new version
        await db.insert('plans', {
            'id': uuid.uuid4(),
            'run_id': current.run_id,
            'plan': new_plan,
            'version': current.version + 1,
            'parent_version': current.version,
            'created_at': datetime.utcnow()
        })
        
        # Update run to point to new plan
        await db.update_run(current.run_id, {'plan_id': new_plan.id})
```

**Preventing Infinite Re-Planning:**

```python
class ReplanLimiter:
    """Prevent infinite replanning"""
    
    MAX_REPLANS = 2
    
    async def should_replan(self, run_id: str) -> bool:
        """Check if we should replan"""
        
        run = await db.get_run(run_id)
        
        # Count replans
        replan_count = await db.query(
            "SELECT COUNT(*) as count FROM plans "
            "WHERE run_id = %s AND parent_version IS NOT NULL",
            [run_id]
        )
        
        if replan_count[0]['count'] >= self.MAX_REPLANS:
            # Max replans exceeded
            await db.update_run(run_id, {
                'status': 'failed',
                'last_error': 'Max replans exceeded'
            })
            return False
        
        return True
    
    async def replan(self, run_id: str):
        """Replan"""
        
        if not await self.should_replan(run_id):
            return
        
        run = await db.get_run(run_id)
        
        # Get current plan
        current_plan = await db.get_plan(run.plan_id)
        
        # Analyze failures
        failures = await self.analyze_failures(run_id)
        
        # Generate new plan
        new_plan = await planner.generate_plan(
            task=run.task,
            previous_plan=current_plan.plan,
            failures=failures
        )
        
        # Store new plan
        await db.insert('plans', {
            'id': uuid.uuid4(),
            'run_id': run_id,
            'plan': new_plan,
            'version': current_plan.version + 1,
            'parent_version': current_plan.version,
            'created_at': datetime.utcnow()
        })
```

### 3.2 Wide Research System (Debugging at 3am)

**Sub-Agent Spawning:**

```python
class WideResearchExecutor:
    """Execute wide research"""
    
    async def execute_research(self, stage: Stage) -> Dict:
        """Execute wide research stage"""
        
        # 1. Decompose task
        subtasks = await self.decompose_task(
            task=stage.task,
            max_agents=stage.config['max_agents']
        )
        
        # 2. Spawn agents (FIXED, not adaptive)
        agents = []
        for i, subtask in enumerate(subtasks):
            agent = await self.spawn_agent(
                run_id=stage.run_id,
                subtask=subtask,
                agent_number=i,
                max_sources=stage.config['max_sources_per_agent']
            )
            agents.append(agent)
        
        # 3. Execute agents in parallel
        results = await asyncio.gather(
            *[self.execute_agent(agent) for agent in agents],
            return_exceptions=True
        )
        
        # 4. Analyze results
        successful_results = [r for r in results if not isinstance(r, Exception)]
        failed_results = [r for r in results if isinstance(r, Exception)]
        
        # 5. Handle failures
        if len(failed_results) > len(successful_results) * 0.5:
            # More than 50% failed, escalate
            raise StageFailureError(f"{len(failed_results)} agents failed")
        
        return {
            'results': successful_results,
            'failures': failed_results
        }
    
    async def spawn_agent(self, run_id: str, subtask: str, agent_number: int, max_sources: int) -> Agent:
        """Spawn agent (FIXED number, not adaptive)"""
        
        # Agents are FULLY ISOLATED (no shared context)
        agent = Agent(
            id=f"agent_{run_id}_{agent_number}",
            run_id=run_id,
            subtask=subtask,
            max_sources=max_sources,
            context_window_tokens=8000,  # Fresh context for each agent
            
            # NO shared context with other agents
            # Each agent gets a clean slate
        )
        
        return agent
    
    async def execute_agent(self, agent: Agent) -> Dict:
        """Execute agent"""
        
        try:
            # 1. Retrieve sources
            sources = await self.retrieve_sources(
                query=agent.subtask,
                max_sources=agent.max_sources
            )
            
            # 2. Analyze sources
            findings = await self.analyze_sources(
                agent_id=agent.id,
                sources=sources,
                subtask=agent.subtask
            )
            
            # 3. Return findings with citations
            return {
                'agent_id': agent.id,
                'subtask': agent.subtask,
                'findings': findings,
                'sources': sources,
                'tokens_used': findings['tokens_used']
            }
            
        except Exception as e:
            # Log failure
            await audit_logger.log(
                action='agent_failed',
                agent_id=agent.id,
                error=str(e)
            )
            raise
```

**Preventing Duplication:**

```python
class DeduplicationManager:
    """Prevent duplication across agents"""
    
    async def deduplicate_sources(self, all_sources: List[Source]) -> List[Source]:
        """Deduplicate sources across all agents"""
        
        seen_urls = {}
        unique_sources = []
        
        for source in all_sources:
            url_hash = sha256(source.url)
            
            if url_hash not in seen_urls:
                seen_urls[url_hash] = source
                unique_sources.append(source)
            else:
                # Duplicate source, keep the one with higher score
                existing = seen_urls[url_hash]
                if source.score > existing.score:
                    unique_sources.remove(existing)
                    unique_sources.append(source)
                    seen_urls[url_hash] = source
        
        return unique_sources
```

**Synthesis (Mechanical, Not Conceptual):**

```python
class SynthesisEngine:
    """Synthesize agent results"""
    
    async def synthesize(self, agent_results: List[Dict]) -> str:
        """Synthesize results from all agents"""
        
        # 1. Collect all findings
        all_findings = [r['findings'] for r in agent_results]
        all_sources = []
        for r in agent_results:
            all_sources.extend(r['sources'])
        
        # 2. Deduplicate sources
        unique_sources = await self.deduplicate_sources(all_sources)
        
        # 3. Score findings by consensus
        finding_scores = await self.score_findings(all_findings)
        
        # 4. Resolve conflicts
        resolved_findings = await self.resolve_conflicts(
            all_findings,
            finding_scores
        )
        
        # 5. Generate synthesis
        synthesis_prompt = f"""
        Synthesize these findings into a coherent report:
        
        Findings:
        {json.dumps(resolved_findings, indent=2)}
        
        Sources:
        {json.dumps(unique_sources, indent=2)}
        
        Generate a report with:
        1. Executive summary
        2. Key findings
        3. Analysis
        4. Recommendations
        5. Citations [1], [2], etc.
        """
        
        response = await llm.invoke({
            'messages': [
                {'role': 'system', 'content': 'You are a research synthesis expert.'},
                {'role': 'user', 'content': synthesis_prompt}
            ]
        })
        
        # 6. Add citations
        report_with_citations = await self.add_citations(
            response.content,
            unique_sources
        )
        
        return report_with_citations
    
    async def score_findings(self, all_findings: List[Dict]) -> Dict:
        """Score findings by consensus"""
        
        scores = {}
        
        for finding in all_findings:
            # Count how many agents found this
            consensus_count = sum(
                1 for other_findings in all_findings
                if self.findings_match(finding, other_findings)
            )
            
            # Score = consensus count / total agents
            score = consensus_count / len(all_findings)
            
            scores[finding['id']] = score
        
        return scores
    
    async def resolve_conflicts(self, all_findings: List[Dict], scores: Dict) -> Dict:
        """Resolve conflicting findings"""
        
        # 1. Group conflicting findings
        conflicts = await self.identify_conflicts(all_findings)
        
        # 2. For each conflict, pick the one with highest consensus
        resolved = {}
        for conflict_group in conflicts:
            best_finding = max(
                conflict_group,
                key=lambda f: scores.get(f['id'], 0)
            )
            resolved[best_finding['id']] = best_finding
        
        return resolved
```

**Handling Failures:**

```
One agent times out:
  → Continue with other agents
  → If > 50% timeout: escalate
  
One agent hallucinates:
  → Detected by consensus scoring (low agreement)
  → Downweighted in synthesis
  
One agent contradicts others:
  → Detected by conflict resolution
  → Picked by voting (majority wins)
  
Maximum fan-out: 50 agents
  → Why? Each agent uses ~8000 tokens context window
  → 50 agents = 400K tokens = $4 cost
  → Beyond 50, diminishing returns (more agents = more noise)
```

---

## Part 4: Presentation Generation, Data Analysis, Email, and Hard Truths

### 4.1 Presentation Generation Pipeline

**Stages:**

```
1. RESEARCH (wide_research stage)
   → Gather sources, analyze findings
   → Output: Synthesis report with citations

2. SLIDE PLANNING (planning stage)
   → Determine slide structure
   → Output: Slide plan (title, content outline, layout)

3. VISUAL GENERATION (visual_generation stage)
   → Generate visuals for each slide
   → Output: Images (stored in S3)

4. SPEAKER NOTES (speaker_notes stage)
   → Generate speaker notes grounded in citations
   → Output: Speaker notes (text)

5. PPTX EXPORT (export stage)
   → Assemble slides, visuals, notes into PPTX
   → Output: .pptx file (stored in S3)
```

**Content-First vs Template-First:**

We use **CONTENT-FIRST**. We determine slide structure based on research findings, not templates.

```python
class SlidePlanner:
    """Plan slides based on content"""
    
    async def plan_slides(self, research_report: str, max_slides: int = 20) -> List[SlidePlan]:
        """Plan slides from research"""
        
        # 1. Extract key sections from report
        sections = await self.extract_sections(research_report)
        
        # 2. Determine slide structure
        slide_structure = await self.determine_structure(sections, max_slides)
        
        # 3. For each section, create slide plan
        slide_plans = []
        for i, section in enumerate(slide_structure):
            slide_plan = SlidePlan(
                id=f"slide_{i}",
                title=section['title'],
                content=section['content'],
                layout=section['layout'],  # 'title', 'content', 'two-column', etc.
                visual_suggestion=section['visual_suggestion'],
                speaker_notes_outline=section['speaker_notes_outline']
            )
            slide_plans.append(slide_plan)
        
        return slide_plans
```

**Asset Lifecycle:**

```
TEMP (during generation):
  → Stored in /tmp/workspace_{workspace_id}/
  → Expires after 1 hour
  → Can be deleted if generation fails

FINAL (after generation):
  → Uploaded to S3
  → Stored at s3://presentations/{workspace_id}/{run_id}/{asset_id}
  → Expires after 30 days
  → Referenced in PPTX
```

**Retry Boundaries:**

```
Retryable:
  - Visual generation timeout
  - LLM timeout
  - S3 upload timeout
  
Non-retryable:
  - Invalid slide structure
  - Unsupported layout
  - Missing required fields
```

### 4.2 Data Analysis Pipeline

**Schema Inference:**

```python
class SchemaInferencer:
    """Infer schema from messy data"""
    
    async def infer_schema(self, df: pd.DataFrame) -> Dict:
        """Infer schema from DataFrame"""
        
        schema = {}
        
        for column in df.columns:
            # 1. Infer type
            inferred_type = await self.infer_column_type(df[column])
            
            # 2. Detect categorical vs numeric
            if inferred_type == 'numeric':
                # Check if actually categorical
                unique_ratio = len(df[column].unique()) / len(df)
                if unique_ratio < 0.05:  # <5% unique values
                    inferred_type = 'categorical'
            
            # 3. Detect temporal
            if inferred_type == 'string':
                if await self.is_temporal(df[column]):
                    inferred_type = 'temporal'
            
            schema[column] = {
                'type': inferred_type,
                'nullable': df[column].isnull().any(),
                'unique_count': len(df[column].unique()),
                'sample_values': df[column].dropna().head(3).tolist()
            }
        
        return schema
```

**Chart Selection:**

```python
class ChartSelector:
    """Select appropriate charts"""
    
    async def select_charts(self, df: pd.DataFrame, schema: Dict) -> List[Chart]:
        """Select charts based on data"""
        
        charts = []
        
        # 1. For each numeric column, suggest line chart
        numeric_cols = [col for col, s in schema.items() if s['type'] == 'numeric']
        for col in numeric_cols[:5]:
            charts.append({
                'type': 'line',
                'title': f'{col} Over Time',
                'x_axis': 'index',
                'y_axis': col,
                'confidence': 0.8
            })
        
        # 2. For categorical columns, suggest bar chart
        categorical_cols = [col for col, s in schema.items() if s['type'] == 'categorical']
        for col in categorical_cols[:3]:
            charts.append({
                'type': 'bar',
                'title': f'{col} Distribution',
                'x_axis': col,
                'y_axis': 'count',
                'confidence': 0.9
            })
        
        # 3. For numeric pairs, suggest scatter plot
        if len(numeric_cols) >= 2:
            charts.append({
                'type': 'scatter',
                'title': f'{numeric_cols[0]} vs {numeric_cols[1]}',
                'x_axis': numeric_cols[0],
                'y_axis': numeric_cols[1],
                'confidence': 0.7
            })
        
        return charts
```

**Detecting Statistical Relevance:**

```python
class RelevanceDetector:
    """Detect statistical relevance vs noise"""
    
    async def is_relevant(self, chart: Chart, df: pd.DataFrame) -> bool:
        """Check if chart is statistically relevant"""
        
        # 1. Check variance
        if chart.type == 'line':
            variance = df[chart.y_axis].var()
            if variance < 0.01:  # Very low variance = noise
                return False
        
        # 2. Check correlation
        elif chart.type == 'scatter':
            correlation = df[chart.x_axis].corr(df[chart.y_axis])
            if abs(correlation) < 0.3:  # Weak correlation = noise
                return False
        
        # 3. Check sample size
        if len(df) < 10:
            return False  # Too few samples
        
        return True
```

### 4.3 Email-Triggered Tasks

**Authentication:**

```python
class EmailAuthenticator:
    """Authenticate emails"""
    
    async def authenticate_email(self, email: Dict) -> str:
        """Authenticate email and return user_id"""
        
        # 1. Verify SPF/DKIM/DMARC
        if not await self.verify_dmarc(email):
            raise UnverifiedEmailError("DMARC verification failed")
        
        # 2. Check sender is registered user
        sender = email['from']
        user = await db.query(
            "SELECT id FROM users WHERE email = %s",
            [sender]
        )
        
        if not user:
            raise UnauthorizedSenderError(f"Sender {sender} not registered")
        
        return user[0]['id']
```

**Idempotency:**

```python
class EmailIdempotencyManager:
    """Guarantee idempotency for emails"""
    
    async def process_email(self, email: Dict):
        """Process email with idempotency"""
        
        # 1. Generate message ID (unique per email)
        message_id = email['message_id']
        
        # 2. Check if already processed
        existing = await db.query(
            "SELECT task_id FROM email_ingestions WHERE message_id = %s",
            [message_id]
        )
        
        if existing:
            # Already processed, return existing task
            return existing[0]['task_id']
        
        # 3. Handle reply chains
        # If this is a reply, check if parent was processed
        if email.get('in_reply_to'):
            parent_task = await db.query(
                "SELECT task_id FROM email_ingestions WHERE message_id = %s",
                [email['in_reply_to']]
            )
            
            if parent_task:
                # This is a reply to an existing task
                # Link to parent task
                parent_task_id = parent_task[0]['task_id']
            else:
                # Parent not found, create new task
                parent_task_id = None
        
        # 4. Create task
        task_id = await self.create_task_from_email(
            email=email,
            parent_task_id=parent_task_id
        )
        
        # 5. Store ingestion record
        await db.insert('email_ingestions', {
            'message_id': message_id,
            'in_reply_to': email.get('in_reply_to'),
            'task_id': task_id,
            'status': 'processing'
        })
        
        return task_id
```

**Attachment Handling:**

```python
class AttachmentHandler:
    """Handle email attachments safely"""
    
    ALLOWED_TYPES = ['pdf', 'csv', 'xlsx', 'json', 'txt', 'png', 'jpg']
    MAX_SIZE = 100 * 1024 * 1024  # 100MB
    
    async def process_attachments(self, email: Dict) -> List[str]:
        """Process attachments safely"""
        
        attachment_keys = []
        
        for attachment in email.get('attachments', []):
            # 1. Validate type
            file_ext = attachment['filename'].split('.')[-1].lower()
            if file_ext not in self.ALLOWED_TYPES:
                raise UnsupportedAttachmentError(f"Type {file_ext} not allowed")
            
            # 2. Validate size
            if len(attachment['data']) > self.MAX_SIZE:
                raise AttachmentTooLargeError(f"Attachment exceeds {self.MAX_SIZE} bytes")
            
            # 3. Scan for malware (external service)
            if not await self.scan_for_malware(attachment['data']):
                raise MalwareDetectedError("Attachment contains malware")
            
            # 4. Upload to S3
            s3_key = f"email_attachments/{uuid.uuid4()}/{attachment['filename']}"
            await s3.put_object(s3_key, attachment['data'])
            
            attachment_keys.append(s3_key)
        
        return attachment_keys
```

---

## Part 5: What They'll Get Wrong (Brutal Honesty)

### 5.1 Things Teams Almost Certainly Get Wrong

**1. Token Counting**

Everyone underestimates token counts. You'll think 10,000 tokens, it'll be 100,000.

**Why?**
- System prompts add 500+ tokens
- JSON formatting adds 20-30% overhead
- Images are 1000+ tokens each
- Context window overhead (padding, special tokens)

**What they'll do wrong:** Estimate tokens as `len(text) / 4`. This is off by 10x.

**What to do instead:** Use tiktoken, add 50% buffer, reconcile against actual usage.

**2. Concurrent Edits**

Everyone thinks they can use CRDT or optimistic merging. You can't with LLM-generated content.

**Why?** When two users issue conflicting prompts, there's no way to merge the results. You have to pick one.

**What they'll do wrong:** Implement CRDT, then realize it doesn't work for LLM content, then spend 3 months ripping it out.

**What to do instead:** Use pessimistic locking for prompts, optimistic for edits.

**3. Billing Reconciliation**

Everyone thinks reservation → charge is simple. It's not.

**Why?** Actual cost is often 2-10x estimated cost due to:
- Retries (each retry costs more)
- Partial failures (refund calculation is complex)
- Token variance (estimation is off)

**What they'll do wrong:** Charge estimated amount, then realize actual is higher, then have to chase down users for payment.

**What to do instead:** Reserve generously, reconcile carefully, refund aggressively.

**4. Wide Research Synthesis**

Everyone thinks you can just merge agent findings. You can't.

**Why?** Agents hallucinate, contradict each other, and find different sources. Merging them is non-trivial.

**What they'll do wrong:** Concatenate agent outputs, get nonsense.

**What to do instead:** Score by consensus, resolve conflicts by voting, use citations to ground findings.

**5. Presentation Generation**

Everyone thinks you can generate slides in one pass. You can't.

**Why?** Slide structure depends on content, which depends on research, which depends on sources. You need multiple passes.

**What they'll do wrong:** Generate slides, realize structure is wrong, start over.

**What to do instead:** Plan → generate → validate → regenerate.

### 5.2 Implicit Assumptions (Undocumented)

**Assumption 1: All clients are online**

We don't support offline-first collaboration. If a client goes offline, edits are lost.

**Assumption 2: LLM API is always available**

We don't have fallback LLMs. If OpenAI is down, we're down.

**Assumption 3: Workspace is single-region**

We don't replicate workspaces across regions. Latency is high for users far from us.

**Assumption 4: Users don't abuse the system**

We assume users won't try to game billing by creating fake runs. We have some detection, but it's not bulletproof.

**Assumption 5: Token counts are stable**

We assume OpenAI's token counts don't change. If they do, our reconciliation breaks.

### 5.3 Things That Only Work Because of Operational Discipline

**1. Billing Accuracy**

We reconcile tokens every day. If we didn't, we'd be off by millions of dollars.

**2. Workspace Consistency**

We have a daily job that validates workspace documents. If we didn't, we'd have corrupted workspaces.

**3. Agent Deduplication**

We have a job that deduplicates agent findings. Without it, we'd have duplicate sources in reports.

**4. Email Idempotency**

We have a job that checks for duplicate emails. Without it, we'd process the same email twice.

### 5.4 Abstractions That Hide Real Complexity

**1. "Optimistic Merging"**

Sounds simple. Actually requires:
- Operational Transformation
- Conflict detection
- Transformation rules for each operation type
- Tiebreaker logic (user_id ordering)

**2. "Wide Research"**

Sounds simple. Actually requires:
- Task decomposition (LLM-based)
- Source deduplication
- Consensus scoring
- Conflict resolution
- Hallucination detection

**3. "Presentation Generation"**

Sounds simple. Actually requires:
- Content planning
- Slide structure determination
- Visual generation
- Speaker notes generation
- PPTX assembly

### 5.5 What to Test in Production First

**1. Token Reconciliation**

Deploy token counting, then run 1000 real tasks. Check variance. If variance > 50%, you have a problem.

**2. Billing Accuracy**

Deploy billing, then manually audit 100 runs. Check if charges match actual usage. If not, you have a problem.

**3. Concurrent Edits**

Deploy collaboration, then have 10 users edit same workspace simultaneously. Check for conflicts. If you get corrupted state, you have a problem.

**4. Wide Research Synthesis**

Deploy wide research, then manually review 10 syntheses. Check for hallucinations and contradictions. If you find them, you have a problem.

**5. Email Idempotency**

Deploy email system, then forward the same email twice. Check if it's processed twice. If it is, you have a problem.

---

## Conclusion

This is the truth. It's not pretty, but it works.

The key principles:
1. **Pessimistic locking for prompts, optimistic for edits**
2. **Reconcile billing aggressively**
3. **Score by consensus, resolve by voting**
4. **Test in production first**
5. **Operational discipline is mandatory**

Good luck rebuilding. You'll need it.

---

**Questions? Escalate to platform team.**
