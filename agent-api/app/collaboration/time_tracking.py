"""
Time Tracking module for SwissBrain.ai collaboration system.

This module provides enterprise time tracking features including:
- Time entry management with manual and timer-based tracking
- Timesheet submission and approval workflows
- Time tracking policies and rules
- Billable hours and project allocation
- Time reports and analytics
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid


class TimeEntryStatus(str, Enum):
    """Status of a time entry."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    LOCKED = "locked"


class TimeEntryType(str, Enum):
    """Type of time entry."""
    MANUAL = "manual"
    TIMER = "timer"
    IMPORTED = "imported"
    ADJUSTED = "adjusted"


class TimerStatus(str, Enum):
    """Status of a timer."""
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"


class TimesheetStatus(str, Enum):
    """Status of a timesheet."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    LOCKED = "locked"


class TimesheetPeriod(str, Enum):
    """Period type for timesheets."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class BillableType(str, Enum):
    """Billable classification."""
    BILLABLE = "billable"
    NON_BILLABLE = "non_billable"
    INTERNAL = "internal"


@dataclass
class TimeCategory:
    """A category for time entries."""
    id: str
    name: str
    description: str = ""
    color: str = "#3498db"
    is_billable: bool = True
    is_active: bool = True
    parent_id: Optional[str] = None
    workspace_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "is_billable": self.is_billable,
            "is_active": self.is_active,
            "parent_id": self.parent_id,
            "workspace_id": self.workspace_id,
            "hourly_rate": self.hourly_rate,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class TimeEntry:
    """A time entry record."""
    id: str
    user_id: str
    date: date
    duration_minutes: int = 0
    entry_type: TimeEntryType = TimeEntryType.MANUAL
    status: TimeEntryStatus = TimeEntryStatus.DRAFT
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    category_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_billable: bool = True
    billable_type: BillableType = BillableType.BILLABLE
    hourly_rate: Optional[float] = None
    tags: Set[str] = field(default_factory=set)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejection_reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_hours(self) -> float:
        """Get duration in hours."""
        return self.duration_minutes / 60.0

    @property
    def billable_amount(self) -> Optional[float]:
        """Calculate billable amount."""
        if self.is_billable and self.hourly_rate:
            return self.duration_hours * self.hourly_rate
        return None

    def submit(self) -> None:
        """Submit the entry for approval."""
        self.status = TimeEntryStatus.SUBMITTED
        self.submitted_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def approve(self, approver_id: str) -> None:
        """Approve the entry."""
        self.status = TimeEntryStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.approved_by = approver_id
        self.updated_at = datetime.utcnow()

    def reject(self, reason: str = "") -> None:
        """Reject the entry."""
        self.status = TimeEntryStatus.REJECTED
        self.rejection_reason = reason
        self.updated_at = datetime.utcnow()

    def lock(self) -> None:
        """Lock the entry."""
        self.status = TimeEntryStatus.LOCKED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "date": self.date.isoformat(),
            "duration_minutes": self.duration_minutes,
            "duration_hours": self.duration_hours,
            "entry_type": self.entry_type.value,
            "status": self.status.value,
            "description": self.description,
            "workspace_id": self.workspace_id,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "category_id": self.category_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "is_billable": self.is_billable,
            "billable_type": self.billable_type.value,
            "hourly_rate": self.hourly_rate,
            "billable_amount": self.billable_amount,
            "tags": list(self.tags),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by": self.approved_by,
            "metadata": self.metadata,
        }


@dataclass
class Timer:
    """A running timer for time tracking."""
    id: str
    user_id: str
    status: TimerStatus = TimerStatus.STOPPED
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    category_id: Optional[str] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    accumulated_seconds: int = 0
    is_billable: bool = True
    tags: Set[str] = field(default_factory=set)

    def start(self) -> None:
        """Start the timer."""
        if self.status == TimerStatus.STOPPED:
            self.started_at = datetime.utcnow()
            self.accumulated_seconds = 0
        elif self.status == TimerStatus.PAUSED:
            pause_duration = 0
            if self.paused_at:
                pause_duration = int((datetime.utcnow() - self.paused_at).total_seconds())
            self.started_at = datetime.utcnow() - timedelta(seconds=self.accumulated_seconds)
        self.status = TimerStatus.RUNNING
        self.paused_at = None

    def pause(self) -> None:
        """Pause the timer."""
        if self.status == TimerStatus.RUNNING:
            self.accumulated_seconds = self.elapsed_seconds
            self.paused_at = datetime.utcnow()
            self.status = TimerStatus.PAUSED

    def stop(self) -> int:
        """Stop the timer and return elapsed seconds."""
        if self.status == TimerStatus.RUNNING:
            self.accumulated_seconds = self.elapsed_seconds
        self.stopped_at = datetime.utcnow()
        self.status = TimerStatus.STOPPED
        return self.accumulated_seconds

    def reset(self) -> None:
        """Reset the timer."""
        self.status = TimerStatus.STOPPED
        self.started_at = None
        self.paused_at = None
        self.stopped_at = None
        self.accumulated_seconds = 0

    @property
    def elapsed_seconds(self) -> int:
        """Get elapsed seconds."""
        if self.status == TimerStatus.RUNNING and self.started_at:
            return int((datetime.utcnow() - self.started_at).total_seconds())
        return self.accumulated_seconds

    @property
    def elapsed_minutes(self) -> int:
        """Get elapsed minutes."""
        return self.elapsed_seconds // 60

    @property
    def formatted_time(self) -> str:
        """Get formatted elapsed time (HH:MM:SS)."""
        seconds = self.elapsed_seconds
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "status": self.status.value,
            "description": self.description,
            "workspace_id": self.workspace_id,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "category_id": self.category_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "paused_at": self.paused_at.isoformat() if self.paused_at else None,
            "elapsed_seconds": self.elapsed_seconds,
            "elapsed_minutes": self.elapsed_minutes,
            "formatted_time": self.formatted_time,
            "is_billable": self.is_billable,
            "tags": list(self.tags),
        }


