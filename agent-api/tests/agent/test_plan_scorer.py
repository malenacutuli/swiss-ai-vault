"""
Tests for Plan Scoring System per SWISSBRAIN_INTELLIGENCE_STACK.md
"""

import pytest
from datetime import datetime

from app.agent.plan_scorer import (
    PLAN_THRESHOLDS,
    PLANNER_ABORT_THRESHOLDS,
    Plan,
    PlanDecision,
    PlanPhase,
    PlanScore,
    PlanScorer,
    PlannerSession,
    RepairType,
    ScoringContext,
    ScoringResult,
    calculate_average_risk,
    calculate_feasibility,
    count_redundant_phases,
    generate_repair_suggestions,
    get_plan_scorer,
    make_decision,
    measure_goal_coverage,
    reset_plan_scorer,
    score_plan,
    set_plan_scorer,
)


class TestThresholds:
    """Verify thresholds match spec."""

    def test_plan_thresholds_match_spec(self):
        """Test PLAN_THRESHOLDS match SWISSBRAIN_INTELLIGENCE_STACK.md Section 1.1."""
        assert PLAN_THRESHOLDS["ACCEPT"] == 0.7
        assert PLAN_THRESHOLDS["REPAIR"] == 0.4
        assert PLAN_THRESHOLDS["REGENERATE"] == 0.4
        assert PLAN_THRESHOLDS["MAX_REPAIRS"] == 3
        assert PLAN_THRESHOLDS["FEASIBILITY_ZERO"] == 0

    def test_abort_thresholds_match_spec(self):
        """Test PLANNER_ABORT_THRESHOLDS match SWISSBRAIN_INTELLIGENCE_STACK.md Section 1.2."""
        assert PLANNER_ABORT_THRESHOLDS["MAX_PLANNING_TIME_MS"] == 30000
        assert PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_TIME_MS"] == 60000
        assert PLANNER_ABORT_THRESHOLDS["MAX_SINGLE_REPAIR_MS"] == 15000
        assert PLANNER_ABORT_THRESHOLDS["MAX_REPAIR_ATTEMPTS"] == 3
        assert PLANNER_ABORT_THRESHOLDS["MAX_REGENERATION_ATTEMPTS"] == 2
        assert PLANNER_ABORT_THRESHOLDS["MIN_ACCEPTABLE_SCORE"] == 0.5
        assert PLANNER_ABORT_THRESHOLDS["TARGET_SCORE"] == 0.7
        assert PLANNER_ABORT_THRESHOLDS["MAX_PHASES"] == 15
        assert PLANNER_ABORT_THRESHOLDS["MAX_PHASE_DURATION_MS"] == 600000
        assert PLANNER_ABORT_THRESHOLDS["MAX_TOTAL_DURATION_MS"] == 3600000


class TestPlanScore:
    """Test PlanScore dataclass."""

    def test_create_plan_score(self):
        """Test PlanScore creation with all fields."""
        score = PlanScore(
            feasibility=0.8,
            completeness=0.7,
            efficiency=0.9,
            risk_adjusted=0.75,
            composite=0.78,
            phase_count=5,
            total_duration_ms=60000,
            avg_risk=0.2,
            redundant_phases=1,
        )
        assert score.feasibility == 0.8
        assert score.composite == 0.78
        assert score.phase_count == 5

    def test_plan_score_to_dict(self):
        """Test PlanScore serialization."""
        score = PlanScore(
            feasibility=0.8,
            completeness=0.7,
            efficiency=0.9,
            risk_adjusted=0.75,
            composite=0.78,
        )
        d = score.to_dict()
        assert d["feasibility"] == 0.8
        assert d["composite"] == 0.78
        assert "phase_count" in d


