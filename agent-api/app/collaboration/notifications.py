"""
Notification System Module

Implements notification delivery with:
- Multi-channel delivery (in-app, email, push, webhook)
- Notification templates with variable substitution
- User preferences and filtering
- Notification queue with batching/digest
- Priority-based delivery
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import re
import time
import hashlib


# ==================== Enums ====================

class NotificationChannel(Enum):
    """Notification delivery channels."""
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"
    WEBHOOK = "webhook"
    SLACK = "slack"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationStatus(Enum):
    """Notification delivery status."""
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"
    READ = "read"


class NotificationType(Enum):
    """Types of notifications."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    MENTION = "mention"
    COMMENT = "comment"
    TASK = "task"
    WORKFLOW = "workflow"
    SYSTEM = "system"


class DigestFrequency(Enum):
    """Frequency for digest notifications."""
    IMMEDIATE = "immediate"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


# ==================== Data Classes ====================

@dataclass
class NotificationTemplate:
    """Template for notification content."""
    id: str
    name: str
    subject_template: str = ""
    body_template: str = ""
    html_template: str = ""
    notification_type: NotificationType = NotificationType.INFO
    default_channels: List[NotificationChannel] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def render(self, variables: Dict[str, Any]) -> Dict[str, str]:
        """Render the template with variables."""
        return {
            "subject": self._substitute(self.subject_template, variables),
            "body": self._substitute(self.body_template, variables),
            "html": self._substitute(self.html_template, variables) if self.html_template else "",
        }

    def _substitute(self, template: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in template."""
        result = template
        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            result = result.replace(placeholder, str(value))
        # Also support ${var} syntax
        for key, value in variables.items():
            placeholder = "${" + key + "}"
            result = result.replace(placeholder, str(value))
        return result


@dataclass
class ChannelConfig:
    """Configuration for a notification channel."""
    channel: NotificationChannel
    enabled: bool = True
    endpoint: str = ""
    api_key: Optional[str] = None
    rate_limit: int = 100  # Per minute
    retry_count: int = 3
    timeout_ms: int = 5000
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NotificationPreferences:
    """User notification preferences."""
    user_id: str
    enabled_channels: Set[NotificationChannel] = field(
        default_factory=lambda: {NotificationChannel.IN_APP, NotificationChannel.EMAIL}
    )
    muted_types: Set[NotificationType] = field(default_factory=set)
    digest_frequency: DigestFrequency = DigestFrequency.IMMEDIATE
    quiet_hours_start: Optional[int] = None  # Hour of day (0-23)
    quiet_hours_end: Optional[int] = None
    email_address: str = ""
    push_token: str = ""
    phone_number: str = ""
    timezone: str = "UTC"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_channel_enabled(self, channel: NotificationChannel) -> bool:
        """Check if channel is enabled."""
        return channel in self.enabled_channels

    def is_type_muted(self, notification_type: NotificationType) -> bool:
        """Check if notification type is muted."""
        return notification_type in self.muted_types

    def is_in_quiet_hours(self, current_hour: int) -> bool:
        """Check if current time is in quiet hours."""
        if self.quiet_hours_start is None or self.quiet_hours_end is None:
            return False
        if self.quiet_hours_start <= self.quiet_hours_end:
            return self.quiet_hours_start <= current_hour < self.quiet_hours_end
        else:
            # Quiet hours span midnight
            return current_hour >= self.quiet_hours_start or current_hour < self.quiet_hours_end


@dataclass
class Notification:
    """A notification to be delivered."""
    id: str
    user_id: str
    title: str
    body: str
    notification_type: NotificationType = NotificationType.INFO
    priority: NotificationPriority = NotificationPriority.NORMAL
    channels: List[NotificationChannel] = field(default_factory=list)
    status: NotificationStatus = NotificationStatus.PENDING
    html_body: str = ""
    action_url: str = ""
    action_label: str = ""
    icon: str = ""
    image_url: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    template_id: Optional[str] = None
    group_key: Optional[str] = None  # For grouping/batching
    expires_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if notification has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def mark_sent(self) -> None:
        """Mark notification as sent."""
        self.status = NotificationStatus.DELIVERED
        self.sent_at = datetime.utcnow()

    def mark_read(self) -> None:
        """Mark notification as read."""
        self.status = NotificationStatus.READ
        self.read_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "body": self.body,
            "type": self.notification_type.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "action_url": self.action_url,
            "created_at": self.created_at.isoformat(),
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }


@dataclass
class DeliveryResult:
    """Result of notification delivery."""
    notification_id: str
    channel: NotificationChannel
    success: bool
    error: Optional[str] = None
    response_data: Dict[str, Any] = field(default_factory=dict)
    delivered_at: datetime = field(default_factory=datetime.utcnow)
    retry_count: int = 0


@dataclass
class NotificationDigest:
    """A digest of multiple notifications."""
    id: str
    user_id: str
    notifications: List[Notification] = field(default_factory=list)
    frequency: DigestFrequency = DigestFrequency.DAILY
    period_start: datetime = field(default_factory=datetime.utcnow)
    period_end: datetime = field(default_factory=datetime.utcnow)
    sent: bool = False
    sent_at: Optional[datetime] = None

    def add_notification(self, notification: Notification) -> None:
        """Add a notification to the digest."""
        self.notifications.append(notification)

    @property
    def count(self) -> int:
        """Get number of notifications in digest."""
        return len(self.notifications)

    def get_summary(self) -> Dict[str, int]:
        """Get summary by notification type."""
        summary = {}
        for notif in self.notifications:
            type_name = notif.notification_type.value
            summary[type_name] = summary.get(type_name, 0) + 1
        return summary


@dataclass
class NotificationConfig:
    """Configuration for notification manager."""
    max_queue_size: int = 10000
    batch_size: int = 100
    batch_interval_ms: int = 5000
    default_expiry_hours: int = 168  # 7 days
    enable_digest: bool = True
    enable_rate_limiting: bool = True
    rate_limit_per_user: int = 100  # Per hour
    retry_failed_after_ms: int = 60000
    max_retries: int = 3


# ==================== Channel Handlers ====================

class ChannelHandler:
    """Base class for channel handlers."""

    def __init__(self, config: ChannelConfig):
        self.config = config
        self._sent_count = 0
        self._last_reset = time.time()

    def can_send(self) -> bool:
        """Check if we can send (rate limiting)."""
        current_time = time.time()
        if current_time - self._last_reset > 60:
            self._sent_count = 0
            self._last_reset = current_time
        return self._sent_count < self.config.rate_limit

    def send(
        self,
        notification: Notification,
        preferences: NotificationPreferences
    ) -> DeliveryResult:
        """Send notification through this channel."""
        raise NotImplementedError

    def _record_send(self) -> None:
        """Record that a notification was sent."""
        self._sent_count += 1


class InAppHandler(ChannelHandler):
    """Handler for in-app notifications."""

    def __init__(self, config: ChannelConfig):
        super().__init__(config)
        self._notifications: Dict[str, List[Notification]] = {}  # user_id -> notifications

    def send(
        self,
        notification: Notification,
        preferences: NotificationPreferences
    ) -> DeliveryResult:
        """Store notification for in-app display."""
        if not self.can_send():
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.IN_APP,
                success=False,
                error="Rate limit exceeded"
            )

        user_id = notification.user_id
        if user_id not in self._notifications:
            self._notifications[user_id] = []
        self._notifications[user_id].append(notification)
        self._record_send()

        return DeliveryResult(
            notification_id=notification.id,
            channel=NotificationChannel.IN_APP,
            success=True
        )

    def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Notification]:
        """Get notifications for a user."""
        notifications = self._notifications.get(user_id, [])
        if unread_only:
            notifications = [n for n in notifications if n.status != NotificationStatus.READ]
        return notifications[-limit:]

    def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        notifications = self._notifications.get(user_id, [])
        return sum(1 for n in notifications if n.status != NotificationStatus.READ)


class EmailHandler(ChannelHandler):
    """Handler for email notifications."""

    def __init__(self, config: ChannelConfig):
        super().__init__(config)
        self._sent_emails: List[Dict[str, Any]] = []  # For testing

    def send(
        self,
        notification: Notification,
        preferences: NotificationPreferences
    ) -> DeliveryResult:
        """Send notification via email."""
        if not self.can_send():
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.EMAIL,
                success=False,
                error="Rate limit exceeded"
            )

        if not preferences.email_address:
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.EMAIL,
                success=False,
                error="No email address configured"
            )

        # In production, this would send via SMTP/API
        email_data = {
            "to": preferences.email_address,
            "subject": notification.title,
            "body": notification.body,
            "html": notification.html_body,
            "notification_id": notification.id,
            "sent_at": datetime.utcnow().isoformat()
        }
        self._sent_emails.append(email_data)
        self._record_send()

        return DeliveryResult(
            notification_id=notification.id,
            channel=NotificationChannel.EMAIL,
            success=True,
            response_data={"email": preferences.email_address}
        )


class PushHandler(ChannelHandler):
    """Handler for push notifications."""

    def __init__(self, config: ChannelConfig):
        super().__init__(config)
        self._sent_pushes: List[Dict[str, Any]] = []  # For testing

    def send(
        self,
        notification: Notification,
        preferences: NotificationPreferences
    ) -> DeliveryResult:
        """Send push notification."""
        if not self.can_send():
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.PUSH,
                success=False,
                error="Rate limit exceeded"
            )

        if not preferences.push_token:
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.PUSH,
                success=False,
                error="No push token configured"
            )

        # In production, this would send via FCM/APNS
        push_data = {
            "token": preferences.push_token,
            "title": notification.title,
            "body": notification.body,
            "data": notification.data,
            "notification_id": notification.id,
            "sent_at": datetime.utcnow().isoformat()
        }
        self._sent_pushes.append(push_data)
        self._record_send()

        return DeliveryResult(
            notification_id=notification.id,
            channel=NotificationChannel.PUSH,
            success=True,
            response_data={"token": preferences.push_token[:20] + "..."}
        )


class WebhookHandler(ChannelHandler):
    """Handler for webhook notifications."""

    def __init__(self, config: ChannelConfig):
        super().__init__(config)
        self._sent_webhooks: List[Dict[str, Any]] = []  # For testing

    def send(
        self,
        notification: Notification,
        preferences: NotificationPreferences
    ) -> DeliveryResult:
        """Send notification via webhook."""
        if not self.can_send():
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error="Rate limit exceeded"
            )

        if not self.config.endpoint:
            return DeliveryResult(
                notification_id=notification.id,
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error="No webhook endpoint configured"
            )

        # In production, this would POST to the webhook URL
        webhook_data = {
            "endpoint": self.config.endpoint,
            "payload": notification.to_dict(),
            "sent_at": datetime.utcnow().isoformat()
        }
        self._sent_webhooks.append(webhook_data)
        self._record_send()

        return DeliveryResult(
            notification_id=notification.id,
            channel=NotificationChannel.WEBHOOK,
            success=True,
            response_data={"endpoint": self.config.endpoint}
        )


# ==================== Template Manager ====================

class TemplateManager:
    """Manages notification templates."""

    def __init__(self):
        self._templates: Dict[str, NotificationTemplate] = {}
        self._register_default_templates()

    def _register_default_templates(self) -> None:
        """Register default notification templates."""
        self.register(NotificationTemplate(
            id="mention",
            name="User Mention",
            subject_template="{{sender_name}} mentioned you",
            body_template="{{sender_name}} mentioned you in {{context}}: \"{{excerpt}}\"",
            notification_type=NotificationType.MENTION,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        ))

        self.register(NotificationTemplate(
            id="comment",
            name="New Comment",
            subject_template="New comment on {{document_name}}",
            body_template="{{sender_name}} commented: \"{{comment_text}}\"",
            notification_type=NotificationType.COMMENT,
            default_channels=[NotificationChannel.IN_APP]
        ))

        self.register(NotificationTemplate(
            id="task_assigned",
            name="Task Assigned",
            subject_template="New task assigned: {{task_title}}",
            body_template="{{assigner_name}} assigned you a task: {{task_title}}",
            notification_type=NotificationType.TASK,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        ))

        self.register(NotificationTemplate(
            id="workflow_completed",
            name="Workflow Completed",
            subject_template="Workflow \"{{workflow_name}}\" completed",
            body_template="The workflow \"{{workflow_name}}\" has completed successfully.",
            notification_type=NotificationType.WORKFLOW,
            default_channels=[NotificationChannel.IN_APP]
        ))

    def register(self, template: NotificationTemplate) -> None:
        """Register a template."""
        self._templates[template.id] = template

    def get(self, template_id: str) -> Optional[NotificationTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def list_templates(self) -> List[NotificationTemplate]:
        """List all templates."""
        return list(self._templates.values())

    def create_notification(
        self,
        template_id: str,
        user_id: str,
        variables: Dict[str, Any],
        notification_id: Optional[str] = None
    ) -> Optional[Notification]:
        """Create a notification from a template."""
        template = self.get(template_id)
        if not template:
            return None

        rendered = template.render(variables)
        notif_id = notification_id or f"notif_{int(time.time() * 1000)}_{hash(user_id) % 10000}"

        return Notification(
            id=notif_id,
            user_id=user_id,
            title=rendered["subject"],
            body=rendered["body"],
            html_body=rendered["html"],
            notification_type=template.notification_type,
            channels=template.default_channels.copy(),
            template_id=template_id,
            data=variables
        )


# ==================== Notification Queue ====================

class NotificationQueue:
    """Queue for batching and processing notifications."""

    def __init__(self, config: NotificationConfig):
        self.config = config
        self._queue: List[Notification] = []
        self._processing = False
        self._last_flush = time.time()

    def enqueue(self, notification: Notification) -> bool:
        """Add notification to queue."""
        if len(self._queue) >= self.config.max_queue_size:
            return False
        notification.status = NotificationStatus.QUEUED
        self._queue.append(notification)
        return True

    def dequeue(self, count: Optional[int] = None) -> List[Notification]:
        """Remove and return notifications from queue."""
        count = count or self.config.batch_size
        batch = self._queue[:count]
        self._queue = self._queue[count:]
        return batch

    def peek(self, count: int = 10) -> List[Notification]:
        """View notifications without removing."""
        return self._queue[:count]

    @property
    def size(self) -> int:
        """Get queue size."""
        return len(self._queue)

    def should_flush(self) -> bool:
        """Check if queue should be flushed."""
        if len(self._queue) >= self.config.batch_size:
            return True
        elapsed = (time.time() - self._last_flush) * 1000
        return elapsed >= self.config.batch_interval_ms and len(self._queue) > 0

    def mark_flushed(self) -> None:
        """Mark that queue was flushed."""
        self._last_flush = time.time()

    def get_by_priority(self, priority: NotificationPriority) -> List[Notification]:
        """Get notifications by priority."""
        return [n for n in self._queue if n.priority == priority]

    def remove_expired(self) -> int:
        """Remove expired notifications."""
        before = len(self._queue)
        self._queue = [n for n in self._queue if not n.is_expired()]
        return before - len(self._queue)


# ==================== Digest Manager ====================

class DigestManager:
    """Manages notification digests."""

    def __init__(self):
        self._digests: Dict[str, NotificationDigest] = {}  # user_id -> current digest
        self._sent_digests: List[NotificationDigest] = []

    def add_to_digest(
        self,
        user_id: str,
        notification: Notification,
        frequency: DigestFrequency
    ) -> None:
        """Add notification to user's digest."""
        digest_key = f"{user_id}_{frequency.value}"
        if digest_key not in self._digests:
            self._digests[digest_key] = NotificationDigest(
                id=f"digest_{digest_key}_{int(time.time())}",
                user_id=user_id,
                frequency=frequency
            )
        self._digests[digest_key].add_notification(notification)

    def get_digest(
        self,
        user_id: str,
        frequency: DigestFrequency
    ) -> Optional[NotificationDigest]:
        """Get current digest for user."""
        digest_key = f"{user_id}_{frequency.value}"
        return self._digests.get(digest_key)

    def flush_digest(
        self,
        user_id: str,
        frequency: DigestFrequency
    ) -> Optional[NotificationDigest]:
        """Flush and return digest."""
        digest_key = f"{user_id}_{frequency.value}"
        digest = self._digests.pop(digest_key, None)
        if digest:
            digest.sent = True
            digest.sent_at = datetime.utcnow()
            digest.period_end = datetime.utcnow()
            self._sent_digests.append(digest)
        return digest

    def get_pending_digests(self, frequency: DigestFrequency) -> List[NotificationDigest]:
        """Get all pending digests for a frequency."""
        return [
            d for d in self._digests.values()
            if d.frequency == frequency and not d.sent
        ]

    def should_send_digest(
        self,
        user_id: str,
        frequency: DigestFrequency
    ) -> bool:
        """Check if digest should be sent."""
        digest = self.get_digest(user_id, frequency)
        if not digest or digest.count == 0:
            return False

        now = datetime.utcnow()
        elapsed = now - digest.period_start

        if frequency == DigestFrequency.HOURLY:
            return elapsed >= timedelta(hours=1)
        elif frequency == DigestFrequency.DAILY:
            return elapsed >= timedelta(days=1)
        elif frequency == DigestFrequency.WEEKLY:
            return elapsed >= timedelta(weeks=1)

        return False


# ==================== Notification Manager ====================

class NotificationManager:
    """Central notification management system."""

    def __init__(self, config: Optional[NotificationConfig] = None):
        self.config = config or NotificationConfig()
        self._preferences: Dict[str, NotificationPreferences] = {}
        self._handlers: Dict[NotificationChannel, ChannelHandler] = {}
        self._queue = NotificationQueue(self.config)
        self._template_manager = TemplateManager()
        self._digest_manager = DigestManager()
        self._delivery_results: List[DeliveryResult] = []
        self._notification_counter = 0
        self._callbacks: Dict[str, List[Callable]] = {
            "notification_created": [],
            "notification_sent": [],
            "notification_failed": [],
            "notification_read": [],
        }
        self._setup_default_handlers()

    def _setup_default_handlers(self) -> None:
        """Setup default channel handlers."""
        self._handlers[NotificationChannel.IN_APP] = InAppHandler(
            ChannelConfig(channel=NotificationChannel.IN_APP)
        )
        self._handlers[NotificationChannel.EMAIL] = EmailHandler(
            ChannelConfig(channel=NotificationChannel.EMAIL)
        )
        self._handlers[NotificationChannel.PUSH] = PushHandler(
            ChannelConfig(channel=NotificationChannel.PUSH)
        )
        self._handlers[NotificationChannel.WEBHOOK] = WebhookHandler(
            ChannelConfig(channel=NotificationChannel.WEBHOOK)
        )

    def register_handler(
        self,
        channel: NotificationChannel,
        handler: ChannelHandler
    ) -> None:
        """Register a channel handler."""
        self._handlers[channel] = handler

    def set_preferences(self, preferences: NotificationPreferences) -> None:
        """Set user notification preferences."""
        self._preferences[preferences.user_id] = preferences

    def get_preferences(self, user_id: str) -> NotificationPreferences:
        """Get user notification preferences."""
        if user_id not in self._preferences:
            self._preferences[user_id] = NotificationPreferences(user_id=user_id)
        return self._preferences[user_id]

    def create_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        notification_type: NotificationType = NotificationType.INFO,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        channels: Optional[List[NotificationChannel]] = None,
        **kwargs
    ) -> Notification:
        """Create a new notification."""
        self._notification_counter += 1
        notification_id = f"notif_{int(time.time() * 1000)}_{self._notification_counter}"

        notification = Notification(
            id=notification_id,
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            priority=priority,
            channels=channels or [NotificationChannel.IN_APP],
            **kwargs
        )

        self._emit_event("notification_created", notification)
        return notification

    def create_from_template(
        self,
        template_id: str,
        user_id: str,
        variables: Dict[str, Any]
    ) -> Optional[Notification]:
        """Create notification from template."""
        self._notification_counter += 1
        notification_id = f"notif_{int(time.time() * 1000)}_{self._notification_counter}"
        notification = self._template_manager.create_notification(
            template_id, user_id, variables, notification_id
        )
        if notification:
            self._emit_event("notification_created", notification)
        return notification

    def send(self, notification: Notification) -> List[DeliveryResult]:
        """Send notification immediately."""
        preferences = self.get_preferences(notification.user_id)
        results = []

        # Check if type is muted
        if preferences.is_type_muted(notification.notification_type):
            notification.status = NotificationStatus.CANCELLED
            return results

        # Check quiet hours for non-urgent notifications
        current_hour = datetime.utcnow().hour
        if (notification.priority != NotificationPriority.URGENT and
                preferences.is_in_quiet_hours(current_hour)):
            # Queue for later or digest
            if self.config.enable_digest:
                self._digest_manager.add_to_digest(
                    notification.user_id,
                    notification,
                    preferences.digest_frequency
                )
            return results

        # Send to each channel
        for channel in notification.channels:
            if not preferences.is_channel_enabled(channel):
                continue

            handler = self._handlers.get(channel)
            if not handler:
                continue

            result = handler.send(notification, preferences)
            results.append(result)
            self._delivery_results.append(result)

            if result.success:
                self._emit_event("notification_sent", notification, result)
            else:
                self._emit_event("notification_failed", notification, result)

        if any(r.success for r in results):
            notification.mark_sent()

        return results

    def send_batch(self, notifications: List[Notification]) -> List[DeliveryResult]:
        """Send a batch of notifications."""
        all_results = []
        for notification in notifications:
            results = self.send(notification)
            all_results.extend(results)
        return all_results

    def queue(self, notification: Notification) -> bool:
        """Add notification to queue for batch processing."""
        return self._queue.enqueue(notification)

    def process_queue(self) -> List[DeliveryResult]:
        """Process queued notifications."""
        if not self._queue.should_flush():
            return []

        batch = self._queue.dequeue()
        results = self.send_batch(batch)
        self._queue.mark_flushed()
        return results

    def notify(
        self,
        user_id: str,
        title: str,
        body: str,
        immediate: bool = True,
        **kwargs
    ) -> Optional[List[DeliveryResult]]:
        """Convenience method to create and send/queue notification."""
        notification = self.create_notification(user_id, title, body, **kwargs)
        if immediate:
            return self.send(notification)
        else:
            self.queue(notification)
            return None

    def notify_from_template(
        self,
        template_id: str,
        user_id: str,
        variables: Dict[str, Any],
        immediate: bool = True
    ) -> Optional[List[DeliveryResult]]:
        """Create and send notification from template."""
        notification = self.create_from_template(template_id, user_id, variables)
        if not notification:
            return None
        if immediate:
            return self.send(notification)
        else:
            self.queue(notification)
            return None

    def mark_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a notification as read."""
        handler = self._handlers.get(NotificationChannel.IN_APP)
        if isinstance(handler, InAppHandler):
            notifications = handler._notifications.get(user_id, [])
            for notif in notifications:
                if notif.id == notification_id:
                    notif.mark_read()
                    self._emit_event("notification_read", notif)
                    return True
        return False

    def mark_all_read(self, user_id: str) -> int:
        """Mark all notifications as read for a user."""
        handler = self._handlers.get(NotificationChannel.IN_APP)
        count = 0
        if isinstance(handler, InAppHandler):
            notifications = handler._notifications.get(user_id, [])
            for notif in notifications:
                if notif.status != NotificationStatus.READ:
                    notif.mark_read()
                    count += 1
        return count

    def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Notification]:
        """Get notifications for a user."""
        handler = self._handlers.get(NotificationChannel.IN_APP)
        if isinstance(handler, InAppHandler):
            return handler.get_notifications(user_id, unread_only, limit)
        return []

    def get_unread_count(self, user_id: str) -> int:
        """Get unread notification count."""
        handler = self._handlers.get(NotificationChannel.IN_APP)
        if isinstance(handler, InAppHandler):
            return handler.get_unread_count(user_id)
        return 0

    def register_template(self, template: NotificationTemplate) -> None:
        """Register a notification template."""
        self._template_manager.register(template)

    def get_template(self, template_id: str) -> Optional[NotificationTemplate]:
        """Get a notification template."""
        return self._template_manager.get(template_id)

    def process_digests(self, frequency: DigestFrequency) -> List[NotificationDigest]:
        """Process and send pending digests."""
        sent_digests = []
        pending = self._digest_manager.get_pending_digests(frequency)

        for digest in pending:
            if self._digest_manager.should_send_digest(digest.user_id, frequency):
                flushed = self._digest_manager.flush_digest(digest.user_id, frequency)
                if flushed:
                    # Send digest notification
                    summary = flushed.get_summary()
                    title = f"You have {flushed.count} notifications"
                    body = ", ".join(f"{v} {k}" for k, v in summary.items())
                    self.notify(
                        flushed.user_id,
                        title,
                        body,
                        notification_type=NotificationType.SYSTEM,
                        channels=[NotificationChannel.EMAIL]
                    )
                    sent_digests.append(flushed)

        return sent_digests

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
        """Get notification statistics."""
        successful = sum(1 for r in self._delivery_results if r.success)
        failed = sum(1 for r in self._delivery_results if not r.success)

        channel_stats = {}
        for result in self._delivery_results:
            channel = result.channel.value
            if channel not in channel_stats:
                channel_stats[channel] = {"sent": 0, "failed": 0}
            if result.success:
                channel_stats[channel]["sent"] += 1
            else:
                channel_stats[channel]["failed"] += 1

        return {
            "total_sent": successful,
            "total_failed": failed,
            "queue_size": self._queue.size,
            "templates_count": len(self._template_manager.list_templates()),
            "channel_stats": channel_stats,
        }


# ==================== Global Instances ====================

_notification_manager: Optional[NotificationManager] = None


def get_notification_manager() -> Optional[NotificationManager]:
    """Get the global notification manager."""
    return _notification_manager


def set_notification_manager(manager: NotificationManager) -> None:
    """Set the global notification manager."""
    global _notification_manager
    _notification_manager = manager


def reset_notification_manager() -> None:
    """Reset the global notification manager."""
    global _notification_manager
    _notification_manager = None


# ==================== Notification Builder ====================

class NotificationBuilder:
    """Fluent builder for creating notifications."""

    def __init__(self, user_id: str):
        self._user_id = user_id
        self._title = ""
        self._body = ""
        self._type = NotificationType.INFO
        self._priority = NotificationPriority.NORMAL
        self._channels: List[NotificationChannel] = [NotificationChannel.IN_APP]
        self._action_url = ""
        self._action_label = ""
        self._data: Dict[str, Any] = {}
        self._group_key: Optional[str] = None
        self._expires_in_hours: Optional[int] = None

    def title(self, title: str) -> "NotificationBuilder":
        """Set notification title."""
        self._title = title
        return self

    def body(self, body: str) -> "NotificationBuilder":
        """Set notification body."""
        self._body = body
        return self

    def type(self, notification_type: NotificationType) -> "NotificationBuilder":
        """Set notification type."""
        self._type = notification_type
        return self

    def priority(self, priority: NotificationPriority) -> "NotificationBuilder":
        """Set priority."""
        self._priority = priority
        return self

    def channels(self, *channels: NotificationChannel) -> "NotificationBuilder":
        """Set delivery channels."""
        self._channels = list(channels)
        return self

    def action(self, url: str, label: str = "View") -> "NotificationBuilder":
        """Set action URL and label."""
        self._action_url = url
        self._action_label = label
        return self

    def data(self, **kwargs) -> "NotificationBuilder":
        """Set additional data."""
        self._data.update(kwargs)
        return self

    def group(self, key: str) -> "NotificationBuilder":
        """Set group key for batching."""
        self._group_key = key
        return self

    def expires_in(self, hours: int) -> "NotificationBuilder":
        """Set expiration time."""
        self._expires_in_hours = hours
        return self

    def build(self) -> Notification:
        """Build the notification."""
        expires_at = None
        if self._expires_in_hours:
            expires_at = datetime.utcnow() + timedelta(hours=self._expires_in_hours)

        return Notification(
            id=f"notif_{int(time.time() * 1000)}_{hash(self._user_id) % 10000}",
            user_id=self._user_id,
            title=self._title,
            body=self._body,
            notification_type=self._type,
            priority=self._priority,
            channels=self._channels,
            action_url=self._action_url,
            action_label=self._action_label,
            data=self._data,
            group_key=self._group_key,
            expires_at=expires_at
        )
