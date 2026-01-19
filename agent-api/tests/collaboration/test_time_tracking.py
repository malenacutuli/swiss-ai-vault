"""
Tests for the Time Tracking module.
"""

import pytest
from datetime import datetime, timedelta, date
from typing import Dict, Any

from app.collaboration.time_tracking import (
    TimeTrackingManager,
    TimeTrackingRegistry,
    TimeEntry,
    TimeEntryStatus,
    TimeEntryType,
    Timer,
    TimerStatus,
    Timesheet,
    TimesheetStatus,
    TimesheetPeriod,
    TimeCategory,
    TrackingPolicy,
    TimeReport,
    BillableType,
    get_time_tracking_manager,
    set_time_tracking_manager,
    reset_time_tracking_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestTimeTrackingEnums:
    """Test time tracking enumeration types."""

    def test_time_entry_status_values(self) -> None:
        """Test TimeEntryStatus enum values."""
        assert TimeEntryStatus.DRAFT.value == "draft"
        assert TimeEntryStatus.SUBMITTED.value == "submitted"
        assert TimeEntryStatus.APPROVED.value == "approved"
        assert TimeEntryStatus.REJECTED.value == "rejected"
        assert TimeEntryStatus.LOCKED.value == "locked"

    def test_time_entry_type_values(self) -> None:
        """Test TimeEntryType enum values."""
        assert TimeEntryType.MANUAL.value == "manual"
        assert TimeEntryType.TIMER.value == "timer"
        assert TimeEntryType.IMPORTED.value == "imported"
        assert TimeEntryType.ADJUSTED.value == "adjusted"

    def test_timer_status_values(self) -> None:
        """Test TimerStatus enum values."""
        assert TimerStatus.RUNNING.value == "running"
        assert TimerStatus.PAUSED.value == "paused"
        assert TimerStatus.STOPPED.value == "stopped"

    def test_timesheet_status_values(self) -> None:
        """Test TimesheetStatus enum values."""
        assert TimesheetStatus.DRAFT.value == "draft"
        assert TimesheetStatus.SUBMITTED.value == "submitted"
        assert TimesheetStatus.APPROVED.value == "approved"

    def test_timesheet_period_values(self) -> None:
        """Test TimesheetPeriod enum values."""
        assert TimesheetPeriod.DAILY.value == "daily"
        assert TimesheetPeriod.WEEKLY.value == "weekly"
        assert TimesheetPeriod.BIWEEKLY.value == "biweekly"
        assert TimesheetPeriod.MONTHLY.value == "monthly"

    def test_billable_type_values(self) -> None:
        """Test BillableType enum values."""
        assert BillableType.BILLABLE.value == "billable"
        assert BillableType.NON_BILLABLE.value == "non_billable"
        assert BillableType.INTERNAL.value == "internal"


# ============================================================
# TimeCategory Tests
# ============================================================

class TestTimeCategory:
    """Test TimeCategory dataclass."""

    def test_create_category(self) -> None:
        """Test creating a category."""
        category = TimeCategory(
            id="cat1",
            name="Development",
            description="Software development work",
            color="#3498db",
            is_billable=True,
        )
        assert category.id == "cat1"
        assert category.name == "Development"
        assert category.is_billable is True

    def test_category_to_dict(self) -> None:
        """Test category to_dict method."""
        category = TimeCategory(
            id="cat1",
            name="Meeting",
            hourly_rate=100.0,
        )
        data = category.to_dict()
        assert data["id"] == "cat1"
        assert data["name"] == "Meeting"
        assert data["hourly_rate"] == 100.0


# ============================================================
# TimeEntry Tests
# ============================================================

class TestTimeEntry:
    """Test TimeEntry dataclass."""

    def test_create_entry(self) -> None:
        """Test creating an entry."""
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=120,
        )
        assert entry.id == "entry1"
        assert entry.duration_minutes == 120
        assert entry.status == TimeEntryStatus.DRAFT

    def test_entry_duration_hours(self) -> None:
        """Test duration hours calculation."""
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=90,
        )
        assert entry.duration_hours == 1.5

    def test_entry_billable_amount(self) -> None:
        """Test billable amount calculation."""
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=120,
            is_billable=True,
            hourly_rate=100.0,
        )
        assert entry.billable_amount == 200.0

    def test_entry_non_billable_no_amount(self) -> None:
        """Test non-billable entry has no amount."""
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=120,
            is_billable=False,
        )
        assert entry.billable_amount is None

    def test_entry_submit(self) -> None:
        """Test submitting an entry."""
        entry = TimeEntry(id="entry1", user_id="user1", date=date.today())
        entry.submit()
        assert entry.status == TimeEntryStatus.SUBMITTED
        assert entry.submitted_at is not None

    def test_entry_approve(self) -> None:
        """Test approving an entry."""
        entry = TimeEntry(id="entry1", user_id="user1", date=date.today())
        entry.submit()
        entry.approve("approver1")
        assert entry.status == TimeEntryStatus.APPROVED
        assert entry.approved_by == "approver1"

    def test_entry_reject(self) -> None:
        """Test rejecting an entry."""
        entry = TimeEntry(id="entry1", user_id="user1", date=date.today())
        entry.submit()
        entry.reject("Needs more detail")
        assert entry.status == TimeEntryStatus.REJECTED
        assert entry.rejection_reason == "Needs more detail"

    def test_entry_to_dict(self) -> None:
        """Test entry to_dict method."""
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=60,
            description="Development work",
        )
        data = entry.to_dict()
        assert data["id"] == "entry1"
        assert data["duration_hours"] == 1.0
        assert data["description"] == "Development work"


