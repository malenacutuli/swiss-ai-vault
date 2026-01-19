"""
Tests for Notification System Module
"""

import pytest
import time
from datetime import datetime, timedelta

from app.collaboration.notifications import (
    NotificationManager,
    NotificationConfig,
    Notification,
    NotificationTemplate,
    NotificationPreferences,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus,
    NotificationType,
    NotificationQueue,
    NotificationDigest,
    NotificationBuilder,
    DigestFrequency,
    DigestManager,
    TemplateManager,
    ChannelConfig,
    ChannelHandler,
    InAppHandler,
    EmailHandler,
    PushHandler,
    WebhookHandler,
    DeliveryResult,
    get_notification_manager,
    set_notification_manager,
    reset_notification_manager,
)


# ==================== Notification Tests ====================

class TestNotification:
    """Tests for Notification class."""

    def test_create_notification(self):
        """Test creating a notification."""
        notif = Notification(
            id="notif_1",
            user_id="user_1",
            title="Test Title",
            body="Test body content"
        )
        assert notif.id == "notif_1"
        assert notif.user_id == "user_1"
        assert notif.title == "Test Title"
        assert notif.status == NotificationStatus.PENDING

    def test_notification_priority(self):
        """Test notification priority."""
        notif = Notification(
            id="notif_1",
            user_id="user_1",
            title="Urgent",
            body="Urgent message",
            priority=NotificationPriority.URGENT
        )
        assert notif.priority == NotificationPriority.URGENT

    def test_notification_channels(self):
        """Test notification channels."""
        notif = Notification(
            id="notif_1",
            user_id="user_1",
            title="Test",
            body="Test",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        )
        assert NotificationChannel.IN_APP in notif.channels
        assert NotificationChannel.EMAIL in notif.channels

    def test_notification_expiry(self):
        """Test notification expiry."""
        # Not expired
        notif1 = Notification(
            id="notif_1",
            user_id="user_1",
            title="Test",
            body="Test",
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        assert not notif1.is_expired()

        # Expired
        notif2 = Notification(
            id="notif_2",
            user_id="user_1",
            title="Test",
            body="Test",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )
        assert notif2.is_expired()

    def test_mark_sent(self):
        """Test marking notification as sent."""
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")
        notif.mark_sent()
        assert notif.status == NotificationStatus.DELIVERED
        assert notif.sent_at is not None

    def test_mark_read(self):
        """Test marking notification as read."""
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")
        notif.mark_read()
        assert notif.status == NotificationStatus.READ
        assert notif.read_at is not None

    def test_to_dict(self):
        """Test converting notification to dict."""
        notif = Notification(
            id="notif_1",
            user_id="user_1",
            title="Test",
            body="Test body"
        )
        data = notif.to_dict()
        assert data["id"] == "notif_1"
        assert data["user_id"] == "user_1"
        assert data["title"] == "Test"
        assert "created_at" in data


# ==================== Template Tests ====================

class TestNotificationTemplate:
    """Tests for NotificationTemplate class."""

    def test_create_template(self):
        """Test creating a template."""
        template = NotificationTemplate(
            id="test_template",
            name="Test Template",
            subject_template="Hello {{name}}",
            body_template="Welcome, {{name}}! Your code is {{code}}."
        )
        assert template.id == "test_template"
        assert template.name == "Test Template"

    def test_render_template(self):
        """Test rendering template with variables."""
        template = NotificationTemplate(
            id="test",
            name="Test",
            subject_template="Hello {{name}}",
            body_template="Your order {{order_id}} is ready."
        )
        rendered = template.render({"name": "Alice", "order_id": "12345"})
        assert rendered["subject"] == "Hello Alice"
        assert rendered["body"] == "Your order 12345 is ready."

    def test_render_dollar_syntax(self):
        """Test rendering with ${var} syntax."""
        template = NotificationTemplate(
            id="test",
            name="Test",
            subject_template="Hello ${name}",
            body_template="Code: ${code}"
        )
        rendered = template.render({"name": "Bob", "code": "ABC123"})
        assert rendered["subject"] == "Hello Bob"
        assert rendered["body"] == "Code: ABC123"

    def test_render_html_template(self):
        """Test rendering HTML template."""
        template = NotificationTemplate(
            id="test",
            name="Test",
            subject_template="Welcome",
            body_template="Hello {{name}}",
            html_template="<h1>Hello {{name}}</h1>"
        )
        rendered = template.render({"name": "Charlie"})
        assert rendered["html"] == "<h1>Hello Charlie</h1>"

    def test_render_empty_html(self):
        """Test rendering with no HTML template."""
        template = NotificationTemplate(
            id="test",
            name="Test",
            subject_template="Test",
            body_template="Test"
        )
        rendered = template.render({})
        assert rendered["html"] == ""


class TestTemplateManager:
    """Tests for TemplateManager class."""

    def test_create_manager(self):
        """Test creating template manager."""
        manager = TemplateManager()
        assert manager is not None

    def test_default_templates(self):
        """Test default templates are registered."""
        manager = TemplateManager()
        assert manager.get("mention") is not None
        assert manager.get("comment") is not None
        assert manager.get("task_assigned") is not None

    def test_register_template(self):
        """Test registering a template."""
        manager = TemplateManager()
        template = NotificationTemplate(
            id="custom",
            name="Custom Template",
            subject_template="Custom: {{title}}",
            body_template="{{message}}"
        )
        manager.register(template)
        assert manager.get("custom") is not None

    def test_list_templates(self):
        """Test listing templates."""
        manager = TemplateManager()
        templates = manager.list_templates()
        assert len(templates) >= 4  # Default templates

    def test_create_notification_from_template(self):
        """Test creating notification from template."""
        manager = TemplateManager()
        notif = manager.create_notification(
            "mention",
            "user_1",
            {"sender_name": "Alice", "context": "document", "excerpt": "Hello"}
        )
        assert notif is not None
        assert "Alice" in notif.title
        assert notif.notification_type == NotificationType.MENTION


# ==================== Preferences Tests ====================

class TestNotificationPreferences:
    """Tests for NotificationPreferences class."""

    def test_create_preferences(self):
        """Test creating preferences."""
        prefs = NotificationPreferences(user_id="user_1")
        assert prefs.user_id == "user_1"
        assert NotificationChannel.IN_APP in prefs.enabled_channels

    def test_channel_enabled(self):
        """Test checking if channel is enabled."""
        prefs = NotificationPreferences(
            user_id="user_1",
            enabled_channels={NotificationChannel.IN_APP}
        )
        assert prefs.is_channel_enabled(NotificationChannel.IN_APP)
        assert not prefs.is_channel_enabled(NotificationChannel.EMAIL)

    def test_type_muted(self):
        """Test checking if type is muted."""
        prefs = NotificationPreferences(
            user_id="user_1",
            muted_types={NotificationType.INFO}
        )
        assert prefs.is_type_muted(NotificationType.INFO)
        assert not prefs.is_type_muted(NotificationType.ERROR)

    def test_quiet_hours_same_day(self):
        """Test quiet hours within same day."""
        prefs = NotificationPreferences(
            user_id="user_1",
            quiet_hours_start=22,
            quiet_hours_end=8
        )
        # 23:00 is in quiet hours (spans midnight)
        assert prefs.is_in_quiet_hours(23)
        # 6:00 is in quiet hours
        assert prefs.is_in_quiet_hours(6)
        # 12:00 is not in quiet hours
        assert not prefs.is_in_quiet_hours(12)

    def test_quiet_hours_simple(self):
        """Test quiet hours not spanning midnight."""
        prefs = NotificationPreferences(
            user_id="user_1",
            quiet_hours_start=1,
            quiet_hours_end=6
        )
        assert prefs.is_in_quiet_hours(3)
        assert not prefs.is_in_quiet_hours(12)
        assert not prefs.is_in_quiet_hours(0)

    def test_no_quiet_hours(self):
        """Test when quiet hours are not set."""
        prefs = NotificationPreferences(user_id="user_1")
        assert not prefs.is_in_quiet_hours(3)
        assert not prefs.is_in_quiet_hours(23)


# ==================== Channel Handler Tests ====================

class TestInAppHandler:
    """Tests for InAppHandler class."""

    def test_create_handler(self):
        """Test creating in-app handler."""
        config = ChannelConfig(channel=NotificationChannel.IN_APP)
        handler = InAppHandler(config)
        assert handler is not None

    def test_send_notification(self):
        """Test sending in-app notification."""
        config = ChannelConfig(channel=NotificationChannel.IN_APP)
        handler = InAppHandler(config)
        prefs = NotificationPreferences(user_id="user_1")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert result.success
        assert result.channel == NotificationChannel.IN_APP

    def test_get_notifications(self):
        """Test getting stored notifications."""
        config = ChannelConfig(channel=NotificationChannel.IN_APP)
        handler = InAppHandler(config)
        prefs = NotificationPreferences(user_id="user_1")

        for i in range(5):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title=f"Test {i}", body="Test")
            handler.send(notif, prefs)

        notifications = handler.get_notifications("user_1")
        assert len(notifications) == 5

    def test_get_unread_count(self):
        """Test getting unread count."""
        config = ChannelConfig(channel=NotificationChannel.IN_APP)
        handler = InAppHandler(config)
        prefs = NotificationPreferences(user_id="user_1")

        for i in range(3):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title=f"Test {i}", body="Test")
            handler.send(notif, prefs)

        assert handler.get_unread_count("user_1") == 3

    def test_rate_limiting(self):
        """Test rate limiting."""
        config = ChannelConfig(channel=NotificationChannel.IN_APP, rate_limit=5)
        handler = InAppHandler(config)
        prefs = NotificationPreferences(user_id="user_1")

        results = []
        for i in range(10):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            results.append(handler.send(notif, prefs))

        successful = sum(1 for r in results if r.success)
        assert successful == 5


