"""Wide Research Job Manager"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class JobStatus(str, Enum):
    """Job status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WideResearchJob:
    """Represents a wide research job"""

    def __init__(
        self,
        job_id: str,
        topic: str,
        num_agents: int = 5,
        max_depth: int = 3
    ):
        """Initialize research job"""
        self.job_id = job_id
        self.topic = topic
        self.num_agents = num_agents
        self.max_depth = max_depth
        self.status = JobStatus.PENDING
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None

        self.subtasks: List[Dict[str, Any]] = []
        self.results: List[Dict[str, Any]] = []
        self.progress = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "job_id": self.job_id,
            "topic": self.topic,
            "status": self.status.value,
            "num_agents": self.num_agents,
            "max_depth": self.max_depth,
            "progress": self.progress,
            "subtasks_count": len(self.subtasks),
            "results_count": len(self.results),
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

class WideResearchJobManager:
    """Manage wide research jobs"""

    def __init__(self):
        """Initialize job manager"""
        self.jobs: Dict[str, WideResearchJob] = {}

    def create_job(
        self,
        topic: str,
        num_agents: int = 5,
        max_depth: int = 3
    ) -> WideResearchJob:
        """Create new research job"""
        job_id = str(uuid.uuid4())

        job = WideResearchJob(
            job_id=job_id,
            topic=topic,
            num_agents=num_agents,
            max_depth=max_depth
        )

        self.jobs[job_id] = job
        logger.info(f"Created research job: {job_id}")
        return job

    def get_job(self, job_id: str) -> Optional[WideResearchJob]:
        """Get research job"""
        return self.jobs.get(job_id)

    def start_job(self, job_id: str) -> bool:
        """Start research job"""
        job = self.get_job(job_id)

        if not job:
            logger.error(f"Job not found: {job_id}")
            return False

        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()

        logger.info(f"Started research job: {job_id}")
        return True

    def complete_job(self, job_id: str) -> bool:
        """Complete research job"""
        job = self.get_job(job_id)

        if not job:
            logger.error(f"Job not found: {job_id}")
            return False

        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        job.progress = 100

        logger.info(f"Completed research job: {job_id}")
        return True

    def fail_job(self, job_id: str, error: str) -> bool:
        """Fail research job"""
        job = self.get_job(job_id)

        if not job:
            logger.error(f"Job not found: {job_id}")
            return False

        job.status = JobStatus.FAILED
        job.completed_at = datetime.utcnow()

        logger.error(f"Failed research job {job_id}: {error}")
        return True

    def update_progress(self, job_id: str, progress: int) -> bool:
        """Update job progress"""
        job = self.get_job(job_id)

        if not job:
            return False

        job.progress = min(100, max(0, progress))
        return True

    def add_subtask(
        self,
        job_id: str,
        subtask: Dict[str, Any]
    ) -> bool:
        """Add subtask to job"""
        job = self.get_job(job_id)

        if not job:
            return False

        job.subtasks.append(subtask)
        return True

    def add_result(
        self,
        job_id: str,
        result: Dict[str, Any]
    ) -> bool:
        """Add result to job"""
        job = self.get_job(job_id)

        if not job:
            return False

        job.results.append(result)
        return True

    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all jobs"""
        return [j.to_dict() for j in self.jobs.values()]
