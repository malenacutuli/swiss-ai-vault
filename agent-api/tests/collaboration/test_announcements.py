"""
Tests for the Announcements & News module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.announcements import (
    AnnouncementManager,
    AnnouncementRegistry,
    Announcement,
    AnnouncementType,
    AnnouncementStatus,
    AnnouncementPriority,
    NewsItem,
    NewsCategory,
    AudienceTarget,
    AudienceType,
    AnnouncementSchedule,
    Reaction,
    ReactionType,
    Acknowledgment,
    AcknowledgmentType,
    ReadReceipt,
    AnnouncementAttachment,
    AnnouncementComment,
    AnnouncementAnalytics,
    get_announcement_manager,
    set_announcement_manager,
    reset_announcement_manager,
)


# ============== Enum Tests ==============

class TestAnnouncementType:
    """Tests for AnnouncementType enum."""

    def test_all_types_exist(self):
        """Test all announcement types are defined."""
        assert AnnouncementType.GENERAL.value == "general"
        assert AnnouncementType.URGENT.value == "urgent"
        assert AnnouncementType.POLICY.value == "policy"
        assert AnnouncementType.EVENT.value == "event"
        assert AnnouncementType.MAINTENANCE.value == "maintenance"
        assert AnnouncementType.SECURITY.value == "security"
        assert AnnouncementType.HR.value == "hr"
        assert AnnouncementType.PRODUCT.value == "product"
        assert AnnouncementType.CELEBRATION.value == "celebration"
        assert AnnouncementType.REMINDER.value == "reminder"


class TestAnnouncementStatus:
    """Tests for AnnouncementStatus enum."""

    def test_all_statuses_exist(self):
        """Test all announcement statuses are defined."""
        assert AnnouncementStatus.DRAFT.value == "draft"
        assert AnnouncementStatus.SCHEDULED.value == "scheduled"
        assert AnnouncementStatus.PUBLISHED.value == "published"
        assert AnnouncementStatus.ARCHIVED.value == "archived"
        assert AnnouncementStatus.EXPIRED.value == "expired"
        assert AnnouncementStatus.CANCELLED.value == "cancelled"


class TestAnnouncementPriority:
    """Tests for AnnouncementPriority enum."""

    def test_all_priorities_exist(self):
        """Test all priority levels are defined."""
        assert AnnouncementPriority.LOW.value == "low"
        assert AnnouncementPriority.NORMAL.value == "normal"
        assert AnnouncementPriority.HIGH.value == "high"
        assert AnnouncementPriority.CRITICAL.value == "critical"


class TestNewsCategory:
    """Tests for NewsCategory enum."""

    def test_all_categories_exist(self):
        """Test all news categories are defined."""
        assert NewsCategory.COMPANY.value == "company"
        assert NewsCategory.INDUSTRY.value == "industry"
        assert NewsCategory.PRODUCT.value == "product"
        assert NewsCategory.TEAM.value == "team"
        assert NewsCategory.TECHNOLOGY.value == "technology"


class TestReactionType:
    """Tests for ReactionType enum."""

    def test_all_reaction_types_exist(self):
        """Test all reaction types are defined."""
        assert ReactionType.LIKE.value == "like"
        assert ReactionType.LOVE.value == "love"
        assert ReactionType.CELEBRATE.value == "celebrate"
        assert ReactionType.SUPPORT.value == "support"
        assert ReactionType.INSIGHTFUL.value == "insightful"
        assert ReactionType.CURIOUS.value == "curious"


# ============== AudienceTarget Tests ==============

class TestAudienceTarget:
    """Tests for AudienceTarget class."""

    def test_create_audience_target(self):
        """Test creating an audience target."""
        target = AudienceTarget(
            audience_type=AudienceType.TEAM,
            target_ids=["team-1", "team-2"]
        )
        assert target.audience_type == AudienceType.TEAM
        assert target.target_ids == ["team-1", "team-2"]
        assert target.include_children is True

    def test_matches_all_users(self):
        """Test ALL audience type matches everyone."""
        target = AudienceTarget(audience_type=AudienceType.ALL)
        assert target.matches_user("user-1") is True
        assert target.matches_user("user-2") is True

    def test_matches_specific_user(self):
        """Test USER audience type matches specific users."""
        target = AudienceTarget(
            audience_type=AudienceType.USER,
            target_ids=["user-1", "user-2"]
        )
        assert target.matches_user("user-1") is True
        assert target.matches_user("user-3") is False

    def test_matches_team(self):
        """Test TEAM audience type matches users in teams."""
        target = AudienceTarget(
            audience_type=AudienceType.TEAM,
            target_ids=["team-1"]
        )
        assert target.matches_user("user-1", user_teams=["team-1"]) is True
        assert target.matches_user("user-2", user_teams=["team-2"]) is False
        assert target.matches_user("user-3") is False

    def test_matches_role(self):
        """Test ROLE audience type matches users with roles."""
        target = AudienceTarget(
            audience_type=AudienceType.ROLE,
            target_ids=["admin", "manager"]
        )
        assert target.matches_user("user-1", user_roles=["admin"]) is True
        assert target.matches_user("user-2", user_roles=["developer"]) is False

    def test_matches_location(self):
        """Test LOCATION audience type matches users in locations."""
        target = AudienceTarget(
            audience_type=AudienceType.LOCATION,
            target_ids=["office-nyc"]
        )
        assert target.matches_user("user-1", user_location="office-nyc") is True
        assert target.matches_user("user-2", user_location="office-sf") is False

    def test_matches_group(self):
        """Test GROUP audience type matches users in groups."""
        target = AudienceTarget(
            audience_type=AudienceType.GROUP,
            target_ids=["group-a"]
        )
        assert target.matches_user("user-1", user_groups=["group-a"]) is True
        assert target.matches_user("user-2", user_groups=["group-b"]) is False

    def test_excludes_users(self):
        """Test excluded users don't match."""
        target = AudienceTarget(
            audience_type=AudienceType.ALL,
            exclude_ids=["user-blocked"]
        )
        assert target.matches_user("user-1") is True
        assert target.matches_user("user-blocked") is False


