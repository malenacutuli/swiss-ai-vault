"""
Tests for the User Profiles & Directory module.
"""

import pytest
from datetime import datetime, timedelta, time
from app.collaboration.profiles import (
    ProfileManager,
    ProfileRegistry,
    UserProfile,
    ProfileStatus,
    ProfilePreferences,
    PresenceStatus,
    UserPresence,
    Skill,
    SkillLevel,
    Badge,
    BadgeType,
    ContactInfo,
    ContactType,
    WorkingHours,
    AvailabilityBlock,
    AvailabilityType,
    OrgRelationship,
    RelationshipType,
    DirectoryEntry,
    get_profile_manager,
    set_profile_manager,
    reset_profile_manager,
)


# ==================== Fixtures ====================

@pytest.fixture
def registry():
    """Create a fresh profile registry."""
    return ProfileRegistry()


@pytest.fixture
def manager():
    """Create a fresh profile manager."""
    return ProfileManager()


@pytest.fixture
def sample_profile(manager):
    """Create a sample profile."""
    return manager.create_profile(
        user_id="user_1",
        display_name="John Doe",
        email="john@example.com",
        workspace_id="ws_1"
    )


# ==================== ContactInfo Tests ====================

class TestContactInfo:
    """Tests for ContactInfo dataclass."""

    def test_create_contact(self):
        """Test creating contact info."""
        contact = ContactInfo(
            type=ContactType.EMAIL,
            value="user@example.com",
            is_primary=True
        )

        assert contact.type == ContactType.EMAIL
        assert contact.value == "user@example.com"
        assert contact.is_primary is True
        assert contact.is_verified is False


# ==================== Skill Tests ====================

class TestSkill:
    """Tests for Skill dataclass."""

    def test_create_skill(self):
        """Test creating a skill."""
        skill = Skill(
            id="skill_1",
            user_id="user_1",
            name="Python",
            category="Programming",
            level=SkillLevel.ADVANCED
        )

        assert skill.id == "skill_1"
        assert skill.name == "Python"
        assert skill.level == SkillLevel.ADVANCED
        assert skill.endorsement_count == 0

    def test_skill_endorsements(self):
        """Test skill endorsements."""
        skill = Skill(
            id="skill_1",
            user_id="user_1",
            name="Python"
        )

        # Add endorsement
        assert skill.add_endorsement("endorser_1") is True
        assert skill.endorsement_count == 1

        # Can't endorse twice
        assert skill.add_endorsement("endorser_1") is False
        assert skill.endorsement_count == 1

        # Can't endorse own skill
        assert skill.add_endorsement("user_1") is False

        # Remove endorsement
        assert skill.remove_endorsement("endorser_1") is True
        assert skill.endorsement_count == 0

        # Can't remove non-existent
        assert skill.remove_endorsement("endorser_1") is False

    def test_skill_to_dict(self):
        """Test skill to dictionary."""
        skill = Skill(
            id="skill_1",
            user_id="user_1",
            name="Python",
            level=SkillLevel.EXPERT
        )

        data = skill.to_dict()

        assert data["id"] == "skill_1"
        assert data["name"] == "Python"
        assert data["level"] == "expert"


# ==================== Badge Tests ====================

class TestBadge:
    """Tests for Badge dataclass."""

    def test_create_badge(self):
        """Test creating a badge."""
        badge = Badge(
            id="badge_1",
            user_id="user_1",
            type=BadgeType.VERIFIED,
            name="Verified User"
        )

        assert badge.id == "badge_1"
        assert badge.type == BadgeType.VERIFIED
        assert badge.is_valid is True

    def test_badge_expiry(self):
        """Test badge expiry."""
        # Non-expired badge
        badge = Badge(
            id="badge_1",
            user_id="user_1",
            type=BadgeType.CERTIFIED,
            name="Certified",
            expires_at=datetime.utcnow() + timedelta(days=30)
        )

        assert badge.is_expired is False
        assert badge.is_valid is True

        # Expired badge
        expired_badge = Badge(
            id="badge_2",
            user_id="user_1",
            type=BadgeType.CERTIFIED,
            name="Expired Cert",
            expires_at=datetime.utcnow() - timedelta(days=1)
        )

        assert expired_badge.is_expired is True
        assert expired_badge.is_valid is False


# ==================== WorkingHours Tests ====================

class TestWorkingHours:
    """Tests for WorkingHours dataclass."""

    def test_default_working_hours(self):
        """Test default working hours."""
        hours = WorkingHours()

        assert hours.timezone == "UTC"
        assert hours.monday is None

    def test_get_hours_for_day(self):
        """Test getting hours for a specific day."""
        hours = WorkingHours(
            monday=(time(9, 0), time(17, 0)),
            tuesday=(time(9, 0), time(17, 0))
        )

        assert hours.get_hours_for_day(0) == (time(9, 0), time(17, 0))  # Monday
        assert hours.get_hours_for_day(2) is None  # Wednesday
        assert hours.get_hours_for_day(7) is None  # Invalid

    def test_is_working_day(self):
        """Test checking if day is a working day."""
        hours = WorkingHours(
            monday=(time(9, 0), time(17, 0)),
            tuesday=(time(9, 0), time(17, 0))
        )

        assert hours.is_working_day(0) is True  # Monday
        assert hours.is_working_day(5) is False  # Saturday


