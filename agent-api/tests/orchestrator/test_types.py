"""Tests for orchestrator types and state transitions."""

import pytest
from datetime import datetime

from app.orchestrator.types import (
    RunState,
    SubtaskState,
    RUN_TRANSITIONS,
    SUBTASK_TRANSITIONS,
    RunConfig,
    ResearchRun,
    Subtask,
    SubtaskDefinition,
    RunProgress,
)


class TestRunState:
    """Tests for RunState enum and transitions."""

    def test_run_states_exist(self):
        """All expected run states exist."""
        expected_states = [
            "CREATED", "VALIDATING", "DECOMPOSING", "SCHEDULING",
            "EXECUTING", "AGGREGATING", "FINALIZING",
            "COMPLETED", "FAILED", "CANCELLED"
        ]
        for state_name in expected_states:
            assert hasattr(RunState, state_name)

    def test_run_state_values(self):
        """Run state values are lowercase strings."""
        assert RunState.CREATED.value == "created"
        assert RunState.EXECUTING.value == "executing"
        assert RunState.COMPLETED.value == "completed"

    def test_run_transitions_from_created(self):
        """CREATED can transition to VALIDATING or CANCELLED."""
        allowed = RUN_TRANSITIONS[RunState.CREATED]
        assert RunState.VALIDATING in allowed
        assert RunState.CANCELLED in allowed
        assert len(allowed) == 2

    def test_run_transitions_from_validating(self):
        """VALIDATING can transition to DECOMPOSING, FAILED, or CANCELLED."""
        allowed = RUN_TRANSITIONS[RunState.VALIDATING]
        assert RunState.DECOMPOSING in allowed
        assert RunState.FAILED in allowed
        assert RunState.CANCELLED in allowed

    def test_run_transitions_from_executing(self):
        """EXECUTING can transition to AGGREGATING, FAILED, or CANCELLED."""
        allowed = RUN_TRANSITIONS[RunState.EXECUTING]
        assert RunState.AGGREGATING in allowed
        assert RunState.FAILED in allowed
        assert RunState.CANCELLED in allowed

    def test_terminal_states_have_no_transitions(self):
        """Terminal states (COMPLETED, FAILED, CANCELLED) have no outgoing transitions."""
        assert RUN_TRANSITIONS[RunState.COMPLETED] == set()
        assert RUN_TRANSITIONS[RunState.FAILED] == set()
        assert RUN_TRANSITIONS[RunState.CANCELLED] == set()

    def test_all_states_have_transitions_defined(self):
        """All states have their transitions defined."""
        for state in RunState:
            assert state in RUN_TRANSITIONS


class TestSubtaskState:
    """Tests for SubtaskState enum and transitions."""

    def test_subtask_states_exist(self):
        """All expected subtask states exist."""
        expected_states = [
            "PENDING", "QUEUED", "ASSIGNED", "RUNNING",
            "CHECKPOINTED", "COMPLETED", "FAILED", "SKIPPED", "CANCELLED"
        ]
        for state_name in expected_states:
            assert hasattr(SubtaskState, state_name)

    def test_subtask_transitions_from_pending(self):
        """PENDING can transition to QUEUED or CANCELLED."""
        allowed = SUBTASK_TRANSITIONS[SubtaskState.PENDING]
        assert SubtaskState.QUEUED in allowed
        assert SubtaskState.CANCELLED in allowed

    def test_subtask_transitions_from_running(self):
        """RUNNING has multiple valid transitions."""
        allowed = SUBTASK_TRANSITIONS[SubtaskState.RUNNING]
        assert SubtaskState.CHECKPOINTED in allowed
        assert SubtaskState.COMPLETED in allowed
        assert SubtaskState.FAILED in allowed
        assert SubtaskState.CANCELLED in allowed

    def test_failed_can_retry(self):
        """FAILED can transition back to PENDING for retry."""
        allowed = SUBTASK_TRANSITIONS[SubtaskState.FAILED]
        assert SubtaskState.PENDING in allowed


class TestRunConfig:
    """Tests for RunConfig dataclass."""

    def test_default_values(self):
        """Default configuration values are set."""
        config = RunConfig()
        assert config.max_subtasks == 100
        assert config.max_retries == 3
        assert config.timeout_minutes == 60
        assert config.priority == 5
        assert config.decomposition_strategy == "auto"
        assert config.min_confidence == 0.7

    def test_custom_values(self):
        """Custom configuration values are respected."""
        config = RunConfig(
            max_subtasks=50,
            max_retries=5,
            timeout_minutes=120,
            decomposition_strategy="entity_based",
        )
        assert config.max_subtasks == 50
        assert config.max_retries == 5
        assert config.timeout_minutes == 120
        assert config.decomposition_strategy == "entity_based"


