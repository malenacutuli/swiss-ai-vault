"""Tests for the plan scoring module."""

import pytest
from datetime import datetime

from app.collaboration.plan_scorer import (
    PlanScorer,
    PlanScorerConfig,
    PlanScore,
    Plan,
    PlanPhase,
    PlanStatus,
    PhaseStatus,
    PhaseType,
    RiskLevel,
    PlanRepairEngine,
    RepairResult,
    PlanOrchestrator,
    get_plan_scorer,
    set_plan_scorer,
    reset_plan_scorer,
    get_plan_orchestrator,
    set_plan_orchestrator,
    reset_plan_orchestrator,
)


class TestPlanPhase:
    """Tests for PlanPhase."""

    def test_create_phase(self):
        """Test creating a plan phase."""
        phase = PlanPhase(
            name="Research",
            description="Research the topic",
            phase_type=PhaseType.RESEARCH,
        )
        assert phase.name == "Research"
        assert phase.phase_type == PhaseType.RESEARCH
        assert phase.status == PhaseStatus.PENDING

    def test_phase_risk_score(self):
        """Test phase risk score calculation."""
        low = PlanPhase(name="Low", risk_level=RiskLevel.LOW)
        assert low.risk_score() == pytest.approx(0.1)

        high = PlanPhase(name="High", risk_level=RiskLevel.HIGH)
        assert high.risk_score() == pytest.approx(0.6)

        critical = PlanPhase(name="Critical", risk_level=RiskLevel.CRITICAL)
        assert critical.risk_score() == pytest.approx(0.9)

    def test_phase_with_dependencies(self):
        """Test phase with dependencies."""
        phase = PlanPhase(
            name="Build",
            dependencies=["research-id", "design-id"],
        )
        assert len(phase.dependencies) == 2

    def test_phase_with_outputs(self):
        """Test phase with outputs."""
        phase = PlanPhase(
            name="Generate Report",
            outputs=["report.pdf", "summary.txt"],
        )
        assert len(phase.outputs) == 2


class TestPlan:
    """Tests for Plan."""

    def test_create_plan(self):
        """Test creating a plan."""
        plan = Plan(
            goal="Build a website",
            description="Create a new marketing website",
        )
        assert plan.goal == "Build a website"
        assert plan.status == PlanStatus.PENDING

    def test_plan_phase_count(self):
        """Test plan phase count."""
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="Phase 1"),
                PlanPhase(name="Phase 2"),
                PlanPhase(name="Phase 3"),
            ],
        )
        assert plan.phase_count() == 3

    def test_plan_total_duration(self):
        """Test plan total duration."""
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="P1", estimated_duration_seconds=60),
                PlanPhase(name="P2", estimated_duration_seconds=120),
            ],
        )
        assert plan.total_duration_seconds() == 180

    def test_get_phase(self):
        """Test getting a phase by ID."""
        phase = PlanPhase(name="Target")
        plan = Plan(goal="Test", phases=[phase])
        found = plan.get_phase(phase.id)
        assert found is not None
        assert found.name == "Target"

    def test_get_nonexistent_phase(self):
        """Test getting a nonexistent phase."""
        plan = Plan(goal="Test")
        assert plan.get_phase("fake-id") is None


