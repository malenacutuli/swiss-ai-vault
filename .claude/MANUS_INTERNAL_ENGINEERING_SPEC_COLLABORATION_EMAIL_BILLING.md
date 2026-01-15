# Manus Internal Engineering Specification: Collaboration, Email, and Billing Edge Cases

**From:** Manus Platform Technical Lead  
**Classification:** Internal Engineering Documentation  
**Purpose:** Exact implementation specifications for rebuilding core systems  
**Warning:** Conceptual answers will break the system. This document contains only concrete behavior.

---

# PART 1: REAL-TIME COLLABORATION RUNTIME SEMANTICS

## 1.1 Collaboration Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COLLABORATION ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   Load Balancer  │
                    │   (Sticky Sessions)│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Collab   │  │ Collab   │  │ Collab   │
        │ Server 1 │  │ Server 2 │  │ Server 3 │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                    ┌───────▼───────┐
                    │  Redis Pub/Sub │
                    │  (Event Bus)   │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ PostgreSQL│  │   S3     │  │  Agent   │
        │ (State)   │  │ (Files)  │  │ Executor │
        └──────────┘  └──────────┘  └──────────┘
```

## 1.2 Concurrency Model: Operational Transformation (OT)

**We use OT, NOT CRDT.**

**Why OT over CRDT:**
1. OT is deterministic and auditable
2. CRDT merges are mathematically elegant but operationally opaque
3. OT allows explicit conflict resolution rules
4. OT is easier to debug in production

### 1.2.1 OT Operation Types

```sql
CREATE TYPE collab.operation_type AS ENUM (
  'INSERT',      -- Insert text at position
  'DELETE',      -- Delete text at position
  'REPLACE',     -- Replace text at position
  'MOVE',        -- Move block from position to position
  'FORMAT',      -- Apply formatting (bold, italic, etc.)
  'PROMPT',      -- Submit prompt to agent
  'CANCEL',      -- Cancel running agent
  'COMMENT',     -- Add comment
  'RESOLVE'      -- Resolve comment
);
```

### 1.2.2 Operation Schema

```sql
CREATE TABLE collab.operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document reference
  workspace_id UUID NOT NULL,
  document_id UUID NOT NULL,
  
  -- Operation details
  operation_type collab.operation_type NOT NULL,
  
  -- Position (for text operations)
  position INTEGER,           -- Character position
  length INTEGER,             -- Length of affected text
  
  -- Content
  content TEXT,               -- New content (for INSERT, REPLACE)
  old_content TEXT,           -- Old content (for DELETE, REPLACE)
  
  -- Metadata
  metadata JSONB,             -- Operation-specific metadata
  
  -- Versioning
  base_version INTEGER NOT NULL,    -- Version this operation is based on
  result_version INTEGER NOT NULL,  -- Version after applying operation
  
  -- User
  user_id UUID NOT NULL,
  user_role VARCHAR(50) NOT NULL,   -- 'owner', 'collaborator', 'viewer'
  
  -- Timestamps
  client_timestamp TIMESTAMP NOT NULL,  -- When client created operation
  server_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending': Waiting to be applied
    -- 'applied': Successfully applied
    -- 'transformed': Applied after transformation
    -- 'rejected': Rejected (conflict)
    -- 'reverted': Reverted by undo
  
  -- Transformation
  transformed_from UUID,      -- Original operation ID (if transformed)
  transformation_log JSONB,   -- Log of transformations applied
  
  -- Constraints
  CONSTRAINT fk_operations_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_operations_document FOREIGN KEY (document_id) 
    REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_operations_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_operations_workspace_version 
  ON collab.operations(workspace_id, result_version DESC);
CREATE INDEX idx_operations_document_version 
  ON collab.operations(document_id, result_version DESC);
CREATE INDEX idx_operations_user 
  ON collab.operations(user_id, server_timestamp DESC);
CREATE INDEX idx_operations_status 
  ON collab.operations(status) WHERE status = 'pending';
```

### 1.2.3 OT Transformation Rules

```python
class OperationalTransformer:
    """Transform concurrent operations to maintain consistency"""
    
    def transform(self, op1: Operation, op2: Operation) -> Tuple[Operation, Operation]:
        """
        Transform two concurrent operations.
        Returns (op1', op2') where:
          - apply(apply(state, op1), op2') == apply(apply(state, op2), op1')
        """
        
        if op1.type == 'INSERT' and op2.type == 'INSERT':
            return self.transform_insert_insert(op1, op2)
        
        elif op1.type == 'INSERT' and op2.type == 'DELETE':
            return self.transform_insert_delete(op1, op2)
        
        elif op1.type == 'DELETE' and op2.type == 'INSERT':
            op2_prime, op1_prime = self.transform_insert_delete(op2, op1)
            return op1_prime, op2_prime
        
        elif op1.type == 'DELETE' and op2.type == 'DELETE':
            return self.transform_delete_delete(op1, op2)
        
        elif op1.type == 'PROMPT' or op2.type == 'PROMPT':
            return self.transform_prompt(op1, op2)
        
        else:
            # Default: no transformation needed
            return op1, op2
    
    def transform_insert_insert(self, op1: Operation, op2: Operation) -> Tuple[Operation, Operation]:
        """
        Transform two INSERT operations.
        
        Rule: If same position, user with lower user_id wins (deterministic).
        """
        if op1.position < op2.position:
            # op1 is before op2, shift op2 right
            op2_prime = op2.copy()
            op2_prime.position += len(op1.content)
            return op1, op2_prime
        
        elif op1.position > op2.position:
            # op2 is before op1, shift op1 right
            op1_prime = op1.copy()
            op1_prime.position += len(op2.content)
            return op1_prime, op2
        
        else:
            # Same position: deterministic tie-breaker
            if op1.user_id < op2.user_id:
                # op1 wins, shift op2 right
                op2_prime = op2.copy()
                op2_prime.position += len(op1.content)
                return op1, op2_prime
            else:
                # op2 wins, shift op1 right
                op1_prime = op1.copy()
                op1_prime.position += len(op2.content)
                return op1_prime, op2
    
    def transform_insert_delete(self, insert_op: Operation, delete_op: Operation) -> Tuple[Operation, Operation]:
        """
        Transform INSERT and DELETE operations.
        
        Rule: INSERT takes precedence over DELETE at same position.
        """
        delete_end = delete_op.position + delete_op.length
        
        if insert_op.position <= delete_op.position:
            # Insert is before delete, shift delete right
            delete_prime = delete_op.copy()
            delete_prime.position += len(insert_op.content)
            return insert_op, delete_prime
        
        elif insert_op.position >= delete_end:
            # Insert is after delete, shift insert left
            insert_prime = insert_op.copy()
            insert_prime.position -= delete_op.length
            return insert_prime, delete_op
        
        else:
            # Insert is inside delete range
            # Split delete around insert
            delete_prime = delete_op.copy()
            delete_prime.length = insert_op.position - delete_op.position
            
            # Create second delete for remainder
            delete_remainder = Operation(
                type='DELETE',
                position=insert_op.position + len(insert_op.content),
                length=delete_end - insert_op.position,
                user_id=delete_op.user_id
            )
            
            # Return insert unchanged, delete split
            return insert_op, (delete_prime, delete_remainder)
    
    def transform_delete_delete(self, op1: Operation, op2: Operation) -> Tuple[Operation, Operation]:
        """
        Transform two DELETE operations.
        
        Rule: Overlapping deletes are merged (no double-delete).
        """
        op1_end = op1.position + op1.length
        op2_end = op2.position + op2.length
        
        # No overlap
        if op1_end <= op2.position:
            # op1 is before op2, shift op2 left
            op2_prime = op2.copy()
            op2_prime.position -= op1.length
            return op1, op2_prime
        
        elif op2_end <= op1.position:
            # op2 is before op1, shift op1 left
            op1_prime = op1.copy()
            op1_prime.position -= op2.length
            return op1_prime, op2
        
        else:
            # Overlapping deletes
            # Calculate non-overlapping portions
            overlap_start = max(op1.position, op2.position)
            overlap_end = min(op1_end, op2_end)
            overlap_length = overlap_end - overlap_start
            
            # Reduce op2's length by overlap (op1 already deleted it)
            op2_prime = op2.copy()
            op2_prime.length -= overlap_length
            
            if op2.position < op1.position:
                # op2 starts before op1
                pass  # Position unchanged
            else:
                # op2 starts at or after op1
                op2_prime.position = op1.position
            
            # If op2 is fully contained in op1, it becomes a no-op
            if op2_prime.length <= 0:
                op2_prime = Operation(type='NOOP')
            
            return op1, op2_prime
    
    def transform_prompt(self, op1: Operation, op2: Operation) -> Tuple[Operation, Operation]:
        """
        Transform PROMPT operations.
        
        Rule: PROMPT operations cannot be merged. Use pessimistic locking.
        """
        # If both are PROMPT, reject the later one
        if op1.type == 'PROMPT' and op2.type == 'PROMPT':
            if op1.client_timestamp < op2.client_timestamp:
                op2_prime = op2.copy()
                op2_prime.status = 'rejected'
                op2_prime.rejection_reason = 'concurrent_prompt'
                return op1, op2_prime
            else:
                op1_prime = op1.copy()
                op1_prime.status = 'rejected'
                op1_prime.rejection_reason = 'concurrent_prompt'
                return op1_prime, op2
        
        # If one is PROMPT, queue text operations until PROMPT completes
        if op1.type == 'PROMPT':
            op2_prime = op2.copy()
            op2_prime.status = 'queued'
            op2_prime.queued_behind = op1.id
            return op1, op2_prime
        
        if op2.type == 'PROMPT':
            op1_prime = op1.copy()
            op1_prime.status = 'queued'
            op1_prime.queued_behind = op2.id
            return op1_prime, op2
        
        return op1, op2
