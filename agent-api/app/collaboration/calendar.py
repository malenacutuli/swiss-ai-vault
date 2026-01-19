"""
Calendar & Scheduling module for SwissBrain.ai collaboration system.

This module provides enterprise calendar and scheduling features including:
- Calendar management with multiple views
- Event creation with recurrence support
- Attendee management and RSVP tracking
- Meeting room and resource booking
- Calendar sharing and permissions
- Free/busy time queries
- Time zone handling
- Event reminders and notifications
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date, time
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid


class CalendarType(str, Enum):
    """Type of calendar."""
    PERSONAL = "personal"
    TEAM = "team"
    PROJECT = "project"
    RESOURCE = "resource"
    SHARED = "shared"


class CalendarVisibility(str, Enum):
    """Visibility of a calendar."""
    PUBLIC = "public"
    PRIVATE = "private"
    SHARED = "shared"


class EventStatus(str, Enum):
    """Status of an event."""
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    CANCELLED = "cancelled"


class EventVisibility(str, Enum):
    """Visibility of an event."""
    PUBLIC = "public"
    PRIVATE = "private"
    CONFIDENTIAL = "confidential"


class EventType(str, Enum):
    """Type of event."""
    MEETING = "meeting"
    APPOINTMENT = "appointment"
    REMINDER = "reminder"
    TASK = "task"
    OUT_OF_OFFICE = "out_of_office"
    FOCUS_TIME = "focus_time"
    ALL_DAY = "all_day"


class AttendeeStatus(str, Enum):
    """RSVP status for an attendee."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TENTATIVE = "tentative"


class AttendeeRole(str, Enum):
    """Role of an attendee."""
    ORGANIZER = "organizer"
    REQUIRED = "required"
    OPTIONAL = "optional"
    RESOURCE = "resource"


