# Manus Internal Engineering Specification: Critical Systems

**Classification:** INTERNAL - Engineering Handoff  
**Author:** Manus Technical Lead  
**Version:** 1.0.0  
**Date:** 2026-01-15

---

## Table of Contents

1. [Collaboration Billing Semantics](#part-1-collaboration-billing-semantics)
2. [Email Identity & Auth Model](#part-2-email-identity--auth-model)
3. [Billing Failure & Retry Economics](#part-3-billing-failure--retry-economics)
4. [Agents + Collaboration Interaction](#part-4-agents--collaboration-interaction)
5. [Abuse & Enterprise Guardrails](#part-5-abuse--enterprise-guardrails)

---

# Part 1: Collaboration Billing Semantics

## 1.1 Core Billing Principle

**INVARIANT: Owner ALWAYS pays.**

This is non-negotiable. The workspace owner is charged for ALL activity regardless of who triggered it. This prevents:
- Collaborators griefing owners
- Credit disputes between users
- Complex multi-party billing reconciliation

## 1.2 Role Definitions and Permissions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COLLABORATION ROLE MATRIX                            │
├─────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────────┤
│ Permission  │ VIEWER  │ COMMENTER│ EDITOR  │ PROMPTER│ RUNNER  │ OWNER      │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────────┤
│ View docs   │ ✓       │ ✓       │ ✓       │ ✓       │ ✓       │ ✓          │
│ Add comments│ ✗       │ ✓       │ ✓       │ ✓       │ ✓       │ ✓          │
│ Edit docs   │ ✗       │ ✗       │ ✓       │ ✓       │ ✓       │ ✓          │
│ Send prompts│ ✗       │ ✗       │ ✗       │ ✓*      │ ✓       │ ✓          │
│ Run agents  │ ✗       │ ✗       │ ✗       │ ✗       │ ✓**     │ ✓          │
│ Manage perms│ ✗       │ ✗       │ ✗       │ ✗       │ ✗       │ ✓          │
│ Delete ws   │ ✗       │ ✗       │ ✗       │ ✗       │ ✗       │ ✓          │
├─────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴────────────┤
│ * PROMPTER: Prompts queued for owner approval unless auto_approve=true     │
│ ** RUNNER: Can execute agents within daily_credit_limit                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Billing State Machine

```
                              ┌─────────────────────────────────────┐
                              │                                     │
                              ▼                                     │
┌──────────┐  action    ┌──────────┐  approved   ┌──────────┐      │
│  IDLE    │───────────▶│ PENDING  │────────────▶│ RESERVED │      │
└──────────┘            └──────────┘             └──────────┘      │
     ▲                       │                        │            │
     │                       │ rejected               │ execute    │
     │                       ▼                        ▼            │
     │                  ┌──────────┐            ┌──────────┐       │
     │                  │ REJECTED │            │ CHARGING │       │
     │                  └──────────┘            └──────────┘       │
     │                                               │             │
     │                       ┌───────────┬──────────┼──────────┐   │
     │                       │           │          │          │   │
     │                       ▼           ▼          ▼          ▼   │
     │                  ┌────────┐ ┌─────────┐ ┌────────┐ ┌───────┐│
     │                  │COMPLETED│ │ FAILED  │ │CANCELLED│ │REFUND ││
     │                  └────────┘ └─────────┘ └────────┘ └───────┘│
     │                       │           │          │          │   │
     └───────────────────────┴───────────┴──────────┴──────────┴───┘
```

### State Definitions

```python
class BillingState(Enum):
    IDLE = "idle"              # No pending action
    PENDING = "pending"        # Awaiting owner approval (for non-owner actions)
    RESERVED = "reserved"      # Credits reserved, not yet charged
    CHARGING = "charging"      # Execution in progress, incrementally charging
    COMPLETED = "completed"    # Successfully completed, final charge applied
    FAILED = "failed"          # Execution failed, partial refund issued
    CANCELLED = "cancelled"    # User cancelled, full refund of reserved credits
    REJECTED = "rejected"      # Owner rejected pending action
    REFUND = "refund"          # Refund in progress
```

### Transition Rules

```python
ALLOWED_TRANSITIONS = {
    BillingState.IDLE: [BillingState.PENDING, BillingState.RESERVED],
    BillingState.PENDING: [BillingState.RESERVED, BillingState.REJECTED],
    BillingState.RESERVED: [BillingState.CHARGING, BillingState.CANCELLED],
    BillingState.CHARGING: [BillingState.COMPLETED, BillingState.FAILED, BillingState.CANCELLED],
    BillingState.COMPLETED: [BillingState.IDLE],
    BillingState.FAILED: [BillingState.REFUND, BillingState.IDLE],
    BillingState.CANCELLED: [BillingState.REFUND, BillingState.IDLE],
    BillingState.REJECTED: [BillingState.IDLE],
    BillingState.REFUND: [BillingState.IDLE],
}
```

## 1.4 Credit Attribution Schema

```sql
-- Core credit attribution table
CREATE TABLE collab.credit_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who pays
    owner_id UUID NOT NULL REFERENCES users(id),
    owner_org_id UUID NOT NULL REFERENCES orgs(id),
    
    -- Who triggered
    triggered_by_user_id UUID NOT NULL REFERENCES users(id),
    triggered_by_role collab_role NOT NULL,
    
    -- What was triggered
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    action_type action_type NOT NULL,  -- 'prompt', 'tool_call', 'agent_run', 'edit'
    action_id UUID NOT NULL,           -- Reference to the specific action
    
    -- Billing state
    state billing_state NOT NULL DEFAULT 'idle',
    
    -- Credit amounts (in millicredits for precision)
    credits_estimated BIGINT NOT NULL DEFAULT 0,
    credits_reserved BIGINT NOT NULL DEFAULT 0,
    credits_charged BIGINT NOT NULL DEFAULT 0,
    credits_refunded BIGINT NOT NULL DEFAULT 0,
    
    -- Approval tracking
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_credit_amounts CHECK (
        credits_estimated >= 0 AND
        credits_reserved >= 0 AND
        credits_charged >= 0 AND
        credits_refunded >= 0 AND
        credits_charged <= credits_reserved AND
        credits_refunded <= credits_reserved
    ),
    
    -- Indexes
    INDEX idx_owner_state (owner_id, state),
    INDEX idx_workspace_created (workspace_id, created_at DESC),
    INDEX idx_triggered_by (triggered_by_user_id, created_at DESC),
    INDEX idx_idempotency (idempotency_key) WHERE idempotency_key IS NOT NULL
);

-- Collaborator daily limits
CREATE TABLE collab.collaborator_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Daily limits (reset at midnight UTC)
    daily_credit_limit BIGINT NOT NULL DEFAULT 100000,  -- 100 credits in millicredits
    daily_credits_used BIGINT NOT NULL DEFAULT 0,
    daily_prompt_limit INT NOT NULL DEFAULT 50,
    daily_prompts_used INT NOT NULL DEFAULT 0,
    
    -- Current period
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Auto-approval settings
    auto_approve_prompts BOOLEAN NOT NULL DEFAULT false,
    auto_approve_threshold BIGINT NOT NULL DEFAULT 10000,  -- Auto-approve if < 10 credits
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (workspace_id, user_id)
);

-- Pending approval queue
CREATE TABLE collab.pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribution_id UUID NOT NULL REFERENCES collab.credit_attributions(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    
    -- Request details
    requester_id UUID NOT NULL REFERENCES users(id),
    request_type approval_type NOT NULL,  -- 'prompt', 'agent_run', 'tool_call'
    request_payload JSONB NOT NULL,
    estimated_credits BIGINT NOT NULL,
    
    -- Status
    status approval_status NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'expired'
    
    -- Expiration (pending requests expire after 24 hours)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
    
    -- Resolution
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    INDEX idx_workspace_pending (workspace_id, status) WHERE status = 'pending',
    INDEX idx_expires (expires_at) WHERE status = 'pending'
);
```

## 1.5 Action Handling by Role

### 1.5.1 Non-Owner Prompt Flow

```python
async def handle_collaborator_prompt(
    workspace_id: str,
    user_id: str,
    prompt: str,
    idempotency_key: str
) -> PromptResult:
    """
    Handle prompt from non-owner collaborator.
    
    Flow:
    1. Check role permissions
    2. Check daily limits
    3. Estimate credits
    4. Check auto-approval eligibility
    5. Either queue for approval or execute immediately
    """
    
    # PHASE 1: Permission check
    permission = await get_user_permission(workspace_id, user_id)
    
    if permission.role not in [Role.PROMPTER, Role.RUNNER, Role.OWNER]:
        raise PermissionDenied(
            code="INSUFFICIENT_ROLE",
            message=f"Role {permission.role} cannot send prompts",
            required_role="PROMPTER"
        )
    
    # PHASE 2: Check daily limits
    limits = await get_collaborator_limits(workspace_id, user_id)
    
    # Reset if new day
    if limits.period_start < date.today():
        limits = await reset_daily_limits(workspace_id, user_id)
    
    if limits.daily_prompts_used >= limits.daily_prompt_limit:
        raise LimitExceeded(
            code="DAILY_PROMPT_LIMIT",
            message=f"Daily prompt limit ({limits.daily_prompt_limit}) exceeded",
            reset_at=midnight_utc()
        )
    
    # PHASE 3: Estimate credits
    estimated_credits = await estimate_prompt_credits(prompt)
    
    if limits.daily_credits_used + estimated_credits > limits.daily_credit_limit:
        raise LimitExceeded(
            code="DAILY_CREDIT_LIMIT",
            message=f"Would exceed daily credit limit",
            available=limits.daily_credit_limit - limits.daily_credits_used,
            required=estimated_credits
        )
    
    # PHASE 4: Check owner credits
    owner = await get_workspace_owner(workspace_id)
    owner_balance = await get_credit_balance(owner.id)
    
    if owner_balance < estimated_credits:
        raise InsufficientCredits(
            code="OWNER_INSUFFICIENT_CREDITS",
            message="Workspace owner has insufficient credits",
            # Don't expose exact balance to collaborators
            hint="Contact workspace owner"
        )
    
    # PHASE 5: Create attribution record
    attribution = await create_credit_attribution(
        owner_id=owner.id,
        owner_org_id=owner.org_id,
        triggered_by_user_id=user_id,
        triggered_by_role=permission.role,
        workspace_id=workspace_id,
        action_type=ActionType.PROMPT,
        credits_estimated=estimated_credits,
        idempotency_key=idempotency_key,
        state=BillingState.IDLE
    )
    
    # PHASE 6: Determine approval path
    requires_approval = not (
        limits.auto_approve_prompts and 
        estimated_credits <= limits.auto_approve_threshold
    )
    
    if requires_approval:
        # Queue for owner approval
        await transition_billing_state(attribution.id, BillingState.PENDING)
        
        pending = await create_pending_approval(
            attribution_id=attribution.id,
            workspace_id=workspace_id,
            requester_id=user_id,
            request_type=ApprovalType.PROMPT,
            request_payload={"prompt": prompt},
            estimated_credits=estimated_credits
        )
        
        # Notify owner
        await notify_owner_approval_needed(
            owner_id=owner.id,
            workspace_id=workspace_id,
            pending_id=pending.id,
            requester_name=await get_user_name(user_id),
            estimated_credits=estimated_credits
        )
        
        return PromptResult(
            status="pending_approval",
            attribution_id=attribution.id,
            pending_id=pending.id,
            message="Prompt queued for owner approval"
        )
    
    else:
        # Auto-approved, execute immediately
        return await execute_prompt_with_billing(
            attribution=attribution,
            workspace_id=workspace_id,
            prompt=prompt,
            user_id=user_id
        )
```

### 1.5.2 Owner Approval Flow

```python
async def handle_approval_decision(
    pending_id: str,
    owner_id: str,
    decision: str,  # 'approve' or 'reject'
    reason: str = None
) -> ApprovalResult:
    """
    Handle owner's decision on pending approval.
    """
    
    # PHASE 1: Validate ownership
    pending = await get_pending_approval(pending_id)
    workspace = await get_workspace(pending.workspace_id)
    
    if workspace.owner_id != owner_id:
        raise PermissionDenied(
            code="NOT_OWNER",
            message="Only workspace owner can approve requests"
        )
    
    if pending.status != ApprovalStatus.PENDING:
        raise InvalidState(
            code="ALREADY_RESOLVED",
            message=f"Request already {pending.status}"
        )
    
    if pending.expires_at < datetime.utcnow():
        raise InvalidState(
            code="EXPIRED",
            message="Approval request has expired"
        )
    
    attribution = await get_credit_attribution(pending.attribution_id)
    
    # PHASE 2: Process decision
    if decision == "reject":
        # Transition to REJECTED
        await transition_billing_state(attribution.id, BillingState.REJECTED)
        
        await update_pending_approval(
            pending_id=pending_id,
            status=ApprovalStatus.REJECTED,
            resolved_by=owner_id,
            resolved_at=datetime.utcnow(),
            resolution_reason=reason
        )
        
        # Notify requester
        await notify_user(
            user_id=pending.requester_id,
            notification_type="approval_rejected",
            payload={
                "workspace_id": pending.workspace_id,
                "reason": reason
            }
        )
        
        return ApprovalResult(status="rejected", reason=reason)
    
    elif decision == "approve":
        # Check owner still has credits
        owner_balance = await get_credit_balance(owner_id)
        
        if owner_balance < attribution.credits_estimated:
            raise InsufficientCredits(
                code="INSUFFICIENT_CREDITS",
                message="You no longer have sufficient credits for this request",
                required=attribution.credits_estimated,
                available=owner_balance
            )
        
        # Reserve credits
        await reserve_credits(
            owner_id=owner_id,
            amount=attribution.credits_estimated,
            attribution_id=attribution.id
        )
        
        await transition_billing_state(attribution.id, BillingState.RESERVED)
        
        # Update pending approval
        await update_pending_approval(
            pending_id=pending_id,
            status=ApprovalStatus.APPROVED,
            resolved_by=owner_id,
            resolved_at=datetime.utcnow()
        )
        
        # Execute the approved action
        return await execute_approved_action(
            attribution=attribution,
            pending=pending
        )
```

## 1.6 Credit Exhaustion Handling

### What Happens When Owner Runs Out of Credits Mid-Session

```python
class CreditExhaustionHandler:
    """
    Handles the scenario where owner credits are exhausted during active collaboration.
    
    CRITICAL INVARIANTS:
    1. In-flight operations MUST complete (grace period)
    2. New operations MUST be blocked
    3. Collaborators MUST be notified
    4. No partial charges (atomic)
    """
    
    GRACE_PERIOD_CREDITS = 10000  # 10 credits in millicredits
    GRACE_PERIOD_SECONDS = 300   # 5 minutes to complete current operation
    
    async def check_and_handle_exhaustion(
        self,
        owner_id: str,
        workspace_id: str,
        required_credits: int
    ) -> ExhaustionResult:
        """
        Check if owner can afford operation and handle exhaustion.
        """
        
        balance = await self.get_credit_balance(owner_id)
        reserved = await self.get_reserved_credits(owner_id)
        available = balance - reserved
        
        # CASE 1: Sufficient credits
        if available >= required_credits:
            return ExhaustionResult(
                can_proceed=True,
                available_credits=available
            )
        
        # CASE 2: Within grace period (allow completion of current ops)
        if available >= -self.GRACE_PERIOD_CREDITS:
            active_ops = await self.get_active_operations(workspace_id)
            
            if active_ops:
                # Allow grace period for in-flight operations
                return ExhaustionResult(
                    can_proceed=True,
                    grace_period=True,
                    grace_expires_at=datetime.utcnow() + timedelta(seconds=self.GRACE_PERIOD_SECONDS),
                    warning="Credits exhausted. Current operation will complete, new operations blocked."
                )
        
        # CASE 3: Hard block
        await self.enter_exhaustion_mode(workspace_id, owner_id)
        
        return ExhaustionResult(
            can_proceed=False,
            available_credits=available,
            required_credits=required_credits,
            deficit=required_credits - available
        )
    
    async def enter_exhaustion_mode(
        self,
        workspace_id: str,
        owner_id: str
    ):
        """
        Put workspace into credit exhaustion mode.
        
        Effects:
        1. Block new prompts from all users
        2. Block new agent runs
        3. Allow read-only access
        4. Allow edits (no credit cost)
        5. Notify all collaborators
        """
        
        # Set workspace flag
        await self.db.execute("""
            UPDATE workspaces
            SET 
                credit_exhausted = true,
                credit_exhausted_at = now(),
                updated_at = now()
            WHERE id = $1
        """, workspace_id)
        
        # Broadcast to all connected clients
        await self.broadcast_to_workspace(
            workspace_id=workspace_id,
            event_type="credit_exhaustion",
            payload={
                "status": "exhausted",
                "message": "Workspace owner has run out of credits",
                "allowed_actions": ["view", "edit", "comment"],
                "blocked_actions": ["prompt", "run_agent", "call_tool"]
            }
        )
        
        # Notify owner
        await self.notify_owner(
            owner_id=owner_id,
            notification_type="credits_exhausted",
            payload={
                "workspace_id": workspace_id,
                "action_required": "Add credits to continue using AI features"
            }
        )
        
        # Log for audit
        await self.audit_log(
            event_type="credit_exhaustion",
            workspace_id=workspace_id,
            owner_id=owner_id,
            details={"balance": await self.get_credit_balance(owner_id)}
        )
    
    async def exit_exhaustion_mode(
        self,
        workspace_id: str,
        owner_id: str
    ):
        """
        Exit exhaustion mode when owner adds credits.
        """
        
        balance = await self.get_credit_balance(owner_id)
        
        if balance <= 0:
            raise InsufficientCredits("Still insufficient credits")
        
        # Clear workspace flag
        await self.db.execute("""
            UPDATE workspaces
            SET 
                credit_exhausted = false,
                credit_exhausted_at = null,
                updated_at = now()
            WHERE id = $1
        """, workspace_id)
        
        # Broadcast to all connected clients
        await self.broadcast_to_workspace(
            workspace_id=workspace_id,
            event_type="credit_restored",
            payload={
                "status": "active",
                "message": "Credits restored. All features available.",
                "allowed_actions": ["view", "edit", "comment", "prompt", "run_agent", "call_tool"]
            }
        )
```

## 1.7 Collaborator Action Blocking Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COLLABORATOR ACTION BLOCKING MATRIX                      │
├─────────────────────┬────────────┬────────────┬────────────┬───────────────┤
│ Scenario            │ View/Edit  │ Prompt     │ Run Agent  │ Behavior      │
├─────────────────────┼────────────┼────────────┼────────────┼───────────────┤
│ Normal operation    │ ✓ Allow    │ ✓ Allow*   │ ✓ Allow**  │ Normal        │
│ Daily limit reached │ ✓ Allow    │ ✗ Reject   │ ✗ Reject   │ Hard block    │
│ Owner low credits   │ ✓ Allow    │ ⚠ Queue    │ ⚠ Queue    │ Soft block    │
│ Owner no credits    │ ✓ Allow    │ ✗ Reject   │ ✗ Reject   │ Hard block    │
│ Owner offline       │ ✓ Allow    │ ⚠ Queue*** │ ✗ Reject   │ Mixed         │
│ Workspace locked    │ ✓ Allow    │ ✗ Reject   │ ✗ Reject   │ Hard block    │
├─────────────────────┴────────────┴────────────┴────────────┴───────────────┤
│ * Prompts may require approval based on auto_approve settings              │
│ ** Agent runs require RUNNER role and within daily_credit_limit            │
│ *** Prompts queued for 24h, then auto-rejected if owner doesn't respond    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Blocking Implementation

```python
class ActionBlocker:
    """
    Determines whether collaborator actions should be allowed, queued, or rejected.
    """
    
    async def check_action(
        self,
        workspace_id: str,
        user_id: str,
        action_type: ActionType,
        estimated_credits: int
    ) -> ActionDecision:
        """
        Returns: ActionDecision with status (allow, queue, reject) and reason
        """
        
        workspace = await self.get_workspace(workspace_id)
        permission = await self.get_permission(workspace_id, user_id)
        limits = await self.get_limits(workspace_id, user_id)
        owner_balance = await self.get_credit_balance(workspace.owner_id)
        
        # Check 1: Role permission
        if not self.role_allows_action(permission.role, action_type):
            return ActionDecision(
                status=DecisionStatus.REJECT,
                reason="INSUFFICIENT_ROLE",
                message=f"Role {permission.role} cannot perform {action_type}"
            )
        
        # Check 2: Workspace locked
        if workspace.is_locked:
            return ActionDecision(
                status=DecisionStatus.REJECT,
                reason="WORKSPACE_LOCKED",
                message="Workspace is locked by owner"
            )
        
        # Check 3: Credit exhaustion
        if workspace.credit_exhausted:
            return ActionDecision(
                status=DecisionStatus.REJECT,
                reason="CREDITS_EXHAUSTED",
                message="Workspace owner has no credits"
            )
        
        # Check 4: Daily limits (for non-owners)
        if user_id != workspace.owner_id:
            if action_type == ActionType.PROMPT:
                if limits.daily_prompts_used >= limits.daily_prompt_limit:
                    return ActionDecision(
                        status=DecisionStatus.REJECT,
                        reason="DAILY_PROMPT_LIMIT",
                        message=f"Daily prompt limit reached ({limits.daily_prompt_limit})",
                        reset_at=self.midnight_utc()
                    )
            
            if limits.daily_credits_used + estimated_credits > limits.daily_credit_limit:
                return ActionDecision(
                    status=DecisionStatus.REJECT,
                    reason="DAILY_CREDIT_LIMIT",
                    message="Would exceed daily credit limit",
                    available=limits.daily_credit_limit - limits.daily_credits_used
                )
        
        # Check 5: Owner balance
        if owner_balance < estimated_credits:
            # Low credits - queue for when owner adds more
            if owner_balance > 0:
                return ActionDecision(
                    status=DecisionStatus.QUEUE,
                    reason="OWNER_LOW_CREDITS",
                    message="Owner has low credits, action queued",
                    queue_expires_at=datetime.utcnow() + timedelta(hours=24)
                )
            else:
                return ActionDecision(
                    status=DecisionStatus.REJECT,
                    reason="OWNER_NO_CREDITS",
                    message="Owner has no credits"
                )
        
        # Check 6: Owner online status (for agent runs)
        if action_type == ActionType.AGENT_RUN:
            owner_presence = await self.get_presence(workspace_id, workspace.owner_id)
            if not owner_presence.is_online:
                return ActionDecision(
                    status=DecisionStatus.REJECT,
                    reason="OWNER_OFFLINE",
                    message="Owner must be online for agent runs"
                )
        
        # Check 7: Approval requirement
        if self.requires_approval(permission, action_type, estimated_credits, limits):
            return ActionDecision(
                status=DecisionStatus.QUEUE,
                reason="REQUIRES_APPROVAL",
                message="Action queued for owner approval"
            )
        
        # All checks passed
        return ActionDecision(
            status=DecisionStatus.ALLOW,
            reason="APPROVED"
        )
```

## 1.8 Idempotency Guarantees

### Idempotency Key Strategy

```python
class IdempotencyManager:
    """
    Ensures exactly-once semantics for billing operations.
    
    INVARIANTS:
    1. Same idempotency_key → same result (within TTL)
    2. No double-charging
    3. No double-refunding
    4. Atomic state transitions
    """
    
    IDEMPOTENCY_TTL = timedelta(hours=24)
    
    async def execute_with_idempotency(
        self,
        idempotency_key: str,
        operation: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute operation with idempotency guarantee.
        """
        
        # Check for existing result
        existing = await self.get_idempotency_record(idempotency_key)
        
        if existing:
            if existing.status == "completed":
                # Return cached result
                return existing.result
            elif existing.status == "in_progress":
                # Wait for completion or timeout
                return await self.wait_for_completion(idempotency_key)
            elif existing.status == "failed":
                # Allow retry after failure
                pass
        
        # Create in-progress record
        await self.create_idempotency_record(
            key=idempotency_key,
            status="in_progress",
            started_at=datetime.utcnow()
        )
        
        try:
            # Execute operation
            result = await operation(*args, **kwargs)
            
            # Store successful result
            await self.update_idempotency_record(
                key=idempotency_key,
                status="completed",
                result=result,
                completed_at=datetime.utcnow()
            )
            
            return result
            
        except Exception as e:
            # Store failure
            await self.update_idempotency_record(
                key=idempotency_key,
                status="failed",
                error=str(e),
                failed_at=datetime.utcnow()
            )
            raise
```

### SQL for Idempotent Credit Operations

```sql
-- Idempotent credit reservation
CREATE OR REPLACE FUNCTION billing.reserve_credits_idempotent(
    p_owner_id UUID,
    p_amount BIGINT,
    p_attribution_id UUID,
    p_idempotency_key VARCHAR(255)
) RETURNS TABLE (
    success BOOLEAN,
    already_reserved BOOLEAN,
    new_balance BIGINT,
    reserved_amount BIGINT
) AS $$
DECLARE
    v_existing_reservation RECORD;
    v_current_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- Check for existing reservation with same idempotency key
    SELECT * INTO v_existing_reservation
    FROM billing.credit_reservations
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;
    
    IF FOUND THEN
        -- Return existing reservation (idempotent)
        RETURN QUERY SELECT 
            true AS success,
            true AS already_reserved,
            v_existing_reservation.balance_after AS new_balance,
            v_existing_reservation.amount AS reserved_amount;
        RETURN;
    END IF;
    
    -- Lock user balance row
    SELECT balance INTO v_current_balance
    FROM billing.credit_balances
    WHERE user_id = p_owner_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0::BIGINT, 0::BIGINT;
        RETURN;
    END IF;
    
    -- Check sufficient balance
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, false, v_current_balance, 0::BIGINT;
        RETURN;
    END IF;
    
    -- Deduct from balance
    v_new_balance := v_current_balance - p_amount;
    
    UPDATE billing.credit_balances
    SET 
        balance = v_new_balance,
        reserved = reserved + p_amount,
        updated_at = now()
    WHERE user_id = p_owner_id;
    
    -- Create reservation record
    INSERT INTO billing.credit_reservations (
        user_id,
        attribution_id,
        amount,
        balance_before,
        balance_after,
        idempotency_key,
        created_at
    ) VALUES (
        p_owner_id,
        p_attribution_id,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_idempotency_key,
        now()
    );
    
    RETURN QUERY SELECT true, false, v_new_balance, p_amount;
END;
$$ LANGUAGE plpgsql;
```

## 1.9 Example Flows

### Flow 1: Collaborator Sends Prompt (Auto-Approved)

```
Timeline:
─────────────────────────────────────────────────────────────────────────────
T+0ms    Collaborator (PROMPTER role) sends prompt
         │
         ▼
T+5ms    check_action() → ALLOW (auto_approve=true, estimated < threshold)
         │
         ▼
T+10ms   create_credit_attribution(state=IDLE)
         │
         ▼
T+15ms   transition_billing_state(IDLE → RESERVED)
         reserve_credits_idempotent(owner_id, estimated_credits)
         │
         ▼
T+20ms   transition_billing_state(RESERVED → CHARGING)
         │
         ▼
T+100ms  LLM call starts
         │
         ▼
T+3000ms LLM call completes
         record_token_call(actual_tokens)
         │
         ▼
T+3010ms transition_billing_state(CHARGING → COMPLETED)
         finalize_credits(actual_credits)
         refund_excess(reserved - actual)
         │
         ▼
T+3020ms update_collaborator_limits(daily_credits_used += actual)
         │
         ▼
T+3025ms Return response to collaborator

SQL Writes:
1. INSERT INTO collab.credit_attributions (state='idle')
2. UPDATE collab.credit_attributions SET state='reserved'
3. INSERT INTO billing.credit_reservations
4. UPDATE billing.credit_balances SET balance -= reserved
5. UPDATE collab.credit_attributions SET state='charging'
6. INSERT INTO billing.token_records
7. UPDATE collab.credit_attributions SET state='completed', credits_charged=X
8. INSERT INTO billing.billing_ledger (type='charge')
9. INSERT INTO billing.billing_ledger (type='refund') -- if excess
10. UPDATE billing.credit_balances SET balance += refund
11. UPDATE collab.collaborator_limits SET daily_credits_used += X
```

### Flow 2: Collaborator Sends Prompt (Requires Approval)

```
Timeline:
─────────────────────────────────────────────────────────────────────────────
T+0ms    Collaborator (PROMPTER role) sends prompt
         │
         ▼
T+5ms    check_action() → QUEUE (auto_approve=false)
         │
         ▼
T+10ms   create_credit_attribution(state=IDLE)
         │
         ▼
T+15ms   transition_billing_state(IDLE → PENDING)
         │
         ▼
T+20ms   create_pending_approval()
         │
         ▼
T+25ms   notify_owner_approval_needed()
         │
         ▼
T+30ms   Return "pending_approval" to collaborator
         │
         ▼
         ... Owner receives notification ...
         │
         ▼
T+60000ms Owner clicks "Approve"
         │
         ▼
T+60005ms handle_approval_decision(decision='approve')
         │
         ▼
T+60010ms check owner still has credits
         │
         ▼
T+60015ms reserve_credits_idempotent()
         transition_billing_state(PENDING → RESERVED)
         │
         ▼
T+60020ms update_pending_approval(status='approved')
         │
         ▼
T+60025ms execute_approved_action()
         transition_billing_state(RESERVED → CHARGING)
         │
         ▼
T+63000ms LLM completes, finalize billing
         │
         ▼
T+63010ms notify_collaborator(result)
```

### Flow 3: Owner Runs Out of Credits Mid-Session

```
Timeline:
─────────────────────────────────────────────────────────────────────────────
T+0ms    Agent running, owner balance = 5 credits
         │
         ▼
T+100ms  Step 1 completes, charges 3 credits
         owner balance = 2 credits
         │
         ▼
T+200ms  Step 2 starts, estimates 4 credits needed
         │
         ▼
T+205ms  check_and_handle_exhaustion() detects insufficient credits
         │
         ▼
T+210ms  Grace period activated (in-flight operation)
         │
         ▼
T+300ms  Step 2 completes, charges 4 credits
         owner balance = -2 credits (within grace)
         │
         ▼
T+310ms  enter_exhaustion_mode(workspace_id)
         │
         ▼
T+315ms  broadcast_to_workspace("credit_exhaustion")
         All collaborators see: "Workspace owner has run out of credits"
         │
         ▼
T+320ms  notify_owner("credits_exhausted")
         │
         ▼
T+400ms  Collaborator tries to send prompt
         │
         ▼
T+405ms  check_action() → REJECT (CREDITS_EXHAUSTED)
         │
         ▼
         ... Owner adds 100 credits ...
         │
         ▼
T+120000ms exit_exhaustion_mode()
         │
         ▼
T+120005ms broadcast_to_workspace("credit_restored")
         │
         ▼
T+120010ms Collaborator can now send prompts again
```

## 1.10 Edge Cases

### Edge Case 1: Concurrent Approvals

**Scenario:** Two owners (unlikely but possible with org-level permissions) try to approve the same pending request simultaneously.

**Solution:** Row-level locking with `FOR UPDATE`

```sql
-- Only one approval can succeed
SELECT * FROM collab.pending_approvals
WHERE id = $1 AND status = 'pending'
FOR UPDATE SKIP LOCKED;

-- If no row returned, another transaction got it
```

### Edge Case 2: Owner Removes Collaborator Mid-Operation

**Scenario:** Owner removes collaborator's access while their prompt is executing.

**Solution:** Operation completes, but collaborator cannot see result.

```python
async def handle_collaborator_removal(
    workspace_id: str,
    user_id: str,
    removed_by: str
):
    # Check for in-flight operations
    active_ops = await get_active_operations_by_user(workspace_id, user_id)
    
    for op in active_ops:
        # Mark operation as orphaned (will complete but result hidden)
        await mark_operation_orphaned(op.id, reason="collaborator_removed")
    
    # Remove permission
    await remove_permission(workspace_id, user_id)
    
    # Disconnect WebSocket
    await disconnect_user_from_workspace(workspace_id, user_id)
```

### Edge Case 3: Idempotency Key Collision

**Scenario:** Two different operations accidentally use the same idempotency key.

**Solution:** Include operation-specific data in key generation.

```python
def generate_idempotency_key(
    workspace_id: str,
    user_id: str,
    action_type: str,
    content_hash: str,
    timestamp_bucket: int  # 1-minute buckets
) -> str:
    """
    Generate collision-resistant idempotency key.
    """
    components = [
        workspace_id,
        user_id,
        action_type,
        content_hash[:16],  # First 16 chars of content hash
        str(timestamp_bucket)
    ]
    return hashlib.sha256(":".join(components).encode()).hexdigest()[:32]
```

---

# Part 2: Email Identity & Auth Model

## 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL INGESTION PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  SMTP   │───▶│ Postfix │───▶│ Milter  │───▶│ Worker  │───▶│ Agent   │  │
│  │ Inbound │    │ MTA     │    │ Filter  │    │ Queue   │    │ Runtime │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ TLS     │    │ SPF/    │    │ Malware │    │ Identity│    │ Task    │  │
│  │ Verify  │    │ DKIM/   │    │ Scan    │    │ Resolve │    │ Execute │  │
│  │         │    │ DMARC   │    │         │    │         │    │         │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Sender Identity Resolution

### Email-to-User Mapping Schema

```sql
-- Verified email addresses linked to users
CREATE TABLE email.verified_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    
    -- Verification status
    verified_at TIMESTAMPTZ,
    verification_token VARCHAR(255),
    verification_expires_at TIMESTAMPTZ,
    
    -- Settings
    is_primary BOOLEAN NOT NULL DEFAULT false,
    can_trigger_tasks BOOLEAN NOT NULL DEFAULT true,
    daily_task_limit INT NOT NULL DEFAULT 100,
    
    -- Security
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (email_address),
    INDEX idx_user_emails (user_id),
    INDEX idx_email_lookup (lower(email_address))
);

-- Organization email domains
CREATE TABLE email.org_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    
    -- Verification
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50),  -- 'dns_txt', 'dns_cname', 'email'
    verification_token VARCHAR(255),
    
    -- Settings
    auto_provision_users BOOLEAN NOT NULL DEFAULT false,
    default_role org_role NOT NULL DEFAULT 'member',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (domain),
    INDEX idx_org_domains (org_id)
);

-- Email aliases for tasks
CREATE TABLE email.task_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    alias_address VARCHAR(255) NOT NULL,  -- e.g., task-abc123@reply.manus.im
    
    -- Permissions
    allowed_senders JSONB NOT NULL DEFAULT '[]',  -- List of allowed email patterns
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (alias_address),
    INDEX idx_task_alias (task_id)
);
```

### Identity Resolution Algorithm

```python
class EmailIdentityResolver:
    """
    Resolves sender email to Manus user/org identity.
    
    Resolution order:
    1. Exact match in verified_addresses
    2. Domain match in org_domains (if auto_provision enabled)
    3. Task alias match (for reply-to-task)
    4. Reject as unknown sender
    """
    
    async def resolve_sender(
        self,
        from_address: str,
        to_address: str,
        message_id: str
    ) -> IdentityResult:
        """
        Resolve sender identity from email headers.
        """
        
        from_email = self.parse_email_address(from_address)
        from_domain = from_email.split('@')[1].lower()
        
        # STEP 1: Check verified addresses (exact match)
        verified = await self.db.fetchrow("""
            SELECT 
                va.user_id,
                va.can_trigger_tasks,
                va.daily_task_limit,
                u.org_id,
                u.status as user_status
            FROM email.verified_addresses va
            JOIN users u ON u.id = va.user_id
            WHERE lower(va.email_address) = lower($1)
              AND va.verified_at IS NOT NULL
        """, from_email)
        
        if verified:
            if verified['user_status'] != 'active':
                return IdentityResult(
                    status="rejected",
                    reason="USER_INACTIVE",
                    message="User account is not active"
                )
            
            if not verified['can_trigger_tasks']:
                return IdentityResult(
                    status="rejected",
                    reason="EMAIL_TASKS_DISABLED",
                    message="Email task triggering is disabled for this address"
                )
            
            return IdentityResult(
                status="resolved",
                user_id=verified['user_id'],
                org_id=verified['org_id'],
                resolution_method="verified_address",
                daily_limit=verified['daily_task_limit']
            )
        
        # STEP 2: Check org domains (domain match)
        org_domain = await self.db.fetchrow("""
            SELECT 
                od.org_id,
                od.auto_provision_users,
                od.default_role,
                o.status as org_status
            FROM email.org_domains od
            JOIN orgs o ON o.id = od.org_id
            WHERE od.domain = $1
              AND od.verified_at IS NOT NULL
        """, from_domain)
        
        if org_domain:
            if org_domain['org_status'] != 'active':
                return IdentityResult(
                    status="rejected",
                    reason="ORG_INACTIVE",
                    message="Organization is not active"
                )
            
            if org_domain['auto_provision_users']:
                # Auto-provision new user
                user = await self.provision_user_from_email(
                    email=from_email,
                    org_id=org_domain['org_id'],
                    role=org_domain['default_role']
                )
                
                return IdentityResult(
                    status="resolved",
                    user_id=user.id,
                    org_id=org_domain['org_id'],
                    resolution_method="auto_provisioned",
                    newly_provisioned=True
                )
            else:
                return IdentityResult(
                    status="rejected",
                    reason="USER_NOT_FOUND",
                    message="Email address not registered and auto-provisioning disabled"
                )
        
        # STEP 3: Check task aliases (reply-to-task)
        to_email = self.parse_email_address(to_address)
        
        if to_email.endswith('@reply.manus.im'):
            alias = await self.db.fetchrow("""
                SELECT 
                    ta.task_id,
                    ta.allowed_senders,
                    ta.expires_at,
                    t.user_id,
                    t.org_id
                FROM email.task_aliases ta
                JOIN tasks t ON t.id = ta.task_id
                WHERE ta.alias_address = $1
            """, to_email)
            
            if alias:
                # Check expiration
                if alias['expires_at'] and alias['expires_at'] < datetime.utcnow():
                    return IdentityResult(
                        status="rejected",
                        reason="ALIAS_EXPIRED",
                        message="Task reply alias has expired"
                    )
                
                # Check allowed senders
                if not self.sender_allowed(from_email, alias['allowed_senders']):
                    return IdentityResult(
                        status="rejected",
                        reason="SENDER_NOT_ALLOWED",
                        message="Sender not in allowed list for this task"
                    )
                
                return IdentityResult(
                    status="resolved",
                    user_id=alias['user_id'],
                    org_id=alias['org_id'],
                    task_id=alias['task_id'],
                    resolution_method="task_alias",
                    is_reply=True
                )
        
        # STEP 4: Unknown sender
        return IdentityResult(
            status="rejected",
            reason="UNKNOWN_SENDER",
            message="Email address not associated with any Manus account"
        )
    
    def sender_allowed(
        self,
        sender: str,
        allowed_patterns: List[str]
    ) -> bool:
        """
        Check if sender matches any allowed pattern.
        
        Patterns can be:
        - Exact email: "user@example.com"
        - Domain wildcard: "*@example.com"
        - Any: "*"
        """
        if not allowed_patterns or "*" in allowed_patterns:
            return True
        
        sender_lower = sender.lower()
        sender_domain = sender_lower.split('@')[1]
        
        for pattern in allowed_patterns:
            pattern_lower = pattern.lower()
            
            if pattern_lower == sender_lower:
                return True
            
            if pattern_lower.startswith('*@'):
                pattern_domain = pattern_lower[2:]
                if sender_domain == pattern_domain:
                    return True
        
        return False
```

## 2.3 Spoofing Prevention

### Security Validation Pipeline

```python
class EmailSecurityValidator:
    """
    Validates email authenticity using SPF, DKIM, and DMARC.
    
    CRITICAL: All three checks must pass for task triggering.
    """
    
    async def validate_email_security(
        self,
        email: InboundEmail
    ) -> SecurityValidationResult:
        """
        Perform comprehensive security validation.
        """
        
        results = {
            'spf': await self.check_spf(email),
            'dkim': await self.check_dkim(email),
            'dmarc': await self.check_dmarc(email)
        }
        
        # Determine overall result
        if all(r.status == 'pass' for r in results.values()):
            overall_status = 'pass'
        elif any(r.status == 'fail' for r in results.values()):
            overall_status = 'fail'
        else:
            overall_status = 'softfail'
        
        return SecurityValidationResult(
            overall_status=overall_status,
            spf=results['spf'],
            dkim=results['dkim'],
            dmarc=results['dmarc'],
            can_trigger_task=(overall_status == 'pass'),
            warnings=self.collect_warnings(results)
        )
    
    async def check_spf(self, email: InboundEmail) -> SPFResult:
        """
        Validate SPF (Sender Policy Framework).
        
        Checks if the sending server is authorized to send for the domain.
        """
        
        sender_domain = email.from_address.split('@')[1]
        sender_ip = email.received_from_ip
        
        try:
            # Query SPF record
            spf_record = await self.dns_query(sender_domain, 'TXT', filter='v=spf1')
            
            if not spf_record:
                return SPFResult(
                    status='none',
                    reason='No SPF record found'
                )
            
            # Parse and evaluate SPF
            result = self.evaluate_spf(spf_record, sender_ip, sender_domain)
            
            return SPFResult(
                status=result.status,  # 'pass', 'fail', 'softfail', 'neutral'
                reason=result.reason,
                record=spf_record
            )
            
        except Exception as e:
            return SPFResult(
                status='temperror',
                reason=f'SPF check failed: {str(e)}'
            )
    
    async def check_dkim(self, email: InboundEmail) -> DKIMResult:
        """
        Validate DKIM (DomainKeys Identified Mail).
        
        Verifies the email signature matches the content.
        """
        
        dkim_signature = email.headers.get('DKIM-Signature')
        
        if not dkim_signature:
            return DKIMResult(
                status='none',
                reason='No DKIM signature present'
            )
        
        try:
            # Parse DKIM signature
            parsed = self.parse_dkim_signature(dkim_signature)
            
            # Fetch public key from DNS
            selector = parsed['s']
            domain = parsed['d']
            dkim_record = await self.dns_query(
                f'{selector}._domainkey.{domain}',
                'TXT'
            )
            
            if not dkim_record:
                return DKIMResult(
                    status='fail',
                    reason='DKIM public key not found in DNS'
                )
            
            # Verify signature
            public_key = self.extract_public_key(dkim_record)
            is_valid = self.verify_dkim_signature(
                email=email,
                signature=parsed,
                public_key=public_key
            )
            
            if is_valid:
                return DKIMResult(
                    status='pass',
                    reason='DKIM signature verified',
                    signing_domain=domain
                )
            else:
                return DKIMResult(
                    status='fail',
                    reason='DKIM signature verification failed'
                )
                
        except Exception as e:
            return DKIMResult(
                status='temperror',
                reason=f'DKIM check failed: {str(e)}'
            )
    
    async def check_dmarc(self, email: InboundEmail) -> DMARCResult:
        """
        Validate DMARC (Domain-based Message Authentication).
        
        Combines SPF and DKIM results with domain policy.
        """
        
        from_domain = email.from_address.split('@')[1]
        
        try:
            # Query DMARC record
            dmarc_record = await self.dns_query(
                f'_dmarc.{from_domain}',
                'TXT',
                filter='v=DMARC1'
            )
            
            if not dmarc_record:
                return DMARCResult(
                    status='none',
                    reason='No DMARC record found',
                    policy='none'
                )
            
            # Parse DMARC policy
            policy = self.parse_dmarc_policy(dmarc_record)
            
            # Evaluate based on SPF and DKIM results
            spf_aligned = self.check_spf_alignment(email, policy)
            dkim_aligned = self.check_dkim_alignment(email, policy)
            
            if spf_aligned or dkim_aligned:
                return DMARCResult(
                    status='pass',
                    reason='DMARC alignment passed',
                    policy=policy['p'],
                    spf_aligned=spf_aligned,
                    dkim_aligned=dkim_aligned
                )
            else:
                return DMARCResult(
                    status='fail',
                    reason='DMARC alignment failed',
                    policy=policy['p'],
                    action=self.get_dmarc_action(policy)
                )
                
        except Exception as e:
            return DMARCResult(
                status='temperror',
                reason=f'DMARC check failed: {str(e)}'
            )
```

### Security Validation Schema

```sql
-- Email security validation results
CREATE TABLE email.security_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES email.inbound_emails(id),
    
    -- Overall result
    overall_status security_status NOT NULL,  -- 'pass', 'fail', 'softfail', 'none'
    can_trigger_task BOOLEAN NOT NULL,
    
    -- SPF
    spf_status security_status NOT NULL,
    spf_reason TEXT,
    spf_record TEXT,
    
    -- DKIM
    dkim_status security_status NOT NULL,
    dkim_reason TEXT,
    dkim_signing_domain VARCHAR(255),
    
    -- DMARC
    dmarc_status security_status NOT NULL,
    dmarc_reason TEXT,
    dmarc_policy VARCHAR(50),
    
    -- Additional checks
    reverse_dns_valid BOOLEAN,
    tls_version VARCHAR(20),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    INDEX idx_email_security (email_id)
);
```

## 2.4 Forwarded Thread Handling

### Thread Detection and Parsing

```python
class ForwardedThreadHandler:
    """
    Handles forwarded email threads and extracts actionable content.
    
    Challenges:
    1. Different email clients format forwards differently
    2. Nested forwards create complex structures
    3. Original sender identity must be preserved
    4. Attachments may be inline or separate
    """
    
    # Common forward patterns
    FORWARD_PATTERNS = [
        r'^-+\s*Forwarded message\s*-+',
        r'^Begin forwarded message:',
        r'^-+\s*Original Message\s*-+',
        r'^From:.*\nSent:.*\nTo:.*\nSubject:',
        r'^>{3,}',  # >>> quoted text
    ]
    
    async def process_forwarded_email(
        self,
        email: InboundEmail
    ) -> ForwardedThreadResult:
        """
        Process a forwarded email thread.
        """
        
        # Detect if this is a forward
        is_forward = self.detect_forward(email)
        
        if not is_forward:
            return ForwardedThreadResult(
                is_forward=False,
                original_email=email
            )
        
        # Parse the forwarded content
        parsed = self.parse_forward_structure(email.body)
        
        # Extract original sender info
        original_sender = self.extract_original_sender(parsed)
        
        # Extract the user's instruction (text before the forward)
        user_instruction = self.extract_user_instruction(email.body, parsed)
        
        # Build thread context
        thread_context = self.build_thread_context(parsed)
        
        return ForwardedThreadResult(
            is_forward=True,
            original_email=email,
            user_instruction=user_instruction,
            original_sender=original_sender,
            thread_context=thread_context,
            forward_depth=len(parsed.nested_forwards),
            attachments=self.consolidate_attachments(email, parsed)
        )
    
    def parse_forward_structure(self, body: str) -> ForwardStructure:
        """
        Parse the structure of a forwarded email.
        
        Returns a tree structure representing nested forwards.
        """
        
        lines = body.split('\n')
        structure = ForwardStructure()
        current_section = 'user_content'
        current_forward = None
        
        for i, line in enumerate(lines):
            # Check for forward boundary
            for pattern in self.FORWARD_PATTERNS:
                if re.match(pattern, line, re.IGNORECASE):
                    if current_forward:
                        structure.nested_forwards.append(current_forward)
                    current_forward = ForwardedMessage()
                    current_section = 'forward_header'
                    break
            
            if current_section == 'user_content':
                structure.user_content.append(line)
            elif current_section == 'forward_header':
                # Parse header fields
                if line.startswith('From:'):
                    current_forward.from_address = self.extract_header_value(line)
                elif line.startswith('Date:'):
                    current_forward.date = self.parse_date(self.extract_header_value(line))
                elif line.startswith('Subject:'):
                    current_forward.subject = self.extract_header_value(line)
                elif line.startswith('To:'):
                    current_forward.to_address = self.extract_header_value(line)
                elif line.strip() == '':
                    current_section = 'forward_body'
            elif current_section == 'forward_body':
                current_forward.body.append(line)
        
        if current_forward:
            structure.nested_forwards.append(current_forward)
        
        return structure
    
    def extract_user_instruction(
        self,
        body: str,
        parsed: ForwardStructure
    ) -> str:
        """
        Extract the user's instruction from before the forwarded content.
        
        This is typically what the user wants done with the forwarded email.
        """
        
        user_content = '\n'.join(parsed.user_content).strip()
        
        # Remove common prefixes
        prefixes_to_remove = [
            'fwd:',
            'fw:',
            'please see below',
            'see attached',
            'forwarding this',
        ]
        
        for prefix in prefixes_to_remove:
            if user_content.lower().startswith(prefix):
                user_content = user_content[len(prefix):].strip()
        
        return user_content if user_content else None
```

## 2.5 Reply-to-Task Behavior

### Task Reply System

```python
class TaskReplyHandler:
    """
    Handles email replies to existing tasks.
    
    Flow:
    1. User receives email from task with reply-to alias
    2. User replies to the alias
    3. Reply is routed to the original task
    4. Task context is updated with reply content
    """
    
    async def create_task_reply_alias(
        self,
        task_id: str,
        allowed_senders: List[str] = None,
        expires_in: timedelta = timedelta(days=7)
    ) -> str:
        """
        Create a reply alias for a task.
        """
        
        # Generate unique alias
        alias_id = self.generate_alias_id()
        alias_address = f"task-{alias_id}@reply.manus.im"
        
        await self.db.execute("""
            INSERT INTO email.task_aliases (
                task_id,
                alias_address,
                allowed_senders,
                expires_at
            ) VALUES ($1, $2, $3, $4)
        """, task_id, alias_address, json.dumps(allowed_senders or ['*']),
             datetime.utcnow() + expires_in)
        
        return alias_address
    
    async def handle_task_reply(
        self,
        email: InboundEmail,
        alias: TaskAlias
    ) -> TaskReplyResult:
        """
        Process an email reply to a task.
        """
        
        task = await self.get_task(alias.task_id)
        
        if not task:
            return TaskReplyResult(
                status="failed",
                reason="TASK_NOT_FOUND",
                message="The task no longer exists"
            )
        
        if task.status in ['completed', 'cancelled']:
            return TaskReplyResult(
                status="failed",
                reason="TASK_CLOSED",
                message=f"The task is already {task.status}"
            )
        
        # Extract reply content (remove quoted original)
        reply_content = self.extract_reply_content(email.body)
        
        # Process attachments
        attachments = await self.process_reply_attachments(email)
        
        # Add reply to task context
        await self.add_task_context(
            task_id=task.id,
            context_type="email_reply",
            content={
                "from": email.from_address,
                "subject": email.subject,
                "body": reply_content,
                "attachments": [a.id for a in attachments],
                "received_at": email.received_at.isoformat()
            }
        )
        
        # Resume task if paused waiting for reply
        if task.status == 'waiting_for_input':
            await self.resume_task(task.id, trigger="email_reply")
        
        return TaskReplyResult(
            status="success",
            task_id=task.id,
            context_added=True,
            task_resumed=(task.status == 'waiting_for_input')
        )
    
    def extract_reply_content(self, body: str) -> str:
        """
        Extract only the new reply content, removing quoted original.
        """
        
        lines = body.split('\n')
        reply_lines = []
        in_quote = False
        
        for line in lines:
            # Detect quote markers
            if line.startswith('>') or line.startswith('|'):
                in_quote = True
                continue
            
            # Detect "On ... wrote:" pattern
            if re.match(r'^On .+ wrote:$', line):
                break
            
            # Detect separator lines
            if re.match(r'^-{3,}|^_{3,}|^={3,}', line):
                break
            
            if not in_quote:
                reply_lines.append(line)
        
        return '\n'.join(reply_lines).strip()
```

## 2.6 CC/BCC Semantics

### CC/BCC Handling Rules

```python
class CCBCCHandler:
    """
    Handles CC and BCC recipients in email-triggered tasks.
    
    Rules:
    1. CC recipients are visible in task context
    2. BCC recipients are NOT visible (by definition)
    3. CC recipients can be added as task collaborators
    4. BCC recipients cannot trigger tasks
    """
    
    async def process_recipients(
        self,
        email: InboundEmail,
        task: Task
    ) -> RecipientProcessingResult:
        """
        Process CC recipients for a task.
        """
        
        results = {
            'cc_processed': [],
            'cc_skipped': [],
            'collaborators_added': []
        }
        
        # Process CC recipients
        for cc_address in email.cc_addresses:
            cc_result = await self.process_cc_recipient(
                cc_address=cc_address,
                task=task,
                sender=email.from_address
            )
            
            if cc_result.added_as_collaborator:
                results['collaborators_added'].append(cc_address)
                results['cc_processed'].append(cc_address)
            elif cc_result.skipped:
                results['cc_skipped'].append({
                    'address': cc_address,
                    'reason': cc_result.skip_reason
                })
            else:
                results['cc_processed'].append(cc_address)
        
        # Add CC context to task
        await self.add_task_context(
            task_id=task.id,
            context_type="email_recipients",
            content={
                "to": email.to_addresses,
                "cc": results['cc_processed'],
                "cc_skipped": results['cc_skipped']
                # BCC intentionally omitted
            }
        )
        
        return RecipientProcessingResult(**results)
    
    async def process_cc_recipient(
        self,
        cc_address: str,
        task: Task,
        sender: str
    ) -> CCRecipientResult:
        """
        Process a single CC recipient.
        """
        
        # Check if CC recipient is a Manus user
        user = await self.find_user_by_email(cc_address)
        
        if not user:
            return CCRecipientResult(
                address=cc_address,
                is_manus_user=False,
                added_as_collaborator=False
            )
        
        # Check if sender has permission to add collaborators
        sender_user = await self.find_user_by_email(sender)
        if not sender_user:
            return CCRecipientResult(
                address=cc_address,
                is_manus_user=True,
                added_as_collaborator=False,
                skipped=True,
                skip_reason="Sender not authorized to add collaborators"
            )
        
        # Check task settings
        task_settings = await self.get_task_settings(task.id)
        
        if not task_settings.auto_add_cc_as_collaborators:
            return CCRecipientResult(
                address=cc_address,
                is_manus_user=True,
                added_as_collaborator=False,
                skipped=True,
                skip_reason="Auto-add CC disabled for this task"
            )
        
        # Add as collaborator with viewer role
        await self.add_task_collaborator(
            task_id=task.id,
            user_id=user.id,
            role='viewer',
            added_by=sender_user.id,
            added_via='email_cc'
        )
        
        return CCRecipientResult(
            address=cc_address,
            is_manus_user=True,
            added_as_collaborator=True,
            collaborator_role='viewer'
        )
```

## 2.7 Email-Triggered Retries

### Retry via Email

```python
class EmailRetryHandler:
    """
    Handles task retries triggered via email.
    
    Supported patterns:
    1. Reply with "retry" to failed task notification
    2. Reply with specific instructions for modified retry
    3. Forward original email with "retry" instruction
    """
    
    RETRY_KEYWORDS = ['retry', 'try again', 'rerun', 'redo']
    
    async def check_and_handle_retry(
        self,
        email: InboundEmail,
        identity: IdentityResult
    ) -> RetryResult:
        """
        Check if email is a retry request and handle it.
        """
        
        # Check if this is a reply to a task notification
        if identity.is_reply and identity.task_id:
            task = await self.get_task(identity.task_id)
            
            if task and task.status == 'failed':
                # Check for retry keywords
                body_lower = email.body.lower()
                
                if any(kw in body_lower for kw in self.RETRY_KEYWORDS):
                    return await self.execute_retry(
                        task=task,
                        email=email,
                        identity=identity
                    )
        
        return RetryResult(is_retry=False)
    
    async def execute_retry(
        self,
        task: Task,
        email: InboundEmail,
        identity: IdentityResult
    ) -> RetryResult:
        """
        Execute a task retry.
        """
        
        # Check retry limits
        retry_count = await self.get_retry_count(task.id)
        max_retries = await self.get_max_retries(task.id)
        
        if retry_count >= max_retries:
            return RetryResult(
                is_retry=True,
                status="rejected",
                reason="MAX_RETRIES_EXCEEDED",
                message=f"Maximum retries ({max_retries}) exceeded"
            )
        
        # Check user permission
        if identity.user_id != task.user_id:
            # Check if user is a collaborator with retry permission
            permission = await self.get_task_permission(task.id, identity.user_id)
            if not permission or permission.role not in ['owner', 'runner']:
                return RetryResult(
                    is_retry=True,
                    status="rejected",
                    reason="INSUFFICIENT_PERMISSION",
                    message="You don't have permission to retry this task"
                )
        
        # Extract modified instructions (if any)
        modified_instructions = self.extract_modified_instructions(email.body)
        
        # Create retry
        new_task = await self.create_retry_task(
            original_task=task,
            triggered_by=identity.user_id,
            triggered_via='email',
            modified_instructions=modified_instructions
        )
        
        # Record retry
        await self.record_retry(
            original_task_id=task.id,
            new_task_id=new_task.id,
            triggered_by=identity.user_id,
            triggered_via='email',
            email_id=email.id
        )
        
        return RetryResult(
            is_retry=True,
            status="success",
            new_task_id=new_task.id,
            retry_number=retry_count + 1
        )
```

## 2.8 Audit Logging

### Email Audit Schema

```sql
-- Comprehensive email audit log
CREATE TABLE email.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type email_audit_event NOT NULL,
    event_id UUID NOT NULL,  -- Reference to specific event
    
    -- Email identification
    email_id UUID REFERENCES email.inbound_emails(id),
    message_id VARCHAR(255),
    
    -- Identity
    resolved_user_id UUID REFERENCES users(id),
    resolved_org_id UUID REFERENCES orgs(id),
    sender_address VARCHAR(255),
    
    -- Security
    security_status security_status,
    spf_status security_status,
    dkim_status security_status,
    dmarc_status security_status,
    
    -- Action taken
    action_taken email_action NOT NULL,  -- 'accepted', 'rejected', 'quarantined'
    rejection_reason VARCHAR(255),
    
    -- Task (if created)
    task_id UUID REFERENCES tasks(id),
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    processing_time_ms INT,
    
    -- Full event data (for compliance)
    event_data JSONB NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Indexes for common queries
    INDEX idx_audit_email (email_id),
    INDEX idx_audit_user (resolved_user_id, created_at DESC),
    INDEX idx_audit_org (resolved_org_id, created_at DESC),
    INDEX idx_audit_event_type (event_type, created_at DESC),
    INDEX idx_audit_action (action_taken, created_at DESC),
    INDEX idx_audit_security (security_status, created_at DESC)
);

-- Email audit event types
CREATE TYPE email_audit_event AS ENUM (
    'email_received',
    'security_validated',
    'security_failed',
    'identity_resolved',
    'identity_failed',
    'malware_detected',
    'task_created',
    'task_creation_failed',
    'reply_processed',
    'retry_triggered',
    'attachment_processed',
    'attachment_rejected',
    'rate_limited',
    'quarantined'
);
```

### Audit Logging Implementation

```python
class EmailAuditLogger:
    """
    Comprehensive audit logging for email processing.
    
    COMPLIANCE REQUIREMENTS:
    1. Every email must be logged
    2. All security decisions must be logged
    3. All identity resolutions must be logged
    4. Logs are immutable (append-only)
    5. Retention: 7 years minimum
    """
    
    async def log_email_received(
        self,
        email: InboundEmail
    ) -> str:
        """Log initial email receipt."""
        
        return await self.create_audit_entry(
            event_type='email_received',
            email_id=email.id,
            message_id=email.message_id,
            sender_address=email.from_address,
            ip_address=email.received_from_ip,
            action_taken='pending',
            event_data={
                'subject': email.subject,
                'to': email.to_addresses,
                'cc': email.cc_addresses,
                'size_bytes': email.size_bytes,
                'attachment_count': len(email.attachments),
                'received_at': email.received_at.isoformat()
            }
        )
    
    async def log_security_validation(
        self,
        email: InboundEmail,
        validation: SecurityValidationResult
    ) -> str:
        """Log security validation result."""
        
        event_type = 'security_validated' if validation.can_trigger_task else 'security_failed'
        
        return await self.create_audit_entry(
            event_type=event_type,
            email_id=email.id,
            message_id=email.message_id,
            sender_address=email.from_address,
            security_status=validation.overall_status,
            spf_status=validation.spf.status,
            dkim_status=validation.dkim.status,
            dmarc_status=validation.dmarc.status,
            action_taken='validated' if validation.can_trigger_task else 'rejected',
            rejection_reason=None if validation.can_trigger_task else 'security_failed',
            event_data={
                'spf': {
                    'status': validation.spf.status,
                    'reason': validation.spf.reason
                },
                'dkim': {
                    'status': validation.dkim.status,
                    'reason': validation.dkim.reason,
                    'signing_domain': validation.dkim.signing_domain
                },
                'dmarc': {
                    'status': validation.dmarc.status,
                    'reason': validation.dmarc.reason,
                    'policy': validation.dmarc.policy
                }
            }
        )
    
    async def log_identity_resolution(
        self,
        email: InboundEmail,
        identity: IdentityResult
    ) -> str:
        """Log identity resolution result."""
        
        event_type = 'identity_resolved' if identity.status == 'resolved' else 'identity_failed'
        
        return await self.create_audit_entry(
            event_type=event_type,
            email_id=email.id,
            message_id=email.message_id,
            sender_address=email.from_address,
            resolved_user_id=identity.user_id if identity.status == 'resolved' else None,
            resolved_org_id=identity.org_id if identity.status == 'resolved' else None,
            action_taken='resolved' if identity.status == 'resolved' else 'rejected',
            rejection_reason=identity.reason if identity.status != 'resolved' else None,
            event_data={
                'resolution_method': identity.resolution_method,
                'is_reply': identity.is_reply,
                'task_id': identity.task_id,
                'newly_provisioned': identity.newly_provisioned
            }
        )
    
    async def log_task_created(
        self,
        email: InboundEmail,
        identity: IdentityResult,
        task: Task
    ) -> str:
        """Log successful task creation."""
        
        return await self.create_audit_entry(
            event_type='task_created',
            email_id=email.id,
            message_id=email.message_id,
            sender_address=email.from_address,
            resolved_user_id=identity.user_id,
            resolved_org_id=identity.org_id,
            task_id=task.id,
            action_taken='accepted',
            event_data={
                'task_type': task.type,
                'estimated_credits': task.estimated_credits,
                'attachments_processed': len(task.attachments)
            }
        )
```

---

# Part 3: Billing Failure & Retry Economics

## 3.1 Billing States During Failure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BILLING FAILURE STATE MACHINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌─────────────┐                                │
│                              │  RESERVED   │                                │
│                              └──────┬──────┘                                │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                                │
│                              │  CHARGING   │                                │
│                              └──────┬──────┘                                │
│                                     │                                       │
│           ┌─────────────────────────┼─────────────────────────┐             │
│           │                         │                         │             │
│           ▼                         ▼                         ▼             │
│    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│    │  COMPLETED  │          │   FAILED    │          │  CANCELLED  │        │
│    │             │          │             │          │             │        │
│    │ Full charge │          │ Partial     │          │ Full refund │        │
│    │ No refund   │          │ refund      │          │             │        │
│    └─────────────┘          └──────┬──────┘          └─────────────┘        │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                        │
│                    │               │               │                        │
│                    ▼               ▼               ▼                        │
│             ┌───────────┐   ┌───────────┐   ┌───────────┐                   │
│             │ RETRYING  │   │ REFUNDING │   │ ABANDONED │                   │
│             │           │   │           │   │           │                   │
│             │ New       │   │ Partial   │   │ Partial   │                   │
│             │ reservation│  │ refund    │   │ charge    │                   │
│             └───────────┘   └───────────┘   └───────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Partial Execution Billing

### Partial Execution Handler

```python
class PartialExecutionBilling:
    """
    Handles billing for partially executed tasks.
    
    PRINCIPLE: Charge for work done, refund for work not done.
    
    Scenarios:
    1. Agent crashes mid-step → Charge completed steps, refund remaining
    2. Tool fails → Charge for tool attempt, refund remaining task
    3. Timeout → Charge for completed work, refund reserved excess
    4. User cancels → Charge for completed work, refund remaining
    """
    
    async def handle_partial_execution(
        self,
        run_id: str,
        failure_point: str,
        failure_reason: str
    ) -> PartialBillingResult:
        """
        Calculate and apply billing for partial execution.
        """
        
        run = await self.get_run(run_id)
        attribution = await self.get_attribution(run.attribution_id)
        
        # Calculate completed work
        completed_steps = await self.get_completed_steps(run_id)
        completed_tokens = sum(s.actual_tokens for s in completed_steps)
        completed_cost = self.calculate_cost(completed_tokens)
        
        # Calculate in-progress work (charge at 50% if recoverable)
        in_progress_step = await self.get_in_progress_step(run_id)
        in_progress_cost = 0
        
        if in_progress_step:
            if self.is_recoverable(failure_reason):
                # Charge 50% for recoverable failures
                in_progress_cost = self.calculate_cost(in_progress_step.estimated_tokens) * 0.5
            else:
                # Charge 100% for non-recoverable failures
                in_progress_cost = self.calculate_cost(in_progress_step.actual_tokens or in_progress_step.estimated_tokens)
        
        # Total charge
        total_charge = completed_cost + in_progress_cost
        
        # Calculate refund
        refund_amount = attribution.credits_reserved - total_charge
        
        if refund_amount < 0:
            # Overrun - need additional charge
            additional_charge = abs(refund_amount)
            refund_amount = 0
            
            # Check if owner has credits for additional charge
            owner_balance = await self.get_credit_balance(attribution.owner_id)
            
            if owner_balance < additional_charge:
                # Log overrun for manual review
                await self.log_billing_overrun(
                    run_id=run_id,
                    expected=attribution.credits_reserved,
                    actual=total_charge,
                    overrun=additional_charge
                )
                # Charge what we can
                additional_charge = owner_balance
        else:
            additional_charge = 0
        
        # Apply billing
        async with self.db.transaction():
            # Finalize charge
            await self.finalize_charge(
                attribution_id=attribution.id,
                charged_amount=total_charge,
                additional_charge=additional_charge
            )
            
            # Process refund
            if refund_amount > 0:
                await self.process_refund(
                    attribution_id=attribution.id,
                    refund_amount=refund_amount,
                    reason=f"partial_execution:{failure_reason}"
                )
            
            # Update attribution state
            await self.transition_billing_state(
                attribution.id,
                BillingState.FAILED
            )
        
        return PartialBillingResult(
            run_id=run_id,
            completed_steps=len(completed_steps),
            completed_cost=completed_cost,
            in_progress_cost=in_progress_cost,
            total_charged=total_charge + additional_charge,
            refund_amount=refund_amount,
            additional_charge=additional_charge
        )
    
    def is_recoverable(self, failure_reason: str) -> bool:
        """
        Determine if failure is recoverable (eligible for 50% charge).
        """
        recoverable_reasons = [
            'timeout',
            'rate_limit',
            'temporary_error',
            'network_error',
            'service_unavailable'
        ]
        return failure_reason in recoverable_reasons
```

## 3.3 Agent Retry Billing

### Retry Cost Rules

```python
class RetryBillingRules:
    """
    Billing rules for agent retries.
    
    RULES:
    1. First retry: FREE (our fault assumption)
    2. Subsequent retries: 50% charge
    3. User-requested retry: FULL charge
    4. Rate limit retry: FREE (not user's fault)
    5. Context overflow retry: FULL charge (user's fault)
    """
    
    RETRY_COST_RULES = {
        # Error type → (first_retry_cost, subsequent_retry_cost)
        'server_error': (0.0, 0.5),      # Our fault
        'rate_limit': (0.0, 0.0),         # Not user's fault
        'timeout': (0.0, 0.5),            # Could be either
        'context_overflow': (1.0, 1.0),   # User's fault
        'invalid_response': (0.0, 0.5),   # Our fault
        'tool_error': (0.5, 0.75),        # Shared fault
        'user_requested': (1.0, 1.0),     # User's choice
    }
    
    async def calculate_retry_cost(
        self,
        run_id: str,
        retry_reason: str,
        retry_number: int
    ) -> RetryCost:
        """
        Calculate cost for a retry attempt.
        """
        
        if retry_reason not in self.RETRY_COST_RULES:
            # Unknown reason - charge full
            cost_multiplier = 1.0
        else:
            first_cost, subsequent_cost = self.RETRY_COST_RULES[retry_reason]
            cost_multiplier = first_cost if retry_number == 1 else subsequent_cost
        
        # Get original estimated cost
        original_run = await self.get_run(run_id)
        estimated_cost = original_run.estimated_credits
        
        # Calculate retry cost
        retry_cost = int(estimated_cost * cost_multiplier)
        
        return RetryCost(
            retry_number=retry_number,
            retry_reason=retry_reason,
            cost_multiplier=cost_multiplier,
            estimated_cost=retry_cost,
            is_free=(cost_multiplier == 0.0)
        )
    
    async def reserve_retry_credits(
        self,
        run_id: str,
        retry_cost: RetryCost,
        owner_id: str
    ) -> RetryReservationResult:
        """
        Reserve credits for retry attempt.
        """
        
        if retry_cost.is_free:
            # Free retry - no reservation needed
            return RetryReservationResult(
                success=True,
                reserved_amount=0,
                is_free=True
            )
        
        # Check owner balance
        balance = await self.get_credit_balance(owner_id)
        
        if balance < retry_cost.estimated_cost:
            return RetryReservationResult(
                success=False,
                reason="INSUFFICIENT_CREDITS",
                required=retry_cost.estimated_cost,
                available=balance
            )
        
        # Reserve credits
        await self.reserve_credits(
            owner_id=owner_id,
            amount=retry_cost.estimated_cost,
            reason=f"retry:{run_id}:{retry_cost.retry_number}"
        )
        
        return RetryReservationResult(
            success=True,
            reserved_amount=retry_cost.estimated_cost,
            is_free=False
        )
```

## 3.4 Tool Failure Billing

### Tool Failure Handler

```python
class ToolFailureBilling:
    """
    Billing for tool execution failures.
    
    RULES:
    1. Tool timeout: Charge for attempt (tokens sent)
    2. Tool error: Charge for attempt
    3. Tool rate limit: No charge (retry free)
    4. Tool invalid response: Charge for attempt
    5. Tool success: Charge for full execution
    """
    
    async def handle_tool_failure(
        self,
        step_id: str,
        tool_name: str,
        failure_type: str,
        tokens_used: int
    ) -> ToolFailureBillingResult:
        """
        Handle billing for a tool failure.
        """
        
        step = await self.get_step(step_id)
        task = await self.get_task(step.task_id)
        
        # Determine charge based on failure type
        if failure_type == 'rate_limit':
            # No charge for rate limits
            charge_amount = 0
            charge_reason = "tool_rate_limit_no_charge"
        elif failure_type == 'timeout':
            # Charge for tokens sent (input only)
            charge_amount = self.calculate_input_cost(tokens_used)
            charge_reason = "tool_timeout_input_only"
        else:
            # Charge for full attempt
            charge_amount = self.calculate_cost(tokens_used)
            charge_reason = f"tool_failure:{failure_type}"
        
        # Record the charge
        if charge_amount > 0:
            await self.record_step_charge(
                step_id=step_id,
                amount=charge_amount,
                reason=charge_reason,
                tokens=tokens_used
            )
        
        # Check if retry is allowed
        retry_allowed = self.can_retry_tool(failure_type, step.retry_count)
        
        if retry_allowed:
            # Calculate retry cost
            retry_cost = await self.calculate_tool_retry_cost(
                step_id=step_id,
                failure_type=failure_type
            )
        else:
            retry_cost = None
        
        return ToolFailureBillingResult(
            step_id=step_id,
            tool_name=tool_name,
            failure_type=failure_type,
            charged_amount=charge_amount,
            charge_reason=charge_reason,
            retry_allowed=retry_allowed,
            retry_cost=retry_cost
        )
```

## 3.5 Timeout Billing

### Timeout Handler

```python
class TimeoutBilling:
    """
    Billing for timeout scenarios.
    
    TIMEOUT TYPES:
    1. Step timeout: Individual step took too long
    2. Task timeout: Overall task exceeded time limit
    3. Run timeout: Entire run exceeded time limit
    4. Idle timeout: No activity for extended period
    """
    
    async def handle_timeout(
        self,
        entity_type: str,  # 'step', 'task', 'run'
        entity_id: str,
        timeout_type: str
    ) -> TimeoutBillingResult:
        """
        Handle billing for a timeout.
        """
        
        if entity_type == 'step':
            return await self.handle_step_timeout(entity_id, timeout_type)
        elif entity_type == 'task':
            return await self.handle_task_timeout(entity_id, timeout_type)
        elif entity_type == 'run':
            return await self.handle_run_timeout(entity_id, timeout_type)
    
    async def handle_step_timeout(
        self,
        step_id: str,
        timeout_type: str
    ) -> TimeoutBillingResult:
        """
        Handle step-level timeout.
        """
        
        step = await self.get_step(step_id)
        
        # Calculate tokens used before timeout
        tokens_used = await self.get_tokens_used_before_timeout(step_id)
        
        # Charge for work done
        charge_amount = self.calculate_cost(tokens_used)
        
        # Record charge
        await self.record_step_charge(
            step_id=step_id,
            amount=charge_amount,
            reason=f"timeout:{timeout_type}",
            tokens=tokens_used
        )
        
        # Mark step as timed out
        await self.mark_step_timed_out(step_id, timeout_type)
        
        # Determine if retry is appropriate
        if timeout_type == 'idle':
            # Idle timeout - likely user abandoned, no retry
            retry_recommended = False
        else:
            # Execution timeout - may be worth retrying
            retry_recommended = step.retry_count < step.max_retries
        
        return TimeoutBillingResult(
            entity_type='step',
            entity_id=step_id,
            timeout_type=timeout_type,
            tokens_charged=tokens_used,
            amount_charged=charge_amount,
            retry_recommended=retry_recommended
        )
    
    async def handle_run_timeout(
        self,
        run_id: str,
        timeout_type: str
    ) -> TimeoutBillingResult:
        """
        Handle run-level timeout (affects all agents).
        """
        
        run = await self.get_run(run_id)
        
        # Get all agents in run
        agents = await self.get_run_agents(run_id)
        
        total_charged = 0
        agent_results = []
        
        for agent in agents:
            # Calculate agent's charges
            agent_tokens = await self.get_agent_tokens(agent.id)
            agent_charge = self.calculate_cost(agent_tokens)
            
            # Record agent charge
            await self.record_agent_charge(
                agent_id=agent.id,
                amount=agent_charge,
                reason=f"run_timeout:{timeout_type}"
            )
            
            total_charged += agent_charge
            agent_results.append({
                'agent_id': agent.id,
                'tokens': agent_tokens,
                'charged': agent_charge
            })
        
        # Calculate refund
        attribution = await self.get_attribution(run.attribution_id)
        refund_amount = max(0, attribution.credits_reserved - total_charged)
        
        # Process refund
        if refund_amount > 0:
            await self.process_refund(
                attribution_id=attribution.id,
                amount=refund_amount,
                reason=f"run_timeout:{timeout_type}"
            )
        
        return TimeoutBillingResult(
            entity_type='run',
            entity_id=run_id,
            timeout_type=timeout_type,
            tokens_charged=sum(a['tokens'] for a in agent_results),
            amount_charged=total_charged,
            refund_amount=refund_amount,
            agent_breakdown=agent_results
        )
```

## 3.6 User Cancellation Billing

### Cancellation Handler

```python
class CancellationBilling:
    """
    Billing for user-initiated cancellations.
    
    RULES:
    1. Cancel before start: Full refund
    2. Cancel during execution: Charge for completed work
    3. Cancel during tool call: Charge for tool attempt
    4. Grace period: 5 seconds after start for full refund
    """
    
    GRACE_PERIOD_SECONDS = 5
    
    async def handle_cancellation(
        self,
        run_id: str,
        cancelled_by: str,
        cancellation_reason: str = None
    ) -> CancellationBillingResult:
        """
        Handle billing for user cancellation.
        """
        
        run = await self.get_run(run_id)
        attribution = await self.get_attribution(run.attribution_id)
        
        # Check if within grace period
        if run.started_at:
            elapsed = (datetime.utcnow() - run.started_at).total_seconds()
            within_grace = elapsed <= self.GRACE_PERIOD_SECONDS
        else:
            within_grace = True  # Not started yet
        
        if within_grace:
            # Full refund
            refund_amount = attribution.credits_reserved
            charged_amount = 0
        else:
            # Calculate completed work
            completed_tokens = await self.get_completed_tokens(run_id)
            charged_amount = self.calculate_cost(completed_tokens)
            
            # Add in-progress work (50% charge for cancellation)
            in_progress_tokens = await self.get_in_progress_tokens(run_id)
            charged_amount += self.calculate_cost(in_progress_tokens) * 0.5
            
            # Calculate refund
            refund_amount = max(0, attribution.credits_reserved - charged_amount)
        
        # Apply billing
        async with self.db.transaction():
            # Finalize charge
            await self.finalize_charge(
                attribution_id=attribution.id,
                charged_amount=charged_amount
            )
            
            # Process refund
            if refund_amount > 0:
                await self.process_refund(
                    attribution_id=attribution.id,
                    amount=refund_amount,
                    reason=f"user_cancellation:{cancellation_reason or 'no_reason'}"
                )
            
            # Update state
            await self.transition_billing_state(
                attribution.id,
                BillingState.CANCELLED
            )
        
        return CancellationBillingResult(
            run_id=run_id,
            cancelled_by=cancelled_by,
            within_grace_period=within_grace,
            charged_amount=charged_amount,
            refund_amount=refund_amount,
            total_reserved=attribution.credits_reserved
        )
```

## 3.7 Concurrent Agent Token Handling

### Concurrent Token Aggregation

```python
class ConcurrentAgentBilling:
    """
    Handles billing when multiple agents contribute tokens concurrently.
    
    CHALLENGES:
    1. Tokens arrive out of order
    2. Multiple agents may complete simultaneously
    3. Need atomic aggregation
    4. Must prevent double-counting
    """
    
    async def record_agent_tokens(
        self,
        run_id: str,
        agent_id: str,
        step_id: str,
        input_tokens: int,
        output_tokens: int,
        model: str,
        idempotency_key: str
    ) -> TokenRecordResult:
        """
        Record tokens from an agent with idempotency.
        """
        
        # Use idempotency to prevent double-counting
        existing = await self.db.fetchrow("""
            SELECT id, total_tokens, cost_usd
            FROM billing.token_records
            WHERE idempotency_key = $1
        """, idempotency_key)
        
        if existing:
            return TokenRecordResult(
                success=True,
                already_recorded=True,
                record_id=existing['id'],
                tokens=existing['total_tokens'],
                cost=existing['cost_usd']
            )
        
        # Calculate cost
        total_tokens = input_tokens + output_tokens
        cost = self.calculate_cost(input_tokens, output_tokens, model)
        
        # Insert with conflict handling
        record_id = await self.db.fetchval("""
            INSERT INTO billing.token_records (
                run_id, agent_id, step_id,
                input_tokens, output_tokens, total_tokens,
                model, cost_usd, idempotency_key,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
        """, run_id, agent_id, step_id,
             input_tokens, output_tokens, total_tokens,
             model, cost, idempotency_key)
        
        if not record_id:
            # Conflict - fetch existing
            existing = await self.db.fetchrow("""
                SELECT id, total_tokens, cost_usd
                FROM billing.token_records
                WHERE idempotency_key = $1
            """, idempotency_key)
            
            return TokenRecordResult(
                success=True,
                already_recorded=True,
                record_id=existing['id'],
                tokens=existing['total_tokens'],
                cost=existing['cost_usd']
            )
        
        # Update run totals atomically
        await self.update_run_totals(run_id, total_tokens, cost)
        
        return TokenRecordResult(
            success=True,
            already_recorded=False,
            record_id=record_id,
            tokens=total_tokens,
            cost=cost
        )
    
    async def update_run_totals(
        self,
        run_id: str,
        tokens: int,
        cost: Decimal
    ):
        """
        Atomically update run totals.
        """
        
        await self.db.execute("""
            UPDATE runs
            SET 
                total_tokens = total_tokens + $2,
                total_cost_usd = total_cost_usd + $3,
                updated_at = now()
            WHERE id = $1
        """, run_id, tokens, cost)
    
    async def get_run_token_summary(
        self,
        run_id: str
    ) -> RunTokenSummary:
        """
        Get aggregated token summary for a run.
        """
        
        summary = await self.db.fetchrow("""
            SELECT 
                COUNT(DISTINCT agent_id) as agent_count,
                COUNT(*) as record_count,
                SUM(input_tokens) as total_input_tokens,
                SUM(output_tokens) as total_output_tokens,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost_usd,
                MIN(created_at) as first_record_at,
                MAX(created_at) as last_record_at
            FROM billing.token_records
            WHERE run_id = $1
        """, run_id)
        
        # Get per-agent breakdown
        agent_breakdown = await self.db.fetch("""
            SELECT 
                agent_id,
                SUM(total_tokens) as tokens,
                SUM(cost_usd) as cost,
                COUNT(*) as record_count
            FROM billing.token_records
            WHERE run_id = $1
            GROUP BY agent_id
        """, run_id)
        
        return RunTokenSummary(
            run_id=run_id,
            agent_count=summary['agent_count'],
            total_input_tokens=summary['total_input_tokens'],
            total_output_tokens=summary['total_output_tokens'],
            total_tokens=summary['total_tokens'],
            total_cost=summary['total_cost_usd'],
            agent_breakdown=[
                AgentTokenBreakdown(
                    agent_id=a['agent_id'],
                    tokens=a['tokens'],
                    cost=a['cost']
                ) for a in agent_breakdown
            ]
        )
```

## 3.8 Refund Logic

### Refund Processor

```python
class RefundProcessor:
    """
    Handles credit refunds.
    
    RULES:
    1. Refunds are immediate (no delay)
    2. Refunds are logged in billing ledger
    3. Refunds cannot exceed original charge
    4. Partial refunds are allowed
    5. Refund reasons are required for audit
    """
    
    async def process_refund(
        self,
        attribution_id: str,
        amount: int,
        reason: str,
        idempotency_key: str = None
    ) -> RefundResult:
        """
        Process a credit refund.
        """
        
        # Generate idempotency key if not provided
        if not idempotency_key:
            idempotency_key = f"refund:{attribution_id}:{uuid.uuid4()}"
        
        # Check for existing refund with same key
        existing = await self.db.fetchrow("""
            SELECT id, amount, status
            FROM billing.refunds
            WHERE idempotency_key = $1
        """, idempotency_key)
        
        if existing:
            return RefundResult(
                success=True,
                already_processed=True,
                refund_id=existing['id'],
                amount=existing['amount']
            )
        
        attribution = await self.get_attribution(attribution_id)
        
        # Validate refund amount
        max_refundable = attribution.credits_reserved - attribution.credits_charged
        
        if amount > max_refundable:
            return RefundResult(
                success=False,
                reason="EXCEEDS_REFUNDABLE",
                max_refundable=max_refundable,
                requested=amount
            )
        
        async with self.db.transaction():
            # Create refund record
            refund_id = await self.db.fetchval("""
                INSERT INTO billing.refunds (
                    attribution_id,
                    user_id,
                    amount,
                    reason,
                    idempotency_key,
                    status,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, 'completed', now())
                RETURNING id
            """, attribution_id, attribution.owner_id, amount, reason, idempotency_key)
            
            # Update user balance
            await self.db.execute("""
                UPDATE billing.credit_balances
                SET 
                    balance = balance + $2,
                    reserved = reserved - $2,
                    updated_at = now()
                WHERE user_id = $1
            """, attribution.owner_id, amount)
            
            # Update attribution
            await self.db.execute("""
                UPDATE collab.credit_attributions
                SET 
                    credits_refunded = credits_refunded + $2,
                    updated_at = now()
                WHERE id = $1
            """, attribution_id, amount)
            
            # Create ledger entry
            await self.db.execute("""
                INSERT INTO billing.billing_ledger (
                    user_id,
                    org_id,
                    entry_type,
                    amount,
                    balance_before,
                    balance_after,
                    reference_type,
                    reference_id,
                    reason,
                    created_at
                ) VALUES (
                    $1, $2, 'refund', $3,
                    (SELECT balance - $3 FROM billing.credit_balances WHERE user_id = $1),
                    (SELECT balance FROM billing.credit_balances WHERE user_id = $1),
                    'attribution', $4, $5, now()
                )
            """, attribution.owner_id, attribution.owner_org_id, amount,
                 attribution_id, reason)
        
        return RefundResult(
            success=True,
            already_processed=False,
            refund_id=refund_id,
            amount=amount,
            new_balance=await self.get_credit_balance(attribution.owner_id)
        )
```

## 3.9 Retry Caps

### Retry Limit Configuration

```python
class RetryLimitConfig:
    """
    Configuration for retry limits.
    
    LIMITS:
    - Per step: 3 retries
    - Per task: 5 retries (across all steps)
    - Per run: 10 retries (across all tasks)
    - Per day per user: 100 retries
    - Free retries per run: 2
    """
    
    DEFAULT_LIMITS = {
        'step_max_retries': 3,
        'task_max_retries': 5,
        'run_max_retries': 10,
        'daily_user_retries': 100,
        'free_retries_per_run': 2,
    }
    
    async def check_retry_allowed(
        self,
        entity_type: str,
        entity_id: str,
        user_id: str
    ) -> RetryAllowedResult:
        """
        Check if retry is allowed for entity.
        """
        
        limits = await self.get_user_limits(user_id)
        
        if entity_type == 'step':
            step = await self.get_step(entity_id)
            if step.retry_count >= limits['step_max_retries']:
                return RetryAllowedResult(
                    allowed=False,
                    reason="STEP_RETRY_LIMIT",
                    current=step.retry_count,
                    max=limits['step_max_retries']
                )
        
        elif entity_type == 'task':
            task = await self.get_task(entity_id)
            task_retries = await self.get_task_retry_count(entity_id)
            if task_retries >= limits['task_max_retries']:
                return RetryAllowedResult(
                    allowed=False,
                    reason="TASK_RETRY_LIMIT",
                    current=task_retries,
                    max=limits['task_max_retries']
                )
        
        elif entity_type == 'run':
            run_retries = await self.get_run_retry_count(entity_id)
            if run_retries >= limits['run_max_retries']:
                return RetryAllowedResult(
                    allowed=False,
                    reason="RUN_RETRY_LIMIT",
                    current=run_retries,
                    max=limits['run_max_retries']
                )
        
        # Check daily limit
        daily_retries = await self.get_daily_retry_count(user_id)
        if daily_retries >= limits['daily_user_retries']:
            return RetryAllowedResult(
                allowed=False,
                reason="DAILY_RETRY_LIMIT",
                current=daily_retries,
                max=limits['daily_user_retries'],
                reset_at=self.midnight_utc()
            )
        
        # Check if free retry available
        run_id = await self.get_run_id_for_entity(entity_type, entity_id)
        free_retries_used = await self.get_free_retries_used(run_id)
        is_free = free_retries_used < limits['free_retries_per_run']
        
        return RetryAllowedResult(
            allowed=True,
            is_free=is_free,
            free_retries_remaining=max(0, limits['free_retries_per_run'] - free_retries_used)
        )
```

## 3.10 Credit Reservation vs Consumption

### Reservation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CREDIT RESERVATION TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  T+0ms     T+10ms    T+100ms   T+1000ms  T+5000ms  T+5100ms                │
│    │         │          │          │          │          │                  │
│    ▼         ▼          ▼          ▼          ▼          ▼                  │
│ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌──────┐              │
│ │Estimate│ │Reserve│ │ Start   │ │Charge│ │ Complete │ │Refund│              │
│ │Credits│ │Credits│ │Execution│ │Step 1│ │Execution │ │Excess│              │
│ └──────┘ └──────┘ └──────────┘ └──────┘ └──────────┘ └──────┘              │
│    │         │          │          │          │          │                  │
│    │         │          │          │          │          │                  │
│ Balance: 100 → 100 → 80 → 80 → 80 → 80 → 80 → 75 → 75 → 75 → 90            │
│ Reserved:  0 →  0 → 20 → 20 → 20 → 15 → 15 → 10 → 10 →  0 →  0            │
│ Charged:   0 →  0 →  0 →  0 →  0 →  5 →  5 → 10 → 10 → 10 → 10            │
│                                                                             │
│ Legend:                                                                     │
│ - Balance: Available credits                                                │
│ - Reserved: Credits held for current operation                              │
│ - Charged: Credits actually consumed                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reservation vs Consumption Implementation

```python
class CreditReservationManager:
    """
    Manages credit reservation and consumption lifecycle.
    
    INVARIANTS:
    1. reserved >= charged (always)
    2. balance + reserved = total_credits (conservation)
    3. On completion: charged + refunded = reserved
    """
    
    async def reserve_credits(
        self,
        user_id: str,
        amount: int,
        attribution_id: str,
        idempotency_key: str
    ) -> ReservationResult:
        """
        Reserve credits for an operation.
        """
        
        async with self.db.transaction():
            # Lock user balance row
            balance_row = await self.db.fetchrow("""
                SELECT balance, reserved
                FROM billing.credit_balances
                WHERE user_id = $1
                FOR UPDATE
            """, user_id)
            
            if not balance_row:
                return ReservationResult(
                    success=False,
                    reason="USER_NOT_FOUND"
                )
            
            available = balance_row['balance'] - balance_row['reserved']
            
            if available < amount:
                return ReservationResult(
                    success=False,
                    reason="INSUFFICIENT_CREDITS",
                    available=available,
                    required=amount
                )
            
            # Update balance
            await self.db.execute("""
                UPDATE billing.credit_balances
                SET 
                    reserved = reserved + $2,
                    updated_at = now()
                WHERE user_id = $1
            """, user_id, amount)
            
            # Create reservation record
            await self.db.execute("""
                INSERT INTO billing.credit_reservations (
                    user_id,
                    attribution_id,
                    amount,
                    idempotency_key,
                    status,
                    created_at
                ) VALUES ($1, $2, $3, $4, 'active', now())
                ON CONFLICT (idempotency_key) DO NOTHING
            """, user_id, attribution_id, amount, idempotency_key)
        
        return ReservationResult(
            success=True,
            reserved_amount=amount,
            new_available=available - amount
        )
    
    async def consume_credits(
        self,
        user_id: str,
        attribution_id: str,
        amount: int,
        reason: str
    ) -> ConsumptionResult:
        """
        Consume credits from reservation.
        """
        
        async with self.db.transaction():
            # Get reservation
            reservation = await self.db.fetchrow("""
                SELECT amount, consumed
                FROM billing.credit_reservations
                WHERE attribution_id = $1 AND status = 'active'
                FOR UPDATE
            """, attribution_id)
            
            if not reservation:
                return ConsumptionResult(
                    success=False,
                    reason="RESERVATION_NOT_FOUND"
                )
            
            remaining = reservation['amount'] - reservation['consumed']
            
            if amount > remaining:
                return ConsumptionResult(
                    success=False,
                    reason="EXCEEDS_RESERVATION",
                    remaining=remaining,
                    requested=amount
                )
            
            # Update reservation
            await self.db.execute("""
                UPDATE billing.credit_reservations
                SET 
                    consumed = consumed + $2,
                    updated_at = now()
                WHERE attribution_id = $1
            """, attribution_id, amount)
            
            # Update user balance (move from reserved to consumed)
            await self.db.execute("""
                UPDATE billing.credit_balances
                SET 
                    balance = balance - $2,
                    reserved = reserved - $2,
                    updated_at = now()
                WHERE user_id = $1
            """, user_id, amount)
            
            # Create ledger entry
            await self.create_ledger_entry(
                user_id=user_id,
                entry_type='charge',
                amount=amount,
                reference_type='attribution',
                reference_id=attribution_id,
                reason=reason
            )
        
        return ConsumptionResult(
            success=True,
            consumed_amount=amount,
            remaining_reservation=remaining - amount
        )
```

## 3.11 Monthly Reconciliation vs Real-Time Charging

### Reconciliation Strategy

```python
class BillingReconciliation:
    """
    Handles billing reconciliation.
    
    STRATEGY:
    - Real-time: Charge as tokens are consumed
    - Daily: Reconcile estimated vs actual
    - Monthly: Full audit and reporting
    
    REAL-TIME CHARGING:
    - Immediate deduction from balance
    - Immediate ledger entry
    - No batching or delay
    
    DAILY RECONCILIATION:
    - Compare estimated vs actual tokens
    - Flag significant variances (>50%)
    - Auto-refund overcharges
    - Alert on undercharges
    
    MONTHLY RECONCILIATION:
    - Full audit of all transactions
    - Generate usage reports
    - Calculate overages
    - Process enterprise billing
    """
    
    async def run_daily_reconciliation(
        self,
        date: date = None
    ) -> DailyReconciliationResult:
        """
        Run daily reconciliation for all completed runs.
        """
        
        if date is None:
            date = date.today() - timedelta(days=1)
        
        # Get all runs completed on this date
        runs = await self.db.fetch("""
            SELECT id, attribution_id
            FROM runs
            WHERE DATE(completed_at) = $1
              AND status IN ('completed', 'failed', 'cancelled')
              AND reconciled_at IS NULL
        """, date)
        
        results = {
            'total_runs': len(runs),
            'reconciled': 0,
            'variances': [],
            'refunds_issued': 0,
            'total_refunded': 0
        }
        
        for run in runs:
            reconciliation = await self.reconcile_run(run['id'])
            
            results['reconciled'] += 1
            
            if reconciliation.variance_pct > 50:
                results['variances'].append({
                    'run_id': run['id'],
                    'variance_pct': reconciliation.variance_pct,
                    'estimated': reconciliation.estimated_tokens,
                    'actual': reconciliation.actual_tokens
                })
            
            if reconciliation.refund_amount > 0:
                results['refunds_issued'] += 1
                results['total_refunded'] += reconciliation.refund_amount
        
        return DailyReconciliationResult(**results)
    
    async def reconcile_run(
        self,
        run_id: str
    ) -> RunReconciliationResult:
        """
        Reconcile a single run.
        """
        
        run = await self.get_run(run_id)
        attribution = await self.get_attribution(run.attribution_id)
        
        # Get actual token usage
        actual_tokens = await self.db.fetchval("""
            SELECT COALESCE(SUM(total_tokens), 0)
            FROM billing.token_records
            WHERE run_id = $1
        """, run_id)
        
        # Calculate variance
        estimated_tokens = attribution.credits_estimated
        variance = actual_tokens - estimated_tokens
        variance_pct = (variance / estimated_tokens * 100) if estimated_tokens > 0 else 0
        
        # Determine action
        if variance_pct < -20:
            # Overcharged - issue refund
            overcharge = attribution.credits_charged - self.calculate_cost(actual_tokens)
            if overcharge > 0:
                await self.process_refund(
                    attribution_id=attribution.id,
                    amount=overcharge,
                    reason=f"reconciliation:overcharge:{variance_pct:.1f}%"
                )
                refund_amount = overcharge
            else:
                refund_amount = 0
            status = 'refunded'
        elif variance_pct > 100:
            # Significant undercharge - flag for review
            status = 'flagged'
            refund_amount = 0
            await self.flag_for_review(
                run_id=run_id,
                reason=f"undercharge:{variance_pct:.1f}%"
            )
        else:
            # Within acceptable range
            status = 'reconciled'
            refund_amount = 0
        
        # Record reconciliation
        await self.db.execute("""
            INSERT INTO billing.token_reconciliations (
                run_id,
                estimated_tokens,
                actual_tokens,
                variance_tokens,
                variance_pct,
                status,
                refund_amount,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        """, run_id, estimated_tokens, actual_tokens, variance, variance_pct, status, refund_amount)
        
        # Mark run as reconciled
        await self.db.execute("""
            UPDATE runs
            SET reconciled_at = now()
            WHERE id = $1
        """, run_id)
        
        return RunReconciliationResult(
            run_id=run_id,
            estimated_tokens=estimated_tokens,
            actual_tokens=actual_tokens,
            variance_tokens=variance,
            variance_pct=variance_pct,
            status=status,
            refund_amount=refund_amount
        )
```

---

# Part 4: Agents + Collaboration Interaction

## 4.1 Agent OT Integration

### Do Agents Produce OT Operations?

**YES.** Agents produce OT operations, but with special handling.

```python
class AgentOTProducer:
    """
    Agents produce OT operations for document modifications.
    
    KEY DIFFERENCES FROM HUMAN OT:
    1