class TestEmailHandler:
    """Tests for EmailHandler class."""

    def test_create_handler(self):
        """Test creating email handler."""
        config = ChannelConfig(channel=NotificationChannel.EMAIL)
        handler = EmailHandler(config)
        assert handler is not None

    def test_send_email(self):
        """Test sending email notification."""
        config = ChannelConfig(channel=NotificationChannel.EMAIL)
        handler = EmailHandler(config)
        prefs = NotificationPreferences(user_id="user_1", email_address="test@example.com")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test body")

        result = handler.send(notif, prefs)
        assert result.success
        assert len(handler._sent_emails) == 1

    def test_send_without_email(self):
        """Test sending without email address."""
        config = ChannelConfig(channel=NotificationChannel.EMAIL)
        handler = EmailHandler(config)
        prefs = NotificationPreferences(user_id="user_1")  # No email
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert not result.success
        assert "No email address" in result.error


class TestPushHandler:
    """Tests for PushHandler class."""

    def test_create_handler(self):
        """Test creating push handler."""
        config = ChannelConfig(channel=NotificationChannel.PUSH)
        handler = PushHandler(config)
        assert handler is not None

    def test_send_push(self):
        """Test sending push notification."""
        config = ChannelConfig(channel=NotificationChannel.PUSH)
        handler = PushHandler(config)
        prefs = NotificationPreferences(user_id="user_1", push_token="token123abc")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert result.success
        assert len(handler._sent_pushes) == 1

    def test_send_without_token(self):
        """Test sending without push token."""
        config = ChannelConfig(channel=NotificationChannel.PUSH)
        handler = PushHandler(config)
        prefs = NotificationPreferences(user_id="user_1")  # No token
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert not result.success
        assert "No push token" in result.error


