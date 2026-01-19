"""
Tests for Goals & OKRs module.

This module tests:
- Goal and objective data models
- Key results and metrics tracking
- Check-ins and progress updates
- Goal alignment and cascading
- Goal cycles
- GoalManager high-level API
"""

import pytest
from datetime import datetime, date, timedelta

from app.collaboration.goals import (
    GoalManager,
    GoalRegistry,
    Goal,
    GoalStatus,
    GoalType,
    GoalLevel,
    GoalPriority,
    GoalPeriod,
    KeyResult,
    KeyResultType,
    CheckIn,
    CheckInStatus,
    GoalAlignment,
    GoalCycle,
    get_goal_manager,
    set_goal_manager,
    reset_goal_manager,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def registry():
    """Create a goal registry."""
    return GoalRegistry()


@pytest.fixture
def manager():
    """Create a goal manager."""
    return GoalManager()


@pytest.fixture
def goal(registry):
    """Create a sample goal."""
    return registry.create_goal(
        title="Increase Revenue",
        owner_id="user-1",
        goal_type=GoalType.OBJECTIVE,
        level=GoalLevel.COMPANY,
        priority=GoalPriority.HIGH,
        period=GoalPeriod.QUARTERLY,
        description="Grow quarterly revenue by 25%",
        workspace_id="ws-1",
    )


@pytest.fixture
def key_result(registry, goal):
    """Create a sample key result."""
    return registry.add_key_result(
        objective_id=goal.id,
        title="Revenue Target",
        owner_id="user-1",
        result_type=KeyResultType.CURRENCY,
        start_value=1000000,
        target_value=1250000,
        unit="USD",
    )


# ============================================================================
# Goal Status Tests
# ============================================================================

class TestGoalStatus:
    """Tests for GoalStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        assert GoalStatus.DRAFT.value == "draft"
        assert GoalStatus.ACTIVE.value == "active"
        assert GoalStatus.ON_TRACK.value == "on_track"
        assert GoalStatus.AT_RISK.value == "at_risk"
        assert GoalStatus.BEHIND.value == "behind"
        assert GoalStatus.COMPLETED.value == "completed"
        assert GoalStatus.CANCELLED.value == "cancelled"
        assert GoalStatus.DEFERRED.value == "deferred"

    def test_status_count(self):
        """Test all status types exist."""
        assert len(GoalStatus) == 8


class TestGoalType:
    """Tests for GoalType enum."""

    def test_type_values(self):
        """Test type enum values."""
        assert GoalType.OBJECTIVE.value == "objective"
        assert GoalType.KEY_RESULT.value == "key_result"
        assert GoalType.INITIATIVE.value == "initiative"
        assert GoalType.MILESTONE.value == "milestone"
        assert GoalType.TASK.value == "task"


class TestGoalLevel:
    """Tests for GoalLevel enum."""

    def test_level_values(self):
        """Test level enum values."""
        assert GoalLevel.COMPANY.value == "company"
        assert GoalLevel.DEPARTMENT.value == "department"
        assert GoalLevel.TEAM.value == "team"
        assert GoalLevel.INDIVIDUAL.value == "individual"


class TestGoalPriority:
    """Tests for GoalPriority enum."""

    def test_priority_values(self):
        """Test priority enum values."""
        assert GoalPriority.LOW.value == "low"
        assert GoalPriority.MEDIUM.value == "medium"
        assert GoalPriority.HIGH.value == "high"
        assert GoalPriority.CRITICAL.value == "critical"


class TestKeyResultType:
    """Tests for KeyResultType enum."""

    def test_kr_type_values(self):
        """Test key result type values."""
        assert KeyResultType.NUMBER.value == "number"
        assert KeyResultType.PERCENTAGE.value == "percentage"
        assert KeyResultType.CURRENCY.value == "currency"
        assert KeyResultType.BOOLEAN.value == "boolean"
        assert KeyResultType.MILESTONE.value == "milestone"


# ============================================================================
# KeyResult Tests
# ============================================================================

class TestKeyResult:
    """Tests for KeyResult class."""

    def test_key_result_creation(self):
        """Test key result creation."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Revenue Target",
            owner_id="user-1",
            result_type=KeyResultType.CURRENCY,
            start_value=1000000,
            target_value=1250000,
            unit="USD",
        )

        assert kr.id == "kr-1"
        assert kr.objective_id == "obj-1"
        assert kr.title == "Revenue Target"
        assert kr.result_type == KeyResultType.CURRENCY
        assert kr.start_value == 1000000
        assert kr.target_value == 1250000
        assert kr.unit == "USD"

    def test_key_result_progress_percentage(self):
        """Test progress calculation for percentage type."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Progress",
            owner_id="user-1",
            result_type=KeyResultType.PERCENTAGE,
            start_value=0,
            target_value=100,
            current_value=50,
        )

        assert kr.progress == 50.0

    def test_key_result_progress_numeric(self):
        """Test progress calculation for numeric type."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Users",
            owner_id="user-1",
            result_type=KeyResultType.NUMBER,
            start_value=100,
            target_value=200,
            current_value=150,
        )

        assert kr.progress == 50.0

    def test_key_result_progress_boolean(self):
        """Test progress calculation for boolean type."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Launch feature",
            owner_id="user-1",
            result_type=KeyResultType.BOOLEAN,
            start_value=0,
            target_value=1,
            current_value=0,
        )

        assert kr.progress == 0.0

        kr.current_value = 1
        assert kr.progress == 100.0

    def test_key_result_is_complete(self):
        """Test is_complete property."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Target",
            owner_id="user-1",
            result_type=KeyResultType.NUMBER,
            start_value=0,
            target_value=100,
            current_value=50,
        )

        assert kr.is_complete is False

        kr.current_value = 100
        assert kr.is_complete is True

    def test_key_result_update_value(self):
        """Test value update."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Target",
            owner_id="user-1",
            result_type=KeyResultType.PERCENTAGE,
            target_value=100,
            current_value=0,
        )

        kr.update_value(50)
        assert kr.current_value == 50
        assert kr.updated_at is not None

    def test_key_result_complete_on_target(self):
        """Test auto-completion when target reached."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Target",
            owner_id="user-1",
            result_type=KeyResultType.PERCENTAGE,
            target_value=100,
            current_value=0,
        )

        kr.update_value(100)
        assert kr.status == GoalStatus.COMPLETED
        assert kr.completed_at is not None

    def test_key_result_to_dict(self):
        """Test dictionary conversion."""
        kr = KeyResult(
            id="kr-1",
            objective_id="obj-1",
            title="Target",
            owner_id="user-1",
            result_type=KeyResultType.PERCENTAGE,
            target_value=100,
            current_value=50,
        )

        data = kr.to_dict()
        assert data["id"] == "kr-1"
        assert data["progress"] == 50.0
        assert data["is_complete"] is False


