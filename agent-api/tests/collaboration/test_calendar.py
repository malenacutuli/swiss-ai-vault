"""
Tests for the Calendar & Scheduling module.
"""

import pytest
from datetime import datetime, timedelta, date, time

from app.collaboration.calendar import (
    CalendarManager,
    CalendarRegistry,
    Calendar,
    CalendarType,
    CalendarVisibility,
    CalendarPermission,
    CalendarShare,
    Event,
    EventStatus,
    EventVisibility,
    EventType,
    EventAttendee,
    EventReminder,
    EventAttachment,
    AttendeeStatus,
    AttendeeRole,
    RecurrenceRule,
    RecurrenceFrequency,
    RecurrenceEndType,
    ReminderType,
    FreeBusySlot,
    FreeBusyStatus,
    MeetingRoom,
    SchedulingSuggestion,
    get_calendar_manager,
    set_calendar_manager,
    reset_calendar_manager,
)


class TestRecurrenceRule:
    """Tests for RecurrenceRule."""

    def test_create_recurrence_rule(self):
        """Test creating a recurrence rule."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=1,
        )

        assert rule.frequency == RecurrenceFrequency.WEEKLY
        assert rule.interval == 1
        assert rule.end_type == RecurrenceEndType.NEVER

    def test_daily_occurrences(self):
        """Test daily recurrence occurrences."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.DAILY,
            interval=1,
            end_type=RecurrenceEndType.AFTER_COUNT,
            count=5,
        )

        start = datetime(2024, 1, 1, 10, 0)
        range_start = datetime(2024, 1, 1)
        range_end = datetime(2024, 1, 31)

        occurrences = rule.get_occurrences(start, range_start, range_end)
        assert len(occurrences) == 5

    def test_weekly_occurrences(self):
        """Test weekly recurrence occurrences."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=1,
        )

        start = datetime(2024, 1, 1, 10, 0)
        range_start = datetime(2024, 1, 1)
        range_end = datetime(2024, 1, 31)

        occurrences = rule.get_occurrences(start, range_start, range_end, max_count=10)
        assert len(occurrences) >= 4

    def test_recurrence_with_exceptions(self):
        """Test recurrence with exceptions."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.DAILY,
            interval=1,
            exceptions={date(2024, 1, 3), date(2024, 1, 5)},
        )

        start = datetime(2024, 1, 1, 10, 0)
        range_start = datetime(2024, 1, 1)
        range_end = datetime(2024, 1, 7)

        occurrences = rule.get_occurrences(start, range_start, range_end)
        dates = [o.date() for o in occurrences]

        assert date(2024, 1, 3) not in dates
        assert date(2024, 1, 5) not in dates

    def test_recurrence_to_dict(self):
        """Test recurrence rule to_dict."""
        rule = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=2,
        )

        data = rule.to_dict()
        assert data["frequency"] == "weekly"
        assert data["interval"] == 2


class TestEventReminder:
    """Tests for EventReminder."""

    def test_create_reminder(self):
        """Test creating a reminder."""
        reminder = EventReminder(
            id="rem1",
            event_id="event1",
            reminder_type=ReminderType.EMAIL,
            minutes_before=30,
        )

        assert reminder.id == "rem1"
        assert reminder.minutes_before == 30
        assert not reminder.is_sent

    def test_should_trigger(self):
        """Test reminder trigger check."""
        reminder = EventReminder(
            id="rem1",
            event_id="event1",
            reminder_type=ReminderType.IN_APP,
            minutes_before=15,
        )

        # Event starting now
        event_start = datetime.utcnow()
        assert reminder.should_trigger(event_start)

        # Event starting in 1 hour
        event_start = datetime.utcnow() + timedelta(hours=1)
        assert not reminder.should_trigger(event_start)

    def test_mark_sent(self):
        """Test marking reminder as sent."""
        reminder = EventReminder(
            id="rem1",
            event_id="event1",
            reminder_type=ReminderType.PUSH,
            minutes_before=10,
        )

        reminder.mark_sent()
        assert reminder.is_sent
        assert reminder.sent_at is not None