class TestResearchRun:
    """Tests for ResearchRun dataclass."""

    @pytest.fixture
    def sample_run(self):
        """Create a sample run for testing."""
        return ResearchRun(
            id="run-123",
            tenant_id="tenant-1",
            user_id="user-1",
            query="Test query",
            config=RunConfig(),
            state=RunState.EXECUTING,
            state_version=3,
            total_subtasks=10,
            completed_subtasks=5,
            failed_subtasks=1,
            fencing_token=None,
            fencing_expires_at=None,
            created_at=datetime.utcnow(),
            started_at=datetime.utcnow(),
            completed_at=None,
            deadline_at=datetime.utcnow(),
            result_summary=None,
            artifacts=[],
        )

    def test_progress_percentage(self, sample_run):
        """Progress percentage is calculated correctly."""
        assert sample_run.progress_percentage == 50.0

    def test_progress_percentage_zero_total(self):
        """Progress percentage is 0 when no subtasks."""
        run = ResearchRun(
            id="run-123",
            tenant_id="tenant-1",
            user_id="user-1",
            query="Test",
            config=RunConfig(),
            state=RunState.CREATED,
            state_version=1,
            total_subtasks=0,
            completed_subtasks=0,
            failed_subtasks=0,
            fencing_token=None,
            fencing_expires_at=None,
            created_at=datetime.utcnow(),
            started_at=None,
            completed_at=None,
            deadline_at=None,
            result_summary=None,
            artifacts=[],
        )
        assert run.progress_percentage == 0.0

    def test_is_terminal_completed(self, sample_run):
        """is_terminal is True for COMPLETED state."""
        sample_run.state = RunState.COMPLETED
        assert sample_run.is_terminal is True

    def test_is_terminal_failed(self, sample_run):
        """is_terminal is True for FAILED state."""
        sample_run.state = RunState.FAILED
        assert sample_run.is_terminal is True

    def test_is_terminal_executing(self, sample_run):
        """is_terminal is False for EXECUTING state."""
        sample_run.state = RunState.EXECUTING
        assert sample_run.is_terminal is False

    def test_from_db_row(self):
        """Create run from database row."""
        row = {
            "id": "run-456",
            "user_id": "user-2",
            "prompt": "Research query",
            "status": "executing",
            "state_version": 5,
            "total_subtasks": 20,
            "completed_subtasks": 10,
            "failed_subtasks": 2,
        }
        run = ResearchRun.from_db_row(row)
        assert run.id == "run-456"
        assert run.state == RunState.EXECUTING
        assert run.state_version == 5


class TestSubtask:
    """Tests for Subtask dataclass."""

    @pytest.fixture
    def sample_subtask(self):
        """Create a sample subtask for testing."""
        return Subtask(
            id="subtask-123",
            run_id="run-123",
            index=0,
            idempotency_key="run-123:0",
            task_type="entity_research",
            entity_id="Company A",
            input_data={"instructions": "Research company"},
            state=SubtaskState.PENDING,
            state_version=1,
            attempt_count=0,
            max_attempts=3,
            assigned_worker_id=None,
            heartbeat_at=None,
            checkpoint_id=None,
            checkpoint_step=0,
            result_data=None,
            artifacts=[],
            last_error=None,
            last_error_code=None,
            created_at=datetime.utcnow(),
            started_at=None,
            completed_at=None,
            depends_on=[],
        )

    def test_is_ready_no_dependencies(self, sample_subtask):
        """is_ready is True when no dependencies."""
        assert sample_subtask.is_ready is True

    def test_is_ready_with_dependencies(self, sample_subtask):
        """is_ready is False when has dependencies."""
        sample_subtask.depends_on = ["subtask-456"]
        assert sample_subtask.is_ready is False

    def test_is_terminal_pending(self, sample_subtask):
        """is_terminal is False for PENDING state."""
        assert sample_subtask.is_terminal is False

    def test_is_terminal_completed(self, sample_subtask):
        """is_terminal is True for COMPLETED state."""
        sample_subtask.state = SubtaskState.COMPLETED
        assert sample_subtask.is_terminal is True


class TestRunProgress:
    """Tests for RunProgress dataclass."""

    def test_percentage_calculation(self):
        """Percentage is calculated correctly."""
        progress = RunProgress(
            total=100,
            completed=50,
            failed=10,
            skipped=5,
            cancelled=5,
            in_progress=30,
            is_complete=False,
        )
        assert progress.percentage == 50.0

    def test_percentage_zero_total(self):
        """Percentage is 0 when total is 0."""
        progress = RunProgress(
            total=0,
            completed=0,
            failed=0,
            skipped=0,
            cancelled=0,
            in_progress=0,
            is_complete=False,
        )
        assert progress.percentage == 0.0


class TestSubtaskDefinition:
    """Tests for SubtaskDefinition dataclass."""

    def test_creation(self):
        """SubtaskDefinition can be created."""
        definition = SubtaskDefinition(
            task_type="entity_research",
            entity_id="Company A",
            input_data={"query": "Research"},
            priority=5,
            estimated_duration_seconds=60,
            depends_on_indices=[0, 1],
        )
        assert definition.task_type == "entity_research"
        assert definition.entity_id == "Company A"
        assert definition.depends_on_indices == [0, 1]
