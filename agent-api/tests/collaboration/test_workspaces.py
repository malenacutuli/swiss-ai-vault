"""
Tests for the Teams & Workspaces module.
"""

import pytest
from datetime import datetime, timedelta
from app.collaboration.workspaces import (
    WorkspaceManager,
    WorkspaceRegistry,
    Workspace,
    WorkspaceStatus,
    WorkspacePlan,
    WorkspaceRole,
    WorkspaceSettings,
    WorkspaceFeature,
    WorkspaceMember,
    WorkspaceUsage,
    WorkspaceActivity,
    WorkspaceInvitation,
    InvitationStatus,
    Team,
    TeamStatus,
    TeamVisibility,
    TeamRole,
    TeamMember,
    get_workspace_manager,
    set_workspace_manager,
    reset_workspace_manager,
)


# ==================== Fixtures ====================

@pytest.fixture
def registry():
    """Create a fresh workspace registry."""
    return WorkspaceRegistry()


@pytest.fixture
def manager():
    """Create a fresh workspace manager."""
    return WorkspaceManager()


@pytest.fixture
def sample_workspace(manager):
    """Create a sample workspace."""
    return manager.create_workspace(
        name="Test Workspace",
        slug="test-workspace",
        owner_id="user_1",
        description="A test workspace"
    )


# ==================== WorkspaceSettings Tests ====================

class TestWorkspaceSettings:
    """Tests for WorkspaceSettings dataclass."""

    def test_default_settings(self):
        """Test default settings."""
        settings = WorkspaceSettings()

        assert settings.default_project_visibility == "team"
        assert settings.allow_guest_access is True
        assert settings.require_2fa is False
        assert settings.email_notifications is True

    def test_feature_management(self):
        """Test enabling and disabling features."""
        settings = WorkspaceSettings()

        # Default features
        assert settings.is_feature_enabled(WorkspaceFeature.PROJECTS) is True
        assert settings.is_feature_enabled(WorkspaceFeature.SSO) is False

        # Enable a feature
        settings.enable_feature(WorkspaceFeature.SSO)
        assert settings.is_feature_enabled(WorkspaceFeature.SSO) is True

        # Disable a feature
        settings.disable_feature(WorkspaceFeature.PROJECTS)
        assert settings.is_feature_enabled(WorkspaceFeature.PROJECTS) is False

    def test_domain_restrictions(self):
        """Test domain restrictions."""
        settings = WorkspaceSettings()

        # No restrictions by default
        assert settings.is_domain_allowed("user@example.com") is True

        # With allowed domains
        settings.allowed_domains = {"company.com", "partner.com"}
        assert settings.is_domain_allowed("user@company.com") is True
        assert settings.is_domain_allowed("user@external.com") is False

        # Blocked domains take precedence
        settings.blocked_domains = {"blocked.com"}
        settings.allowed_domains = set()  # Clear allowed
        assert settings.is_domain_allowed("user@blocked.com") is False
        assert settings.is_domain_allowed("user@other.com") is True


# ==================== Workspace Tests ====================

class TestWorkspace:
    """Tests for Workspace dataclass."""

    def test_create_workspace(self):
        """Test creating a workspace."""
        workspace = Workspace(
            id="ws_1",
            name="My Workspace",
            slug="my-workspace",
            description="Test workspace"
        )

        assert workspace.id == "ws_1"
        assert workspace.name == "My Workspace"
        assert workspace.slug == "my-workspace"
        assert workspace.status == WorkspaceStatus.ACTIVE
        assert workspace.plan == WorkspacePlan.FREE

    def test_workspace_member_count(self):
        """Test member count property."""
        workspace = Workspace(
            id="ws_1",
            name="Test",
            slug="test",
            member_ids={"user_1", "user_2", "user_3"}
        )

        assert workspace.member_count == 3

    def test_workspace_team_count(self):
        """Test team count property."""
        workspace = Workspace(
            id="ws_1",
            name="Test",
            slug="test",
            team_ids={"team_1", "team_2"}
        )

        assert workspace.team_count == 2

    def test_workspace_trial(self):
        """Test trial properties."""
        # Active trial
        workspace = Workspace(
            id="ws_1",
            name="Test",
            slug="test",
            trial_ends_at=datetime.utcnow() + timedelta(days=14)
        )

        assert workspace.is_trial is True
        assert workspace.trial_days_remaining in (13, 14)

        # Expired trial
        workspace2 = Workspace(
            id="ws_2",
            name="Test2",
            slug="test2",
            trial_ends_at=datetime.utcnow() - timedelta(days=1)
        )

        assert workspace2.is_trial is False
        assert workspace2.trial_days_remaining == 0

        # No trial
        workspace3 = Workspace(id="ws_3", name="Test3", slug="test3")
        assert workspace3.is_trial is False
        assert workspace3.trial_days_remaining is None

    def test_workspace_status_changes(self):
        """Test status change methods."""
        workspace = Workspace(id="ws_1", name="Test", slug="test")

        workspace.suspend()
        assert workspace.status == WorkspaceStatus.SUSPENDED

        workspace.activate()
        assert workspace.status == WorkspaceStatus.ACTIVE

        workspace.archive()
        assert workspace.status == WorkspaceStatus.ARCHIVED

    def test_workspace_to_dict(self):
        """Test converting workspace to dictionary."""
        workspace = Workspace(
            id="ws_1",
            name="Test",
            slug="test-ws",
            owner_id="user_1"
        )

        data = workspace.to_dict()

        assert data["id"] == "ws_1"
        assert data["name"] == "Test"
        assert data["slug"] == "test-ws"
        assert data["owner_id"] == "user_1"


# ==================== WorkspaceMember Tests ====================

