"""
Plan Scoring System per SWISSBRAIN_INTELLIGENCE_STACK.md

Implements decision boundaries for plan evaluation, repair, and abort logic.
Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 1 (Planner Agent)
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

# Structured logging
logger = logging.getLogger(__name__)


# ============================================================================
# Thresholds from SWISSBRAIN_INTELLIGENCE_STACK.md
# ============================================================================

# Section 1.1 Plan Scoring Thresholds
PLAN_THRESHOLDS = {
    "ACCEPT": 0.7,  # Good enough to execute
    "REPAIR": 0.4,  # Salvageable with fixes
    "REGENERATE": 0.4,  # Below this, start over
    "MAX_REPAIRS": 3,  # Stop repairing after this
    "FEASIBILITY_ZERO": 0,  # Impossible plan, regenerate immediately
}

# Section 1.2 Abort Conditions
PLANNER_ABORT_THRESHOLDS = {
    # Time limits
    "MAX_PLANNING_TIME_MS": 30000,  # 30s to produce plan
    "MAX_REPAIR_TIME_MS": 60000,  # 60s total for repairs
    "MAX_SINGLE_REPAIR_MS": 15000,  # 15s per repair attempt
    # Attempt limits
    "MAX_REPAIR_ATTEMPTS": 3,
    "MAX_REGENERATION_ATTEMPTS": 2,
    # Score thresholds
    "MIN_ACCEPTABLE_SCORE": 0.5,  # Don't even try below this
    "TARGET_SCORE": 0.7,  # Stop repairing once reached
    # Complexity limits
    "MAX_PHASES": 15,
    "MAX_PHASE_DURATION_MS": 600000,  # 10 minutes per phase
    "MAX_TOTAL_DURATION_MS": 3600000,  # 1 hour total
}


# ============================================================================
# Enums
# ============================================================================


class PlanDecision(Enum):
    """Decision result from plan scoring."""

    ACCEPT = "accept"  # Score >= 0.7, execute plan
    REPAIR = "repair"  # Score 0.4-0.7, attempt repair
    REGENERATE = "regenerate"  # Score < 0.4, start over
    ABORT = "abort"  # Exceeded limits, give up


class PhaseRiskLevel(Enum):
    """Risk level for plan phases."""

    LOW = "low"  # < 0.3
    MEDIUM = "medium"  # 0.3 - 0.6
    HIGH = "high"  # 0.6 - 0.8
    CRITICAL = "critical"  # > 0.8


class RepairType(Enum):
    """Types of plan repairs."""

    ADD_PHASE = "add_phase"
    REMOVE_PHASE = "remove_phase"
    REORDER_PHASES = "reorder_phases"
    MODIFY_PHASE = "modify_phase"
    SPLIT_PHASE = "split_phase"
    MERGE_PHASES = "merge_phases"


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class PlanPhase:
    """A phase within a plan."""

    id: str
    name: str
    description: str
    estimated_duration_ms: int = 0
    risk_level: float = 0.0  # 0-1 scale
    dependencies: List[str] = field(default_factory=list)
    required_tools: List[str] = field(default_factory=list)
    expected_outputs: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Plan:
    """A plan to be scored."""

    id: str
    goal: str
    phases: List[PlanPhase]
    context: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PlanScore:
    """
    Score breakdown for a plan.
    Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 1 (Next: Implement Plan Scoring)
    """

    feasibility: float  # 0-1: Can we do this?
    completeness: float  # 0-1: Does this cover the goal?
    efficiency: float  # 0-1: Shortest path?
    risk_adjusted: float  # Feasibility * (1 - risk_penalty)
    composite: float  # Weighted combination

    # Additional metrics for observability
    phase_count: int = 0
    total_duration_ms: int = 0
    avg_risk: float = 0.0
    redundant_phases: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/metrics."""
        return {
            "feasibility": self.feasibility,
            "completeness": self.completeness,
            "efficiency": self.efficiency,
            "risk_adjusted": self.risk_adjusted,
            "composite": self.composite,
            "phase_count": self.phase_count,
            "total_duration_ms": self.total_duration_ms,
            "avg_risk": self.avg_risk,
            "redundant_phases": self.redundant_phases,
        }


