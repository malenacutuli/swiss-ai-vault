"""
Projects & Milestones Module

Implements project management functionality with:
- Project creation and lifecycle management
- Project members and role-based access
- Milestones and project phases
- Progress tracking and health indicators
- Project templates
- Budget and resource tracking
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import time


# ==================== Enums ====================

class ProjectStatus(Enum):
    """Project status."""
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ProjectVisibility(Enum):
    """Project visibility levels."""
    PRIVATE = "private"
    TEAM = "team"
    WORKSPACE = "workspace"
    ORGANIZATION = "organization"
    PUBLIC = "public"


class ProjectHealth(Enum):
    """Project health indicators."""
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    OFF_TRACK = "off_track"
    UNKNOWN = "unknown"


class MemberRole(Enum):
    """Project member roles."""
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"
    VIEWER = "viewer"
    GUEST = "guest"


class MilestoneStatus(Enum):
    """Milestone status."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"


class PhaseStatus(Enum):
    """Project phase status."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ProjectType(Enum):
    """Types of projects."""
    STANDARD = "standard"
    AGILE = "agile"
    WATERFALL = "waterfall"
    KANBAN = "kanban"
    SCRUM = "scrum"
    CUSTOM = "custom"


# ==================== Data Classes ====================

@dataclass
class ProjectMember:
    """A member of a project."""
    id: str
    project_id: str
    user_id: str
    role: MemberRole
    joined_at: datetime = field(default_factory=datetime.utcnow)
    invited_by: Optional[str] = None
    permissions: Set[str] = field(default_factory=set)
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    def has_permission(self, permission: str) -> bool:
        """Check if member has a specific permission."""
        # Owners and admins have all permissions
        if self.role in (MemberRole.OWNER, MemberRole.ADMIN):
            return True
        return permission in self.permissions

    def can_edit(self) -> bool:
        """Check if member can edit project."""
        return self.role in (MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MANAGER, MemberRole.MEMBER)

    def can_manage(self) -> bool:
        """Check if member can manage project settings."""
        return self.role in (MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MANAGER)

    def can_admin(self) -> bool:
        """Check if member has admin access."""
        return self.role in (MemberRole.OWNER, MemberRole.ADMIN)


@dataclass
class Milestone:
    """A project milestone."""
    id: str
    project_id: str
    name: str
    description: str = ""
    status: MilestoneStatus = MilestoneStatus.PLANNED
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    owner_id: Optional[str] = None
    task_ids: Set[str] = field(default_factory=set)
    completed_task_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    order: int = 0
    color: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def task_count(self) -> int:
        """Get total task count."""
        return len(self.task_ids)

    @property
    def progress(self) -> float:
        """Get milestone progress (0.0 - 1.0)."""
        if self.task_count == 0:
            return 0.0
        return self.completed_task_count / self.task_count

    @property
    def is_overdue(self) -> bool:
        """Check if milestone is overdue."""
        if not self.due_date:
            return False
        if self.status == MilestoneStatus.COMPLETED:
            return False
        return datetime.utcnow() > self.due_date

    @property
    def days_until_due(self) -> Optional[int]:
        """Get days until due date."""
        if not self.due_date:
            return None
        delta = self.due_date - datetime.utcnow()
        return delta.days

    def complete(self) -> None:
        """Mark milestone as completed."""
        self.status = MilestoneStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def add_task(self, task_id: str) -> None:
        """Add a task to the milestone."""
        self.task_ids.add(task_id)
        self.updated_at = datetime.utcnow()

    def remove_task(self, task_id: str) -> bool:
        """Remove a task from the milestone."""
        if task_id in self.task_ids:
            self.task_ids.discard(task_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "progress": self.progress,
            "task_count": self.task_count,
            "is_overdue": self.is_overdue,
        }


@dataclass
class ProjectPhase:
    """A phase in a project."""
    id: str
    project_id: str
    name: str
    description: str = ""
    status: PhaseStatus = PhaseStatus.NOT_STARTED
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    milestone_ids: Set[str] = field(default_factory=set)
    order: int = 0
    color: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def start(self) -> None:
        """Start the phase."""
        self.status = PhaseStatus.IN_PROGRESS
        self.actual_start_date = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def complete(self) -> None:
        """Complete the phase."""
        self.status = PhaseStatus.COMPLETED
        self.actual_end_date = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    @property
    def duration_days(self) -> Optional[int]:
        """Get planned duration in days."""
        if not self.start_date or not self.end_date:
            return None
        return (self.end_date - self.start_date).days

    @property
    def actual_duration_days(self) -> Optional[int]:
        """Get actual duration in days."""
        if not self.actual_start_date:
            return None
        end = self.actual_end_date or datetime.utcnow()
        return (end - self.actual_start_date).days

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "order": self.order,
        }


@dataclass
class ProjectBudget:
    """Project budget information."""
    total_budget: float = 0.0
    spent: float = 0.0
    currency: str = "USD"
    labor_budget: float = 0.0
    labor_spent: float = 0.0
    materials_budget: float = 0.0
    materials_spent: float = 0.0
    other_budget: float = 0.0
    other_spent: float = 0.0

    @property
    def remaining(self) -> float:
        """Get remaining budget."""
        return self.total_budget - self.spent

    @property
    def spent_percentage(self) -> float:
        """Get percentage of budget spent."""
        if self.total_budget == 0:
            return 0.0
        return (self.spent / self.total_budget) * 100

    @property
    def is_over_budget(self) -> bool:
        """Check if project is over budget."""
        return self.spent > self.total_budget


@dataclass
class ProjectMetrics:
    """Project metrics and statistics."""
    total_tasks: int = 0
    completed_tasks: int = 0
    total_milestones: int = 0
    completed_milestones: int = 0
    total_hours_estimated: float = 0.0
    total_hours_logged: float = 0.0
    team_size: int = 0
    days_since_start: int = 0
    days_until_deadline: Optional[int] = None

    @property
    def task_completion_rate(self) -> float:
        """Get task completion rate (0.0 - 1.0)."""
        if self.total_tasks == 0:
            return 0.0
        return self.completed_tasks / self.total_tasks

    @property
    def milestone_completion_rate(self) -> float:
        """Get milestone completion rate (0.0 - 1.0)."""
        if self.total_milestones == 0:
            return 0.0
        return self.completed_milestones / self.total_milestones

    @property
    def hours_variance(self) -> float:
        """Get variance between estimated and logged hours."""
        return self.total_hours_logged - self.total_hours_estimated


@dataclass
class Project:
    """A project in the system."""
    id: str
    name: str
    description: str = ""
    project_type: ProjectType = ProjectType.STANDARD
    status: ProjectStatus = ProjectStatus.PLANNING
    visibility: ProjectVisibility = ProjectVisibility.TEAM
    health: ProjectHealth = ProjectHealth.UNKNOWN

    # Ownership
    owner_id: Optional[str] = None
    workspace_id: Optional[str] = None
    parent_id: Optional[str] = None  # For sub-projects

    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None

    # Organization
    tags: Set[str] = field(default_factory=set)
    labels: Dict[str, str] = field(default_factory=dict)
    color: Optional[str] = None
    icon: Optional[str] = None

    # Relations
    member_ids: Set[str] = field(default_factory=set)
    milestone_ids: List[str] = field(default_factory=list)
    phase_ids: List[str] = field(default_factory=list)
    task_list_ids: Set[str] = field(default_factory=set)
    board_ids: Set[str] = field(default_factory=set)

    # Budget
    budget: Optional[ProjectBudget] = None

    # Settings
    settings: Dict[str, Any] = field(default_factory=dict)
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_tag(self, tag: str) -> None:
        """Add a tag to the project."""
        self.tags.add(tag.lower().strip())
        self.updated_at = datetime.utcnow()

    def remove_tag(self, tag: str) -> bool:
        """Remove a tag from the project."""
        tag_lower = tag.lower().strip()
        if tag_lower in self.tags:
            self.tags.discard(tag_lower)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def set_label(self, key: str, value: str) -> None:
        """Set a label on the project."""
        self.labels[key] = value
        self.updated_at = datetime.utcnow()

    def activate(self) -> None:
        """Activate the project."""
        self.status = ProjectStatus.ACTIVE
        if not self.start_date:
            self.start_date = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def complete(self) -> None:
        """Mark project as completed."""
        self.status = ProjectStatus.COMPLETED
        self.actual_end_date = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the project."""
        self.status = ProjectStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    @property
    def is_active(self) -> bool:
        """Check if project is active."""
        return self.status == ProjectStatus.ACTIVE

    @property
    def is_overdue(self) -> bool:
        """Check if project is overdue."""
        if not self.target_end_date:
            return False
        if self.status == ProjectStatus.COMPLETED:
            return False
        return datetime.utcnow() > self.target_end_date

    @property
    def days_until_deadline(self) -> Optional[int]:
        """Get days until target end date."""
        if not self.target_end_date:
            return None
        delta = self.target_end_date - datetime.utcnow()
        return delta.days

    @property
    def duration_days(self) -> Optional[int]:
        """Get project duration in days."""
        if not self.start_date:
            return None
        end = self.actual_end_date or datetime.utcnow()
        return (end - self.start_date).days

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "type": self.project_type.value,
            "status": self.status.value,
            "visibility": self.visibility.value,
            "health": self.health.value,
            "owner_id": self.owner_id,
            "workspace_id": self.workspace_id,
            "tags": list(self.tags),
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "target_end_date": self.target_end_date.isoformat() if self.target_end_date else None,
            "is_overdue": self.is_overdue,
            "member_count": len(self.member_ids),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ProjectTemplate:
    """A template for creating projects."""
    id: str
    name: str
    description: str = ""
    project_type: ProjectType = ProjectType.STANDARD
    phases: List[Dict[str, Any]] = field(default_factory=list)
    milestones: List[Dict[str, Any]] = field(default_factory=list)
    task_templates: List[Dict[str, Any]] = field(default_factory=list)
    default_settings: Dict[str, Any] = field(default_factory=dict)
    tags: Set[str] = field(default_factory=set)
    workspace_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_public: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectActivity:
    """An activity entry for a project."""
    id: str
    project_id: str
    user_id: Optional[str] = None
    action: str = ""
    entity_type: str = ""  # task, milestone, member, etc.
    entity_id: Optional[str] = None
    description: str = ""
    changes: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


