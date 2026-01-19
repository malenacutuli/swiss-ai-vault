"""
Tests for Activity Feed & Timeline Module
"""

import pytest
import time
from datetime import datetime, timedelta

from app.collaboration.activity_feed import (
    ActivityManager,
    ActivityFeed,
    ActivityFeedConfig,
    ActivityEntry,
    ActivityType,
    ActivityVisibility,
    ActivityFilter,
    ActivityTarget,
    Actor,
    AggregatedActivity,
    ActivityAggregator,
    AggregationType,
    TimelineBuilder,
    TimelineGroup,
    FeedPage,
    FeedType,
    ActivityBuilder,
    get_activity_manager,
    set_activity_manager,
    reset_activity_manager,
)


# ==================== Actor Tests ====================

class TestActor:
    """Tests for Actor class."""

    def test_create_actor(self):
        """Test creating an actor."""
        actor = Actor(id="user_1", name="Alice", type="user")
        assert actor.id == "user_1"
        assert actor.name == "Alice"
        assert actor.type == "user"

    def test_actor_with_avatar(self):
        """Test actor with avatar URL."""
        actor = Actor(
            id="user_1",
            name="Alice",
            avatar_url="https://example.com/avatar.png"
        )
        assert actor.avatar_url == "https://example.com/avatar.png"

    def test_actor_with_metadata(self):
        """Test actor with metadata."""
        actor = Actor(
            id="user_1",
            name="Alice",
            metadata={"role": "admin"}
        )
        assert actor.metadata["role"] == "admin"


# ==================== ActivityTarget Tests ====================

class TestActivityTarget:
    """Tests for ActivityTarget class."""

    def test_create_target(self):
        """Test creating a target."""
        target = ActivityTarget(id="doc_1", type="document", name="My Document")
        assert target.id == "doc_1"
        assert target.type == "document"
        assert target.name == "My Document"

    def test_target_with_url(self):
        """Test target with URL."""
        target = ActivityTarget(
            id="doc_1",
            type="document",
            url="/documents/doc_1"
        )
        assert target.url == "/documents/doc_1"


# ==================== ActivityEntry Tests ====================

class TestActivityEntry:
    """Tests for ActivityEntry class."""

    def test_create_activity(self):
        """Test creating an activity entry."""
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            message="Alice created a document"
        )
        assert activity.id == "act_1"
        assert activity.activity_type == ActivityType.DOCUMENT_CREATED
        assert activity.actor.name == "Alice"

    def test_activity_with_target(self):
        """Test activity with target."""
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document", name="Report")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_UPDATED,
            actor=actor,
            target=target
        )
        assert activity.target.id == "doc_1"

    def test_activity_visibility(self):
        """Test activity visibility."""
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            visibility=ActivityVisibility.PRIVATE
        )
        assert activity.visibility == ActivityVisibility.PRIVATE

    def test_activity_tags(self):
        """Test activity tags."""
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            tags={"important", "project-x"}
        )
        assert "important" in activity.tags
        assert "project-x" in activity.tags

    def test_activity_to_dict(self):
        """Test converting activity to dict."""
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document", name="Report")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            target=target,
            message="Created Report"
        )
        data = activity.to_dict()
        assert data["id"] == "act_1"
        assert data["type"] == "document_created"
        assert data["actor"]["name"] == "Alice"
        assert data["target"]["name"] == "Report"

    def test_aggregation_key_generation(self):
        """Test aggregation key is generated."""
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_UPDATED,
            actor=actor,
            target=target
        )
        assert activity.aggregation_key is not None
        assert "document_updated" in activity.aggregation_key


# ==================== ActivityFilter Tests ====================