@dataclass
class RepairSuggestion:
    """Suggested repair for a plan."""

    repair_type: RepairType
    phase_id: Optional[str] = None
    description: str = ""
    expected_score_improvement: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoringContext:
    """Context for plan scoring."""

    available_tools: List[str] = field(default_factory=list)
    max_duration_ms: int = PLANNER_ABORT_THRESHOLDS["MAX_TOTAL_DURATION_MS"]
    max_phases: int = PLANNER_ABORT_THRESHOLDS["MAX_PHASES"]
    goal_keywords: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoringResult:
    """Full result of plan scoring."""

    plan_id: str
    score: PlanScore
    decision: PlanDecision
    repair_suggestions: List[RepairSuggestion] = field(default_factory=list)
    abort_reason: Optional[str] = None
    scoring_duration_ms: int = 0
    idempotency_key: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/metrics."""
        return {
            "plan_id": self.plan_id,
            "score": self.score.to_dict(),
            "decision": self.decision.value,
            "repair_suggestions": [
                {"type": r.repair_type.value, "description": r.description}
                for r in self.repair_suggestions
            ],
            "abort_reason": self.abort_reason,
            "scoring_duration_ms": self.scoring_duration_ms,
            "idempotency_key": self.idempotency_key,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class RepairAttempt:
    """Record of a repair attempt."""

    attempt_number: int
    repair_type: RepairType
    started_at: datetime
    completed_at: Optional[datetime] = None
    score_before: float = 0.0
    score_after: float = 0.0
    success: bool = False
    duration_ms: int = 0


@dataclass
class PlannerSession:
    """Tracks a planning session with repair attempts."""

    session_id: str
    plan_id: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    repair_attempts: List[RepairAttempt] = field(default_factory=list)
    regeneration_count: int = 0
    total_repair_time_ms: int = 0
    final_decision: Optional[PlanDecision] = None
    final_score: Optional[float] = None
    aborted: bool = False
    abort_reason: Optional[str] = None


# ============================================================================
# Scoring Functions (per SWISSBRAIN_INTELLIGENCE_STACK.md spec)
# ============================================================================


def calculate_feasibility(plan: Plan, context: ScoringContext) -> float:
    """
    Calculate feasibility score: Can each phase be executed?

    Factors:
    - Are required tools available?
    - Are dependencies satisfiable?
    - Is duration within limits?
    """
    if not plan.phases:
        return 0.0

    phase_scores = []

    for phase in plan.phases:
        phase_score = 1.0

        # Tool availability check
        if phase.required_tools:
            available = sum(
                1 for t in phase.required_tools if t in context.available_tools
            )
            tool_score = available / len(phase.required_tools)
            phase_score *= tool_score

        # Duration check
        if phase.estimated_duration_ms > PLANNER_ABORT_THRESHOLDS["MAX_PHASE_DURATION_MS"]:
            phase_score *= 0.5  # Penalty for too-long phases

        # Dependency check (simplified)
        if phase.dependencies:
            # Check if dependencies reference existing phases
            phase_ids = {p.id for p in plan.phases}
            unmet = sum(1 for d in phase.dependencies if d not in phase_ids)
            if unmet > 0:
                phase_score *= max(0.2, 1 - (unmet / len(phase.dependencies)))

        phase_scores.append(phase_score)

    return sum(phase_scores) / len(phase_scores) if phase_scores else 0.0


def measure_goal_coverage(goal: str, phases: List[PlanPhase]) -> float:
    """
    Calculate completeness: Does execution achieve goal?

    Uses keyword matching as a proxy for goal coverage.
    """
    if not goal or not phases:
        return 0.0

    # Extract goal keywords (simplified)
    goal_words = set(goal.lower().split())
    stop_words = {"the", "a", "an", "is", "are", "to", "for", "and", "or", "of", "in"}
    goal_keywords = goal_words - stop_words

    if not goal_keywords:
        return 0.5  # Neutral if no meaningful keywords

    # Check phase coverage of goal keywords
    covered_keywords = set()
    for phase in phases:
        phase_text = f"{phase.name} {phase.description}".lower()
        for keyword in goal_keywords:
            if keyword in phase_text:
                covered_keywords.add(keyword)

    coverage = len(covered_keywords) / len(goal_keywords) if goal_keywords else 0.0

    # Also check if phases produce expected outputs
    has_outputs = sum(1 for p in phases if p.expected_outputs)
    output_bonus = min(0.2, has_outputs * 0.05)

    return min(1.0, coverage + output_bonus)


def count_redundant_phases(plan: Plan) -> int:
    """
    Count redundant or unnecessary phases.

    Considers:
    - Duplicate phase names
    - Phases with no outputs
    - Phases with no dependencies that could be merged
    """
    redundant = 0

    # Check for duplicate names
    names = [p.name.lower() for p in plan.phases]
    duplicates = len(names) - len(set(names))
    redundant += duplicates

    # Phases with no expected outputs (after first phase)
    for i, phase in enumerate(plan.phases[1:], 1):
        if not phase.expected_outputs and not phase.dependencies:
            redundant += 1

    return redundant


def calculate_average_risk(phases: List[PlanPhase]) -> float:
    """Calculate average risk across phases."""
    if not phases:
        return 0.0
    return sum(p.risk_level for p in phases) / len(phases)


def score_plan(plan: Plan, context: ScoringContext) -> PlanScore:
    """
    Score a plan according to SWISSBRAIN_INTELLIGENCE_STACK.md spec.

    Composite formula (weights tunable):
    composite = feasibility * 0.35 + completeness * 0.35 + efficiency * 0.15 + risk_adjusted * 0.15
    """
    # Feasibility: Can each phase be executed?
    feasibility = calculate_feasibility(plan, context)

    # Completeness: Does execution achieve goal?
    completeness = measure_goal_coverage(plan.goal, plan.phases)

    # Efficiency: Penalize unnecessary phases
    redundant = count_redundant_phases(plan)
    efficiency = 1.0 - (redundant / len(plan.phases)) if plan.phases else 0.0
    efficiency = max(0.0, efficiency)

    # Risk adjustment
    avg_risk = calculate_average_risk(plan.phases)
    risk_adjusted = feasibility * (1 - avg_risk * 0.3)

    # Composite score (weights from spec)
    composite = (
        feasibility * 0.35
        + completeness * 0.35
        + efficiency * 0.15
        + risk_adjusted * 0.15
    )

    # Additional metrics
    total_duration = sum(p.estimated_duration_ms for p in plan.phases)

    return PlanScore(
        feasibility=round(feasibility, 4),
        completeness=round(completeness, 4),
        efficiency=round(efficiency, 4),
        risk_adjusted=round(risk_adjusted, 4),
        composite=round(composite, 4),
        phase_count=len(plan.phases),
        total_duration_ms=total_duration,
        avg_risk=round(avg_risk, 4),
        redundant_phases=redundant,
    )


# ============================================================================
# Decision Logic
# ============================================================================


def make_decision(score: PlanScore, session: Optional[PlannerSession] = None) -> Tuple[PlanDecision, Optional[str]]:
    """
    Determine decision based on score and session state.

    Returns (decision, abort_reason).
    """
    # Check for zero feasibility
    if score.feasibility == 0:
        return PlanDecision.REGENERATE, "Zero feasibility - impossible plan"

    # Check abort conditions from session
    if session:
        # Max repair attempts
        if len(session.repair_attempts) >= PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_ATTEMPTS"]:
            if score.composite < PLAN_THRESHOLDS["ACCEPT"]:
                return PlanDecision.ABORT, f"Max repair attempts ({PLANNER_ABORT_THRESHOLDS['MAX_REPAIR_ATTEMPTS']}) exceeded"

        # Max regeneration attempts
        if session.regeneration_count >= PLANNER_ABORT_THRESHOLDS["MAX_REGENERATION_ATTEMPTS"]:
            return PlanDecision.ABORT, f"Max regeneration attempts ({PLANNER_ABORT_THRESHOLDS['MAX_REGENERATION_ATTEMPTS']}) exceeded"

        # Total repair time
        if session.total_repair_time_ms >= PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_TIME_MS"]:
            return PlanDecision.ABORT, f"Max repair time ({PLANNER_ABORT_THRESHOLDS['MAX_REPAIR_TIME_MS']}ms) exceeded"

    # Score-based decisions
    if score.composite >= PLAN_THRESHOLDS["ACCEPT"]:
        return PlanDecision.ACCEPT, None

    if score.composite >= PLAN_THRESHOLDS["REPAIR"]:
        return PlanDecision.REPAIR, None

    # Below repair threshold
    if score.composite < PLAN_THRESHOLDS["MIN_ACCEPTABLE_SCORE"] if session else PLAN_THRESHOLDS["REGENERATE"]:
        return PlanDecision.REGENERATE, None

    return PlanDecision.REPAIR, None


def generate_repair_suggestions(plan: Plan, score: PlanScore) -> List[RepairSuggestion]:
    """Generate repair suggestions based on score breakdown."""
    suggestions = []

    # Low feasibility - suggest tool additions or phase modifications
    if score.feasibility < 0.6:
        suggestions.append(
            RepairSuggestion(
                repair_type=RepairType.MODIFY_PHASE,
                description="Modify phases to use available tools or reduce complexity",
                expected_score_improvement=0.1,
            )
        )

    # Low completeness - suggest adding phases
    if score.completeness < 0.6:
        suggestions.append(
            RepairSuggestion(
                repair_type=RepairType.ADD_PHASE,
                description="Add phases to better cover goal requirements",
                expected_score_improvement=0.15,
            )
        )

    # Low efficiency - suggest removing redundant phases
    if score.efficiency < 0.7 and score.redundant_phases > 0:
        suggestions.append(
            RepairSuggestion(
                repair_type=RepairType.REMOVE_PHASE,
                description=f"Remove {score.redundant_phases} redundant phase(s)",
                expected_score_improvement=0.05,
            )
        )

    # High risk - suggest splitting phases
    if score.avg_risk > 0.5:
        suggestions.append(
            RepairSuggestion(
                repair_type=RepairType.SPLIT_PHASE,
                description="Split high-risk phases into smaller, safer steps",
                expected_score_improvement=0.08,
            )
        )

    # Too many phases - suggest merging
    if score.phase_count > PLANNER_ABORT_THRESHOLDS["MAX_PHASES"] * 0.8:
        suggestions.append(
            RepairSuggestion(
                repair_type=RepairType.MERGE_PHASES,
                description="Merge related phases to reduce complexity",
                expected_score_improvement=0.05,
            )
        )

    return suggestions


# ============================================================================
# Main Scorer Class
# ============================================================================


class PlanScorer:
    """
    Plan scoring and decision engine.

    Implements the planner agent decision boundaries from
    SWISSBRAIN_INTELLIGENCE_STACK.md.
    """

    def __init__(
        self,
        metrics_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        """
        Initialize the plan scorer.

        Args:
            metrics_callback: Optional callback for emitting metrics
        """
        self._metrics_callback = metrics_callback
        self._sessions: Dict[str, PlannerSession] = {}

    def _emit_metrics(self, metrics: Dict[str, Any]) -> None:
        """Emit metrics if callback is configured."""
        if self._metrics_callback:
            try:
                self._metrics_callback(metrics)
            except Exception as e:
                logger.warning(f"Failed to emit metrics: {e}")

    def score(
        self,
        plan: Plan,
        context: Optional[ScoringContext] = None,
        session_id: Optional[str] = None,
    ) -> ScoringResult:
        """
        Score a plan and return decision.

        Args:
            plan: Plan to score
            context: Scoring context with available tools, limits
            session_id: Optional session ID for tracking repair attempts

        Returns:
            ScoringResult with score, decision, and suggestions
        """
        start_time = time.time()

        if context is None:
            context = ScoringContext()

        # Get or create session
        session = None
        if session_id:
            session = self._sessions.get(session_id)
            if not session:
                session = PlannerSession(
                    session_id=session_id,
                    plan_id=plan.id,
                )
                self._sessions[session_id] = session

        # Score the plan
        score = score_plan(plan, context)

        # Make decision
        decision, abort_reason = make_decision(score, session)

        # Generate repair suggestions if needed
        suggestions = []
        if decision == PlanDecision.REPAIR:
            suggestions = generate_repair_suggestions(plan, score)

        # Calculate scoring duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Build result
        result = ScoringResult(
            plan_id=plan.id,
            score=score,
            decision=decision,
            repair_suggestions=suggestions,
            abort_reason=abort_reason,
            scoring_duration_ms=duration_ms,
        )

        # Update session if tracking
        if session:
            session.final_decision = decision
            session.final_score = score.composite
            if decision == PlanDecision.ABORT:
                session.aborted = True
                session.abort_reason = abort_reason

        # Emit metrics
        self._emit_metrics({
            "type": "plan_scoring",
            "plan_id": plan.id,
            "composite_score": score.composite,
            "decision": decision.value,
            "duration_ms": duration_ms,
            "phase_count": score.phase_count,
            "feasibility": score.feasibility,
            "completeness": score.completeness,
        })

        # Structured logging
        logger.info(
            "Plan scored",
            extra={
                "plan_id": plan.id,
                "composite_score": score.composite,
                "decision": decision.value,
                "duration_ms": duration_ms,
            },
        )

        return result

    def record_repair_attempt(
        self,
        session_id: str,
        repair_type: RepairType,
        score_before: float,
        score_after: float,
        duration_ms: int,
    ) -> None:
        """Record a repair attempt for a session."""
        session = self._sessions.get(session_id)
        if not session:
            logger.warning(f"Session {session_id} not found for repair recording")
            return

        attempt = RepairAttempt(
            attempt_number=len(session.repair_attempts) + 1,
            repair_type=repair_type,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            score_before=score_before,
            score_after=score_after,
            success=score_after > score_before,
            duration_ms=duration_ms,
        )

        session.repair_attempts.append(attempt)
        session.total_repair_time_ms += duration_ms

        self._emit_metrics({
            "type": "repair_attempt",
            "session_id": session_id,
            "repair_type": repair_type.value,
            "score_before": score_before,
            "score_after": score_after,
            "improvement": score_after - score_before,
            "duration_ms": duration_ms,
        })

    def record_regeneration(self, session_id: str) -> None:
        """Record a plan regeneration."""
        session = self._sessions.get(session_id)
        if not session:
            logger.warning(f"Session {session_id} not found for regeneration recording")
            return

        session.regeneration_count += 1

        self._emit_metrics({
            "type": "plan_regeneration",
            "session_id": session_id,
            "regeneration_count": session.regeneration_count,
        })

    def get_session(self, session_id: str) -> Optional[PlannerSession]:
        """Get a planner session by ID."""
        return self._sessions.get(session_id)

    def clear_session(self, session_id: str) -> None:
        """Clear a planner session."""
        if session_id in self._sessions:
            del self._sessions[session_id]

    def should_abort(
        self,
        session_id: str,
        elapsed_ms: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if planning should abort based on time/attempt limits.

        Returns (should_abort, reason).
        """
        session = self._sessions.get(session_id)

        # Time limit check
        if elapsed_ms > PLANNER_ABORT_THRESHOLDS["MAX_PLANNING_TIME_MS"]:
            return True, f"Exceeded planning time limit ({PLANNER_ABORT_THRESHOLDS['MAX_PLANNING_TIME_MS']}ms)"

        if session:
            # Repair attempts
            if len(session.repair_attempts) >= PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_ATTEMPTS"]:
                return True, f"Max repair attempts exceeded"

            # Regenerations
            if session.regeneration_count >= PLANNER_ABORT_THRESHOLDS["MAX_REGENERATION_ATTEMPTS"]:
                return True, f"Max regeneration attempts exceeded"

            # Total repair time
            if session.total_repair_time_ms >= PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_TIME_MS"]:
                return True, f"Max repair time exceeded"

        return False, None


# ============================================================================
# Module-level instance
# ============================================================================

_default_scorer: Optional[PlanScorer] = None


def get_plan_scorer() -> PlanScorer:
    """Get the default plan scorer instance."""
    global _default_scorer
    if _default_scorer is None:
        _default_scorer = PlanScorer()
    return _default_scorer


def set_plan_scorer(scorer: PlanScorer) -> None:
    """Set the default plan scorer instance."""
    global _default_scorer
    _default_scorer = scorer


def reset_plan_scorer() -> None:
    """Reset the default plan scorer instance."""
    global _default_scorer
    _default_scorer = None