# ==================== Project Registry ====================

class ProjectRegistry:
    """Central registry for managing projects."""

    _counter: int = 0

    def __init__(self):
        self._projects: Dict[str, Project] = {}
        self._members: Dict[str, ProjectMember] = {}
        self._milestones: Dict[str, Milestone] = {}
        self._phases: Dict[str, ProjectPhase] = {}
        self._templates: Dict[str, ProjectTemplate] = {}
        self._activities: List[ProjectActivity] = []
        self._workspace_projects: Dict[str, Set[str]] = {}
        self._user_projects: Dict[str, Set[str]] = {}  # user -> project_ids

    def create_project(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        **kwargs
    ) -> Project:
        """Create a new project."""
        ProjectRegistry._counter += 1
        project_id = f"proj_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        project = Project(
            id=project_id,
            name=name,
            workspace_id=workspace_id,
            owner_id=owner_id,
            **kwargs
        )

        self._projects[project_id] = project

        # Index by workspace
        if workspace_id:
            if workspace_id not in self._workspace_projects:
                self._workspace_projects[workspace_id] = set()
            self._workspace_projects[workspace_id].add(project_id)

        # Add owner as member
        if owner_id:
            self.add_member(project_id, owner_id, MemberRole.OWNER)

        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        """Get a project by ID."""
        return self._projects.get(project_id)

    def update_project(self, project: Project) -> bool:
        """Update a project."""
        if project.id not in self._projects:
            return False

        project.updated_at = datetime.utcnow()
        self._projects[project.id] = project
        return True

    def delete_project(self, project_id: str, soft_delete: bool = True) -> bool:
        """Delete a project."""
        project = self._projects.get(project_id)
        if not project:
            return False

        if soft_delete:
            project.status = ProjectStatus.ARCHIVED
            project.updated_at = datetime.utcnow()
        else:
            # Remove from indexes
            if project.workspace_id and project.workspace_id in self._workspace_projects:
                self._workspace_projects[project.workspace_id].discard(project_id)

            # Remove members
            member_ids_to_remove = [
                mid for mid, m in self._members.items()
                if m.project_id == project_id
            ]
            for mid in member_ids_to_remove:
                del self._members[mid]

            # Remove milestones
            milestone_ids_to_remove = [
                mid for mid, m in self._milestones.items()
                if m.project_id == project_id
            ]
            for mid in milestone_ids_to_remove:
                del self._milestones[mid]

            # Remove phases
            phase_ids_to_remove = [
                pid for pid, p in self._phases.items()
                if p.project_id == project_id
            ]
            for pid in phase_ids_to_remove:
                del self._phases[pid]

            del self._projects[project_id]

        return True

    def list_projects(
        self,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        member_id: Optional[str] = None,
        status: Optional[ProjectStatus] = None,
        statuses: Optional[List[ProjectStatus]] = None,
        project_type: Optional[ProjectType] = None,
        tags: Optional[Set[str]] = None,
        include_archived: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> List[Project]:
        """List projects matching criteria."""
        # Start with filtered set
        if workspace_id and workspace_id in self._workspace_projects:
            project_ids = self._workspace_projects[workspace_id]
            projects = [self._projects[pid] for pid in project_ids if pid in self._projects]
        elif member_id and member_id in self._user_projects:
            project_ids = self._user_projects[member_id]
            projects = [self._projects[pid] for pid in project_ids if pid in self._projects]
        else:
            projects = list(self._projects.values())

        # Filter by owner
        if owner_id:
            projects = [p for p in projects if p.owner_id == owner_id]

        # Filter by status
        if status:
            projects = [p for p in projects if p.status == status]
        elif statuses:
            projects = [p for p in projects if p.status in statuses]
        elif not include_archived:
            projects = [p for p in projects if p.status != ProjectStatus.ARCHIVED]

        # Filter by type
        if project_type:
            projects = [p for p in projects if p.project_type == project_type]

        # Filter by tags
        if tags:
            projects = [p for p in projects if tags.issubset(p.tags)]

        # Sort by updated_at desc
        projects.sort(key=lambda p: p.updated_at, reverse=True)

        # Paginate
        return projects[offset:offset + limit]

    def search_projects(
        self,
        query: str,
        workspace_id: Optional[str] = None
    ) -> List[Project]:
        """Search projects by name or description."""
        query_lower = query.lower()
        projects = self.list_projects(workspace_id=workspace_id, limit=10000)

        results = []
        for project in projects:
            if (query_lower in project.name.lower() or
                query_lower in project.description.lower() or
                any(query_lower in tag for tag in project.tags)):
                results.append(project)

        return results

    # Member management
    def add_member(
        self,
        project_id: str,
        user_id: str,
        role: MemberRole,
        invited_by: Optional[str] = None
    ) -> Optional[ProjectMember]:
        """Add a member to a project."""
        project = self._projects.get(project_id)
        if not project:
            return None

        # Check if already a member
        for member in self._members.values():
            if member.project_id == project_id and member.user_id == user_id:
                return member

        ProjectRegistry._counter += 1
        member_id = f"member_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        member = ProjectMember(
            id=member_id,
            project_id=project_id,
            user_id=user_id,
            role=role,
            invited_by=invited_by
        )

        self._members[member_id] = member
        project.member_ids.add(user_id)

        # Update user index
        if user_id not in self._user_projects:
            self._user_projects[user_id] = set()
        self._user_projects[user_id].add(project_id)

        return member

    def get_member(self, member_id: str) -> Optional[ProjectMember]:
        """Get a member by ID."""
        return self._members.get(member_id)

    def get_project_member(self, project_id: str, user_id: str) -> Optional[ProjectMember]:
        """Get a member by project and user ID."""
        for member in self._members.values():
            if member.project_id == project_id and member.user_id == user_id:
                return member
        return None

    def update_member_role(self, project_id: str, user_id: str, new_role: MemberRole) -> bool:
        """Update a member's role."""
        member = self.get_project_member(project_id, user_id)
        if not member:
            return False

        member.role = new_role
        return True

    def remove_member(self, project_id: str, user_id: str) -> bool:
        """Remove a member from a project."""
        project = self._projects.get(project_id)
        if not project:
            return False

        member = self.get_project_member(project_id, user_id)
        if not member:
            return False

        del self._members[member.id]
        project.member_ids.discard(user_id)

        if user_id in self._user_projects:
            self._user_projects[user_id].discard(project_id)

        return True

    def get_project_members(self, project_id: str) -> List[ProjectMember]:
        """Get all members of a project."""
        return [m for m in self._members.values() if m.project_id == project_id and m.is_active]

    def get_user_projects(self, user_id: str) -> List[Project]:
        """Get all projects a user is a member of."""
        project_ids = self._user_projects.get(user_id, set())
        return [self._projects[pid] for pid in project_ids if pid in self._projects]

    # Milestone management
    def create_milestone(
        self,
        project_id: str,
        name: str,
        **kwargs
    ) -> Optional[Milestone]:
        """Create a milestone for a project."""
        project = self._projects.get(project_id)
        if not project:
            return None

        ProjectRegistry._counter += 1
        milestone_id = f"milestone_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        milestone = Milestone(
            id=milestone_id,
            project_id=project_id,
            name=name,
            order=len(project.milestone_ids),
            **kwargs
        )

        self._milestones[milestone_id] = milestone
        project.milestone_ids.append(milestone_id)
        project.updated_at = datetime.utcnow()

        return milestone

    def get_milestone(self, milestone_id: str) -> Optional[Milestone]:
        """Get a milestone by ID."""
        return self._milestones.get(milestone_id)

    def update_milestone(self, milestone: Milestone) -> bool:
        """Update a milestone."""
        if milestone.id not in self._milestones:
            return False

        milestone.updated_at = datetime.utcnow()
        self._milestones[milestone.id] = milestone
        return True

    def delete_milestone(self, milestone_id: str) -> bool:
        """Delete a milestone."""
        milestone = self._milestones.get(milestone_id)
        if not milestone:
            return False

        project = self._projects.get(milestone.project_id)
        if project and milestone_id in project.milestone_ids:
            project.milestone_ids.remove(milestone_id)

        del self._milestones[milestone_id]
        return True

    def get_project_milestones(self, project_id: str) -> List[Milestone]:
        """Get all milestones for a project."""
        project = self._projects.get(project_id)
        if not project:
            return []

        milestones = [self._milestones[mid] for mid in project.milestone_ids if mid in self._milestones]
        milestones.sort(key=lambda m: m.order)
        return milestones

    def complete_milestone(self, milestone_id: str) -> bool:
        """Mark a milestone as completed."""
        milestone = self._milestones.get(milestone_id)
        if not milestone:
            return False

        milestone.complete()
        return True

    # Phase management
    def create_phase(
        self,
        project_id: str,
        name: str,
        **kwargs
    ) -> Optional[ProjectPhase]:
        """Create a phase for a project."""
        project = self._projects.get(project_id)
        if not project:
            return None

        ProjectRegistry._counter += 1
        phase_id = f"phase_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        phase = ProjectPhase(
            id=phase_id,
            project_id=project_id,
            name=name,
            order=len(project.phase_ids),
            **kwargs
        )

        self._phases[phase_id] = phase
        project.phase_ids.append(phase_id)
        project.updated_at = datetime.utcnow()

        return phase

    def get_phase(self, phase_id: str) -> Optional[ProjectPhase]:
        """Get a phase by ID."""
        return self._phases.get(phase_id)

    def update_phase(self, phase: ProjectPhase) -> bool:
        """Update a phase."""
        if phase.id not in self._phases:
            return False

        phase.updated_at = datetime.utcnow()
        self._phases[phase.id] = phase
        return True

    def delete_phase(self, phase_id: str) -> bool:
        """Delete a phase."""
        phase = self._phases.get(phase_id)
        if not phase:
            return False

        project = self._projects.get(phase.project_id)
        if project and phase_id in project.phase_ids:
            project.phase_ids.remove(phase_id)

        del self._phases[phase_id]
        return True

    def get_project_phases(self, project_id: str) -> List[ProjectPhase]:
        """Get all phases for a project."""
        project = self._projects.get(project_id)
        if not project:
            return []

        phases = [self._phases[pid] for pid in project.phase_ids if pid in self._phases]
        phases.sort(key=lambda p: p.order)
        return phases

    # Template management
    def create_template(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        created_by: Optional[str] = None,
        **kwargs
    ) -> ProjectTemplate:
        """Create a project template."""
        ProjectRegistry._counter += 1
        template_id = f"template_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        template = ProjectTemplate(
            id=template_id,
            name=name,
            workspace_id=workspace_id,
            created_by=created_by,
            **kwargs
        )

        self._templates[template_id] = template
        return template

    def get_template(self, template_id: str) -> Optional[ProjectTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def list_templates(
        self,
        workspace_id: Optional[str] = None,
        include_public: bool = True
    ) -> List[ProjectTemplate]:
        """List project templates."""
        templates = list(self._templates.values())

        if workspace_id:
            templates = [
                t for t in templates
                if t.workspace_id == workspace_id or (include_public and t.is_public)
            ]

        return templates

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        if template_id not in self._templates:
            return False

        del self._templates[template_id]
        return True

    # Activity logging
    def log_activity(
        self,
        project_id: str,
        action: str,
        user_id: Optional[str] = None,
        entity_type: str = "",
        entity_id: Optional[str] = None,
        description: str = "",
        changes: Optional[Dict[str, Any]] = None
    ) -> ProjectActivity:
        """Log a project activity."""
        ProjectRegistry._counter += 1
        activity_id = f"activity_{int(time.time() * 1000)}_{ProjectRegistry._counter}"

        activity = ProjectActivity(
            id=activity_id,
            project_id=project_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            changes=changes or {}
        )

        self._activities.append(activity)
        return activity

    def get_project_activities(
        self,
        project_id: str,
        limit: int = 50
    ) -> List[ProjectActivity]:
        """Get recent activities for a project."""
        activities = [a for a in self._activities if a.project_id == project_id]
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]


