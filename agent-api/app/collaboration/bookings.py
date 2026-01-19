"""
Booking & Reservations module for enterprise collaboration.

This module provides comprehensive booking and reservation functionality including:
- Bookable resources (meeting rooms, equipment, desks, vehicles, parking)
- Resource availability and schedules
- Booking management with conflict detection
- Recurring bookings
- Approval workflows
- Check-in/check-out tracking
- Amenities and features
- Analytics and reporting
"""

from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ============================================================
# Enums
# ============================================================

class ResourceType(Enum):
    """Types of bookable resources."""
    MEETING_ROOM = "meeting_room"
    CONFERENCE_ROOM = "conference_room"
    DESK = "desk"
    PARKING_SPOT = "parking_spot"
    EQUIPMENT = "equipment"
    VEHICLE = "vehicle"
    OFFICE = "office"
    LAB = "lab"
    STUDIO = "studio"
    LOCKER = "locker"
    PHONE_BOOTH = "phone_booth"
    LOUNGE = "lounge"
    OTHER = "other"


class ResourceStatus(Enum):
    """Status of a bookable resource."""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    UNAVAILABLE = "unavailable"
    RESERVED = "reserved"
    RETIRED = "retired"


class BookingStatus(Enum):
    """Status of a booking."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    COMPLETED = "completed"


class ApprovalStatus(Enum):
    """Status of booking approval."""
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RecurrenceType(Enum):
    """Types of recurring bookings."""
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class DayOfWeek(Enum):
    """Days of the week."""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


class ConflictResolution(Enum):
    """How to handle booking conflicts."""
    REJECT = "reject"
    WAITLIST = "waitlist"
    AUTO_REASSIGN = "auto_reassign"
    OVERRIDE = "override"


class CheckInMethod(Enum):
    """Methods for checking in."""
    MANUAL = "manual"
    QR_CODE = "qr_code"
    NFC = "nfc"
    AUTOMATIC = "automatic"
    BLUETOOTH = "bluetooth"


# ============================================================
# Data Models
# ============================================================

@dataclass
class Amenity:
    """Amenity or feature of a resource."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None


@dataclass
class ResourceSchedule:
    """Operating schedule for a resource."""
    id: str = field(default_factory=lambda: str(uuid4()))
    resource_id: str = ""
    day_of_week: DayOfWeek = DayOfWeek.MONDAY
    start_time: time = field(default_factory=lambda: time(9, 0))
    end_time: time = field(default_factory=lambda: time(17, 0))
    is_available: bool = True