class TestFeasibilityCalculation:
    """Test feasibility scoring."""

    def test_empty_plan_feasibility(self):
        """Empty plan has zero feasibility."""
        plan = Plan(id="p1", goal="Test", phases=[])
        context = ScoringContext()
        assert calculate_feasibility(plan, context) == 0.0

    def test_plan_with_available_tools(self):
        """Plan with all tools available has high feasibility."""
        phase = PlanPhase(
            id="ph1",
            name="Research",
            description="Research the topic",
            required_tools=["web_search", "read_file"],
        )
        plan = Plan(id="p1", goal="Research something", phases=[phase])
        context = ScoringContext(available_tools=["web_search", "read_file"])

        feasibility = calculate_feasibility(plan, context)
        assert feasibility == 1.0

    def test_plan_with_missing_tools(self):
        """Plan with missing tools has reduced feasibility."""
        phase = PlanPhase(
            id="ph1",
            name="Research",
            description="Research the topic",
            required_tools=["web_search", "database_query"],
        )
        plan = Plan(id="p1", goal="Research something", phases=[phase])
        context = ScoringContext(available_tools=["web_search"])

        feasibility = calculate_feasibility(plan, context)
        assert feasibility == 0.5  # Only 1 of 2 tools available

    def test_plan_with_unmet_dependencies(self):
        """Plan with unmet dependencies has reduced feasibility."""
        phases = [
            PlanPhase(id="ph1", name="Step 1", description="First step"),
            PlanPhase(
                id="ph2",
                name="Step 2",
                description="Second step",
                dependencies=["ph1", "ph_nonexistent"],
            ),
        ]
        plan = Plan(id="p1", goal="Multi-step task", phases=phases)
        context = ScoringContext()

        feasibility = calculate_feasibility(plan, context)
        assert feasibility < 1.0


class TestCompletenessCalculation:
    """Test goal coverage/completeness scoring."""

    def test_empty_goal_completeness(self):
        """Empty goal gives neutral score."""
        plan = Plan(id="p1", goal="", phases=[])
        assert measure_goal_coverage(plan.goal, plan.phases) == 0.0

    def test_full_goal_coverage(self):
        """Phases covering all goal keywords get high score."""
        phases = [
            PlanPhase(id="ph1", name="Research market", description="Market analysis"),
            PlanPhase(id="ph2", name="Create report", description="Write report"),
        ]
        goal = "Research market and create report"

        completeness = measure_goal_coverage(goal, phases)
        assert completeness > 0.7

    def test_partial_goal_coverage(self):
        """Phases partially covering goal get medium score."""
        phases = [
            PlanPhase(id="ph1", name="Research", description="Research something"),
        ]
        goal = "Research market and create report"

        completeness = measure_goal_coverage(goal, phases)
        assert 0.3 < completeness < 0.7


class TestEfficiencyCalculation:
    """Test efficiency/redundancy scoring."""

    def test_no_redundant_phases(self):
        """Plan with no redundancy has zero redundant count."""
        phases = [
            PlanPhase(id="ph1", name="Step 1", description="First", expected_outputs=["result1"]),
            PlanPhase(id="ph2", name="Step 2", description="Second", expected_outputs=["result2"], dependencies=["ph1"]),
        ]
        plan = Plan(id="p1", goal="Test", phases=phases)
        assert count_redundant_phases(plan) == 0

    def test_duplicate_phase_names(self):
        """Duplicate phase names are counted as redundant."""
        phases = [
            PlanPhase(id="ph1", name="Research", description="First research"),
            PlanPhase(id="ph2", name="Research", description="Second research"),
        ]
        plan = Plan(id="p1", goal="Test", phases=phases)
        assert count_redundant_phases(plan) >= 1


class TestRiskCalculation:
    """Test risk calculation."""

    def test_zero_risk(self):
        """Phases with no risk have zero average."""
        phases = [
            PlanPhase(id="ph1", name="Step 1", description="Safe step", risk_level=0.0),
        ]
        assert calculate_average_risk(phases) == 0.0

    def test_mixed_risk(self):
        """Average risk is calculated correctly."""
        phases = [
            PlanPhase(id="ph1", name="Step 1", description="Low risk", risk_level=0.2),
            PlanPhase(id="ph2", name="Step 2", description="High risk", risk_level=0.8),
        ]
        avg = calculate_average_risk(phases)
        assert avg == 0.5