class TestActivityFilter:
    """Tests for ActivityFilter class."""

    def test_create_filter(self):
        """Test creating a filter."""
        filter_spec = ActivityFilter(
            activity_types={ActivityType.DOCUMENT_CREATED, ActivityType.DOCUMENT_UPDATED}
        )
        assert len(filter_spec.activity_types) == 2

    def test_filter_by_actor(self):
        """Test filtering by actor."""
        filter_spec = ActivityFilter(actor_ids={"user_1", "user_2"})
        actor1 = Actor(id="user_1", name="Alice")
        actor2 = Actor(id="user_3", name="Charlie")

        activity1 = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor1
        )
        activity2 = ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor2
        )

        assert activity1.matches_filter(filter_spec)
        assert not activity2.matches_filter(filter_spec)

    def test_filter_by_type(self):
        """Test filtering by activity type."""
        filter_spec = ActivityFilter(
            activity_types={ActivityType.DOCUMENT_CREATED}
        )
        actor = Actor(id="user_1", name="Alice")

        activity1 = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        )
        activity2 = ActivityEntry(
            id="act_2",
            activity_type=ActivityType.COMMENT_ADDED,
            actor=actor
        )

        assert activity1.matches_filter(filter_spec)
        assert not activity2.matches_filter(filter_spec)

    def test_filter_by_time_range(self):
        """Test filtering by time range."""
        now = datetime.utcnow()
        filter_spec = ActivityFilter(
            start_time=now - timedelta(hours=1),
            end_time=now
        )
        actor = Actor(id="user_1", name="Alice")

        activity1 = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            timestamp=now - timedelta(minutes=30)
        )
        activity2 = ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            timestamp=now - timedelta(hours=2)
        )

        assert activity1.matches_filter(filter_spec)
        assert not activity2.matches_filter(filter_spec)

    def test_filter_by_tags(self):
        """Test filtering by tags."""
        filter_spec = ActivityFilter(tags={"important"})
        actor = Actor(id="user_1", name="Alice")

        activity1 = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            tags={"important", "urgent"}
        )
        activity2 = ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            tags={"normal"}
        )

        assert activity1.matches_filter(filter_spec)
        assert not activity2.matches_filter(filter_spec)


# ==================== ActivityAggregator Tests ====================

class TestActivityAggregator:
    """Tests for ActivityAggregator class."""

    def test_create_aggregator(self):
        """Test creating an aggregator."""
        aggregator = ActivityAggregator(window_minutes=60)
        assert aggregator.window_minutes == 60

    def test_aggregate_similar_activities(self):
        """Test aggregating similar activities from same actor."""
        aggregator = ActivityAggregator(window_minutes=60)
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document")

        now = datetime.utcnow()
        activities = [
            ActivityEntry(
                id="act_1",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor,
                target=target,
                timestamp=now
            ),
            ActivityEntry(
                id="act_2",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor,
                target=target,
                timestamp=now + timedelta(minutes=5)
            ),
            ActivityEntry(
                id="act_3",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor,
                target=target,
                timestamp=now + timedelta(minutes=10)
            ),
        ]

        aggregated = aggregator.aggregate(activities)
        assert len(aggregated) >= 1
        assert aggregated[0].count >= 2

    def test_no_aggregation_for_different_types(self):
        """Test no aggregation for different activity types."""
        aggregator = ActivityAggregator(window_minutes=60)
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document")

        now = datetime.utcnow()
        activities = [
            ActivityEntry(
                id="act_1",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor,
                target=target,
                timestamp=now
            ),
            ActivityEntry(
                id="act_2",
                activity_type=ActivityType.DOCUMENT_UPDATED,
                actor=actor,
                target=target,
                timestamp=now
            ),
        ]

        aggregated = aggregator.aggregate(activities)
        # Single activities shouldn't be aggregated
        assert len(aggregated) == 0

    def test_should_aggregate(self):
        """Test should_aggregate check."""
        aggregator = ActivityAggregator(window_minutes=60)
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document")

        now = datetime.utcnow()
        activity1 = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_VIEWED,
            actor=actor,
            target=target,
            timestamp=now
        )
        activity2 = ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_VIEWED,
            actor=actor,
            target=target,
            timestamp=now + timedelta(minutes=30)
        )
        activity3 = ActivityEntry(
            id="act_3",
            activity_type=ActivityType.DOCUMENT_VIEWED,
            actor=actor,
            target=target,
            timestamp=now + timedelta(hours=2)
        )

        assert aggregator.should_aggregate(activity1, activity2)
        assert not aggregator.should_aggregate(activity1, activity3)


