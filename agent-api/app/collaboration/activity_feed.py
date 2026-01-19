"""
Activity Feed & Timeline Module

Implements activity tracking with:
- Activity event recording and storage
- Activity feed with filtering and pagination
- Activity aggregation for grouping similar events
- Timeline builder with date-based grouping
- Activity search and filtering
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import time
import hashlib


# ==================== Enums ====================

class ActivityType(Enum):
    """Types of activities."""
    # Document activities
    DOCUMENT_CREATED = "document_created"
    DOCUMENT_UPDATED = "document_updated"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_SHARED = "document_shared"
    DOCUMENT_VIEWED = "document_viewed"

    # Collaboration activities
    COMMENT_ADDED = "comment_added"
    COMMENT_REPLIED = "comment_replied"
    COMMENT_RESOLVED = "comment_resolved"
    MENTION_CREATED = "mention_created"

    # User activities
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    USER_INVITED = "user_invited"

    # Task activities
    TASK_CREATED = "task_created"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_UPDATED = "task_updated"

    # Workflow activities
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"

    # System activities
    SYSTEM_EVENT = "system_event"
    ERROR_OCCURRED = "error_occurred"


class ActivityVisibility(Enum):
    """Visibility levels for activities."""
    PUBLIC = "public"  # Visible to all users
    TEAM = "team"  # Visible to team members
    PRIVATE = "private"  # Visible only to involved users
    SYSTEM = "system"  # System-level, admin only


class FeedType(Enum):
    """Types of activity feeds."""
    USER = "user"  # User's personal feed
    DOCUMENT = "document"  # Document-specific feed
    TEAM = "team"  # Team-wide feed
    PROJECT = "project"  # Project-specific feed
    GLOBAL = "global"  # Global activity feed


class AggregationType(Enum):
    """Types of activity aggregation."""
    NONE = "none"  # No aggregation
    COUNT = "count"  # Count similar activities
    BATCH = "batch"  # Batch into groups
    SUMMARY = "summary"  # Summarize activities


# ==================== Data Classes ====================

@dataclass
class Actor:
    """The user or system that performed an activity."""
    id: str
    name: str
    type: str = "user"  # user, system, bot
    avatar_url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActivityTarget:
    """The target/object of an activity."""
    id: str
    type: str  # document, comment, task, user, etc.
    name: str = ""
    url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActivityEntry:
    """A single activity entry."""
    id: str
    activity_type: ActivityType
    actor: Actor
    target: Optional[ActivityTarget] = None
    secondary_target: Optional[ActivityTarget] = None  # e.g., "assigned to" user
    message: str = ""
    visibility: ActivityVisibility = ActivityVisibility.PUBLIC
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: Set[str] = field(default_factory=set)
    parent_id: Optional[str] = None  # For threaded activities
    aggregation_key: Optional[str] = None  # For grouping similar activities

    def __post_init__(self):
        if not self.aggregation_key:
            self.aggregation_key = self._generate_aggregation_key()

    def _generate_aggregation_key(self) -> str:
        """Generate key for aggregating similar activities."""
        parts = [
            self.activity_type.value,
            self.actor.id,
            self.target.type if self.target else "",
        ]
        return "_".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "type": self.activity_type.value,
            "actor": {
                "id": self.actor.id,
                "name": self.actor.name,
                "type": self.actor.type,
            },
            "target": {
                "id": self.target.id,
                "type": self.target.type,
                "name": self.target.name,
            } if self.target else None,
            "message": self.message,
            "visibility": self.visibility.value,
            "timestamp": self.timestamp.isoformat(),
            "tags": list(self.tags),
        }

    def matches_filter(self, filter_spec: "ActivityFilter") -> bool:
        """Check if activity matches a filter."""
        if filter_spec.activity_types and self.activity_type not in filter_spec.activity_types:
            return False
        if filter_spec.actor_ids and self.actor.id not in filter_spec.actor_ids:
            return False
        if filter_spec.target_types and self.target and self.target.type not in filter_spec.target_types:
            return False
        if filter_spec.target_ids and self.target and self.target.id not in filter_spec.target_ids:
            return False
        if filter_spec.visibility_levels and self.visibility not in filter_spec.visibility_levels:
            return False
        if filter_spec.tags and not filter_spec.tags.intersection(self.tags):
            return False
        if filter_spec.start_time and self.timestamp < filter_spec.start_time:
            return False
        if filter_spec.end_time and self.timestamp > filter_spec.end_time:
            return False
        return True


@dataclass
class ActivityFilter:
    """Filter specification for activities."""
    activity_types: Optional[Set[ActivityType]] = None
    actor_ids: Optional[Set[str]] = None
    target_types: Optional[Set[str]] = None
    target_ids: Optional[Set[str]] = None
    visibility_levels: Optional[Set[ActivityVisibility]] = None
    tags: Optional[Set[str]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    search_query: Optional[str] = None


@dataclass
class AggregatedActivity:
    """An aggregated group of similar activities."""
    id: str
    aggregation_key: str
    activity_type: ActivityType
    activities: List[ActivityEntry] = field(default_factory=list)
    actors: List[Actor] = field(default_factory=list)
    target: Optional[ActivityTarget] = None
    count: int = 0
    first_timestamp: datetime = field(default_factory=datetime.utcnow)
    last_timestamp: datetime = field(default_factory=datetime.utcnow)
    summary: str = ""

    def add_activity(self, activity: ActivityEntry) -> None:
        """Add an activity to the aggregation."""
        self.activities.append(activity)
        if activity.actor not in self.actors:
            self.actors.append(activity.actor)
        self.count = len(self.activities)
        if activity.timestamp < self.first_timestamp:
            self.first_timestamp = activity.timestamp
        if activity.timestamp > self.last_timestamp:
            self.last_timestamp = activity.timestamp
        self._update_summary()

    def _update_summary(self) -> None:
        """Update the summary message."""
        actor_count = len(self.actors)
        if self.count == 1:
            self.summary = self.activities[0].message
        elif actor_count == 1:
            # Same actor, multiple actions
            self.summary = f"{self.actors[0].name} ({self.count} times)"
        elif actor_count == 2:
            names = [a.name for a in self.actors[:2]]
            self.summary = f"{names[0]} and {names[1]}"
        else:
            first_name = self.actors[0].name
            others = actor_count - 1
            self.summary = f"{first_name} and {others} others"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "aggregation_key": self.aggregation_key,
            "type": self.activity_type.value,
            "count": self.count,
            "actors": [{"id": a.id, "name": a.name} for a in self.actors[:5]],
            "target": {
                "id": self.target.id,
                "type": self.target.type,
                "name": self.target.name,
            } if self.target else None,
            "summary": self.summary,
            "first_timestamp": self.first_timestamp.isoformat(),
            "last_timestamp": self.last_timestamp.isoformat(),
        }


@dataclass
class TimelineGroup:
    """A group of activities in a timeline."""
    id: str
    label: str  # e.g., "Today", "Yesterday", "January 15, 2025"
    date: datetime
    activities: List[ActivityEntry] = field(default_factory=list)
    aggregated: List[AggregatedActivity] = field(default_factory=list)

    @property
    def count(self) -> int:
        """Get total activity count."""
        return len(self.activities) + sum(a.count for a in self.aggregated)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "label": self.label,
            "date": self.date.isoformat(),
            "count": self.count,
            "activities": [a.to_dict() for a in self.activities],
            "aggregated": [a.to_dict() for a in self.aggregated],
        }


@dataclass
class FeedPage:
    """A page of activity feed results."""
    activities: List[ActivityEntry] = field(default_factory=list)
    total_count: int = 0
    page: int = 1
    page_size: int = 20
    has_more: bool = False
    cursor: Optional[str] = None

    @property
    def page_count(self) -> int:
        """Get total number of pages."""
        if self.page_size <= 0:
            return 0
        return (self.total_count + self.page_size - 1) // self.page_size


@dataclass
class ActivityFeedConfig:
    """Configuration for activity feed."""
    max_activities: int = 100000
    default_page_size: int = 20
    max_page_size: int = 100
    aggregation_window_minutes: int = 60
    enable_aggregation: bool = True
    retention_days: int = 90
    enable_search: bool = True


# ==================== Activity Aggregator ====================

class ActivityAggregator:
    """Aggregates similar activities together."""

    def __init__(self, window_minutes: int = 60):
        self.window_minutes = window_minutes

    def aggregate(
        self,
        activities: List[ActivityEntry],
        aggregation_type: AggregationType = AggregationType.COUNT
    ) -> List[AggregatedActivity]:
        """Aggregate activities by their aggregation key."""
        if aggregation_type == AggregationType.NONE:
            return []

        # Group by aggregation key and time window
        groups: Dict[str, AggregatedActivity] = {}

        for activity in activities:
            key = self._get_window_key(activity)

            if key not in groups:
                groups[key] = AggregatedActivity(
                    id=f"agg_{key}",
                    aggregation_key=activity.aggregation_key,
                    activity_type=activity.activity_type,
                    target=activity.target,
                    first_timestamp=activity.timestamp,
                    last_timestamp=activity.timestamp,
                )

            groups[key].add_activity(activity)

        # Filter out single-activity groups
        return [g for g in groups.values() if g.count > 1]

    def _get_window_key(self, activity: ActivityEntry) -> str:
        """Get the time-windowed aggregation key."""
        window_start = activity.timestamp.replace(
            minute=(activity.timestamp.minute // self.window_minutes) * self.window_minutes,
            second=0,
            microsecond=0
        )
        return f"{activity.aggregation_key}_{window_start.isoformat()}"

    def should_aggregate(
        self,
        activity1: ActivityEntry,
        activity2: ActivityEntry
    ) -> bool:
        """Check if two activities should be aggregated."""
        if activity1.aggregation_key != activity2.aggregation_key:
            return False
        time_diff = abs((activity1.timestamp - activity2.timestamp).total_seconds())
        return time_diff <= self.window_minutes * 60


# ==================== Timeline Builder ====================

class TimelineBuilder:
    """Builds timeline views from activities."""

    def __init__(self, aggregator: Optional[ActivityAggregator] = None):
        self.aggregator = aggregator or ActivityAggregator()

    def build_timeline(
        self,
        activities: List[ActivityEntry],
        group_by: str = "day",
        aggregate: bool = True
    ) -> List[TimelineGroup]:
        """Build a timeline from activities."""
        if not activities:
            return []

        # Sort by timestamp descending
        sorted_activities = sorted(activities, key=lambda a: a.timestamp, reverse=True)

        # Group by date
        groups: Dict[str, TimelineGroup] = {}
        for activity in sorted_activities:
            group_key = self._get_group_key(activity.timestamp, group_by)
            label = self._get_group_label(activity.timestamp, group_by)

            if group_key not in groups:
                groups[group_key] = TimelineGroup(
                    id=f"timeline_{group_key}",
                    label=label,
                    date=activity.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
                )

            groups[group_key].activities.append(activity)

        # Apply aggregation within each group
        if aggregate:
            for group in groups.values():
                aggregated = self.aggregator.aggregate(group.activities)
                if aggregated:
                    group.aggregated = aggregated
                    # Remove aggregated activities from main list
                    aggregated_ids = set()
                    for agg in aggregated:
                        for act in agg.activities:
                            aggregated_ids.add(act.id)
                    group.activities = [a for a in group.activities if a.id not in aggregated_ids]

        # Sort groups by date descending
        return sorted(groups.values(), key=lambda g: g.date, reverse=True)

    def _get_group_key(self, timestamp: datetime, group_by: str) -> str:
        """Get the grouping key for a timestamp."""
        if group_by == "hour":
            return timestamp.strftime("%Y-%m-%d-%H")
        elif group_by == "day":
            return timestamp.strftime("%Y-%m-%d")
        elif group_by == "week":
            return timestamp.strftime("%Y-W%W")
        elif group_by == "month":
            return timestamp.strftime("%Y-%m")
        return timestamp.strftime("%Y-%m-%d")

    def _get_group_label(self, timestamp: datetime, group_by: str) -> str:
        """Get a human-readable label for the group."""
        now = datetime.utcnow()
        today = now.date()
        activity_date = timestamp.date()

        if activity_date == today:
            return "Today"
        elif activity_date == today - timedelta(days=1):
            return "Yesterday"
        elif (today - activity_date).days < 7:
            return timestamp.strftime("%A")  # Day name
        elif group_by == "week":
            return f"Week of {timestamp.strftime('%B %d')}"
        elif group_by == "month":
            return timestamp.strftime("%B %Y")
        else:
            return timestamp.strftime("%B %d, %Y")


# ==================== Activity Feed ====================

class ActivityFeed:
    """Manages an activity feed for a specific context."""

    def __init__(
        self,
        feed_id: str,
        feed_type: FeedType,
        config: Optional[ActivityFeedConfig] = None
    ):
        self.feed_id = feed_id
        self.feed_type = feed_type
        self.config = config or ActivityFeedConfig()
        self._activities: List[ActivityEntry] = []
        self._index_by_id: Dict[str, ActivityEntry] = {}
        self._index_by_actor: Dict[str, List[str]] = {}
        self._index_by_target: Dict[str, List[str]] = {}
        self._index_by_type: Dict[ActivityType, List[str]] = {}

    def add_activity(self, activity: ActivityEntry) -> bool:
        """Add an activity to the feed."""
        if len(self._activities) >= self.config.max_activities:
            # Remove oldest activity
            oldest = self._activities.pop(0)
            self._remove_from_indexes(oldest)

        self._activities.append(activity)
        self._add_to_indexes(activity)
        return True

    def get_activity(self, activity_id: str) -> Optional[ActivityEntry]:
        """Get an activity by ID."""
        return self._index_by_id.get(activity_id)

    def get_activities(
        self,
        filter_spec: Optional[ActivityFilter] = None,
        page: int = 1,
        page_size: Optional[int] = None
    ) -> FeedPage:
        """Get activities with optional filtering and pagination."""
        page_size = min(page_size or self.config.default_page_size, self.config.max_page_size)

        # Apply filter
        if filter_spec:
            filtered = [a for a in self._activities if a.matches_filter(filter_spec)]
        else:
            filtered = self._activities.copy()

        # Sort by timestamp descending
        filtered.sort(key=lambda a: a.timestamp, reverse=True)

        # Paginate
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        page_activities = filtered[start:end]

        return FeedPage(
            activities=page_activities,
            total_count=total,
            page=page,
            page_size=page_size,
            has_more=end < total,
            cursor=page_activities[-1].id if page_activities else None
        )

    def get_by_actor(self, actor_id: str, limit: int = 50) -> List[ActivityEntry]:
        """Get activities by actor."""
        activity_ids = self._index_by_actor.get(actor_id, [])
        activities = [self._index_by_id[aid] for aid in activity_ids if aid in self._index_by_id]
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]

    def get_by_target(self, target_id: str, limit: int = 50) -> List[ActivityEntry]:
        """Get activities by target."""
        activity_ids = self._index_by_target.get(target_id, [])
        activities = [self._index_by_id[aid] for aid in activity_ids if aid in self._index_by_id]
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]

    def get_by_type(self, activity_type: ActivityType, limit: int = 50) -> List[ActivityEntry]:
        """Get activities by type."""
        activity_ids = self._index_by_type.get(activity_type, [])
        activities = [self._index_by_id[aid] for aid in activity_ids if aid in self._index_by_id]
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:limit]

    def search(self, query: str, limit: int = 50) -> List[ActivityEntry]:
        """Search activities by message content."""
        if not self.config.enable_search:
            return []
        query_lower = query.lower()
        results = [
            a for a in self._activities
            if query_lower in a.message.lower()
            or (a.target and query_lower in a.target.name.lower())
            or query_lower in a.actor.name.lower()
        ]
        results.sort(key=lambda a: a.timestamp, reverse=True)
        return results[:limit]

    def get_recent(self, limit: int = 20) -> List[ActivityEntry]:
        """Get most recent activities."""
        sorted_activities = sorted(self._activities, key=lambda a: a.timestamp, reverse=True)
        return sorted_activities[:limit]

    def cleanup_old(self, before: Optional[datetime] = None) -> int:
        """Remove activities older than specified date."""
        if before is None:
            before = datetime.utcnow() - timedelta(days=self.config.retention_days)

        to_remove = [a for a in self._activities if a.timestamp < before]
        for activity in to_remove:
            self._activities.remove(activity)
            self._remove_from_indexes(activity)

        return len(to_remove)

    @property
    def count(self) -> int:
        """Get total activity count."""
        return len(self._activities)

    def _add_to_indexes(self, activity: ActivityEntry) -> None:
        """Add activity to indexes."""
        self._index_by_id[activity.id] = activity

        if activity.actor.id not in self._index_by_actor:
            self._index_by_actor[activity.actor.id] = []
        self._index_by_actor[activity.actor.id].append(activity.id)

        if activity.target:
            if activity.target.id not in self._index_by_target:
                self._index_by_target[activity.target.id] = []
            self._index_by_target[activity.target.id].append(activity.id)

        if activity.activity_type not in self._index_by_type:
            self._index_by_type[activity.activity_type] = []
        self._index_by_type[activity.activity_type].append(activity.id)

    def _remove_from_indexes(self, activity: ActivityEntry) -> None:
        """Remove activity from indexes."""
        self._index_by_id.pop(activity.id, None)

        if activity.actor.id in self._index_by_actor:
            self._index_by_actor[activity.actor.id] = [
                aid for aid in self._index_by_actor[activity.actor.id]
                if aid != activity.id
            ]

        if activity.target and activity.target.id in self._index_by_target:
            self._index_by_target[activity.target.id] = [
                aid for aid in self._index_by_target[activity.target.id]
                if aid != activity.id
            ]

        if activity.activity_type in self._index_by_type:
            self._index_by_type[activity.activity_type] = [
                aid for aid in self._index_by_type[activity.activity_type]
                if aid != activity.id
            ]


# ==================== Activity Manager ====================

class ActivityManager:
    """Central manager for all activity tracking."""

    def __init__(self, config: Optional[ActivityFeedConfig] = None):
        self.config = config or ActivityFeedConfig()
        self._feeds: Dict[str, ActivityFeed] = {}
        self._global_feed = ActivityFeed("global", FeedType.GLOBAL, self.config)
        self._aggregator = ActivityAggregator(self.config.aggregation_window_minutes)
        self._timeline_builder = TimelineBuilder(self._aggregator)
        self._activity_counter = 0
        self._callbacks: Dict[str, List[Callable]] = {
            "activity_created": [],
            "activity_deleted": [],
        }
        self._formatters: Dict[ActivityType, Callable] = {}
        self._register_default_formatters()

    def _register_default_formatters(self) -> None:
        """Register default message formatters."""
        self._formatters[ActivityType.DOCUMENT_CREATED] = lambda a: (
            f"{a.actor.name} created {a.target.name if a.target else 'a document'}"
        )
        self._formatters[ActivityType.DOCUMENT_UPDATED] = lambda a: (
            f"{a.actor.name} updated {a.target.name if a.target else 'a document'}"
        )
        self._formatters[ActivityType.COMMENT_ADDED] = lambda a: (
            f"{a.actor.name} commented on {a.target.name if a.target else 'a document'}"
        )
        self._formatters[ActivityType.TASK_ASSIGNED] = lambda a: (
            f"{a.actor.name} assigned a task to {a.secondary_target.name if a.secondary_target else 'someone'}"
        )
        self._formatters[ActivityType.USER_JOINED] = lambda a: (
            f"{a.actor.name} joined"
        )

    def register_formatter(
        self,
        activity_type: ActivityType,
        formatter: Callable[[ActivityEntry], str]
    ) -> None:
        """Register a custom message formatter."""
        self._formatters[activity_type] = formatter

    def get_or_create_feed(
        self,
        feed_id: str,
        feed_type: FeedType
    ) -> ActivityFeed:
        """Get or create an activity feed."""
        key = f"{feed_type.value}:{feed_id}"
        if key not in self._feeds:
            self._feeds[key] = ActivityFeed(feed_id, feed_type, self.config)
        return self._feeds[key]

    def record_activity(
        self,
        activity_type: ActivityType,
        actor: Actor,
        target: Optional[ActivityTarget] = None,
        secondary_target: Optional[ActivityTarget] = None,
        message: Optional[str] = None,
        visibility: ActivityVisibility = ActivityVisibility.PUBLIC,
        feed_ids: Optional[List[Tuple[str, FeedType]]] = None,
        tags: Optional[Set[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ActivityEntry:
        """Record a new activity."""
        self._activity_counter += 1
        activity_id = f"act_{int(time.time() * 1000)}_{self._activity_counter}"

        # Generate message if not provided
        if message is None:
            formatter = self._formatters.get(activity_type)
            if formatter:
                # Create temporary activity for formatting
                temp = ActivityEntry(
                    id=activity_id,
                    activity_type=activity_type,
                    actor=actor,
                    target=target,
                    secondary_target=secondary_target,
                )
                message = formatter(temp)
            else:
                message = f"{actor.name} performed {activity_type.value}"

        activity = ActivityEntry(
            id=activity_id,
            activity_type=activity_type,
            actor=actor,
            target=target,
            secondary_target=secondary_target,
            message=message,
            visibility=visibility,
            tags=tags or set(),
            metadata=metadata or {},
        )

        # Add to global feed
        self._global_feed.add_activity(activity)

        # Add to specified feeds
        if feed_ids:
            for feed_id, feed_type in feed_ids:
                feed = self.get_or_create_feed(feed_id, feed_type)
                feed.add_activity(activity)

        # Auto-add to actor's user feed
        user_feed = self.get_or_create_feed(actor.id, FeedType.USER)
        user_feed.add_activity(activity)

        # Auto-add to target's feed if applicable
        if target and target.type == "document":
            doc_feed = self.get_or_create_feed(target.id, FeedType.DOCUMENT)
            doc_feed.add_activity(activity)

        self._emit_event("activity_created", activity)
        return activity

    def get_user_feed(
        self,
        user_id: str,
        filter_spec: Optional[ActivityFilter] = None,
        page: int = 1,
        page_size: int = 20
    ) -> FeedPage:
        """Get a user's activity feed."""
        feed = self.get_or_create_feed(user_id, FeedType.USER)
        return feed.get_activities(filter_spec, page, page_size)

    def get_document_feed(
        self,
        document_id: str,
        filter_spec: Optional[ActivityFilter] = None,
        page: int = 1,
        page_size: int = 20
    ) -> FeedPage:
        """Get a document's activity feed."""
        feed = self.get_or_create_feed(document_id, FeedType.DOCUMENT)
        return feed.get_activities(filter_spec, page, page_size)

    def get_global_feed(
        self,
        filter_spec: Optional[ActivityFilter] = None,
        page: int = 1,
        page_size: int = 20
    ) -> FeedPage:
        """Get the global activity feed."""
        return self._global_feed.get_activities(filter_spec, page, page_size)

    def get_timeline(
        self,
        feed_id: str,
        feed_type: FeedType,
        group_by: str = "day",
        filter_spec: Optional[ActivityFilter] = None,
        limit: int = 100
    ) -> List[TimelineGroup]:
        """Get a timeline view of activities."""
        feed = self.get_or_create_feed(feed_id, feed_type)
        page = feed.get_activities(filter_spec, page=1, page_size=limit)
        return self._timeline_builder.build_timeline(
            page.activities,
            group_by=group_by,
            aggregate=self.config.enable_aggregation
        )

    def get_user_timeline(
        self,
        user_id: str,
        group_by: str = "day",
        limit: int = 100
    ) -> List[TimelineGroup]:
        """Get a user's timeline."""
        return self.get_timeline(user_id, FeedType.USER, group_by, limit=limit)

    def search_activities(
        self,
        query: str,
        feed_id: Optional[str] = None,
        feed_type: Optional[FeedType] = None,
        limit: int = 50
    ) -> List[ActivityEntry]:
        """Search activities across feeds."""
        if feed_id and feed_type:
            feed = self.get_or_create_feed(feed_id, feed_type)
            return feed.search(query, limit)
        return self._global_feed.search(query, limit)

    def get_activity_count(
        self,
        feed_id: str,
        feed_type: FeedType,
        activity_types: Optional[Set[ActivityType]] = None,
        since: Optional[datetime] = None
    ) -> int:
        """Get count of activities."""
        feed = self.get_or_create_feed(feed_id, feed_type)
        filter_spec = ActivityFilter(
            activity_types=activity_types,
            start_time=since
        )
        page = feed.get_activities(filter_spec, page=1, page_size=1)
        return page.total_count

    def get_recent_actors(
        self,
        feed_id: str,
        feed_type: FeedType,
        limit: int = 10
    ) -> List[Actor]:
        """Get recent unique actors in a feed."""
        feed = self.get_or_create_feed(feed_id, feed_type)
        recent = feed.get_recent(limit * 3)  # Get more to dedupe

        seen_ids = set()
        actors = []
        for activity in recent:
            if activity.actor.id not in seen_ids:
                actors.append(activity.actor)
                seen_ids.add(activity.actor.id)
                if len(actors) >= limit:
                    break

        return actors

    def cleanup(self, before: Optional[datetime] = None) -> Dict[str, int]:
        """Cleanup old activities from all feeds."""
        results = {"global": self._global_feed.cleanup_old(before)}
        for key, feed in self._feeds.items():
            results[key] = feed.cleanup_old(before)
        return results

    def on(self, event: str, callback: Callable) -> None:
        """Register event callback."""
        if event in self._callbacks:
            self._callbacks[event].append(callback)

    def _emit_event(self, event: str, *args) -> None:
        """Emit event to callbacks."""
        for callback in self._callbacks.get(event, []):
            try:
                callback(*args)
            except Exception:
                pass

    def get_stats(self) -> Dict[str, Any]:
        """Get activity manager statistics."""
        type_counts = {}
        for activity_type in self._global_feed._index_by_type:
            type_counts[activity_type.value] = len(
                self._global_feed._index_by_type[activity_type]
            )

        return {
            "total_activities": self._global_feed.count,
            "total_feeds": len(self._feeds) + 1,  # +1 for global
            "activity_types": type_counts,
            "total_actors": len(self._global_feed._index_by_actor),
            "total_targets": len(self._global_feed._index_by_target),
        }