# ============================================================
# Timer Tests
# ============================================================

class TestTimer:
    """Test Timer dataclass."""

    def test_create_timer(self) -> None:
        """Test creating a timer."""
        timer = Timer(
            id="timer1",
            user_id="user1",
            description="Working on task",
        )
        assert timer.id == "timer1"
        assert timer.status == TimerStatus.STOPPED

    def test_timer_start(self) -> None:
        """Test starting a timer."""
        timer = Timer(id="timer1", user_id="user1")
        timer.start()
        assert timer.status == TimerStatus.RUNNING
        assert timer.started_at is not None

    def test_timer_pause(self) -> None:
        """Test pausing a timer."""
        timer = Timer(id="timer1", user_id="user1")
        timer.start()
        timer.pause()
        assert timer.status == TimerStatus.PAUSED
        assert timer.paused_at is not None

    def test_timer_resume(self) -> None:
        """Test resuming a timer."""
        timer = Timer(id="timer1", user_id="user1")
        timer.start()
        timer.pause()
        timer.start()
        assert timer.status == TimerStatus.RUNNING
        assert timer.paused_at is None

    def test_timer_stop(self) -> None:
        """Test stopping a timer."""
        timer = Timer(id="timer1", user_id="user1")
        timer.start()
        elapsed = timer.stop()
        assert timer.status == TimerStatus.STOPPED
        assert elapsed >= 0

    def test_timer_reset(self) -> None:
        """Test resetting a timer."""
        timer = Timer(id="timer1", user_id="user1")
        timer.start()
        timer.reset()
        assert timer.status == TimerStatus.STOPPED
        assert timer.accumulated_seconds == 0

    def test_timer_elapsed_seconds(self) -> None:
        """Test elapsed seconds calculation."""
        timer = Timer(id="timer1", user_id="user1")
        timer.accumulated_seconds = 300
        assert timer.elapsed_seconds == 300
        assert timer.elapsed_minutes == 5

    def test_timer_formatted_time(self) -> None:
        """Test formatted time."""
        timer = Timer(id="timer1", user_id="user1")
        timer.accumulated_seconds = 3661
        assert timer.formatted_time == "01:01:01"

    def test_timer_to_dict(self) -> None:
        """Test timer to_dict method."""
        timer = Timer(
            id="timer1",
            user_id="user1",
            description="Test timer",
        )
        data = timer.to_dict()
        assert data["id"] == "timer1"
        assert data["status"] == "stopped"


# ============================================================
# Timesheet Tests
# ============================================================

