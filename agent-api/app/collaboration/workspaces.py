"""
Teams & Workspaces Module

Implements workspace and team management functionality with:
- Workspace creation and lifecycle management
- Team organization within workspaces
- Membership management with role-based access
- Workspace settings and customization
- Cross-team collaboration features
- Invitation and onboarding flows
- Activity tracking and audit
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import time
import secrets
import hashlib


# ==================== Enums ====================

class WorkspaceStatus(Enum):
    """Workspace status."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"
    PENDING_DELETION = "pending_deletion"


class WorkspacePlan(Enum):
    """Workspace subscription plan."""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


class WorkspaceRole(Enum):
    """Workspace-level roles."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"
    BILLING = "billing"


class TeamStatus(Enum):
    """Team status."""
    ACTIVE = "active"
    ARCHIVED = "archived"


class TeamVisibility(Enum):
    """Team visibility settings."""
    PUBLIC = "public"  # Visible to all workspace members
    PRIVATE = "private"  # Only visible to team members
    SECRET = "secret"  # Hidden from workspace directory


class TeamRole(Enum):
    """Team-level roles."""
    LEAD = "lead"
    MEMBER = "member"
    GUEST = "guest"


class InvitationStatus(Enum):
    """Invitation status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class WorkspaceFeature(Enum):
    """Workspace features that can be enabled/disabled."""
    PROJECTS = "projects"
    TASKS = "tasks"
    RESOURCES = "resources"
    TEMPLATES = "templates"
    WORKFLOWS = "workflows"
    INTEGRATIONS = "integrations"
    ANALYTICS = "analytics"
    CUSTOM_FIELDS = "custom_fields"
    API_ACCESS = "api_access"
    SSO = "sso"
    AUDIT_LOG = "audit_log"
    ADVANCED_PERMISSIONS = "advanced_permissions"


# ==================== Data Classes ====================

@dataclass
class WorkspaceSettings:
    """Workspace configuration settings."""
    # General settings
    default_project_visibility: str = "team"
    default_task_visibility: str = "team"
    allow_guest_access: bool = True
    require_2fa: bool = False

    # Notification settings
    email_notifications: bool = True
    digest_frequency: str = "daily"  # instant, hourly, daily, weekly

    # Security settings
    session_timeout_minutes: int = 480  # 8 hours
    password_min_length: int = 8
    allowed_domains: Set[str] = field(default_factory=set)
    blocked_domains: Set[str] = field(default_factory=set)

    # Limits
    max_projects: int = 0  # 0 = unlimited
    max_members: int = 0
    max_storage_gb: float = 0
    max_file_size_mb: int = 100

    # Branding
    custom_domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None

    # Features
    enabled_features: Set[WorkspaceFeature] = field(default_factory=lambda: {
        WorkspaceFeature.PROJECTS,
        WorkspaceFeature.TASKS,
        WorkspaceFeature.RESOURCES,
    })

    def is_feature_enabled(self, feature: WorkspaceFeature) -> bool:
        """Check if a feature is enabled."""
        return feature in self.enabled_features

    def enable_feature(self, feature: WorkspaceFeature) -> None:
        """Enable a feature."""
        self.enabled_features.add(feature)

    def disable_feature(self, feature: WorkspaceFeature) -> None:
        """Disable a feature."""
        self.enabled_features.discard(feature)

    def is_domain_allowed(self, email: str) -> bool:
        """Check if an email domain is allowed."""
        domain = email.split("@")[-1].lower()

        if self.blocked_domains and domain in self.blocked_domains:
            return False

        if self.allowed_domains:
            return domain in self.allowed_domains

        return True


@dataclass
class WorkspaceMember:
    """A member of a workspace."""
    id: str
    workspace_id: str
    user_id: str
    role: WorkspaceRole
    joined_at: datetime = field(default_factory=datetime.utcnow)
    invited_by: Optional[str] = None
    is_active: bool = True

    # Profile within workspace
    display_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None

    # Permissions
    custom_permissions: Set[str] = field(default_factory=set)
    team_ids: Set[str] = field(default_factory=set)

    # Settings
    notification_preferences: Dict[str, Any] = field(default_factory=dict)
    last_active_at: Optional[datetime] = None

    metadata: Dict[str, Any] = field(default_factory=dict)

    def has_permission(self, permission: str) -> bool:
        """Check if member has a specific permission."""
        if self.role in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
            return True
        return permission in self.custom_permissions

    def can_manage_workspace(self) -> bool:
        """Check if member can manage workspace settings."""
        return self.role in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)

    def can_manage_members(self) -> bool:
        """Check if member can manage other members."""
        return self.role in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)

    def can_manage_billing(self) -> bool:
        """Check if member can manage billing."""
        return self.role in (WorkspaceRole.OWNER, WorkspaceRole.BILLING)

    def can_create_teams(self) -> bool:
        """Check if member can create teams."""
        return self.role in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)

    def is_guest(self) -> bool:
        """Check if member is a guest."""
        return self.role == WorkspaceRole.GUEST

    def update_activity(self) -> None:
        """Update last active timestamp."""
        self.last_active_at = datetime.utcnow()


@dataclass
class TeamMember:
    """A member of a team."""
    id: str
    team_id: str
    user_id: str
    workspace_member_id: str
    role: TeamRole
    joined_at: datetime = field(default_factory=datetime.utcnow)
    added_by: Optional[str] = None
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_lead(self) -> bool:
        """Check if member is a team lead."""
        return self.role == TeamRole.LEAD

    def can_manage_team(self) -> bool:
        """Check if member can manage team settings."""
        return self.role == TeamRole.LEAD


