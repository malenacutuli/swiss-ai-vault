"""
Knowledge Base & Documentation module for SwissBrain.ai collaboration system.

This module provides enterprise knowledge management features including:
- Articles and documentation pages
- Version history and change tracking
- Hierarchical categories and organization
- Search and discovery
- Reactions and bookmarks
- View analytics
- Multi-author collaboration
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import uuid


class ArticleStatus(str, Enum):
    """Status of an article."""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"


class ArticleVisibility(str, Enum):
    """Visibility level of an article."""
    PUBLIC = "public"
    INTERNAL = "internal"
    PRIVATE = "private"
    RESTRICTED = "restricted"


class CategoryStatus(str, Enum):
    """Status of a category."""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class ContentType(str, Enum):
    """Type of content format."""
    MARKDOWN = "markdown"
    HTML = "html"
    PLAIN_TEXT = "plain_text"
    RICH_TEXT = "rich_text"


class ReactionType(str, Enum):
    """Types of reactions to articles."""
    LIKE = "like"
    HELPFUL = "helpful"
    BOOKMARK = "bookmark"
    OUTDATED = "outdated"
    NEEDS_UPDATE = "needs_update"


class ContributorRole(str, Enum):
    """Roles for article contributors."""
    AUTHOR = "author"
    EDITOR = "editor"
    REVIEWER = "reviewer"
    CONTRIBUTOR = "contributor"


class ArticleTemplate(str, Enum):
    """Built-in article templates."""
    BLANK = "blank"
    HOWTO = "howto"
    FAQ = "faq"
    TROUBLESHOOTING = "troubleshooting"
    REFERENCE = "reference"
    TUTORIAL = "tutorial"
    POLICY = "policy"
    MEETING_NOTES = "meeting_notes"


@dataclass
class ArticleVersion:
    """A version of an article content."""
    id: str
    article_id: str
    version_number: int
    title: str
    content: str
    content_type: ContentType = ContentType.MARKDOWN
    summary: str = ""
    author_id: str = ""
    change_description: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    word_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Calculate word count if not set."""
        if self.word_count == 0 and self.content:
            self.word_count = len(self.content.split())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "version_number": self.version_number,
            "title": self.title,
            "content": self.content,
            "content_type": self.content_type.value,
            "summary": self.summary,
            "author_id": self.author_id,
            "change_description": self.change_description,
            "created_at": self.created_at.isoformat(),
            "word_count": self.word_count,
            "metadata": self.metadata,
        }


@dataclass
class ArticleContributor:
    """A contributor to an article."""
    id: str
    article_id: str
    user_id: str
    role: ContributorRole = ContributorRole.CONTRIBUTOR
    added_at: datetime = field(default_factory=datetime.utcnow)
    added_by: str = ""
    contribution_count: int = 0
    last_contribution_at: Optional[datetime] = None

    def record_contribution(self) -> None:
        """Record a contribution."""
        self.contribution_count += 1
        self.last_contribution_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "user_id": self.user_id,
            "role": self.role.value,
            "added_at": self.added_at.isoformat(),
            "added_by": self.added_by,
            "contribution_count": self.contribution_count,
            "last_contribution_at": self.last_contribution_at.isoformat() if self.last_contribution_at else None,
        }


@dataclass
class ArticleReaction:
    """A reaction to an article."""
    id: str
    article_id: str
    user_id: str
    reaction_type: ReactionType
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "user_id": self.user_id,
            "reaction_type": self.reaction_type.value,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class ArticleView:
    """A view record for an article."""
    id: str
    article_id: str
    user_id: str
    viewed_at: datetime = field(default_factory=datetime.utcnow)
    duration_seconds: int = 0
    source: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "user_id": self.user_id,
            "viewed_at": self.viewed_at.isoformat(),
            "duration_seconds": self.duration_seconds,
            "source": self.source,
        }


@dataclass
class ArticleComment:
    """A comment on an article."""
    id: str
    article_id: str
    author_id: str
    content: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    parent_id: Optional[str] = None
    is_resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    line_number: Optional[int] = None
    reactions: Dict[str, Set[str]] = field(default_factory=dict)

    def update(self, content: str) -> None:
        """Update comment content."""
        self.content = content
        self.updated_at = datetime.utcnow()

    def resolve(self, user_id: str) -> None:
        """Mark comment as resolved."""
        self.is_resolved = True
        self.resolved_by = user_id
        self.resolved_at = datetime.utcnow()

    def unresolve(self) -> None:
        """Mark comment as unresolved."""
        self.is_resolved = False
        self.resolved_by = None
        self.resolved_at = None

    def add_reaction(self, user_id: str, reaction: str) -> None:
        """Add a reaction to the comment."""
        if reaction not in self.reactions:
            self.reactions[reaction] = set()
        self.reactions[reaction].add(user_id)

    def remove_reaction(self, user_id: str, reaction: str) -> None:
        """Remove a reaction from the comment."""
        if reaction in self.reactions:
            self.reactions[reaction].discard(user_id)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "author_id": self.author_id,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "parent_id": self.parent_id,
            "is_resolved": self.is_resolved,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "line_number": self.line_number,
            "reactions": {k: list(v) for k, v in self.reactions.items()},
        }


@dataclass
class ArticleAttachment:
    """An attachment to an article."""
    id: str
    article_id: str
    filename: str
    file_path: str
    file_size: int = 0
    mime_type: str = ""
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.utcnow)
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "uploaded_by": self.uploaded_by,
            "uploaded_at": self.uploaded_at.isoformat(),
            "description": self.description,
        }


