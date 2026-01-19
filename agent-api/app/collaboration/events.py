"""
Events & Calendar module for enterprise collaboration.

This module provides comprehensive event and calendar management including:
- Events with various types (meeting, webinar, conference, etc.)
- Calendar management with multiple views
- Recurring events with flexible patterns
- RSVP and attendance tracking
- Reminders and notifications
- Room and resource booking integration
- Video conferencing integration
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class EventType(Enum):
    """Types of events."""
    MEETING = "meeting"
    WEBINAR = "webinar"
    CONFERENCE = "conference"
    WORKSHOP = "workshop"
    TRAINING = "training"
    INTERVIEW = "interview"
    ONE_ON_ONE = "one_on_one"
    TEAM_SYNC = "team_sync"
    ALL_HANDS = "all_hands"
    SOCIAL = "social"
    HOLIDAY = "holiday"
    OUT_OF_OFFICE = "out_of_office"
    FOCUS_TIME = "focus_time"
    REMINDER = "reminder"
    TASK = "task"
    OTHER = "other"


class EventStatus(Enum):
    """Status of an event."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    RESCHEDULED = "rescheduled"


class EventVisibility(Enum):
    """Visibility settings for events."""
    PUBLIC = "public"
    PRIVATE = "private"
    CONFIDENTIAL = "confidential"
    INTERNAL = "internal"


class RSVPStatus(Enum):
    """RSVP response status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TENTATIVE = "tentative"
    NO_RESPONSE = "no_response"


class AttendeeRole(Enum):
    """Role of an attendee in an event."""
    ORGANIZER = "organizer"
    HOST = "host"
    PRESENTER = "presenter"
    REQUIRED = "required"
    OPTIONAL = "optional"
    RESOURCE = "resource"


class RecurrenceFrequency(Enum):
    """Frequency of recurring events."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class ReminderType(Enum):
    """Types of reminders."""
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"
    IN_APP = "in_app"
    SLACK = "slack"
    TEAMS = "teams"


class CalendarType(Enum):
    """Types of calendars."""
    PERSONAL = "personal"
    TEAM = "team"
    PROJECT = "project"
    RESOURCE = "resource"
    HOLIDAY = "holiday"
    SHARED = "shared"


@dataclass
class RecurrenceRule:
    """Rule for recurring events."""
    id: str = field(default_factory=lambda: str(uuid4()))
    frequency: RecurrenceFrequency = RecurrenceFrequency.WEEKLY
    interval: int = 1  # Every N frequency units
    days_of_week: list[int] = field(default_factory=list)  # 0=Mon, 6=Sun
    day_of_month: Optional[int] = None
    month_of_year: Optional[int] = None
    week_of_month: Optional[int] = None  # 1-5, -1 for last
    count: Optional[int] = None  # Number of occurrences
    until: Optional[datetime] = None  # End date
    exceptions: list[datetime] = field(default_factory=list)  # Excluded dates
    metadata: dict[str, Any] = field(default_factory=dict)

    def get_occurrences(
        self,
        start: datetime,
        end: datetime,
        event_start: datetime
    ) -> list[datetime]:
        """Get all occurrences within a date range."""
        occurrences = []
        current = event_start
        count = 0
        max_iterations = 1000  # Safety limit

        while current <= end and max_iterations > 0:
            max_iterations -= 1

            if current >= start and current not in self.exceptions:
                occurrences.append(current)
                count += 1

                if self.count and count >= self.count:
                    break

            if self.until and current > self.until:
                break

            # Calculate next occurrence
            if self.frequency == RecurrenceFrequency.DAILY:
                current = current + timedelta(days=self.interval)
            elif self.frequency == RecurrenceFrequency.WEEKLY:
                current = current + timedelta(weeks=self.interval)
            elif self.frequency == RecurrenceFrequency.BIWEEKLY:
                current = current + timedelta(weeks=2 * self.interval)
            elif self.frequency == RecurrenceFrequency.MONTHLY:
                # Add months
                month = current.month + self.interval
                year = current.year + (month - 1) // 12
                month = ((month - 1) % 12) + 1
                day = min(current.day, 28)  # Safe day
                current = current.replace(year=year, month=month, day=day)
            elif self.frequency == RecurrenceFrequency.YEARLY:
                current = current.replace(year=current.year + self.interval)

        return occurrences


