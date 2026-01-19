"""
Orchestrator Core Implementation

The Orchestrator is the central coordinator for research runs. It manages:
- Run lifecycle and state transitions
- Query decomposition into subtasks
- Subtask scheduling and prioritization
- Progress tracking and aggregation
- Failure handling and recovery coordination
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncIterator, Optional, List
from uuid import uuid4

from supabase import Client
from anthropic import Anthropic

from app.orchestrator.types import (
    RunState,
    SubtaskState,
    ResearchRun,
    RunConfig,
    Subtask,
    SubtaskDefinition,
    DecompositionResult,
    SchedulingDecision,
    RunProgress,
    OrchestratorConfig,
    ValidationError,
    QuotaExceededError,
    DecompositionError,
    ConcurrencyError,
)
from app.orchestrator.state_machine import StateMachine
from app.orchestrator.decomposer import TaskDecomposer
from app.orchestrator.scheduler import SubtaskScheduler
from app.worker.job_queue import JobQueue

logger = logging.getLogger(__name__)


class Orchestrator:
    """
    Central coordinator for research runs.

    The Orchestrator is responsible for:
    1. Accepting research queries and creating runs
    2. Decomposing queries into parallel subtasks
    3. Scheduling subtasks across worker pools
    4. Tracking progress and handling failures
    5. Aggregating results and producing final output

    Thread Safety:
    - All state mutations go through the database with fencing tokens
    - Multiple orchestrator instances can run concurrently
    - Work is distributed via job queues with deduplication
    """

    def __init__(
        self,
        supabase: Client,
        anthropic: Anthropic,
        config: Optional[OrchestratorConfig] = None
    ):
        self.supabase = supabase
        self.anthropic = anthropic
        self.config = config or OrchestratorConfig()

        # Initialize components
        self.state_machine = StateMachine(supabase)
        self.decomposer = TaskDecomposer(anthropic)
        self.scheduler = SubtaskScheduler()
        self.job_queue = JobQueue()

        # Internal state
        self._running = False
        self._background_tasks: List[asyncio.Task] = []

    # =========================================================================
    # LIFECYCLE MANAGEMENT
    # =========================================================================

    async def start(self) -> None:
        """Start the orchestrator and background tasks."""
        self._running = True

        # Start background monitors
        self._background_tasks = [
            asyncio.create_task(self._progress_monitor_loop()),
            asyncio.create_task(self._deadline_monitor_loop()),
            asyncio.create_task(self._stalled_run_detector_loop()),
        ]

        logger.info("Orchestrator started with background monitors")

    async def stop(self) -> None:
        """Stop the orchestrator gracefully."""
        self._running = False

        # Cancel background tasks
        for task in self._background_tasks:
            task.cancel()

        await asyncio.gather(*self._background_tasks, return_exceptions=True)
        logger.info("Orchestrator stopped")

    # =========================================================================
    # RUN CREATION
    # =========================================================================

    async def create_run(
        self,
        tenant_id: str,
        user_id: str,
        query: str,
        config: Optional[RunConfig] = None
    ) -> ResearchRun:
        """
        Create a new research run.

        This is the entry point for all orchestrated research operations.

        Args:
            tenant_id: Tenant identifier for isolation
            user_id: User who initiated the run
            query: Natural language research query
            config: Optional configuration overrides

        Returns:
            The created ResearchRun object
        """
        config = config or RunConfig()

        # Step 1: Validate inputs
        await self._validate_run_request(tenant_id, user_id, query, config)

        # Step 2: Create run record
        run_id = str(uuid4())
        now = datetime.utcnow()

        run_data = {
            "id": run_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "prompt": query,
            "status": RunState.CREATED.value,
            "state_version": 1,
            "orchestrator_mode": "orchestrator",
            "decomposition_strategy": config.decomposition_strategy,
            "total_subtasks": 0,
            "completed_subtasks": 0,
            "failed_subtasks": 0,
            "deadline_at": (now + timedelta(minutes=config.timeout_minutes)).isoformat(),
            "created_at": now.isoformat(),
        }

        result = self.supabase.table("agent_runs").insert(run_data).execute()

        if not result.data:
            raise ValidationError("Failed to create run record")

        run = ResearchRun.from_db_row(result.data[0])

        # Step 3: Enqueue for async processing
        self.job_queue.enqueue(run_id, priority=config.priority)

        logger.info(f"Created orchestrator run {run_id} for user {user_id}")

        return run

    async def _validate_run_request(
        self,
        tenant_id: str,
        user_id: str,
        query: str,
        config: RunConfig
    ) -> None:
        """Validate a run creation request."""
        # Check query length
        if len(query) < 10:
            raise ValidationError("Query too short")
        if len(query) > 10000:
            raise ValidationError("Query too long")

        # Check user credits
        result = self.supabase.table("credit_balances").select("balance").eq("user_id", user_id).single().execute()
        if result.data:
            balance = result.data.get("balance", 0)
            if balance <= 0:
                raise QuotaExceededError("Insufficient credits")

        # Check concurrent runs
        result = self.supabase.table("agent_runs").select("id", count="exact").eq("user_id", user_id).in_("status", ["created", "validating", "decomposing", "scheduling", "executing", "aggregating", "finalizing"]).execute()
        active_count = result.count or 0

        if active_count >= 5:  # Max 5 concurrent runs
            raise QuotaExceededError("Maximum concurrent runs exceeded")

    # =========================================================================
    # RUN PROCESSING (Main State Machine)
    # =========================================================================

    async def process_run(self, run_id: str) -> None:
        """
        Process a run through its lifecycle.

        This is the main state machine driver. It:
        1. Acquires a lock on the run
        2. Determines the current state
        3. Executes the appropriate phase
        4. Transitions to the next state
        5. Releases the lock

        The method is idempotent - calling it multiple times is safe.
        """
        async with self._acquire_run_lock(run_id) as run:
            if run is None:
                logger.warning(f"Could not acquire lock for run {run_id}")
                return

            if run.is_terminal:
                logger.info(f"Run {run_id} is already terminal ({run.state.value})")
                return

            try:
                # Execute current phase
                next_state = await self._execute_phase(run)

                # Transition if needed
                if next_state and next_state != run.state:
                    success = await self.state_machine.transition_run_state(
                        run_id,
                        run.state,
                        next_state,
                        run.state_version,
                    )

                    if success and next_state != RunState.EXECUTING:
                        # Re-enqueue for next phase (except EXECUTING which is event-driven)
                        self.job_queue.enqueue(run_id, priority=0)

            except Exception as e:
                await self._handle_run_error(run, e)

    async def _execute_phase(self, run: ResearchRun) -> Optional[RunState]:
        """Execute the current phase and return the next state."""

        if run.state == RunState.CREATED:
            return await self._phase_validate(run)

        elif run.state == RunState.VALIDATING:
            return await self._phase_decompose(run)

        elif run.state == RunState.DECOMPOSING:
            return await self._phase_schedule(run)

        elif run.state == RunState.SCHEDULING:
            return await self._phase_start_execution(run)

        elif run.state == RunState.EXECUTING:
            return await self._phase_monitor_execution(run)

        elif run.state == RunState.AGGREGATING:
            return await self._phase_aggregate(run)

        elif run.state == RunState.FINALIZING:
            return await self._phase_finalize(run)

        return None

    @asynccontextmanager
    async def _acquire_run_lock(
        self,
        run_id: str,
    ) -> AsyncIterator[Optional[ResearchRun]]:
        """Acquire an exclusive lock on a run."""
        acquired, run = await self.state_machine.acquire_fencing_token(
            run_id,
            self.config.fencing_timeout_minutes
        )

        if not acquired:
            yield None
            return

        try:
            yield run
        finally:
            if run and run.fencing_token:
                await self.state_machine.release_fencing_token(run_id, run.fencing_token)

    # =========================================================================
    # PHASE: VALIDATION
    # =========================================================================

    async def _phase_validate(self, run: ResearchRun) -> RunState:
        """Validate the run before decomposition."""
        validation = await self.decomposer.validate_query(run.query)

        if not validation.get("is_valid", True):
            raise ValidationError(validation.get("error_message", "Query validation failed"))

        return RunState.VALIDATING

    # =========================================================================
    # PHASE: DECOMPOSITION
    # =========================================================================

    async def _phase_decompose(self, run: ResearchRun) -> RunState:
        """Decompose the query into subtasks."""
        decomposition = await self.decomposer.decompose(
            query=run.query,
            config=run.config
        )

        if len(decomposition.subtasks) == 0:
            raise DecompositionError("No subtasks generated")

        # Create subtasks in database
        await self._create_subtasks(run, decomposition)

        # Update run with subtask count
        self.supabase.table("agent_runs").update({
            "total_subtasks": len(decomposition.subtasks),
            "state_version": run.state_version + 1,
            "last_progress_at": datetime.utcnow().isoformat(),
        }).eq("id", run.id).execute()

        logger.info(f"Decomposed run {run.id} into {len(decomposition.subtasks)} subtasks")

        return RunState.DECOMPOSING

    async def _create_subtasks(
        self,
        run: ResearchRun,
        decomposition: DecompositionResult
    ) -> List[Subtask]:
        """Create subtask records in database."""
        subtasks = []
        id_map = {}  # index -> subtask_id

        for index, definition in enumerate(decomposition.subtasks):
            subtask_id = str(uuid4())
            id_map[index] = subtask_id

            # Resolve dependencies (convert indices to UUIDs)
            depends_on = [
                id_map[dep_idx]
                for dep_idx in definition.depends_on_indices
                if dep_idx in id_map
            ]

            subtask_data = {
                "id": subtask_id,
                "run_id": run.id,
                "subtask_index": index,
                "idempotency_key": f"{run.id}:{index}",
                "task_type": definition.task_type,
                "entity_id": definition.entity_id,
                "input_data": definition.input_data,
                "state": SubtaskState.PENDING.value,
                "state_version": 1,
                "attempt_count": 0,
                "max_attempts": run.config.max_retries,
                "depends_on": depends_on,
                "created_at": datetime.utcnow().isoformat(),
            }

            result = self.supabase.table("subtasks").insert(subtask_data).execute()

            if result.data:
                subtasks.append(Subtask.from_db_row(result.data[0]))

        return subtasks

    # =========================================================================
    # PHASE: SCHEDULING
    # =========================================================================

    async def _phase_schedule(self, run: ResearchRun) -> RunState:
        """Schedule subtasks for execution."""
        # Get all pending subtasks
        subtasks = await self.state_machine.get_subtasks_by_run(
            run_id=run.id,
            states=[SubtaskState.PENDING]
        )

        # Filter to ready subtasks (dependencies met)
        completed_ids = await self._get_completed_subtask_ids(run.id)
        ready_subtasks = [
            s for s in subtasks
            if all(dep in completed_ids for dep in s.depends_on)
        ]

        # Schedule each ready subtask
        for subtask in ready_subtasks:
            decision = await self.scheduler.schedule(subtask, run)
            await self._enqueue_subtask(subtask, decision)

        return RunState.SCHEDULING

    async def _enqueue_subtask(
        self,
        subtask: Subtask,
        decision: SchedulingDecision
    ) -> None:
        """Enqueue a subtask for execution."""
        # Update state to QUEUED
        await self.state_machine.transition_subtask_state(
            subtask.id,
            subtask.state,
            SubtaskState.QUEUED,
            subtask.state_version,
        )

        # Enqueue to job queue
        # Note: This integrates with the existing job queue
        job_data = {
            "type": "subtask",
            "subtask_id": subtask.id,
            "run_id": subtask.run_id,
            "task_type": subtask.task_type,
            "input_data": subtask.input_data,
        }

        self.job_queue.enqueue(
            run_id=subtask.run_id,
            priority=decision.priority,
        )

        logger.info(f"Enqueued subtask {subtask.id} to {decision.queue_name}")

    # =========================================================================
    # PHASE: EXECUTION
    # =========================================================================

    async def _phase_start_execution(self, run: ResearchRun) -> RunState:
        """Start the execution phase."""
        self.supabase.table("agent_runs").update({
            "started_at": datetime.utcnow().isoformat(),
            "state_version": run.state_version + 1,
            "last_progress_at": datetime.utcnow().isoformat(),
        }).eq("id", run.id).execute()

        return RunState.EXECUTING

    async def _phase_monitor_execution(self, run: ResearchRun) -> Optional[RunState]:
        """Monitor execution progress."""
        progress = await self._calculate_progress(run.id)

        # Check if all subtasks are done
        if progress.is_complete:
            return RunState.AGGREGATING

        # Check for deadline
        if run.deadline_at and datetime.utcnow() > run.deadline_at:
            await self._cancel_pending_subtasks(run.id)
            return RunState.AGGREGATING

        # Schedule newly ready subtasks
        await self._schedule_ready_subtasks(run)

        # Stay in EXECUTING state
        return None

    async def _calculate_progress(self, run_id: str) -> RunProgress:
        """Calculate current run progress."""
        counts = await self.state_machine.get_subtask_counts_by_state(run_id)

        total = sum(counts.values())
        completed = counts.get("completed", 0)
        failed = counts.get("failed", 0)
        skipped = counts.get("skipped", 0)
        cancelled = counts.get("cancelled", 0)

        terminal = completed + failed + skipped + cancelled

        return RunProgress(
            total=total,
            completed=completed,
            failed=failed,
            skipped=skipped,
            cancelled=cancelled,
            in_progress=total - terminal,
            is_complete=(terminal == total and total > 0)
        )

    async def _schedule_ready_subtasks(self, run: ResearchRun) -> None:
        """Schedule any newly ready subtasks."""
        pending = await self.state_machine.get_subtasks_by_run(
            run_id=run.id,
            states=[SubtaskState.PENDING]
        )

        if not pending:
            return

        completed_ids = await self._get_completed_subtask_ids(run.id)

        for subtask in pending:
            if all(dep in completed_ids for dep in subtask.depends_on):
                decision = await self.scheduler.schedule(subtask, run)
                await self._enqueue_subtask(subtask, decision)

    # =========================================================================
    # PHASE: AGGREGATION
    # =========================================================================

    async def _phase_aggregate(self, run: ResearchRun) -> RunState:
        """Aggregate subtask results."""
        # Get completed subtask results
        subtasks = await self.state_machine.get_subtasks_by_run(
            run_id=run.id,
            states=[SubtaskState.COMPLETED]
        )

        results = [s.result_data for s in subtasks if s.result_data]

        # Simple aggregation - combine all results
        aggregation = {
            "subtask_count": len(subtasks),
            "results": results,
            "completed_at": datetime.utcnow().isoformat(),
        }

        # Store aggregation
        self.supabase.table("agent_runs").update({
            "result_summary": aggregation,
            "state_version": run.state_version + 1,
            "last_progress_at": datetime.utcnow().isoformat(),
        }).eq("id", run.id).execute()

        return RunState.AGGREGATING

    # =========================================================================
    # PHASE: FINALIZATION
    # =========================================================================

    async def _phase_finalize(self, run: ResearchRun) -> RunState:
        """Finalize the run."""
        self.supabase.table("agent_runs").update({
            "completed_at": datetime.utcnow().isoformat(),
            "state_version": run.state_version + 1,
        }).eq("id", run.id).execute()

        logger.info(f"Run {run.id} completed successfully")

        return RunState.COMPLETED

    # =========================================================================
    # ERROR HANDLING
    # =========================================================================

    async def _handle_run_error(
        self,
        run: ResearchRun,
        error: Exception
    ) -> None:
        """Handle an error during run processing."""
        error_message = str(error)
        logger.error(f"Run {run.id} error: {error_message}")

        if isinstance(error, (ValidationError, DecompositionError)):
            # Not recoverable - fail the run
            await self._fail_run(run, error_message)

        elif isinstance(error, ConcurrencyError):
            # Retry later
            self.job_queue.enqueue(run.id, priority=0)

        else:
            # Unknown error - fail the run
            await self._fail_run(run, f"Unexpected error: {error_message}")

    async def _fail_run(self, run: ResearchRun, reason: str) -> None:
        """Mark a run as failed."""
        self.supabase.table("agent_runs").update({
            "status": RunState.FAILED.value,
            "completed_at": datetime.utcnow().isoformat(),
            "result_summary": {"error": reason},
            "state_version": run.state_version + 1,
        }).eq("id", run.id).execute()

        logger.error(f"Run {run.id} failed: {reason}")

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    async def _get_completed_subtask_ids(self, run_id: str) -> set[str]:
        """Get IDs of completed subtasks for a run."""
        subtasks = await self.state_machine.get_subtasks_by_run(
            run_id=run_id,
            states=[SubtaskState.COMPLETED]
        )
        return {s.id for s in subtasks}

    async def _cancel_pending_subtasks(self, run_id: str) -> None:
        """Cancel all pending subtasks for a run."""
        self.supabase.table("subtasks").update({
            "state": SubtaskState.CANCELLED.value,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("run_id", run_id).in_("state", ["pending", "queued"]).execute()

    # =========================================================================
    # BACKGROUND MONITORS
    # =========================================================================

    async def _progress_monitor_loop(self) -> None:
        """Background loop to emit progress updates."""
        while self._running:
            try:
                await asyncio.sleep(self.config.progress_update_interval)
                # Progress updates happen via database triggers
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Progress monitor error: {e}")

    async def _deadline_monitor_loop(self) -> None:
        """Background loop to check for deadline violations."""
        while self._running:
            try:
                await asyncio.sleep(self.config.deadline_check_interval)
                await self._check_deadlines()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Deadline monitor error: {e}")

    async def _stalled_run_detector_loop(self) -> None:
        """Background loop to detect stalled runs."""
        while self._running:
            try:
                await asyncio.sleep(self.config.stall_detection_interval)
                await self._detect_stalled_runs()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Stall detector error: {e}")

    async def _check_deadlines(self) -> None:
        """Check for runs past deadline."""
        now = datetime.utcnow()

        result = self.supabase.table("agent_runs").select("*").eq("orchestrator_mode", "orchestrator").lt("deadline_at", now.isoformat()).not_.in_("status", ["completed", "failed", "cancelled"]).execute()

        for row in (result.data or []):
            run = ResearchRun.from_db_row(row)
            logger.warning(f"Run {run.id} past deadline, triggering aggregation")
            self.job_queue.enqueue(run.id, priority=10)  # High priority

    async def _detect_stalled_runs(self) -> None:
        """Detect and recover stalled runs."""
        stalled = await self.state_machine.get_stalled_runs(
            self.config.stall_threshold_minutes
        )

        for run in stalled:
            logger.warning(f"Run {run.id} appears stalled, re-triggering")
            self.job_queue.enqueue(run.id, priority=5)