@dataclass
class Timesheet:
    """A timesheet for a period."""
    id: str
    user_id: str
    period_type: TimesheetPeriod
    start_date: date
    end_date: date
    status: TimesheetStatus = TimesheetStatus.DRAFT
    workspace_id: Optional[str] = None
    entry_ids: List[str] = field(default_factory=list)
    total_minutes: int = 0
    billable_minutes: int = 0
    non_billable_minutes: int = 0
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejection_reason: str = ""

    @property
    def total_hours(self) -> float:
        """Get total hours."""
        return self.total_minutes / 60.0

    @property
    def billable_hours(self) -> float:
        """Get billable hours."""
        return self.billable_minutes / 60.0

    @property
    def period_label(self) -> str:
        """Get human-readable period label."""
        if self.period_type == TimesheetPeriod.DAILY:
            return self.start_date.strftime("%B %d, %Y")
        elif self.period_type == TimesheetPeriod.WEEKLY:
            return f"Week of {self.start_date.strftime('%B %d, %Y')}"
        elif self.period_type == TimesheetPeriod.BIWEEKLY:
            return f"{self.start_date.strftime('%b %d')} - {self.end_date.strftime('%b %d, %Y')}"
        else:
            return self.start_date.strftime("%B %Y")

    def submit(self) -> None:
        """Submit the timesheet."""
        self.status = TimesheetStatus.SUBMITTED
        self.submitted_at = datetime.utcnow()

    def approve(self, approver_id: str) -> None:
        """Approve the timesheet."""
        self.status = TimesheetStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.approved_by = approver_id

    def reject(self, reason: str = "") -> None:
        """Reject the timesheet."""
        self.status = TimesheetStatus.REJECTED
        self.rejection_reason = reason

    def lock(self) -> None:
        """Lock the timesheet."""
        self.status = TimesheetStatus.LOCKED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "period_type": self.period_type.value,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "status": self.status.value,
            "workspace_id": self.workspace_id,
            "entry_ids": self.entry_ids,
            "total_minutes": self.total_minutes,
            "total_hours": self.total_hours,
            "billable_minutes": self.billable_minutes,
            "billable_hours": self.billable_hours,
            "non_billable_minutes": self.non_billable_minutes,
            "period_label": self.period_label,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by": self.approved_by,
        }


@dataclass
class TrackingPolicy:
    """Time tracking policy for a workspace."""
    id: str
    workspace_id: str
    name: str
    description: str = ""
    is_active: bool = True
    require_description: bool = False
    require_project: bool = False
    require_task: bool = False
    require_category: bool = False
    max_daily_hours: float = 24.0
    max_weekly_hours: float = 168.0
    min_entry_minutes: int = 1
    max_entry_hours: float = 24.0
    allow_future_entries: bool = False
    allow_past_entries: bool = True
    past_entry_limit_days: int = 30
    require_approval: bool = True
    auto_approve_under_hours: Optional[float] = None
    overtime_threshold_daily: Optional[float] = None
    overtime_threshold_weekly: Optional[float] = None
    rounding_minutes: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def validate_entry(self, entry: TimeEntry, daily_total: int = 0, weekly_total: int = 0) -> List[str]:
        """Validate an entry against the policy."""
        errors = []

        if self.require_description and not entry.description:
            errors.append("Description is required")

        if self.require_project and not entry.project_id:
            errors.append("Project is required")

        if self.require_task and not entry.task_id:
            errors.append("Task is required")

        if self.require_category and not entry.category_id:
            errors.append("Category is required")

        if entry.duration_minutes < self.min_entry_minutes:
            errors.append(f"Minimum entry duration is {self.min_entry_minutes} minutes")

        if entry.duration_hours > self.max_entry_hours:
            errors.append(f"Maximum entry duration is {self.max_entry_hours} hours")

        new_daily = (daily_total + entry.duration_minutes) / 60.0
        if new_daily > self.max_daily_hours:
            errors.append(f"Exceeds maximum daily hours ({self.max_daily_hours})")

        new_weekly = (weekly_total + entry.duration_minutes) / 60.0
        if new_weekly > self.max_weekly_hours:
            errors.append(f"Exceeds maximum weekly hours ({self.max_weekly_hours})")

        today = date.today()
        if not self.allow_future_entries and entry.date > today:
            errors.append("Future entries are not allowed")

        if self.allow_past_entries:
            limit = today - timedelta(days=self.past_entry_limit_days)
            if entry.date < limit:
                errors.append(f"Entry date exceeds {self.past_entry_limit_days} day limit")

        return errors

    def round_duration(self, minutes: int) -> int:
        """Round duration according to policy."""
        if self.rounding_minutes <= 0:
            return minutes
        return ((minutes + self.rounding_minutes - 1) // self.rounding_minutes) * self.rounding_minutes

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "require_description": self.require_description,
            "require_project": self.require_project,
            "require_task": self.require_task,
            "require_category": self.require_category,
            "max_daily_hours": self.max_daily_hours,
            "max_weekly_hours": self.max_weekly_hours,
            "min_entry_minutes": self.min_entry_minutes,
            "max_entry_hours": self.max_entry_hours,
            "allow_future_entries": self.allow_future_entries,
            "allow_past_entries": self.allow_past_entries,
            "past_entry_limit_days": self.past_entry_limit_days,
            "require_approval": self.require_approval,
            "overtime_threshold_daily": self.overtime_threshold_daily,
            "overtime_threshold_weekly": self.overtime_threshold_weekly,
            "rounding_minutes": self.rounding_minutes,
        }


