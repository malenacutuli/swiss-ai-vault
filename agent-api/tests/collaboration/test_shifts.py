"""
Tests for the Shift Scheduling module.
"""

import pytest
from datetime import datetime, timedelta, date, time

from app.collaboration.shifts import (
    # Enums
    ShiftType,
    ShiftStatus,
    ScheduleStatus,
    TimeOffType,
    TimeOffStatus,
    AvailabilityType,
    SwapStatus,
    CoverageStatus,
    OvertimeType,
    NotificationType,
    DayOfWeek,
    # Data Models
    ShiftDefinition,
    ShiftAssignment,
    Schedule,
    ScheduleTemplate,
    EmployeeAvailability,
    TimeOffRequest,
    TimeOffBalance,
    ShiftSwapRequest,
    CoverageRequest,
    OvertimeRecord,
    ShiftNotification,
    ShiftAnalytics,
    # Registry and Manager
    ShiftRegistry,
    ShiftManager,
    # Global instance functions
    get_shift_manager,
    set_shift_manager,
    reset_shift_manager,
)


class TestEnums:
    """Test enum definitions."""

    def test_shift_type_values(self):
        """Test ShiftType enum values."""
        assert ShiftType.MORNING.value == "morning"
        assert ShiftType.AFTERNOON.value == "afternoon"
        assert ShiftType.EVENING.value == "evening"
        assert ShiftType.NIGHT.value == "night"
        assert ShiftType.ON_CALL.value == "on_call"
        assert len(ShiftType) == 10

    def test_shift_status_values(self):
        """Test ShiftStatus enum values."""
        assert ShiftStatus.SCHEDULED.value == "scheduled"
        assert ShiftStatus.IN_PROGRESS.value == "in_progress"
        assert ShiftStatus.COMPLETED.value == "completed"
        assert ShiftStatus.CANCELLED.value == "cancelled"

    def test_time_off_type_values(self):
        """Test TimeOffType enum values."""
        assert TimeOffType.VACATION.value == "vacation"
        assert TimeOffType.SICK.value == "sick"
        assert TimeOffType.PERSONAL.value == "personal"
        assert TimeOffType.MATERNITY.value == "maternity"

    def test_swap_status_values(self):
        """Test SwapStatus enum values."""
        assert SwapStatus.PENDING.value == "pending"
        assert SwapStatus.ACCEPTED.value == "accepted"
        assert SwapStatus.DECLINED.value == "declined"
        assert SwapStatus.COMPLETED.value == "completed"

    def test_day_of_week_values(self):
        """Test DayOfWeek enum values."""
        assert DayOfWeek.MONDAY.value == 0
        assert DayOfWeek.FRIDAY.value == 4
        assert DayOfWeek.SUNDAY.value == 6


class TestShiftDefinitionModel:
    """Test ShiftDefinition data model."""

    def test_create_shift_definition(self):
        """Test creating a shift definition."""
        definition = ShiftDefinition(
            id="sd-001",
            name="Morning Shift",
            shift_type=ShiftType.MORNING,
            start_time="06:00",
            end_time="14:00",
            duration_hours=8.0,
        )
        assert definition.id == "sd-001"
        assert definition.name == "Morning Shift"
        assert definition.shift_type == ShiftType.MORNING
        assert definition.duration_hours == 8.0

    def test_shift_definition_to_dict(self):
        """Test shift definition to_dict method."""
        definition = ShiftDefinition(
            id="sd-001",
            name="Night Shift",
            shift_type=ShiftType.NIGHT,
            start_time="22:00",
            end_time="06:00",
        )
        data = definition.to_dict()
        assert data["id"] == "sd-001"
        assert data["shift_type"] == "night"