# ============== AnnouncementSchedule Tests ==============

class TestAnnouncementSchedule:
    """Tests for AnnouncementSchedule class."""

    def test_create_schedule(self):
        """Test creating a schedule."""
        publish_at = datetime.now() + timedelta(days=1)
        schedule = AnnouncementSchedule(
            publish_at=publish_at,
            expire_at=publish_at + timedelta(days=7)
        )
        assert schedule.publish_at == publish_at
        assert schedule.timezone == "UTC"

    def test_is_active_before_publish(self):
        """Test schedule is not active before publish time."""
        schedule = AnnouncementSchedule(
            publish_at=datetime.now() + timedelta(hours=1)
        )
        assert schedule.is_active() is False

    def test_is_active_after_publish(self):
        """Test schedule is active after publish time."""
        schedule = AnnouncementSchedule(
            publish_at=datetime.now() - timedelta(hours=1)
        )
        assert schedule.is_active() is True

    def test_is_active_after_expire(self):
        """Test schedule is not active after expiration."""
        schedule = AnnouncementSchedule(
            publish_at=datetime.now() - timedelta(days=2),
            expire_at=datetime.now() - timedelta(days=1)
        )
        assert schedule.is_active() is False

    def test_should_publish(self):
        """Test should_publish check."""
        past = AnnouncementSchedule(publish_at=datetime.now() - timedelta(hours=1))
        future = AnnouncementSchedule(publish_at=datetime.now() + timedelta(hours=1))

        assert past.should_publish() is True
        assert future.should_publish() is False

    def test_is_expired(self):
        """Test is_expired check."""
        not_expired = AnnouncementSchedule(expire_at=datetime.now() + timedelta(days=1))
        expired = AnnouncementSchedule(expire_at=datetime.now() - timedelta(days=1))
        no_expiry = AnnouncementSchedule()

        assert not_expired.is_expired() is False
        assert expired.is_expired() is True
        assert no_expiry.is_expired() is False


# ============== Announcement Tests ==============