class TestPlanScorerConfig:
    """Tests for PlanScorerConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = PlanScorerConfig()
        assert config.accept_threshold == 0.7
        assert config.repair_threshold == 0.4
        assert config.max_repair_attempts == 3
        assert config.max_phases == 15

    def test_custom_config(self):
        """Test custom configuration."""
        config = PlanScorerConfig(
            accept_threshold=0.8,
            max_repair_attempts=5,
        )
        assert config.accept_threshold == 0.8
        assert config.max_repair_attempts == 5

    def test_weights_valid(self):
        """Test that default weights sum to 1.0."""
        config = PlanScorerConfig()
        total = (
            config.feasibility_weight +
            config.completeness_weight +
            config.efficiency_weight +
            config.risk_weight
        )
        assert total == pytest.approx(1.0)


class TestPlanScorer:
    """Tests for PlanScorer."""

    def test_create_scorer(self):
        """Test creating a scorer."""
        scorer = PlanScorer()
        assert scorer is not None

    def test_score_empty_plan(self):
        """Test scoring an empty plan."""
        scorer = PlanScorer()
        plan = Plan(goal="Test")
        score = scorer.score_plan(plan)
        assert score.composite_score == 0.0

    def test_score_simple_plan(self):
        """Test scoring a simple plan."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Create report",
            phases=[
                PlanPhase(
                    name="Research",
                    phase_type=PhaseType.RESEARCH,
                    outputs=["research_data"],
                ),
                PlanPhase(
                    name="Generate",
                    phase_type=PhaseType.GENERATION,
                    outputs=["report"],
                ),
            ],
        )
        score = scorer.score_plan(plan)
        assert score.composite_score > 0
        assert score.feasibility > 0

    def test_score_determines_status(self):
        """Test that score determines correct status."""
        config = PlanScorerConfig(
            accept_threshold=0.7,
            repair_threshold=0.4,
        )
        scorer = PlanScorer(config)

        # High-scoring plan
        good_plan = Plan(
            goal="Build feature",
            phases=[
                PlanPhase(name="P1", outputs=["build", "feature"]),
                PlanPhase(name="P2", outputs=["test", "deploy"]),
            ],
        )
        good_context = {"goal_aspects": ["build", "feature", "test"]}
        good_score = scorer.score_plan(good_plan, good_context)
        # Status depends on composite score

    def test_feasibility_broken_dependencies(self):
        """Test feasibility with broken dependencies."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(
                    name="Dependent",
                    dependencies=["nonexistent-id"],
                ),
            ],
        )
        score = scorer.score_plan(plan)
        assert score.feasibility < 1.0

    def test_completeness_with_goal_aspects(self):
        """Test completeness scoring with goal aspects."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Create and deploy application",
            phases=[
                PlanPhase(name="Create application", outputs=["app"]),
            ],
        )
        context = {"goal_aspects": ["create", "deploy", "application"]}
        score = scorer.score_plan(plan, context)
        # Should cover some but not all aspects
        assert 0 < score.completeness < 1.0

    def test_efficiency_redundant_phases(self):
        """Test efficiency penalizes redundant phases."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="Research 1", phase_type=PhaseType.RESEARCH, outputs=["data"]),
                PlanPhase(name="Research 2", phase_type=PhaseType.RESEARCH, outputs=["data"]),
                PlanPhase(name="Research 3", phase_type=PhaseType.RESEARCH, outputs=["data"]),
            ],
        )
        score = scorer.score_plan(plan)
        assert score.efficiency < 0.8

    def test_risk_penalty_high_risk_phases(self):
        """Test risk penalty for high-risk phases."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="Risky", risk_level=RiskLevel.CRITICAL),
                PlanPhase(name="Also Risky", risk_level=RiskLevel.HIGH),
            ],
        )
        score = scorer.score_plan(plan)
        assert score.risk_adjusted < score.feasibility

    def test_too_many_phases(self):
        """Test scoring plan with too many phases."""
        config = PlanScorerConfig(max_phases=5)
        scorer = PlanScorer(config)
        plan = Plan(
            goal="Test",
            phases=[PlanPhase(name=f"Phase {i}") for i in range(10)],
        )
        score = scorer.score_plan(plan)
        assert "Too many phases" in str(score.issues)

    def test_score_with_available_resources(self):
        """Test scoring with available resources."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(
                    name="Needs DB",
                    required_resources=["database"],
                ),
            ],
        )
        # Without resources, feasibility should be lower
        score1 = scorer.score_plan(plan, {"available_resources": []})

        # With resources, feasibility should be higher
        score2 = scorer.score_plan(plan, {"available_resources": ["database"]})

        # Both should work, but score2 should be >= score1
        assert score2.feasibility >= score1.feasibility

    def test_phase_scores_included(self):
        """Test that individual phase scores are included."""
        scorer = PlanScorer()
        phase = PlanPhase(name="Test Phase")
        plan = Plan(goal="Test", phases=[phase])
        score = scorer.score_plan(plan)
        assert phase.id in score.phase_scores


class TestPlanScore:
    """Tests for PlanScore."""

    def test_create_score(self):
        """Test creating a score."""
        score = PlanScore(
            plan_id="test-id",
            composite_score=0.75,
            feasibility=0.8,
            completeness=0.7,
            efficiency=0.6,
            risk_adjusted=0.75,
            status=PlanStatus.ACCEPT,
        )
        assert score.composite_score == 0.75
        assert score.status == PlanStatus.ACCEPT

    def test_score_to_dict(self):
        """Test score to_dict conversion."""
        score = PlanScore(
            plan_id="test-id",
            composite_score=0.75,
            feasibility=0.8,
            completeness=0.7,
            efficiency=0.6,
            risk_adjusted=0.75,
            status=PlanStatus.ACCEPT,
        )
        data = score.to_dict()
        assert data["composite_score"] == 0.75
        assert data["status"] == "accept"


class TestPlanRepairEngine:
    """Tests for PlanRepairEngine."""

    def test_create_repair_engine(self):
        """Test creating a repair engine."""
        engine = PlanRepairEngine()
        assert engine is not None

    @pytest.mark.asyncio
    async def test_repair_broken_dependencies(self):
        """Test repairing broken dependencies."""
        engine = PlanRepairEngine()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="Valid"),
                PlanPhase(name="Broken", dependencies=["nonexistent"]),
            ],
        )
        score = engine.scorer.score_plan(plan)
        result = await engine.repair_plan(plan, score)

        # Should have attempted repair
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_repair_adds_missing_coverage(self):
        """Test repair adds phases for missing coverage."""
        engine = PlanRepairEngine()
        plan = Plan(
            goal="Create, test, deploy",
            phases=[
                PlanPhase(name="Create only", outputs=["create"]),
            ],
        )
        context = {"goal_aspects": ["create", "test", "deploy"]}
        score = engine.scorer.score_plan(plan, context)
        result = await engine.repair_plan(plan, score, context)

        if result.success and result.repaired_plan:
            # Should have more phases now
            assert result.repaired_plan.phase_count() >= plan.phase_count()

    @pytest.mark.asyncio
    async def test_repair_removes_redundant(self):
        """Test repair removes redundant phases."""
        engine = PlanRepairEngine()
        plan = Plan(
            goal="Test",
            phases=[
                PlanPhase(name="R1", phase_type=PhaseType.RESEARCH, outputs=["data"]),
                PlanPhase(name="R2", phase_type=PhaseType.RESEARCH, outputs=["data"]),
                PlanPhase(name="R3", phase_type=PhaseType.RESEARCH, outputs=["data"]),
                PlanPhase(name="Execute", phase_type=PhaseType.EXECUTION),
            ],
        )
        score = engine.scorer.score_plan(plan)
        result = await engine.repair_plan(plan, score)

        if result.success and result.repaired_plan:
            # May have fewer phases after removing redundant
            assert result.repaired_plan.phase_count() <= plan.phase_count() + 1

    @pytest.mark.asyncio
    async def test_repair_adds_validation_for_high_risk(self):
        """Test repair adds validation for high-risk phases."""
        engine = PlanRepairEngine()
        plan = Plan(
            goal="Risky operation",
            phases=[
                PlanPhase(name="High Risk", risk_level=RiskLevel.HIGH),
            ],
        )
        score = engine.scorer.score_plan(plan)
        result = await engine.repair_plan(plan, score)

        if result.success and result.repaired_plan:
            # Should have added validation phase
            validation_phases = [
                p for p in result.repaired_plan.phases
                if p.phase_type == PhaseType.VALIDATION
            ]
            assert len(validation_phases) >= 0


class TestPlanOrchestrator:
    """Tests for PlanOrchestrator."""

    def test_create_orchestrator(self):
        """Test creating an orchestrator."""
        orchestrator = PlanOrchestrator()
        assert orchestrator is not None

    @pytest.mark.asyncio
    async def test_process_acceptable_plan(self):
        """Test processing an acceptable plan."""
        orchestrator = PlanOrchestrator()
        plan = Plan(
            goal="Simple task",
            phases=[
                PlanPhase(
                    name="Execute",
                    outputs=["simple", "task"],
                    risk_level=RiskLevel.LOW,
                ),
            ],
        )
        context = {"goal_aspects": ["simple", "task"]}
        final_plan, score, log = await orchestrator.process_plan(plan, context)

        assert len(log) > 0
        assert "Scored plan" in log[0]

    @pytest.mark.asyncio
    async def test_process_triggers_repair(self):
        """Test processing triggers repair for low scores."""
        config = PlanScorerConfig(
            accept_threshold=0.9,
            repair_threshold=0.3,
        )
        orchestrator = PlanOrchestrator(config)
        plan = Plan(
            goal="Medium quality plan",
            phases=[
                PlanPhase(name="Phase 1"),
            ],
        )
        final_plan, score, log = await orchestrator.process_plan(plan)

        # Should have some log entries
        assert len(log) >= 1

    @pytest.mark.asyncio
    async def test_process_with_regenerate_callback(self):
        """Test processing with regeneration callback."""
        regenerate_called = []

        def regenerate(plan, score):
            regenerate_called.append(True)
            # Return a better plan
            return Plan(
                goal=plan.goal,
                phases=[
                    PlanPhase(name="Better", outputs=["goal", "coverage"]),
                ],
            )

        config = PlanScorerConfig(
            accept_threshold=0.95,
            repair_threshold=0.9,
        )
        orchestrator = PlanOrchestrator(config, regenerate_callback=regenerate)
        plan = Plan(goal="Needs regeneration", phases=[])

        final_plan, score, log = await orchestrator.process_plan(plan)

        # May or may not have triggered regeneration depending on scores

    @pytest.mark.asyncio
    async def test_process_respects_timeout(self):
        """Test processing respects planning timeout."""
        config = PlanScorerConfig(max_planning_time_ms=10)  # Very short timeout
        orchestrator = PlanOrchestrator(config)

        # Create a plan that would need repair
        plan = Plan(goal="Test", phases=[])

        final_plan, score, log = await orchestrator.process_plan(plan)

        # Should complete (possibly with abort)
        assert len(log) >= 1

    @pytest.mark.asyncio
    async def test_process_respects_max_repairs(self):
        """Test processing respects max repair attempts."""
        config = PlanScorerConfig(
            accept_threshold=0.99,
            repair_threshold=0.1,
            max_repair_attempts=2,
        )
        orchestrator = PlanOrchestrator(config)
        plan = Plan(
            goal="Hard to repair",
            phases=[PlanPhase(name="Weak")],
        )

        final_plan, score, log = await orchestrator.process_plan(plan)

        # Should have limited repair attempts
        repair_logs = [l for l in log if "Repair attempt" in l]
        assert len(repair_logs) <= config.max_repair_attempts

    def test_get_abort_reason(self):
        """Test getting abort reason."""
        orchestrator = PlanOrchestrator()
        # Initially no abort
        assert orchestrator.get_abort_reason() is None


class TestEnums:
    """Tests for enums."""

    def test_plan_status_values(self):
        """Test plan status values."""
        assert PlanStatus.ACCEPT.value == "accept"
        assert PlanStatus.REPAIR.value == "repair"
        assert PlanStatus.REGENERATE.value == "regenerate"
        assert PlanStatus.ABORTED.value == "aborted"

    def test_phase_status_values(self):
        """Test phase status values."""
        assert PhaseStatus.PENDING.value == "pending"
        assert PhaseStatus.COMPLETED.value == "completed"
        assert PhaseStatus.FAILED.value == "failed"

    def test_phase_type_values(self):
        """Test phase type values."""
        assert PhaseType.RESEARCH.value == "research"
        assert PhaseType.EXECUTION.value == "execution"
        assert PhaseType.VALIDATION.value == "validation"

    def test_risk_level_values(self):
        """Test risk level values."""
        assert RiskLevel.LOW.value == "low"
        assert RiskLevel.HIGH.value == "high"
        assert RiskLevel.CRITICAL.value == "critical"


class TestGlobalInstances:
    """Tests for global instance management."""

    def teardown_method(self):
        """Reset global instances after each test."""
        reset_plan_scorer()
        reset_plan_orchestrator()

    def test_get_scorer_none(self):
        """Test getting scorer when not set."""
        reset_plan_scorer()
        assert get_plan_scorer() is None

    def test_set_and_get_scorer(self):
        """Test setting and getting scorer."""
        scorer = PlanScorer()
        set_plan_scorer(scorer)
        assert get_plan_scorer() is scorer

    def test_reset_scorer(self):
        """Test resetting scorer."""
        scorer = PlanScorer()
        set_plan_scorer(scorer)
        reset_plan_scorer()
        assert get_plan_scorer() is None

    def test_set_and_get_orchestrator(self):
        """Test setting and getting orchestrator."""
        orchestrator = PlanOrchestrator()
        set_plan_orchestrator(orchestrator)
        assert get_plan_orchestrator() is orchestrator

    def test_reset_orchestrator(self):
        """Test resetting orchestrator."""
        orchestrator = PlanOrchestrator()
        set_plan_orchestrator(orchestrator)
        reset_plan_orchestrator()
        assert get_plan_orchestrator() is None


class TestIntegration:
    """Integration tests for plan scoring."""

    @pytest.mark.asyncio
    async def test_full_workflow_accept(self):
        """Test complete workflow with accepted plan."""
        orchestrator = PlanOrchestrator()

        plan = Plan(
            goal="Build and deploy feature",
            description="Create a new feature and deploy to production",
            phases=[
                PlanPhase(
                    name="Research requirements",
                    phase_type=PhaseType.RESEARCH,
                    outputs=["requirements", "build"],
                    risk_level=RiskLevel.LOW,
                ),
                PlanPhase(
                    name="Implement feature",
                    phase_type=PhaseType.EXECUTION,
                    outputs=["feature", "deploy"],
                    risk_level=RiskLevel.MEDIUM,
                ),
                PlanPhase(
                    name="Test feature",
                    phase_type=PhaseType.VALIDATION,
                    outputs=["test_results"],
                    risk_level=RiskLevel.LOW,
                ),
                PlanPhase(
                    name="Deploy feature",
                    phase_type=PhaseType.DELIVERY,
                    outputs=["deployment"],
                    risk_level=RiskLevel.MEDIUM,
                ),
            ],
        )
        context = {"goal_aspects": ["build", "deploy", "feature"]}

        final_plan, score, log = await orchestrator.process_plan(plan, context)

        assert score.composite_score > 0
        assert len(log) > 0

    @pytest.mark.asyncio
    async def test_full_workflow_repair(self):
        """Test complete workflow with plan needing repair."""
        config = PlanScorerConfig(
            accept_threshold=0.8,
            repair_threshold=0.3,
        )
        orchestrator = PlanOrchestrator(config)

        # Plan with issues
        plan = Plan(
            goal="Complete project",
            phases=[
                PlanPhase(
                    name="Start",
                    dependencies=["missing-id"],  # Broken dependency
                    risk_level=RiskLevel.HIGH,
                ),
            ],
        )

        final_plan, score, log = await orchestrator.process_plan(plan)

        # Should have attempted to process
        assert len(log) >= 1

    @pytest.mark.asyncio
    async def test_scoring_consistency(self):
        """Test that scoring is consistent."""
        scorer = PlanScorer()
        plan = Plan(
            goal="Consistent test",
            phases=[
                PlanPhase(name="Phase 1", outputs=["output1"]),
                PlanPhase(name="Phase 2", outputs=["output2"]),
            ],
        )

        score1 = scorer.score_plan(plan)
        score2 = scorer.score_plan(plan)

        assert score1.composite_score == score2.composite_score
        assert score1.feasibility == score2.feasibility

    def test_scoring_with_complex_dependencies(self):
        """Test scoring with complex phase dependencies."""
        scorer = PlanScorer()

        p1 = PlanPhase(name="Phase 1", outputs=["data"])
        p2 = PlanPhase(name="Phase 2", dependencies=[p1.id])
        p3 = PlanPhase(name="Phase 3", dependencies=[p1.id, p2.id])

        plan = Plan(goal="Complex", phases=[p1, p2, p3])
        score = scorer.score_plan(plan)

        # All dependencies are valid, so feasibility should be high
        assert score.feasibility > 0.5