# ==================== AvailabilityBlock Tests ====================

class TestAvailabilityBlock:
    """Tests for AvailabilityBlock dataclass."""

    def test_create_availability_block(self):
        """Test creating an availability block."""
        block = AvailabilityBlock(
            id="avail_1",
            user_id="user_1",
            type=AvailabilityType.OUT_OF_OFFICE,
            title="Vacation",
            start_time=datetime.utcnow() - timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(days=7)
        )

        assert block.id == "avail_1"
        assert block.type == AvailabilityType.OUT_OF_OFFICE
        assert block.is_active is True

    def test_availability_block_active(self):
        """Test availability block active status."""
        # Future block
        future = AvailabilityBlock(
            id="avail_1",
            user_id="user_1",
            type=AvailabilityType.VACATION,
            start_time=datetime.utcnow() + timedelta(days=1),
            end_time=datetime.utcnow() + timedelta(days=7)
        )

        assert future.is_active is False

        # Past block
        past = AvailabilityBlock(
            id="avail_2",
            user_id="user_1",
            type=AvailabilityType.MEETING,
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1)
        )

        assert past.is_active is False

    def test_availability_duration(self):
        """Test availability duration calculation."""
        block = AvailabilityBlock(
            id="avail_1",
            user_id="user_1",
            type=AvailabilityType.MEETING,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=2)
        )

        assert abs(block.duration_hours - 2.0) < 0.001


# ==================== UserPresence Tests ====================

class TestUserPresence:
    """Tests for UserPresence dataclass."""

    def test_create_presence(self):
        """Test creating user presence."""
        presence = UserPresence(user_id="user_1")

        assert presence.user_id == "user_1"
        assert presence.status == PresenceStatus.OFFLINE

    def test_set_status(self):
        """Test setting presence status."""
        presence = UserPresence(user_id="user_1")

        presence.set_status(
            PresenceStatus.BUSY,
            text="In a meeting",
            emoji=":calendar:",
            expires_in_minutes=60
        )

        assert presence.status == PresenceStatus.BUSY
        assert presence.status_text == "In a meeting"
        assert presence.status_emoji == ":calendar:"
        assert presence.status_expires_at is not None

    def test_clear_status(self):
        """Test clearing status."""
        presence = UserPresence(user_id="user_1")
        presence.set_status(PresenceStatus.BUSY, text="Busy")

        presence.clear_status()

        assert presence.status_text == ""
        assert presence.status_emoji is None
        assert presence.status_expires_at is None

    def test_status_expired(self):
        """Test status expiration."""
        presence = UserPresence(
            user_id="user_1",
            status_expires_at=datetime.utcnow() - timedelta(minutes=1)
        )

        assert presence.is_status_expired is True

    def test_update_last_seen(self):
        """Test updating last seen."""
        presence = UserPresence(user_id="user_1")
        assert presence.last_seen_at is None

        presence.update_last_seen()
        assert presence.last_seen_at is not None

    def test_presence_to_dict(self):
        """Test presence to dictionary."""
        presence = UserPresence(
            user_id="user_1",
            status=PresenceStatus.ONLINE,
            status_text="Working"
        )

        data = presence.to_dict()

        assert data["user_id"] == "user_1"
        assert data["status"] == "online"
        assert data["status_text"] == "Working"


# ==================== ProfilePreferences Tests ====================

class TestProfilePreferences:
    """Tests for ProfilePreferences dataclass."""

    def test_default_preferences(self):
        """Test default preferences."""
        prefs = ProfilePreferences()

        assert prefs.show_email is True
        assert prefs.show_phone is False
        assert prefs.email_notifications is True
        assert prefs.theme == "system"
        assert prefs.language == "en"


# ==================== UserProfile Tests ====================