class TestWorkspaceMember:
    """Tests for WorkspaceMember dataclass."""

    def test_create_member(self):
        """Test creating a workspace member."""
        member = WorkspaceMember(
            id="wm_1",
            workspace_id="ws_1",
            user_id="user_1",
            role=WorkspaceRole.ADMIN
        )

        assert member.id == "wm_1"
        assert member.role == WorkspaceRole.ADMIN
        assert member.is_active is True

    def test_member_permissions(self):
        """Test member permission checks."""
        owner = WorkspaceMember(
            id="wm_1", workspace_id="ws_1", user_id="u1",
            role=WorkspaceRole.OWNER
        )
        admin = WorkspaceMember(
            id="wm_2", workspace_id="ws_1", user_id="u2",
            role=WorkspaceRole.ADMIN
        )
        member = WorkspaceMember(
            id="wm_3", workspace_id="ws_1", user_id="u3",
            role=WorkspaceRole.MEMBER,
            custom_permissions={"create_projects"}
        )
        guest = WorkspaceMember(
            id="wm_4", workspace_id="ws_1", user_id="u4",
            role=WorkspaceRole.GUEST
        )

        # Owner and admin have all permissions
        assert owner.has_permission("anything") is True
        assert admin.has_permission("anything") is True

        # Member only has explicit permissions
        assert member.has_permission("create_projects") is True
        assert member.has_permission("delete_workspace") is False

        # Guest has no extra permissions
        assert guest.has_permission("create_projects") is False

    def test_member_role_checks(self):
        """Test role-based checks."""
        owner = WorkspaceMember(
            id="wm_1", workspace_id="ws_1", user_id="u1",
            role=WorkspaceRole.OWNER
        )
        admin = WorkspaceMember(
            id="wm_2", workspace_id="ws_1", user_id="u2",
            role=WorkspaceRole.ADMIN
        )
        member = WorkspaceMember(
            id="wm_3", workspace_id="ws_1", user_id="u3",
            role=WorkspaceRole.MEMBER
        )
        billing = WorkspaceMember(
            id="wm_4", workspace_id="ws_1", user_id="u4",
            role=WorkspaceRole.BILLING
        )
        guest = WorkspaceMember(
            id="wm_5", workspace_id="ws_1", user_id="u5",
            role=WorkspaceRole.GUEST
        )

        # can_manage_workspace
        assert owner.can_manage_workspace() is True
        assert admin.can_manage_workspace() is True
        assert member.can_manage_workspace() is False

        # can_manage_members
        assert owner.can_manage_members() is True
        assert admin.can_manage_members() is True
        assert member.can_manage_members() is False

        # can_manage_billing
        assert owner.can_manage_billing() is True
        assert billing.can_manage_billing() is True
        assert admin.can_manage_billing() is False

        # can_create_teams
        assert owner.can_create_teams() is True
        assert admin.can_create_teams() is True
        assert member.can_create_teams() is True
        assert guest.can_create_teams() is False

        # is_guest
        assert guest.is_guest() is True
        assert member.is_guest() is False

    def test_update_activity(self):
        """Test updating activity timestamp."""
        member = WorkspaceMember(
            id="wm_1", workspace_id="ws_1", user_id="u1",
            role=WorkspaceRole.MEMBER
        )

        assert member.last_active_at is None

        member.update_activity()
        assert member.last_active_at is not None


# ==================== Team Tests ====================

class TestTeam:
    """Tests for Team dataclass."""

    def test_create_team(self):
        """Test creating a team."""
        team = Team(
            id="team_1",
            workspace_id="ws_1",
            name="Engineering",
            description="Engineering team"
        )

        assert team.id == "team_1"
        assert team.name == "Engineering"
        assert team.status == TeamStatus.ACTIVE
        assert team.visibility == TeamVisibility.PUBLIC

    def test_team_member_management(self):
        """Test adding and removing team members."""
        team = Team(id="team_1", workspace_id="ws_1", name="Test")

        team.add_member("user_1")
        assert "user_1" in team.member_ids
        assert team.member_count == 1

        team.add_member("user_2")
        assert team.member_count == 2
        assert team.is_member("user_2") is True

        assert team.remove_member("user_1") is True
        assert "user_1" not in team.member_ids
        assert team.remove_member("nonexistent") is False

    def test_team_archive(self):
        """Test archiving a team."""
        team = Team(id="team_1", workspace_id="ws_1", name="Test")

        team.archive()
        assert team.status == TeamStatus.ARCHIVED

    def test_team_to_dict(self):
        """Test converting team to dictionary."""
        team = Team(
            id="team_1",
            workspace_id="ws_1",
            name="Test",
            visibility=TeamVisibility.PRIVATE
        )

        data = team.to_dict()

        assert data["id"] == "team_1"
        assert data["name"] == "Test"
        assert data["visibility"] == "private"


# ==================== TeamMember Tests ====================

class TestTeamMember:
    """Tests for TeamMember dataclass."""

    def test_create_team_member(self):
        """Test creating a team member."""
        tm = TeamMember(
            id="tm_1",
            team_id="team_1",
            user_id="user_1",
            workspace_member_id="wm_1",
            role=TeamRole.LEAD
        )

        assert tm.id == "tm_1"
        assert tm.role == TeamRole.LEAD
        assert tm.is_lead() is True

    def test_team_member_roles(self):
        """Test team member role checks."""
        lead = TeamMember(
            id="tm_1", team_id="team_1", user_id="u1",
            workspace_member_id="wm_1", role=TeamRole.LEAD
        )
        member = TeamMember(
            id="tm_2", team_id="team_1", user_id="u2",
            workspace_member_id="wm_2", role=TeamRole.MEMBER
        )

        assert lead.is_lead() is True
        assert lead.can_manage_team() is True

        assert member.is_lead() is False
        assert member.can_manage_team() is False


# ==================== WorkspaceInvitation Tests ====================