class TestTimesheet:
    """Test Timesheet dataclass."""

    def test_create_timesheet(self) -> None:
        """Test creating a timesheet."""
        today = date.today()
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=today,
            end_date=today + timedelta(days=6),
        )
        assert timesheet.id == "ts1"
        assert timesheet.status == TimesheetStatus.DRAFT

    def test_timesheet_total_hours(self) -> None:
        """Test total hours calculation."""
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
            total_minutes=2400,
        )
        assert timesheet.total_hours == 40.0

    def test_timesheet_period_label_daily(self) -> None:
        """Test daily period label."""
        today = date.today()
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.DAILY,
            start_date=today,
            end_date=today,
        )
        assert today.strftime("%B %d, %Y") in timesheet.period_label

    def test_timesheet_period_label_weekly(self) -> None:
        """Test weekly period label."""
        today = date.today()
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=today,
            end_date=today + timedelta(days=6),
        )
        assert "Week of" in timesheet.period_label

    def test_timesheet_submit(self) -> None:
        """Test submitting a timesheet."""
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
        )
        timesheet.submit()
        assert timesheet.status == TimesheetStatus.SUBMITTED

    def test_timesheet_approve(self) -> None:
        """Test approving a timesheet."""
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
        )
        timesheet.submit()
        timesheet.approve("approver1")
        assert timesheet.status == TimesheetStatus.APPROVED
        assert timesheet.approved_by == "approver1"

    def test_timesheet_to_dict(self) -> None:
        """Test timesheet to_dict method."""
        timesheet = Timesheet(
            id="ts1",
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
            total_minutes=2400,
            billable_minutes=2000,
        )
        data = timesheet.to_dict()
        assert data["total_hours"] == 40.0
        assert data["billable_hours"] == pytest.approx(33.33, rel=0.01)


# ============================================================
# TrackingPolicy Tests
# ============================================================

