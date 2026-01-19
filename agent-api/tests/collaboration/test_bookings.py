"""
Tests for the Booking & Reservations module.
"""

import pytest
from datetime import datetime, date, time, timedelta

from app.collaboration.bookings import (
    BookingManager,
    BookingRegistry,
    BookableResource,
    ResourceType,
    ResourceStatus,
    ResourceSchedule,
    ResourceBlackout,
    Booking,
    BookingStatus,
    ApprovalStatus,
    RecurrenceType,
    RecurrenceRule,
    DayOfWeek,
    WaitlistEntry,
    BookingConflict,
    ConflictResolution,
    ResourceGroup,
    BookingPolicy,
    BookingReminder,
    BookingAnalytics,
    Amenity,
    CheckInMethod,
    get_booking_manager,
    set_booking_manager,
    reset_booking_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestEnums:
    """Tests for enum definitions."""

    def test_resource_type_values(self):
        """Test ResourceType enum values."""
        assert ResourceType.MEETING_ROOM.value == "meeting_room"
        assert ResourceType.CONFERENCE_ROOM.value == "conference_room"
        assert ResourceType.DESK.value == "desk"
        assert ResourceType.PARKING_SPOT.value == "parking_spot"
        assert ResourceType.EQUIPMENT.value == "equipment"
        assert ResourceType.VEHICLE.value == "vehicle"

    def test_resource_status_values(self):
        """Test ResourceStatus enum values."""
        assert ResourceStatus.AVAILABLE.value == "available"
        assert ResourceStatus.OCCUPIED.value == "occupied"
        assert ResourceStatus.MAINTENANCE.value == "maintenance"
        assert ResourceStatus.UNAVAILABLE.value == "unavailable"

    def test_booking_status_values(self):
        """Test BookingStatus enum values."""
        assert BookingStatus.PENDING.value == "pending"
        assert BookingStatus.CONFIRMED.value == "confirmed"
        assert BookingStatus.CHECKED_IN.value == "checked_in"
        assert BookingStatus.CANCELLED.value == "cancelled"
        assert BookingStatus.NO_SHOW.value == "no_show"

    def test_day_of_week_values(self):
        """Test DayOfWeek enum values."""
        assert DayOfWeek.MONDAY.value == 0
        assert DayOfWeek.FRIDAY.value == 4
        assert DayOfWeek.SUNDAY.value == 6

    def test_recurrence_type_values(self):
        """Test RecurrenceType enum values."""
        assert RecurrenceType.NONE.value == "none"
        assert RecurrenceType.DAILY.value == "daily"
        assert RecurrenceType.WEEKLY.value == "weekly"
        assert RecurrenceType.MONTHLY.value == "monthly"


# ============================================================
# Data Model Tests
# ============================================================

class TestDataModels:
    """Tests for data models."""

    def test_bookable_resource_creation(self):
        """Test BookableResource creation."""
        resource = BookableResource(
            workspace_id="ws-1",
            name="Conference Room A",
            resource_type=ResourceType.CONFERENCE_ROOM,
            capacity=10,
        )
        assert resource.workspace_id == "ws-1"
        assert resource.name == "Conference Room A"
        assert resource.resource_type == ResourceType.CONFERENCE_ROOM
        assert resource.capacity == 10
        assert resource.status == ResourceStatus.AVAILABLE
        assert resource.id is not None

    def test_resource_schedule_creation(self):
        """Test ResourceSchedule creation."""
        schedule = ResourceSchedule(
            resource_id="res-1",
            day_of_week=DayOfWeek.MONDAY,
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        assert schedule.resource_id == "res-1"
        assert schedule.day_of_week == DayOfWeek.MONDAY
        assert schedule.start_time == time(9, 0)
        assert schedule.is_available is True

    def test_resource_blackout_creation(self):
        """Test ResourceBlackout creation."""
        blackout = ResourceBlackout(
            resource_id="res-1",
            start_datetime=datetime(2024, 1, 1, 9, 0),
            end_datetime=datetime(2024, 1, 1, 17, 0),
            reason="Maintenance",
            created_by="admin-1",
        )
        assert blackout.resource_id == "res-1"
        assert blackout.reason == "Maintenance"

    def test_booking_creation(self):
        """Test Booking creation."""
        booking = Booking(
            workspace_id="ws-1",
            resource_id="res-1",
            user_id="user-1",
            title="Team Meeting",
            start_datetime=datetime(2024, 1, 15, 10, 0),
            end_datetime=datetime(2024, 1, 15, 11, 0),
        )
        assert booking.workspace_id == "ws-1"
        assert booking.title == "Team Meeting"
        assert booking.status == BookingStatus.PENDING
        assert booking.id is not None

    def test_recurrence_rule_creation(self):
        """Test RecurrenceRule creation."""
        rule = RecurrenceRule(
            recurrence_type=RecurrenceType.WEEKLY,
            interval=1,
            days_of_week=[DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
            occurrence_count=10,
        )
        assert rule.recurrence_type == RecurrenceType.WEEKLY
        assert len(rule.days_of_week) == 2

    def test_waitlist_entry_creation(self):
        """Test WaitlistEntry creation."""
        entry = WaitlistEntry(
            workspace_id="ws-1",
            resource_id="res-1",
            user_id="user-1",
            title="Backup meeting",
        )
        assert entry.is_active is True
        assert entry.position == 0

    def test_resource_group_creation(self):
        """Test ResourceGroup creation."""
        group = ResourceGroup(
            workspace_id="ws-1",
            name="Floor 3 Meeting Rooms",
            resource_ids=["res-1", "res-2", "res-3"],
        )
        assert group.name == "Floor 3 Meeting Rooms"
        assert len(group.resource_ids) == 3

    def test_amenity_creation(self):
        """Test Amenity creation."""
        amenity = Amenity(
            name="Whiteboard",
            description="Wall-mounted whiteboard",
            category="presentation",
        )
        assert amenity.name == "Whiteboard"


# ============================================================
# Registry Tests
# ============================================================

class TestBookingRegistry:
    """Tests for BookingRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return BookingRegistry()

    def test_create_resource(self, registry):
        """Test creating a resource."""
        resource = BookableResource(
            workspace_id="ws-1",
            name="Room A",
            resource_type=ResourceType.MEETING_ROOM,
        )
        created = registry.create_resource(resource)
        assert created.id == resource.id
        assert registry.get_resource(resource.id) is not None

    def test_update_resource(self, registry):
        """Test updating a resource."""
        resource = BookableResource(workspace_id="ws-1", name="Original", resource_type=ResourceType.MEETING_ROOM)
        registry.create_resource(resource)
        resource.name = "Updated"
        updated = registry.update_resource(resource)
        assert updated.name == "Updated"

    def test_delete_resource(self, registry):
        """Test deleting a resource."""
        resource = BookableResource(workspace_id="ws-1", name="Room", resource_type=ResourceType.MEETING_ROOM)
        registry.create_resource(resource)
        result = registry.delete_resource(resource.id)
        assert result is True
        assert registry.get_resource(resource.id) is None

    def test_list_resources_by_type(self, registry):
        """Test listing resources by type."""
        r1 = BookableResource(workspace_id="ws-1", name="Room 1", resource_type=ResourceType.MEETING_ROOM)
        r2 = BookableResource(workspace_id="ws-1", name="Desk 1", resource_type=ResourceType.DESK)
        registry.create_resource(r1)
        registry.create_resource(r2)
        resources = registry.list_resources(resource_type=ResourceType.MEETING_ROOM)
        assert len(resources) == 1
        assert resources[0].resource_type == ResourceType.MEETING_ROOM

    def test_list_resources_by_capacity(self, registry):
        """Test listing resources by minimum capacity."""
        r1 = BookableResource(workspace_id="ws-1", name="Small", resource_type=ResourceType.MEETING_ROOM, capacity=4)
        r2 = BookableResource(workspace_id="ws-1", name="Large", resource_type=ResourceType.MEETING_ROOM, capacity=20)
        registry.create_resource(r1)
        registry.create_resource(r2)
        resources = registry.list_resources(min_capacity=10)
        assert len(resources) == 1
        assert resources[0].name == "Large"

    def test_create_schedule(self, registry):
        """Test creating a schedule."""
        schedule = ResourceSchedule(resource_id="res-1", day_of_week=DayOfWeek.MONDAY)
        created = registry.create_schedule(schedule)
        assert created.id == schedule.id

    def test_get_resource_schedules(self, registry):
        """Test getting schedules for a resource."""
        s1 = ResourceSchedule(resource_id="res-1", day_of_week=DayOfWeek.MONDAY)
        s2 = ResourceSchedule(resource_id="res-1", day_of_week=DayOfWeek.TUESDAY)
        s3 = ResourceSchedule(resource_id="res-2", day_of_week=DayOfWeek.MONDAY)
        registry.create_schedule(s1)
        registry.create_schedule(s2)
        registry.create_schedule(s3)
        schedules = registry.get_resource_schedules("res-1")
        assert len(schedules) == 2

    def test_create_booking(self, registry):
        """Test creating a booking."""
        booking = Booking(
            workspace_id="ws-1",
            resource_id="res-1",
            user_id="user-1",
            title="Meeting",
            start_datetime=datetime(2024, 1, 15, 10, 0),
            end_datetime=datetime(2024, 1, 15, 11, 0),
        )
        created = registry.create_booking(booking)
        assert created.id == booking.id

    def test_get_resource_bookings(self, registry):
        """Test getting bookings for a resource in time range."""
        b1 = Booking(
            workspace_id="ws-1", resource_id="res-1", user_id="user-1", title="B1",
            start_datetime=datetime(2024, 1, 15, 10, 0),
            end_datetime=datetime(2024, 1, 15, 11, 0),
        )
        b2 = Booking(
            workspace_id="ws-1", resource_id="res-1", user_id="user-1", title="B2",
            start_datetime=datetime(2024, 1, 15, 14, 0),
            end_datetime=datetime(2024, 1, 15, 15, 0),
        )
        registry.create_booking(b1)
        registry.create_booking(b2)
        bookings = registry.get_resource_bookings(
            "res-1",
            datetime(2024, 1, 15, 9, 0),
            datetime(2024, 1, 15, 12, 0),
        )
        assert len(bookings) == 1
        assert bookings[0].title == "B1"

    def test_get_user_bookings(self, registry):
        """Test getting bookings for a user."""
        now = datetime.utcnow()
        b1 = Booking(
            workspace_id="ws-1", resource_id="res-1", user_id="user-1", title="B1",
            start_datetime=now + timedelta(hours=1),
            end_datetime=now + timedelta(hours=2),
        )
        b2 = Booking(
            workspace_id="ws-1", resource_id="res-1", user_id="user-2", title="B2",
            start_datetime=now + timedelta(hours=3),
            end_datetime=now + timedelta(hours=4),
        )
        registry.create_booking(b1)
        registry.create_booking(b2)
        bookings = registry.get_user_bookings("user-1")
        assert len(bookings) == 1

    def test_create_waitlist_entry(self, registry):
        """Test creating a waitlist entry."""
        entry = WaitlistEntry(workspace_id="ws-1", resource_id="res-1", user_id="user-1", title="Waiting")
        created = registry.create_waitlist_entry(entry)
        assert created.id == entry.id

    def test_get_resource_waitlist(self, registry):
        """Test getting waitlist for a resource."""
        e1 = WaitlistEntry(workspace_id="ws-1", resource_id="res-1", user_id="user-1", title="W1")
        e2 = WaitlistEntry(workspace_id="ws-1", resource_id="res-2", user_id="user-2", title="W2")
        registry.create_waitlist_entry(e1)
        registry.create_waitlist_entry(e2)
        waitlist = registry.get_resource_waitlist("res-1")
        assert len(waitlist) == 1

    def test_create_group(self, registry):
        """Test creating a resource group."""
        group = ResourceGroup(workspace_id="ws-1", name="Group 1", resource_ids=["res-1"])
        created = registry.create_group(group)
        assert created.id == group.id

    def test_clear_registry(self, registry):
        """Test clearing the registry."""
        resource = BookableResource(workspace_id="ws-1", name="Room", resource_type=ResourceType.MEETING_ROOM)
        registry.create_resource(resource)
        registry.clear()
        assert registry.get_resource(resource.id) is None


# ============================================================
# Manager Tests
# ============================================================

class TestBookingManager:
    """Tests for BookingManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return BookingManager()

    def test_create_resource(self, manager):
        """Test creating a resource."""
        resource = manager.create_resource(
            workspace_id="ws-1",
            name="Conference Room A",
            resource_type=ResourceType.CONFERENCE_ROOM,
            capacity=10,
            building="Main Building",
            floor="3rd Floor",
        )
        assert resource.name == "Conference Room A"
        assert resource.capacity == 10
        assert resource.building == "Main Building"

    def test_update_resource(self, manager):
        """Test updating a resource."""
        resource = manager.create_resource("ws-1", "Original", ResourceType.MEETING_ROOM)
        updated = manager.update_resource(resource.id, name="Updated", capacity=15)
        assert updated.name == "Updated"
        assert updated.capacity == 15

    def test_delete_resource(self, manager):
        """Test deleting a resource."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        result = manager.delete_resource(resource.id)
        assert result is True
        assert manager.get_resource(resource.id) is None

    def test_list_resources(self, manager):
        """Test listing resources."""
        manager.create_resource("ws-1", "Room 1", ResourceType.MEETING_ROOM)
        manager.create_resource("ws-1", "Room 2", ResourceType.MEETING_ROOM)
        manager.create_resource("ws-2", "Room 3", ResourceType.MEETING_ROOM)
        resources = manager.list_resources("ws-1")
        assert len(resources) == 2

    def test_set_resource_schedule(self, manager):
        """Test setting resource schedule."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        schedule = manager.set_resource_schedule(
            resource.id,
            DayOfWeek.MONDAY,
            time(9, 0),
            time(18, 0),
        )
        assert schedule is not None
        assert schedule.start_time == time(9, 0)

    def test_set_default_schedule(self, manager):
        """Test setting default schedule."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        schedules = manager.set_default_schedule(resource.id)
        assert len(schedules) == 5  # Weekdays only

    def test_add_blackout(self, manager):
        """Test adding a blackout period."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        blackout = manager.add_blackout(
            resource.id,
            datetime(2024, 1, 15, 9, 0),
            datetime(2024, 1, 15, 17, 0),
            "Maintenance",
            "admin-1",
        )
        assert blackout is not None
        assert blackout.reason == "Maintenance"

    def test_create_booking(self, manager):
        """Test creating a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM, capacity=10)
        now = datetime.utcnow()
        booking = manager.create_booking(
            workspace_id="ws-1",
            resource_id=resource.id,
            user_id="user-1",
            start=now + timedelta(hours=1),
            end=now + timedelta(hours=2),
            title="Team Meeting",
            attendee_count=5,
        )
        assert booking is not None
        assert booking.title == "Team Meeting"
        assert booking.status == BookingStatus.CONFIRMED

    def test_create_booking_requires_approval(self, manager):
        """Test creating a booking that requires approval."""
        resource = manager.create_resource(
            "ws-1", "Executive Room", ResourceType.CONFERENCE_ROOM,
            requires_approval=True,
        )
        now = datetime.utcnow()
        booking = manager.create_booking(
            workspace_id="ws-1",
            resource_id=resource.id,
            user_id="user-1",
            start=now + timedelta(hours=1),
            end=now + timedelta(hours=2),
            title="Meeting",
        )
        assert booking is not None
        assert booking.status == BookingStatus.PENDING
        assert booking.approval_status == ApprovalStatus.PENDING

    def test_create_booking_conflict(self, manager):
        """Test creating a booking when slot is taken."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        start = now + timedelta(hours=1)
        end = now + timedelta(hours=2)

        # First booking succeeds
        b1 = manager.create_booking("ws-1", resource.id, "user-1", start, end, "Meeting 1")
        assert b1 is not None

        # Second booking for same time fails
        b2 = manager.create_booking("ws-1", resource.id, "user-2", start, end, "Meeting 2")
        assert b2 is None

    def test_create_booking_capacity_exceeded(self, manager):
        """Test creating a booking with too many attendees."""
        resource = manager.create_resource("ws-1", "Small Room", ResourceType.MEETING_ROOM, capacity=4)
        now = datetime.utcnow()
        booking = manager.create_booking(
            workspace_id="ws-1",
            resource_id=resource.id,
            user_id="user-1",
            start=now + timedelta(hours=1),
            end=now + timedelta(hours=2),
            title="Meeting",
            attendee_count=10,  # Exceeds capacity
        )
        assert booking is None

    def test_update_booking(self, manager):
        """Test updating a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Original Title",
        )
        updated = manager.update_booking(booking.id, title="Updated Title", notes="Some notes")
        assert updated.title == "Updated Title"
        assert updated.notes == "Some notes"

    def test_reschedule_booking(self, manager):
        """Test rescheduling a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting",
        )
        new_start = now + timedelta(hours=3)
        new_end = now + timedelta(hours=4)
        rescheduled = manager.reschedule_booking(booking.id, new_start, new_end)
        assert rescheduled is not None
        assert rescheduled.start_datetime == new_start

    def test_cancel_booking(self, manager):
        """Test cancelling a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting",
        )
        cancelled = manager.cancel_booking(booking.id, "user-1", "Changed plans")
        assert cancelled.status == BookingStatus.CANCELLED
        assert cancelled.cancellation_reason == "Changed plans"

    def test_check_in(self, manager):
        """Test checking in to a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM, requires_check_in=True)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now - timedelta(minutes=5), now + timedelta(hours=1),
            "Meeting",
        )
        checked_in = manager.check_in(booking.id)
        assert checked_in.status == BookingStatus.CHECKED_IN
        assert checked_in.checked_in_at is not None

    def test_check_out(self, manager):
        """Test checking out from a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now - timedelta(minutes=5), now + timedelta(hours=1),
            "Meeting",
        )
        manager.check_in(booking.id)
        checked_out = manager.check_out(booking.id)
        assert checked_out.status == BookingStatus.COMPLETED
        assert checked_out.checked_out_at is not None

    def test_mark_no_show(self, manager):
        """Test marking a booking as no-show."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting",
        )
        no_show = manager.mark_no_show(booking.id)
        assert no_show.status == BookingStatus.NO_SHOW

    def test_approve_booking(self, manager):
        """Test approving a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM, requires_approval=True)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting",
        )
        approved = manager.approve_booking(booking.id, "manager-1")
        assert approved.approval_status == ApprovalStatus.APPROVED
        assert approved.status == BookingStatus.CONFIRMED

    def test_reject_booking(self, manager):
        """Test rejecting a booking."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM, requires_approval=True)
        now = datetime.utcnow()
        booking = manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting",
        )
        rejected = manager.reject_booking(booking.id, "manager-1", "Room needed for other purpose")
        assert rejected.approval_status == ApprovalStatus.REJECTED
        assert rejected.status == BookingStatus.CANCELLED

    def test_is_resource_available(self, manager):
        """Test checking resource availability."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        start = now + timedelta(hours=1)
        end = now + timedelta(hours=2)

        # Initially available
        assert manager.is_resource_available(resource.id, start, end) is True

        # Book the slot
        manager.create_booking("ws-1", resource.id, "user-1", start, end, "Meeting")

        # No longer available
        assert manager.is_resource_available(resource.id, start, end) is False

    def test_search_available_resources(self, manager):
        """Test searching for available resources."""
        r1 = manager.create_resource("ws-1", "Room 1", ResourceType.MEETING_ROOM, capacity=5)
        r2 = manager.create_resource("ws-1", "Room 2", ResourceType.MEETING_ROOM, capacity=10)
        now = datetime.utcnow()
        start = now + timedelta(hours=1)
        end = now + timedelta(hours=2)

        # Book Room 1
        manager.create_booking("ws-1", r1.id, "user-1", start, end, "Meeting")

        # Search for available rooms
        available = manager.search_available_resources("ws-1", start, end)
        assert len(available) == 1
        assert available[0].id == r2.id

    def test_join_waitlist(self, manager):
        """Test joining the waitlist."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        entry = manager.join_waitlist(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Waiting for slot",
        )
        assert entry is not None
        assert entry.is_active is True

    def test_leave_waitlist(self, manager):
        """Test leaving the waitlist."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        entry = manager.join_waitlist(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Waiting",
        )
        result = manager.leave_waitlist(entry.id)
        assert result is True

    def test_get_user_bookings(self, manager):
        """Test getting user's bookings."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting 1",
        )
        manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=3), now + timedelta(hours=4),
            "Meeting 2",
        )
        bookings = manager.get_user_bookings("user-1")
        assert len(bookings) == 2

    def test_create_resource_group(self, manager):
        """Test creating a resource group."""
        r1 = manager.create_resource("ws-1", "Room 1", ResourceType.MEETING_ROOM)
        r2 = manager.create_resource("ws-1", "Room 2", ResourceType.MEETING_ROOM)
        group = manager.create_resource_group(
            "ws-1",
            "Floor 3 Rooms",
            [r1.id, r2.id],
            description="All meeting rooms on floor 3",
        )
        assert group.name == "Floor 3 Rooms"
        assert len(group.resource_ids) == 2

    def test_add_resource_to_group(self, manager):
        """Test adding a resource to a group."""
        r1 = manager.create_resource("ws-1", "Room 1", ResourceType.MEETING_ROOM)
        r2 = manager.create_resource("ws-1", "Room 2", ResourceType.MEETING_ROOM)
        group = manager.create_resource_group("ws-1", "Rooms", [r1.id])
        updated = manager.add_resource_to_group(group.id, r2.id)
        assert len(updated.resource_ids) == 2

    def test_get_booking_analytics(self, manager):
        """Test getting booking analytics."""
        resource = manager.create_resource("ws-1", "Room", ResourceType.MEETING_ROOM)
        now = datetime.utcnow()
        today = now.date()

        # Create some bookings
        manager.create_booking(
            "ws-1", resource.id, "user-1",
            now + timedelta(hours=1), now + timedelta(hours=2),
            "Meeting 1",
        )
        manager.create_booking(
            "ws-1", resource.id, "user-2",
            now + timedelta(hours=3), now + timedelta(hours=4),
            "Meeting 2",
        )

        analytics = manager.get_booking_analytics(
            "ws-1",
            today,
            today + timedelta(days=1),
        )
        assert analytics.total_bookings == 2
        assert analytics.unique_users == 2


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstances:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_booking_manager()

    def test_get_booking_manager(self):
        """Test getting the global booking manager."""
        manager = get_booking_manager()
        assert manager is not None
        assert isinstance(manager, BookingManager)

    def test_set_booking_manager(self):
        """Test setting the global booking manager."""
        custom_manager = BookingManager()
        set_booking_manager(custom_manager)
        assert get_booking_manager() is custom_manager

    def test_reset_booking_manager(self):
        """Test resetting the global booking manager."""
        manager1 = get_booking_manager()
        reset_booking_manager()
        manager2 = get_booking_manager()
        assert manager1 is not manager2