@dataclass
class EventReminder:
    """Reminder for an event."""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_id: str = ""
    reminder_type: ReminderType = ReminderType.EMAIL
    minutes_before: int = 15
    is_sent: bool = False
    sent_at: Optional[datetime] = None
    recipient_id: Optional[str] = None  # If None, send to all attendees
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class EventAttendee:
    """Attendee of an event."""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_id: str = ""
    user_id: str = ""
    email: str = ""
    name: str = ""
    role: AttendeeRole = AttendeeRole.REQUIRED
    rsvp_status: RSVPStatus = RSVPStatus.PENDING
    rsvp_at: Optional[datetime] = None
    rsvp_comment: Optional[str] = None
    attended: bool = False
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    is_external: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    def accept(self, comment: str = None) -> None:
        """Accept the event invitation."""
        self.rsvp_status = RSVPStatus.ACCEPTED
        self.rsvp_at = datetime.now()
        self.rsvp_comment = comment

    def decline(self, comment: str = None) -> None:
        """Decline the event invitation."""
        self.rsvp_status = RSVPStatus.DECLINED
        self.rsvp_at = datetime.now()
        self.rsvp_comment = comment

    def tentative(self, comment: str = None) -> None:
        """Mark as tentative."""
        self.rsvp_status = RSVPStatus.TENTATIVE
        self.rsvp_at = datetime.now()
        self.rsvp_comment = comment

    def check_in(self) -> None:
        """Check in to the event."""
        self.attended = True
        self.check_in_time = datetime.now()

    def check_out(self) -> None:
        """Check out from the event."""
        self.check_out_time = datetime.now()


@dataclass
class EventLocation:
    """Location for an event."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    address: str = ""
    room: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    capacity: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "UTC"
    is_virtual: bool = False
    video_conference_url: Optional[str] = None
    video_conference_provider: Optional[str] = None  # zoom, teams, meet, etc.
    dial_in_number: Optional[str] = None
    dial_in_pin: Optional[str] = None
    resource_id: Optional[str] = None  # Link to resource management
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EventAttachment:
    """Attachment for an event."""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_id: str = ""
    filename: str = ""
    file_type: str = ""
    file_size: int = 0
    url: str = ""
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Event:
    """An event in the system."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    event_type: EventType = EventType.MEETING
    status: EventStatus = EventStatus.SCHEDULED
    visibility: EventVisibility = EventVisibility.INTERNAL

    # Timing
    start_time: datetime = field(default_factory=datetime.now)
    end_time: datetime = field(default_factory=datetime.now)
    all_day: bool = False
    timezone: str = "UTC"

    # Ownership
    organizer_id: str = ""
    organization_id: str = ""
    calendar_id: str = ""

    # Location
    location: Optional[EventLocation] = None

    # Recurrence
    is_recurring: bool = False
    recurrence_rule: Optional[RecurrenceRule] = None
    recurring_event_id: Optional[str] = None  # Parent event for instances

    # Attendees and reminders stored separately in registry
    attendee_count: int = 0
    confirmed_count: int = 0

    # Settings
    allow_guests: bool = True
    require_rsvp: bool = False
    max_attendees: Optional[int] = None
    waiting_list_enabled: bool = False
    auto_record: bool = False

    # Rich content
    cover_image_url: Optional[str] = None
    color: Optional[str] = None
    tags: list[str] = field(default_factory=list)

    # External integrations
    external_id: Optional[str] = None
    external_source: Optional[str] = None  # google, outlook, etc.
    sync_enabled: bool = False

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    cancelled_at: Optional[datetime] = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_minutes(self) -> int:
        """Get event duration in minutes."""
        delta = self.end_time - self.start_time
        return int(delta.total_seconds() / 60)

    @property
    def is_past(self) -> bool:
        """Check if event is in the past."""
        return self.end_time < datetime.now()

    @property
    def is_ongoing(self) -> bool:
        """Check if event is currently happening."""
        now = datetime.now()
        return self.start_time <= now <= self.end_time

    @property
    def is_upcoming(self) -> bool:
        """Check if event is in the future."""
        return self.start_time > datetime.now()

    def cancel(self, reason: str = None) -> None:
        """Cancel the event."""
        self.status = EventStatus.CANCELLED
        self.cancelled_at = datetime.now()
        self.updated_at = datetime.now()
        if reason:
            self.metadata["cancellation_reason"] = reason

    def reschedule(self, new_start: datetime, new_end: datetime) -> None:
        """Reschedule the event."""
        self.metadata["original_start"] = self.start_time.isoformat()
        self.metadata["original_end"] = self.end_time.isoformat()
        self.start_time = new_start
        self.end_time = new_end
        self.status = EventStatus.RESCHEDULED
        self.updated_at = datetime.now()

    def complete(self) -> None:
        """Mark event as completed."""
        self.status = EventStatus.COMPLETED
        self.updated_at = datetime.now()

    def is_full(self) -> bool:
        """Check if event has reached max attendees."""
        if self.max_attendees is None:
            return False
        return self.confirmed_count >= self.max_attendees

    def can_join(self) -> bool:
        """Check if more attendees can join."""
        if self.status == EventStatus.CANCELLED:
            return False
        if self.is_past:
            return False
        return not self.is_full() or self.waiting_list_enabled