class TestUserProfile:
    """Tests for UserProfile dataclass."""

    def test_create_profile(self):
        """Test creating a profile."""
        profile = UserProfile(
            id="profile_1",
            user_id="user_1",
            display_name="John Doe",
            email="john@example.com"
        )

        assert profile.id == "profile_1"
        assert profile.user_id == "user_1"
        assert profile.display_name == "John Doe"
        assert profile.status == ProfileStatus.ACTIVE

    def test_profile_full_name(self):
        """Test full name property."""
        profile = UserProfile(
            id="p1",
            user_id="u1",
            first_name="John",
            last_name="Doe"
        )

        assert profile.full_name == "John Doe"

        # With display name only
        profile2 = UserProfile(
            id="p2",
            user_id="u2",
            display_name="JD"
        )

        assert profile2.full_name == "JD"

    def test_profile_initials(self):
        """Test initials property."""
        profile = UserProfile(
            id="p1",
            user_id="u1",
            first_name="John",
            last_name="Doe"
        )

        assert profile.initials == "JD"

        # With display name
        profile2 = UserProfile(
            id="p2",
            user_id="u2",
            display_name="Jane Smith"
        )

        assert profile2.initials == "JS"

    def test_profile_add_contact(self):
        """Test adding contact info."""
        profile = UserProfile(id="p1", user_id="u1")

        contact = ContactInfo(
            type=ContactType.PHONE,
            value="+1234567890",
            is_primary=True
        )

        profile.add_contact(contact)

        assert len(profile.contacts) == 1
        assert profile.contacts[0].value == "+1234567890"

    def test_profile_get_primary_contact(self):
        """Test getting primary contact."""
        profile = UserProfile(id="p1", user_id="u1")

        profile.add_contact(ContactInfo(
            type=ContactType.EMAIL,
            value="secondary@example.com"
        ))
        profile.add_contact(ContactInfo(
            type=ContactType.EMAIL,
            value="primary@example.com",
            is_primary=True
        ))

        primary = profile.get_primary_contact(ContactType.EMAIL)
        assert primary is not None
        assert primary.value == "primary@example.com"

    def test_profile_verify(self):
        """Test profile verification."""
        profile = UserProfile(id="p1", user_id="u1")

        assert profile.is_verified is False

        profile.verify()

        assert profile.is_verified is True
        assert profile.verified_at is not None

    def test_profile_update_activity(self):
        """Test updating activity."""
        profile = UserProfile(id="p1", user_id="u1")

        assert profile.last_active_at is None

        profile.update_activity()

        assert profile.last_active_at is not None

    def test_profile_to_dict(self):
        """Test profile to dictionary."""
        profile = UserProfile(
            id="p1",
            user_id="u1",
            display_name="John Doe",
            email="john@example.com"
        )

        data = profile.to_dict()

        assert data["id"] == "p1"
        assert data["display_name"] == "John Doe"

        # With private data
        data_private = profile.to_dict(include_private=True)
        assert data_private["email"] == "john@example.com"


# ==================== ProfileRegistry Tests ====================

