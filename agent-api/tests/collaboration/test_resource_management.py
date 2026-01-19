"""
Tests for Resource Management module.

This module tests:
- Resource types and data models
- Resource allocation and scheduling
- Capacity planning
- Utilization tracking
- ResourceManager high-level API
"""

import pytest
from datetime import datetime, date, timedelta

from app.collaboration.resource_management import (
    ResourceManager,
    ResourceRegistry,
    Resource,
    ResourceType,
    ResourceStatus,
    ResourceSkill,
    ResourceAvailability,
    ResourceAllocation,
    AllocationStatus,
    AllocationPriority,
    ResourceBooking,
    CapacityPlan,
    CapacityUnit,
    ScheduleType,
    ResourceUtilization,
    get_resource_manager,
    set_resource_manager,
    reset_resource_manager,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def registry():
    """Create a resource registry."""
    return ResourceRegistry()


@pytest.fixture
def manager():
    """Create a resource manager."""
    return ResourceManager()


@pytest.fixture
def person_resource(registry):
    """Create a sample person resource."""
    return registry.create_resource(
        name="John Developer",
        resource_type=ResourceType.PERSON,
        workspace_id="ws-1",
        team_id="team-1",
        capacity=40.0,
        capacity_unit=CapacityUnit.HOURS,
        hourly_rate=100.0,
        email="john@example.com",
    )


@pytest.fixture
def room_resource(registry):
    """Create a sample room resource."""
    return registry.create_resource(
        name="Conference Room A",
        resource_type=ResourceType.ROOM,
        workspace_id="ws-1",
        location="Building 1, Floor 2",
        capacity=10.0,
        capacity_unit=CapacityUnit.UNITS,
    )


# ============================================================================
# Enum Tests
# ============================================================================

class TestResourceType:
    """Tests for ResourceType enum."""

    def test_resource_types(self):
        """Test resource type values."""
        assert ResourceType.PERSON.value == "person"
        assert ResourceType.EQUIPMENT.value == "equipment"
        assert ResourceType.ROOM.value == "room"
        assert ResourceType.VEHICLE.value == "vehicle"
        assert ResourceType.SOFTWARE.value == "software"
        assert ResourceType.MATERIAL.value == "material"
        assert ResourceType.BUDGET.value == "budget"
        assert ResourceType.OTHER.value == "other"


class TestResourceStatus:
    """Tests for ResourceStatus enum."""

    def test_status_values(self):
        """Test status values."""
        assert ResourceStatus.AVAILABLE.value == "available"
        assert ResourceStatus.ALLOCATED.value == "allocated"
        assert ResourceStatus.PARTIALLY_ALLOCATED.value == "partially_allocated"
        assert ResourceStatus.UNAVAILABLE.value == "unavailable"
        assert ResourceStatus.MAINTENANCE.value == "maintenance"
        assert ResourceStatus.RESERVED.value == "reserved"
        assert ResourceStatus.RETIRED.value == "retired"


class TestAllocationStatus:
    """Tests for AllocationStatus enum."""

    def test_allocation_status_values(self):
        """Test allocation status values."""
        assert AllocationStatus.REQUESTED.value == "requested"
        assert AllocationStatus.APPROVED.value == "approved"
        assert AllocationStatus.ACTIVE.value == "active"
        assert AllocationStatus.COMPLETED.value == "completed"
        assert AllocationStatus.CANCELLED.value == "cancelled"
        assert AllocationStatus.REJECTED.value == "rejected"


class TestAllocationPriority:
    """Tests for AllocationPriority enum."""

    def test_priority_values(self):
        """Test priority values."""
        assert AllocationPriority.LOW.value == "low"
        assert AllocationPriority.MEDIUM.value == "medium"
        assert AllocationPriority.HIGH.value == "high"
        assert AllocationPriority.CRITICAL.value == "critical"


# ============================================================================
# ResourceSkill Tests
# ============================================================================

class TestResourceSkill:
    """Tests for ResourceSkill class."""

    def test_skill_creation(self):
        """Test skill creation."""
        skill = ResourceSkill(
            id="skill-1",
            name="Python",
            level=4,
            description="Python programming",
            certified=True,
            certification_date=date(2023, 1, 1),
        )

        assert skill.name == "Python"
        assert skill.level == 4
        assert skill.certified is True

    def test_skill_is_valid_no_expiry(self):
        """Test skill validity without expiry."""
        skill = ResourceSkill(
            id="skill-1",
            name="Python",
            level=3,
        )

        assert skill.is_valid is True

    def test_skill_is_valid_not_expired(self):
        """Test skill validity with future expiry."""
        skill = ResourceSkill(
            id="skill-1",
            name="AWS Certified",
            level=3,
            certified=True,
            expiry_date=date.today() + timedelta(days=30),
        )

        assert skill.is_valid is True

    def test_skill_is_invalid_expired(self):
        """Test skill validity with past expiry."""
        skill = ResourceSkill(
            id="skill-1",
            name="AWS Certified",
            level=3,
            certified=True,
            expiry_date=date.today() - timedelta(days=1),
        )

        assert skill.is_valid is False

    def test_skill_to_dict(self):
        """Test skill dictionary conversion."""
        skill = ResourceSkill(
            id="skill-1",
            name="Python",
            level=4,
        )

        data = skill.to_dict()
        assert data["name"] == "Python"
        assert data["level"] == 4


# ============================================================================
# Resource Tests
# ============================================================================

class TestResource:
    """Tests for Resource class."""

    def test_resource_creation(self, person_resource):
        """Test resource creation."""
        assert person_resource.name == "John Developer"
        assert person_resource.resource_type == ResourceType.PERSON
        assert person_resource.capacity == 40.0
        assert person_resource.status == ResourceStatus.AVAILABLE

    def test_resource_available_capacity(self, person_resource):
        """Test available capacity calculation."""
        assert person_resource.available_capacity == 40.0

    def test_resource_utilization_percentage(self, person_resource):
        """Test utilization percentage calculation."""
        assert person_resource.utilization_percentage == 0.0

        person_resource.metadata["allocated_capacity"] = 20.0
        assert person_resource.utilization_percentage == 50.0

    def test_resource_add_skill(self, person_resource):
        """Test adding skill to resource."""
        skill = ResourceSkill(id="s1", name="Python", level=4)
        person_resource.add_skill(skill)

        assert len(person_resource.skills) == 1
        assert person_resource.skills[0].name == "Python"

    def test_resource_remove_skill(self, person_resource):
        """Test removing skill from resource."""
        skill = ResourceSkill(id="s1", name="Python", level=4)
        person_resource.add_skill(skill)

        result = person_resource.remove_skill("s1")
        assert result is True
        assert len(person_resource.skills) == 0

    def test_resource_has_skill(self, person_resource):
        """Test skill checking."""
        skill = ResourceSkill(id="s1", name="Python", level=4)
        person_resource.add_skill(skill)

        assert person_resource.has_skill("Python", 3) is True
        assert person_resource.has_skill("Python", 5) is False
        assert person_resource.has_skill("JavaScript", 1) is False

    def test_resource_to_dict(self, person_resource):
        """Test dictionary conversion."""
        data = person_resource.to_dict()
        assert data["name"] == "John Developer"
        assert data["resource_type"] == "person"
        assert data["capacity"] == 40.0


# ============================================================================
# ResourceAllocation Tests
# ============================================================================

class TestResourceAllocation:
    """Tests for ResourceAllocation class."""

    def test_allocation_creation(self):
        """Test allocation creation."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            project_id="proj-1",
            requester_id="user-1",
            allocated_capacity=20.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
        )

        assert allocation.status == AllocationStatus.REQUESTED
        assert allocation.allocated_capacity == 20.0

    def test_allocation_duration_days(self):
        """Test duration calculation."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 10),
        )

        assert allocation.duration_days == 10

    def test_allocation_is_active(self):
        """Test active allocation check."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
            status=AllocationStatus.ACTIVE,
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() + timedelta(days=5),
        )

        assert allocation.is_active is True

    def test_allocation_is_overdue(self):
        """Test overdue allocation check."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
            status=AllocationStatus.ACTIVE,
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() - timedelta(days=1),
        )

        assert allocation.is_overdue is True

    def test_allocation_approve(self):
        """Test allocation approval."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
        )

        allocation.approve("approver-1")
        assert allocation.status == AllocationStatus.APPROVED
        assert allocation.approver_id == "approver-1"
        assert allocation.approved_at is not None

    def test_allocation_activate(self):
        """Test allocation activation."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
        )

        allocation.activate()
        assert allocation.status == AllocationStatus.ACTIVE
        assert allocation.actual_start == date.today()

    def test_allocation_complete(self):
        """Test allocation completion."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
        )

        allocation.complete()
        assert allocation.status == AllocationStatus.COMPLETED
        assert allocation.actual_end == date.today()

    def test_allocation_to_dict(self):
        """Test dictionary conversion."""
        allocation = ResourceAllocation(
            id="alloc-1",
            resource_id="res-1",
            requester_id="user-1",
            allocated_capacity=20.0,
        )

        data = allocation.to_dict()
        assert data["id"] == "alloc-1"
        assert data["allocated_capacity"] == 20.0


# ============================================================================
# ResourceBooking Tests
# ============================================================================

class TestResourceBooking:
    """Tests for ResourceBooking class."""

    def test_booking_creation(self):
        """Test booking creation."""
        start = datetime.utcnow()
        end = start + timedelta(hours=2)

        booking = ResourceBooking(
            id="book-1",
            resource_id="room-1",
            booked_by="user-1",
            title="Team Meeting",
            start_datetime=start,
            end_datetime=end,
        )

        assert booking.title == "Team Meeting"
        assert booking.duration_minutes == 120

    def test_booking_is_current(self):
        """Test current booking check."""
        now = datetime.utcnow()
        booking = ResourceBooking(
            id="book-1",
            resource_id="room-1",
            booked_by="user-1",
            title="Meeting",
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(hours=1),
        )

        assert booking.is_current is True

    def test_booking_is_future(self):
        """Test future booking check."""
        now = datetime.utcnow()
        booking = ResourceBooking(
            id="book-1",
            resource_id="room-1",
            booked_by="user-1",
            title="Meeting",
            start_datetime=now + timedelta(hours=1),
            end_datetime=now + timedelta(hours=2),
        )

        assert booking.is_future is True

    def test_booking_is_past(self):
        """Test past booking check."""
        now = datetime.utcnow()
        booking = ResourceBooking(
            id="book-1",
            resource_id="room-1",
            booked_by="user-1",
            title="Meeting",
            start_datetime=now - timedelta(hours=2),
            end_datetime=now - timedelta(hours=1),
        )

        assert booking.is_past is True

    def test_booking_to_dict(self):
        """Test dictionary conversion."""
        start = datetime.utcnow()
        end = start + timedelta(hours=1)

        booking = ResourceBooking(
            id="book-1",
            resource_id="room-1",
            booked_by="user-1",
            title="Meeting",
            start_datetime=start,
            end_datetime=end,
        )

        data = booking.to_dict()
        assert data["title"] == "Meeting"
        assert data["duration_minutes"] == 60


# ============================================================================
# CapacityPlan Tests
# ============================================================================

class TestCapacityPlan:
    """Tests for CapacityPlan class."""

    def test_plan_creation(self):
        """Test capacity plan creation."""
        plan = CapacityPlan(
            id="plan-1",
            name="Q1 2024 Plan",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
            total_capacity=1000.0,
            planned_capacity=800.0,
        )

        assert plan.name == "Q1 2024 Plan"
        assert plan.utilization_percentage == 80.0

    def test_plan_capacity_gap(self):
        """Test capacity gap calculation."""
        plan = CapacityPlan(
            id="plan-1",
            name="Plan",
            start_date=date.today(),
            total_capacity=100.0,
            planned_capacity=80.0,
            actual_capacity=60.0,
        )

        assert plan.capacity_gap == 20.0

    def test_plan_to_dict(self):
        """Test dictionary conversion."""
        plan = CapacityPlan(
            id="plan-1",
            name="Plan",
            start_date=date.today(),
            total_capacity=100.0,
        )

        data = plan.to_dict()
        assert data["name"] == "Plan"


# ============================================================================
# ResourceUtilization Tests
# ============================================================================

class TestResourceUtilization:
    """Tests for ResourceUtilization class."""

    def test_utilization_creation(self):
        """Test utilization record creation."""
        util = ResourceUtilization(
            id="util-1",
            resource_id="res-1",
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 7),
            total_capacity=40.0,
            allocated_capacity=32.0,
            actual_hours=35.0,
            billable_hours=30.0,
        )

        assert util.utilization_rate == 80.0
        assert util.billable_rate == pytest.approx(85.71, rel=0.01)

    def test_utilization_to_dict(self):
        """Test dictionary conversion."""
        util = ResourceUtilization(
            id="util-1",
            resource_id="res-1",
            period_start=date.today(),
            period_end=date.today(),
            total_capacity=40.0,
            allocated_capacity=30.0,
        )

        data = util.to_dict()
        assert data["utilization_rate"] == 75.0


# ============================================================================
# ResourceRegistry Tests
# ============================================================================

class TestResourceRegistry:
    """Tests for ResourceRegistry class."""

    def test_create_resource(self, registry):
        """Test resource creation."""
        resource = registry.create_resource(
            name="Test Resource",
            resource_type=ResourceType.EQUIPMENT,
        )

        assert resource.id is not None
        assert resource.name == "Test Resource"

    def test_get_resource(self, registry, person_resource):
        """Test resource retrieval."""
        retrieved = registry.get_resource(person_resource.id)
        assert retrieved == person_resource

    def test_get_resource_not_found(self, registry):
        """Test resource not found."""
        assert registry.get_resource("nonexistent") is None

    def test_update_resource(self, registry, person_resource):
        """Test resource update."""
        updated = registry.update_resource(
            person_resource.id,
            name="Jane Developer",
            capacity=35.0,
        )

        assert updated.name == "Jane Developer"
        assert updated.capacity == 35.0

    def test_delete_resource(self, registry, person_resource):
        """Test resource deletion."""
        result = registry.delete_resource(person_resource.id)
        assert result is True
        assert registry.get_resource(person_resource.id) is None

    def test_list_resources(self, registry):
        """Test listing resources."""
        registry.create_resource("R1", ResourceType.PERSON, workspace_id="ws-1")
        registry.create_resource("R2", ResourceType.EQUIPMENT, workspace_id="ws-1")
        registry.create_resource("R3", ResourceType.PERSON, workspace_id="ws-2")

        all_resources = registry.list_resources()
        assert len(all_resources) == 3

        ws1_resources = registry.list_resources(workspace_id="ws-1")
        assert len(ws1_resources) == 2

        people = registry.list_resources(resource_type=ResourceType.PERSON)
        assert len(people) == 2

    def test_list_resources_by_skill(self, registry):
        """Test listing resources by skill."""
        r1 = registry.create_resource("Dev 1", ResourceType.PERSON)
        r2 = registry.create_resource("Dev 2", ResourceType.PERSON)

        registry.add_resource_skill(r1.id, "Python", level=4)
        registry.add_resource_skill(r2.id, "Python", level=2)

        resources = registry.list_resources(skill_name="Python", min_skill_level=3)
        assert len(resources) == 1
        assert resources[0].id == r1.id

    def test_get_available_resources(self, registry):
        """Test getting available resources."""
        r1 = registry.create_resource("R1", ResourceType.PERSON, capacity=40.0)
        r2 = registry.create_resource("R2", ResourceType.PERSON, capacity=40.0)

        # Allocate r1
        allocation = registry.create_allocation(
            resource_id=r1.id,
            requester_id="user-1",
            allocated_capacity=40.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
        )
        registry.approve_allocation(allocation.id, "approver-1")

        available = registry.get_available_resources(
            date.today(),
            date.today() + timedelta(days=30),
            min_capacity=30.0,
        )

        assert len(available) == 1
        assert available[0].id == r2.id

    # Skill methods

    def test_add_resource_skill(self, registry, person_resource):
        """Test adding skill to resource."""
        skill = registry.add_resource_skill(
            person_resource.id,
            "Python",
            level=4,
            certified=True,
        )

        assert skill is not None
        assert skill.name == "Python"
        assert person_resource.has_skill("Python", 4)

    def test_find_resources_by_skills(self, registry):
        """Test finding resources by skills."""
        r1 = registry.create_resource("Dev 1", ResourceType.PERSON)
        r2 = registry.create_resource("Dev 2", ResourceType.PERSON)
        r3 = registry.create_resource("Dev 3", ResourceType.PERSON)

        registry.add_resource_skill(r1.id, "Python", level=4)
        registry.add_resource_skill(r1.id, "JavaScript", level=3)
        registry.add_resource_skill(r2.id, "Python", level=3)
        registry.add_resource_skill(r3.id, "JavaScript", level=4)

        # Match all skills
        matched = registry.find_resources_by_skills(
            [("Python", 3), ("JavaScript", 3)],
            match_all=True,
        )
        assert len(matched) == 1
        assert matched[0].id == r1.id

        # Match any skill
        matched = registry.find_resources_by_skills(
            [("Python", 4)],
            match_all=False,
        )
        assert len(matched) == 1

    # Availability methods

    def test_set_availability(self, registry, person_resource):
        """Test setting availability."""
        avail = registry.set_availability(
            person_resource.id,
            day_of_week=0,  # Monday
            start_time="09:00",
            end_time="17:00",
        )

        assert avail is not None
        assert avail.day_of_week == 0

    def test_get_availability(self, registry, person_resource):
        """Test getting availability."""
        registry.set_availability(person_resource.id, day_of_week=0)
        registry.set_availability(person_resource.id, day_of_week=1)

        avail = registry.get_availability(person_resource.id)
        assert len(avail) == 2

    # Allocation methods

    def test_create_allocation(self, registry, person_resource):
        """Test creating allocation."""
        allocation = registry.create_allocation(
            resource_id=person_resource.id,
            requester_id="user-1",
            project_id="proj-1",
            allocated_capacity=20.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
        )

        assert allocation is not None
        assert allocation.status == AllocationStatus.REQUESTED

    def test_approve_allocation(self, registry, person_resource):
        """Test approving allocation."""
        allocation = registry.create_allocation(
            resource_id=person_resource.id,
            requester_id="user-1",
            allocated_capacity=20.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
        )

        approved = registry.approve_allocation(allocation.id, "approver-1")
        assert approved.status == AllocationStatus.APPROVED

        # Resource should be partially allocated
        resource = registry.get_resource(person_resource.id)
        assert resource.status == ResourceStatus.PARTIALLY_ALLOCATED

    def test_complete_allocation(self, registry, person_resource):
        """Test completing allocation."""
        allocation = registry.create_allocation(
            resource_id=person_resource.id,
            requester_id="user-1",
            allocated_capacity=20.0,
        )

        registry.approve_allocation(allocation.id, "approver-1")
        registry.activate_allocation(allocation.id)
        completed = registry.complete_allocation(allocation.id)

        assert completed.status == AllocationStatus.COMPLETED

    def test_list_allocations(self, registry, person_resource):
        """Test listing allocations."""
        registry.create_allocation(person_resource.id, "user-1", project_id="proj-1")
        registry.create_allocation(person_resource.id, "user-2", project_id="proj-2")

        all_allocs = registry.list_allocations()
        assert len(all_allocs) == 2

        proj1_allocs = registry.list_allocations(project_id="proj-1")
        assert len(proj1_allocs) == 1

    # Booking methods

    def test_create_booking(self, registry, room_resource):
        """Test creating booking."""
        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=2)

        booking = registry.create_booking(
            resource_id=room_resource.id,
            booked_by="user-1",
            title="Team Meeting",
            start_datetime=start,
            end_datetime=end,
        )

        assert booking is not None
        assert booking.title == "Team Meeting"

    def test_booking_conflict(self, registry, room_resource):
        """Test booking conflict detection."""
        start1 = datetime.utcnow() + timedelta(hours=1)
        end1 = start1 + timedelta(hours=2)

        registry.create_booking(
            room_resource.id,
            "user-1",
            "Meeting 1",
            start1,
            end1,
        )

        # Overlapping booking should fail
        start2 = start1 + timedelta(minutes=30)
        end2 = end1 + timedelta(minutes=30)

        booking2 = registry.create_booking(
            room_resource.id,
            "user-2",
            "Meeting 2",
            start2,
            end2,
        )

        assert booking2 is None

    def test_cancel_booking(self, registry, room_resource):
        """Test cancelling booking."""
        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=1)

        booking = registry.create_booking(
            room_resource.id,
            "user-1",
            "Meeting",
            start,
            end,
        )

        cancelled = registry.cancel_booking(booking.id)
        assert cancelled.status == AllocationStatus.CANCELLED

    def test_list_bookings(self, registry, room_resource):
        """Test listing bookings."""
        start1 = datetime.utcnow() + timedelta(hours=1)
        start2 = datetime.utcnow() + timedelta(hours=3)

        registry.create_booking(room_resource.id, "user-1", "M1", start1, start1 + timedelta(hours=1))
        registry.create_booking(room_resource.id, "user-2", "M2", start2, start2 + timedelta(hours=1))

        bookings = registry.list_bookings(resource_id=room_resource.id)
        assert len(bookings) == 2

        user1_bookings = registry.list_bookings(booked_by="user-1")
        assert len(user1_bookings) == 1

    def test_get_resource_schedule(self, registry, room_resource):
        """Test getting resource schedule."""
        today = date.today()
        tomorrow = today + timedelta(days=1)

        start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
        registry.create_booking(
            room_resource.id,
            "user-1",
            "Meeting",
            start,
            start + timedelta(hours=1),
        )

        schedule = registry.get_resource_schedule(
            room_resource.id,
            today,
            tomorrow,
        )

        assert len(schedule) == 1

    # Capacity Plan methods

    def test_create_capacity_plan(self, registry):
        """Test creating capacity plan."""
        plan = registry.create_capacity_plan(
            name="Q1 Plan",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
            workspace_id="ws-1",
        )

        assert plan.name == "Q1 Plan"

    def test_update_capacity_plan(self, registry):
        """Test updating capacity plan."""
        plan = registry.create_capacity_plan("Plan", date.today())

        updated = registry.update_capacity_plan(
            plan.id,
            total_capacity=100.0,
            planned_capacity=80.0,
        )

        assert updated.total_capacity == 100.0
        assert updated.planned_capacity == 80.0

    def test_list_capacity_plans(self, registry):
        """Test listing capacity plans."""
        registry.create_capacity_plan("Plan 1", date.today(), workspace_id="ws-1")
        registry.create_capacity_plan("Plan 2", date.today(), workspace_id="ws-2")

        all_plans = registry.list_capacity_plans()
        assert len(all_plans) == 2

        ws1_plans = registry.list_capacity_plans(workspace_id="ws-1")
        assert len(ws1_plans) == 1

    # Utilization methods

    def test_record_utilization(self, registry, person_resource):
        """Test recording utilization."""
        util = registry.record_utilization(
            resource_id=person_resource.id,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 7),
            total_capacity=40.0,
            allocated_capacity=32.0,
            actual_hours=35.0,
            billable_hours=30.0,
        )

        assert util is not None
        assert util.utilization_rate == 80.0

    def test_get_utilization_history(self, registry, person_resource):
        """Test getting utilization history."""
        registry.record_utilization(
            person_resource.id,
            date(2024, 1, 1),
            date(2024, 1, 7),
            40.0, 32.0,
        )
        registry.record_utilization(
            person_resource.id,
            date(2024, 1, 8),
            date(2024, 1, 14),
            40.0, 36.0,
        )

        history = registry.get_utilization_history(person_resource.id)
        assert len(history) == 2

    # Statistics

    def test_get_stats(self, registry):
        """Test getting statistics."""
        registry.create_resource("Person 1", ResourceType.PERSON)
        registry.create_resource("Room 1", ResourceType.ROOM)

        stats = registry.get_stats()
        assert stats["total_resources"] == 2
        assert stats["resources_by_type"]["person"] == 1
        assert stats["resources_by_type"]["room"] == 1


# ============================================================================
# ResourceManager Tests
# ============================================================================

class TestResourceManager:
    """Tests for ResourceManager class."""

    def test_manager_creation(self, manager):
        """Test manager creation."""
        assert manager.registry is not None

    def test_create_resource(self, manager):
        """Test creating resource."""
        resource = manager.create_resource(
            name="Test",
            resource_type=ResourceType.EQUIPMENT,
        )

        assert resource.name == "Test"

    def test_create_person_resource(self, manager):
        """Test creating person resource."""
        person = manager.create_person_resource(
            name="John Doe",
            email="john@example.com",
            hourly_rate=100.0,
        )

        assert person.resource_type == ResourceType.PERSON
        assert person.capacity == 40.0  # Default 40 hours/week
        assert person.email == "john@example.com"

    def test_create_room_resource(self, manager):
        """Test creating room resource."""
        room = manager.create_room_resource(
            name="Conference A",
            location="Floor 1",
            capacity=10.0,
        )

        assert room.resource_type == ResourceType.ROOM
        assert room.location == "Floor 1"

    def test_create_equipment_resource(self, manager):
        """Test creating equipment resource."""
        equipment = manager.create_equipment_resource(
            name="Projector",
            description="4K Projector",
            daily_rate=50.0,
        )

        assert equipment.resource_type == ResourceType.EQUIPMENT
        assert equipment.daily_rate == 50.0

    def test_list_people(self, manager):
        """Test listing people."""
        manager.create_person_resource("Person 1", "p1@example.com")
        manager.create_person_resource("Person 2", "p2@example.com")
        manager.create_room_resource("Room 1", "Floor 1")

        people = manager.list_people()
        assert len(people) == 2

    def test_list_rooms(self, manager):
        """Test listing rooms."""
        manager.create_room_resource("Room 1", "Floor 1")
        manager.create_room_resource("Room 2", "Floor 2")

        rooms = manager.list_rooms()
        assert len(rooms) == 2

    def test_add_skill(self, manager):
        """Test adding skill."""
        person = manager.create_person_resource("Dev", "dev@example.com")
        skill = manager.add_skill(person.id, "Python", level=4)

        assert skill.name == "Python"

    def test_find_by_skills(self, manager):
        """Test finding by skills."""
        p1 = manager.create_person_resource("Dev 1", "d1@example.com")
        p2 = manager.create_person_resource("Dev 2", "d2@example.com")

        manager.add_skill(p1.id, "Python", level=4)
        manager.add_skill(p2.id, "Python", level=2)

        found = manager.find_by_skills([("Python", 3)])
        assert len(found) == 1
        assert found[0].id == p1.id

    def test_request_allocation(self, manager):
        """Test requesting allocation."""
        person = manager.create_person_resource("Dev", "dev@example.com")

        allocation = manager.request_allocation(
            resource_id=person.id,
            requester_id="user-1",
            project_id="proj-1",
            capacity=20.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
        )

        assert allocation is not None
        assert allocation.status == AllocationStatus.REQUESTED

    def test_approve_and_activate_allocation(self, manager):
        """Test approving and activating allocation."""
        person = manager.create_person_resource("Dev", "dev@example.com")

        allocation = manager.request_allocation(
            person.id, "user-1", capacity=20.0
        )

        approved = manager.approve_allocation(allocation.id, "manager-1")
        assert approved.status == AllocationStatus.APPROVED

        activated = manager.activate_allocation(allocation.id)
        assert activated.status == AllocationStatus.ACTIVE

    def test_get_pending_allocations(self, manager):
        """Test getting pending allocations."""
        person = manager.create_person_resource("Dev", "dev@example.com")

        manager.request_allocation(person.id, "user-1")
        manager.request_allocation(person.id, "user-2")

        pending = manager.get_pending_allocations()
        assert len(pending) == 2

    def test_book_resource(self, manager):
        """Test booking resource."""
        room = manager.create_room_resource("Room", "Floor 1")

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=2)

        booking = manager.book_resource(
            room.id,
            "user-1",
            "Meeting",
            start,
            end,
        )

        assert booking is not None

    def test_check_availability(self, manager):
        """Test checking availability."""
        room = manager.create_room_resource("Room", "Floor 1")

        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=2)

        # Initially available
        assert manager.check_availability(room.id, start, end) is True

        # Book it
        manager.book_resource(room.id, "user-1", "Meeting", start, end)

        # Now not available
        assert manager.check_availability(room.id, start, end) is False

    def test_get_schedule(self, manager):
        """Test getting schedule."""
        room = manager.create_room_resource("Room", "Floor 1")

        today = date.today()
        start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)

        manager.book_resource(
            room.id,
            "user-1",
            "Meeting",
            start,
            start + timedelta(hours=1),
        )

        schedule = manager.get_schedule(room.id, today, today + timedelta(days=1))
        assert len(schedule) == 1

    def test_create_capacity_plan(self, manager):
        """Test creating capacity plan."""
        plan = manager.create_capacity_plan(
            name="Q1 Plan",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )

        assert plan.name == "Q1 Plan"

    def test_record_utilization(self, manager):
        """Test recording utilization."""
        person = manager.create_person_resource("Dev", "dev@example.com")

        util = manager.record_utilization(
            person.id,
            date(2024, 1, 1),
            date(2024, 1, 7),
            actual_hours=35.0,
            billable_hours=30.0,
        )

        assert util is not None

    def test_get_resource_summary(self, manager):
        """Test getting resource summary."""
        person = manager.create_person_resource("Dev", "dev@example.com")
        manager.request_allocation(person.id, "user-1")

        summary = manager.get_resource_summary(person.id)
        assert summary["resource"]["name"] == "Dev"
        assert summary["total_allocations"] == 1

    def test_get_team_utilization(self, manager):
        """Test getting team utilization."""
        p1 = manager.create_person_resource("Dev 1", "d1@example.com", team_id="team-1")
        p2 = manager.create_person_resource("Dev 2", "d2@example.com", team_id="team-1")

        # Set some allocated capacity
        p1.metadata["allocated_capacity"] = 20.0
        p2.metadata["allocated_capacity"] = 30.0

        util = manager.get_team_utilization("team-1", date.today(), date.today())

        assert util["total_resources"] == 2
        assert util["total_capacity"] == 80.0  # 40 + 40
        assert util["total_allocated"] == 50.0  # 20 + 30

    def test_get_stats(self, manager):
        """Test getting statistics."""
        manager.create_person_resource("Person", "p@example.com")
        manager.create_room_resource("Room", "Floor 1")

        stats = manager.get_stats()
        assert stats["total_resources"] == 2


# ============================================================================
# Global Instance Tests
# ============================================================================

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_resource_manager()

    def test_get_resource_manager(self):
        """Test getting global manager."""
        manager = get_resource_manager()
        assert manager is not None
        assert isinstance(manager, ResourceManager)

    def test_get_resource_manager_singleton(self):
        """Test global manager is singleton."""
        manager1 = get_resource_manager()
        manager2 = get_resource_manager()
        assert manager1 is manager2

    def test_set_resource_manager(self):
        """Test setting global manager."""
        custom_manager = ResourceManager()
        set_resource_manager(custom_manager)
        assert get_resource_manager() is custom_manager

    def test_reset_resource_manager(self):
        """Test resetting global manager."""
        manager1 = get_resource_manager()
        reset_resource_manager()
        manager2 = get_resource_manager()
        assert manager1 is not manager2


# ============================================================================
# Integration Tests
# ============================================================================

class TestResourceIntegration:
    """Integration tests for resource management."""

    def test_full_allocation_workflow(self, manager):
        """Test complete allocation workflow."""
        # Create person resource
        developer = manager.create_person_resource(
            name="Alice Developer",
            email="alice@example.com",
            workspace_id="ws-1",
            team_id="dev-team",
            hourly_rate=150.0,
        )

        # Add skills
        manager.add_skill(developer.id, "Python", level=5, certified=True)
        manager.add_skill(developer.id, "React", level=4)

        # Request allocation to project
        allocation = manager.request_allocation(
            resource_id=developer.id,
            requester_id="pm-1",
            project_id="project-alpha",
            capacity=30.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
            priority=AllocationPriority.HIGH,
        )

        assert allocation.status == AllocationStatus.REQUESTED

        # Manager approves
        manager.approve_allocation(allocation.id, "director-1")
        allocation = manager.get_allocation(allocation.id)
        assert allocation.status == AllocationStatus.APPROVED

        # PM activates when work starts
        manager.activate_allocation(allocation.id)
        allocation = manager.get_allocation(allocation.id)
        assert allocation.status == AllocationStatus.ACTIVE

        # Check resource status
        resource = manager.get_resource(developer.id)
        assert resource.status == ResourceStatus.PARTIALLY_ALLOCATED

        # Complete allocation
        manager.complete_allocation(allocation.id)
        allocation = manager.get_allocation(allocation.id)
        assert allocation.status == AllocationStatus.COMPLETED

    def test_room_booking_workflow(self, manager):
        """Test room booking workflow."""
        # Create conference room
        room = manager.create_room_resource(
            name="Board Room",
            location="Executive Floor",
            workspace_id="ws-1",
            capacity=20.0,
        )

        # Check availability
        start = datetime.utcnow() + timedelta(hours=1)
        end = start + timedelta(hours=2)

        assert manager.check_availability(room.id, start, end) is True

        # Book the room
        booking = manager.book_resource(
            resource_id=room.id,
            booked_by="exec-1",
            title="Board Meeting",
            start_datetime=start,
            end_datetime=end,
            attendees={"exec-1", "exec-2", "exec-3"},
        )

        assert booking is not None

        # Try to book overlapping time
        start2 = start + timedelta(minutes=30)
        end2 = end + timedelta(minutes=30)

        booking2 = manager.book_resource(
            room.id, "user-1", "Conflict", start2, end2
        )

        assert booking2 is None

        # Check schedule
        schedule = manager.get_schedule(
            room.id,
            date.today(),
            date.today() + timedelta(days=1),
        )

        assert len(schedule) == 1
        assert schedule[0].title == "Board Meeting"

    def test_capacity_planning_workflow(self, manager):
        """Test capacity planning workflow."""
        # Create team members
        team_id = "engineering-team"
        dev1 = manager.create_person_resource("Dev 1", "d1@example.com", team_id=team_id)
        dev2 = manager.create_person_resource("Dev 2", "d2@example.com", team_id=team_id)
        dev3 = manager.create_person_resource("Dev 3", "d3@example.com", team_id=team_id)

        # Create capacity plan
        plan = manager.create_capacity_plan(
            name="Q1 Engineering Plan",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
            workspace_id="ws-1",
            created_by="eng-manager",
        )

        # Set capacity metrics
        total_capacity = 40 * 3 * 13  # 3 devs, 13 weeks
        planned_capacity = total_capacity * 0.85  # 85% utilization target

        manager.update_capacity_plan(
            plan.id,
            total_capacity=total_capacity,
            planned_capacity=planned_capacity,
        )

        # Allocate resources
        manager.request_allocation(dev1.id, "pm-1", capacity=35.0)
        manager.request_allocation(dev2.id, "pm-1", capacity=30.0)
        manager.request_allocation(dev3.id, "pm-2", capacity=38.0)

        # Check team utilization
        dev1.metadata["allocated_capacity"] = 35.0
        dev2.metadata["allocated_capacity"] = 30.0
        dev3.metadata["allocated_capacity"] = 38.0

        team_util = manager.get_team_utilization(
            team_id,
            date(2024, 1, 1),
            date(2024, 1, 7),
        )

        assert team_util["total_resources"] == 3
        assert team_util["total_allocated"] == 103.0

    def test_skill_based_resource_matching(self, manager):
        """Test finding resources by skills."""
        # Create developers with different skills
        senior = manager.create_person_resource("Senior Dev", "senior@example.com")
        manager.add_skill(senior.id, "Python", level=5)
        manager.add_skill(senior.id, "AWS", level=4, certified=True)
        manager.add_skill(senior.id, "Kubernetes", level=3)

        mid = manager.create_person_resource("Mid Dev", "mid@example.com")
        manager.add_skill(mid.id, "Python", level=3)
        manager.add_skill(mid.id, "React", level=4)

        junior = manager.create_person_resource("Junior Dev", "junior@example.com")
        manager.add_skill(junior.id, "Python", level=2)
        manager.add_skill(junior.id, "HTML", level=3)

        # Find Python experts
        python_experts = manager.find_by_skills([("Python", 4)])
        assert len(python_experts) == 1
        assert python_experts[0].name == "Senior Dev"

        # Find any Python developers
        python_devs = manager._registry.find_resources_by_skills(
            [("Python", 2)],
            match_all=False,
        )
        assert len(python_devs) == 3