class RecurrenceFrequency(str, Enum):
    """Frequency of recurrence."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurrenceEndType(str, Enum):
    """How recurrence ends."""
    NEVER = "never"
    AFTER_COUNT = "after_count"
    UNTIL_DATE = "until_date"


class ReminderType(str, Enum):
    """Type of reminder."""
    EMAIL = "email"
    PUSH = "push"
    IN_APP = "in_app"
    SMS = "sms"


class CalendarPermission(str, Enum):
    """Permission levels for calendar access."""
    NONE = "none"
    FREE_BUSY = "free_busy"
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


class FreeBusyStatus(str, Enum):
    """Free/busy status."""
    FREE = "free"
    BUSY = "busy"
    TENTATIVE = "tentative"
    OUT_OF_OFFICE = "out_of_office"


@dataclass
class RecurrenceRule:
    """Rule for recurring events."""
    frequency: RecurrenceFrequency
    interval: int = 1
    end_type: RecurrenceEndType = RecurrenceEndType.NEVER
    count: Optional[int] = None
    until: Optional[datetime] = None
    by_day: List[int] = field(default_factory=list)  # 0=Mon, 6=Sun
    by_month_day: List[int] = field(default_factory=list)
    by_month: List[int] = field(default_factory=list)
    exceptions: Set[date] = field(default_factory=set)

    def get_occurrences(
        self,
        start: datetime,
        range_start: datetime,
        range_end: datetime,
        max_count: int = 100,
    ) -> List[datetime]:
        """Generate occurrence dates within a range."""
        occurrences = []
        current = start
        count = 0

        while current <= range_end and len(occurrences) < max_count:
            if self.end_type == RecurrenceEndType.AFTER_COUNT and self.count:
                if count >= self.count:
                    break
            if self.end_type == RecurrenceEndType.UNTIL_DATE and self.until:
                if current > self.until:
                    break

            if current >= range_start and current.date() not in self.exceptions:
                occurrences.append(current)

            current = self._next_occurrence(current)
            count += 1

        return occurrences

    def _next_occurrence(self, current: datetime) -> datetime:
        """Calculate the next occurrence."""
        if self.frequency == RecurrenceFrequency.DAILY:
            return current + timedelta(days=self.interval)
        elif self.frequency == RecurrenceFrequency.WEEKLY:
            return current + timedelta(weeks=self.interval)
        elif self.frequency == RecurrenceFrequency.BIWEEKLY:
            return current + timedelta(weeks=2 * self.interval)
        elif self.frequency == RecurrenceFrequency.MONTHLY:
            month = current.month + self.interval
            year = current.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(current.day, 28)
            return current.replace(year=year, month=month, day=day)
        elif self.frequency == RecurrenceFrequency.YEARLY:
            return current.replace(year=current.year + self.interval)
        return current + timedelta(days=1)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "frequency": self.frequency.value,
            "interval": self.interval,
            "end_type": self.end_type.value,
            "count": self.count,
            "until": self.until.isoformat() if self.until else None,
            "by_day": self.by_day,
            "by_month_day": self.by_month_day,
            "by_month": self.by_month,
            "exceptions": [d.isoformat() for d in self.exceptions],
        }


@dataclass
class EventReminder:
    """A reminder for an event."""
    id: str
    event_id: str
    reminder_type: ReminderType
    minutes_before: int
    is_sent: bool = False
    sent_at: Optional[datetime] = None

    def should_trigger(self, event_start: datetime) -> bool:
        """Check if reminder should trigger now."""
        if self.is_sent:
            return False
        trigger_time = event_start - timedelta(minutes=self.minutes_before)
        return datetime.utcnow() >= trigger_time

    def mark_sent(self) -> None:
        """Mark reminder as sent."""
        self.is_sent = True
        self.sent_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_id": self.event_id,
            "reminder_type": self.reminder_type.value,
            "minutes_before": self.minutes_before,
            "is_sent": self.is_sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }


@dataclass
class EventAttendee:
    """An attendee of an event."""
    id: str
    event_id: str
    user_id: str
    email: str = ""
    name: str = ""
    role: AttendeeRole = AttendeeRole.REQUIRED
    status: AttendeeStatus = AttendeeStatus.PENDING
    responded_at: Optional[datetime] = None
    comment: str = ""
    is_organizer: bool = False

    def respond(self, status: AttendeeStatus, comment: str = "") -> None:
        """Respond to the event invitation."""
        self.status = status
        self.comment = comment
        self.responded_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_id": self.event_id,
            "user_id": self.user_id,
            "email": self.email,
            "name": self.name,
            "role": self.role.value,
            "status": self.status.value,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "comment": self.comment,
            "is_organizer": self.is_organizer,
        }


@dataclass
class EventAttachment:
    """An attachment to an event."""
    id: str
    event_id: str
    filename: str
    file_path: str
    file_size: int = 0
    mime_type: str = ""
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_id": self.event_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "uploaded_by": self.uploaded_by,
            "uploaded_at": self.uploaded_at.isoformat(),
        }


@dataclass
class Event:
    """A calendar event."""
    id: str
    calendar_id: str
    title: str
    organizer_id: str
    start_time: datetime
    end_time: datetime
    event_type: EventType = EventType.MEETING
    status: EventStatus = EventStatus.CONFIRMED
    visibility: EventVisibility = EventVisibility.PUBLIC
    description: str = ""
    location: str = ""
    video_conference_url: str = ""
    is_all_day: bool = False
    is_recurring: bool = False
    recurrence_rule: Optional[RecurrenceRule] = None
    recurring_event_id: Optional[str] = None
    timezone: str = "UTC"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: str = ""
    color: str = ""
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_minutes(self) -> int:
        """Get event duration in minutes."""
        delta = self.end_time - self.start_time
        return int(delta.total_seconds() / 60)

    @property
    def duration_hours(self) -> float:
        """Get event duration in hours."""
        return self.duration_minutes / 60

    @property
    def is_past(self) -> bool:
        """Check if event is in the past."""
        return self.end_time < datetime.utcnow()

    @property
    def is_ongoing(self) -> bool:
        """Check if event is currently happening."""
        now = datetime.utcnow()
        return self.start_time <= now <= self.end_time

    @property
    def is_future(self) -> bool:
        """Check if event is in the future."""
        return self.start_time > datetime.utcnow()

    def update(
        self,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> None:
        """Update event details."""
        if title is not None:
            self.title = title
        if description is not None:
            self.description = description
        if location is not None:
            self.location = location
        if start_time is not None:
            self.start_time = start_time
        if end_time is not None:
            self.end_time = end_time
        self.updated_at = datetime.utcnow()

    def cancel(self) -> None:
        """Cancel the event."""
        self.status = EventStatus.CANCELLED
        self.updated_at = datetime.utcnow()

    def confirm(self) -> None:
        """Confirm the event."""
        self.status = EventStatus.CONFIRMED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "calendar_id": self.calendar_id,
            "title": self.title,
            "organizer_id": self.organizer_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "event_type": self.event_type.value,
            "status": self.status.value,
            "visibility": self.visibility.value,
            "description": self.description,
            "location": self.location,
            "video_conference_url": self.video_conference_url,
            "is_all_day": self.is_all_day,
            "is_recurring": self.is_recurring,
            "recurrence_rule": self.recurrence_rule.to_dict() if self.recurrence_rule else None,
            "recurring_event_id": self.recurring_event_id,
            "timezone": self.timezone,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "color": self.color,
            "tags": list(self.tags),
            "duration_minutes": self.duration_minutes,
            "metadata": self.metadata,
        }


@dataclass
class Calendar:
    """A calendar."""
    id: str
    name: str
    owner_id: str
    calendar_type: CalendarType = CalendarType.PERSONAL
    visibility: CalendarVisibility = CalendarVisibility.PRIVATE
    description: str = ""
    color: str = "#3498db"
    timezone: str = "UTC"
    workspace_id: Optional[str] = None
    team_id: Optional[str] = None
    project_id: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    settings: Dict[str, Any] = field(default_factory=dict)

    def update(
        self,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        visibility: Optional[CalendarVisibility] = None,
    ) -> None:
        """Update calendar details."""
        if name is not None:
            self.name = name
        if description is not None:
            self.description = description
        if color is not None:
            self.color = color
        if visibility is not None:
            self.visibility = visibility
        self.updated_at = datetime.utcnow()

    def deactivate(self) -> None:
        """Deactivate the calendar."""
        self.is_active = False
        self.updated_at = datetime.utcnow()

    def activate(self) -> None:
        """Activate the calendar."""
        self.is_active = True
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "owner_id": self.owner_id,
            "calendar_type": self.calendar_type.value,
            "visibility": self.visibility.value,
            "description": self.description,
            "color": self.color,
            "timezone": self.timezone,
            "workspace_id": self.workspace_id,
            "team_id": self.team_id,
            "project_id": self.project_id,
            "is_default": self.is_default,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "settings": self.settings,
        }


@dataclass
class CalendarShare:
    """A calendar sharing configuration."""
    id: str
    calendar_id: str
    shared_with_id: str
    shared_with_type: str = "user"  # user, team, workspace
    permission: CalendarPermission = CalendarPermission.READ
    shared_by: str = ""
    shared_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "calendar_id": self.calendar_id,
            "shared_with_id": self.shared_with_id,
            "shared_with_type": self.shared_with_type,
            "permission": self.permission.value,
            "shared_by": self.shared_by,
            "shared_at": self.shared_at.isoformat(),
        }


@dataclass
class FreeBusySlot:
    """A free/busy time slot."""
    start_time: datetime
    end_time: datetime
    status: FreeBusyStatus
    event_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "status": self.status.value,
            "event_id": self.event_id,
        }


@dataclass
class MeetingRoom:
    """A meeting room resource."""
    id: str
    name: str
    capacity: int
    location: str = ""
    floor: str = ""
    building: str = ""
    workspace_id: Optional[str] = None
    amenities: Set[str] = field(default_factory=set)
    is_available: bool = True
    calendar_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "capacity": self.capacity,
            "location": self.location,
            "floor": self.floor,
            "building": self.building,
            "workspace_id": self.workspace_id,
            "amenities": list(self.amenities),
            "is_available": self.is_available,
            "calendar_id": self.calendar_id,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class SchedulingSuggestion:
    """A suggested meeting time."""
    start_time: datetime
    end_time: datetime
    score: float
    available_attendees: List[str] = field(default_factory=list)
    unavailable_attendees: List[str] = field(default_factory=list)
    available_rooms: List[str] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "score": self.score,
            "available_attendees": self.available_attendees,
            "unavailable_attendees": self.unavailable_attendees,
            "available_rooms": self.available_rooms,
            "conflicts": self.conflicts,
        }


class CalendarRegistry:
    """Registry for calendar entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._calendars: Dict[str, Calendar] = {}
        self._events: Dict[str, Event] = {}
        self._attendees: Dict[str, List[EventAttendee]] = {}
        self._reminders: Dict[str, List[EventReminder]] = {}
        self._attachments: Dict[str, List[EventAttachment]] = {}
        self._shares: Dict[str, List[CalendarShare]] = {}
        self._rooms: Dict[str, MeetingRoom] = {}
        self._user_calendars: Dict[str, Set[str]] = {}

    # Calendar methods
    def create_calendar(
        self,
        name: str,
        owner_id: str,
        calendar_type: CalendarType = CalendarType.PERSONAL,
        visibility: CalendarVisibility = CalendarVisibility.PRIVATE,
        description: str = "",
        color: str = "#3498db",
        timezone: str = "UTC",
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        project_id: Optional[str] = None,
        is_default: bool = False,
    ) -> Calendar:
        """Create a new calendar."""
        calendar_id = str(uuid.uuid4())
        calendar = Calendar(
            id=calendar_id,
            name=name,
            owner_id=owner_id,
            calendar_type=calendar_type,
            visibility=visibility,
            description=description,
            color=color,
            timezone=timezone,
            workspace_id=workspace_id,
            team_id=team_id,
            project_id=project_id,
            is_default=is_default,
        )

        self._calendars[calendar_id] = calendar
        self._shares[calendar_id] = []

        # Track user calendars
        if owner_id not in self._user_calendars:
            self._user_calendars[owner_id] = set()
        self._user_calendars[owner_id].add(calendar_id)

        return calendar

    def get_calendar(self, calendar_id: str) -> Optional[Calendar]:
        """Get a calendar by ID."""
        return self._calendars.get(calendar_id)

    def update_calendar(
        self,
        calendar_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        visibility: Optional[CalendarVisibility] = None,
    ) -> Optional[Calendar]:
        """Update a calendar."""
        calendar = self._calendars.get(calendar_id)
        if not calendar:
            return None

        calendar.update(name, description, color, visibility)
        return calendar

    def delete_calendar(self, calendar_id: str) -> bool:
        """Delete a calendar."""
        calendar = self._calendars.get(calendar_id)
        if not calendar:
            return False

        # Remove from user calendars
        if calendar.owner_id in self._user_calendars:
            self._user_calendars[calendar.owner_id].discard(calendar_id)

        # Delete associated events
        events_to_delete = [e.id for e in self._events.values() if e.calendar_id == calendar_id]
        for event_id in events_to_delete:
            self.delete_event(event_id)

        # Clean up
        del self._calendars[calendar_id]
        self._shares.pop(calendar_id, None)

        return True

    def list_calendars(
        self,
        owner_id: Optional[str] = None,
        calendar_type: Optional[CalendarType] = None,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        include_shared: bool = True,
    ) -> List[Calendar]:
        """List calendars with filters."""
        calendars = list(self._calendars.values())

        if owner_id:
            owned = [c for c in calendars if c.owner_id == owner_id]
            if include_shared:
                # Include shared calendars
                shared_calendar_ids = set()
                for cal_id, shares in self._shares.items():
                    for share in shares:
                        if share.shared_with_id == owner_id:
                            shared_calendar_ids.add(cal_id)
                shared = [c for c in calendars if c.id in shared_calendar_ids]
                calendars = owned + shared
            else:
                calendars = owned

        if calendar_type:
            calendars = [c for c in calendars if c.calendar_type == calendar_type]
        if workspace_id:
            calendars = [c for c in calendars if c.workspace_id == workspace_id]
        if team_id:
            calendars = [c for c in calendars if c.team_id == team_id]

        return calendars

    def get_user_default_calendar(self, user_id: str) -> Optional[Calendar]:
        """Get a user's default calendar."""
        calendars = self.list_calendars(owner_id=user_id, include_shared=False)
        for cal in calendars:
            if cal.is_default:
                return cal
        # Return first personal calendar if no default
        for cal in calendars:
            if cal.calendar_type == CalendarType.PERSONAL:
                return cal
        return None

    # Event methods
    def create_event(
        self,
        calendar_id: str,
        title: str,
        organizer_id: str,
        start_time: datetime,
        end_time: datetime,
        event_type: EventType = EventType.MEETING,
        status: EventStatus = EventStatus.CONFIRMED,
        visibility: EventVisibility = EventVisibility.PUBLIC,
        description: str = "",
        location: str = "",
        video_conference_url: str = "",
        is_all_day: bool = False,
        is_recurring: bool = False,
        recurrence_rule: Optional[RecurrenceRule] = None,
        timezone: str = "UTC",
        color: str = "",
        tags: Optional[Set[str]] = None,
    ) -> Optional[Event]:
        """Create a new event."""
        if calendar_id not in self._calendars:
            return None

        event_id = str(uuid.uuid4())
        event = Event(
            id=event_id,
            calendar_id=calendar_id,
            title=title,
            organizer_id=organizer_id,
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            status=status,
            visibility=visibility,
            description=description,
            location=location,
            video_conference_url=video_conference_url,
            is_all_day=is_all_day,
            is_recurring=is_recurring,
            recurrence_rule=recurrence_rule,
            timezone=timezone,
            created_by=organizer_id,
            color=color,
            tags=tags or set(),
        )

        self._events[event_id] = event
        self._attendees[event_id] = []
        self._reminders[event_id] = []
        self._attachments[event_id] = []

        # Add organizer as attendee
        self._add_attendee(
            event_id, organizer_id, "", "",
            AttendeeRole.ORGANIZER, AttendeeStatus.ACCEPTED, True
        )

        return event

    def get_event(self, event_id: str) -> Optional[Event]:
        """Get an event by ID."""
        return self._events.get(event_id)

    def update_event(
        self,
        event_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        status: Optional[EventStatus] = None,
        visibility: Optional[EventVisibility] = None,
    ) -> Optional[Event]:
        """Update an event."""
        event = self._events.get(event_id)
        if not event:
            return None

        event.update(title, description, location, start_time, end_time)
        if status is not None:
            event.status = status
        if visibility is not None:
            event.visibility = visibility

        return event

    def delete_event(self, event_id: str) -> bool:
        """Delete an event."""
        if event_id not in self._events:
            return False

        del self._events[event_id]
        self._attendees.pop(event_id, None)
        self._reminders.pop(event_id, None)
        self._attachments.pop(event_id, None)

        return True

    def cancel_event(self, event_id: str) -> Optional[Event]:
        """Cancel an event."""
        event = self._events.get(event_id)
        if event:
            event.cancel()
        return event

    def list_events(
        self,
        calendar_id: Optional[str] = None,
        calendar_ids: Optional[List[str]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        organizer_id: Optional[str] = None,
        event_type: Optional[EventType] = None,
        status: Optional[EventStatus] = None,
        include_cancelled: bool = False,
    ) -> List[Event]:
        """List events with filters."""
        events = list(self._events.values())

        if calendar_id:
            events = [e for e in events if e.calendar_id == calendar_id]
        if calendar_ids:
            events = [e for e in events if e.calendar_id in calendar_ids]
        if start_date:
            events = [e for e in events if e.end_time >= start_date]
        if end_date:
            events = [e for e in events if e.start_time <= end_date]
        if organizer_id:
            events = [e for e in events if e.organizer_id == organizer_id]
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if status:
            events = [e for e in events if e.status == status]
        if not include_cancelled:
            events = [e for e in events if e.status != EventStatus.CANCELLED]

        # Sort by start time
        events.sort(key=lambda e: e.start_time)

        return events

    def get_events_for_day(
        self,
        calendar_ids: List[str],
        day: date,
    ) -> List[Event]:
        """Get events for a specific day."""
        start = datetime.combine(day, time.min)
        end = datetime.combine(day, time.max)
        return self.list_events(calendar_ids=calendar_ids, start_date=start, end_date=end)

    def get_events_for_week(
        self,
        calendar_ids: List[str],
        week_start: date,
    ) -> List[Event]:
        """Get events for a week."""
        start = datetime.combine(week_start, time.min)
        end = datetime.combine(week_start + timedelta(days=6), time.max)
        return self.list_events(calendar_ids=calendar_ids, start_date=start, end_date=end)

    def get_events_for_month(
        self,
        calendar_ids: List[str],
        year: int,
        month: int,
    ) -> List[Event]:
        """Get events for a month."""
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
        else:
            end = datetime(year, month + 1, 1) - timedelta(seconds=1)
        return self.list_events(calendar_ids=calendar_ids, start_date=start, end_date=end)

    def get_upcoming_events(
        self,
        user_id: str,
        limit: int = 10,
    ) -> List[Event]:
        """Get upcoming events for a user."""
        # Get user's calendar IDs
        calendar_ids = list(self._user_calendars.get(user_id, set()))

        # Add shared calendars
        for cal_id, shares in self._shares.items():
            for share in shares:
                if share.shared_with_id == user_id:
                    calendar_ids.append(cal_id)

        now = datetime.utcnow()
        events = self.list_events(
            calendar_ids=calendar_ids,
            start_date=now,
        )

        # Also get events where user is an attendee
        for event_id, attendees in self._attendees.items():
            for attendee in attendees:
                if attendee.user_id == user_id:
                    event = self._events.get(event_id)
                    if event and event.start_time >= now and event not in events:
                        events.append(event)

        events.sort(key=lambda e: e.start_time)
        return events[:limit]

    # Attendee methods
    def _add_attendee(
        self,
        event_id: str,
        user_id: str,
        email: str,
        name: str,
        role: AttendeeRole,
        status: AttendeeStatus,
        is_organizer: bool,
    ) -> EventAttendee:
        """Internal method to add an attendee."""
        attendee = EventAttendee(
            id=str(uuid.uuid4()),
            event_id=event_id,
            user_id=user_id,
            email=email,
            name=name,
            role=role,
            status=status,
            is_organizer=is_organizer,
        )

        if event_id not in self._attendees:
            self._attendees[event_id] = []
        self._attendees[event_id].append(attendee)

        return attendee

    def add_attendee(
        self,
        event_id: str,
        user_id: str,
        email: str = "",
        name: str = "",
        role: AttendeeRole = AttendeeRole.REQUIRED,
    ) -> Optional[EventAttendee]:
        """Add an attendee to an event."""
        if event_id not in self._events:
            return None

        # Check if already an attendee
        attendees = self._attendees.get(event_id, [])
        for a in attendees:
            if a.user_id == user_id:
                return a

        return self._add_attendee(
            event_id, user_id, email, name, role, AttendeeStatus.PENDING, False
        )

    def remove_attendee(self, event_id: str, user_id: str) -> bool:
        """Remove an attendee from an event."""
        attendees = self._attendees.get(event_id, [])
        for i, a in enumerate(attendees):
            if a.user_id == user_id and not a.is_organizer:
                del attendees[i]
                return True
        return False

    def get_attendees(self, event_id: str) -> List[EventAttendee]:
        """Get all attendees for an event."""
        return self._attendees.get(event_id, [])

    def respond_to_event(
        self,
        event_id: str,
        user_id: str,
        status: AttendeeStatus,
        comment: str = "",
    ) -> Optional[EventAttendee]:
        """Respond to an event invitation."""
        attendees = self._attendees.get(event_id, [])
        for attendee in attendees:
            if attendee.user_id == user_id:
                attendee.respond(status, comment)
                return attendee
        return None

    def get_user_events(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[AttendeeStatus] = None,
    ) -> List[Event]:
        """Get events where user is an attendee."""
        event_ids = set()

        for event_id, attendees in self._attendees.items():
            for attendee in attendees:
                if attendee.user_id == user_id:
                    if status is None or attendee.status == status:
                        event_ids.add(event_id)

        events = [self._events[eid] for eid in event_ids if eid in self._events]

        if start_date:
            events = [e for e in events if e.end_time >= start_date]
        if end_date:
            events = [e for e in events if e.start_time <= end_date]

        events.sort(key=lambda e: e.start_time)
        return events

    # Reminder methods
    def add_reminder(
        self,
        event_id: str,
        reminder_type: ReminderType,
        minutes_before: int,
    ) -> Optional[EventReminder]:
        """Add a reminder to an event."""
        if event_id not in self._events:
            return None

        reminder = EventReminder(
            id=str(uuid.uuid4()),
            event_id=event_id,
            reminder_type=reminder_type,
            minutes_before=minutes_before,
        )

        if event_id not in self._reminders:
            self._reminders[event_id] = []
        self._reminders[event_id].append(reminder)

        return reminder

    def get_reminders(self, event_id: str) -> List[EventReminder]:
        """Get all reminders for an event."""
        return self._reminders.get(event_id, [])

    def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder."""
        for event_id, reminders in self._reminders.items():
            for i, r in enumerate(reminders):
                if r.id == reminder_id:
                    del reminders[i]
                    return True
        return False

    def get_pending_reminders(self) -> List[EventReminder]:
        """Get all pending reminders that should be triggered."""
        pending = []
        for event_id, reminders in self._reminders.items():
            event = self._events.get(event_id)
            if not event:
                continue
            for reminder in reminders:
                if reminder.should_trigger(event.start_time):
                    pending.append(reminder)
        return pending

    # Attachment methods
    def add_attachment(
        self,
        event_id: str,
        filename: str,
        file_path: str,
        uploaded_by: str,
        file_size: int = 0,
        mime_type: str = "",
    ) -> Optional[EventAttachment]:
        """Add an attachment to an event."""
        if event_id not in self._events:
            return None

        attachment = EventAttachment(
            id=str(uuid.uuid4()),
            event_id=event_id,
            filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uploaded_by,
        )

        if event_id not in self._attachments:
            self._attachments[event_id] = []
        self._attachments[event_id].append(attachment)

        return attachment

    def get_attachments(self, event_id: str) -> List[EventAttachment]:
        """Get all attachments for an event."""
        return self._attachments.get(event_id, [])

    def delete_attachment(self, attachment_id: str) -> bool:
        """Delete an attachment."""
        for event_id, attachments in self._attachments.items():
            for i, a in enumerate(attachments):
                if a.id == attachment_id:
                    del attachments[i]
                    return True
        return False

    # Calendar sharing methods
    def share_calendar(
        self,
        calendar_id: str,
        shared_with_id: str,
        shared_with_type: str,
        permission: CalendarPermission,
        shared_by: str,
    ) -> Optional[CalendarShare]:
        """Share a calendar."""
        if calendar_id not in self._calendars:
            return None

        # Check for existing share
        shares = self._shares.get(calendar_id, [])
        for share in shares:
            if share.shared_with_id == shared_with_id:
                share.permission = permission
                return share

        share = CalendarShare(
            id=str(uuid.uuid4()),
            calendar_id=calendar_id,
            shared_with_id=shared_with_id,
            shared_with_type=shared_with_type,
            permission=permission,
            shared_by=shared_by,
        )

        if calendar_id not in self._shares:
            self._shares[calendar_id] = []
        self._shares[calendar_id].append(share)

        return share

    def unshare_calendar(self, calendar_id: str, shared_with_id: str) -> bool:
        """Remove calendar sharing."""
        shares = self._shares.get(calendar_id, [])
        for i, share in enumerate(shares):
            if share.shared_with_id == shared_with_id:
                del shares[i]
                return True
        return False

    def get_calendar_shares(self, calendar_id: str) -> List[CalendarShare]:
        """Get all shares for a calendar."""
        return self._shares.get(calendar_id, [])

    def get_shared_calendars(self, user_id: str) -> List[Calendar]:
        """Get calendars shared with a user."""
        shared_calendar_ids = set()
        for cal_id, shares in self._shares.items():
            for share in shares:
                if share.shared_with_id == user_id:
                    shared_calendar_ids.add(cal_id)

        return [self._calendars[cid] for cid in shared_calendar_ids if cid in self._calendars]

    def get_calendar_permission(
        self,
        calendar_id: str,
        user_id: str,
    ) -> CalendarPermission:
        """Get a user's permission level for a calendar."""
        calendar = self._calendars.get(calendar_id)
        if not calendar:
            return CalendarPermission.NONE

        if calendar.owner_id == user_id:
            return CalendarPermission.ADMIN

        shares = self._shares.get(calendar_id, [])
        for share in shares:
            if share.shared_with_id == user_id:
                return share.permission

        if calendar.visibility == CalendarVisibility.PUBLIC:
            return CalendarPermission.READ

        return CalendarPermission.NONE

    # Meeting room methods
    def create_room(
        self,
        name: str,
        capacity: int,
        location: str = "",
        floor: str = "",
        building: str = "",
        workspace_id: Optional[str] = None,
        amenities: Optional[Set[str]] = None,
    ) -> MeetingRoom:
        """Create a meeting room."""
        room_id = str(uuid.uuid4())

        # Create a calendar for the room
        calendar = self.create_calendar(
            name=f"Room: {name}",
            owner_id="system",
            calendar_type=CalendarType.RESOURCE,
            visibility=CalendarVisibility.PUBLIC,
        )

        room = MeetingRoom(
            id=room_id,
            name=name,
            capacity=capacity,
            location=location,
            floor=floor,
            building=building,
            workspace_id=workspace_id,
            amenities=amenities or set(),
            calendar_id=calendar.id,
        )

        self._rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> Optional[MeetingRoom]:
        """Get a meeting room."""
        return self._rooms.get(room_id)

    def list_rooms(
        self,
        workspace_id: Optional[str] = None,
        min_capacity: Optional[int] = None,
        amenities: Optional[Set[str]] = None,
    ) -> List[MeetingRoom]:
        """List meeting rooms with filters."""
        rooms = list(self._rooms.values())

        if workspace_id:
            rooms = [r for r in rooms if r.workspace_id == workspace_id]
        if min_capacity:
            rooms = [r for r in rooms if r.capacity >= min_capacity]
        if amenities:
            rooms = [r for r in rooms if amenities <= r.amenities]

        return rooms

    def get_available_rooms(
        self,
        start_time: datetime,
        end_time: datetime,
        min_capacity: Optional[int] = None,
        workspace_id: Optional[str] = None,
    ) -> List[MeetingRoom]:
        """Get available rooms for a time slot."""
        rooms = self.list_rooms(workspace_id=workspace_id, min_capacity=min_capacity)
        available = []

        for room in rooms:
            if room.calendar_id:
                events = self.list_events(
                    calendar_id=room.calendar_id,
                    start_date=start_time,
                    end_date=end_time,
                )
                if not events:
                    available.append(room)
            else:
                available.append(room)

        return available

    def book_room(
        self,
        room_id: str,
        title: str,
        organizer_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> Optional[Event]:
        """Book a meeting room."""
        room = self._rooms.get(room_id)
        if not room or not room.calendar_id:
            return None

        # Check availability
        events = self.list_events(
            calendar_id=room.calendar_id,
            start_date=start_time,
            end_date=end_time,
        )
        if events:
            return None  # Room not available

        return self.create_event(
            calendar_id=room.calendar_id,
            title=title,
            organizer_id=organizer_id,
            start_time=start_time,
            end_time=end_time,
            location=f"{room.name} - {room.location}",
        )

    # Free/busy methods
    def get_free_busy(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[FreeBusySlot]:
        """Get free/busy slots for a user."""
        events = self.get_user_events(user_id, start_time, end_time, AttendeeStatus.ACCEPTED)
        slots = []

        for event in events:
            if event.status == EventStatus.CANCELLED:
                continue

            status = FreeBusyStatus.BUSY
            if event.event_type == EventType.OUT_OF_OFFICE:
                status = FreeBusyStatus.OUT_OF_OFFICE
            elif event.status == EventStatus.TENTATIVE:
                status = FreeBusyStatus.TENTATIVE

            slots.append(FreeBusySlot(
                start_time=event.start_time,
                end_time=event.end_time,
                status=status,
                event_id=event.id,
            ))

        return sorted(slots, key=lambda s: s.start_time)

    def find_free_slots(
        self,
        user_ids: List[str],
        start_date: datetime,
        end_date: datetime,
        duration_minutes: int,
        working_hours_start: int = 9,
        working_hours_end: int = 17,
    ) -> List[Tuple[datetime, datetime]]:
        """Find free time slots for multiple users."""
        free_slots = []

        # Get all busy slots for all users
        all_busy: List[Tuple[datetime, datetime]] = []
        for user_id in user_ids:
            busy_slots = self.get_free_busy(user_id, start_date, end_date)
            for slot in busy_slots:
                if slot.status in (FreeBusyStatus.BUSY, FreeBusyStatus.OUT_OF_OFFICE):
                    all_busy.append((slot.start_time, slot.end_time))

        # Sort and merge busy slots
        all_busy.sort(key=lambda x: x[0])
        merged_busy: List[Tuple[datetime, datetime]] = []
        for start, end in all_busy:
            if merged_busy and start <= merged_busy[-1][1]:
                merged_busy[-1] = (merged_busy[-1][0], max(merged_busy[-1][1], end))
            else:
                merged_busy.append((start, end))

        # Find free slots within working hours
        current = start_date
        while current < end_date:
            # Check if within working hours
            if current.hour >= working_hours_start and current.hour < working_hours_end:
                slot_end = current + timedelta(minutes=duration_minutes)

                # Check if slot_end is within working hours
                if slot_end.hour <= working_hours_end:
                    # Check if slot conflicts with any busy period
                    is_free = True
                    for busy_start, busy_end in merged_busy:
                        if not (slot_end <= busy_start or current >= busy_end):
                            is_free = False
                            break

                    if is_free:
                        free_slots.append((current, slot_end))

            current += timedelta(minutes=30)  # Check every 30 minutes

        return free_slots[:20]  # Return up to 20 suggestions

    # Statistics
    def get_stats(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get calendar statistics."""
        calendars = self.list_calendars(owner_id=user_id, workspace_id=workspace_id)
        calendar_ids = [c.id for c in calendars]

        events = self.list_events(calendar_ids=calendar_ids)

        now = datetime.utcnow()
        upcoming = [e for e in events if e.start_time > now]
        past = [e for e in events if e.end_time < now]

        total_duration = sum(e.duration_minutes for e in events)

        return {
            "total_calendars": len(calendars),
            "total_events": len(events),
            "upcoming_events": len(upcoming),
            "past_events": len(past),
            "total_duration_hours": total_duration / 60,
            "avg_event_duration_minutes": total_duration / len(events) if events else 0,
        }


class CalendarManager:
    """High-level API for calendar operations."""

    def __init__(self, registry: Optional[CalendarRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or CalendarRegistry()

    @property
    def registry(self) -> CalendarRegistry:
        """Get the registry."""
        return self._registry

    # Calendar methods
    def create_calendar(
        self,
        name: str,
        owner_id: str,
        calendar_type: CalendarType = CalendarType.PERSONAL,
        visibility: CalendarVisibility = CalendarVisibility.PRIVATE,
        description: str = "",
        color: str = "#3498db",
        timezone: str = "UTC",
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        project_id: Optional[str] = None,
        is_default: bool = False,
    ) -> Calendar:
        """Create a new calendar."""
        return self._registry.create_calendar(
            name=name,
            owner_id=owner_id,
            calendar_type=calendar_type,
            visibility=visibility,
            description=description,
            color=color,
            timezone=timezone,
            workspace_id=workspace_id,
            team_id=team_id,
            project_id=project_id,
            is_default=is_default,
        )

    def get_calendar(self, calendar_id: str) -> Optional[Calendar]:
        """Get a calendar."""
        return self._registry.get_calendar(calendar_id)

    def update_calendar(
        self,
        calendar_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        visibility: Optional[CalendarVisibility] = None,
    ) -> Optional[Calendar]:
        """Update a calendar."""
        return self._registry.update_calendar(
            calendar_id, name, description, color, visibility
        )

    def delete_calendar(self, calendar_id: str) -> bool:
        """Delete a calendar."""
        return self._registry.delete_calendar(calendar_id)

    def list_calendars(
        self,
        owner_id: Optional[str] = None,
        calendar_type: Optional[CalendarType] = None,
        workspace_id: Optional[str] = None,
        include_shared: bool = True,
    ) -> List[Calendar]:
        """List calendars."""
        return self._registry.list_calendars(
            owner_id=owner_id,
            calendar_type=calendar_type,
            workspace_id=workspace_id,
            include_shared=include_shared,
        )

    def get_user_default_calendar(self, user_id: str) -> Optional[Calendar]:
        """Get user's default calendar."""
        return self._registry.get_user_default_calendar(user_id)

    def ensure_user_calendar(self, user_id: str, user_name: str = "") -> Calendar:
        """Ensure user has a default calendar."""
        calendar = self.get_user_default_calendar(user_id)
        if not calendar:
            calendar = self.create_calendar(
                name=f"{user_name or user_id}'s Calendar",
                owner_id=user_id,
                calendar_type=CalendarType.PERSONAL,
                is_default=True,
            )
        return calendar

    # Event methods
    def create_event(
        self,
        calendar_id: str,
        title: str,
        organizer_id: str,
        start_time: datetime,
        end_time: datetime,
        event_type: EventType = EventType.MEETING,
        description: str = "",
        location: str = "",
        video_conference_url: str = "",
        is_all_day: bool = False,
        attendee_ids: Optional[List[str]] = None,
        recurrence: Optional[RecurrenceRule] = None,
        reminders: Optional[List[int]] = None,
    ) -> Optional[Event]:
        """Create an event with attendees and reminders."""
        event = self._registry.create_event(
            calendar_id=calendar_id,
            title=title,
            organizer_id=organizer_id,
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            description=description,
            location=location,
            video_conference_url=video_conference_url,
            is_all_day=is_all_day,
            is_recurring=recurrence is not None,
            recurrence_rule=recurrence,
        )

        if not event:
            return None

        # Add attendees
        if attendee_ids:
            for user_id in attendee_ids:
                if user_id != organizer_id:
                    self._registry.add_attendee(event.id, user_id)

        # Add default reminders
        if reminders:
            for minutes in reminders:
                self._registry.add_reminder(event.id, ReminderType.IN_APP, minutes)
        else:
            # Default 15-minute reminder
            self._registry.add_reminder(event.id, ReminderType.IN_APP, 15)

        return event

    def get_event(self, event_id: str) -> Optional[Event]:
        """Get an event."""
        return self._registry.get_event(event_id)

    def update_event(
        self,
        event_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Optional[Event]:
        """Update an event."""
        return self._registry.update_event(
            event_id, title, description, location, start_time, end_time
        )

    def delete_event(self, event_id: str) -> bool:
        """Delete an event."""
        return self._registry.delete_event(event_id)

    def cancel_event(self, event_id: str) -> Optional[Event]:
        """Cancel an event."""
        return self._registry.cancel_event(event_id)

    def list_events(
        self,
        calendar_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Event]:
        """List events."""
        return self._registry.list_events(
            calendar_id=calendar_id,
            start_date=start_date,
            end_date=end_date,
        )

    def get_events_for_day(self, user_id: str, day: date) -> List[Event]:
        """Get events for a day."""
        calendars = self.list_calendars(owner_id=user_id)
        calendar_ids = [c.id for c in calendars]
        return self._registry.get_events_for_day(calendar_ids, day)

    def get_events_for_week(self, user_id: str, week_start: date) -> List[Event]:
        """Get events for a week."""
        calendars = self.list_calendars(owner_id=user_id)
        calendar_ids = [c.id for c in calendars]
        return self._registry.get_events_for_week(calendar_ids, week_start)

    def get_events_for_month(self, user_id: str, year: int, month: int) -> List[Event]:
        """Get events for a month."""
        calendars = self.list_calendars(owner_id=user_id)
        calendar_ids = [c.id for c in calendars]
        return self._registry.get_events_for_month(calendar_ids, year, month)

    def get_upcoming_events(self, user_id: str, limit: int = 10) -> List[Event]:
        """Get upcoming events."""
        return self._registry.get_upcoming_events(user_id, limit)

    # Attendee methods
    def add_attendee(
        self,
        event_id: str,
        user_id: str,
        email: str = "",
        name: str = "",
        role: AttendeeRole = AttendeeRole.REQUIRED,
    ) -> Optional[EventAttendee]:
        """Add an attendee."""
        return self._registry.add_attendee(event_id, user_id, email, name, role)

    def remove_attendee(self, event_id: str, user_id: str) -> bool:
        """Remove an attendee."""
        return self._registry.remove_attendee(event_id, user_id)

    def get_attendees(self, event_id: str) -> List[EventAttendee]:
        """Get event attendees."""
        return self._registry.get_attendees(event_id)

    def respond_to_event(
        self,
        event_id: str,
        user_id: str,
        status: AttendeeStatus,
        comment: str = "",
    ) -> Optional[EventAttendee]:
        """Respond to an event."""
        return self._registry.respond_to_event(event_id, user_id, status, comment)

    def accept_event(self, event_id: str, user_id: str) -> Optional[EventAttendee]:
        """Accept an event invitation."""
        return self.respond_to_event(event_id, user_id, AttendeeStatus.ACCEPTED)

    def decline_event(self, event_id: str, user_id: str, comment: str = "") -> Optional[EventAttendee]:
        """Decline an event invitation."""
        return self.respond_to_event(event_id, user_id, AttendeeStatus.DECLINED, comment)

    def tentative_event(self, event_id: str, user_id: str) -> Optional[EventAttendee]:
        """Mark tentative for an event."""
        return self.respond_to_event(event_id, user_id, AttendeeStatus.TENTATIVE)

    def get_user_events(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Event]:
        """Get events for a user."""
        return self._registry.get_user_events(user_id, start_date, end_date)

    # Reminder methods
    def add_reminder(
        self,
        event_id: str,
        reminder_type: ReminderType,
        minutes_before: int,
    ) -> Optional[EventReminder]:
        """Add a reminder."""
        return self._registry.add_reminder(event_id, reminder_type, minutes_before)

    def get_reminders(self, event_id: str) -> List[EventReminder]:
        """Get event reminders."""
        return self._registry.get_reminders(event_id)

    def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder."""
        return self._registry.delete_reminder(reminder_id)

    # Attachment methods
    def add_attachment(
        self,
        event_id: str,
        filename: str,
        file_path: str,
        uploaded_by: str,
    ) -> Optional[EventAttachment]:
        """Add an attachment."""
        return self._registry.add_attachment(event_id, filename, file_path, uploaded_by)

    def get_attachments(self, event_id: str) -> List[EventAttachment]:
        """Get event attachments."""
        return self._registry.get_attachments(event_id)

    def delete_attachment(self, attachment_id: str) -> bool:
        """Delete an attachment."""
        return self._registry.delete_attachment(attachment_id)

    # Sharing methods
    def share_calendar(
        self,
        calendar_id: str,
        shared_with_id: str,
        permission: CalendarPermission,
        shared_by: str,
        shared_with_type: str = "user",
    ) -> Optional[CalendarShare]:
        """Share a calendar."""
        return self._registry.share_calendar(
            calendar_id, shared_with_id, shared_with_type, permission, shared_by
        )

    def unshare_calendar(self, calendar_id: str, shared_with_id: str) -> bool:
        """Remove calendar sharing."""
        return self._registry.unshare_calendar(calendar_id, shared_with_id)

    def get_calendar_shares(self, calendar_id: str) -> List[CalendarShare]:
        """Get calendar shares."""
        return self._registry.get_calendar_shares(calendar_id)

    def get_shared_calendars(self, user_id: str) -> List[Calendar]:
        """Get calendars shared with user."""
        return self._registry.get_shared_calendars(user_id)

    def get_calendar_permission(self, calendar_id: str, user_id: str) -> CalendarPermission:
        """Get user's calendar permission."""
        return self._registry.get_calendar_permission(calendar_id, user_id)

    # Meeting room methods
    def create_room(
        self,
        name: str,
        capacity: int,
        location: str = "",
        floor: str = "",
        building: str = "",
        workspace_id: Optional[str] = None,
        amenities: Optional[Set[str]] = None,
    ) -> MeetingRoom:
        """Create a meeting room."""
        return self._registry.create_room(
            name, capacity, location, floor, building, workspace_id, amenities
        )

    def get_room(self, room_id: str) -> Optional[MeetingRoom]:
        """Get a meeting room."""
        return self._registry.get_room(room_id)

    def list_rooms(
        self,
        workspace_id: Optional[str] = None,
        min_capacity: Optional[int] = None,
    ) -> List[MeetingRoom]:
        """List meeting rooms."""
        return self._registry.list_rooms(workspace_id, min_capacity)

    def get_available_rooms(
        self,
        start_time: datetime,
        end_time: datetime,
        min_capacity: Optional[int] = None,
    ) -> List[MeetingRoom]:
        """Get available rooms."""
        return self._registry.get_available_rooms(start_time, end_time, min_capacity)

    def book_room(
        self,
        room_id: str,
        title: str,
        organizer_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> Optional[Event]:
        """Book a meeting room."""
        return self._registry.book_room(room_id, title, organizer_id, start_time, end_time)

    # Free/busy methods
    def get_free_busy(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[FreeBusySlot]:
        """Get free/busy for a user."""
        return self._registry.get_free_busy(user_id, start_time, end_time)

    def find_meeting_time(
        self,
        attendee_ids: List[str],
        duration_minutes: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[SchedulingSuggestion]:
        """Find available meeting times."""
        if start_date is None:
            start_date = datetime.utcnow()
        if end_date is None:
            end_date = start_date + timedelta(days=7)

        free_slots = self._registry.find_free_slots(
            attendee_ids, start_date, end_date, duration_minutes
        )

        suggestions = []
        for start, end in free_slots:
            # Check which attendees are available
            available = []
            unavailable = []

            for user_id in attendee_ids:
                busy = self._registry.get_free_busy(user_id, start, end)
                if any(s.status in (FreeBusyStatus.BUSY, FreeBusyStatus.OUT_OF_OFFICE) for s in busy):
                    unavailable.append(user_id)
                else:
                    available.append(user_id)

            # Get available rooms
            rooms = self._registry.get_available_rooms(start, end)
            room_ids = [r.id for r in rooms]

            # Calculate score (higher is better)
            score = len(available) / len(attendee_ids) if attendee_ids else 1.0

            suggestions.append(SchedulingSuggestion(
                start_time=start,
                end_time=end,
                score=score,
                available_attendees=available,
                unavailable_attendees=unavailable,
                available_rooms=room_ids,
            ))

        # Sort by score descending
        suggestions.sort(key=lambda s: s.score, reverse=True)
        return suggestions[:10]

    # Quick event creation
    def quick_meeting(
        self,
        organizer_id: str,
        title: str,
        start_time: datetime,
        duration_minutes: int = 30,
        attendee_ids: Optional[List[str]] = None,
    ) -> Optional[Event]:
        """Quick meeting creation."""
        calendar = self.ensure_user_calendar(organizer_id)
        end_time = start_time + timedelta(minutes=duration_minutes)

        return self.create_event(
            calendar_id=calendar.id,
            title=title,
            organizer_id=organizer_id,
            start_time=start_time,
            end_time=end_time,
            event_type=EventType.MEETING,
            attendee_ids=attendee_ids,
        )

    def schedule_focus_time(
        self,
        user_id: str,
        start_time: datetime,
        duration_minutes: int = 60,
        title: str = "Focus Time",
    ) -> Optional[Event]:
        """Schedule focus time."""
        calendar = self.ensure_user_calendar(user_id)
        end_time = start_time + timedelta(minutes=duration_minutes)

        return self.create_event(
            calendar_id=calendar.id,
            title=title,
            organizer_id=user_id,
            start_time=start_time,
            end_time=end_time,
            event_type=EventType.FOCUS_TIME,
        )

    def schedule_out_of_office(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
        title: str = "Out of Office",
    ) -> Optional[Event]:
        """Schedule out of office."""
        calendar = self.ensure_user_calendar(user_id)

        return self.create_event(
            calendar_id=calendar.id,
            title=title,
            organizer_id=user_id,
            start_time=start_time,
            end_time=end_time,
            event_type=EventType.OUT_OF_OFFICE,
        )

    # Statistics
    def get_stats(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get calendar statistics."""
        return self._registry.get_stats(user_id, workspace_id)


# Global instance management
_calendar_manager: Optional[CalendarManager] = None


def get_calendar_manager() -> CalendarManager:
    """Get the global calendar manager instance."""
    global _calendar_manager
    if _calendar_manager is None:
        _calendar_manager = CalendarManager()
    return _calendar_manager


def set_calendar_manager(manager: CalendarManager) -> None:
    """Set the global calendar manager instance."""
    global _calendar_manager
    _calendar_manager = manager


def reset_calendar_manager() -> None:
    """Reset the global calendar manager instance."""
    global _calendar_manager
    _calendar_manager = None