class TestWorkspaceInvitation:
    """Tests for WorkspaceInvitation dataclass."""

    def test_create_invitation(self):
        """Test creating an invitation."""
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com",
            role=WorkspaceRole.MEMBER
        )

        assert invitation.id == "inv_1"
        assert invitation.email == "user@example.com"
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.is_valid is True
        assert len(invitation.token) > 0

    def test_invitation_expiry(self):
        """Test invitation expiry."""
        # Valid invitation
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com"
        )

        assert invitation.is_expired is False
        assert invitation.is_valid is True

        # Expired invitation
        expired = WorkspaceInvitation(
            id="inv_2",
            workspace_id="ws_1",
            email="user@example.com",
            expires_at=datetime.utcnow() - timedelta(days=1)
        )

        assert expired.is_expired is True
        assert expired.is_valid is False

    def test_invitation_accept(self):
        """Test accepting an invitation."""
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com"
        )

        assert invitation.accept("user_1") is True
        assert invitation.status == InvitationStatus.ACCEPTED
        assert invitation.user_id == "user_1"
        assert invitation.accepted_at is not None

        # Can't accept again
        assert invitation.accept("user_2") is False

    def test_invitation_decline(self):
        """Test declining an invitation."""
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com"
        )

        assert invitation.decline() is True
        assert invitation.status == InvitationStatus.DECLINED

        # Can't decline again
        assert invitation.decline() is False

    def test_invitation_revoke(self):
        """Test revoking an invitation."""
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com"
        )

        assert invitation.revoke() is True
        assert invitation.status == InvitationStatus.REVOKED

    def test_invitation_extend(self):
        """Test extending invitation expiry."""
        invitation = WorkspaceInvitation(
            id="inv_1",
            workspace_id="ws_1",
            email="user@example.com"
        )

        original_expiry = invitation.expires_at
        invitation.extend(30)

        assert invitation.expires_at > original_expiry


# ==================== WorkspaceUsage Tests ====================

class TestWorkspaceUsage:
    """Tests for WorkspaceUsage dataclass."""

    def test_create_usage(self):
        """Test creating usage stats."""
        usage = WorkspaceUsage(
            workspace_id="ws_1",
            total_members=100,
            active_members=80,
            storage_used_bytes=5 * 1024**3,  # 5 GB
            storage_limit_bytes=10 * 1024**3  # 10 GB
        )

        assert usage.total_members == 100
        assert usage.active_members == 80

    def test_usage_calculations(self):
        """Test usage calculations."""
        usage = WorkspaceUsage(
            workspace_id="ws_1",
            total_members=100,
            active_members=80,
            storage_used_bytes=5 * 1024**3,
            storage_limit_bytes=10 * 1024**3
        )

        assert usage.storage_used_gb == 5.0
        assert usage.storage_percentage == 50.0
        assert usage.member_percentage == 80.0


# ==================== WorkspaceRegistry Tests ====================