# ============================================================================
# Goal Tests
# ============================================================================

class TestGoal:
    """Tests for Goal class."""

    def test_goal_creation(self, goal):
        """Test goal creation."""
        assert goal.title == "Increase Revenue"
        assert goal.owner_id == "user-1"
        assert goal.goal_type == GoalType.OBJECTIVE
        assert goal.level == GoalLevel.COMPANY
        assert goal.priority == GoalPriority.HIGH
        assert goal.period == GoalPeriod.QUARTERLY
        assert goal.status == GoalStatus.DRAFT

    def test_goal_activate(self, goal):
        """Test goal activation."""
        goal.activate()
        assert goal.status == GoalStatus.ACTIVE
        assert goal.updated_at is not None

    def test_goal_complete(self, goal):
        """Test goal completion."""
        goal.complete(score=0.8)
        assert goal.status == GoalStatus.COMPLETED
        assert goal.score == 0.8
        assert goal.completed_at is not None

    def test_goal_cancel(self, goal):
        """Test goal cancellation."""
        goal.cancel()
        assert goal.status == GoalStatus.CANCELLED

    def test_goal_defer(self, goal):
        """Test goal deferral."""
        goal.defer()
        assert goal.status == GoalStatus.DEFERRED

    def test_goal_progress_on_track(self, goal):
        """Test progress update - on track."""
        goal.activate()
        goal.update_progress(75.0)
        assert goal.progress == 75.0
        assert goal.status == GoalStatus.ON_TRACK

    def test_goal_progress_at_risk(self, goal):
        """Test progress update - at risk."""
        goal.activate()
        goal.update_progress(50.0)
        assert goal.status == GoalStatus.AT_RISK

    def test_goal_progress_behind(self, goal):
        """Test progress update - behind."""
        goal.activate()
        goal.update_progress(30.0)
        assert goal.status == GoalStatus.BEHIND

    def test_goal_progress_complete(self, goal):
        """Test progress update - complete."""
        goal.activate()
        goal.update_progress(100.0)
        assert goal.status == GoalStatus.COMPLETED
        assert goal.completed_at is not None

    def test_goal_is_overdue(self, registry):
        """Test overdue detection."""
        goal = registry.create_goal(
            title="Overdue Goal",
            owner_id="user-1",
            end_date=date.today() - timedelta(days=1),
        )
        goal.activate()

        assert goal.is_overdue is True

    def test_goal_not_overdue_when_complete(self, registry):
        """Test completed goal not marked overdue."""
        goal = registry.create_goal(
            title="Completed Goal",
            owner_id="user-1",
            end_date=date.today() - timedelta(days=1),
        )
        goal.complete()

        assert goal.is_overdue is False

    def test_goal_days_remaining(self, registry):
        """Test days remaining calculation."""
        goal = registry.create_goal(
            title="Future Goal",
            owner_id="user-1",
            end_date=date.today() + timedelta(days=10),
        )

        assert goal.days_remaining == 10

    def test_goal_to_dict(self, goal):
        """Test dictionary conversion."""
        data = goal.to_dict()
        assert data["id"] == goal.id
        assert data["title"] == "Increase Revenue"
        assert data["goal_type"] == "objective"
        assert data["level"] == "company"


# ============================================================================
# CheckIn Tests
# ============================================================================

