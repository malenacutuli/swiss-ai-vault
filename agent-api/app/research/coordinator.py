"""Parallel Agent Coordinator"""

import logging
import asyncio
from typing import Dict, Any, List, Callable
from app.research.job_manager import WideResearchJobManager, JobStatus

logger = logging.getLogger(__name__)

class ParallelAgentCoordinator:
    """Coordinate parallel agent execution"""

    def __init__(
        self,
        job_manager: WideResearchJobManager,
        agent_executor: Callable
    ):
        """
        Initialize coordinator.

        Args:
            job_manager: Job manager instance
            agent_executor: Async function to execute agent
        """
        self.job_manager = job_manager
        self.agent_executor = agent_executor

    async def distribute_research(
        self,
        job_id: str,
        topic: str,
        num_agents: int = 5
    ) -> Dict[str, Any]:
        """
        Distribute research across agents.

        Args:
            job_id: Job ID
            topic: Research topic
            num_agents: Number of agents to spawn

        Returns:
            Research results
        """
        job = self.job_manager.get_job(job_id)

        if not job:
            raise ValueError(f"Job not found: {job_id}")

        # Start job
        self.job_manager.start_job(job_id)

        # Create subtasks
        subtasks = self._create_subtasks(topic, num_agents)

        for subtask in subtasks:
            self.job_manager.add_subtask(job_id, subtask)

        # Execute agents in parallel
        try:
            tasks = [
                self.agent_executor(
                    job_id=job_id,
                    subtask=subtask,
                    topic=topic
                )
                for subtask in subtasks
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Agent failed: {result}")
                else:
                    self.job_manager.add_result(job_id, result)

            # Complete job
            self.job_manager.complete_job(job_id)

            return {
                "job_id": job_id,
                "status": "completed",
                "results": job.results
            }

        except Exception as e:
            logger.error(f"Coordination failed: {e}")
            self.job_manager.fail_job(job_id, str(e))
            raise

    def _create_subtasks(self, topic: str, num_agents: int) -> List[Dict[str, Any]]:
        """Create subtasks for agents"""
        subtasks = []

        # Divide topic into subtasks
        aspects = [
            "overview",
            "recent_developments",
            "expert_opinions",
            "case_studies",
            "future_outlook"
        ]

        for i in range(num_agents):
            aspect = aspects[i % len(aspects)]

            subtasks.append({
                "agent_id": i,
                "aspect": aspect,
                "query": f"{topic} - {aspect}",
                "depth": 1
            })

        return subtasks
