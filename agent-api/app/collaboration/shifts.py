"""
Shift Scheduling module for enterprise collaboration.

This module provides comprehensive shift scheduling functionality including:
- Shift definitions and templates
- Schedule creation and management
- Employee availability tracking
- Time-off requests and approvals
- Shift swaps and coverage requests
- Overtime tracking and management
- Schedule notifications
- Scheduling analytics
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date, time
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import uuid


# ============================================================
# Enums
# ============================================================

class ShiftType(Enum):
    """Types of shifts."""
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"
    OVERNIGHT = "overnight"
    SPLIT = "split"
    FLEX = "flex"
    ON_CALL = "on_call"
    STANDBY = "standby"
    CUSTOM = "custom"


class ShiftStatus(Enum):
    """Status of a shift assignment."""
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"
    SWAPPED = "swapped"


class ScheduleStatus(Enum):
    """Status of a schedule."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class TimeOffType(Enum):
    """Types of time off."""
    VACATION = "vacation"
    SICK = "sick"
    PERSONAL = "personal"
    BEREAVEMENT = "bereavement"
    JURY_DUTY = "jury_duty"
    MILITARY = "military"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    FAMILY_MEDICAL = "family_medical"
    UNPAID = "unpaid"
    COMPENSATORY = "compensatory"
    OTHER = "other"


class TimeOffStatus(Enum):
    """Status of a time-off request."""
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class AvailabilityType(Enum):
    """Types of availability."""
    AVAILABLE = "available"
    PREFERRED = "preferred"
    UNAVAILABLE = "unavailable"
    LIMITED = "limited"


class SwapStatus(Enum):
    """Status of a shift swap request."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class CoverageStatus(Enum):
    """Status of a coverage request."""
    OPEN = "open"
    CLAIMED = "claimed"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class OvertimeType(Enum):
    """Types of overtime."""
    REGULAR = "regular"
    DOUBLE_TIME = "double_time"
    HOLIDAY = "holiday"
    EMERGENCY = "emergency"
    VOLUNTARY = "voluntary"
    MANDATORY = "mandatory"


class NotificationType(Enum):
    """Types of shift notifications."""
    SCHEDULE_PUBLISHED = "schedule_published"
    SHIFT_ASSIGNED = "shift_assigned"
    SHIFT_CHANGED = "shift_changed"
    SHIFT_CANCELLED = "shift_cancelled"
    SHIFT_REMINDER = "shift_reminder"
    SWAP_REQUESTED = "swap_requested"
    SWAP_ACCEPTED = "swap_accepted"
    SWAP_DECLINED = "swap_declined"
    COVERAGE_NEEDED = "coverage_needed"
    COVERAGE_CLAIMED = "coverage_claimed"
    TIME_OFF_REQUESTED = "time_off_requested"
    TIME_OFF_APPROVED = "time_off_approved"
    TIME_OFF_DENIED = "time_off_denied"
    OVERTIME_ALERT = "overtime_alert"


class DayOfWeek(Enum):
    """Days of the week."""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


# ============================================================
# Data Models
# ============================================================

@dataclass
class ShiftDefinition:
    """Defines a shift template."""
    id: str
    name: str
    shift_type: ShiftType = ShiftType.CUSTOM
    start_time: str = "09:00"  # HH:MM format
    end_time: str = "17:00"
    duration_hours: float = 8.0
    break_duration_minutes: int = 30
    color: str = "#3498db"
    department_id: Optional[str] = None
    location_id: Optional[str] = None
    min_staff: int = 1
    max_staff: Optional[int] = None
    skills_required: List[str] = field(default_factory=list)
    pay_rate_multiplier: float = 1.0
    is_overnight: bool = False
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "shift_type": self.shift_type.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_hours": self.duration_hours,
            "break_duration_minutes": self.break_duration_minutes,
            "color": self.color,
            "min_staff": self.min_staff,
            "active": self.active,
        }


@dataclass
class ShiftAssignment:
    """Represents an employee's shift assignment."""
    id: str
    shift_definition_id: str
    employee_id: str
    schedule_id: str
    shift_date: date
    start_time: str
    end_time: str
    status: ShiftStatus = ShiftStatus.SCHEDULED
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    break_taken_minutes: int = 0
    notes: Optional[str] = None
    location_id: Optional[str] = None
    position: Optional[str] = None
    is_overtime: bool = False
    overtime_type: Optional[OvertimeType] = None
    overtime_hours: float = 0.0
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def scheduled_hours(self) -> float:
        """Calculate scheduled hours."""
        start = datetime.strptime(self.start_time, "%H:%M")
        end = datetime.strptime(self.end_time, "%H:%M")
        if end < start:  # Overnight shift
            end += timedelta(days=1)
        delta = end - start
        return delta.total_seconds() / 3600

    @property
    def actual_hours(self) -> Optional[float]:
        """Calculate actual hours worked."""
        if self.actual_start and self.actual_end:
            delta = self.actual_end - self.actual_start
            hours = delta.total_seconds() / 3600
            hours -= self.break_taken_minutes / 60
            return round(hours, 2)
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "shift_definition_id": self.shift_definition_id,
            "employee_id": self.employee_id,
            "shift_date": self.shift_date.isoformat(),
            "start_time": self.start_time,
            "end_time": self.end_time,
            "status": self.status.value,
            "scheduled_hours": self.scheduled_hours,
            "actual_hours": self.actual_hours,
            "is_overtime": self.is_overtime,
        }


@dataclass
class Schedule:
    """Represents a work schedule for a period."""
    id: str
    name: str
    department_id: Optional[str] = None
    location_id: Optional[str] = None
    start_date: date = field(default_factory=date.today)
    end_date: Optional[date] = None
    status: ScheduleStatus = ScheduleStatus.DRAFT
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    total_shifts: int = 0
    total_hours: float = 0.0
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status.value,
            "total_shifts": self.total_shifts,
            "total_hours": self.total_hours,
        }


@dataclass
class ScheduleTemplate:
    """Template for creating recurring schedules."""
    id: str
    name: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    pattern_weeks: int = 1  # Number of weeks in the pattern
    shifts: List[Dict[str, Any]] = field(default_factory=list)
    active: bool = True
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "pattern_weeks": self.pattern_weeks,
            "shifts_count": len(self.shifts),
            "active": self.active,
        }


@dataclass
class EmployeeAvailability:
    """Represents an employee's availability."""
    id: str
    employee_id: str
    day_of_week: DayOfWeek
    availability_type: AvailabilityType = AvailabilityType.AVAILABLE
    start_time: Optional[str] = None  # HH:MM, None means all day
    end_time: Optional[str] = None
    recurring: bool = True
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "day_of_week": self.day_of_week.value,
            "availability_type": self.availability_type.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "recurring": self.recurring,
        }