class TestEventAttendee:
    """Tests for EventAttendee."""

    def test_create_attendee(self):
        """Test creating an attendee."""
        attendee = EventAttendee(
            id="att1",
            event_id="event1",
            user_id="user1",
            email="user@example.com",
            name="Test User",
            role=AttendeeRole.REQUIRED,
        )

        assert attendee.id == "att1"
        assert attendee.status == AttendeeStatus.PENDING
        assert attendee.role == AttendeeRole.REQUIRED

    def test_respond(self):
        """Test responding to an event."""
        attendee = EventAttendee(
            id="att1",
            event_id="event1",
            user_id="user1",
        )

        attendee.respond(AttendeeStatus.ACCEPTED, "Looking forward to it!")
        assert attendee.status == AttendeeStatus.ACCEPTED
        assert attendee.comment == "Looking forward to it!"
        assert attendee.responded_at is not None


class TestEvent:
    """Tests for Event."""

    def test_create_event(self):
        """Test creating an event."""
        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        event = Event(
            id="event1",
            calendar_id="cal1",
            title="Team Meeting",
            organizer_id="user1",
            start_time=start,
            end_time=end,
        )

        assert event.id == "event1"
        assert event.title == "Team Meeting"
        assert event.status == EventStatus.CONFIRMED
        assert event.duration_minutes == 60

    def test_event_duration(self):
        """Test event duration calculations."""
        start = datetime(2024, 1, 1, 10, 0)
        end = datetime(2024, 1, 1, 11, 30)

        event = Event(
            id="event1",
            calendar_id="cal1",
            title="Test",
            organizer_id="user1",
            start_time=start,
            end_time=end,
        )

        assert event.duration_minutes == 90
        assert event.duration_hours == 1.5

    def test_event_time_properties(self):
        """Test event time properties."""
        # Past event
        past_event = Event(
            id="past",
            calendar_id="cal1",
            title="Past Event",
            organizer_id="user1",
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1),
        )
        assert past_event.is_past
        assert not past_event.is_ongoing
        assert not past_event.is_future

        # Future event
        future_event = Event(
            id="future",
            calendar_id="cal1",
            title="Future Event",
            organizer_id="user1",
            start_time=datetime.utcnow() + timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(hours=2),
        )
        assert not future_event.is_past
        assert not future_event.is_ongoing
        assert future_event.is_future

    def test_update_event(self):
        """Test updating an event."""
        event = Event(
            id="event1",
            calendar_id="cal1",
            title="Original",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        event.update(title="Updated Title", location="Room 101")
        assert event.title == "Updated Title"
        assert event.location == "Room 101"
        assert event.updated_at is not None

    def test_cancel_event(self):
        """Test canceling an event."""
        event = Event(
            id="event1",
            calendar_id="cal1",
            title="Test",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        event.cancel()
        assert event.status == EventStatus.CANCELLED

    def test_event_to_dict(self):
        """Test event to_dict."""
        event = Event(
            id="event1",
            calendar_id="cal1",
            title="Test",
            organizer_id="user1",
            start_time=datetime(2024, 1, 1, 10, 0),
            end_time=datetime(2024, 1, 1, 11, 0),
            tags={"meeting", "team"},
        )

        data = event.to_dict()
        assert data["id"] == "event1"
        assert data["title"] == "Test"
        assert data["duration_minutes"] == 60


class TestCalendar:
    """Tests for Calendar."""

    def test_create_calendar(self):
        """Test creating a calendar."""
        calendar = Calendar(
            id="cal1",
            name="My Calendar",
            owner_id="user1",
        )

        assert calendar.id == "cal1"
        assert calendar.name == "My Calendar"
        assert calendar.calendar_type == CalendarType.PERSONAL
        assert calendar.is_active

    def test_update_calendar(self):
        """Test updating a calendar."""
        calendar = Calendar(
            id="cal1",
            name="Old Name",
            owner_id="user1",
        )

        calendar.update(name="New Name", color="#ff0000")
        assert calendar.name == "New Name"
        assert calendar.color == "#ff0000"
        assert calendar.updated_at is not None

    def test_deactivate_calendar(self):
        """Test deactivating a calendar."""
        calendar = Calendar(
            id="cal1",
            name="Test",
            owner_id="user1",
        )

        calendar.deactivate()
        assert not calendar.is_active

        calendar.activate()
        assert calendar.is_active


class TestMeetingRoom:
    """Tests for MeetingRoom."""

    def test_create_room(self):
        """Test creating a meeting room."""
        room = MeetingRoom(
            id="room1",
            name="Conference Room A",
            capacity=10,
            location="Building 1, Floor 2",
            amenities={"projector", "whiteboard", "video_conf"},
        )

        assert room.id == "room1"
        assert room.capacity == 10
        assert "projector" in room.amenities


class TestCalendarRegistry:
    """Tests for CalendarRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry."""
        return CalendarRegistry()

    def test_create_calendar(self, registry):
        """Test creating a calendar."""
        calendar = registry.create_calendar(
            name="My Calendar",
            owner_id="user1",
        )

        assert calendar.id is not None
        assert calendar.name == "My Calendar"
        assert calendar.owner_id == "user1"

    def test_get_calendar(self, registry):
        """Test getting a calendar."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        retrieved = registry.get_calendar(calendar.id)
        assert retrieved is not None
        assert retrieved.id == calendar.id

    def test_update_calendar(self, registry):
        """Test updating a calendar."""
        calendar = registry.create_calendar(name="Old Name", owner_id="user1")

        updated = registry.update_calendar(calendar.id, name="New Name")
        assert updated.name == "New Name"

    def test_delete_calendar(self, registry):
        """Test deleting a calendar."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        result = registry.delete_calendar(calendar.id)
        assert result

        retrieved = registry.get_calendar(calendar.id)
        assert retrieved is None

    def test_list_calendars(self, registry):
        """Test listing calendars."""
        registry.create_calendar(name="Cal 1", owner_id="user1")
        registry.create_calendar(name="Cal 2", owner_id="user1")
        registry.create_calendar(name="Cal 3", owner_id="user2")

        all_cals = registry.list_calendars()
        assert len(all_cals) == 3

        user1_cals = registry.list_calendars(owner_id="user1", include_shared=False)
        assert len(user1_cals) == 2

    def test_get_user_default_calendar(self, registry):
        """Test getting user's default calendar."""
        registry.create_calendar(name="Regular", owner_id="user1")
        default = registry.create_calendar(
            name="Default", owner_id="user1", is_default=True
        )

        retrieved = registry.get_user_default_calendar("user1")
        assert retrieved is not None
        assert retrieved.id == default.id

    def test_create_event(self, registry):
        """Test creating an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        event = registry.create_event(
            calendar_id=calendar.id,
            title="Team Meeting",
            organizer_id="user1",
            start_time=start,
            end_time=end,
        )

        assert event is not None
        assert event.title == "Team Meeting"

    def test_create_event_invalid_calendar(self, registry):
        """Test creating event with invalid calendar."""
        event = registry.create_event(
            calendar_id="nonexistent",
            title="Test",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        assert event is None

    def test_get_event(self, registry):
        """Test getting an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Test",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        retrieved = registry.get_event(event.id)
        assert retrieved is not None
        assert retrieved.id == event.id

    def test_update_event(self, registry):
        """Test updating an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Original",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        updated = registry.update_event(event.id, title="Updated")
        assert updated.title == "Updated"

    def test_delete_event(self, registry):
        """Test deleting an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Test",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        result = registry.delete_event(event.id)
        assert result

        retrieved = registry.get_event(event.id)
        assert retrieved is None

    def test_cancel_event(self, registry):
        """Test canceling an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Test",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        cancelled = registry.cancel_event(event.id)
        assert cancelled.status == EventStatus.CANCELLED

    def test_list_events(self, registry):
        """Test listing events."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        now = datetime.utcnow()
        registry.create_event(
            calendar_id=calendar.id,
            title="Event 1",
            organizer_id="user1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
        )
        registry.create_event(
            calendar_id=calendar.id,
            title="Event 2",
            organizer_id="user1",
            start_time=now + timedelta(hours=3),
            end_time=now + timedelta(hours=4),
        )

        events = registry.list_events(calendar_id=calendar.id)
        assert len(events) == 2

    def test_list_events_date_range(self, registry):
        """Test listing events with date range."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        registry.create_event(
            calendar_id=calendar.id,
            title="Today",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )
        registry.create_event(
            calendar_id=calendar.id,
            title="Next Week",
            organizer_id="user1",
            start_time=datetime.utcnow() + timedelta(days=7),
            end_time=datetime.utcnow() + timedelta(days=7, hours=1),
        )

        # Get only today's events
        events = registry.list_events(
            calendar_id=calendar.id,
            start_date=datetime.utcnow() - timedelta(hours=1),
            end_date=datetime.utcnow() + timedelta(hours=2),
        )
        assert len(events) == 1
        assert events[0].title == "Today"

    def test_get_events_for_day(self, registry):
        """Test getting events for a specific day."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        today = date.today()
        registry.create_event(
            calendar_id=calendar.id,
            title="Today's Event",
            organizer_id="user1",
            start_time=datetime.combine(today, time(10, 0)),
            end_time=datetime.combine(today, time(11, 0)),
        )

        events = registry.get_events_for_day([calendar.id], today)
        assert len(events) == 1

    def test_get_upcoming_events(self, registry):
        """Test getting upcoming events."""
        calendar = registry.create_calendar(
            name="Test", owner_id="user1", is_default=True
        )

        now = datetime.utcnow()
        registry.create_event(
            calendar_id=calendar.id,
            title="Upcoming 1",
            organizer_id="user1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
        )
        registry.create_event(
            calendar_id=calendar.id,
            title="Upcoming 2",
            organizer_id="user1",
            start_time=now + timedelta(hours=3),
            end_time=now + timedelta(hours=4),
        )

        upcoming = registry.get_upcoming_events("user1", limit=5)
        assert len(upcoming) == 2

    def test_add_attendee(self, registry):
        """Test adding an attendee."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        attendee = registry.add_attendee(
            event.id, "user2", "user2@example.com", "User Two"
        )

        assert attendee is not None
        assert attendee.user_id == "user2"

    def test_remove_attendee(self, registry):
        """Test removing an attendee."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        registry.add_attendee(event.id, "user2")

        result = registry.remove_attendee(event.id, "user2")
        assert result

    def test_get_attendees(self, registry):
        """Test getting attendees."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        registry.add_attendee(event.id, "user2")
        registry.add_attendee(event.id, "user3")

        attendees = registry.get_attendees(event.id)
        assert len(attendees) == 3  # Including organizer

    def test_respond_to_event(self, registry):
        """Test responding to an event."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        registry.add_attendee(event.id, "user2")

        response = registry.respond_to_event(event.id, "user2", AttendeeStatus.ACCEPTED)
        assert response is not None
        assert response.status == AttendeeStatus.ACCEPTED

    def test_get_user_events(self, registry):
        """Test getting user's events as attendee."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        registry.add_attendee(event.id, "user2")

        events = registry.get_user_events("user2")
        assert len(events) == 1

    def test_add_reminder(self, registry):
        """Test adding a reminder."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow() + timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(hours=2),
        )

        reminder = registry.add_reminder(event.id, ReminderType.EMAIL, 30)
        assert reminder is not None
        assert reminder.minutes_before == 30

    def test_get_reminders(self, registry):
        """Test getting reminders."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        registry.add_reminder(event.id, ReminderType.EMAIL, 30)
        registry.add_reminder(event.id, ReminderType.PUSH, 15)

        reminders = registry.get_reminders(event.id)
        assert len(reminders) == 2

    def test_add_attachment(self, registry):
        """Test adding an attachment."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        event = registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        attachment = registry.add_attachment(
            event.id, "agenda.pdf", "/uploads/agenda.pdf", "user1"
        )

        assert attachment is not None
        assert attachment.filename == "agenda.pdf"

    def test_share_calendar(self, registry):
        """Test sharing a calendar."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        share = registry.share_calendar(
            calendar.id, "user2", "user", CalendarPermission.READ, "user1"
        )

        assert share is not None
        assert share.permission == CalendarPermission.READ

    def test_unshare_calendar(self, registry):
        """Test unsharing a calendar."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        registry.share_calendar(
            calendar.id, "user2", "user", CalendarPermission.READ, "user1"
        )

        result = registry.unshare_calendar(calendar.id, "user2")
        assert result

    def test_get_shared_calendars(self, registry):
        """Test getting shared calendars."""
        cal1 = registry.create_calendar(name="Cal 1", owner_id="user1")
        cal2 = registry.create_calendar(name="Cal 2", owner_id="user1")

        registry.share_calendar(cal1.id, "user2", "user", CalendarPermission.READ, "user1")
        registry.share_calendar(cal2.id, "user2", "user", CalendarPermission.WRITE, "user1")

        shared = registry.get_shared_calendars("user2")
        assert len(shared) == 2

    def test_get_calendar_permission(self, registry):
        """Test getting calendar permission."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")
        registry.share_calendar(
            calendar.id, "user2", "user", CalendarPermission.READ, "user1"
        )

        # Owner has admin
        assert registry.get_calendar_permission(calendar.id, "user1") == CalendarPermission.ADMIN

        # Shared user has read
        assert registry.get_calendar_permission(calendar.id, "user2") == CalendarPermission.READ

        # Unshared user has none
        assert registry.get_calendar_permission(calendar.id, "user3") == CalendarPermission.NONE

    def test_create_room(self, registry):
        """Test creating a meeting room."""
        room = registry.create_room(
            name="Conference A",
            capacity=10,
            location="Building 1",
            amenities={"projector", "whiteboard"},
        )

        assert room.id is not None
        assert room.name == "Conference A"
        assert room.calendar_id is not None

    def test_list_rooms(self, registry):
        """Test listing rooms."""
        registry.create_room(name="Room A", capacity=10)
        registry.create_room(name="Room B", capacity=20)
        registry.create_room(name="Room C", capacity=5)

        all_rooms = registry.list_rooms()
        assert len(all_rooms) == 3

        large_rooms = registry.list_rooms(min_capacity=15)
        assert len(large_rooms) == 1

    def test_get_available_rooms(self, registry):
        """Test getting available rooms."""
        room1 = registry.create_room(name="Room A", capacity=10)
        room2 = registry.create_room(name="Room B", capacity=10)

        # Book room1
        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)
        registry.book_room(room1.id, "Meeting", "user1", start, end)

        # Check availability
        available = registry.get_available_rooms(start, end)
        assert len(available) == 1
        assert available[0].id == room2.id

    def test_book_room(self, registry):
        """Test booking a room."""
        room = registry.create_room(name="Conference A", capacity=10)

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        event = registry.book_room(room.id, "Team Meeting", "user1", start, end)
        assert event is not None
        assert "Conference A" in event.location

    def test_get_free_busy(self, registry):
        """Test getting free/busy slots."""
        calendar = registry.create_calendar(
            name="Test", owner_id="user1", is_default=True
        )

        now = datetime.utcnow()
        registry.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
        )

        # Add user as attendee and accept
        event = registry.list_events(calendar_id=calendar.id)[0]
        registry.respond_to_event(event.id, "user1", AttendeeStatus.ACCEPTED)

        slots = registry.get_free_busy(
            "user1",
            now,
            now + timedelta(hours=3),
        )

        assert len(slots) >= 1

    def test_find_free_slots(self, registry):
        """Test finding free time slots."""
        # Create calendars and events
        cal1 = registry.create_calendar(
            name="User 1 Cal", owner_id="user1", is_default=True
        )
        cal2 = registry.create_calendar(
            name="User 2 Cal", owner_id="user2", is_default=True
        )

        now = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0)

        # Find free slots
        free_slots = registry.find_free_slots(
            ["user1", "user2"],
            now,
            now + timedelta(days=1),
            30,
        )

        assert len(free_slots) > 0

    def test_get_stats(self, registry):
        """Test getting statistics."""
        calendar = registry.create_calendar(name="Test", owner_id="user1")

        now = datetime.utcnow()
        registry.create_event(
            calendar_id=calendar.id,
            title="Event 1",
            organizer_id="user1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
        )
        registry.create_event(
            calendar_id=calendar.id,
            title="Event 2",
            organizer_id="user1",
            start_time=now + timedelta(hours=3),
            end_time=now + timedelta(hours=4),
        )

        stats = registry.get_stats(user_id="user1")
        assert stats["total_calendars"] == 1
        assert stats["total_events"] == 2


class TestCalendarManager:
    """Tests for CalendarManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager."""
        return CalendarManager()

    def test_create_calendar(self, manager):
        """Test creating a calendar."""
        calendar = manager.create_calendar(
            name="My Calendar",
            owner_id="user1",
        )

        assert calendar.id is not None
        assert calendar.name == "My Calendar"

    def test_ensure_user_calendar(self, manager):
        """Test ensuring user has a calendar."""
        calendar = manager.ensure_user_calendar("user1", "Test User")

        assert calendar is not None
        assert calendar.is_default

        # Should return same calendar
        same = manager.ensure_user_calendar("user1")
        assert same.id == calendar.id

    def test_create_event(self, manager):
        """Test creating an event."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        event = manager.create_event(
            calendar_id=calendar.id,
            title="Team Meeting",
            organizer_id="user1",
            start_time=start,
            end_time=end,
            attendee_ids=["user2", "user3"],
        )

        assert event is not None
        assert event.title == "Team Meeting"

        # Check attendees
        attendees = manager.get_attendees(event.id)
        assert len(attendees) == 3

    def test_create_event_with_reminders(self, manager):
        """Test creating event with custom reminders."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")

        event = manager.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow() + timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(hours=2),
            reminders=[30, 15, 5],
        )

        reminders = manager.get_reminders(event.id)
        assert len(reminders) == 3

    def test_accept_event(self, manager):
        """Test accepting an event."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")
        event = manager.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
            attendee_ids=["user2"],
        )

        response = manager.accept_event(event.id, "user2")
        assert response.status == AttendeeStatus.ACCEPTED

    def test_decline_event(self, manager):
        """Test declining an event."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")
        event = manager.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
            attendee_ids=["user2"],
        )

        response = manager.decline_event(event.id, "user2", "Conflicting meeting")
        assert response.status == AttendeeStatus.DECLINED
        assert response.comment == "Conflicting meeting"

    def test_quick_meeting(self, manager):
        """Test quick meeting creation."""
        event = manager.quick_meeting(
            organizer_id="user1",
            title="Quick Sync",
            start_time=datetime.utcnow() + timedelta(hours=1),
            duration_minutes=30,
            attendee_ids=["user2"],
        )

        assert event is not None
        assert event.title == "Quick Sync"
        assert event.duration_minutes == 30

    def test_schedule_focus_time(self, manager):
        """Test scheduling focus time."""
        event = manager.schedule_focus_time(
            user_id="user1",
            start_time=datetime.utcnow() + timedelta(hours=1),
            duration_minutes=120,
            title="Deep Work",
        )

        assert event is not None
        assert event.event_type == EventType.FOCUS_TIME
        assert event.title == "Deep Work"

    def test_schedule_out_of_office(self, manager):
        """Test scheduling out of office."""
        start = datetime.utcnow() + timedelta(days=1)
        end = start + timedelta(days=5)

        event = manager.schedule_out_of_office(
            user_id="user1",
            start_time=start,
            end_time=end,
            title="Vacation",
        )

        assert event is not None
        assert event.event_type == EventType.OUT_OF_OFFICE

    def test_share_calendar(self, manager):
        """Test sharing a calendar."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")

        share = manager.share_calendar(
            calendar.id, "user2", CalendarPermission.WRITE, "user1"
        )

        assert share is not None
        assert manager.get_calendar_permission(calendar.id, "user2") == CalendarPermission.WRITE

    def test_create_room(self, manager):
        """Test creating a meeting room."""
        room = manager.create_room(
            name="Board Room",
            capacity=20,
            location="Executive Floor",
            amenities={"video_conf", "projector"},
        )

        assert room is not None
        assert room.capacity == 20

    def test_book_room(self, manager):
        """Test booking a room."""
        room = manager.create_room(name="Conference A", capacity=10)

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        event = manager.book_room(room.id, "Team Meeting", "user1", start, end)
        assert event is not None

    def test_find_meeting_time(self, manager):
        """Test finding meeting time suggestions."""
        # Create calendars for users
        manager.ensure_user_calendar("user1")
        manager.ensure_user_calendar("user2")

        suggestions = manager.find_meeting_time(
            attendee_ids=["user1", "user2"],
            duration_minutes=30,
        )

        assert len(suggestions) > 0
        assert all(s.score > 0 for s in suggestions)

    def test_get_events_for_day(self, manager):
        """Test getting events for a day."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")

        today = date.today()
        manager.create_event(
            calendar_id=calendar.id,
            title="Today's Meeting",
            organizer_id="user1",
            start_time=datetime.combine(today, time(10, 0)),
            end_time=datetime.combine(today, time(11, 0)),
        )

        events = manager.get_events_for_day("user1", today)
        assert len(events) == 1

    def test_get_free_busy(self, manager):
        """Test getting free/busy information."""
        calendar = manager.ensure_user_calendar("user1")

        now = datetime.utcnow()
        event = manager.create_event(
            calendar_id=calendar.id,
            title="Meeting",
            organizer_id="user1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
        )

        # Accept the event
        manager.accept_event(event.id, "user1")

        slots = manager.get_free_busy(
            "user1",
            now,
            now + timedelta(hours=3),
        )

        assert len(slots) >= 1

    def test_get_stats(self, manager):
        """Test getting statistics."""
        calendar = manager.create_calendar(name="Test", owner_id="user1")
        manager.create_event(
            calendar_id=calendar.id,
            title="Event",
            organizer_id="user1",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=1),
        )

        stats = manager.get_stats(user_id="user1")
        assert stats["total_calendars"] >= 1
        assert stats["total_events"] >= 1


class TestGlobalInstances:
    """Tests for global instance management."""

    def test_set_and_get_manager(self):
        """Test setting and getting global manager."""
        reset_calendar_manager()

        manager = CalendarManager()
        set_calendar_manager(manager)

        retrieved = get_calendar_manager()
        assert retrieved is manager

        reset_calendar_manager()

    def test_get_creates_default(self):
        """Test that get creates default manager."""
        reset_calendar_manager()

        manager = get_calendar_manager()
        assert manager is not None

        reset_calendar_manager()


class TestCalendarWorkflows:
    """Integration tests for complete workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager."""
        return CalendarManager()

    def test_complete_meeting_workflow(self, manager):
        """Test complete meeting scheduling workflow."""
        # Organizer creates meeting
        organizer = "user1"
        attendees = ["user2", "user3"]

        calendar = manager.ensure_user_calendar(organizer)

        start = datetime.utcnow() + timedelta(hours=2)
        end = start + timedelta(hours=1)

        event = manager.create_event(
            calendar_id=calendar.id,
            title="Project Kickoff",
            organizer_id=organizer,
            start_time=start,
            end_time=end,
            description="Let's discuss the project plan",
            location="Conference Room A",
            attendee_ids=attendees,
        )

        # Attendees respond
        manager.accept_event(event.id, "user2")
        manager.decline_event(event.id, "user3", "I have a conflict")

        # Check responses
        event_attendees = manager.get_attendees(event.id)
        accepted = [a for a in event_attendees if a.status == AttendeeStatus.ACCEPTED]
        declined = [a for a in event_attendees if a.status == AttendeeStatus.DECLINED]

        assert len(accepted) == 2  # Organizer + user2
        assert len(declined) == 1

    def test_recurring_meeting_workflow(self, manager):
        """Test recurring meeting workflow."""
        calendar = manager.ensure_user_calendar("user1")

        # Create weekly recurring meeting
        start = datetime(2024, 1, 1, 10, 0)
        end = start + timedelta(hours=1)

        recurrence = RecurrenceRule(
            frequency=RecurrenceFrequency.WEEKLY,
            interval=1,
            end_type=RecurrenceEndType.AFTER_COUNT,
            count=4,
        )

        event = manager.create_event(
            calendar_id=calendar.id,
            title="Weekly Standup",
            organizer_id="user1",
            start_time=start,
            end_time=end,
            recurrence=recurrence,
        )

        assert event.is_recurring
        assert event.recurrence_rule is not None

    def test_room_booking_workflow(self, manager):
        """Test meeting room booking workflow."""
        # Create rooms
        room_a = manager.create_room(
            name="Conference A",
            capacity=10,
            amenities={"projector", "whiteboard"},
        )
        room_b = manager.create_room(
            name="Conference B",
            capacity=20,
            amenities={"projector", "video_conf"},
        )

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=2)

        # Book room A
        event1 = manager.book_room(room_a.id, "Team Meeting", "user1", start, end)
        assert event1 is not None

        # Try to book room A again (should fail)
        event2 = manager.book_room(room_a.id, "Another Meeting", "user2", start, end)
        assert event2 is None

        # Book room B (should work)
        event3 = manager.book_room(room_b.id, "Another Meeting", "user2", start, end)
        assert event3 is not None

        # Check available rooms
        available = manager.get_available_rooms(start, end)
        assert len(available) == 0

    def test_calendar_sharing_workflow(self, manager):
        """Test calendar sharing workflow."""
        # User1 creates calendar
        calendar = manager.create_calendar(
            name="Team Calendar",
            owner_id="user1",
            calendar_type=CalendarType.TEAM,
        )

        # Share with team members
        manager.share_calendar(calendar.id, "user2", CalendarPermission.WRITE, "user1")
        manager.share_calendar(calendar.id, "user3", CalendarPermission.READ, "user1")

        # Check permissions
        assert manager.get_calendar_permission(calendar.id, "user1") == CalendarPermission.ADMIN
        assert manager.get_calendar_permission(calendar.id, "user2") == CalendarPermission.WRITE
        assert manager.get_calendar_permission(calendar.id, "user3") == CalendarPermission.READ

        # User2 can create events
        event = manager.create_event(
            calendar_id=calendar.id,
            title="Team Sync",
            organizer_id="user2",
            start_time=datetime.utcnow() + timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(hours=2),
        )
        assert event is not None

    def test_find_meeting_time_workflow(self, manager):
        """Test finding meeting time for multiple attendees."""
        # Create calendars and add some events
        cal1 = manager.ensure_user_calendar("user1")
        cal2 = manager.ensure_user_calendar("user2")

        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

        # User1 has a meeting
        e1 = manager.create_event(
            calendar_id=cal1.id,
            title="User1 Meeting",
            organizer_id="user1",
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=3),
        )
        manager.accept_event(e1.id, "user1")

        # User2 has a meeting
        e2 = manager.create_event(
            calendar_id=cal2.id,
            title="User2 Meeting",
            organizer_id="user2",
            start_time=now + timedelta(hours=4),
            end_time=now + timedelta(hours=5),
        )
        manager.accept_event(e2.id, "user2")

        # Find meeting time
        suggestions = manager.find_meeting_time(
            attendee_ids=["user1", "user2"],
            duration_minutes=60,
            start_date=now,
            end_date=now + timedelta(days=1),
        )

        assert len(suggestions) > 0
        # Best suggestion should have both attendees available
        best = suggestions[0]
        assert best.score > 0