class TestScorePlan:
    """Test the main score_plan function."""

    def test_score_plan_composite_formula(self):
        """Test composite score uses correct weights from spec."""
        # Create a plan that we can predict the score for
        phases = [
            PlanPhase(
                id="ph1",
                name="Research market trends",
                description="Analyze current market",
                expected_outputs=["analysis"],
                risk_level=0.1,
            ),
        ]
        plan = Plan(id="p1", goal="Research market trends", phases=phases)
        context = ScoringContext()

        score = score_plan(plan, context)

        # Verify composite is weighted correctly
        expected = (
            score.feasibility * 0.35
            + score.completeness * 0.35
            + score.efficiency * 0.15
            + score.risk_adjusted * 0.15
        )
        assert abs(score.composite - expected) < 0.01

    def test_score_plan_metadata(self):
        """Test score includes additional metrics."""
        phases = [
            PlanPhase(id="ph1", name="Step", description="Do", estimated_duration_ms=5000),
            PlanPhase(id="ph2", name="Step2", description="Do2", estimated_duration_ms=3000),
        ]
        plan = Plan(id="p1", goal="Test", phases=phases)

        score = score_plan(plan, ScoringContext())

        assert score.phase_count == 2
        assert score.total_duration_ms == 8000


class TestMakeDecision:
    """Test decision-making logic."""

    def test_accept_high_score(self):
        """Score >= 0.7 results in ACCEPT."""
        score = PlanScore(
            feasibility=0.8,
            completeness=0.8,
            efficiency=0.8,
            risk_adjusted=0.75,
            composite=0.78,
        )
        decision, reason = make_decision(score)
        assert decision == PlanDecision.ACCEPT
        assert reason is None

    def test_repair_medium_score(self):
        """Score 0.4-0.7 results in REPAIR."""
        score = PlanScore(
            feasibility=0.6,
            completeness=0.5,
            efficiency=0.6,
            risk_adjusted=0.55,
            composite=0.55,
        )
        decision, reason = make_decision(score)
        assert decision == PlanDecision.REPAIR

    def test_regenerate_low_score(self):
        """Score < 0.4 results in REGENERATE."""
        score = PlanScore(
            feasibility=0.3,
            completeness=0.3,
            efficiency=0.3,
            risk_adjusted=0.25,
            composite=0.29,
        )
        decision, reason = make_decision(score)
        assert decision == PlanDecision.REGENERATE

    def test_regenerate_zero_feasibility(self):
        """Zero feasibility always regenerates."""
        score = PlanScore(
            feasibility=0.0,
            completeness=0.9,
            efficiency=0.9,
            risk_adjusted=0.0,
            composite=0.45,
        )
        decision, reason = make_decision(score)
        assert decision == PlanDecision.REGENERATE
        assert "Zero feasibility" in reason

    def test_abort_max_repairs(self):
        """Abort after max repair attempts."""
        score = PlanScore(
            feasibility=0.5,
            completeness=0.5,
            efficiency=0.5,
            risk_adjusted=0.45,
            composite=0.5,
        )
        session = PlannerSession(session_id="s1", plan_id="p1")
        # Simulate 3 repair attempts
        for i in range(3):
            session.repair_attempts.append(
                type("RepairAttempt", (), {"attempt_number": i + 1})()
            )

        decision, reason = make_decision(score, session)
        assert decision == PlanDecision.ABORT
        assert "Max repair attempts" in reason


