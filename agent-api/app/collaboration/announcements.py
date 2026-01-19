"""
Announcements & News module for enterprise collaboration.

This module provides comprehensive announcement and news management including:
- Announcements with priority levels and categories
- News articles and updates
- Audience targeting (teams, roles, locations)
- Scheduling and expiration
- Reactions and acknowledgments
- Read tracking and analytics
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class AnnouncementType(Enum):
    """Types of announcements."""
    GENERAL = "general"
    URGENT = "urgent"
    POLICY = "policy"
    EVENT = "event"
    MAINTENANCE = "maintenance"
    SECURITY = "security"
    HR = "hr"
    PRODUCT = "product"
    CELEBRATION = "celebration"
    REMINDER = "reminder"


class AnnouncementStatus(Enum):
    """Status of an announcement."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AnnouncementPriority(Enum):
    """Priority levels for announcements."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class NewsCategory(Enum):
    """Categories for news items."""
    COMPANY = "company"
    INDUSTRY = "industry"
    PRODUCT = "product"
    TEAM = "team"
    TECHNOLOGY = "technology"
    MARKET = "market"
    PARTNERSHIP = "partnership"
    AWARD = "award"
    HIRING = "hiring"
    OTHER = "other"


class ReactionType(Enum):
    """Types of reactions to announcements."""
    LIKE = "like"
    LOVE = "love"
    CELEBRATE = "celebrate"
    SUPPORT = "support"
    INSIGHTFUL = "insightful"
    CURIOUS = "curious"


class AcknowledgmentType(Enum):
    """Types of acknowledgments."""
    READ = "read"
    ACKNOWLEDGED = "acknowledged"
    CONFIRMED = "confirmed"
    SIGNED = "signed"


class AudienceType(Enum):
    """Types of audience targeting."""
    ALL = "all"
    TEAM = "team"
    DEPARTMENT = "department"
    ROLE = "role"
    LOCATION = "location"
    USER = "user"
    GROUP = "group"
    CUSTOM = "custom"


@dataclass
class AudienceTarget:
    """Target audience for an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    audience_type: AudienceType = AudienceType.ALL
    target_ids: list[str] = field(default_factory=list)
    include_children: bool = True
    exclude_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    def matches_user(self, user_id: str, user_teams: list[str] = None,
                     user_roles: list[str] = None, user_location: str = None,
                     user_groups: list[str] = None) -> bool:
        """Check if a user matches this audience target."""
        if user_id in self.exclude_ids:
            return False

        if self.audience_type == AudienceType.ALL:
            return True

        if self.audience_type == AudienceType.USER:
            return user_id in self.target_ids

        if self.audience_type == AudienceType.TEAM:
            if user_teams:
                return any(team in self.target_ids for team in user_teams)
            return False

        if self.audience_type == AudienceType.ROLE:
            if user_roles:
                return any(role in self.target_ids for role in user_roles)
            return False

        if self.audience_type == AudienceType.LOCATION:
            if user_location:
                return user_location in self.target_ids
            return False

        if self.audience_type == AudienceType.GROUP:
            if user_groups:
                return any(group in self.target_ids for group in user_groups)
            return False

        return False


