"""
Plan Scoring System

Implements:
- Composite plan scoring (feasibility, completeness, efficiency, risk)
- Plan repair loop with timeout and attempt limits
- Goal coverage analysis
- Phase redundancy detection
- Abort conditions for planning failures
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import asyncio
import time
import uuid


class PlanStatus(Enum):
    """Status of a plan after scoring."""
    ACCEPT = "accept"           # Score >= accept threshold, ready to execute
    REPAIR = "repair"           # Score between repair and accept, needs fixes
    REGENERATE = "regenerate"   # Score below repair threshold, start over
    ABORTED = "aborted"         # Exceeded limits, cannot continue
    PENDING = "pending"         # Not yet scored


class PhaseStatus(Enum):
    """Execution status of a plan phase."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class PhaseType(Enum):
    """Types of plan phases."""
    RESEARCH = "research"
    ANALYSIS = "analysis"
    SYNTHESIS = "synthesis"
    GENERATION = "generation"
    VALIDATION = "validation"
    EXECUTION = "execution"
    REVIEW = "review"
    DELIVERY = "delivery"


class RiskLevel(Enum):
    """Risk levels for phases."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class PlanPhase:
    """A single phase in a plan."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    phase_type: PhaseType = PhaseType.EXECUTION
    status: PhaseStatus = PhaseStatus.PENDING
    dependencies: List[str] = field(default_factory=list)  # IDs of required phases
    estimated_duration_seconds: int = 60
    risk_level: RiskLevel = RiskLevel.LOW
    required_resources: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def risk_score(self) -> float:
        """Get numeric risk score."""
        risk_map = {
            RiskLevel.LOW: 0.1,
            RiskLevel.MEDIUM: 0.3,
            RiskLevel.HIGH: 0.6,
            RiskLevel.CRITICAL: 0.9,
        }
        return risk_map.get(self.risk_level, 0.3)