class TestWebhookHandler:
    """Tests for WebhookHandler class."""

    def test_create_handler(self):
        """Test creating webhook handler."""
        config = ChannelConfig(
            channel=NotificationChannel.WEBHOOK,
            endpoint="https://example.com/webhook"
        )
        handler = WebhookHandler(config)
        assert handler is not None

    def test_send_webhook(self):
        """Test sending webhook notification."""
        config = ChannelConfig(
            channel=NotificationChannel.WEBHOOK,
            endpoint="https://example.com/webhook"
        )
        handler = WebhookHandler(config)
        prefs = NotificationPreferences(user_id="user_1")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert result.success
        assert len(handler._sent_webhooks) == 1

    def test_send_without_endpoint(self):
        """Test sending without endpoint."""
        config = ChannelConfig(channel=NotificationChannel.WEBHOOK)  # No endpoint
        handler = WebhookHandler(config)
        prefs = NotificationPreferences(user_id="user_1")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        result = handler.send(notif, prefs)
        assert not result.success
        assert "No webhook endpoint" in result.error


# ==================== Queue Tests ====================

class TestNotificationQueue:
    """Tests for NotificationQueue class."""

    def test_create_queue(self):
        """Test creating queue."""
        config = NotificationConfig()
        queue = NotificationQueue(config)
        assert queue.size == 0

    def test_enqueue(self):
        """Test enqueuing notifications."""
        config = NotificationConfig()
        queue = NotificationQueue(config)
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")

        assert queue.enqueue(notif)
        assert queue.size == 1
        assert notif.status == NotificationStatus.QUEUED

    def test_dequeue(self):
        """Test dequeuing notifications."""
        config = NotificationConfig(batch_size=5)
        queue = NotificationQueue(config)

        for i in range(10):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            queue.enqueue(notif)

        batch = queue.dequeue()
        assert len(batch) == 5
        assert queue.size == 5

    def test_peek(self):
        """Test peeking at queue."""
        config = NotificationConfig()
        queue = NotificationQueue(config)

        for i in range(5):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            queue.enqueue(notif)

        peeked = queue.peek(3)
        assert len(peeked) == 3
        assert queue.size == 5  # Queue unchanged

    def test_max_queue_size(self):
        """Test max queue size limit."""
        config = NotificationConfig(max_queue_size=5)
        queue = NotificationQueue(config)

        for i in range(10):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            queue.enqueue(notif)

        assert queue.size == 5

    def test_should_flush(self):
        """Test flush condition check."""
        config = NotificationConfig(batch_size=5, batch_interval_ms=100)
        queue = NotificationQueue(config)

        # Empty queue should not flush
        assert not queue.should_flush()

        # Under batch size, recently flushed
        for i in range(3):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            queue.enqueue(notif)
        assert not queue.should_flush()

        # At batch size should flush
        for i in range(3, 5):
            notif = Notification(id=f"notif_{i}", user_id="user_1", title="Test", body="Test")
            queue.enqueue(notif)
        assert queue.should_flush()

    def test_get_by_priority(self):
        """Test getting notifications by priority."""
        config = NotificationConfig()
        queue = NotificationQueue(config)

        queue.enqueue(Notification(
            id="notif_1", user_id="user_1", title="Low", body="Test",
            priority=NotificationPriority.LOW
        ))
        queue.enqueue(Notification(
            id="notif_2", user_id="user_1", title="Urgent", body="Test",
            priority=NotificationPriority.URGENT
        ))
        queue.enqueue(Notification(
            id="notif_3", user_id="user_1", title="Normal", body="Test",
            priority=NotificationPriority.NORMAL
        ))

        urgent = queue.get_by_priority(NotificationPriority.URGENT)
        assert len(urgent) == 1
        assert urgent[0].title == "Urgent"

    def test_remove_expired(self):
        """Test removing expired notifications."""
        config = NotificationConfig()
        queue = NotificationQueue(config)

        queue.enqueue(Notification(
            id="notif_1", user_id="user_1", title="Valid", body="Test",
            expires_at=datetime.utcnow() + timedelta(hours=1)
        ))
        queue.enqueue(Notification(
            id="notif_2", user_id="user_1", title="Expired", body="Test",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        ))

        removed = queue.remove_expired()
        assert removed == 1
        assert queue.size == 1