# ==================== AggregatedActivity Tests ====================

class TestAggregatedActivity:
    """Tests for AggregatedActivity class."""

    def test_create_aggregated_activity(self):
        """Test creating aggregated activity."""
        agg = AggregatedActivity(
            id="agg_1",
            aggregation_key="key_1",
            activity_type=ActivityType.DOCUMENT_VIEWED
        )
        assert agg.id == "agg_1"
        assert agg.count == 0

    def test_add_activity_to_aggregation(self):
        """Test adding activity to aggregation."""
        agg = AggregatedActivity(
            id="agg_1",
            aggregation_key="key_1",
            activity_type=ActivityType.DOCUMENT_VIEWED
        )
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_VIEWED,
            actor=actor
        )
        agg.add_activity(activity)

        assert agg.count == 1
        assert len(agg.actors) == 1

    def test_aggregation_summary(self):
        """Test aggregation summary generation."""
        agg = AggregatedActivity(
            id="agg_1",
            aggregation_key="key_1",
            activity_type=ActivityType.DOCUMENT_VIEWED
        )

        for i in range(5):
            actor = Actor(id=f"user_{i}", name=f"User{i}")
            activity = ActivityEntry(
                id=f"act_{i}",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor
            )
            agg.add_activity(activity)

        assert agg.count == 5
        assert "others" in agg.summary

    def test_to_dict(self):
        """Test converting aggregation to dict."""
        agg = AggregatedActivity(
            id="agg_1",
            aggregation_key="key_1",
            activity_type=ActivityType.DOCUMENT_VIEWED
        )
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_VIEWED,
            actor=actor
        )
        agg.add_activity(activity)

        data = agg.to_dict()
        assert data["id"] == "agg_1"
        assert data["count"] == 1


# ==================== TimelineBuilder Tests ====================

class TestTimelineBuilder:
    """Tests for TimelineBuilder class."""

    def test_create_builder(self):
        """Test creating timeline builder."""
        builder = TimelineBuilder()
        assert builder is not None

    def test_build_timeline(self):
        """Test building a timeline."""
        builder = TimelineBuilder()
        actor = Actor(id="user_1", name="Alice")

        now = datetime.utcnow()
        activities = [
            ActivityEntry(
                id="act_1",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor,
                timestamp=now
            ),
            ActivityEntry(
                id="act_2",
                activity_type=ActivityType.DOCUMENT_UPDATED,
                actor=actor,
                timestamp=now - timedelta(days=1)
            ),
        ]

        timeline = builder.build_timeline(activities, group_by="day")
        assert len(timeline) == 2

    def test_timeline_labels(self):
        """Test timeline group labels."""
        builder = TimelineBuilder()
        actor = Actor(id="user_1", name="Alice")

        now = datetime.utcnow()
        activities = [
            ActivityEntry(
                id="act_1",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor,
                timestamp=now
            ),
        ]

        timeline = builder.build_timeline(activities, group_by="day")
        assert timeline[0].label == "Today"

    def test_timeline_with_aggregation(self):
        """Test timeline with aggregation enabled."""
        builder = TimelineBuilder()
        actor1 = Actor(id="user_1", name="Alice")
        actor2 = Actor(id="user_2", name="Bob")
        target = ActivityTarget(id="doc_1", type="document")

        now = datetime.utcnow()
        activities = [
            ActivityEntry(
                id="act_1",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor1,
                target=target,
                timestamp=now
            ),
            ActivityEntry(
                id="act_2",
                activity_type=ActivityType.DOCUMENT_VIEWED,
                actor=actor2,
                target=target,
                timestamp=now + timedelta(minutes=5)
            ),
        ]

        timeline = builder.build_timeline(activities, aggregate=True)
        assert len(timeline) >= 1