class TestAnnouncement:
    """Tests for Announcement class."""

    def test_create_announcement(self):
        """Test creating an announcement."""
        announcement = Announcement(
            title="Test Announcement",
            content="This is test content",
            author_id="author-1",
            organization_id="org-1"
        )
        assert announcement.title == "Test Announcement"
        assert announcement.status == AnnouncementStatus.DRAFT
        assert announcement.priority == AnnouncementPriority.NORMAL

    def test_publish_announcement(self):
        """Test publishing an announcement."""
        announcement = Announcement(title="Test", content="Content")
        announcement.publish()

        assert announcement.status == AnnouncementStatus.PUBLISHED
        assert announcement.published_at is not None

    def test_archive_announcement(self):
        """Test archiving an announcement."""
        announcement = Announcement(title="Test", content="Content")
        announcement.publish()
        announcement.archive()

        assert announcement.status == AnnouncementStatus.ARCHIVED
        assert announcement.archived_at is not None

    def test_cancel_announcement(self):
        """Test cancelling an announcement."""
        announcement = Announcement(title="Test", content="Content")
        announcement.cancel()

        assert announcement.status == AnnouncementStatus.CANCELLED

    def test_is_visible_to_user_not_published(self):
        """Test draft announcement is not visible."""
        announcement = Announcement(title="Test", content="Content")
        assert announcement.is_visible_to_user("user-1") is False

    def test_is_visible_to_user_published(self):
        """Test published announcement is visible."""
        announcement = Announcement(title="Test", content="Content")
        announcement.publish()
        assert announcement.is_visible_to_user("user-1") is True

    def test_is_visible_with_audience_target(self):
        """Test visibility with audience targeting."""
        announcement = Announcement(
            title="Test",
            content="Content",
            audience=AudienceTarget(
                audience_type=AudienceType.TEAM,
                target_ids=["team-1"]
            )
        )
        announcement.publish()

        assert announcement.is_visible_to_user("user-1", user_teams=["team-1"]) is True
        assert announcement.is_visible_to_user("user-2", user_teams=["team-2"]) is False

    def test_increment_view(self):
        """Test incrementing view count."""
        announcement = Announcement(title="Test", content="Content")
        assert announcement.view_count == 0
        announcement.increment_view()
        assert announcement.view_count == 1

    def test_add_remove_reaction(self):
        """Test adding and removing reactions."""
        announcement = Announcement(title="Test", content="Content")
        assert announcement.reaction_count == 0

        announcement.add_reaction()
        assert announcement.reaction_count == 1

        announcement.remove_reaction()
        assert announcement.reaction_count == 0

        # Doesn't go negative
        announcement.remove_reaction()
        assert announcement.reaction_count == 0


# ============== NewsItem Tests ==============

class TestNewsItem:
    """Tests for NewsItem class."""

    def test_create_news_item(self):
        """Test creating a news item."""
        news = NewsItem(
            title="Test News",
            content="News content here",
            author_id="author-1",
            organization_id="org-1",
            category=NewsCategory.COMPANY
        )
        assert news.title == "Test News"
        assert news.category == NewsCategory.COMPANY
        assert news.status == AnnouncementStatus.DRAFT

    def test_publish_news(self):
        """Test publishing news."""
        news = NewsItem(title="Test News", content="Content")
        news.publish()

        assert news.status == AnnouncementStatus.PUBLISHED
        assert news.published_at is not None

    def test_generate_slug(self):
        """Test slug generation."""
        news = NewsItem(title="This is a Test News Article!", content="Content")
        slug = news.generate_slug()

        assert slug == "this-is-a-test-news-article"
        assert news.slug == slug

    def test_generate_slug_special_chars(self):
        """Test slug generation with special characters."""
        news = NewsItem(title="What's New? 2024 Updates!", content="Content")
        slug = news.generate_slug()

        assert "'" not in slug
        assert "?" not in slug
        assert "!" not in slug


# ============== Reaction Tests ==============