```

## 1.3 Prompt Handling: Owner Approval vs Immediate Execution

### 1.3.1 Prompt Permission Model

```sql
CREATE TABLE collab.workspace_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Role
  role VARCHAR(50) NOT NULL,
    -- 'owner': Full control
    -- 'editor': Can edit, prompt with approval
    -- 'prompter': Can prompt with approval
    -- 'viewer': Read-only
  
  -- Prompt permissions
  can_prompt_immediately BOOLEAN DEFAULT FALSE,
    -- TRUE: Prompts execute immediately (uses owner's credits)
    -- FALSE: Prompts require owner approval
  
  credit_limit_usd DECIMAL(12, 8),
    -- Maximum credits this user can spend per day
    -- NULL = unlimited (for owner)
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_permissions_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_permissions_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);
```

### 1.3.2 Prompt Submission Flow

```python
class PromptHandler:
    """Handle prompt submissions from collaborators"""
    
    async def submit_prompt(
        self,
        workspace_id: str,
        user_id: str,
        prompt: str,
        metadata: dict
    ) -> PromptResult:
        """
        Submit a prompt to the workspace.
        
        Returns:
          - EXECUTED: Prompt executed immediately
          - QUEUED: Prompt queued for owner approval
          - REJECTED: Prompt rejected (no permission)
        """
        
        # 1. Get user permissions
        permissions = await self.get_permissions(workspace_id, user_id)
        
        if permissions is None:
            return PromptResult(
                status='REJECTED',
                reason='no_access'
            )
        
        # 2. Check if user can prompt
        if permissions.role == 'viewer':
            return PromptResult(
                status='REJECTED',
                reason='viewer_cannot_prompt'
            )
        
        # 3. Acquire prompt lock (pessimistic locking)
        lock_acquired = await self.acquire_prompt_lock(workspace_id, timeout=30)
        
        if not lock_acquired:
            return PromptResult(
                status='REJECTED',
                reason='another_prompt_in_progress',
                retry_after=30
            )
        
        try:
            # 4. Check if immediate execution allowed
            if permissions.can_prompt_immediately:
                # 4a. Check credit limit
                if permissions.credit_limit_usd is not None:
                    daily_usage = await self.get_daily_usage(workspace_id, user_id)
                    estimated_cost = await self.estimate_prompt_cost(prompt)
                    
                    if daily_usage + estimated_cost > permissions.credit_limit_usd:
                        return PromptResult(
                            status='REJECTED',
                            reason='credit_limit_exceeded',
                            daily_usage=daily_usage,
                            credit_limit=permissions.credit_limit_usd
                        )
                
                # 4b. Execute immediately
                run = await self.execute_prompt(
                    workspace_id=workspace_id,
                    prompt=prompt,
                    triggered_by=user_id,
                    credit_source='owner'  # Always charge owner
                )
                
                return PromptResult(
                    status='EXECUTED',
                    run_id=run.id
                )
            
            else:
                # 4c. Queue for owner approval
                pending_prompt = await self.queue_prompt(
                    workspace_id=workspace_id,
                    prompt=prompt,
                    submitted_by=user_id
                )
                
                # 4d. Notify owner
                await self.notify_owner(
                    workspace_id=workspace_id,
                    event='prompt_pending_approval',
                    prompt_id=pending_prompt.id,
                    submitted_by=user_id
                )
                
                return PromptResult(
                    status='QUEUED',
                    prompt_id=pending_prompt.id
                )
        
        finally:
            # 5. Release prompt lock
            await self.release_prompt_lock(workspace_id)
    
    async def acquire_prompt_lock(self, workspace_id: str, timeout: int) -> bool:
        """
        Acquire pessimistic lock for prompt execution.
        
        Uses Redis with TTL for distributed locking.
        """
        lock_key = f"prompt_lock:{workspace_id}"
        lock_value = str(uuid.uuid4())
        
        # Try to acquire lock with NX (only if not exists)
        acquired = await redis.set(
            lock_key,
            lock_value,
            nx=True,
            ex=timeout
        )
        
        if acquired:
            # Store lock value for release verification
            self.current_locks[workspace_id] = lock_value
            return True
        
        return False
    
    async def release_prompt_lock(self, workspace_id: str):
        """Release prompt lock"""
        lock_key = f"prompt_lock:{workspace_id}"
        lock_value = self.current_locks.get(workspace_id)
        
        if lock_value:
            # Only release if we own the lock
            await redis.eval(
                """
                if redis.call('get', KEYS[1]) == ARGV[1] then
                    return redis.call('del', KEYS[1])
                else
                    return 0
                end
                """,
                1,
                lock_key,
                lock_value
            )
            del self.current_locks[workspace_id]
```

### 1.3.3 Pending Prompt Schema

```sql
CREATE TABLE collab.pending_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL,
  
  -- Prompt details
  prompt TEXT NOT NULL,
  metadata JSONB,
  
  -- Submitter
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending': Waiting for owner approval
    -- 'approved': Owner approved, executing
    -- 'rejected': Owner rejected
    -- 'expired': Timed out (24h)
    -- 'cancelled': Submitter cancelled
  
  -- Approval
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Execution
  run_id UUID,
  
  -- Expiry
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  
  CONSTRAINT fk_pending_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_submitted_by FOREIGN KEY (submitted_by) 
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pending_reviewed_by FOREIGN KEY (reviewed_by) 
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pending_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE SET NULL
);

-- Index for pending prompts
CREATE INDEX idx_pending_prompts_workspace_status 
  ON collab.pending_prompts(workspace_id, status) 
  WHERE status = 'pending';
```

## 1.4 Credit Attribution Rules

### 1.4.1 Credit Attribution Schema

```sql
CREATE TABLE collab.credit_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run reference
  run_id UUID NOT NULL,
  
  -- Attribution
  charged_to_org_id UUID NOT NULL,      -- Organization that pays
  triggered_by_user_id UUID NOT NULL,   -- User who triggered the action
  workspace_owner_id UUID NOT NULL,     -- Owner of the workspace
  
  -- Amounts
  total_cost_usd DECIMAL(12, 8) NOT NULL,
  
  -- Attribution breakdown
  attribution_type VARCHAR(50) NOT NULL,
    -- 'owner_direct': Owner triggered, owner pays
    -- 'collaborator_immediate': Collaborator triggered (immediate), owner pays
    -- 'collaborator_approved': Collaborator triggered (approved), owner pays
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_attribution_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_attribution_org FOREIGN KEY (charged_to_org_id) 
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attribution_triggered_by FOREIGN KEY (triggered_by_user_id) 
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_attribution_owner FOREIGN KEY (workspace_owner_id) 
    REFERENCES users(id) ON DELETE SET NULL
);
```

### 1.4.2 Credit Attribution Rules

```python
class CreditAttributor:
    """Determine who pays for agent execution"""
    
    # RULE 1: Owner ALWAYS pays
    # Rationale: Prevents collaborators from griefing owner's credits
    
    # RULE 2: Triggered_by tracks who initiated
    # Rationale: Audit trail for usage analysis
    
    # RULE 3: Daily limits per collaborator
    # Rationale: Prevents abuse by collaborators
    
    async def attribute_credits(
        self,
        run_id: str,
        workspace_id: str,
        triggered_by_user_id: str,
        cost_usd: float
    ) -> CreditAttribution:
        """
        Attribute credits for a run.
        
        INVARIANT: Owner's organization ALWAYS pays.
        """
        
        # 1. Get workspace owner
        workspace = await self.get_workspace(workspace_id)
        owner_id = workspace.owner_id
        owner_org_id = await self.get_user_org(owner_id)
        
        # 2. Determine attribution type
        if triggered_by_user_id == owner_id:
            attribution_type = 'owner_direct'
        else:
            # Check if collaborator has immediate execution permission
            permissions = await self.get_permissions(workspace_id, triggered_by_user_id)
            if permissions.can_prompt_immediately:
                attribution_type = 'collaborator_immediate'
            else:
                attribution_type = 'collaborator_approved'
        
        # 3. Create attribution record
        attribution = await db.insert('collab.credit_attributions', {
            'run_id': run_id,
            'charged_to_org_id': owner_org_id,  # ALWAYS owner's org
            'triggered_by_user_id': triggered_by_user_id,
            'workspace_owner_id': owner_id,
            'total_cost_usd': cost_usd,
            'attribution_type': attribution_type
        })
        
        # 4. Update collaborator's daily usage (for limit tracking)
        if triggered_by_user_id != owner_id:
            await self.update_daily_usage(
                workspace_id=workspace_id,
                user_id=triggered_by_user_id,
                cost_usd=cost_usd
            )
        
        # 5. Charge owner's organization
        await billing.charge(
            org_id=owner_org_id,
            amount_usd=cost_usd,
            run_id=run_id,
            reason=f'workspace_usage_{attribution_type}'
        )
        
        return attribution
```

## 1.5 Owner Disconnection Handling

### 1.5.1 Presence Tracking Schema

```sql
CREATE TABLE collab.presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Connection
  connection_id VARCHAR(255) NOT NULL,  -- WebSocket connection ID
  server_id VARCHAR(255) NOT NULL,      -- Which server handles this connection
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'online',
    -- 'online': Connected and active
    -- 'idle': Connected but inactive (>5 min)
    -- 'offline': Disconnected
  
  -- Timestamps
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  
  CONSTRAINT fk_presence_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_presence_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_connection UNIQUE (connection_id)
);

-- Index for presence queries
CREATE INDEX idx_presence_workspace_status 
  ON collab.presence(workspace_id, status) 
  WHERE status IN ('online', 'idle');
```

### 1.5.2 Owner Disconnection Behavior

```python
class OwnerDisconnectionHandler:
    """Handle owner disconnection during collaboration"""
    
    # BEHAVIOR RULES:
    # 1. Running agents CONTINUE (don't abort mid-execution)
    # 2. Pending prompts REMAIN pending (don't auto-reject)
    # 3. Collaborators CAN continue editing (OT continues)
    # 4. New prompts from collaborators are QUEUED (not executed)
    # 5. Owner reconnection RESUMES normal operation
    
    async def handle_owner_disconnect(self, workspace_id: str, owner_id: str):
        """Handle owner disconnection"""
        
        # 1. Update presence
        await db.update('collab.presence', {
            'status': 'offline',
            'disconnected_at': datetime.utcnow()
        }, where={'workspace_id': workspace_id, 'user_id': owner_id})
        
        # 2. Check for running agents
        running_runs = await db.query(
            "SELECT id FROM runs WHERE workspace_id = %s AND status = 'running'",
            [workspace_id]
        )
        
        if running_runs:
            # Log but don't abort
            await self.log_event(
                workspace_id=workspace_id,
                event='owner_disconnected_with_running_agents',
                run_ids=[r['id'] for r in running_runs]
            )
        
        # 3. Notify collaborators
        await self.broadcast_to_workspace(
            workspace_id=workspace_id,
            event='owner_status_changed',
            data={'status': 'offline', 'owner_id': owner_id}
        )
        
        # 4. Update workspace state
        await db.update('workspaces', {
            'owner_online': False,
            'owner_last_seen': datetime.utcnow()
        }, where={'id': workspace_id})
    
    async def handle_owner_reconnect(self, workspace_id: str, owner_id: str):
        """Handle owner reconnection"""
        
        # 1. Update presence
        await db.update('collab.presence', {
            'status': 'online',
            'connected_at': datetime.utcnow(),
            'disconnected_at': None
        }, where={'workspace_id': workspace_id, 'user_id': owner_id})
        
        # 2. Get pending prompts
        pending_prompts = await db.query(
            """
            SELECT id, prompt, submitted_by, submitted_at 
            FROM collab.pending_prompts 
            WHERE workspace_id = %s AND status = 'pending'
            ORDER BY submitted_at ASC
            """,
            [workspace_id]
        )
        
        # 3. Notify owner of pending prompts
        if pending_prompts:
            await self.notify_user(
                user_id=owner_id,
                event='pending_prompts_waiting',
                data={'prompts': pending_prompts}
            )
        
        # 4. Notify collaborators
        await self.broadcast_to_workspace(
            workspace_id=workspace_id,
            event='owner_status_changed',
            data={'status': 'online', 'owner_id': owner_id}
        )
        
        # 5. Update workspace state
        await db.update('workspaces', {
            'owner_online': True
        }, where={'id': workspace_id})
    
    async def handle_collaborator_prompt_while_owner_offline(
        self,
        workspace_id: str,
        user_id: str,
        prompt: str
    ) -> PromptResult:
        """Handle prompt submission while owner is offline"""
        
        # Check if owner is online
        owner_online = await self.is_owner_online(workspace_id)
        
        if not owner_online:
            # Queue prompt (even if user has immediate execution permission)
            pending_prompt = await db.insert('collab.pending_prompts', {
                'workspace_id': workspace_id,
                'prompt': prompt,
                'submitted_by': user_id,
                'status': 'pending',
                'metadata': {'owner_offline': True}
            })
            
            return PromptResult(
                status='QUEUED',
                reason='owner_offline',
                prompt_id=pending_prompt['id']
            )
        
        # Owner is online, use normal flow
        return await self.submit_prompt(workspace_id, user_id, prompt, {})