@dataclass
class ArticleLink:
    """A link between articles."""
    id: str
    source_article_id: str
    target_article_id: str
    link_type: str = "related"
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "source_article_id": self.source_article_id,
            "target_article_id": self.target_article_id,
            "link_type": self.link_type,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Article:
    """A knowledge base article."""
    id: str
    title: str
    slug: str
    author_id: str
    status: ArticleStatus = ArticleStatus.DRAFT
    visibility: ArticleVisibility = ArticleVisibility.INTERNAL
    content: str = ""
    content_type: ContentType = ContentType.MARKDOWN
    summary: str = ""
    category_id: Optional[str] = None
    workspace_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    version: int = 1
    tags: Set[str] = field(default_factory=set)
    featured: bool = False
    pinned: bool = False
    allow_comments: bool = True
    allow_reactions: bool = True
    view_count: int = 0
    like_count: int = 0
    bookmark_count: int = 0
    comment_count: int = 0
    word_count: int = 0
    reading_time_minutes: int = 0
    template: ArticleTemplate = ArticleTemplate.BLANK
    cover_image_url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Calculate derived fields."""
        self._update_counts()

    def _update_counts(self) -> None:
        """Update word count and reading time."""
        if self.content:
            self.word_count = len(self.content.split())
            self.reading_time_minutes = max(1, self.word_count // 200)

    def update_content(self, content: str, content_type: Optional[ContentType] = None) -> None:
        """Update article content."""
        self.content = content
        if content_type:
            self.content_type = content_type
        self.updated_at = datetime.utcnow()
        self.version += 1
        self._update_counts()

    def publish(self) -> None:
        """Publish the article."""
        self.status = ArticleStatus.PUBLISHED
        self.published_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def unpublish(self) -> None:
        """Unpublish the article (back to draft)."""
        self.status = ArticleStatus.DRAFT
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the article."""
        self.status = ArticleStatus.ARCHIVED
        self.archived_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def submit_for_review(self) -> None:
        """Submit article for review."""
        self.status = ArticleStatus.IN_REVIEW
        self.updated_at = datetime.utcnow()

    def add_tag(self, tag: str) -> None:
        """Add a tag to the article."""
        self.tags.add(tag.lower().strip())

    def remove_tag(self, tag: str) -> None:
        """Remove a tag from the article."""
        self.tags.discard(tag.lower().strip())

    def increment_view(self) -> None:
        """Increment view count."""
        self.view_count += 1

    def increment_like(self) -> None:
        """Increment like count."""
        self.like_count += 1

    def decrement_like(self) -> None:
        """Decrement like count."""
        self.like_count = max(0, self.like_count - 1)

    def increment_bookmark(self) -> None:
        """Increment bookmark count."""
        self.bookmark_count += 1

    def decrement_bookmark(self) -> None:
        """Decrement bookmark count."""
        self.bookmark_count = max(0, self.bookmark_count - 1)

    def increment_comment(self) -> None:
        """Increment comment count."""
        self.comment_count += 1

    def decrement_comment(self) -> None:
        """Decrement comment count."""
        self.comment_count = max(0, self.comment_count - 1)

    @property
    def is_published(self) -> bool:
        """Check if article is published."""
        return self.status == ArticleStatus.PUBLISHED

    @property
    def is_draft(self) -> bool:
        """Check if article is a draft."""
        return self.status == ArticleStatus.DRAFT

    @property
    def is_archived(self) -> bool:
        """Check if article is archived."""
        return self.status == ArticleStatus.ARCHIVED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "author_id": self.author_id,
            "status": self.status.value,
            "visibility": self.visibility.value,
            "content": self.content,
            "content_type": self.content_type.value,
            "summary": self.summary,
            "category_id": self.category_id,
            "workspace_id": self.workspace_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "version": self.version,
            "tags": list(self.tags),
            "featured": self.featured,
            "pinned": self.pinned,
            "allow_comments": self.allow_comments,
            "allow_reactions": self.allow_reactions,
            "view_count": self.view_count,
            "like_count": self.like_count,
            "bookmark_count": self.bookmark_count,
            "comment_count": self.comment_count,
            "word_count": self.word_count,
            "reading_time_minutes": self.reading_time_minutes,
            "template": self.template.value,
            "cover_image_url": self.cover_image_url,
            "metadata": self.metadata,
        }


