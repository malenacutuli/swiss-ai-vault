"""Wide Research System - Phase 7

Parallel multi-agent research system that distributes research tasks across
multiple agents, collects results, and synthesizes findings.
"""

from app.research.job_manager import (
    WideResearchJobManager,
    WideResearchJob,
    JobStatus
)
from app.research.coordinator import ParallelAgentCoordinator
from app.research.synthesizer import ResultSynthesizer

__all__ = [
    "WideResearchJobManager",
    "WideResearchJob",
    "JobStatus",
    "ParallelAgentCoordinator",
    "ResultSynthesizer",
]