```

## 1.6 Conflict Resolution Testing

### 1.6.1 Test Cases

```python
class CollaborationTestCases:
    """Test cases for conflict resolution"""
    
    # =========================================
    # TEST CASE 1: Concurrent INSERT at same position
    # =========================================
    async def test_concurrent_insert_same_position(self):
        """
        User A inserts "Hello" at position 0
        User B inserts "World" at position 0 (concurrent)
        
        Expected: Deterministic order based on user_id
        """
        # Setup
        doc = await create_document(content="")
        user_a = await create_user(id="user_a")  # Lower ID
        user_b = await create_user(id="user_b")  # Higher ID
        
        # Concurrent operations
        op_a = Operation(type='INSERT', position=0, content='Hello', user_id='user_a', base_version=0)
        op_b = Operation(type='INSERT', position=0, content='World', user_id='user_b', base_version=0)
        
        # Transform
        op_a_prime, op_b_prime = transformer.transform(op_a, op_b)
        
        # Apply
        result = apply(apply(doc, op_a), op_b_prime)
        
        # Assert: user_a wins (lower ID), so "HelloWorld"
        assert result.content == "HelloWorld"
        assert op_b_prime.position == 5  # Shifted right by "Hello"
    
    # =========================================
    # TEST CASE 2: INSERT inside DELETE range
    # =========================================
    async def test_insert_inside_delete(self):
        """
        Document: "Hello World"
        User A deletes "Hello " (position 0, length 6)
        User B inserts "Beautiful " at position 6 (concurrent)
        
        Expected: Insert preserved, delete split
        """
        doc = await create_document(content="Hello World")
        
        op_a = Operation(type='DELETE', position=0, length=6, user_id='user_a', base_version=0)
        op_b = Operation(type='INSERT', position=6, content='Beautiful ', user_id='user_b', base_version=0)
        
        # Transform
        op_a_prime, op_b_prime = transformer.transform(op_a, op_b)
        
        # Apply
        result = apply(apply(doc, op_a), op_b_prime)
        
        # Assert: "Beautiful World" (insert preserved)
        assert result.content == "Beautiful World"
    
    # =========================================
    # TEST CASE 3: Overlapping DELETEs
    # =========================================
    async def test_overlapping_deletes(self):
        """
        Document: "Hello Beautiful World"
        User A deletes "Hello Beautiful" (position 0, length 15)
        User B deletes "Beautiful World" (position 6, length 15) (concurrent)
        
        Expected: No double-delete, merged result
        """
        doc = await create_document(content="Hello Beautiful World")
        
        op_a = Operation(type='DELETE', position=0, length=15, user_id='user_a', base_version=0)
        op_b = Operation(type='DELETE', position=6, length=15, user_id='user_b', base_version=0)
        
        # Transform
        op_a_prime, op_b_prime = transformer.transform(op_a, op_b)
        
        # Apply
        result = apply(apply(doc, op_a), op_b_prime)
        
        # Assert: "" (everything deleted, no double-delete)
        assert result.content == ""
    
    # =========================================
    # TEST CASE 4: Concurrent PROMPTs
    # =========================================
    async def test_concurrent_prompts(self):
        """
        User A submits prompt "Write a poem"
        User B submits prompt "Write a story" (concurrent)
        
        Expected: Earlier prompt wins, later is rejected
        """
        workspace = await create_workspace()
        user_a = await create_user()
        user_b = await create_user()
        
        # Concurrent prompts (A is 100ms earlier)
        op_a = Operation(
            type='PROMPT', 
            content='Write a poem', 
            user_id=user_a.id, 
            client_timestamp=datetime(2024, 1, 1, 12, 0, 0, 0)
        )
        op_b = Operation(
            type='PROMPT', 
            content='Write a story', 
            user_id=user_b.id, 
            client_timestamp=datetime(2024, 1, 1, 12, 0, 0, 100000)  # 100ms later
        )
        
        # Transform
        op_a_prime, op_b_prime = transformer.transform(op_a, op_b)
        
        # Assert: A wins, B rejected
        assert op_a_prime.status == 'applied'
        assert op_b_prime.status == 'rejected'
        assert op_b_prime.rejection_reason == 'concurrent_prompt'
    
    # =========================================
    # TEST CASE 5: Owner disconnection during agent execution
    # =========================================
    async def test_owner_disconnect_during_execution(self):
        """
        Owner starts agent execution
        Owner disconnects mid-execution
        
        Expected: Agent continues to completion
        """
        workspace = await create_workspace()
        owner = workspace.owner
        
        # Start execution
        run = await start_run(workspace_id=workspace.id, prompt="Write a report")
        assert run.status == 'running'
        
        # Owner disconnects
        await handle_owner_disconnect(workspace.id, owner.id)
        
        # Check run status
        run = await get_run(run.id)
        assert run.status == 'running'  # Still running
        
        # Wait for completion
        await wait_for_run(run.id)
        
        run = await get_run(run.id)
        assert run.status == 'completed'  # Completed successfully
    
    # =========================================
    # TEST CASE 6: Credit attribution for collaborator
    # =========================================
    async def test_credit_attribution_collaborator(self):
        """
        Collaborator triggers prompt
        
        Expected: Owner's org is charged, collaborator is tracked
        """
        workspace = await create_workspace()
        owner = workspace.owner
        collaborator = await add_collaborator(workspace.id, can_prompt_immediately=True)
        
        # Collaborator submits prompt
        result = await submit_prompt(
            workspace_id=workspace.id,
            user_id=collaborator.id,
            prompt="Write something"
        )
        
        # Wait for completion
        run = await wait_for_run(result.run_id)
        
        # Check attribution
        attribution = await get_attribution(run.id)
        assert attribution.charged_to_org_id == owner.org_id  # Owner pays
        assert attribution.triggered_by_user_id == collaborator.id  # Collaborator tracked
        assert attribution.attribution_type == 'collaborator_immediate'
```

## 1.7 WebSocket Architecture

### 1.7.1 WebSocket Connection Schema

```sql
CREATE TABLE collab.websocket_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Connection
  connection_id VARCHAR(255) NOT NULL UNIQUE,
  server_id VARCHAR(255) NOT NULL,
  
  -- User
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'connected',
    -- 'connected': Active connection
    -- 'disconnected': Graceful disconnect
    -- 'terminated': Server terminated
  
  -- Timestamps
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_ping_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  
  -- Metadata
  client_version VARCHAR(50),
  user_agent TEXT,
  ip_address INET,
  
  CONSTRAINT fk_ws_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ws_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Index for connection lookups
CREATE INDEX idx_ws_connections_workspace 
  ON collab.websocket_connections(workspace_id) 
  WHERE status = 'connected';
CREATE INDEX idx_ws_connections_server 
  ON collab.websocket_connections(server_id) 
  WHERE status = 'connected';
```

### 1.7.2 WebSocket Event Flow

```python
class WebSocketHandler:
    """Handle WebSocket connections for real-time collaboration"""
    
    # Event types
    EVENTS = {
        # Client -> Server
        'operation': 'Client submits an operation',
        'cursor_move': 'Client cursor position changed',
        'selection_change': 'Client selection changed',
        'ping': 'Client heartbeat',
        
        # Server -> Client
        'operation_ack': 'Server acknowledges operation',
        'operation_broadcast': 'Broadcast operation to other clients',
        'cursor_update': 'Other client cursor moved',
        'selection_update': 'Other client selection changed',
        'presence_update': 'User joined/left/status changed',
        'pong': 'Server heartbeat response',
        'error': 'Error message',
    }
    
    async def handle_connection(self, websocket, user_id: str, workspace_id: str):
        """Handle new WebSocket connection"""
        
        connection_id = str(uuid.uuid4())
        server_id = os.environ.get('SERVER_ID')
        
        # 1. Register connection
        await db.insert('collab.websocket_connections', {
            'connection_id': connection_id,
            'server_id': server_id,
            'user_id': user_id,
            'workspace_id': workspace_id,
            'status': 'connected'
        })
        
        # 2. Subscribe to Redis channel for this workspace
        pubsub = redis.pubsub()
        await pubsub.subscribe(f'workspace:{workspace_id}')
        
        # 3. Broadcast presence update
        await self.broadcast_presence(workspace_id, user_id, 'joined')
        
        # 4. Send current document state
        document = await self.get_document_state(workspace_id)
        await websocket.send(json.dumps({
            'type': 'document_state',
            'data': document
        }))
        
        # 5. Send current presence
        presence = await self.get_presence(workspace_id)
        await websocket.send(json.dumps({
            'type': 'presence_state',
            'data': presence
        }))
        
        try:
            # 6. Handle messages
            async for message in websocket:
                await self.handle_message(websocket, connection_id, message)
        
        finally:
            # 7. Cleanup on disconnect
            await self.handle_disconnect(connection_id, workspace_id, user_id)
    
    async def handle_message(self, websocket, connection_id: str, message: str):
        """Handle incoming WebSocket message"""
        
        data = json.loads(message)
        event_type = data.get('type')
        
        if event_type == 'operation':
            await self.handle_operation(websocket, connection_id, data)
        
        elif event_type == 'cursor_move':
            await self.handle_cursor_move(connection_id, data)
        
        elif event_type == 'selection_change':
            await self.handle_selection_change(connection_id, data)
        
        elif event_type == 'ping':
            await self.handle_ping(websocket, connection_id)
        
        else:
            await websocket.send(json.dumps({
                'type': 'error',
                'error': f'Unknown event type: {event_type}'
            }))
    
    async def handle_operation(self, websocket, connection_id: str, data: dict):
        """Handle operation from client"""
        
        operation = data.get('operation')
        workspace_id = data.get('workspace_id')
        
        # 1. Get current document version
        current_version = await self.get_document_version(workspace_id)
        
        # 2. Check if operation is based on current version
        if operation['base_version'] != current_version:
            # Need to transform against missed operations
            missed_ops = await self.get_operations_since(
                workspace_id, 
                operation['base_version']
            )
            
            for missed_op in missed_ops:
                operation, _ = self.transformer.transform(operation, missed_op)
        
        # 3. Apply operation
        result_version = current_version + 1
        operation['result_version'] = result_version
        
        await db.insert('collab.operations', operation)
        
        # 4. Update document
        await self.apply_operation_to_document(workspace_id, operation)
        
        # 5. Acknowledge to sender
        await websocket.send(json.dumps({
            'type': 'operation_ack',
            'operation_id': operation['id'],
            'result_version': result_version
        }))
        
        # 6. Broadcast to other clients
        await redis.publish(f'workspace:{workspace_id}', json.dumps({
            'type': 'operation_broadcast',
            'operation': operation,
            'exclude_connection': connection_id
        }))
    
    async def handle_disconnect(self, connection_id: str, workspace_id: str, user_id: str):
        """Handle WebSocket disconnect"""
        
        # 1. Update connection status
        await db.update('collab.websocket_connections', {
            'status': 'disconnected',
            'disconnected_at': datetime.utcnow()
        }, where={'connection_id': connection_id})
        
        # 2. Check if user has other connections to this workspace
        other_connections = await db.query(
            """
            SELECT COUNT(*) as count FROM collab.websocket_connections
            WHERE workspace_id = %s AND user_id = %s AND status = 'connected'
            """,
            [workspace_id, user_id]
        )
        
        if other_connections[0]['count'] == 0:
            # 3. User fully disconnected, broadcast presence update
            await self.broadcast_presence(workspace_id, user_id, 'left')
            
            # 4. Check if this is the owner
            workspace = await db.get('workspaces', workspace_id)
            if workspace['owner_id'] == user_id:
                await self.handle_owner_disconnect(workspace_id, user_id)
