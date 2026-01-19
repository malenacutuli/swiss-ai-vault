"""
Resource Management module for SwissBrain.ai collaboration system.

This module provides enterprise resource management features including:
- Resource types (people, equipment, rooms, etc.)
- Resource allocation and assignments
- Capacity planning
- Resource scheduling
- Availability tracking
- Utilization reports
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid


class ResourceType(str, Enum):
    """Type of resource."""
    PERSON = "person"
    EQUIPMENT = "equipment"
    ROOM = "room"
    VEHICLE = "vehicle"
    SOFTWARE = "software"
    MATERIAL = "material"
    BUDGET = "budget"
    OTHER = "other"


class ResourceStatus(str, Enum):
    """Status of a resource."""
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    PARTIALLY_ALLOCATED = "partially_allocated"
    UNAVAILABLE = "unavailable"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"
    RETIRED = "retired"


class AllocationStatus(str, Enum):
    """Status of an allocation."""
    REQUESTED = "requested"
    APPROVED = "approved"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class AllocationPriority(str, Enum):
    """Priority of an allocation."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CapacityUnit(str, Enum):
    """Unit for capacity measurement."""
    HOURS = "hours"
    DAYS = "days"
    PERCENTAGE = "percentage"
    UNITS = "units"
    QUANTITY = "quantity"


class ScheduleType(str, Enum):
    """Type of schedule."""
    FIXED = "fixed"
    FLEXIBLE = "flexible"
    RECURRING = "recurring"
    ON_DEMAND = "on_demand"


@dataclass
class ResourceSkill:
    """A skill or capability of a resource."""
    id: str
    name: str
    level: int = 1  # 1-5 proficiency level
    description: str = ""
    certified: bool = False
    certification_date: Optional[date] = None
    expiry_date: Optional[date] = None

    @property
    def is_valid(self) -> bool:
        """Check if skill certification is valid."""
        if not self.certified:
            return True
        if self.expiry_date:
            return date.today() <= self.expiry_date
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "level": self.level,
            "description": self.description,
            "certified": self.certified,
            "certification_date": self.certification_date.isoformat() if self.certification_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "is_valid": self.is_valid,
        }


@dataclass
class ResourceAvailability:
    """Availability window for a resource."""
    id: str
    resource_id: str
    day_of_week: Optional[int] = None  # 0=Monday, 6=Sunday, None=specific date
    specific_date: Optional[date] = None
    start_time: str = "09:00"
    end_time: str = "17:00"
    is_available: bool = True
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "day_of_week": self.day_of_week,
            "specific_date": self.specific_date.isoformat() if self.specific_date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_available": self.is_available,
            "notes": self.notes,
        }


@dataclass
class Resource:
    """A manageable resource."""
    id: str
    name: str
    resource_type: ResourceType
    workspace_id: Optional[str] = None
    team_id: Optional[str] = None
    owner_id: Optional[str] = None
    status: ResourceStatus = ResourceStatus.AVAILABLE
    description: str = ""
    capacity: float = 1.0
    capacity_unit: CapacityUnit = CapacityUnit.UNITS
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    location: str = ""
    email: str = ""
    phone: str = ""
    skills: List[ResourceSkill] = field(default_factory=list)
    tags: Set[str] = field(default_factory=set)
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def allocated_capacity(self) -> float:
        """Get currently allocated capacity (set externally)."""
        return self.metadata.get("allocated_capacity", 0.0)

    @property
    def available_capacity(self) -> float:
        """Get available capacity."""
        return max(0.0, self.capacity - self.allocated_capacity)

    @property
    def utilization_percentage(self) -> float:
        """Get utilization percentage."""
        if self.capacity == 0:
            return 0.0
        return (self.allocated_capacity / self.capacity) * 100

    def add_skill(self, skill: ResourceSkill) -> None:
        """Add a skill to the resource."""
        self.skills.append(skill)
        self.updated_at = datetime.utcnow()

    def remove_skill(self, skill_id: str) -> bool:
        """Remove a skill from the resource."""
        for i, skill in enumerate(self.skills):
            if skill.id == skill_id:
                del self.skills[i]
                self.updated_at = datetime.utcnow()
                return True
        return False

    def has_skill(self, skill_name: str, min_level: int = 1) -> bool:
        """Check if resource has a skill at minimum level."""
        for skill in self.skills:
            if skill.name.lower() == skill_name.lower() and skill.level >= min_level:
                return skill.is_valid
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "resource_type": self.resource_type.value,
            "workspace_id": self.workspace_id,
            "team_id": self.team_id,
            "owner_id": self.owner_id,
            "status": self.status.value,
            "description": self.description,
            "capacity": self.capacity,
            "capacity_unit": self.capacity_unit.value,
            "allocated_capacity": self.allocated_capacity,
            "available_capacity": self.available_capacity,
            "utilization_percentage": self.utilization_percentage,
            "hourly_rate": self.hourly_rate,
            "daily_rate": self.daily_rate,
            "location": self.location,
            "email": self.email,
            "phone": self.phone,
            "skills": [s.to_dict() for s in self.skills],
            "tags": list(self.tags),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "metadata": self.metadata,
        }