# ==================== TimelineGroup Tests ====================

class TestTimelineGroup:
    """Tests for TimelineGroup class."""

    def test_create_group(self):
        """Test creating timeline group."""
        group = TimelineGroup(
            id="group_1",
            label="Today",
            date=datetime.utcnow()
        )
        assert group.id == "group_1"
        assert group.label == "Today"

    def test_group_count(self):
        """Test group activity count."""
        group = TimelineGroup(
            id="group_1",
            label="Today",
            date=datetime.utcnow()
        )
        actor = Actor(id="user_1", name="Alice")
        group.activities.append(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        ))
        group.activities.append(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_UPDATED,
            actor=actor
        ))

        assert group.count == 2


# ==================== ActivityFeed Tests ====================

class TestActivityFeed:
    """Tests for ActivityFeed class."""

    def test_create_feed(self):
        """Test creating an activity feed."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        assert feed.feed_id == "feed_1"
        assert feed.feed_type == FeedType.USER
        assert feed.count == 0

    def test_add_activity(self):
        """Test adding activity to feed."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        )
        feed.add_activity(activity)
        assert feed.count == 1

    def test_get_activity(self):
        """Test getting activity by ID."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")
        activity = ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        )
        feed.add_activity(activity)

        retrieved = feed.get_activity("act_1")
        assert retrieved is not None
        assert retrieved.id == "act_1"

    def test_get_activities_with_pagination(self):
        """Test getting activities with pagination."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")

        for i in range(25):
            activity = ActivityEntry(
                id=f"act_{i}",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor
            )
            feed.add_activity(activity)

        page1 = feed.get_activities(page=1, page_size=10)
        assert len(page1.activities) == 10
        assert page1.total_count == 25
        assert page1.has_more

        page2 = feed.get_activities(page=2, page_size=10)
        assert len(page2.activities) == 10
        assert page2.has_more

        page3 = feed.get_activities(page=3, page_size=10)
        assert len(page3.activities) == 5
        assert not page3.has_more

    def test_get_activities_with_filter(self):
        """Test getting activities with filter."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")

        feed.add_activity(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        ))
        feed.add_activity(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.COMMENT_ADDED,
            actor=actor
        ))

        filter_spec = ActivityFilter(activity_types={ActivityType.DOCUMENT_CREATED})
        page = feed.get_activities(filter_spec)
        assert page.total_count == 1

    def test_get_by_actor(self):
        """Test getting activities by actor."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor1 = Actor(id="user_1", name="Alice")
        actor2 = Actor(id="user_2", name="Bob")

        feed.add_activity(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor1
        ))
        feed.add_activity(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor2
        ))

        activities = feed.get_by_actor("user_1")
        assert len(activities) == 1
        assert activities[0].actor.id == "user_1"

    def test_get_by_target(self):
        """Test getting activities by target."""
        feed = ActivityFeed("feed_1", FeedType.DOCUMENT)
        actor = Actor(id="user_1", name="Alice")
        target1 = ActivityTarget(id="doc_1", type="document")
        target2 = ActivityTarget(id="doc_2", type="document")

        feed.add_activity(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_UPDATED,
            actor=actor,
            target=target1
        ))
        feed.add_activity(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_UPDATED,
            actor=actor,
            target=target2
        ))

        activities = feed.get_by_target("doc_1")
        assert len(activities) == 1

    def test_get_by_type(self):
        """Test getting activities by type."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")

        feed.add_activity(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        ))
        feed.add_activity(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.COMMENT_ADDED,
            actor=actor
        ))
        feed.add_activity(ActivityEntry(
            id="act_3",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor
        ))

        activities = feed.get_by_type(ActivityType.DOCUMENT_CREATED)
        assert len(activities) == 2

    def test_search(self):
        """Test searching activities."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")

        feed.add_activity(ActivityEntry(
            id="act_1",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            message="Created the quarterly report"
        ))
        feed.add_activity(ActivityEntry(
            id="act_2",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            message="Created a todo list"
        ))

        results = feed.search("quarterly")
        assert len(results) == 1
        assert "quarterly" in results[0].message

    def test_get_recent(self):
        """Test getting recent activities."""
        feed = ActivityFeed("feed_1", FeedType.USER)
        actor = Actor(id="user_1", name="Alice")

        for i in range(10):
            feed.add_activity(ActivityEntry(
                id=f"act_{i}",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor
            ))

        recent = feed.get_recent(5)
        assert len(recent) == 5

    def test_cleanup_old(self):
        """Test cleaning up old activities."""
        config = ActivityFeedConfig(retention_days=7)
        feed = ActivityFeed("feed_1", FeedType.USER, config)
        actor = Actor(id="user_1", name="Alice")

        # Add old activity
        old_activity = ActivityEntry(
            id="act_old",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            timestamp=datetime.utcnow() - timedelta(days=10)
        )
        feed.add_activity(old_activity)

        # Add recent activity
        new_activity = ActivityEntry(
            id="act_new",
            activity_type=ActivityType.DOCUMENT_CREATED,
            actor=actor,
            timestamp=datetime.utcnow()
        )
        feed.add_activity(new_activity)

        removed = feed.cleanup_old()
        assert removed == 1
        assert feed.count == 1

    def test_max_activities_limit(self):
        """Test max activities limit."""
        config = ActivityFeedConfig(max_activities=5)
        feed = ActivityFeed("feed_1", FeedType.USER, config)
        actor = Actor(id="user_1", name="Alice")

        for i in range(10):
            feed.add_activity(ActivityEntry(
                id=f"act_{i}",
                activity_type=ActivityType.DOCUMENT_CREATED,
                actor=actor
            ))

        assert feed.count == 5