class TestShiftAssignmentModel:
    """Test ShiftAssignment data model."""

    def test_create_shift_assignment(self):
        """Test creating a shift assignment."""
        today = date.today()
        assignment = ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=today,
            start_time="09:00",
            end_time="17:00",
        )
        assert assignment.id == "sa-001"
        assert assignment.employee_id == "emp-001"
        assert assignment.shift_date == today

    def test_scheduled_hours_calculation(self):
        """Test scheduled hours calculation."""
        assignment = ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=date.today(),
            start_time="09:00",
            end_time="17:00",
        )
        assert assignment.scheduled_hours == 8.0

    def test_overnight_shift_hours(self):
        """Test overnight shift hours calculation."""
        assignment = ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=date.today(),
            start_time="22:00",
            end_time="06:00",
        )
        assert assignment.scheduled_hours == 8.0

    def test_actual_hours_calculation(self):
        """Test actual hours calculation."""
        now = datetime.utcnow()
        assignment = ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=date.today(),
            start_time="09:00",
            end_time="17:00",
            actual_start=now,
            actual_end=now + timedelta(hours=8, minutes=30),
            break_taken_minutes=30,
        )
        assert assignment.actual_hours == 8.0


class TestScheduleModel:
    """Test Schedule data model."""

    def test_create_schedule(self):
        """Test creating a schedule."""
        schedule = Schedule(
            id="sch-001",
            name="Week 1 Schedule",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
        )
        assert schedule.id == "sch-001"
        assert schedule.name == "Week 1 Schedule"
        assert schedule.status == ScheduleStatus.DRAFT


class TestTimeOffRequestModel:
    """Test TimeOffRequest data model."""

    def test_create_time_off_request(self):
        """Test creating a time-off request."""
        today = date.today()
        request = TimeOffRequest(
            id="to-001",
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            start_date=today,
            end_date=today + timedelta(days=5),
            hours_requested=40.0,
        )
        assert request.id == "to-001"
        assert request.time_off_type == TimeOffType.VACATION
        assert request.days_requested == 6

    def test_partial_day_request(self):
        """Test partial day time-off request."""
        today = date.today()
        request = TimeOffRequest(
            id="to-001",
            employee_id="emp-001",
            time_off_type=TimeOffType.PERSONAL,
            start_date=today,
            end_date=today,
            start_time="13:00",
            end_time="17:00",
        )
        assert request.is_partial_day is True


class TestTimeOffBalanceModel:
    """Test TimeOffBalance data model."""

    def test_available_hours_calculation(self):
        """Test available hours calculation."""
        balance = TimeOffBalance(
            id="tb-001",
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            year=2024,
            total_hours=120.0,
            used_hours=40.0,
            pending_hours=16.0,
            carried_over=8.0,
        )
        assert balance.available_hours == 72.0  # 120 + 8 - 40 - 16