@dataclass
class ResourceAllocation:
    """An allocation of a resource to a project or task."""
    id: str
    resource_id: str
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    requester_id: str = ""
    approver_id: Optional[str] = None
    status: AllocationStatus = AllocationStatus.REQUESTED
    priority: AllocationPriority = AllocationPriority.MEDIUM
    allocated_capacity: float = 1.0
    capacity_unit: CapacityUnit = CapacityUnit.UNITS
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

    @property
    def duration_days(self) -> int:
        """Get allocation duration in days."""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0

    @property
    def is_active(self) -> bool:
        """Check if allocation is currently active."""
        if self.status != AllocationStatus.ACTIVE:
            return False
        today = date.today()
        if self.start_date and self.end_date:
            return self.start_date <= today <= self.end_date
        return True

    @property
    def is_overdue(self) -> bool:
        """Check if allocation is overdue."""
        if self.status in (AllocationStatus.COMPLETED, AllocationStatus.CANCELLED):
            return False
        if self.end_date:
            return date.today() > self.end_date
        return False

    def approve(self, approver_id: str) -> None:
        """Approve the allocation."""
        self.status = AllocationStatus.APPROVED
        self.approver_id = approver_id
        self.approved_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def activate(self) -> None:
        """Activate the allocation."""
        self.status = AllocationStatus.ACTIVE
        self.actual_start = date.today()
        self.updated_at = datetime.utcnow()

    def complete(self) -> None:
        """Complete the allocation."""
        self.status = AllocationStatus.COMPLETED
        self.actual_end = date.today()
        self.updated_at = datetime.utcnow()

    def cancel(self) -> None:
        """Cancel the allocation."""
        self.status = AllocationStatus.CANCELLED
        self.updated_at = datetime.utcnow()

    def reject(self) -> None:
        """Reject the allocation."""
        self.status = AllocationStatus.REJECTED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "requester_id": self.requester_id,
            "approver_id": self.approver_id,
            "status": self.status.value,
            "priority": self.priority.value,
            "allocated_capacity": self.allocated_capacity,
            "capacity_unit": self.capacity_unit.value,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "actual_start": self.actual_start.isoformat() if self.actual_start else None,
            "actual_end": self.actual_end.isoformat() if self.actual_end else None,
            "duration_days": self.duration_days,
            "is_active": self.is_active,
            "is_overdue": self.is_overdue,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
        }


@dataclass
class ResourceBooking:
    """A booking/reservation for a resource."""
    id: str
    resource_id: str
    booked_by: str
    title: str
    start_datetime: datetime
    end_datetime: datetime
    status: AllocationStatus = AllocationStatus.APPROVED
    schedule_type: ScheduleType = ScheduleType.FIXED
    recurrence_rule: Optional[str] = None  # iCal RRULE format
    location: str = ""
    description: str = ""
    attendees: Set[str] = field(default_factory=set)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @property
    def duration_minutes(self) -> int:
        """Get booking duration in minutes."""
        delta = self.end_datetime - self.start_datetime
        return int(delta.total_seconds() / 60)

    @property
    def is_current(self) -> bool:
        """Check if booking is currently active."""
        now = datetime.utcnow()
        return self.start_datetime <= now <= self.end_datetime

    @property
    def is_past(self) -> bool:
        """Check if booking is in the past."""
        return datetime.utcnow() > self.end_datetime

    @property
    def is_future(self) -> bool:
        """Check if booking is in the future."""
        return datetime.utcnow() < self.start_datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "booked_by": self.booked_by,
            "title": self.title,
            "start_datetime": self.start_datetime.isoformat(),
            "end_datetime": self.end_datetime.isoformat(),
            "status": self.status.value,
            "schedule_type": self.schedule_type.value,
            "recurrence_rule": self.recurrence_rule,
            "location": self.location,
            "description": self.description,
            "attendees": list(self.attendees),
            "duration_minutes": self.duration_minutes,
            "is_current": self.is_current,
            "is_past": self.is_past,
            "is_future": self.is_future,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


@dataclass
class CapacityPlan:
    """A capacity plan for resource planning."""
    id: str
    name: str
    workspace_id: Optional[str] = None
    start_date: date = field(default_factory=date.today)
    end_date: Optional[date] = None
    period_type: str = "weekly"  # daily, weekly, monthly, quarterly
    total_capacity: float = 0.0
    planned_capacity: float = 0.0
    actual_capacity: float = 0.0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: str = ""

    @property
    def capacity_gap(self) -> float:
        """Get gap between planned and actual capacity."""
        return self.planned_capacity - self.actual_capacity

    @property
    def utilization_percentage(self) -> float:
        """Get planned utilization percentage."""
        if self.total_capacity == 0:
            return 0.0
        return (self.planned_capacity / self.total_capacity) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "workspace_id": self.workspace_id,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "period_type": self.period_type,
            "total_capacity": self.total_capacity,
            "planned_capacity": self.planned_capacity,
            "actual_capacity": self.actual_capacity,
            "capacity_gap": self.capacity_gap,
            "utilization_percentage": self.utilization_percentage,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }


@dataclass
class ResourceUtilization:
    """Utilization record for a resource."""
    id: str
    resource_id: str
    period_start: date
    period_end: date
    total_capacity: float
    allocated_capacity: float
    actual_hours: float = 0.0
    billable_hours: float = 0.0
    workspace_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def utilization_rate(self) -> float:
        """Get utilization rate."""
        if self.total_capacity == 0:
            return 0.0
        return (self.allocated_capacity / self.total_capacity) * 100

    @property
    def billable_rate(self) -> float:
        """Get billable rate percentage."""
        if self.actual_hours == 0:
            return 0.0
        return (self.billable_hours / self.actual_hours) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_capacity": self.total_capacity,
            "allocated_capacity": self.allocated_capacity,
            "actual_hours": self.actual_hours,
            "billable_hours": self.billable_hours,
            "utilization_rate": self.utilization_rate,
            "billable_rate": self.billable_rate,
            "workspace_id": self.workspace_id,
            "created_at": self.created_at.isoformat(),
        }