@dataclass
class TimeReport:
    """A time tracking report."""
    id: str
    name: str
    start_date: date
    end_date: date
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: str = ""
    workspace_id: Optional[str] = None
    user_ids: List[str] = field(default_factory=list)
    project_ids: List[str] = field(default_factory=list)
    total_entries: int = 0
    total_minutes: int = 0
    billable_minutes: int = 0
    non_billable_minutes: int = 0
    total_amount: float = 0.0
    by_user: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    by_project: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    by_category: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    by_date: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    @property
    def total_hours(self) -> float:
        """Get total hours."""
        return self.total_minutes / 60.0

    @property
    def billable_hours(self) -> float:
        """Get billable hours."""
        return self.billable_minutes / 60.0

    @property
    def billable_percentage(self) -> float:
        """Get billable percentage."""
        if self.total_minutes > 0:
            return (self.billable_minutes / self.total_minutes) * 100
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "generated_at": self.generated_at.isoformat(),
            "generated_by": self.generated_by,
            "workspace_id": self.workspace_id,
            "total_entries": self.total_entries,
            "total_minutes": self.total_minutes,
            "total_hours": self.total_hours,
            "billable_minutes": self.billable_minutes,
            "billable_hours": self.billable_hours,
            "non_billable_minutes": self.non_billable_minutes,
            "billable_percentage": self.billable_percentage,
            "total_amount": self.total_amount,
            "by_user": self.by_user,
            "by_project": self.by_project,
            "by_category": self.by_category,
            "by_date": self.by_date,
        }