class TestProfileRegistry:
    """Tests for ProfileRegistry."""

    def test_create_profile(self, registry):
        """Test creating a profile."""
        profile = registry.create_profile(
            user_id="user_1",
            display_name="John Doe",
            email="john@example.com"
        )

        assert profile.id.startswith("profile_")
        assert profile.user_id == "user_1"

    def test_create_profile_existing_user(self, registry):
        """Test creating profile for existing user returns existing."""
        profile1 = registry.create_profile(user_id="user_1")
        profile2 = registry.create_profile(user_id="user_1")

        assert profile1.id == profile2.id

    def test_get_profile(self, registry):
        """Test getting a profile."""
        profile = registry.create_profile(user_id="user_1")

        retrieved = registry.get_profile(profile.id)
        assert retrieved is not None
        assert retrieved.user_id == "user_1"

    def test_get_profile_by_user(self, registry):
        """Test getting profile by user ID."""
        profile = registry.create_profile(user_id="user_1")

        retrieved = registry.get_profile_by_user("user_1")
        assert retrieved is not None
        assert retrieved.id == profile.id

    def test_update_profile(self, registry):
        """Test updating a profile."""
        profile = registry.create_profile(user_id="user_1")
        profile.display_name = "Updated Name"

        assert registry.update_profile(profile) is True

        retrieved = registry.get_profile(profile.id)
        assert retrieved.display_name == "Updated Name"

    def test_delete_profile(self, registry):
        """Test deleting a profile."""
        profile = registry.create_profile(user_id="user_1")
        registry.add_skill("user_1", "Python")

        assert registry.delete_profile(profile.id) is True
        assert registry.get_profile(profile.id) is None
        assert registry.get_profile_by_user("user_1") is None

    def test_list_profiles(self, registry):
        """Test listing profiles."""
        registry.create_profile(user_id="user_1", workspace_id="ws_1")
        registry.create_profile(user_id="user_2", workspace_id="ws_1")
        registry.create_profile(user_id="user_3", workspace_id="ws_2")

        all_profiles = registry.list_profiles()
        assert len(all_profiles) == 3

        ws1_profiles = registry.list_profiles(workspace_id="ws_1")
        assert len(ws1_profiles) == 2

    def test_list_profiles_by_department(self, registry):
        """Test listing profiles by department."""
        p1 = registry.create_profile(user_id="user_1", department="Engineering")
        registry.create_profile(user_id="user_2", department="Marketing")

        eng_profiles = registry.list_profiles(department="Engineering")
        assert len(eng_profiles) == 1
        assert eng_profiles[0].id == p1.id

    def test_search_profiles(self, registry):
        """Test searching profiles."""
        registry.create_profile(
            user_id="user_1",
            display_name="John Doe",
            email="john@example.com"
        )
        registry.create_profile(
            user_id="user_2",
            display_name="Jane Smith",
            title="Engineer"
        )

        results = registry.search_profiles("john")
        assert len(results) == 1

        results = registry.search_profiles("engineer")
        assert len(results) == 1

    # Skill tests
    def test_add_skill(self, registry):
        """Test adding a skill."""
        registry.create_profile(user_id="user_1")

        skill = registry.add_skill("user_1", "Python", "Programming", SkillLevel.ADVANCED)

        assert skill is not None
        assert skill.name == "Python"
        assert skill.level == SkillLevel.ADVANCED

    def test_get_user_skills(self, registry):
        """Test getting user's skills."""
        registry.create_profile(user_id="user_1")
        registry.add_skill("user_1", "Python")
        registry.add_skill("user_1", "JavaScript")

        skills = registry.get_user_skills("user_1")
        assert len(skills) == 2

    def test_endorse_skill(self, registry):
        """Test endorsing a skill."""
        registry.create_profile(user_id="user_1")
        skill = registry.add_skill("user_1", "Python")

        assert registry.endorse_skill(skill.id, "endorser_1") is True

        retrieved = registry.get_skill(skill.id)
        assert retrieved.endorsement_count == 1

    def test_find_users_by_skill(self, registry):
        """Test finding users by skill."""
        registry.create_profile(user_id="user_1")
        registry.create_profile(user_id="user_2")
        registry.add_skill("user_1", "Python")
        registry.add_skill("user_2", "python")  # Different case

        users = registry.find_users_by_skill("python")
        assert len(users) == 2

    def test_delete_skill(self, registry):
        """Test deleting a skill."""
        registry.create_profile(user_id="user_1")
        skill = registry.add_skill("user_1", "Python")

        assert registry.delete_skill(skill.id) is True
        assert registry.get_skill(skill.id) is None

    # Badge tests
    def test_award_badge(self, registry):
        """Test awarding a badge."""
        registry.create_profile(user_id="user_1")

        badge = registry.award_badge(
            "user_1",
            BadgeType.VERIFIED,
            "Verified User",
            description="Email verified"
        )

        assert badge is not None
        assert badge.type == BadgeType.VERIFIED

    def test_get_user_badges(self, registry):
        """Test getting user's badges."""
        registry.create_profile(user_id="user_1")
        registry.award_badge("user_1", BadgeType.VERIFIED, "Verified")
        registry.award_badge("user_1", BadgeType.EMPLOYEE, "Employee")

        badges = registry.get_user_badges("user_1")
        assert len(badges) == 2

    def test_has_badge(self, registry):
        """Test checking if user has badge."""
        registry.create_profile(user_id="user_1")
        registry.award_badge("user_1", BadgeType.VERIFIED, "Verified")

        assert registry.has_badge("user_1", BadgeType.VERIFIED) is True
        assert registry.has_badge("user_1", BadgeType.ADMIN) is False

    def test_delete_badge(self, registry):
        """Test deleting a badge."""
        registry.create_profile(user_id="user_1")
        badge = registry.award_badge("user_1", BadgeType.VERIFIED, "Verified")

        assert registry.delete_badge(badge.id) is True
        assert registry.get_badge(badge.id) is None

    # Presence tests
    def test_update_presence(self, registry):
        """Test updating presence."""
        registry.create_profile(user_id="user_1")

        presence = registry.update_presence(
            "user_1",
            PresenceStatus.BUSY,
            "In meeting",
            ":calendar:"
        )

        assert presence is not None
        assert presence.status == PresenceStatus.BUSY
        assert presence.status_text == "In meeting"

    def test_get_online_users(self, registry):
        """Test getting online users."""
        registry.create_profile(user_id="user_1", workspace_id="ws_1")
        registry.create_profile(user_id="user_2", workspace_id="ws_1")
        registry.create_profile(user_id="user_3", workspace_id="ws_1")

        registry.update_presence("user_1", PresenceStatus.ONLINE)
        registry.update_presence("user_2", PresenceStatus.BUSY)
        registry.update_presence("user_3", PresenceStatus.OFFLINE)

        online = registry.get_online_users(workspace_id="ws_1")
        assert len(online) == 2

    # Availability tests
    def test_add_availability_block(self, registry):
        """Test adding availability block."""
        registry.create_profile(user_id="user_1")

        block = registry.add_availability_block(
            "user_1",
            AvailabilityType.OUT_OF_OFFICE,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(days=7),
            title="Vacation"
        )

        assert block is not None
        assert block.type == AvailabilityType.OUT_OF_OFFICE

    def test_get_user_availability(self, registry):
        """Test getting user availability."""
        registry.create_profile(user_id="user_1")
        registry.add_availability_block(
            "user_1",
            AvailabilityType.MEETING,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(hours=1)
        )

        blocks = registry.get_user_availability("user_1")
        assert len(blocks) == 1

    def test_get_current_availability(self, registry):
        """Test getting current availability."""
        registry.create_profile(user_id="user_1")
        registry.add_availability_block(
            "user_1",
            AvailabilityType.BUSY,
            datetime.utcnow() - timedelta(minutes=30),
            datetime.utcnow() + timedelta(minutes=30)
        )

        current = registry.get_current_availability("user_1")
        assert current is not None
        assert current.type == AvailabilityType.BUSY

    # Relationship tests
    def test_add_relationship(self, registry):
        """Test adding organizational relationship."""
        registry.create_profile(user_id="user_1")
        registry.create_profile(user_id="manager_1")

        rel = registry.add_relationship(
            "user_1",
            "manager_1",
            RelationshipType.REPORTS_TO
        )

        assert rel is not None
        assert rel.type == RelationshipType.REPORTS_TO

        # Profile should have manager set
        profile = registry.get_profile_by_user("user_1")
        assert profile.manager_id == "manager_1"

    def test_get_direct_reports(self, registry):
        """Test getting direct reports."""
        registry.create_profile(user_id="manager_1")
        registry.create_profile(user_id="user_1")
        registry.create_profile(user_id="user_2")

        registry.add_relationship("user_1", "manager_1", RelationshipType.REPORTS_TO)
        registry.add_relationship("user_2", "manager_1", RelationshipType.REPORTS_TO)

        reports = registry.get_direct_reports("manager_1")
        assert len(reports) == 2

    def test_get_manager(self, registry):
        """Test getting user's manager."""
        registry.create_profile(user_id="user_1")
        registry.create_profile(user_id="manager_1")
        registry.add_relationship("user_1", "manager_1", RelationshipType.REPORTS_TO)

        manager_id = registry.get_manager("user_1")
        assert manager_id == "manager_1"

    def test_get_org_chart(self, registry):
        """Test getting organization chart."""
        registry.create_profile(user_id="ceo", display_name="CEO", title="CEO")
        registry.create_profile(user_id="vp1", display_name="VP Engineering", title="VP Engineering")
        registry.create_profile(user_id="eng1", display_name="Engineer", title="Engineer")

        registry.add_relationship("vp1", "ceo", RelationshipType.REPORTS_TO)
        registry.add_relationship("eng1", "vp1", RelationshipType.REPORTS_TO)

        chart = registry.get_org_chart("ceo")

        assert chart["user_id"] == "ceo"
        assert len(chart["children"]) == 1
        assert chart["children"][0]["user_id"] == "vp1"
        assert len(chart["children"][0]["children"]) == 1