class TestWorkspaceRegistry:
    """Tests for WorkspaceRegistry."""

    def test_create_workspace(self, registry):
        """Test creating a workspace."""
        workspace = registry.create_workspace(
            name="Test Workspace",
            slug="test-workspace",
            owner_id="user_1"
        )

        assert workspace.id.startswith("ws_")
        assert workspace.name == "Test Workspace"
        assert workspace.slug == "test-workspace"
        assert workspace.owner_id == "user_1"

    def test_create_workspace_duplicate_slug(self, registry):
        """Test creating workspace with duplicate slug."""
        registry.create_workspace(name="Test", slug="test-slug")

        with pytest.raises(ValueError):
            registry.create_workspace(name="Test 2", slug="test-slug")

    def test_create_workspace_adds_owner(self, registry):
        """Test that creating workspace adds owner as member."""
        workspace = registry.create_workspace(
            name="Test",
            slug="test",
            owner_id="user_1"
        )

        members = registry.get_workspace_members(workspace.id)
        assert len(members) == 1
        assert members[0].user_id == "user_1"
        assert members[0].role == WorkspaceRole.OWNER

    def test_get_workspace(self, registry):
        """Test getting a workspace."""
        workspace = registry.create_workspace(name="Test", slug="test")

        retrieved = registry.get_workspace(workspace.id)
        assert retrieved is not None
        assert retrieved.id == workspace.id

        assert registry.get_workspace("nonexistent") is None

    def test_get_workspace_by_slug(self, registry):
        """Test getting workspace by slug."""
        workspace = registry.create_workspace(name="Test", slug="test-slug")

        retrieved = registry.get_workspace_by_slug("test-slug")
        assert retrieved is not None
        assert retrieved.id == workspace.id

        assert registry.get_workspace_by_slug("nonexistent") is None

    def test_update_workspace(self, registry):
        """Test updating a workspace."""
        workspace = registry.create_workspace(name="Test", slug="test")
        workspace.name = "Updated"

        assert registry.update_workspace(workspace) is True

        retrieved = registry.get_workspace(workspace.id)
        assert retrieved.name == "Updated"

    def test_delete_workspace_soft(self, registry):
        """Test soft deleting a workspace."""
        workspace = registry.create_workspace(name="Test", slug="test")

        assert registry.delete_workspace(workspace.id, soft_delete=True) is True

        retrieved = registry.get_workspace(workspace.id)
        assert retrieved.status == WorkspaceStatus.PENDING_DELETION

    def test_delete_workspace_hard(self, registry):
        """Test hard deleting a workspace."""
        workspace = registry.create_workspace(
            name="Test",
            slug="test",
            owner_id="user_1"
        )
        registry.create_team(workspace.id, "Team 1")

        assert registry.delete_workspace(workspace.id, soft_delete=False) is True

        assert registry.get_workspace(workspace.id) is None
        assert registry.get_workspace_by_slug("test") is None

    def test_list_workspaces(self, registry):
        """Test listing workspaces."""
        registry.create_workspace(name="WS1", slug="ws1")
        registry.create_workspace(name="WS2", slug="ws2")
        registry.create_workspace(name="WS3", slug="ws3")

        workspaces = registry.list_workspaces()
        assert len(workspaces) == 3

    def test_list_workspaces_by_user(self, registry):
        """Test listing workspaces by user."""
        ws1 = registry.create_workspace(name="WS1", slug="ws1")
        ws2 = registry.create_workspace(name="WS2", slug="ws2")
        registry.create_workspace(name="WS3", slug="ws3")

        registry.add_member(ws1.id, "user_1", WorkspaceRole.MEMBER)
        registry.add_member(ws2.id, "user_1", WorkspaceRole.MEMBER)

        user_workspaces = registry.list_workspaces(user_id="user_1")
        assert len(user_workspaces) == 2

    def test_list_workspaces_by_status(self, registry):
        """Test listing workspaces by status."""
        ws1 = registry.create_workspace(name="WS1", slug="ws1")
        ws2 = registry.create_workspace(name="WS2", slug="ws2")
        ws2.suspend()
        registry.update_workspace(ws2)

        active = registry.list_workspaces(status=WorkspaceStatus.ACTIVE)
        assert len(active) == 1
        assert active[0].id == ws1.id

    def test_search_workspaces(self, registry):
        """Test searching workspaces."""
        registry.create_workspace(name="Alpha Project", slug="alpha")
        registry.create_workspace(name="Beta Project", slug="beta", description="Uses alpha patterns")
        registry.create_workspace(name="Gamma", slug="gamma")

        results = registry.search_workspaces("alpha")
        assert len(results) == 2

    # Member tests
    def test_add_member(self, registry):
        """Test adding a member."""
        workspace = registry.create_workspace(name="Test", slug="test")

        member = registry.add_member(
            workspace.id,
            "user_2",
            WorkspaceRole.MEMBER,
            invited_by="user_1"
        )

        assert member is not None
        assert member.user_id == "user_2"
        assert member.role == WorkspaceRole.MEMBER

    def test_add_member_already_exists(self, registry):
        """Test adding existing member returns existing."""
        workspace = registry.create_workspace(name="Test", slug="test")

        member1 = registry.add_member(workspace.id, "user_2", WorkspaceRole.MEMBER)
        member2 = registry.add_member(workspace.id, "user_2", WorkspaceRole.ADMIN)

        assert member1.id == member2.id

    def test_get_workspace_member(self, registry):
        """Test getting a specific member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_2", WorkspaceRole.MEMBER)

        member = registry.get_workspace_member(workspace.id, "user_2")
        assert member is not None
        assert member.user_id == "user_2"

    def test_update_member_role(self, registry):
        """Test updating member role."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_2", WorkspaceRole.MEMBER)

        assert registry.update_member_role(workspace.id, "user_2", WorkspaceRole.ADMIN) is True

        member = registry.get_workspace_member(workspace.id, "user_2")
        assert member.role == WorkspaceRole.ADMIN

    def test_remove_member(self, registry):
        """Test removing a member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_2", WorkspaceRole.MEMBER)

        assert registry.remove_member(workspace.id, "user_2") is True
        assert registry.get_workspace_member(workspace.id, "user_2") is None

    def test_get_user_workspaces(self, registry):
        """Test getting user's workspaces."""
        ws1 = registry.create_workspace(name="WS1", slug="ws1")
        ws2 = registry.create_workspace(name="WS2", slug="ws2")

        registry.add_member(ws1.id, "user_1", WorkspaceRole.MEMBER)
        registry.add_member(ws2.id, "user_1", WorkspaceRole.MEMBER)

        workspaces = registry.get_user_workspaces("user_1")
        assert len(workspaces) == 2

    # Team tests
    def test_create_team(self, registry):
        """Test creating a team."""
        workspace = registry.create_workspace(name="Test", slug="test")

        team = registry.create_team(
            workspace.id,
            "Engineering",
            created_by="user_1",
            description="Engineering team"
        )

        assert team is not None
        assert team.name == "Engineering"
        assert team.workspace_id == workspace.id

    def test_create_team_adds_creator(self, registry):
        """Test that creating team adds creator as lead."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)

        team = registry.create_team(workspace.id, "Test Team", created_by="user_1")

        members = registry.get_team_members(team.id)
        assert len(members) == 1
        assert members[0].user_id == "user_1"
        assert members[0].role == TeamRole.LEAD

    def test_get_team(self, registry):
        """Test getting a team."""
        workspace = registry.create_workspace(name="Test", slug="test")
        team = registry.create_team(workspace.id, "Test Team")

        retrieved = registry.get_team(team.id)
        assert retrieved is not None
        assert retrieved.name == "Test Team"

    def test_update_team(self, registry):
        """Test updating a team."""
        workspace = registry.create_workspace(name="Test", slug="test")
        team = registry.create_team(workspace.id, "Test Team")

        team.name = "Updated Team"
        assert registry.update_team(team) is True

        retrieved = registry.get_team(team.id)
        assert retrieved.name == "Updated Team"

    def test_delete_team(self, registry):
        """Test deleting a team."""
        workspace = registry.create_workspace(name="Test", slug="test")
        team = registry.create_team(workspace.id, "Test Team")

        assert registry.delete_team(team.id) is True

        retrieved = registry.get_team(team.id)
        assert retrieved.status == TeamStatus.ARCHIVED

    def test_get_workspace_teams(self, registry):
        """Test getting workspace teams."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.create_team(workspace.id, "Team 1")
        registry.create_team(workspace.id, "Team 2")
        registry.create_team(workspace.id, "Team 3")

        teams = registry.get_workspace_teams(workspace.id)
        assert len(teams) == 3

    def test_search_teams(self, registry):
        """Test searching teams."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.create_team(workspace.id, "Engineering")
        registry.create_team(workspace.id, "Design", description="Engineering support")
        registry.create_team(workspace.id, "Marketing")

        results = registry.search_teams(workspace.id, "engineer")
        assert len(results) == 2

    # Team member tests
    def test_add_team_member(self, registry):
        """Test adding a team member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)
        team = registry.create_team(workspace.id, "Test Team")

        tm = registry.add_team_member(team.id, "user_1", TeamRole.MEMBER)

        assert tm is not None
        assert tm.user_id == "user_1"
        assert tm.role == TeamRole.MEMBER

    def test_add_team_member_requires_workspace_membership(self, registry):
        """Test that team member must be workspace member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        team = registry.create_team(workspace.id, "Test Team")

        tm = registry.add_team_member(team.id, "nonmember", TeamRole.MEMBER)
        assert tm is None

    def test_get_team_member(self, registry):
        """Test getting a team member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)
        team = registry.create_team(workspace.id, "Test Team")
        registry.add_team_member(team.id, "user_1", TeamRole.MEMBER)

        tm = registry.get_team_member(team.id, "user_1")
        assert tm is not None
        assert tm.user_id == "user_1"

    def test_update_team_member_role(self, registry):
        """Test updating team member role."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)
        team = registry.create_team(workspace.id, "Test Team")
        registry.add_team_member(team.id, "user_1", TeamRole.MEMBER)

        assert registry.update_team_member_role(team.id, "user_1", TeamRole.LEAD) is True

        tm = registry.get_team_member(team.id, "user_1")
        assert tm.role == TeamRole.LEAD

    def test_remove_team_member(self, registry):
        """Test removing a team member."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)
        team = registry.create_team(workspace.id, "Test Team")
        registry.add_team_member(team.id, "user_1", TeamRole.MEMBER)

        assert registry.remove_team_member(team.id, "user_1") is True
        assert registry.get_team_member(team.id, "user_1") is None

    def test_get_user_teams(self, registry):
        """Test getting user's teams in a workspace."""
        workspace = registry.create_workspace(name="Test", slug="test")
        registry.add_member(workspace.id, "user_1", WorkspaceRole.MEMBER)

        team1 = registry.create_team(workspace.id, "Team 1")
        team2 = registry.create_team(workspace.id, "Team 2")
        registry.create_team(workspace.id, "Team 3")

        registry.add_team_member(team1.id, "user_1", TeamRole.MEMBER)
        registry.add_team_member(team2.id, "user_1", TeamRole.MEMBER)

        teams = registry.get_user_teams(workspace.id, "user_1")
        assert len(teams) == 2

    # Invitation tests
    def test_create_invitation(self, registry):
        """Test creating an invitation."""
        workspace = registry.create_workspace(name="Test", slug="test")

        invitation = registry.create_invitation(
            workspace.id,
            "user@example.com",
            WorkspaceRole.MEMBER,
            invited_by="user_1"
        )

        assert invitation is not None
        assert invitation.email == "user@example.com"
        assert invitation.role == WorkspaceRole.MEMBER

    def test_create_invitation_domain_blocked(self, registry):
        """Test invitation blocked by domain restrictions."""
        workspace = registry.create_workspace(name="Test", slug="test")
        workspace.settings.blocked_domains = {"blocked.com"}
        registry.update_workspace(workspace)

        invitation = registry.create_invitation(
            workspace.id,
            "user@blocked.com",
            WorkspaceRole.MEMBER
        )

        assert invitation is None

    def test_get_invitation_by_token(self, registry):
        """Test getting invitation by token."""
        workspace = registry.create_workspace(name="Test", slug="test")
        invitation = registry.create_invitation(workspace.id, "user@example.com")

        retrieved = registry.get_invitation_by_token(invitation.token)
        assert retrieved is not None
        assert retrieved.id == invitation.id

    def test_get_invitations_for_email(self, registry):
        """Test getting invitations for an email."""
        ws1 = registry.create_workspace(name="WS1", slug="ws1")
        ws2 = registry.create_workspace(name="WS2", slug="ws2")

        registry.create_invitation(ws1.id, "user@example.com")
        registry.create_invitation(ws2.id, "user@example.com")

        invitations = registry.get_invitations_for_email("user@example.com")
        assert len(invitations) == 2

    def test_accept_invitation(self, registry):
        """Test accepting an invitation."""
        workspace = registry.create_workspace(name="Test", slug="test")
        invitation = registry.create_invitation(
            workspace.id,
            "user@example.com",
            WorkspaceRole.MEMBER,
            team_ids=set()
        )

        member = registry.accept_invitation(invitation.id, "new_user")

        assert member is not None
        assert member.user_id == "new_user"
        assert member.role == WorkspaceRole.MEMBER

        # Invitation status updated
        assert invitation.status == InvitationStatus.ACCEPTED

    def test_revoke_invitation(self, registry):
        """Test revoking an invitation."""
        workspace = registry.create_workspace(name="Test", slug="test")
        invitation = registry.create_invitation(workspace.id, "user@example.com")

        assert registry.revoke_invitation(invitation.id) is True
        assert invitation.status == InvitationStatus.REVOKED

    # Activity tests
    def test_log_activity(self, registry):
        """Test logging an activity."""
        workspace = registry.create_workspace(name="Test", slug="test")

        activity = registry.log_activity(
            workspace_id=workspace.id,
            action="created",
            user_id="user_1",
            entity_type="workspace",
            entity_id=workspace.id
        )

        assert activity.id.startswith("wa_")
        assert activity.action == "created"

    def test_get_workspace_activities(self, registry):
        """Test getting workspace activities."""
        workspace = registry.create_workspace(name="Test", slug="test")

        registry.log_activity(workspace.id, "created")
        registry.log_activity(workspace.id, "updated")
        registry.log_activity(workspace.id, "member_added")

        activities = registry.get_workspace_activities(workspace.id)
        assert len(activities) == 3


