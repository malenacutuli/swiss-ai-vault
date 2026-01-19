"""
Tests for the Projects & Milestones module.
"""

import pytest
from datetime import datetime, timedelta
from app.collaboration.projects import (
    ProjectManager,
    ProjectRegistry,
    Project,
    ProjectStatus,
    ProjectVisibility,
    ProjectHealth,
    ProjectType,
    ProjectMember,
    MemberRole,
    Milestone,
    MilestoneStatus,
    ProjectPhase,
    PhaseStatus,
    ProjectBudget,
    ProjectMetrics,
    ProjectTemplate,
    ProjectActivity,
    get_project_manager,
    set_project_manager,
    reset_project_manager,
)


# ==================== Fixtures ====================

@pytest.fixture
def registry():
    """Create a fresh project registry."""
    return ProjectRegistry()


@pytest.fixture
def manager():
    """Create a fresh project manager."""
    return ProjectManager()


@pytest.fixture
def sample_project(manager):
    """Create a sample project."""
    return manager.create_project(
        name="Test Project",
        workspace_id="ws_1",
        owner_id="user_1",
        description="A test project",
        project_type=ProjectType.AGILE,
        tags={"feature", "priority"}
    )


# ==================== Project Tests ====================

class TestProject:
    """Tests for Project dataclass."""

    def test_create_project(self):
        """Test creating a project."""
        project = Project(
            id="proj_1",
            name="My Project",
            description="Test description"
        )

        assert project.id == "proj_1"
        assert project.name == "My Project"
        assert project.description == "Test description"
        assert project.status == ProjectStatus.PLANNING
        assert project.visibility == ProjectVisibility.TEAM
        assert project.health == ProjectHealth.UNKNOWN

    def test_project_tags(self):
        """Test adding and removing tags."""
        project = Project(id="proj_1", name="Test")

        project.add_tag("important")
        project.add_tag("Feature")  # Should be lowercased

        assert "important" in project.tags
        assert "feature" in project.tags

        assert project.remove_tag("important") is True
        assert "important" not in project.tags
        assert project.remove_tag("nonexistent") is False

    def test_project_labels(self):
        """Test setting labels."""
        project = Project(id="proj_1", name="Test")

        project.set_label("priority", "high")
        project.set_label("team", "backend")

        assert project.labels["priority"] == "high"
        assert project.labels["team"] == "backend"

    def test_project_activate(self):
        """Test activating a project."""
        project = Project(id="proj_1", name="Test")
        assert project.status == ProjectStatus.PLANNING
        assert project.start_date is None

        project.activate()

        assert project.status == ProjectStatus.ACTIVE
        assert project.start_date is not None
        assert project.is_active is True

    def test_project_complete(self):
        """Test completing a project."""
        project = Project(id="proj_1", name="Test")
        project.activate()

        project.complete()

        assert project.status == ProjectStatus.COMPLETED
        assert project.actual_end_date is not None

    def test_project_archive(self):
        """Test archiving a project."""
        project = Project(id="proj_1", name="Test")

        project.archive()

        assert project.status == ProjectStatus.ARCHIVED

    def test_project_is_overdue(self):
        """Test checking if project is overdue."""
        project = Project(
            id="proj_1",
            name="Test",
            target_end_date=datetime.utcnow() - timedelta(days=1)
        )

        assert project.is_overdue is True

        # Not overdue if completed
        project.complete()
        assert project.is_overdue is False

    def test_project_days_until_deadline(self):
        """Test days until deadline calculation."""
        project = Project(
            id="proj_1",
            name="Test",
            target_end_date=datetime.utcnow() + timedelta(days=10)
        )

        # Allow for sub-day precision (9-10 days)
        assert project.days_until_deadline in (9, 10)

        # No deadline
        project2 = Project(id="proj_2", name="Test2")
        assert project2.days_until_deadline is None

    def test_project_duration_days(self):
        """Test duration calculation."""
        project = Project(
            id="proj_1",
            name="Test",
            start_date=datetime.utcnow() - timedelta(days=5)
        )

        assert project.duration_days == 5

        # No start date
        project2 = Project(id="proj_2", name="Test2")
        assert project2.duration_days is None

    def test_project_to_dict(self):
        """Test converting project to dictionary."""
        project = Project(
            id="proj_1",
            name="Test",
            owner_id="user_1",
            tags={"tag1"}
        )

        data = project.to_dict()

        assert data["id"] == "proj_1"
        assert data["name"] == "Test"
        assert data["owner_id"] == "user_1"
        assert "tag1" in data["tags"]


# ==================== ProjectMember Tests ====================