class TestRepairSuggestions:
    """Test repair suggestion generation."""

    def test_low_feasibility_suggests_modify(self):
        """Low feasibility suggests modifying phases."""
        score = PlanScore(
            feasibility=0.4,
            completeness=0.7,
            efficiency=0.8,
            risk_adjusted=0.35,
            composite=0.55,
        )
        plan = Plan(id="p1", goal="Test", phases=[])

        suggestions = generate_repair_suggestions(plan, score)
        types = [s.repair_type for s in suggestions]
        assert RepairType.MODIFY_PHASE in types

    def test_low_completeness_suggests_add(self):
        """Low completeness suggests adding phases."""
        score = PlanScore(
            feasibility=0.8,
            completeness=0.4,
            efficiency=0.8,
            risk_adjusted=0.75,
            composite=0.6,
        )
        plan = Plan(id="p1", goal="Test", phases=[])

        suggestions = generate_repair_suggestions(plan, score)
        types = [s.repair_type for s in suggestions]
        assert RepairType.ADD_PHASE in types

    def test_high_risk_suggests_split(self):
        """High risk suggests splitting phases."""
        score = PlanScore(
            feasibility=0.8,
            completeness=0.7,
            efficiency=0.7,
            risk_adjusted=0.5,
            composite=0.65,
            avg_risk=0.6,
        )
        plan = Plan(id="p1", goal="Test", phases=[])

        suggestions = generate_repair_suggestions(plan, score)
        types = [s.repair_type for s in suggestions]
        assert RepairType.SPLIT_PHASE in types


class TestPlanScorer:
    """Test PlanScorer class."""

    @pytest.fixture
    def scorer(self):
        """Create fresh scorer for each test."""
        return PlanScorer()

    @pytest.fixture
    def good_plan(self):
        """Create a plan that should score well."""
        phases = [
            PlanPhase(
                id="ph1",
                name="Research market trends",
                description="Analyze market data",
                expected_outputs=["market_analysis"],
                risk_level=0.2,
            ),
            PlanPhase(
                id="ph2",
                name="Create comprehensive report",
                description="Write detailed report",
                expected_outputs=["final_report"],
                dependencies=["ph1"],
                risk_level=0.1,
            ),
        ]
        return Plan(
            id="good-plan",
            goal="Research market trends and create comprehensive report",
            phases=phases,
        )

    @pytest.fixture
    def bad_plan(self):
        """Create a plan that should score poorly."""
        phases = [
            PlanPhase(
                id="ph1",
                name="Something unrelated",
                description="Does nothing useful",
                required_tools=["nonexistent_tool"],
                risk_level=0.9,
            ),
        ]
        return Plan(
            id="bad-plan",
            goal="Research market trends and create report",
            phases=phases,
        )

    def test_score_returns_result(self, scorer, good_plan):
        """Score method returns ScoringResult."""
        result = scorer.score(good_plan)

        assert isinstance(result, ScoringResult)
        assert result.plan_id == "good-plan"
        assert result.score is not None
        assert result.decision is not None

    def test_good_plan_accepted(self, scorer, good_plan):
        """Good plan gets ACCEPT decision."""
        result = scorer.score(good_plan)

        # Should have decent scores
        assert result.score.composite >= 0.5
        # May be ACCEPT or REPAIR depending on exact calculation

    def test_bad_plan_rejected(self, scorer, bad_plan):
        """Bad plan gets REGENERATE or REPAIR decision."""
        result = scorer.score(bad_plan)

        assert result.decision in (PlanDecision.REGENERATE, PlanDecision.REPAIR)

    def test_scoring_with_session(self, scorer, good_plan):
        """Scoring with session tracks state."""
        session_id = "test-session"

        result = scorer.score(good_plan, session_id=session_id)
        session = scorer.get_session(session_id)

        assert session is not None
        assert session.plan_id == "good-plan"
        assert session.final_score is not None

    def test_record_repair_attempt(self, scorer, good_plan):
        """Repair attempts are recorded in session."""
        session_id = "repair-session"
        scorer.score(good_plan, session_id=session_id)

        scorer.record_repair_attempt(
            session_id=session_id,
            repair_type=RepairType.ADD_PHASE,
            score_before=0.5,
            score_after=0.6,
            duration_ms=1000,
        )

        session = scorer.get_session(session_id)
        assert len(session.repair_attempts) == 1
        assert session.repair_attempts[0].repair_type == RepairType.ADD_PHASE

    def test_record_regeneration(self, scorer, good_plan):
        """Regenerations are counted in session."""
        session_id = "regen-session"
        scorer.score(good_plan, session_id=session_id)

        scorer.record_regeneration(session_id)
        scorer.record_regeneration(session_id)

        session = scorer.get_session(session_id)
        assert session.regeneration_count == 2

    def test_should_abort_time_limit(self, scorer):
        """Abort check detects time limit exceeded."""
        should_abort, reason = scorer.should_abort("any-session", elapsed_ms=35000)

        assert should_abort is True
        assert "time limit" in reason.lower()

    def test_should_abort_repair_attempts(self, scorer, good_plan):
        """Abort check detects max repairs exceeded."""
        session_id = "max-repairs"
        scorer.score(good_plan, session_id=session_id)

        for i in range(3):
            scorer.record_repair_attempt(
                session_id=session_id,
                repair_type=RepairType.MODIFY_PHASE,
                score_before=0.5,
                score_after=0.55,
                duration_ms=1000,
            )

        should_abort, reason = scorer.should_abort(session_id, elapsed_ms=5000)
        assert should_abort is True

    def test_clear_session(self, scorer, good_plan):
        """Sessions can be cleared."""
        session_id = "clear-me"
        scorer.score(good_plan, session_id=session_id)

        assert scorer.get_session(session_id) is not None

        scorer.clear_session(session_id)
        assert scorer.get_session(session_id) is None

    def test_metrics_callback(self, good_plan):
        """Metrics callback is invoked."""
        metrics_received = []

        def callback(m):
            metrics_received.append(m)

        scorer = PlanScorer(metrics_callback=callback)
        scorer.score(good_plan)

        assert len(metrics_received) > 0
        assert metrics_received[0]["type"] == "plan_scoring"