```

### 1.7.3 Redis Pub/Sub Architecture

```python
class RedisPubSubHandler:
    """Handle Redis Pub/Sub for cross-server communication"""
    
    async def subscribe_to_workspace(self, workspace_id: str, callback):
        """Subscribe to workspace channel"""
        
        channel = f'workspace:{workspace_id}'
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        
        async for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'])
                await callback(data)
    
    async def publish_to_workspace(self, workspace_id: str, event: dict):
        """Publish event to workspace channel"""
        
        channel = f'workspace:{workspace_id}'
        await redis.publish(channel, json.dumps(event))
    
    async def broadcast_operation(self, workspace_id: str, operation: dict, exclude_connection: str = None):
        """Broadcast operation to all clients in workspace"""
        
        await self.publish_to_workspace(workspace_id, {
            'type': 'operation_broadcast',
            'operation': operation,
            'exclude_connection': exclude_connection
        })
    
    async def broadcast_presence(self, workspace_id: str, user_id: str, status: str):
        """Broadcast presence update to all clients in workspace"""
        
        await self.publish_to_workspace(workspace_id, {
            'type': 'presence_update',
            'user_id': user_id,
            'status': status,
            'timestamp': datetime.utcnow().isoformat()
        })
```

## 1.8 Failure Scenarios

### 1.8.1 Scenario: Server Crash During Operation

```python
async def handle_server_crash_recovery(server_id: str):
    """
    Recover from server crash.
    
    Problem: Server crashes with pending operations.
    Solution: Other servers detect and recover.
    """
    
    # 1. Detect crashed server (no heartbeat for 30s)
    crashed_connections = await db.query(
        """
        SELECT * FROM collab.websocket_connections
        WHERE server_id = %s AND status = 'connected'
        """,
        [server_id]
    )
    
    # 2. Mark connections as terminated
    await db.update('collab.websocket_connections', {
        'status': 'terminated',
        'disconnected_at': datetime.utcnow()
    }, where={'server_id': server_id, 'status': 'connected'})
    
    # 3. Broadcast presence updates for affected users
    for conn in crashed_connections:
        await broadcast_presence(
            conn['workspace_id'],
            conn['user_id'],
            'disconnected_server_crash'
        )
    
    # 4. Check for pending operations
    pending_ops = await db.query(
        """
        SELECT * FROM collab.operations
        WHERE status = 'pending'
        ORDER BY server_timestamp ASC
        """,
        []
    )
    
    # 5. Retry pending operations
    for op in pending_ops:
        try:
            await apply_operation(op)
            await db.update('collab.operations', {
                'status': 'applied'
            }, where={'id': op['id']})
        except Exception as e:
            await db.update('collab.operations', {
                'status': 'failed',
                'error_message': str(e)
            }, where={'id': op['id']})
```

### 1.8.2 Scenario: Network Partition

```python
async def handle_network_partition(workspace_id: str):
    """
    Handle network partition between collaboration servers.
    
    Problem: Two servers can't communicate, both accepting operations.
    Solution: Detect partition, pause operations, resolve on reconnect.
    """
    
    # 1. Detect partition (can't reach other servers)
    partition_detected = await detect_partition()
    
    if partition_detected:
        # 2. Pause accepting new operations
        await set_workspace_mode(workspace_id, 'partition_recovery')
        
        # 3. Notify clients
        await broadcast_to_workspace(workspace_id, {
            'type': 'partition_detected',
            'message': 'Network issue detected. Operations paused.'
        })
        
        # 4. Wait for partition to heal
        await wait_for_partition_heal()
        
        # 5. Collect operations from all partitions
        all_ops = await collect_operations_from_all_servers(workspace_id)
        
        # 6. Sort by timestamp and transform
        sorted_ops = sorted(all_ops, key=lambda x: x['client_timestamp'])
        
        # 7. Apply in order with transformation
        for i, op in enumerate(sorted_ops):
            for prev_op in sorted_ops[:i]:
                op, _ = transformer.transform(op, prev_op)
            await apply_operation(op)
        
        # 8. Resume normal operation
        await set_workspace_mode(workspace_id, 'normal')
        
        # 9. Notify clients
        await broadcast_to_workspace(workspace_id, {
            'type': 'partition_resolved',
            'message': 'Network issue resolved. Operations resumed.'
        })
```

---

# PART 2: EMAIL PROCESSING PIPELINE

## 2.1 Email Ingestion Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EMAIL INGESTION PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

External Email
      │
      ▼
┌──────────────┐
│   MX Record  │  (mail.manus.im)
│   Receiver   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   SMTP       │  (Postfix)
│   Server     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Email      │  (Validate SPF/DKIM/DMARC)
│   Validator  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Dedup      │  (Check Message-ID)
│   Service    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Parser     │  (Extract body, attachments)
│   Service    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Queue      │  (Redis/SQS)
│   (emails)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Processor  │  (Route to workspace/agent)
│   Worker     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Agent      │  (Process email content)
│   Executor   │
└──────────────┘
```

## 2.2 Email Schema

```sql
CREATE TABLE email.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Message identification
  message_id VARCHAR(255) NOT NULL,           -- RFC 5322 Message-ID
  message_id_hash VARCHAR(64) NOT NULL,       -- SHA-256 of Message-ID
  
  -- Threading
  in_reply_to VARCHAR(255),                   -- In-Reply-To header
  references TEXT[],                          -- References header (array)
  thread_id UUID,                             -- Our internal thread ID
  
  -- Envelope
  envelope_from VARCHAR(255) NOT NULL,        -- MAIL FROM
  envelope_to VARCHAR(255)[] NOT NULL,        -- RCPT TO (array)
  
  -- Headers
  header_from VARCHAR(255) NOT NULL,          -- From header
  header_to VARCHAR(255)[] NOT NULL,          -- To header (array)
  header_cc VARCHAR(255)[],                   -- CC header (array)
  header_subject TEXT,                        -- Subject header
  header_date TIMESTAMP,                      -- Date header
  
  -- Body
  body_text TEXT,                             -- Plain text body
  body_html TEXT,                             -- HTML body
  body_text_length INTEGER,                   -- Length of text body
  body_html_length INTEGER,                   -- Length of HTML body
  
  -- Attachments
  attachment_count INTEGER DEFAULT 0,
  total_attachment_size_bytes BIGINT DEFAULT 0,
  
  -- Security validation
  spf_result VARCHAR(50),                     -- 'pass', 'fail', 'softfail', 'neutral', 'none'
  dkim_result VARCHAR(50),                    -- 'pass', 'fail', 'none'
  dmarc_result VARCHAR(50),                   -- 'pass', 'fail', 'none'
  spam_score DECIMAL(5, 2),                   -- SpamAssassin score
  
  -- Processing
  status VARCHAR(50) NOT NULL DEFAULT 'received',
    -- 'received': Just received
    -- 'validated': Passed security checks
    -- 'parsed': Body and attachments extracted
    -- 'queued': Queued for processing
    -- 'processing': Being processed by agent
    -- 'completed': Successfully processed
    -- 'failed': Processing failed
    -- 'rejected': Rejected (spam, spoofing, etc.)
  
  -- Routing
  workspace_id UUID,                          -- Routed to workspace
  run_id UUID,                                -- Created run ID
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP,
  parsed_at TIMESTAMP,
  queued_at TIMESTAMP,
  processing_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  
  -- Raw storage
  raw_email_s3_key VARCHAR(255),              -- S3 key for raw email
  
  -- Constraints
  CONSTRAINT unique_message_id_hash UNIQUE (message_id_hash),
  CONSTRAINT fk_email_workspace FOREIGN KEY (workspace_id) 
    REFERENCES workspaces(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_emails_message_id_hash ON email.inbound_emails(message_id_hash);
CREATE INDEX idx_emails_status ON email.inbound_emails(status);
CREATE INDEX idx_emails_workspace ON email.inbound_emails(workspace_id);
CREATE INDEX idx_emails_thread ON email.inbound_emails(thread_id);
CREATE INDEX idx_emails_received ON email.inbound_emails(received_at DESC);
CREATE INDEX idx_emails_retry ON email.inbound_emails(next_retry_at) 
  WHERE status = 'failed' AND retry_count < 3;
```

## 2.3 Attachment Schema

```sql
CREATE TABLE email.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email reference
  email_id UUID NOT NULL,
  
  -- Attachment details
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(255) NOT NULL,
  content_id VARCHAR(255),                    -- For inline attachments
  size_bytes BIGINT NOT NULL,
  
  -- Storage
  s3_key VARCHAR(255) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  
  -- Security
  malware_scan_result VARCHAR(50),            -- 'clean', 'infected', 'error'
  malware_scan_at TIMESTAMP,
  
  -- Metadata
  is_inline BOOLEAN DEFAULT FALSE,
  checksum_sha256 VARCHAR(64),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_attachment_email FOREIGN KEY (email_id) 
    REFERENCES email.inbound_emails(id) ON DELETE CASCADE,
  CONSTRAINT check_size_limit CHECK (size_bytes <= 26214400)  -- 25MB limit
);

-- Indexes
CREATE INDEX idx_attachments_email ON email.attachments(email_id);
CREATE INDEX idx_attachments_content_type ON email.attachments(content_type);
```