# ==================== WorkspaceManager Tests ====================

class TestWorkspaceManager:
    """Tests for WorkspaceManager."""

    def test_create_workspace(self, manager):
        """Test creating a workspace."""
        workspace = manager.create_workspace(
            name="Test Workspace",
            slug="test-workspace",
            owner_id="user_1"
        )

        assert workspace.name == "Test Workspace"
        assert workspace.owner_id == "user_1"

    def test_create_workspace_with_trial(self, manager):
        """Test creating workspace with trial."""
        workspace = manager.create_workspace(
            name="Trial Workspace",
            slug="trial-ws",
            trial_days=14
        )

        assert workspace.is_trial is True
        assert workspace.trial_days_remaining in (13, 14)

    def test_create_workspace_logs_activity(self, manager):
        """Test that creating workspace logs activity."""
        workspace = manager.create_workspace(
            name="Test",
            slug="test",
            owner_id="user_1"
        )

        activities = manager.get_activities(workspace.id)
        assert len(activities) == 1
        assert activities[0].action == "created"

    def test_get_workspace(self, manager, sample_workspace):
        """Test getting a workspace."""
        retrieved = manager.get_workspace(sample_workspace.id)
        assert retrieved is not None
        assert retrieved.name == sample_workspace.name

    def test_get_workspace_by_slug(self, manager, sample_workspace):
        """Test getting workspace by slug."""
        retrieved = manager.get_workspace_by_slug("test-workspace")
        assert retrieved is not None
        assert retrieved.id == sample_workspace.id

    def test_update_workspace(self, manager, sample_workspace):
        """Test updating a workspace."""
        updated = manager.update_workspace(
            sample_workspace.id,
            name="Updated Name",
            plan=WorkspacePlan.PROFESSIONAL,
            updated_by="user_1"
        )

        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.plan == WorkspacePlan.PROFESSIONAL

    def test_delete_workspace(self, manager, sample_workspace):
        """Test deleting a workspace."""
        assert manager.delete_workspace(sample_workspace.id) is True

        retrieved = manager.get_workspace(sample_workspace.id)
        assert retrieved.status == WorkspaceStatus.PENDING_DELETION

    def test_suspend_workspace(self, manager, sample_workspace):
        """Test suspending a workspace."""
        suspended = manager.suspend_workspace(
            sample_workspace.id,
            reason="Payment overdue"
        )

        assert suspended is not None
        assert suspended.status == WorkspaceStatus.SUSPENDED

    def test_activate_workspace(self, manager, sample_workspace):
        """Test activating a workspace."""
        manager.suspend_workspace(sample_workspace.id)

        activated = manager.activate_workspace(sample_workspace.id)

        assert activated is not None
        assert activated.status == WorkspaceStatus.ACTIVE

    def test_list_workspaces(self, manager):
        """Test listing workspaces."""
        manager.create_workspace(name="WS1", slug="ws1")
        manager.create_workspace(name="WS2", slug="ws2")

        workspaces = manager.list_workspaces()
        assert len(workspaces) == 2

    def test_search_workspaces(self, manager):
        """Test searching workspaces."""
        manager.create_workspace(name="Alpha Project", slug="alpha")
        manager.create_workspace(name="Beta Project", slug="beta")

        results = manager.search_workspaces("alpha")
        assert len(results) == 1

    def test_get_my_workspaces(self, manager):
        """Test getting user's workspaces."""
        ws1 = manager.create_workspace(name="WS1", slug="ws1")
        ws2 = manager.create_workspace(name="WS2", slug="ws2")

        manager.add_member(ws1.id, "user_1", WorkspaceRole.MEMBER)
        manager.add_member(ws2.id, "user_1", WorkspaceRole.MEMBER)

        workspaces = manager.get_my_workspaces("user_1")
        assert len(workspaces) == 2

    # Member operations
    def test_add_member(self, manager, sample_workspace):
        """Test adding a member."""
        member = manager.add_member(
            sample_workspace.id,
            "user_2",
            WorkspaceRole.MEMBER,
            added_by="user_1"
        )

        assert member is not None
        assert member.user_id == "user_2"

    def test_remove_member(self, manager, sample_workspace):
        """Test removing a member."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)

        assert manager.remove_member(sample_workspace.id, "user_2") is True
        assert manager.is_member(sample_workspace.id, "user_2") is False

    def test_update_member_role(self, manager, sample_workspace):
        """Test updating member role."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)

        assert manager.update_member_role(
            sample_workspace.id,
            "user_2",
            WorkspaceRole.ADMIN
        ) is True

        role = manager.get_member_role(sample_workspace.id, "user_2")
        assert role == WorkspaceRole.ADMIN

    def test_get_members(self, manager, sample_workspace):
        """Test getting workspace members."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)

        members = manager.get_members(sample_workspace.id)
        assert len(members) == 2  # Owner + new member

    def test_is_member(self, manager, sample_workspace):
        """Test checking membership."""
        assert manager.is_member(sample_workspace.id, "user_1") is True
        assert manager.is_member(sample_workspace.id, "user_99") is False

    # Team operations
    def test_create_team(self, manager, sample_workspace):
        """Test creating a team."""
        team = manager.create_team(
            sample_workspace.id,
            "Engineering",
            description="Engineering team",
            created_by="user_1"
        )

        assert team is not None
        assert team.name == "Engineering"

    def test_get_team(self, manager, sample_workspace):
        """Test getting a team."""
        team = manager.create_team(sample_workspace.id, "Test")

        retrieved = manager.get_team(team.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_update_team(self, manager, sample_workspace):
        """Test updating a team."""
        team = manager.create_team(sample_workspace.id, "Test")

        updated = manager.update_team(
            team.id,
            name="Updated Team",
            visibility=TeamVisibility.PRIVATE
        )

        assert updated is not None
        assert updated.name == "Updated Team"
        assert updated.visibility == TeamVisibility.PRIVATE

    def test_delete_team(self, manager, sample_workspace):
        """Test deleting a team."""
        team = manager.create_team(sample_workspace.id, "Test")

        assert manager.delete_team(team.id) is True

    def test_archive_team(self, manager, sample_workspace):
        """Test archiving a team."""
        team = manager.create_team(sample_workspace.id, "Test")

        archived = manager.archive_team(team.id)

        assert archived is not None
        assert archived.status == TeamStatus.ARCHIVED

    def test_get_teams(self, manager, sample_workspace):
        """Test getting workspace teams."""
        manager.create_team(sample_workspace.id, "Team 1")
        manager.create_team(sample_workspace.id, "Team 2")

        teams = manager.get_teams(sample_workspace.id)
        assert len(teams) == 2

    def test_search_teams(self, manager, sample_workspace):
        """Test searching teams."""
        manager.create_team(sample_workspace.id, "Engineering")
        manager.create_team(sample_workspace.id, "Marketing")

        results = manager.search_teams(sample_workspace.id, "engineer")
        assert len(results) == 1

    def test_get_user_teams(self, manager, sample_workspace):
        """Test getting user's teams."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)

        team1 = manager.create_team(sample_workspace.id, "Team 1")
        team2 = manager.create_team(sample_workspace.id, "Team 2")

        manager.add_team_member(team1.id, "user_2")
        manager.add_team_member(team2.id, "user_2")

        teams = manager.get_user_teams(sample_workspace.id, "user_2")
        assert len(teams) == 2

    # Team member operations
    def test_add_team_member(self, manager, sample_workspace):
        """Test adding a team member."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)
        team = manager.create_team(sample_workspace.id, "Test Team")

        tm = manager.add_team_member(team.id, "user_2", TeamRole.MEMBER)

        assert tm is not None
        assert tm.user_id == "user_2"

    def test_remove_team_member(self, manager, sample_workspace):
        """Test removing a team member."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)
        team = manager.create_team(sample_workspace.id, "Test Team")
        manager.add_team_member(team.id, "user_2")

        assert manager.remove_team_member(team.id, "user_2") is True

    def test_update_team_member_role(self, manager, sample_workspace):
        """Test updating team member role."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)
        team = manager.create_team(sample_workspace.id, "Test Team")
        manager.add_team_member(team.id, "user_2", TeamRole.MEMBER)

        assert manager.update_team_member_role(team.id, "user_2", TeamRole.LEAD) is True

    def test_get_team_members(self, manager, sample_workspace):
        """Test getting team members."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)
        team = manager.create_team(sample_workspace.id, "Test Team", created_by="user_1")
        manager.add_team_member(team.id, "user_2")

        members = manager.get_team_members(team.id)
        assert len(members) == 2  # Creator + new member

    # Invitation operations
    def test_invite_user(self, manager, sample_workspace):
        """Test inviting a user."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "newuser@example.com",
            WorkspaceRole.MEMBER,
            invited_by="user_1"
        )

        assert invitation is not None
        assert invitation.email == "newuser@example.com"

    def test_get_invitation(self, manager, sample_workspace):
        """Test getting an invitation."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "user@example.com"
        )

        retrieved = manager.get_invitation(invitation.id)
        assert retrieved is not None
        assert retrieved.id == invitation.id

    def test_get_invitation_by_token(self, manager, sample_workspace):
        """Test getting invitation by token."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "user@example.com"
        )

        retrieved = manager.get_invitation_by_token(invitation.token)
        assert retrieved is not None
        assert retrieved.id == invitation.id

    def test_accept_invitation(self, manager, sample_workspace):
        """Test accepting an invitation."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "user@example.com",
            WorkspaceRole.MEMBER
        )

        member = manager.accept_invitation(invitation.id, "new_user")

        assert member is not None
        assert member.user_id == "new_user"
        assert member.role == WorkspaceRole.MEMBER

    def test_decline_invitation(self, manager, sample_workspace):
        """Test declining an invitation."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "user@example.com"
        )

        assert manager.decline_invitation(invitation.id, "some_user") is True

        retrieved = manager.get_invitation(invitation.id)
        assert retrieved.status == InvitationStatus.DECLINED

    def test_revoke_invitation(self, manager, sample_workspace):
        """Test revoking an invitation."""
        invitation = manager.invite_user(
            sample_workspace.id,
            "user@example.com"
        )

        assert manager.revoke_invitation(invitation.id) is True

        retrieved = manager.get_invitation(invitation.id)
        assert retrieved.status == InvitationStatus.REVOKED

    def test_get_pending_invitations(self, manager, sample_workspace):
        """Test getting pending invitations."""
        manager.invite_user(sample_workspace.id, "user1@example.com")
        manager.invite_user(sample_workspace.id, "user2@example.com")
        inv3 = manager.invite_user(sample_workspace.id, "user3@example.com")
        manager.accept_invitation(inv3.id, "user_3")

        pending = manager.get_pending_invitations(sample_workspace.id)
        assert len(pending) == 2

    def test_get_invitations_for_email(self, manager):
        """Test getting invitations for email."""
        ws1 = manager.create_workspace(name="WS1", slug="ws1")
        ws2 = manager.create_workspace(name="WS2", slug="ws2")

        manager.invite_user(ws1.id, "user@example.com")
        manager.invite_user(ws2.id, "user@example.com")

        invitations = manager.get_invitations_for_email("user@example.com")
        assert len(invitations) == 2

    # Settings operations
    def test_update_settings(self, manager, sample_workspace):
        """Test updating workspace settings."""
        new_settings = WorkspaceSettings(
            require_2fa=True,
            session_timeout_minutes=60
        )

        updated = manager.update_settings(sample_workspace.id, new_settings)

        assert updated is not None
        assert updated.settings.require_2fa is True
        assert updated.settings.session_timeout_minutes == 60

    def test_enable_feature(self, manager, sample_workspace):
        """Test enabling a feature."""
        assert manager.enable_feature(
            sample_workspace.id,
            WorkspaceFeature.SSO
        ) is True

        workspace = manager.get_workspace(sample_workspace.id)
        assert workspace.is_feature_enabled(WorkspaceFeature.SSO) is True

    def test_disable_feature(self, manager, sample_workspace):
        """Test disabling a feature."""
        assert manager.disable_feature(
            sample_workspace.id,
            WorkspaceFeature.PROJECTS
        ) is True

        workspace = manager.get_workspace(sample_workspace.id)
        assert workspace.is_feature_enabled(WorkspaceFeature.PROJECTS) is False

    # Usage and stats
    def test_get_usage(self, manager, sample_workspace):
        """Test getting workspace usage."""
        manager.add_member(sample_workspace.id, "user_2", WorkspaceRole.MEMBER)
        manager.add_member(sample_workspace.id, "user_3", WorkspaceRole.GUEST)
        manager.create_team(sample_workspace.id, "Team 1")
        manager.invite_user(sample_workspace.id, "pending@example.com")

        usage = manager.get_usage(sample_workspace.id)

        assert usage is not None
        assert usage.total_members == 3  # Owner + 2 added
        assert usage.guest_members == 1
        assert usage.total_teams == 1
        assert usage.pending_invitations == 1

    def test_get_stats(self, manager):
        """Test getting global stats."""
        manager.create_workspace(name="WS1", slug="ws1", plan=WorkspacePlan.FREE)
        manager.create_workspace(name="WS2", slug="ws2", plan=WorkspacePlan.PROFESSIONAL)

        stats = manager.get_stats()

        assert stats["total_workspaces"] == 2
        assert stats["by_plan"]["free"] == 1
        assert stats["by_plan"]["professional"] == 1


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global instance management."""

    def test_set_and_get_workspace_manager(self):
        """Test setting and getting global workspace manager."""
        reset_workspace_manager()

        assert get_workspace_manager() is None

        manager = WorkspaceManager()
        set_workspace_manager(manager)

        assert get_workspace_manager() is manager

        reset_workspace_manager()
        assert get_workspace_manager() is None