class TestShiftRegistry:
    """Test ShiftRegistry functionality."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return ShiftRegistry()

    def test_create_and_get_shift_definition(self, registry):
        """Test creating and retrieving a shift definition."""
        definition = ShiftDefinition(
            id="sd-001",
            name="Morning Shift",
            shift_type=ShiftType.MORNING,
        )
        registry.create_shift_definition(definition)

        result = registry.get_shift_definition("sd-001")
        assert result is not None
        assert result.name == "Morning Shift"

    def test_list_shift_definitions_with_filters(self, registry):
        """Test listing shift definitions with filters."""
        registry.create_shift_definition(ShiftDefinition(
            id="sd-001",
            name="Morning",
            shift_type=ShiftType.MORNING,
            department_id="dept-001",
        ))
        registry.create_shift_definition(ShiftDefinition(
            id="sd-002",
            name="Night",
            shift_type=ShiftType.NIGHT,
            department_id="dept-001",
        ))

        morning = registry.list_shift_definitions(shift_type=ShiftType.MORNING)
        assert len(morning) == 1
        assert morning[0].name == "Morning"

        dept = registry.list_shift_definitions(department_id="dept-001")
        assert len(dept) == 2

    def test_create_and_get_schedule(self, registry):
        """Test creating and retrieving a schedule."""
        schedule = Schedule(
            id="sch-001",
            name="Week 1",
            start_date=date.today(),
        )
        registry.create_schedule(schedule)

        result = registry.get_schedule("sch-001")
        assert result is not None
        assert result.name == "Week 1"

    def test_create_and_get_shift_assignment(self, registry):
        """Test creating and retrieving a shift assignment."""
        assignment = ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=date.today(),
            start_time="09:00",
            end_time="17:00",
        )
        registry.create_shift_assignment(assignment)

        result = registry.get_shift_assignment("sa-001")
        assert result is not None
        assert result.employee_id == "emp-001"

    def test_list_shift_assignments_with_filters(self, registry):
        """Test listing shift assignments with filters."""
        today = date.today()
        registry.create_shift_assignment(ShiftAssignment(
            id="sa-001",
            shift_definition_id="sd-001",
            employee_id="emp-001",
            schedule_id="sch-001",
            shift_date=today,
            start_time="09:00",
            end_time="17:00",
        ))
        registry.create_shift_assignment(ShiftAssignment(
            id="sa-002",
            shift_definition_id="sd-001",
            employee_id="emp-002",
            schedule_id="sch-001",
            shift_date=today + timedelta(days=1),
            start_time="09:00",
            end_time="17:00",
        ))

        emp1 = registry.list_shift_assignments(employee_id="emp-001")
        assert len(emp1) == 1

        schedule = registry.list_shift_assignments(schedule_id="sch-001")
        assert len(schedule) == 2

    def test_time_off_request_management(self, registry):
        """Test time-off request CRUD."""
        today = date.today()
        request = TimeOffRequest(
            id="to-001",
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            start_date=today,
            end_date=today + timedelta(days=5),
        )
        registry.create_time_off_request(request)

        result = registry.get_time_off_request("to-001")
        assert result is not None
        assert result.time_off_type == TimeOffType.VACATION

    def test_swap_request_management(self, registry):
        """Test swap request CRUD."""
        swap = ShiftSwapRequest(
            id="sw-001",
            requester_id="emp-001",
            requester_shift_id="sa-001",
            target_id="emp-002",
            target_shift_id="sa-002",
        )
        registry.create_swap_request(swap)

        result = registry.get_swap_request("sw-001")
        assert result is not None
        assert result.status == SwapStatus.PENDING

    def test_coverage_request_management(self, registry):
        """Test coverage request CRUD."""
        coverage = CoverageRequest(
            id="cv-001",
            shift_id="sa-001",
            requester_id="emp-001",
            urgent=True,
        )
        registry.create_coverage_request(coverage)

        result = registry.get_coverage_request("cv-001")
        assert result is not None
        assert result.urgent is True

        open_requests = registry.get_open_coverage_requests()
        assert len(open_requests) == 1


class TestShiftManager:
    """Test ShiftManager functionality."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return ShiftManager()

    def test_create_shift_definition(self, manager):
        """Test creating a shift definition."""
        definition = manager.create_shift_definition(
            name="Morning Shift",
            shift_type=ShiftType.MORNING,
            start_time="06:00",
            end_time="14:00",
        )
        assert definition is not None
        assert definition.name == "Morning Shift"
        assert definition.duration_hours == 8.0

    def test_create_overnight_shift(self, manager):
        """Test creating an overnight shift."""
        definition = manager.create_shift_definition(
            name="Night Shift",
            shift_type=ShiftType.NIGHT,
            start_time="22:00",
            end_time="06:00",
        )
        assert definition.is_overnight is True
        assert definition.duration_hours == 8.0

    def test_create_schedule(self, manager):
        """Test creating a schedule."""
        today = date.today()
        schedule = manager.create_schedule(
            name="Week 1 Schedule",
            start_date=today,
            end_date=today + timedelta(days=7),
            created_by="admin",
        )
        assert schedule is not None
        assert schedule.status == ScheduleStatus.DRAFT

    def test_publish_schedule(self, manager):
        """Test publishing a schedule."""
        today = date.today()
        schedule = manager.create_schedule(
            name="Week 1",
            start_date=today,
        )
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        published = manager.publish_schedule(schedule.id, published_by="admin")
        assert published.status == ScheduleStatus.PUBLISHED
        assert published.published_at is not None

    def test_assign_shift(self, manager):
        """Test assigning a shift."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )

        assignment = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )
        assert assignment is not None
        assert assignment.employee_id == "emp-001"
        assert assignment.scheduled_hours == 8.0

    def test_start_and_end_shift(self, manager):
        """Test starting and ending a shift."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        assignment = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        started = manager.start_shift(assignment.id)
        assert started.status == ShiftStatus.IN_PROGRESS
        assert started.actual_start is not None

        ended = manager.end_shift(assignment.id, break_taken_minutes=30)
        assert ended.status == ShiftStatus.COMPLETED
        assert ended.actual_end is not None

    def test_cancel_shift(self, manager):
        """Test cancelling a shift."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        assignment = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        cancelled = manager.cancel_shift(assignment.id, reason="Schedule change")
        assert cancelled.status == ShiftStatus.CANCELLED

    def test_set_availability(self, manager):
        """Test setting employee availability."""
        availability = manager.set_availability(
            employee_id="emp-001",
            day_of_week=DayOfWeek.MONDAY,
            availability_type=AvailabilityType.AVAILABLE,
            start_time="08:00",
            end_time="18:00",
        )
        assert availability is not None
        assert availability.day_of_week == DayOfWeek.MONDAY

    def test_check_availability(self, manager):
        """Test checking employee availability."""
        manager.set_availability(
            employee_id="emp-001",
            day_of_week=DayOfWeek.MONDAY,
            availability_type=AvailabilityType.UNAVAILABLE,
        )

        # Find a Monday
        today = date.today()
        while today.weekday() != 0:  # 0 = Monday
            today += timedelta(days=1)

        available = manager.check_availability(
            employee_id="emp-001",
            shift_date=today,
            start_time="09:00",
            end_time="17:00",
        )
        assert available is False

    def test_request_time_off(self, manager):
        """Test requesting time off."""
        today = date.today()
        request = manager.request_time_off(
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            start_date=today + timedelta(days=7),
            end_date=today + timedelta(days=14),
            reason="Family vacation",
        )
        assert request is not None
        assert request.status == TimeOffStatus.PENDING
        assert request.hours_requested == 64.0  # 8 days * 8 hours

    def test_approve_time_off(self, manager):
        """Test approving time off."""
        today = date.today()
        # Create balance first
        manager.create_time_off_balance(
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            year=today.year,
            total_hours=120.0,
        )

        request = manager.request_time_off(
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            start_date=today + timedelta(days=7),
            end_date=today + timedelta(days=9),
        )

        approved = manager.approve_time_off(request.id, approved_by="manager")
        assert approved.status == TimeOffStatus.APPROVED

        # Check balance updated
        balance = manager.get_time_off_balance(
            "emp-001", TimeOffType.VACATION, today.year
        )
        assert balance.used_hours == 24.0

    def test_deny_time_off(self, manager):
        """Test denying time off."""
        today = date.today()
        manager.create_time_off_balance(
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            year=today.year,
            total_hours=120.0,
        )

        request = manager.request_time_off(
            employee_id="emp-001",
            time_off_type=TimeOffType.VACATION,
            start_date=today + timedelta(days=7),
            end_date=today + timedelta(days=9),
        )

        denied = manager.deny_time_off(
            request.id,
            denied_by="manager",
            reason="Critical project deadline",
        )
        assert denied.status == TimeOffStatus.DENIED
        assert denied.denied_reason == "Critical project deadline"

    def test_request_swap(self, manager):
        """Test requesting a shift swap."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )

        shift1 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )
        shift2 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-002",
            schedule_id=schedule.id,
            shift_date=today + timedelta(days=1),
        )

        swap = manager.request_swap(
            requester_id="emp-001",
            requester_shift_id=shift1.id,
            target_id="emp-002",
            target_shift_id=shift2.id,
            reason="Doctor appointment",
        )
        assert swap is not None
        assert swap.status == SwapStatus.PENDING

    def test_swap_workflow(self, manager):
        """Test complete swap workflow."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )

        shift1 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )
        shift2 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-002",
            schedule_id=schedule.id,
            shift_date=today + timedelta(days=1),
        )

        swap = manager.request_swap(
            requester_id="emp-001",
            requester_shift_id=shift1.id,
            target_id="emp-002",
            target_shift_id=shift2.id,
        )

        # Target accepts
        accepted = manager.accept_swap(swap.id)
        assert accepted.status == SwapStatus.ACCEPTED

        # Manager approves
        approved = manager.approve_swap(swap.id, approved_by="manager")
        assert approved.status == SwapStatus.COMPLETED

        # Verify shifts swapped
        updated_shift1 = manager.get_shift_assignment(shift1.id)
        updated_shift2 = manager.get_shift_assignment(shift2.id)
        assert updated_shift1.employee_id == "emp-002"
        assert updated_shift2.employee_id == "emp-001"

    def test_decline_swap(self, manager):
        """Test declining a swap request."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )

        shift1 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )
        shift2 = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-002",
            schedule_id=schedule.id,
            shift_date=today + timedelta(days=1),
        )

        swap = manager.request_swap(
            requester_id="emp-001",
            requester_shift_id=shift1.id,
            target_id="emp-002",
            target_shift_id=shift2.id,
        )

        declined = manager.decline_swap(swap.id)
        assert declined.status == SwapStatus.DECLINED

    def test_request_coverage(self, manager):
        """Test requesting shift coverage."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        shift = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        coverage = manager.request_coverage(
            shift_id=shift.id,
            requester_id="emp-001",
            reason="Sick",
            urgent=True,
        )
        assert coverage is not None
        assert coverage.status == CoverageStatus.OPEN
        assert coverage.urgent is True

    def test_claim_and_approve_coverage(self, manager):
        """Test claiming and approving coverage."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        shift = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        coverage = manager.request_coverage(
            shift_id=shift.id,
            requester_id="emp-001",
        )

        claimed = manager.claim_coverage(coverage.id, claimed_by="emp-002")
        assert claimed.status == CoverageStatus.CLAIMED
        assert claimed.claimed_by == "emp-002"

        approved = manager.approve_coverage(coverage.id, approved_by="manager")
        assert approved.status == CoverageStatus.APPROVED

        # Verify shift reassigned
        updated_shift = manager.get_shift_assignment(shift.id)
        assert updated_shift.employee_id == "emp-002"

    def test_record_overtime(self, manager):
        """Test recording overtime."""
        today = date.today()
        overtime = manager.record_overtime(
            employee_id="emp-001",
            date=today,
            hours=2.0,
            overtime_type=OvertimeType.REGULAR,
            reason="Urgent project deadline",
        )
        assert overtime is not None
        assert overtime.hours == 2.0
        assert overtime.rate_multiplier == 1.5

    def test_approve_overtime(self, manager):
        """Test approving overtime."""
        today = date.today()
        overtime = manager.record_overtime(
            employee_id="emp-001",
            date=today,
            hours=2.0,
        )

        approved = manager.approve_overtime(overtime.id, approved_by="manager")
        assert approved.approved is True
        assert approved.approved_by == "manager"

    def test_get_total_overtime_hours(self, manager):
        """Test calculating total overtime hours."""
        today = date.today()
        for i in range(3):
            ot = manager.record_overtime(
                employee_id="emp-001",
                date=today + timedelta(days=i),
                hours=2.0,
            )
            manager.approve_overtime(ot.id, approved_by="manager")

        total = manager.get_total_overtime_hours(
            employee_id="emp-001",
            start_date=today,
            end_date=today + timedelta(days=7),
        )
        assert total == 6.0

    def test_generate_analytics(self, manager):
        """Test generating analytics."""
        today = date.today()
        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )

        # Create some shifts
        for i in range(5):
            manager.assign_shift(
                shift_definition_id=definition.id,
                employee_id=f"emp-00{i % 3 + 1}",
                schedule_id=schedule.id,
                shift_date=today + timedelta(days=i),
            )

        analytics = manager.generate_analytics(
            period_start=today,
            period_end=today + timedelta(days=7),
        )
        assert analytics.total_shifts == 5
        assert analytics.total_hours == 40.0