@dataclass
class ResourceBlackout:
    """Blackout period when resource is unavailable."""
    id: str = field(default_factory=lambda: str(uuid4()))
    resource_id: str = ""
    start_datetime: datetime = field(default_factory=datetime.utcnow)
    end_datetime: datetime = field(default_factory=datetime.utcnow)
    reason: Optional[str] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BookableResource:
    """A resource that can be booked."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    name: str = ""
    description: Optional[str] = None
    resource_type: ResourceType = ResourceType.MEETING_ROOM
    status: ResourceStatus = ResourceStatus.AVAILABLE
    # Location
    building: Optional[str] = None
    floor: Optional[str] = None
    room_number: Optional[str] = None
    address: Optional[str] = None
    location_notes: Optional[str] = None
    # Capacity
    capacity: int = 1
    min_capacity: Optional[int] = None
    # Booking rules
    min_booking_duration: int = 15  # minutes
    max_booking_duration: int = 480  # minutes (8 hours)
    booking_increment: int = 15  # minutes
    advance_booking_days: int = 30  # how far in advance can book
    min_notice_minutes: int = 0  # minimum notice required
    max_bookings_per_day: Optional[int] = None
    max_bookings_per_user_day: Optional[int] = None
    # Approval
    requires_approval: bool = False
    approver_ids: List[str] = field(default_factory=list)
    auto_approve_for_roles: List[str] = field(default_factory=list)
    # Check-in
    requires_check_in: bool = False
    check_in_window_minutes: int = 15
    auto_release_minutes: int = 15  # release if no check-in
    check_in_method: CheckInMethod = CheckInMethod.MANUAL
    # Features
    amenities: List[str] = field(default_factory=list)  # Amenity IDs
    equipment: List[str] = field(default_factory=list)
    # Images
    image_url: Optional[str] = None
    images: List[str] = field(default_factory=list)
    # Pricing (optional)
    is_paid: bool = False
    hourly_rate: Optional[float] = None
    currency: str = "USD"
    # Metadata
    tags: List[str] = field(default_factory=list)
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RecurrenceRule:
    """Rule for recurring bookings."""
    recurrence_type: RecurrenceType = RecurrenceType.NONE
    interval: int = 1  # every N days/weeks/months
    days_of_week: List[DayOfWeek] = field(default_factory=list)  # for weekly
    day_of_month: Optional[int] = None  # for monthly
    end_date: Optional[date] = None
    occurrence_count: Optional[int] = None  # number of occurrences


@dataclass
class Booking:
    """A resource booking/reservation."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    resource_id: str = ""
    user_id: str = ""
    title: str = ""
    description: Optional[str] = None
    # Time
    start_datetime: datetime = field(default_factory=datetime.utcnow)
    end_datetime: datetime = field(default_factory=datetime.utcnow)
    timezone: str = "UTC"
    # Status
    status: BookingStatus = BookingStatus.PENDING
    approval_status: ApprovalStatus = ApprovalStatus.NOT_REQUIRED
    # Recurrence
    is_recurring: bool = False
    recurrence_rule: Optional[RecurrenceRule] = None
    parent_booking_id: Optional[str] = None  # for recurring instances
    recurrence_index: Optional[int] = None
    # Attendees
    attendee_ids: List[str] = field(default_factory=list)
    attendee_count: int = 1
    external_attendees: List[str] = field(default_factory=list)  # email addresses
    # Check-in
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None
    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    # Cancellation
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    # Meeting integration
    calendar_event_id: Optional[str] = None
    video_conference_url: Optional[str] = None
    # Notes and extras
    notes: Optional[str] = None
    setup_notes: Optional[str] = None
    equipment_requested: List[str] = field(default_factory=list)
    catering_requested: bool = False
    catering_notes: Optional[str] = None
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class WaitlistEntry:
    """Entry in the waitlist for a resource."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    resource_id: str = ""
    user_id: str = ""
    requested_start: datetime = field(default_factory=datetime.utcnow)
    requested_end: datetime = field(default_factory=datetime.utcnow)
    title: str = ""
    # Priority
    priority: int = 0
    position: int = 0
    # Status
    is_active: bool = True
    notified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BookingConflict:
    """Conflict between bookings."""
    id: str = field(default_factory=lambda: str(uuid4()))
    booking_id: str = ""
    conflicting_booking_id: str = ""
    resource_id: str = ""
    conflict_start: datetime = field(default_factory=datetime.utcnow)
    conflict_end: datetime = field(default_factory=datetime.utcnow)
    resolution: Optional[ConflictResolution] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ResourceGroup:
    """Group of related resources."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    name: str = ""
    description: Optional[str] = None
    resource_ids: List[str] = field(default_factory=list)
    manager_ids: List[str] = field(default_factory=list)
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BookingPolicy:
    """Policy for booking resources."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    name: str = ""
    description: Optional[str] = None
    # Scope
    applies_to_all: bool = True
    resource_types: List[ResourceType] = field(default_factory=list)
    resource_ids: List[str] = field(default_factory=list)
    user_roles: List[str] = field(default_factory=list)
    # Rules
    max_booking_duration: Optional[int] = None  # minutes
    max_advance_days: Optional[int] = None
    max_bookings_per_day: Optional[int] = None
    max_bookings_per_week: Optional[int] = None
    allowed_days: List[DayOfWeek] = field(default_factory=list)
    allowed_start_time: Optional[time] = None
    allowed_end_time: Optional[time] = None
    # Enforcement
    is_active: bool = True
    priority: int = 0  # higher priority policies take precedence
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BookingReminder:
    """Reminder for an upcoming booking."""
    id: str = field(default_factory=lambda: str(uuid4()))
    booking_id: str = ""
    user_id: str = ""
    remind_at: datetime = field(default_factory=datetime.utcnow)
    minutes_before: int = 15
    sent_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BookingAnalytics:
    """Analytics for resource bookings."""
    workspace_id: str = ""
    resource_id: Optional[str] = None
    period_start: date = field(default_factory=date.today)
    period_end: date = field(default_factory=date.today)
    # Totals
    total_bookings: int = 0
    total_hours_booked: float = 0.0
    unique_users: int = 0
    # Status breakdown
    confirmed_count: int = 0
    cancelled_count: int = 0
    no_show_count: int = 0
    completed_count: int = 0
    # Utilization
    utilization_rate: float = 0.0  # percentage of available time booked
    average_booking_duration: float = 0.0  # minutes
    peak_hour: Optional[int] = None
    peak_day: Optional[DayOfWeek] = None
    # By resource type
    bookings_by_type: Dict[str, int] = field(default_factory=dict)
    hours_by_type: Dict[str, float] = field(default_factory=dict)
    # By user
    bookings_by_user: Dict[str, int] = field(default_factory=dict)
    # Time series
    daily_bookings: Dict[str, int] = field(default_factory=dict)
    hourly_distribution: Dict[int, int] = field(default_factory=dict)
    calculated_at: datetime = field(default_factory=datetime.utcnow)


# ============================================================
# Registry
# ============================================================

class BookingRegistry:
    """Registry for managing bookings and resources."""

    def __init__(self) -> None:
        self._resources: Dict[str, BookableResource] = {}
        self._schedules: Dict[str, ResourceSchedule] = {}
        self._blackouts: Dict[str, ResourceBlackout] = {}
        self._bookings: Dict[str, Booking] = {}
        self._waitlist: Dict[str, WaitlistEntry] = {}
        self._conflicts: Dict[str, BookingConflict] = {}
        self._groups: Dict[str, ResourceGroup] = {}
        self._policies: Dict[str, BookingPolicy] = {}
        self._reminders: Dict[str, BookingReminder] = {}
        self._amenities: Dict[str, Amenity] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._resources.clear()
        self._schedules.clear()
        self._blackouts.clear()
        self._bookings.clear()
        self._waitlist.clear()
        self._conflicts.clear()
        self._groups.clear()
        self._policies.clear()
        self._reminders.clear()
        self._amenities.clear()

    # Resource CRUD
    def create_resource(self, resource: BookableResource) -> BookableResource:
        """Create a bookable resource."""
        self._resources[resource.id] = resource
        return resource

    def get_resource(self, resource_id: str) -> Optional[BookableResource]:
        """Get a resource by ID."""
        return self._resources.get(resource_id)

    def update_resource(self, resource: BookableResource) -> Optional[BookableResource]:
        """Update a resource."""
        if resource.id not in self._resources:
            return None
        resource.updated_at = datetime.utcnow()
        self._resources[resource.id] = resource
        return resource

    def delete_resource(self, resource_id: str) -> bool:
        """Delete a resource."""
        if resource_id not in self._resources:
            return False
        # Delete related data
        self._schedules = {k: v for k, v in self._schedules.items() if v.resource_id != resource_id}
        self._blackouts = {k: v for k, v in self._blackouts.items() if v.resource_id != resource_id}
        self._bookings = {k: v for k, v in self._bookings.items() if v.resource_id != resource_id}
        del self._resources[resource_id]
        return True

    def list_resources(
        self,
        workspace_id: Optional[str] = None,
        resource_type: Optional[ResourceType] = None,
        status: Optional[ResourceStatus] = None,
        is_active: Optional[bool] = None,
        min_capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None,
    ) -> List[BookableResource]:
        """List resources with optional filters."""
        resources = list(self._resources.values())
        if workspace_id:
            resources = [r for r in resources if r.workspace_id == workspace_id]
        if resource_type:
            resources = [r for r in resources if r.resource_type == resource_type]
        if status:
            resources = [r for r in resources if r.status == status]
        if is_active is not None:
            resources = [r for r in resources if r.is_active == is_active]
        if min_capacity:
            resources = [r for r in resources if r.capacity >= min_capacity]
        if amenities:
            resources = [r for r in resources if all(a in r.amenities for a in amenities)]
        return sorted(resources, key=lambda r: r.name)

    # Schedule CRUD
    def create_schedule(self, schedule: ResourceSchedule) -> ResourceSchedule:
        """Create a resource schedule."""
        self._schedules[schedule.id] = schedule
        return schedule

    def get_resource_schedules(self, resource_id: str) -> List[ResourceSchedule]:
        """Get schedules for a resource."""
        schedules = [s for s in self._schedules.values() if s.resource_id == resource_id]
        return sorted(schedules, key=lambda s: s.day_of_week.value)

    def update_schedule(self, schedule: ResourceSchedule) -> Optional[ResourceSchedule]:
        """Update a schedule."""
        if schedule.id not in self._schedules:
            return None
        self._schedules[schedule.id] = schedule
        return schedule

    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a schedule."""
        if schedule_id not in self._schedules:
            return False
        del self._schedules[schedule_id]
        return True

    # Blackout CRUD
    def create_blackout(self, blackout: ResourceBlackout) -> ResourceBlackout:
        """Create a blackout period."""
        self._blackouts[blackout.id] = blackout
        return blackout

    def get_blackout(self, blackout_id: str) -> Optional[ResourceBlackout]:
        """Get a blackout by ID."""
        return self._blackouts.get(blackout_id)

    def get_resource_blackouts(
        self,
        resource_id: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[ResourceBlackout]:
        """Get blackouts for a resource."""
        blackouts = [b for b in self._blackouts.values() if b.resource_id == resource_id]
        if start:
            blackouts = [b for b in blackouts if b.end_datetime >= start]
        if end:
            blackouts = [b for b in blackouts if b.start_datetime <= end]
        return sorted(blackouts, key=lambda b: b.start_datetime)

    def delete_blackout(self, blackout_id: str) -> bool:
        """Delete a blackout."""
        if blackout_id not in self._blackouts:
            return False
        del self._blackouts[blackout_id]
        return True

    # Booking CRUD
    def create_booking(self, booking: Booking) -> Booking:
        """Create a booking."""
        self._bookings[booking.id] = booking
        return booking

    def get_booking(self, booking_id: str) -> Optional[Booking]:
        """Get a booking by ID."""
        return self._bookings.get(booking_id)

    def update_booking(self, booking: Booking) -> Optional[Booking]:
        """Update a booking."""
        if booking.id not in self._bookings:
            return None
        booking.updated_at = datetime.utcnow()
        self._bookings[booking.id] = booking
        return booking

    def delete_booking(self, booking_id: str) -> bool:
        """Delete a booking."""
        if booking_id not in self._bookings:
            return False
        del self._bookings[booking_id]
        return True

    def list_bookings(
        self,
        workspace_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[BookingStatus] = None,
        start_from: Optional[datetime] = None,
        start_to: Optional[datetime] = None,
    ) -> List[Booking]:
        """List bookings with optional filters."""
        bookings = list(self._bookings.values())
        if workspace_id:
            bookings = [b for b in bookings if b.workspace_id == workspace_id]
        if resource_id:
            bookings = [b for b in bookings if b.resource_id == resource_id]
        if user_id:
            bookings = [b for b in bookings if b.user_id == user_id]
        if status:
            bookings = [b for b in bookings if b.status == status]
        if start_from:
            bookings = [b for b in bookings if b.start_datetime >= start_from]
        if start_to:
            bookings = [b for b in bookings if b.start_datetime <= start_to]
        return sorted(bookings, key=lambda b: b.start_datetime)

    def get_resource_bookings(
        self,
        resource_id: str,
        start: datetime,
        end: datetime,
        exclude_cancelled: bool = True,
    ) -> List[Booking]:
        """Get bookings for a resource in a time range."""
        bookings = [
            b for b in self._bookings.values()
            if b.resource_id == resource_id
            and b.start_datetime < end
            and b.end_datetime > start
        ]
        if exclude_cancelled:
            bookings = [b for b in bookings if b.status != BookingStatus.CANCELLED]
        return sorted(bookings, key=lambda b: b.start_datetime)

    def get_user_bookings(
        self,
        user_id: str,
        start_from: Optional[datetime] = None,
        include_past: bool = False,
    ) -> List[Booking]:
        """Get bookings for a user."""
        bookings = [b for b in self._bookings.values() if b.user_id == user_id]
        if not include_past:
            now = datetime.utcnow()
            bookings = [b for b in bookings if b.end_datetime >= now]
        if start_from:
            bookings = [b for b in bookings if b.start_datetime >= start_from]
        return sorted(bookings, key=lambda b: b.start_datetime)

    # Waitlist CRUD
    def create_waitlist_entry(self, entry: WaitlistEntry) -> WaitlistEntry:
        """Create a waitlist entry."""
        self._waitlist[entry.id] = entry
        return entry

    def get_waitlist_entry(self, entry_id: str) -> Optional[WaitlistEntry]:
        """Get a waitlist entry by ID."""
        return self._waitlist.get(entry_id)

    def update_waitlist_entry(self, entry: WaitlistEntry) -> Optional[WaitlistEntry]:
        """Update a waitlist entry."""
        if entry.id not in self._waitlist:
            return None
        self._waitlist[entry.id] = entry
        return entry

    def delete_waitlist_entry(self, entry_id: str) -> bool:
        """Delete a waitlist entry."""
        if entry_id not in self._waitlist:
            return False
        del self._waitlist[entry_id]
        return True

    def get_resource_waitlist(
        self,
        resource_id: str,
        is_active: bool = True,
    ) -> List[WaitlistEntry]:
        """Get waitlist for a resource."""
        entries = [e for e in self._waitlist.values() if e.resource_id == resource_id]
        if is_active:
            entries = [e for e in entries if e.is_active]
        return sorted(entries, key=lambda e: (e.priority, e.created_at))

    # Group CRUD
    def create_group(self, group: ResourceGroup) -> ResourceGroup:
        """Create a resource group."""
        self._groups[group.id] = group
        return group

    def get_group(self, group_id: str) -> Optional[ResourceGroup]:
        """Get a group by ID."""
        return self._groups.get(group_id)

    def update_group(self, group: ResourceGroup) -> Optional[ResourceGroup]:
        """Update a group."""
        if group.id not in self._groups:
            return None
        group.updated_at = datetime.utcnow()
        self._groups[group.id] = group
        return group

    def delete_group(self, group_id: str) -> bool:
        """Delete a group."""
        if group_id not in self._groups:
            return False
        del self._groups[group_id]
        return True

    def list_groups(self, workspace_id: Optional[str] = None) -> List[ResourceGroup]:
        """List resource groups."""
        groups = list(self._groups.values())
        if workspace_id:
            groups = [g for g in groups if g.workspace_id == workspace_id]
        return sorted(groups, key=lambda g: g.name)

    # Policy CRUD
    def create_policy(self, policy: BookingPolicy) -> BookingPolicy:
        """Create a booking policy."""
        self._policies[policy.id] = policy
        return policy

    def get_policy(self, policy_id: str) -> Optional[BookingPolicy]:
        """Get a policy by ID."""
        return self._policies.get(policy_id)

    def update_policy(self, policy: BookingPolicy) -> Optional[BookingPolicy]:
        """Update a policy."""
        if policy.id not in self._policies:
            return None
        policy.updated_at = datetime.utcnow()
        self._policies[policy.id] = policy
        return policy

    def delete_policy(self, policy_id: str) -> bool:
        """Delete a policy."""
        if policy_id not in self._policies:
            return False
        del self._policies[policy_id]
        return True

    def list_policies(
        self,
        workspace_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[BookingPolicy]:
        """List booking policies."""
        policies = list(self._policies.values())
        if workspace_id:
            policies = [p for p in policies if p.workspace_id == workspace_id]
        if is_active is not None:
            policies = [p for p in policies if p.is_active == is_active]
        return sorted(policies, key=lambda p: -p.priority)

    # Amenity CRUD
    def create_amenity(self, amenity: Amenity) -> Amenity:
        """Create an amenity."""
        self._amenities[amenity.id] = amenity
        return amenity

    def get_amenity(self, amenity_id: str) -> Optional[Amenity]:
        """Get an amenity by ID."""
        return self._amenities.get(amenity_id)

    def list_amenities(self) -> List[Amenity]:
        """List all amenities."""
        return list(self._amenities.values())

    # Reminder CRUD
    def create_reminder(self, reminder: BookingReminder) -> BookingReminder:
        """Create a booking reminder."""
        self._reminders[reminder.id] = reminder
        return reminder

    def get_pending_reminders(self, before: Optional[datetime] = None) -> List[BookingReminder]:
        """Get pending reminders."""
        now = before or datetime.utcnow()
        return [r for r in self._reminders.values() if r.sent_at is None and r.remind_at <= now]


# ============================================================
# Manager
# ============================================================

class BookingManager:
    """High-level API for booking and reservation management."""

    def __init__(self, registry: Optional[BookingRegistry] = None) -> None:
        self.registry = registry or BookingRegistry()

    # Resource Management
    def create_resource(
        self,
        workspace_id: str,
        name: str,
        resource_type: ResourceType,
        capacity: int = 1,
        description: Optional[str] = None,
        building: Optional[str] = None,
        floor: Optional[str] = None,
        room_number: Optional[str] = None,
        amenities: Optional[List[str]] = None,
        requires_approval: bool = False,
        requires_check_in: bool = False,
    ) -> BookableResource:
        """Create a bookable resource."""
        resource = BookableResource(
            workspace_id=workspace_id,
            name=name,
            resource_type=resource_type,
            capacity=capacity,
            description=description,
            building=building,
            floor=floor,
            room_number=room_number,
            amenities=amenities or [],
            requires_approval=requires_approval,
            requires_check_in=requires_check_in,
        )
        return self.registry.create_resource(resource)

    def get_resource(self, resource_id: str) -> Optional[BookableResource]:
        """Get a resource by ID."""
        return self.registry.get_resource(resource_id)

    def update_resource(
        self,
        resource_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        capacity: Optional[int] = None,
        status: Optional[ResourceStatus] = None,
        amenities: Optional[List[str]] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[BookableResource]:
        """Update a resource."""
        resource = self.registry.get_resource(resource_id)
        if not resource:
            return None

        if name is not None:
            resource.name = name
        if description is not None:
            resource.description = description
        if capacity is not None:
            resource.capacity = capacity
        if status is not None:
            resource.status = status
        if amenities is not None:
            resource.amenities = amenities
        if is_active is not None:
            resource.is_active = is_active

        return self.registry.update_resource(resource)

    def delete_resource(self, resource_id: str) -> bool:
        """Delete a resource."""
        return self.registry.delete_resource(resource_id)

    def list_resources(
        self,
        workspace_id: str,
        resource_type: Optional[ResourceType] = None,
        min_capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None,
    ) -> List[BookableResource]:
        """List available resources."""
        return self.registry.list_resources(
            workspace_id=workspace_id,
            resource_type=resource_type,
            is_active=True,
            min_capacity=min_capacity,
            amenities=amenities,
        )

    def search_available_resources(
        self,
        workspace_id: str,
        start: datetime,
        end: datetime,
        resource_type: Optional[ResourceType] = None,
        min_capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None,
    ) -> List[BookableResource]:
        """Search for resources available in a time slot."""
        resources = self.list_resources(
            workspace_id=workspace_id,
            resource_type=resource_type,
            min_capacity=min_capacity,
            amenities=amenities,
        )

        available = []
        for resource in resources:
            if self.is_resource_available(resource.id, start, end):
                available.append(resource)

        return available

    def is_resource_available(
        self,
        resource_id: str,
        start: datetime,
        end: datetime,
    ) -> bool:
        """Check if a resource is available for a time slot."""
        resource = self.registry.get_resource(resource_id)
        if not resource or not resource.is_active:
            return False

        if resource.status not in [ResourceStatus.AVAILABLE, ResourceStatus.RESERVED]:
            return False

        # Check blackouts
        blackouts = self.registry.get_resource_blackouts(resource_id, start, end)
        if blackouts:
            return False

        # Check existing bookings
        bookings = self.registry.get_resource_bookings(resource_id, start, end)
        active_bookings = [
            b for b in bookings
            if b.status in [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]
        ]
        if active_bookings:
            return False

        return True

    def get_resource_availability(
        self,
        resource_id: str,
        date_val: date,
    ) -> List[Dict[str, Any]]:
        """Get availability slots for a resource on a given date."""
        resource = self.registry.get_resource(resource_id)
        if not resource:
            return []

        # Get schedule for this day
        day_of_week = DayOfWeek(date_val.weekday())
        schedules = self.registry.get_resource_schedules(resource_id)
        day_schedule = next((s for s in schedules if s.day_of_week == day_of_week), None)

        if not day_schedule or not day_schedule.is_available:
            return []

        # Get existing bookings
        start_of_day = datetime.combine(date_val, day_schedule.start_time)
        end_of_day = datetime.combine(date_val, day_schedule.end_time)
        bookings = self.registry.get_resource_bookings(resource_id, start_of_day, end_of_day)

        # Calculate free slots
        slots = []
        current = start_of_day

        for booking in sorted(bookings, key=lambda b: b.start_datetime):
            if booking.status == BookingStatus.CANCELLED:
                continue
            if current < booking.start_datetime:
                slots.append({
                    "start": current,
                    "end": booking.start_datetime,
                    "available": True,
                })
            slots.append({
                "start": booking.start_datetime,
                "end": booking.end_datetime,
                "available": False,
                "booking_id": booking.id,
            })
            current = max(current, booking.end_datetime)

        if current < end_of_day:
            slots.append({
                "start": current,
                "end": end_of_day,
                "available": True,
            })

        return slots

    # Schedule Management
    def set_resource_schedule(
        self,
        resource_id: str,
        day_of_week: DayOfWeek,
        start_time: time,
        end_time: time,
        is_available: bool = True,
    ) -> Optional[ResourceSchedule]:
        """Set schedule for a resource on a specific day."""
        resource = self.registry.get_resource(resource_id)
        if not resource:
            return None

        # Check for existing schedule
        schedules = self.registry.get_resource_schedules(resource_id)
        existing = next((s for s in schedules if s.day_of_week == day_of_week), None)

        if existing:
            existing.start_time = start_time
            existing.end_time = end_time
            existing.is_available = is_available
            return self.registry.update_schedule(existing)

        schedule = ResourceSchedule(
            resource_id=resource_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            is_available=is_available,
        )
        return self.registry.create_schedule(schedule)

    def set_default_schedule(
        self,
        resource_id: str,
        start_time: time = time(9, 0),
        end_time: time = time(17, 0),
        weekdays_only: bool = True,
    ) -> List[ResourceSchedule]:
        """Set default business hours schedule."""
        schedules = []
        days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
        if not weekdays_only:
            days.extend([DayOfWeek.SATURDAY, DayOfWeek.SUNDAY])

        for day in days:
            schedule = self.set_resource_schedule(resource_id, day, start_time, end_time)
            if schedule:
                schedules.append(schedule)

        return schedules

    def add_blackout(
        self,
        resource_id: str,
        start: datetime,
        end: datetime,
        reason: str,
        created_by: str,
    ) -> Optional[ResourceBlackout]:
        """Add a blackout period for a resource."""
        resource = self.registry.get_resource(resource_id)
        if not resource:
            return None

        blackout = ResourceBlackout(
            resource_id=resource_id,
            start_datetime=start,
            end_datetime=end,
            reason=reason,
            created_by=created_by,
        )
        return self.registry.create_blackout(blackout)

    def remove_blackout(self, blackout_id: str) -> bool:
        """Remove a blackout period."""
        return self.registry.delete_blackout(blackout_id)

    # Booking Management
    def create_booking(
        self,
        workspace_id: str,
        resource_id: str,
        user_id: str,
        start: datetime,
        end: datetime,
        title: str,
        description: Optional[str] = None,
        attendee_ids: Optional[List[str]] = None,
        attendee_count: int = 1,
        notes: Optional[str] = None,
    ) -> Optional[Booking]:
        """Create a new booking."""
        resource = self.registry.get_resource(resource_id)
        if not resource or not resource.is_active:
            return None

        # Check availability
        if not self.is_resource_available(resource_id, start, end):
            return None

        # Check capacity
        if attendee_count > resource.capacity:
            return None

        # Check booking rules
        duration_minutes = (end - start).total_seconds() / 60
        if duration_minutes < resource.min_booking_duration:
            return None
        if duration_minutes > resource.max_booking_duration:
            return None

        # Determine approval status
        approval_status = ApprovalStatus.NOT_REQUIRED
        booking_status = BookingStatus.CONFIRMED
        if resource.requires_approval:
            approval_status = ApprovalStatus.PENDING
            booking_status = BookingStatus.PENDING

        booking = Booking(
            workspace_id=workspace_id,
            resource_id=resource_id,
            user_id=user_id,
            start_datetime=start,
            end_datetime=end,
            title=title,
            description=description,
            attendee_ids=attendee_ids or [],
            attendee_count=attendee_count,
            notes=notes,
            status=booking_status,
            approval_status=approval_status,
        )

        return self.registry.create_booking(booking)

    def create_recurring_booking(
        self,
        workspace_id: str,
        resource_id: str,
        user_id: str,
        start: datetime,
        end: datetime,
        title: str,
        recurrence_rule: RecurrenceRule,
        description: Optional[str] = None,
    ) -> List[Booking]:
        """Create recurring bookings."""
        bookings = []

        # Create parent booking
        parent = self.create_booking(
            workspace_id=workspace_id,
            resource_id=resource_id,
            user_id=user_id,
            start=start,
            end=end,
            title=title,
            description=description,
        )
        if not parent:
            return []

        parent.is_recurring = True
        parent.recurrence_rule = recurrence_rule
        parent.recurrence_index = 0
        self.registry.update_booking(parent)
        bookings.append(parent)

        # Generate occurrences
        occurrence_dates = self._generate_occurrence_dates(start, recurrence_rule)
        duration = end - start

        for i, occurrence_start in enumerate(occurrence_dates[1:], 1):
            occurrence_end = occurrence_start + duration

            # Check availability for this occurrence
            if not self.is_resource_available(resource_id, occurrence_start, occurrence_end):
                continue

            occurrence = Booking(
                workspace_id=workspace_id,
                resource_id=resource_id,
                user_id=user_id,
                start_datetime=occurrence_start,
                end_datetime=occurrence_end,
                title=title,
                description=description,
                is_recurring=True,
                parent_booking_id=parent.id,
                recurrence_index=i,
                status=parent.status,
                approval_status=parent.approval_status,
            )
            self.registry.create_booking(occurrence)
            bookings.append(occurrence)

        return bookings

    def _generate_occurrence_dates(
        self,
        start: datetime,
        rule: RecurrenceRule,
    ) -> List[datetime]:
        """Generate occurrence dates based on recurrence rule."""
        dates = [start]
        current = start
        count = 1
        max_occurrences = rule.occurrence_count or 52  # Default max 1 year of weekly

        while count < max_occurrences:
            if rule.recurrence_type == RecurrenceType.DAILY:
                current = current + timedelta(days=rule.interval)
            elif rule.recurrence_type == RecurrenceType.WEEKLY:
                current = current + timedelta(weeks=rule.interval)
            elif rule.recurrence_type == RecurrenceType.BIWEEKLY:
                current = current + timedelta(weeks=2 * rule.interval)
            elif rule.recurrence_type == RecurrenceType.MONTHLY:
                # Add months
                month = current.month + rule.interval
                year = current.year + (month - 1) // 12
                month = ((month - 1) % 12) + 1
                day = min(current.day, 28)  # Safe for all months
                current = current.replace(year=year, month=month, day=day)
            else:
                break

            # Check end conditions
            if rule.end_date and current.date() > rule.end_date:
                break

            dates.append(current)
            count += 1

        return dates

    def get_booking(self, booking_id: str) -> Optional[Booking]:
        """Get a booking by ID."""
        return self.registry.get_booking(booking_id)

    def update_booking(
        self,
        booking_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        attendee_ids: Optional[List[str]] = None,
        notes: Optional[str] = None,
    ) -> Optional[Booking]:
        """Update a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED]:
            return None

        if title is not None:
            booking.title = title
        if description is not None:
            booking.description = description
        if attendee_ids is not None:
            booking.attendee_ids = attendee_ids
        if notes is not None:
            booking.notes = notes

        return self.registry.update_booking(booking)

    def reschedule_booking(
        self,
        booking_id: str,
        new_start: datetime,
        new_end: datetime,
    ) -> Optional[Booking]:
        """Reschedule a booking to a new time."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED]:
            return None

        # Check availability (excluding current booking)
        existing_bookings = self.registry.get_resource_bookings(
            booking.resource_id, new_start, new_end
        )
        conflicts = [b for b in existing_bookings if b.id != booking_id]
        if conflicts:
            return None

        booking.start_datetime = new_start
        booking.end_datetime = new_end

        return self.registry.update_booking(booking)

    def cancel_booking(
        self,
        booking_id: str,
        cancelled_by: str,
        reason: Optional[str] = None,
    ) -> Optional[Booking]:
        """Cancel a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status == BookingStatus.CANCELLED:
            return None

        booking.status = BookingStatus.CANCELLED
        booking.cancelled_by = cancelled_by
        booking.cancelled_at = datetime.utcnow()
        booking.cancellation_reason = reason

        self.registry.update_booking(booking)

        # Process waitlist
        self._process_waitlist(booking.resource_id, booking.start_datetime, booking.end_datetime)

        return booking

    def _process_waitlist(
        self,
        resource_id: str,
        start: datetime,
        end: datetime,
    ) -> None:
        """Process waitlist when a slot becomes available."""
        waitlist = self.registry.get_resource_waitlist(resource_id)
        for entry in waitlist:
            # Check if this waitlist entry overlaps with freed slot
            if entry.requested_start < end and entry.requested_end > start:
                entry.notified_at = datetime.utcnow()
                self.registry.update_waitlist_entry(entry)
                break  # Notify first matching entry

    # Check-in/Check-out
    def check_in(
        self,
        booking_id: str,
        checked_in_by: Optional[str] = None,
    ) -> Optional[Booking]:
        """Check in to a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status != BookingStatus.CONFIRMED:
            return None

        # Check if within check-in window
        resource = self.registry.get_resource(booking.resource_id)
        if resource and resource.requires_check_in:
            now = datetime.utcnow()
            window_start = booking.start_datetime - timedelta(minutes=resource.check_in_window_minutes)
            if now < window_start:
                return None  # Too early

        booking.status = BookingStatus.CHECKED_IN
        booking.checked_in_at = datetime.utcnow()
        booking.checked_in_by = checked_in_by or booking.user_id

        return self.registry.update_booking(booking)

    def check_out(self, booking_id: str) -> Optional[Booking]:
        """Check out from a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status != BookingStatus.CHECKED_IN:
            return None

        booking.status = BookingStatus.COMPLETED
        booking.checked_out_at = datetime.utcnow()

        return self.registry.update_booking(booking)

    def mark_no_show(self, booking_id: str) -> Optional[Booking]:
        """Mark a booking as no-show."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING]:
            return None

        booking.status = BookingStatus.NO_SHOW

        self.registry.update_booking(booking)

        # Process waitlist
        self._process_waitlist(booking.resource_id, booking.start_datetime, booking.end_datetime)

        return booking

    # Approval Management
    def approve_booking(
        self,
        booking_id: str,
        approved_by: str,
    ) -> Optional[Booking]:
        """Approve a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.approval_status != ApprovalStatus.PENDING:
            return None

        booking.approval_status = ApprovalStatus.APPROVED
        booking.status = BookingStatus.CONFIRMED
        booking.approved_by = approved_by
        booking.approved_at = datetime.utcnow()

        return self.registry.update_booking(booking)

    def reject_booking(
        self,
        booking_id: str,
        rejected_by: str,
        reason: str,
    ) -> Optional[Booking]:
        """Reject a booking."""
        booking = self.registry.get_booking(booking_id)
        if not booking:
            return None

        if booking.approval_status != ApprovalStatus.PENDING:
            return None

        booking.approval_status = ApprovalStatus.REJECTED
        booking.status = BookingStatus.CANCELLED
        booking.approved_by = rejected_by
        booking.approved_at = datetime.utcnow()
        booking.rejection_reason = reason

        return self.registry.update_booking(booking)

    def get_pending_approvals(
        self,
        workspace_id: str,
        approver_id: Optional[str] = None,
    ) -> List[Booking]:
        """Get bookings pending approval."""
        bookings = self.registry.list_bookings(
            workspace_id=workspace_id,
            status=BookingStatus.PENDING,
        )
        bookings = [b for b in bookings if b.approval_status == ApprovalStatus.PENDING]

        if approver_id:
            # Filter by resources this user can approve
            result = []
            for booking in bookings:
                resource = self.registry.get_resource(booking.resource_id)
                if resource and approver_id in resource.approver_ids:
                    result.append(booking)
            return result

        return bookings

    # Waitlist Management
    def join_waitlist(
        self,
        workspace_id: str,
        resource_id: str,
        user_id: str,
        requested_start: datetime,
        requested_end: datetime,
        title: str,
    ) -> Optional[WaitlistEntry]:
        """Join the waitlist for a resource."""
        resource = self.registry.get_resource(resource_id)
        if not resource:
            return None

        # Get current position
        waitlist = self.registry.get_resource_waitlist(resource_id)
        position = len(waitlist)

        entry = WaitlistEntry(
            workspace_id=workspace_id,
            resource_id=resource_id,
            user_id=user_id,
            requested_start=requested_start,
            requested_end=requested_end,
            title=title,
            position=position,
        )

        return self.registry.create_waitlist_entry(entry)

    def leave_waitlist(self, entry_id: str) -> bool:
        """Leave the waitlist."""
        return self.registry.delete_waitlist_entry(entry_id)

    def get_user_waitlist_entries(self, user_id: str) -> List[WaitlistEntry]:
        """Get a user's waitlist entries."""
        return [e for e in self.registry._waitlist.values() if e.user_id == user_id and e.is_active]

    # User Bookings
    def get_user_bookings(
        self,
        user_id: str,
        include_past: bool = False,
    ) -> List[Booking]:
        """Get bookings for a user."""
        return self.registry.get_user_bookings(user_id, include_past=include_past)

    def get_user_upcoming_bookings(
        self,
        user_id: str,
        days: int = 7,
    ) -> List[Booking]:
        """Get upcoming bookings for a user."""
        now = datetime.utcnow()
        end = now + timedelta(days=days)
        bookings = self.registry.get_user_bookings(user_id)
        return [b for b in bookings if b.start_datetime <= end and b.status != BookingStatus.CANCELLED]

    # Group Management
    def create_resource_group(
        self,
        workspace_id: str,
        name: str,
        resource_ids: List[str],
        description: Optional[str] = None,
        manager_ids: Optional[List[str]] = None,
    ) -> ResourceGroup:
        """Create a resource group."""
        group = ResourceGroup(
            workspace_id=workspace_id,
            name=name,
            description=description,
            resource_ids=resource_ids,
            manager_ids=manager_ids or [],
        )
        return self.registry.create_group(group)

    def get_group(self, group_id: str) -> Optional[ResourceGroup]:
        """Get a resource group by ID."""
        return self.registry.get_group(group_id)

    def add_resource_to_group(self, group_id: str, resource_id: str) -> Optional[ResourceGroup]:
        """Add a resource to a group."""
        group = self.registry.get_group(group_id)
        if not group:
            return None

        if resource_id not in group.resource_ids:
            group.resource_ids.append(resource_id)
            return self.registry.update_group(group)

        return group

    def remove_resource_from_group(self, group_id: str, resource_id: str) -> Optional[ResourceGroup]:
        """Remove a resource from a group."""
        group = self.registry.get_group(group_id)
        if not group:
            return None

        if resource_id in group.resource_ids:
            group.resource_ids.remove(resource_id)
            return self.registry.update_group(group)

        return group

    # Analytics
    def get_booking_analytics(
        self,
        workspace_id: str,
        period_start: date,
        period_end: date,
        resource_id: Optional[str] = None,
    ) -> BookingAnalytics:
        """Get booking analytics for a period."""
        start_dt = datetime.combine(period_start, time.min)
        end_dt = datetime.combine(period_end, time.max)

        bookings = self.registry.list_bookings(
            workspace_id=workspace_id,
            resource_id=resource_id,
            start_from=start_dt,
            start_to=end_dt,
        )

        analytics = BookingAnalytics(
            workspace_id=workspace_id,
            resource_id=resource_id,
            period_start=period_start,
            period_end=period_end,
            total_bookings=len(bookings),
        )

        users = set()
        total_hours = 0.0

        for booking in bookings:
            # Track unique users
            users.add(booking.user_id)

            # Calculate hours
            duration = (booking.end_datetime - booking.start_datetime).total_seconds() / 3600
            total_hours += duration

            # Status breakdown
            status = booking.status.value
            if status == "confirmed":
                analytics.confirmed_count += 1
            elif status == "cancelled":
                analytics.cancelled_count += 1
            elif status == "no_show":
                analytics.no_show_count += 1
            elif status == "completed":
                analytics.completed_count += 1

            # By resource type
            resource = self.registry.get_resource(booking.resource_id)
            if resource:
                rt = resource.resource_type.value
                analytics.bookings_by_type[rt] = analytics.bookings_by_type.get(rt, 0) + 1
                analytics.hours_by_type[rt] = analytics.hours_by_type.get(rt, 0.0) + duration

            # By user
            analytics.bookings_by_user[booking.user_id] = analytics.bookings_by_user.get(booking.user_id, 0) + 1

            # Daily distribution
            date_key = booking.start_datetime.date().isoformat()
            analytics.daily_bookings[date_key] = analytics.daily_bookings.get(date_key, 0) + 1

            # Hourly distribution
            hour = booking.start_datetime.hour
            analytics.hourly_distribution[hour] = analytics.hourly_distribution.get(hour, 0) + 1

        analytics.unique_users = len(users)
        analytics.total_hours_booked = total_hours

        if bookings:
            analytics.average_booking_duration = (total_hours * 60) / len(bookings)

            # Find peak hour
            if analytics.hourly_distribution:
                analytics.peak_hour = max(analytics.hourly_distribution, key=analytics.hourly_distribution.get)

        return analytics


# ============================================================
# Global Instance Management
# ============================================================

_booking_manager: Optional[BookingManager] = None


def get_booking_manager() -> BookingManager:
    """Get the global booking manager instance."""
    global _booking_manager
    if _booking_manager is None:
        _booking_manager = BookingManager()
    return _booking_manager


def set_booking_manager(manager: BookingManager) -> None:
    """Set the global booking manager instance."""
    global _booking_manager
    _booking_manager = manager


def reset_booking_manager() -> None:
    """Reset the global booking manager instance."""
    global _booking_manager
    _booking_manager = None