class TestProjectMember:
    """Tests for ProjectMember dataclass."""

    def test_create_member(self):
        """Test creating a project member."""
        member = ProjectMember(
            id="member_1",
            project_id="proj_1",
            user_id="user_1",
            role=MemberRole.ADMIN
        )

        assert member.id == "member_1"
        assert member.project_id == "proj_1"
        assert member.user_id == "user_1"
        assert member.role == MemberRole.ADMIN
        assert member.is_active is True

    def test_member_permissions(self):
        """Test member permission checks."""
        owner = ProjectMember(
            id="m1", project_id="p1", user_id="u1",
            role=MemberRole.OWNER
        )
        admin = ProjectMember(
            id="m2", project_id="p1", user_id="u2",
            role=MemberRole.ADMIN
        )
        member = ProjectMember(
            id="m3", project_id="p1", user_id="u3",
            role=MemberRole.MEMBER,
            permissions={"create_tasks"}
        )
        viewer = ProjectMember(
            id="m4", project_id="p1", user_id="u4",
            role=MemberRole.VIEWER
        )

        # Owner and admin have all permissions
        assert owner.has_permission("anything") is True
        assert admin.has_permission("anything") is True

        # Member only has explicit permissions
        assert member.has_permission("create_tasks") is True
        assert member.has_permission("delete_project") is False

        # Viewer has no extra permissions
        assert viewer.has_permission("create_tasks") is False

    def test_member_can_edit(self):
        """Test can_edit check."""
        member = ProjectMember(
            id="m1", project_id="p1", user_id="u1",
            role=MemberRole.MEMBER
        )
        viewer = ProjectMember(
            id="m2", project_id="p1", user_id="u2",
            role=MemberRole.VIEWER
        )

        assert member.can_edit() is True
        assert viewer.can_edit() is False

    def test_member_can_manage(self):
        """Test can_manage check."""
        manager = ProjectMember(
            id="m1", project_id="p1", user_id="u1",
            role=MemberRole.MANAGER
        )
        member = ProjectMember(
            id="m2", project_id="p1", user_id="u2",
            role=MemberRole.MEMBER
        )

        assert manager.can_manage() is True
        assert member.can_manage() is False

    def test_member_can_admin(self):
        """Test can_admin check."""
        admin = ProjectMember(
            id="m1", project_id="p1", user_id="u1",
            role=MemberRole.ADMIN
        )
        manager = ProjectMember(
            id="m2", project_id="p1", user_id="u2",
            role=MemberRole.MANAGER
        )

        assert admin.can_admin() is True
        assert manager.can_admin() is False


# ==================== Milestone Tests ====================

class TestMilestone:
    """Tests for Milestone dataclass."""

    def test_create_milestone(self):
        """Test creating a milestone."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Version 1.0",
            description="First release"
        )

        assert milestone.id == "ms_1"
        assert milestone.name == "Version 1.0"
        assert milestone.status == MilestoneStatus.PLANNED

    def test_milestone_progress(self):
        """Test milestone progress calculation."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test"
        )

        # No tasks
        assert milestone.progress == 0.0

        # Add tasks
        milestone.add_task("task_1")
        milestone.add_task("task_2")
        milestone.completed_task_count = 1

        assert milestone.task_count == 2
        assert milestone.progress == 0.5

    def test_milestone_is_overdue(self):
        """Test milestone overdue check."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test",
            due_date=datetime.utcnow() - timedelta(days=1)
        )

        assert milestone.is_overdue is True

        milestone.complete()
        assert milestone.is_overdue is False

    def test_milestone_days_until_due(self):
        """Test days until due calculation."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test",
            due_date=datetime.utcnow() + timedelta(days=7)
        )

        # Allow for sub-day precision (6-7 days)
        assert milestone.days_until_due in (6, 7)

    def test_milestone_complete(self):
        """Test completing a milestone."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test"
        )

        milestone.complete()

        assert milestone.status == MilestoneStatus.COMPLETED
        assert milestone.completed_at is not None

    def test_milestone_add_remove_task(self):
        """Test adding and removing tasks."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test"
        )

        milestone.add_task("task_1")
        assert "task_1" in milestone.task_ids

        assert milestone.remove_task("task_1") is True
        assert "task_1" not in milestone.task_ids

        assert milestone.remove_task("nonexistent") is False

    def test_milestone_to_dict(self):
        """Test converting milestone to dictionary."""
        milestone = Milestone(
            id="ms_1",
            project_id="proj_1",
            name="Test"
        )

        data = milestone.to_dict()

        assert data["id"] == "ms_1"
        assert data["name"] == "Test"
        assert data["status"] == "planned"


# ==================== ProjectPhase Tests ====================