## 2.4 Email State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EMAIL STATE MACHINE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │ RECEIVED │
                              └────┬─────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ REJECTED │  │VALIDATED │  │  FAILED  │
              │ (spam)   │  │          │  │ (retry)  │
              └──────────┘  └────┬─────┘  └────┬─────┘
                                 │              │
                                 ▼              │
                           ┌──────────┐         │
                           │  PARSED  │◄────────┘
                           └────┬─────┘
                                │
                                ▼
                           ┌──────────┐
                           │  QUEUED  │
                           └────┬─────┘
                                │
                                ▼
                          ┌───────────┐
                          │PROCESSING │
                          └────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │                     │
                    ▼                     ▼
              ┌──────────┐          ┌──────────┐
              │COMPLETED │          │  FAILED  │
              └──────────┘          │ (retry)  │
                                    └──────────┘

State Transitions:
  RECEIVED → VALIDATED: SPF/DKIM/DMARC pass
  RECEIVED → REJECTED: SPF/DKIM/DMARC fail OR spam score > 5.0
  RECEIVED → FAILED: Validation error (retry)
  VALIDATED → PARSED: Body and attachments extracted
  VALIDATED → FAILED: Parse error (retry)
  PARSED → QUEUED: Added to processing queue
  QUEUED → PROCESSING: Worker picked up
  PROCESSING → COMPLETED: Agent finished successfully
  PROCESSING → FAILED: Agent error (retry up to 3 times)
  FAILED → VALIDATED/PARSED/QUEUED: Retry (based on where it failed)
```

## 2.5 Idempotency and Deduplication

```python
class EmailDeduplicator:
    """Ensure each email is processed exactly once"""
    
    async def check_duplicate(self, message_id: str) -> Tuple[bool, Optional[str]]:
        """
        Check if email is a duplicate.
        
        Returns:
          (is_duplicate, existing_email_id)
        """
        
        # 1. Hash the Message-ID
        message_id_hash = hashlib.sha256(message_id.encode()).hexdigest()
        
        # 2. Check database
        existing = await db.query(
            """
            SELECT id, status FROM email.inbound_emails
            WHERE message_id_hash = %s
            LIMIT 1
            """,
            [message_id_hash]
        )
        
        if existing:
            return True, existing[0]['id']
        
        # 3. Check Redis (for in-flight emails)
        redis_key = f"email:processing:{message_id_hash}"
        in_flight = await redis.get(redis_key)
        
        if in_flight:
            return True, in_flight.decode()
        
        return False, None
    
    async def mark_processing(self, message_id: str, email_id: str):
        """Mark email as being processed (for dedup during processing)"""
        
        message_id_hash = hashlib.sha256(message_id.encode()).hexdigest()
        redis_key = f"email:processing:{message_id_hash}"
        
        # Set with 1 hour TTL (processing should complete within 1 hour)
        await redis.set(redis_key, email_id, ex=3600)
    
    async def clear_processing(self, message_id: str):
        """Clear processing marker after completion"""
        
        message_id_hash = hashlib.sha256(message_id.encode()).hexdigest()
        redis_key = f"email:processing:{message_id_hash}"
        
        await redis.delete(redis_key)
    
    async def handle_forwarded_email(self, email: dict) -> str:
        """
        Handle forwarded emails (may have same Message-ID).
        
        Strategy: Use combination of Message-ID + envelope_from + received_at
        """
        
        # 1. Create composite key
        composite = f"{email['message_id']}:{email['envelope_from']}:{email['received_at'].isoformat()}"
        composite_hash = hashlib.sha256(composite.encode()).hexdigest()
        
        # 2. Check for duplicate
        existing = await db.query(
            """
            SELECT id FROM email.inbound_emails
            WHERE message_id_hash = %s
              OR (message_id = %s AND envelope_from = %s AND received_at = %s)
            LIMIT 1
            """,
            [composite_hash, email['message_id'], email['envelope_from'], email['received_at']]
        )
        
        if existing:
            return existing[0]['id']  # Return existing email ID
        
        # 3. Not a duplicate, use composite hash
        return composite_hash
```

## 2.6 Security Validation

```python
class EmailSecurityValidator:
    """Validate email security (SPF, DKIM, DMARC)"""
    
    async def validate(self, email: dict) -> ValidationResult:
        """
        Validate email security.
        
        Returns ValidationResult with:
          - is_valid: Whether email passes security checks
          - spf_result: SPF check result
          - dkim_result: DKIM check result
          - dmarc_result: DMARC check result
          - rejection_reason: Why email was rejected (if any)
        """
        
        # 1. SPF Check
        spf_result = await self.check_spf(
            ip=email['source_ip'],
            domain=email['envelope_from'].split('@')[1],
            sender=email['envelope_from']
        )
        
        # 2. DKIM Check
        dkim_result = await self.check_dkim(
            raw_email=email['raw_email']
        )
        
        # 3. DMARC Check
        dmarc_result = await self.check_dmarc(
            domain=email['header_from'].split('@')[1],
            spf_result=spf_result,
            dkim_result=dkim_result
        )
        
        # 4. Spam Score
        spam_score = await self.calculate_spam_score(email)
        
        # 5. Determine validity
        is_valid = True
        rejection_reason = None
        
        # DMARC fail = reject
        if dmarc_result == 'fail':
            is_valid = False
            rejection_reason = 'dmarc_fail'
        
        # Both SPF and DKIM fail = reject
        elif spf_result == 'fail' and dkim_result == 'fail':
            is_valid = False
            rejection_reason = 'spf_and_dkim_fail'
        
        # High spam score = reject
        elif spam_score > 5.0:
            is_valid = False
            rejection_reason = f'spam_score_{spam_score}'
        
        return ValidationResult(
            is_valid=is_valid,
            spf_result=spf_result,
            dkim_result=dkim_result,
            dmarc_result=dmarc_result,
            spam_score=spam_score,
            rejection_reason=rejection_reason
        )
    
    async def check_spf(self, ip: str, domain: str, sender: str) -> str:
        """
        Check SPF record.
        
        Returns: 'pass', 'fail', 'softfail', 'neutral', 'none'
        """
        
        try:
            import spf
            result, _, _ = spf.check(ip, sender, domain)
            return result
        except Exception as e:
            logger.error(f"SPF check failed: {e}")
            return 'temperror'
    
    async def check_dkim(self, raw_email: bytes) -> str:
        """
        Check DKIM signature.
        
        Returns: 'pass', 'fail', 'none'
        """
        
        try:
            import dkim
            if dkim.verify(raw_email):
                return 'pass'
            else:
                return 'fail'
        except dkim.DKIMException:
            return 'fail'
        except Exception:
            return 'none'
    
    async def check_dmarc(self, domain: str, spf_result: str, dkim_result: str) -> str:
        """
        Check DMARC policy.
        
        Returns: 'pass', 'fail', 'none'
        """
        
        try:
            # 1. Get DMARC record
            import dns.resolver
            dmarc_record = dns.resolver.resolve(f'_dmarc.{domain}', 'TXT')
            
            if not dmarc_record:
                return 'none'
            
            # 2. Parse DMARC policy
            policy = self.parse_dmarc_record(str(dmarc_record[0]))
            
            # 3. Check alignment
            # DMARC passes if either SPF or DKIM passes with alignment
            if spf_result == 'pass' or dkim_result == 'pass':
                return 'pass'
            
            return 'fail'
        
        except dns.resolver.NXDOMAIN:
            return 'none'
        except Exception as e:
            logger.error(f"DMARC check failed: {e}")
            return 'none'
```

## 2.7 Attachment Handling

```python
class AttachmentHandler:
    """Handle email attachments"""
    
    # Size limits
    MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25MB per attachment
    MAX_TOTAL_SIZE = 50 * 1024 * 1024       # 50MB total per email
    
    # Allowed content types
    ALLOWED_CONTENT_TYPES = {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'text/html',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/zip',
        'application/json',
    }
    
    # Blocked extensions (regardless of content type)
    BLOCKED_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
        '.js', '.vbs', '.wsf', '.wsh', '.ps1', '.psm1',
        '.dll', '.sys', '.drv',
    }
    
    async def process_attachments(self, email_id: str, raw_email: bytes) -> List[dict]:
        """
        Process email attachments.
        
        Returns list of processed attachments.
        """
        
        import email
        msg = email.message_from_bytes(raw_email)
        
        attachments = []
        total_size = 0
        
        for part in msg.walk():
            if part.get_content_maintype() == 'multipart':
                continue
            
            filename = part.get_filename()
            if not filename:
                continue
            
            # 1. Get attachment data
            content = part.get_payload(decode=True)
            content_type = part.get_content_type()
            size = len(content)
            
            # 2. Validate size
            if size > self.MAX_ATTACHMENT_SIZE:
                raise AttachmentTooLargeError(
                    f"Attachment {filename} exceeds {self.MAX_ATTACHMENT_SIZE} bytes"
                )
            
            total_size += size
            if total_size > self.MAX_TOTAL_SIZE:
                raise TotalAttachmentsTooLargeError(
                    f"Total attachments exceed {self.MAX_TOTAL_SIZE} bytes"
                )
            
            # 3. Validate content type
            if content_type not in self.ALLOWED_CONTENT_TYPES:
                raise BlockedContentTypeError(
                    f"Content type {content_type} not allowed"
                )
            
            # 4. Validate extension
            ext = os.path.splitext(filename)[1].lower()
            if ext in self.BLOCKED_EXTENSIONS:
                raise BlockedExtensionError(
                    f"Extension {ext} not allowed"
                )
            
            # 5. Scan for malware
            malware_result = await self.scan_for_malware(content)
            if malware_result != 'clean':
                raise MalwareDetectedError(
                    f"Malware detected in {filename}: {malware_result}"
                )
            
            # 6. Upload to S3
            s3_key = f"attachments/{email_id}/{uuid.uuid4()}/{filename}"
            await s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=content,
                ContentType=content_type
            )
            
            # 7. Calculate checksum
            checksum = hashlib.sha256(content).hexdigest()
            
            # 8. Create attachment record
            attachment = await db.insert('email.attachments', {
                'email_id': email_id,
                'filename': filename,
                'content_type': content_type,
                'size_bytes': size,
                's3_key': s3_key,
                's3_bucket': S3_BUCKET,
                'malware_scan_result': malware_result,
                'malware_scan_at': datetime.utcnow(),
                'checksum_sha256': checksum
            })
            
            attachments.append(attachment)
        
        return attachments
    
    async def scan_for_malware(self, content: bytes) -> str:
        """
        Scan attachment for malware using ClamAV.
        
        Returns: 'clean', 'infected', 'error'
        """
        
        try:
            import clamd
            cd = clamd.ClamdUnixSocket()
            result = cd.instream(io.BytesIO(content))
            
            if result['stream'][0] == 'OK':
                return 'clean'
            else:
                return f'infected:{result["stream"][1]}'
        
        except Exception as e:
            logger.error(f"Malware scan failed: {e}")
            return 'error'