@dataclass
class Plan:
    """A complete execution plan."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    goal: str = ""
    description: str = ""
    phases: List[PlanPhase] = field(default_factory=list)
    status: PlanStatus = PlanStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def phase_count(self) -> int:
        """Get number of phases."""
        return len(self.phases)

    def total_duration_seconds(self) -> int:
        """Get total estimated duration."""
        return sum(p.estimated_duration_seconds for p in self.phases)

    def get_phase(self, phase_id: str) -> Optional[PlanPhase]:
        """Get a phase by ID."""
        for phase in self.phases:
            if phase.id == phase_id:
                return phase
        return None


@dataclass
class PlanScore:
    """Result of plan scoring."""
    plan_id: str
    composite_score: float  # 0.0 - 1.0
    feasibility: float      # Can each phase be executed?
    completeness: float     # Does execution achieve the goal?
    efficiency: float       # Shortest path, no redundant phases?
    risk_adjusted: float    # Feasibility adjusted for risk
    status: PlanStatus
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    phase_scores: Dict[str, float] = field(default_factory=dict)
    scored_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "plan_id": self.plan_id,
            "composite_score": self.composite_score,
            "feasibility": self.feasibility,
            "completeness": self.completeness,
            "efficiency": self.efficiency,
            "risk_adjusted": self.risk_adjusted,
            "status": self.status.value,
            "issues": self.issues,
            "suggestions": self.suggestions,
            "scored_at": self.scored_at.isoformat(),
        }


@dataclass
class RepairResult:
    """Result of a plan repair attempt."""
    success: bool
    repaired_plan: Optional[Plan] = None
    changes_made: List[str] = field(default_factory=list)
    new_score: Optional[PlanScore] = None
    attempt_number: int = 0
    duration_ms: int = 0


@dataclass
class PlanScorerConfig:
    """Configuration for plan scoring."""
    # Score thresholds
    accept_threshold: float = 0.7       # Score >= this is acceptable
    repair_threshold: float = 0.4       # Score >= this can be repaired
    min_acceptable_score: float = 0.5   # Absolute minimum to proceed

    # Scoring weights (must sum to 1.0)
    feasibility_weight: float = 0.35
    completeness_weight: float = 0.35
    efficiency_weight: float = 0.15
    risk_weight: float = 0.15

    # Abort conditions
    max_planning_time_ms: int = 30000   # 30 seconds
    max_repair_time_ms: int = 60000     # 60 seconds total for repairs
    max_repair_attempts: int = 3
    max_regeneration_attempts: int = 2
    max_phases: int = 15

    # Efficiency thresholds
    max_redundant_phases: int = 2
    min_phase_contribution: float = 0.1  # Each phase should contribute at least 10%

    # Risk thresholds
    max_average_risk: float = 0.5
    max_critical_phases: int = 2


class PlanScorer:
    """
    Scores execution plans based on multiple dimensions.

    Evaluates feasibility, completeness, efficiency, and risk
    to determine if a plan should be accepted, repaired, or regenerated.
    """

    def __init__(self, config: Optional[PlanScorerConfig] = None):
        self.config = config or PlanScorerConfig()
        self._lock = asyncio.Lock()
        self._scoring_history: List[PlanScore] = []

    def score_plan(
        self,
        plan: Plan,
        context: Optional[Dict[str, Any]] = None
    ) -> PlanScore:
        """
        Score a plan across all dimensions.

        Args:
            plan: The plan to score
            context: Optional context for scoring

        Returns:
            PlanScore with detailed breakdown
        """
        context = context or {}
        issues = []
        suggestions = []

        # Check phase count limit
        if plan.phase_count() > self.config.max_phases:
            issues.append(f"Too many phases: {plan.phase_count()} > {self.config.max_phases}")
            suggestions.append("Consider consolidating related phases")

        # Calculate individual scores
        feasibility = self._calculate_feasibility(plan, context)
        completeness = self._calculate_completeness(plan, context)
        efficiency = self._calculate_efficiency(plan, context)
        risk_penalty = self._calculate_risk_penalty(plan)

        # Risk-adjusted feasibility
        risk_adjusted = feasibility * (1 - risk_penalty)

        # Composite score (weighted average)
        composite = (
            feasibility * self.config.feasibility_weight +
            completeness * self.config.completeness_weight +
            efficiency * self.config.efficiency_weight +
            risk_adjusted * self.config.risk_weight
        )

        # Determine status based on thresholds
        if composite >= self.config.accept_threshold:
            status = PlanStatus.ACCEPT
        elif composite >= self.config.repair_threshold:
            status = PlanStatus.REPAIR
            suggestions.append("Plan can be improved with targeted repairs")
        else:
            status = PlanStatus.REGENERATE
            issues.append("Plan score too low for repair")

        # Add specific issues and suggestions
        if feasibility < 0.6:
            issues.append(f"Low feasibility ({feasibility:.2f})")
            suggestions.append("Review phase dependencies and resource requirements")
        if completeness < 0.6:
            issues.append(f"Incomplete goal coverage ({completeness:.2f})")
            suggestions.append("Add phases to address missing aspects of the goal")
        if efficiency < 0.6:
            issues.append(f"Low efficiency ({efficiency:.2f})")
            suggestions.append("Remove redundant or low-contribution phases")
        if risk_penalty > 0.3:
            issues.append(f"High risk ({risk_penalty:.2f})")
            suggestions.append("Consider alternatives for high-risk phases")

        # Score individual phases
        phase_scores = {}
        for phase in plan.phases:
            phase_scores[phase.id] = self._score_phase(phase, plan, context)

        score = PlanScore(
            plan_id=plan.id,
            composite_score=composite,
            feasibility=feasibility,
            completeness=completeness,
            efficiency=efficiency,
            risk_adjusted=risk_adjusted,
            status=status,
            issues=issues,
            suggestions=suggestions,
            phase_scores=phase_scores,
            metadata=context,
        )

        self._scoring_history.append(score)
        return score

    def _calculate_feasibility(
        self,
        plan: Plan,
        context: Dict[str, Any]
    ) -> float:
        """
        Calculate feasibility score.

        Checks if each phase can be executed given dependencies
        and available resources.
        """
        if not plan.phases:
            return 0.0

        feasible_count = 0
        for phase in plan.phases:
            # Check dependencies are satisfiable
            deps_ok = self._check_dependencies(phase, plan)
            # Check resources are available
            resources_ok = self._check_resources(phase, context)

            if deps_ok and resources_ok:
                feasible_count += 1

        return feasible_count / len(plan.phases)

    def _calculate_completeness(
        self,
        plan: Plan,
        context: Dict[str, Any]
    ) -> float:
        """
        Calculate completeness score.

        Measures how well the plan covers the goal requirements.
        """
        if not plan.goal:
            return 0.5  # No goal to measure against

        # Get goal aspects from context or parse from goal
        goal_aspects = context.get("goal_aspects", [])
        if not goal_aspects:
            # Simple heuristic: split goal into words as aspects
            goal_aspects = [w.lower() for w in plan.goal.split() if len(w) > 3]

        if not goal_aspects:
            return 0.5

        # Check which aspects are covered by phases
        covered = set()
        for phase in plan.phases:
            phase_text = f"{phase.name} {phase.description}".lower()
            for aspect in goal_aspects:
                if aspect in phase_text:
                    covered.add(aspect)
            # Check outputs
            for output in phase.outputs:
                for aspect in goal_aspects:
                    if aspect in output.lower():
                        covered.add(aspect)

        return len(covered) / len(goal_aspects) if goal_aspects else 0.5

    def _calculate_efficiency(
        self,
        plan: Plan,
        context: Dict[str, Any]
    ) -> float:
        """
        Calculate efficiency score.

        Penalizes redundant phases and unnecessarily long plans.
        """
        if not plan.phases:
            return 0.0

        # Count redundant phases
        redundant = self._count_redundant_phases(plan)
        redundancy_penalty = min(redundant / max(len(plan.phases), 1), 0.5)

        # Check for optimal phase count (heuristic)
        optimal_phases = context.get("optimal_phases", 5)
        phase_ratio = min(optimal_phases / max(len(plan.phases), 1), 1.0)

        # Check phase contribution
        low_contribution = 0
        for phase in plan.phases:
            contribution = self._estimate_phase_contribution(phase, plan)
            if contribution < self.config.min_phase_contribution:
                low_contribution += 1
        contribution_penalty = low_contribution / max(len(plan.phases), 1)

        efficiency = 1.0 - redundancy_penalty - (contribution_penalty * 0.3)
        efficiency = efficiency * (0.5 + 0.5 * phase_ratio)

        return max(0.0, min(1.0, efficiency))

    def _calculate_risk_penalty(self, plan: Plan) -> float:
        """
        Calculate risk penalty from phase risks.
        """
        if not plan.phases:
            return 0.0

        total_risk = sum(p.risk_score() for p in plan.phases)
        avg_risk = total_risk / len(plan.phases)

        # Count critical phases
        critical_count = sum(
            1 for p in plan.phases if p.risk_level == RiskLevel.CRITICAL
        )
        critical_penalty = min(critical_count * 0.15, 0.3)

        return min(avg_risk + critical_penalty, 1.0)

    def _check_dependencies(self, phase: PlanPhase, plan: Plan) -> bool:
        """Check if phase dependencies are satisfiable."""
        for dep_id in phase.dependencies:
            dep_phase = plan.get_phase(dep_id)
            if not dep_phase:
                return False  # Dependency not found
        return True

    def _check_resources(
        self,
        phase: PlanPhase,
        context: Dict[str, Any]
    ) -> bool:
        """Check if required resources are available."""
        available_resources = set(context.get("available_resources", []))
        for resource in phase.required_resources:
            if resource not in available_resources and available_resources:
                return False
        return True

    def _count_redundant_phases(self, plan: Plan) -> int:
        """Count phases that appear redundant."""
        seen_types = {}
        redundant = 0

        for phase in plan.phases:
            key = (phase.phase_type, frozenset(phase.outputs))
            if key in seen_types:
                redundant += 1
            else:
                seen_types[key] = phase.id

        return redundant

    def _estimate_phase_contribution(
        self,
        phase: PlanPhase,
        plan: Plan
    ) -> float:
        """Estimate how much a phase contributes to the goal."""
        # Phases with outputs contribute more
        if phase.outputs:
            return 0.3 + 0.1 * min(len(phase.outputs), 5)
        # Phases that others depend on contribute
        dependent_count = sum(
            1 for p in plan.phases if phase.id in p.dependencies
        )
        if dependent_count > 0:
            return 0.2 + 0.1 * min(dependent_count, 3)
        return 0.1

    def _score_phase(
        self,
        phase: PlanPhase,
        plan: Plan,
        context: Dict[str, Any]
    ) -> float:
        """Score an individual phase."""
        score = 0.5  # Base score

        # Bonus for outputs
        if phase.outputs:
            score += 0.1 * min(len(phase.outputs), 3)

        # Bonus for being depended upon
        dependent_count = sum(
            1 for p in plan.phases if phase.id in p.dependencies
        )
        score += 0.05 * min(dependent_count, 4)

        # Penalty for high risk
        score -= phase.risk_score() * 0.2

        # Penalty for missing dependencies
        if not self._check_dependencies(phase, plan):
            score -= 0.3

        return max(0.0, min(1.0, score))


class PlanRepairEngine:
    """
    Repairs plans that fall below acceptance threshold.

    Applies targeted fixes to improve plan scores while
    respecting abort conditions.
    """

    def __init__(
        self,
        scorer: Optional[PlanScorer] = None,
        config: Optional[PlanScorerConfig] = None
    ):
        self.config = config or PlanScorerConfig()
        self.scorer = scorer or PlanScorer(self.config)
        self._repair_history: List[RepairResult] = []

    async def repair_plan(
        self,
        plan: Plan,
        score: PlanScore,
        context: Optional[Dict[str, Any]] = None
    ) -> RepairResult:
        """
        Attempt to repair a plan.

        Args:
            plan: The plan to repair
            score: The current score
            context: Optional context

        Returns:
            RepairResult with repaired plan if successful
        """
        start_time = time.time()
        changes = []
        context = context or {}

        # Create a copy of the plan to modify
        repaired = self._copy_plan(plan)

        # Apply repairs based on issues
        if score.feasibility < 0.6:
            changes.extend(self._repair_feasibility(repaired, context))

        if score.completeness < 0.6:
            changes.extend(self._repair_completeness(repaired, score, context))

        if score.efficiency < 0.6:
            changes.extend(self._repair_efficiency(repaired))

        if score.risk_adjusted < score.feasibility * 0.8:
            changes.extend(self._repair_risk(repaired))

        # Re-score the repaired plan
        new_score = self.scorer.score_plan(repaired, context)
        duration_ms = int((time.time() - start_time) * 1000)

        # Check if repair was successful
        success = new_score.composite_score > score.composite_score

        result = RepairResult(
            success=success,
            repaired_plan=repaired if success else None,
            changes_made=changes,
            new_score=new_score,
            duration_ms=duration_ms,
        )

        self._repair_history.append(result)
        return result

    def _copy_plan(self, plan: Plan) -> Plan:
        """Create a copy of a plan."""
        return Plan(
            id=str(uuid.uuid4()),
            goal=plan.goal,
            description=plan.description,
            phases=[
                PlanPhase(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                    phase_type=p.phase_type,
                    status=p.status,
                    dependencies=list(p.dependencies),
                    estimated_duration_seconds=p.estimated_duration_seconds,
                    risk_level=p.risk_level,
                    required_resources=list(p.required_resources),
                    outputs=list(p.outputs),
                    metadata=dict(p.metadata),
                )
                for p in plan.phases
            ],
            metadata=dict(plan.metadata),
        )

    def _repair_feasibility(
        self,
        plan: Plan,
        context: Dict[str, Any]
    ) -> List[str]:
        """Repair feasibility issues."""
        changes = []

        # Fix broken dependencies
        valid_ids = {p.id for p in plan.phases}
        for phase in plan.phases:
            invalid_deps = [d for d in phase.dependencies if d not in valid_ids]
            if invalid_deps:
                phase.dependencies = [
                    d for d in phase.dependencies if d in valid_ids
                ]
                changes.append(f"Removed invalid dependencies from {phase.name}")

        # Remove phases with unsatisfiable resource requirements
        available = set(context.get("available_resources", []))
        if available:
            to_remove = []
            for phase in plan.phases:
                missing = set(phase.required_resources) - available
                if missing and len(missing) == len(phase.required_resources):
                    to_remove.append(phase)
            for phase in to_remove:
                plan.phases.remove(phase)
                changes.append(f"Removed phase with unavailable resources: {phase.name}")

        return changes

    def _repair_completeness(
        self,
        plan: Plan,
        score: PlanScore,
        context: Dict[str, Any]
    ) -> List[str]:
        """Repair completeness issues."""
        changes = []

        # Add missing coverage phases
        goal_aspects = context.get("goal_aspects", [])
        covered = set()

        for phase in plan.phases:
            phase_text = f"{phase.name} {phase.description}".lower()
            for aspect in goal_aspects:
                if aspect in phase_text:
                    covered.add(aspect)

        missing = set(goal_aspects) - covered
        for aspect in list(missing)[:3]:  # Add up to 3 phases
            new_phase = PlanPhase(
                name=f"Address: {aspect}",
                description=f"Phase to cover missing aspect: {aspect}",
                phase_type=PhaseType.EXECUTION,
                outputs=[aspect],
            )
            plan.phases.append(new_phase)
            changes.append(f"Added phase for missing aspect: {aspect}")

        return changes

    def _repair_efficiency(self, plan: Plan) -> List[str]:
        """Repair efficiency issues."""
        changes = []

        # Remove redundant phases
        seen = {}
        to_remove = []

        for phase in plan.phases:
            key = (phase.phase_type, frozenset(phase.outputs))
            if key in seen:
                # Check if this phase is depended upon
                is_dependency = any(
                    phase.id in p.dependencies for p in plan.phases
                )
                if not is_dependency:
                    to_remove.append(phase)
            else:
                seen[key] = phase

        for phase in to_remove[:2]:  # Remove up to 2 redundant phases
            plan.phases.remove(phase)
            changes.append(f"Removed redundant phase: {phase.name}")

        return changes

    def _repair_risk(self, plan: Plan) -> List[str]:
        """Repair risk issues."""
        changes = []

        # Downgrade risk levels where possible
        for phase in plan.phases:
            if phase.risk_level == RiskLevel.CRITICAL:
                phase.risk_level = RiskLevel.HIGH
                changes.append(f"Downgraded risk for: {phase.name}")
            elif phase.risk_level == RiskLevel.HIGH:
                # Add validation phase after high-risk phases
                if not any(
                    p.phase_type == PhaseType.VALIDATION and phase.id in p.dependencies
                    for p in plan.phases
                ):
                    validation = PlanPhase(
                        name=f"Validate: {phase.name}",
                        phase_type=PhaseType.VALIDATION,
                        dependencies=[phase.id],
                        risk_level=RiskLevel.LOW,
                    )
                    plan.phases.append(validation)
                    changes.append(f"Added validation for high-risk phase: {phase.name}")

        return changes


class PlanOrchestrator:
    """
    Orchestrates the plan scoring and repair loop.

    Manages the complete workflow from initial scoring through
    repair attempts or regeneration.
    """

    def __init__(
        self,
        config: Optional[PlanScorerConfig] = None,
        regenerate_callback: Optional[Callable[[Plan, PlanScore], Plan]] = None
    ):
        self.config = config or PlanScorerConfig()
        self.scorer = PlanScorer(self.config)
        self.repair_engine = PlanRepairEngine(self.scorer, self.config)
        self.regenerate_callback = regenerate_callback
        self._lock = asyncio.Lock()
        self._abort_reason: Optional[str] = None

    async def process_plan(
        self,
        plan: Plan,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[Plan, PlanScore, List[str]]:
        """
        Process a plan through scoring, repair, and regeneration.

        Args:
            plan: The initial plan
            context: Optional context

        Returns:
            Tuple of (final_plan, final_score, processing_log)
        """
        context = context or {}
        log = []
        start_time = time.time()
        repair_attempts = 0
        regeneration_attempts = 0
        current_plan = plan

        async with self._lock:
            self._abort_reason = None

            while True:
                # Check planning timeout
                elapsed_ms = (time.time() - start_time) * 1000
                if elapsed_ms > self.config.max_planning_time_ms:
                    self._abort_reason = "Planning timeout exceeded"
                    log.append(f"ABORT: {self._abort_reason}")
                    current_plan.status = PlanStatus.ABORTED
                    return current_plan, self._create_abort_score(current_plan), log

                # Score the current plan
                score = self.scorer.score_plan(current_plan, context)
                log.append(f"Scored plan: {score.composite_score:.2f} ({score.status.value})")

                # Accept if score is good enough
                if score.status == PlanStatus.ACCEPT:
                    current_plan.status = PlanStatus.ACCEPT
                    log.append("Plan accepted")
                    return current_plan, score, log

                # Attempt repair if score is repairable
                if score.status == PlanStatus.REPAIR:
                    if repair_attempts >= self.config.max_repair_attempts:
                        log.append("Max repair attempts reached")
                        if score.composite_score >= self.config.min_acceptable_score:
                            current_plan.status = PlanStatus.ACCEPT
                            log.append("Accepting plan at minimum threshold")
                            return current_plan, score, log
                        score.status = PlanStatus.REGENERATE
                    else:
                        repair_attempts += 1
                        log.append(f"Repair attempt {repair_attempts}")

                        # Check repair timeout
                        repair_elapsed = (time.time() - start_time) * 1000
                        if repair_elapsed > self.config.max_repair_time_ms:
                            self._abort_reason = "Repair timeout exceeded"
                            log.append(f"ABORT: {self._abort_reason}")
                            current_plan.status = PlanStatus.ABORTED
                            return current_plan, score, log

                        result = await self.repair_engine.repair_plan(
                            current_plan, score, context
                        )
                        if result.success and result.repaired_plan:
                            current_plan = result.repaired_plan
                            log.append(f"Repair successful: {', '.join(result.changes_made)}")
                            continue
                        else:
                            log.append("Repair unsuccessful")

                # Regenerate if score is too low
                if score.status == PlanStatus.REGENERATE:
                    if regeneration_attempts >= self.config.max_regeneration_attempts:
                        self._abort_reason = "Max regeneration attempts reached"
                        log.append(f"ABORT: {self._abort_reason}")
                        current_plan.status = PlanStatus.ABORTED
                        return current_plan, score, log

                    regeneration_attempts += 1
                    log.append(f"Regeneration attempt {regeneration_attempts}")

                    if self.regenerate_callback:
                        try:
                            current_plan = self.regenerate_callback(current_plan, score)
                            log.append("Plan regenerated")
                            repair_attempts = 0  # Reset repair counter
                            continue
                        except Exception as e:
                            log.append(f"Regeneration failed: {str(e)}")
                    else:
                        self._abort_reason = "No regeneration callback available"
                        log.append(f"ABORT: {self._abort_reason}")
                        current_plan.status = PlanStatus.ABORTED
                        return current_plan, score, log

    def _create_abort_score(self, plan: Plan) -> PlanScore:
        """Create an abort score for a plan."""
        return PlanScore(
            plan_id=plan.id,
            composite_score=0.0,
            feasibility=0.0,
            completeness=0.0,
            efficiency=0.0,
            risk_adjusted=0.0,
            status=PlanStatus.ABORTED,
            issues=[self._abort_reason or "Plan processing aborted"],
        )

    def get_abort_reason(self) -> Optional[str]:
        """Get the reason for the last abort."""
        return self._abort_reason


# Global instance management
_plan_scorer: Optional[PlanScorer] = None
_plan_orchestrator: Optional[PlanOrchestrator] = None


def get_plan_scorer() -> Optional[PlanScorer]:
    """Get the global plan scorer."""
    return _plan_scorer


def set_plan_scorer(scorer: PlanScorer) -> None:
    """Set the global plan scorer."""
    global _plan_scorer
    _plan_scorer = scorer


def reset_plan_scorer() -> None:
    """Reset the global plan scorer."""
    global _plan_scorer
    _plan_scorer = None


def get_plan_orchestrator() -> Optional[PlanOrchestrator]:
    """Get the global plan orchestrator."""
    return _plan_orchestrator


def set_plan_orchestrator(orchestrator: PlanOrchestrator) -> None:
    """Set the global plan orchestrator."""
    global _plan_orchestrator
    _plan_orchestrator = orchestrator


def reset_plan_orchestrator() -> None:
    """Reset the global plan orchestrator."""
    global _plan_orchestrator
    _plan_orchestrator = None