class TestCheckIn:
    """Tests for CheckIn class."""

    def test_check_in_creation(self):
        """Test check-in creation."""
        check_in = CheckIn(
            id="ci-1",
            goal_id="goal-1",
            author_id="user-1",
            progress=50.0,
            confidence=0.8,
            notes="Making good progress",
            blockers="None",
            next_steps="Continue execution",
        )

        assert check_in.id == "ci-1"
        assert check_in.progress == 50.0
        assert check_in.confidence == 0.8
        assert check_in.status == CheckInStatus.DRAFT

    def test_check_in_submit(self):
        """Test check-in submission."""
        check_in = CheckIn(
            id="ci-1",
            goal_id="goal-1",
            author_id="user-1",
        )

        check_in.submit()
        assert check_in.status == CheckInStatus.SUBMITTED
        assert check_in.submitted_at is not None

    def test_check_in_review(self):
        """Test check-in review."""
        check_in = CheckIn(
            id="ci-1",
            goal_id="goal-1",
            author_id="user-1",
        )

        check_in.submit()
        check_in.review("reviewer-1")

        assert check_in.status == CheckInStatus.REVIEWED
        assert check_in.reviewed_by == "reviewer-1"
        assert check_in.reviewed_at is not None

    def test_check_in_to_dict(self):
        """Test dictionary conversion."""
        check_in = CheckIn(
            id="ci-1",
            goal_id="goal-1",
            author_id="user-1",
            progress=75.0,
        )

        data = check_in.to_dict()
        assert data["id"] == "ci-1"
        assert data["progress"] == 75.0


# ============================================================================
# GoalAlignment Tests
# ============================================================================

class TestGoalAlignment:
    """Tests for GoalAlignment class."""

    def test_alignment_creation(self):
        """Test alignment creation."""
        alignment = GoalAlignment(
            id="align-1",
            source_goal_id="goal-1",
            target_goal_id="goal-2",
            alignment_type="supports",
            weight=1.0,
        )

        assert alignment.source_goal_id == "goal-1"
        assert alignment.target_goal_id == "goal-2"
        assert alignment.alignment_type == "supports"

    def test_alignment_to_dict(self):
        """Test dictionary conversion."""
        alignment = GoalAlignment(
            id="align-1",
            source_goal_id="goal-1",
            target_goal_id="goal-2",
        )

        data = alignment.to_dict()
        assert data["id"] == "align-1"
        assert data["alignment_type"] == "supports"


# ============================================================================
# GoalCycle Tests
# ============================================================================

class TestGoalCycle:
    """Tests for GoalCycle class."""

    def test_cycle_creation(self):
        """Test cycle creation."""
        cycle = GoalCycle(
            id="cycle-1",
            name="Q1 2024",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )

        assert cycle.name == "Q1 2024"
        assert cycle.period == GoalPeriod.QUARTERLY

    def test_cycle_is_current(self):
        """Test current cycle detection."""
        today = date.today()
        cycle = GoalCycle(
            id="cycle-1",
            name="Current",
            period=GoalPeriod.QUARTERLY,
            start_date=today - timedelta(days=10),
            end_date=today + timedelta(days=10),
        )

        assert cycle.is_current is True

    def test_cycle_not_current_past(self):
        """Test past cycle detection."""
        cycle = GoalCycle(
            id="cycle-1",
            name="Past",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2020, 1, 1),
            end_date=date(2020, 3, 31),
        )

        assert cycle.is_current is False

    def test_cycle_progress_percentage(self):
        """Test cycle progress calculation."""
        today = date.today()
        cycle = GoalCycle(
            id="cycle-1",
            name="Progress",
            period=GoalPeriod.QUARTERLY,
            start_date=today - timedelta(days=50),
            end_date=today + timedelta(days=50),
        )

        # Should be around 50%
        assert 45 < cycle.progress_percentage < 55

    def test_cycle_to_dict(self):
        """Test dictionary conversion."""
        cycle = GoalCycle(
            id="cycle-1",
            name="Q1 2024",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )

        data = cycle.to_dict()
        assert data["name"] == "Q1 2024"
        assert data["period"] == "quarterly"


# ============================================================================
# GoalRegistry Tests
# ============================================================================