# ==================== ActivityManager Tests ====================

class TestActivityManager:
    """Tests for ActivityManager class."""

    def test_create_manager(self):
        """Test creating activity manager."""
        manager = ActivityManager()
        assert manager is not None

    def test_create_manager_with_config(self):
        """Test creating manager with config."""
        config = ActivityFeedConfig(max_activities=500)
        manager = ActivityManager(config)
        assert manager.config.max_activities == 500

    def test_record_activity(self):
        """Test recording an activity."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document", name="Report")

        activity = manager.record_activity(
            ActivityType.DOCUMENT_CREATED,
            actor,
            target=target
        )

        assert activity is not None
        assert activity.activity_type == ActivityType.DOCUMENT_CREATED
        assert "Alice" in activity.message

    def test_record_with_custom_message(self):
        """Test recording with custom message."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        activity = manager.record_activity(
            ActivityType.DOCUMENT_CREATED,
            actor,
            message="Custom message here"
        )

        assert activity.message == "Custom message here"

    def test_get_user_feed(self):
        """Test getting user feed."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)
        manager.record_activity(ActivityType.DOCUMENT_UPDATED, actor)

        page = manager.get_user_feed("user_1")
        assert page.total_count == 2

    def test_get_document_feed(self):
        """Test getting document feed."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")
        target = ActivityTarget(id="doc_1", type="document", name="Report")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor, target=target)
        manager.record_activity(ActivityType.DOCUMENT_UPDATED, actor, target=target)

        page = manager.get_document_feed("doc_1")
        assert page.total_count == 2

    def test_get_global_feed(self):
        """Test getting global feed."""
        manager = ActivityManager()
        actor1 = Actor(id="user_1", name="Alice")
        actor2 = Actor(id="user_2", name="Bob")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor1)
        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor2)

        page = manager.get_global_feed()
        assert page.total_count == 2

    def test_get_user_timeline(self):
        """Test getting user timeline."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)
        manager.record_activity(ActivityType.DOCUMENT_UPDATED, actor)

        timeline = manager.get_user_timeline("user_1")
        assert len(timeline) >= 1

    def test_search_activities(self):
        """Test searching activities."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(
            ActivityType.DOCUMENT_CREATED,
            actor,
            message="Created the annual report"
        )
        manager.record_activity(
            ActivityType.DOCUMENT_CREATED,
            actor,
            message="Created a memo"
        )

        results = manager.search_activities("annual")
        assert len(results) == 1

    def test_get_activity_count(self):
        """Test getting activity count."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        for _ in range(5):
            manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)

        count = manager.get_activity_count("user_1", FeedType.USER)
        assert count == 5

    def test_get_recent_actors(self):
        """Test getting recent actors."""
        manager = ActivityManager()
        target = ActivityTarget(id="doc_1", type="document", name="Report")

        for i in range(5):
            actor = Actor(id=f"user_{i}", name=f"User {i}")
            manager.record_activity(
                ActivityType.DOCUMENT_VIEWED,
                actor,
                target=target
            )

        actors = manager.get_recent_actors("doc_1", FeedType.DOCUMENT, limit=3)
        assert len(actors) == 3

    def test_event_callbacks(self):
        """Test event callbacks."""
        manager = ActivityManager()
        events = []

        manager.on("activity_created", lambda a: events.append(a.id))

        actor = Actor(id="user_1", name="Alice")
        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)

        assert len(events) == 1

    def test_register_formatter(self):
        """Test registering custom formatter."""
        manager = ActivityManager()

        manager.register_formatter(
            ActivityType.DOCUMENT_DELETED,
            lambda a: f"{a.actor.name} deleted the document permanently"
        )

        actor = Actor(id="user_1", name="Alice")
        activity = manager.record_activity(ActivityType.DOCUMENT_DELETED, actor)

        assert "permanently" in activity.message

    def test_cleanup(self):
        """Test cleanup across all feeds."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)

        results = manager.cleanup(datetime.utcnow() + timedelta(days=1))
        # Should clean up the activity we just added
        assert "global" in results

    def test_get_stats(self):
        """Test getting stats."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, actor)
        manager.record_activity(ActivityType.DOCUMENT_UPDATED, actor)

        stats = manager.get_stats()
        assert stats["total_activities"] == 2
        assert stats["total_actors"] >= 1


# ==================== ActivityBuilder Tests ====================

class TestActivityBuilder:
    """Tests for ActivityBuilder class."""

    def test_build_activity(self):
        """Test building an activity."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.DOCUMENT_CREATED)
            .actor("user_1", "Alice")
            .target("doc_1", "document", "My Document")
            .message("Created a new document")
            .record())

        assert activity is not None
        assert activity.activity_type == ActivityType.DOCUMENT_CREATED
        assert activity.actor.name == "Alice"

    def test_build_with_secondary_target(self):
        """Test building with secondary target."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.TASK_ASSIGNED)
            .actor("user_1", "Alice")
            .target("task_1", "task", "Review PR")
            .secondary_target("user_2", "user", "Bob")
            .record())

        assert activity is not None
        assert activity.secondary_target.name == "Bob"

    def test_build_with_visibility(self):
        """Test building with visibility."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.DOCUMENT_CREATED)
            .actor("user_1", "Alice")
            .visibility(ActivityVisibility.PRIVATE)
            .record())

        assert activity is not None
        assert activity.visibility == ActivityVisibility.PRIVATE

    def test_build_with_tags(self):
        """Test building with tags."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.DOCUMENT_CREATED)
            .actor("user_1", "Alice")
            .tag("important", "project-x")
            .record())

        assert activity is not None
        assert "important" in activity.tags

    def test_build_with_metadata(self):
        """Test building with metadata."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.DOCUMENT_CREATED)
            .actor("user_1", "Alice")
            .meta(source="api", version="1.0")
            .record())

        assert activity is not None
        assert activity.metadata["source"] == "api"

    def test_build_with_feeds(self):
        """Test building with additional feeds."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .type(ActivityType.DOCUMENT_CREATED)
            .actor("user_1", "Alice")
            .add_feed("team_1", FeedType.TEAM)
            .record())

        assert activity is not None
        # Check activity is in team feed
        page = manager.get_or_create_feed("team_1", FeedType.TEAM).get_activities()
        assert page.total_count == 1

    def test_build_without_required_fields(self):
        """Test building without required fields fails."""
        manager = ActivityManager()
        activity = (ActivityBuilder(manager)
            .message("No type or actor")
            .record())

        assert activity is None


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global activity manager instances."""

    def test_get_manager_none(self):
        """Test get manager returns None initially."""
        reset_activity_manager()
        assert get_activity_manager() is None

    def test_set_and_get_manager(self):
        """Test setting and getting manager."""
        reset_activity_manager()
        manager = ActivityManager()
        set_activity_manager(manager)
        assert get_activity_manager() is manager

    def test_reset_manager(self):
        """Test resetting manager."""
        manager = ActivityManager()
        set_activity_manager(manager)
        reset_activity_manager()
        assert get_activity_manager() is None