# ==================== Digest Tests ====================

class TestNotificationDigest:
    """Tests for NotificationDigest class."""

    def test_create_digest(self):
        """Test creating digest."""
        digest = NotificationDigest(
            id="digest_1",
            user_id="user_1",
            frequency=DigestFrequency.DAILY
        )
        assert digest.id == "digest_1"
        assert digest.count == 0

    def test_add_notification(self):
        """Test adding notifications to digest."""
        digest = NotificationDigest(id="digest_1", user_id="user_1")
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")
        digest.add_notification(notif)
        assert digest.count == 1

    def test_get_summary(self):
        """Test getting digest summary."""
        digest = NotificationDigest(id="digest_1", user_id="user_1")
        digest.add_notification(Notification(
            id="notif_1", user_id="user_1", title="Test", body="Test",
            notification_type=NotificationType.INFO
        ))
        digest.add_notification(Notification(
            id="notif_2", user_id="user_1", title="Test", body="Test",
            notification_type=NotificationType.INFO
        ))
        digest.add_notification(Notification(
            id="notif_3", user_id="user_1", title="Test", body="Test",
            notification_type=NotificationType.COMMENT
        ))

        summary = digest.get_summary()
        assert summary["info"] == 2
        assert summary["comment"] == 1


class TestDigestManager:
    """Tests for DigestManager class."""

    def test_create_manager(self):
        """Test creating digest manager."""
        manager = DigestManager()
        assert manager is not None

    def test_add_to_digest(self):
        """Test adding to digest."""
        manager = DigestManager()
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")
        manager.add_to_digest("user_1", notif, DigestFrequency.DAILY)

        digest = manager.get_digest("user_1", DigestFrequency.DAILY)
        assert digest is not None
        assert digest.count == 1

    def test_flush_digest(self):
        """Test flushing digest."""
        manager = DigestManager()
        notif = Notification(id="notif_1", user_id="user_1", title="Test", body="Test")
        manager.add_to_digest("user_1", notif, DigestFrequency.DAILY)

        flushed = manager.flush_digest("user_1", DigestFrequency.DAILY)
        assert flushed is not None
        assert flushed.sent
        assert flushed.count == 1

        # Digest should be cleared
        assert manager.get_digest("user_1", DigestFrequency.DAILY) is None

    def test_get_pending_digests(self):
        """Test getting pending digests."""
        manager = DigestManager()
        manager.add_to_digest("user_1", Notification(
            id="notif_1", user_id="user_1", title="Test", body="Test"
        ), DigestFrequency.DAILY)
        manager.add_to_digest("user_2", Notification(
            id="notif_2", user_id="user_2", title="Test", body="Test"
        ), DigestFrequency.DAILY)

        pending = manager.get_pending_digests(DigestFrequency.DAILY)
        assert len(pending) == 2