class TestGoalRegistry:
    """Tests for GoalRegistry class."""

    def test_create_goal(self, registry):
        """Test goal creation."""
        goal = registry.create_goal(
            title="Test Goal",
            owner_id="user-1",
        )

        assert goal.id is not None
        assert goal.title == "Test Goal"

    def test_get_goal(self, registry, goal):
        """Test goal retrieval."""
        retrieved = registry.get_goal(goal.id)
        assert retrieved == goal

    def test_get_goal_not_found(self, registry):
        """Test goal not found."""
        assert registry.get_goal("nonexistent") is None

    def test_update_goal(self, registry, goal):
        """Test goal update."""
        updated = registry.update_goal(
            goal.id,
            title="Updated Title",
            priority=GoalPriority.CRITICAL,
        )

        assert updated.title == "Updated Title"
        assert updated.priority == GoalPriority.CRITICAL

    def test_delete_goal(self, registry, goal):
        """Test goal deletion."""
        result = registry.delete_goal(goal.id)
        assert result is True
        assert registry.get_goal(goal.id) is None

    def test_delete_goal_not_found(self, registry):
        """Test delete non-existent goal."""
        assert registry.delete_goal("nonexistent") is False

    def test_activate_goal(self, registry, goal):
        """Test goal activation."""
        activated = registry.activate_goal(goal.id)
        assert activated.status == GoalStatus.ACTIVE

    def test_complete_goal(self, registry, goal):
        """Test goal completion."""
        completed = registry.complete_goal(goal.id, score=0.9)
        assert completed.status == GoalStatus.COMPLETED
        assert completed.score == 0.9

    def test_list_goals(self, registry):
        """Test listing goals."""
        registry.create_goal(title="Goal 1", owner_id="user-1")
        registry.create_goal(title="Goal 2", owner_id="user-1")
        registry.create_goal(title="Goal 3", owner_id="user-2")

        all_goals = registry.list_goals()
        assert len(all_goals) == 3

        user1_goals = registry.list_goals(owner_id="user-1")
        assert len(user1_goals) == 2

    def test_list_goals_by_status(self, registry):
        """Test listing goals by status."""
        goal1 = registry.create_goal(title="Active", owner_id="user-1")
        registry.create_goal(title="Draft", owner_id="user-1")

        registry.activate_goal(goal1.id)

        active_goals = registry.list_goals(status=GoalStatus.ACTIVE)
        assert len(active_goals) == 1

    def test_list_goals_by_tags(self, registry):
        """Test listing goals by tags."""
        registry.create_goal(title="Goal 1", owner_id="user-1", tags={"engineering"})
        registry.create_goal(title="Goal 2", owner_id="user-1", tags={"sales"})

        eng_goals = registry.list_goals(tags={"engineering"})
        assert len(eng_goals) == 1

    def test_get_child_goals(self, registry):
        """Test getting child goals."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        registry.create_goal(title="Child 1", owner_id="user-1", parent_id=parent.id)
        registry.create_goal(title="Child 2", owner_id="user-1", parent_id=parent.id)

        children = registry.get_child_goals(parent.id)
        assert len(children) == 2

    def test_get_goal_tree(self, registry):
        """Test goal tree retrieval."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        registry.create_goal(title="Child", owner_id="user-1", parent_id=parent.id)
        registry.add_key_result(parent.id, "KR 1", "user-1")

        tree = registry.get_goal_tree(parent.id)
        assert tree["goal"]["title"] == "Parent"
        assert len(tree["key_results"]) == 1
        assert len(tree["children"]) == 1

    # Key Result Tests

    def test_add_key_result(self, registry, goal):
        """Test adding key result."""
        kr = registry.add_key_result(
            objective_id=goal.id,
            title="Revenue Target",
            owner_id="user-1",
            target_value=1000000,
        )

        assert kr is not None
        assert kr.objective_id == goal.id

    def test_add_key_result_invalid_goal(self, registry):
        """Test adding key result to invalid goal."""
        kr = registry.add_key_result(
            objective_id="invalid",
            title="Test",
            owner_id="user-1",
        )

        assert kr is None

    def test_get_key_result(self, registry, goal, key_result):
        """Test getting key result."""
        retrieved = registry.get_key_result(goal.id, key_result.id)
        assert retrieved == key_result

    def test_update_key_result_value(self, registry, goal, key_result):
        """Test updating key result value."""
        updated = registry.update_key_result_value(
            goal.id, key_result.id, 1125000
        )

        assert updated.current_value == 1125000

    def test_delete_key_result(self, registry, goal, key_result):
        """Test deleting key result."""
        result = registry.delete_key_result(goal.id, key_result.id)
        assert result is True
        assert registry.get_key_result(goal.id, key_result.id) is None

    def test_get_key_results(self, registry, goal):
        """Test getting all key results."""
        registry.add_key_result(goal.id, "KR 1", "user-1")
        registry.add_key_result(goal.id, "KR 2", "user-1")

        krs = registry.get_key_results(goal.id)
        assert len(krs) == 2

    def test_goal_progress_from_key_results(self, registry, goal):
        """Test goal progress calculated from key results."""
        kr1 = registry.add_key_result(goal.id, "KR 1", "user-1", target_value=100)
        kr2 = registry.add_key_result(goal.id, "KR 2", "user-1", target_value=100)

        registry.update_key_result_value(goal.id, kr1.id, 50)
        registry.update_key_result_value(goal.id, kr2.id, 100)

        # Average progress should be 75%
        assert goal.progress == 75.0

    # Check-in Tests

    def test_create_check_in(self, registry, goal):
        """Test creating check-in."""
        check_in = registry.create_check_in(
            goal_id=goal.id,
            author_id="user-1",
            progress=50.0,
            notes="Making progress",
        )

        assert check_in is not None
        assert check_in.progress == 50.0

    def test_create_check_in_invalid_goal(self, registry):
        """Test creating check-in for invalid goal."""
        check_in = registry.create_check_in(
            goal_id="invalid",
            author_id="user-1",
        )

        assert check_in is None

    def test_submit_check_in(self, registry, goal):
        """Test submitting check-in."""
        check_in = registry.create_check_in(goal.id, "user-1")
        submitted = registry.submit_check_in(goal.id, check_in.id)

        assert submitted.status == CheckInStatus.SUBMITTED

    def test_review_check_in(self, registry, goal):
        """Test reviewing check-in."""
        check_in = registry.create_check_in(goal.id, "user-1")
        registry.submit_check_in(goal.id, check_in.id)
        reviewed = registry.review_check_in(goal.id, check_in.id, "manager-1")

        assert reviewed.status == CheckInStatus.REVIEWED
        assert reviewed.reviewed_by == "manager-1"

    def test_get_check_ins(self, registry, goal):
        """Test getting check-ins."""
        registry.create_check_in(goal.id, "user-1")
        registry.create_check_in(goal.id, "user-1")

        check_ins = registry.get_check_ins(goal.id)
        assert len(check_ins) == 2

    def test_get_latest_check_in(self, registry, goal):
        """Test getting latest check-in."""
        registry.create_check_in(goal.id, "user-1", notes="First")
        latest = registry.create_check_in(goal.id, "user-1", notes="Latest")

        result = registry.get_latest_check_in(goal.id)
        assert result.notes == "Latest"

    def test_check_in_updates_progress(self, registry, goal):
        """Test check-in updates goal progress."""
        goal.activate()
        registry.create_check_in(
            goal.id,
            "user-1",
            progress=60.0,
        )

        assert goal.progress == 60.0

    # Alignment Tests

    def test_create_alignment(self, registry):
        """Test creating alignment."""
        goal1 = registry.create_goal(title="Company Goal", owner_id="user-1")
        goal2 = registry.create_goal(title="Team Goal", owner_id="user-2")

        alignment = registry.create_alignment(
            source_goal_id=goal2.id,
            target_goal_id=goal1.id,
            alignment_type="supports",
        )

        assert alignment is not None
        assert alignment.source_goal_id == goal2.id
        assert alignment.target_goal_id == goal1.id

    def test_create_alignment_invalid_goal(self, registry):
        """Test creating alignment with invalid goal."""
        goal = registry.create_goal(title="Goal", owner_id="user-1")

        alignment = registry.create_alignment(
            source_goal_id=goal.id,
            target_goal_id="invalid",
        )

        assert alignment is None

    def test_get_alignments_from(self, registry):
        """Test getting alignments from a goal."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        child = registry.create_goal(title="Child", owner_id="user-2")
        registry.create_alignment(child.id, parent.id)

        alignments = registry.get_alignments_from(child.id)
        assert len(alignments) == 1

    def test_get_alignments_to(self, registry):
        """Test getting alignments to a goal."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        child1 = registry.create_goal(title="Child 1", owner_id="user-2")
        child2 = registry.create_goal(title="Child 2", owner_id="user-3")

        registry.create_alignment(child1.id, parent.id)
        registry.create_alignment(child2.id, parent.id)

        alignments = registry.get_alignments_to(parent.id)
        assert len(alignments) == 2

    def test_get_aligned_goals(self, registry):
        """Test getting aligned goals."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        child = registry.create_goal(title="Child", owner_id="user-2")
        registry.create_alignment(child.id, parent.id)

        aligned = registry.get_aligned_goals(parent.id)
        assert len(aligned) == 1
        assert aligned[0].title == "Child"

    def test_delete_alignment(self, registry):
        """Test deleting alignment."""
        goal1 = registry.create_goal(title="Goal 1", owner_id="user-1")
        goal2 = registry.create_goal(title="Goal 2", owner_id="user-2")
        alignment = registry.create_alignment(goal2.id, goal1.id)

        result = registry.delete_alignment(alignment.id)
        assert result is True
        assert registry.get_alignment(alignment.id) is None

    def test_delete_goal_removes_alignments(self, registry):
        """Test deleting goal removes related alignments."""
        parent = registry.create_goal(title="Parent", owner_id="user-1")
        child = registry.create_goal(title="Child", owner_id="user-2")
        alignment = registry.create_alignment(child.id, parent.id)

        registry.delete_goal(child.id)

        assert registry.get_alignment(alignment.id) is None

    # Cycle Tests

    def test_create_cycle(self, registry):
        """Test creating cycle."""
        cycle = registry.create_cycle(
            name="Q1 2024",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )

        assert cycle.name == "Q1 2024"
        assert cycle.period == GoalPeriod.QUARTERLY

    def test_get_cycle(self, registry):
        """Test getting cycle."""
        cycle = registry.create_cycle(
            name="Q1",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )

        retrieved = registry.get_cycle(cycle.id)
        assert retrieved == cycle

    def test_get_current_cycle(self, registry):
        """Test getting current cycle."""
        today = date.today()
        registry.create_cycle(
            name="Current",
            period=GoalPeriod.QUARTERLY,
            start_date=today - timedelta(days=10),
            end_date=today + timedelta(days=80),
        )

        current = registry.get_current_cycle()
        assert current is not None
        assert current.name == "Current"

    def test_list_cycles(self, registry):
        """Test listing cycles."""
        registry.create_cycle(
            name="Q1",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )
        registry.create_cycle(
            name="Q2",
            period=GoalPeriod.QUARTERLY,
            start_date=date(2024, 4, 1),
            end_date=date(2024, 6, 30),
        )

        cycles = registry.list_cycles()
        assert len(cycles) == 2

    # Statistics Tests

    def test_get_stats(self, registry):
        """Test getting statistics."""
        goal1 = registry.create_goal(title="Goal 1", owner_id="user-1")
        goal2 = registry.create_goal(title="Goal 2", owner_id="user-1")
        registry.activate_goal(goal1.id)
        registry.complete_goal(goal2.id)

        stats = registry.get_stats()
        assert stats["total_goals"] == 2
        assert stats["completed_goals"] == 1


# ============================================================================
# GoalManager Tests
# ============================================================================

class TestGoalManager:
    """Tests for GoalManager class."""

    def test_manager_creation(self, manager):
        """Test manager creation."""
        assert manager.registry is not None

    def test_create_objective(self, manager):
        """Test creating objective."""
        objective = manager.create_objective(
            title="Increase Revenue",
            owner_id="user-1",
            description="Grow revenue by 25%",
        )

        assert objective.goal_type == GoalType.OBJECTIVE
        assert objective.level == GoalLevel.INDIVIDUAL

    def test_create_company_objective(self, manager):
        """Test creating company objective."""
        objective = manager.create_company_objective(
            title="Company Vision",
            owner_id="ceo-1",
        )

        assert objective.level == GoalLevel.COMPANY

    def test_create_team_objective(self, manager):
        """Test creating team objective."""
        company_obj = manager.create_company_objective(
            title="Company Goal",
            owner_id="ceo-1",
        )

        team_obj = manager.create_team_objective(
            title="Team Goal",
            owner_id="manager-1",
            team_id="team-1",
            parent_id=company_obj.id,
        )

        assert team_obj.level == GoalLevel.TEAM
        assert team_obj.parent_id == company_obj.id

        # Should auto-create alignment
        alignments = manager.registry.get_alignments_from(team_obj.id)
        assert len(alignments) == 1

    def test_create_individual_objective(self, manager):
        """Test creating individual objective."""
        team_obj = manager.create_team_objective(
            title="Team Goal",
            owner_id="manager-1",
            team_id="team-1",
        )

        individual_obj = manager.create_individual_objective(
            title="My Goal",
            owner_id="user-1",
            parent_id=team_obj.id,
        )

        assert individual_obj.level == GoalLevel.INDIVIDUAL

    def test_get_goal(self, manager):
        """Test getting goal."""
        objective = manager.create_objective("Test", "user-1")
        retrieved = manager.get_goal(objective.id)
        assert retrieved == objective

    def test_update_goal(self, manager):
        """Test updating goal."""
        objective = manager.create_objective("Test", "user-1")
        updated = manager.update_goal(objective.id, title="Updated")
        assert updated.title == "Updated"

    def test_delete_goal(self, manager):
        """Test deleting goal."""
        objective = manager.create_objective("Test", "user-1")
        result = manager.delete_goal(objective.id)
        assert result is True

    def test_activate_goal(self, manager):
        """Test activating goal."""
        objective = manager.create_objective("Test", "user-1")
        activated = manager.activate_goal(objective.id)
        assert activated.status == GoalStatus.ACTIVE

    def test_complete_goal(self, manager):
        """Test completing goal."""
        objective = manager.create_objective("Test", "user-1")
        completed = manager.complete_goal(objective.id, score=0.85)
        assert completed.status == GoalStatus.COMPLETED
        assert completed.score == 0.85

    def test_list_goals(self, manager):
        """Test listing goals."""
        manager.create_objective("Obj 1", "user-1")
        manager.create_objective("Obj 2", "user-1")

        goals = manager.list_goals()
        assert len(goals) == 2

    def test_list_objectives(self, manager):
        """Test listing objectives."""
        manager.create_objective("Obj 1", "user-1")
        manager.create_objective("Obj 2", "user-1")

        objectives = manager.list_objectives()
        assert len(objectives) == 2

    def test_get_my_goals(self, manager):
        """Test getting user's goals."""
        manager.create_objective("My Goal", "user-1")
        manager.create_objective("Other Goal", "user-2")

        my_goals = manager.get_my_goals("user-1")
        assert len(my_goals) == 1

    def test_get_team_goals(self, manager):
        """Test getting team's goals."""
        manager.create_team_objective("Team Goal", "manager-1", "team-1")
        manager.create_team_objective("Other Team Goal", "manager-2", "team-2")

        team_goals = manager.get_team_goals("team-1")
        assert len(team_goals) == 1

    # Key Result Tests

    def test_add_key_result(self, manager):
        """Test adding key result."""
        objective = manager.create_objective("Objective", "user-1")
        kr = manager.add_key_result(
            objective_id=objective.id,
            title="Key Result",
            owner_id="user-1",
            target_value=100,
        )

        assert kr is not None

    def test_add_numeric_key_result(self, manager):
        """Test adding numeric key result."""
        objective = manager.create_objective("Revenue", "user-1")
        kr = manager.add_numeric_key_result(
            objective_id=objective.id,
            title="Revenue",
            owner_id="user-1",
            start_value=1000000,
            target_value=1500000,
            unit="USD",
        )

        assert kr.result_type == KeyResultType.NUMBER
        assert kr.start_value == 1000000

    def test_add_percentage_key_result(self, manager):
        """Test adding percentage key result."""
        objective = manager.create_objective("NPS", "user-1")
        kr = manager.add_percentage_key_result(
            objective_id=objective.id,
            title="NPS Score",
            owner_id="user-1",
            target_value=80,
        )

        assert kr.result_type == KeyResultType.PERCENTAGE

    def test_add_boolean_key_result(self, manager):
        """Test adding boolean key result."""
        objective = manager.create_objective("Launch", "user-1")
        kr = manager.add_boolean_key_result(
            objective_id=objective.id,
            title="Launch Feature",
            owner_id="user-1",
        )

        assert kr.result_type == KeyResultType.BOOLEAN
        assert kr.target_value == 1.0

    def test_update_key_result(self, manager):
        """Test updating key result."""
        objective = manager.create_objective("Objective", "user-1")
        kr = manager.add_key_result(objective.id, "KR", "user-1", target_value=100)

        updated = manager.update_key_result(objective.id, kr.id, 50)
        assert updated.current_value == 50

    def test_complete_key_result(self, manager):
        """Test completing boolean key result."""
        objective = manager.create_objective("Launch", "user-1")
        kr = manager.add_boolean_key_result(objective.id, "Feature", "user-1")

        completed = manager.complete_key_result(objective.id, kr.id)
        assert completed.is_complete is True

    def test_get_key_results(self, manager):
        """Test getting key results."""
        objective = manager.create_objective("Objective", "user-1")
        manager.add_key_result(objective.id, "KR 1", "user-1")
        manager.add_key_result(objective.id, "KR 2", "user-1")

        krs = manager.get_key_results(objective.id)
        assert len(krs) == 2

    # Check-in Tests

    def test_create_check_in(self, manager):
        """Test creating check-in."""
        objective = manager.create_objective("Objective", "user-1")
        objective.activate()

        check_in = manager.create_check_in(
            goal_id=objective.id,
            author_id="user-1",
            progress=50,
            notes="Making progress",
        )

        assert check_in is not None

    def test_update_progress(self, manager):
        """Test quick progress update."""
        objective = manager.create_objective("Objective", "user-1")
        manager.activate_goal(objective.id)

        check_in = manager.update_progress(
            goal_id=objective.id,
            author_id="user-1",
            progress=75,
            notes="Good progress",
        )

        assert check_in.status == CheckInStatus.SUBMITTED
        assert objective.progress == 75

    def test_get_check_ins(self, manager):
        """Test getting check-ins."""
        objective = manager.create_objective("Objective", "user-1")
        manager.create_check_in(objective.id, "user-1")
        manager.create_check_in(objective.id, "user-1")

        check_ins = manager.get_check_ins(objective.id)
        assert len(check_ins) == 2

    # Alignment Tests

    def test_align_goal(self, manager):
        """Test aligning goals."""
        company = manager.create_company_objective("Company", "ceo-1")
        team = manager.create_objective("Team", "manager-1", level=GoalLevel.TEAM)

        alignment = manager.align_goal(team.id, company.id)
        assert alignment is not None

    def test_get_aligned_goals(self, manager):
        """Test getting aligned goals."""
        company = manager.create_company_objective("Company", "ceo-1")
        team = manager.create_team_objective("Team", "manager-1", "team-1", parent_id=company.id)

        aligned = manager.get_aligned_goals(company.id)
        assert len(aligned) == 1
        assert aligned[0].id == team.id

    def test_get_parent_goals(self, manager):
        """Test getting parent goals."""
        company = manager.create_company_objective("Company", "ceo-1")
        team = manager.create_team_objective("Team", "manager-1", "team-1", parent_id=company.id)

        parents = manager.get_parent_goals(team.id)
        assert len(parents) == 1
        assert parents[0].id == company.id

    # Cycle Tests

    def test_create_quarterly_cycle(self, manager):
        """Test creating quarterly cycle."""
        cycle = manager.create_quarterly_cycle(
            name="Q1 2024",
            start_date=date(2024, 1, 1),
        )

        assert cycle.period == GoalPeriod.QUARTERLY
        # End date should be end of March
        assert cycle.end_date.month == 3

    def test_create_annual_cycle(self, manager):
        """Test creating annual cycle."""
        cycle = manager.create_annual_cycle(year=2024)

        assert cycle.name == "FY2024"
        assert cycle.period == GoalPeriod.ANNUAL
        assert cycle.start_date == date(2024, 1, 1)
        assert cycle.end_date == date(2024, 12, 31)

    def test_get_current_cycle(self, manager):
        """Test getting current cycle."""
        today = date.today()
        manager.registry.create_cycle(
            name="Current",
            period=GoalPeriod.QUARTERLY,
            start_date=today - timedelta(days=10),
            end_date=today + timedelta(days=80),
        )

        current = manager.get_current_cycle()
        assert current is not None

    def test_list_cycles(self, manager):
        """Test listing cycles."""
        manager.create_annual_cycle(2024)
        manager.create_annual_cycle(2025)

        cycles = manager.list_cycles()
        assert len(cycles) == 2

    # Summary Tests

    def test_get_goal_summary(self, manager):
        """Test getting goal summary."""
        objective = manager.create_objective("Objective", "user-1")
        manager.add_key_result(objective.id, "KR 1", "user-1")
        manager.create_check_in(objective.id, "user-1")

        summary = manager.get_goal_summary(objective.id)
        assert summary["goal"]["title"] == "Objective"
        assert len(summary["key_results"]) == 1

    def test_get_okr_summary(self, manager):
        """Test getting OKR summary."""
        obj1 = manager.create_objective("Obj 1", "user-1")
        obj2 = manager.create_objective("Obj 2", "user-1")
        manager.add_key_result(obj1.id, "KR 1", "user-1")
        manager.add_key_result(obj2.id, "KR 2", "user-1")

        summary = manager.get_okr_summary()
        assert summary["total_objectives"] == 2
        assert summary["total_key_results"] == 2

    def test_get_stats(self, manager):
        """Test getting statistics."""
        manager.create_objective("Obj 1", "user-1")
        obj2 = manager.create_objective("Obj 2", "user-1")
        manager.complete_goal(obj2.id)

        stats = manager.get_stats()
        assert stats["total_goals"] == 2
        assert stats["completed_goals"] == 1