@dataclass
class TimeOffRequest:
    """Represents a time-off request."""
    id: str
    employee_id: str
    time_off_type: TimeOffType
    start_date: date
    end_date: date
    start_time: Optional[str] = None  # For partial day
    end_time: Optional[str] = None
    hours_requested: float = 0.0
    reason: Optional[str] = None
    status: TimeOffStatus = TimeOffStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    denied_reason: Optional[str] = None
    affects_shifts: List[str] = field(default_factory=list)
    coverage_required: bool = False
    coverage_found: bool = False
    submitted_at: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def days_requested(self) -> int:
        """Calculate number of days requested."""
        return (self.end_date - self.start_date).days + 1

    @property
    def is_partial_day(self) -> bool:
        """Check if request is for partial day."""
        return self.start_time is not None or self.end_time is not None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "time_off_type": self.time_off_type.value,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "days_requested": self.days_requested,
            "status": self.status.value,
        }


@dataclass
class TimeOffBalance:
    """Tracks an employee's time-off balance."""
    id: str
    employee_id: str
    time_off_type: TimeOffType
    year: int
    total_hours: float = 0.0
    used_hours: float = 0.0
    pending_hours: float = 0.0
    carried_over: float = 0.0
    accrual_rate: float = 0.0  # Hours per pay period
    max_carryover: float = 0.0
    expires_at: Optional[date] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def available_hours(self) -> float:
        """Calculate available hours."""
        return self.total_hours + self.carried_over - self.used_hours - self.pending_hours

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "time_off_type": self.time_off_type.value,
            "year": self.year,
            "total_hours": self.total_hours,
            "used_hours": self.used_hours,
            "available_hours": self.available_hours,
        }


@dataclass
class ShiftSwapRequest:
    """Represents a shift swap request between employees."""
    id: str
    requester_id: str
    requester_shift_id: str
    target_id: str
    target_shift_id: str
    status: SwapStatus = SwapStatus.PENDING
    reason: Optional[str] = None
    requester_accepted: bool = True
    target_accepted: bool = False
    manager_approved: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "requester_shift_id": self.requester_shift_id,
            "target_id": self.target_id,
            "target_shift_id": self.target_shift_id,
            "status": self.status.value,
        }


@dataclass
class CoverageRequest:
    """Represents a request for shift coverage."""
    id: str
    shift_id: str
    requester_id: str
    reason: Optional[str] = None
    status: CoverageStatus = CoverageStatus.OPEN
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    incentive: Optional[str] = None
    urgent: bool = False
    expires_at: Optional[datetime] = None
    eligible_employees: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "shift_id": self.shift_id,
            "requester_id": self.requester_id,
            "status": self.status.value,
            "claimed_by": self.claimed_by,
            "urgent": self.urgent,
        }


@dataclass
class OvertimeRecord:
    """Records overtime worked."""
    id: str
    employee_id: str
    shift_id: Optional[str] = None
    overtime_type: OvertimeType = OvertimeType.REGULAR
    date: date = field(default_factory=date.today)
    hours: float = 0.0
    rate_multiplier: float = 1.5
    approved: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "overtime_type": self.overtime_type.value,
            "date": self.date.isoformat(),
            "hours": self.hours,
            "rate_multiplier": self.rate_multiplier,
            "approved": self.approved,
        }


@dataclass
class ShiftNotification:
    """Represents a shift-related notification."""
    id: str
    notification_type: NotificationType
    recipient_id: str
    shift_id: Optional[str] = None
    schedule_id: Optional[str] = None
    message: str = ""
    sent: bool = False
    sent_at: Optional[datetime] = None
    read: bool = False
    read_at: Optional[datetime] = None
    channel: str = "push"
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "notification_type": self.notification_type.value,
            "recipient_id": self.recipient_id,
            "sent": self.sent,
            "read": self.read,
        }


@dataclass
class ShiftAnalytics:
    """Analytics data for shift scheduling."""
    id: str
    period_start: date
    period_end: date
    department_id: Optional[str] = None
    total_shifts: int = 0
    total_hours: float = 0.0
    overtime_hours: float = 0.0
    covered_shifts: int = 0
    uncovered_shifts: int = 0
    swaps_requested: int = 0
    swaps_completed: int = 0
    time_off_requests: int = 0
    time_off_approved: int = 0
    no_shows: int = 0
    late_arrivals: int = 0
    average_hours_per_employee: float = 0.0
    coverage_rate: float = 0.0
    shifts_by_type: Dict[str, int] = field(default_factory=dict)
    hours_by_employee: Dict[str, float] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_shifts": self.total_shifts,
            "total_hours": self.total_hours,
            "overtime_hours": self.overtime_hours,
            "coverage_rate": self.coverage_rate,
        }


# ============================================================
# Registry
# ============================================================