class TestReaction:
    """Tests for Reaction class."""

    def test_create_reaction(self):
        """Test creating a reaction."""
        reaction = Reaction(
            user_id="user-1",
            target_id="announcement-1",
            reaction_type=ReactionType.LIKE,
            target_type="announcement"
        )
        assert reaction.user_id == "user-1"
        assert reaction.reaction_type == ReactionType.LIKE


# ============== Acknowledgment Tests ==============

class TestAcknowledgment:
    """Tests for Acknowledgment class."""

    def test_create_acknowledgment(self):
        """Test creating an acknowledgment."""
        ack = Acknowledgment(
            user_id="user-1",
            announcement_id="announcement-1",
            acknowledgment_type=AcknowledgmentType.ACKNOWLEDGED
        )
        assert ack.user_id == "user-1"
        assert ack.acknowledgment_type == AcknowledgmentType.ACKNOWLEDGED

    def test_acknowledgment_with_signature(self):
        """Test acknowledgment with signature."""
        ack = Acknowledgment(
            user_id="user-1",
            announcement_id="announcement-1",
            acknowledgment_type=AcknowledgmentType.SIGNED,
            signature="John Doe"
        )
        assert ack.signature == "John Doe"


# ============== AnnouncementRegistry Tests ==============

class TestAnnouncementRegistry:
    """Tests for AnnouncementRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return AnnouncementRegistry()

    # Announcement CRUD
    def test_create_announcement(self, registry):
        """Test creating an announcement in registry."""
        announcement = Announcement(
            title="Test",
            content="Content",
            organization_id="org-1"
        )
        created = registry.create_announcement(announcement)
        assert created.id == announcement.id

    def test_get_announcement(self, registry):
        """Test getting an announcement."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        retrieved = registry.get_announcement(announcement.id)
        assert retrieved is not None
        assert retrieved.title == "Test"

    def test_get_announcement_not_found(self, registry):
        """Test getting non-existent announcement."""
        assert registry.get_announcement("nonexistent") is None

    def test_update_announcement(self, registry):
        """Test updating an announcement."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        announcement.title = "Updated Title"
        updated = registry.update_announcement(announcement)
        assert updated.title == "Updated Title"

    def test_delete_announcement(self, registry):
        """Test deleting an announcement."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        assert registry.delete_announcement(announcement.id) is True
        assert registry.get_announcement(announcement.id) is None

    def test_delete_announcement_not_found(self, registry):
        """Test deleting non-existent announcement."""
        assert registry.delete_announcement("nonexistent") is False

    def test_list_announcements(self, registry):
        """Test listing announcements."""
        a1 = Announcement(title="A1", content="C1", organization_id="org-1")
        a2 = Announcement(title="A2", content="C2", organization_id="org-1")
        a3 = Announcement(title="A3", content="C3", organization_id="org-2")

        registry.create_announcement(a1)
        registry.create_announcement(a2)
        registry.create_announcement(a3)

        all_announcements = registry.list_announcements()
        assert len(all_announcements) == 3

        org1_announcements = registry.list_announcements(organization_id="org-1")
        assert len(org1_announcements) == 2

    def test_list_announcements_by_status(self, registry):
        """Test listing announcements by status."""
        a1 = Announcement(title="Draft", content="C1")
        a2 = Announcement(title="Published", content="C2")
        a2.publish()

        registry.create_announcement(a1)
        registry.create_announcement(a2)

        drafts = registry.list_announcements(status=AnnouncementStatus.DRAFT)
        assert len(drafts) == 1
        assert drafts[0].title == "Draft"

    def test_list_announcements_pinned_only(self, registry):
        """Test listing pinned announcements."""
        a1 = Announcement(title="Pinned", content="C1", pinned=True)
        a2 = Announcement(title="Not Pinned", content="C2", pinned=False)

        registry.create_announcement(a1)
        registry.create_announcement(a2)

        pinned = registry.list_announcements(pinned_only=True)
        assert len(pinned) == 1
        assert pinned[0].title == "Pinned"

    def test_get_announcements_for_user(self, registry):
        """Test getting announcements for specific user."""
        a1 = Announcement(
            title="For Team 1",
            content="C1",
            audience=AudienceTarget(
                audience_type=AudienceType.TEAM,
                target_ids=["team-1"]
            )
        )
        a1.publish()

        a2 = Announcement(title="For All", content="C2")
        a2.publish()

        registry.create_announcement(a1)
        registry.create_announcement(a2)

        team1_user = registry.get_announcements_for_user("user-1", user_teams=["team-1"])
        assert len(team1_user) == 2

        team2_user = registry.get_announcements_for_user("user-2", user_teams=["team-2"])
        assert len(team2_user) == 1

    # News CRUD
    def test_create_news(self, registry):
        """Test creating news in registry."""
        news = NewsItem(title="Test News", content="Content")
        created = registry.create_news(news)
        assert created.id == news.id

    def test_get_news(self, registry):
        """Test getting news."""
        news = NewsItem(title="Test News", content="Content")
        registry.create_news(news)

        retrieved = registry.get_news(news.id)
        assert retrieved is not None
        assert retrieved.title == "Test News"

    def test_get_news_by_slug(self, registry):
        """Test getting news by slug."""
        news = NewsItem(title="Test News", content="Content")
        news.generate_slug()
        registry.create_news(news)

        retrieved = registry.get_news_by_slug("test-news")
        assert retrieved is not None
        assert retrieved.id == news.id

    def test_list_news(self, registry):
        """Test listing news."""
        n1 = NewsItem(title="N1", content="C1", category=NewsCategory.COMPANY)
        n2 = NewsItem(title="N2", content="C2", category=NewsCategory.PRODUCT)

        registry.create_news(n1)
        registry.create_news(n2)

        all_news = registry.list_news()
        assert len(all_news) == 2

        company_news = registry.list_news(category=NewsCategory.COMPANY)
        assert len(company_news) == 1

    def test_list_news_featured_only(self, registry):
        """Test listing featured news."""
        n1 = NewsItem(title="Featured", content="C1", featured=True)
        n2 = NewsItem(title="Not Featured", content="C2", featured=False)

        registry.create_news(n1)
        registry.create_news(n2)

        featured = registry.list_news(featured_only=True)
        assert len(featured) == 1
        assert featured[0].title == "Featured"

    # Reactions
    def test_add_reaction(self, registry):
        """Test adding a reaction."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        reaction = Reaction(
            user_id="user-1",
            target_id=announcement.id,
            reaction_type=ReactionType.LIKE
        )
        added = registry.add_reaction(reaction)
        assert added is not None

        # Check announcement count updated
        ann = registry.get_announcement(announcement.id)
        assert ann.reaction_count == 1

    def test_update_existing_reaction(self, registry):
        """Test updating an existing reaction."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        r1 = Reaction(
            user_id="user-1",
            target_id=announcement.id,
            reaction_type=ReactionType.LIKE
        )
        registry.add_reaction(r1)

        r2 = Reaction(
            user_id="user-1",
            target_id=announcement.id,
            reaction_type=ReactionType.LOVE
        )
        updated = registry.add_reaction(r2)

        # Should update, not add new
        assert updated.reaction_type == ReactionType.LOVE
        reactions = registry.get_reactions(announcement.id)
        assert len(reactions) == 1

    def test_remove_reaction(self, registry):
        """Test removing a reaction."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        reaction = Reaction(
            user_id="user-1",
            target_id=announcement.id,
            reaction_type=ReactionType.LIKE
        )
        registry.add_reaction(reaction)

        assert registry.remove_reaction("user-1", announcement.id) is True
        assert len(registry.get_reactions(announcement.id)) == 0

    def test_get_reaction_counts(self, registry):
        """Test getting reaction counts by type."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        r1 = Reaction(user_id="user-1", target_id=announcement.id, reaction_type=ReactionType.LIKE)
        r2 = Reaction(user_id="user-2", target_id=announcement.id, reaction_type=ReactionType.LIKE)
        r3 = Reaction(user_id="user-3", target_id=announcement.id, reaction_type=ReactionType.LOVE)

        registry.add_reaction(r1)
        registry.add_reaction(r2)
        registry.add_reaction(r3)

        counts = registry.get_reaction_counts(announcement.id)
        assert counts["like"] == 2
        assert counts["love"] == 1

    # Acknowledgments
    def test_add_acknowledgment(self, registry):
        """Test adding an acknowledgment."""
        announcement = Announcement(
            title="Test",
            content="Content",
            require_acknowledgment=True
        )
        registry.create_announcement(announcement)

        ack = Acknowledgment(
            user_id="user-1",
            announcement_id=announcement.id,
            acknowledgment_type=AcknowledgmentType.ACKNOWLEDGED
        )
        added = registry.add_acknowledgment(ack)
        assert added is not None

        ann = registry.get_announcement(announcement.id)
        assert ann.acknowledgment_count == 1

    def test_has_acknowledged(self, registry):
        """Test checking if user has acknowledged."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        assert registry.has_acknowledged("user-1", announcement.id) is False

        ack = Acknowledgment(user_id="user-1", announcement_id=announcement.id)
        registry.add_acknowledgment(ack)

        assert registry.has_acknowledged("user-1", announcement.id) is True

    def test_get_unacknowledged_announcements(self, registry):
        """Test getting unacknowledged announcements."""
        a1 = Announcement(
            title="Needs Ack",
            content="C1",
            require_acknowledgment=True
        )
        a1.publish()
        a2 = Announcement(
            title="No Ack Needed",
            content="C2",
            require_acknowledgment=False
        )
        a2.publish()

        registry.create_announcement(a1)
        registry.create_announcement(a2)

        unacked = registry.get_unacknowledged_announcements("user-1")
        assert len(unacked) == 1
        assert unacked[0].title == "Needs Ack"

    # Read receipts
    def test_add_read_receipt(self, registry):
        """Test adding a read receipt."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        receipt = ReadReceipt(
            user_id="user-1",
            announcement_id=announcement.id,
            time_spent_seconds=30
        )
        added = registry.add_read_receipt(receipt)
        assert added is not None

        ann = registry.get_announcement(announcement.id)
        assert ann.view_count == 1

    def test_has_read(self, registry):
        """Test checking if user has read."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        assert registry.has_read("user-1", announcement.id) is False

        receipt = ReadReceipt(user_id="user-1", announcement_id=announcement.id)
        registry.add_read_receipt(receipt)

        assert registry.has_read("user-1", announcement.id) is True

    # Comments
    def test_add_comment(self, registry):
        """Test adding a comment."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        comment = AnnouncementComment(
            target_id=announcement.id,
            author_id="user-1",
            content="Great announcement!"
        )
        added = registry.add_comment(comment)
        assert added is not None

        ann = registry.get_announcement(announcement.id)
        assert ann.comment_count == 1

    def test_add_comment_reply(self, registry):
        """Test adding a reply to a comment."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        parent = AnnouncementComment(
            target_id=announcement.id,
            author_id="user-1",
            content="Parent comment"
        )
        registry.add_comment(parent)

        reply = AnnouncementComment(
            target_id=announcement.id,
            author_id="user-2",
            content="Reply",
            parent_id=parent.id
        )
        registry.add_comment(reply)

        parent_updated = registry.get_comment(parent.id)
        assert parent_updated.reply_count == 1

    def test_get_comments(self, registry):
        """Test getting comments."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        c1 = AnnouncementComment(target_id=announcement.id, author_id="user-1", content="C1")
        c2 = AnnouncementComment(target_id=announcement.id, author_id="user-2", content="C2")

        registry.add_comment(c1)
        registry.add_comment(c2)

        comments = registry.get_comments(announcement.id)
        assert len(comments) == 2

    def test_delete_comment(self, registry):
        """Test deleting a comment."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        comment = AnnouncementComment(
            target_id=announcement.id,
            author_id="user-1",
            content="Comment"
        )
        registry.add_comment(comment)

        assert registry.delete_comment(comment.id) is True
        assert registry.get_comment(comment.id) is None

        ann = registry.get_announcement(announcement.id)
        assert ann.comment_count == 0

    # Analytics
    def test_calculate_analytics(self, registry):
        """Test calculating analytics."""
        announcement = Announcement(title="Test", content="Content")
        registry.create_announcement(announcement)

        # Add some engagement
        r1 = Reaction(user_id="user-1", target_id=announcement.id, reaction_type=ReactionType.LIKE)
        r2 = Reaction(user_id="user-2", target_id=announcement.id, reaction_type=ReactionType.LIKE)
        registry.add_reaction(r1)
        registry.add_reaction(r2)

        receipt = ReadReceipt(
            user_id="user-1",
            announcement_id=announcement.id,
            time_spent_seconds=60,
            scroll_percentage=0.8
        )
        registry.add_read_receipt(receipt)

        analytics = registry.calculate_analytics(announcement.id)
        assert analytics is not None
        assert analytics.total_reactions == 2
        assert analytics.unique_views == 1


# ============== AnnouncementManager Tests ==============

class TestAnnouncementManager:
    """Tests for AnnouncementManager class."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return AnnouncementManager()

    def test_create_announcement(self, manager):
        """Test creating an announcement via manager."""
        announcement = manager.create_announcement(
            title="Test Announcement",
            content="This is a test",
            author_id="author-1",
            organization_id="org-1"
        )
        assert announcement.title == "Test Announcement"
        assert announcement.status == AnnouncementStatus.DRAFT

    def test_publish_announcement(self, manager):
        """Test publishing announcement via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        published = manager.publish_announcement(announcement.id)
        assert published.status == AnnouncementStatus.PUBLISHED

    def test_schedule_announcement(self, manager):
        """Test scheduling announcement."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        publish_at = datetime.now() + timedelta(days=1)
        scheduled = manager.schedule_announcement(announcement.id, publish_at)

        assert scheduled.status == AnnouncementStatus.SCHEDULED
        assert scheduled.schedule.publish_at == publish_at

    def test_archive_announcement(self, manager):
        """Test archiving announcement."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        archived = manager.archive_announcement(announcement.id)
        assert archived.status == AnnouncementStatus.ARCHIVED

    def test_pin_announcement(self, manager):
        """Test pinning announcement."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        pinned = manager.pin_announcement(announcement.id, True)
        assert pinned.pinned is True

        unpinned = manager.pin_announcement(announcement.id, False)
        assert unpinned.pinned is False

    def test_get_user_feed(self, manager):
        """Test getting user feed."""
        a1 = manager.create_announcement(
            title="Announcement 1",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_announcement(a1.id)

        a2 = manager.create_announcement(
            title="Announcement 2",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_announcement(a2.id)

        feed = manager.get_user_feed("user-1")
        assert len(feed) == 2

    def test_get_pending_acknowledgments(self, manager):
        """Test getting pending acknowledgments."""
        a1 = manager.create_announcement(
            title="Needs Ack",
            content="Content",
            author_id="author-1",
            organization_id="org-1",
            require_acknowledgment=True
        )
        manager.publish_announcement(a1.id)

        pending = manager.get_pending_acknowledgments("user-1")
        assert len(pending) == 1

    def test_create_news(self, manager):
        """Test creating news via manager."""
        news = manager.create_news(
            title="Test News Article",
            content="News content",
            author_id="author-1",
            organization_id="org-1",
            category=NewsCategory.COMPANY
        )
        assert news.title == "Test News Article"
        assert news.slug == "test-news-article"

    def test_publish_news(self, manager):
        """Test publishing news via manager."""
        news = manager.create_news(
            title="Test News",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        published = manager.publish_news(news.id)
        assert published.status == AnnouncementStatus.PUBLISHED

    def test_feature_news(self, manager):
        """Test featuring news."""
        news = manager.create_news(
            title="Test News",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        featured = manager.feature_news(news.id, True)
        assert featured.featured is True

    def test_get_news_feed(self, manager):
        """Test getting news feed."""
        n1 = manager.create_news(
            title="News 1",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_news(n1.id)

        feed = manager.get_news_feed()
        assert len(feed) == 1

    def test_react(self, manager):
        """Test adding reaction via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        reaction = manager.react("user-1", announcement.id, ReactionType.LIKE)
        assert reaction.reaction_type == ReactionType.LIKE

    def test_unreact(self, manager):
        """Test removing reaction via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.react("user-1", announcement.id, ReactionType.LIKE)
        assert manager.unreact("user-1", announcement.id) is True

    def test_acknowledge(self, manager):
        """Test acknowledging via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1",
            require_acknowledgment=True
        )
        ack = manager.acknowledge("user-1", announcement.id)
        assert ack.user_id == "user-1"

    def test_mark_as_read(self, manager):
        """Test marking as read via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        receipt = manager.mark_as_read("user-1", announcement.id, time_spent_seconds=30)
        assert receipt.time_spent_seconds == 30

    def test_add_comment(self, manager):
        """Test adding comment via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        comment = manager.add_comment("user-1", announcement.id, "Great!")
        assert comment.content == "Great!"

    def test_get_announcement_analytics(self, manager):
        """Test getting analytics via manager."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.react("user-1", announcement.id, ReactionType.LIKE)

        analytics = manager.get_announcement_analytics(announcement.id)
        assert analytics.total_reactions == 1

    def test_get_engagement_summary(self, manager):
        """Test getting engagement summary."""
        announcement = manager.create_announcement(
            title="Test",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.react("user-1", announcement.id, ReactionType.LIKE)
        manager.add_comment("user-1", announcement.id, "Comment")

        summary = manager.get_engagement_summary(announcement.id)
        assert summary["reactions"] == 1
        assert summary["comments"] == 1

    def test_search_announcements(self, manager):
        """Test searching announcements."""
        a1 = manager.create_announcement(
            title="Important Update",
            content="Content about updates",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_announcement(a1.id)

        a2 = manager.create_announcement(
            title="Other News",
            content="Different content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_announcement(a2.id)

        results = manager.search_announcements("update")
        assert len(results) == 1
        assert results[0].title == "Important Update"

    def test_search_news(self, manager):
        """Test searching news."""
        n1 = manager.create_news(
            title="Product Launch",
            content="New product details",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_news(n1.id)

        results = manager.search_news("product")
        assert len(results) == 1

    def test_publish_scheduled_announcements(self, manager):
        """Test bulk publish of scheduled announcements."""
        a1 = manager.create_announcement(
            title="Scheduled",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        # Schedule for past (should be published)
        manager.schedule_announcement(a1.id, datetime.now() - timedelta(hours=1))

        published = manager.publish_scheduled_announcements()
        assert len(published) == 1
        assert published[0].status == AnnouncementStatus.PUBLISHED

    def test_expire_announcements(self, manager):
        """Test bulk expire announcements."""
        a1 = manager.create_announcement(
            title="Will Expire",
            content="Content",
            author_id="author-1",
            organization_id="org-1"
        )
        manager.publish_announcement(a1.id)

        # Set expired schedule
        ann = manager.registry.get_announcement(a1.id)
        ann.schedule = AnnouncementSchedule(
            publish_at=datetime.now() - timedelta(days=10),
            expire_at=datetime.now() - timedelta(days=1)
        )
        manager.registry.update_announcement(ann)

        expired = manager.expire_announcements()
        assert len(expired) == 1
        assert expired[0].status == AnnouncementStatus.EXPIRED


# ============== Global Instance Tests ==============

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_announcement_manager()

    def teardown_method(self):
        """Reset global instance after each test."""
        reset_announcement_manager()

    def test_get_announcement_manager(self):
        """Test getting global manager."""
        manager = get_announcement_manager()
        assert manager is not None
        assert isinstance(manager, AnnouncementManager)

    def test_get_same_instance(self):
        """Test getting same instance."""
        manager1 = get_announcement_manager()
        manager2 = get_announcement_manager()
        assert manager1 is manager2

    def test_set_announcement_manager(self):
        """Test setting global manager."""
        custom_manager = AnnouncementManager()
        set_announcement_manager(custom_manager)

        assert get_announcement_manager() is custom_manager

    def test_reset_announcement_manager(self):
        """Test resetting global manager."""
        manager1 = get_announcement_manager()
        reset_announcement_manager()
        manager2 = get_announcement_manager()

        assert manager1 is not manager2