class TestProjectPhase:
    """Tests for ProjectPhase dataclass."""

    def test_create_phase(self):
        """Test creating a phase."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Planning",
            description="Initial planning phase"
        )

        assert phase.id == "phase_1"
        assert phase.name == "Planning"
        assert phase.status == PhaseStatus.NOT_STARTED

    def test_phase_start(self):
        """Test starting a phase."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Planning"
        )

        phase.start()

        assert phase.status == PhaseStatus.IN_PROGRESS
        assert phase.actual_start_date is not None

    def test_phase_complete(self):
        """Test completing a phase."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Planning"
        )

        phase.start()
        phase.complete()

        assert phase.status == PhaseStatus.COMPLETED
        assert phase.actual_end_date is not None

    def test_phase_duration_days(self):
        """Test phase duration calculation."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Test",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=14)
        )

        assert phase.duration_days == 14

    def test_phase_actual_duration_days(self):
        """Test actual duration calculation."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Test"
        )

        phase.start()
        assert phase.actual_duration_days == 0  # Just started

    def test_phase_to_dict(self):
        """Test converting phase to dictionary."""
        phase = ProjectPhase(
            id="phase_1",
            project_id="proj_1",
            name="Test",
            order=1
        )

        data = phase.to_dict()

        assert data["id"] == "phase_1"
        assert data["name"] == "Test"
        assert data["status"] == "not_started"
        assert data["order"] == 1


# ==================== ProjectBudget Tests ====================

class TestProjectBudget:
    """Tests for ProjectBudget dataclass."""

    def test_create_budget(self):
        """Test creating a budget."""
        budget = ProjectBudget(
            total_budget=100000.0,
            spent=30000.0,
            currency="USD"
        )

        assert budget.total_budget == 100000.0
        assert budget.spent == 30000.0
        assert budget.currency == "USD"

    def test_budget_remaining(self):
        """Test remaining budget calculation."""
        budget = ProjectBudget(total_budget=100000.0, spent=30000.0)

        assert budget.remaining == 70000.0

    def test_budget_spent_percentage(self):
        """Test spent percentage calculation."""
        budget = ProjectBudget(total_budget=100000.0, spent=30000.0)

        assert budget.spent_percentage == 30.0

    def test_budget_is_over_budget(self):
        """Test over budget check."""
        budget = ProjectBudget(total_budget=100000.0, spent=110000.0)

        assert budget.is_over_budget is True


# ==================== ProjectMetrics Tests ====================

class TestProjectMetrics:
    """Tests for ProjectMetrics dataclass."""

    def test_create_metrics(self):
        """Test creating metrics."""
        metrics = ProjectMetrics(
            total_tasks=100,
            completed_tasks=60,
            total_milestones=5,
            completed_milestones=3
        )

        assert metrics.total_tasks == 100
        assert metrics.completed_tasks == 60

    def test_metrics_task_completion_rate(self):
        """Test task completion rate."""
        metrics = ProjectMetrics(total_tasks=100, completed_tasks=60)

        assert metrics.task_completion_rate == 0.6

    def test_metrics_milestone_completion_rate(self):
        """Test milestone completion rate."""
        metrics = ProjectMetrics(total_milestones=5, completed_milestones=3)

        assert metrics.milestone_completion_rate == 0.6

    def test_metrics_hours_variance(self):
        """Test hours variance calculation."""
        metrics = ProjectMetrics(
            total_hours_estimated=100.0,
            total_hours_logged=120.0
        )

        assert metrics.hours_variance == 20.0


# ==================== ProjectTemplate Tests ====================

class TestProjectTemplate:
    """Tests for ProjectTemplate dataclass."""

    def test_create_template(self):
        """Test creating a template."""
        template = ProjectTemplate(
            id="tmpl_1",
            name="Agile Template",
            description="Standard agile project template",
            project_type=ProjectType.AGILE,
            phases=[{"name": "Sprint 1"}, {"name": "Sprint 2"}],
            milestones=[{"name": "MVP"}, {"name": "Release"}],
            is_public=True
        )

        assert template.id == "tmpl_1"
        assert template.name == "Agile Template"
        assert len(template.phases) == 2
        assert len(template.milestones) == 2
        assert template.is_public is True


# ==================== ProjectActivity Tests ====================

class TestProjectActivity:
    """Tests for ProjectActivity dataclass."""

    def test_create_activity(self):
        """Test creating an activity."""
        activity = ProjectActivity(
            id="act_1",
            project_id="proj_1",
            user_id="user_1",
            action="created",
            entity_type="milestone",
            entity_id="ms_1",
            description="Milestone created"
        )

        assert activity.id == "act_1"
        assert activity.action == "created"
        assert activity.entity_type == "milestone"


# ==================== ProjectRegistry Tests ====================

class TestProjectRegistry:
    """Tests for ProjectRegistry."""

    def test_create_project(self, registry):
        """Test creating a project."""
        project = registry.create_project(
            name="Test Project",
            workspace_id="ws_1",
            owner_id="user_1"
        )

        assert project.id.startswith("proj_")
        assert project.name == "Test Project"
        assert project.workspace_id == "ws_1"
        assert project.owner_id == "user_1"

    def test_create_project_adds_owner_as_member(self, registry):
        """Test that creating a project adds owner as member."""
        project = registry.create_project(
            name="Test",
            owner_id="user_1"
        )

        members = registry.get_project_members(project.id)
        assert len(members) == 1
        assert members[0].user_id == "user_1"
        assert members[0].role == MemberRole.OWNER

    def test_get_project(self, registry):
        """Test getting a project."""
        project = registry.create_project(name="Test")

        retrieved = registry.get_project(project.id)
        assert retrieved is not None
        assert retrieved.id == project.id

        assert registry.get_project("nonexistent") is None

    def test_update_project(self, registry):
        """Test updating a project."""
        project = registry.create_project(name="Test")
        project.name = "Updated"

        assert registry.update_project(project) is True

        retrieved = registry.get_project(project.id)
        assert retrieved.name == "Updated"

    def test_delete_project_soft(self, registry):
        """Test soft deleting a project."""
        project = registry.create_project(name="Test")

        assert registry.delete_project(project.id, soft_delete=True) is True

        retrieved = registry.get_project(project.id)
        assert retrieved.status == ProjectStatus.ARCHIVED

    def test_delete_project_hard(self, registry):
        """Test hard deleting a project."""
        project = registry.create_project(
            name="Test",
            owner_id="user_1"
        )
        registry.create_milestone(project.id, "Milestone 1")
        registry.create_phase(project.id, "Phase 1")

        assert registry.delete_project(project.id, soft_delete=False) is True

        assert registry.get_project(project.id) is None

    def test_list_projects(self, registry):
        """Test listing projects."""
        registry.create_project(name="Project 1", workspace_id="ws_1")
        registry.create_project(name="Project 2", workspace_id="ws_1")
        registry.create_project(name="Project 3", workspace_id="ws_2")

        all_projects = registry.list_projects()
        assert len(all_projects) == 3

        ws1_projects = registry.list_projects(workspace_id="ws_1")
        assert len(ws1_projects) == 2

    def test_list_projects_by_status(self, registry):
        """Test listing projects by status."""
        p1 = registry.create_project(name="P1")
        p2 = registry.create_project(name="P2")
        p2.status = ProjectStatus.ACTIVE
        registry.update_project(p2)

        active = registry.list_projects(status=ProjectStatus.ACTIVE)
        assert len(active) == 1
        assert active[0].id == p2.id

    def test_list_projects_by_type(self, registry):
        """Test listing projects by type."""
        registry.create_project(name="P1", project_type=ProjectType.AGILE)
        registry.create_project(name="P2", project_type=ProjectType.WATERFALL)

        agile = registry.list_projects(project_type=ProjectType.AGILE)
        assert len(agile) == 1

    def test_list_projects_by_tags(self, registry):
        """Test listing projects by tags."""
        p1 = registry.create_project(name="P1", tags={"backend", "api"})
        registry.create_project(name="P2", tags={"frontend"})

        backend = registry.list_projects(tags={"backend"})
        assert len(backend) == 1
        assert backend[0].id == p1.id

    def test_list_projects_pagination(self, registry):
        """Test project listing pagination."""
        for i in range(10):
            registry.create_project(name=f"Project {i}")

        page1 = registry.list_projects(limit=3, offset=0)
        page2 = registry.list_projects(limit=3, offset=3)

        assert len(page1) == 3
        assert len(page2) == 3
        assert page1[0].id != page2[0].id

    def test_search_projects(self, registry):
        """Test searching projects."""
        registry.create_project(name="Alpha Project", description="Testing alpha")
        registry.create_project(name="Beta Project", tags={"alpha"})
        registry.create_project(name="Gamma")

        results = registry.search_projects("alpha")
        assert len(results) == 2

    # Member tests
    def test_add_member(self, registry):
        """Test adding a member."""
        project = registry.create_project(name="Test")

        member = registry.add_member(
            project.id,
            "user_2",
            MemberRole.MEMBER,
            invited_by="user_1"
        )

        assert member is not None
        assert member.user_id == "user_2"
        assert member.role == MemberRole.MEMBER
        assert member.invited_by == "user_1"

    def test_add_member_already_exists(self, registry):
        """Test adding a member that already exists."""
        project = registry.create_project(name="Test")

        member1 = registry.add_member(project.id, "user_2", MemberRole.MEMBER)
        member2 = registry.add_member(project.id, "user_2", MemberRole.ADMIN)

        # Should return existing member
        assert member1.id == member2.id

    def test_get_project_member(self, registry):
        """Test getting a specific member."""
        project = registry.create_project(name="Test")
        registry.add_member(project.id, "user_2", MemberRole.MEMBER)

        member = registry.get_project_member(project.id, "user_2")
        assert member is not None
        assert member.user_id == "user_2"

    def test_update_member_role(self, registry):
        """Test updating a member's role."""
        project = registry.create_project(name="Test")
        registry.add_member(project.id, "user_2", MemberRole.MEMBER)

        assert registry.update_member_role(project.id, "user_2", MemberRole.ADMIN) is True

        member = registry.get_project_member(project.id, "user_2")
        assert member.role == MemberRole.ADMIN

    def test_remove_member(self, registry):
        """Test removing a member."""
        project = registry.create_project(name="Test")
        registry.add_member(project.id, "user_2", MemberRole.MEMBER)

        assert registry.remove_member(project.id, "user_2") is True
        assert registry.get_project_member(project.id, "user_2") is None

    def test_get_project_members(self, registry):
        """Test getting all project members."""
        project = registry.create_project(name="Test", owner_id="user_1")
        registry.add_member(project.id, "user_2", MemberRole.MEMBER)
        registry.add_member(project.id, "user_3", MemberRole.VIEWER)

        members = registry.get_project_members(project.id)
        assert len(members) == 3

    def test_get_user_projects(self, registry):
        """Test getting all projects for a user."""
        p1 = registry.create_project(name="P1")
        p2 = registry.create_project(name="P2")

        registry.add_member(p1.id, "user_1", MemberRole.MEMBER)
        registry.add_member(p2.id, "user_1", MemberRole.MEMBER)

        projects = registry.get_user_projects("user_1")
        assert len(projects) == 2

    # Milestone tests
    def test_create_milestone(self, registry):
        """Test creating a milestone."""
        project = registry.create_project(name="Test")

        milestone = registry.create_milestone(
            project.id,
            "Version 1.0",
            description="First release"
        )

        assert milestone is not None
        assert milestone.name == "Version 1.0"
        assert milestone.project_id == project.id

    def test_get_milestone(self, registry):
        """Test getting a milestone."""
        project = registry.create_project(name="Test")
        ms = registry.create_milestone(project.id, "Milestone 1")

        retrieved = registry.get_milestone(ms.id)
        assert retrieved is not None
        assert retrieved.name == "Milestone 1"

    def test_update_milestone(self, registry):
        """Test updating a milestone."""
        project = registry.create_project(name="Test")
        ms = registry.create_milestone(project.id, "Milestone 1")

        ms.name = "Updated Milestone"
        assert registry.update_milestone(ms) is True

        retrieved = registry.get_milestone(ms.id)
        assert retrieved.name == "Updated Milestone"

    def test_delete_milestone(self, registry):
        """Test deleting a milestone."""
        project = registry.create_project(name="Test")
        ms = registry.create_milestone(project.id, "Milestone 1")

        assert registry.delete_milestone(ms.id) is True
        assert registry.get_milestone(ms.id) is None

        # Should be removed from project
        assert ms.id not in project.milestone_ids

    def test_get_project_milestones(self, registry):
        """Test getting all milestones for a project."""
        project = registry.create_project(name="Test")
        registry.create_milestone(project.id, "MS1")
        registry.create_milestone(project.id, "MS2")
        registry.create_milestone(project.id, "MS3")

        milestones = registry.get_project_milestones(project.id)
        assert len(milestones) == 3

    def test_complete_milestone(self, registry):
        """Test completing a milestone."""
        project = registry.create_project(name="Test")
        ms = registry.create_milestone(project.id, "Milestone 1")

        assert registry.complete_milestone(ms.id) is True

        retrieved = registry.get_milestone(ms.id)
        assert retrieved.status == MilestoneStatus.COMPLETED

    # Phase tests
    def test_create_phase(self, registry):
        """Test creating a phase."""
        project = registry.create_project(name="Test")

        phase = registry.create_phase(
            project.id,
            "Planning",
            description="Planning phase"
        )

        assert phase is not None
        assert phase.name == "Planning"
        assert phase.project_id == project.id

    def test_get_phase(self, registry):
        """Test getting a phase."""
        project = registry.create_project(name="Test")
        phase = registry.create_phase(project.id, "Phase 1")

        retrieved = registry.get_phase(phase.id)
        assert retrieved is not None
        assert retrieved.name == "Phase 1"

    def test_update_phase(self, registry):
        """Test updating a phase."""
        project = registry.create_project(name="Test")
        phase = registry.create_phase(project.id, "Phase 1")

        phase.name = "Updated Phase"
        assert registry.update_phase(phase) is True

        retrieved = registry.get_phase(phase.id)
        assert retrieved.name == "Updated Phase"

    def test_delete_phase(self, registry):
        """Test deleting a phase."""
        project = registry.create_project(name="Test")
        phase = registry.create_phase(project.id, "Phase 1")

        assert registry.delete_phase(phase.id) is True
        assert registry.get_phase(phase.id) is None

    def test_get_project_phases(self, registry):
        """Test getting all phases for a project."""
        project = registry.create_project(name="Test")
        registry.create_phase(project.id, "Phase 1")
        registry.create_phase(project.id, "Phase 2")

        phases = registry.get_project_phases(project.id)
        assert len(phases) == 2

    # Template tests
    def test_create_template(self, registry):
        """Test creating a template."""
        template = registry.create_template(
            name="Agile Template",
            workspace_id="ws_1",
            created_by="user_1",
            project_type=ProjectType.AGILE
        )

        assert template.id.startswith("template_")
        assert template.name == "Agile Template"

    def test_get_template(self, registry):
        """Test getting a template."""
        template = registry.create_template(name="Test Template")

        retrieved = registry.get_template(template.id)
        assert retrieved is not None
        assert retrieved.name == "Test Template"

    def test_list_templates(self, registry):
        """Test listing templates."""
        registry.create_template(name="T1", workspace_id="ws_1")
        registry.create_template(name="T2", workspace_id="ws_1", is_public=True)
        registry.create_template(name="T3", workspace_id="ws_2")

        all_templates = registry.list_templates()
        assert len(all_templates) == 3

        ws1_templates = registry.list_templates(workspace_id="ws_1")
        assert len(ws1_templates) == 2  # T1 and T2

    def test_delete_template(self, registry):
        """Test deleting a template."""
        template = registry.create_template(name="Test Template")

        assert registry.delete_template(template.id) is True
        assert registry.get_template(template.id) is None

    # Activity tests
    def test_log_activity(self, registry):
        """Test logging an activity."""
        project = registry.create_project(name="Test")

        activity = registry.log_activity(
            project_id=project.id,
            action="created",
            user_id="user_1",
            entity_type="project",
            entity_id=project.id,
            description="Project created"
        )

        assert activity.id.startswith("activity_")
        assert activity.action == "created"

    def test_get_project_activities(self, registry):
        """Test getting project activities."""
        project = registry.create_project(name="Test")

        registry.log_activity(project.id, "created")
        registry.log_activity(project.id, "updated")
        registry.log_activity(project.id, "member_added")

        activities = registry.get_project_activities(project.id)
        assert len(activities) == 3