```

## 2.8 Retry Policy

```python
class EmailRetryPolicy:
    """Retry policy for email processing"""
    
    # Retry limits
    MAX_RETRIES = 3
    
    # Retry delays (exponential backoff)
    RETRY_DELAYS = [
        60,      # 1 minute
        300,     # 5 minutes
        900,     # 15 minutes
    ]
    
    # Retryable errors
    RETRYABLE_ERRORS = {
        'validation_timeout',
        'parse_timeout',
        'agent_timeout',
        'database_error',
        'queue_error',
        's3_error',
    }
    
    # Non-retryable errors
    NON_RETRYABLE_ERRORS = {
        'dmarc_fail',
        'spf_and_dkim_fail',
        'spam_detected',
        'malware_detected',
        'attachment_too_large',
        'blocked_content_type',
        'blocked_extension',
    }
    
    async def should_retry(self, email_id: str, error_code: str) -> Tuple[bool, Optional[datetime]]:
        """
        Determine if email should be retried.
        
        Returns:
          (should_retry, next_retry_at)
        """
        
        # 1. Check if error is retryable
        if error_code in self.NON_RETRYABLE_ERRORS:
            return False, None
        
        if error_code not in self.RETRYABLE_ERRORS:
            # Unknown error, don't retry
            return False, None
        
        # 2. Get current retry count
        email = await db.get('email.inbound_emails', email_id)
        retry_count = email['retry_count']
        
        # 3. Check if max retries exceeded
        if retry_count >= self.MAX_RETRIES:
            return False, None
        
        # 4. Calculate next retry time
        delay = self.RETRY_DELAYS[min(retry_count, len(self.RETRY_DELAYS) - 1)]
        next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
        
        return True, next_retry_at
    
    async def schedule_retry(self, email_id: str, error_code: str, error_message: str):
        """Schedule email for retry"""
        
        should_retry, next_retry_at = await self.should_retry(email_id, error_code)
        
        if should_retry:
            await db.update('email.inbound_emails', {
                'status': 'failed',
                'error_code': error_code,
                'error_message': error_message,
                'retry_count': db.raw('retry_count + 1'),
                'next_retry_at': next_retry_at
            }, where={'id': email_id})
            
            # Schedule retry job
            await scheduler.schedule(
                job='retry_email',
                args={'email_id': email_id},
                run_at=next_retry_at
            )
        else:
            # Mark as permanently failed
            await db.update('email.inbound_emails', {
                'status': 'rejected',
                'error_code': error_code,
                'error_message': error_message
            }, where={'id': email_id})
```

## 2.9 Example Failure Paths

### 2.9.1 Failure Path: SPF Fail

```
1. Email received from 192.168.1.1
2. Envelope from: user@example.com
3. SPF check: example.com SPF record doesn't include 192.168.1.1
4. SPF result: fail
5. DKIM check: no signature
6. DKIM result: none
7. DMARC check: policy is "reject" for SPF fail
8. DMARC result: fail
9. Email rejected with error_code: 'dmarc_fail'
10. No retry (non-retryable error)
```

### 2.9.2 Failure Path: Malware Detected

```
1. Email received
2. Security validation: pass
3. Parse email: success
4. Process attachments:
   - attachment1.pdf: clean
   - attachment2.doc: infected (Trojan.Generic)
5. Attachment processing failed with error_code: 'malware_detected'
6. Email rejected
7. No retry (non-retryable error)
8. Alert sent to security team
```

### 2.9.3 Failure Path: Agent Timeout

```
1. Email received
2. Security validation: pass
3. Parse email: success
4. Queue for processing: success
5. Agent starts processing
6. Agent timeout after 30 minutes
7. Error code: 'agent_timeout'
8. Retry 1: scheduled for +1 minute
9. Retry 1: agent timeout again
10. Retry 2: scheduled for +5 minutes
11. Retry 2: agent timeout again
12. Retry 3: scheduled for +15 minutes
13. Retry 3: agent timeout again
14. Max retries exceeded
15. Email marked as failed (permanent)
16. Alert sent to ops team
```

---

# PART 3: BILLING EDGE CASES

## 3.1 Agent Crash Mid-Run

### 3.1.1 Timeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT CRASH MID-RUN TIMELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

Time    Event                           Credits         Balance
─────   ─────                           ───────         ───────
T0      Run starts                      Reserve $1.00   $10.00 → $9.00 (reserved)
T1      Task 1 starts                   -               -
T2      Step 1.1 completes              Charge $0.10    $9.90 (actual)
T3      Step 1.2 completes              Charge $0.15    $9.75 (actual)
T4      Task 1 completes                -               -
T5      Task 2 starts                   -               -
T6      Step 2.1 completes              Charge $0.20    $9.55 (actual)
T7      *** AGENT CRASH ***             -               -
T8      Crash detected                  -               -
T9      Calculate completion ratio      50% (2/4 tasks) -
T10     Calculate refund                $0.55 unused    -
T11     Apply refund                    Refund $0.55    $9.55 + $0.55 = $10.10
T12     Release reservation             Release $0.00   $10.10 (final)

Ledger Entries:
  T0:  RESERVE    $1.00   run_start
  T2:  CHARGE     $0.10   step_1.1_tokens
  T3:  CHARGE     $0.15   step_1.2_tokens
  T6:  CHARGE     $0.20   step_2.1_tokens
  T11: REFUND     $0.55   agent_crash_partial_completion
```

### 3.1.2 Implementation

```python
class AgentCrashHandler:
    """Handle agent crash mid-run"""
    
    async def handle_crash(self, run_id: str, agent_id: str, crash_reason: str):
        """
        Handle agent crash.
        
        RULES:
        1. Calculate completion ratio
        2. Charge for completed work
        3. Refund for incomplete work
        4. Release reservation
        """
        
        # 1. Get run and agent
        run = await db.get('runs', run_id)
        agent = await db.get('agents', agent_id)
        
        # 2. Calculate completion ratio
        total_tasks = await db.query(
            "SELECT COUNT(*) as count FROM tasks WHERE agent_id = %s",
            [agent_id]
        )
        completed_tasks = await db.query(
            "SELECT COUNT(*) as count FROM tasks WHERE agent_id = %s AND status = 'completed'",
            [agent_id]
        )
        
        completion_ratio = completed_tasks[0]['count'] / total_tasks[0]['count']
        
        # 3. Get actual charges
        actual_charges = await db.query(
            """
            SELECT SUM(amount_usd) as total FROM billing.billing_ledger
            WHERE run_id = %s AND transaction_type = 'charge'
            """,
            [run_id]
        )
        actual_charged = actual_charges[0]['total'] or 0
        
        # 4. Get reserved amount
        reserved_amount = run['credits_reserved']
        
        # 5. Calculate refund
        # Refund = Reserved - Actual Charged
        refund_amount = reserved_amount - actual_charged
        
        if refund_amount > 0:
            # 6. Apply refund
            await db.insert('billing.billing_ledger', {
                'org_id': run['org_id'],
                'transaction_type': 'refund',
                'direction': 'credit',
                'amount_usd': refund_amount,
                'run_id': run_id,
                'reason': f'agent_crash_partial_completion_{completion_ratio:.1%}',
                'created_by': 'system'
            })
            
            # 7. Update balance
            await db.update('billing.credit_balances', {
                'balance_usd': db.raw('balance_usd + %s', [refund_amount]),
                'reserved_usd': db.raw('reserved_usd - %s', [reserved_amount])
            }, where={'org_id': run['org_id']})
        
        # 8. Update run status
        await db.update('runs', {
            'status': 'failed',
            'failure_reason': f'agent_crash: {crash_reason}',
            'completion_ratio': completion_ratio,
            'credits_charged': actual_charged,
            'credits_refunded': refund_amount
        }, where={'id': run_id})
        
        # 9. Log for audit
        await audit_logger.log(
            action='agent_crash_billing',
            run_id=run_id,
            agent_id=agent_id,
            completion_ratio=completion_ratio,
            actual_charged=actual_charged,
            refund_amount=refund_amount
        )
        
        return {
            'completion_ratio': completion_ratio,
            'actual_charged': actual_charged,
            'refund_amount': refund_amount
        }
```

## 3.2 Budget Runs Out Mid-Step

### 3.2.1 Timeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUDGET EXHAUSTION MID-STEP TIMELINE                       │
└─────────────────────────────────────────────────────────────────────────────┘

Time    Event                           Credits         Balance
─────   ─────                           ───────         ───────
T0      Run starts                      Reserve $0.50   $0.50 → $0.00 (reserved)
T1      Step 1 starts                   -               -
T2      Step 1 LLM call 1               Charge $0.20    $0.30 (remaining)
T3      Step 1 LLM call 2               Charge $0.15    $0.15 (remaining)
T4      Step 1 LLM call 3 starts        -               -
T5      LLM returns 5000 tokens         Cost $0.25      -
T6      *** INSUFFICIENT CREDITS ***    -               -
T7      Step 1 marked as failed         -               -
T8      Run paused                      -               -
T9      Notify user                     -               -
T10     User adds $1.00                 Purchase $1.00  $1.15
T11     Run resumed                     Reserve $0.50   $0.65 (reserved)
T12     Step 1 retried                  -               -
T13     Step 1 completes                Charge $0.25    $0.90 (remaining)

Ledger Entries:
  T0:  RESERVE    $0.50   run_start
  T2:  CHARGE     $0.20   step_1_llm_call_1
  T3:  CHARGE     $0.15   step_1_llm_call_2
  T6:  (no charge - insufficient credits)
  T10: PURCHASE   $1.00   user_purchase
  T11: RESERVE    $0.50   run_resume
  T13: CHARGE     $0.25   step_1_llm_call_3_retry