# ==================== Integration Tests ====================

class TestWorkspaceWorkflows:
    """Integration tests for workspace workflows."""

    def test_complete_workspace_setup(self, manager):
        """Test complete workspace setup workflow."""
        # Create workspace
        workspace = manager.create_workspace(
            name="Acme Corp",
            slug="acme-corp",
            owner_id="admin_user",
            plan=WorkspacePlan.BUSINESS,
            organization_name="Acme Corporation"
        )

        # Configure settings
        settings = WorkspaceSettings(
            require_2fa=True,
            allowed_domains={"acme.com"},
            max_members=100
        )
        manager.update_settings(workspace.id, settings)

        # Enable features
        manager.enable_feature(workspace.id, WorkspaceFeature.SSO)
        manager.enable_feature(workspace.id, WorkspaceFeature.AUDIT_LOG)

        # Create teams
        engineering = manager.create_team(
            workspace.id,
            "Engineering",
            description="Engineering department",
            created_by="admin_user"
        )
        marketing = manager.create_team(
            workspace.id,
            "Marketing",
            description="Marketing department",
            created_by="admin_user"
        )

        # Add members
        manager.add_member(workspace.id, "eng_lead", WorkspaceRole.MEMBER)
        manager.add_member(workspace.id, "mkt_lead", WorkspaceRole.MEMBER)

        # Add to teams
        manager.add_team_member(engineering.id, "eng_lead", TeamRole.LEAD)
        manager.add_team_member(marketing.id, "mkt_lead", TeamRole.LEAD)

        # Verify setup
        usage = manager.get_usage(workspace.id)
        assert usage.total_members == 3
        assert usage.total_teams == 2

    def test_invitation_workflow(self, manager):
        """Test invitation workflow."""
        workspace = manager.create_workspace(
            name="Test Workspace",
            slug="test-ws",
            owner_id="admin"
        )

        # Create team for auto-join
        team = manager.create_team(workspace.id, "Engineering", created_by="admin")

        # Invite user with team assignment
        invitation = manager.invite_user(
            workspace.id,
            "newuser@company.com",
            WorkspaceRole.MEMBER,
            invited_by="admin",
            team_ids={team.id},
            message="Welcome to the team!"
        )

        # Verify invitation
        assert invitation.is_valid is True
        assert invitation.message == "Welcome to the team!"

        # Accept invitation
        member = manager.accept_invitation(invitation.id, "new_user_id")

        # Verify membership
        assert member is not None
        assert manager.is_member(workspace.id, "new_user_id") is True

        # Verify team membership
        teams = manager.get_user_teams(workspace.id, "new_user_id")
        assert len(teams) == 1
        assert teams[0].id == team.id

    def test_multi_workspace_user(self, manager):
        """Test user belonging to multiple workspaces."""
        # Create workspaces
        ws1 = manager.create_workspace(name="Workspace 1", slug="ws1")
        ws2 = manager.create_workspace(name="Workspace 2", slug="ws2")
        ws3 = manager.create_workspace(name="Workspace 3", slug="ws3")

        # Add user to workspaces with different roles
        manager.add_member(ws1.id, "multi_user", WorkspaceRole.OWNER)
        manager.add_member(ws2.id, "multi_user", WorkspaceRole.ADMIN)
        manager.add_member(ws3.id, "multi_user", WorkspaceRole.MEMBER)

        # Get user's workspaces
        workspaces = manager.get_my_workspaces("multi_user")
        assert len(workspaces) == 3

        # Verify different roles
        assert manager.get_member_role(ws1.id, "multi_user") == WorkspaceRole.OWNER
        assert manager.get_member_role(ws2.id, "multi_user") == WorkspaceRole.ADMIN
        assert manager.get_member_role(ws3.id, "multi_user") == WorkspaceRole.MEMBER

    def test_nested_team_structure(self, manager):
        """Test nested team structure."""
        workspace = manager.create_workspace(
            name="Large Org",
            slug="large-org",
            owner_id="admin"
        )

        # Create parent team
        engineering = manager.create_team(
            workspace.id,
            "Engineering",
            created_by="admin"
        )

        # Create child teams
        frontend = manager.registry.create_team(
            workspace.id,
            "Frontend",
            parent_team_id=engineering.id
        )
        backend = manager.registry.create_team(
            workspace.id,
            "Backend",
            parent_team_id=engineering.id
        )

        # Verify structure
        assert frontend.parent_team_id == engineering.id
        assert backend.parent_team_id == engineering.id

        teams = manager.get_teams(workspace.id)
        assert len(teams) == 3

    def test_workspace_lifecycle(self, manager):
        """Test workspace lifecycle management."""
        # Create workspace with trial
        workspace = manager.create_workspace(
            name="Trial Workspace",
            slug="trial-ws",
            owner_id="user_1",
            plan=WorkspacePlan.FREE,
            trial_days=14
        )

        assert workspace.is_trial is True

        # Upgrade plan
        manager.update_workspace(
            workspace.id,
            plan=WorkspacePlan.PROFESSIONAL
        )

        # Suspend for payment issues
        manager.suspend_workspace(
            workspace.id,
            reason="Payment failed",
            suspended_by="system"
        )

        retrieved = manager.get_workspace(workspace.id)
        assert retrieved.status == WorkspaceStatus.SUSPENDED

        # Reactivate after payment
        manager.activate_workspace(workspace.id)

        retrieved = manager.get_workspace(workspace.id)
        assert retrieved.status == WorkspaceStatus.ACTIVE

        # Archive workspace
        retrieved.archive()
        manager.registry.update_workspace(retrieved)

        retrieved = manager.get_workspace(workspace.id)
        assert retrieved.status == WorkspaceStatus.ARCHIVED