# ==================== Project Manager ====================

class ProjectManager:
    """High-level manager for projects."""

    def __init__(self):
        self.registry = ProjectRegistry()

    def create_project(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        description: str = "",
        project_type: ProjectType = ProjectType.STANDARD,
        visibility: ProjectVisibility = ProjectVisibility.TEAM,
        start_date: Optional[datetime] = None,
        target_end_date: Optional[datetime] = None,
        tags: Optional[Set[str]] = None
    ) -> Project:
        """Create a new project."""
        project = self.registry.create_project(
            name=name,
            workspace_id=workspace_id,
            owner_id=owner_id,
            description=description,
            project_type=project_type,
            visibility=visibility,
            start_date=start_date,
            target_end_date=target_end_date,
            tags=tags or set()
        )

        self.registry.log_activity(
            project_id=project.id,
            action="created",
            user_id=owner_id,
            entity_type="project",
            entity_id=project.id,
            description=f"Project '{name}' created"
        )

        return project

    def create_from_template(
        self,
        template_id: str,
        name: str,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None
    ) -> Optional[Project]:
        """Create a project from a template."""
        template = self.registry.get_template(template_id)
        if not template:
            return None

        project = self.create_project(
            name=name,
            workspace_id=workspace_id,
            owner_id=owner_id,
            description=template.description,
            project_type=template.project_type,
            tags=template.tags.copy()
        )

        # Create phases from template
        for phase_data in template.phases:
            self.create_phase(
                project_id=project.id,
                name=phase_data.get("name", "Phase"),
                description=phase_data.get("description", "")
            )

        # Create milestones from template
        for milestone_data in template.milestones:
            self.create_milestone(
                project_id=project.id,
                name=milestone_data.get("name", "Milestone"),
                description=milestone_data.get("description", "")
            )

        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        """Get a project by ID."""
        return self.registry.get_project(project_id)

    def update_project(
        self,
        project_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[ProjectStatus] = None,
        health: Optional[ProjectHealth] = None,
        target_end_date: Optional[datetime] = None,
        tags: Optional[Set[str]] = None,
        updated_by: Optional[str] = None
    ) -> Optional[Project]:
        """Update a project."""
        project = self.registry.get_project(project_id)
        if not project:
            return None

        changes = {}

        if name is not None and name != project.name:
            changes["name"] = {"old": project.name, "new": name}
            project.name = name

        if description is not None:
            project.description = description

        if status is not None and status != project.status:
            changes["status"] = {"old": project.status.value, "new": status.value}
            project.status = status
            if status == ProjectStatus.COMPLETED:
                project.actual_end_date = datetime.utcnow()

        if health is not None:
            project.health = health

        if target_end_date is not None:
            project.target_end_date = target_end_date

        if tags is not None:
            project.tags = tags

        self.registry.update_project(project)

        if changes:
            self.registry.log_activity(
                project_id=project_id,
                action="updated",
                user_id=updated_by,
                entity_type="project",
                entity_id=project_id,
                changes=changes
            )

        return project

    def delete_project(self, project_id: str, permanent: bool = False) -> bool:
        """Delete a project."""
        return self.registry.delete_project(project_id, soft_delete=not permanent)

    def activate_project(self, project_id: str, user_id: Optional[str] = None) -> Optional[Project]:
        """Activate a project."""
        project = self.registry.get_project(project_id)
        if not project:
            return None

        project.activate()
        self.registry.update_project(project)

        self.registry.log_activity(
            project_id=project_id,
            action="activated",
            user_id=user_id,
            entity_type="project",
            entity_id=project_id
        )

        return project

    def complete_project(self, project_id: str, user_id: Optional[str] = None) -> Optional[Project]:
        """Mark a project as completed."""
        project = self.registry.get_project(project_id)
        if not project:
            return None

        project.complete()
        self.registry.update_project(project)

        self.registry.log_activity(
            project_id=project_id,
            action="completed",
            user_id=user_id,
            entity_type="project",
            entity_id=project_id
        )

        return project

    def list_projects(self, **kwargs) -> List[Project]:
        """List projects."""
        return self.registry.list_projects(**kwargs)

    def search_projects(self, query: str, workspace_id: Optional[str] = None) -> List[Project]:
        """Search projects."""
        return self.registry.search_projects(query, workspace_id)

    def get_my_projects(self, user_id: str) -> List[Project]:
        """Get projects the user is a member of."""
        return self.registry.get_user_projects(user_id)

    # Member operations
    def add_member(
        self,
        project_id: str,
        user_id: str,
        role: MemberRole = MemberRole.MEMBER,
        added_by: Optional[str] = None
    ) -> Optional[ProjectMember]:
        """Add a member to a project."""
        member = self.registry.add_member(project_id, user_id, role, added_by)

        if member:
            self.registry.log_activity(
                project_id=project_id,
                action="member_added",
                user_id=added_by,
                entity_type="member",
                entity_id=user_id,
                description=f"User {user_id} added as {role.value}"
            )

        return member

    def remove_member(self, project_id: str, user_id: str, removed_by: Optional[str] = None) -> bool:
        """Remove a member from a project."""
        result = self.registry.remove_member(project_id, user_id)

        if result:
            self.registry.log_activity(
                project_id=project_id,
                action="member_removed",
                user_id=removed_by,
                entity_type="member",
                entity_id=user_id
            )

        return result

    def update_member_role(
        self,
        project_id: str,
        user_id: str,
        new_role: MemberRole,
        updated_by: Optional[str] = None
    ) -> bool:
        """Update a member's role."""
        result = self.registry.update_member_role(project_id, user_id, new_role)

        if result:
            self.registry.log_activity(
                project_id=project_id,
                action="member_role_updated",
                user_id=updated_by,
                entity_type="member",
                entity_id=user_id,
                changes={"role": new_role.value}
            )

        return result

    def get_members(self, project_id: str) -> List[ProjectMember]:
        """Get project members."""
        return self.registry.get_project_members(project_id)

    def is_member(self, project_id: str, user_id: str) -> bool:
        """Check if user is a member of the project."""
        return self.registry.get_project_member(project_id, user_id) is not None

    def get_member_role(self, project_id: str, user_id: str) -> Optional[MemberRole]:
        """Get user's role in a project."""
        member = self.registry.get_project_member(project_id, user_id)
        return member.role if member else None

    # Milestone operations
    def create_milestone(
        self,
        project_id: str,
        name: str,
        description: str = "",
        due_date: Optional[datetime] = None,
        owner_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Optional[Milestone]:
        """Create a milestone."""
        milestone = self.registry.create_milestone(
            project_id=project_id,
            name=name,
            description=description,
            due_date=due_date,
            owner_id=owner_id
        )

        if milestone:
            self.registry.log_activity(
                project_id=project_id,
                action="milestone_created",
                user_id=created_by,
                entity_type="milestone",
                entity_id=milestone.id,
                description=f"Milestone '{name}' created"
            )

        return milestone

    def get_milestone(self, milestone_id: str) -> Optional[Milestone]:
        """Get a milestone."""
        return self.registry.get_milestone(milestone_id)

    def update_milestone(
        self,
        milestone_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        due_date: Optional[datetime] = None,
        status: Optional[MilestoneStatus] = None
    ) -> Optional[Milestone]:
        """Update a milestone."""
        milestone = self.registry.get_milestone(milestone_id)
        if not milestone:
            return None

        if name is not None:
            milestone.name = name
        if description is not None:
            milestone.description = description
        if due_date is not None:
            milestone.due_date = due_date
        if status is not None:
            milestone.status = status
            if status == MilestoneStatus.COMPLETED:
                milestone.completed_at = datetime.utcnow()

        self.registry.update_milestone(milestone)
        return milestone

    def delete_milestone(self, milestone_id: str) -> bool:
        """Delete a milestone."""
        return self.registry.delete_milestone(milestone_id)

    def complete_milestone(self, milestone_id: str, completed_by: Optional[str] = None) -> bool:
        """Mark a milestone as completed."""
        milestone = self.registry.get_milestone(milestone_id)
        if not milestone:
            return False

        result = self.registry.complete_milestone(milestone_id)

        if result:
            self.registry.log_activity(
                project_id=milestone.project_id,
                action="milestone_completed",
                user_id=completed_by,
                entity_type="milestone",
                entity_id=milestone_id,
                description=f"Milestone '{milestone.name}' completed"
            )

        return result

    def get_milestones(self, project_id: str) -> List[Milestone]:
        """Get project milestones."""
        return self.registry.get_project_milestones(project_id)

    def add_task_to_milestone(self, milestone_id: str, task_id: str) -> bool:
        """Add a task to a milestone."""
        milestone = self.registry.get_milestone(milestone_id)
        if not milestone:
            return False

        milestone.add_task(task_id)
        self.registry.update_milestone(milestone)
        return True

    def remove_task_from_milestone(self, milestone_id: str, task_id: str) -> bool:
        """Remove a task from a milestone."""
        milestone = self.registry.get_milestone(milestone_id)
        if not milestone:
            return False

        if milestone.remove_task(task_id):
            self.registry.update_milestone(milestone)
            return True
        return False

    # Phase operations
    def create_phase(
        self,
        project_id: str,
        name: str,
        description: str = "",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Optional[ProjectPhase]:
        """Create a project phase."""
        return self.registry.create_phase(
            project_id=project_id,
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date
        )

    def get_phase(self, phase_id: str) -> Optional[ProjectPhase]:
        """Get a phase."""
        return self.registry.get_phase(phase_id)

    def update_phase(
        self,
        phase_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[PhaseStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Optional[ProjectPhase]:
        """Update a phase."""
        phase = self.registry.get_phase(phase_id)
        if not phase:
            return None

        if name is not None:
            phase.name = name
        if description is not None:
            phase.description = description
        if status is not None:
            if status == PhaseStatus.IN_PROGRESS and phase.status == PhaseStatus.NOT_STARTED:
                phase.start()
            elif status == PhaseStatus.COMPLETED:
                phase.complete()
            else:
                phase.status = status
        if start_date is not None:
            phase.start_date = start_date
        if end_date is not None:
            phase.end_date = end_date

        self.registry.update_phase(phase)
        return phase

    def delete_phase(self, phase_id: str) -> bool:
        """Delete a phase."""
        return self.registry.delete_phase(phase_id)

    def get_phases(self, project_id: str) -> List[ProjectPhase]:
        """Get project phases."""
        return self.registry.get_project_phases(project_id)

    # Template operations
    def create_template(
        self,
        name: str,
        description: str = "",
        project_type: ProjectType = ProjectType.STANDARD,
        phases: Optional[List[Dict[str, Any]]] = None,
        milestones: Optional[List[Dict[str, Any]]] = None,
        workspace_id: Optional[str] = None,
        created_by: Optional[str] = None,
        is_public: bool = False,
        tags: Optional[Set[str]] = None
    ) -> ProjectTemplate:
        """Create a project template."""
        return self.registry.create_template(
            name=name,
            description=description,
            project_type=project_type,
            phases=phases or [],
            milestones=milestones or [],
            workspace_id=workspace_id,
            created_by=created_by,
            is_public=is_public,
            tags=tags or set()
        )

    def get_template(self, template_id: str) -> Optional[ProjectTemplate]:
        """Get a template."""
        return self.registry.get_template(template_id)

    def list_templates(self, workspace_id: Optional[str] = None) -> List[ProjectTemplate]:
        """List templates."""
        return self.registry.list_templates(workspace_id)

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        return self.registry.delete_template(template_id)

    # Activity and metrics
    def get_activities(self, project_id: str, limit: int = 50) -> List[ProjectActivity]:
        """Get project activities."""
        return self.registry.get_project_activities(project_id, limit)

    def get_metrics(self, project_id: str) -> Optional[ProjectMetrics]:
        """Get project metrics."""
        project = self.registry.get_project(project_id)
        if not project:
            return None

        milestones = self.get_milestones(project_id)
        members = self.get_members(project_id)

        completed_milestones = sum(
            1 for m in milestones
            if m.status == MilestoneStatus.COMPLETED
        )

        days_since_start = 0
        if project.start_date:
            days_since_start = (datetime.utcnow() - project.start_date).days

        return ProjectMetrics(
            total_milestones=len(milestones),
            completed_milestones=completed_milestones,
            team_size=len(members),
            days_since_start=days_since_start,
            days_until_deadline=project.days_until_deadline
        )

    def calculate_health(self, project_id: str) -> ProjectHealth:
        """Calculate project health based on metrics."""
        project = self.registry.get_project(project_id)
        if not project:
            return ProjectHealth.UNKNOWN

        if project.status == ProjectStatus.COMPLETED:
            return ProjectHealth.ON_TRACK

        # Check if overdue
        if project.is_overdue:
            return ProjectHealth.OFF_TRACK

        # Check milestones
        milestones = self.get_milestones(project_id)
        overdue_milestones = sum(1 for m in milestones if m.is_overdue)

        if overdue_milestones > 0:
            return ProjectHealth.AT_RISK

        # Check if approaching deadline with incomplete milestones
        if project.days_until_deadline is not None and project.days_until_deadline < 7:
            incomplete = sum(
                1 for m in milestones
                if m.status not in (MilestoneStatus.COMPLETED, MilestoneStatus.CANCELLED)
            )
            if incomplete > 0:
                return ProjectHealth.AT_RISK

        return ProjectHealth.ON_TRACK

    def get_stats(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get project statistics."""
        projects = self.registry.list_projects(workspace_id=workspace_id, limit=100000, include_archived=True)

        status_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        health_counts: Dict[str, int] = {}
        total_members = 0
        total_milestones = 0

        for project in projects:
            status_counts[project.status.value] = status_counts.get(project.status.value, 0) + 1
            type_counts[project.project_type.value] = type_counts.get(project.project_type.value, 0) + 1
            health_counts[project.health.value] = health_counts.get(project.health.value, 0) + 1
            total_members += len(project.member_ids)
            total_milestones += len(project.milestone_ids)

        return {
            "total_projects": len(projects),
            "by_status": status_counts,
            "by_type": type_counts,
            "by_health": health_counts,
            "total_members": total_members,
            "total_milestones": total_milestones,
            "total_templates": len(self.registry._templates),
        }


# ==================== Global Instances ====================

_project_manager: Optional[ProjectManager] = None


def get_project_manager() -> Optional[ProjectManager]:
    """Get the global project manager."""
    return _project_manager


def set_project_manager(manager: ProjectManager) -> None:
    """Set the global project manager."""
    global _project_manager
    _project_manager = manager


def reset_project_manager() -> None:
    """Reset the global project manager."""
    global _project_manager
    _project_manager = None
