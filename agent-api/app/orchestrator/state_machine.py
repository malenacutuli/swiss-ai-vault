"""
State Machine for Run and Subtask Lifecycle Management

Implements:
- Valid state transition validation
- Fencing token acquisition/release
- Optimistic locking with state_version
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import uuid4

from supabase import Client

from app.orchestrator.types import (
    RunState,
    SubtaskState,
    RUN_TRANSITIONS,
    SUBTASK_TRANSITIONS,
    ResearchRun,
    Subtask,
    InvalidTransitionError,
    ConcurrencyError,
    FencingError,
)

logger = logging.getLogger(__name__)


class StateMachine:
    """
    Manages state transitions for runs and subtasks with concurrency safety.

    Uses:
    - Fencing tokens for exclusive processing
    - Optimistic locking with state_version
    - Database-level atomic operations
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase

    # =========================================================================
    # FENCING TOKEN MANAGEMENT
    # =========================================================================

    async def acquire_fencing_token(
        self,
        run_id: str,
        timeout_minutes: int = 5
    ) -> Tuple[bool, Optional[ResearchRun]]:
        """
        Acquire exclusive processing lock on a run.

        Args:
            run_id: Run to lock
            timeout_minutes: Lock timeout

        Returns:
            (success, run_data) tuple
        """
        fencing_token = str(uuid4())
        expires_at = datetime.utcnow() + timedelta(minutes=timeout_minutes)

        try:
            result = self.supabase.rpc(
                "acquire_run_fencing_token",
                {
                    "p_run_id": run_id,
                    "p_fencing_token": fencing_token,
                    "p_expires_at": expires_at.isoformat(),
                }
            ).execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                acquired = row.get("acquired", False)
                run_data = row.get("run_data")

                if acquired and run_data:
                    run_data["fencing_token"] = fencing_token
                    return True, ResearchRun.from_db_row(run_data)

                logger.warning(f"Failed to acquire fencing token for run {run_id}")
                return False, None

            return False, None

        except Exception as e:
            logger.error(f"Error acquiring fencing token: {e}")
            return False, None

    async def release_fencing_token(
        self,
        run_id: str,
        fencing_token: str
    ) -> bool:
        """
        Release exclusive processing lock.

        Args:
            run_id: Run to unlock
            fencing_token: Token to release

        Returns:
            True if released successfully
        """
        try:
            result = self.supabase.rpc(
                "release_run_fencing_token",
                {
                    "p_run_id": run_id,
                    "p_fencing_token": fencing_token,
                }
            ).execute()

            return result.data is True

        except Exception as e:
            logger.error(f"Error releasing fencing token: {e}")
            return False

    # =========================================================================
    # RUN STATE TRANSITIONS
    # =========================================================================

    def validate_run_transition(
        self,
        from_state: RunState,
        to_state: RunState
    ) -> bool:
        """Check if run state transition is valid."""
        allowed = RUN_TRANSITIONS.get(from_state, set())
        return to_state in allowed

    async def transition_run_state(
        self,
        run_id: str,
        from_state: RunState,
        to_state: RunState,
        state_version: int,
        transitioned_by: str = "orchestrator",
        reason: Optional[str] = None
    ) -> bool:
        """
        Transition run to new state with optimistic locking.

        Args:
            run_id: Run ID
            from_state: Expected current state
            to_state: Target state
            state_version: Expected state version
            transitioned_by: Who initiated (for audit)
            reason: Transition reason

        Returns:
            True if transition succeeded

        Raises:
            InvalidTransitionError: If transition is not allowed
            ConcurrencyError: If state_version mismatch
        """
        # Validate transition
        if not self.validate_run_transition(from_state, to_state):
            raise InvalidTransitionError(
                f"Cannot transition from {from_state.value} to {to_state.value}"
            )

        try:
            result = self.supabase.rpc(
                "transition_run_state",
                {
                    "p_run_id": run_id,
                    "p_from_state": from_state.value,
                    "p_to_state": to_state.value,
                    "p_state_version": state_version,
                    "p_transitioned_by": transitioned_by,
                    "p_reason": reason,
                }
            ).execute()

            success = result.data is True

            if success:
                logger.info(
                    f"Run {run_id} transitioned: {from_state.value} -> {to_state.value}"
                )
            else:
                logger.warning(
                    f"Run {run_id} transition failed: {from_state.value} -> {to_state.value} "
                    f"(version mismatch or state changed)"
                )

            return success

        except Exception as e:
            logger.error(f"Error transitioning run state: {e}")
            raise ConcurrencyError(f"State transition failed: {e}")

    # =========================================================================
    # SUBTASK STATE TRANSITIONS
    # =========================================================================

    def validate_subtask_transition(
        self,
        from_state: SubtaskState,
        to_state: SubtaskState
    ) -> bool:
        """Check if subtask state transition is valid."""
        allowed = SUBTASK_TRANSITIONS.get(from_state, set())
        return to_state in allowed

    async def transition_subtask_state(
        self,
        subtask_id: str,
        from_state: SubtaskState,
        to_state: SubtaskState,
        state_version: int,
        transitioned_by: str = "worker",
        reason: Optional[str] = None,
        result_data: Optional[dict] = None,
        error: Optional[str] = None
    ) -> bool:
        """
        Transition subtask to new state with optimistic locking.

        Args:
            subtask_id: Subtask ID
            from_state: Expected current state
            to_state: Target state
            state_version: Expected state version
            transitioned_by: Who initiated
            reason: Transition reason
            result_data: Result data (for completed)
            error: Error message (for failed)

        Returns:
            True if transition succeeded
        """
        # Validate transition
        if not self.validate_subtask_transition(from_state, to_state):
            raise InvalidTransitionError(
                f"Cannot transition subtask from {from_state.value} to {to_state.value}"
            )

        try:
            result = self.supabase.rpc(
                "transition_subtask_state",
                {
                    "p_subtask_id": subtask_id,
                    "p_from_state": from_state.value,
                    "p_to_state": to_state.value,
                    "p_state_version": state_version,
                    "p_transitioned_by": transitioned_by,
                    "p_reason": reason,
                    "p_result_data": result_data,
                    "p_error": error,
                }
            ).execute()

            success = result.data is True

            if success:
                logger.info(
                    f"Subtask {subtask_id} transitioned: {from_state.value} -> {to_state.value}"
                )

            return success

        except Exception as e:
            logger.error(f"Error transitioning subtask state: {e}")
            return False

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    async def get_run(self, run_id: str) -> Optional[ResearchRun]:
        """Get run by ID."""
        try:
            result = self.supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()
            if result.data:
                return ResearchRun.from_db_row(result.data)
            return None
        except Exception as e:
            logger.error(f"Error getting run: {e}")
            return None

    async def get_subtask(self, subtask_id: str) -> Optional[Subtask]:
        """Get subtask by ID."""
        try:
            result = self.supabase.table("subtasks").select("*").eq("id", subtask_id).single().execute()
            if result.data:
                return Subtask.from_db_row(result.data)
            return None
        except Exception as e:
            logger.error(f"Error getting subtask: {e}")
            return None

    async def get_subtasks_by_run(
        self,
        run_id: str,
        states: Optional[list[SubtaskState]] = None
    ) -> list[Subtask]:
        """Get subtasks for a run, optionally filtered by state."""
        try:
            query = self.supabase.table("subtasks").select("*").eq("run_id", run_id)

            if states:
                state_values = [s.value for s in states]
                query = query.in_("state", state_values)

            result = query.order("subtask_index").execute()

            return [Subtask.from_db_row(row) for row in (result.data or [])]

        except Exception as e:
            logger.error(f"Error getting subtasks: {e}")
            return []

    async def get_subtask_counts_by_state(self, run_id: str) -> dict[str, int]:
        """Get subtask counts grouped by state."""
        try:
            result = self.supabase.rpc(
                "get_subtask_counts_by_state",
                {"p_run_id": run_id}
            ).execute()

            counts = {}
            for row in (result.data or []):
                counts[row["state"]] = row["count"]

            return counts

        except Exception as e:
            logger.error(f"Error getting subtask counts: {e}")
            return {}

    async def check_subtask_ready(self, subtask_id: str) -> bool:
        """Check if subtask dependencies are met."""
        try:
            result = self.supabase.rpc(
                "check_subtask_ready",
                {"p_subtask_id": subtask_id}
            ).execute()

            return result.data is True

        except Exception as e:
            logger.error(f"Error checking subtask ready: {e}")
            return False

    async def get_stalled_runs(self, threshold_minutes: int = 10) -> list[ResearchRun]:
        """Get runs that haven't progressed recently."""
        try:
            result = self.supabase.rpc(
                "get_stalled_runs",
                {"p_threshold_minutes": threshold_minutes}
            ).execute()

            return [ResearchRun.from_db_row(row) for row in (result.data or [])]

        except Exception as e:
            logger.error(f"Error getting stalled runs: {e}")
            return []