class TestTrackingPolicy:
    """Test TrackingPolicy dataclass."""

    def test_create_policy(self) -> None:
        """Test creating a policy."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Standard Policy",
        )
        assert policy.id == "policy1"
        assert policy.max_daily_hours == 24.0

    def test_policy_validate_entry_pass(self) -> None:
        """Test policy validation passing."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
        )
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=480,
        )
        errors = policy.validate_entry(entry)
        assert len(errors) == 0

    def test_policy_require_description(self) -> None:
        """Test policy requires description."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
            require_description=True,
        )
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=60,
            description="",
        )
        errors = policy.validate_entry(entry)
        assert "Description is required" in errors

    def test_policy_require_project(self) -> None:
        """Test policy requires project."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
            require_project=True,
        )
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=60,
        )
        errors = policy.validate_entry(entry)
        assert "Project is required" in errors

    def test_policy_max_daily_hours(self) -> None:
        """Test max daily hours validation."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
            max_daily_hours=8.0,
        )
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today(),
            duration_minutes=120,
        )
        errors = policy.validate_entry(entry, daily_total=420)
        assert any("maximum daily hours" in e for e in errors)

    def test_policy_no_future_entries(self) -> None:
        """Test no future entries validation."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
            allow_future_entries=False,
        )
        entry = TimeEntry(
            id="entry1",
            user_id="user1",
            date=date.today() + timedelta(days=1),
            duration_minutes=60,
        )
        errors = policy.validate_entry(entry)
        assert "Future entries are not allowed" in errors

    def test_policy_round_duration(self) -> None:
        """Test duration rounding."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Policy",
            rounding_minutes=15,
        )
        assert policy.round_duration(7) == 15
        assert policy.round_duration(15) == 15
        assert policy.round_duration(16) == 30

    def test_policy_to_dict(self) -> None:
        """Test policy to_dict method."""
        policy = TrackingPolicy(
            id="policy1",
            workspace_id="ws1",
            name="Standard Policy",
            require_approval=True,
        )
        data = policy.to_dict()
        assert data["name"] == "Standard Policy"
        assert data["require_approval"] is True


# ============================================================
# TimeReport Tests
# ============================================================

class TestTimeReport:
    """Test TimeReport dataclass."""

    def test_create_report(self) -> None:
        """Test creating a report."""
        report = TimeReport(
            id="report1",
            name="Weekly Report",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
        )
        assert report.id == "report1"
        assert report.total_minutes == 0

    def test_report_billable_percentage(self) -> None:
        """Test billable percentage calculation."""
        report = TimeReport(
            id="report1",
            name="Report",
            start_date=date.today(),
            end_date=date.today(),
            total_minutes=1000,
            billable_minutes=750,
        )
        assert report.billable_percentage == 75.0

    def test_report_to_dict(self) -> None:
        """Test report to_dict method."""
        report = TimeReport(
            id="report1",
            name="Weekly Report",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=6),
            total_minutes=2400,
            billable_minutes=2000,
        )
        data = report.to_dict()
        assert data["total_hours"] == 40.0
        assert data["billable_percentage"] == pytest.approx(83.33, rel=0.01)


# ============================================================
# TimeTrackingRegistry Tests
# ============================================================

class TestTimeTrackingRegistry:
    """Test TimeTrackingRegistry class."""

    @pytest.fixture
    def registry(self) -> TimeTrackingRegistry:
        """Create a registry for testing."""
        return TimeTrackingRegistry()

    # Entry tests
    def test_create_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test creating an entry."""
        entry = registry.create_entry(
            user_id="user1",
            entry_date=date.today(),
            duration_minutes=120,
            description="Development work",
        )
        assert entry.id is not None
        assert entry.duration_minutes == 120

    def test_get_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test getting an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        retrieved = registry.get_entry(entry.id)
        assert retrieved is not None
        assert retrieved.id == entry.id

    def test_update_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test updating an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        updated = registry.update_entry(entry.id, duration_minutes=90)
        assert updated.duration_minutes == 90

    def test_update_approved_entry_fails(self, registry: TimeTrackingRegistry) -> None:
        """Test updating approved entry fails."""
        entry = registry.create_entry("user1", date.today(), 60)
        registry.submit_entry(entry.id)
        registry.approve_entry(entry.id, "approver1")
        updated = registry.update_entry(entry.id, duration_minutes=90)
        assert updated is None

    def test_delete_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test deleting an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        result = registry.delete_entry(entry.id)
        assert result is True
        assert registry.get_entry(entry.id) is None

    def test_submit_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test submitting an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        submitted = registry.submit_entry(entry.id)
        assert submitted.status == TimeEntryStatus.SUBMITTED

    def test_approve_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test approving an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        registry.submit_entry(entry.id)
        approved = registry.approve_entry(entry.id, "approver1")
        assert approved.status == TimeEntryStatus.APPROVED

    def test_reject_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test rejecting an entry."""
        entry = registry.create_entry("user1", date.today(), 60)
        registry.submit_entry(entry.id)
        rejected = registry.reject_entry(entry.id, "Needs revision")
        assert rejected.status == TimeEntryStatus.REJECTED

    def test_list_entries(self, registry: TimeTrackingRegistry) -> None:
        """Test listing entries."""
        registry.create_entry("user1", date.today(), 60)
        registry.create_entry("user1", date.today(), 90)
        registry.create_entry("user2", date.today(), 120)

        all_entries = registry.list_entries()
        assert len(all_entries) == 3

        user1_entries = registry.list_entries(user_id="user1")
        assert len(user1_entries) == 2

    def test_list_entries_by_date_range(self, registry: TimeTrackingRegistry) -> None:
        """Test listing entries by date range."""
        today = date.today()
        registry.create_entry("user1", today, 60)
        registry.create_entry("user1", today - timedelta(days=1), 60)
        registry.create_entry("user1", today - timedelta(days=7), 60)

        entries = registry.list_entries(
            user_id="user1",
            start_date=today - timedelta(days=2),
            end_date=today,
        )
        assert len(entries) == 2

    def test_get_daily_total(self, registry: TimeTrackingRegistry) -> None:
        """Test getting daily total."""
        today = date.today()
        registry.create_entry("user1", today, 60)
        registry.create_entry("user1", today, 90)

        total = registry.get_daily_total("user1", today)
        assert total == 150

    def test_get_weekly_total(self, registry: TimeTrackingRegistry) -> None:
        """Test getting weekly total."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        registry.create_entry("user1", week_start, 480)
        registry.create_entry("user1", week_start + timedelta(days=1), 480)

        total = registry.get_weekly_total("user1", week_start)
        assert total == 960

    # Timer tests
    def test_create_timer(self, registry: TimeTrackingRegistry) -> None:
        """Test creating a timer."""
        timer = registry.create_timer(
            user_id="user1",
            description="Working on feature",
        )
        assert timer.id is not None
        assert timer.status == TimerStatus.STOPPED

    def test_start_timer(self, registry: TimeTrackingRegistry) -> None:
        """Test starting a timer."""
        timer = registry.create_timer("user1")
        started = registry.start_timer(timer.id)
        assert started.status == TimerStatus.RUNNING

    def test_pause_timer(self, registry: TimeTrackingRegistry) -> None:
        """Test pausing a timer."""
        timer = registry.create_timer("user1")
        registry.start_timer(timer.id)
        paused = registry.pause_timer(timer.id)
        assert paused.status == TimerStatus.PAUSED

    def test_stop_timer_creates_entry(self, registry: TimeTrackingRegistry) -> None:
        """Test stopping timer creates entry."""
        timer = registry.create_timer("user1", description="Test work")
        # Simulate elapsed time by setting started_at in the past
        timer.status = TimerStatus.RUNNING
        timer.started_at = datetime.utcnow() - timedelta(hours=1)

        stopped_timer, entry = registry.stop_timer(timer.id, create_entry=True)
        assert stopped_timer.status == TimerStatus.STOPPED
        assert entry is not None
        assert entry.duration_minutes >= 59  # Allow for slight timing variance

    def test_stop_timer_no_entry_under_minute(self, registry: TimeTrackingRegistry) -> None:
        """Test stopping timer doesn't create entry under a minute."""
        timer = registry.create_timer("user1")
        registry.start_timer(timer.id)
        timer.accumulated_seconds = 30

        stopped_timer, entry = registry.stop_timer(timer.id, create_entry=True)
        assert entry is None

    def test_get_active_timer(self, registry: TimeTrackingRegistry) -> None:
        """Test getting active timer."""
        timer = registry.create_timer("user1")
        registry.start_timer(timer.id)

        active = registry.get_active_timer("user1")
        assert active is not None
        assert active.id == timer.id

    def test_no_active_timer(self, registry: TimeTrackingRegistry) -> None:
        """Test no active timer."""
        active = registry.get_active_timer("user1")
        assert active is None

    # Timesheet tests
    def test_create_weekly_timesheet(self, registry: TimeTrackingRegistry) -> None:
        """Test creating a weekly timesheet."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        registry.create_entry("user1", week_start, 480)
        registry.create_entry("user1", week_start + timedelta(days=1), 480, is_billable=False)

        timesheet = registry.create_timesheet(
            user_id="user1",
            period_type=TimesheetPeriod.WEEKLY,
            start_date=week_start,
        )

        assert timesheet.total_minutes == 960
        assert timesheet.billable_minutes == 480
        assert timesheet.non_billable_minutes == 480

    def test_submit_timesheet(self, registry: TimeTrackingRegistry) -> None:
        """Test submitting a timesheet."""
        today = date.today()
        registry.create_entry("user1", today, 60)
        timesheet = registry.create_timesheet("user1", TimesheetPeriod.DAILY, today)

        submitted = registry.submit_timesheet(timesheet.id)
        assert submitted.status == TimesheetStatus.SUBMITTED

    def test_approve_timesheet(self, registry: TimeTrackingRegistry) -> None:
        """Test approving a timesheet."""
        today = date.today()
        registry.create_entry("user1", today, 60)
        timesheet = registry.create_timesheet("user1", TimesheetPeriod.DAILY, today)
        registry.submit_timesheet(timesheet.id)

        approved = registry.approve_timesheet(timesheet.id, "approver1")
        assert approved.status == TimesheetStatus.APPROVED

    def test_list_timesheets(self, registry: TimeTrackingRegistry) -> None:
        """Test listing timesheets."""
        today = date.today()
        registry.create_timesheet("user1", TimesheetPeriod.DAILY, today)
        registry.create_timesheet("user1", TimesheetPeriod.DAILY, today - timedelta(days=1))

        timesheets = registry.list_timesheets(user_id="user1")
        assert len(timesheets) == 2

    # Category tests
    def test_create_category(self, registry: TimeTrackingRegistry) -> None:
        """Test creating a category."""
        category = registry.create_category(
            name="Development",
            is_billable=True,
            color="#3498db",
        )
        assert category.id is not None
        assert category.name == "Development"

    def test_list_categories(self, registry: TimeTrackingRegistry) -> None:
        """Test listing categories."""
        registry.create_category("Development")
        registry.create_category("Meeting")

        categories = registry.list_categories()
        assert len(categories) == 2

    # Policy tests
    def test_create_policy(self, registry: TimeTrackingRegistry) -> None:
        """Test creating a policy."""
        policy = registry.create_policy(
            workspace_id="ws1",
            name="Standard Policy",
            require_description=True,
        )
        assert policy.id is not None
        assert policy.require_description is True

    def test_get_workspace_policy(self, registry: TimeTrackingRegistry) -> None:
        """Test getting workspace policy."""
        registry.create_policy("ws1", "Policy 1")

        policy = registry.get_workspace_policy("ws1")
        assert policy is not None

    # Report tests
    def test_generate_report(self, registry: TimeTrackingRegistry) -> None:
        """Test generating a report."""
        today = date.today()
        registry.create_entry("user1", today, 480, is_billable=True, project_id="p1")
        registry.create_entry("user1", today, 120, is_billable=False, project_id="p2")
        registry.create_entry("user2", today, 240, is_billable=True, project_id="p1")

        report = registry.generate_report(
            name="Weekly Report",
            start_date=today,
            end_date=today,
            generated_by="admin",
        )

        assert report.total_entries == 3
        assert report.total_minutes == 840
        assert report.billable_minutes == 720
        assert "user1" in report.by_user
        assert "p1" in report.by_project

    def test_get_stats(self, registry: TimeTrackingRegistry) -> None:
        """Test getting stats."""
        registry.create_entry("user1", date.today(), 480, is_billable=True)
        registry.create_entry("user1", date.today(), 120, is_billable=False)

        stats = registry.get_stats()
        assert stats["total_entries"] == 2
        assert stats["total_minutes"] == 600
        assert stats["billable_minutes"] == 480


# ============================================================
# TimeTrackingManager Tests
# ============================================================

class TestTimeTrackingManager:
    """Test TimeTrackingManager class."""

    @pytest.fixture
    def manager(self) -> TimeTrackingManager:
        """Create a manager for testing."""
        return TimeTrackingManager()

    def test_log_time(self, manager: TimeTrackingManager) -> None:
        """Test logging time."""
        entry = manager.log_time(
            user_id="user1",
            duration_minutes=120,
            description="Development work",
        )
        assert entry.duration_minutes == 120

    def test_log_hours(self, manager: TimeTrackingManager) -> None:
        """Test logging hours."""
        entry = manager.log_hours(
            user_id="user1",
            hours=2.5,
            description="Meeting",
        )
        assert entry.duration_minutes == 150

    def test_start_timer(self, manager: TimeTrackingManager) -> None:
        """Test starting a timer."""
        timer = manager.start_timer(
            user_id="user1",
            description="Working on feature",
        )
        assert timer.status == TimerStatus.RUNNING

    def test_start_timer_stops_previous(self, manager: TimeTrackingManager) -> None:
        """Test starting new timer stops previous."""
        timer1 = manager.start_timer("user1", description="First task")
        timer1.accumulated_seconds = 3600

        timer2 = manager.start_timer("user1", description="Second task")

        assert timer1.status == TimerStatus.STOPPED
        assert timer2.status == TimerStatus.RUNNING

    def test_pause_resume_timer(self, manager: TimeTrackingManager) -> None:
        """Test pause and resume timer."""
        timer = manager.start_timer("user1")

        paused = manager.pause_timer(timer.id)
        assert paused.status == TimerStatus.PAUSED

        resumed = manager.resume_timer(timer.id)
        assert resumed.status == TimerStatus.RUNNING

    def test_stop_timer(self, manager: TimeTrackingManager) -> None:
        """Test stopping a timer."""
        timer = manager.start_timer("user1")
        # Simulate elapsed time by setting started_at in the past
        timer.started_at = datetime.utcnow() - timedelta(hours=2)

        stopped_timer, entry = manager.stop_timer(timer.id)
        assert stopped_timer.status == TimerStatus.STOPPED
        assert entry is not None
        assert entry.duration_minutes >= 119  # Allow for slight timing variance

    def test_discard_timer(self, manager: TimeTrackingManager) -> None:
        """Test discarding a timer."""
        timer = manager.start_timer("user1")
        result = manager.discard_timer(timer.id)
        assert result is True
        assert manager.get_timer(timer.id) is None

    def test_create_weekly_timesheet(self, manager: TimeTrackingManager) -> None:
        """Test creating weekly timesheet."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        manager.log_time("user1", 480, entry_date=week_start)

        timesheet = manager.create_weekly_timesheet("user1", week_start)
        assert timesheet.period_type == TimesheetPeriod.WEEKLY
        assert timesheet.total_minutes == 480

    def test_timesheet_workflow(self, manager: TimeTrackingManager) -> None:
        """Test complete timesheet workflow."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        manager.log_time("user1", 480, entry_date=week_start)
        timesheet = manager.create_weekly_timesheet("user1", week_start)

        submitted = manager.submit_timesheet(timesheet.id)
        assert submitted.status == TimesheetStatus.SUBMITTED

        approved = manager.approve_timesheet(timesheet.id, "manager1")
        assert approved.status == TimesheetStatus.APPROVED

    def test_get_pending_timesheets(self, manager: TimeTrackingManager) -> None:
        """Test getting pending timesheets."""
        today = date.today()
        timesheet = manager.create_weekly_timesheet("user1", today)
        manager.submit_timesheet(timesheet.id)

        pending = manager.get_pending_timesheets()
        assert len(pending) == 1

    def test_get_daily_summary(self, manager: TimeTrackingManager) -> None:
        """Test daily summary."""
        today = date.today()
        manager.log_time("user1", 480, entry_date=today, is_billable=True)
        manager.log_time("user1", 120, entry_date=today, is_billable=False)

        summary = manager.get_daily_summary("user1", today)
        assert summary["entry_count"] == 2
        assert summary["total_hours"] == 10.0
        assert summary["billable_hours"] == 8.0

    def test_get_weekly_summary(self, manager: TimeTrackingManager) -> None:
        """Test weekly summary."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        manager.log_time("user1", 480, entry_date=week_start)
        manager.log_time("user1", 480, entry_date=week_start + timedelta(days=1))

        summary = manager.get_weekly_summary("user1", week_start)
        assert summary["total_hours"] == 16.0

    def test_generate_weekly_report(self, manager: TimeTrackingManager) -> None:
        """Test weekly report generation."""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        manager.log_time("user1", 480, entry_date=week_start)

        report = manager.generate_weekly_report("user1", week_start, "admin")
        assert report.total_minutes == 480

    def test_create_category(self, manager: TimeTrackingManager) -> None:
        """Test creating a category."""
        category = manager.create_category(
            name="Development",
            is_billable=True,
        )
        assert category.name == "Development"

    def test_create_policy(self, manager: TimeTrackingManager) -> None:
        """Test creating a policy."""
        policy = manager.create_policy(
            workspace_id="ws1",
            name="Standard",
            require_description=True,
        )
        assert policy.require_description is True

    def test_validate_entry(self, manager: TimeTrackingManager) -> None:
        """Test entry validation."""
        manager.create_policy(
            workspace_id="ws1",
            name="Policy",
            require_description=True,
        )

        entry = manager.log_time(
            "user1",
            60,
            description="",
            workspace_id="ws1",
        )

        errors = manager.validate_entry(entry, workspace_id="ws1")
        assert "Description is required" in errors

    def test_get_stats(self, manager: TimeTrackingManager) -> None:
        """Test getting stats."""
        manager.log_time("user1", 480, is_billable=True)
        manager.log_time("user1", 120, is_billable=False)

        stats = manager.get_stats()
        assert stats["total_entries"] == 2
        assert stats["billable_percentage"] == 80.0


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstance:
    """Test global instance management."""

    def setup_method(self) -> None:
        """Reset before each test."""
        reset_time_tracking_manager()

    def teardown_method(self) -> None:
        """Reset after each test."""
        reset_time_tracking_manager()

    def test_get_time_tracking_manager(self) -> None:
        """Test getting global manager."""
        manager = get_time_tracking_manager()
        assert manager is not None
        assert isinstance(manager, TimeTrackingManager)

    def test_get_same_instance(self) -> None:
        """Test getting same instance."""
        manager1 = get_time_tracking_manager()
        manager2 = get_time_tracking_manager()
        assert manager1 is manager2

    def test_set_time_tracking_manager(self) -> None:
        """Test setting custom manager."""
        custom = TimeTrackingManager()
        set_time_tracking_manager(custom)
        assert get_time_tracking_manager() is custom

    def test_reset_time_tracking_manager(self) -> None:
        """Test resetting manager."""
        manager1 = get_time_tracking_manager()
        reset_time_tracking_manager()
        manager2 = get_time_tracking_manager()
        assert manager1 is not manager2