class TimeTrackingRegistry:
    """Registry for time tracking entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._entries: Dict[str, TimeEntry] = {}
        self._timers: Dict[str, Timer] = {}
        self._timesheets: Dict[str, Timesheet] = {}
        self._categories: Dict[str, TimeCategory] = {}
        self._policies: Dict[str, TrackingPolicy] = {}
        self._reports: Dict[str, TimeReport] = {}

    # Time Entry methods
    def create_entry(
        self,
        user_id: str,
        entry_date: date,
        duration_minutes: int,
        entry_type: TimeEntryType = TimeEntryType.MANUAL,
        description: str = "",
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        category_id: Optional[str] = None,
        is_billable: bool = True,
        hourly_rate: Optional[float] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        tags: Optional[Set[str]] = None,
    ) -> TimeEntry:
        """Create a time entry."""
        entry_id = str(uuid.uuid4())
        entry = TimeEntry(
            id=entry_id,
            user_id=user_id,
            date=entry_date,
            duration_minutes=duration_minutes,
            entry_type=entry_type,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=task_id,
            category_id=category_id,
            is_billable=is_billable,
            hourly_rate=hourly_rate,
            start_time=start_time,
            end_time=end_time,
            tags=tags or set(),
        )

        if not is_billable:
            entry.billable_type = BillableType.NON_BILLABLE

        self._entries[entry_id] = entry
        return entry

    def get_entry(self, entry_id: str) -> Optional[TimeEntry]:
        """Get an entry by ID."""
        return self._entries.get(entry_id)

    def update_entry(
        self,
        entry_id: str,
        duration_minutes: Optional[int] = None,
        description: Optional[str] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        category_id: Optional[str] = None,
        is_billable: Optional[bool] = None,
        tags: Optional[Set[str]] = None,
    ) -> Optional[TimeEntry]:
        """Update an entry."""
        entry = self._entries.get(entry_id)
        if not entry:
            return None

        if entry.status in (TimeEntryStatus.APPROVED, TimeEntryStatus.LOCKED):
            return None

        if duration_minutes is not None:
            entry.duration_minutes = duration_minutes
        if description is not None:
            entry.description = description
        if project_id is not None:
            entry.project_id = project_id
        if task_id is not None:
            entry.task_id = task_id
        if category_id is not None:
            entry.category_id = category_id
        if is_billable is not None:
            entry.is_billable = is_billable
            entry.billable_type = BillableType.BILLABLE if is_billable else BillableType.NON_BILLABLE
        if tags is not None:
            entry.tags = tags

        entry.updated_at = datetime.utcnow()
        return entry

    def delete_entry(self, entry_id: str) -> bool:
        """Delete an entry."""
        entry = self._entries.get(entry_id)
        if not entry:
            return False

        if entry.status in (TimeEntryStatus.APPROVED, TimeEntryStatus.LOCKED):
            return False

        del self._entries[entry_id]
        return True

    def submit_entry(self, entry_id: str) -> Optional[TimeEntry]:
        """Submit an entry for approval."""
        entry = self._entries.get(entry_id)
        if entry and entry.status == TimeEntryStatus.DRAFT:
            entry.submit()
        return entry

    def approve_entry(self, entry_id: str, approver_id: str) -> Optional[TimeEntry]:
        """Approve an entry."""
        entry = self._entries.get(entry_id)
        if entry and entry.status == TimeEntryStatus.SUBMITTED:
            entry.approve(approver_id)
        return entry

    def reject_entry(self, entry_id: str, reason: str = "") -> Optional[TimeEntry]:
        """Reject an entry."""
        entry = self._entries.get(entry_id)
        if entry and entry.status == TimeEntryStatus.SUBMITTED:
            entry.reject(reason)
        return entry

    def list_entries(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[TimeEntryStatus] = None,
        is_billable: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TimeEntry]:
        """List entries with filters."""
        entries = list(self._entries.values())

        if user_id:
            entries = [e for e in entries if e.user_id == user_id]
        if workspace_id:
            entries = [e for e in entries if e.workspace_id == workspace_id]
        if project_id:
            entries = [e for e in entries if e.project_id == project_id]
        if task_id:
            entries = [e for e in entries if e.task_id == task_id]
        if start_date:
            entries = [e for e in entries if e.date >= start_date]
        if end_date:
            entries = [e for e in entries if e.date <= end_date]
        if status:
            entries = [e for e in entries if e.status == status]
        if is_billable is not None:
            entries = [e for e in entries if e.is_billable == is_billable]

        entries.sort(key=lambda e: (e.date, e.created_at), reverse=True)
        return entries[offset:offset + limit]

    def get_daily_total(self, user_id: str, entry_date: date, workspace_id: Optional[str] = None) -> int:
        """Get total minutes for a user on a date."""
        entries = self.list_entries(
            user_id=user_id,
            workspace_id=workspace_id,
            start_date=entry_date,
            end_date=entry_date,
        )
        return sum(e.duration_minutes for e in entries)

    def get_weekly_total(self, user_id: str, week_start: date, workspace_id: Optional[str] = None) -> int:
        """Get total minutes for a user in a week."""
        week_end = week_start + timedelta(days=6)
        entries = self.list_entries(
            user_id=user_id,
            workspace_id=workspace_id,
            start_date=week_start,
            end_date=week_end,
        )
        return sum(e.duration_minutes for e in entries)

    # Timer methods
    def create_timer(
        self,
        user_id: str,
        description: str = "",
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        category_id: Optional[str] = None,
        is_billable: bool = True,
    ) -> Timer:
        """Create a timer."""
        timer_id = str(uuid.uuid4())
        timer = Timer(
            id=timer_id,
            user_id=user_id,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=task_id,
            category_id=category_id,
            is_billable=is_billable,
        )

        self._timers[timer_id] = timer
        return timer

    def get_timer(self, timer_id: str) -> Optional[Timer]:
        """Get a timer by ID."""
        return self._timers.get(timer_id)

    def get_active_timer(self, user_id: str) -> Optional[Timer]:
        """Get the active timer for a user."""
        for timer in self._timers.values():
            if timer.user_id == user_id and timer.status == TimerStatus.RUNNING:
                return timer
        return None

    def start_timer(self, timer_id: str) -> Optional[Timer]:
        """Start a timer."""
        timer = self._timers.get(timer_id)
        if timer:
            timer.start()
        return timer

    def pause_timer(self, timer_id: str) -> Optional[Timer]:
        """Pause a timer."""
        timer = self._timers.get(timer_id)
        if timer:
            timer.pause()
        return timer

    def stop_timer(self, timer_id: str, create_entry: bool = True) -> Tuple[Optional[Timer], Optional[TimeEntry]]:
        """Stop a timer and optionally create an entry."""
        timer = self._timers.get(timer_id)
        if not timer:
            return None, None

        elapsed = timer.stop()
        entry = None

        if create_entry and elapsed >= 60:
            duration_minutes = elapsed // 60
            entry = self.create_entry(
                user_id=timer.user_id,
                entry_date=date.today(),
                duration_minutes=duration_minutes,
                entry_type=TimeEntryType.TIMER,
                description=timer.description,
                workspace_id=timer.workspace_id,
                project_id=timer.project_id,
                task_id=timer.task_id,
                category_id=timer.category_id,
                is_billable=timer.is_billable,
                start_time=timer.started_at,
                end_time=timer.stopped_at,
                tags=timer.tags,
            )

        return timer, entry

    def delete_timer(self, timer_id: str) -> bool:
        """Delete a timer."""
        if timer_id in self._timers:
            del self._timers[timer_id]
            return True
        return False

    def list_timers(self, user_id: Optional[str] = None) -> List[Timer]:
        """List timers."""
        timers = list(self._timers.values())
        if user_id:
            timers = [t for t in timers if t.user_id == user_id]
        return timers

    # Timesheet methods
    def create_timesheet(
        self,
        user_id: str,
        period_type: TimesheetPeriod,
        start_date: date,
        workspace_id: Optional[str] = None,
    ) -> Timesheet:
        """Create a timesheet."""
        timesheet_id = str(uuid.uuid4())

        if period_type == TimesheetPeriod.DAILY:
            end_date = start_date
        elif period_type == TimesheetPeriod.WEEKLY:
            end_date = start_date + timedelta(days=6)
        elif period_type == TimesheetPeriod.BIWEEKLY:
            end_date = start_date + timedelta(days=13)
        else:
            next_month = start_date.replace(day=28) + timedelta(days=4)
            end_date = next_month - timedelta(days=next_month.day)

        timesheet = Timesheet(
            id=timesheet_id,
            user_id=user_id,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date,
            workspace_id=workspace_id,
        )

        entries = self.list_entries(
            user_id=user_id,
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date,
        )

        for entry in entries:
            timesheet.entry_ids.append(entry.id)
            timesheet.total_minutes += entry.duration_minutes
            if entry.is_billable:
                timesheet.billable_minutes += entry.duration_minutes
            else:
                timesheet.non_billable_minutes += entry.duration_minutes

        self._timesheets[timesheet_id] = timesheet
        return timesheet

    def get_timesheet(self, timesheet_id: str) -> Optional[Timesheet]:
        """Get a timesheet by ID."""
        return self._timesheets.get(timesheet_id)

    def submit_timesheet(self, timesheet_id: str) -> Optional[Timesheet]:
        """Submit a timesheet."""
        timesheet = self._timesheets.get(timesheet_id)
        if timesheet and timesheet.status == TimesheetStatus.DRAFT:
            timesheet.submit()
            for entry_id in timesheet.entry_ids:
                self.submit_entry(entry_id)
        return timesheet

    def approve_timesheet(self, timesheet_id: str, approver_id: str) -> Optional[Timesheet]:
        """Approve a timesheet."""
        timesheet = self._timesheets.get(timesheet_id)
        if timesheet and timesheet.status == TimesheetStatus.SUBMITTED:
            timesheet.approve(approver_id)
            for entry_id in timesheet.entry_ids:
                self.approve_entry(entry_id, approver_id)
        return timesheet

    def reject_timesheet(self, timesheet_id: str, reason: str = "") -> Optional[Timesheet]:
        """Reject a timesheet."""
        timesheet = self._timesheets.get(timesheet_id)
        if timesheet and timesheet.status == TimesheetStatus.SUBMITTED:
            timesheet.reject(reason)
            for entry_id in timesheet.entry_ids:
                self.reject_entry(entry_id, reason)
        return timesheet

    def list_timesheets(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        status: Optional[TimesheetStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Timesheet]:
        """List timesheets."""
        timesheets = list(self._timesheets.values())

        if user_id:
            timesheets = [t for t in timesheets if t.user_id == user_id]
        if workspace_id:
            timesheets = [t for t in timesheets if t.workspace_id == workspace_id]
        if status:
            timesheets = [t for t in timesheets if t.status == status]

        timesheets.sort(key=lambda t: t.start_date, reverse=True)
        return timesheets[offset:offset + limit]

    def refresh_timesheet(self, timesheet_id: str) -> Optional[Timesheet]:
        """Refresh timesheet totals from entries."""
        timesheet = self._timesheets.get(timesheet_id)
        if not timesheet:
            return None

        timesheet.total_minutes = 0
        timesheet.billable_minutes = 0
        timesheet.non_billable_minutes = 0

        for entry_id in timesheet.entry_ids:
            entry = self._entries.get(entry_id)
            if entry:
                timesheet.total_minutes += entry.duration_minutes
                if entry.is_billable:
                    timesheet.billable_minutes += entry.duration_minutes
                else:
                    timesheet.non_billable_minutes += entry.duration_minutes

        return timesheet

    # Category methods
    def create_category(
        self,
        name: str,
        description: str = "",
        color: str = "#3498db",
        is_billable: bool = True,
        workspace_id: Optional[str] = None,
        hourly_rate: Optional[float] = None,
    ) -> TimeCategory:
        """Create a category."""
        category_id = str(uuid.uuid4())
        category = TimeCategory(
            id=category_id,
            name=name,
            description=description,
            color=color,
            is_billable=is_billable,
            workspace_id=workspace_id,
            hourly_rate=hourly_rate,
        )

        self._categories[category_id] = category
        return category

    def get_category(self, category_id: str) -> Optional[TimeCategory]:
        """Get a category by ID."""
        return self._categories.get(category_id)

    def list_categories(
        self,
        workspace_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[TimeCategory]:
        """List categories."""
        categories = list(self._categories.values())

        if workspace_id:
            categories = [c for c in categories if c.workspace_id == workspace_id]
        if is_active is not None:
            categories = [c for c in categories if c.is_active == is_active]

        return categories

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        if category_id in self._categories:
            del self._categories[category_id]
            return True
        return False

    # Policy methods
    def create_policy(
        self,
        workspace_id: str,
        name: str,
        description: str = "",
        require_description: bool = False,
        require_project: bool = False,
        require_approval: bool = True,
        max_daily_hours: float = 24.0,
        max_weekly_hours: float = 168.0,
    ) -> TrackingPolicy:
        """Create a tracking policy."""
        policy_id = str(uuid.uuid4())
        policy = TrackingPolicy(
            id=policy_id,
            workspace_id=workspace_id,
            name=name,
            description=description,
            require_description=require_description,
            require_project=require_project,
            require_approval=require_approval,
            max_daily_hours=max_daily_hours,
            max_weekly_hours=max_weekly_hours,
        )

        self._policies[policy_id] = policy
        return policy

    def get_policy(self, policy_id: str) -> Optional[TrackingPolicy]:
        """Get a policy by ID."""
        return self._policies.get(policy_id)

    def get_workspace_policy(self, workspace_id: str) -> Optional[TrackingPolicy]:
        """Get the active policy for a workspace."""
        for policy in self._policies.values():
            if policy.workspace_id == workspace_id and policy.is_active:
                return policy
        return None

    def list_policies(self, workspace_id: Optional[str] = None) -> List[TrackingPolicy]:
        """List policies."""
        policies = list(self._policies.values())
        if workspace_id:
            policies = [p for p in policies if p.workspace_id == workspace_id]
        return policies

    def delete_policy(self, policy_id: str) -> bool:
        """Delete a policy."""
        if policy_id in self._policies:
            del self._policies[policy_id]
            return True
        return False

    # Report methods
    def generate_report(
        self,
        name: str,
        start_date: date,
        end_date: date,
        generated_by: str,
        workspace_id: Optional[str] = None,
        user_ids: Optional[List[str]] = None,
        project_ids: Optional[List[str]] = None,
    ) -> TimeReport:
        """Generate a time report."""
        report_id = str(uuid.uuid4())
        report = TimeReport(
            id=report_id,
            name=name,
            start_date=start_date,
            end_date=end_date,
            generated_by=generated_by,
            workspace_id=workspace_id,
            user_ids=user_ids or [],
            project_ids=project_ids or [],
        )

        entries = self.list_entries(
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date,
        )

        if user_ids:
            entries = [e for e in entries if e.user_id in user_ids]
        if project_ids:
            entries = [e for e in entries if e.project_id in project_ids]

        report.total_entries = len(entries)

        for entry in entries:
            report.total_minutes += entry.duration_minutes
            if entry.is_billable:
                report.billable_minutes += entry.duration_minutes
                if entry.billable_amount:
                    report.total_amount += entry.billable_amount
            else:
                report.non_billable_minutes += entry.duration_minutes

            if entry.user_id not in report.by_user:
                report.by_user[entry.user_id] = {"minutes": 0, "billable": 0, "entries": 0}
            report.by_user[entry.user_id]["minutes"] += entry.duration_minutes
            report.by_user[entry.user_id]["entries"] += 1
            if entry.is_billable:
                report.by_user[entry.user_id]["billable"] += entry.duration_minutes

            if entry.project_id:
                if entry.project_id not in report.by_project:
                    report.by_project[entry.project_id] = {"minutes": 0, "billable": 0, "entries": 0}
                report.by_project[entry.project_id]["minutes"] += entry.duration_minutes
                report.by_project[entry.project_id]["entries"] += 1
                if entry.is_billable:
                    report.by_project[entry.project_id]["billable"] += entry.duration_minutes

            if entry.category_id:
                if entry.category_id not in report.by_category:
                    report.by_category[entry.category_id] = {"minutes": 0, "billable": 0, "entries": 0}
                report.by_category[entry.category_id]["minutes"] += entry.duration_minutes
                report.by_category[entry.category_id]["entries"] += 1
                if entry.is_billable:
                    report.by_category[entry.category_id]["billable"] += entry.duration_minutes

            date_key = entry.date.isoformat()
            if date_key not in report.by_date:
                report.by_date[date_key] = {"minutes": 0, "billable": 0, "entries": 0}
            report.by_date[date_key]["minutes"] += entry.duration_minutes
            report.by_date[date_key]["entries"] += 1
            if entry.is_billable:
                report.by_date[date_key]["billable"] += entry.duration_minutes

        self._reports[report_id] = report
        return report

    def get_report(self, report_id: str) -> Optional[TimeReport]:
        """Get a report by ID."""
        return self._reports.get(report_id)

    def list_reports(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[TimeReport]:
        """List reports."""
        reports = list(self._reports.values())
        if workspace_id:
            reports = [r for r in reports if r.workspace_id == workspace_id]
        reports.sort(key=lambda r: r.generated_at, reverse=True)
        return reports[:limit]

    # Statistics
    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get time tracking statistics."""
        entries = self.list_entries(workspace_id=workspace_id, user_id=user_id)

        total_minutes = sum(e.duration_minutes for e in entries)
        billable_minutes = sum(e.duration_minutes for e in entries if e.is_billable)

        status_counts = {status.value: 0 for status in TimeEntryStatus}
        for entry in entries:
            status_counts[entry.status.value] += 1

        active_timers = len([t for t in self._timers.values() if t.status == TimerStatus.RUNNING])

        return {
            "total_entries": len(entries),
            "total_minutes": total_minutes,
            "total_hours": total_minutes / 60.0,
            "billable_minutes": billable_minutes,
            "billable_hours": billable_minutes / 60.0,
            "non_billable_minutes": total_minutes - billable_minutes,
            "billable_percentage": (billable_minutes / total_minutes * 100) if total_minutes > 0 else 0,
            "entries_by_status": status_counts,
            "active_timers": active_timers,
        }