@dataclass
class Calendar:
    """A calendar in the system."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    calendar_type: CalendarType = CalendarType.PERSONAL
    color: str = "#3B82F6"
    timezone: str = "UTC"

    # Ownership
    owner_id: str = ""
    organization_id: str = ""

    # Settings
    is_default: bool = False
    is_visible: bool = True
    is_shared: bool = False
    shared_with: list[str] = field(default_factory=list)
    can_edit: list[str] = field(default_factory=list)

    # External sync
    external_id: Optional[str] = None
    external_source: Optional[str] = None
    sync_enabled: bool = False
    last_synced_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def share_with(self, user_id: str, can_edit: bool = False) -> None:
        """Share calendar with a user."""
        if user_id not in self.shared_with:
            self.shared_with.append(user_id)
        if can_edit and user_id not in self.can_edit:
            self.can_edit.append(user_id)
        self.is_shared = True
        self.updated_at = datetime.now()

    def unshare_with(self, user_id: str) -> None:
        """Remove sharing with a user."""
        if user_id in self.shared_with:
            self.shared_with.remove(user_id)
        if user_id in self.can_edit:
            self.can_edit.remove(user_id)
        if not self.shared_with:
            self.is_shared = False
        self.updated_at = datetime.now()

    def can_user_view(self, user_id: str) -> bool:
        """Check if user can view the calendar."""
        if self.owner_id == user_id:
            return True
        return user_id in self.shared_with

    def can_user_edit(self, user_id: str) -> bool:
        """Check if user can edit the calendar."""
        if self.owner_id == user_id:
            return True
        return user_id in self.can_edit


@dataclass
class WaitingListEntry:
    """Entry in an event's waiting list."""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_id: str = ""
    user_id: str = ""
    email: str = ""
    name: str = ""
    position: int = 0
    joined_at: datetime = field(default_factory=datetime.now)
    promoted_at: Optional[datetime] = None
    is_promoted: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EventFeedback:
    """Feedback for an event."""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_id: str = ""
    user_id: str = ""
    rating: int = 0  # 1-5
    comment: str = ""
    would_recommend: bool = True
    aspects: dict[str, int] = field(default_factory=dict)  # aspect -> rating
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