@dataclass
class Category:
    """A category for organizing articles."""
    id: str
    name: str
    slug: str
    description: str = ""
    status: CategoryStatus = CategoryStatus.ACTIVE
    parent_id: Optional[str] = None
    workspace_id: Optional[str] = None
    icon: str = ""
    color: str = ""
    position: int = 0
    article_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def update(self, name: Optional[str] = None, description: Optional[str] = None) -> None:
        """Update category details."""
        if name:
            self.name = name
        if description is not None:
            self.description = description
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the category."""
        self.status = CategoryStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def activate(self) -> None:
        """Activate the category."""
        self.status = CategoryStatus.ACTIVE
        self.updated_at = datetime.utcnow()

    def increment_article_count(self) -> None:
        """Increment article count."""
        self.article_count += 1

    def decrement_article_count(self) -> None:
        """Decrement article count."""
        self.article_count = max(0, self.article_count - 1)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "status": self.status.value,
            "parent_id": self.parent_id,
            "workspace_id": self.workspace_id,
            "icon": self.icon,
            "color": self.color,
            "position": self.position,
            "article_count": self.article_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "metadata": self.metadata,
        }


@dataclass
class KnowledgeBaseSettings:
    """Settings for a knowledge base."""
    workspace_id: str
    default_visibility: ArticleVisibility = ArticleVisibility.INTERNAL
    require_review: bool = False
    allow_anonymous_views: bool = False
    enable_versioning: bool = True
    max_versions_to_keep: int = 50
    enable_comments: bool = True
    enable_reactions: bool = True
    enable_attachments: bool = True
    max_attachment_size_mb: int = 10
    allowed_attachment_types: Set[str] = field(default_factory=lambda: {"pdf", "doc", "docx", "png", "jpg", "gif"})
    enable_search: bool = True
    enable_analytics: bool = True
    custom_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "workspace_id": self.workspace_id,
            "default_visibility": self.default_visibility.value,
            "require_review": self.require_review,
            "allow_anonymous_views": self.allow_anonymous_views,
            "enable_versioning": self.enable_versioning,
            "max_versions_to_keep": self.max_versions_to_keep,
            "enable_comments": self.enable_comments,
            "enable_reactions": self.enable_reactions,
            "enable_attachments": self.enable_attachments,
            "max_attachment_size_mb": self.max_attachment_size_mb,
            "allowed_attachment_types": list(self.allowed_attachment_types),
            "enable_search": self.enable_search,
            "enable_analytics": self.enable_analytics,
            "custom_fields": self.custom_fields,
        }


@dataclass
class SearchResult:
    """A search result for knowledge base."""
    article_id: str
    title: str
    slug: str
    summary: str
    score: float
    highlights: List[str] = field(default_factory=list)
    category_name: str = ""
    author_name: str = ""
    published_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "article_id": self.article_id,
            "title": self.title,
            "slug": self.slug,
            "summary": self.summary,
            "score": self.score,
            "highlights": self.highlights,
            "category_name": self.category_name,
            "author_name": self.author_name,
            "published_at": self.published_at.isoformat() if self.published_at else None,
        }


class KnowledgeBaseRegistry:
    """Registry for knowledge base entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._articles: Dict[str, Article] = {}
        self._articles_by_slug: Dict[str, str] = {}
        self._categories: Dict[str, Category] = {}
        self._categories_by_slug: Dict[str, str] = {}
        self._versions: Dict[str, List[ArticleVersion]] = {}
        self._contributors: Dict[str, List[ArticleContributor]] = {}
        self._reactions: Dict[str, List[ArticleReaction]] = {}
        self._views: Dict[str, List[ArticleView]] = {}
        self._comments: Dict[str, List[ArticleComment]] = {}
        self._attachments: Dict[str, List[ArticleAttachment]] = {}
        self._links: Dict[str, List[ArticleLink]] = {}
        self._settings: Dict[str, KnowledgeBaseSettings] = {}

    # Article methods
    def create_article(
        self,
        title: str,
        slug: str,
        author_id: str,
        content: str = "",
        content_type: ContentType = ContentType.MARKDOWN,
        summary: str = "",
        status: ArticleStatus = ArticleStatus.DRAFT,
        visibility: ArticleVisibility = ArticleVisibility.INTERNAL,
        category_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        template: ArticleTemplate = ArticleTemplate.BLANK,
    ) -> Article:
        """Create a new article."""
        if slug in self._articles_by_slug:
            raise ValueError(f"Article with slug '{slug}' already exists")

        article_id = str(uuid.uuid4())
        article = Article(
            id=article_id,
            title=title,
            slug=slug,
            author_id=author_id,
            content=content,
            content_type=content_type,
            summary=summary,
            status=status,
            visibility=visibility,
            category_id=category_id,
            workspace_id=workspace_id,
            tags=tags or set(),
            template=template,
        )

        self._articles[article_id] = article
        self._articles_by_slug[slug] = article_id
        self._versions[article_id] = []
        self._contributors[article_id] = []
        self._reactions[article_id] = []
        self._views[article_id] = []
        self._comments[article_id] = []
        self._attachments[article_id] = []
        self._links[article_id] = []

        # Add author as contributor
        self._add_contributor(article_id, author_id, ContributorRole.AUTHOR, author_id)

        # Create initial version
        self._create_version(article, "Initial version")

        # Update category count
        if category_id and category_id in self._categories:
            self._categories[category_id].increment_article_count()

        return article

    def get_article(self, article_id: str) -> Optional[Article]:
        """Get an article by ID."""
        return self._articles.get(article_id)

    def get_article_by_slug(self, slug: str) -> Optional[Article]:
        """Get an article by slug."""
        article_id = self._articles_by_slug.get(slug)
        if article_id:
            return self._articles.get(article_id)
        return None

    def update_article(
        self,
        article_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        content_type: Optional[ContentType] = None,
        summary: Optional[str] = None,
        visibility: Optional[ArticleVisibility] = None,
        category_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        editor_id: Optional[str] = None,
        change_description: str = "",
    ) -> Optional[Article]:
        """Update an article."""
        article = self._articles.get(article_id)
        if not article:
            return None

        old_category_id = article.category_id
        content_changed = False

        if title is not None:
            article.title = title
            content_changed = True
        if content is not None:
            article.update_content(content, content_type)
            content_changed = True
        elif content_type is not None:
            article.content_type = content_type
        if summary is not None:
            article.summary = summary
        if visibility is not None:
            article.visibility = visibility
        if category_id is not None:
            article.category_id = category_id
            # Update category counts
            if old_category_id and old_category_id in self._categories:
                self._categories[old_category_id].decrement_article_count()
            if category_id in self._categories:
                self._categories[category_id].increment_article_count()
        if tags is not None:
            article.tags = tags

        article.updated_at = datetime.utcnow()

        # Create version if content changed
        if content_changed and editor_id:
            self._create_version(article, change_description or "Content updated")
            self._record_contributor_activity(article_id, editor_id)

        return article

    def delete_article(self, article_id: str) -> bool:
        """Delete an article."""
        article = self._articles.get(article_id)
        if not article:
            return False

        # Update category count
        if article.category_id and article.category_id in self._categories:
            self._categories[article.category_id].decrement_article_count()

        # Remove from slug index
        if article.slug in self._articles_by_slug:
            del self._articles_by_slug[article.slug]

        # Clean up related data
        del self._articles[article_id]
        self._versions.pop(article_id, None)
        self._contributors.pop(article_id, None)
        self._reactions.pop(article_id, None)
        self._views.pop(article_id, None)
        self._comments.pop(article_id, None)
        self._attachments.pop(article_id, None)
        self._links.pop(article_id, None)

        return True

    def list_articles(
        self,
        workspace_id: Optional[str] = None,
        category_id: Optional[str] = None,
        author_id: Optional[str] = None,
        status: Optional[ArticleStatus] = None,
        visibility: Optional[ArticleVisibility] = None,
        tags: Optional[Set[str]] = None,
        featured: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Article]:
        """List articles with filters."""
        articles = list(self._articles.values())

        if workspace_id:
            articles = [a for a in articles if a.workspace_id == workspace_id]
        if category_id:
            articles = [a for a in articles if a.category_id == category_id]
        if author_id:
            articles = [a for a in articles if a.author_id == author_id]
        if status:
            articles = [a for a in articles if a.status == status]
        if visibility:
            articles = [a for a in articles if a.visibility == visibility]
        if tags:
            articles = [a for a in articles if tags & a.tags]
        if featured is not None:
            articles = [a for a in articles if a.featured == featured]

        # Sort by created_at descending
        articles.sort(key=lambda a: a.created_at, reverse=True)

        return articles[offset:offset + limit]

    def search_articles(
        self,
        query: str,
        workspace_id: Optional[str] = None,
        category_id: Optional[str] = None,
        status: Optional[ArticleStatus] = None,
        limit: int = 20,
    ) -> List[SearchResult]:
        """Search articles by query."""
        query_lower = query.lower()
        results: List[SearchResult] = []

        for article in self._articles.values():
            if workspace_id and article.workspace_id != workspace_id:
                continue
            if category_id and article.category_id != category_id:
                continue
            if status and article.status != status:
                continue

            # Calculate score based on matches
            score = 0.0
            highlights = []

            if query_lower in article.title.lower():
                score += 10.0
                highlights.append(article.title)
            if query_lower in article.summary.lower():
                score += 5.0
                highlights.append(article.summary[:200])
            if query_lower in article.content.lower():
                score += 3.0
                # Find context around match
                idx = article.content.lower().find(query_lower)
                if idx >= 0:
                    start = max(0, idx - 50)
                    end = min(len(article.content), idx + len(query) + 50)
                    highlights.append(f"...{article.content[start:end]}...")

            for tag in article.tags:
                if query_lower in tag.lower():
                    score += 2.0

            if score > 0:
                category = self._categories.get(article.category_id) if article.category_id else None
                results.append(SearchResult(
                    article_id=article.id,
                    title=article.title,
                    slug=article.slug,
                    summary=article.summary or article.content[:200],
                    score=score,
                    highlights=highlights[:3],
                    category_name=category.name if category else "",
                    published_at=article.published_at,
                ))

        # Sort by score descending
        results.sort(key=lambda r: r.score, reverse=True)

        return results[:limit]

    def publish_article(self, article_id: str) -> Optional[Article]:
        """Publish an article."""
        article = self._articles.get(article_id)
        if article:
            article.publish()
        return article

    def archive_article(self, article_id: str) -> Optional[Article]:
        """Archive an article."""
        article = self._articles.get(article_id)
        if article:
            article.archive()
        return article

    # Version methods
    def _create_version(self, article: Article, change_description: str = "") -> ArticleVersion:
        """Create a new version for an article."""
        versions = self._versions.get(article.id, [])
        version_number = len(versions) + 1

        version = ArticleVersion(
            id=str(uuid.uuid4()),
            article_id=article.id,
            version_number=version_number,
            title=article.title,
            content=article.content,
            content_type=article.content_type,
            summary=article.summary,
            author_id=article.author_id,
            change_description=change_description,
        )

        versions.append(version)
        self._versions[article.id] = versions

        return version

    def get_article_versions(self, article_id: str) -> List[ArticleVersion]:
        """Get all versions of an article."""
        return self._versions.get(article_id, [])

    def get_version(self, article_id: str, version_number: int) -> Optional[ArticleVersion]:
        """Get a specific version of an article."""
        versions = self._versions.get(article_id, [])
        for version in versions:
            if version.version_number == version_number:
                return version
        return None

    def restore_version(self, article_id: str, version_number: int, user_id: str) -> Optional[Article]:
        """Restore an article to a previous version."""
        version = self.get_version(article_id, version_number)
        if not version:
            return None

        return self.update_article(
            article_id=article_id,
            title=version.title,
            content=version.content,
            content_type=version.content_type,
            summary=version.summary,
            editor_id=user_id,
            change_description=f"Restored to version {version_number}",
        )

    # Contributor methods
    def _add_contributor(
        self,
        article_id: str,
        user_id: str,
        role: ContributorRole,
        added_by: str,
    ) -> ArticleContributor:
        """Add a contributor to an article."""
        contributor = ArticleContributor(
            id=str(uuid.uuid4()),
            article_id=article_id,
            user_id=user_id,
            role=role,
            added_by=added_by,
        )

        if article_id not in self._contributors:
            self._contributors[article_id] = []
        self._contributors[article_id].append(contributor)

        return contributor

    def add_contributor(
        self,
        article_id: str,
        user_id: str,
        role: ContributorRole,
        added_by: str,
    ) -> Optional[ArticleContributor]:
        """Add a contributor to an article."""
        if article_id not in self._articles:
            return None

        # Check if already a contributor
        contributors = self._contributors.get(article_id, [])
        for c in contributors:
            if c.user_id == user_id:
                return c

        return self._add_contributor(article_id, user_id, role, added_by)

    def get_contributors(self, article_id: str) -> List[ArticleContributor]:
        """Get all contributors to an article."""
        return self._contributors.get(article_id, [])

    def remove_contributor(self, article_id: str, user_id: str) -> bool:
        """Remove a contributor from an article."""
        contributors = self._contributors.get(article_id, [])
        for i, c in enumerate(contributors):
            if c.user_id == user_id:
                del contributors[i]
                return True
        return False

    def _record_contributor_activity(self, article_id: str, user_id: str) -> None:
        """Record contributor activity."""
        contributors = self._contributors.get(article_id, [])
        for c in contributors:
            if c.user_id == user_id:
                c.record_contribution()
                return

    # Reaction methods
    def add_reaction(
        self,
        article_id: str,
        user_id: str,
        reaction_type: ReactionType,
    ) -> Optional[ArticleReaction]:
        """Add a reaction to an article."""
        article = self._articles.get(article_id)
        if not article or not article.allow_reactions:
            return None

        # Check for existing reaction of same type
        reactions = self._reactions.get(article_id, [])
        for r in reactions:
            if r.user_id == user_id and r.reaction_type == reaction_type:
                return r

        reaction = ArticleReaction(
            id=str(uuid.uuid4()),
            article_id=article_id,
            user_id=user_id,
            reaction_type=reaction_type,
        )

        reactions.append(reaction)
        self._reactions[article_id] = reactions

        # Update counts
        if reaction_type == ReactionType.LIKE:
            article.increment_like()
        elif reaction_type == ReactionType.BOOKMARK:
            article.increment_bookmark()

        return reaction

    def remove_reaction(
        self,
        article_id: str,
        user_id: str,
        reaction_type: ReactionType,
    ) -> bool:
        """Remove a reaction from an article."""
        article = self._articles.get(article_id)
        if not article:
            return False

        reactions = self._reactions.get(article_id, [])
        for i, r in enumerate(reactions):
            if r.user_id == user_id and r.reaction_type == reaction_type:
                del reactions[i]
                # Update counts
                if reaction_type == ReactionType.LIKE:
                    article.decrement_like()
                elif reaction_type == ReactionType.BOOKMARK:
                    article.decrement_bookmark()
                return True

        return False

    def get_reactions(self, article_id: str) -> List[ArticleReaction]:
        """Get all reactions to an article."""
        return self._reactions.get(article_id, [])

    def get_user_reactions(self, article_id: str, user_id: str) -> List[ArticleReaction]:
        """Get a user's reactions to an article."""
        reactions = self._reactions.get(article_id, [])
        return [r for r in reactions if r.user_id == user_id]

    def get_user_bookmarks(self, user_id: str) -> List[Article]:
        """Get all articles bookmarked by a user."""
        bookmarked = []
        for article_id, reactions in self._reactions.items():
            for r in reactions:
                if r.user_id == user_id and r.reaction_type == ReactionType.BOOKMARK:
                    article = self._articles.get(article_id)
                    if article:
                        bookmarked.append(article)
                    break
        return bookmarked

    # View methods
    def record_view(
        self,
        article_id: str,
        user_id: str,
        duration_seconds: int = 0,
        source: str = "",
    ) -> Optional[ArticleView]:
        """Record a view of an article."""
        article = self._articles.get(article_id)
        if not article:
            return None

        view = ArticleView(
            id=str(uuid.uuid4()),
            article_id=article_id,
            user_id=user_id,
            duration_seconds=duration_seconds,
            source=source,
        )

        if article_id not in self._views:
            self._views[article_id] = []
        self._views[article_id].append(view)

        article.increment_view()

        return view

    def get_views(self, article_id: str) -> List[ArticleView]:
        """Get all views of an article."""
        return self._views.get(article_id, [])

    def get_view_stats(self, article_id: str) -> Dict[str, Any]:
        """Get view statistics for an article."""
        views = self._views.get(article_id, [])

        unique_viewers = set(v.user_id for v in views)
        total_duration = sum(v.duration_seconds for v in views)

        return {
            "total_views": len(views),
            "unique_viewers": len(unique_viewers),
            "total_duration_seconds": total_duration,
            "avg_duration_seconds": total_duration / len(views) if views else 0,
        }

    # Comment methods
    def add_comment(
        self,
        article_id: str,
        author_id: str,
        content: str,
        parent_id: Optional[str] = None,
        line_number: Optional[int] = None,
    ) -> Optional[ArticleComment]:
        """Add a comment to an article."""
        article = self._articles.get(article_id)
        if not article or not article.allow_comments:
            return None

        comment = ArticleComment(
            id=str(uuid.uuid4()),
            article_id=article_id,
            author_id=author_id,
            content=content,
            parent_id=parent_id,
            line_number=line_number,
        )

        if article_id not in self._comments:
            self._comments[article_id] = []
        self._comments[article_id].append(comment)

        article.increment_comment()

        return comment

    def get_comment(self, comment_id: str) -> Optional[ArticleComment]:
        """Get a comment by ID."""
        for comments in self._comments.values():
            for c in comments:
                if c.id == comment_id:
                    return c
        return None

    def update_comment(self, comment_id: str, content: str) -> Optional[ArticleComment]:
        """Update a comment."""
        comment = self.get_comment(comment_id)
        if comment:
            comment.update(content)
        return comment

    def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment."""
        for article_id, comments in self._comments.items():
            for i, c in enumerate(comments):
                if c.id == comment_id:
                    del comments[i]
                    article = self._articles.get(article_id)
                    if article:
                        article.decrement_comment()
                    return True
        return False

    def get_comments(self, article_id: str, include_resolved: bool = True) -> List[ArticleComment]:
        """Get all comments on an article."""
        comments = self._comments.get(article_id, [])
        if not include_resolved:
            comments = [c for c in comments if not c.is_resolved]
        return comments

    def resolve_comment(self, comment_id: str, user_id: str) -> Optional[ArticleComment]:
        """Resolve a comment."""
        comment = self.get_comment(comment_id)
        if comment:
            comment.resolve(user_id)
        return comment

    # Attachment methods
    def add_attachment(
        self,
        article_id: str,
        filename: str,
        file_path: str,
        uploaded_by: str,
        file_size: int = 0,
        mime_type: str = "",
        description: str = "",
    ) -> Optional[ArticleAttachment]:
        """Add an attachment to an article."""
        if article_id not in self._articles:
            return None

        attachment = ArticleAttachment(
            id=str(uuid.uuid4()),
            article_id=article_id,
            filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uploaded_by,
            description=description,
        )

        if article_id not in self._attachments:
            self._attachments[article_id] = []
        self._attachments[article_id].append(attachment)

        return attachment

    def get_attachments(self, article_id: str) -> List[ArticleAttachment]:
        """Get all attachments for an article."""
        return self._attachments.get(article_id, [])

    def delete_attachment(self, attachment_id: str) -> bool:
        """Delete an attachment."""
        for article_id, attachments in self._attachments.items():
            for i, a in enumerate(attachments):
                if a.id == attachment_id:
                    del attachments[i]
                    return True
        return False

    # Link methods
    def add_link(
        self,
        source_article_id: str,
        target_article_id: str,
        link_type: str,
        created_by: str,
    ) -> Optional[ArticleLink]:
        """Add a link between articles."""
        if source_article_id not in self._articles or target_article_id not in self._articles:
            return None

        link = ArticleLink(
            id=str(uuid.uuid4()),
            source_article_id=source_article_id,
            target_article_id=target_article_id,
            link_type=link_type,
            created_by=created_by,
        )

        if source_article_id not in self._links:
            self._links[source_article_id] = []
        self._links[source_article_id].append(link)

        return link

    def get_links(self, article_id: str) -> List[ArticleLink]:
        """Get all links from an article."""
        return self._links.get(article_id, [])

    def get_backlinks(self, article_id: str) -> List[ArticleLink]:
        """Get all links to an article."""
        backlinks = []
        for links in self._links.values():
            for link in links:
                if link.target_article_id == article_id:
                    backlinks.append(link)
        return backlinks

    def delete_link(self, link_id: str) -> bool:
        """Delete a link."""
        for article_id, links in self._links.items():
            for i, link in enumerate(links):
                if link.id == link_id:
                    del links[i]
                    return True
        return False

    # Category methods
    def create_category(
        self,
        name: str,
        slug: str,
        description: str = "",
        parent_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        icon: str = "",
        color: str = "",
        position: int = 0,
        created_by: str = "",
    ) -> Category:
        """Create a new category."""
        if slug in self._categories_by_slug:
            raise ValueError(f"Category with slug '{slug}' already exists")

        category_id = str(uuid.uuid4())
        category = Category(
            id=category_id,
            name=name,
            slug=slug,
            description=description,
            parent_id=parent_id,
            workspace_id=workspace_id,
            icon=icon,
            color=color,
            position=position,
            created_by=created_by,
        )

        self._categories[category_id] = category
        self._categories_by_slug[slug] = category_id

        return category

    def get_category(self, category_id: str) -> Optional[Category]:
        """Get a category by ID."""
        return self._categories.get(category_id)

    def get_category_by_slug(self, slug: str) -> Optional[Category]:
        """Get a category by slug."""
        category_id = self._categories_by_slug.get(slug)
        if category_id:
            return self._categories.get(category_id)
        return None

    def update_category(
        self,
        category_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        color: Optional[str] = None,
        position: Optional[int] = None,
    ) -> Optional[Category]:
        """Update a category."""
        category = self._categories.get(category_id)
        if not category:
            return None

        if name is not None:
            category.name = name
        if description is not None:
            category.description = description
        if icon is not None:
            category.icon = icon
        if color is not None:
            category.color = color
        if position is not None:
            category.position = position

        category.updated_at = datetime.utcnow()

        return category

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        category = self._categories.get(category_id)
        if not category:
            return False

        # Remove from slug index
        if category.slug in self._categories_by_slug:
            del self._categories_by_slug[category.slug]

        del self._categories[category_id]

        return True

    def list_categories(
        self,
        workspace_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        status: Optional[CategoryStatus] = None,
    ) -> List[Category]:
        """List categories with filters."""
        categories = list(self._categories.values())

        if workspace_id:
            categories = [c for c in categories if c.workspace_id == workspace_id]
        if parent_id is not None:
            categories = [c for c in categories if c.parent_id == parent_id]
        if status:
            categories = [c for c in categories if c.status == status]

        # Sort by position
        categories.sort(key=lambda c: c.position)

        return categories

    def get_category_tree(self, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get category tree structure."""
        categories = self.list_categories(workspace_id=workspace_id, status=CategoryStatus.ACTIVE)

        # Build tree
        tree: List[Dict[str, Any]] = []
        by_parent: Dict[Optional[str], List[Category]] = {}

        for category in categories:
            parent = category.parent_id
            if parent not in by_parent:
                by_parent[parent] = []
            by_parent[parent].append(category)

        def build_node(category: Category) -> Dict[str, Any]:
            children = by_parent.get(category.id, [])
            return {
                "category": category.to_dict(),
                "children": [build_node(c) for c in children],
            }

        for root in by_parent.get(None, []):
            tree.append(build_node(root))

        return tree

    # Settings methods
    def get_settings(self, workspace_id: str) -> KnowledgeBaseSettings:
        """Get knowledge base settings for a workspace."""
        if workspace_id not in self._settings:
            self._settings[workspace_id] = KnowledgeBaseSettings(workspace_id=workspace_id)
        return self._settings[workspace_id]

    def update_settings(
        self,
        workspace_id: str,
        **kwargs: Any,
    ) -> KnowledgeBaseSettings:
        """Update knowledge base settings."""
        settings = self.get_settings(workspace_id)

        for key, value in kwargs.items():
            if hasattr(settings, key):
                setattr(settings, key, value)

        return settings

    # Statistics methods
    def get_stats(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get knowledge base statistics."""
        articles = list(self._articles.values())
        if workspace_id:
            articles = [a for a in articles if a.workspace_id == workspace_id]

        categories = list(self._categories.values())
        if workspace_id:
            categories = [c for c in categories if c.workspace_id == workspace_id]

        total_views = sum(a.view_count for a in articles)
        total_likes = sum(a.like_count for a in articles)
        total_comments = sum(a.comment_count for a in articles)

        status_counts = {}
        for status in ArticleStatus:
            status_counts[status.value] = len([a for a in articles if a.status == status])

        return {
            "total_articles": len(articles),
            "total_categories": len(categories),
            "total_views": total_views,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "articles_by_status": status_counts,
            "published_articles": status_counts.get(ArticleStatus.PUBLISHED.value, 0),
            "draft_articles": status_counts.get(ArticleStatus.DRAFT.value, 0),
        }


class KnowledgeBaseManager:
    """High-level API for knowledge base operations."""

    def __init__(self, registry: Optional[KnowledgeBaseRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or KnowledgeBaseRegistry()

    @property
    def registry(self) -> KnowledgeBaseRegistry:
        """Get the registry."""
        return self._registry

    # Article methods
    def create_article(
        self,
        title: str,
        author_id: str,
        slug: Optional[str] = None,
        content: str = "",
        content_type: ContentType = ContentType.MARKDOWN,
        summary: str = "",
        status: ArticleStatus = ArticleStatus.DRAFT,
        visibility: ArticleVisibility = ArticleVisibility.INTERNAL,
        category_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        template: ArticleTemplate = ArticleTemplate.BLANK,
    ) -> Article:
        """Create a new article."""
        if not slug:
            slug = self._generate_slug(title)

        return self._registry.create_article(
            title=title,
            slug=slug,
            author_id=author_id,
            content=content,
            content_type=content_type,
            summary=summary,
            status=status,
            visibility=visibility,
            category_id=category_id,
            workspace_id=workspace_id,
            tags=tags,
            template=template,
        )

    def _generate_slug(self, title: str) -> str:
        """Generate a slug from a title."""
        import re
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')

        # Check for uniqueness
        base_slug = slug
        counter = 1
        while self._registry.get_article_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug

    def get_article(self, article_id: str) -> Optional[Article]:
        """Get an article by ID."""
        return self._registry.get_article(article_id)

    def get_article_by_slug(self, slug: str) -> Optional[Article]:
        """Get an article by slug."""
        return self._registry.get_article_by_slug(slug)

    def update_article(
        self,
        article_id: str,
        editor_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        content_type: Optional[ContentType] = None,
        summary: Optional[str] = None,
        visibility: Optional[ArticleVisibility] = None,
        category_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        change_description: str = "",
    ) -> Optional[Article]:
        """Update an article."""
        return self._registry.update_article(
            article_id=article_id,
            title=title,
            content=content,
            content_type=content_type,
            summary=summary,
            visibility=visibility,
            category_id=category_id,
            tags=tags,
            editor_id=editor_id,
            change_description=change_description,
        )

    def delete_article(self, article_id: str) -> bool:
        """Delete an article."""
        return self._registry.delete_article(article_id)

    def publish_article(self, article_id: str) -> Optional[Article]:
        """Publish an article."""
        return self._registry.publish_article(article_id)

    def archive_article(self, article_id: str) -> Optional[Article]:
        """Archive an article."""
        return self._registry.archive_article(article_id)

    def submit_for_review(self, article_id: str) -> Optional[Article]:
        """Submit an article for review."""
        article = self._registry.get_article(article_id)
        if article:
            article.submit_for_review()
        return article

    def list_articles(
        self,
        workspace_id: Optional[str] = None,
        category_id: Optional[str] = None,
        author_id: Optional[str] = None,
        status: Optional[ArticleStatus] = None,
        visibility: Optional[ArticleVisibility] = None,
        tags: Optional[Set[str]] = None,
        featured: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Article]:
        """List articles with filters."""
        return self._registry.list_articles(
            workspace_id=workspace_id,
            category_id=category_id,
            author_id=author_id,
            status=status,
            visibility=visibility,
            tags=tags,
            featured=featured,
            limit=limit,
            offset=offset,
        )

    def search_articles(
        self,
        query: str,
        workspace_id: Optional[str] = None,
        category_id: Optional[str] = None,
        status: Optional[ArticleStatus] = None,
        limit: int = 20,
    ) -> List[SearchResult]:
        """Search articles."""
        return self._registry.search_articles(
            query=query,
            workspace_id=workspace_id,
            category_id=category_id,
            status=status,
            limit=limit,
        )

    def get_featured_articles(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[Article]:
        """Get featured articles."""
        return self._registry.list_articles(
            workspace_id=workspace_id,
            status=ArticleStatus.PUBLISHED,
            featured=True,
            limit=limit,
        )

    def get_recent_articles(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[Article]:
        """Get recently published articles."""
        return self._registry.list_articles(
            workspace_id=workspace_id,
            status=ArticleStatus.PUBLISHED,
            limit=limit,
        )

    def get_popular_articles(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[Article]:
        """Get popular articles by view count."""
        articles = self._registry.list_articles(
            workspace_id=workspace_id,
            status=ArticleStatus.PUBLISHED,
            limit=100,
        )
        articles.sort(key=lambda a: a.view_count, reverse=True)
        return articles[:limit]

    # Version methods
    def get_article_versions(self, article_id: str) -> List[ArticleVersion]:
        """Get all versions of an article."""
        return self._registry.get_article_versions(article_id)

    def get_version(self, article_id: str, version_number: int) -> Optional[ArticleVersion]:
        """Get a specific version."""
        return self._registry.get_version(article_id, version_number)

    def restore_version(self, article_id: str, version_number: int, user_id: str) -> Optional[Article]:
        """Restore an article to a previous version."""
        return self._registry.restore_version(article_id, version_number, user_id)

    def compare_versions(
        self,
        article_id: str,
        version_a: int,
        version_b: int,
    ) -> Optional[Dict[str, Any]]:
        """Compare two versions of an article."""
        v_a = self._registry.get_version(article_id, version_a)
        v_b = self._registry.get_version(article_id, version_b)

        if not v_a or not v_b:
            return None

        return {
            "version_a": v_a.to_dict(),
            "version_b": v_b.to_dict(),
            "title_changed": v_a.title != v_b.title,
            "content_changed": v_a.content != v_b.content,
            "word_count_diff": v_b.word_count - v_a.word_count,
        }

    # Contributor methods
    def add_contributor(
        self,
        article_id: str,
        user_id: str,
        role: ContributorRole,
        added_by: str,
    ) -> Optional[ArticleContributor]:
        """Add a contributor to an article."""
        return self._registry.add_contributor(article_id, user_id, role, added_by)

    def get_contributors(self, article_id: str) -> List[ArticleContributor]:
        """Get all contributors to an article."""
        return self._registry.get_contributors(article_id)

    def remove_contributor(self, article_id: str, user_id: str) -> bool:
        """Remove a contributor."""
        return self._registry.remove_contributor(article_id, user_id)

    # Reaction methods
    def add_reaction(
        self,
        article_id: str,
        user_id: str,
        reaction_type: ReactionType,
    ) -> Optional[ArticleReaction]:
        """Add a reaction to an article."""
        return self._registry.add_reaction(article_id, user_id, reaction_type)

    def remove_reaction(
        self,
        article_id: str,
        user_id: str,
        reaction_type: ReactionType,
    ) -> bool:
        """Remove a reaction."""
        return self._registry.remove_reaction(article_id, user_id, reaction_type)

    def like_article(self, article_id: str, user_id: str) -> Optional[ArticleReaction]:
        """Like an article."""
        return self.add_reaction(article_id, user_id, ReactionType.LIKE)

    def unlike_article(self, article_id: str, user_id: str) -> bool:
        """Unlike an article."""
        return self.remove_reaction(article_id, user_id, ReactionType.LIKE)

    def bookmark_article(self, article_id: str, user_id: str) -> Optional[ArticleReaction]:
        """Bookmark an article."""
        return self.add_reaction(article_id, user_id, ReactionType.BOOKMARK)

    def unbookmark_article(self, article_id: str, user_id: str) -> bool:
        """Remove bookmark from an article."""
        return self.remove_reaction(article_id, user_id, ReactionType.BOOKMARK)

    def get_user_bookmarks(self, user_id: str) -> List[Article]:
        """Get all bookmarked articles for a user."""
        return self._registry.get_user_bookmarks(user_id)

    def mark_outdated(self, article_id: str, user_id: str) -> Optional[ArticleReaction]:
        """Mark an article as outdated."""
        return self.add_reaction(article_id, user_id, ReactionType.OUTDATED)

    def mark_needs_update(self, article_id: str, user_id: str) -> Optional[ArticleReaction]:
        """Mark an article as needing update."""
        return self.add_reaction(article_id, user_id, ReactionType.NEEDS_UPDATE)

    # View methods
    def record_view(
        self,
        article_id: str,
        user_id: str,
        duration_seconds: int = 0,
        source: str = "",
    ) -> Optional[ArticleView]:
        """Record a view."""
        return self._registry.record_view(article_id, user_id, duration_seconds, source)

    def get_view_stats(self, article_id: str) -> Dict[str, Any]:
        """Get view statistics."""
        return self._registry.get_view_stats(article_id)

    # Comment methods
    def add_comment(
        self,
        article_id: str,
        author_id: str,
        content: str,
        parent_id: Optional[str] = None,
        line_number: Optional[int] = None,
    ) -> Optional[ArticleComment]:
        """Add a comment to an article."""
        return self._registry.add_comment(article_id, author_id, content, parent_id, line_number)

    def update_comment(self, comment_id: str, content: str) -> Optional[ArticleComment]:
        """Update a comment."""
        return self._registry.update_comment(comment_id, content)

    def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment."""
        return self._registry.delete_comment(comment_id)

    def get_comments(self, article_id: str, include_resolved: bool = True) -> List[ArticleComment]:
        """Get comments on an article."""
        return self._registry.get_comments(article_id, include_resolved)

    def resolve_comment(self, comment_id: str, user_id: str) -> Optional[ArticleComment]:
        """Resolve a comment."""
        return self._registry.resolve_comment(comment_id, user_id)

    def get_comment_thread(self, article_id: str, parent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get comment thread structure."""
        comments = self._registry.get_comments(article_id)

        # Build tree
        by_parent: Dict[Optional[str], List[ArticleComment]] = {}
        for comment in comments:
            p = comment.parent_id
            if p not in by_parent:
                by_parent[p] = []
            by_parent[p].append(comment)

        def build_thread(parent: Optional[str]) -> List[Dict[str, Any]]:
            result = []
            for comment in by_parent.get(parent, []):
                result.append({
                    "comment": comment.to_dict(),
                    "replies": build_thread(comment.id),
                })
            return result

        return build_thread(parent_id)

    # Attachment methods
    def add_attachment(
        self,
        article_id: str,
        filename: str,
        file_path: str,
        uploaded_by: str,
        file_size: int = 0,
        mime_type: str = "",
        description: str = "",
    ) -> Optional[ArticleAttachment]:
        """Add an attachment."""
        return self._registry.add_attachment(
            article_id, filename, file_path, uploaded_by, file_size, mime_type, description
        )

    def get_attachments(self, article_id: str) -> List[ArticleAttachment]:
        """Get all attachments."""
        return self._registry.get_attachments(article_id)

    def delete_attachment(self, attachment_id: str) -> bool:
        """Delete an attachment."""
        return self._registry.delete_attachment(attachment_id)

    # Link methods
    def add_link(
        self,
        source_article_id: str,
        target_article_id: str,
        link_type: str,
        created_by: str,
    ) -> Optional[ArticleLink]:
        """Add a link between articles."""
        return self._registry.add_link(source_article_id, target_article_id, link_type, created_by)

    def get_related_articles(self, article_id: str) -> List[Article]:
        """Get related articles."""
        links = self._registry.get_links(article_id)
        related = []
        for link in links:
            article = self._registry.get_article(link.target_article_id)
            if article:
                related.append(article)
        return related

    def get_articles_linking_to(self, article_id: str) -> List[Article]:
        """Get articles that link to this article."""
        backlinks = self._registry.get_backlinks(article_id)
        articles = []
        for link in backlinks:
            article = self._registry.get_article(link.source_article_id)
            if article:
                articles.append(article)
        return articles

    def delete_link(self, link_id: str) -> bool:
        """Delete a link."""
        return self._registry.delete_link(link_id)

    # Category methods
    def create_category(
        self,
        name: str,
        slug: Optional[str] = None,
        description: str = "",
        parent_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        icon: str = "",
        color: str = "",
        position: int = 0,
        created_by: str = "",
    ) -> Category:
        """Create a category."""
        if not slug:
            slug = self._generate_category_slug(name)

        return self._registry.create_category(
            name=name,
            slug=slug,
            description=description,
            parent_id=parent_id,
            workspace_id=workspace_id,
            icon=icon,
            color=color,
            position=position,
            created_by=created_by,
        )

    def _generate_category_slug(self, name: str) -> str:
        """Generate a category slug."""
        import re
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')

        base_slug = slug
        counter = 1
        while self._registry.get_category_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug

    def get_category(self, category_id: str) -> Optional[Category]:
        """Get a category by ID."""
        return self._registry.get_category(category_id)

    def get_category_by_slug(self, slug: str) -> Optional[Category]:
        """Get a category by slug."""
        return self._registry.get_category_by_slug(slug)

    def update_category(
        self,
        category_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        color: Optional[str] = None,
        position: Optional[int] = None,
    ) -> Optional[Category]:
        """Update a category."""
        return self._registry.update_category(
            category_id, name, description, icon, color, position
        )

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        return self._registry.delete_category(category_id)

    def list_categories(
        self,
        workspace_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        status: Optional[CategoryStatus] = None,
    ) -> List[Category]:
        """List categories."""
        return self._registry.list_categories(workspace_id, parent_id, status)

    def get_category_tree(self, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get category tree structure."""
        return self._registry.get_category_tree(workspace_id)

    def get_category_articles(
        self,
        category_id: str,
        include_subcategories: bool = False,
        status: Optional[ArticleStatus] = None,
        limit: int = 50,
    ) -> List[Article]:
        """Get articles in a category."""
        if not include_subcategories:
            return self._registry.list_articles(
                category_id=category_id,
                status=status,
                limit=limit,
            )

        # Get all subcategory IDs
        category_ids = {category_id}
        categories = self._registry.list_categories()

        def get_children(parent: str) -> None:
            for cat in categories:
                if cat.parent_id == parent:
                    category_ids.add(cat.id)
                    get_children(cat.id)

        get_children(category_id)

        # Get articles from all categories
        all_articles = []
        for cid in category_ids:
            articles = self._registry.list_articles(
                category_id=cid,
                status=status,
                limit=limit,
            )
            all_articles.extend(articles)

        # Sort and limit
        all_articles.sort(key=lambda a: a.created_at, reverse=True)
        return all_articles[:limit]

    # Settings methods
    def get_settings(self, workspace_id: str) -> KnowledgeBaseSettings:
        """Get knowledge base settings."""
        return self._registry.get_settings(workspace_id)

    def update_settings(self, workspace_id: str, **kwargs: Any) -> KnowledgeBaseSettings:
        """Update knowledge base settings."""
        return self._registry.update_settings(workspace_id, **kwargs)

    # Statistics methods
    def get_stats(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get knowledge base statistics."""
        return self._registry.get_stats(workspace_id)

    def get_author_stats(self, author_id: str) -> Dict[str, Any]:
        """Get statistics for an author."""
        articles = self._registry.list_articles(author_id=author_id)

        total_views = sum(a.view_count for a in articles)
        total_likes = sum(a.like_count for a in articles)
        total_comments = sum(a.comment_count for a in articles)
        published = [a for a in articles if a.status == ArticleStatus.PUBLISHED]

        return {
            "total_articles": len(articles),
            "published_articles": len(published),
            "draft_articles": len([a for a in articles if a.status == ArticleStatus.DRAFT]),
            "total_views": total_views,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "avg_views_per_article": total_views / len(articles) if articles else 0,
        }

    def get_trending_tags(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get trending tags."""
        articles = self._registry.list_articles(
            workspace_id=workspace_id,
            status=ArticleStatus.PUBLISHED,
        )

        tag_counts: Dict[str, int] = {}
        for article in articles:
            for tag in article.tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)

        return [{"tag": tag, "count": count} for tag, count in sorted_tags[:limit]]


# Global instance management
_knowledge_base_manager: Optional[KnowledgeBaseManager] = None


def get_knowledge_base_manager() -> KnowledgeBaseManager:
    """Get the global knowledge base manager instance."""
    global _knowledge_base_manager
    if _knowledge_base_manager is None:
        _knowledge_base_manager = KnowledgeBaseManager()
    return _knowledge_base_manager


def set_knowledge_base_manager(manager: KnowledgeBaseManager) -> None:
    """Set the global knowledge base manager instance."""
    global _knowledge_base_manager
    _knowledge_base_manager = manager


def reset_knowledge_base_manager() -> None:
    """Reset the global knowledge base manager instance."""
    global _knowledge_base_manager
    _knowledge_base_manager = None