class TimeTrackingManager:
    """High-level API for time tracking operations."""

    def __init__(self, registry: Optional[TimeTrackingRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or TimeTrackingRegistry()

    @property
    def registry(self) -> TimeTrackingRegistry:
        """Get the registry."""
        return self._registry

    # Entry methods
    def log_time(
        self,
        user_id: str,
        duration_minutes: int,
        description: str = "",
        entry_date: Optional[date] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        is_billable: bool = True,
        workspace_id: Optional[str] = None,
    ) -> TimeEntry:
        """Log time manually."""
        if entry_date is None:
            entry_date = date.today()

        return self._registry.create_entry(
            user_id=user_id,
            entry_date=entry_date,
            duration_minutes=duration_minutes,
            entry_type=TimeEntryType.MANUAL,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=task_id,
            is_billable=is_billable,
        )

    def log_hours(
        self,
        user_id: str,
        hours: float,
        description: str = "",
        entry_date: Optional[date] = None,
        project_id: Optional[str] = None,
        is_billable: bool = True,
        workspace_id: Optional[str] = None,
    ) -> TimeEntry:
        """Log time in hours."""
        duration_minutes = int(hours * 60)
        return self.log_time(
            user_id=user_id,
            duration_minutes=duration_minutes,
            description=description,
            entry_date=entry_date,
            project_id=project_id,
            is_billable=is_billable,
            workspace_id=workspace_id,
        )

    def get_entry(self, entry_id: str) -> Optional[TimeEntry]:
        """Get an entry."""
        return self._registry.get_entry(entry_id)

    def update_entry(
        self,
        entry_id: str,
        duration_minutes: Optional[int] = None,
        description: Optional[str] = None,
    ) -> Optional[TimeEntry]:
        """Update an entry."""
        return self._registry.update_entry(entry_id, duration_minutes, description)

    def delete_entry(self, entry_id: str) -> bool:
        """Delete an entry."""
        return self._registry.delete_entry(entry_id)

    def submit_entry(self, entry_id: str) -> Optional[TimeEntry]:
        """Submit an entry."""
        return self._registry.submit_entry(entry_id)

    def approve_entry(self, entry_id: str, approver_id: str) -> Optional[TimeEntry]:
        """Approve an entry."""
        return self._registry.approve_entry(entry_id, approver_id)

    def reject_entry(self, entry_id: str, reason: str = "") -> Optional[TimeEntry]:
        """Reject an entry."""
        return self._registry.reject_entry(entry_id, reason)

    def list_entries(
        self,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[TimeEntry]:
        """List entries."""
        return self._registry.list_entries(
            user_id=user_id,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
        )

    def get_entries_for_date(self, user_id: str, entry_date: date) -> List[TimeEntry]:
        """Get entries for a specific date."""
        return self._registry.list_entries(
            user_id=user_id,
            start_date=entry_date,
            end_date=entry_date,
        )

    def get_entries_for_week(self, user_id: str, week_start: date) -> List[TimeEntry]:
        """Get entries for a week."""
        week_end = week_start + timedelta(days=6)
        return self._registry.list_entries(
            user_id=user_id,
            start_date=week_start,
            end_date=week_end,
        )

    # Timer methods
    def start_timer(
        self,
        user_id: str,
        description: str = "",
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Timer:
        """Start a new timer."""
        active = self._registry.get_active_timer(user_id)
        if active:
            self._registry.stop_timer(active.id, create_entry=True)

        timer = self._registry.create_timer(
            user_id=user_id,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=task_id,
        )
        timer.start()
        return timer

    def get_timer(self, timer_id: str) -> Optional[Timer]:
        """Get a timer."""
        return self._registry.get_timer(timer_id)

    def get_active_timer(self, user_id: str) -> Optional[Timer]:
        """Get active timer for user."""
        return self._registry.get_active_timer(user_id)

    def pause_timer(self, timer_id: str) -> Optional[Timer]:
        """Pause a timer."""
        return self._registry.pause_timer(timer_id)

    def resume_timer(self, timer_id: str) -> Optional[Timer]:
        """Resume a paused timer."""
        return self._registry.start_timer(timer_id)

    def stop_timer(self, timer_id: str, create_entry: bool = True) -> Tuple[Optional[Timer], Optional[TimeEntry]]:
        """Stop a timer."""
        return self._registry.stop_timer(timer_id, create_entry)

    def discard_timer(self, timer_id: str) -> bool:
        """Discard a timer without creating an entry."""
        self._registry.stop_timer(timer_id, create_entry=False)
        return self._registry.delete_timer(timer_id)

    # Timesheet methods
    def create_weekly_timesheet(
        self,
        user_id: str,
        week_start: date,
        workspace_id: Optional[str] = None,
    ) -> Timesheet:
        """Create a weekly timesheet."""
        return self._registry.create_timesheet(
            user_id=user_id,
            period_type=TimesheetPeriod.WEEKLY,
            start_date=week_start,
            workspace_id=workspace_id,
        )

    def create_monthly_timesheet(
        self,
        user_id: str,
        month_start: date,
        workspace_id: Optional[str] = None,
    ) -> Timesheet:
        """Create a monthly timesheet."""
        return self._registry.create_timesheet(
            user_id=user_id,
            period_type=TimesheetPeriod.MONTHLY,
            start_date=month_start,
            workspace_id=workspace_id,
        )

    def get_timesheet(self, timesheet_id: str) -> Optional[Timesheet]:
        """Get a timesheet."""
        return self._registry.get_timesheet(timesheet_id)

    def submit_timesheet(self, timesheet_id: str) -> Optional[Timesheet]:
        """Submit a timesheet."""
        return self._registry.submit_timesheet(timesheet_id)

    def approve_timesheet(self, timesheet_id: str, approver_id: str) -> Optional[Timesheet]:
        """Approve a timesheet."""
        return self._registry.approve_timesheet(timesheet_id, approver_id)

    def reject_timesheet(self, timesheet_id: str, reason: str = "") -> Optional[Timesheet]:
        """Reject a timesheet."""
        return self._registry.reject_timesheet(timesheet_id, reason)

    def list_timesheets(
        self,
        user_id: Optional[str] = None,
        status: Optional[TimesheetStatus] = None,
    ) -> List[Timesheet]:
        """List timesheets."""
        return self._registry.list_timesheets(user_id=user_id, status=status)

    def get_pending_timesheets(self, workspace_id: Optional[str] = None) -> List[Timesheet]:
        """Get pending timesheets awaiting approval."""
        return self._registry.list_timesheets(
            workspace_id=workspace_id,
            status=TimesheetStatus.SUBMITTED,
        )

    # Category methods
    def create_category(
        self,
        name: str,
        is_billable: bool = True,
        color: str = "#3498db",
        workspace_id: Optional[str] = None,
    ) -> TimeCategory:
        """Create a category."""
        return self._registry.create_category(
            name=name,
            is_billable=is_billable,
            color=color,
            workspace_id=workspace_id,
        )

    def list_categories(self, workspace_id: Optional[str] = None) -> List[TimeCategory]:
        """List categories."""
        return self._registry.list_categories(workspace_id=workspace_id, is_active=True)

    # Policy methods
    def create_policy(
        self,
        workspace_id: str,
        name: str,
        require_description: bool = False,
        require_project: bool = False,
        max_daily_hours: float = 24.0,
    ) -> TrackingPolicy:
        """Create a tracking policy."""
        return self._registry.create_policy(
            workspace_id=workspace_id,
            name=name,
            require_description=require_description,
            require_project=require_project,
            max_daily_hours=max_daily_hours,
        )

    def get_workspace_policy(self, workspace_id: str) -> Optional[TrackingPolicy]:
        """Get workspace policy."""
        return self._registry.get_workspace_policy(workspace_id)

    def validate_entry(
        self,
        entry: TimeEntry,
        workspace_id: Optional[str] = None,
    ) -> List[str]:
        """Validate an entry against policy."""
        policy = self._registry.get_workspace_policy(workspace_id or entry.workspace_id or "")
        if not policy:
            return []

        daily_total = self._registry.get_daily_total(entry.user_id, entry.date, workspace_id)
        weekly_total = self._registry.get_weekly_total(
            entry.user_id,
            entry.date - timedelta(days=entry.date.weekday()),
            workspace_id,
        )

        return policy.validate_entry(entry, daily_total, weekly_total)

    # Report methods
    def generate_report(
        self,
        name: str,
        start_date: date,
        end_date: date,
        generated_by: str,
        workspace_id: Optional[str] = None,
        user_ids: Optional[List[str]] = None,
    ) -> TimeReport:
        """Generate a report."""
        return self._registry.generate_report(
            name=name,
            start_date=start_date,
            end_date=end_date,
            generated_by=generated_by,
            workspace_id=workspace_id,
            user_ids=user_ids,
        )

    def generate_weekly_report(
        self,
        user_id: str,
        week_start: date,
        generated_by: str,
    ) -> TimeReport:
        """Generate a weekly report for a user."""
        week_end = week_start + timedelta(days=6)
        return self._registry.generate_report(
            name=f"Weekly Report - {week_start.strftime('%B %d, %Y')}",
            start_date=week_start,
            end_date=week_end,
            generated_by=generated_by,
            user_ids=[user_id],
        )

    def get_report(self, report_id: str) -> Optional[TimeReport]:
        """Get a report."""
        return self._registry.get_report(report_id)

    def list_reports(self, workspace_id: Optional[str] = None) -> List[TimeReport]:
        """List reports."""
        return self._registry.list_reports(workspace_id=workspace_id)

    # Summary methods
    def get_daily_summary(self, user_id: str, entry_date: date) -> Dict[str, Any]:
        """Get daily summary for a user."""
        entries = self.get_entries_for_date(user_id, entry_date)
        total_minutes = sum(e.duration_minutes for e in entries)
        billable_minutes = sum(e.duration_minutes for e in entries if e.is_billable)

        return {
            "date": entry_date.isoformat(),
            "user_id": user_id,
            "entry_count": len(entries),
            "total_minutes": total_minutes,
            "total_hours": total_minutes / 60.0,
            "billable_minutes": billable_minutes,
            "billable_hours": billable_minutes / 60.0,
            "non_billable_minutes": total_minutes - billable_minutes,
        }

    def get_weekly_summary(self, user_id: str, week_start: date) -> Dict[str, Any]:
        """Get weekly summary for a user."""
        entries = self.get_entries_for_week(user_id, week_start)
        total_minutes = sum(e.duration_minutes for e in entries)
        billable_minutes = sum(e.duration_minutes for e in entries if e.is_billable)

        by_day: Dict[str, int] = {}
        for entry in entries:
            day_key = entry.date.isoformat()
            by_day[day_key] = by_day.get(day_key, 0) + entry.duration_minutes

        return {
            "week_start": week_start.isoformat(),
            "week_end": (week_start + timedelta(days=6)).isoformat(),
            "user_id": user_id,
            "entry_count": len(entries),
            "total_minutes": total_minutes,
            "total_hours": total_minutes / 60.0,
            "billable_minutes": billable_minutes,
            "billable_hours": billable_minutes / 60.0,
            "by_day": by_day,
        }

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get statistics."""
        return self._registry.get_stats(workspace_id=workspace_id, user_id=user_id)


# Global instance management
_time_tracking_manager: Optional[TimeTrackingManager] = None


def get_time_tracking_manager() -> TimeTrackingManager:
    """Get the global time tracking manager instance."""
    global _time_tracking_manager
    if _time_tracking_manager is None:
        _time_tracking_manager = TimeTrackingManager()
    return _time_tracking_manager


def set_time_tracking_manager(manager: TimeTrackingManager) -> None:
    """Set the global time tracking manager instance."""
    global _time_tracking_manager
    _time_tracking_manager = manager


def reset_time_tracking_manager() -> None:
    """Reset the global time tracking manager instance."""
    global _time_tracking_manager
    _time_tracking_manager = None
