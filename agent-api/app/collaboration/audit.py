"""
Audit Logging for Collaboration Gateway

Provides comprehensive audit trail for:
- User actions (join, leave, edit)
- Document changes (operations, versions)
- System events (circuit breaker, rate limiting)
- Security events (authentication, authorization)

Supports multiple storage backends and retention policies.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Any, Callable, TypeVar
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)


class AuditEventType(Enum):
    """Types of audit events."""
    # User events
    USER_CONNECT = "user.connect"
    USER_DISCONNECT = "user.disconnect"
    USER_JOIN_DOCUMENT = "user.join_document"
    USER_LEAVE_DOCUMENT = "user.leave_document"

    # Document events
    DOCUMENT_CREATE = "document.create"
    DOCUMENT_OPERATION = "document.operation"
    DOCUMENT_SNAPSHOT = "document.snapshot"
    DOCUMENT_DELETE = "document.delete"

    # Collaboration events
    CURSOR_UPDATE = "collaboration.cursor_update"
    PRESENCE_CHANGE = "collaboration.presence_change"
    CONFLICT_RESOLVED = "collaboration.conflict_resolved"

    # System events
    CIRCUIT_BREAKER_OPEN = "system.circuit_breaker_open"
    CIRCUIT_BREAKER_CLOSE = "system.circuit_breaker_close"
    RATE_LIMIT_EXCEEDED = "system.rate_limit_exceeded"
    BACKPRESSURE_HIGH = "system.backpressure_high"

    # Security events
    AUTH_SUCCESS = "security.auth_success"
    AUTH_FAILURE = "security.auth_failure"
    PERMISSION_DENIED = "security.permission_denied"
    SUSPICIOUS_ACTIVITY = "security.suspicious_activity"


class AuditSeverity(Enum):
    """Severity levels for audit events."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    """An audit event record."""
    id: str
    event_type: AuditEventType
    severity: AuditSeverity
    timestamp: datetime
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    document_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    action: Optional[str] = None
    resource: Optional[str] = None
    details: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "client_id": self.client_id,
            "document_id": self.document_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "action": self.action,
            "resource": self.resource,
            "details": self.details,
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: dict) -> AuditEvent:
        """Create from dictionary."""
        return cls(
            id=data["id"],
            event_type=AuditEventType(data["event_type"]),
            severity=AuditSeverity(data["severity"]),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            user_id=data.get("user_id"),
            client_id=data.get("client_id"),
            document_id=data.get("document_id"),
            ip_address=data.get("ip_address"),
            user_agent=data.get("user_agent"),
            action=data.get("action"),
            resource=data.get("resource"),
            details=data.get("details", {}),
            metadata=data.get("metadata", {}),
        )


@dataclass
class AuditConfig:
    """Configuration for audit logger."""
    # Retention
    retention_days: int = 90
    max_events: int = 100000

    # Filtering
    min_severity: AuditSeverity = AuditSeverity.INFO
    enabled_event_types: Optional[set[AuditEventType]] = None  # None = all

    # Batching
    batch_size: int = 100
    flush_interval: float = 5.0  # seconds

    # Privacy
    mask_ip_addresses: bool = False
    exclude_details_keys: set[str] = field(default_factory=set)


class AuditStorage(ABC):
    """Abstract base class for audit storage backends."""

    @abstractmethod
    async def store(self, event: AuditEvent) -> bool:
        """Store an audit event."""
        pass

    @abstractmethod
    async def store_batch(self, events: list[AuditEvent]) -> int:
        """Store multiple events."""
        pass

    @abstractmethod
    async def query(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        pass

    @abstractmethod
    async def count(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> int:
        """Count matching events."""
        pass

    @abstractmethod
    async def cleanup(self, before: datetime) -> int:
        """Remove events older than given time."""
        pass


class InMemoryAuditStorage(AuditStorage):
    """In-memory audit storage for testing and development."""

    def __init__(self, max_events: int = 100000):
        self._events: list[AuditEvent] = []
        self._max_events = max_events
        self._lock = asyncio.Lock()

    async def store(self, event: AuditEvent) -> bool:
        async with self._lock:
            self._events.append(event)
            self._enforce_limit()
            return True

    async def store_batch(self, events: list[AuditEvent]) -> int:
        async with self._lock:
            self._events.extend(events)
            self._enforce_limit()
            return len(events)

    def _enforce_limit(self) -> None:
        if len(self._events) > self._max_events:
            # Remove oldest events
            self._events = self._events[-self._max_events:]

    async def query(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        async with self._lock:
            results = self._events.copy()

        # Apply filters
        if event_type:
            results = [e for e in results if e.event_type == event_type]
        if user_id:
            results = [e for e in results if e.user_id == user_id]
        if document_id:
            results = [e for e in results if e.document_id == document_id]
        if start_time:
            results = [e for e in results if e.timestamp >= start_time]
        if end_time:
            results = [e for e in results if e.timestamp <= end_time]

        # Sort by timestamp descending
        results.sort(key=lambda e: e.timestamp, reverse=True)

        # Apply pagination
        return results[offset:offset + limit]

    async def count(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> int:
        results = await self.query(
            event_type=event_type,
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            limit=self._max_events,
        )
        return len(results)

    async def cleanup(self, before: datetime) -> int:
        async with self._lock:
            original_count = len(self._events)
            self._events = [e for e in self._events if e.timestamp >= before]
            return original_count - len(self._events)

    async def clear(self) -> None:
        async with self._lock:
            self._events.clear()


class AuditLogger:
    """
    Central audit logger for collaboration events.

    Features:
    - Multiple storage backends
    - Event batching for performance
    - Configurable filtering and retention
    - Privacy controls (IP masking, field exclusion)
    """

    def __init__(
        self,
        config: Optional[AuditConfig] = None,
        storage: Optional[AuditStorage] = None,
    ):
        """
        Initialize audit logger.

        Args:
            config: Audit configuration
            storage: Storage backend (defaults to in-memory)
        """
        self.config = config or AuditConfig()
        self.storage = storage or InMemoryAuditStorage(self.config.max_events)

        # Event batching
        self._batch: list[AuditEvent] = []
        self._batch_lock = asyncio.Lock()

        # Background tasks
        self._flush_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

        # Statistics
        self._total_logged = 0
        self._total_filtered = 0
        self._total_errors = 0

        # Callbacks
        self.on_event: Optional[Callable[[AuditEvent], Any]] = None

    async def start(self) -> None:
        """Start background tasks."""
        if self._running:
            return

        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Audit logger started")

    async def stop(self) -> None:
        """Stop background tasks and flush remaining events."""
        self._running = False

        # Flush remaining events
        await self._flush_batch()

        # Cancel background tasks
        for task in [self._flush_task, self._cleanup_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        logger.info("Audit logger stopped")

    async def _flush_loop(self) -> None:
        """Periodically flush event batch."""
        try:
            while self._running:
                await asyncio.sleep(self.config.flush_interval)
                await self._flush_batch()
        except asyncio.CancelledError:
            pass

    async def _cleanup_loop(self) -> None:
        """Periodically cleanup old events."""
        try:
            while self._running:
                await asyncio.sleep(3600)  # Run hourly
                cutoff = datetime.utcnow() - timedelta(days=self.config.retention_days)
                removed = await self.storage.cleanup(cutoff)
                if removed > 0:
                    logger.info(f"Audit cleanup: removed {removed} old events")
        except asyncio.CancelledError:
            pass

    async def _flush_batch(self) -> None:
        """Flush current batch to storage."""
        async with self._batch_lock:
            if not self._batch:
                return

            batch = self._batch
            self._batch = []

        try:
            await self.storage.store_batch(batch)
        except Exception as e:
            logger.error(f"Failed to flush audit batch: {e}")
            self._total_errors += len(batch)

    def _should_log(self, event_type: AuditEventType, severity: AuditSeverity) -> bool:
        """Check if event should be logged based on config."""
        # Check severity
        severity_order = [
            AuditSeverity.DEBUG,
            AuditSeverity.INFO,
            AuditSeverity.WARNING,
            AuditSeverity.ERROR,
            AuditSeverity.CRITICAL,
        ]
        if severity_order.index(severity) < severity_order.index(self.config.min_severity):
            return False

        # Check event type filter
        if self.config.enabled_event_types is not None:
            if event_type not in self.config.enabled_event_types:
                return False

        return True

    def _mask_event(self, event: AuditEvent) -> AuditEvent:
        """Apply privacy masking to event."""
        if self.config.mask_ip_addresses and event.ip_address:
            # Mask last octet
            parts = event.ip_address.split(".")
            if len(parts) == 4:
                event.ip_address = f"{parts[0]}.{parts[1]}.{parts[2]}.xxx"

        # Remove excluded detail keys
        for key in self.config.exclude_details_keys:
            event.details.pop(key, None)

        return event

    async def log(
        self,
        event_type: AuditEventType,
        severity: AuditSeverity = AuditSeverity.INFO,
        user_id: Optional[str] = None,
        client_id: Optional[str] = None,
        document_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        details: Optional[dict] = None,
        metadata: Optional[dict] = None,
    ) -> Optional[AuditEvent]:
        """
        Log an audit event.

        Args:
            event_type: Type of event
            severity: Event severity
            user_id: User identifier
            client_id: Client identifier
            document_id: Document identifier
            ip_address: Client IP address
            user_agent: Client user agent
            action: Action performed
            resource: Resource affected
            details: Additional details
            metadata: Event metadata

        Returns:
            The logged event, or None if filtered
        """
        # Check if should log
        if not self._should_log(event_type, severity):
            self._total_filtered += 1
            return None

        # Create event
        event = AuditEvent(
            id=str(uuid.uuid4()),
            event_type=event_type,
            severity=severity,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            client_id=client_id,
            document_id=document_id,
            ip_address=ip_address,
            user_agent=user_agent,
            action=action,
            resource=resource,
            details=details or {},
            metadata=metadata or {},
        )

        # Apply masking
        event = self._mask_event(event)

        # Add to batch
        async with self._batch_lock:
            self._batch.append(event)
            self._total_logged += 1

            # Flush if batch is full
            if len(self._batch) >= self.config.batch_size:
                batch = self._batch
                self._batch = []

        if len(batch if 'batch' in dir() else []) > 0:
            try:
                await self.storage.store_batch(batch)
            except Exception as e:
                logger.error(f"Failed to store audit batch: {e}")

        # Invoke callback
        if self.on_event:
            try:
                result = self.on_event(event)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                pass

        return event

    async def log_user_connect(
        self,
        user_id: str,
        client_id: str,
        ip_address: Optional[str] = None,
        **kwargs
    ) -> Optional[AuditEvent]:
        """Log user connection."""
        return await self.log(
            AuditEventType.USER_CONNECT,
            AuditSeverity.INFO,
            user_id=user_id,
            client_id=client_id,
            ip_address=ip_address,
            action="connect",
            **kwargs
        )

    async def log_user_disconnect(
        self,
        user_id: str,
        client_id: str,
        **kwargs
    ) -> Optional[AuditEvent]:
        """Log user disconnection."""
        return await self.log(
            AuditEventType.USER_DISCONNECT,
            AuditSeverity.INFO,
            user_id=user_id,
            client_id=client_id,
            action="disconnect",
            **kwargs
        )

    async def log_document_operation(
        self,
        user_id: str,
        document_id: str,
        operation_count: int,
        version: int,
        **kwargs
    ) -> Optional[AuditEvent]:
        """Log document operation."""
        return await self.log(
            AuditEventType.DOCUMENT_OPERATION,
            AuditSeverity.DEBUG,
            user_id=user_id,
            document_id=document_id,
            action="operation",
            details={
                "operation_count": operation_count,
                "version": version,
            },
            **kwargs
        )

    async def log_rate_limit(
        self,
        user_id: str,
        limit_type: str,
        **kwargs
    ) -> Optional[AuditEvent]:
        """Log rate limit exceeded."""
        return await self.log(
            AuditEventType.RATE_LIMIT_EXCEEDED,
            AuditSeverity.WARNING,
            user_id=user_id,
            action="rate_limit",
            details={"limit_type": limit_type},
            **kwargs
        )

    async def log_security_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        reason: Optional[str] = None,
        **kwargs
    ) -> Optional[AuditEvent]:
        """Log security-related event."""
        return await self.log(
            event_type,
            AuditSeverity.WARNING,
            user_id=user_id,
            ip_address=ip_address,
            details={"reason": reason} if reason else {},
            **kwargs
        )

    async def query(
        self,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        # Flush pending events first
        await self._flush_batch()

        return await self.storage.query(
            event_type=event_type,
            user_id=user_id,
            document_id=document_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=offset,
        )

    async def get_user_activity(
        self,
        user_id: str,
        hours: int = 24,
        limit: int = 100,
    ) -> list[AuditEvent]:
        """Get recent activity for a user."""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        return await self.query(
            user_id=user_id,
            start_time=start_time,
            limit=limit,
        )

    async def get_document_history(
        self,
        document_id: str,
        limit: int = 100,
    ) -> list[AuditEvent]:
        """Get audit history for a document."""
        return await self.query(
            document_id=document_id,
            limit=limit,
        )

    def get_stats(self) -> dict:
        """Get audit logger statistics."""
        return {
            "total_logged": self._total_logged,
            "total_filtered": self._total_filtered,
            "total_errors": self._total_errors,
            "pending_batch_size": len(self._batch),
            "running": self._running,
        }