@dataclass
class AnnouncementSchedule:
    """Schedule settings for an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    publish_at: Optional[datetime] = None
    expire_at: Optional[datetime] = None
    timezone: str = "UTC"
    recurring: bool = False
    recurrence_pattern: Optional[str] = None
    recurrence_end: Optional[datetime] = None
    reminder_before: Optional[timedelta] = None
    auto_archive: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def is_active(self, at_time: datetime = None) -> bool:
        """Check if the schedule is currently active."""
        check_time = at_time or datetime.now()

        if self.publish_at and check_time < self.publish_at:
            return False

        if self.expire_at and check_time > self.expire_at:
            return False

        return True

    def should_publish(self, at_time: datetime = None) -> bool:
        """Check if announcement should be published."""
        check_time = at_time or datetime.now()

        if self.publish_at is None:
            return True

        return check_time >= self.publish_at

    def is_expired(self, at_time: datetime = None) -> bool:
        """Check if announcement has expired."""
        if self.expire_at is None:
            return False

        check_time = at_time or datetime.now()
        return check_time > self.expire_at


@dataclass
class Reaction:
    """A reaction to an announcement or news item."""
    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: str = ""
    reaction_type: ReactionType = ReactionType.LIKE
    target_id: str = ""
    target_type: str = "announcement"
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Acknowledgment:
    """An acknowledgment of an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: str = ""
    announcement_id: str = ""
    acknowledgment_type: AcknowledgmentType = AcknowledgmentType.READ
    acknowledged_at: datetime = field(default_factory=datetime.now)
    signature: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReadReceipt:
    """Tracks when a user read an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: str = ""
    announcement_id: str = ""
    read_at: datetime = field(default_factory=datetime.now)
    time_spent_seconds: int = 0
    scroll_percentage: float = 0.0
    device_type: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnnouncementAttachment:
    """Attachment for an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    announcement_id: str = ""
    filename: str = ""
    file_type: str = ""
    file_size: int = 0
    url: str = ""
    thumbnail_url: Optional[str] = None
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Announcement:
    """An announcement in the system."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    content: str = ""
    summary: Optional[str] = None
    announcement_type: AnnouncementType = AnnouncementType.GENERAL
    status: AnnouncementStatus = AnnouncementStatus.DRAFT
    priority: AnnouncementPriority = AnnouncementPriority.NORMAL

    # Author and ownership
    author_id: str = ""
    organization_id: str = ""

    # Targeting
    audience: Optional[AudienceTarget] = None

    # Scheduling
    schedule: Optional[AnnouncementSchedule] = None

    # Content options
    pinned: bool = False
    allow_reactions: bool = True
    allow_comments: bool = True
    require_acknowledgment: bool = False
    acknowledgment_type: AcknowledgmentType = AcknowledgmentType.READ

    # Rich content
    cover_image_url: Optional[str] = None
    attachments: list[AnnouncementAttachment] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)

    # Tracking
    view_count: int = 0
    reaction_count: int = 0
    comment_count: int = 0
    acknowledgment_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def publish(self) -> None:
        """Publish the announcement."""
        self.status = AnnouncementStatus.PUBLISHED
        self.published_at = datetime.now()
        self.updated_at = datetime.now()

    def archive(self) -> None:
        """Archive the announcement."""
        self.status = AnnouncementStatus.ARCHIVED
        self.archived_at = datetime.now()
        self.updated_at = datetime.now()

    def cancel(self) -> None:
        """Cancel the announcement."""
        self.status = AnnouncementStatus.CANCELLED
        self.updated_at = datetime.now()

    def is_visible_to_user(self, user_id: str, user_teams: list[str] = None,
                           user_roles: list[str] = None, user_location: str = None,
                           user_groups: list[str] = None) -> bool:
        """Check if announcement is visible to a specific user."""
        if self.status != AnnouncementStatus.PUBLISHED:
            return False

        if self.schedule and not self.schedule.is_active():
            return False

        if self.audience is None:
            return True

        return self.audience.matches_user(
            user_id, user_teams, user_roles, user_location, user_groups
        )

    def increment_view(self) -> None:
        """Increment view count."""
        self.view_count += 1

    def add_reaction(self) -> None:
        """Increment reaction count."""
        self.reaction_count += 1

    def remove_reaction(self) -> None:
        """Decrement reaction count."""
        if self.reaction_count > 0:
            self.reaction_count -= 1

    def add_acknowledgment(self) -> None:
        """Increment acknowledgment count."""
        self.acknowledgment_count += 1


@dataclass
class NewsItem:
    """A news item or article."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    content: str = ""
    summary: Optional[str] = None
    category: NewsCategory = NewsCategory.COMPANY
    status: AnnouncementStatus = AnnouncementStatus.DRAFT

    # Author and ownership
    author_id: str = ""
    organization_id: str = ""

    # Display options
    featured: bool = False
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    # SEO and sharing
    slug: Optional[str] = None
    meta_description: Optional[str] = None

    # Targeting (optional for news)
    audience: Optional[AudienceTarget] = None

    # Content
    attachments: list[AnnouncementAttachment] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    related_news_ids: list[str] = field(default_factory=list)

    # Engagement
    allow_reactions: bool = True
    allow_comments: bool = True

    # Tracking
    view_count: int = 0
    reaction_count: int = 0
    comment_count: int = 0
    share_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    published_at: Optional[datetime] = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def publish(self) -> None:
        """Publish the news item."""
        self.status = AnnouncementStatus.PUBLISHED
        self.published_at = datetime.now()
        self.updated_at = datetime.now()

    def archive(self) -> None:
        """Archive the news item."""
        self.status = AnnouncementStatus.ARCHIVED
        self.updated_at = datetime.now()

    def generate_slug(self) -> str:
        """Generate a URL-friendly slug from the title."""
        import re
        slug = self.title.lower()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        self.slug = slug.strip('-')
        return self.slug