class ResourceRegistry:
    """Registry for resource management entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._resources: Dict[str, Resource] = {}
        self._allocations: Dict[str, ResourceAllocation] = {}
        self._bookings: Dict[str, ResourceBooking] = {}
        self._availability: Dict[str, List[ResourceAvailability]] = {}
        self._capacity_plans: Dict[str, CapacityPlan] = {}
        self._utilization: Dict[str, List[ResourceUtilization]] = {}

    # Resource CRUD
    def create_resource(
        self,
        name: str,
        resource_type: ResourceType,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        description: str = "",
        capacity: float = 1.0,
        capacity_unit: CapacityUnit = CapacityUnit.UNITS,
        hourly_rate: Optional[float] = None,
        daily_rate: Optional[float] = None,
        location: str = "",
        email: str = "",
        tags: Optional[Set[str]] = None,
    ) -> Resource:
        """Create a resource."""
        resource_id = str(uuid.uuid4())
        resource = Resource(
            id=resource_id,
            name=name,
            resource_type=resource_type,
            workspace_id=workspace_id,
            team_id=team_id,
            owner_id=owner_id,
            description=description,
            capacity=capacity,
            capacity_unit=capacity_unit,
            hourly_rate=hourly_rate,
            daily_rate=daily_rate,
            location=location,
            email=email,
            tags=tags or set(),
        )

        self._resources[resource_id] = resource
        self._availability[resource_id] = []

        return resource

    def get_resource(self, resource_id: str) -> Optional[Resource]:
        """Get a resource by ID."""
        return self._resources.get(resource_id)

    def update_resource(
        self,
        resource_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[ResourceStatus] = None,
        capacity: Optional[float] = None,
        hourly_rate: Optional[float] = None,
        daily_rate: Optional[float] = None,
        location: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Resource]:
        """Update a resource."""
        resource = self._resources.get(resource_id)
        if not resource:
            return None

        if name is not None:
            resource.name = name
        if description is not None:
            resource.description = description
        if status is not None:
            resource.status = status
        if capacity is not None:
            resource.capacity = capacity
        if hourly_rate is not None:
            resource.hourly_rate = hourly_rate
        if daily_rate is not None:
            resource.daily_rate = daily_rate
        if location is not None:
            resource.location = location
        if tags is not None:
            resource.tags = tags
        if is_active is not None:
            resource.is_active = is_active

        resource.updated_at = datetime.utcnow()
        return resource

    def delete_resource(self, resource_id: str) -> bool:
        """Delete a resource."""
        if resource_id not in self._resources:
            return False

        del self._resources[resource_id]
        self._availability.pop(resource_id, None)

        # Remove related allocations
        to_remove = [
            aid for aid, a in self._allocations.items()
            if a.resource_id == resource_id
        ]
        for aid in to_remove:
            del self._allocations[aid]

        # Remove related bookings
        to_remove = [
            bid for bid, b in self._bookings.items()
            if b.resource_id == resource_id
        ]
        for bid in to_remove:
            del self._bookings[bid]

        return True

    def list_resources(
        self,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        resource_type: Optional[ResourceType] = None,
        status: Optional[ResourceStatus] = None,
        is_active: Optional[bool] = None,
        tags: Optional[Set[str]] = None,
        skill_name: Optional[str] = None,
        min_skill_level: int = 1,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Resource]:
        """List resources with filters."""
        resources = list(self._resources.values())

        if workspace_id:
            resources = [r for r in resources if r.workspace_id == workspace_id]
        if team_id:
            resources = [r for r in resources if r.team_id == team_id]
        if resource_type:
            resources = [r for r in resources if r.resource_type == resource_type]
        if status:
            resources = [r for r in resources if r.status == status]
        if is_active is not None:
            resources = [r for r in resources if r.is_active == is_active]
        if tags:
            resources = [r for r in resources if tags & r.tags]
        if skill_name:
            resources = [
                r for r in resources
                if r.has_skill(skill_name, min_skill_level)
            ]

        resources.sort(key=lambda r: r.name)
        return resources[offset:offset + limit]

    def get_available_resources(
        self,
        start_date: date,
        end_date: date,
        resource_type: Optional[ResourceType] = None,
        workspace_id: Optional[str] = None,
        min_capacity: float = 0.0,
    ) -> List[Resource]:
        """Get resources available in a date range."""
        resources = self.list_resources(
            workspace_id=workspace_id,
            resource_type=resource_type,
            is_active=True,
        )

        available = []
        for resource in resources:
            if resource.status in (ResourceStatus.UNAVAILABLE, ResourceStatus.RETIRED):
                continue

            # Check if resource has enough available capacity
            allocated = self._get_allocated_capacity(
                resource.id, start_date, end_date
            )
            if resource.capacity - allocated >= min_capacity:
                available.append(resource)

        return available

    def _get_allocated_capacity(
        self,
        resource_id: str,
        start_date: date,
        end_date: date,
    ) -> float:
        """Get allocated capacity for a resource in a date range."""
        total = 0.0
        for allocation in self._allocations.values():
            if allocation.resource_id != resource_id:
                continue
            if allocation.status not in (
                AllocationStatus.APPROVED,
                AllocationStatus.ACTIVE,
            ):
                continue
            if allocation.start_date and allocation.end_date:
                # Check for overlap
                if (allocation.start_date <= end_date and
                        allocation.end_date >= start_date):
                    total += allocation.allocated_capacity
        return total

    # Skill methods
    def add_resource_skill(
        self,
        resource_id: str,
        name: str,
        level: int = 1,
        description: str = "",
        certified: bool = False,
        certification_date: Optional[date] = None,
        expiry_date: Optional[date] = None,
    ) -> Optional[ResourceSkill]:
        """Add a skill to a resource."""
        resource = self._resources.get(resource_id)
        if not resource:
            return None

        skill_id = str(uuid.uuid4())
        skill = ResourceSkill(
            id=skill_id,
            name=name,
            level=level,
            description=description,
            certified=certified,
            certification_date=certification_date,
            expiry_date=expiry_date,
        )

        resource.add_skill(skill)
        return skill

    def remove_resource_skill(self, resource_id: str, skill_id: str) -> bool:
        """Remove a skill from a resource."""
        resource = self._resources.get(resource_id)
        if not resource:
            return False
        return resource.remove_skill(skill_id)

    def find_resources_by_skills(
        self,
        skills: List[Tuple[str, int]],  # [(skill_name, min_level), ...]
        workspace_id: Optional[str] = None,
        match_all: bool = True,
    ) -> List[Resource]:
        """Find resources matching skill requirements."""
        resources = self.list_resources(workspace_id=workspace_id, is_active=True)
        matched = []

        for resource in resources:
            if match_all:
                # Must have all skills
                has_all = all(
                    resource.has_skill(name, level)
                    for name, level in skills
                )
                if has_all:
                    matched.append(resource)
            else:
                # Must have at least one skill
                has_any = any(
                    resource.has_skill(name, level)
                    for name, level in skills
                )
                if has_any:
                    matched.append(resource)

        return matched

    # Availability methods
    def set_availability(
        self,
        resource_id: str,
        day_of_week: Optional[int] = None,
        specific_date: Optional[date] = None,
        start_time: str = "09:00",
        end_time: str = "17:00",
        is_available: bool = True,
        notes: str = "",
    ) -> Optional[ResourceAvailability]:
        """Set availability for a resource."""
        if resource_id not in self._resources:
            return None

        avail_id = str(uuid.uuid4())
        availability = ResourceAvailability(
            id=avail_id,
            resource_id=resource_id,
            day_of_week=day_of_week,
            specific_date=specific_date,
            start_time=start_time,
            end_time=end_time,
            is_available=is_available,
            notes=notes,
        )

        self._availability[resource_id].append(availability)
        return availability

    def get_availability(self, resource_id: str) -> List[ResourceAvailability]:
        """Get availability settings for a resource."""
        return self._availability.get(resource_id, [])

    def clear_availability(self, resource_id: str) -> bool:
        """Clear all availability settings for a resource."""
        if resource_id in self._availability:
            self._availability[resource_id] = []
            return True
        return False

    # Allocation CRUD
    def create_allocation(
        self,
        resource_id: str,
        requester_id: str,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        allocated_capacity: float = 1.0,
        capacity_unit: CapacityUnit = CapacityUnit.UNITS,
        priority: AllocationPriority = AllocationPriority.MEDIUM,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        notes: str = "",
    ) -> Optional[ResourceAllocation]:
        """Create a resource allocation request."""
        if resource_id not in self._resources:
            return None

        allocation_id = str(uuid.uuid4())
        allocation = ResourceAllocation(
            id=allocation_id,
            resource_id=resource_id,
            project_id=project_id,
            task_id=task_id,
            requester_id=requester_id,
            allocated_capacity=allocated_capacity,
            capacity_unit=capacity_unit,
            priority=priority,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
        )

        self._allocations[allocation_id] = allocation
        return allocation

    def get_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Get an allocation by ID."""
        return self._allocations.get(allocation_id)

    def update_allocation(
        self,
        allocation_id: str,
        allocated_capacity: Optional[float] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        priority: Optional[AllocationPriority] = None,
        notes: Optional[str] = None,
    ) -> Optional[ResourceAllocation]:
        """Update an allocation."""
        allocation = self._allocations.get(allocation_id)
        if not allocation:
            return None

        if allocated_capacity is not None:
            allocation.allocated_capacity = allocated_capacity
        if start_date is not None:
            allocation.start_date = start_date
        if end_date is not None:
            allocation.end_date = end_date
        if priority is not None:
            allocation.priority = priority
        if notes is not None:
            allocation.notes = notes

        allocation.updated_at = datetime.utcnow()
        return allocation

    def delete_allocation(self, allocation_id: str) -> bool:
        """Delete an allocation."""
        if allocation_id in self._allocations:
            del self._allocations[allocation_id]
            return True
        return False

    def approve_allocation(
        self,
        allocation_id: str,
        approver_id: str,
    ) -> Optional[ResourceAllocation]:
        """Approve an allocation."""
        allocation = self._allocations.get(allocation_id)
        if allocation:
            allocation.approve(approver_id)
            self._update_resource_allocated_capacity(allocation.resource_id)
        return allocation

    def activate_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Activate an allocation."""
        allocation = self._allocations.get(allocation_id)
        if allocation:
            allocation.activate()
        return allocation

    def complete_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Complete an allocation."""
        allocation = self._allocations.get(allocation_id)
        if allocation:
            allocation.complete()
            self._update_resource_allocated_capacity(allocation.resource_id)
        return allocation

    def cancel_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Cancel an allocation."""
        allocation = self._allocations.get(allocation_id)
        if allocation:
            allocation.cancel()
            self._update_resource_allocated_capacity(allocation.resource_id)
        return allocation

    def _update_resource_allocated_capacity(self, resource_id: str) -> None:
        """Update the allocated capacity for a resource."""
        resource = self._resources.get(resource_id)
        if not resource:
            return

        today = date.today()
        total = 0.0
        for allocation in self._allocations.values():
            if allocation.resource_id != resource_id:
                continue
            if allocation.status not in (
                AllocationStatus.APPROVED,
                AllocationStatus.ACTIVE,
            ):
                continue
            if allocation.start_date and allocation.end_date:
                if allocation.start_date <= today <= allocation.end_date:
                    total += allocation.allocated_capacity
            else:
                total += allocation.allocated_capacity

        resource.metadata["allocated_capacity"] = total

        # Update resource status based on utilization
        if total >= resource.capacity:
            resource.status = ResourceStatus.ALLOCATED
        elif total > 0:
            resource.status = ResourceStatus.PARTIALLY_ALLOCATED
        else:
            resource.status = ResourceStatus.AVAILABLE

    def list_allocations(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        requester_id: Optional[str] = None,
        status: Optional[AllocationStatus] = None,
        priority: Optional[AllocationPriority] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ResourceAllocation]:
        """List allocations with filters."""
        allocations = list(self._allocations.values())

        if resource_id:
            allocations = [a for a in allocations if a.resource_id == resource_id]
        if project_id:
            allocations = [a for a in allocations if a.project_id == project_id]
        if requester_id:
            allocations = [a for a in allocations if a.requester_id == requester_id]
        if status:
            allocations = [a for a in allocations if a.status == status]
        if priority:
            allocations = [a for a in allocations if a.priority == priority]
        if start_date:
            allocations = [
                a for a in allocations
                if a.start_date and a.start_date >= start_date
            ]
        if end_date:
            allocations = [
                a for a in allocations
                if a.end_date and a.end_date <= end_date
            ]

        allocations.sort(key=lambda a: a.created_at, reverse=True)
        return allocations[offset:offset + limit]

    # Booking methods
    def create_booking(
        self,
        resource_id: str,
        booked_by: str,
        title: str,
        start_datetime: datetime,
        end_datetime: datetime,
        schedule_type: ScheduleType = ScheduleType.FIXED,
        recurrence_rule: Optional[str] = None,
        location: str = "",
        description: str = "",
        attendees: Optional[Set[str]] = None,
    ) -> Optional[ResourceBooking]:
        """Create a resource booking."""
        if resource_id not in self._resources:
            return None

        # Check for conflicts
        if self._has_booking_conflict(resource_id, start_datetime, end_datetime):
            return None

        booking_id = str(uuid.uuid4())
        booking = ResourceBooking(
            id=booking_id,
            resource_id=resource_id,
            booked_by=booked_by,
            title=title,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            schedule_type=schedule_type,
            recurrence_rule=recurrence_rule,
            location=location,
            description=description,
            attendees=attendees or set(),
        )

        self._bookings[booking_id] = booking
        return booking

    def _has_booking_conflict(
        self,
        resource_id: str,
        start_datetime: datetime,
        end_datetime: datetime,
        exclude_booking_id: Optional[str] = None,
    ) -> bool:
        """Check if there's a booking conflict."""
        for booking in self._bookings.values():
            if booking.resource_id != resource_id:
                continue
            if booking.status == AllocationStatus.CANCELLED:
                continue
            if exclude_booking_id and booking.id == exclude_booking_id:
                continue
            # Check for overlap
            if (start_datetime < booking.end_datetime and
                    end_datetime > booking.start_datetime):
                return True
        return False

    def get_booking(self, booking_id: str) -> Optional[ResourceBooking]:
        """Get a booking by ID."""
        return self._bookings.get(booking_id)

    def update_booking(
        self,
        booking_id: str,
        title: Optional[str] = None,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None,
        location: Optional[str] = None,
        description: Optional[str] = None,
        attendees: Optional[Set[str]] = None,
    ) -> Optional[ResourceBooking]:
        """Update a booking."""
        booking = self._bookings.get(booking_id)
        if not booking:
            return None

        # Check for conflicts if time changed
        new_start = start_datetime or booking.start_datetime
        new_end = end_datetime or booking.end_datetime
        if start_datetime or end_datetime:
            if self._has_booking_conflict(
                booking.resource_id, new_start, new_end, booking_id
            ):
                return None

        if title is not None:
            booking.title = title
        if start_datetime is not None:
            booking.start_datetime = start_datetime
        if end_datetime is not None:
            booking.end_datetime = end_datetime
        if location is not None:
            booking.location = location
        if description is not None:
            booking.description = description
        if attendees is not None:
            booking.attendees = attendees

        booking.updated_at = datetime.utcnow()
        return booking

    def cancel_booking(self, booking_id: str) -> Optional[ResourceBooking]:
        """Cancel a booking."""
        booking = self._bookings.get(booking_id)
        if booking:
            booking.status = AllocationStatus.CANCELLED
            booking.updated_at = datetime.utcnow()
        return booking

    def delete_booking(self, booking_id: str) -> bool:
        """Delete a booking."""
        if booking_id in self._bookings:
            del self._bookings[booking_id]
            return True
        return False

    def list_bookings(
        self,
        resource_id: Optional[str] = None,
        booked_by: Optional[str] = None,
        start_after: Optional[datetime] = None,
        end_before: Optional[datetime] = None,
        status: Optional[AllocationStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ResourceBooking]:
        """List bookings with filters."""
        bookings = list(self._bookings.values())

        if resource_id:
            bookings = [b for b in bookings if b.resource_id == resource_id]
        if booked_by:
            bookings = [b for b in bookings if b.booked_by == booked_by]
        if start_after:
            bookings = [b for b in bookings if b.start_datetime >= start_after]
        if end_before:
            bookings = [b for b in bookings if b.end_datetime <= end_before]
        if status:
            bookings = [b for b in bookings if b.status == status]

        bookings.sort(key=lambda b: b.start_datetime)
        return bookings[offset:offset + limit]

    def get_resource_schedule(
        self,
        resource_id: str,
        start_date: date,
        end_date: date,
    ) -> List[ResourceBooking]:
        """Get schedule for a resource."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        return self.list_bookings(
            resource_id=resource_id,
            start_after=start_dt,
            end_before=end_dt,
        )

    # Capacity Plan methods
    def create_capacity_plan(
        self,
        name: str,
        start_date: date,
        end_date: Optional[date] = None,
        period_type: str = "weekly",
        workspace_id: Optional[str] = None,
        created_by: str = "",
    ) -> CapacityPlan:
        """Create a capacity plan."""
        plan_id = str(uuid.uuid4())
        plan = CapacityPlan(
            id=plan_id,
            name=name,
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date,
            period_type=period_type,
            created_by=created_by,
        )

        self._capacity_plans[plan_id] = plan
        return plan

    def get_capacity_plan(self, plan_id: str) -> Optional[CapacityPlan]:
        """Get a capacity plan by ID."""
        return self._capacity_plans.get(plan_id)

    def update_capacity_plan(
        self,
        plan_id: str,
        name: Optional[str] = None,
        total_capacity: Optional[float] = None,
        planned_capacity: Optional[float] = None,
        actual_capacity: Optional[float] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[CapacityPlan]:
        """Update a capacity plan."""
        plan = self._capacity_plans.get(plan_id)
        if not plan:
            return None

        if name is not None:
            plan.name = name
        if total_capacity is not None:
            plan.total_capacity = total_capacity
        if planned_capacity is not None:
            plan.planned_capacity = planned_capacity
        if actual_capacity is not None:
            plan.actual_capacity = actual_capacity
        if is_active is not None:
            plan.is_active = is_active

        plan.updated_at = datetime.utcnow()
        return plan

    def list_capacity_plans(
        self,
        workspace_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[CapacityPlan]:
        """List capacity plans."""
        plans = list(self._capacity_plans.values())

        if workspace_id:
            plans = [p for p in plans if p.workspace_id == workspace_id]
        if is_active is not None:
            plans = [p for p in plans if p.is_active == is_active]

        plans.sort(key=lambda p: p.start_date, reverse=True)
        return plans

    # Utilization methods
    def record_utilization(
        self,
        resource_id: str,
        period_start: date,
        period_end: date,
        total_capacity: float,
        allocated_capacity: float,
        actual_hours: float = 0.0,
        billable_hours: float = 0.0,
        workspace_id: Optional[str] = None,
    ) -> Optional[ResourceUtilization]:
        """Record utilization for a resource."""
        if resource_id not in self._resources:
            return None

        util_id = str(uuid.uuid4())
        utilization = ResourceUtilization(
            id=util_id,
            resource_id=resource_id,
            period_start=period_start,
            period_end=period_end,
            total_capacity=total_capacity,
            allocated_capacity=allocated_capacity,
            actual_hours=actual_hours,
            billable_hours=billable_hours,
            workspace_id=workspace_id,
        )

        if resource_id not in self._utilization:
            self._utilization[resource_id] = []
        self._utilization[resource_id].append(utilization)

        return utilization

    def get_utilization_history(
        self,
        resource_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ResourceUtilization]:
        """Get utilization history for a resource."""
        records = self._utilization.get(resource_id, [])

        if start_date:
            records = [r for r in records if r.period_end >= start_date]
        if end_date:
            records = [r for r in records if r.period_start <= end_date]

        records.sort(key=lambda r: r.period_start)
        return records

    # Statistics
    def get_stats(
        self,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get resource management statistics."""
        resources = self.list_resources(workspace_id=workspace_id)
        allocations = list(self._allocations.values())
        if workspace_id:
            resource_ids = {r.id for r in resources}
            allocations = [
                a for a in allocations if a.resource_id in resource_ids
            ]

        # Resource counts by type
        type_counts = {}
        for rtype in ResourceType:
            type_counts[rtype.value] = len([
                r for r in resources if r.resource_type == rtype
            ])

        # Resource counts by status
        status_counts = {}
        for status in ResourceStatus:
            status_counts[status.value] = len([
                r for r in resources if r.status == status
            ])

        # Allocation counts by status
        alloc_counts = {}
        for status in AllocationStatus:
            alloc_counts[status.value] = len([
                a for a in allocations if a.status == status
            ])

        # Calculate average utilization
        total_capacity = sum(r.capacity for r in resources)
        total_allocated = sum(r.allocated_capacity for r in resources)
        avg_utilization = (
            (total_allocated / total_capacity * 100)
            if total_capacity > 0 else 0
        )

        return {
            "total_resources": len(resources),
            "active_resources": len([r for r in resources if r.is_active]),
            "resources_by_type": type_counts,
            "resources_by_status": status_counts,
            "total_allocations": len(allocations),
            "allocations_by_status": alloc_counts,
            "total_capacity": total_capacity,
            "total_allocated": total_allocated,
            "average_utilization": avg_utilization,
        }


class ResourceManager:
    """High-level API for resource management."""

    def __init__(self, registry: Optional[ResourceRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or ResourceRegistry()

    @property
    def registry(self) -> ResourceRegistry:
        """Get the registry."""
        return self._registry

    # Resource methods
    def create_resource(
        self,
        name: str,
        resource_type: ResourceType,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        description: str = "",
        capacity: float = 1.0,
        hourly_rate: Optional[float] = None,
        tags: Optional[Set[str]] = None,
    ) -> Resource:
        """Create a resource."""
        return self._registry.create_resource(
            name=name,
            resource_type=resource_type,
            workspace_id=workspace_id,
            team_id=team_id,
            owner_id=owner_id,
            description=description,
            capacity=capacity,
            hourly_rate=hourly_rate,
            tags=tags,
        )

    def create_person_resource(
        self,
        name: str,
        email: str = "",
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        hourly_rate: Optional[float] = None,
    ) -> Resource:
        """Create a person resource."""
        return self._registry.create_resource(
            name=name,
            resource_type=ResourceType.PERSON,
            workspace_id=workspace_id,
            team_id=team_id,
            email=email,
            capacity=40.0,  # 40 hours/week
            capacity_unit=CapacityUnit.HOURS,
            hourly_rate=hourly_rate,
        )

    def create_room_resource(
        self,
        name: str,
        location: str,
        workspace_id: Optional[str] = None,
        capacity: float = 1.0,
    ) -> Resource:
        """Create a room resource."""
        return self._registry.create_resource(
            name=name,
            resource_type=ResourceType.ROOM,
            workspace_id=workspace_id,
            location=location,
            capacity=capacity,
            capacity_unit=CapacityUnit.UNITS,
        )

    def create_equipment_resource(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        description: str = "",
        daily_rate: Optional[float] = None,
    ) -> Resource:
        """Create an equipment resource."""
        return self._registry.create_resource(
            name=name,
            resource_type=ResourceType.EQUIPMENT,
            workspace_id=workspace_id,
            description=description,
            capacity=1.0,
            daily_rate=daily_rate,
        )

    def get_resource(self, resource_id: str) -> Optional[Resource]:
        """Get a resource."""
        return self._registry.get_resource(resource_id)

    def update_resource(
        self,
        resource_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        capacity: Optional[float] = None,
    ) -> Optional[Resource]:
        """Update a resource."""
        return self._registry.update_resource(
            resource_id,
            name=name,
            description=description,
            capacity=capacity,
        )

    def delete_resource(self, resource_id: str) -> bool:
        """Delete a resource."""
        return self._registry.delete_resource(resource_id)

    def list_resources(
        self,
        workspace_id: Optional[str] = None,
        resource_type: Optional[ResourceType] = None,
    ) -> List[Resource]:
        """List resources."""
        return self._registry.list_resources(
            workspace_id=workspace_id,
            resource_type=resource_type,
        )

    def list_people(self, workspace_id: Optional[str] = None) -> List[Resource]:
        """List person resources."""
        return self._registry.list_resources(
            workspace_id=workspace_id,
            resource_type=ResourceType.PERSON,
        )

    def list_rooms(self, workspace_id: Optional[str] = None) -> List[Resource]:
        """List room resources."""
        return self._registry.list_resources(
            workspace_id=workspace_id,
            resource_type=ResourceType.ROOM,
        )

    def list_equipment(self, workspace_id: Optional[str] = None) -> List[Resource]:
        """List equipment resources."""
        return self._registry.list_resources(
            workspace_id=workspace_id,
            resource_type=ResourceType.EQUIPMENT,
        )

    def get_available_resources(
        self,
        start_date: date,
        end_date: date,
        resource_type: Optional[ResourceType] = None,
        workspace_id: Optional[str] = None,
    ) -> List[Resource]:
        """Get available resources."""
        return self._registry.get_available_resources(
            start_date, end_date, resource_type, workspace_id
        )

    # Skill methods
    def add_skill(
        self,
        resource_id: str,
        name: str,
        level: int = 1,
        certified: bool = False,
    ) -> Optional[ResourceSkill]:
        """Add a skill to a resource."""
        return self._registry.add_resource_skill(
            resource_id, name, level, certified=certified
        )

    def find_by_skills(
        self,
        skills: List[Tuple[str, int]],
        workspace_id: Optional[str] = None,
    ) -> List[Resource]:
        """Find resources by skills."""
        return self._registry.find_resources_by_skills(
            skills, workspace_id=workspace_id
        )

    # Allocation methods
    def request_allocation(
        self,
        resource_id: str,
        requester_id: str,
        project_id: Optional[str] = None,
        capacity: float = 1.0,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        priority: AllocationPriority = AllocationPriority.MEDIUM,
    ) -> Optional[ResourceAllocation]:
        """Request a resource allocation."""
        return self._registry.create_allocation(
            resource_id=resource_id,
            requester_id=requester_id,
            project_id=project_id,
            allocated_capacity=capacity,
            start_date=start_date,
            end_date=end_date,
            priority=priority,
        )

    def approve_allocation(
        self,
        allocation_id: str,
        approver_id: str,
    ) -> Optional[ResourceAllocation]:
        """Approve an allocation."""
        return self._registry.approve_allocation(allocation_id, approver_id)

    def activate_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Activate an allocation."""
        return self._registry.activate_allocation(allocation_id)

    def complete_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Complete an allocation."""
        return self._registry.complete_allocation(allocation_id)

    def cancel_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Cancel an allocation."""
        return self._registry.cancel_allocation(allocation_id)

    def get_allocation(self, allocation_id: str) -> Optional[ResourceAllocation]:
        """Get an allocation."""
        return self._registry.get_allocation(allocation_id)

    def list_allocations(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        status: Optional[AllocationStatus] = None,
    ) -> List[ResourceAllocation]:
        """List allocations."""
        return self._registry.list_allocations(
            resource_id=resource_id,
            project_id=project_id,
            status=status,
        )

    def get_pending_allocations(self) -> List[ResourceAllocation]:
        """Get pending allocation requests."""
        return self._registry.list_allocations(
            status=AllocationStatus.REQUESTED
        )

    def get_active_allocations(
        self,
        resource_id: Optional[str] = None,
    ) -> List[ResourceAllocation]:
        """Get active allocations."""
        return self._registry.list_allocations(
            resource_id=resource_id,
            status=AllocationStatus.ACTIVE,
        )

    # Booking methods
    def book_resource(
        self,
        resource_id: str,
        booked_by: str,
        title: str,
        start_datetime: datetime,
        end_datetime: datetime,
        description: str = "",
        attendees: Optional[Set[str]] = None,
    ) -> Optional[ResourceBooking]:
        """Book a resource."""
        return self._registry.create_booking(
            resource_id=resource_id,
            booked_by=booked_by,
            title=title,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            description=description,
            attendees=attendees,
        )

    def cancel_booking(self, booking_id: str) -> Optional[ResourceBooking]:
        """Cancel a booking."""
        return self._registry.cancel_booking(booking_id)

    def get_booking(self, booking_id: str) -> Optional[ResourceBooking]:
        """Get a booking."""
        return self._registry.get_booking(booking_id)

    def list_bookings(
        self,
        resource_id: Optional[str] = None,
        booked_by: Optional[str] = None,
    ) -> List[ResourceBooking]:
        """List bookings."""
        return self._registry.list_bookings(
            resource_id=resource_id,
            booked_by=booked_by,
        )

    def get_schedule(
        self,
        resource_id: str,
        start_date: date,
        end_date: date,
    ) -> List[ResourceBooking]:
        """Get resource schedule."""
        return self._registry.get_resource_schedule(
            resource_id, start_date, end_date
        )

    def check_availability(
        self,
        resource_id: str,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> bool:
        """Check if resource is available."""
        return not self._registry._has_booking_conflict(
            resource_id, start_datetime, end_datetime
        )

    # Capacity planning methods
    def create_capacity_plan(
        self,
        name: str,
        start_date: date,
        end_date: Optional[date] = None,
        workspace_id: Optional[str] = None,
        created_by: str = "",
    ) -> CapacityPlan:
        """Create a capacity plan."""
        return self._registry.create_capacity_plan(
            name=name,
            start_date=start_date,
            end_date=end_date,
            workspace_id=workspace_id,
            created_by=created_by,
        )

    def get_capacity_plan(self, plan_id: str) -> Optional[CapacityPlan]:
        """Get a capacity plan."""
        return self._registry.get_capacity_plan(plan_id)

    def update_capacity_plan(
        self,
        plan_id: str,
        total_capacity: Optional[float] = None,
        planned_capacity: Optional[float] = None,
        actual_capacity: Optional[float] = None,
    ) -> Optional[CapacityPlan]:
        """Update a capacity plan."""
        return self._registry.update_capacity_plan(
            plan_id,
            total_capacity=total_capacity,
            planned_capacity=planned_capacity,
            actual_capacity=actual_capacity,
        )

    def list_capacity_plans(
        self,
        workspace_id: Optional[str] = None,
    ) -> List[CapacityPlan]:
        """List capacity plans."""
        return self._registry.list_capacity_plans(workspace_id=workspace_id)

    # Utilization methods
    def record_utilization(
        self,
        resource_id: str,
        period_start: date,
        period_end: date,
        actual_hours: float,
        billable_hours: float = 0.0,
    ) -> Optional[ResourceUtilization]:
        """Record utilization."""
        resource = self._registry.get_resource(resource_id)
        if not resource:
            return None

        return self._registry.record_utilization(
            resource_id=resource_id,
            period_start=period_start,
            period_end=period_end,
            total_capacity=resource.capacity,
            allocated_capacity=resource.allocated_capacity,
            actual_hours=actual_hours,
            billable_hours=billable_hours,
            workspace_id=resource.workspace_id,
        )

    def get_utilization_history(
        self,
        resource_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[ResourceUtilization]:
        """Get utilization history."""
        return self._registry.get_utilization_history(
            resource_id, start_date, end_date
        )

    # Summary methods
    def get_resource_summary(self, resource_id: str) -> Dict[str, Any]:
        """Get resource summary."""
        resource = self._registry.get_resource(resource_id)
        if not resource:
            return {}

        allocations = self._registry.list_allocations(resource_id=resource_id)
        active_allocs = [a for a in allocations if a.status == AllocationStatus.ACTIVE]
        bookings = self._registry.list_bookings(resource_id=resource_id)
        upcoming_bookings = [b for b in bookings if b.is_future]

        return {
            "resource": resource.to_dict(),
            "total_allocations": len(allocations),
            "active_allocations": len(active_allocs),
            "total_bookings": len(bookings),
            "upcoming_bookings": len(upcoming_bookings),
        }

    def get_team_utilization(
        self,
        team_id: str,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        """Get team utilization summary."""
        resources = self._registry.list_resources(team_id=team_id)

        total_capacity = sum(r.capacity for r in resources)
        total_allocated = sum(r.allocated_capacity for r in resources)

        resource_utils = []
        for resource in resources:
            resource_utils.append({
                "resource_id": resource.id,
                "name": resource.name,
                "capacity": resource.capacity,
                "allocated": resource.allocated_capacity,
                "utilization": resource.utilization_percentage,
            })

        return {
            "team_id": team_id,
            "total_resources": len(resources),
            "total_capacity": total_capacity,
            "total_allocated": total_allocated,
            "average_utilization": (
                (total_allocated / total_capacity * 100)
                if total_capacity > 0 else 0
            ),
            "resources": resource_utils,
        }

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get statistics."""
        return self._registry.get_stats(workspace_id)


# Global instance management
_resource_manager: Optional[ResourceManager] = None


def get_resource_manager() -> ResourceManager:
    """Get the global resource manager instance."""
    global _resource_manager
    if _resource_manager is None:
        _resource_manager = ResourceManager()
    return _resource_manager


def set_resource_manager(manager: ResourceManager) -> None:
    """Set the global resource manager instance."""
    global _resource_manager
    _resource_manager = manager


def reset_resource_manager() -> None:
    """Reset the global resource manager instance."""
    global _resource_manager
    _resource_manager = None
