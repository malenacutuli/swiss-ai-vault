"""Tests for orchestrator state machine."""

import pytest
from unittest.mock import Mock, AsyncMock, MagicMock

from app.orchestrator.types import (
    RunState,
    SubtaskState,
    InvalidTransitionError,
)
from app.orchestrator.state_machine import StateMachine


class TestStateMachineValidation:
    """Tests for state transition validation."""

    @pytest.fixture
    def state_machine(self):
        """Create state machine with mock Supabase."""
        mock_supabase = Mock()
        return StateMachine(mock_supabase)

    def test_validate_valid_run_transition(self, state_machine):
        """Valid run transitions return True."""
        assert state_machine.validate_run_transition(
            RunState.CREATED, RunState.VALIDATING
        ) is True

    def test_validate_invalid_run_transition(self, state_machine):
        """Invalid run transitions return False."""
        assert state_machine.validate_run_transition(
            RunState.CREATED, RunState.EXECUTING
        ) is False

    def test_validate_terminal_state_transition(self, state_machine):
        """Transitions from terminal states return False."""
        assert state_machine.validate_run_transition(
            RunState.COMPLETED, RunState.EXECUTING
        ) is False

    def test_validate_valid_subtask_transition(self, state_machine):
        """Valid subtask transitions return True."""
        assert state_machine.validate_subtask_transition(
            SubtaskState.PENDING, SubtaskState.QUEUED
        ) is True

    def test_validate_invalid_subtask_transition(self, state_machine):
        """Invalid subtask transitions return False."""
        assert state_machine.validate_subtask_transition(
            SubtaskState.PENDING, SubtaskState.COMPLETED
        ) is False

    def test_validate_retry_transition(self, state_machine):
        """FAILED can transition to PENDING for retry."""
        assert state_machine.validate_subtask_transition(
            SubtaskState.FAILED, SubtaskState.PENDING
        ) is True


class TestStateMachineRunTransitions:
    """Tests for run state transition execution."""

    @pytest.fixture
    def state_machine(self):
        """Create state machine with mock Supabase."""
        mock_supabase = Mock()
        mock_supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=True))
        ))
        return StateMachine(mock_supabase)

    @pytest.mark.asyncio
    async def test_transition_run_state_success(self, state_machine):
        """Successful run state transition."""
        result = await state_machine.transition_run_state(
            run_id="run-123",
            from_state=RunState.CREATED,
            to_state=RunState.VALIDATING,
            state_version=1,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_transition_run_state_invalid(self, state_machine):
        """Invalid run state transition raises exception."""
        with pytest.raises(InvalidTransitionError):
            await state_machine.transition_run_state(
                run_id="run-123",
                from_state=RunState.CREATED,
                to_state=RunState.COMPLETED,
                state_version=1,
            )

    @pytest.mark.asyncio
    async def test_transition_run_state_calls_rpc(self, state_machine):
        """Transition calls the correct RPC function."""
        await state_machine.transition_run_state(
            run_id="run-123",
            from_state=RunState.CREATED,
            to_state=RunState.VALIDATING,
            state_version=1,
            transitioned_by="test",
            reason="test reason",
        )

        state_machine.supabase.rpc.assert_called_once_with(
            "transition_run_state",
            {
                "p_run_id": "run-123",
                "p_from_state": "created",
                "p_to_state": "validating",
                "p_state_version": 1,
                "p_transitioned_by": "test",
                "p_reason": "test reason",
            }
        )


class TestStateMachineFencingToken:
    """Tests for fencing token management."""

    @pytest.fixture
    def state_machine(self):
        """Create state machine with mock Supabase."""
        mock_supabase = Mock()
        return StateMachine(mock_supabase)

    @pytest.mark.asyncio
    async def test_acquire_fencing_token_success(self, state_machine):
        """Successfully acquire fencing token."""
        state_machine.supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[{
                "acquired": True,
                "run_data": {
                    "id": "run-123",
                    "user_id": "user-1",
                    "status": "created",
                    "state_version": 1,
                }
            }]))
        ))

        acquired, run = await state_machine.acquire_fencing_token("run-123")

        assert acquired is True
        assert run is not None
        assert run.id == "run-123"

    @pytest.mark.asyncio
    async def test_acquire_fencing_token_failure(self, state_machine):
        """Failed to acquire fencing token."""
        state_machine.supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[{
                "acquired": False,
                "run_data": None,
            }]))
        ))

        acquired, run = await state_machine.acquire_fencing_token("run-123")

        assert acquired is False
        assert run is None

    @pytest.mark.asyncio
    async def test_release_fencing_token(self, state_machine):
        """Release fencing token."""
        state_machine.supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=True))
        ))

        result = await state_machine.release_fencing_token(
            "run-123",
            "token-456"
        )

        assert result is True


class TestStateMachineHelpers:
    """Tests for helper methods."""

    @pytest.fixture
    def state_machine(self):
        """Create state machine with mock Supabase."""
        mock_supabase = Mock()
        return StateMachine(mock_supabase)

    @pytest.mark.asyncio
    async def test_get_subtask_counts_by_state(self, state_machine):
        """Get subtask counts grouped by state."""
        state_machine.supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[
                {"state": "pending", "count": 5},
                {"state": "completed", "count": 3},
                {"state": "failed", "count": 2},
            ]))
        ))

        counts = await state_machine.get_subtask_counts_by_state("run-123")

        assert counts["pending"] == 5
        assert counts["completed"] == 3
        assert counts["failed"] == 2

    @pytest.mark.asyncio
    async def test_check_subtask_ready(self, state_machine):
        """Check if subtask is ready to execute."""
        state_machine.supabase.rpc = Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=True))
        ))

        result = await state_machine.check_subtask_ready("subtask-123")

        assert result is True
