"""
Subtask Scheduler for Fair Scheduling and Priority Management

Implements:
- Fair scheduling with tenant quotas
- Priority calculation (deadline, retry, dependencies)
- Queue mapping by task type
- Worker affinity for checkpointing
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from app.orchestrator.types import (
    Subtask,
    ResearchRun,
    SchedulingDecision,
)

logger = logging.getLogger(__name__)


# Queue mapping by task type
TASK_TYPE_QUEUES = {
    "entity_research": "workers.research",
    "dimension_analysis": "workers.research",
    "source_research": "workers.research",
    "research": "workers.research",
    "synthesis": "workers.synthesis",
    "web_search": "workers.search",
    "code_execution": "workers.code",
    "browser": "workers.browser",
    "default": "workers.subtask",
}


class SubtaskScheduler:
    """
    Schedules subtasks for execution with fair scheduling and priority.

    Features:
    - Queue mapping by task type
    - Priority calculation based on multiple factors
    - Delay calculation for retries (exponential backoff)
    - Worker affinity for checkpoint recovery
    """

    def __init__(
        self,
        default_priority: int = 5,
        max_priority: int = 10,
        base_retry_delay: int = 30,
        max_retry_delay: int = 300,
    ):
        self.default_priority = default_priority
        self.max_priority = max_priority
        self.base_retry_delay = base_retry_delay
        self.max_retry_delay = max_retry_delay

    async def schedule(
        self,
        subtask: Subtask,
        run: ResearchRun
    ) -> SchedulingDecision:
        """
        Create scheduling decision for a subtask.

        Args:
            subtask: The subtask to schedule
            run: The parent run

        Returns:
            SchedulingDecision with queue, priority, delay, affinity
        """
        # Determine queue
        queue_name = self._get_queue_name(subtask.task_type)

        # Calculate priority
        priority = self._calculate_priority(subtask, run)

        # Calculate delay (for retries)
        delay_seconds = self._calculate_delay(subtask)

        # Determine worker affinity (for checkpoint recovery)
        worker_affinity = self._get_worker_affinity(subtask)

        decision = SchedulingDecision(
            subtask_id=subtask.id,
            queue_name=queue_name,
            priority=priority,
            delay_seconds=delay_seconds,
            worker_affinity=worker_affinity,
        )

        logger.info(
            f"Scheduled subtask {subtask.id}: queue={queue_name}, "
            f"priority={priority}, delay={delay_seconds}s"
        )

        return decision

    def _get_queue_name(self, task_type: str) -> str:
        """Get queue name for task type."""
        return TASK_TYPE_QUEUES.get(task_type, TASK_TYPE_QUEUES["default"])

    def _calculate_priority(
        self,
        subtask: Subtask,
        run: ResearchRun
    ) -> int:
        """
        Calculate scheduling priority.

        Factors:
        1. Base priority from run config
        2. Deadline proximity (higher priority as deadline approaches)
        3. Retry status (slightly lower priority for retries)
        4. Synthesis tasks get higher priority (to complete run faster)
        """
        priority = self.default_priority

        # Factor 1: Run priority
        if hasattr(run.config, 'priority'):
            priority = run.config.priority

        # Factor 2: Deadline proximity
        if run.deadline_at:
            now = datetime.utcnow()
            if run.deadline_at > now:
                time_remaining = (run.deadline_at - now).total_seconds()
                # Increase priority as deadline approaches (within 10 minutes)
                if time_remaining < 600:  # 10 minutes
                    priority = min(priority + 3, self.max_priority)
                elif time_remaining < 1800:  # 30 minutes
                    priority = min(priority + 1, self.max_priority)

        # Factor 3: Retry penalty (slightly lower priority)
        if subtask.attempt_count > 0:
            priority = max(1, priority - 1)

        # Factor 4: Synthesis boost
        if subtask.task_type == "synthesis":
            priority = min(priority + 2, self.max_priority)

        return priority

    def _calculate_delay(self, subtask: Subtask) -> int:
        """
        Calculate scheduling delay for retries.

        Uses exponential backoff: base * 2^attempt_count
        Capped at max_retry_delay.
        """
        if subtask.attempt_count == 0:
            return 0

        delay = self.base_retry_delay * (2 ** (subtask.attempt_count - 1))
        return min(delay, self.max_retry_delay)

    def _get_worker_affinity(self, subtask: Subtask) -> Optional[str]:
        """
        Get worker affinity for checkpoint recovery.

        If subtask has a checkpoint, prefer the same worker that created it.
        """
        if subtask.checkpoint_id and subtask.assigned_worker_id:
            return subtask.assigned_worker_id
        return None

    async def schedule_batch(
        self,
        subtasks: list[Subtask],
        run: ResearchRun
    ) -> list[SchedulingDecision]:
        """Schedule multiple subtasks."""
        decisions = []
        for subtask in subtasks:
            decision = await self.schedule(subtask, run)
            decisions.append(decision)
        return decisions

    async def calculate_queue_load(
        self,
        queue_name: str
    ) -> dict:
        """
        Calculate current load on a queue.

        Returns metrics for fair scheduling decisions.
        """
        # This would integrate with Redis to get actual queue depth
        # For now, return placeholder
        return {
            "queue_name": queue_name,
            "depth": 0,
            "processing": 0,
            "estimated_wait_seconds": 0,
        }