# ==================== ProjectManager Tests ====================

class TestProjectManager:
    """Tests for ProjectManager."""

    def test_create_project(self, manager):
        """Test creating a project."""
        project = manager.create_project(
            name="Test Project",
            workspace_id="ws_1",
            owner_id="user_1",
            description="A test project"
        )

        assert project.name == "Test Project"
        assert project.owner_id == "user_1"

    def test_create_project_logs_activity(self, manager):
        """Test that creating a project logs activity."""
        project = manager.create_project(
            name="Test Project",
            owner_id="user_1"
        )

        activities = manager.get_activities(project.id)
        assert len(activities) == 1
        assert activities[0].action == "created"

    def test_create_from_template(self, manager):
        """Test creating a project from template."""
        template = manager.create_template(
            name="Agile Template",
            phases=[{"name": "Sprint 1"}, {"name": "Sprint 2"}],
            milestones=[{"name": "MVP"}],
            tags={"agile"}
        )

        project = manager.create_from_template(
            template_id=template.id,
            name="New Agile Project",
            owner_id="user_1"
        )

        assert project is not None
        assert project.name == "New Agile Project"
        assert "agile" in project.tags

        phases = manager.get_phases(project.id)
        assert len(phases) == 2

        milestones = manager.get_milestones(project.id)
        assert len(milestones) == 1

    def test_get_project(self, manager, sample_project):
        """Test getting a project."""
        retrieved = manager.get_project(sample_project.id)
        assert retrieved is not None
        assert retrieved.name == sample_project.name

    def test_update_project(self, manager, sample_project):
        """Test updating a project."""
        updated = manager.update_project(
            sample_project.id,
            name="Updated Name",
            status=ProjectStatus.ACTIVE,
            updated_by="user_1"
        )

        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.status == ProjectStatus.ACTIVE

    def test_delete_project(self, manager, sample_project):
        """Test deleting a project."""
        assert manager.delete_project(sample_project.id) is True

        retrieved = manager.get_project(sample_project.id)
        assert retrieved.status == ProjectStatus.ARCHIVED

    def test_activate_project(self, manager, sample_project):
        """Test activating a project."""
        activated = manager.activate_project(sample_project.id)

        assert activated is not None
        assert activated.status == ProjectStatus.ACTIVE
        assert activated.start_date is not None

    def test_complete_project(self, manager, sample_project):
        """Test completing a project."""
        manager.activate_project(sample_project.id)
        completed = manager.complete_project(sample_project.id)

        assert completed is not None
        assert completed.status == ProjectStatus.COMPLETED
        assert completed.actual_end_date is not None

    def test_list_projects(self, manager):
        """Test listing projects."""
        manager.create_project(name="P1", workspace_id="ws_1")
        manager.create_project(name="P2", workspace_id="ws_1")

        projects = manager.list_projects(workspace_id="ws_1")
        assert len(projects) == 2

    def test_search_projects(self, manager):
        """Test searching projects."""
        manager.create_project(name="Alpha Project")
        manager.create_project(name="Beta Project")

        results = manager.search_projects("alpha")
        assert len(results) == 1

    def test_get_my_projects(self, manager):
        """Test getting user's projects."""
        p1 = manager.create_project(name="P1")
        p2 = manager.create_project(name="P2")

        manager.add_member(p1.id, "user_1", MemberRole.MEMBER)
        manager.add_member(p2.id, "user_1", MemberRole.VIEWER)

        projects = manager.get_my_projects("user_1")
        assert len(projects) == 2

    # Member operations
    def test_add_member(self, manager, sample_project):
        """Test adding a member."""
        member = manager.add_member(
            sample_project.id,
            "user_2",
            MemberRole.MEMBER,
            added_by="user_1"
        )

        assert member is not None
        assert member.user_id == "user_2"

    def test_remove_member(self, manager, sample_project):
        """Test removing a member."""
        manager.add_member(sample_project.id, "user_2", MemberRole.MEMBER)

        assert manager.remove_member(sample_project.id, "user_2") is True
        assert manager.is_member(sample_project.id, "user_2") is False

    def test_update_member_role(self, manager, sample_project):
        """Test updating member role."""
        manager.add_member(sample_project.id, "user_2", MemberRole.MEMBER)

        assert manager.update_member_role(
            sample_project.id,
            "user_2",
            MemberRole.ADMIN
        ) is True

        role = manager.get_member_role(sample_project.id, "user_2")
        assert role == MemberRole.ADMIN

    def test_get_members(self, manager, sample_project):
        """Test getting project members."""
        manager.add_member(sample_project.id, "user_2", MemberRole.MEMBER)

        members = manager.get_members(sample_project.id)
        assert len(members) == 2  # Owner + new member

    def test_is_member(self, manager, sample_project):
        """Test checking membership."""
        assert manager.is_member(sample_project.id, "user_1") is True
        assert manager.is_member(sample_project.id, "user_99") is False

    def test_get_member_role(self, manager, sample_project):
        """Test getting member role."""
        role = manager.get_member_role(sample_project.id, "user_1")
        assert role == MemberRole.OWNER

    # Milestone operations
    def test_create_milestone(self, manager, sample_project):
        """Test creating a milestone."""
        milestone = manager.create_milestone(
            sample_project.id,
            "Version 1.0",
            description="First release",
            due_date=datetime.utcnow() + timedelta(days=30)
        )

        assert milestone is not None
        assert milestone.name == "Version 1.0"

    def test_get_milestone(self, manager, sample_project):
        """Test getting a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")

        retrieved = manager.get_milestone(ms.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_update_milestone(self, manager, sample_project):
        """Test updating a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")

        updated = manager.update_milestone(
            ms.id,
            name="Updated",
            status=MilestoneStatus.IN_PROGRESS
        )

        assert updated is not None
        assert updated.name == "Updated"
        assert updated.status == MilestoneStatus.IN_PROGRESS

    def test_delete_milestone(self, manager, sample_project):
        """Test deleting a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")

        assert manager.delete_milestone(ms.id) is True
        assert manager.get_milestone(ms.id) is None

    def test_complete_milestone(self, manager, sample_project):
        """Test completing a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")

        assert manager.complete_milestone(ms.id) is True

        retrieved = manager.get_milestone(ms.id)
        assert retrieved.status == MilestoneStatus.COMPLETED

    def test_get_milestones(self, manager, sample_project):
        """Test getting project milestones."""
        manager.create_milestone(sample_project.id, "MS1")
        manager.create_milestone(sample_project.id, "MS2")

        milestones = manager.get_milestones(sample_project.id)
        assert len(milestones) == 2

    def test_add_task_to_milestone(self, manager, sample_project):
        """Test adding a task to a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")

        assert manager.add_task_to_milestone(ms.id, "task_1") is True

        retrieved = manager.get_milestone(ms.id)
        assert "task_1" in retrieved.task_ids

    def test_remove_task_from_milestone(self, manager, sample_project):
        """Test removing a task from a milestone."""
        ms = manager.create_milestone(sample_project.id, "Test")
        manager.add_task_to_milestone(ms.id, "task_1")

        assert manager.remove_task_from_milestone(ms.id, "task_1") is True

        retrieved = manager.get_milestone(ms.id)
        assert "task_1" not in retrieved.task_ids

    # Phase operations
    def test_create_phase(self, manager, sample_project):
        """Test creating a phase."""
        phase = manager.create_phase(
            sample_project.id,
            "Planning",
            description="Initial planning",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=14)
        )

        assert phase is not None
        assert phase.name == "Planning"

    def test_get_phase(self, manager, sample_project):
        """Test getting a phase."""
        phase = manager.create_phase(sample_project.id, "Test")

        retrieved = manager.get_phase(phase.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_update_phase(self, manager, sample_project):
        """Test updating a phase."""
        phase = manager.create_phase(sample_project.id, "Test")

        updated = manager.update_phase(
            phase.id,
            name="Updated",
            status=PhaseStatus.IN_PROGRESS
        )

        assert updated is not None
        assert updated.name == "Updated"
        assert updated.status == PhaseStatus.IN_PROGRESS
        assert updated.actual_start_date is not None

    def test_delete_phase(self, manager, sample_project):
        """Test deleting a phase."""
        phase = manager.create_phase(sample_project.id, "Test")

        assert manager.delete_phase(phase.id) is True
        assert manager.get_phase(phase.id) is None

    def test_get_phases(self, manager, sample_project):
        """Test getting project phases."""
        manager.create_phase(sample_project.id, "Phase 1")
        manager.create_phase(sample_project.id, "Phase 2")

        phases = manager.get_phases(sample_project.id)
        assert len(phases) == 2

    # Template operations
    def test_create_template(self, manager):
        """Test creating a template."""
        template = manager.create_template(
            name="Agile Template",
            description="Standard agile template",
            project_type=ProjectType.AGILE,
            phases=[{"name": "Sprint 1"}],
            milestones=[{"name": "MVP"}],
            is_public=True
        )

        assert template is not None
        assert template.name == "Agile Template"
        assert template.is_public is True

    def test_get_template(self, manager):
        """Test getting a template."""
        template = manager.create_template(name="Test")

        retrieved = manager.get_template(template.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_list_templates(self, manager):
        """Test listing templates."""
        manager.create_template(name="T1", workspace_id="ws_1")
        manager.create_template(name="T2", workspace_id="ws_1")

        templates = manager.list_templates(workspace_id="ws_1")
        assert len(templates) == 2

    def test_delete_template(self, manager):
        """Test deleting a template."""
        template = manager.create_template(name="Test")

        assert manager.delete_template(template.id) is True
        assert manager.get_template(template.id) is None

    # Metrics operations
    def test_get_activities(self, manager, sample_project):
        """Test getting activities."""
        manager.add_member(sample_project.id, "user_2", MemberRole.MEMBER)

        activities = manager.get_activities(sample_project.id)
        assert len(activities) >= 2  # Created + member added

    def test_get_metrics(self, manager, sample_project):
        """Test getting project metrics."""
        manager.create_milestone(sample_project.id, "MS1")
        manager.create_milestone(sample_project.id, "MS2")
        manager.add_member(sample_project.id, "user_2", MemberRole.MEMBER)

        metrics = manager.get_metrics(sample_project.id)

        assert metrics is not None
        assert metrics.total_milestones == 2
        assert metrics.team_size == 2  # Owner + new member

    def test_calculate_health_on_track(self, manager, sample_project):
        """Test health calculation - on track."""
        health = manager.calculate_health(sample_project.id)
        assert health == ProjectHealth.ON_TRACK

    def test_calculate_health_overdue(self, manager):
        """Test health calculation - overdue."""
        project = manager.create_project(
            name="Overdue Project",
            target_end_date=datetime.utcnow() - timedelta(days=1)
        )
        manager.activate_project(project.id)

        health = manager.calculate_health(project.id)
        assert health == ProjectHealth.OFF_TRACK

    def test_calculate_health_at_risk(self, manager, sample_project):
        """Test health calculation - at risk."""
        manager.activate_project(sample_project.id)

        # Create overdue milestone
        ms = manager.create_milestone(
            sample_project.id,
            "Overdue",
            due_date=datetime.utcnow() - timedelta(days=1)
        )

        health = manager.calculate_health(sample_project.id)
        assert health == ProjectHealth.AT_RISK

    def test_get_stats(self, manager):
        """Test getting workspace stats."""
        p1 = manager.create_project(name="P1", workspace_id="ws_1")
        p2 = manager.create_project(name="P2", workspace_id="ws_1")
        manager.activate_project(p2.id)

        manager.create_milestone(p1.id, "MS1")
        manager.add_member(p1.id, "user_2", MemberRole.MEMBER)

        stats = manager.get_stats(workspace_id="ws_1")

        assert stats["total_projects"] == 2
        assert stats["by_status"]["planning"] == 1
        assert stats["by_status"]["active"] == 1


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global instance management."""

    def test_set_and_get_project_manager(self):
        """Test setting and getting global project manager."""
        reset_project_manager()

        assert get_project_manager() is None

        manager = ProjectManager()
        set_project_manager(manager)

        assert get_project_manager() is manager

        reset_project_manager()
        assert get_project_manager() is None