class EventRegistry:
    """Registry for managing events and calendars."""

    def __init__(self):
        self._events: dict[str, Event] = {}
        self._calendars: dict[str, Calendar] = {}
        self._attendees: dict[str, EventAttendee] = {}
        self._reminders: dict[str, EventReminder] = {}
        self._waiting_list: dict[str, WaitingListEntry] = {}
        self._feedback: dict[str, EventFeedback] = {}
        self._attachments: dict[str, EventAttachment] = {}

    # Event CRUD
    def create_event(self, event: Event) -> Event:
        """Create a new event."""
        self._events[event.id] = event
        return event

    def get_event(self, event_id: str) -> Optional[Event]:
        """Get an event by ID."""
        return self._events.get(event_id)

    def update_event(self, event: Event) -> Event:
        """Update an existing event."""
        event.updated_at = datetime.now()
        self._events[event.id] = event
        return event

    def delete_event(self, event_id: str) -> bool:
        """Delete an event."""
        if event_id in self._events:
            del self._events[event_id]
            # Clean up related data
            self._attendees = {
                k: v for k, v in self._attendees.items()
                if v.event_id != event_id
            }
            self._reminders = {
                k: v for k, v in self._reminders.items()
                if v.event_id != event_id
            }
            return True
        return False

    def list_events(
        self,
        organization_id: str = None,
        calendar_id: str = None,
        organizer_id: str = None,
        event_type: EventType = None,
        status: EventStatus = None,
        start_after: datetime = None,
        start_before: datetime = None,
        tags: list[str] = None
    ) -> list[Event]:
        """List events with optional filters."""
        results = []

        for event in self._events.values():
            if organization_id and event.organization_id != organization_id:
                continue
            if calendar_id and event.calendar_id != calendar_id:
                continue
            if organizer_id and event.organizer_id != organizer_id:
                continue
            if event_type and event.event_type != event_type:
                continue
            if status and event.status != status:
                continue
            if start_after and event.start_time < start_after:
                continue
            if start_before and event.start_time > start_before:
                continue
            if tags and not any(tag in event.tags for tag in tags):
                continue

            results.append(event)

        return sorted(results, key=lambda x: x.start_time)

    def get_events_in_range(
        self,
        start: datetime,
        end: datetime,
        calendar_ids: list[str] = None,
        user_id: str = None,
        include_recurring: bool = True
    ) -> list[Event]:
        """Get all events within a date range."""
        results = []

        for event in self._events.values():
            if calendar_ids and event.calendar_id not in calendar_ids:
                continue

            # Check if user is attendee or organizer
            if user_id:
                is_organizer = event.organizer_id == user_id
                is_attendee = any(
                    a.user_id == user_id
                    for a in self._attendees.values()
                    if a.event_id == event.id
                )
                if not is_organizer and not is_attendee:
                    continue

            if event.is_recurring and include_recurring and event.recurrence_rule:
                # Get recurring instances
                occurrences = event.recurrence_rule.get_occurrences(
                    start, end, event.start_time
                )
                for occurrence in occurrences:
                    duration = event.end_time - event.start_time
                    instance = Event(
                        id=f"{event.id}_{occurrence.isoformat()}",
                        title=event.title,
                        description=event.description,
                        event_type=event.event_type,
                        status=event.status,
                        visibility=event.visibility,
                        start_time=occurrence,
                        end_time=occurrence + duration,
                        all_day=event.all_day,
                        timezone=event.timezone,
                        organizer_id=event.organizer_id,
                        organization_id=event.organization_id,
                        calendar_id=event.calendar_id,
                        location=event.location,
                        is_recurring=True,
                        recurring_event_id=event.id,
                        color=event.color,
                        tags=event.tags
                    )
                    results.append(instance)
            else:
                # Check if event falls within range
                if event.start_time <= end and event.end_time >= start:
                    results.append(event)

        return sorted(results, key=lambda x: x.start_time)

    def get_upcoming_events(
        self,
        user_id: str,
        limit: int = 10,
        include_tentative: bool = True
    ) -> list[Event]:
        """Get upcoming events for a user."""
        now = datetime.now()
        events = []

        for event in self._events.values():
            if event.start_time < now:
                continue
            if event.status == EventStatus.CANCELLED:
                continue

            # Check if user is organizer or attendee
            is_organizer = event.organizer_id == user_id
            attendee = None
            for a in self._attendees.values():
                if a.event_id == event.id and a.user_id == user_id:
                    attendee = a
                    break

            if not is_organizer and not attendee:
                continue

            if attendee:
                if attendee.rsvp_status == RSVPStatus.DECLINED:
                    continue
                if not include_tentative and attendee.rsvp_status == RSVPStatus.TENTATIVE:
                    continue

            events.append(event)

        return sorted(events, key=lambda x: x.start_time)[:limit]

    def find_conflicts(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
        exclude_event_id: str = None
    ) -> list[Event]:
        """Find conflicting events for a user."""
        conflicts = []

        for event in self._events.values():
            if event.id == exclude_event_id:
                continue
            if event.status == EventStatus.CANCELLED:
                continue

            # Check if user is organizer or accepted attendee
            is_organizer = event.organizer_id == user_id
            is_accepted = any(
                a.user_id == user_id and a.rsvp_status == RSVPStatus.ACCEPTED
                for a in self._attendees.values()
                if a.event_id == event.id
            )

            if not is_organizer and not is_accepted:
                continue

            # Check for overlap
            if event.start_time < end and event.end_time > start:
                conflicts.append(event)

        return conflicts

    # Calendar CRUD
    def create_calendar(self, calendar: Calendar) -> Calendar:
        """Create a new calendar."""
        self._calendars[calendar.id] = calendar
        return calendar

    def get_calendar(self, calendar_id: str) -> Optional[Calendar]:
        """Get a calendar by ID."""
        return self._calendars.get(calendar_id)

    def update_calendar(self, calendar: Calendar) -> Calendar:
        """Update an existing calendar."""
        calendar.updated_at = datetime.now()
        self._calendars[calendar.id] = calendar
        return calendar

    def delete_calendar(self, calendar_id: str) -> bool:
        """Delete a calendar."""
        if calendar_id in self._calendars:
            del self._calendars[calendar_id]
            return True
        return False

    def list_calendars(
        self,
        owner_id: str = None,
        organization_id: str = None,
        calendar_type: CalendarType = None,
        include_shared: bool = True,
        user_id: str = None
    ) -> list[Calendar]:
        """List calendars with optional filters."""
        results = []

        for calendar in self._calendars.values():
            if organization_id and calendar.organization_id != organization_id:
                continue
            if calendar_type and calendar.calendar_type != calendar_type:
                continue

            if owner_id and calendar.owner_id != owner_id:
                if not include_shared or owner_id not in calendar.shared_with:
                    continue

            if user_id:
                if not calendar.can_user_view(user_id):
                    continue

            results.append(calendar)

        return sorted(results, key=lambda x: (not x.is_default, x.name))

    def get_default_calendar(self, user_id: str) -> Optional[Calendar]:
        """Get user's default calendar."""
        for calendar in self._calendars.values():
            if calendar.owner_id == user_id and calendar.is_default:
                return calendar
        return None

    # Attendees
    def add_attendee(self, attendee: EventAttendee) -> EventAttendee:
        """Add an attendee to an event."""
        self._attendees[attendee.id] = attendee

        # Update event count
        event = self.get_event(attendee.event_id)
        if event:
            event.attendee_count += 1
            if attendee.rsvp_status == RSVPStatus.ACCEPTED:
                event.confirmed_count += 1

        return attendee

    def get_attendee(self, attendee_id: str) -> Optional[EventAttendee]:
        """Get an attendee by ID."""
        return self._attendees.get(attendee_id)

    def get_attendee_by_user(self, event_id: str, user_id: str) -> Optional[EventAttendee]:
        """Get attendee by event and user ID."""
        for attendee in self._attendees.values():
            if attendee.event_id == event_id and attendee.user_id == user_id:
                return attendee
        return None

    def update_attendee(self, attendee: EventAttendee) -> EventAttendee:
        """Update an attendee."""
        old_attendee = self._attendees.get(attendee.id)
        self._attendees[attendee.id] = attendee

        # Update confirmed count if RSVP changed
        if old_attendee:
            event = self.get_event(attendee.event_id)
            if event:
                was_accepted = old_attendee.rsvp_status == RSVPStatus.ACCEPTED
                is_accepted = attendee.rsvp_status == RSVPStatus.ACCEPTED

                if was_accepted and not is_accepted:
                    event.confirmed_count = max(0, event.confirmed_count - 1)
                elif not was_accepted and is_accepted:
                    event.confirmed_count += 1

        return attendee

    def remove_attendee(self, attendee_id: str) -> bool:
        """Remove an attendee."""
        attendee = self._attendees.get(attendee_id)
        if not attendee:
            return False

        event = self.get_event(attendee.event_id)
        if event:
            event.attendee_count = max(0, event.attendee_count - 1)
            if attendee.rsvp_status == RSVPStatus.ACCEPTED:
                event.confirmed_count = max(0, event.confirmed_count - 1)

        del self._attendees[attendee_id]
        return True

    def get_event_attendees(
        self,
        event_id: str,
        rsvp_status: RSVPStatus = None,
        role: AttendeeRole = None
    ) -> list[EventAttendee]:
        """Get attendees for an event."""
        results = []
        for attendee in self._attendees.values():
            if attendee.event_id != event_id:
                continue
            if rsvp_status and attendee.rsvp_status != rsvp_status:
                continue
            if role and attendee.role != role:
                continue
            results.append(attendee)

        # Sort by role importance
        role_order = {
            AttendeeRole.ORGANIZER: 0,
            AttendeeRole.HOST: 1,
            AttendeeRole.PRESENTER: 2,
            AttendeeRole.REQUIRED: 3,
            AttendeeRole.OPTIONAL: 4,
            AttendeeRole.RESOURCE: 5
        }
        return sorted(results, key=lambda x: role_order.get(x.role, 5))

    def get_user_events(
        self,
        user_id: str,
        start: datetime = None,
        end: datetime = None,
        rsvp_status: RSVPStatus = None
    ) -> list[Event]:
        """Get events a user is attending."""
        event_ids = set()

        for attendee in self._attendees.values():
            if attendee.user_id != user_id:
                continue
            if rsvp_status and attendee.rsvp_status != rsvp_status:
                continue
            event_ids.add(attendee.event_id)

        # Also include events user organized
        for event in self._events.values():
            if event.organizer_id == user_id:
                event_ids.add(event.id)

        results = []
        for event_id in event_ids:
            event = self.get_event(event_id)
            if not event:
                continue
            if start and event.end_time < start:
                continue
            if end and event.start_time > end:
                continue
            results.append(event)

        return sorted(results, key=lambda x: x.start_time)

    # Reminders
    def add_reminder(self, reminder: EventReminder) -> EventReminder:
        """Add a reminder."""
        self._reminders[reminder.id] = reminder
        return reminder

    def get_reminders(self, event_id: str) -> list[EventReminder]:
        """Get reminders for an event."""
        return [r for r in self._reminders.values() if r.event_id == event_id]

    def get_pending_reminders(self, before: datetime = None) -> list[EventReminder]:
        """Get reminders that need to be sent."""
        check_time = before or datetime.now()
        pending = []

        for reminder in self._reminders.values():
            if reminder.is_sent:
                continue

            event = self.get_event(reminder.event_id)
            if not event:
                continue

            send_at = event.start_time - timedelta(minutes=reminder.minutes_before)
            if send_at <= check_time:
                pending.append(reminder)

        return pending

    def mark_reminder_sent(self, reminder_id: str) -> bool:
        """Mark a reminder as sent."""
        reminder = self._reminders.get(reminder_id)
        if reminder:
            reminder.is_sent = True
            reminder.sent_at = datetime.now()
            return True
        return False

    # Waiting list
    def add_to_waiting_list(self, entry: WaitingListEntry) -> WaitingListEntry:
        """Add to waiting list."""
        # Determine position
        existing = [e for e in self._waiting_list.values() if e.event_id == entry.event_id]
        entry.position = len(existing) + 1

        self._waiting_list[entry.id] = entry
        return entry

    def get_waiting_list(self, event_id: str) -> list[WaitingListEntry]:
        """Get waiting list for an event."""
        entries = [e for e in self._waiting_list.values() if e.event_id == event_id]
        return sorted(entries, key=lambda x: x.position)

    def promote_from_waiting_list(self, event_id: str) -> Optional[WaitingListEntry]:
        """Promote the first person from waiting list."""
        entries = self.get_waiting_list(event_id)
        for entry in entries:
            if not entry.is_promoted:
                entry.is_promoted = True
                entry.promoted_at = datetime.now()
                return entry
        return None

    def remove_from_waiting_list(self, entry_id: str) -> bool:
        """Remove from waiting list."""
        if entry_id in self._waiting_list:
            del self._waiting_list[entry_id]
            return True
        return False

    # Feedback
    def add_feedback(self, feedback: EventFeedback) -> EventFeedback:
        """Add event feedback."""
        self._feedback[feedback.id] = feedback
        return feedback

    def get_feedback(self, event_id: str) -> list[EventFeedback]:
        """Get feedback for an event."""
        return [f for f in self._feedback.values() if f.event_id == event_id]

    def get_feedback_summary(self, event_id: str) -> dict[str, Any]:
        """Get feedback summary for an event."""
        feedbacks = self.get_feedback(event_id)
        if not feedbacks:
            return {"count": 0, "average_rating": 0, "recommend_rate": 0}

        total_rating = sum(f.rating for f in feedbacks)
        recommend_count = sum(1 for f in feedbacks if f.would_recommend)

        return {
            "count": len(feedbacks),
            "average_rating": total_rating / len(feedbacks),
            "recommend_rate": recommend_count / len(feedbacks)
        }