# ==================== Integration Tests ====================

class TestIntegration:
    """Integration tests for activity feed system."""

    def test_full_activity_flow(self):
        """Test full activity recording and retrieval flow."""
        manager = ActivityManager()

        # Record various activities
        alice = Actor(id="user_1", name="Alice")
        bob = Actor(id="user_2", name="Bob")
        doc = ActivityTarget(id="doc_1", type="document", name="Report")

        manager.record_activity(ActivityType.DOCUMENT_CREATED, alice, target=doc)
        manager.record_activity(ActivityType.DOCUMENT_SHARED, alice, target=doc)
        manager.record_activity(ActivityType.DOCUMENT_VIEWED, bob, target=doc)
        manager.record_activity(ActivityType.COMMENT_ADDED, bob, target=doc)

        # Check global feed
        global_page = manager.get_global_feed()
        assert global_page.total_count == 4

        # Check document feed
        doc_page = manager.get_document_feed("doc_1")
        assert doc_page.total_count == 4

        # Check user feeds
        alice_page = manager.get_user_feed("user_1")
        assert alice_page.total_count == 2

        bob_page = manager.get_user_feed("user_2")
        assert bob_page.total_count == 2

    def test_timeline_generation(self):
        """Test timeline generation with multiple days."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        # Create activities across multiple days
        now = datetime.utcnow()
        for i in range(5):
            activity = manager.record_activity(
                ActivityType.DOCUMENT_CREATED,
                actor,
                message=f"Activity {i}"
            )
            # Manually adjust timestamp for testing
            activity.timestamp = now - timedelta(days=i)

        timeline = manager.get_user_timeline("user_1", group_by="day")
        assert len(timeline) >= 1

    def test_filtering_and_search(self):
        """Test filtering and search functionality."""
        manager = ActivityManager()
        actor = Actor(id="user_1", name="Alice")

        manager.record_activity(
            ActivityType.DOCUMENT_CREATED,
            actor,
            message="Created quarterly report"
        )
        manager.record_activity(
            ActivityType.TASK_CREATED,
            actor,
            message="Created task for review"
        )

        # Filter by type
        filter_spec = ActivityFilter(activity_types={ActivityType.DOCUMENT_CREATED})
        page = manager.get_global_feed(filter_spec)
        assert page.total_count == 1

        # Search
        results = manager.search_activities("quarterly")
        assert len(results) == 1

    def test_multi_user_collaboration(self):
        """Test multi-user collaboration tracking."""
        manager = ActivityManager()
        doc = ActivityTarget(id="doc_1", type="document", name="Shared Document")

        users = [
            Actor(id=f"user_{i}", name=f"User{i}")
            for i in range(5)
        ]

        for user in users:
            manager.record_activity(ActivityType.DOCUMENT_VIEWED, user, target=doc)

        # Check recent actors
        recent = manager.get_recent_actors("doc_1", FeedType.DOCUMENT)
        assert len(recent) == 5

        # Check stats
        stats = manager.get_stats()
        assert stats["total_actors"] >= 5
