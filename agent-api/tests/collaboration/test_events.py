"""
Tests for the Events & Calendar module.
"""

import pytest
from datetime import datetime, timedelta, date

from app.collaboration.events import (
    EventManager,
    EventRegistry,
    Event,
    EventType,
    EventStatus,
    EventVisibility,
    Calendar,
    CalendarType,
    EventAttendee,
    AttendeeRole,
    RSVPStatus,
    RecurrenceRule,
    RecurrenceFrequency,
    EventReminder,
    ReminderType,
    EventLocation,
    EventAttachment,
    WaitingListEntry,
    EventFeedback,
    get_event_manager,
    set_event_manager,
    reset_event_manager,
)


# ============== Enum Tests ==============

class TestEventType:
    """Tests for EventType enum."""

    def test_all_types_exist(self):
        """Test all event types are defined."""
        assert EventType.MEETING.value == "meeting"
        assert EventType.WEBINAR.value == "webinar"
        assert EventType.CONFERENCE.value == "conference"
        assert EventType.WORKSHOP.value == "workshop"
        assert EventType.TRAINING.value == "training"
        assert EventType.INTERVIEW.value == "interview"
        assert EventType.ONE_ON_ONE.value == "one_on_one"
        assert EventType.TEAM_SYNC.value == "team_sync"
        assert EventType.ALL_HANDS.value == "all_hands"


class TestEventStatus:
    """Tests for EventStatus enum."""

    def test_all_statuses_exist(self):
        """Test all event statuses are defined."""
        assert EventStatus.DRAFT.value == "draft"
        assert EventStatus.SCHEDULED.value == "scheduled"
        assert EventStatus.CONFIRMED.value == "confirmed"
        assert EventStatus.TENTATIVE.value == "tentative"
        assert EventStatus.CANCELLED.value == "cancelled"
        assert EventStatus.COMPLETED.value == "completed"


class TestRSVPStatus:
    """Tests for RSVPStatus enum."""

    def test_all_statuses_exist(self):
        """Test all RSVP statuses are defined."""
        assert RSVPStatus.PENDING.value == "pending"
        assert RSVPStatus.ACCEPTED.value == "accepted"
        assert RSVPStatus.DECLINED.value == "declined"
        assert RSVPStatus.TENTATIVE.value == "tentative"


class TestAttendeeRole:
    """Tests for AttendeeRole enum."""

    def test_all_roles_exist(self):
        """Test all attendee roles are defined."""
        assert AttendeeRole.ORGANIZER.value == "organizer"
        assert AttendeeRole.HOST.value == "host"
        assert AttendeeRole.PRESENTER.value == "presenter"
        assert AttendeeRole.REQUIRED.value == "required"
        assert AttendeeRole.OPTIONAL.value == "optional"


class TestRecurrenceFrequency:
    """Tests for RecurrenceFrequency enum."""

    def test_all_frequencies_exist(self):
        """Test all recurrence frequencies are defined."""
        assert RecurrenceFrequency.DAILY.value == "daily"
        assert RecurrenceFrequency.WEEKLY.value == "weekly"
        assert RecurrenceFrequency.BIWEEKLY.value == "biweekly"
        assert RecurrenceFrequency.MONTHLY.value == "monthly"
        assert RecurrenceFrequency.YEARLY.value == "yearly"


# ============== RecurrenceRule Tests ==============