# ==================== Manager Tests ====================

class TestNotificationManager:
    """Tests for NotificationManager class."""

    def test_create_manager(self):
        """Test creating notification manager."""
        manager = NotificationManager()
        assert manager is not None

    def test_create_manager_with_config(self):
        """Test creating manager with config."""
        config = NotificationConfig(max_queue_size=500)
        manager = NotificationManager(config)
        assert manager.config.max_queue_size == 500

    def test_create_notification(self):
        """Test creating notification."""
        manager = NotificationManager()
        notif = manager.create_notification(
            "user_1",
            "Test Title",
            "Test body"
        )
        assert notif is not None
        assert notif.user_id == "user_1"
        assert notif.title == "Test Title"

    def test_send_notification(self):
        """Test sending notification."""
        manager = NotificationManager()
        notif = manager.create_notification(
            "user_1",
            "Test",
            "Test body",
            channels=[NotificationChannel.IN_APP]
        )
        results = manager.send(notif)
        assert len(results) == 1
        assert results[0].success

    def test_send_to_multiple_channels(self):
        """Test sending to multiple channels."""
        manager = NotificationManager()
        manager.set_preferences(NotificationPreferences(
            user_id="user_1",
            email_address="test@example.com",
            enabled_channels={NotificationChannel.IN_APP, NotificationChannel.EMAIL}
        ))
        notif = manager.create_notification(
            "user_1",
            "Test",
            "Test body",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        )
        results = manager.send(notif)
        assert len(results) == 2

    def test_muted_type_not_sent(self):
        """Test muted notification types are not sent."""
        manager = NotificationManager()
        manager.set_preferences(NotificationPreferences(
            user_id="user_1",
            muted_types={NotificationType.INFO}
        ))
        notif = manager.create_notification(
            "user_1",
            "Test",
            "Test body",
            notification_type=NotificationType.INFO
        )
        results = manager.send(notif)
        assert len(results) == 0
        assert notif.status == NotificationStatus.CANCELLED

    def test_queue_notification(self):
        """Test queuing notification."""
        manager = NotificationManager()
        notif = manager.create_notification("user_1", "Test", "Test body")
        assert manager.queue(notif)
        assert notif.status == NotificationStatus.QUEUED

    def test_notify_immediate(self):
        """Test notify convenience method (immediate)."""
        manager = NotificationManager()
        results = manager.notify("user_1", "Test", "Test body", immediate=True)
        assert results is not None
        assert len(results) >= 1

    def test_notify_queued(self):
        """Test notify convenience method (queued)."""
        manager = NotificationManager()
        results = manager.notify("user_1", "Test", "Test body", immediate=False)
        assert results is None  # Queued, not sent

    def test_notify_from_template(self):
        """Test notify from template."""
        manager = NotificationManager()
        results = manager.notify_from_template(
            "mention",
            "user_1",
            {"sender_name": "Alice", "context": "document", "excerpt": "Hello"}
        )
        assert results is not None

    def test_get_notifications(self):
        """Test getting notifications for user."""
        manager = NotificationManager()
        for i in range(5):
            manager.notify(f"user_1", f"Test {i}", "Body", immediate=True)

        notifications = manager.get_notifications("user_1")
        assert len(notifications) == 5

    def test_get_unread_count(self):
        """Test getting unread count."""
        manager = NotificationManager()
        for i in range(3):
            manager.notify("user_1", f"Test {i}", "Body", immediate=True)

        count = manager.get_unread_count("user_1")
        assert count == 3

    def test_mark_read(self):
        """Test marking notification as read."""
        manager = NotificationManager()
        notif = manager.create_notification("user_1", "Test", "Body")
        manager.send(notif)

        assert manager.mark_read(notif.id, "user_1")
        assert manager.get_unread_count("user_1") == 0

    def test_mark_all_read(self):
        """Test marking all notifications as read."""
        manager = NotificationManager()
        for i in range(5):
            manager.notify("user_1", f"Test {i}", "Body", immediate=True)

        count = manager.mark_all_read("user_1")
        assert count == 5
        assert manager.get_unread_count("user_1") == 0

    def test_register_custom_template(self):
        """Test registering custom template."""
        manager = NotificationManager()
        template = NotificationTemplate(
            id="custom",
            name="Custom",
            subject_template="Custom: {{value}}",
            body_template="Value is {{value}}"
        )
        manager.register_template(template)
        assert manager.get_template("custom") is not None

    def test_event_callbacks(self):
        """Test event callbacks."""
        manager = NotificationManager()
        events = []

        manager.on("notification_created", lambda n: events.append(("created", n.id)))
        manager.on("notification_sent", lambda n, r: events.append(("sent", n.id)))

        manager.notify("user_1", "Test", "Body", immediate=True)

        assert any(e[0] == "created" for e in events)
        assert any(e[0] == "sent" for e in events)

    def test_get_stats(self):
        """Test getting stats."""
        manager = NotificationManager()
        manager.notify("user_1", "Test", "Body", immediate=True)

        stats = manager.get_stats()
        assert "total_sent" in stats
        assert "queue_size" in stats
        assert stats["total_sent"] >= 1

    def test_disabled_channel_not_sent(self):
        """Test disabled channel is skipped."""
        manager = NotificationManager()
        manager.set_preferences(NotificationPreferences(
            user_id="user_1",
            enabled_channels={NotificationChannel.IN_APP}  # Only in-app
        ))
        notif = manager.create_notification(
            "user_1",
            "Test",
            "Body",
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        )
        results = manager.send(notif)
        # Only in-app should be sent
        assert len(results) == 1
        assert results[0].channel == NotificationChannel.IN_APP