# ==================== Global Instances ====================

_activity_manager: Optional[ActivityManager] = None


def get_activity_manager() -> Optional[ActivityManager]:
    """Get the global activity manager."""
    return _activity_manager


def set_activity_manager(manager: ActivityManager) -> None:
    """Set the global activity manager."""
    global _activity_manager
    _activity_manager = manager


def reset_activity_manager() -> None:
    """Reset the global activity manager."""
    global _activity_manager
    _activity_manager = None


# ==================== Activity Builder ====================

class ActivityBuilder:
    """Fluent builder for creating activities."""

    def __init__(self, manager: ActivityManager):
        self._manager = manager
        self._activity_type: Optional[ActivityType] = None
        self._actor: Optional[Actor] = None
        self._target: Optional[ActivityTarget] = None
        self._secondary_target: Optional[ActivityTarget] = None
        self._message: Optional[str] = None
        self._visibility = ActivityVisibility.PUBLIC
        self._feed_ids: List[Tuple[str, FeedType]] = []
        self._tags: Set[str] = set()
        self._metadata: Dict[str, Any] = {}

    def type(self, activity_type: ActivityType) -> "ActivityBuilder":
        """Set activity type."""
        self._activity_type = activity_type
        return self

    def actor(
        self,
        actor_id: str,
        name: str,
        actor_type: str = "user"
    ) -> "ActivityBuilder":
        """Set actor."""
        self._actor = Actor(id=actor_id, name=name, type=actor_type)
        return self

    def target(
        self,
        target_id: str,
        target_type: str,
        name: str = ""
    ) -> "ActivityBuilder":
        """Set target."""
        self._target = ActivityTarget(id=target_id, type=target_type, name=name)
        return self

    def secondary_target(
        self,
        target_id: str,
        target_type: str,
        name: str = ""
    ) -> "ActivityBuilder":
        """Set secondary target."""
        self._secondary_target = ActivityTarget(id=target_id, type=target_type, name=name)
        return self

    def message(self, message: str) -> "ActivityBuilder":
        """Set message."""
        self._message = message
        return self

    def visibility(self, visibility: ActivityVisibility) -> "ActivityBuilder":
        """Set visibility."""
        self._visibility = visibility
        return self

    def add_feed(self, feed_id: str, feed_type: FeedType) -> "ActivityBuilder":
        """Add feed to post to."""
        self._feed_ids.append((feed_id, feed_type))
        return self

    def tag(self, *tags: str) -> "ActivityBuilder":
        """Add tags."""
        self._tags.update(tags)
        return self

    def meta(self, **kwargs) -> "ActivityBuilder":
        """Add metadata."""
        self._metadata.update(kwargs)
        return self

    def record(self) -> Optional[ActivityEntry]:
        """Record the activity."""
        if not self._activity_type or not self._actor:
            return None

        return self._manager.record_activity(
            activity_type=self._activity_type,
            actor=self._actor,
            target=self._target,
            secondary_target=self._secondary_target,
            message=self._message,
            visibility=self._visibility,
            feed_ids=self._feed_ids if self._feed_ids else None,
            tags=self._tags if self._tags else None,
            metadata=self._metadata if self._metadata else None,
        )