class TestGlobalInstances:
    """Test global instance management."""

    def test_get_shift_manager(self):
        """Test getting global shift manager."""
        reset_shift_manager()
        manager = get_shift_manager()
        assert manager is not None
        assert isinstance(manager, ShiftManager)

    def test_set_shift_manager(self):
        """Test setting custom shift manager."""
        reset_shift_manager()
        custom_manager = ShiftManager()
        set_shift_manager(custom_manager)

        manager = get_shift_manager()
        assert manager is custom_manager

    def test_reset_shift_manager(self):
        """Test resetting shift manager."""
        manager1 = get_shift_manager()
        reset_shift_manager()
        manager2 = get_shift_manager()
        assert manager1 is not manager2


class TestShiftWorkflows:
    """Test complete shift workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return ShiftManager()

    def test_complete_scheduling_workflow(self, manager):
        """Test a complete scheduling workflow."""
        today = date.today()

        # Create shift definitions
        morning = manager.create_shift_definition(
            name="Morning",
            shift_type=ShiftType.MORNING,
            start_time="06:00",
            end_time="14:00",
        )
        evening = manager.create_shift_definition(
            name="Evening",
            shift_type=ShiftType.EVENING,
            start_time="14:00",
            end_time="22:00",
        )

        # Create schedule
        schedule = manager.create_schedule(
            name="Week of " + today.isoformat(),
            start_date=today,
            end_date=today + timedelta(days=7),
            created_by="scheduler",
        )

        # Assign shifts
        for i in range(7):
            shift_date = today + timedelta(days=i)
            manager.assign_shift(
                shift_definition_id=morning.id,
                employee_id="emp-001",
                schedule_id=schedule.id,
                shift_date=shift_date,
            )
            manager.assign_shift(
                shift_definition_id=evening.id,
                employee_id="emp-002",
                schedule_id=schedule.id,
                shift_date=shift_date,
            )

        # Publish schedule
        published = manager.publish_schedule(schedule.id, published_by="manager")
        assert published.status == ScheduleStatus.PUBLISHED
        assert published.total_shifts == 14
        assert published.total_hours == 112.0

    def test_time_off_with_coverage_workflow(self, manager):
        """Test time off request with coverage needed."""
        today = date.today()

        # Setup
        manager.create_time_off_balance(
            employee_id="emp-001",
            time_off_type=TimeOffType.SICK,
            year=today.year,
            total_hours=80.0,
        )

        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        shift = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        # Employee gets sick
        time_off = manager.request_time_off(
            employee_id="emp-001",
            time_off_type=TimeOffType.SICK,
            start_date=today,
            end_date=today,
            reason="Flu",
        )
        assert time_off.affects_shifts == [shift.id]
        assert time_off.coverage_required is True

        # Request coverage
        coverage = manager.request_coverage(
            shift_id=shift.id,
            requester_id="emp-001",
            reason="Sick - need coverage",
            urgent=True,
        )

        # Another employee claims it
        claimed = manager.claim_coverage(coverage.id, claimed_by="emp-002")
        approved = manager.approve_coverage(coverage.id, approved_by="manager")

        # Approve time off
        manager.approve_time_off(time_off.id, approved_by="manager")

        # Verify
        updated_shift = manager.get_shift_assignment(shift.id)
        assert updated_shift.employee_id == "emp-002"

    def test_overtime_tracking_workflow(self, manager):
        """Test overtime tracking workflow."""
        today = date.today()

        schedule = manager.create_schedule(name="Week 1", start_date=today)
        definition = manager.create_shift_definition(
            name="Morning",
            start_time="09:00",
            end_time="17:00",
        )
        shift = manager.assign_shift(
            shift_definition_id=definition.id,
            employee_id="emp-001",
            schedule_id=schedule.id,
            shift_date=today,
        )

        # Employee starts shift
        manager.start_shift(shift.id)

        # Simulate working late (actual end would be calculated based on time)
        updated = manager.registry.update_shift_assignment(
            shift.id,
            {
                "actual_end": datetime.utcnow() + timedelta(hours=10),
                "is_overtime": True,
                "overtime_hours": 2.0,
                "overtime_type": OvertimeType.REGULAR,
            },
        )

        # Record overtime
        overtime = manager.record_overtime(
            employee_id="emp-001",
            date=today,
            hours=2.0,
            shift_id=shift.id,
            reason="Urgent deadline",
        )
        manager.approve_overtime(overtime.id, approved_by="manager")

        # Check analytics
        analytics = manager.generate_analytics(
            period_start=today,
            period_end=today + timedelta(days=1),
        )
        assert analytics.overtime_hours == 2.0