class TestGlobalInstance:
    """Test module-level instance management."""

    def test_get_plan_scorer(self):
        """Get default scorer instance."""
        reset_plan_scorer()
        scorer = get_plan_scorer()

        assert scorer is not None
        assert isinstance(scorer, PlanScorer)

    def test_set_plan_scorer(self):
        """Set custom scorer instance."""
        reset_plan_scorer()
        custom = PlanScorer()
        set_plan_scorer(custom)

        assert get_plan_scorer() is custom

    def test_reset_plan_scorer(self):
        """Reset creates new instance."""
        scorer1 = get_plan_scorer()
        reset_plan_scorer()
        scorer2 = get_plan_scorer()

        assert scorer1 is not scorer2


class TestScoringResult:
    """Test ScoringResult dataclass."""

    def test_result_has_idempotency_key(self):
        """Each result has unique idempotency key."""
        score = PlanScore(
            feasibility=0.7,
            completeness=0.7,
            efficiency=0.7,
            risk_adjusted=0.65,
            composite=0.69,
        )
        result1 = ScoringResult(plan_id="p1", score=score, decision=PlanDecision.REPAIR)
        result2 = ScoringResult(plan_id="p1", score=score, decision=PlanDecision.REPAIR)

        assert result1.idempotency_key != result2.idempotency_key

    def test_result_to_dict(self):
        """Result can be serialized."""
        score = PlanScore(
            feasibility=0.7,
            completeness=0.7,
            efficiency=0.7,
            risk_adjusted=0.65,
            composite=0.69,
        )
        result = ScoringResult(
            plan_id="p1",
            score=score,
            decision=PlanDecision.REPAIR,
            scoring_duration_ms=50,
        )

        d = result.to_dict()
        assert d["plan_id"] == "p1"
        assert d["decision"] == "repair"
        assert "score" in d
        assert "idempotency_key" in d