# ============================================================================
# Global Instance Tests
# ============================================================================

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_goal_manager()

    def test_get_goal_manager(self):
        """Test getting global manager."""
        manager = get_goal_manager()
        assert manager is not None
        assert isinstance(manager, GoalManager)

    def test_get_goal_manager_singleton(self):
        """Test global manager is singleton."""
        manager1 = get_goal_manager()
        manager2 = get_goal_manager()
        assert manager1 is manager2

    def test_set_goal_manager(self):
        """Test setting global manager."""
        custom_manager = GoalManager()
        set_goal_manager(custom_manager)
        assert get_goal_manager() is custom_manager

    def test_reset_goal_manager(self):
        """Test resetting global manager."""
        manager1 = get_goal_manager()
        reset_goal_manager()
        manager2 = get_goal_manager()
        assert manager1 is not manager2


# ============================================================================
# Integration Tests
# ============================================================================

class TestGoalIntegration:
    """Integration tests for goals module."""

    def test_full_okr_flow(self, manager):
        """Test complete OKR flow."""
        # Create company objective
        company_obj = manager.create_company_objective(
            title="Increase Market Share",
            owner_id="ceo-1",
            workspace_id="ws-1",
        )
        manager.activate_goal(company_obj.id)

        # Create team objective aligned to company
        team_obj = manager.create_team_objective(
            title="Launch New Product",
            owner_id="product-lead-1",
            team_id="product-team",
            parent_id=company_obj.id,
            workspace_id="ws-1",
        )
        manager.activate_goal(team_obj.id)

        # Add key results
        kr1 = manager.add_percentage_key_result(
            team_obj.id,
            "Development Completion",
            "dev-lead-1",
            target_value=100,
        )
        kr2 = manager.add_boolean_key_result(
            team_obj.id,
            "Launch to Production",
            "devops-lead-1",
        )

        # Update key result progress
        manager.update_key_result(team_obj.id, kr1.id, 50)

        # Create check-in
        manager.create_check_in(
            team_obj.id,
            "product-lead-1",
            progress=None,  # Calculated from KRs
            confidence=0.8,
            notes="On track for launch",
        )

        # Verify progress
        team_goal = manager.get_goal(team_obj.id)
        assert team_goal.progress == 25.0  # 50% on one KR, 0% on other = 25% avg

        # Complete boolean KR
        manager.complete_key_result(team_obj.id, kr2.id)

        # Verify updated progress
        team_goal = manager.get_goal(team_obj.id)
        assert team_goal.progress == 75.0  # 50% + 100% = 75% avg

        # Complete first KR
        manager.update_key_result(team_obj.id, kr1.id, 100)

        # Verify goal completed
        team_goal = manager.get_goal(team_obj.id)
        assert team_goal.progress == 100.0
        assert team_goal.status == GoalStatus.COMPLETED

    def test_goal_hierarchy(self, manager):
        """Test goal hierarchy and cascading."""
        # Company level
        company = manager.create_company_objective(
            "Grow Revenue",
            "ceo",
            workspace_id="ws-1",
        )

        # Department level
        sales_dept = manager.create_objective(
            "Sales Growth",
            "sales-vp",
            level=GoalLevel.DEPARTMENT,
        )
        manager.align_goal(sales_dept.id, company.id)

        # Team level
        team1 = manager.create_team_objective(
            "Enterprise Sales",
            "team-lead-1",
            "enterprise-team",
            parent_id=sales_dept.id,
        )

        team2 = manager.create_team_objective(
            "SMB Sales",
            "team-lead-2",
            "smb-team",
            parent_id=sales_dept.id,
        )

        # Verify hierarchy
        aligned_to_company = manager.get_aligned_goals(company.id)
        assert len(aligned_to_company) == 1
        assert aligned_to_company[0].id == sales_dept.id

        aligned_to_dept = manager.get_aligned_goals(sales_dept.id)
        assert len(aligned_to_dept) == 2

    def test_quarterly_cycle_workflow(self, manager):
        """Test quarterly cycle workflow."""
        # Create Q1 cycle
        q1 = manager.create_quarterly_cycle(
            "Q1 2024",
            date(2024, 1, 1),
            workspace_id="ws-1",
        )

        # Create objectives for Q1
        obj1 = manager.create_objective(
            "Q1 Objective 1",
            "user-1",
            period=GoalPeriod.QUARTERLY,
            workspace_id="ws-1",
            start_date=q1.start_date,
            end_date=q1.end_date,
        )

        obj2 = manager.create_objective(
            "Q1 Objective 2",
            "user-1",
            period=GoalPeriod.QUARTERLY,
            workspace_id="ws-1",
            start_date=q1.start_date,
            end_date=q1.end_date,
        )

        # Add KRs and track progress
        kr = manager.add_key_result(obj1.id, "KR 1", "user-1", target_value=100)
        manager.update_key_result(obj1.id, kr.id, 75)
        manager.activate_goal(obj1.id)

        manager.activate_goal(obj2.id)
        obj2.update_progress(50)

        # Get OKR summary
        summary = manager.get_okr_summary(workspace_id="ws-1")
        assert summary["total_objectives"] == 2
        assert summary["average_progress"] == 62.5  # (75 + 50) / 2
