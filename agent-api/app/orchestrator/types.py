"""
Orchestrator Core Data Structures and Types

Based on Failure & Retry Semantics specification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4


# =============================================================================
# RUN STATE MACHINE
# =============================================================================

class RunState(Enum):
    """States in the research run lifecycle."""
    CREATED = "created"
    VALIDATING = "validating"
    DECOMPOSING = "decomposing"
    SCHEDULING = "scheduling"
    EXECUTING = "executing"
    AGGREGATING = "aggregating"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SubtaskState(Enum):
    """States in the subtask lifecycle."""
    PENDING = "pending"
    QUEUED = "queued"
    ASSIGNED = "assigned"
    RUNNING = "running"
    CHECKPOINTED = "checkpointed"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


# Valid state transitions
RUN_TRANSITIONS: Dict[RunState, Set[RunState]] = {
    RunState.CREATED: {RunState.VALIDATING, RunState.CANCELLED},
    RunState.VALIDATING: {RunState.DECOMPOSING, RunState.FAILED, RunState.CANCELLED},
    RunState.DECOMPOSING: {RunState.SCHEDULING, RunState.FAILED, RunState.CANCELLED},
    RunState.SCHEDULING: {RunState.EXECUTING, RunState.FAILED, RunState.CANCELLED},
    RunState.EXECUTING: {RunState.AGGREGATING, RunState.FAILED, RunState.CANCELLED},
    RunState.AGGREGATING: {RunState.FINALIZING, RunState.FAILED, RunState.CANCELLED},
    RunState.FINALIZING: {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED},
    RunState.COMPLETED: set(),  # Terminal state
    RunState.FAILED: set(),     # Terminal state
    RunState.CANCELLED: set(),  # Terminal state
}

SUBTASK_TRANSITIONS: Dict[SubtaskState, Set[SubtaskState]] = {
    SubtaskState.PENDING: {SubtaskState.QUEUED, SubtaskState.CANCELLED},
    SubtaskState.QUEUED: {SubtaskState.ASSIGNED, SubtaskState.CANCELLED},
    SubtaskState.ASSIGNED: {SubtaskState.RUNNING, SubtaskState.PENDING, SubtaskState.CANCELLED},
    SubtaskState.RUNNING: {SubtaskState.CHECKPOINTED, SubtaskState.COMPLETED,
                           SubtaskState.FAILED, SubtaskState.CANCELLED},
    SubtaskState.CHECKPOINTED: {SubtaskState.RUNNING, SubtaskState.COMPLETED,
                                 SubtaskState.FAILED, SubtaskState.CANCELLED},
    SubtaskState.COMPLETED: set(),
    SubtaskState.FAILED: {SubtaskState.PENDING},  # Can retry
    SubtaskState.SKIPPED: set(),
    SubtaskState.CANCELLED: set(),
}


# =============================================================================
# CORE ENTITIES
# =============================================================================

@dataclass
class RunConfig:
    """Configuration for a research run."""
    max_subtasks: int = 100
    max_sources_per_subtask: int = 10
    max_retries: int = 3
    timeout_minutes: int = 60
    priority: int = 5  # 1-10, higher = more urgent

    # Decomposition settings
    decomposition_strategy: str = "auto"  # auto, entity_based, dimension_based, source_based
    entity_types: List[str] = field(default_factory=list)

    # Quality settings
    min_confidence: float = 0.7
    require_multiple_sources: bool = True

    # Resource limits
    max_llm_calls: int = 1000
    max_web_requests: int = 500
    budget_limit_usd: Optional[float] = None


@dataclass
class ResearchRun:
    """A research run representing a complete research task."""
    id: str
    tenant_id: str
    user_id: str

    # Query and configuration
    query: str
    config: RunConfig

    # State
    state: RunState
    state_version: int

    # Progress
    total_subtasks: int
    completed_subtasks: int
    failed_subtasks: int

    # Fencing
    fencing_token: Optional[str]
    fencing_expires_at: Optional[datetime]

    # Timing
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    deadline_at: Optional[datetime]

    # Results
    result_summary: Optional[Dict[str, Any]]
    artifacts: List[str]

    @property
    def progress_percentage(self) -> float:
        if self.total_subtasks == 0:
            return 0.0
        return (self.completed_subtasks / self.total_subtasks) * 100

    @property
    def is_terminal(self) -> bool:
        return self.state in {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED}

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "ResearchRun":
        """Create from database row."""
        return cls(
            id=row["id"],
            tenant_id=row.get("tenant_id", row.get("user_id")),
            user_id=row["user_id"],
            query=row.get("prompt", ""),
            config=RunConfig(
                max_subtasks=row.get("max_subtasks", 100),
                timeout_minutes=row.get("timeout_minutes", 60),
            ),
            state=RunState(row.get("status", "created")),
            state_version=row.get("state_version", 1),
            total_subtasks=row.get("total_subtasks", 0),
            completed_subtasks=row.get("completed_subtasks", 0),
            failed_subtasks=row.get("failed_subtasks", 0),
            fencing_token=row.get("fencing_token"),
            fencing_expires_at=row.get("fencing_expires_at"),
            created_at=row.get("created_at", datetime.utcnow()),
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
            deadline_at=row.get("deadline_at"),
            result_summary=row.get("result_summary"),
            artifacts=row.get("artifacts", []),
        )


@dataclass
class Subtask:
    """A subtask within a research run."""
    id: str
    run_id: str
    index: int
    idempotency_key: str

    # Task definition
    task_type: str
    entity_id: Optional[str]
    input_data: Dict[str, Any]

    # State
    state: SubtaskState
    state_version: int

    # Execution
    attempt_count: int
    max_attempts: int
    assigned_worker_id: Optional[str]
    heartbeat_at: Optional[datetime]

    # Checkpointing
    checkpoint_id: Optional[str]
    checkpoint_step: int

    # Results
    result_data: Optional[Dict[str, Any]]
    artifacts: List[str]

    # Errors
    last_error: Optional[str]
    last_error_code: Optional[str]

    # Timing
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    # Dependencies
    depends_on: List[str]  # List of subtask IDs

    @property
    def is_ready(self) -> bool:
        """Check if subtask is ready to execute (dependencies met)."""
        return len(self.depends_on) == 0

    @property
    def is_terminal(self) -> bool:
        return self.state in {SubtaskState.COMPLETED, SubtaskState.FAILED,
                              SubtaskState.SKIPPED, SubtaskState.CANCELLED}

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "Subtask":
        """Create from database row."""
        return cls(
            id=row["id"],
            run_id=row["run_id"],
            index=row["subtask_index"],
            idempotency_key=row["idempotency_key"],
            task_type=row["task_type"],
            entity_id=row.get("entity_id"),
            input_data=row.get("input_data", {}),
            state=SubtaskState(row.get("state", "pending")),
            state_version=row.get("state_version", 1),
            attempt_count=row.get("attempt_count", 0),
            max_attempts=row.get("max_attempts", 3),
            assigned_worker_id=row.get("assigned_worker_id"),
            heartbeat_at=row.get("heartbeat_at"),
            checkpoint_id=row.get("checkpoint_id"),
            checkpoint_step=row.get("checkpoint_step", 0),
            result_data=row.get("result_data"),
            artifacts=row.get("artifacts", []),
            last_error=row.get("last_error"),
            last_error_code=row.get("last_error_code"),
            created_at=row.get("created_at", datetime.utcnow()),
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
            depends_on=row.get("depends_on", []),
        )


@dataclass
class SubtaskDefinition:
    """Definition of a subtask before creation."""
    task_type: str
    entity_id: Optional[str]
    input_data: Dict[str, Any]
    priority: int
    estimated_duration_seconds: int
    depends_on_indices: List[int]  # Indices of dependent subtasks


@dataclass
class DecompositionResult:
    """Result of decomposing a query into subtasks."""
    subtasks: List[SubtaskDefinition]
    dependency_graph: Dict[str, List[str]]  # subtask_id -> dependencies
    estimated_duration_minutes: int
    estimated_cost_usd: float
    decomposition_reasoning: str


@dataclass
class SchedulingDecision:
    """Decision about how to schedule a subtask."""
    subtask_id: str
    queue_name: str
    priority: int
    delay_seconds: int
    worker_affinity: Optional[str]


@dataclass
class RunProgress:
    """Progress information for a run."""
    total: int
    completed: int
    failed: int
    skipped: int
    cancelled: int
    in_progress: int
    is_complete: bool

    @property
    def percentage(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.completed / self.total) * 100


@dataclass
class OrchestratorConfig:
    """Configuration for the orchestrator."""
    max_failure_ratio: float = 0.3
    deduplicate_queries: bool = True
    progress_update_interval: int = 10
    deadline_check_interval: int = 30
    stall_detection_interval: int = 60
    stall_threshold_minutes: int = 10
    fencing_timeout_minutes: int = 5


# =============================================================================
# EXCEPTIONS
# =============================================================================

class OrchestratorError(Exception):
    """Base exception for orchestrator errors."""
    pass


class ValidationError(OrchestratorError):
    """Query or config validation failed."""
    pass


class QuotaExceededError(OrchestratorError):
    """Tenant quota exceeded."""
    pass


class DecompositionError(OrchestratorError):
    """Query decomposition failed."""
    pass


class InvalidTransitionError(OrchestratorError):
    """Invalid state transition."""
    pass


class ConcurrencyError(OrchestratorError):
    """Concurrent modification detected."""
    pass


class FencingError(OrchestratorError):
    """Failed to acquire fencing token."""
    pass