```

### 3.2.2 Implementation

```python
class BudgetExhaustionHandler:
    """Handle budget exhaustion mid-step"""
    
    async def handle_insufficient_credits(
        self,
        run_id: str,
        step_id: str,
        required_amount: float
    ):
        """
        Handle insufficient credits during step execution.
        
        RULES:
        1. DO NOT charge for the failed LLM call
        2. Mark step as failed (retryable)
        3. Pause run
        4. Notify user
        5. Wait for user to add credits
        6. Resume run when credits added
        """
        
        # 1. Get run
        run = await db.get('runs', run_id)
        
        # 2. Get available balance
        balance = await db.get('billing.credit_balances', {'org_id': run['org_id']})
        available = balance['balance_usd'] - balance['reserved_usd']
        
        # 3. Calculate shortfall
        shortfall = required_amount - available
        
        # 4. Mark step as failed (retryable)
        await db.update('steps', {
            'status': 'failed',
            'failure_reason': 'insufficient_credits',
            'failure_retryable': True
        }, where={'id': step_id})
        
        # 5. Pause run
        await db.update('runs', {
            'status': 'paused',
            'pause_reason': 'insufficient_credits',
            'pause_shortfall': shortfall
        }, where={'id': run_id})
        
        # 6. Notify user
        await notify_user(
            org_id=run['org_id'],
            event='insufficient_credits',
            data={
                'run_id': run_id,
                'available': available,
                'required': required_amount,
                'shortfall': shortfall
            }
        )
        
        # 7. Log event
        await db.insert('billing.insufficient_credit_events', {
            'org_id': run['org_id'],
            'run_id': run_id,
            'step_id': step_id,
            'available_balance': available,
            'required_amount': required_amount,
            'shortfall': shortfall
        })
        
        # 8. Set up watcher for credit addition
        await self.watch_for_credits(run_id, shortfall)
    
    async def watch_for_credits(self, run_id: str, shortfall: float):
        """Watch for credit addition and resume run"""
        
        run = await db.get('runs', run_id)
        
        # Subscribe to credit balance changes
        async def on_balance_change(org_id: str, new_balance: float):
            if org_id != run['org_id']:
                return
            
            # Check if enough credits now
            balance = await db.get('billing.credit_balances', {'org_id': org_id})
            available = balance['balance_usd'] - balance['reserved_usd']
            
            if available >= shortfall:
                # Resume run
                await self.resume_run(run_id)
        
        # Register watcher
        await event_bus.subscribe(
            'credit_balance_changed',
            on_balance_change,
            timeout=86400  # 24 hour timeout
        )
    
    async def resume_run(self, run_id: str):
        """Resume paused run after credits added"""
        
        run = await db.get('runs', run_id)
        
        if run['status'] != 'paused':
            return
        
        # 1. Reserve credits for remaining work
        estimated_remaining = await self.estimate_remaining_cost(run_id)
        
        # 2. Update balance
        await db.update('billing.credit_balances', {
            'reserved_usd': db.raw('reserved_usd + %s', [estimated_remaining])
        }, where={'org_id': run['org_id']})
        
        # 3. Resume run
        await db.update('runs', {
            'status': 'running',
            'pause_reason': None,
            'pause_shortfall': None,
            'credits_reserved': db.raw('credits_reserved + %s', [estimated_remaining])
        }, where={'id': run_id})
        
        # 4. Retry failed step
        failed_step = await db.query(
            """
            SELECT id FROM steps
            WHERE run_id = %s AND status = 'failed' AND failure_retryable = TRUE
            ORDER BY created_at DESC
            LIMIT 1
            """,
            [run_id]
        )
        
        if failed_step:
            await self.retry_step(failed_step[0]['id'])
        
        # 5. Notify user
        await notify_user(
            org_id=run['org_id'],
            event='run_resumed',
            data={'run_id': run_id}
        )
```

## 3.3 Retry Causes Token Overuse

### 3.3.1 Timeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RETRY TOKEN OVERUSE TIMELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

Time    Event                           Tokens          Cost        Balance
─────   ─────                           ──────          ────        ───────
T0      Run starts                      -               Reserve $1  $10 → $9
T1      Step 1 attempt 1                500 tokens      $0.05       $9.95
T2      Step 1 fails (timeout)          -               -           -
T3      Step 1 attempt 2 (retry)        500 tokens      $0.05       $9.90
T4      Step 1 fails (timeout)          -               -           -
T5      Step 1 attempt 3 (retry)        500 tokens      $0.05       $9.85
T6      Step 1 succeeds                 -               -           -
T7      Total tokens: 1500              -               -           -
T8      Estimated was: 500              -               -           -
T9      Variance: +200%                 -               -           -

Ledger Entries:
  T0:  RESERVE    $1.00   run_start
  T1:  CHARGE     $0.05   step_1_attempt_1
  T3:  CHARGE     $0.05   step_1_attempt_2_retry
  T5:  CHARGE     $0.05   step_1_attempt_3_retry

Reconciliation:
  Estimated: 500 tokens = $0.05
  Actual: 1500 tokens = $0.15
  Variance: +200% (CRITICAL)
  Action: Alert team, no additional charge (user not at fault)
```

### 3.3.2 Implementation

```python
class RetryTokenOveruseHandler:
    """Handle token overuse due to retries"""
    
    # RULE: User is NOT charged extra for retry token usage
    # Rationale: Retries are due to system failures, not user actions
    
    async def record_retry_tokens(
        self,
        run_id: str,
        step_id: str,
        attempt_number: int,
        tokens: int,
        cost: float
    ):
        """
        Record tokens used in retry attempt.
        
        RULES:
        1. Charge for each attempt (tokens were consumed)
        2. Track retry attempts separately
        3. Flag for reconciliation review
        4. Alert if variance > 100%
        """
        
        # 1. Record token usage
        await billing.record_token_call(
            run_id=run_id,
            step_id=step_id,
            input_tokens=tokens,
            output_tokens=0,
            model='gpt-4-turbo',
            metadata={
                'is_retry': True,
                'attempt_number': attempt_number
            }
        )
        
        # 2. Update step retry count
        await db.update('steps', {
            'retry_count': attempt_number,
            'total_tokens_including_retries': db.raw(
                'total_tokens_including_retries + %s', [tokens]
            )
        }, where={'id': step_id})
        
        # 3. Check variance
        step = await db.get('steps', step_id)
        estimated_tokens = step['tokens_estimated']
        actual_tokens = step['total_tokens_including_retries']
        
        if estimated_tokens > 0:
            variance = (actual_tokens - estimated_tokens) / estimated_tokens
            
            if variance > 1.0:  # > 100% variance
                # 4. Flag for review
                await db.insert('billing.retry_overuse_flags', {
                    'run_id': run_id,
                    'step_id': step_id,
                    'estimated_tokens': estimated_tokens,
                    'actual_tokens': actual_tokens,
                    'variance_pct': variance * 100,
                    'retry_count': attempt_number
                })
                
                # 5. Alert team
                await alert_team(
                    f"Retry token overuse: Step {step_id} used {actual_tokens} tokens "
                    f"(estimated {estimated_tokens}, variance {variance:.0%})"
                )
    
    async def reconcile_retry_overuse(self, run_id: str):
        """
        Reconcile token overuse due to retries.
        
        RULE: Do NOT charge user extra for retry tokens.
        """
        
        # 1. Get all retry overuse flags for this run
        flags = await db.query(
            """
            SELECT * FROM billing.retry_overuse_flags
            WHERE run_id = %s
            """,
            [run_id]
        )
        
        if not flags:
            return
        
        # 2. Calculate total overuse
        total_overuse_tokens = sum(
            f['actual_tokens'] - f['estimated_tokens'] 
            for f in flags
        )
        
        # 3. Calculate cost of overuse
        # (This is informational only, we don't charge extra)
        overuse_cost = total_overuse_tokens * 0.0001  # Rough estimate
        
        # 4. Log for analysis
        await db.insert('billing.retry_overuse_analysis', {
            'run_id': run_id,
            'total_overuse_tokens': total_overuse_tokens,
            'overuse_cost_usd': overuse_cost,
            'flag_count': len(flags),
            'action': 'no_charge_user_not_at_fault'
        })
        
        # 5. Update reconciliation status
        await db.update('billing.token_reconciliations', {
            'notes': db.raw(
                "notes || %s",
                [f'\nRetry overuse: {total_overuse_tokens} tokens, no extra charge']
            )
        }, where={'run_id': run_id})
```

## 3.4 User Cancels Run

### 3.4.1 Timeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    USER CANCELLATION TIMELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

Time    Event                           Credits         Balance
─────   ─────                           ───────         ───────
T0      Run starts                      Reserve $2.00   $10.00 → $8.00 (reserved)
T1      Task 1 completes                Charge $0.30    $9.70
T2      Task 2 starts                   -               -
T3      Step 2.1 completes              Charge $0.20    $9.50
T4      *** USER CANCELS ***            -               -
T5      Cancel signal sent              -               -
T6      Agent receives cancel           -               -
T7      Agent stops gracefully          -               -
T8      Calculate completion            25% (1/4 tasks) -
T9      Calculate refund                $1.50 unused    -
T10     Apply refund                    Refund $1.50    $9.50 + $1.50 = $11.00
T11     Release reservation             Release $0.00   $11.00 (final)

Ledger Entries:
  T0:  RESERVE    $2.00   run_start
  T1:  CHARGE     $0.30   task_1_tokens
  T3:  CHARGE     $0.20   step_2.1_tokens
  T10: REFUND     $1.50   user_cancellation_unused_reservation

Note: User is charged for completed work only.
```

### 3.4.2 Implementation

```python
class UserCancellationHandler:
    """Handle user-initiated run cancellation"""
    
    async def cancel_run(self, run_id: str, user_id: str, reason: str = None):
        """
        Cancel a running run.
        
        RULES:
        1. Send cancel signal to agent
        2. Wait for graceful shutdown (max 30s)
        3. Charge for completed work
        4. Refund unused reservation
        5. Release all reservations
        """
        
        # 1. Get run
        run = await db.get('runs', run_id)
        
        if run['status'] not in ['running', 'paused']:
            raise InvalidRunStatusError(f"Cannot cancel run in status {run['status']}")
        
        # 2. Mark as cancelling
        await db.update('runs', {
            'status': 'cancelling',
            'cancelled_by': user_id,
            'cancellation_reason': reason,
            'cancellation_requested_at': datetime.utcnow()
        }, where={'id': run_id})
        
        # 3. Send cancel signal to agent
        await self.send_cancel_signal(run_id)
        
        # 4. Wait for graceful shutdown (max 30s)
        shutdown_complete = await self.wait_for_shutdown(run_id, timeout=30)
        
        if not shutdown_complete:
            # Force kill if graceful shutdown fails
            await self.force_kill_agent(run_id)
        
        # 5. Calculate charges
        actual_charges = await db.query(
            """
            SELECT SUM(amount_usd) as total FROM billing.billing_ledger
            WHERE run_id = %s AND transaction_type = 'charge'
            """,
            [run_id]
        )
        actual_charged = actual_charges[0]['total'] or 0
        
        # 6. Calculate refund
        reserved_amount = run['credits_reserved']
        refund_amount = reserved_amount - actual_charged
        
        if refund_amount > 0:
            # 7. Apply refund
            await db.insert('billing.billing_ledger', {
                'org_id': run['org_id'],
                'transaction_type': 'refund',
                'direction': 'credit',
                'amount_usd': refund_amount,
                'run_id': run_id,
                'reason': 'user_cancellation_unused_reservation',
                'created_by': user_id
            })
            
            # 8. Update balance
            await db.update('billing.credit_balances', {
                'balance_usd': db.raw('balance_usd + %s', [refund_amount]),
                'reserved_usd': db.raw('reserved_usd - %s', [reserved_amount])
            }, where={'org_id': run['org_id']})
        else:
            # Just release reservation
            await db.update('billing.credit_balances', {
                'reserved_usd': db.raw('reserved_usd - %s', [reserved_amount])
            }, where={'org_id': run['org_id']})
        
        # 9. Update run status
        await db.update('runs', {
            'status': 'cancelled',
            'cancelled_at': datetime.utcnow(),
            'credits_charged': actual_charged,
            'credits_refunded': refund_amount
        }, where={'id': run_id})
        
        # 10. Notify user
        await notify_user(
            org_id=run['org_id'],
            event='run_cancelled',
            data={
                'run_id': run_id,
                'charged': actual_charged,
                'refunded': refund_amount
            }
        )
        
        return {
            'status': 'cancelled',
            'charged': actual_charged,
            'refunded': refund_amount
        }