class TestRecurrenceRule:
    """Tests for RecurrenceRule class."""

    def test_create_recurrence_rule(self):
        """Test creating a recurrence rule."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=1
        )
        assert rule.frequency == RecurrenceFrequency.WEEKLY
        assert rule.interval == 1

    def test_daily_occurrences(self):
        """Test daily recurrence occurrences."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.DAILY,
            interval=1,
            count=5
        )
        start = datetime(2024, 1, 1, 10, 0)
        end = datetime(2024, 1, 10)
        event_start = datetime(2024, 1, 1, 10, 0)

        occurrences = rule.get_occurrences(start, end, event_start)
        assert len(occurrences) == 5

    def test_weekly_occurrences(self):
        """Test weekly recurrence occurrences."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=1,
            count=4
        )
        start = datetime(2024, 1, 1)
        end = datetime(2024, 2, 1)
        event_start = datetime(2024, 1, 1, 10, 0)

        occurrences = rule.get_occurrences(start, end, event_start)
        assert len(occurrences) == 4

    def test_recurrence_with_until(self):
        """Test recurrence with end date."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.DAILY,
            interval=1,
            until=datetime(2024, 1, 5)
        )
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 10)
        event_start = datetime(2024, 1, 1, 10, 0)

        occurrences = rule.get_occurrences(start, end, event_start)
        assert len(occurrences) == 5

    def test_recurrence_with_exceptions(self):
        """Test recurrence with excluded dates."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.DAILY,
            interval=1,
            count=5,
            exceptions=[datetime(2024, 1, 3, 10, 0)]
        )
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 10)
        event_start = datetime(2024, 1, 1, 10, 0)

        occurrences = rule.get_occurrences(start, end, event_start)
        assert datetime(2024, 1, 3, 10, 0) not in occurrences


# ============== EventAttendee Tests ==============

class TestEventAttendee:
    """Tests for EventAttendee class."""

    def test_create_attendee(self):
        """Test creating an attendee."""
        attendee = EventAttendee(
            event_id="event-1",
            user_id="user-1",
            email="user@example.com",
            role=AttendeeRole.REQUIRED
        )
        assert attendee.event_id == "event-1"
        assert attendee.rsvp_status == RSVPStatus.PENDING

    def test_accept(self):
        """Test accepting invitation."""
        attendee = EventAttendee(event_id="event-1", user_id="user-1")
        attendee.accept("Looking forward to it!")

        assert attendee.rsvp_status == RSVPStatus.ACCEPTED
        assert attendee.rsvp_at is not None
        assert attendee.rsvp_comment == "Looking forward to it!"

    def test_decline(self):
        """Test declining invitation."""
        attendee = EventAttendee(event_id="event-1", user_id="user-1")
        attendee.decline("Can't make it")

        assert attendee.rsvp_status == RSVPStatus.DECLINED
        assert attendee.rsvp_comment == "Can't make it"

    def test_tentative(self):
        """Test marking as tentative."""
        attendee = EventAttendee(event_id="event-1", user_id="user-1")
        attendee.tentative()

        assert attendee.rsvp_status == RSVPStatus.TENTATIVE

    def test_check_in(self):
        """Test checking in."""
        attendee = EventAttendee(event_id="event-1", user_id="user-1")
        attendee.check_in()

        assert attendee.attended is True
        assert attendee.check_in_time is not None

    def test_check_out(self):
        """Test checking out."""
        attendee = EventAttendee(event_id="event-1", user_id="user-1")
        attendee.check_in()
        attendee.check_out()

        assert attendee.check_out_time is not None


# ============== EventLocation Tests ==============

class TestEventLocation:
    """Tests for EventLocation class."""

    def test_create_physical_location(self):
        """Test creating a physical location."""
        location = EventLocation(
            name="Conference Room A",
            address="123 Main St",
            room="A101",
            capacity=20
        )
        assert location.name == "Conference Room A"
        assert location.is_virtual is False

    def test_create_virtual_location(self):
        """Test creating a virtual location."""
        location = EventLocation(
            name="Zoom Meeting",
            is_virtual=True,
            video_conference_url="https://zoom.us/j/123",
            video_conference_provider="zoom"
        )
        assert location.is_virtual is True
        assert location.video_conference_provider == "zoom"


# ============== Event Tests ==============

class TestEvent:
    """Tests for Event class."""

    def test_create_event(self):
        """Test creating an event."""
        event = Event(
            title="Team Meeting",
            description="Weekly sync",
            start_time=datetime.now() + timedelta(hours=1),
            end_time=datetime.now() + timedelta(hours=2),
            organizer_id="user-1"
        )
        assert event.title == "Team Meeting"
        assert event.status == EventStatus.SCHEDULED

    def test_duration_minutes(self):
        """Test calculating event duration."""
        start = datetime.now()
        end = start + timedelta(hours=1, minutes=30)
        event = Event(title="Test", start_time=start, end_time=end)

        assert event.duration_minutes == 90

    def test_is_past(self):
        """Test checking if event is past."""
        past_event = Event(
            title="Past",
            start_time=datetime.now() - timedelta(days=1),
            end_time=datetime.now() - timedelta(days=1, hours=-1)
        )
        assert past_event.is_past is True

    def test_is_upcoming(self):
        """Test checking if event is upcoming."""
        future_event = Event(
            title="Future",
            start_time=datetime.now() + timedelta(days=1),
            end_time=datetime.now() + timedelta(days=1, hours=1)
        )
        assert future_event.is_upcoming is True

    def test_cancel_event(self):
        """Test cancelling an event."""
        event = Event(title="Test")
        event.cancel("Rescheduled")

        assert event.status == EventStatus.CANCELLED
        assert event.cancelled_at is not None
        assert event.metadata["cancellation_reason"] == "Rescheduled"

    def test_reschedule_event(self):
        """Test rescheduling an event."""
        original_start = datetime.now()
        original_end = original_start + timedelta(hours=1)
        event = Event(title="Test", start_time=original_start, end_time=original_end)

        new_start = datetime.now() + timedelta(days=1)
        new_end = new_start + timedelta(hours=1)
        event.reschedule(new_start, new_end)

        assert event.status == EventStatus.RESCHEDULED
        assert event.start_time == new_start
        assert "original_start" in event.metadata

    def test_complete_event(self):
        """Test completing an event."""
        event = Event(title="Test")
        event.complete()

        assert event.status == EventStatus.COMPLETED

    def test_is_full(self):
        """Test checking if event is full."""
        event = Event(title="Test", max_attendees=10, confirmed_count=10)
        assert event.is_full() is True

        event.max_attendees = None
        assert event.is_full() is False

    def test_can_join(self):
        """Test checking if more can join."""
        event = Event(
            title="Test",
            max_attendees=10,
            confirmed_count=10,
            start_time=datetime.now() + timedelta(hours=1),
            end_time=datetime.now() + timedelta(hours=2)
        )
        assert event.can_join() is False

        event.waiting_list_enabled = True
        assert event.can_join() is True


# ============== Calendar Tests ==============

class TestCalendar:
    """Tests for Calendar class."""

    def test_create_calendar(self):
        """Test creating a calendar."""
        calendar = Calendar(
            name="My Calendar",
            owner_id="user-1",
            organization_id="org-1"
        )
        assert calendar.name == "My Calendar"
        assert calendar.calendar_type == CalendarType.PERSONAL

    def test_share_calendar(self):
        """Test sharing a calendar."""
        calendar = Calendar(name="My Calendar", owner_id="user-1")
        calendar.share_with("user-2", can_edit=True)

        assert "user-2" in calendar.shared_with
        assert "user-2" in calendar.can_edit
        assert calendar.is_shared is True

    def test_unshare_calendar(self):
        """Test unsharing a calendar."""
        calendar = Calendar(name="My Calendar", owner_id="user-1")
        calendar.share_with("user-2")
        calendar.unshare_with("user-2")

        assert "user-2" not in calendar.shared_with
        assert calendar.is_shared is False

    def test_can_user_view(self):
        """Test checking view permissions."""
        calendar = Calendar(name="My Calendar", owner_id="user-1")
        calendar.share_with("user-2")

        assert calendar.can_user_view("user-1") is True
        assert calendar.can_user_view("user-2") is True
        assert calendar.can_user_view("user-3") is False

    def test_can_user_edit(self):
        """Test checking edit permissions."""
        calendar = Calendar(name="My Calendar", owner_id="user-1")
        calendar.share_with("user-2", can_edit=False)
        calendar.share_with("user-3", can_edit=True)

        assert calendar.can_user_edit("user-1") is True
        assert calendar.can_user_edit("user-2") is False
        assert calendar.can_user_edit("user-3") is True


# ============== EventRegistry Tests ==============

class TestEventRegistry:
    """Tests for EventRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return EventRegistry()

    # Event CRUD
    def test_create_event(self, registry):
        """Test creating an event in registry."""
        event = Event(title="Test Event", organizer_id="user-1")
        created = registry.create_event(event)
        assert created.id == event.id

    def test_get_event(self, registry):
        """Test getting an event."""
        event = Event(title="Test Event")
        registry.create_event(event)

        retrieved = registry.get_event(event.id)
        assert retrieved is not None
        assert retrieved.title == "Test Event"

    def test_update_event(self, registry):
        """Test updating an event."""
        event = Event(title="Test Event")
        registry.create_event(event)

        event.title = "Updated Event"
        updated = registry.update_event(event)
        assert updated.title == "Updated Event"

    def test_delete_event(self, registry):
        """Test deleting an event."""
        event = Event(title="Test Event")
        registry.create_event(event)

        assert registry.delete_event(event.id) is True
        assert registry.get_event(event.id) is None

    def test_list_events(self, registry):
        """Test listing events."""
        e1 = Event(title="E1", organization_id="org-1", event_type=EventType.MEETING)
        e2 = Event(title="E2", organization_id="org-1", event_type=EventType.WEBINAR)
        e3 = Event(title="E3", organization_id="org-2", event_type=EventType.MEETING)

        registry.create_event(e1)
        registry.create_event(e2)
        registry.create_event(e3)

        all_events = registry.list_events()
        assert len(all_events) == 3

        org1_events = registry.list_events(organization_id="org-1")
        assert len(org1_events) == 2

        meetings = registry.list_events(event_type=EventType.MEETING)
        assert len(meetings) == 2

    def test_get_events_in_range(self, registry):
        """Test getting events in date range."""
        now = datetime.now()
        e1 = Event(
            title="E1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1"
        )
        e2 = Event(
            title="E2",
            start_time=now + timedelta(days=2),
            end_time=now + timedelta(days=2, hours=1),
            organizer_id="user-1"
        )

        registry.create_event(e1)
        registry.create_event(e2)

        # Add user as attendee
        a1 = EventAttendee(event_id=e1.id, user_id="user-1")
        a2 = EventAttendee(event_id=e2.id, user_id="user-1")
        registry.add_attendee(a1)
        registry.add_attendee(a2)

        events = registry.get_events_in_range(
            start=now,
            end=now + timedelta(days=1),
            user_id="user-1"
        )
        assert len(events) == 1
        assert events[0].title == "E1"

    def test_get_upcoming_events(self, registry):
        """Test getting upcoming events."""
        now = datetime.now()
        e1 = Event(
            title="Future",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1"
        )
        e2 = Event(
            title="Past",
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
            organizer_id="user-1"
        )

        registry.create_event(e1)
        registry.create_event(e2)

        upcoming = registry.get_upcoming_events("user-1")
        assert len(upcoming) == 1
        assert upcoming[0].title == "Future"

    def test_find_conflicts(self, registry):
        """Test finding conflicting events."""
        now = datetime.now()
        e1 = Event(
            title="E1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1"
        )
        registry.create_event(e1)

        conflicts = registry.find_conflicts(
            "user-1",
            now + timedelta(hours=1, minutes=30),
            now + timedelta(hours=2, minutes=30)
        )
        assert len(conflicts) == 1

    # Calendar CRUD
    def test_create_calendar(self, registry):
        """Test creating a calendar."""
        calendar = Calendar(name="My Calendar", owner_id="user-1")
        created = registry.create_calendar(calendar)
        assert created.id == calendar.id

    def test_get_calendar(self, registry):
        """Test getting a calendar."""
        calendar = Calendar(name="My Calendar")
        registry.create_calendar(calendar)

        retrieved = registry.get_calendar(calendar.id)
        assert retrieved is not None

    def test_list_calendars(self, registry):
        """Test listing calendars."""
        c1 = Calendar(name="Personal", owner_id="user-1", calendar_type=CalendarType.PERSONAL)
        c2 = Calendar(name="Team", owner_id="user-1", calendar_type=CalendarType.TEAM)

        registry.create_calendar(c1)
        registry.create_calendar(c2)

        all_calendars = registry.list_calendars(owner_id="user-1")
        assert len(all_calendars) == 2

        personal = registry.list_calendars(calendar_type=CalendarType.PERSONAL)
        assert len(personal) == 1

    def test_get_default_calendar(self, registry):
        """Test getting default calendar."""
        c1 = Calendar(name="Personal", owner_id="user-1", is_default=True)
        c2 = Calendar(name="Other", owner_id="user-1", is_default=False)

        registry.create_calendar(c1)
        registry.create_calendar(c2)

        default = registry.get_default_calendar("user-1")
        assert default is not None
        assert default.name == "Personal"

    # Attendees
    def test_add_attendee(self, registry):
        """Test adding an attendee."""
        event = Event(title="Test")
        registry.create_event(event)

        attendee = EventAttendee(event_id=event.id, user_id="user-1")
        added = registry.add_attendee(attendee)
        assert added is not None

        updated_event = registry.get_event(event.id)
        assert updated_event.attendee_count == 1

    def test_get_attendee_by_user(self, registry):
        """Test getting attendee by user."""
        event = Event(title="Test")
        registry.create_event(event)

        attendee = EventAttendee(event_id=event.id, user_id="user-1")
        registry.add_attendee(attendee)

        found = registry.get_attendee_by_user(event.id, "user-1")
        assert found is not None
        assert found.user_id == "user-1"

    def test_update_attendee_rsvp(self, registry):
        """Test updating attendee RSVP affects counts."""
        event = Event(title="Test")
        registry.create_event(event)

        attendee = EventAttendee(event_id=event.id, user_id="user-1")
        registry.add_attendee(attendee)

        # Create a new attendee object with same ID but accepted status
        # This simulates what happens in real usage where the status changes
        updated_attendee = EventAttendee(
            id=attendee.id,
            event_id=event.id,
            user_id="user-1",
            rsvp_status=RSVPStatus.ACCEPTED
        )
        registry.update_attendee(updated_attendee)

        updated_event = registry.get_event(event.id)
        assert updated_event.confirmed_count == 1

    def test_remove_attendee(self, registry):
        """Test removing an attendee."""
        event = Event(title="Test")
        registry.create_event(event)

        attendee = EventAttendee(event_id=event.id, user_id="user-1")
        registry.add_attendee(attendee)

        assert registry.remove_attendee(attendee.id) is True

        updated_event = registry.get_event(event.id)
        assert updated_event.attendee_count == 0

    def test_get_event_attendees(self, registry):
        """Test getting event attendees."""
        event = Event(title="Test")
        registry.create_event(event)

        a1 = EventAttendee(event_id=event.id, user_id="user-1", role=AttendeeRole.ORGANIZER)
        a2 = EventAttendee(event_id=event.id, user_id="user-2", role=AttendeeRole.REQUIRED)

        registry.add_attendee(a1)
        registry.add_attendee(a2)

        attendees = registry.get_event_attendees(event.id)
        assert len(attendees) == 2
        assert attendees[0].role == AttendeeRole.ORGANIZER  # Sorted by role

    # Reminders
    def test_add_reminder(self, registry):
        """Test adding a reminder."""
        event = Event(title="Test")
        registry.create_event(event)

        reminder = EventReminder(event_id=event.id, minutes_before=15)
        added = registry.add_reminder(reminder)
        assert added is not None

    def test_get_pending_reminders(self, registry):
        """Test getting pending reminders."""
        now = datetime.now()
        event = Event(
            title="Test",
            start_time=now + timedelta(minutes=10),
            end_time=now + timedelta(hours=1)
        )
        registry.create_event(event)

        reminder = EventReminder(event_id=event.id, minutes_before=15)
        registry.add_reminder(reminder)

        pending = registry.get_pending_reminders()
        assert len(pending) == 1

    def test_mark_reminder_sent(self, registry):
        """Test marking reminder as sent."""
        event = Event(title="Test", start_time=datetime.now())
        registry.create_event(event)

        reminder = EventReminder(event_id=event.id, minutes_before=15)
        registry.add_reminder(reminder)

        assert registry.mark_reminder_sent(reminder.id) is True
        assert reminder.is_sent is True

    # Waiting list
    def test_add_to_waiting_list(self, registry):
        """Test adding to waiting list."""
        event = Event(title="Test")
        registry.create_event(event)

        entry = WaitingListEntry(event_id=event.id, user_id="user-1")
        added = registry.add_to_waiting_list(entry)
        assert added.position == 1

    def test_promote_from_waiting_list(self, registry):
        """Test promoting from waiting list."""
        event = Event(title="Test")
        registry.create_event(event)

        entry = WaitingListEntry(event_id=event.id, user_id="user-1")
        registry.add_to_waiting_list(entry)

        promoted = registry.promote_from_waiting_list(event.id)
        assert promoted is not None
        assert promoted.is_promoted is True

    # Feedback
    def test_add_feedback(self, registry):
        """Test adding feedback."""
        event = Event(title="Test")
        registry.create_event(event)

        feedback = EventFeedback(
            event_id=event.id,
            user_id="user-1",
            rating=5,
            comment="Great event!"
        )
        added = registry.add_feedback(feedback)
        assert added is not None

    def test_get_feedback_summary(self, registry):
        """Test getting feedback summary."""
        event = Event(title="Test")
        registry.create_event(event)

        f1 = EventFeedback(event_id=event.id, user_id="user-1", rating=5, would_recommend=True)
        f2 = EventFeedback(event_id=event.id, user_id="user-2", rating=4, would_recommend=True)
        f3 = EventFeedback(event_id=event.id, user_id="user-3", rating=3, would_recommend=False)

        registry.add_feedback(f1)
        registry.add_feedback(f2)
        registry.add_feedback(f3)

        summary = registry.get_feedback_summary(event.id)
        assert summary["count"] == 3
        assert summary["average_rating"] == 4.0
        assert summary["recommend_rate"] == 2/3