# ==================== Builder Tests ====================

class TestNotificationBuilder:
    """Tests for NotificationBuilder class."""

    def test_build_simple_notification(self):
        """Test building simple notification."""
        notif = (NotificationBuilder("user_1")
            .title("Test Title")
            .body("Test body")
            .build())

        assert notif.user_id == "user_1"
        assert notif.title == "Test Title"
        assert notif.body == "Test body"

    def test_build_with_priority(self):
        """Test building with priority."""
        notif = (NotificationBuilder("user_1")
            .title("Urgent")
            .body("Urgent message")
            .priority(NotificationPriority.URGENT)
            .build())

        assert notif.priority == NotificationPriority.URGENT

    def test_build_with_channels(self):
        """Test building with channels."""
        notif = (NotificationBuilder("user_1")
            .title("Test")
            .body("Test")
            .channels(NotificationChannel.IN_APP, NotificationChannel.EMAIL)
            .build())

        assert NotificationChannel.IN_APP in notif.channels
        assert NotificationChannel.EMAIL in notif.channels

    def test_build_with_action(self):
        """Test building with action."""
        notif = (NotificationBuilder("user_1")
            .title("Test")
            .body("Test")
            .action("https://example.com/view", "View Details")
            .build())

        assert notif.action_url == "https://example.com/view"
        assert notif.action_label == "View Details"

    def test_build_with_data(self):
        """Test building with data."""
        notif = (NotificationBuilder("user_1")
            .title("Test")
            .body("Test")
            .data(order_id="12345", status="pending")
            .build())

        assert notif.data["order_id"] == "12345"
        assert notif.data["status"] == "pending"

    def test_build_with_expiry(self):
        """Test building with expiry."""
        notif = (NotificationBuilder("user_1")
            .title("Test")
            .body("Test")
            .expires_in(24)
            .build())

        assert notif.expires_at is not None
        assert notif.expires_at > datetime.utcnow()


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global notification manager instances."""

    def test_get_manager_none(self):
        """Test get manager returns None initially."""
        reset_notification_manager()
        assert get_notification_manager() is None

    def test_set_and_get_manager(self):
        """Test setting and getting manager."""
        reset_notification_manager()
        manager = NotificationManager()
        set_notification_manager(manager)
        assert get_notification_manager() is manager

    def test_reset_manager(self):
        """Test resetting manager."""
        manager = NotificationManager()
        set_notification_manager(manager)
        reset_notification_manager()
        assert get_notification_manager() is None


# ==================== Integration Tests ====================

class TestIntegration:
    """Integration tests for notification system."""

    def test_full_notification_flow(self):
        """Test full notification flow."""
        manager = NotificationManager()

        # Set user preferences
        manager.set_preferences(NotificationPreferences(
            user_id="user_1",
            email_address="user@example.com",
            enabled_channels={NotificationChannel.IN_APP, NotificationChannel.EMAIL}
        ))

        # Send notification
        results = manager.notify(
            "user_1",
            "Welcome!",
            "Welcome to the platform",
            notification_type=NotificationType.INFO,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        )

        assert len(results) == 2
        assert all(r.success for r in results)

        # Check notifications
        notifications = manager.get_notifications("user_1")
        assert len(notifications) == 1

        # Mark read
        manager.mark_read(notifications[0].id, "user_1")
        assert manager.get_unread_count("user_1") == 0

    def test_template_based_notification(self):
        """Test template-based notification flow."""
        manager = NotificationManager()

        results = manager.notify_from_template(
            "task_assigned",
            "user_1",
            {"assigner_name": "Alice", "task_title": "Review PR #123"}
        )

        assert results is not None
        assert any(r.success for r in results)

        notifications = manager.get_notifications("user_1")
        assert len(notifications) == 1
        assert "Alice" in notifications[0].body

    def test_batch_processing(self):
        """Test batch notification processing."""
        config = NotificationConfig(batch_size=5)
        manager = NotificationManager(config)

        # Queue multiple notifications
        for i in range(10):
            manager.notify(f"user_{i % 3}", f"Test {i}", "Body", immediate=False)

        # Process queue
        results = manager.process_queue()
        assert len(results) >= 5

    def test_priority_handling(self):
        """Test priority-based handling."""
        manager = NotificationManager()

        # Send low and urgent priority
        low = manager.create_notification(
            "user_1", "Low Priority", "Body",
            priority=NotificationPriority.LOW
        )
        urgent = manager.create_notification(
            "user_1", "Urgent", "Body",
            priority=NotificationPriority.URGENT
        )

        manager.send(low)
        manager.send(urgent)

        stats = manager.get_stats()
        assert stats["total_sent"] >= 2

    def test_multi_user_notifications(self):
        """Test notifications to multiple users."""
        manager = NotificationManager()

        users = ["user_1", "user_2", "user_3"]
        for user_id in users:
            manager.notify(user_id, f"Hello {user_id}", "Welcome!")

        for user_id in users:
            count = manager.get_unread_count(user_id)
            assert count == 1