# ==================== Integration Tests ====================

class TestProjectWorkflows:
    """Integration tests for project workflows."""

    def test_complete_project_workflow(self, manager):
        """Test a complete project workflow."""
        # Create project
        project = manager.create_project(
            name="Product Launch",
            owner_id="pm_user",
            description="Launch new product",
            project_type=ProjectType.AGILE
        )

        # Add team members
        manager.add_member(project.id, "dev_1", MemberRole.MEMBER)
        manager.add_member(project.id, "dev_2", MemberRole.MEMBER)
        manager.add_member(project.id, "designer", MemberRole.MEMBER)

        # Create phases
        planning = manager.create_phase(project.id, "Planning")
        development = manager.create_phase(project.id, "Development")
        testing = manager.create_phase(project.id, "Testing")
        launch = manager.create_phase(project.id, "Launch")

        # Create milestones
        mvp = manager.create_milestone(
            project.id,
            "MVP",
            due_date=datetime.utcnow() + timedelta(days=30)
        )
        beta = manager.create_milestone(
            project.id,
            "Beta Release",
            due_date=datetime.utcnow() + timedelta(days=60)
        )
        final = manager.create_milestone(
            project.id,
            "Final Release",
            due_date=datetime.utcnow() + timedelta(days=90)
        )

        # Activate project
        manager.activate_project(project.id)

        # Start planning phase
        manager.update_phase(planning.id, status=PhaseStatus.IN_PROGRESS)

        # Complete planning
        manager.update_phase(planning.id, status=PhaseStatus.COMPLETED)

        # Start development
        manager.update_phase(development.id, status=PhaseStatus.IN_PROGRESS)

        # Complete MVP milestone
        manager.complete_milestone(mvp.id)

        # Verify metrics
        metrics = manager.get_metrics(project.id)
        assert metrics.total_milestones == 3
        assert metrics.completed_milestones == 1
        assert metrics.team_size == 4  # owner + 3 members

    def test_template_based_project_creation(self, manager):
        """Test creating projects from templates."""
        # Create template
        template = manager.create_template(
            name="Scrum Sprint",
            description="Standard 2-week sprint",
            project_type=ProjectType.SCRUM,
            phases=[
                {"name": "Sprint Planning"},
                {"name": "Development"},
                {"name": "Review"},
                {"name": "Retrospective"}
            ],
            milestones=[
                {"name": "Sprint Goal"}
            ],
            is_public=True
        )

        # Create projects from template
        sprint1 = manager.create_from_template(
            template.id,
            name="Sprint 1",
            owner_id="scrum_master"
        )
        sprint2 = manager.create_from_template(
            template.id,
            name="Sprint 2",
            owner_id="scrum_master"
        )

        # Verify both projects have the template structure
        for project in [sprint1, sprint2]:
            phases = manager.get_phases(project.id)
            assert len(phases) == 4

            milestones = manager.get_milestones(project.id)
            assert len(milestones) == 1

    def test_project_health_monitoring(self, manager):
        """Test project health monitoring."""
        project = manager.create_project(
            name="Monitored Project",
            target_end_date=datetime.utcnow() + timedelta(days=30)
        )
        manager.activate_project(project.id)

        # Initially on track
        assert manager.calculate_health(project.id) == ProjectHealth.ON_TRACK

        # Add overdue milestone - becomes at risk
        manager.create_milestone(
            project.id,
            "Overdue Milestone",
            due_date=datetime.utcnow() - timedelta(days=5)
        )

        assert manager.calculate_health(project.id) == ProjectHealth.AT_RISK

        # Update project deadline to past - becomes off track
        manager.update_project(
            project.id,
            target_end_date=datetime.utcnow() - timedelta(days=1)
        )

        assert manager.calculate_health(project.id) == ProjectHealth.OFF_TRACK