@dataclass
class Team:
    """A team within a workspace."""
    id: str
    workspace_id: str
    name: str
    description: str = ""
    status: TeamStatus = TeamStatus.ACTIVE
    visibility: TeamVisibility = TeamVisibility.PUBLIC

    # Organization
    parent_team_id: Optional[str] = None  # For nested teams
    member_ids: Set[str] = field(default_factory=set)  # user_ids

    # Metadata
    icon: Optional[str] = None
    color: Optional[str] = None
    tags: Set[str] = field(default_factory=set)

    # Settings
    settings: Dict[str, Any] = field(default_factory=dict)

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def member_count(self) -> int:
        """Get the number of team members."""
        return len(self.member_ids)

    def add_member(self, user_id: str) -> None:
        """Add a member to the team."""
        self.member_ids.add(user_id)
        self.updated_at = datetime.utcnow()

    def remove_member(self, user_id: str) -> bool:
        """Remove a member from the team."""
        if user_id in self.member_ids:
            self.member_ids.discard(user_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def is_member(self, user_id: str) -> bool:
        """Check if user is a team member."""
        return user_id in self.member_ids

    def archive(self) -> None:
        """Archive the team."""
        self.status = TeamStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "visibility": self.visibility.value,
            "member_count": self.member_count,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class WorkspaceInvitation:
    """An invitation to join a workspace."""
    id: str
    workspace_id: str
    email: str
    role: WorkspaceRole = WorkspaceRole.MEMBER
    status: InvitationStatus = InvitationStatus.PENDING

    # Invitation details
    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    invited_by: Optional[str] = None
    team_ids: Set[str] = field(default_factory=set)  # Auto-join teams

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(days=7))
    accepted_at: Optional[datetime] = None

    # Response tracking
    user_id: Optional[str] = None  # Set when accepted
    message: str = ""  # Personal message from inviter

    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if invitation is expired."""
        if self.status != InvitationStatus.PENDING:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if invitation is valid and can be accepted."""
        return self.status == InvitationStatus.PENDING and not self.is_expired

    def accept(self, user_id: str) -> bool:
        """Accept the invitation."""
        if not self.is_valid:
            return False

        self.status = InvitationStatus.ACCEPTED
        self.user_id = user_id
        self.accepted_at = datetime.utcnow()
        return True

    def decline(self) -> bool:
        """Decline the invitation."""
        if self.status != InvitationStatus.PENDING:
            return False

        self.status = InvitationStatus.DECLINED
        return True

    def revoke(self) -> bool:
        """Revoke the invitation."""
        if self.status != InvitationStatus.PENDING:
            return False

        self.status = InvitationStatus.REVOKED
        return True

    def extend(self, days: int = 7) -> None:
        """Extend the invitation expiry."""
        self.expires_at = datetime.utcnow() + timedelta(days=days)


@dataclass
class WorkspaceUsage:
    """Workspace usage statistics."""
    workspace_id: str

    # Member counts
    total_members: int = 0
    active_members: int = 0
    guest_members: int = 0
    pending_invitations: int = 0

    # Team counts
    total_teams: int = 0
    active_teams: int = 0

    # Project counts
    total_projects: int = 0
    active_projects: int = 0

    # Storage
    storage_used_bytes: int = 0
    storage_limit_bytes: int = 0

    # Activity
    last_activity_at: Optional[datetime] = None
    monthly_active_users: int = 0

    calculated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def storage_used_gb(self) -> float:
        """Get storage used in GB."""
        return self.storage_used_bytes / (1024 ** 3)

    @property
    def storage_percentage(self) -> float:
        """Get storage usage percentage."""
        if self.storage_limit_bytes == 0:
            return 0.0
        return (self.storage_used_bytes / self.storage_limit_bytes) * 100

    @property
    def member_percentage(self) -> float:
        """Get member count vs active percentage."""
        if self.total_members == 0:
            return 0.0
        return (self.active_members / self.total_members) * 100