class ShiftRegistry:
    """Registry for managing shift data."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._shift_definitions: Dict[str, ShiftDefinition] = {}
        self._shift_assignments: Dict[str, ShiftAssignment] = {}
        self._schedules: Dict[str, Schedule] = {}
        self._schedule_templates: Dict[str, ScheduleTemplate] = {}
        self._availability: Dict[str, EmployeeAvailability] = {}
        self._time_off_requests: Dict[str, TimeOffRequest] = {}
        self._time_off_balances: Dict[str, TimeOffBalance] = {}
        self._swap_requests: Dict[str, ShiftSwapRequest] = {}
        self._coverage_requests: Dict[str, CoverageRequest] = {}
        self._overtime_records: Dict[str, OvertimeRecord] = {}
        self._notifications: Dict[str, ShiftNotification] = {}
        self._analytics: Dict[str, ShiftAnalytics] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._shift_definitions.clear()
        self._shift_assignments.clear()
        self._schedules.clear()
        self._schedule_templates.clear()
        self._availability.clear()
        self._time_off_requests.clear()
        self._time_off_balances.clear()
        self._swap_requests.clear()
        self._coverage_requests.clear()
        self._overtime_records.clear()
        self._notifications.clear()
        self._analytics.clear()

    # Shift Definition CRUD
    def create_shift_definition(self, definition: ShiftDefinition) -> ShiftDefinition:
        """Create a shift definition."""
        self._shift_definitions[definition.id] = definition
        return definition

    def get_shift_definition(self, definition_id: str) -> Optional[ShiftDefinition]:
        """Get a shift definition by ID."""
        return self._shift_definitions.get(definition_id)

    def update_shift_definition(
        self, definition_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftDefinition]:
        """Update a shift definition."""
        definition = self._shift_definitions.get(definition_id)
        if definition:
            for key, value in updates.items():
                if hasattr(definition, key):
                    setattr(definition, key, value)
        return definition

    def delete_shift_definition(self, definition_id: str) -> bool:
        """Delete a shift definition."""
        if definition_id in self._shift_definitions:
            del self._shift_definitions[definition_id]
            return True
        return False

    def list_shift_definitions(
        self,
        shift_type: Optional[ShiftType] = None,
        department_id: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[ShiftDefinition]:
        """List shift definitions."""
        results = list(self._shift_definitions.values())

        if shift_type:
            results = [d for d in results if d.shift_type == shift_type]
        if department_id:
            results = [d for d in results if d.department_id == department_id]
        if active is not None:
            results = [d for d in results if d.active == active]

        return results

    # Shift Assignment CRUD
    def create_shift_assignment(self, assignment: ShiftAssignment) -> ShiftAssignment:
        """Create a shift assignment."""
        self._shift_assignments[assignment.id] = assignment
        return assignment

    def get_shift_assignment(self, assignment_id: str) -> Optional[ShiftAssignment]:
        """Get a shift assignment by ID."""
        return self._shift_assignments.get(assignment_id)

    def update_shift_assignment(
        self, assignment_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftAssignment]:
        """Update a shift assignment."""
        assignment = self._shift_assignments.get(assignment_id)
        if assignment:
            for key, value in updates.items():
                if hasattr(assignment, key):
                    setattr(assignment, key, value)
            assignment.updated_at = datetime.utcnow()
        return assignment

    def delete_shift_assignment(self, assignment_id: str) -> bool:
        """Delete a shift assignment."""
        if assignment_id in self._shift_assignments:
            del self._shift_assignments[assignment_id]
            return True
        return False

    def list_shift_assignments(
        self,
        employee_id: Optional[str] = None,
        schedule_id: Optional[str] = None,
        status: Optional[ShiftStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ShiftAssignment]:
        """List shift assignments."""
        results = list(self._shift_assignments.values())

        if employee_id:
            results = [a for a in results if a.employee_id == employee_id]
        if schedule_id:
            results = [a for a in results if a.schedule_id == schedule_id]
        if status:
            results = [a for a in results if a.status == status]
        if start_date:
            results = [a for a in results if a.shift_date >= start_date]
        if end_date:
            results = [a for a in results if a.shift_date <= end_date]

        return sorted(results, key=lambda a: (a.shift_date, a.start_time))

    def get_employee_shifts_for_date(
        self, employee_id: str, shift_date: date
    ) -> List[ShiftAssignment]:
        """Get all shifts for an employee on a specific date."""
        return [
            a for a in self._shift_assignments.values()
            if a.employee_id == employee_id and a.shift_date == shift_date
        ]

    # Schedule CRUD
    def create_schedule(self, schedule: Schedule) -> Schedule:
        """Create a schedule."""
        self._schedules[schedule.id] = schedule
        return schedule

    def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Get a schedule by ID."""
        return self._schedules.get(schedule_id)

    def update_schedule(
        self, schedule_id: str, updates: Dict[str, Any]
    ) -> Optional[Schedule]:
        """Update a schedule."""
        schedule = self._schedules.get(schedule_id)
        if schedule:
            for key, value in updates.items():
                if hasattr(schedule, key):
                    setattr(schedule, key, value)
            schedule.updated_at = datetime.utcnow()
        return schedule

    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a schedule."""
        if schedule_id in self._schedules:
            del self._schedules[schedule_id]
            return True
        return False

    def list_schedules(
        self,
        department_id: Optional[str] = None,
        status: Optional[ScheduleStatus] = None,
    ) -> List[Schedule]:
        """List schedules."""
        results = list(self._schedules.values())

        if department_id:
            results = [s for s in results if s.department_id == department_id]
        if status:
            results = [s for s in results if s.status == status]

        return sorted(results, key=lambda s: s.start_date, reverse=True)

    # Schedule Template CRUD
    def create_schedule_template(self, template: ScheduleTemplate) -> ScheduleTemplate:
        """Create a schedule template."""
        self._schedule_templates[template.id] = template
        return template

    def get_schedule_template(self, template_id: str) -> Optional[ScheduleTemplate]:
        """Get a schedule template by ID."""
        return self._schedule_templates.get(template_id)

    def list_schedule_templates(
        self, department_id: Optional[str] = None, active: Optional[bool] = None
    ) -> List[ScheduleTemplate]:
        """List schedule templates."""
        results = list(self._schedule_templates.values())

        if department_id:
            results = [t for t in results if t.department_id == department_id]
        if active is not None:
            results = [t for t in results if t.active == active]

        return results

    # Availability CRUD
    def create_availability(self, availability: EmployeeAvailability) -> EmployeeAvailability:
        """Create an availability record."""
        self._availability[availability.id] = availability
        return availability

    def get_availability(self, availability_id: str) -> Optional[EmployeeAvailability]:
        """Get an availability record by ID."""
        return self._availability.get(availability_id)

    def update_availability(
        self, availability_id: str, updates: Dict[str, Any]
    ) -> Optional[EmployeeAvailability]:
        """Update an availability record."""
        availability = self._availability.get(availability_id)
        if availability:
            for key, value in updates.items():
                if hasattr(availability, key):
                    setattr(availability, key, value)
        return availability

    def delete_availability(self, availability_id: str) -> bool:
        """Delete an availability record."""
        if availability_id in self._availability:
            del self._availability[availability_id]
            return True
        return False

    def get_employee_availability(
        self, employee_id: str, day_of_week: Optional[DayOfWeek] = None
    ) -> List[EmployeeAvailability]:
        """Get availability for an employee."""
        results = [
            a for a in self._availability.values()
            if a.employee_id == employee_id
        ]
        if day_of_week:
            results = [a for a in results if a.day_of_week == day_of_week]
        return results

    # Time Off Request CRUD
    def create_time_off_request(self, request: TimeOffRequest) -> TimeOffRequest:
        """Create a time-off request."""
        self._time_off_requests[request.id] = request
        return request

    def get_time_off_request(self, request_id: str) -> Optional[TimeOffRequest]:
        """Get a time-off request by ID."""
        return self._time_off_requests.get(request_id)

    def update_time_off_request(
        self, request_id: str, updates: Dict[str, Any]
    ) -> Optional[TimeOffRequest]:
        """Update a time-off request."""
        request = self._time_off_requests.get(request_id)
        if request:
            for key, value in updates.items():
                if hasattr(request, key):
                    setattr(request, key, value)
        return request

    def delete_time_off_request(self, request_id: str) -> bool:
        """Delete a time-off request."""
        if request_id in self._time_off_requests:
            del self._time_off_requests[request_id]
            return True
        return False

    def list_time_off_requests(
        self,
        employee_id: Optional[str] = None,
        status: Optional[TimeOffStatus] = None,
        time_off_type: Optional[TimeOffType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[TimeOffRequest]:
        """List time-off requests."""
        results = list(self._time_off_requests.values())

        if employee_id:
            results = [r for r in results if r.employee_id == employee_id]
        if status:
            results = [r for r in results if r.status == status]
        if time_off_type:
            results = [r for r in results if r.time_off_type == time_off_type]
        if start_date:
            results = [r for r in results if r.end_date >= start_date]
        if end_date:
            results = [r for r in results if r.start_date <= end_date]

        return sorted(results, key=lambda r: r.start_date)

    # Time Off Balance CRUD
    def create_time_off_balance(self, balance: TimeOffBalance) -> TimeOffBalance:
        """Create a time-off balance."""
        self._time_off_balances[balance.id] = balance
        return balance

    def get_time_off_balance(self, balance_id: str) -> Optional[TimeOffBalance]:
        """Get a time-off balance by ID."""
        return self._time_off_balances.get(balance_id)

    def update_time_off_balance(
        self, balance_id: str, updates: Dict[str, Any]
    ) -> Optional[TimeOffBalance]:
        """Update a time-off balance."""
        balance = self._time_off_balances.get(balance_id)
        if balance:
            for key, value in updates.items():
                if hasattr(balance, key):
                    setattr(balance, key, value)
            balance.updated_at = datetime.utcnow()
        return balance

    def get_employee_time_off_balance(
        self,
        employee_id: str,
        time_off_type: TimeOffType,
        year: int,
    ) -> Optional[TimeOffBalance]:
        """Get time-off balance for an employee."""
        for balance in self._time_off_balances.values():
            if (
                balance.employee_id == employee_id
                and balance.time_off_type == time_off_type
                and balance.year == year
            ):
                return balance
        return None

    def list_employee_balances(
        self, employee_id: str, year: Optional[int] = None
    ) -> List[TimeOffBalance]:
        """List all time-off balances for an employee."""
        results = [
            b for b in self._time_off_balances.values()
            if b.employee_id == employee_id
        ]
        if year:
            results = [b for b in results if b.year == year]
        return results

    # Swap Request CRUD
    def create_swap_request(self, request: ShiftSwapRequest) -> ShiftSwapRequest:
        """Create a swap request."""
        self._swap_requests[request.id] = request
        return request

    def get_swap_request(self, request_id: str) -> Optional[ShiftSwapRequest]:
        """Get a swap request by ID."""
        return self._swap_requests.get(request_id)

    def update_swap_request(
        self, request_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftSwapRequest]:
        """Update a swap request."""
        request = self._swap_requests.get(request_id)
        if request:
            for key, value in updates.items():
                if hasattr(request, key):
                    setattr(request, key, value)
        return request

    def list_swap_requests(
        self,
        employee_id: Optional[str] = None,
        status: Optional[SwapStatus] = None,
    ) -> List[ShiftSwapRequest]:
        """List swap requests."""
        results = list(self._swap_requests.values())

        if employee_id:
            results = [
                r for r in results
                if r.requester_id == employee_id or r.target_id == employee_id
            ]
        if status:
            results = [r for r in results if r.status == status]

        return sorted(results, key=lambda r: r.created_at, reverse=True)

    # Coverage Request CRUD
    def create_coverage_request(self, request: CoverageRequest) -> CoverageRequest:
        """Create a coverage request."""
        self._coverage_requests[request.id] = request
        return request

    def get_coverage_request(self, request_id: str) -> Optional[CoverageRequest]:
        """Get a coverage request by ID."""
        return self._coverage_requests.get(request_id)

    def update_coverage_request(
        self, request_id: str, updates: Dict[str, Any]
    ) -> Optional[CoverageRequest]:
        """Update a coverage request."""
        request = self._coverage_requests.get(request_id)
        if request:
            for key, value in updates.items():
                if hasattr(request, key):
                    setattr(request, key, value)
        return request

    def list_coverage_requests(
        self,
        requester_id: Optional[str] = None,
        status: Optional[CoverageStatus] = None,
    ) -> List[CoverageRequest]:
        """List coverage requests."""
        results = list(self._coverage_requests.values())

        if requester_id:
            results = [r for r in results if r.requester_id == requester_id]
        if status:
            results = [r for r in results if r.status == status]

        return sorted(results, key=lambda r: r.created_at, reverse=True)

    def get_open_coverage_requests(self) -> List[CoverageRequest]:
        """Get all open coverage requests."""
        return [
            r for r in self._coverage_requests.values()
            if r.status == CoverageStatus.OPEN
        ]

    # Overtime Record CRUD
    def create_overtime_record(self, record: OvertimeRecord) -> OvertimeRecord:
        """Create an overtime record."""
        self._overtime_records[record.id] = record
        return record

    def get_overtime_record(self, record_id: str) -> Optional[OvertimeRecord]:
        """Get an overtime record by ID."""
        return self._overtime_records.get(record_id)

    def update_overtime_record(
        self, record_id: str, updates: Dict[str, Any]
    ) -> Optional[OvertimeRecord]:
        """Update an overtime record."""
        record = self._overtime_records.get(record_id)
        if record:
            for key, value in updates.items():
                if hasattr(record, key):
                    setattr(record, key, value)
        return record

    def list_overtime_records(
        self,
        employee_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        approved: Optional[bool] = None,
    ) -> List[OvertimeRecord]:
        """List overtime records."""
        results = list(self._overtime_records.values())

        if employee_id:
            results = [r for r in results if r.employee_id == employee_id]
        if start_date:
            results = [r for r in results if r.date >= start_date]
        if end_date:
            results = [r for r in results if r.date <= end_date]
        if approved is not None:
            results = [r for r in results if r.approved == approved]

        return sorted(results, key=lambda r: r.date)

    # Notification CRUD
    def create_notification(self, notification: ShiftNotification) -> ShiftNotification:
        """Create a notification."""
        self._notifications[notification.id] = notification
        return notification

    def get_notification(self, notification_id: str) -> Optional[ShiftNotification]:
        """Get a notification by ID."""
        return self._notifications.get(notification_id)

    def update_notification(
        self, notification_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftNotification]:
        """Update a notification."""
        notification = self._notifications.get(notification_id)
        if notification:
            for key, value in updates.items():
                if hasattr(notification, key):
                    setattr(notification, key, value)
        return notification

    def list_notifications(
        self,
        recipient_id: Optional[str] = None,
        notification_type: Optional[NotificationType] = None,
        read: Optional[bool] = None,
    ) -> List[ShiftNotification]:
        """List notifications."""
        results = list(self._notifications.values())

        if recipient_id:
            results = [n for n in results if n.recipient_id == recipient_id]
        if notification_type:
            results = [n for n in results if n.notification_type == notification_type]
        if read is not None:
            results = [n for n in results if n.read == read]

        return sorted(results, key=lambda n: n.created_at, reverse=True)

    # Analytics CRUD
    def create_analytics(self, analytics: ShiftAnalytics) -> ShiftAnalytics:
        """Create an analytics record."""
        self._analytics[analytics.id] = analytics
        return analytics

    def get_analytics(self, analytics_id: str) -> Optional[ShiftAnalytics]:
        """Get an analytics record by ID."""
        return self._analytics.get(analytics_id)

    def list_analytics(
        self,
        department_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ShiftAnalytics]:
        """List analytics records."""
        results = list(self._analytics.values())

        if department_id:
            results = [a for a in results if a.department_id == department_id]
        if start_date:
            results = [a for a in results if a.period_start >= start_date]
        if end_date:
            results = [a for a in results if a.period_end <= end_date]

        return sorted(results, key=lambda a: a.period_start)


# ============================================================
# Manager
# ============================================================

class ShiftManager:
    """High-level API for shift scheduling."""

    def __init__(self, registry: Optional[ShiftRegistry] = None) -> None:
        """Initialize the manager."""
        self.registry = registry or ShiftRegistry()
        self._notification_handler: Optional[Callable] = None

    def set_notification_handler(self, handler: Callable) -> None:
        """Set handler for sending notifications."""
        self._notification_handler = handler

    # Shift Definition Management
    def create_shift_definition(
        self,
        name: str,
        shift_type: ShiftType = ShiftType.CUSTOM,
        start_time: str = "09:00",
        end_time: str = "17:00",
        break_duration_minutes: int = 30,
        department_id: Optional[str] = None,
        **kwargs: Any,
    ) -> ShiftDefinition:
        """Create a new shift definition."""
        # Calculate duration
        start = datetime.strptime(start_time, "%H:%M")
        end = datetime.strptime(end_time, "%H:%M")
        is_overnight = end < start
        if is_overnight:
            end += timedelta(days=1)
        duration_hours = (end - start).total_seconds() / 3600

        definition = ShiftDefinition(
            id=str(uuid.uuid4()),
            name=name,
            shift_type=shift_type,
            start_time=start_time,
            end_time=end_time,
            duration_hours=duration_hours,
            break_duration_minutes=break_duration_minutes,
            department_id=department_id,
            is_overnight=is_overnight,
            **kwargs,
        )
        return self.registry.create_shift_definition(definition)

    def get_shift_definition(self, definition_id: str) -> Optional[ShiftDefinition]:
        """Get a shift definition by ID."""
        return self.registry.get_shift_definition(definition_id)

    def update_shift_definition(
        self, definition_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftDefinition]:
        """Update a shift definition."""
        return self.registry.update_shift_definition(definition_id, updates)

    def list_shift_definitions(
        self,
        shift_type: Optional[ShiftType] = None,
        department_id: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[ShiftDefinition]:
        """List shift definitions."""
        return self.registry.list_shift_definitions(
            shift_type=shift_type,
            department_id=department_id,
            active=active,
        )

    # Schedule Management
    def create_schedule(
        self,
        name: str,
        start_date: date,
        end_date: Optional[date] = None,
        department_id: Optional[str] = None,
        created_by: str = "",
        **kwargs: Any,
    ) -> Schedule:
        """Create a new schedule."""
        schedule = Schedule(
            id=str(uuid.uuid4()),
            name=name,
            start_date=start_date,
            end_date=end_date,
            department_id=department_id,
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_schedule(schedule)

    def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Get a schedule by ID."""
        return self.registry.get_schedule(schedule_id)

    def update_schedule(
        self, schedule_id: str, updates: Dict[str, Any]
    ) -> Optional[Schedule]:
        """Update a schedule."""
        return self.registry.update_schedule(schedule_id, updates)

    def publish_schedule(
        self, schedule_id: str, published_by: str
    ) -> Optional[Schedule]:
        """Publish a schedule."""
        schedule = self.registry.update_schedule(
            schedule_id,
            {
                "status": ScheduleStatus.PUBLISHED,
                "published_at": datetime.utcnow(),
                "published_by": published_by,
            },
        )

        if schedule:
            # Notify all employees with shifts in this schedule
            shifts = self.registry.list_shift_assignments(schedule_id=schedule_id)
            employee_ids = set(s.employee_id for s in shifts)
            for emp_id in employee_ids:
                self._send_notification(
                    NotificationType.SCHEDULE_PUBLISHED,
                    recipient_id=emp_id,
                    schedule_id=schedule_id,
                    message=f"New schedule published: {schedule.name}",
                )

        return schedule

    def list_schedules(
        self,
        department_id: Optional[str] = None,
        status: Optional[ScheduleStatus] = None,
    ) -> List[Schedule]:
        """List schedules."""
        return self.registry.list_schedules(
            department_id=department_id, status=status
        )

    # Shift Assignment Management
    def assign_shift(
        self,
        shift_definition_id: str,
        employee_id: str,
        schedule_id: str,
        shift_date: date,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[ShiftAssignment]:
        """Assign a shift to an employee."""
        definition = self.registry.get_shift_definition(shift_definition_id)
        if not definition:
            return None

        assignment = ShiftAssignment(
            id=str(uuid.uuid4()),
            shift_definition_id=shift_definition_id,
            employee_id=employee_id,
            schedule_id=schedule_id,
            shift_date=shift_date,
            start_time=start_time or definition.start_time,
            end_time=end_time or definition.end_time,
            created_by=created_by,
            **kwargs,
        )
        assignment = self.registry.create_shift_assignment(assignment)

        # Update schedule totals
        schedule = self.registry.get_schedule(schedule_id)
        if schedule:
            self.registry.update_schedule(
                schedule_id,
                {
                    "total_shifts": schedule.total_shifts + 1,
                    "total_hours": schedule.total_hours + assignment.scheduled_hours,
                },
            )

        # Notify employee
        self._send_notification(
            NotificationType.SHIFT_ASSIGNED,
            recipient_id=employee_id,
            shift_id=assignment.id,
            schedule_id=schedule_id,
            message=f"New shift assigned for {shift_date}",
        )

        return assignment

    def get_shift_assignment(self, assignment_id: str) -> Optional[ShiftAssignment]:
        """Get a shift assignment by ID."""
        return self.registry.get_shift_assignment(assignment_id)

    def update_shift_assignment(
        self, assignment_id: str, updates: Dict[str, Any]
    ) -> Optional[ShiftAssignment]:
        """Update a shift assignment."""
        return self.registry.update_shift_assignment(assignment_id, updates)

    def cancel_shift(
        self, assignment_id: str, reason: Optional[str] = None
    ) -> Optional[ShiftAssignment]:
        """Cancel a shift assignment."""
        assignment = self.registry.update_shift_assignment(
            assignment_id,
            {"status": ShiftStatus.CANCELLED, "notes": reason},
        )

        if assignment:
            self._send_notification(
                NotificationType.SHIFT_CANCELLED,
                recipient_id=assignment.employee_id,
                shift_id=assignment_id,
                message=f"Shift cancelled for {assignment.shift_date}",
            )

        return assignment

    def start_shift(self, assignment_id: str) -> Optional[ShiftAssignment]:
        """Record shift start."""
        return self.registry.update_shift_assignment(
            assignment_id,
            {
                "status": ShiftStatus.IN_PROGRESS,
                "actual_start": datetime.utcnow(),
            },
        )

    def end_shift(
        self, assignment_id: str, break_taken_minutes: int = 0
    ) -> Optional[ShiftAssignment]:
        """Record shift end."""
        assignment = self.registry.get_shift_assignment(assignment_id)
        if not assignment:
            return None

        now = datetime.utcnow()
        updates: Dict[str, Any] = {
            "status": ShiftStatus.COMPLETED,
            "actual_end": now,
            "break_taken_minutes": break_taken_minutes,
        }

        # Check for overtime
        if assignment.actual_start:
            actual_hours = (now - assignment.actual_start).total_seconds() / 3600
            actual_hours -= break_taken_minutes / 60
            if actual_hours > assignment.scheduled_hours:
                updates["is_overtime"] = True
                updates["overtime_hours"] = actual_hours - assignment.scheduled_hours
                updates["overtime_type"] = OvertimeType.REGULAR

        return self.registry.update_shift_assignment(assignment_id, updates)

    def list_shifts(
        self,
        employee_id: Optional[str] = None,
        schedule_id: Optional[str] = None,
        status: Optional[ShiftStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ShiftAssignment]:
        """List shift assignments."""
        return self.registry.list_shift_assignments(
            employee_id=employee_id,
            schedule_id=schedule_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )

    def get_employee_shifts(
        self,
        employee_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ShiftAssignment]:
        """Get all shifts for an employee."""
        return self.registry.list_shift_assignments(
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )

    # Availability Management
    def set_availability(
        self,
        employee_id: str,
        day_of_week: DayOfWeek,
        availability_type: AvailabilityType,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        **kwargs: Any,
    ) -> EmployeeAvailability:
        """Set employee availability for a day."""
        # Check for existing availability for this day
        existing = self.registry.get_employee_availability(employee_id, day_of_week)
        if existing:
            # Update existing
            return self.registry.update_availability(
                existing[0].id,
                {
                    "availability_type": availability_type,
                    "start_time": start_time,
                    "end_time": end_time,
                },
            )

        availability = EmployeeAvailability(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            day_of_week=day_of_week,
            availability_type=availability_type,
            start_time=start_time,
            end_time=end_time,
            **kwargs,
        )
        return self.registry.create_availability(availability)

    def get_employee_availability(
        self, employee_id: str, day_of_week: Optional[DayOfWeek] = None
    ) -> List[EmployeeAvailability]:
        """Get employee availability."""
        return self.registry.get_employee_availability(employee_id, day_of_week)

    def check_availability(
        self, employee_id: str, shift_date: date, start_time: str, end_time: str
    ) -> bool:
        """Check if employee is available for a shift."""
        day_of_week = DayOfWeek(shift_date.weekday())
        availability = self.registry.get_employee_availability(employee_id, day_of_week)

        if not availability:
            return True  # No restrictions

        for avail in availability:
            if avail.availability_type == AvailabilityType.UNAVAILABLE:
                return False
            if avail.availability_type == AvailabilityType.LIMITED:
                if avail.start_time and avail.end_time:
                    # Check time overlap
                    if start_time < avail.start_time or end_time > avail.end_time:
                        return False

        return True

    # Time Off Management
    def request_time_off(
        self,
        employee_id: str,
        time_off_type: TimeOffType,
        start_date: date,
        end_date: date,
        reason: Optional[str] = None,
        hours_requested: Optional[float] = None,
        **kwargs: Any,
    ) -> TimeOffRequest:
        """Submit a time-off request."""
        # Calculate hours if not provided
        if hours_requested is None:
            days = (end_date - start_date).days + 1
            hours_requested = days * 8.0  # Assuming 8-hour days

        # Check for affected shifts
        affected_shifts = []
        shifts = self.registry.list_shift_assignments(
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )
        affected_shifts = [s.id for s in shifts]

        request = TimeOffRequest(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            time_off_type=time_off_type,
            start_date=start_date,
            end_date=end_date,
            hours_requested=hours_requested,
            reason=reason,
            affects_shifts=affected_shifts,
            coverage_required=len(affected_shifts) > 0,
            **kwargs,
        )
        request = self.registry.create_time_off_request(request)

        # Update pending hours in balance
        current_year = start_date.year
        balance = self.registry.get_employee_time_off_balance(
            employee_id, time_off_type, current_year
        )
        if balance:
            self.registry.update_time_off_balance(
                balance.id,
                {"pending_hours": balance.pending_hours + hours_requested},
            )

        # Notify manager
        self._send_notification(
            NotificationType.TIME_OFF_REQUESTED,
            recipient_id="manager",  # Would be actual manager ID
            message=f"Time off request from employee {employee_id}",
        )

        return request

    def approve_time_off(
        self, request_id: str, approved_by: str
    ) -> Optional[TimeOffRequest]:
        """Approve a time-off request."""
        request = self.registry.get_time_off_request(request_id)
        if not request or request.status != TimeOffStatus.PENDING:
            return None

        request = self.registry.update_time_off_request(
            request_id,
            {
                "status": TimeOffStatus.APPROVED,
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
            },
        )

        if request:
            # Update balance
            balance = self.registry.get_employee_time_off_balance(
                request.employee_id,
                request.time_off_type,
                request.start_date.year,
            )
            if balance:
                self.registry.update_time_off_balance(
                    balance.id,
                    {
                        "pending_hours": balance.pending_hours - request.hours_requested,
                        "used_hours": balance.used_hours + request.hours_requested,
                    },
                )

            # Cancel affected shifts
            for shift_id in request.affects_shifts:
                self.cancel_shift(shift_id, "Time off approved")

            # Notify employee
            self._send_notification(
                NotificationType.TIME_OFF_APPROVED,
                recipient_id=request.employee_id,
                message=f"Your time off request has been approved",
            )

        return request

    def deny_time_off(
        self, request_id: str, denied_by: str, reason: str
    ) -> Optional[TimeOffRequest]:
        """Deny a time-off request."""
        request = self.registry.get_time_off_request(request_id)
        if not request or request.status != TimeOffStatus.PENDING:
            return None

        request = self.registry.update_time_off_request(
            request_id,
            {
                "status": TimeOffStatus.DENIED,
                "approved_by": denied_by,
                "approved_at": datetime.utcnow(),
                "denied_reason": reason,
            },
        )

        if request:
            # Remove from pending
            balance = self.registry.get_employee_time_off_balance(
                request.employee_id,
                request.time_off_type,
                request.start_date.year,
            )
            if balance:
                self.registry.update_time_off_balance(
                    balance.id,
                    {"pending_hours": balance.pending_hours - request.hours_requested},
                )

            # Notify employee
            self._send_notification(
                NotificationType.TIME_OFF_DENIED,
                recipient_id=request.employee_id,
                message=f"Your time off request has been denied: {reason}",
            )

        return request

    def get_time_off_request(self, request_id: str) -> Optional[TimeOffRequest]:
        """Get a time-off request by ID."""
        return self.registry.get_time_off_request(request_id)

    def list_time_off_requests(
        self,
        employee_id: Optional[str] = None,
        status: Optional[TimeOffStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[TimeOffRequest]:
        """List time-off requests."""
        return self.registry.list_time_off_requests(
            employee_id=employee_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )

    def get_pending_time_off_requests(self) -> List[TimeOffRequest]:
        """Get all pending time-off requests."""
        return self.registry.list_time_off_requests(status=TimeOffStatus.PENDING)

    # Time Off Balance Management
    def create_time_off_balance(
        self,
        employee_id: str,
        time_off_type: TimeOffType,
        year: int,
        total_hours: float,
        accrual_rate: float = 0.0,
        max_carryover: float = 0.0,
        **kwargs: Any,
    ) -> TimeOffBalance:
        """Create a time-off balance for an employee."""
        balance = TimeOffBalance(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            time_off_type=time_off_type,
            year=year,
            total_hours=total_hours,
            accrual_rate=accrual_rate,
            max_carryover=max_carryover,
            **kwargs,
        )
        return self.registry.create_time_off_balance(balance)

    def get_time_off_balance(
        self, employee_id: str, time_off_type: TimeOffType, year: int
    ) -> Optional[TimeOffBalance]:
        """Get time-off balance for an employee."""
        return self.registry.get_employee_time_off_balance(
            employee_id, time_off_type, year
        )

    def get_all_balances(
        self, employee_id: str, year: Optional[int] = None
    ) -> List[TimeOffBalance]:
        """Get all time-off balances for an employee."""
        return self.registry.list_employee_balances(employee_id, year)

    # Shift Swap Management
    def request_swap(
        self,
        requester_id: str,
        requester_shift_id: str,
        target_id: str,
        target_shift_id: str,
        reason: Optional[str] = None,
    ) -> Optional[ShiftSwapRequest]:
        """Request to swap shifts with another employee."""
        requester_shift = self.registry.get_shift_assignment(requester_shift_id)
        target_shift = self.registry.get_shift_assignment(target_shift_id)

        if not requester_shift or not target_shift:
            return None

        request = ShiftSwapRequest(
            id=str(uuid.uuid4()),
            requester_id=requester_id,
            requester_shift_id=requester_shift_id,
            target_id=target_id,
            target_shift_id=target_shift_id,
            reason=reason,
        )
        request = self.registry.create_swap_request(request)

        # Notify target
        self._send_notification(
            NotificationType.SWAP_REQUESTED,
            recipient_id=target_id,
            shift_id=target_shift_id,
            message=f"Shift swap request from {requester_id}",
        )

        return request

    def accept_swap(self, request_id: str) -> Optional[ShiftSwapRequest]:
        """Accept a swap request (by target employee)."""
        request = self.registry.get_swap_request(request_id)
        if not request or request.status != SwapStatus.PENDING:
            return None

        request = self.registry.update_swap_request(
            request_id,
            {
                "target_accepted": True,
                "status": SwapStatus.ACCEPTED,
            },
        )

        if request:
            self._send_notification(
                NotificationType.SWAP_ACCEPTED,
                recipient_id=request.requester_id,
                message="Your swap request was accepted",
            )

        return request

    def decline_swap(self, request_id: str) -> Optional[ShiftSwapRequest]:
        """Decline a swap request."""
        request = self.registry.get_swap_request(request_id)
        if not request or request.status != SwapStatus.PENDING:
            return None

        request = self.registry.update_swap_request(
            request_id,
            {
                "target_accepted": False,
                "status": SwapStatus.DECLINED,
            },
        )

        if request:
            self._send_notification(
                NotificationType.SWAP_DECLINED,
                recipient_id=request.requester_id,
                message="Your swap request was declined",
            )

        return request

    def approve_swap(
        self, request_id: str, approved_by: str
    ) -> Optional[ShiftSwapRequest]:
        """Manager approval of swap request."""
        request = self.registry.get_swap_request(request_id)
        if not request or request.status != SwapStatus.ACCEPTED:
            return None

        # Perform the swap
        requester_shift = self.registry.get_shift_assignment(request.requester_shift_id)
        target_shift = self.registry.get_shift_assignment(request.target_shift_id)

        if requester_shift and target_shift:
            # Swap employee IDs
            self.registry.update_shift_assignment(
                request.requester_shift_id,
                {"employee_id": request.target_id, "status": ShiftStatus.SWAPPED},
            )
            self.registry.update_shift_assignment(
                request.target_shift_id,
                {"employee_id": request.requester_id, "status": ShiftStatus.SWAPPED},
            )

        request = self.registry.update_swap_request(
            request_id,
            {
                "manager_approved": True,
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
                "status": SwapStatus.COMPLETED,
                "completed_at": datetime.utcnow(),
            },
        )

        return request

    def list_swap_requests(
        self,
        employee_id: Optional[str] = None,
        status: Optional[SwapStatus] = None,
    ) -> List[ShiftSwapRequest]:
        """List swap requests."""
        return self.registry.list_swap_requests(employee_id=employee_id, status=status)

    # Coverage Management
    def request_coverage(
        self,
        shift_id: str,
        requester_id: str,
        reason: Optional[str] = None,
        urgent: bool = False,
        incentive: Optional[str] = None,
        **kwargs: Any,
    ) -> Optional[CoverageRequest]:
        """Request coverage for a shift."""
        shift = self.registry.get_shift_assignment(shift_id)
        if not shift:
            return None

        request = CoverageRequest(
            id=str(uuid.uuid4()),
            shift_id=shift_id,
            requester_id=requester_id,
            reason=reason,
            urgent=urgent,
            incentive=incentive,
            **kwargs,
        )
        request = self.registry.create_coverage_request(request)

        # Notify eligible employees
        self._send_notification(
            NotificationType.COVERAGE_NEEDED,
            recipient_id="all_eligible",  # Would broadcast
            shift_id=shift_id,
            message=f"Coverage needed for shift on {shift.shift_date}",
        )

        return request

    def claim_coverage(
        self, request_id: str, claimed_by: str
    ) -> Optional[CoverageRequest]:
        """Claim a coverage request."""
        request = self.registry.get_coverage_request(request_id)
        if not request or request.status != CoverageStatus.OPEN:
            return None

        request = self.registry.update_coverage_request(
            request_id,
            {
                "status": CoverageStatus.CLAIMED,
                "claimed_by": claimed_by,
                "claimed_at": datetime.utcnow(),
            },
        )

        if request:
            self._send_notification(
                NotificationType.COVERAGE_CLAIMED,
                recipient_id=request.requester_id,
                shift_id=request.shift_id,
                message=f"Your shift coverage was claimed by {claimed_by}",
            )

        return request

    def approve_coverage(
        self, request_id: str, approved_by: str
    ) -> Optional[CoverageRequest]:
        """Approve a coverage claim."""
        request = self.registry.get_coverage_request(request_id)
        if not request or request.status != CoverageStatus.CLAIMED:
            return None

        # Update the shift assignment
        if request.claimed_by:
            self.registry.update_shift_assignment(
                request.shift_id,
                {"employee_id": request.claimed_by},
            )

        request = self.registry.update_coverage_request(
            request_id,
            {
                "status": CoverageStatus.APPROVED,
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
            },
        )

        return request

    def get_open_coverage_requests(self) -> List[CoverageRequest]:
        """Get all open coverage requests."""
        return self.registry.get_open_coverage_requests()

    def list_coverage_requests(
        self,
        requester_id: Optional[str] = None,
        status: Optional[CoverageStatus] = None,
    ) -> List[CoverageRequest]:
        """List coverage requests."""
        return self.registry.list_coverage_requests(
            requester_id=requester_id, status=status
        )

    # Overtime Management
    def record_overtime(
        self,
        employee_id: str,
        date: date,
        hours: float,
        overtime_type: OvertimeType = OvertimeType.REGULAR,
        shift_id: Optional[str] = None,
        reason: Optional[str] = None,
        **kwargs: Any,
    ) -> OvertimeRecord:
        """Record overtime worked."""
        rate_multiplier = 1.5
        if overtime_type == OvertimeType.DOUBLE_TIME:
            rate_multiplier = 2.0
        elif overtime_type == OvertimeType.HOLIDAY:
            rate_multiplier = 2.5

        record = OvertimeRecord(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            shift_id=shift_id,
            overtime_type=overtime_type,
            date=date,
            hours=hours,
            rate_multiplier=rate_multiplier,
            reason=reason,
            **kwargs,
        )
        return self.registry.create_overtime_record(record)

    def approve_overtime(
        self, record_id: str, approved_by: str
    ) -> Optional[OvertimeRecord]:
        """Approve an overtime record."""
        return self.registry.update_overtime_record(
            record_id,
            {
                "approved": True,
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
            },
        )

    def get_employee_overtime(
        self,
        employee_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[OvertimeRecord]:
        """Get overtime records for an employee."""
        return self.registry.list_overtime_records(
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )

    def get_total_overtime_hours(
        self,
        employee_id: str,
        start_date: date,
        end_date: date,
    ) -> float:
        """Calculate total overtime hours for an employee in a period."""
        records = self.registry.list_overtime_records(
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            approved=True,
        )
        return sum(r.hours for r in records)

    # Analytics
    def generate_analytics(
        self,
        period_start: date,
        period_end: date,
        department_id: Optional[str] = None,
    ) -> ShiftAnalytics:
        """Generate analytics for a period."""
        shifts = self.registry.list_shift_assignments(
            start_date=period_start,
            end_date=period_end,
        )

        total_shifts = len(shifts)
        total_hours = sum(s.scheduled_hours for s in shifts)
        overtime_hours = sum(s.overtime_hours for s in shifts if s.is_overtime)
        no_shows = sum(1 for s in shifts if s.status == ShiftStatus.MISSED)

        # Coverage stats
        coverage_requests = self.registry.list_coverage_requests()
        covered = sum(
            1 for c in coverage_requests
            if c.status in [CoverageStatus.APPROVED, CoverageStatus.COMPLETED]
        )
        uncovered = sum(
            1 for c in coverage_requests
            if c.status == CoverageStatus.OPEN
        )

        # Swap stats
        swaps = self.registry.list_swap_requests()
        swaps_requested = len(swaps)
        swaps_completed = sum(1 for s in swaps if s.status == SwapStatus.COMPLETED)

        # Time off stats
        time_off = self.registry.list_time_off_requests(
            start_date=period_start,
            end_date=period_end,
        )
        time_off_approved = sum(
            1 for t in time_off if t.status == TimeOffStatus.APPROVED
        )

        # Hours by employee
        hours_by_employee: Dict[str, float] = {}
        for shift in shifts:
            hours_by_employee[shift.employee_id] = (
                hours_by_employee.get(shift.employee_id, 0) + shift.scheduled_hours
            )

        # Shifts by type
        shifts_by_type: Dict[str, int] = {}
        for shift in shifts:
            definition = self.registry.get_shift_definition(shift.shift_definition_id)
            if definition:
                type_key = definition.shift_type.value
                shifts_by_type[type_key] = shifts_by_type.get(type_key, 0) + 1

        # Calculate averages
        unique_employees = len(hours_by_employee)
        avg_hours = total_hours / unique_employees if unique_employees > 0 else 0

        coverage_rate = (
            covered / (covered + uncovered) * 100
            if (covered + uncovered) > 0
            else 100.0
        )

        analytics = ShiftAnalytics(
            id=str(uuid.uuid4()),
            period_start=period_start,
            period_end=period_end,
            department_id=department_id,
            total_shifts=total_shifts,
            total_hours=total_hours,
            overtime_hours=overtime_hours,
            covered_shifts=covered,
            uncovered_shifts=uncovered,
            swaps_requested=swaps_requested,
            swaps_completed=swaps_completed,
            time_off_requests=len(time_off),
            time_off_approved=time_off_approved,
            no_shows=no_shows,
            average_hours_per_employee=avg_hours,
            coverage_rate=coverage_rate,
            shifts_by_type=shifts_by_type,
            hours_by_employee=hours_by_employee,
        )
        return self.registry.create_analytics(analytics)

    # Notification Helper
    def _send_notification(
        self,
        notification_type: NotificationType,
        recipient_id: str,
        shift_id: Optional[str] = None,
        schedule_id: Optional[str] = None,
        message: str = "",
    ) -> Optional[ShiftNotification]:
        """Send a notification."""
        notification = ShiftNotification(
            id=str(uuid.uuid4()),
            notification_type=notification_type,
            recipient_id=recipient_id,
            shift_id=shift_id,
            schedule_id=schedule_id,
            message=message,
        )
        notification = self.registry.create_notification(notification)

        if self._notification_handler:
            try:
                self._notification_handler(notification)
                notification.sent = True
                notification.sent_at = datetime.utcnow()
                self.registry.update_notification(
                    notification.id,
                    {"sent": True, "sent_at": notification.sent_at},
                )
            except Exception:
                pass

        return notification


# ============================================================
# Global Instance
# ============================================================

_shift_manager: Optional[ShiftManager] = None


def get_shift_manager() -> ShiftManager:
    """Get the global shift manager instance."""
    global _shift_manager
    if _shift_manager is None:
        _shift_manager = ShiftManager()
    return _shift_manager


def set_shift_manager(manager: ShiftManager) -> None:
    """Set the global shift manager instance."""
    global _shift_manager
    _shift_manager = manager


def reset_shift_manager() -> None:
    """Reset the global shift manager instance."""
    global _shift_manager
    _shift_manager = None