@dataclass
class AnnouncementComment:
    """A comment on an announcement or news item."""
    id: str = field(default_factory=lambda: str(uuid4()))
    target_id: str = ""
    target_type: str = "announcement"
    author_id: str = ""
    content: str = ""
    parent_id: Optional[str] = None

    # Moderation
    is_approved: bool = True
    is_hidden: bool = False

    # Engagement
    reaction_count: int = 0
    reply_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnnouncementAnalytics:
    """Analytics for an announcement."""
    id: str = field(default_factory=lambda: str(uuid4()))
    announcement_id: str = ""
    date: datetime = field(default_factory=datetime.now)

    # Views
    total_views: int = 0
    unique_views: int = 0

    # Engagement
    reactions: dict[str, int] = field(default_factory=dict)
    total_reactions: int = 0
    comments: int = 0
    shares: int = 0

    # Acknowledgments
    total_audience: int = 0
    acknowledged_count: int = 0
    acknowledgment_rate: float = 0.0

    # Time metrics
    avg_time_spent_seconds: float = 0.0
    avg_scroll_depth: float = 0.0

    # Device breakdown
    device_breakdown: dict[str, int] = field(default_factory=dict)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


class AnnouncementRegistry:
    """Registry for managing announcements and news items."""

    def __init__(self):
        self._announcements: dict[str, Announcement] = {}
        self._news: dict[str, NewsItem] = {}
        self._reactions: dict[str, Reaction] = {}
        self._acknowledgments: dict[str, Acknowledgment] = {}
        self._read_receipts: dict[str, ReadReceipt] = {}
        self._comments: dict[str, AnnouncementComment] = {}
        self._analytics: dict[str, AnnouncementAnalytics] = {}

    # Announcement CRUD
    def create_announcement(self, announcement: Announcement) -> Announcement:
        """Create a new announcement."""
        self._announcements[announcement.id] = announcement
        return announcement

    def get_announcement(self, announcement_id: str) -> Optional[Announcement]:
        """Get an announcement by ID."""
        return self._announcements.get(announcement_id)

    def update_announcement(self, announcement: Announcement) -> Announcement:
        """Update an existing announcement."""
        announcement.updated_at = datetime.now()
        self._announcements[announcement.id] = announcement
        return announcement

    def delete_announcement(self, announcement_id: str) -> bool:
        """Delete an announcement."""
        if announcement_id in self._announcements:
            del self._announcements[announcement_id]
            return True
        return False

    def list_announcements(
        self,
        organization_id: str = None,
        status: AnnouncementStatus = None,
        announcement_type: AnnouncementType = None,
        priority: AnnouncementPriority = None,
        author_id: str = None,
        pinned_only: bool = False,
        require_acknowledgment: bool = None,
        tags: list[str] = None
    ) -> list[Announcement]:
        """List announcements with optional filters."""
        results = []

        for announcement in self._announcements.values():
            if organization_id and announcement.organization_id != organization_id:
                continue
            if status and announcement.status != status:
                continue
            if announcement_type and announcement.announcement_type != announcement_type:
                continue
            if priority and announcement.priority != priority:
                continue
            if author_id and announcement.author_id != author_id:
                continue
            if pinned_only and not announcement.pinned:
                continue
            if require_acknowledgment is not None and announcement.require_acknowledgment != require_acknowledgment:
                continue
            if tags and not any(tag in announcement.tags for tag in tags):
                continue

            results.append(announcement)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_announcements_for_user(
        self,
        user_id: str,
        user_teams: list[str] = None,
        user_roles: list[str] = None,
        user_location: str = None,
        user_groups: list[str] = None,
        include_read: bool = True
    ) -> list[Announcement]:
        """Get announcements visible to a specific user."""
        results = []

        for announcement in self._announcements.values():
            if not announcement.is_visible_to_user(
                user_id, user_teams, user_roles, user_location, user_groups
            ):
                continue

            if not include_read:
                # Check if user has read it
                has_read = any(
                    r.user_id == user_id and r.announcement_id == announcement.id
                    for r in self._read_receipts.values()
                )
                if has_read:
                    continue

            results.append(announcement)

        # Sort: pinned first, then by priority, then by date
        priority_order = {
            AnnouncementPriority.CRITICAL: 0,
            AnnouncementPriority.HIGH: 1,
            AnnouncementPriority.NORMAL: 2,
            AnnouncementPriority.LOW: 3
        }

        return sorted(
            results,
            key=lambda x: (
                not x.pinned,
                priority_order.get(x.priority, 2),
                -x.created_at.timestamp()
            )
        )

    # News CRUD
    def create_news(self, news: NewsItem) -> NewsItem:
        """Create a new news item."""
        self._news[news.id] = news
        return news

    def get_news(self, news_id: str) -> Optional[NewsItem]:
        """Get a news item by ID."""
        return self._news.get(news_id)

    def get_news_by_slug(self, slug: str) -> Optional[NewsItem]:
        """Get a news item by slug."""
        for news in self._news.values():
            if news.slug == slug:
                return news
        return None

    def update_news(self, news: NewsItem) -> NewsItem:
        """Update an existing news item."""
        news.updated_at = datetime.now()
        self._news[news.id] = news
        return news

    def delete_news(self, news_id: str) -> bool:
        """Delete a news item."""
        if news_id in self._news:
            del self._news[news_id]
            return True
        return False

    def list_news(
        self,
        organization_id: str = None,
        status: AnnouncementStatus = None,
        category: NewsCategory = None,
        author_id: str = None,
        featured_only: bool = False,
        tags: list[str] = None
    ) -> list[NewsItem]:
        """List news items with optional filters."""
        results = []

        for news in self._news.values():
            if organization_id and news.organization_id != organization_id:
                continue
            if status and news.status != status:
                continue
            if category and news.category != category:
                continue
            if author_id and news.author_id != author_id:
                continue
            if featured_only and not news.featured:
                continue
            if tags and not any(tag in news.tags for tag in tags):
                continue

            results.append(news)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    # Reactions
    def add_reaction(self, reaction: Reaction) -> Reaction:
        """Add a reaction."""
        # Check for existing reaction from same user on same target
        for r in self._reactions.values():
            if r.user_id == reaction.user_id and r.target_id == reaction.target_id:
                # Update existing reaction
                r.reaction_type = reaction.reaction_type
                r.created_at = datetime.now()
                return r

        self._reactions[reaction.id] = reaction

        # Update target count
        if reaction.target_type == "announcement":
            announcement = self.get_announcement(reaction.target_id)
            if announcement:
                announcement.add_reaction()
        elif reaction.target_type == "news":
            news = self.get_news(reaction.target_id)
            if news:
                news.reaction_count += 1

        return reaction

    def remove_reaction(self, user_id: str, target_id: str) -> bool:
        """Remove a reaction."""
        for reaction_id, reaction in list(self._reactions.items()):
            if reaction.user_id == user_id and reaction.target_id == target_id:
                del self._reactions[reaction_id]

                # Update target count
                if reaction.target_type == "announcement":
                    announcement = self.get_announcement(target_id)
                    if announcement:
                        announcement.remove_reaction()
                elif reaction.target_type == "news":
                    news = self.get_news(target_id)
                    if news and news.reaction_count > 0:
                        news.reaction_count -= 1

                return True
        return False

    def get_reactions(self, target_id: str) -> list[Reaction]:
        """Get all reactions for a target."""
        return [r for r in self._reactions.values() if r.target_id == target_id]

    def get_user_reaction(self, user_id: str, target_id: str) -> Optional[Reaction]:
        """Get a user's reaction on a target."""
        for reaction in self._reactions.values():
            if reaction.user_id == user_id and reaction.target_id == target_id:
                return reaction
        return None

    def get_reaction_counts(self, target_id: str) -> dict[str, int]:
        """Get reaction counts by type for a target."""
        counts: dict[str, int] = {}
        for reaction in self._reactions.values():
            if reaction.target_id == target_id:
                reaction_name = reaction.reaction_type.value
                counts[reaction_name] = counts.get(reaction_name, 0) + 1
        return counts

    # Acknowledgments
    def add_acknowledgment(self, acknowledgment: Acknowledgment) -> Acknowledgment:
        """Add an acknowledgment."""
        # Check for existing acknowledgment
        for a in self._acknowledgments.values():
            if a.user_id == acknowledgment.user_id and a.announcement_id == acknowledgment.announcement_id:
                return a  # Already acknowledged

        self._acknowledgments[acknowledgment.id] = acknowledgment

        # Update announcement count
        announcement = self.get_announcement(acknowledgment.announcement_id)
        if announcement:
            announcement.add_acknowledgment()

        return acknowledgment

    def get_acknowledgment(self, user_id: str, announcement_id: str) -> Optional[Acknowledgment]:
        """Get a user's acknowledgment for an announcement."""
        for ack in self._acknowledgments.values():
            if ack.user_id == user_id and ack.announcement_id == announcement_id:
                return ack
        return None

    def get_acknowledgments(self, announcement_id: str) -> list[Acknowledgment]:
        """Get all acknowledgments for an announcement."""
        return [a for a in self._acknowledgments.values() if a.announcement_id == announcement_id]

    def has_acknowledged(self, user_id: str, announcement_id: str) -> bool:
        """Check if a user has acknowledged an announcement."""
        return self.get_acknowledgment(user_id, announcement_id) is not None

    def get_unacknowledged_announcements(
        self,
        user_id: str,
        user_teams: list[str] = None,
        user_roles: list[str] = None,
        user_location: str = None,
        user_groups: list[str] = None
    ) -> list[Announcement]:
        """Get announcements requiring acknowledgment that user hasn't acknowledged."""
        results = []

        for announcement in self._announcements.values():
            if not announcement.require_acknowledgment:
                continue
            if not announcement.is_visible_to_user(
                user_id, user_teams, user_roles, user_location, user_groups
            ):
                continue
            if self.has_acknowledged(user_id, announcement.id):
                continue

            results.append(announcement)

        return sorted(
            results,
            key=lambda x: (
                x.priority != AnnouncementPriority.CRITICAL,
                x.priority != AnnouncementPriority.HIGH,
                -x.created_at.timestamp()
            )
        )

    # Read receipts
    def add_read_receipt(self, receipt: ReadReceipt) -> ReadReceipt:
        """Add a read receipt."""
        # Check for existing receipt
        for r in self._read_receipts.values():
            if r.user_id == receipt.user_id and r.announcement_id == receipt.announcement_id:
                # Update existing
                r.time_spent_seconds = max(r.time_spent_seconds, receipt.time_spent_seconds)
                r.scroll_percentage = max(r.scroll_percentage, receipt.scroll_percentage)
                return r

        self._read_receipts[receipt.id] = receipt

        # Update view count
        announcement = self.get_announcement(receipt.announcement_id)
        if announcement:
            announcement.increment_view()

        return receipt

    def get_read_receipt(self, user_id: str, announcement_id: str) -> Optional[ReadReceipt]:
        """Get a user's read receipt for an announcement."""
        for receipt in self._read_receipts.values():
            if receipt.user_id == user_id and receipt.announcement_id == announcement_id:
                return receipt
        return None

    def has_read(self, user_id: str, announcement_id: str) -> bool:
        """Check if a user has read an announcement."""
        return self.get_read_receipt(user_id, announcement_id) is not None

    def get_read_receipts(self, announcement_id: str) -> list[ReadReceipt]:
        """Get all read receipts for an announcement."""
        return [r for r in self._read_receipts.values() if r.announcement_id == announcement_id]

    # Comments
    def add_comment(self, comment: AnnouncementComment) -> AnnouncementComment:
        """Add a comment."""
        self._comments[comment.id] = comment

        # Update parent reply count if this is a reply
        if comment.parent_id:
            parent = self._comments.get(comment.parent_id)
            if parent:
                parent.reply_count += 1

        # Update target comment count
        if comment.target_type == "announcement":
            announcement = self.get_announcement(comment.target_id)
            if announcement:
                announcement.comment_count += 1
        elif comment.target_type == "news":
            news = self.get_news(comment.target_id)
            if news:
                news.comment_count += 1

        return comment

    def get_comment(self, comment_id: str) -> Optional[AnnouncementComment]:
        """Get a comment by ID."""
        return self._comments.get(comment_id)

    def update_comment(self, comment: AnnouncementComment) -> AnnouncementComment:
        """Update a comment."""
        comment.updated_at = datetime.now()
        self._comments[comment.id] = comment
        return comment

    def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment."""
        comment = self._comments.get(comment_id)
        if not comment:
            return False

        # Update parent reply count
        if comment.parent_id:
            parent = self._comments.get(comment.parent_id)
            if parent and parent.reply_count > 0:
                parent.reply_count -= 1

        # Update target comment count
        if comment.target_type == "announcement":
            announcement = self.get_announcement(comment.target_id)
            if announcement and announcement.comment_count > 0:
                announcement.comment_count -= 1
        elif comment.target_type == "news":
            news = self.get_news(comment.target_id)
            if news and news.comment_count > 0:
                news.comment_count -= 1

        del self._comments[comment_id]
        return True

    def get_comments(
        self,
        target_id: str,
        include_hidden: bool = False,
        parent_id: str = None
    ) -> list[AnnouncementComment]:
        """Get comments for a target."""
        results = []

        for comment in self._comments.values():
            if comment.target_id != target_id:
                continue
            if not include_hidden and comment.is_hidden:
                continue
            if parent_id is not None and comment.parent_id != parent_id:
                continue
            elif parent_id is None and comment.parent_id is not None:
                continue  # Only top-level by default

            results.append(comment)

        return sorted(results, key=lambda x: x.created_at)

    def get_comment_replies(self, comment_id: str) -> list[AnnouncementComment]:
        """Get replies to a comment."""
        return sorted(
            [c for c in self._comments.values() if c.parent_id == comment_id],
            key=lambda x: x.created_at
        )

    # Analytics
    def save_analytics(self, analytics: AnnouncementAnalytics) -> AnnouncementAnalytics:
        """Save analytics data."""
        self._analytics[analytics.id] = analytics
        return analytics

    def get_analytics(self, announcement_id: str) -> Optional[AnnouncementAnalytics]:
        """Get latest analytics for an announcement."""
        results = [a for a in self._analytics.values() if a.announcement_id == announcement_id]
        if not results:
            return None
        return sorted(results, key=lambda x: x.date, reverse=True)[0]

    def calculate_analytics(self, announcement_id: str) -> Optional[AnnouncementAnalytics]:
        """Calculate current analytics for an announcement."""
        announcement = self.get_announcement(announcement_id)
        if not announcement:
            return None

        read_receipts = self.get_read_receipts(announcement_id)
        reactions = self.get_reactions(announcement_id)
        acknowledgments = self.get_acknowledgments(announcement_id)

        # Calculate metrics
        unique_readers = set(r.user_id for r in read_receipts)

        total_time = sum(r.time_spent_seconds for r in read_receipts)
        avg_time = total_time / len(read_receipts) if read_receipts else 0

        total_scroll = sum(r.scroll_percentage for r in read_receipts)
        avg_scroll = total_scroll / len(read_receipts) if read_receipts else 0

        device_breakdown: dict[str, int] = {}
        for receipt in read_receipts:
            device_breakdown[receipt.device_type] = device_breakdown.get(receipt.device_type, 0) + 1

        reaction_counts = self.get_reaction_counts(announcement_id)

        analytics = AnnouncementAnalytics(
            announcement_id=announcement_id,
            total_views=announcement.view_count,
            unique_views=len(unique_readers),
            reactions=reaction_counts,
            total_reactions=len(reactions),
            comments=announcement.comment_count,
            acknowledged_count=len(acknowledgments),
            avg_time_spent_seconds=avg_time,
            avg_scroll_depth=avg_scroll,
            device_breakdown=device_breakdown
        )

        return analytics


class AnnouncementManager:
    """High-level API for managing announcements and news."""

    def __init__(self, registry: AnnouncementRegistry = None):
        self.registry = registry or AnnouncementRegistry()

    # Announcement operations
    def create_announcement(
        self,
        title: str,
        content: str,
        author_id: str,
        organization_id: str,
        announcement_type: AnnouncementType = AnnouncementType.GENERAL,
        priority: AnnouncementPriority = AnnouncementPriority.NORMAL,
        audience: AudienceTarget = None,
        schedule: AnnouncementSchedule = None,
        pinned: bool = False,
        require_acknowledgment: bool = False,
        tags: list[str] = None,
        **kwargs
    ) -> Announcement:
        """Create a new announcement."""
        announcement = Announcement(
            title=title,
            content=content,
            author_id=author_id,
            organization_id=organization_id,
            announcement_type=announcement_type,
            priority=priority,
            audience=audience,
            schedule=schedule,
            pinned=pinned,
            require_acknowledgment=require_acknowledgment,
            tags=tags or [],
            **kwargs
        )
        return self.registry.create_announcement(announcement)

    def publish_announcement(self, announcement_id: str) -> Optional[Announcement]:
        """Publish an announcement."""
        announcement = self.registry.get_announcement(announcement_id)
        if not announcement:
            return None

        announcement.publish()
        return self.registry.update_announcement(announcement)

    def schedule_announcement(
        self,
        announcement_id: str,
        publish_at: datetime,
        expire_at: datetime = None
    ) -> Optional[Announcement]:
        """Schedule an announcement for future publication."""
        announcement = self.registry.get_announcement(announcement_id)
        if not announcement:
            return None

        announcement.schedule = AnnouncementSchedule(
            publish_at=publish_at,
            expire_at=expire_at
        )
        announcement.status = AnnouncementStatus.SCHEDULED

        return self.registry.update_announcement(announcement)

    def archive_announcement(self, announcement_id: str) -> Optional[Announcement]:
        """Archive an announcement."""
        announcement = self.registry.get_announcement(announcement_id)
        if not announcement:
            return None

        announcement.archive()
        return self.registry.update_announcement(announcement)

    def pin_announcement(self, announcement_id: str, pinned: bool = True) -> Optional[Announcement]:
        """Pin or unpin an announcement."""
        announcement = self.registry.get_announcement(announcement_id)
        if not announcement:
            return None

        announcement.pinned = pinned
        announcement.updated_at = datetime.now()
        return self.registry.update_announcement(announcement)

    def get_user_feed(
        self,
        user_id: str,
        user_teams: list[str] = None,
        user_roles: list[str] = None,
        user_location: str = None,
        user_groups: list[str] = None,
        include_read: bool = True,
        limit: int = 50
    ) -> list[Announcement]:
        """Get announcement feed for a user."""
        announcements = self.registry.get_announcements_for_user(
            user_id=user_id,
            user_teams=user_teams,
            user_roles=user_roles,
            user_location=user_location,
            user_groups=user_groups,
            include_read=include_read
        )
        return announcements[:limit]

    def get_pending_acknowledgments(
        self,
        user_id: str,
        user_teams: list[str] = None,
        user_roles: list[str] = None,
        user_location: str = None,
        user_groups: list[str] = None
    ) -> list[Announcement]:
        """Get announcements pending acknowledgment for a user."""
        return self.registry.get_unacknowledged_announcements(
            user_id=user_id,
            user_teams=user_teams,
            user_roles=user_roles,
            user_location=user_location,
            user_groups=user_groups
        )

    # News operations
    def create_news(
        self,
        title: str,
        content: str,
        author_id: str,
        organization_id: str,
        category: NewsCategory = NewsCategory.COMPANY,
        featured: bool = False,
        tags: list[str] = None,
        **kwargs
    ) -> NewsItem:
        """Create a news item."""
        news = NewsItem(
            title=title,
            content=content,
            author_id=author_id,
            organization_id=organization_id,
            category=category,
            featured=featured,
            tags=tags or [],
            **kwargs
        )
        news.generate_slug()
        return self.registry.create_news(news)

    def publish_news(self, news_id: str) -> Optional[NewsItem]:
        """Publish a news item."""
        news = self.registry.get_news(news_id)
        if not news:
            return None

        news.publish()
        return self.registry.update_news(news)

    def feature_news(self, news_id: str, featured: bool = True) -> Optional[NewsItem]:
        """Feature or unfeature a news item."""
        news = self.registry.get_news(news_id)
        if not news:
            return None

        news.featured = featured
        news.updated_at = datetime.now()
        return self.registry.update_news(news)

    def get_news_feed(
        self,
        organization_id: str = None,
        category: NewsCategory = None,
        featured_only: bool = False,
        limit: int = 20
    ) -> list[NewsItem]:
        """Get news feed."""
        news_items = self.registry.list_news(
            organization_id=organization_id,
            status=AnnouncementStatus.PUBLISHED,
            category=category,
            featured_only=featured_only
        )
        return news_items[:limit]

    # Engagement
    def react(
        self,
        user_id: str,
        target_id: str,
        reaction_type: ReactionType,
        target_type: str = "announcement"
    ) -> Reaction:
        """Add a reaction to an announcement or news item."""
        reaction = Reaction(
            user_id=user_id,
            target_id=target_id,
            reaction_type=reaction_type,
            target_type=target_type
        )
        return self.registry.add_reaction(reaction)

    def unreact(self, user_id: str, target_id: str) -> bool:
        """Remove a reaction."""
        return self.registry.remove_reaction(user_id, target_id)

    def acknowledge(
        self,
        user_id: str,
        announcement_id: str,
        acknowledgment_type: AcknowledgmentType = AcknowledgmentType.ACKNOWLEDGED,
        signature: str = None,
        **kwargs
    ) -> Acknowledgment:
        """Acknowledge an announcement."""
        acknowledgment = Acknowledgment(
            user_id=user_id,
            announcement_id=announcement_id,
            acknowledgment_type=acknowledgment_type,
            signature=signature,
            **kwargs
        )
        return self.registry.add_acknowledgment(acknowledgment)

    def mark_as_read(
        self,
        user_id: str,
        announcement_id: str,
        time_spent_seconds: int = 0,
        scroll_percentage: float = 0.0,
        device_type: str = "unknown"
    ) -> ReadReceipt:
        """Mark an announcement as read."""
        receipt = ReadReceipt(
            user_id=user_id,
            announcement_id=announcement_id,
            time_spent_seconds=time_spent_seconds,
            scroll_percentage=scroll_percentage,
            device_type=device_type
        )
        return self.registry.add_read_receipt(receipt)

    def add_comment(
        self,
        author_id: str,
        target_id: str,
        content: str,
        target_type: str = "announcement",
        parent_id: str = None
    ) -> AnnouncementComment:
        """Add a comment to an announcement or news item."""
        comment = AnnouncementComment(
            target_id=target_id,
            target_type=target_type,
            author_id=author_id,
            content=content,
            parent_id=parent_id
        )
        return self.registry.add_comment(comment)

    # Analytics
    def get_announcement_analytics(self, announcement_id: str) -> Optional[AnnouncementAnalytics]:
        """Get analytics for an announcement."""
        return self.registry.calculate_analytics(announcement_id)

    def get_engagement_summary(self, announcement_id: str) -> dict[str, Any]:
        """Get engagement summary for an announcement."""
        announcement = self.registry.get_announcement(announcement_id)
        if not announcement:
            return {}

        return {
            "views": announcement.view_count,
            "reactions": announcement.reaction_count,
            "reaction_breakdown": self.registry.get_reaction_counts(announcement_id),
            "comments": announcement.comment_count,
            "acknowledgments": announcement.acknowledgment_count,
            "require_acknowledgment": announcement.require_acknowledgment
        }

    # Search
    def search_announcements(
        self,
        query: str,
        organization_id: str = None,
        status: AnnouncementStatus = None
    ) -> list[Announcement]:
        """Search announcements by title or content."""
        query_lower = query.lower()
        results = []

        for announcement in self.registry.list_announcements(
            organization_id=organization_id,
            status=status
        ):
            if query_lower in announcement.title.lower() or query_lower in announcement.content.lower():
                results.append(announcement)

        return results

    def search_news(
        self,
        query: str,
        organization_id: str = None,
        category: NewsCategory = None
    ) -> list[NewsItem]:
        """Search news by title or content."""
        query_lower = query.lower()
        results = []

        for news in self.registry.list_news(
            organization_id=organization_id,
            status=AnnouncementStatus.PUBLISHED,
            category=category
        ):
            if query_lower in news.title.lower() or query_lower in news.content.lower():
                results.append(news)

        return results

    # Bulk operations
    def publish_scheduled_announcements(self) -> list[Announcement]:
        """Publish all announcements whose schedule time has passed."""
        published = []

        for announcement in self.registry.list_announcements(
            status=AnnouncementStatus.SCHEDULED
        ):
            if announcement.schedule and announcement.schedule.should_publish():
                announcement.publish()
                self.registry.update_announcement(announcement)
                published.append(announcement)

        return published

    def expire_announcements(self) -> list[Announcement]:
        """Mark expired announcements."""
        expired = []

        for announcement in self.registry.list_announcements(
            status=AnnouncementStatus.PUBLISHED
        ):
            if announcement.schedule and announcement.schedule.is_expired():
                announcement.status = AnnouncementStatus.EXPIRED
                announcement.updated_at = datetime.now()
                self.registry.update_announcement(announcement)
                expired.append(announcement)

        return expired


# Global instance management
_announcement_manager: Optional[AnnouncementManager] = None


def get_announcement_manager() -> AnnouncementManager:
    """Get the global announcement manager instance."""
    global _announcement_manager
    if _announcement_manager is None:
        _announcement_manager = AnnouncementManager()
    return _announcement_manager


def set_announcement_manager(manager: AnnouncementManager) -> None:
    """Set the global announcement manager instance."""
    global _announcement_manager
    _announcement_manager = manager


def reset_announcement_manager() -> None:
    """Reset the global announcement manager instance."""
    global _announcement_manager
    _announcement_manager = None