@dataclass
class WorkspaceActivity:
    """An activity entry for a workspace."""
    id: str
    workspace_id: str
    user_id: Optional[str] = None
    action: str = ""
    entity_type: str = ""  # workspace, team, member, invitation
    entity_id: Optional[str] = None
    description: str = ""
    changes: Dict[str, Any] = field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Workspace:
    """A workspace - the top-level organization unit."""
    id: str
    name: str
    slug: str  # URL-friendly identifier
    description: str = ""
    status: WorkspaceStatus = WorkspaceStatus.ACTIVE
    plan: WorkspacePlan = WorkspacePlan.FREE

    # Ownership
    owner_id: Optional[str] = None

    # Organization info
    organization_name: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None  # 1-10, 11-50, 51-200, 201-500, 500+

    # Branding
    logo_url: Optional[str] = None
    icon: Optional[str] = None
    primary_color: Optional[str] = None

    # Settings
    settings: WorkspaceSettings = field(default_factory=WorkspaceSettings)

    # Relationships
    member_ids: Set[str] = field(default_factory=set)
    team_ids: Set[str] = field(default_factory=set)

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # Billing
    billing_email: Optional[str] = None
    trial_ends_at: Optional[datetime] = None

    # Custom data
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def member_count(self) -> int:
        """Get the number of workspace members."""
        return len(self.member_ids)

    @property
    def team_count(self) -> int:
        """Get the number of teams."""
        return len(self.team_ids)

    @property
    def is_trial(self) -> bool:
        """Check if workspace is in trial period."""
        if not self.trial_ends_at:
            return False
        return datetime.utcnow() < self.trial_ends_at

    @property
    def trial_days_remaining(self) -> Optional[int]:
        """Get remaining trial days."""
        if not self.trial_ends_at:
            return None
        if datetime.utcnow() >= self.trial_ends_at:
            return 0
        return (self.trial_ends_at - datetime.utcnow()).days

    def is_feature_enabled(self, feature: WorkspaceFeature) -> bool:
        """Check if a feature is enabled."""
        return self.settings.is_feature_enabled(feature)

    def suspend(self) -> None:
        """Suspend the workspace."""
        self.status = WorkspaceStatus.SUSPENDED
        self.updated_at = datetime.utcnow()

    def activate(self) -> None:
        """Activate the workspace."""
        self.status = WorkspaceStatus.ACTIVE
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the workspace."""
        self.status = WorkspaceStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "status": self.status.value,
            "plan": self.plan.value,
            "owner_id": self.owner_id,
            "member_count": self.member_count,
            "team_count": self.team_count,
            "is_trial": self.is_trial,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ==================== Workspace Registry ====================

class WorkspaceRegistry:
    """Central registry for managing workspaces and teams."""

    _counter: int = 0

    def __init__(self):
        self._workspaces: Dict[str, Workspace] = {}
        self._workspace_members: Dict[str, WorkspaceMember] = {}
        self._teams: Dict[str, Team] = {}
        self._team_members: Dict[str, TeamMember] = {}
        self._invitations: Dict[str, WorkspaceInvitation] = {}
        self._activities: List[WorkspaceActivity] = []

        # Indexes
        self._slug_to_workspace: Dict[str, str] = {}
        self._user_workspaces: Dict[str, Set[str]] = {}  # user_id -> workspace_ids
        self._workspace_teams: Dict[str, Set[str]] = {}  # workspace_id -> team_ids
        self._email_invitations: Dict[str, Set[str]] = {}  # email -> invitation_ids

    # Workspace operations
    def create_workspace(
        self,
        name: str,
        slug: str,
        owner_id: Optional[str] = None,
        **kwargs
    ) -> Workspace:
        """Create a new workspace."""
        # Validate slug uniqueness
        if slug in self._slug_to_workspace:
            raise ValueError(f"Workspace slug '{slug}' already exists")

        WorkspaceRegistry._counter += 1
        workspace_id = f"ws_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        workspace = Workspace(
            id=workspace_id,
            name=name,
            slug=slug,
            owner_id=owner_id,
            **kwargs
        )

        self._workspaces[workspace_id] = workspace
        self._slug_to_workspace[slug] = workspace_id
        self._workspace_teams[workspace_id] = set()

        # Add owner as member
        if owner_id:
            self.add_member(workspace_id, owner_id, WorkspaceRole.OWNER)

        return workspace

    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        """Get a workspace by ID."""
        return self._workspaces.get(workspace_id)

    def get_workspace_by_slug(self, slug: str) -> Optional[Workspace]:
        """Get a workspace by slug."""
        workspace_id = self._slug_to_workspace.get(slug)
        if workspace_id:
            return self._workspaces.get(workspace_id)
        return None

    def update_workspace(self, workspace: Workspace) -> bool:
        """Update a workspace."""
        if workspace.id not in self._workspaces:
            return False

        workspace.updated_at = datetime.utcnow()
        self._workspaces[workspace.id] = workspace
        return True

    def delete_workspace(self, workspace_id: str, soft_delete: bool = True) -> bool:
        """Delete a workspace."""
        workspace = self._workspaces.get(workspace_id)
        if not workspace:
            return False

        if soft_delete:
            workspace.status = WorkspaceStatus.PENDING_DELETION
            workspace.updated_at = datetime.utcnow()
        else:
            # Remove from indexes
            if workspace.slug in self._slug_to_workspace:
                del self._slug_to_workspace[workspace.slug]

            # Remove members
            member_ids = [
                mid for mid, m in self._workspace_members.items()
                if m.workspace_id == workspace_id
            ]
            for mid in member_ids:
                member = self._workspace_members[mid]
                if member.user_id in self._user_workspaces:
                    self._user_workspaces[member.user_id].discard(workspace_id)
                del self._workspace_members[mid]

            # Remove teams
            team_ids = list(self._workspace_teams.get(workspace_id, set()))
            for tid in team_ids:
                self.delete_team(tid, soft_delete=False)

            if workspace_id in self._workspace_teams:
                del self._workspace_teams[workspace_id]

            del self._workspaces[workspace_id]

        return True

    def list_workspaces(
        self,
        user_id: Optional[str] = None,
        status: Optional[WorkspaceStatus] = None,
        plan: Optional[WorkspacePlan] = None,
        include_archived: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> List[Workspace]:
        """List workspaces matching criteria."""
        if user_id and user_id in self._user_workspaces:
            workspace_ids = self._user_workspaces[user_id]
            workspaces = [self._workspaces[wid] for wid in workspace_ids if wid in self._workspaces]
        else:
            workspaces = list(self._workspaces.values())

        # Filter by status
        if status:
            workspaces = [w for w in workspaces if w.status == status]
        elif not include_archived:
            workspaces = [w for w in workspaces if w.status not in (
                WorkspaceStatus.ARCHIVED, WorkspaceStatus.PENDING_DELETION
            )]

        # Filter by plan
        if plan:
            workspaces = [w for w in workspaces if w.plan == plan]

        # Sort by updated_at desc
        workspaces.sort(key=lambda w: w.updated_at, reverse=True)

        return workspaces[offset:offset + limit]

    def search_workspaces(self, query: str) -> List[Workspace]:
        """Search workspaces by name or slug."""
        query_lower = query.lower()
        results = []

        for workspace in self._workspaces.values():
            if workspace.status in (WorkspaceStatus.ARCHIVED, WorkspaceStatus.PENDING_DELETION):
                continue
            if (query_lower in workspace.name.lower() or
                query_lower in workspace.slug.lower() or
                query_lower in workspace.description.lower()):
                results.append(workspace)

        return results

    # Member operations
    def add_member(
        self,
        workspace_id: str,
        user_id: str,
        role: WorkspaceRole,
        invited_by: Optional[str] = None
    ) -> Optional[WorkspaceMember]:
        """Add a member to a workspace."""
        workspace = self._workspaces.get(workspace_id)
        if not workspace:
            return None

        # Check if already a member
        for member in self._workspace_members.values():
            if member.workspace_id == workspace_id and member.user_id == user_id:
                return member

        WorkspaceRegistry._counter += 1
        member_id = f"wm_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        member = WorkspaceMember(
            id=member_id,
            workspace_id=workspace_id,
            user_id=user_id,
            role=role,
            invited_by=invited_by
        )

        self._workspace_members[member_id] = member
        workspace.member_ids.add(user_id)

        # Update user index
        if user_id not in self._user_workspaces:
            self._user_workspaces[user_id] = set()
        self._user_workspaces[user_id].add(workspace_id)

        return member

    def get_member(self, member_id: str) -> Optional[WorkspaceMember]:
        """Get a member by ID."""
        return self._workspace_members.get(member_id)

    def get_workspace_member(self, workspace_id: str, user_id: str) -> Optional[WorkspaceMember]:
        """Get a member by workspace and user ID."""
        for member in self._workspace_members.values():
            if member.workspace_id == workspace_id and member.user_id == user_id:
                return member
        return None

    def update_member_role(self, workspace_id: str, user_id: str, new_role: WorkspaceRole) -> bool:
        """Update a member's role."""
        member = self.get_workspace_member(workspace_id, user_id)
        if not member:
            return False

        member.role = new_role
        return True

    def remove_member(self, workspace_id: str, user_id: str) -> bool:
        """Remove a member from a workspace."""
        workspace = self._workspaces.get(workspace_id)
        if not workspace:
            return False

        member = self.get_workspace_member(workspace_id, user_id)
        if not member:
            return False

        # Remove from teams
        for team_id in list(member.team_ids):
            self.remove_team_member(team_id, user_id)

        del self._workspace_members[member.id]
        workspace.member_ids.discard(user_id)

        if user_id in self._user_workspaces:
            self._user_workspaces[user_id].discard(workspace_id)

        return True

    def get_workspace_members(
        self,
        workspace_id: str,
        role: Optional[WorkspaceRole] = None,
        active_only: bool = True
    ) -> List[WorkspaceMember]:
        """Get all members of a workspace."""
        members = [
            m for m in self._workspace_members.values()
            if m.workspace_id == workspace_id
        ]

        if active_only:
            members = [m for m in members if m.is_active]

        if role:
            members = [m for m in members if m.role == role]

        return members

    def get_user_workspaces(self, user_id: str) -> List[Workspace]:
        """Get all workspaces a user is a member of."""
        workspace_ids = self._user_workspaces.get(user_id, set())
        return [self._workspaces[wid] for wid in workspace_ids if wid in self._workspaces]

    # Team operations
    def create_team(
        self,
        workspace_id: str,
        name: str,
        created_by: Optional[str] = None,
        **kwargs
    ) -> Optional[Team]:
        """Create a new team."""
        workspace = self._workspaces.get(workspace_id)
        if not workspace:
            return None

        WorkspaceRegistry._counter += 1
        team_id = f"team_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        team = Team(
            id=team_id,
            workspace_id=workspace_id,
            name=name,
            created_by=created_by,
            **kwargs
        )

        self._teams[team_id] = team
        workspace.team_ids.add(team_id)
        self._workspace_teams[workspace_id].add(team_id)

        # Add creator as team lead
        if created_by:
            self.add_team_member(team_id, created_by, TeamRole.LEAD)

        return team

    def get_team(self, team_id: str) -> Optional[Team]:
        """Get a team by ID."""
        return self._teams.get(team_id)

    def update_team(self, team: Team) -> bool:
        """Update a team."""
        if team.id not in self._teams:
            return False

        team.updated_at = datetime.utcnow()
        self._teams[team.id] = team
        return True

    def delete_team(self, team_id: str, soft_delete: bool = True) -> bool:
        """Delete a team."""
        team = self._teams.get(team_id)
        if not team:
            return False

        if soft_delete:
            team.status = TeamStatus.ARCHIVED
            team.updated_at = datetime.utcnow()
        else:
            workspace = self._workspaces.get(team.workspace_id)
            if workspace:
                workspace.team_ids.discard(team_id)

            if team.workspace_id in self._workspace_teams:
                self._workspace_teams[team.workspace_id].discard(team_id)

            # Remove team members
            tm_ids = [
                tmid for tmid, tm in self._team_members.items()
                if tm.team_id == team_id
            ]
            for tmid in tm_ids:
                del self._team_members[tmid]

            del self._teams[team_id]

        return True

    def get_workspace_teams(
        self,
        workspace_id: str,
        visibility: Optional[TeamVisibility] = None,
        include_archived: bool = False
    ) -> List[Team]:
        """Get all teams in a workspace."""
        team_ids = self._workspace_teams.get(workspace_id, set())
        teams = [self._teams[tid] for tid in team_ids if tid in self._teams]

        if not include_archived:
            teams = [t for t in teams if t.status == TeamStatus.ACTIVE]

        if visibility:
            teams = [t for t in teams if t.visibility == visibility]

        teams.sort(key=lambda t: t.name)
        return teams

    def search_teams(self, workspace_id: str, query: str) -> List[Team]:
        """Search teams by name."""
        query_lower = query.lower()
        teams = self.get_workspace_teams(workspace_id)

        return [
            t for t in teams
            if query_lower in t.name.lower() or query_lower in t.description.lower()
        ]

    # Team member operations
    def add_team_member(
        self,
        team_id: str,
        user_id: str,
        role: TeamRole = TeamRole.MEMBER,
        added_by: Optional[str] = None
    ) -> Optional[TeamMember]:
        """Add a member to a team."""
        team = self._teams.get(team_id)
        if not team:
            return None

        # Verify user is a workspace member
        workspace_member = self.get_workspace_member(team.workspace_id, user_id)
        if not workspace_member:
            return None

        # Check if already a team member
        for tm in self._team_members.values():
            if tm.team_id == team_id and tm.user_id == user_id:
                return tm

        WorkspaceRegistry._counter += 1
        tm_id = f"tm_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        team_member = TeamMember(
            id=tm_id,
            team_id=team_id,
            user_id=user_id,
            workspace_member_id=workspace_member.id,
            role=role,
            added_by=added_by
        )

        self._team_members[tm_id] = team_member
        team.member_ids.add(user_id)
        workspace_member.team_ids.add(team_id)

        return team_member

    def get_team_member(self, team_id: str, user_id: str) -> Optional[TeamMember]:
        """Get a team member."""
        for tm in self._team_members.values():
            if tm.team_id == team_id and tm.user_id == user_id:
                return tm
        return None

    def update_team_member_role(self, team_id: str, user_id: str, new_role: TeamRole) -> bool:
        """Update a team member's role."""
        tm = self.get_team_member(team_id, user_id)
        if not tm:
            return False

        tm.role = new_role
        return True

    def remove_team_member(self, team_id: str, user_id: str) -> bool:
        """Remove a member from a team."""
        team = self._teams.get(team_id)
        if not team:
            return False

        tm = self.get_team_member(team_id, user_id)
        if not tm:
            return False

        # Update workspace member
        workspace_member = self.get_workspace_member(team.workspace_id, user_id)
        if workspace_member:
            workspace_member.team_ids.discard(team_id)

        team.member_ids.discard(user_id)
        del self._team_members[tm.id]

        return True

    def get_team_members(self, team_id: str) -> List[TeamMember]:
        """Get all members of a team."""
        return [
            tm for tm in self._team_members.values()
            if tm.team_id == team_id and tm.is_active
        ]

    def get_user_teams(self, workspace_id: str, user_id: str) -> List[Team]:
        """Get all teams a user is a member of in a workspace."""
        workspace_member = self.get_workspace_member(workspace_id, user_id)
        if not workspace_member:
            return []

        return [
            self._teams[tid] for tid in workspace_member.team_ids
            if tid in self._teams
        ]

    # Invitation operations
    def create_invitation(
        self,
        workspace_id: str,
        email: str,
        role: WorkspaceRole = WorkspaceRole.MEMBER,
        invited_by: Optional[str] = None,
        team_ids: Optional[Set[str]] = None,
        message: str = "",
        expires_days: int = 7
    ) -> Optional[WorkspaceInvitation]:
        """Create a workspace invitation."""
        workspace = self._workspaces.get(workspace_id)
        if not workspace:
            return None

        # Check domain restrictions
        if not workspace.settings.is_domain_allowed(email):
            return None

        WorkspaceRegistry._counter += 1
        invitation_id = f"inv_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        invitation = WorkspaceInvitation(
            id=invitation_id,
            workspace_id=workspace_id,
            email=email.lower(),
            role=role,
            invited_by=invited_by,
            team_ids=team_ids or set(),
            message=message,
            expires_at=datetime.utcnow() + timedelta(days=expires_days)
        )

        self._invitations[invitation_id] = invitation

        # Index by email
        email_lower = email.lower()
        if email_lower not in self._email_invitations:
            self._email_invitations[email_lower] = set()
        self._email_invitations[email_lower].add(invitation_id)

        return invitation

    def get_invitation(self, invitation_id: str) -> Optional[WorkspaceInvitation]:
        """Get an invitation by ID."""
        return self._invitations.get(invitation_id)

    def get_invitation_by_token(self, token: str) -> Optional[WorkspaceInvitation]:
        """Get an invitation by token."""
        for invitation in self._invitations.values():
            if invitation.token == token:
                return invitation
        return None

    def get_invitations_for_email(self, email: str) -> List[WorkspaceInvitation]:
        """Get all invitations for an email address."""
        email_lower = email.lower()
        invitation_ids = self._email_invitations.get(email_lower, set())
        return [
            self._invitations[inv_id]
            for inv_id in invitation_ids
            if inv_id in self._invitations
        ]

    def get_workspace_invitations(
        self,
        workspace_id: str,
        status: Optional[InvitationStatus] = None
    ) -> List[WorkspaceInvitation]:
        """Get all invitations for a workspace."""
        invitations = [
            inv for inv in self._invitations.values()
            if inv.workspace_id == workspace_id
        ]

        if status:
            invitations = [inv for inv in invitations if inv.status == status]

        invitations.sort(key=lambda i: i.created_at, reverse=True)
        return invitations

    def accept_invitation(self, invitation_id: str, user_id: str) -> Optional[WorkspaceMember]:
        """Accept an invitation and add user to workspace."""
        invitation = self._invitations.get(invitation_id)
        if not invitation or not invitation.is_valid:
            return None

        if not invitation.accept(user_id):
            return None

        # Add as workspace member
        member = self.add_member(
            invitation.workspace_id,
            user_id,
            invitation.role,
            invitation.invited_by
        )

        if member:
            # Add to teams
            for team_id in invitation.team_ids:
                self.add_team_member(team_id, user_id)

        return member

    def revoke_invitation(self, invitation_id: str) -> bool:
        """Revoke an invitation."""
        invitation = self._invitations.get(invitation_id)
        if not invitation:
            return False

        return invitation.revoke()

    # Activity logging
    def log_activity(
        self,
        workspace_id: str,
        action: str,
        user_id: Optional[str] = None,
        entity_type: str = "",
        entity_id: Optional[str] = None,
        description: str = "",
        changes: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> WorkspaceActivity:
        """Log a workspace activity."""
        WorkspaceRegistry._counter += 1
        activity_id = f"wa_{int(time.time() * 1000)}_{WorkspaceRegistry._counter}"

        activity = WorkspaceActivity(
            id=activity_id,
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            changes=changes or {},
            ip_address=ip_address,
            user_agent=user_agent
        )

        self._activities.append(activity)
        return activity

    def get_workspace_activities(
        self,
        workspace_id: str,
        user_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 50
    ) -> List[WorkspaceActivity]:
        """Get recent activities for a workspace."""
        activities = [a for a in self._activities if a.workspace_id == workspace_id]

        if user_id:
            activities = [a for a in activities if a.user_id == user_id]

        if entity_type:
            activities = [a for a in activities if a.entity_type == entity_type]

        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]


