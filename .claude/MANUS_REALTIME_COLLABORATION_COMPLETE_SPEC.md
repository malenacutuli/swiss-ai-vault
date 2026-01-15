# Manus Real-Time Collaboration: Complete Internal Engineering Specification

**From:** Manus Platform Technical Lead  
**Classification:** Internal Engineering Documentation  
**Purpose:** Exact implementation details for collaboration, retry semantics, and emergency controls

---

## Table of Contents

1. [Orchestration & Retry Semantics](#1-orchestration--retry-semantics)
2. [Collaboration Conflict Resolution](#2-collaboration-conflict-resolution)
3. [Retry + Billing UX Contract](#3-retry--billing-ux-contract)
4. [Wide Research Confidence & Dropout](#4-wide-research-confidence--dropout)
5. [Document & Presentation Generation](#5-document--presentation-generation)
6. [Email Ingestion Lifecycle](#6-email-ingestion-lifecycle)
7. [Kill-Switch & Safeguards](#7-kill-switch--safeguards)

---

## 1. Orchestration & Retry Semantics

### 1.1 User-Visible Retry States

```python
# =============================================================================
# RETRY STATE MACHINE (USER-VISIBLE)
# =============================================================================

class UserVisibleState(Enum):
    """States visible to users in the UI."""
    RUNNING = "running"           # Normal execution
    RETRYING = "retrying"         # Automatic retry in progress
    WAITING = "waiting"           # Waiting for external resource
    PAUSED = "paused"             # User-initiated pause
    FAILED = "failed"             # Permanent failure
    COMPLETED = "completed"       # Success
    CANCELLED = "cancelled"       # User cancelled


class RetryVisibility(Enum):
    """How retries are surfaced to users."""
    SILENT = "silent"             # No UI indication (first retry)
    VISIBLE = "visible"           # Show "Retrying..." badge
    CONFIRM = "confirm"           # Require user confirmation
    BLOCKED = "blocked"           # Cannot retry without user action


# =============================================================================
# RETRY VISIBILITY RULES
# =============================================================================

RETRY_VISIBILITY_RULES = {
    # (attempt_number, error_type) -> visibility
    (1, "transient"): RetryVisibility.SILENT,
    (2, "transient"): RetryVisibility.VISIBLE,
    (3, "transient"): RetryVisibility.VISIBLE,
    (1, "rate_limit"): RetryVisibility.VISIBLE,
    (2, "rate_limit"): RetryVisibility.VISIBLE,
    (3, "rate_limit"): RetryVisibility.CONFIRM,
    (1, "credit_low"): RetryVisibility.CONFIRM,
    ("any", "permanent"): RetryVisibility.BLOCKED,
}


def get_retry_visibility(attempt: int, error_type: str) -> RetryVisibility:
    """
    Determine how retry should be surfaced to user.
    
    Rules:
      1. First transient retry: SILENT (user doesn't see it)
      2. Second/third transient retry: VISIBLE (badge shown)
      3. Rate limit retries: Always VISIBLE
      4. Third rate limit retry: CONFIRM (user must approve)
      5. Low credit retry: Always CONFIRM
      6. Permanent errors: BLOCKED (no retry possible)
    """
    key = (attempt, error_type)
    if key in RETRY_VISIBILITY_RULES:
        return RETRY_VISIBILITY_RULES[key]
    
    # Fallback rules
    if error_type == "permanent":
        return RetryVisibility.BLOCKED
    if attempt >= 3:
        return RetryVisibility.CONFIRM
    if attempt >= 2:
        return RetryVisibility.VISIBLE
    return RetryVisibility.SILENT
```

### 1.2 User Override Controls

```python
# =============================================================================
# USER RETRY OVERRIDE CONTROLS
# =============================================================================

@dataclass
class RetryPreferences:
    """User preferences for retry behavior."""
    
    # Global settings
    auto_retry_enabled: bool = True           # Master switch
    max_auto_retries: int = 3                 # Cap on automatic retries
    require_confirm_after: int = 2            # Require confirmation after N retries
    
    # Credit controls
    max_retry_credit_spend: Decimal = Decimal("1.00")  # Max credits for retries
    confirm_retry_credit_above: Decimal = Decimal("0.10")  # Confirm if retry costs more
    
    # Per-error-type overrides
    retry_on_rate_limit: bool = True
    retry_on_timeout: bool = True
    retry_on_server_error: bool = True
    retry_on_context_overflow: bool = False   # Usually not helpful
    
    # Notification preferences
    notify_on_silent_retry: bool = False
    notify_on_visible_retry: bool = True
    notify_on_final_failure: bool = True


@dataclass
class RetryDecision:
    """Decision made by retry system."""
    should_retry: bool
    visibility: RetryVisibility
    requires_confirmation: bool
    estimated_cost: Decimal
    reason: str
    user_can_override: bool


def evaluate_retry_decision(
    step: 'Step',
    error: 'StepError',
    user_prefs: RetryPreferences,
    credit_balance: Decimal
) -> RetryDecision:
    """
    Evaluate whether to retry and how to surface it.
    
    Decision tree:
      1. Check if auto-retry is enabled
      2. Check if error type is retryable
      3. Check if under retry cap
      4. Check if user has sufficient credits
      5. Check if retry cost exceeds confirmation threshold
      6. Determine visibility level
    """
    
    # Rule 1: Master switch
    if not user_prefs.auto_retry_enabled:
        return RetryDecision(
            should_retry=False,
            visibility=RetryVisibility.BLOCKED,
            requires_confirmation=True,
            estimated_cost=Decimal("0"),
            reason="Auto-retry disabled by user",
            user_can_override=True
        )
    
    # Rule 2: Error type check
    if error.error_type == "permanent":
        return RetryDecision(
            should_retry=False,
            visibility=RetryVisibility.BLOCKED,
            requires_confirmation=False,
            estimated_cost=Decimal("0"),
            reason=f"Permanent error: {error.message}",
            user_can_override=False
        )
    
    # Rule 3: Retry cap
    if step.retry_count >= user_prefs.max_auto_retries:
        return RetryDecision(
            should_retry=False,
            visibility=RetryVisibility.CONFIRM,
            requires_confirmation=True,
            estimated_cost=estimate_retry_cost(step),
            reason=f"Retry limit ({user_prefs.max_auto_retries}) reached",
            user_can_override=True
        )
    
    # Rule 4: Credit check
    estimated_cost = estimate_retry_cost(step)
    if credit_balance < estimated_cost:
        return RetryDecision(
            should_retry=False,
            visibility=RetryVisibility.BLOCKED,
            requires_confirmation=True,
            estimated_cost=estimated_cost,
            reason=f"Insufficient credits: need {estimated_cost}, have {credit_balance}",
            user_can_override=False
        )
    
    # Rule 5: Credit confirmation threshold
    requires_confirm = (
        estimated_cost > user_prefs.confirm_retry_credit_above or
        step.retry_count >= user_prefs.require_confirm_after
    )
    
    # Rule 6: Determine visibility
    visibility = get_retry_visibility(step.retry_count + 1, error.error_type)
    
    return RetryDecision(
        should_retry=True,
        visibility=visibility,
        requires_confirmation=requires_confirm,
        estimated_cost=estimated_cost,
        reason=f"Retrying {error.error_type} error (attempt {step.retry_count + 1})",
        user_can_override=True
    )
```

### 1.3 Retry Credit Consumption Rules

```python
# =============================================================================
# RETRY CREDIT RULES
# =============================================================================

class RetryCreditPolicy(Enum):
    """How credits are charged for retries."""
    FULL_CHARGE = "full"          # Charge full cost again
    REDUCED_CHARGE = "reduced"    # Charge at reduced rate
    NO_CHARGE = "free"            # No additional charge
    REFUND_ORIGINAL = "refund"    # Refund original + charge new


# Credit policy by error type
RETRY_CREDIT_POLICIES = {
    # Our fault -> free retry
    "server_error": RetryCreditPolicy.NO_CHARGE,
    "internal_error": RetryCreditPolicy.NO_CHARGE,
    "infrastructure_error": RetryCreditPolicy.NO_CHARGE,
    
    # External fault -> reduced charge
    "rate_limit": RetryCreditPolicy.REDUCED_CHARGE,  # 50% charge
    "timeout": RetryCreditPolicy.REDUCED_CHARGE,     # 50% charge
    "upstream_error": RetryCreditPolicy.REDUCED_CHARGE,
    
    # User's context -> full charge
    "context_overflow": RetryCreditPolicy.FULL_CHARGE,
    "invalid_request": RetryCreditPolicy.FULL_CHARGE,
    
    # Transient -> first free, then reduced
    "transient": RetryCreditPolicy.NO_CHARGE,  # First retry free
}


def calculate_retry_credit_charge(
    step: 'Step',
    error: 'StepError',
    estimated_tokens: int
) -> Decimal:
    """
    Calculate credit charge for a retry.
    
    Rules:
      1. Server errors: FREE (our fault)
      2. Rate limits: 50% charge (shared fault)
      3. Context overflow: FULL charge (user's fault)
      4. First transient retry: FREE
      5. Subsequent transient: 50% charge
    """
    
    policy = RETRY_CREDIT_POLICIES.get(error.error_type, RetryCreditPolicy.FULL_CHARGE)
    base_cost = estimate_token_cost(estimated_tokens)
    
    if policy == RetryCreditPolicy.NO_CHARGE:
        return Decimal("0")
    
    if policy == RetryCreditPolicy.REDUCED_CHARGE:
        return base_cost * Decimal("0.5")
    
    if policy == RetryCreditPolicy.REFUND_ORIGINAL:
        # Refund is handled separately
        return base_cost
    
    # FULL_CHARGE
    return base_cost


# =============================================================================
# UI STATE MAPPING
# =============================================================================

UI_STATE_MAPPING = {
    # (backend_state, retry_status) -> UI display
    ("running", None): {
        "badge": None,
        "color": "blue",
        "message": "Running...",
        "spinner": True,
        "actions": ["pause", "cancel"]
    },
    ("running", "retrying"): {
        "badge": "Retrying",
        "color": "yellow",
        "message": "Retrying after error...",
        "spinner": True,
        "actions": ["cancel", "skip_retry"]
    },
    ("running", "waiting_confirm"): {
        "badge": "Needs Approval",
        "color": "orange",
        "message": "Retry requires your approval",
        "spinner": False,
        "actions": ["approve_retry", "skip_retry", "cancel"]
    },
    ("paused", None): {
        "badge": "Paused",
        "color": "gray",
        "message": "Paused by user",
        "spinner": False,
        "actions": ["resume", "cancel"]
    },
    ("failed", "retriable"): {
        "badge": "Failed",
        "color": "red",
        "message": "Failed - click to retry",
        "spinner": False,
        "actions": ["retry", "dismiss"]
    },
    ("failed", "permanent"): {
        "badge": "Failed",
        "color": "red",
        "message": "Permanently failed",
        "spinner": False,
        "actions": ["dismiss", "contact_support"]
    },
    ("completed", None): {
        "badge": "Done",
        "color": "green",
        "message": "Completed successfully",
        "spinner": False,
        "actions": ["view_result"]
    }
}
```

---

## 2. Collaboration Conflict Resolution

### 2.1 Conflict Resolution Policy

```python
# =============================================================================
# CONFLICT RESOLUTION POLICY
# =============================================================================

class ConflictResolutionLevel(Enum):
    """Level at which conflicts are resolved."""
    CHARACTER = "character"       # Character-by-character OT
    BLOCK = "block"               # Block-level (paragraph, code block)
    SEMANTIC = "semantic"         # Semantic intent (requires LLM)


class ConflictResolutionPolicy(Enum):
    """Policy for resolving conflicts."""
    LAST_WRITE_WINS = "lww"       # Simple timestamp-based
    FIRST_WRITE_WINS = "fww"      # First edit preserved
    MERGE = "merge"               # Attempt to merge both
    OWNER_WINS = "owner"          # Owner's edit takes precedence
    PROMPT_LOCK = "lock"          # Lock during prompt editing


# =============================================================================
# CONFLICT RESOLUTION RULES BY CONTENT TYPE
# =============================================================================

CONFLICT_RESOLUTION_RULES = {
    # Content type -> (resolution_level, policy)
    
    # Text content: character-level OT merge
    "text": (ConflictResolutionLevel.CHARACTER, ConflictResolutionPolicy.MERGE),
    
    # Code blocks: block-level, last-write-wins
    "code": (ConflictResolutionLevel.BLOCK, ConflictResolutionPolicy.LAST_WRITE_WINS),
    
    # Prompts: block-level, lock-based (pessimistic)
    "prompt": (ConflictResolutionLevel.BLOCK, ConflictResolutionPolicy.PROMPT_LOCK),
    
    # Tool parameters: block-level, owner wins
    "tool_params": (ConflictResolutionLevel.BLOCK, ConflictResolutionPolicy.OWNER_WINS),
    
    # Metadata: last-write-wins
    "metadata": (ConflictResolutionLevel.BLOCK, ConflictResolutionPolicy.LAST_WRITE_WINS),
    
    # Comments: merge (append)
    "comment": (ConflictResolutionLevel.BLOCK, ConflictResolutionPolicy.MERGE),
}


# =============================================================================
# PROMPT BLOCK CONFLICT RESOLUTION
# =============================================================================

@dataclass
class PromptEdit:
    """A prompt edit operation."""
    user_id: str
    workspace_id: str
    block_id: str
    old_content: str
    new_content: str
    timestamp: datetime
    version: int


@dataclass
class PromptLock:
    """Lock on a prompt block."""
    block_id: str
    user_id: str
    acquired_at: datetime
    expires_at: datetime
    version_at_lock: int


class PromptConflictResolver:
    """
    Resolves conflicts when two collaborators edit the same prompt block.
    
    Policy: PESSIMISTIC LOCKING
      - User must acquire lock before editing prompt
      - Lock expires after 30 seconds of inactivity
      - If lock held by another user, edit is REJECTED
      - Lock holder's edit always wins
    """
    
    LOCK_TIMEOUT_SECONDS = 30
    LOCK_EXTENSION_SECONDS = 15
    
    async def acquire_lock(
        self,
        user_id: str,
        block_id: str,
        workspace_id: str
    ) -> Tuple[bool, Optional[PromptLock], Optional[str]]:
        """
        Attempt to acquire lock on prompt block.
        
        Returns:
            (success, lock_if_acquired, error_message_if_failed)
        """
        
        # Check for existing lock
        existing_lock = await self._get_lock(block_id)
        
        if existing_lock:
            # Check if lock is expired
            if existing_lock.expires_at < datetime.utcnow():
                # Expired lock, can acquire
                await self._release_lock(block_id)
            elif existing_lock.user_id == user_id:
                # Same user, extend lock
                extended_lock = await self._extend_lock(existing_lock)
                return (True, extended_lock, None)
            else:
                # Another user holds lock
                holder_name = await self._get_user_name(existing_lock.user_id)
                return (
                    False,
                    None,
                    f"Prompt is being edited by {holder_name}. "
                    f"Lock expires in {(existing_lock.expires_at - datetime.utcnow()).seconds}s"
                )
        
        # Acquire new lock
        lock = PromptLock(
            block_id=block_id,
            user_id=user_id,
            acquired_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(seconds=self.LOCK_TIMEOUT_SECONDS),
            version_at_lock=await self._get_current_version(block_id)
        )
        
        await self._save_lock(lock)
        
        # Broadcast lock acquisition to other users
        await self._broadcast_lock_event(workspace_id, block_id, user_id, "acquired")
        
        return (True, lock, None)
    
    async def resolve_concurrent_edits(
        self,
        edit_a: PromptEdit,
        edit_b: PromptEdit
    ) -> Tuple[PromptEdit, Optional[PromptEdit], str]:
        """
        Resolve conflict between two concurrent prompt edits.
        
        Policy:
          1. If one has lock, that edit wins
          2. If neither has lock, earlier timestamp wins
          3. Losing edit is REJECTED (not merged)
        
        Returns:
            (winning_edit, losing_edit, resolution_reason)
        """
        
        lock_a = await self._get_lock_for_user(edit_a.block_id, edit_a.user_id)
        lock_b = await self._get_lock_for_user(edit_b.block_id, edit_b.user_id)
        
        # Rule 1: Lock holder wins
        if lock_a and not lock_b:
            return (edit_a, edit_b, "Edit A has lock")
        if lock_b and not lock_a:
            return (edit_b, edit_a, "Edit B has lock")
        
        # Rule 2: Both have locks (shouldn't happen) or neither has lock
        # Fall back to timestamp
        if edit_a.timestamp <= edit_b.timestamp:
            return (edit_a, edit_b, "Edit A has earlier timestamp")
        else:
            return (edit_b, edit_a, "Edit B has earlier timestamp")
    
    async def apply_edit_with_conflict_check(
        self,
        edit: PromptEdit,
        lock: Optional[PromptLock]
    ) -> Tuple[bool, Optional[str]]:
        """
        Apply a prompt edit with conflict checking.
        
        Returns:
            (success, error_message_if_failed)
        """
        
        # Check version hasn't changed since lock was acquired
        current_version = await self._get_current_version(edit.block_id)
        
        if lock:
            if current_version != lock.version_at_lock:
                return (
                    False,
                    f"Prompt was modified while you held the lock. "
                    f"Your version: {lock.version_at_lock}, current: {current_version}"
                )
        else:
            # No lock - check if version matches
            if current_version != edit.version:
                return (
                    False,
                    f"Prompt was modified by another user. Please refresh and try again."
                )
        
        # Apply edit
        await self._apply_edit(edit)
        
        # Release lock if held
        if lock:
            await self._release_lock(edit.block_id)
        
        return (True, None)
```

### 2.2 Tool Execution Permissions

```python
# =============================================================================
# TOOL EXECUTION PERMISSION MODEL
# =============================================================================

class CollaboratorRole(Enum):
    """Roles in a collaborative workspace."""
    OWNER = "owner"           # Full control, pays for everything
    ADMIN = "admin"           # Can manage collaborators, execute tools
    EDITOR = "editor"         # Can edit content, limited tool execution
    PROMPTER = "prompter"     # Can submit prompts, no direct tool execution
    VIEWER = "viewer"         # Read-only access


@dataclass
class ToolExecutionPermission:
    """Permission to execute a specific tool."""
    tool_name: str
    allowed_roles: Set[CollaboratorRole]
    requires_owner_approval: bool
    max_cost_without_approval: Decimal
    daily_limit: Optional[int]


# =============================================================================
# TOOL PERMISSION MATRIX
# =============================================================================

TOOL_PERMISSIONS = {
    # Tool name -> permission config
    
    "web_search": ToolExecutionPermission(
        tool_name="web_search",
        allowed_roles={CollaboratorRole.OWNER, CollaboratorRole.ADMIN, CollaboratorRole.EDITOR},
        requires_owner_approval=False,
        max_cost_without_approval=Decimal("0.10"),
        daily_limit=100
    ),
    
    "code_execution": ToolExecutionPermission(
        tool_name="code_execution",
        allowed_roles={CollaboratorRole.OWNER, CollaboratorRole.ADMIN},
        requires_owner_approval=False,
        max_cost_without_approval=Decimal("1.00"),
        daily_limit=50
    ),
    
    "file_write": ToolExecutionPermission(
        tool_name="file_write",
        allowed_roles={CollaboratorRole.OWNER, CollaboratorRole.ADMIN, CollaboratorRole.EDITOR},
        requires_owner_approval=False,
        max_cost_without_approval=Decimal("0.05"),
        daily_limit=200
    ),
    
    "llm_call": ToolExecutionPermission(
        tool_name="llm_call",
        allowed_roles={CollaboratorRole.OWNER, CollaboratorRole.ADMIN, CollaboratorRole.EDITOR, CollaboratorRole.PROMPTER},
        requires_owner_approval=False,
        max_cost_without_approval=Decimal("0.50"),
        daily_limit=None  # No limit, but credit-capped
    ),
    
    "external_api": ToolExecutionPermission(
        tool_name="external_api",
        allowed_roles={CollaboratorRole.OWNER, CollaboratorRole.ADMIN},
        requires_owner_approval=True,  # Always requires approval
        max_cost_without_approval=Decimal("0"),
        daily_limit=20
    ),
    
    "payment": ToolExecutionPermission(
        tool_name="payment",
        allowed_roles={CollaboratorRole.OWNER},  # Owner only
        requires_owner_approval=True,
        max_cost_without_approval=Decimal("0"),
        daily_limit=5
    ),
}


# =============================================================================
# TOOL EXECUTION AUTHORIZATION
# =============================================================================

@dataclass
class ToolExecutionRequest:
    """Request to execute a tool."""
    tool_name: str
    requester_id: str
    requester_role: CollaboratorRole
    workspace_id: str
    owner_id: str
    estimated_cost: Decimal
    parameters: Dict[str, Any]


@dataclass
class ToolExecutionDecision:
    """Decision on tool execution request."""
    allowed: bool
    requires_approval: bool
    approval_request_id: Optional[str]
    charged_to: str  # User ID who pays
    reason: str


async def authorize_tool_execution(
    request: ToolExecutionRequest,
    collaborator_daily_usage: Dict[str, int],
    owner_credit_balance: Decimal
) -> ToolExecutionDecision:
    """
    Authorize a tool execution request.
    
    Rules:
      1. Check if role is allowed to use tool
      2. Check daily limit
      3. Check if cost exceeds approval threshold
      4. Check owner credit balance
      5. Owner ALWAYS pays (prevents griefing)
      6. Owner can veto via approval mechanism
    
    Returns:
        ToolExecutionDecision
    """
    
    permission = TOOL_PERMISSIONS.get(request.tool_name)
    if not permission:
        return ToolExecutionDecision(
            allowed=False,
            requires_approval=False,
            approval_request_id=None,
            charged_to=request.owner_id,
            reason=f"Unknown tool: {request.tool_name}"
        )
    
    # Rule 1: Role check
    if request.requester_role not in permission.allowed_roles:
        return ToolExecutionDecision(
            allowed=False,
            requires_approval=False,
            approval_request_id=None,
            charged_to=request.owner_id,
            reason=f"Role {request.requester_role.value} cannot execute {request.tool_name}"
        )
    
    # Rule 2: Daily limit check
    if permission.daily_limit:
        current_usage = collaborator_daily_usage.get(request.requester_id, 0)
        if current_usage >= permission.daily_limit:
            return ToolExecutionDecision(
                allowed=False,
                requires_approval=True,  # Can request override
                approval_request_id=None,
                charged_to=request.owner_id,
                reason=f"Daily limit ({permission.daily_limit}) reached for {request.tool_name}"
            )
    
    # Rule 3: Cost threshold check
    if request.estimated_cost > permission.max_cost_without_approval:
        if permission.requires_owner_approval or request.requester_id != request.owner_id:
            approval_id = await create_approval_request(request)
            return ToolExecutionDecision(
                allowed=False,
                requires_approval=True,
                approval_request_id=approval_id,
                charged_to=request.owner_id,
                reason=f"Cost ${request.estimated_cost} exceeds threshold ${permission.max_cost_without_approval}"
            )
    
    # Rule 4: Owner credit balance check
    if owner_credit_balance < request.estimated_cost:
        return ToolExecutionDecision(
            allowed=False,
            requires_approval=False,
            approval_request_id=None,
            charged_to=request.owner_id,
            reason=f"Owner has insufficient credits: ${owner_credit_balance} < ${request.estimated_cost}"
        )
    
    # Rule 5: Owner always pays
    # (This is enforced by charged_to always being owner_id)
    
    # Allowed
    return ToolExecutionDecision(
        allowed=True,
        requires_approval=False,
        approval_request_id=None,
        charged_to=request.owner_id,  # Owner ALWAYS pays
        reason="Authorized"
    )


# =============================================================================
# OWNER VETO MECHANISM
# =============================================================================

@dataclass
class ApprovalRequest:
    """Request for owner approval."""
    id: str
    workspace_id: str
    owner_id: str
    requester_id: str
    tool_name: str
    estimated_cost: Decimal
    parameters: Dict[str, Any]
    created_at: datetime
    expires_at: datetime
    status: str  # pending, approved, rejected, expired


async def create_approval_request(request: ToolExecutionRequest) -> str:
    """Create an approval request for the owner."""
    
    approval = ApprovalRequest(
        id=generate_uuid(),
        workspace_id=request.workspace_id,
        owner_id=request.owner_id,
        requester_id=request.requester_id,
        tool_name=request.tool_name,
        estimated_cost=request.estimated_cost,
        parameters=request.parameters,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=15),
        status="pending"
    )
    
    await save_approval_request(approval)
    
    # Notify owner
    await notify_owner(
        owner_id=request.owner_id,
        notification_type="approval_request",
        title=f"{await get_user_name(request.requester_id)} wants to run {request.tool_name}",
        body=f"Estimated cost: ${request.estimated_cost}",
        actions=["approve", "reject"],
        data={"approval_id": approval.id}
    )
    
    return approval.id


async def owner_respond_to_approval(
    approval_id: str,
    owner_id: str,
    decision: str  # "approve" or "reject"
) -> Tuple[bool, str]:
    """
    Owner responds to an approval request.
    
    Returns:
        (success, message)
    """
    
    approval = await get_approval_request(approval_id)
    
    if not approval:
        return (False, "Approval request not found")
    
    if approval.owner_id != owner_id:
        return (False, "Only the owner can respond to this request")
    
    if approval.status != "pending":
        return (False, f"Request already {approval.status}")
    
    if approval.expires_at < datetime.utcnow():
        approval.status = "expired"
        await save_approval_request(approval)
        return (False, "Request has expired")
    
    approval.status = "approved" if decision == "approve" else "rejected"
    await save_approval_request(approval)
    
    # Notify requester
    await notify_user(
        user_id=approval.requester_id,
        notification_type="approval_response",
        title=f"Your request was {approval.status}",
        body=f"Tool: {approval.tool_name}"
    )
    
    return (True, f"Request {approval.status}")
```

### 2.3 Credit Exhaustion During Collaboration

```python
# =============================================================================
# CREDIT EXHAUSTION HANDLING
# =============================================================================

class CreditExhaustionPolicy(Enum):
    """What happens when owner credits hit zero."""
    HARD_STOP = "hard_stop"           # Stop all execution immediately
    SOFT_STOP = "soft_stop"           # Complete current step, then stop
    GRACE_PERIOD = "grace_period"     # Allow small overdraft
    NOTIFY_ONLY = "notify_only"       # Notify but continue (enterprise)


@dataclass
class CreditExhaustionConfig:
    """Configuration for credit exhaustion handling."""
    policy: CreditExhaustionPolicy
    grace_amount: Decimal              # Overdraft allowed
    grace_duration_seconds: int        # Time before hard stop
    notify_at_balance: Decimal         # Notify when balance drops below
    notify_collaborators: bool         # Notify all collaborators


# Default configuration
DEFAULT_CREDIT_EXHAUSTION_CONFIG = CreditExhaustionConfig(
    policy=CreditExhaustionPolicy.SOFT_STOP,
    grace_amount=Decimal("0.50"),
    grace_duration_seconds=300,  # 5 minutes
    notify_at_balance=Decimal("5.00"),
    notify_collaborators=True
)


async def handle_credit_exhaustion(
    workspace_id: str,
    owner_id: str,
    current_balance: Decimal,
    config: CreditExhaustionConfig = DEFAULT_CREDIT_EXHAUSTION_CONFIG
) -> Dict[str, Any]:
    """
    Handle credit exhaustion during collaboration.
    
    Returns:
        Action to take and notifications to send
    """
    
    result = {
        "action": None,
        "notifications": [],
        "ui_state": None
    }
    
    # Check if in grace period
    grace_state = await get_grace_period_state(workspace_id)
    
    if current_balance <= 0:
        if config.policy == CreditExhaustionPolicy.HARD_STOP:
            # Immediate stop
            result["action"] = "stop_all_execution"
            result["ui_state"] = {
                "type": "hard_stop",
                "message": "Execution stopped: Owner has no credits remaining",
                "color": "red",
                "actions": ["add_credits", "end_session"]
            }
            
        elif config.policy == CreditExhaustionPolicy.SOFT_STOP:
            # Complete current step, then stop
            result["action"] = "complete_current_then_stop"
            result["ui_state"] = {
                "type": "soft_stop",
                "message": "Credits exhausted. Current step will complete, then execution will pause.",
                "color": "orange",
                "actions": ["add_credits", "end_session"]
            }
            
        elif config.policy == CreditExhaustionPolicy.GRACE_PERIOD:
            if not grace_state:
                # Start grace period
                await start_grace_period(
                    workspace_id,
                    config.grace_amount,
                    config.grace_duration_seconds
                )
                result["action"] = "continue_with_grace"
                result["ui_state"] = {
                    "type": "grace_period",
                    "message": f"Credits exhausted. Grace period active for {config.grace_duration_seconds}s",
                    "color": "yellow",
                    "countdown": config.grace_duration_seconds,
                    "actions": ["add_credits"]
                }
            elif grace_state["expired"]:
                # Grace period expired
                result["action"] = "stop_all_execution"
                result["ui_state"] = {
                    "type": "hard_stop",
                    "message": "Grace period expired. Execution stopped.",
                    "color": "red",
                    "actions": ["add_credits", "end_session"]
                }
            else:
                # Still in grace period
                result["action"] = "continue_with_grace"
                remaining = grace_state["remaining_seconds"]
                result["ui_state"] = {
                    "type": "grace_period",
                    "message": f"Grace period: {remaining}s remaining",
                    "color": "yellow",
                    "countdown": remaining,
                    "actions": ["add_credits"]
                }
    
    elif current_balance <= config.notify_at_balance:
        # Low balance warning
        result["action"] = "continue"
        result["ui_state"] = {
            "type": "low_balance_warning",
            "message": f"Low credits: ${current_balance:.2f} remaining",
            "color": "yellow",
            "actions": ["add_credits", "dismiss"]
        }
    
    # Notify collaborators if configured
    if config.notify_collaborators and result["ui_state"]:
        collaborators = await get_workspace_collaborators(workspace_id)
        for collab in collaborators:
            result["notifications"].append({
                "user_id": collab.user_id,
                "type": "credit_status",
                "data": result["ui_state"]
            })
    
    return result


# =============================================================================
# UI STATE DISPLAY RULES
# =============================================================================

UI_CREDIT_STATES = {
    "normal": {
        "banner": None,
        "blocking": False
    },
    "low_balance_warning": {
        "banner": {
            "type": "warning",
            "message": "Low credits remaining",
            "dismissible": True
        },
        "blocking": False
    },
    "grace_period": {
        "banner": {
            "type": "warning",
            "message": "Credits exhausted - grace period active",
            "dismissible": False,
            "countdown": True
        },
        "blocking": False,
        "disable_new_prompts": True
    },
    "soft_stop": {
        "banner": {
            "type": "error",
            "message": "Credits exhausted - completing current step",
            "dismissible": False
        },
        "blocking": True,
        "disable_new_prompts": True,
        "disable_tool_execution": True
    },
    "hard_stop": {
        "banner": {
            "type": "error",
            "message": "Credits exhausted - execution stopped",
            "dismissible": False
        },
        "blocking": True,
        "disable_all_actions": True,
        "modal": {
            "title": "Credits Exhausted",
            "message": "The workspace owner has run out of credits. Please add credits to continue.",
            "actions": ["add_credits", "end_session"]
        }
    }
}
```

---

## 3. Retry + Billing UX Contract

### 3.1 Complete Retry Billing Rules

```python
# =============================================================================
# RETRY BILLING UX CONTRACT
# =============================================================================

@dataclass
class RetryBillingConfig:
    """Configuration for retry billing behavior."""
    
    # Retry caps
    max_retries_per_step: int = 3
    max_retries_per_task: int = 10
    max_retries_per_run: int = 50
    
    # Credit rules
    first_retry_free: bool = True
    retry_discount_percent: int = 50  # 50% discount on retries
    max_retry_credit_per_step: Decimal = Decimal("1.00")
    
    # User controls
    allow_disable_retries: bool = True
    allow_manual_retry: bool = True
    show_retry_cost_preview: bool = True


# =============================================================================
# RETRY COST DISPLAY
# =============================================================================

@dataclass
class RetryCostDisplay:
    """How retry costs are displayed to users."""
    original_cost: Decimal
    retry_cost: Decimal
    discount_applied: Decimal
    total_spent_on_retries: Decimal
    retries_remaining: int
    message: str


def calculate_retry_cost_display(
    step: 'Step',
    config: RetryBillingConfig
) -> RetryCostDisplay:
    """
    Calculate and format retry cost for display.
    
    Display rules:
      1. Show original cost
      2. Show retry cost (with discount)
      3. Show total spent on retries for this step
      4. Show retries remaining
      5. Show clear message
    """
    
    original_cost = step.estimated_cost
    retry_number = step.retry_count + 1
    
    # Calculate retry cost
    if config.first_retry_free and retry_number == 1:
        retry_cost = Decimal("0")
        discount = original_cost
    else:
        discount = original_cost * Decimal(config.retry_discount_percent) / 100
        retry_cost = original_cost - discount
    
    # Calculate total spent
    total_spent = sum(r.cost for r in step.retry_history)
    
    # Calculate remaining
    retries_remaining = config.max_retries_per_step - step.retry_count
    
    # Generate message
    if retry_cost == 0:
        message = "This retry is free"
    elif discount > 0:
        message = f"Retry cost: ${retry_cost:.4f} ({config.retry_discount_percent}% discount applied)"
    else:
        message = f"Retry cost: ${retry_cost:.4f}"
    
    return RetryCostDisplay(
        original_cost=original_cost,
        retry_cost=retry_cost,
        discount_applied=discount,
        total_spent_on_retries=total_spent,
        retries_remaining=retries_remaining,
        message=message
    )


# =============================================================================
# UI STATE DEFINITIONS
# =============================================================================

@dataclass
class RetryUIState:
    """Complete UI state for retry display."""
    
    # Visual state
    status_badge: str              # "Retrying", "Waiting", "Failed"
    status_color: str              # "yellow", "orange", "red"
    spinner_visible: bool
    progress_bar_visible: bool
    progress_percent: Optional[int]
    
    # Message
    primary_message: str
    secondary_message: Optional[str]
    
    # Cost display
    cost_visible: bool
    cost_breakdown: Optional[RetryCostDisplay]
    
    # Actions
    available_actions: List[str]
    primary_action: Optional[str]
    
    # Blocking
    blocks_other_steps: bool
    requires_user_action: bool


def get_retry_ui_state(
    step: 'Step',
    retry_decision: RetryDecision,
    config: RetryBillingConfig
) -> RetryUIState:
    """
    Get complete UI state for a step in retry.
    
    States:
      1. RETRYING (automatic): Yellow badge, spinner, no action needed
      2. WAITING (for approval): Orange badge, no spinner, action needed
      3. FAILED (retriable): Red badge, no spinner, manual retry available
      4. FAILED (permanent): Red badge, no spinner, no retry available
    """
    
    if retry_decision.visibility == RetryVisibility.SILENT:
        # Silent retry - minimal UI change
        return RetryUIState(
            status_badge="Running",
            status_color="blue",
            spinner_visible=True,
            progress_bar_visible=False,
            progress_percent=None,
            primary_message="Processing...",
            secondary_message=None,
            cost_visible=False,
            cost_breakdown=None,
            available_actions=["cancel"],
            primary_action=None,
            blocks_other_steps=False,
            requires_user_action=False
        )
    
    elif retry_decision.visibility == RetryVisibility.VISIBLE:
        # Visible retry - show retry badge
        cost_display = calculate_retry_cost_display(step, config)
        return RetryUIState(
            status_badge="Retrying",
            status_color="yellow",
            spinner_visible=True,
            progress_bar_visible=True,
            progress_percent=None,  # Indeterminate
            primary_message=f"Retrying... (attempt {step.retry_count + 1}/{config.max_retries_per_step})",
            secondary_message=cost_display.message,
            cost_visible=True,
            cost_breakdown=cost_display,
            available_actions=["cancel", "skip_retry"],
            primary_action=None,
            blocks_other_steps=False,
            requires_user_action=False
        )
    
    elif retry_decision.visibility == RetryVisibility.CONFIRM:
        # Needs confirmation
        cost_display = calculate_retry_cost_display(step, config)
        return RetryUIState(
            status_badge="Needs Approval",
            status_color="orange",
            spinner_visible=False,
            progress_bar_visible=False,
            progress_percent=None,
            primary_message="Retry requires your approval",
            secondary_message=f"Cost: ${cost_display.retry_cost:.4f}",
            cost_visible=True,
            cost_breakdown=cost_display,
            available_actions=["approve_retry", "skip_retry", "cancel"],
            primary_action="approve_retry",
            blocks_other_steps=True,
            requires_user_action=True
        )
    
    elif retry_decision.visibility == RetryVisibility.BLOCKED:
        # Cannot retry
        return RetryUIState(
            status_badge="Failed",
            status_color="red",
            spinner_visible=False,
            progress_bar_visible=False,
            progress_percent=None,
            primary_message="Step failed",
            secondary_message=retry_decision.reason,
            cost_visible=False,
            cost_breakdown=None,
            available_actions=["dismiss", "contact_support"] if not retry_decision.user_can_override else ["manual_retry", "dismiss"],
            primary_action="manual_retry" if retry_decision.user_can_override else "dismiss",
            blocks_other_steps=False,
            requires_user_action=True
        )


# =============================================================================
# USER RETRY CONTROLS
# =============================================================================

@dataclass
class UserRetryControls:
    """Controls available to user for managing retries."""
    
    # Global toggle
    auto_retry_enabled: bool
    
    # Per-task toggle
    task_retry_enabled: Dict[str, bool]  # task_id -> enabled
    
    # Cost controls
    max_retry_spend: Decimal
    confirm_above: Decimal
    
    # Notification preferences
    notify_on_retry: bool
    notify_on_failure: bool


async def update_user_retry_controls(
    user_id: str,
    workspace_id: str,
    controls: UserRetryControls
) -> Tuple[bool, str]:
    """
    Update user's retry control preferences.
    
    Returns:
        (success, message)
    """
    
    # Validate
    if controls.max_retry_spend < Decimal("0"):
        return (False, "Max retry spend cannot be negative")
    
    if controls.confirm_above < Decimal("0"):
        return (False, "Confirm threshold cannot be negative")
    
    # Save
    await save_user_retry_controls(user_id, workspace_id, controls)
    
    # Apply to active runs
    active_runs = await get_active_runs_for_user(user_id, workspace_id)
    for run in active_runs:
        await apply_retry_controls_to_run(run.id, controls)
    
    return (True, "Retry controls updated")
```

---

## 4. Wide Research Confidence & Dropout

### 4.1 Confidence Scoring Heuristics

```python
# =============================================================================
# WIDE RESEARCH CONFIDENCE SCORING
# =============================================================================

@dataclass
class AgentResult:
    """Result from a single research agent."""
    agent_id: str
    query: str
    findings: List[str]
    sources: List[str]
    confidence_self_reported: float  # 0-1, agent's own assessment
    execution_time_ms: int
    token_count: int
    error: Optional[str]


@dataclass
class ConfidenceScore:
    """Computed confidence score for an agent result."""
    overall: float              # 0-1, final score
    source_quality: float       # 0-1, quality of sources
    consistency: float          # 0-1, internal consistency
    coverage: float             # 0-1, coverage of query
    freshness: float            # 0-1, recency of information
    corroboration: float        # 0-1, agreement with other agents
    components: Dict[str, float]  # Breakdown


class ConfidenceScorer:
    """
    Computes confidence scores for research agent results.
    
    Scoring heuristics:
      1. Source quality (40%): Domain authority, citation count, recency
      2. Internal consistency (20%): No contradictions within findings
      3. Query coverage (15%): How well findings address the query
      4. Corroboration (15%): Agreement with other agents
      5. Self-reported confidence (10%): Agent's own assessment
    """
    
    WEIGHTS = {
        "source_quality": 0.40,
        "consistency": 0.20,
        "coverage": 0.15,
        "corroboration": 0.15,
        "self_reported": 0.10
    }
    
    # Source quality scoring
    HIGH_QUALITY_DOMAINS = {
        "nature.com", "science.org", "nejm.org", "thelancet.com",  # Academic
        "reuters.com", "apnews.com", "bbc.com",  # News
        "gov", "edu",  # Government, education
        "arxiv.org", "pubmed.ncbi.nlm.nih.gov"  # Preprints, medical
    }
    
    MEDIUM_QUALITY_DOMAINS = {
        "wikipedia.org", "britannica.com",  # Encyclopedias
        "nytimes.com", "washingtonpost.com", "theguardian.com",  # Major news
        "forbes.com", "bloomberg.com"  # Business
    }
    
    LOW_QUALITY_INDICATORS = [
        "blog", "forum", "reddit", "quora", "yahoo answers",
        "medium.com", "substack"  # User-generated
    ]
    
    def score_result(
        self,
        result: AgentResult,
        all_results: List[AgentResult],
        query_embedding: List[float]
    ) -> ConfidenceScore:
        """
        Compute confidence score for a single agent result.
        """
        
        # Component scores
        source_quality = self._score_source_quality(result.sources)
        consistency = self._score_internal_consistency(result.findings)
        coverage = self._score_query_coverage(result.findings, query_embedding)
        corroboration = self._score_corroboration(result, all_results)
        self_reported = result.confidence_self_reported
        
        # Weighted overall score
        overall = (
            source_quality * self.WEIGHTS["source_quality"] +
            consistency * self.WEIGHTS["consistency"] +
            coverage * self.WEIGHTS["coverage"] +
            corroboration * self.WEIGHTS["corroboration"] +
            self_reported * self.WEIGHTS["self_reported"]
        )
        
        return ConfidenceScore(
            overall=overall,
            source_quality=source_quality,
            consistency=consistency,
            coverage=coverage,
            freshness=self._score_freshness(result.sources),
            corroboration=corroboration,
            components={
                "source_quality": source_quality,
                "consistency": consistency,
                "coverage": coverage,
                "corroboration": corroboration,
                "self_reported": self_reported
            }
        )
    
    def _score_source_quality(self, sources: List[str]) -> float:
        """
        Score source quality based on domain authority.
        
        Scoring:
          - High quality domain: 1.0
          - Medium quality domain: 0.7
          - Unknown domain: 0.5
          - Low quality indicator: 0.2
        """
        if not sources:
            return 0.3  # No sources = low confidence
        
        scores = []
        for source in sources:
            domain = extract_domain(source)
            
            if any(hq in domain for hq in self.HIGH_QUALITY_DOMAINS):
                scores.append(1.0)
            elif any(mq in domain for mq in self.MEDIUM_QUALITY_DOMAINS):
                scores.append(0.7)
            elif any(lq in domain.lower() for lq in self.LOW_QUALITY_INDICATORS):
                scores.append(0.2)
            else:
                scores.append(0.5)
        
        return sum(scores) / len(scores)
    
    def _score_internal_consistency(self, findings: List[str]) -> float:
        """
        Score internal consistency of findings.
        
        Checks for:
          - Contradictory statements
          - Logical inconsistencies
          - Conflicting numbers/dates
        """
        if len(findings) < 2:
            return 1.0  # Single finding = consistent
        
        # Use embedding similarity to detect contradictions
        embeddings = [get_embedding(f) for f in findings]
        
        # Check for semantic contradictions
        contradiction_score = 0
        for i, e1 in enumerate(embeddings):
            for j, e2 in enumerate(embeddings[i+1:], i+1):
                similarity = cosine_similarity(e1, e2)
                # Very low similarity might indicate contradiction
                if similarity < 0.3:
                    contradiction_score += 1
        
        max_contradictions = len(findings) * (len(findings) - 1) / 2
        consistency = 1.0 - (contradiction_score / max_contradictions) if max_contradictions > 0 else 1.0
        
        return max(0.0, consistency)
    
    def _score_query_coverage(
        self,
        findings: List[str],
        query_embedding: List[float]
    ) -> float:
        """
        Score how well findings cover the original query.
        """
        if not findings:
            return 0.0
        
        # Compute similarity between findings and query
        finding_embeddings = [get_embedding(f) for f in findings]
        
        # Average similarity
        similarities = [
            cosine_similarity(query_embedding, fe)
            for fe in finding_embeddings
        ]
        
        return sum(similarities) / len(similarities)
    
    def _score_corroboration(
        self,
        result: AgentResult,
        all_results: List[AgentResult]
    ) -> float:
        """
        Score how well this result agrees with other agents.
        
        High corroboration = multiple agents found similar information
        """
        if len(all_results) < 2:
            return 0.5  # No other agents to compare
        
        other_results = [r for r in all_results if r.agent_id != result.agent_id]
        
        # Compare findings
        result_embedding = get_embedding(" ".join(result.findings))
        
        similarities = []
        for other in other_results:
            if other.findings:
                other_embedding = get_embedding(" ".join(other.findings))
                sim = cosine_similarity(result_embedding, other_embedding)
                similarities.append(sim)
        
        if not similarities:
            return 0.5
        
        return sum(similarities) / len(similarities)
    
    def _score_freshness(self, sources: List[str]) -> float:
        """
        Score recency of sources.
        """
        # This would require parsing dates from sources
        # Simplified: assume freshness based on source type
        return 0.7  # Default moderate freshness


# =============================================================================
# AGENT DROPOUT RULES
# =============================================================================

@dataclass
class DropoutDecision:
    """Decision on whether to drop an agent's results."""
    drop: bool
    reason: str
    confidence_score: float


class AgentDropoutEvaluator:
    """
    Evaluates whether an agent's results should be dropped from synthesis.
    
    Dropout rules:
      1. Confidence below threshold (< 0.3)
      2. Error during execution
      3. Timeout (no results)
      4. Duplicate of higher-confidence agent
      5. Contradicts majority consensus
      6. Source quality too low
    """
    
    CONFIDENCE_THRESHOLD = 0.3
    DUPLICATE_SIMILARITY_THRESHOLD = 0.95
    CONTRADICTION_THRESHOLD = 0.2
    SOURCE_QUALITY_THRESHOLD = 0.25
    
    def evaluate_dropout(
        self,
        result: AgentResult,
        confidence: ConfidenceScore,
        all_results: List[AgentResult],
        all_confidences: List[ConfidenceScore]
    ) -> DropoutDecision:
        """
        Evaluate whether to drop an agent's results.
        """
        
        # Rule 1: Error during execution
        if result.error:
            return DropoutDecision(
                drop=True,
                reason=f"Agent error: {result.error}",
                confidence_score=0.0
            )
        
        # Rule 2: No findings
        if not result.findings:
            return DropoutDecision(
                drop=True,
                reason="Agent returned no findings",
                confidence_score=0.0
            )
        
        # Rule 3: Confidence below threshold
        if confidence.overall < self.CONFIDENCE_THRESHOLD:
            return DropoutDecision(
                drop=True,
                reason=f"Confidence {confidence.overall:.2f} below threshold {self.CONFIDENCE_THRESHOLD}",
                confidence_score=confidence.overall
            )
        
        # Rule 4: Source quality too low
        if confidence.source_quality < self.SOURCE_QUALITY_THRESHOLD:
            return DropoutDecision(
                drop=True,
                reason=f"Source quality {confidence.source_quality:.2f} below threshold",
                confidence_score=confidence.overall
            )
        
        # Rule 5: Duplicate of higher-confidence agent
        for other_result, other_conf in zip(all_results, all_confidences):
            if other_result.agent_id == result.agent_id:
                continue
            
            similarity = self._compute_similarity(result, other_result)
            if similarity > self.DUPLICATE_SIMILARITY_THRESHOLD:
                if other_conf.overall > confidence.overall:
                    return DropoutDecision(
                        drop=True,
                        reason=f"Duplicate of agent {other_result.agent_id} with higher confidence",
                        confidence_score=confidence.overall
                    )
        
        # Rule 6: Contradicts majority consensus
        if self._contradicts_majority(result, all_results, all_confidences):
            return DropoutDecision(
                drop=True,
                reason="Contradicts majority consensus",
                confidence_score=confidence.overall
            )
        
        # Keep the result
        return DropoutDecision(
            drop=False,
            reason="Passed all dropout checks",
            confidence_score=confidence.overall
        )
    
    def _compute_similarity(
        self,
        result_a: AgentResult,
        result_b: AgentResult
    ) -> float:
        """Compute similarity between two agent results."""
        emb_a = get_embedding(" ".join(result_a.findings))
        emb_b = get_embedding(" ".join(result_b.findings))
        return cosine_similarity(emb_a, emb_b)
    
    def _contradicts_majority(
        self,
        result: AgentResult,
        all_results: List[AgentResult],
        all_confidences: List[ConfidenceScore]
    ) -> bool:
        """
        Check if result contradicts the majority of other agents.
        
        Majority = weighted by confidence scores
        """
        if len(all_results) < 3:
            return False  # Need at least 3 agents for majority
        
        result_embedding = get_embedding(" ".join(result.findings))
        
        # Compute weighted agreement
        total_weight = 0
        agreement_weight = 0
        
        for other_result, other_conf in zip(all_results, all_confidences):
            if other_result.agent_id == result.agent_id:
                continue
            
            other_embedding = get_embedding(" ".join(other_result.findings))
            similarity = cosine_similarity(result_embedding, other_embedding)
            
            weight = other_conf.overall
            total_weight += weight
            
            if similarity > 0.5:  # Agrees
                agreement_weight += weight
        
        if total_weight == 0:
            return False
        
        agreement_ratio = agreement_weight / total_weight
        
        # If less than 30% agreement, contradicts majority
        return agreement_ratio < 0.3
```

### 4.2 Synthesis Weighting

```python
# =============================================================================
# SYNTHESIS WEIGHTING
# =============================================================================

class SynthesisWeighter:
    """
    Weights agent results for synthesis.
    
    Weighting strategy:
      1. Base weight from confidence score
      2. Boost for corroboration
      3. Penalty for outliers
      4. Normalize to sum to 1.0
    """
    
    CORROBORATION_BOOST = 1.5
    OUTLIER_PENALTY = 0.5
    
    def compute_weights(
        self,
        results: List[AgentResult],
        confidences: List[ConfidenceScore],
        dropout_decisions: List[DropoutDecision]
    ) -> Dict[str, float]:
        """
        Compute synthesis weights for each agent.
        
        Returns:
            agent_id -> weight (0-1, sum to 1.0)
        """
        
        # Filter out dropped agents
        active_results = []
        active_confidences = []
        
        for result, conf, dropout in zip(results, confidences, dropout_decisions):
            if not dropout.drop:
                active_results.append(result)
                active_confidences.append(conf)
        
        if not active_results:
            return {}
        
        # Compute raw weights
        raw_weights = {}
        for result, conf in zip(active_results, active_confidences):
            weight = conf.overall
            
            # Boost for high corroboration
            if conf.corroboration > 0.7:
                weight *= self.CORROBORATION_BOOST
            
            # Penalty for low corroboration (outlier)
            elif conf.corroboration < 0.3:
                weight *= self.OUTLIER_PENALTY
            
            raw_weights[result.agent_id] = weight
        
        # Normalize
        total = sum(raw_weights.values())
        if total == 0:
            # Equal weights if all zero
            equal_weight = 1.0 / len(active_results)
            return {r.agent_id: equal_weight for r in active_results}
        
        return {
            agent_id: weight / total
            for agent_id, weight in raw_weights.items()
        }
```

---

## 5. Document & Presentation Generation

### 5.1 Design Heuristics

```python
# =============================================================================
# DOCUMENT DESIGN HEURISTICS
# =============================================================================

@dataclass
class DocumentDesignConfig:
    """Configuration for document generation design."""
    
    # Layout
    max_paragraphs_per_section: int = 5
    max_words_per_paragraph: int = 150
    min_sections: int = 3
    max_sections: int = 10
    
    # Visual density
    target_text_to_visual_ratio: float = 0.7  # 70% text, 30% visuals
    max_consecutive_text_blocks: int = 3
    min_visuals_per_page: int = 1
    
    # Typography
    heading_levels: int = 3
    use_bullet_lists: bool = True
    max_bullet_items: int = 7
    
    # Whitespace
    section_spacing: str = "large"
    paragraph_spacing: str = "medium"


class DocumentDesigner:
    """
    Applies design heuristics to document generation.
    """
    
    def apply_heuristics(
        self,
        content: 'DocumentContent',
        config: DocumentDesignConfig
    ) -> 'DesignedDocument':
        """
        Apply design heuristics to raw content.
        """
        
        # 1. Structure content into sections
        sections = self._structure_sections(content, config)
        
        # 2. Balance text and visuals
        sections = self._balance_visuals(sections, config)
        
        # 3. Apply typography rules
        sections = self._apply_typography(sections, config)
        
        # 4. Add whitespace
        sections = self._add_whitespace(sections, config)
        
        return DesignedDocument(sections=sections)
    
    def _structure_sections(
        self,
        content: 'DocumentContent',
        config: DocumentDesignConfig
    ) -> List['Section']:
        """
        Structure content into logical sections.
        
        Rules:
          1. Group related paragraphs
          2. Create section breaks at topic changes
          3. Ensure section count within bounds
          4. Balance section lengths
        """
        # Implementation details...
        pass
    
    def _balance_visuals(
        self,
        sections: List['Section'],
        config: DocumentDesignConfig
    ) -> List['Section']:
        """
        Balance text and visual content.
        
        Rules:
          1. Insert visual after every N text blocks
          2. Ensure minimum visuals per page
          3. Don't exceed target ratio
        """
        # Implementation details...
        pass
```

### 5.2 Slide Narrative Flow Rules

```python
# =============================================================================
# SLIDE NARRATIVE FLOW
# =============================================================================

class SlideNarrativeType(Enum):
    """Types of narrative flow for presentations."""
    PROBLEM_SOLUTION = "problem_solution"
    CHRONOLOGICAL = "chronological"
    COMPARE_CONTRAST = "compare_contrast"
    CAUSE_EFFECT = "cause_effect"
    PYRAMID = "pyramid"  # Conclusion first, then supporting
    STORY_ARC = "story_arc"  # Setup, conflict, resolution


@dataclass
class SlideNarrativeConfig:
    """Configuration for slide narrative flow."""
    
    # Structure
    narrative_type: SlideNarrativeType
    include_title_slide: bool = True
    include_agenda_slide: bool = True
    include_summary_slide: bool = True
    include_qa_slide: bool = True
    
    # Pacing
    min_slides: int = 5
    max_slides: int = 20
    target_minutes_per_slide: float = 2.0
    
    # Content per slide
    max_bullets_per_slide: int = 5
    max_words_per_bullet: int = 10
    one_idea_per_slide: bool = True


NARRATIVE_TEMPLATES = {
    SlideNarrativeType.PROBLEM_SOLUTION: [
        {"type": "title", "purpose": "Hook audience"},
        {"type": "agenda", "purpose": "Set expectations"},
        {"type": "problem", "purpose": "Define the problem", "count": "1-3"},
        {"type": "impact", "purpose": "Show why it matters", "count": "1-2"},
        {"type": "solution", "purpose": "Present solution", "count": "2-5"},
        {"type": "benefits", "purpose": "Show benefits", "count": "1-3"},
        {"type": "proof", "purpose": "Evidence/case studies", "count": "1-3"},
        {"type": "call_to_action", "purpose": "What to do next"},
        {"type": "summary", "purpose": "Recap key points"},
        {"type": "qa", "purpose": "Questions"}
    ],
    
    SlideNarrativeType.STORY_ARC: [
        {"type": "title", "purpose": "Hook audience"},
        {"type": "setup", "purpose": "Establish context", "count": "1-2"},
        {"type": "characters", "purpose": "Introduce key players", "count": "1-2"},
        {"type": "conflict", "purpose": "Present challenge", "count": "2-3"},
        {"type": "journey", "purpose": "Show progression", "count": "3-5"},
        {"type": "climax", "purpose": "Key turning point", "count": "1-2"},
        {"type": "resolution", "purpose": "Outcome", "count": "1-2"},
        {"type": "lesson", "purpose": "Key takeaway"},
        {"type": "qa", "purpose": "Questions"}
    ],
    
    SlideNarrativeType.PYRAMID: [
        {"type": "title", "purpose": "Hook audience"},
        {"type": "conclusion", "purpose": "Main point upfront"},
        {"type": "key_argument_1", "purpose": "Supporting point 1", "count": "2-3"},
        {"type": "key_argument_2", "purpose": "Supporting point 2", "count": "2-3"},
        {"type": "key_argument_3", "purpose": "Supporting point 3", "count": "2-3"},
        {"type": "evidence", "purpose": "Data/proof", "count": "1-3"},
        {"type": "implications", "purpose": "What this means"},
        {"type": "next_steps", "purpose": "Actions"},
        {"type": "qa", "purpose": "Questions"}
    ]
}


class SlideNarrativeGenerator:
    """
    Generates slide narrative flow.
    
    Rules:
      1. Follow narrative template structure
      2. One main idea per slide
      3. Progressive disclosure of information
      4. Build to key moments
      5. End with clear call to action
    """
    
    def generate_narrative(
        self,
        content: 'PresentationContent',
        config: SlideNarrativeConfig
    ) -> List['SlideOutline']:
        """
        Generate slide narrative from content.
        """
        
        template = NARRATIVE_TEMPLATES[config.narrative_type]
        slides = []
        
        for section in template:
            section_slides = self._generate_section_slides(
                content,
                section,
                config
            )
            slides.extend(section_slides)
        
        # Validate slide count
        if len(slides) < config.min_slides:
            slides = self._expand_slides(slides, config.min_slides)
        elif len(slides) > config.max_slides:
            slides = self._condense_slides(slides, config.max_slides)
        
        return slides
    
    def _generate_section_slides(
        self,
        content: 'PresentationContent',
        section: Dict,
        config: SlideNarrativeConfig
    ) -> List['SlideOutline']:
        """Generate slides for a narrative section."""
        # Implementation details...
        pass
```

### 5.3 Auto-Visual Density Controls

```python
# =============================================================================
# AUTO-VISUAL DENSITY
# =============================================================================

class VisualDensityLevel(Enum):
    """Visual density levels for presentations."""
    MINIMAL = "minimal"      # Mostly text, few visuals
    BALANCED = "balanced"    # 50/50 text and visuals
    VISUAL_HEAVY = "visual"  # Mostly visuals, minimal text
    DATA_HEAVY = "data"      # Charts and graphs focused


@dataclass
class VisualDensityConfig:
    """Configuration for visual density."""
    
    level: VisualDensityLevel
    
    # Per-slide limits
    max_text_percentage: float  # 0-1
    min_visual_percentage: float  # 0-1
    max_elements_per_slide: int
    
    # Visual types
    prefer_charts: bool
    prefer_images: bool
    prefer_icons: bool
    prefer_diagrams: bool


DENSITY_PRESETS = {
    VisualDensityLevel.MINIMAL: VisualDensityConfig(
        level=VisualDensityLevel.MINIMAL,
        max_text_percentage=0.8,
        min_visual_percentage=0.1,
        max_elements_per_slide=3,
        prefer_charts=False,
        prefer_images=False,
        prefer_icons=True,
        prefer_diagrams=False
    ),
    
    VisualDensityLevel.BALANCED: VisualDensityConfig(
        level=VisualDensityLevel.BALANCED,
        max_text_percentage=0.5,
        min_visual_percentage=0.3,
        max_elements_per_slide=4,
        prefer_charts=True,
        prefer_images=True,
        prefer_icons=True,
        prefer_diagrams=True
    ),
    
    VisualDensityLevel.VISUAL_HEAVY: VisualDensityConfig(
        level=VisualDensityLevel.VISUAL_HEAVY,
        max_text_percentage=0.3,
        min_visual_percentage=0.6,
        max_elements_per_slide=2,
        prefer_charts=True,
        prefer_images=True,
        prefer_icons=False,
        prefer_diagrams=True
    ),
    
    VisualDensityLevel.DATA_HEAVY: VisualDensityConfig(
        level=VisualDensityLevel.DATA_HEAVY,
        max_text_percentage=0.4,
        min_visual_percentage=0.5,
        max_elements_per_slide=3,
        prefer_charts=True,
        prefer_images=False,
        prefer_icons=False,
        prefer_diagrams=True
    )
}


class VisualDensityController:
    """
    Controls visual density in presentations.
    
    Rules:
      1. Enforce text/visual ratio per slide
      2. Auto-generate visuals when text-heavy
      3. Simplify visuals when too dense
      4. Balance across presentation
    """
    
    def apply_density_controls(
        self,
        slides: List['Slide'],
        config: VisualDensityConfig
    ) -> List['Slide']:
        """
        Apply visual density controls to slides.
        """
        
        controlled_slides = []
        
        for slide in slides:
            # Calculate current density
            text_pct = self._calculate_text_percentage(slide)
            visual_pct = self._calculate_visual_percentage(slide)
            
            # Apply controls
            if text_pct > config.max_text_percentage:
                slide = self._add_visuals(slide, config)
            
            if visual_pct < config.min_visual_percentage:
                slide = self._add_visuals(slide, config)
            
            if len(slide.elements) > config.max_elements_per_slide:
                slide = self._simplify_slide(slide, config)
            
            controlled_slides.append(slide)
        
        return controlled_slides
```

### 5.4 Speaker Notes Coherence Scoring

```python
# =============================================================================
# SPEAKER NOTES COHERENCE
# =============================================================================

@dataclass
class SpeakerNotesScore:
    """Coherence score for speaker notes."""
    overall: float              # 0-1
    slide_alignment: float      # How well notes match slide content
    narrative_flow: float       # How well notes flow between slides
    timing_appropriate: float   # Whether notes fit time allocation
    completeness: float         # Whether notes cover all points
    clarity: float              # Language clarity


class SpeakerNotesScorer:
    """
    Scores coherence of speaker notes.
    
    Scoring criteria:
      1. Slide alignment (30%): Notes should expand on slide content
      2. Narrative flow (25%): Notes should connect slides logically
      3. Timing (20%): Notes should fit allocated time
      4. Completeness (15%): Notes should cover all key points
      5. Clarity (10%): Notes should be clear and speakable
    """
    
    WEIGHTS = {
        "slide_alignment": 0.30,
        "narrative_flow": 0.25,
        "timing": 0.20,
        "completeness": 0.15,
        "clarity": 0.10
    }
    
    # Timing heuristics
    WORDS_PER_MINUTE = 150
    TARGET_MINUTES_PER_SLIDE = 2.0
    
    def score_notes(
        self,
        slides: List['Slide'],
        notes: List[str],
        target_duration_minutes: float
    ) -> List[SpeakerNotesScore]:
        """
        Score speaker notes for all slides.
        """
        
        scores = []
        
        for i, (slide, note) in enumerate(zip(slides, notes)):
            prev_note = notes[i-1] if i > 0 else None
            next_note = notes[i+1] if i < len(notes) - 1 else None
            
            score = self._score_single_note(
                slide, note, prev_note, next_note,
                target_duration_minutes / len(slides)
            )
            scores.append(score)
        
        return scores
    
    def _score_single_note(
        self,
        slide: 'Slide',
        note: str,
        prev_note: Optional[str],
        next_note: Optional[str],
        target_minutes: float
    ) -> SpeakerNotesScore:
        """Score a single slide's speaker notes."""
        
        # 1. Slide alignment
        slide_text = self._extract_slide_text(slide)
        alignment = self._compute_alignment(slide_text, note)
        
        # 2. Narrative flow
        flow = self._compute_narrative_flow(note, prev_note, next_note)
        
        # 3. Timing
        word_count = len(note.split())
        estimated_minutes = word_count / self.WORDS_PER_MINUTE
        timing_ratio = min(estimated_minutes / target_minutes, target_minutes / estimated_minutes)
        timing = timing_ratio if timing_ratio <= 1 else 1 / timing_ratio
        
        # 4. Completeness
        completeness = self._compute_completeness(slide, note)
        
        # 5. Clarity
        clarity = self._compute_clarity(note)
        
        # Overall
        overall = (
            alignment * self.WEIGHTS["slide_alignment"] +
            flow * self.WEIGHTS["narrative_flow"] +
            timing * self.WEIGHTS["timing"] +
            completeness * self.WEIGHTS["completeness"] +
            clarity * self.WEIGHTS["clarity"]
        )
        
        return SpeakerNotesScore(
            overall=overall,
            slide_alignment=alignment,
            narrative_flow=flow,
            timing_appropriate=timing,
            completeness=completeness,
            clarity=clarity
        )
    
    def _compute_alignment(self, slide_text: str, note: str) -> float:
        """Compute how well notes align with slide content."""
        slide_embedding = get_embedding(slide_text)
        note_embedding = get_embedding(note)
        return cosine_similarity(slide_embedding, note_embedding)
    
    def _compute_narrative_flow(
        self,
        note: str,
        prev_note: Optional[str],
        next_note: Optional[str]
    ) -> float:
        """Compute narrative flow between notes."""
        scores = []
        
        if prev_note:
            # Check transition from previous
            transition_score = self._check_transition(prev_note, note)
            scores.append(transition_score)
        
        if next_note:
            # Check setup for next
            setup_score = self._check_setup(note, next_note)
            scores.append(setup_score)
        
        return sum(scores) / len(scores) if scores else 0.7
    
    def _compute_completeness(self, slide: 'Slide', note: str) -> float:
        """Check if notes cover all slide points."""
        slide_points = self._extract_key_points(slide)
        note_embedding = get_embedding(note)
        
        covered = 0
        for point in slide_points:
            point_embedding = get_embedding(point)
            if cosine_similarity(note_embedding, point_embedding) > 0.6:
                covered += 1
        
        return covered / len(slide_points) if slide_points else 1.0
    
    def _compute_clarity(self, note: str) -> float:
        """Compute language clarity score."""
        # Heuristics:
        # - Sentence length (shorter = clearer)
        # - Word complexity (simpler = clearer)
        # - Active voice preference
        
        sentences = note.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences)
        
        # Penalize very long sentences
        length_score = 1.0 if avg_sentence_length < 20 else 20 / avg_sentence_length
        
        return length_score
```

---

## 6. Email Ingestion Lifecycle

### 6.1 Complete State Machine

```python
# =============================================================================
# EMAIL INGESTION STATE MACHINE
# =============================================================================

class EmailState(Enum):
    """States in email ingestion lifecycle."""
    RECEIVED = "received"           # Email received by SMTP
    VALIDATING = "validating"       # Security validation in progress
    VALIDATED = "validated"         # Passed security checks
    REJECTED = "rejected"           # Failed security checks
    PARSING = "parsing"             # Parsing email content
    PARSED = "parsed"               # Content extracted
    DEDUPLICATING = "deduplicating" # Checking for duplicates
    DUPLICATE = "duplicate"         # Is a duplicate
    PROCESSING = "processing"       # Creating/updating task
    PROCESSED = "processed"         # Task created/updated
    FAILED = "failed"               # Processing failed
    RESPONDED = "responded"         # Response sent


# State transitions
EMAIL_STATE_TRANSITIONS = {
    EmailState.RECEIVED: [EmailState.VALIDATING],
    EmailState.VALIDATING: [EmailState.VALIDATED, EmailState.REJECTED],
    EmailState.VALIDATED: [EmailState.PARSING],
    EmailState.PARSING: [EmailState.PARSED, EmailState.FAILED],
    EmailState.PARSED: [EmailState.DEDUPLICATING],
    EmailState.DEDUPLICATING: [EmailState.DUPLICATE, EmailState.PROCESSING],
    EmailState.PROCESSING: [EmailState.PROCESSED, EmailState.FAILED],
    EmailState.PROCESSED: [EmailState.RESPONDED],
    EmailState.DUPLICATE: [EmailState.RESPONDED],
    EmailState.REJECTED: [],  # Terminal
    EmailState.FAILED: [EmailState.RESPONDED],  # Can still respond with error
    EmailState.RESPONDED: []  # Terminal
}


# =============================================================================
# EMAIL INGESTION PIPELINE
# =============================================================================

@dataclass
class InboundEmail:
    """Inbound email record."""
    id: str
    message_id: str                    # RFC 5322 Message-ID
    from_address: str
    to_address: str
    subject: str
    body_text: Optional[str]
    body_html: Optional[str]
    attachments: List['EmailAttachment']
    headers: Dict[str, str]
    received_at: datetime
    
    # Security
    spf_result: Optional[str]
    dkim_result: Optional[str]
    dmarc_result: Optional[str]
    spam_score: Optional[float]
    
    # Processing
    state: EmailState
    state_history: List[Dict]
    content_hash: str
    thread_id: Optional[str]
    is_reply: bool
    in_reply_to: Optional[str]
    
    # Outcome
    task_id: Optional[str]
    error: Optional[str]
    response_sent: bool


class EmailIngestionPipeline:
    """
    Complete email ingestion pipeline.
    
    Stages:
      1. Receive: Accept email from SMTP
      2. Validate: Security checks (SPF, DKIM, DMARC, spam)
      3. Parse: Extract content and attachments
      4. Deduplicate: Check for duplicate emails
      5. Process: Create or update task
      6. Respond: Send acknowledgment or error
    """
    
    async def process_email(self, raw_email: bytes) -> InboundEmail:
        """
        Process an inbound email through the pipeline.
        """
        
        # Stage 1: Receive
        email = await self._receive_email(raw_email)
        
        try:
            # Stage 2: Validate
            email = await self._validate_email(email)
            if email.state == EmailState.REJECTED:
                await self._send_rejection_response(email)
                return email
            
            # Stage 3: Parse
            email = await self._parse_email(email)
            
            # Stage 4: Deduplicate
            email = await self._deduplicate_email(email)
            if email.state == EmailState.DUPLICATE:
                await self._send_duplicate_response(email)
                return email
            
            # Stage 5: Process
            email = await self._process_email(email)
            
            # Stage 6: Respond
            await self._send_success_response(email)
            
        except Exception as e:
            email.state = EmailState.FAILED
            email.error = str(e)
            await self._send_error_response(email)
        
        return email
```

### 6.2 Deduplication Logic

```python
# =============================================================================
# EMAIL DEDUPLICATION
# =============================================================================

class DeduplicationStrategy(Enum):
    """Strategies for detecting duplicate emails."""
    MESSAGE_ID = "message_id"       # RFC 5322 Message-ID
    CONTENT_HASH = "content_hash"   # Hash of body content
    THREAD_ID = "thread_id"         # Thread continuation
    COMPOSITE = "composite"         # Combination of above


@dataclass
class DeduplicationResult:
    """Result of deduplication check."""
    is_duplicate: bool
    duplicate_of: Optional[str]     # ID of original email
    strategy_matched: Optional[DeduplicationStrategy]
    confidence: float               # 0-1


class EmailDeduplicator:
    """
    Deduplicates inbound emails.
    
    Deduplication rules (in order):
      1. Message-ID: Exact match on RFC 5322 Message-ID
      2. Content hash: SHA-256 of normalized body
      3. Thread ID: Same thread within time window
      4. Fuzzy match: High similarity within time window
    
    Time windows:
      - Message-ID: 7 days
      - Content hash: 24 hours
      - Thread ID: 30 days
      - Fuzzy match: 1 hour
    """
    
    MESSAGE_ID_WINDOW_DAYS = 7
    CONTENT_HASH_WINDOW_HOURS = 24
    THREAD_ID_WINDOW_DAYS = 30
    FUZZY_MATCH_WINDOW_HOURS = 1
    FUZZY_SIMILARITY_THRESHOLD = 0.95
    
    async def check_duplicate(
        self,
        email: InboundEmail
    ) -> DeduplicationResult:
        """
        Check if email is a duplicate.
        """
        
        # Strategy 1: Message-ID
        if email.message_id:
            existing = await self._find_by_message_id(
                email.message_id,
                self.MESSAGE_ID_WINDOW_DAYS
            )
            if existing:
                return DeduplicationResult(
                    is_duplicate=True,
                    duplicate_of=existing.id,
                    strategy_matched=DeduplicationStrategy.MESSAGE_ID,
                    confidence=1.0
                )
        
        # Strategy 2: Content hash
        existing = await self._find_by_content_hash(
            email.content_hash,
            self.CONTENT_HASH_WINDOW_HOURS
        )
        if existing:
            return DeduplicationResult(
                is_duplicate=True,
                duplicate_of=existing.id,
                strategy_matched=DeduplicationStrategy.CONTENT_HASH,
                confidence=1.0
            )
        
        # Strategy 3: Thread ID (for replies)
        if email.thread_id:
            # Not a duplicate, but part of thread
            # This is handled differently - we update the existing task
            pass
        
        # Strategy 4: Fuzzy match
        similar = await self._find_similar_emails(
            email,
            self.FUZZY_MATCH_WINDOW_HOURS,
            self.FUZZY_SIMILARITY_THRESHOLD
        )
        if similar:
            return DeduplicationResult(
                is_duplicate=True,
                duplicate_of=similar.id,
                strategy_matched=DeduplicationStrategy.COMPOSITE,
                confidence=similar.similarity
            )
        
        # Not a duplicate
        return DeduplicationResult(
            is_duplicate=False,
            duplicate_of=None,
            strategy_matched=None,
            confidence=0.0
        )
    
    def compute_content_hash(self, email: InboundEmail) -> str:
        """
        Compute content hash for deduplication.
        
        Normalization:
          1. Lowercase
          2. Remove whitespace
          3. Remove signatures
          4. Remove quoted text
          5. SHA-256
        """
        content = email.body_text or ""
        
        # Normalize
        content = content.lower()
        content = re.sub(r'\s+', ' ', content)
        content = self._remove_signature(content)
        content = self._remove_quoted_text(content)
        content = content.strip()
        
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _remove_signature(self, text: str) -> str:
        """Remove email signature."""
        # Common signature markers
        markers = ['--', '___', 'sent from', 'best regards', 'thanks,']
        
        for marker in markers:
            idx = text.lower().rfind(marker)
            if idx > len(text) * 0.5:  # Only if in bottom half
                text = text[:idx]
        
        return text
    
    def _remove_quoted_text(self, text: str) -> str:
        """Remove quoted/forwarded text."""
        # Remove lines starting with >
        lines = text.split('\n')
        lines = [l for l in lines if not l.strip().startswith('>')]
        
        # Remove "On ... wrote:" blocks
        text = '\n'.join(lines)
        text = re.sub(r'On .+ wrote:.*', '', text, flags=re.DOTALL)
        
        return text
```

### 6.3 Security Validation

```python
# =============================================================================
# EMAIL SECURITY VALIDATION
# =============================================================================

@dataclass
class SecurityValidationResult:
    """Result of email security validation."""
    passed: bool
    spf_result: str          # pass, fail, softfail, neutral, none
    dkim_result: str         # pass, fail, none
    dmarc_result: str        # pass, fail, none
    spam_score: float        # 0-10, higher = more likely spam
    threats_detected: List[str]
    rejection_reason: Optional[str]


class EmailSecurityValidator:
    """
    Validates email security.
    
    Checks:
      1. SPF: Sender Policy Framework
      2. DKIM: DomainKeys Identified Mail
      3. DMARC: Domain-based Message Authentication
      4. Spam score: SpamAssassin or similar
      5. Attachment scanning: Malware detection
      6. Sender reputation: Known bad actors
    
    Rejection rules:
      - SPF fail + DKIM fail: REJECT
      - DMARC fail: REJECT (if policy is reject)
      - Spam score > 7: REJECT
      - Malware detected: REJECT
      - Sender on blocklist: REJECT
    """
    
    SPAM_THRESHOLD = 7.0
    
    async def validate(self, email: InboundEmail) -> SecurityValidationResult:
        """
        Validate email security.
        """
        
        threats = []
        
        # Check SPF
        spf_result = await self._check_spf(email)
        if spf_result == "fail":
            threats.append("SPF failed")
        
        # Check DKIM
        dkim_result = await self._check_dkim(email)
        if dkim_result == "fail":
            threats.append("DKIM failed")
        
        # Check DMARC
        dmarc_result = await self._check_dmarc(email)
        if dmarc_result == "fail":
            threats.append("DMARC failed")
        
        # Check spam score
        spam_score = await self._check_spam(email)
        if spam_score > self.SPAM_THRESHOLD:
            threats.append(f"High spam score: {spam_score}")
        
        # Check attachments for malware
        for attachment in email.attachments:
            malware_result = await self._scan_attachment(attachment)
            if malware_result.infected:
                threats.append(f"Malware in attachment: {malware_result.virus_name}")
        
        # Check sender reputation
        reputation = await self._check_sender_reputation(email.from_address)
        if reputation.is_blocked:
            threats.append(f"Sender blocked: {reputation.reason}")
        
        # Determine if passed
        passed = self._evaluate_pass(
            spf_result, dkim_result, dmarc_result,
            spam_score, threats
        )
        
        rejection_reason = None
        if not passed:
            rejection_reason = "; ".join(threats)
        
        return SecurityValidationResult(
            passed=passed,
            spf_result=spf_result,
            dkim_result=dkim_result,
            dmarc_result=dmarc_result,
            spam_score=spam_score,
            threats_detected=threats,
            rejection_reason=rejection_reason
        )
    
    def _evaluate_pass(
        self,
        spf: str,
        dkim: str,
        dmarc: str,
        spam_score: float,
        threats: List[str]
    ) -> bool:
        """
        Evaluate if email passes security checks.
        
        Rules:
          1. Both SPF and DKIM fail: REJECT
          2. DMARC fail: REJECT
          3. Spam score > threshold: REJECT
          4. Any malware: REJECT
          5. Sender blocked: REJECT
        """
        
        # Rule 1: Both SPF and DKIM fail
        if spf == "fail" and dkim == "fail":
            return False
        
        # Rule 2: DMARC fail
        if dmarc == "fail":
            return False
        
        # Rule 3: Spam score
        if spam_score > self.SPAM_THRESHOLD:
            return False
        
        # Rule 4 & 5: Check threats
        for threat in threats:
            if "Malware" in threat or "blocked" in threat:
                return False
        
        return True
```

### 6.4 Thread Continuation

```python
# =============================================================================
# EMAIL THREAD CONTINUATION
# =============================================================================

@dataclass
class ThreadContext:
    """Context for an email thread."""
    thread_id: str
    task_id: str
    email_count: int
    last_email_at: datetime
    participants: Set[str]
    subject: str


class EmailThreadManager:
    """
    Manages email thread continuation.
    
    Thread identification:
      1. In-Reply-To header
      2. References header
      3. Subject matching (Re: prefix)
      4. Participant matching
    
    Thread rules:
      1. Reply to existing thread: Update task with new context
      2. New thread from same sender: Create new task
      3. Thread timeout (30 days): Start new thread
    """
    
    THREAD_TIMEOUT_DAYS = 30
    
    async def identify_thread(
        self,
        email: InboundEmail
    ) -> Optional[ThreadContext]:
        """
        Identify if email belongs to an existing thread.
        """
        
        # Method 1: In-Reply-To header
        if email.in_reply_to:
            thread = await self._find_thread_by_message_id(email.in_reply_to)
            if thread:
                return thread
        
        # Method 2: References header
        references = email.headers.get("References", "").split()
        for ref in references:
            thread = await self._find_thread_by_message_id(ref)
            if thread:
                return thread
        
        # Method 3: Subject matching
        if email.subject.lower().startswith("re:"):
            original_subject = email.subject[3:].strip()
            thread = await self._find_thread_by_subject(
                original_subject,
                email.from_address,
                self.THREAD_TIMEOUT_DAYS
            )
            if thread:
                return thread
        
        # No existing thread
        return None
    
    async def continue_thread(
        self,
        email: InboundEmail,
        thread: ThreadContext
    ) -> 'Task':
        """
        Continue an existing thread with new email.
        """
        
        # Get existing task
        task = await get_task(thread.task_id)
        
        # Add email content to task context
        new_context = self._extract_email_context(email)
        task.context.append(new_context)
        
        # Update thread metadata
        thread.email_count += 1
        thread.last_email_at = email.received_at
        thread.participants.add(email.from_address)
        
        await save_thread(thread)
        await save_task(task)
        
        # Resume task if paused
        if task.status == "paused":
            await resume_task(task.id)
        
        return task
```

### 6.5 Edge Case Table

```python
# =============================================================================
# EMAIL EDGE CASES
# =============================================================================

EMAIL_EDGE_CASES = {
    # Edge case -> handling
    
    "attachment_over_size_limit": {
        "detection": "attachment.size > MAX_ATTACHMENT_SIZE (25MB)",
        "handling": "Skip attachment, notify user in response",
        "response": "Attachment '{name}' exceeds size limit and was not processed",
        "task_created": True,
        "attachment_stored": False
    },
    
    "all_attachments_over_limit": {
        "detection": "all attachments exceed limit",
        "handling": "Process email body only",
        "response": "All attachments exceeded size limit. Processing email body only.",
        "task_created": True,
        "attachment_stored": False
    },
    
    "malware_in_attachment": {
        "detection": "ClamAV detects malware",
        "handling": "Quarantine attachment, notify user",
        "response": "Attachment '{name}' was quarantined due to security concerns",
        "task_created": True,
        "attachment_stored": False
    },
    
    "empty_email_body": {
        "detection": "body_text is empty and no attachments",
        "handling": "Reject email",
        "response": "Email has no content to process",
        "task_created": False,
        "attachment_stored": False
    },
    
    "unknown_sender": {
        "detection": "sender not in allowed list (if configured)",
        "handling": "Queue for manual review or reject",
        "response": "Your email is pending review",
        "task_created": False,
        "attachment_stored": False
    },
    
    "duplicate_within_1_hour": {
        "detection": "same content hash within 1 hour",
        "handling": "Ignore, send acknowledgment",
        "response": "We received your email. A task is already in progress.",
        "task_created": False,
        "attachment_stored": False
    },
    
    "thread_continuation_after_task_complete": {
        "detection": "reply to completed task",
        "handling": "Create new task with reference to old",
        "response": "Creating new task (previous task was completed)",
        "task_created": True,
        "attachment_stored": True
    },
    
    "owner_credit_exhausted": {
        "detection": "owner has no credits",
        "handling": "Queue email, notify owner",
        "response": "Your request is queued. The account needs credits to process.",
        "task_created": False,
        "attachment_stored": True
    },
    
    "forwarded_email_chain": {
        "detection": "multiple 'Forwarded' markers",
        "handling": "Extract only the most recent message",
        "response": "Processing the most recent message in the chain",
        "task_created": True,
        "attachment_stored": True
    },
    
    "auto_reply_loop": {
        "detection": "Auto-Submitted header or loop detection",
        "handling": "Ignore, do not respond",
        "response": None,
        "task_created": False,
        "attachment_stored": False
    }
}
```

---

## 7. Kill-Switch & Safeguards

### 7.1 Emergency Stop Mechanisms

```python
# =============================================================================
# KILL SWITCHES
# =============================================================================

class KillSwitchLevel(Enum):
    """Levels of kill switch."""
    GLOBAL = "global"           # Stop everything
    ORG = "org"                 # Stop specific organization
    USER = "user"               # Stop specific user
    RUN = "run"                 # Stop specific run
    AGENT = "agent"             # Stop specific agent


@dataclass
class KillSwitch:
    """Kill switch configuration."""
    id: str
    level: KillSwitchLevel
    target_id: str              # org_id, user_id, run_id, or agent_id
    reason: str
    activated_by: str           # User or system
    activated_at: datetime
    expires_at: Optional[datetime]
    is_active: bool


# =============================================================================
# KILL SWITCH FLAGS
# =============================================================================

KILL_SWITCH_FLAGS = {
    # Flag name -> (level, check_frequency, latency_guarantee)
    
    "global_emergency_stop": {
        "level": KillSwitchLevel.GLOBAL,
        "check_frequency": "every_step",
        "latency_guarantee_ms": 100,
        "checked_at": ["before_llm_call", "before_tool_execution", "before_step_start"]
    },
    
    "org_suspended": {
        "level": KillSwitchLevel.ORG,
        "check_frequency": "every_step",
        "latency_guarantee_ms": 100,
        "checked_at": ["before_llm_call", "before_tool_execution", "before_step_start"]
    },
    
    "user_suspended": {
        "level": KillSwitchLevel.USER,
        "check_frequency": "every_step",
        "latency_guarantee_ms": 100,
        "checked_at": ["before_llm_call", "before_tool_execution", "before_step_start"]
    },
    
    "run_cancelled": {
        "level": KillSwitchLevel.RUN,
        "check_frequency": "every_step",
        "latency_guarantee_ms": 50,
        "checked_at": ["before_llm_call", "before_tool_execution", "before_step_start", "during_streaming"]
    },
    
    "credit_exhausted": {
        "level": KillSwitchLevel.ORG,
        "check_frequency": "before_billable_action",
        "latency_guarantee_ms": 100,
        "checked_at": ["before_llm_call", "before_tool_execution"]
    },
    
    "abuse_detected": {
        "level": KillSwitchLevel.USER,
        "check_frequency": "every_step",
        "latency_guarantee_ms": 100,
        "checked_at": ["before_llm_call", "before_tool_execution", "before_step_start"]
    }
}


# =============================================================================
# KILL SWITCH CHECKER
# =============================================================================

class KillSwitchChecker:
    """
    Checks kill switches at various points in execution.
    
    Check points:
      1. Before step start
      2. Before LLM call
      3. Before tool execution
      4. During streaming (periodic)
      5. Before billable action
    
    Latency guarantees:
      - All checks complete within 100ms
      - Uses Redis for fast lookups
      - Caches negative results for 1 second
    """
    
    CACHE_TTL_SECONDS = 1
    
    async def check_all(
        self,
        context: 'ExecutionContext'
    ) -> Optional[KillSwitch]:
        """
        Check all applicable kill switches.
        
        Returns:
            KillSwitch if any is active, None otherwise
        """
        
        # Check in order of severity
        checks = [
            ("global_emergency_stop", None),
            ("org_suspended", context.org_id),
            ("user_suspended", context.user_id),
            ("run_cancelled", context.run_id),
            ("credit_exhausted", context.org_id),
            ("abuse_detected", context.user_id),
        ]
        
        for flag_name, target_id in checks:
            kill_switch = await self._check_flag(flag_name, target_id)
            if kill_switch and kill_switch.is_active:
                return kill_switch
        
        return None
    
    async def _check_flag(
        self,
        flag_name: str,
        target_id: Optional[str]
    ) -> Optional[KillSwitch]:
        """
        Check a specific kill switch flag.
        """
        
        # Check cache first
        cache_key = f"kill_switch:{flag_name}:{target_id or 'global'}"
        cached = await redis.get(cache_key)
        
        if cached == "inactive":
            return None
        elif cached:
            return KillSwitch(**json.loads(cached))
        
        # Query database
        kill_switch = await self._query_kill_switch(flag_name, target_id)
        
        # Cache result
        if kill_switch and kill_switch.is_active:
            await redis.setex(
                cache_key,
                self.CACHE_TTL_SECONDS,
                json.dumps(asdict(kill_switch))
            )
        else:
            await redis.setex(cache_key, self.CACHE_TTL_SECONDS, "inactive")
        
        return kill_switch


# =============================================================================
# CREDIT EXHAUSTION STOP
# =============================================================================

class CreditExhaustionHandler:
    """
    Handles credit exhaustion stop-the-world logic.
    
    Behavior:
      1. Check credit balance before every billable action
      2. If balance < estimated cost: BLOCK
      3. If balance < warning threshold: WARN
      4. If balance hits zero mid-step: Complete step, then STOP
    
    Grace period:
      - 5 minutes after hitting zero
      - Allows completion of current step
      - Blocks new steps
    """
    
    WARNING_THRESHOLD = Decimal("5.00")
    GRACE_PERIOD_SECONDS = 300
    
    async def check_before_action(
        self,
        org_id: str,
        estimated_cost: Decimal
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if action should proceed based on credit balance.
        
        Returns:
            (can_proceed, warning_message)
        """
        
        balance = await get_org_credit_balance(org_id)
        
        # Check if in grace period
        grace = await get_grace_period(org_id)
        
        if balance <= 0:
            if grace and not grace.expired:
                # In grace period - allow current step to complete
                return (True, f"Grace period: {grace.remaining_seconds}s remaining")
            else:
                # No grace or expired - block
                return (False, "Credit balance exhausted")
        
        if balance < estimated_cost:
            # Not enough for this action
            return (False, f"Insufficient credits: ${balance} < ${estimated_cost}")
        
        if balance < self.WARNING_THRESHOLD:
            # Low balance warning
            return (True, f"Low credit balance: ${balance}")
        
        # OK
        return (True, None)
    
    async def handle_exhaustion_mid_step(
        self,
        org_id: str,
        step_id: str
    ) -> Dict[str, Any]:
        """
        Handle credit exhaustion during step execution.
        """
        
        # Start grace period
        grace = await start_grace_period(org_id, self.GRACE_PERIOD_SECONDS)
        
        # Mark step as "completing under grace"
        await mark_step_grace_period(step_id)
        
        # Notify owner
        await notify_org_owner(
            org_id,
            "credit_exhausted",
            f"Credits exhausted. Current step will complete. Grace period: {self.GRACE_PERIOD_SECONDS}s"
        )
        
        return {
            "action": "continue_with_grace",
            "grace_period_seconds": self.GRACE_PERIOD_SECONDS,
            "step_will_complete": True,
            "new_steps_blocked": True
        }


# =============================================================================
# ABUSE DETECTION
# =============================================================================

class AbuseDetector:
    """
    Detects and handles abuse.
    
    Abuse triggers:
      1. Rate limiting exceeded (10x normal)
      2. Unusual token consumption (5x average)
      3. Blocked content generation attempts
      4. Multiple failed payment attempts
      5. Suspicious IP patterns
      6. Terms of service violations
    
    Actions:
      1. Warning: Notify user, log event
      2. Throttle: Reduce rate limits
      3. Suspend: Activate kill switch
      4. Ban: Permanent suspension
    """
    
    TRIGGERS = {
        "rate_limit_exceeded": {
            "threshold": "10x normal rate",
            "action": "throttle",
            "escalation": "suspend after 3 occurrences"
        },
        "unusual_token_consumption": {
            "threshold": "5x average consumption in 1 hour",
            "action": "warning",
            "escalation": "throttle after 2 occurrences"
        },
        "blocked_content_attempt": {
            "threshold": "any attempt",
            "action": "warning",
            "escalation": "suspend after 3 attempts"
        },
        "payment_fraud": {
            "threshold": "3 failed attempts with different cards",
            "action": "suspend",
            "escalation": "ban after review"
        },
        "suspicious_ip": {
            "threshold": "known bad IP or VPN + unusual activity",
            "action": "throttle",
            "escalation": "suspend after verification"
        },
        "tos_violation": {
            "threshold": "any confirmed violation",
            "action": "suspend",
            "escalation": "ban after review"
        }
    }
    
    async def check_for_abuse(
        self,
        user_id: str,
        org_id: str,
        action: str,
        context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Check if action constitutes abuse.
        
        Returns:
            Abuse detection result if abuse detected, None otherwise
        """
        
        # Check each trigger
        for trigger_name, trigger_config in self.TRIGGERS.items():
            is_triggered = await self._check_trigger(
                trigger_name,
                user_id,
                org_id,
                action,
                context
            )
            
            if is_triggered:
                return await self._handle_abuse(
                    trigger_name,
                    trigger_config,
                    user_id,
                    org_id
                )
        
        return None
    
    async def _handle_abuse(
        self,
        trigger_name: str,
        trigger_config: Dict,
        user_id: str,
        org_id: str
    ) -> Dict[str, Any]:
        """
        Handle detected abuse.
        """
        
        action = trigger_config["action"]
        
        if action == "warning":
            await self._send_warning(user_id, trigger_name)
            await self._log_abuse_event(user_id, org_id, trigger_name, "warning")
            return {"action": "warning", "trigger": trigger_name}
        
        elif action == "throttle":
            await self._apply_throttle(user_id, org_id)
            await self._log_abuse_event(user_id, org_id, trigger_name, "throttle")
            return {"action": "throttle", "trigger": trigger_name}
        
        elif action == "suspend":
            await self._activate_kill_switch(
                KillSwitchLevel.USER,
                user_id,
                f"Abuse detected: {trigger_name}"
            )
            await self._log_abuse_event(user_id, org_id, trigger_name, "suspend")
            return {"action": "suspend", "trigger": trigger_name}
        
        elif action == "ban":
            await self._permanent_ban(user_id, org_id, trigger_name)
            await self._log_abuse_event(user_id, org_id, trigger_name, "ban")
            return {"action": "ban", "trigger": trigger_name}
        
        return {"action": "none", "trigger": trigger_name}


# =============================================================================
# HUMAN OVERRIDE PATHS
# =============================================================================

class HumanOverride:
    """
    Human override mechanisms for kill switches and safeguards.
    
    Override paths:
      1. Admin override: Platform admin can override any kill switch
      2. Owner override: Org owner can override org-level switches
      3. Support override: Support can temporarily lift restrictions
      4. Emergency override: On-call engineer can override in emergencies
    
    Audit requirements:
      - All overrides logged with reason
      - Overrides expire after set time
      - Overrides require 2FA for sensitive actions
    """
    
    OVERRIDE_PERMISSIONS = {
        "admin": {
            "can_override": [KillSwitchLevel.GLOBAL, KillSwitchLevel.ORG, KillSwitchLevel.USER, KillSwitchLevel.RUN],
            "requires_2fa": True,
            "max_duration_hours": 24,
            "requires_reason": True
        },
        "owner": {
            "can_override": [KillSwitchLevel.ORG, KillSwitchLevel.USER, KillSwitchLevel.RUN],
            "requires_2fa": True,
            "max_duration_hours": 4,
            "requires_reason": True
        },
        "support": {
            "can_override": [KillSwitchLevel.USER, KillSwitchLevel.RUN],
            "requires_2fa": True,
            "max_duration_hours": 1,
            "requires_reason": True
        },
        "on_call": {
            "can_override": [KillSwitchLevel.GLOBAL, KillSwitchLevel.ORG],
            "requires_2fa": True,
            "max_duration_hours": 2,
            "requires_reason": True,
            "requires_incident_id": True
        }
    }
    
    async def request_override(
        self,
        requester_id: str,
        requester_role: str,
        kill_switch_id: str,
        reason: str,
        duration_hours: float,
        incident_id: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Request an override for a kill switch.
        
        Returns:
            (success, message)
        """
        
        # Get kill switch
        kill_switch = await get_kill_switch(kill_switch_id)
        if not kill_switch:
            return (False, "Kill switch not found")
        
        # Check permissions
        permissions = self.OVERRIDE_PERMISSIONS.get(requester_role)
        if not permissions:
            return (False, f"Role {requester_role} cannot override kill switches")
        
        if kill_switch.level not in permissions["can_override"]:
            return (False, f"Role {requester_role} cannot override {kill_switch.level.value} level switches")
        
        if duration_hours > permissions["max_duration_hours"]:
            return (False, f"Duration exceeds maximum ({permissions['max_duration_hours']} hours)")
        
        if permissions.get("requires_incident_id") and not incident_id:
            return (False, "Incident ID required for this override")
        
        # Verify 2FA if required
        if permissions["requires_2fa"]:
            verified = await verify_2fa(requester_id)
            if not verified:
                return (False, "2FA verification required")
        
        # Create override
        override = await create_override(
            kill_switch_id=kill_switch_id,
            requester_id=requester_id,
            requester_role=requester_role,
            reason=reason,
            duration_hours=duration_hours,
            incident_id=incident_id
        )
        
        # Deactivate kill switch temporarily
        await deactivate_kill_switch(
            kill_switch_id,
            override_id=override.id,
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours)
        )
        
        # Log audit event
        await log_audit_event(
            event_type="kill_switch_override",
            actor_id=requester_id,
            actor_role=requester_role,
            target_id=kill_switch_id,
            reason=reason,
            duration_hours=duration_hours,
            incident_id=incident_id
        )
        
        return (True, f"Override granted for {duration_hours} hours")
```

---

## Summary

This document provides exact implementation details for:

1. **Orchestration & Retry Semantics**
   - User-visible retry states and visibility rules
   - User override controls for retries
   - Retry credit consumption rules
   - UI state mapping

2. **Collaboration Conflict Resolution**
   - Pessimistic locking for prompt blocks
   - Tool execution permission model
   - Credit exhaustion handling during collaboration

3. **Retry + Billing UX Contract**
   - Complete retry billing rules
   - Cost display formatting
   - User retry controls

4. **Wide Research**
   - Confidence scoring heuristics
   - Agent dropout rules
   - Synthesis weighting

5. **Document & Presentation Generation**
   - Design heuristics
   - Slide narrative flow rules
   - Auto-visual density controls
   - Speaker notes coherence scoring

6. **Email Ingestion**
   - Complete state machine
   - Deduplication logic
   - Security validation
   - Thread continuation
   - Edge case handling

7. **Kill-Switch & Safeguards**
   - Kill switch flags and check points
   - Credit exhaustion stop-the-world logic
   - Abuse detection triggers
   - Human override paths

---

**This is the technical truth. Implement it exactly.** 🎯