```

## 3.5 Multiple Agents Contribute Tokens Concurrently

### 3.5.1 Timeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONCURRENT AGENT TOKEN CONTRIBUTION                       │
└─────────────────────────────────────────────────────────────────────────────┘

Time    Agent 1             Agent 2             Agent 3             Balance
─────   ───────             ───────             ───────             ───────
T0      -                   -                   -                   $10.00
T1      Start               Start               Start               Reserve $3.00 → $7.00
T2      LLM call (500 tok)  -                   -                   -
T3      -                   LLM call (600 tok)  -                   -
T4      -                   -                   LLM call (400 tok)  -
T5      Charge $0.05        -                   -                   $9.95
T6      -                   Charge $0.06        -                   $9.89
T7      -                   -                   Charge $0.04        $9.85
T8      LLM call (300 tok)  LLM call (200 tok)  LLM call (500 tok)  -
T9      Charge $0.03        Charge $0.02        Charge $0.05        $9.75
T10     Complete            Complete            Complete            -
T11     -                   -                   -                   Release $2.75 → $10.00

Ledger Entries (ordered by server_timestamp):
  T1:  RESERVE    $3.00   run_start (3 agents × $1.00)
  T5:  CHARGE     $0.05   agent_1_step_1
  T6:  CHARGE     $0.06   agent_2_step_1
  T7:  CHARGE     $0.04   agent_3_step_1
  T9a: CHARGE     $0.03   agent_1_step_2
  T9b: CHARGE     $0.02   agent_2_step_2
  T9c: CHARGE     $0.05   agent_3_step_2
  T11: RELEASE    $2.75   run_complete_unused_reservation

Total charged: $0.25
Total reserved: $3.00
Refunded: $2.75
```

### 3.5.2 Implementation

```python
class ConcurrentAgentBillingHandler:
    """Handle billing for concurrent agent token contributions"""
    
    # INVARIANT: All token records must be atomic
    # INVARIANT: Balance updates must use row-level locking
    # INVARIANT: Ledger entries must be append-only
    
    async def record_concurrent_token_call(
        self,
        run_id: str,
        agent_id: str,
        step_id: str,
        tokens: int,
        cost: float
    ):
        """
        Record token call from one of multiple concurrent agents.
        
        RULES:
        1. Each agent's tokens are recorded independently
        2. Balance is updated atomically with row-level lock
        3. Ledger entries are append-only
        4. No double-charging (idempotency key)
        """
        
        # 1. Generate idempotency key
        idempotency_key = f"{run_id}:{agent_id}:{step_id}:{datetime.utcnow().timestamp()}"
        
        # 2. Check for duplicate
        existing = await db.query(
            "SELECT id FROM billing.billing_ledger WHERE idempotency_key = %s",
            [idempotency_key]
        )
        
        if existing:
            # Already recorded, return existing
            return existing[0]['id']
        
        # 3. Get run (for org_id)
        run = await db.get('runs', run_id)
        
        # 4. Begin transaction
        async with db.transaction():
            # 5. Lock balance row
            balance = await db.query(
                """
                SELECT * FROM billing.credit_balances
                WHERE org_id = %s
                FOR UPDATE
                """,
                [run['org_id']]
            )
            
            if not balance:
                raise OrgNotFoundError(run['org_id'])
            
            balance = balance[0]
            
            # 6. Check sufficient balance
            available = balance['balance_usd'] - balance['reserved_usd']
            if available < cost:
                raise InsufficientCreditsError(available, cost)
            
            # 7. Insert token record
            token_record = await db.insert('billing.token_records', {
                'run_id': run_id,
                'agent_id': agent_id,
                'step_id': step_id,
                'total_tokens': tokens,
                'cost_usd': cost,
                'idempotency_key': idempotency_key
            })
            
            # 8. Insert ledger entry
            ledger_entry = await db.insert('billing.billing_ledger', {
                'org_id': run['org_id'],
                'transaction_type': 'charge',
                'direction': 'debit',
                'amount_usd': cost,
                'run_id': run_id,
                'agent_id': agent_id,
                'reason': f'agent_{agent_id}_tokens',
                'idempotency_key': idempotency_key,
                'created_by': 'system'
            })
            
            # 9. Update balance
            await db.update('billing.credit_balances', {
                'balance_usd': balance['balance_usd'] - cost
            }, where={'org_id': run['org_id']})
            
            # 10. Update run totals
            await db.update('runs', {
                'tokens_used': db.raw('tokens_used + %s', [tokens]),
                'cost_incurred': db.raw('cost_incurred + %s', [cost])
            }, where={'id': run_id})
            
            # 11. Update agent totals
            await db.update('agents', {
                'tokens_used': db.raw('tokens_used + %s', [tokens]),
                'cost_incurred': db.raw('cost_incurred + %s', [cost])
            }, where={'id': agent_id})
        
        return ledger_entry['id']
    
    async def finalize_multi_agent_run(self, run_id: str):
        """
        Finalize billing for multi-agent run.
        
        RULES:
        1. Sum all agent charges
        2. Release unused reservation
        3. Create reconciliation record
        """
        
        # 1. Get run
        run = await db.get('runs', run_id)
        
        # 2. Get all agent charges
        charges = await db.query(
            """
            SELECT 
                agent_id,
                SUM(amount_usd) as total_charged,
                COUNT(*) as charge_count
            FROM billing.billing_ledger
            WHERE run_id = %s AND transaction_type = 'charge'
            GROUP BY agent_id
            """,
            [run_id]
        )
        
        total_charged = sum(c['total_charged'] for c in charges)
        
        # 3. Calculate unused reservation
        reserved = run['credits_reserved']
        unused = reserved - total_charged
        
        if unused > 0:
            # 4. Release unused reservation
            await db.update('billing.credit_balances', {
                'reserved_usd': db.raw('reserved_usd - %s', [reserved])
            }, where={'org_id': run['org_id']})
            
            # Note: We don't add back to balance because charges already deducted
        
        # 5. Create reconciliation record
        await db.insert('billing.token_reconciliations', {
            'run_id': run_id,
            'estimated_total_tokens': run['tokens_estimated'],
            'actual_total_tokens': run['tokens_used'],
            'estimated_cost_usd': reserved,
            'actual_cost_usd': total_charged,
            'status': 'RECONCILED',
            'notes': f'Multi-agent run with {len(charges)} agents'
        })
        
        # 6. Update run
        await db.update('runs', {
            'credits_charged': total_charged,
            'credits_refunded': 0,  # No refund, just release reservation
            'billing_finalized': True,
            'billing_finalized_at': datetime.utcnow()
        }, where={'id': run_id})
        
        return {
            'total_charged': total_charged,
            'agents': charges,
            'reserved': reserved,
            'unused': unused
        }
```

## 3.6 Billing Ledger Schema (Complete)

```sql
CREATE TABLE billing.billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization
  org_id UUID NOT NULL,
  
  -- Transaction
  transaction_type VARCHAR(50) NOT NULL,
    -- 'reserve': Credits reserved for run
    -- 'charge': Credits charged for usage
    -- 'refund': Credits refunded
    -- 'release': Reservation released (no charge)
    -- 'purchase': Credits purchased
    -- 'adjustment': Manual adjustment
  
  direction VARCHAR(10) NOT NULL,
    -- 'debit': Money out (charge, reserve)
    -- 'credit': Money in (refund, release, purchase)
  
  amount_usd DECIMAL(12, 8) NOT NULL CHECK (amount_usd > 0),
  
  -- References
  run_id UUID,
  agent_id UUID,
  task_id UUID,
  step_id UUID,
  
  -- Reason
  reason VARCHAR(255) NOT NULL,
  
  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE,
  
  -- Metadata
  metadata JSONB,
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_ledger_org FOREIGN KEY (org_id) 
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ledger_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE SET NULL,
  CONSTRAINT fk_ledger_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Invariants
  CONSTRAINT check_transaction_type CHECK (
    transaction_type IN ('reserve', 'charge', 'refund', 'release', 'purchase', 'adjustment')
  ),
  CONSTRAINT check_direction CHECK (
    direction IN ('debit', 'credit')
  ),
  CONSTRAINT check_direction_matches_type CHECK (
    (transaction_type IN ('charge', 'reserve') AND direction = 'debit') OR
    (transaction_type IN ('refund', 'release', 'purchase') AND direction = 'credit') OR
    (transaction_type = 'adjustment')
  )
);

-- Indexes
CREATE INDEX idx_ledger_org_created ON billing.billing_ledger(org_id, created_at DESC);
CREATE INDEX idx_ledger_run ON billing.billing_ledger(run_id);
CREATE INDEX idx_ledger_agent ON billing.billing_ledger(agent_id);
CREATE INDEX idx_ledger_type ON billing.billing_ledger(transaction_type);
CREATE INDEX idx_ledger_idempotency ON billing.billing_ledger(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Append-only trigger (prevent updates and deletes)
CREATE OR REPLACE FUNCTION billing.prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'billing_ledger is append-only. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_ledger_immutable
BEFORE UPDATE OR DELETE ON billing.billing_ledger
FOR EACH ROW EXECUTE FUNCTION billing.prevent_ledger_modification();
```

---

## Summary

This document provides exact implementation specifications for:

1. **Real-Time Collaboration**
   - OT-based concurrency (not CRDT)
   - Pessimistic locking for prompts
   - Owner always pays (credit attribution)
   - Graceful owner disconnection handling
   - WebSocket + Redis Pub/Sub architecture

2. **Email Processing**
   - Complete ingestion pipeline
   - SPF/DKIM/DMARC validation
   - Idempotency via Message-ID hash
   - Attachment size limits (25MB per, 50MB total)
   - Retry policy (3 retries, exponential backoff)

3. **Billing Edge Cases**
   - Agent crash: Proportional refund
   - Budget exhaustion: Pause and resume
   - Retry overuse: No extra charge to user
   - User cancellation: Refund unused reservation
   - Concurrent agents: Atomic balance updates

**All implementations include:**
- Table schemas
- Event flows
- Failure scenarios
- Timeline diagrams
- Exact ledger entries
- Refund vs charge rules

---

**This is the technical truth. Implement it exactly.** 🎯
