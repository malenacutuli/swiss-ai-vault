"""Scheduled Task System"""

import logging
import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum
import croniter

logger = logging.getLogger(__name__)

class ScheduleStatus(str, Enum):
    """Schedule status"""
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"

class ScheduledTask:
    """Represents a scheduled task"""

    def __init__(
        self,
        task_id: str,
        name: str,
        cron_expression: str,
        task_config: Dict[str, Any]
    ):
        """Initialize scheduled task"""
        self.task_id = task_id
        self.name = name
        self.cron_expression = cron_expression
        self.task_config = task_config
        self.status = ScheduleStatus.ACTIVE
        self.created_at = datetime.utcnow()
        self.last_executed: Optional[datetime] = None
        self.next_execution: Optional[datetime] = None
        self.execution_count = 0

    def get_next_execution(self) -> datetime:
        """Get next execution time"""
        cron = croniter.croniter(self.cron_expression)
        return datetime.fromtimestamp(cron.get_next(float))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "task_id": self.task_id,
            "name": self.name,
            "cron_expression": self.cron_expression,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "last_executed": self.last_executed.isoformat() if self.last_executed else None,
            "next_execution": self.next_execution.isoformat() if self.next_execution else None,
            "execution_count": self.execution_count
        }

class TaskScheduler:
    """Manage scheduled tasks"""

    def __init__(self, executor: Callable):
        """
        Initialize scheduler.

        Args:
            executor: Async function to execute tasks
        """
        self.tasks: Dict[str, ScheduledTask] = {}
        self.executor = executor
        self.running = False

    def create_task(
        self,
        task_id: str,
        name: str,
        cron_expression: str,
        task_config: Dict[str, Any]
    ) -> ScheduledTask:
        """Create scheduled task"""
        task = ScheduledTask(
            task_id=task_id,
            name=name,
            cron_expression=cron_expression,
            task_config=task_config
        )

        task.next_execution = task.get_next_execution()
        self.tasks[task_id] = task

        logger.info(f"Created scheduled task: {task_id}")
        return task

    def get_task(self, task_id: str) -> Optional[ScheduledTask]:
        """Get scheduled task"""
        return self.tasks.get(task_id)

    async def start(self) -> None:
        """Start scheduler"""
        self.running = True
        logger.info("Task scheduler started")

        while self.running:
            await self._check_and_execute()
            await asyncio.sleep(60)  # Check every minute

    async def _check_and_execute(self) -> None:
        """Check and execute due tasks"""
        now = datetime.utcnow()

        for task in self.tasks.values():
            if task.status != ScheduleStatus.ACTIVE:
                continue

            if task.next_execution and now >= task.next_execution:
                await self._execute_task(task)

    async def _execute_task(self, task: ScheduledTask) -> None:
        """Execute task"""
        try:
            logger.info(f"Executing scheduled task: {task.task_id}")

            await self.executor(task.task_config)

            task.last_executed = datetime.utcnow()
            task.execution_count += 1
            task.next_execution = task.get_next_execution()

            logger.info(f"Task executed: {task.task_id}")

        except Exception as e:
            logger.error(f"Task execution failed: {e}")

    def pause_task(self, task_id: str) -> bool:
        """Pause task"""
        task = self.get_task(task_id)
        if task:
            task.status = ScheduleStatus.PAUSED
            return True
        return False

    def resume_task(self, task_id: str) -> bool:
        """Resume task"""
        task = self.get_task(task_id)
        if task:
            task.status = ScheduleStatus.ACTIVE
            return True
        return False

    def list_tasks(self) -> list:
        """List all tasks"""
        return [t.to_dict() for t in self.tasks.values()]