# ============== EventManager Tests ==============

class TestEventManager:
    """Tests for EventManager class."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return EventManager()

    def test_create_calendar(self, manager):
        """Test creating a calendar via manager."""
        calendar = manager.create_calendar(
            name="My Calendar",
            owner_id="user-1",
            organization_id="org-1"
        )
        assert calendar.name == "My Calendar"

    def test_get_user_calendars(self, manager):
        """Test getting user calendars."""
        manager.create_calendar("Cal 1", "user-1", "org-1")
        manager.create_calendar("Cal 2", "user-1", "org-1")

        calendars = manager.get_user_calendars("user-1")
        assert len(calendars) == 2

    def test_share_calendar(self, manager):
        """Test sharing calendar via manager."""
        calendar = manager.create_calendar("My Calendar", "user-1", "org-1")
        shared = manager.share_calendar(calendar.id, "user-2", can_edit=True)

        assert "user-2" in shared.shared_with
        assert "user-2" in shared.can_edit

    def test_create_event(self, manager):
        """Test creating an event via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Team Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2", "user-3"]
        )
        assert event.title == "Team Meeting"
        assert event.attendee_count == 3  # Including organizer

    def test_create_event_with_reminders(self, manager):
        """Test creating event with reminders."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            reminders=[15, 30, 60]
        )

        reminders = manager.registry.get_reminders(event.id)
        assert len(reminders) == 3

    def test_update_event(self, manager):
        """Test updating event via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )

        updated = manager.update_event(event.id, title="Updated Meeting")
        assert updated.title == "Updated Meeting"

    def test_cancel_event(self, manager):
        """Test cancelling event via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )

        cancelled = manager.cancel_event(event.id, "Weather")
        assert cancelled.status == EventStatus.CANCELLED

    def test_reschedule_event(self, manager):
        """Test rescheduling event via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )

        new_start = now + timedelta(days=1)
        new_end = new_start + timedelta(hours=1)
        rescheduled = manager.reschedule_event(event.id, new_start, new_end)

        assert rescheduled.status == EventStatus.RESCHEDULED
        assert rescheduled.start_time == new_start

    def test_get_day_events(self, manager):
        """Test getting events for a day."""
        target_date = date.today() + timedelta(days=1)
        start = datetime.combine(target_date, datetime.min.time().replace(hour=10))
        end = start + timedelta(hours=1)

        event = manager.create_event(
            title="Meeting",
            start_time=start,
            end_time=end,
            organizer_id="user-1",
            organization_id="org-1"
        )

        events = manager.get_day_events("user-1", target_date)
        assert len(events) == 1

    def test_rsvp_accept(self, manager):
        """Test accepting RSVP via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2"]
        )

        attendee = manager.rsvp(event.id, "user-2", RSVPStatus.ACCEPTED)
        assert attendee.rsvp_status == RSVPStatus.ACCEPTED

    def test_rsvp_decline(self, manager):
        """Test declining RSVP via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2"]
        )

        attendee = manager.rsvp(event.id, "user-2", RSVPStatus.DECLINED, "Can't make it")
        assert attendee.rsvp_status == RSVPStatus.DECLINED

    def test_invite_attendee(self, manager):
        """Test inviting attendee via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )

        attendee = manager.invite_attendee(event.id, "user-2")
        assert attendee is not None
        assert attendee.user_id == "user-2"

    def test_remove_attendee(self, manager):
        """Test removing attendee via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2"]
        )

        result = manager.remove_attendee(event.id, "user-2")
        assert result is True

    def test_check_in(self, manager):
        """Test checking in via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2"]
        )

        attendee = manager.check_in(event.id, "user-2")
        assert attendee.attended is True

    def test_check_availability(self, manager):
        """Test checking availability via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )

        # Check for conflict
        availability = manager.check_availability(
            "user-1",
            now + timedelta(hours=1, minutes=30),
            now + timedelta(hours=2, minutes=30)
        )
        assert availability["available"] is False
        assert availability["conflict_count"] == 1

        # Check for no conflict
        availability = manager.check_availability(
            "user-1",
            now + timedelta(hours=3),
            now + timedelta(hours=4)
        )
        assert availability["available"] is True

    def test_join_waiting_list(self, manager):
        """Test joining waiting list via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            max_attendees=2,
            waiting_list_enabled=True
        )

        entry = manager.join_waiting_list(event.id, "user-5")
        assert entry is not None
        assert entry.position == 1

    def test_submit_feedback(self, manager):
        """Test submitting feedback via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
            organizer_id="user-1",
            organization_id="org-1"
        )

        feedback = manager.submit_feedback(event.id, "user-1", rating=5, comment="Great!")
        assert feedback.rating == 5

    def test_add_and_get_reminders(self, manager):
        """Test adding reminders via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(minutes=10),
            end_time=now + timedelta(hours=1),
            organizer_id="user-1",
            organization_id="org-1"
        )

        manager.add_reminder(event.id, 15, ReminderType.EMAIL)

        pending = manager.get_pending_reminders()
        assert len(pending) >= 1

    def test_search_events(self, manager):
        """Test searching events via manager."""
        now = datetime.now()
        manager.create_event(
            title="Project Review",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1"
        )
        manager.create_event(
            title="Team Lunch",
            start_time=now + timedelta(hours=3),
            end_time=now + timedelta(hours=4),
            organizer_id="user-1",
            organization_id="org-1"
        )

        results = manager.search_events("project", user_id="user-1")
        assert len(results) == 1
        assert results[0].title == "Project Review"

    def test_get_event_stats(self, manager):
        """Test getting event stats via manager."""
        now = datetime.now()
        event = manager.create_event(
            title="Meeting",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            organizer_id="user-1",
            organization_id="org-1",
            attendee_ids=["user-2", "user-3"]
        )

        manager.rsvp(event.id, "user-2", RSVPStatus.ACCEPTED)
        manager.rsvp(event.id, "user-3", RSVPStatus.DECLINED)

        stats = manager.get_event_stats(event.id)
        assert stats["total_invited"] == 3
        assert stats["rsvp_counts"]["accepted"] == 2  # organizer + user-2
        assert stats["rsvp_counts"]["declined"] == 1


# ============== Global Instance Tests ==============

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_event_manager()

    def teardown_method(self):
        """Reset global instance after each test."""
        reset_event_manager()

    def test_get_event_manager(self):
        """Test getting global manager."""
        manager = get_event_manager()
        assert manager is not None
        assert isinstance(manager, EventManager)

    def test_get_same_instance(self):
        """Test getting same instance."""
        manager1 = get_event_manager()
        manager2 = get_event_manager()
        assert manager1 is manager2

    def test_set_event_manager(self):
        """Test setting global manager."""
        custom_manager = EventManager()
        set_event_manager(custom_manager)

        assert get_event_manager() is custom_manager

    def test_reset_event_manager(self):
        """Test resetting global manager."""
        manager1 = get_event_manager()
        reset_event_manager()
        manager2 = get_event_manager()

        assert manager1 is not manager2
