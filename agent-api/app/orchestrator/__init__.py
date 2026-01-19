"""
Orchestrator Module for Parallel Task Execution

This module implements the Manus-style orchestrator with:
- 10-state run state machine
- Fencing tokens for concurrency safety
- Task decomposition into parallel subtasks
- Subtask scheduling with dependencies
- Progress tracking and aggregation
"""

from app.orchestrator.types import (
    RunState,
    SubtaskState,
    RUN_TRANSITIONS,
    SUBTASK_TRANSITIONS,
    ResearchRun,
    RunConfig,
    Subtask,
    SubtaskDefinition,
    DecompositionResult,
    SchedulingDecision,
    RunProgress,
    OrchestratorConfig,
)
from app.orchestrator.state_machine import StateMachine
from app.orchestrator.orchestrator import Orchestrator
from app.orchestrator.decomposer import TaskDecomposer
from app.orchestrator.scheduler import SubtaskScheduler

__all__ = [
    # Types
    "RunState",
    "SubtaskState",
    "RUN_TRANSITIONS",
    "SUBTASK_TRANSITIONS",
    "ResearchRun",
    "RunConfig",
    "Subtask",
    "SubtaskDefinition",
    "DecompositionResult",
    "SchedulingDecision",
    "RunProgress",
    "OrchestratorConfig",
    # Classes
    "StateMachine",
    "Orchestrator",
    "TaskDecomposer",
    "SubtaskScheduler",
]