# ==================== Workspace Manager ====================

class WorkspaceManager:
    """High-level manager for workspaces and teams."""

    def __init__(self):
        self.registry = WorkspaceRegistry()

    # Workspace operations
    def create_workspace(
        self,
        name: str,
        slug: str,
        owner_id: Optional[str] = None,
        description: str = "",
        plan: WorkspacePlan = WorkspacePlan.FREE,
        organization_name: Optional[str] = None,
        trial_days: int = 0
    ) -> Workspace:
        """Create a new workspace."""
        trial_ends_at = None
        if trial_days > 0:
            trial_ends_at = datetime.utcnow() + timedelta(days=trial_days)

        workspace = self.registry.create_workspace(
            name=name,
            slug=slug,
            owner_id=owner_id,
            description=description,
            plan=plan,
            organization_name=organization_name,
            trial_ends_at=trial_ends_at
        )

        self.registry.log_activity(
            workspace_id=workspace.id,
            action="created",
            user_id=owner_id,
            entity_type="workspace",
            entity_id=workspace.id,
            description=f"Workspace '{name}' created"
        )

        return workspace

    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        """Get a workspace by ID."""
        return self.registry.get_workspace(workspace_id)

    def get_workspace_by_slug(self, slug: str) -> Optional[Workspace]:
        """Get a workspace by slug."""
        return self.registry.get_workspace_by_slug(slug)

    def update_workspace(
        self,
        workspace_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        plan: Optional[WorkspacePlan] = None,
        updated_by: Optional[str] = None
    ) -> Optional[Workspace]:
        """Update a workspace."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return None

        changes = {}

        if name is not None and name != workspace.name:
            changes["name"] = {"old": workspace.name, "new": name}
            workspace.name = name

        if description is not None:
            workspace.description = description

        if plan is not None and plan != workspace.plan:
            changes["plan"] = {"old": workspace.plan.value, "new": plan.value}
            workspace.plan = plan

        self.registry.update_workspace(workspace)

        if changes:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="updated",
                user_id=updated_by,
                entity_type="workspace",
                entity_id=workspace_id,
                changes=changes
            )

        return workspace

    def delete_workspace(self, workspace_id: str, permanent: bool = False) -> bool:
        """Delete a workspace."""
        return self.registry.delete_workspace(workspace_id, soft_delete=not permanent)

    def suspend_workspace(self, workspace_id: str, reason: str = "", suspended_by: Optional[str] = None) -> Optional[Workspace]:
        """Suspend a workspace."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return None

        workspace.suspend()
        self.registry.update_workspace(workspace)

        self.registry.log_activity(
            workspace_id=workspace_id,
            action="suspended",
            user_id=suspended_by,
            entity_type="workspace",
            entity_id=workspace_id,
            description=reason
        )

        return workspace

    def activate_workspace(self, workspace_id: str, activated_by: Optional[str] = None) -> Optional[Workspace]:
        """Activate a workspace."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return None

        workspace.activate()
        self.registry.update_workspace(workspace)

        self.registry.log_activity(
            workspace_id=workspace_id,
            action="activated",
            user_id=activated_by,
            entity_type="workspace",
            entity_id=workspace_id
        )

        return workspace

    def list_workspaces(self, **kwargs) -> List[Workspace]:
        """List workspaces."""
        return self.registry.list_workspaces(**kwargs)

    def search_workspaces(self, query: str) -> List[Workspace]:
        """Search workspaces."""
        return self.registry.search_workspaces(query)

    def get_my_workspaces(self, user_id: str) -> List[Workspace]:
        """Get workspaces the user is a member of."""
        return self.registry.get_user_workspaces(user_id)

    # Member operations
    def add_member(
        self,
        workspace_id: str,
        user_id: str,
        role: WorkspaceRole = WorkspaceRole.MEMBER,
        added_by: Optional[str] = None
    ) -> Optional[WorkspaceMember]:
        """Add a member to a workspace."""
        member = self.registry.add_member(workspace_id, user_id, role, added_by)

        if member:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="member_added",
                user_id=added_by,
                entity_type="member",
                entity_id=user_id,
                description=f"User added as {role.value}"
            )

        return member

    def remove_member(
        self,
        workspace_id: str,
        user_id: str,
        removed_by: Optional[str] = None
    ) -> bool:
        """Remove a member from a workspace."""
        result = self.registry.remove_member(workspace_id, user_id)

        if result:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="member_removed",
                user_id=removed_by,
                entity_type="member",
                entity_id=user_id
            )

        return result

    def update_member_role(
        self,
        workspace_id: str,
        user_id: str,
        new_role: WorkspaceRole,
        updated_by: Optional[str] = None
    ) -> bool:
        """Update a member's role."""
        result = self.registry.update_member_role(workspace_id, user_id, new_role)

        if result:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="member_role_updated",
                user_id=updated_by,
                entity_type="member",
                entity_id=user_id,
                changes={"role": new_role.value}
            )

        return result

    def get_members(self, workspace_id: str, **kwargs) -> List[WorkspaceMember]:
        """Get workspace members."""
        return self.registry.get_workspace_members(workspace_id, **kwargs)

    def is_member(self, workspace_id: str, user_id: str) -> bool:
        """Check if user is a workspace member."""
        return self.registry.get_workspace_member(workspace_id, user_id) is not None

    def get_member_role(self, workspace_id: str, user_id: str) -> Optional[WorkspaceRole]:
        """Get user's role in a workspace."""
        member = self.registry.get_workspace_member(workspace_id, user_id)
        return member.role if member else None

    # Team operations
    def create_team(
        self,
        workspace_id: str,
        name: str,
        description: str = "",
        visibility: TeamVisibility = TeamVisibility.PUBLIC,
        created_by: Optional[str] = None
    ) -> Optional[Team]:
        """Create a team."""
        team = self.registry.create_team(
            workspace_id=workspace_id,
            name=name,
            description=description,
            visibility=visibility,
            created_by=created_by
        )

        if team:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="team_created",
                user_id=created_by,
                entity_type="team",
                entity_id=team.id,
                description=f"Team '{name}' created"
            )

        return team

    def get_team(self, team_id: str) -> Optional[Team]:
        """Get a team."""
        return self.registry.get_team(team_id)

    def update_team(
        self,
        team_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        visibility: Optional[TeamVisibility] = None,
        updated_by: Optional[str] = None
    ) -> Optional[Team]:
        """Update a team."""
        team = self.registry.get_team(team_id)
        if not team:
            return None

        if name is not None:
            team.name = name
        if description is not None:
            team.description = description
        if visibility is not None:
            team.visibility = visibility

        self.registry.update_team(team)

        self.registry.log_activity(
            workspace_id=team.workspace_id,
            action="team_updated",
            user_id=updated_by,
            entity_type="team",
            entity_id=team_id
        )

        return team

    def delete_team(self, team_id: str, deleted_by: Optional[str] = None) -> bool:
        """Delete a team."""
        team = self.registry.get_team(team_id)
        if not team:
            return False

        result = self.registry.delete_team(team_id)

        if result:
            self.registry.log_activity(
                workspace_id=team.workspace_id,
                action="team_deleted",
                user_id=deleted_by,
                entity_type="team",
                entity_id=team_id
            )

        return result

    def archive_team(self, team_id: str, archived_by: Optional[str] = None) -> Optional[Team]:
        """Archive a team."""
        team = self.registry.get_team(team_id)
        if not team:
            return None

        team.archive()
        self.registry.update_team(team)

        self.registry.log_activity(
            workspace_id=team.workspace_id,
            action="team_archived",
            user_id=archived_by,
            entity_type="team",
            entity_id=team_id
        )

        return team

    def get_teams(self, workspace_id: str, **kwargs) -> List[Team]:
        """Get workspace teams."""
        return self.registry.get_workspace_teams(workspace_id, **kwargs)

    def search_teams(self, workspace_id: str, query: str) -> List[Team]:
        """Search teams."""
        return self.registry.search_teams(workspace_id, query)

    def get_user_teams(self, workspace_id: str, user_id: str) -> List[Team]:
        """Get teams a user is a member of."""
        return self.registry.get_user_teams(workspace_id, user_id)

    # Team member operations
    def add_team_member(
        self,
        team_id: str,
        user_id: str,
        role: TeamRole = TeamRole.MEMBER,
        added_by: Optional[str] = None
    ) -> Optional[TeamMember]:
        """Add a member to a team."""
        team_member = self.registry.add_team_member(team_id, user_id, role, added_by)

        if team_member:
            team = self.registry.get_team(team_id)
            if team:
                self.registry.log_activity(
                    workspace_id=team.workspace_id,
                    action="team_member_added",
                    user_id=added_by,
                    entity_type="team_member",
                    entity_id=user_id,
                    description=f"User added to team as {role.value}"
                )

        return team_member

    def remove_team_member(
        self,
        team_id: str,
        user_id: str,
        removed_by: Optional[str] = None
    ) -> bool:
        """Remove a member from a team."""
        team = self.registry.get_team(team_id)
        result = self.registry.remove_team_member(team_id, user_id)

        if result and team:
            self.registry.log_activity(
                workspace_id=team.workspace_id,
                action="team_member_removed",
                user_id=removed_by,
                entity_type="team_member",
                entity_id=user_id
            )

        return result

    def update_team_member_role(
        self,
        team_id: str,
        user_id: str,
        new_role: TeamRole,
        updated_by: Optional[str] = None
    ) -> bool:
        """Update a team member's role."""
        result = self.registry.update_team_member_role(team_id, user_id, new_role)

        if result:
            team = self.registry.get_team(team_id)
            if team:
                self.registry.log_activity(
                    workspace_id=team.workspace_id,
                    action="team_member_role_updated",
                    user_id=updated_by,
                    entity_type="team_member",
                    entity_id=user_id,
                    changes={"role": new_role.value}
                )

        return result

    def get_team_members(self, team_id: str) -> List[TeamMember]:
        """Get team members."""
        return self.registry.get_team_members(team_id)

    # Invitation operations
    def invite_user(
        self,
        workspace_id: str,
        email: str,
        role: WorkspaceRole = WorkspaceRole.MEMBER,
        invited_by: Optional[str] = None,
        team_ids: Optional[Set[str]] = None,
        message: str = ""
    ) -> Optional[WorkspaceInvitation]:
        """Invite a user to a workspace."""
        invitation = self.registry.create_invitation(
            workspace_id=workspace_id,
            email=email,
            role=role,
            invited_by=invited_by,
            team_ids=team_ids,
            message=message
        )

        if invitation:
            self.registry.log_activity(
                workspace_id=workspace_id,
                action="invitation_sent",
                user_id=invited_by,
                entity_type="invitation",
                entity_id=invitation.id,
                description=f"Invitation sent to {email}"
            )

        return invitation

    def get_invitation(self, invitation_id: str) -> Optional[WorkspaceInvitation]:
        """Get an invitation."""
        return self.registry.get_invitation(invitation_id)

    def get_invitation_by_token(self, token: str) -> Optional[WorkspaceInvitation]:
        """Get an invitation by token."""
        return self.registry.get_invitation_by_token(token)

    def accept_invitation(
        self,
        invitation_id: str,
        user_id: str
    ) -> Optional[WorkspaceMember]:
        """Accept an invitation."""
        invitation = self.registry.get_invitation(invitation_id)
        if not invitation:
            return None

        member = self.registry.accept_invitation(invitation_id, user_id)

        if member:
            self.registry.log_activity(
                workspace_id=invitation.workspace_id,
                action="invitation_accepted",
                user_id=user_id,
                entity_type="invitation",
                entity_id=invitation_id
            )

        return member

    def decline_invitation(self, invitation_id: str, user_id: str) -> bool:
        """Decline an invitation."""
        invitation = self.registry.get_invitation(invitation_id)
        if not invitation:
            return False

        result = invitation.decline()

        if result:
            self.registry.log_activity(
                workspace_id=invitation.workspace_id,
                action="invitation_declined",
                user_id=user_id,
                entity_type="invitation",
                entity_id=invitation_id
            )

        return result

    def revoke_invitation(
        self,
        invitation_id: str,
        revoked_by: Optional[str] = None
    ) -> bool:
        """Revoke an invitation."""
        invitation = self.registry.get_invitation(invitation_id)
        if not invitation:
            return False

        result = self.registry.revoke_invitation(invitation_id)

        if result:
            self.registry.log_activity(
                workspace_id=invitation.workspace_id,
                action="invitation_revoked",
                user_id=revoked_by,
                entity_type="invitation",
                entity_id=invitation_id
            )

        return result

    def get_pending_invitations(self, workspace_id: str) -> List[WorkspaceInvitation]:
        """Get pending invitations for a workspace."""
        return self.registry.get_workspace_invitations(
            workspace_id,
            status=InvitationStatus.PENDING
        )

    def get_invitations_for_email(self, email: str) -> List[WorkspaceInvitation]:
        """Get all pending invitations for an email."""
        invitations = self.registry.get_invitations_for_email(email)
        return [inv for inv in invitations if inv.is_valid]

    # Settings operations
    def update_settings(
        self,
        workspace_id: str,
        settings: WorkspaceSettings,
        updated_by: Optional[str] = None
    ) -> Optional[Workspace]:
        """Update workspace settings."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return None

        workspace.settings = settings
        self.registry.update_workspace(workspace)

        self.registry.log_activity(
            workspace_id=workspace_id,
            action="settings_updated",
            user_id=updated_by,
            entity_type="workspace",
            entity_id=workspace_id
        )

        return workspace

    def enable_feature(
        self,
        workspace_id: str,
        feature: WorkspaceFeature,
        enabled_by: Optional[str] = None
    ) -> bool:
        """Enable a workspace feature."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return False

        workspace.settings.enable_feature(feature)
        self.registry.update_workspace(workspace)

        self.registry.log_activity(
            workspace_id=workspace_id,
            action="feature_enabled",
            user_id=enabled_by,
            entity_type="feature",
            entity_id=feature.value
        )

        return True

    def disable_feature(
        self,
        workspace_id: str,
        feature: WorkspaceFeature,
        disabled_by: Optional[str] = None
    ) -> bool:
        """Disable a workspace feature."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return False

        workspace.settings.disable_feature(feature)
        self.registry.update_workspace(workspace)

        self.registry.log_activity(
            workspace_id=workspace_id,
            action="feature_disabled",
            user_id=disabled_by,
            entity_type="feature",
            entity_id=feature.value
        )

        return True

    # Activity and usage
    def get_activities(
        self,
        workspace_id: str,
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> List[WorkspaceActivity]:
        """Get workspace activities."""
        return self.registry.get_workspace_activities(
            workspace_id,
            user_id=user_id,
            limit=limit
        )

    def get_usage(self, workspace_id: str) -> Optional[WorkspaceUsage]:
        """Get workspace usage statistics."""
        workspace = self.registry.get_workspace(workspace_id)
        if not workspace:
            return None

        members = self.registry.get_workspace_members(workspace_id)
        teams = self.registry.get_workspace_teams(workspace_id)

        active_members = sum(1 for m in members if m.is_active)
        guest_members = sum(1 for m in members if m.role == WorkspaceRole.GUEST)
        pending_invitations = len(self.registry.get_workspace_invitations(
            workspace_id,
            status=InvitationStatus.PENDING
        ))

        return WorkspaceUsage(
            workspace_id=workspace_id,
            total_members=len(members),
            active_members=active_members,
            guest_members=guest_members,
            pending_invitations=pending_invitations,
            total_teams=len(teams),
            active_teams=sum(1 for t in teams if t.status == TeamStatus.ACTIVE)
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get global workspace statistics."""
        workspaces = self.registry.list_workspaces(limit=100000, include_archived=True)

        status_counts: Dict[str, int] = {}
        plan_counts: Dict[str, int] = {}
        total_members = 0
        total_teams = 0

        for workspace in workspaces:
            status_counts[workspace.status.value] = status_counts.get(workspace.status.value, 0) + 1
            plan_counts[workspace.plan.value] = plan_counts.get(workspace.plan.value, 0) + 1
            total_members += workspace.member_count
            total_teams += workspace.team_count

        return {
            "total_workspaces": len(workspaces),
            "by_status": status_counts,
            "by_plan": plan_counts,
            "total_members": total_members,
            "total_teams": total_teams,
        }


# ==================== Global Instances ====================

_workspace_manager: Optional[WorkspaceManager] = None


def get_workspace_manager() -> Optional[WorkspaceManager]:
    """Get the global workspace manager."""
    return _workspace_manager


def set_workspace_manager(manager: WorkspaceManager) -> None:
    """Set the global workspace manager."""
    global _workspace_manager
    _workspace_manager = manager


def reset_workspace_manager() -> None:
    """Reset the global workspace manager."""
    global _workspace_manager
    _workspace_manager = None