# ==================== ProfileManager Tests ====================

class TestProfileManager:
    """Tests for ProfileManager."""

    def test_create_profile(self, manager):
        """Test creating a profile."""
        profile = manager.create_profile(
            user_id="user_1",
            display_name="John Doe",
            email="john@example.com"
        )

        assert profile.display_name == "John Doe"
        assert profile.email == "john@example.com"

    def test_get_profile(self, manager, sample_profile):
        """Test getting a profile."""
        retrieved = manager.get_profile(sample_profile.id)
        assert retrieved is not None
        assert retrieved.user_id == sample_profile.user_id

    def test_get_profile_by_user(self, manager, sample_profile):
        """Test getting profile by user ID."""
        retrieved = manager.get_profile_by_user("user_1")
        assert retrieved is not None
        assert retrieved.id == sample_profile.id

    def test_update_profile(self, manager, sample_profile):
        """Test updating a profile."""
        updated = manager.update_profile(
            "user_1",
            display_name="Jane Doe",
            title="Senior Engineer",
            location="San Francisco"
        )

        assert updated is not None
        assert updated.display_name == "Jane Doe"
        assert updated.title == "Senior Engineer"
        assert updated.location == "San Francisco"

    def test_delete_profile(self, manager, sample_profile):
        """Test deleting a profile."""
        assert manager.delete_profile("user_1") is True
        assert manager.get_profile_by_user("user_1") is None

    def test_verify_profile(self, manager, sample_profile):
        """Test verifying a profile."""
        verified = manager.verify_profile("user_1")

        assert verified is not None
        assert verified.is_verified is True

    def test_list_profiles(self, manager):
        """Test listing profiles."""
        manager.create_profile(user_id="user_1", workspace_id="ws_1")
        manager.create_profile(user_id="user_2", workspace_id="ws_1")

        profiles = manager.list_profiles(workspace_id="ws_1")
        assert len(profiles) == 2

    def test_search_profiles(self, manager):
        """Test searching profiles."""
        manager.create_profile(user_id="user_1", display_name="John Doe")
        manager.create_profile(user_id="user_2", display_name="Jane Smith")

        results = manager.search_profiles("john")
        assert len(results) == 1

    # Skill operations
    def test_add_skill(self, manager, sample_profile):
        """Test adding a skill."""
        skill = manager.add_skill(
            "user_1",
            "Python",
            "Programming",
            SkillLevel.ADVANCED,
            years_experience=5.0
        )

        assert skill is not None
        assert skill.name == "Python"
        assert skill.years_experience == 5.0

    def test_update_skill(self, manager, sample_profile):
        """Test updating a skill."""
        skill = manager.add_skill("user_1", "Python")

        updated = manager.update_skill(
            skill.id,
            level=SkillLevel.EXPERT,
            years_experience=7.0
        )

        assert updated is not None
        assert updated.level == SkillLevel.EXPERT
        assert updated.years_experience == 7.0

    def test_remove_skill(self, manager, sample_profile):
        """Test removing a skill."""
        skill = manager.add_skill("user_1", "Python")

        assert manager.remove_skill(skill.id) is True

    def test_get_user_skills(self, manager, sample_profile):
        """Test getting user's skills."""
        manager.add_skill("user_1", "Python")
        manager.add_skill("user_1", "JavaScript")

        skills = manager.get_user_skills("user_1")
        assert len(skills) == 2

    def test_endorse_skill(self, manager, sample_profile):
        """Test endorsing a skill."""
        skill = manager.add_skill("user_1", "Python")

        assert manager.endorse_skill(skill.id, "endorser_1") is True

    def test_find_users_by_skill(self, manager):
        """Test finding users by skill."""
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="user_2")
        manager.add_skill("user_1", "Python")
        manager.add_skill("user_2", "Python")

        profiles = manager.find_users_by_skill("python")
        assert len(profiles) == 2

    # Badge operations
    def test_award_badge(self, manager, sample_profile):
        """Test awarding a badge."""
        badge = manager.award_badge(
            "user_1",
            BadgeType.TOP_CONTRIBUTOR,
            "Top Contributor",
            description="Made significant contributions"
        )

        assert badge is not None
        assert badge.type == BadgeType.TOP_CONTRIBUTOR

    def test_revoke_badge(self, manager, sample_profile):
        """Test revoking a badge."""
        badge = manager.award_badge("user_1", BadgeType.VERIFIED, "Verified")

        assert manager.revoke_badge(badge.id) is True

    def test_get_user_badges(self, manager, sample_profile):
        """Test getting user's badges."""
        manager.award_badge("user_1", BadgeType.VERIFIED, "Verified")
        manager.award_badge("user_1", BadgeType.EMPLOYEE, "Employee")

        badges = manager.get_user_badges("user_1")
        assert len(badges) == 2

    def test_has_badge(self, manager, sample_profile):
        """Test checking if user has badge."""
        manager.award_badge("user_1", BadgeType.VERIFIED, "Verified")

        assert manager.has_badge("user_1", BadgeType.VERIFIED) is True
        assert manager.has_badge("user_1", BadgeType.ADMIN) is False

    # Presence operations
    def test_set_presence(self, manager, sample_profile):
        """Test setting presence."""
        presence = manager.set_presence(
            "user_1",
            PresenceStatus.BUSY,
            "In meeting",
            ":calendar:"
        )

        assert presence is not None
        assert presence.status == PresenceStatus.BUSY

    def test_get_presence(self, manager, sample_profile):
        """Test getting presence."""
        manager.set_presence("user_1", PresenceStatus.ONLINE)

        presence = manager.get_presence("user_1")
        assert presence is not None
        assert presence.status == PresenceStatus.ONLINE

    def test_clear_status(self, manager, sample_profile):
        """Test clearing status."""
        manager.set_presence("user_1", PresenceStatus.BUSY, "Working")

        assert manager.clear_status("user_1") is True

        presence = manager.get_presence("user_1")
        assert presence.status_text == ""

    def test_update_activity(self, manager, sample_profile):
        """Test updating activity."""
        manager.update_activity("user_1")

        profile = manager.get_profile_by_user("user_1")
        assert profile.last_active_at is not None

    def test_get_online_users(self, manager):
        """Test getting online users."""
        manager.create_profile(user_id="user_1", workspace_id="ws_1")
        manager.create_profile(user_id="user_2", workspace_id="ws_1")

        manager.set_presence("user_1", PresenceStatus.ONLINE)
        manager.set_presence("user_2", PresenceStatus.OFFLINE)

        online = manager.get_online_users(workspace_id="ws_1")
        assert len(online) == 1

    # Availability operations
    def test_set_availability(self, manager, sample_profile):
        """Test setting availability."""
        block = manager.set_availability(
            "user_1",
            AvailabilityType.OUT_OF_OFFICE,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(days=7),
            title="Vacation"
        )

        assert block is not None
        assert block.type == AvailabilityType.OUT_OF_OFFICE

    def test_remove_availability(self, manager, sample_profile):
        """Test removing availability."""
        block = manager.set_availability(
            "user_1",
            AvailabilityType.MEETING,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(hours=1)
        )

        assert manager.remove_availability(block.id) is True

    def test_get_availability(self, manager, sample_profile):
        """Test getting availability."""
        manager.set_availability(
            "user_1",
            AvailabilityType.MEETING,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(hours=1)
        )

        blocks = manager.get_availability("user_1")
        assert len(blocks) == 1

    def test_is_available(self, manager, sample_profile):
        """Test checking availability."""
        # Default is available
        assert manager.is_available("user_1") is True

        # Set as busy
        manager.set_availability(
            "user_1",
            AvailabilityType.BUSY,
            datetime.utcnow() - timedelta(minutes=30),
            datetime.utcnow() + timedelta(minutes=30)
        )

        assert manager.is_available("user_1") is False

    # Organization operations
    def test_set_manager(self, manager):
        """Test setting manager."""
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="manager_1")

        rel = manager.set_manager("user_1", "manager_1")

        assert rel is not None

        profile = manager.get_profile_by_user("user_1")
        assert profile.manager_id == "manager_1"

    def test_remove_manager(self, manager):
        """Test removing manager."""
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="manager_1")
        manager.set_manager("user_1", "manager_1")

        assert manager.remove_manager("user_1") is True

        profile = manager.get_profile_by_user("user_1")
        assert profile.manager_id is None

    def test_get_manager(self, manager):
        """Test getting manager profile."""
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="manager_1", display_name="Boss")
        manager.set_manager("user_1", "manager_1")

        mgr = manager.get_manager("user_1")
        assert mgr is not None
        assert mgr.display_name == "Boss"

    def test_get_direct_reports(self, manager):
        """Test getting direct reports."""
        manager.create_profile(user_id="manager_1")
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="user_2")

        manager.set_manager("user_1", "manager_1")
        manager.set_manager("user_2", "manager_1")

        reports = manager.get_direct_reports("manager_1")
        assert len(reports) == 2

    def test_get_org_chart(self, manager):
        """Test getting org chart."""
        manager.create_profile(user_id="ceo", display_name="CEO")
        manager.create_profile(user_id="vp", display_name="VP")
        manager.set_manager("vp", "ceo")

        chart = manager.get_org_chart("ceo")

        assert chart["user_id"] == "ceo"
        assert len(chart["children"]) == 1

    # Directory operations
    def test_get_directory(self, manager):
        """Test getting directory."""
        manager.create_profile(
            user_id="user_1",
            display_name="John Doe",
            workspace_id="ws_1",
            department="Engineering"
        )
        manager.create_profile(
            user_id="user_2",
            display_name="Jane Smith",
            workspace_id="ws_1",
            department="Marketing"
        )

        directory = manager.get_directory("ws_1")
        assert len(directory) == 2

        eng_directory = manager.get_directory("ws_1", department="Engineering")
        assert len(eng_directory) == 1

    def test_get_departments(self, manager):
        """Test getting departments."""
        manager.create_profile(user_id="u1", workspace_id="ws_1", department="Engineering")
        manager.create_profile(user_id="u2", workspace_id="ws_1", department="Marketing")
        manager.create_profile(user_id="u3", workspace_id="ws_1", department="Engineering")

        departments = manager.get_departments("ws_1")

        assert len(departments) == 2
        assert "Engineering" in departments
        assert "Marketing" in departments

    def test_get_stats(self, manager):
        """Test getting stats."""
        manager.create_profile(user_id="u1", workspace_id="ws_1", department="Eng")
        manager.create_profile(user_id="u2", workspace_id="ws_1", department="Eng")
        p3 = manager.create_profile(user_id="u3", workspace_id="ws_1", department="Mkt")

        manager.add_skill("u1", "Python")
        manager.verify_profile("u1")
        p3.verify()
        manager.registry.update_profile(p3)

        stats = manager.get_stats(workspace_id="ws_1")

        assert stats["total_profiles"] == 3
        assert stats["verified_profiles"] == 2
        assert stats["profiles_with_skills"] == 1
        assert stats["by_department"]["Eng"] == 2


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global instance management."""

    def test_set_and_get_profile_manager(self):
        """Test setting and getting global profile manager."""
        reset_profile_manager()

        assert get_profile_manager() is None

        manager = ProfileManager()
        set_profile_manager(manager)

        assert get_profile_manager() is manager

        reset_profile_manager()
        assert get_profile_manager() is None


# ==================== Integration Tests ====================

class TestProfileWorkflows:
    """Integration tests for profile workflows."""

    def test_complete_profile_setup(self, manager):
        """Test complete profile setup workflow."""
        # Create profile
        profile = manager.create_profile(
            user_id="new_user",
            display_name="New Employee",
            email="new@company.com",
            workspace_id="ws_1"
        )

        # Update profile details
        manager.update_profile(
            "new_user",
            first_name="John",
            last_name="Doe",
            title="Software Engineer",
            department="Engineering",
            location="San Francisco",
            timezone="America/Los_Angeles"
        )

        # Add skills
        manager.add_skill("new_user", "Python", "Programming", SkillLevel.ADVANCED)
        manager.add_skill("new_user", "JavaScript", "Programming", SkillLevel.INTERMEDIATE)
        manager.add_skill("new_user", "Docker", "DevOps", SkillLevel.BEGINNER)

        # Set manager
        manager.create_profile(user_id="mgr", display_name="Manager")
        manager.set_manager("new_user", "mgr")

        # Verify profile
        manager.verify_profile("new_user")

        # Award badges
        manager.award_badge("new_user", BadgeType.EMPLOYEE, "Employee")
        manager.award_badge("new_user", BadgeType.VERIFIED, "Verified")

        # Set presence
        manager.set_presence("new_user", PresenceStatus.ONLINE)

        # Verify setup
        profile = manager.get_profile_by_user("new_user")
        assert profile.is_verified is True
        assert profile.manager_id == "mgr"

        skills = manager.get_user_skills("new_user")
        assert len(skills) == 3

        badges = manager.get_user_badges("new_user")
        assert len(badges) == 2

    def test_skill_endorsement_workflow(self, manager):
        """Test skill endorsement workflow."""
        # Create profiles
        manager.create_profile(user_id="user_1")
        manager.create_profile(user_id="user_2")
        manager.create_profile(user_id="user_3")

        # Add skill
        skill = manager.add_skill("user_1", "Python", "Programming", SkillLevel.ADVANCED)

        # Endorsements
        manager.endorse_skill(skill.id, "user_2")
        manager.endorse_skill(skill.id, "user_3")

        # Verify
        skills = manager.get_user_skills("user_1")
        assert skills[0].endorsement_count == 2

        # Find users with skill
        python_users = manager.find_users_by_skill("python")
        assert len(python_users) == 1

    def test_organizational_structure(self, manager):
        """Test organizational structure."""
        # Create org structure
        manager.create_profile(
            user_id="ceo",
            display_name="CEO",
            title="Chief Executive Officer",
            workspace_id="ws_1"
        )
        manager.create_profile(
            user_id="cto",
            display_name="CTO",
            title="Chief Technology Officer",
            workspace_id="ws_1"
        )
        manager.create_profile(
            user_id="eng_lead",
            display_name="Engineering Lead",
            title="Engineering Lead",
            workspace_id="ws_1"
        )
        manager.create_profile(
            user_id="dev_1",
            display_name="Developer 1",
            title="Software Engineer",
            workspace_id="ws_1"
        )
        manager.create_profile(
            user_id="dev_2",
            display_name="Developer 2",
            title="Software Engineer",
            workspace_id="ws_1"
        )

        # Set relationships
        manager.set_manager("cto", "ceo")
        manager.set_manager("eng_lead", "cto")
        manager.set_manager("dev_1", "eng_lead")
        manager.set_manager("dev_2", "eng_lead")

        # Test org chart
        chart = manager.get_org_chart("ceo")

        assert chart["user_id"] == "ceo"
        assert len(chart["children"]) == 1  # CTO
        assert len(chart["children"][0]["children"]) == 1  # Eng Lead
        assert len(chart["children"][0]["children"][0]["children"]) == 2  # Devs

        # Test direct reports
        cto_reports = manager.get_direct_reports("cto")
        assert len(cto_reports) == 1

        lead_reports = manager.get_direct_reports("eng_lead")
        assert len(lead_reports) == 2

    def test_presence_and_availability(self, manager):
        """Test presence and availability workflow."""
        manager.create_profile(user_id="user_1", workspace_id="ws_1")

        # Set online
        manager.set_presence("user_1", PresenceStatus.ONLINE)

        # Set in meeting
        manager.set_availability(
            "user_1",
            AvailabilityType.MEETING,
            datetime.utcnow() - timedelta(minutes=15),
            datetime.utcnow() + timedelta(minutes=45),
            title="Team standup"
        )

        # Check availability
        assert manager.is_available("user_1") is False

        current = manager.get_current_availability("user_1")
        assert current is not None
        assert current.type == AvailabilityType.MEETING
        assert current.title == "Team standup"

        # User is online but in meeting
        presence = manager.get_presence("user_1")
        assert presence.status == PresenceStatus.ONLINE

        online = manager.get_online_users("ws_1")
        assert "user_1" in online