class EventManager:
    """High-level API for managing events and calendars."""

    def __init__(self, registry: EventRegistry = None):
        self.registry = registry or EventRegistry()

    # Calendar operations
    def create_calendar(
        self,
        name: str,
        owner_id: str,
        organization_id: str,
        calendar_type: CalendarType = CalendarType.PERSONAL,
        is_default: bool = False,
        color: str = "#3B82F6",
        **kwargs
    ) -> Calendar:
        """Create a new calendar."""
        calendar = Calendar(
            name=name,
            owner_id=owner_id,
            organization_id=organization_id,
            calendar_type=calendar_type,
            is_default=is_default,
            color=color,
            **kwargs
        )
        return self.registry.create_calendar(calendar)

    def get_user_calendars(
        self,
        user_id: str,
        include_shared: bool = True
    ) -> list[Calendar]:
        """Get all calendars for a user."""
        return self.registry.list_calendars(
            user_id=user_id,
            include_shared=include_shared
        )

    def share_calendar(
        self,
        calendar_id: str,
        user_id: str,
        can_edit: bool = False
    ) -> Optional[Calendar]:
        """Share a calendar with a user."""
        calendar = self.registry.get_calendar(calendar_id)
        if not calendar:
            return None

        calendar.share_with(user_id, can_edit)
        return self.registry.update_calendar(calendar)

    # Event operations
    def create_event(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        organizer_id: str,
        organization_id: str,
        calendar_id: str = None,
        event_type: EventType = EventType.MEETING,
        description: str = "",
        location: EventLocation = None,
        attendee_ids: list[str] = None,
        recurrence: RecurrenceRule = None,
        reminders: list[int] = None,  # Minutes before
        **kwargs
    ) -> Event:
        """Create a new event."""
        # Get or create default calendar
        if not calendar_id:
            default_cal = self.registry.get_default_calendar(organizer_id)
            if default_cal:
                calendar_id = default_cal.id
            else:
                # Create default calendar
                new_cal = self.create_calendar(
                    name="My Calendar",
                    owner_id=organizer_id,
                    organization_id=organization_id,
                    is_default=True
                )
                calendar_id = new_cal.id

        event = Event(
            title=title,
            description=description,
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            organizer_id=organizer_id,
            organization_id=organization_id,
            calendar_id=calendar_id,
            location=location,
            is_recurring=recurrence is not None,
            recurrence_rule=recurrence,
            **kwargs
        )
        created_event = self.registry.create_event(event)

        # Add organizer as attendee
        organizer_attendee = EventAttendee(
            event_id=created_event.id,
            user_id=organizer_id,
            role=AttendeeRole.ORGANIZER,
            rsvp_status=RSVPStatus.ACCEPTED
        )
        self.registry.add_attendee(organizer_attendee)

        # Add other attendees
        if attendee_ids:
            for user_id in attendee_ids:
                if user_id != organizer_id:
                    attendee = EventAttendee(
                        event_id=created_event.id,
                        user_id=user_id,
                        role=AttendeeRole.REQUIRED
                    )
                    self.registry.add_attendee(attendee)

        # Add reminders
        if reminders:
            for minutes in reminders:
                reminder = EventReminder(
                    event_id=created_event.id,
                    minutes_before=minutes
                )
                self.registry.add_reminder(reminder)

        return created_event

    def update_event(
        self,
        event_id: str,
        title: str = None,
        description: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        location: EventLocation = None,
        **kwargs
    ) -> Optional[Event]:
        """Update an event."""
        event = self.registry.get_event(event_id)
        if not event:
            return None

        if title is not None:
            event.title = title
        if description is not None:
            event.description = description
        if start_time is not None:
            event.start_time = start_time
        if end_time is not None:
            event.end_time = end_time
        if location is not None:
            event.location = location

        for key, value in kwargs.items():
            if hasattr(event, key):
                setattr(event, key, value)

        return self.registry.update_event(event)

    def cancel_event(self, event_id: str, reason: str = None) -> Optional[Event]:
        """Cancel an event."""
        event = self.registry.get_event(event_id)
        if not event:
            return None

        event.cancel(reason)
        return self.registry.update_event(event)

    def reschedule_event(
        self,
        event_id: str,
        new_start: datetime,
        new_end: datetime
    ) -> Optional[Event]:
        """Reschedule an event."""
        event = self.registry.get_event(event_id)
        if not event:
            return None

        event.reschedule(new_start, new_end)
        return self.registry.update_event(event)

    def get_calendar_view(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
        calendar_ids: list[str] = None
    ) -> list[Event]:
        """Get events for calendar view."""
        return self.registry.get_events_in_range(
            start=start,
            end=end,
            calendar_ids=calendar_ids,
            user_id=user_id,
            include_recurring=True
        )

    def get_day_events(self, user_id: str, date: date) -> list[Event]:
        """Get events for a specific day."""
        start = datetime.combine(date, datetime.min.time())
        end = datetime.combine(date, datetime.max.time())
        return self.get_calendar_view(user_id, start, end)

    def get_week_events(self, user_id: str, week_start: date) -> list[Event]:
        """Get events for a week."""
        start = datetime.combine(week_start, datetime.min.time())
        end = start + timedelta(days=7)
        return self.get_calendar_view(user_id, start, end)

    def get_month_events(self, user_id: str, year: int, month: int) -> list[Event]:
        """Get events for a month."""
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
        return self.get_calendar_view(user_id, start, end)

    # RSVP operations
    def rsvp(
        self,
        event_id: str,
        user_id: str,
        response: RSVPStatus,
        comment: str = None
    ) -> Optional[EventAttendee]:
        """Respond to an event invitation."""
        attendee = self.registry.get_attendee_by_user(event_id, user_id)
        if not attendee:
            return None

        if response == RSVPStatus.ACCEPTED:
            attendee.accept(comment)
        elif response == RSVPStatus.DECLINED:
            attendee.decline(comment)
        elif response == RSVPStatus.TENTATIVE:
            attendee.tentative(comment)

        return self.registry.update_attendee(attendee)

    def invite_attendee(
        self,
        event_id: str,
        user_id: str,
        email: str = "",
        name: str = "",
        role: AttendeeRole = AttendeeRole.REQUIRED,
        is_external: bool = False
    ) -> Optional[EventAttendee]:
        """Invite an attendee to an event."""
        event = self.registry.get_event(event_id)
        if not event:
            return None

        # Check if already invited
        existing = self.registry.get_attendee_by_user(event_id, user_id)
        if existing:
            return existing

        attendee = EventAttendee(
            event_id=event_id,
            user_id=user_id,
            email=email,
            name=name,
            role=role,
            is_external=is_external
        )
        return self.registry.add_attendee(attendee)

    def remove_attendee(self, event_id: str, user_id: str) -> bool:
        """Remove an attendee from an event."""
        attendee = self.registry.get_attendee_by_user(event_id, user_id)
        if not attendee:
            return False
        return self.registry.remove_attendee(attendee.id)

    def check_in(self, event_id: str, user_id: str) -> Optional[EventAttendee]:
        """Check in an attendee."""
        attendee = self.registry.get_attendee_by_user(event_id, user_id)
        if not attendee:
            return None

        attendee.check_in()
        return self.registry.update_attendee(attendee)

    # Availability
    def check_availability(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
        exclude_event_id: str = None
    ) -> dict[str, Any]:
        """Check user's availability."""
        conflicts = self.registry.find_conflicts(user_id, start, end, exclude_event_id)

        return {
            "available": len(conflicts) == 0,
            "conflicts": conflicts,
            "conflict_count": len(conflicts)
        }

    def find_free_slots(
        self,
        user_ids: list[str],
        date: date,
        duration_minutes: int,
        start_hour: int = 9,
        end_hour: int = 17
    ) -> list[tuple[datetime, datetime]]:
        """Find free time slots for multiple users."""
        day_start = datetime.combine(date, datetime.min.time().replace(hour=start_hour))
        day_end = datetime.combine(date, datetime.min.time().replace(hour=end_hour))

        # Get all events for all users
        all_busy = []
        for user_id in user_ids:
            events = self.registry.get_user_events(
                user_id,
                start=day_start,
                end=day_end,
                rsvp_status=RSVPStatus.ACCEPTED
            )
            for event in events:
                all_busy.append((event.start_time, event.end_time))

        # Sort busy periods
        all_busy.sort(key=lambda x: x[0])

        # Find free slots
        free_slots = []
        current = day_start

        for busy_start, busy_end in all_busy:
            if current + timedelta(minutes=duration_minutes) <= busy_start:
                free_slots.append((current, busy_start))
            current = max(current, busy_end)

        if current + timedelta(minutes=duration_minutes) <= day_end:
            free_slots.append((current, day_end))

        return free_slots

    # Waiting list
    def join_waiting_list(
        self,
        event_id: str,
        user_id: str,
        email: str = "",
        name: str = ""
    ) -> Optional[WaitingListEntry]:
        """Join an event's waiting list."""
        event = self.registry.get_event(event_id)
        if not event or not event.waiting_list_enabled:
            return None

        entry = WaitingListEntry(
            event_id=event_id,
            user_id=user_id,
            email=email,
            name=name
        )
        return self.registry.add_to_waiting_list(entry)

    # Feedback
    def submit_feedback(
        self,
        event_id: str,
        user_id: str,
        rating: int,
        comment: str = "",
        would_recommend: bool = True,
        aspects: dict[str, int] = None
    ) -> EventFeedback:
        """Submit feedback for an event."""
        feedback = EventFeedback(
            event_id=event_id,
            user_id=user_id,
            rating=rating,
            comment=comment,
            would_recommend=would_recommend,
            aspects=aspects or {}
        )
        return self.registry.add_feedback(feedback)

    # Reminders
    def add_reminder(
        self,
        event_id: str,
        minutes_before: int,
        reminder_type: ReminderType = ReminderType.EMAIL,
        recipient_id: str = None
    ) -> EventReminder:
        """Add a reminder to an event."""
        reminder = EventReminder(
            event_id=event_id,
            minutes_before=minutes_before,
            reminder_type=reminder_type,
            recipient_id=recipient_id
        )
        return self.registry.add_reminder(reminder)

    def get_pending_reminders(self) -> list[EventReminder]:
        """Get reminders that need to be sent."""
        return self.registry.get_pending_reminders()

    def send_reminder(self, reminder_id: str) -> bool:
        """Mark a reminder as sent."""
        return self.registry.mark_reminder_sent(reminder_id)

    # Search
    def search_events(
        self,
        query: str,
        user_id: str = None,
        organization_id: str = None,
        start_after: datetime = None
    ) -> list[Event]:
        """Search events by title or description."""
        query_lower = query.lower()
        results = []

        for event in self.registry.list_events(
            organization_id=organization_id,
            start_after=start_after
        ):
            if query_lower in event.title.lower() or query_lower in event.description.lower():
                if user_id:
                    # Check if user has access
                    is_organizer = event.organizer_id == user_id
                    is_attendee = self.registry.get_attendee_by_user(event.id, user_id) is not None
                    if not is_organizer and not is_attendee:
                        continue
                results.append(event)

        return results

    # Statistics
    def get_event_stats(self, event_id: str) -> dict[str, Any]:
        """Get statistics for an event."""
        event = self.registry.get_event(event_id)
        if not event:
            return {}

        attendees = self.registry.get_event_attendees(event_id)
        rsvp_counts = {
            "accepted": 0,
            "declined": 0,
            "tentative": 0,
            "pending": 0
        }

        attended = 0
        for attendee in attendees:
            status_key = attendee.rsvp_status.value
            if status_key in rsvp_counts:
                rsvp_counts[status_key] += 1
            if attendee.attended:
                attended += 1

        feedback_summary = self.registry.get_feedback_summary(event_id)

        return {
            "total_invited": len(attendees),
            "rsvp_counts": rsvp_counts,
            "attendance_count": attended,
            "attendance_rate": attended / len(attendees) if attendees else 0,
            "feedback": feedback_summary
        }


# Global instance management
_event_manager: Optional[EventManager] = None


def get_event_manager() -> EventManager:
    """Get the global event manager instance."""
    global _event_manager
    if _event_manager is None:
        _event_manager = EventManager()
    return _event_manager


def set_event_manager(manager: EventManager) -> None:
    """Set the global event manager instance."""
    global _event_manager
    _event_manager = manager


def reset_event_manager() -> None:
    """Reset the global event manager instance."""
    global _event_manager
    _event_manager = None
