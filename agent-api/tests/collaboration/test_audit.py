"""Tests for Audit Logger."""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.collaboration.audit import (
    AuditLogger,
    AuditConfig,
    AuditEvent,
    AuditEventType,
    AuditSeverity,
    InMemoryAuditStorage,
)


class TestAuditConfig:
    """Tests for AuditConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = AuditConfig()

        assert config.retention_days == 90
        assert config.max_events == 100000
        assert config.min_severity == AuditSeverity.INFO
        assert config.batch_size == 100

    def test_custom_config(self):
        """Can customize config."""
        config = AuditConfig(
            retention_days=30,
            min_severity=AuditSeverity.WARNING,
        )

        assert config.retention_days == 30
        assert config.min_severity == AuditSeverity.WARNING


class TestAuditEvent:
    """Tests for AuditEvent."""

    def test_to_dict(self):
        """Convert event to dictionary."""
        event = AuditEvent(
            id="test-123",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
            user_id="user_1",
        )

        d = event.to_dict()

        assert d["id"] == "test-123"
        assert d["event_type"] == "user.connect"
        assert d["severity"] == "info"
        assert d["user_id"] == "user_1"

    def test_to_json(self):
        """Convert event to JSON."""
        event = AuditEvent(
            id="test-123",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
        )

        json_str = event.to_json()

        assert "test-123" in json_str
        assert "user.connect" in json_str

    def test_from_dict(self):
        """Create event from dictionary."""
        data = {
            "id": "test-123",
            "event_type": "user.connect",
            "severity": "info",
            "timestamp": "2024-01-01T00:00:00",
            "user_id": "user_1",
        }

        event = AuditEvent.from_dict(data)

        assert event.id == "test-123"
        assert event.event_type == AuditEventType.USER_CONNECT
        assert event.user_id == "user_1"


class TestInMemoryAuditStorage:
    """Tests for InMemoryAuditStorage."""

    @pytest.fixture
    def storage(self):
        return InMemoryAuditStorage(max_events=100)

    @pytest.mark.asyncio
    async def test_store(self, storage):
        """Store an event."""
        event = AuditEvent(
            id="test-1",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
        )

        result = await storage.store(event)

        assert result is True
        events = await storage.query()
        assert len(events) == 1

    @pytest.mark.asyncio
    async def test_store_batch(self, storage):
        """Store multiple events."""
        events = [
            AuditEvent(
                id=f"test-{i}",
                event_type=AuditEventType.USER_CONNECT,
                severity=AuditSeverity.INFO,
                timestamp=datetime.utcnow(),
            )
            for i in range(5)
        ]

        count = await storage.store_batch(events)

        assert count == 5
        stored = await storage.query()
        assert len(stored) == 5

    @pytest.mark.asyncio
    async def test_query_by_type(self, storage):
        """Query events by type."""
        await storage.store(AuditEvent(
            id="test-1",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
        ))
        await storage.store(AuditEvent(
            id="test-2",
            event_type=AuditEventType.USER_DISCONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
        ))

        results = await storage.query(event_type=AuditEventType.USER_CONNECT)

        assert len(results) == 1
        assert results[0].event_type == AuditEventType.USER_CONNECT

    @pytest.mark.asyncio
    async def test_query_by_user(self, storage):
        """Query events by user."""
        await storage.store(AuditEvent(
            id="test-1",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
            user_id="user_1",
        ))
        await storage.store(AuditEvent(
            id="test-2",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=datetime.utcnow(),
            user_id="user_2",
        ))

        results = await storage.query(user_id="user_1")

        assert len(results) == 1
        assert results[0].user_id == "user_1"

    @pytest.mark.asyncio
    async def test_query_by_time_range(self, storage):
        """Query events by time range."""
        now = datetime.utcnow()

        await storage.store(AuditEvent(
            id="test-1",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=now - timedelta(hours=2),
        ))
        await storage.store(AuditEvent(
            id="test-2",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=now,
        ))

        results = await storage.query(
            start_time=now - timedelta(hours=1)
        )

        assert len(results) == 1
        assert results[0].id == "test-2"

    @pytest.mark.asyncio
    async def test_count(self, storage):
        """Count events."""
        for i in range(5):
            await storage.store(AuditEvent(
                id=f"test-{i}",
                event_type=AuditEventType.USER_CONNECT,
                severity=AuditSeverity.INFO,
                timestamp=datetime.utcnow(),
            ))

        count = await storage.count()
        assert count == 5

    @pytest.mark.asyncio
    async def test_cleanup(self, storage):
        """Cleanup old events."""
        now = datetime.utcnow()

        await storage.store(AuditEvent(
            id="test-old",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=now - timedelta(days=100),
        ))
        await storage.store(AuditEvent(
            id="test-new",
            event_type=AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
            timestamp=now,
        ))

        removed = await storage.cleanup(now - timedelta(days=90))

        assert removed == 1
        remaining = await storage.query()
        assert len(remaining) == 1
        assert remaining[0].id == "test-new"

    @pytest.mark.asyncio
    async def test_enforces_limit(self, storage):
        """Enforces max event limit."""
        for i in range(150):
            await storage.store(AuditEvent(
                id=f"test-{i}",
                event_type=AuditEventType.USER_CONNECT,
                severity=AuditSeverity.INFO,
                timestamp=datetime.utcnow(),
            ))

        events = await storage.query(limit=1000)
        assert len(events) == 100  # max_events


class TestAuditLogger:
    """Tests for AuditLogger."""

    @pytest.fixture
    def config(self):
        return AuditConfig(
            batch_size=5,
            flush_interval=0.1,
        )

    @pytest.fixture
    def logger(self, config):
        return AuditLogger(config=config)

    @pytest.mark.asyncio
    async def test_log_event(self, logger):
        """Log a basic event."""
        event = await logger.log(
            AuditEventType.USER_CONNECT,
            user_id="user_1",
        )

        assert event is not None
        assert event.event_type == AuditEventType.USER_CONNECT
        assert event.user_id == "user_1"

    @pytest.mark.asyncio
    async def test_log_with_details(self, logger):
        """Log event with details."""
        event = await logger.log(
            AuditEventType.DOCUMENT_OPERATION,
            user_id="user_1",
            document_id="doc_1",
            details={"operation_count": 5},
        )

        assert event.details["operation_count"] == 5

    @pytest.mark.asyncio
    async def test_severity_filtering(self, logger):
        """Events below min severity are filtered."""
        logger.config.min_severity = AuditSeverity.WARNING

        event = await logger.log(
            AuditEventType.USER_CONNECT,
            severity=AuditSeverity.INFO,
        )

        assert event is None
        assert logger._total_filtered == 1

    @pytest.mark.asyncio
    async def test_event_type_filtering(self, logger):
        """Only enabled event types are logged."""
        logger.config.enabled_event_types = {AuditEventType.USER_CONNECT}

        event1 = await logger.log(AuditEventType.USER_CONNECT)
        event2 = await logger.log(AuditEventType.USER_DISCONNECT)

        assert event1 is not None
        assert event2 is None

    @pytest.mark.asyncio
    async def test_ip_masking(self, logger):
        """IP addresses are masked when configured."""
        logger.config.mask_ip_addresses = True

        event = await logger.log(
            AuditEventType.USER_CONNECT,
            ip_address="192.168.1.100",
        )

        assert event.ip_address == "192.168.1.xxx"

    @pytest.mark.asyncio
    async def test_exclude_details_keys(self, logger):
        """Excluded keys are removed from details."""
        logger.config.exclude_details_keys = {"password", "token"}

        event = await logger.log(
            AuditEventType.AUTH_SUCCESS,
            details={"password": "secret", "username": "user"},
        )

        assert "password" not in event.details
        assert "username" in event.details

    @pytest.mark.asyncio
    async def test_log_user_connect(self, logger):
        """Convenience method for user connect."""
        event = await logger.log_user_connect(
            user_id="user_1",
            client_id="client_1",
            ip_address="127.0.0.1",
        )

        assert event.event_type == AuditEventType.USER_CONNECT
        assert event.action == "connect"

    @pytest.mark.asyncio
    async def test_log_document_operation(self, logger):
        """Convenience method for document operation."""
        # Set min severity to DEBUG to allow this event
        logger.config.min_severity = AuditSeverity.DEBUG

        event = await logger.log_document_operation(
            user_id="user_1",
            document_id="doc_1",
            operation_count=3,
            version=5,
        )

        assert event.event_type == AuditEventType.DOCUMENT_OPERATION
        assert event.details["operation_count"] == 3

    @pytest.mark.asyncio
    async def test_query(self, logger):
        """Query logged events."""
        await logger.log(AuditEventType.USER_CONNECT, user_id="user_1")
        await logger.log(AuditEventType.USER_CONNECT, user_id="user_2")

        # Flush to storage
        await logger._flush_batch()

        events = await logger.query(user_id="user_1")

        assert len(events) == 1
        assert events[0].user_id == "user_1"

    @pytest.mark.asyncio
    async def test_get_user_activity(self, logger):
        """Get user activity."""
        await logger.log(AuditEventType.USER_CONNECT, user_id="user_1")
        await logger.log(AuditEventType.DOCUMENT_OPERATION, user_id="user_1",
                        severity=AuditSeverity.WARNING)
        await logger._flush_batch()

        activity = await logger.get_user_activity("user_1")

        assert len(activity) >= 1

    @pytest.mark.asyncio
    async def test_on_event_callback(self, logger):
        """Event callback is invoked."""
        events = []

        async def on_event(event):
            events.append(event)

        logger.on_event = on_event

        await logger.log(AuditEventType.USER_CONNECT, user_id="user_1")

        assert len(events) == 1

    @pytest.mark.asyncio
    async def test_get_stats(self, logger):
        """Get logger statistics."""
        await logger.log(AuditEventType.USER_CONNECT)

        stats = logger.get_stats()

        assert stats["total_logged"] == 1
        assert "pending_batch_size" in stats

    @pytest.mark.asyncio
    async def test_start_stop(self, logger):
        """Start and stop background tasks."""
        await logger.start()
        assert logger._running is True

        await logger.stop()
        assert logger._running is False


class TestAuditEventType:
    """Tests for AuditEventType enum."""

    def test_user_events(self):
        """User event types exist."""
        assert AuditEventType.USER_CONNECT.value == "user.connect"
        assert AuditEventType.USER_DISCONNECT.value == "user.disconnect"

    def test_document_events(self):
        """Document event types exist."""
        assert AuditEventType.DOCUMENT_CREATE.value == "document.create"
        assert AuditEventType.DOCUMENT_OPERATION.value == "document.operation"

    def test_security_events(self):
        """Security event types exist."""
        assert AuditEventType.AUTH_SUCCESS.value == "security.auth_success"
        assert AuditEventType.AUTH_FAILURE.value == "security.auth_failure"


class TestAuditSeverity:
    """Tests for AuditSeverity enum."""

    def test_severity_levels(self):
        """All severity levels exist."""
        assert AuditSeverity.DEBUG.value == "debug"
        assert AuditSeverity.INFO.value == "info"
        assert AuditSeverity.WARNING.value == "warning"
        assert AuditSeverity.ERROR.value == "error"
        assert AuditSeverity.CRITICAL.value == "critical"
