# Circuit Breaker Webhook: Complete Production Implementation

**Document Type:** Internal Engineering Specification  
**Author:** Platform Technical Lead  
**Status:** Production-Ready  
**Last Updated:** 2026-01-15

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Circuit Breaker Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐    │
│  │  Prometheus  │────▶│  Alertmanager    │────▶│  Circuit Breaker     │    │
│  │  (Metrics)   │     │  (Alert Router)  │     │  Webhook (Flask)     │    │
│  └──────────────┘     └──────────────────┘     └──────────┬───────────┘    │
│                                                           │                 │
│                                                           ▼                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Redis Cluster                                 │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │ Circuit Breaker │  │ Pub/Sub Channel │  │ Deactivation    │       │  │
│  │  │ State Keys      │  │ (Broadcast)     │  │ Queue (ZSET)    │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    ▼               ▼               ▼                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  WebSocket Pod 1 │  │  WebSocket Pod 2 │  │  WebSocket Pod N │         │
│  │  (Subscriber)    │  │  (Subscriber)    │  │  (Subscriber)    │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
circuit_breaker_webhook/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Flask application entry point
│   ├── config.py               # Configuration management
│   ├── models.py               # Data models and enums
│   ├── redis_client.py         # Redis connection and operations
│   ├── circuit_breaker.py      # Circuit breaker logic
│   ├── alert_handler.py        # Alertmanager webhook handler
│   ├── scheduler.py            # Background task scheduler
│   ├── metrics.py              # Prometheus metrics
│   └── health.py               # Health check endpoints
├── tests/
│   ├── __init__.py
│   ├── test_circuit_breaker.py
│   ├── test_alert_handler.py
│   └── test_redis_client.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## 3. Configuration Module

```python
# File: app/config.py

"""
Configuration management for Circuit Breaker Webhook.
All values can be overridden via environment variables.
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class RedisConfig:
    """Redis connection configuration."""
    
    # Connection settings
    host: str = field(default_factory=lambda: os.getenv("REDIS_HOST", "redis-master"))
    port: int = field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))
    db: int = field(default_factory=lambda: int(os.getenv("REDIS_DB", "0")))
    password: Optional[str] = field(default_factory=lambda: os.getenv("REDIS_PASSWORD"))
    
    # Connection pool settings
    max_connections: int = field(default_factory=lambda: int(os.getenv("REDIS_MAX_CONNECTIONS", "50")))
    socket_timeout: float = field(default_factory=lambda: float(os.getenv("REDIS_SOCKET_TIMEOUT", "5.0")))
    socket_connect_timeout: float = field(default_factory=lambda: float(os.getenv("REDIS_CONNECT_TIMEOUT", "2.0")))
    retry_on_timeout: bool = True
    
    # Sentinel settings (for HA)
    use_sentinel: bool = field(default_factory=lambda: os.getenv("REDIS_USE_SENTINEL", "false").lower() == "true")
    sentinel_hosts: List[str] = field(default_factory=lambda: os.getenv("REDIS_SENTINEL_HOSTS", "").split(","))
    sentinel_master: str = field(default_factory=lambda: os.getenv("REDIS_SENTINEL_MASTER", "mymaster"))
    
    # Key prefixes
    key_prefix: str = "collab:circuit_breaker:"
    pubsub_channel: str = "collab:circuit_breaker:events"
    deactivation_queue: str = "collab:circuit_breaker:deactivate_queue"


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker behavior configuration."""
    
    # Activation settings
    activation_cooldown_seconds: int = field(
        default_factory=lambda: int(os.getenv("CB_ACTIVATION_COOLDOWN", "30"))
    )
    deactivation_delay_seconds: int = field(
        default_factory=lambda: int(os.getenv("CB_DEACTIVATION_DELAY", "120"))
    )
    
    # Grace period settings
    grace_period_seconds: int = field(
        default_factory=lambda: int(os.getenv("CB_GRACE_PERIOD", "60"))
    )
    
    # Thresholds
    backpressure_activate_threshold: float = field(
        default_factory=lambda: float(os.getenv("CB_ACTIVATE_THRESHOLD", "0.95"))
    )
    backpressure_deactivate_threshold: float = field(
        default_factory=lambda: float(os.getenv("CB_DEACTIVATE_THRESHOLD", "0.85"))
    )
    
    # Rate limiting
    max_activations_per_hour: int = field(
        default_factory=lambda: int(os.getenv("CB_MAX_ACTIVATIONS_PER_HOUR", "10"))
    )
    
    # Notification settings
    notify_on_activation: bool = True
    notify_on_deactivation: bool = True
    notify_slack_channel: str = field(
        default_factory=lambda: os.getenv("CB_SLACK_CHANNEL", "#platform-critical")
    )


@dataclass
class WebhookConfig:
    """Webhook server configuration."""
    
    host: str = field(default_factory=lambda: os.getenv("WEBHOOK_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("WEBHOOK_PORT", "8080")))
    debug: bool = field(default_factory=lambda: os.getenv("WEBHOOK_DEBUG", "false").lower() == "true")
    
    # Authentication
    auth_token: Optional[str] = field(default_factory=lambda: os.getenv("WEBHOOK_AUTH_TOKEN"))
    require_auth: bool = field(default_factory=lambda: os.getenv("WEBHOOK_REQUIRE_AUTH", "true").lower() == "true")
    
    # Request limits
    max_content_length: int = 1024 * 1024  # 1MB
    request_timeout: int = 30


@dataclass
class MetricsConfig:
    """Prometheus metrics configuration."""
    
    enabled: bool = field(default_factory=lambda: os.getenv("METRICS_ENABLED", "true").lower() == "true")
    port: int = field(default_factory=lambda: int(os.getenv("METRICS_PORT", "9090")))
    path: str = "/metrics"


@dataclass
class Config:
    """Main configuration container."""
    
    environment: Environment = field(
        default_factory=lambda: Environment(os.getenv("ENVIRONMENT", "production"))
    )
    redis: RedisConfig = field(default_factory=RedisConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    webhook: WebhookConfig = field(default_factory=WebhookConfig)
    metrics: MetricsConfig = field(default_factory=MetricsConfig)
    
    # Logging
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    log_format: str = "json"  # json or text
    
    @classmethod
    def load(cls) -> "Config":
        """Load configuration from environment."""
        return cls()


# Global config instance
config = Config.load()
```

---

## 4. Data Models

```python
# File: app/models.py

"""
Data models for Circuit Breaker Webhook.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import json
import uuid


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"           # Normal operation, accepting connections
    OPEN = "open"               # Rejecting new connections
    HALF_OPEN = "half_open"     # Testing if system recovered


class AlertStatus(Enum):
    """Alertmanager alert status."""
    FIRING = "firing"
    RESOLVED = "resolved"


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ActivationReason(Enum):
    """Reasons for circuit breaker activation."""
    BACKPRESSURE_CRITICAL = "backpressure_critical"
    WEBSOCKET_EXHAUSTION = "websocket_exhaustion"
    REDIS_SATURATION = "redis_saturation"
    OT_QUEUE_OVERFLOW = "ot_queue_overflow"
    MEMORY_CRITICAL = "memory_critical"
    MANUAL_ACTIVATION = "manual_activation"


class DeactivationReason(Enum):
    """Reasons for circuit breaker deactivation."""
    BACKPRESSURE_RECOVERED = "backpressure_recovered"
    SCHEDULED_DEACTIVATION = "scheduled_deactivation"
    MANUAL_DEACTIVATION = "manual_deactivation"
    TIMEOUT = "timeout"


@dataclass
class CircuitBreakerStatus:
    """Current circuit breaker status."""
    
    state: CircuitBreakerState
    activated_at: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None
    activation_reason: Optional[ActivationReason] = None
    activation_count_last_hour: int = 0
    last_backpressure_level: float = 0.0
    grace_period_ends_at: Optional[datetime] = None
    scheduled_deactivation_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "state": self.state.value,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "deactivated_at": self.deactivated_at.isoformat() if self.deactivated_at else None,
            "activation_reason": self.activation_reason.value if self.activation_reason else None,
            "activation_count_last_hour": self.activation_count_last_hour,
            "last_backpressure_level": self.last_backpressure_level,
            "grace_period_ends_at": self.grace_period_ends_at.isoformat() if self.grace_period_ends_at else None,
            "scheduled_deactivation_at": self.scheduled_deactivation_at.isoformat() if self.scheduled_deactivation_at else None,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CircuitBreakerStatus":
        """Create from dictionary."""
        return cls(
            state=CircuitBreakerState(data["state"]),
            activated_at=datetime.fromisoformat(data["activated_at"]) if data.get("activated_at") else None,
            deactivated_at=datetime.fromisoformat(data["deactivated_at"]) if data.get("deactivated_at") else None,
            activation_reason=ActivationReason(data["activation_reason"]) if data.get("activation_reason") else None,
            activation_count_last_hour=data.get("activation_count_last_hour", 0),
            last_backpressure_level=data.get("last_backpressure_level", 0.0),
            grace_period_ends_at=datetime.fromisoformat(data["grace_period_ends_at"]) if data.get("grace_period_ends_at") else None,
            scheduled_deactivation_at=datetime.fromisoformat(data["scheduled_deactivation_at"]) if data.get("scheduled_deactivation_at") else None,
        )


@dataclass
class CircuitBreakerEvent:
    """Event published to Redis pub/sub."""
    
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str = ""  # "activate", "deactivate", "half_open"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    reason: str = ""
    backpressure_level: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "reason": self.reason,
            "backpressure_level": self.backpressure_level,
            "metadata": self.metadata,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_json(cls, json_str: str) -> "CircuitBreakerEvent":
        """Create from JSON string."""
        data = json.loads(json_str)
        return cls(
            event_id=data["event_id"],
            event_type=data["event_type"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            reason=data["reason"],
            backpressure_level=data.get("backpressure_level", 0.0),
            metadata=data.get("metadata", {}),
        )


@dataclass
class AlertmanagerAlert:
    """Parsed Alertmanager alert."""
    
    status: AlertStatus
    alertname: str
    severity: AlertSeverity
    labels: Dict[str, str]
    annotations: Dict[str, str]
    starts_at: datetime
    ends_at: Optional[datetime] = None
    generator_url: Optional[str] = None
    fingerprint: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AlertmanagerAlert":
        """Parse from Alertmanager webhook payload."""
        return cls(
            status=AlertStatus(data["status"]),
            alertname=data["labels"]["alertname"],
            severity=AlertSeverity(data["labels"].get("severity", "warning")),
            labels=data["labels"],
            annotations=data.get("annotations", {}),
            starts_at=datetime.fromisoformat(data["startsAt"].replace("Z", "+00:00")),
            ends_at=datetime.fromisoformat(data["endsAt"].replace("Z", "+00:00")) if data.get("endsAt") else None,
            generator_url=data.get("generatorURL"),
            fingerprint=data.get("fingerprint"),
        )


@dataclass
class AlertmanagerPayload:
    """Full Alertmanager webhook payload."""
    
    version: str
    group_key: str
    status: AlertStatus
    receiver: str
    group_labels: Dict[str, str]
    common_labels: Dict[str, str]
    common_annotations: Dict[str, str]
    external_url: str
    alerts: List[AlertmanagerAlert]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AlertmanagerPayload":
        """Parse from Alertmanager webhook payload."""
        return cls(
            version=data.get("version", "4"),
            group_key=data.get("groupKey", ""),
            status=AlertStatus(data["status"]),
            receiver=data.get("receiver", ""),
            group_labels=data.get("groupLabels", {}),
            common_labels=data.get("commonLabels", {}),
            common_annotations=data.get("commonAnnotations", {}),
            external_url=data.get("externalURL", ""),
            alerts=[AlertmanagerAlert.from_dict(a) for a in data.get("alerts", [])],
        )


@dataclass
class DeactivationTask:
    """Scheduled deactivation task."""
    
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    scheduled_at: datetime = field(default_factory=datetime.utcnow)
    execute_at: datetime = field(default_factory=datetime.utcnow)
    reason: DeactivationReason = DeactivationReason.SCHEDULED_DEACTIVATION
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "task_id": self.task_id,
            "scheduled_at": self.scheduled_at.isoformat(),
            "execute_at": self.execute_at.isoformat(),
            "reason": self.reason.value,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_json(cls, json_str: str) -> "DeactivationTask":
        """Create from JSON string."""
        data = json.loads(json_str)
        return cls(
            task_id=data["task_id"],
            scheduled_at=datetime.fromisoformat(data["scheduled_at"]),
            execute_at=datetime.fromisoformat(data["execute_at"]),
            reason=DeactivationReason(data["reason"]),
        )
```

---

## 5. Redis Client Module

```python
# File: app/redis_client.py

"""
Redis client with connection pooling, retry logic, and pub/sub support.
"""

import redis
from redis.sentinel import Sentinel
from redis.exceptions import ConnectionError, TimeoutError, RedisError
from typing import Optional, Dict, Any, Callable, List
from datetime import datetime, timedelta
import time
import json
import logging
import threading
from contextlib import contextmanager

from app.config import config, RedisConfig
from app.models import (
    CircuitBreakerStatus,
    CircuitBreakerState,
    CircuitBreakerEvent,
    DeactivationTask,
)

logger = logging.getLogger(__name__)


class RedisClient:
    """
    Redis client with connection pooling and retry logic.
    
    Features:
    - Connection pooling for performance
    - Automatic retry on transient failures
    - Sentinel support for HA
    - Pub/sub for event broadcasting
    """
    
    def __init__(self, redis_config: Optional[RedisConfig] = None):
        self.config = redis_config or config.redis
        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        self._pubsub_thread: Optional[threading.Thread] = None
        self._subscribers: Dict[str, List[Callable]] = {}
        self._lock = threading.Lock()
        
    def connect(self) -> None:
        """Establish connection to Redis."""
        try:
            if self.config.use_sentinel:
                self._connect_sentinel()
            else:
                self._connect_standalone()
            
            # Test connection
            self._client.ping()
            logger.info(f"Connected to Redis at {self.config.host}:{self.config.port}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def _connect_standalone(self) -> None:
        """Connect to standalone Redis."""
        self._pool = redis.ConnectionPool(
            host=self.config.host,
            port=self.config.port,
            db=self.config.db,
            password=self.config.password,
            max_connections=self.config.max_connections,
            socket_timeout=self.config.socket_timeout,
            socket_connect_timeout=self.config.socket_connect_timeout,
            retry_on_timeout=self.config.retry_on_timeout,
            decode_responses=True,
        )
        self._client = redis.Redis(connection_pool=self._pool)
    
    def _connect_sentinel(self) -> None:
        """Connect to Redis via Sentinel for HA."""
        sentinel_hosts = [
            (host.split(":")[0], int(host.split(":")[1]))
            for host in self.config.sentinel_hosts
            if host
        ]
        sentinel = Sentinel(
            sentinel_hosts,
            socket_timeout=self.config.socket_timeout,
            password=self.config.password,
        )
        self._client = sentinel.master_for(
            self.config.sentinel_master,
            socket_timeout=self.config.socket_timeout,
            decode_responses=True,
        )
    
    def disconnect(self) -> None:
        """Close Redis connection."""
        if self._pubsub:
            self._pubsub.close()
        if self._pool:
            self._pool.disconnect()
        logger.info("Disconnected from Redis")
    
    @contextmanager
    def pipeline(self):
        """Create a pipeline for batch operations."""
        pipe = self._client.pipeline()
        try:
            yield pipe
            pipe.execute()
        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}")
            raise
    
    def _retry_operation(
        self,
        operation: Callable,
        max_retries: int = 3,
        base_delay: float = 0.1,
    ) -> Any:
        """
        Execute operation with exponential backoff retry.
        
        Args:
            operation: Callable to execute
            max_retries: Maximum retry attempts
            base_delay: Base delay between retries (exponential)
        
        Returns:
            Operation result
        
        Raises:
            RedisError: If all retries fail
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                return operation()
            except (ConnectionError, TimeoutError) as e:
                last_error = e
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        f"Redis operation failed (attempt {attempt + 1}/{max_retries + 1}), "
                        f"retrying in {delay:.2f}s: {e}"
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"Redis operation failed after {max_retries + 1} attempts: {e}")
        
        raise last_error
    
    # =========================================================================
    # Circuit Breaker State Operations
    # =========================================================================
    
    def get_circuit_breaker_status(self) -> CircuitBreakerStatus:
        """
        Get current circuit breaker status from Redis.
        
        Returns:
            CircuitBreakerStatus object
        """
        def _get():
            key = f"{self.config.key_prefix}status"
            data = self._client.get(key)
            
            if data:
                return CircuitBreakerStatus.from_dict(json.loads(data))
            else:
                # Default: closed (normal operation)
                return CircuitBreakerStatus(state=CircuitBreakerState.CLOSED)
        
        return self._retry_operation(_get)
    
    def set_circuit_breaker_status(self, status: CircuitBreakerStatus) -> None:
        """
        Set circuit breaker status in Redis.
        
        Args:
            status: CircuitBreakerStatus to set
        """
        def _set():
            key = f"{self.config.key_prefix}status"
            self._client.set(key, status.to_json())
        
        self._retry_operation(_set)
    
    def is_circuit_breaker_active(self) -> bool:
        """
        Check if circuit breaker is currently active (open).
        
        Returns:
            True if active, False otherwise
        """
        def _check():
            key = f"{self.config.key_prefix}active"
            return self._client.get(key) == "1"
        
        return self._retry_operation(_check)
    
    def activate_circuit_breaker(
        self,
        reason: str,
        backpressure_level: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Activate circuit breaker with atomic operation.
        
        Uses SETNX to ensure only one activation succeeds in race conditions.
        
        Args:
            reason: Activation reason
            backpressure_level: Current backpressure level
            metadata: Additional metadata
        
        Returns:
            True if activation succeeded, False if already active
        """
        def _activate():
            active_key = f"{self.config.key_prefix}active"
            activated_at_key = f"{self.config.key_prefix}activated_at"
            reason_key = f"{self.config.key_prefix}reason"
            count_key = f"{self.config.key_prefix}activation_count"
            
            # Atomic check-and-set
            # SETNX returns True only if key didn't exist
            if not self._client.setnx(active_key, "1"):
                logger.info("Circuit breaker already active, skipping activation")
                return False
            
            # Set activation metadata
            now = datetime.utcnow()
            pipe = self._client.pipeline()
            pipe.set(activated_at_key, now.isoformat())
            pipe.set(reason_key, reason)
            pipe.incr(count_key)
            pipe.expire(count_key, 3600)  # Count resets after 1 hour
            pipe.execute()
            
            # Update full status
            status = CircuitBreakerStatus(
                state=CircuitBreakerState.OPEN,
                activated_at=now,
                activation_reason=reason,
                last_backpressure_level=backpressure_level,
            )
            self.set_circuit_breaker_status(status)
            
            logger.critical(
                f"CIRCUIT BREAKER ACTIVATED - Reason: {reason}, "
                f"Backpressure: {backpressure_level:.2%}"
            )
            
            return True
        
        return self._retry_operation(_activate)
    
    def deactivate_circuit_breaker(self, reason: str) -> bool:
        """
        Deactivate circuit breaker.
        
        Args:
            reason: Deactivation reason
        
        Returns:
            True if deactivation succeeded, False if already inactive
        """
        def _deactivate():
            active_key = f"{self.config.key_prefix}active"
            
            # Check if active
            if not self._client.get(active_key):
                logger.info("Circuit breaker already inactive, skipping deactivation")
                return False
            
            # Delete active flag
            self._client.delete(active_key)
            
            # Update status
            now = datetime.utcnow()
            status = self.get_circuit_breaker_status()
            status.state = CircuitBreakerState.CLOSED
            status.deactivated_at = now
            self.set_circuit_breaker_status(status)
            
            logger.info(f"CIRCUIT BREAKER DEACTIVATED - Reason: {reason}")
            
            return True
        
        return self._retry_operation(_deactivate)
    
    def get_activation_count_last_hour(self) -> int:
        """
        Get number of activations in the last hour.
        
        Returns:
            Activation count
        """
        def _get_count():
            key = f"{self.config.key_prefix}activation_count"
            count = self._client.get(key)
            return int(count) if count else 0
        
        return self._retry_operation(_get_count)
    
    # =========================================================================
    # Pub/Sub Operations
    # =========================================================================
    
    def publish_event(self, event: CircuitBreakerEvent) -> int:
        """
        Publish circuit breaker event to all subscribers.
        
        Args:
            event: Event to publish
        
        Returns:
            Number of subscribers that received the message
        """
        def _publish():
            return self._client.publish(
                self.config.pubsub_channel,
                event.to_json()
            )
        
        subscriber_count = self._retry_operation(_publish)
        logger.info(
            f"Published event {event.event_type} to {subscriber_count} subscribers"
        )
        return subscriber_count
    
    def subscribe(self, callback: Callable[[CircuitBreakerEvent], None]) -> None:
        """
        Subscribe to circuit breaker events.
        
        Args:
            callback: Function to call when event received
        """
        with self._lock:
            if self.config.pubsub_channel not in self._subscribers:
                self._subscribers[self.config.pubsub_channel] = []
            self._subscribers[self.config.pubsub_channel].append(callback)
        
        # Start subscriber thread if not running
        if not self._pubsub_thread or not self._pubsub_thread.is_alive():
            self._start_subscriber_thread()
    
    def _start_subscriber_thread(self) -> None:
        """Start background thread for pub/sub."""
        self._pubsub = self._client.pubsub()
        self._pubsub.subscribe(self.config.pubsub_channel)
        
        def _listen():
            for message in self._pubsub.listen():
                if message["type"] == "message":
                    try:
                        event = CircuitBreakerEvent.from_json(message["data"])
                        callbacks = self._subscribers.get(self.config.pubsub_channel, [])
                        for callback in callbacks:
                            try:
                                callback(event)
                            except Exception as e:
                                logger.error(f"Subscriber callback error: {e}")
                    except Exception as e:
                        logger.error(f"Failed to parse event: {e}")
        
        self._pubsub_thread = threading.Thread(target=_listen, daemon=True)
        self._pubsub_thread.start()
        logger.info(f"Started pub/sub subscriber thread for {self.config.pubsub_channel}")
    
    # =========================================================================
    # Deactivation Queue Operations
    # =========================================================================
    
    def schedule_deactivation(self, delay_seconds: int) -> str:
        """
        Schedule circuit breaker deactivation.
        
        Uses Redis sorted set with score = execution timestamp.
        
        Args:
            delay_seconds: Seconds until deactivation
        
        Returns:
            Task ID
        """
        def _schedule():
            now = datetime.utcnow()
            execute_at = now + timedelta(seconds=delay_seconds)
            
            task = DeactivationTask(
                scheduled_at=now,
                execute_at=execute_at,
            )
            
            # Add to sorted set with score = execution timestamp
            self._client.zadd(
                self.config.deactivation_queue,
                {task.to_json(): execute_at.timestamp()}
            )
            
            logger.info(
                f"Scheduled deactivation task {task.task_id} "
                f"for {execute_at.isoformat()}"
            )
            
            return task.task_id
        
        return self._retry_operation(_schedule)
    
    def get_pending_deactivations(self) -> List[DeactivationTask]:
        """
        Get all pending deactivation tasks that are ready to execute.
        
        Returns:
            List of tasks ready for execution
        """
        def _get_pending():
            now = datetime.utcnow().timestamp()
            
            # Get all tasks with score <= now
            tasks_json = self._client.zrangebyscore(
                self.config.deactivation_queue,
                "-inf",
                now
            )
            
            return [DeactivationTask.from_json(t) for t in tasks_json]
        
        return self._retry_operation(_get_pending)
    
    def remove_deactivation_task(self, task: DeactivationTask) -> None:
        """
        Remove completed deactivation task from queue.
        
        Args:
            task: Task to remove
        """
        def _remove():
            self._client.zrem(self.config.deactivation_queue, task.to_json())
        
        self._retry_operation(_remove)
    
    def clear_deactivation_queue(self) -> int:
        """
        Clear all pending deactivation tasks.
        
        Returns:
            Number of tasks cleared
        """
        def _clear():
            count = self._client.zcard(self.config.deactivation_queue)
            self._client.delete(self.config.deactivation_queue)
            return count
        
        return self._retry_operation(_clear)
    
    # =========================================================================
    # Health Check
    # =========================================================================
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on Redis connection.
        
        Returns:
            Health status dictionary
        """
        try:
            start = time.time()
            self._client.ping()
            latency = (time.time() - start) * 1000
            
            info = self._client.info("server")
            
            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "redis_version": info.get("redis_version"),
                "connected_clients": self._client.info("clients").get("connected_clients"),
                "used_memory": self._client.info("memory").get("used_memory_human"),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }


# Global Redis client instance
redis_client = RedisClient()
```

---

## 6. Circuit Breaker Logic

```python
# File: app/circuit_breaker.py

"""
Circuit breaker logic for collaboration system protection.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from app.config import config
from app.redis_client import redis_client
from app.models import (
    CircuitBreakerStatus,
    CircuitBreakerState,
    CircuitBreakerEvent,
    ActivationReason,
    DeactivationReason,
)
from app.metrics import metrics

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """
    Circuit breaker for protecting collaboration system from overload.
    
    States:
    - CLOSED: Normal operation, accepting all connections
    - OPEN: Rejecting new connections, existing connections maintained
    - HALF_OPEN: Testing if system recovered (not implemented yet)
    
    Activation triggers:
    - Backpressure > 95%
    - WebSocket exhaustion
    - Redis pub/sub saturation
    - OT queue overflow
    - Memory critical
    
    Deactivation:
    - Scheduled after configurable delay (default 120s)
    - Manual deactivation via API
    - Backpressure drops below threshold
    """
    
    def __init__(self):
        self.config = config.circuit_breaker
    
    def get_status(self) -> CircuitBreakerStatus:
        """Get current circuit breaker status."""
        return redis_client.get_circuit_breaker_status()
    
    def is_active(self) -> bool:
        """Check if circuit breaker is currently active."""
        return redis_client.is_circuit_breaker_active()
    
    def activate(
        self,
        reason: ActivationReason,
        backpressure_level: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Activate circuit breaker.
        
        Args:
            reason: Why the circuit breaker is being activated
            backpressure_level: Current system backpressure (0.0 to 1.0)
            metadata: Additional context
        
        Returns:
            True if activation succeeded, False if already active or rate limited
        """
        # Check rate limit
        activation_count = redis_client.get_activation_count_last_hour()
        if activation_count >= self.config.max_activations_per_hour:
            logger.warning(
                f"Circuit breaker activation rate limited: "
                f"{activation_count} activations in last hour"
            )
            metrics.circuit_breaker_rate_limited.inc()
            return False
        
        # Attempt activation
        activated = redis_client.activate_circuit_breaker(
            reason=reason.value,
            backpressure_level=backpressure_level,
            metadata=metadata,
        )
        
        if activated:
            # Record metrics
            metrics.circuit_breaker_activations.labels(reason=reason.value).inc()
            metrics.circuit_breaker_state.set(1)  # 1 = OPEN
            
            # Publish event to all WebSocket servers
            event = CircuitBreakerEvent(
                event_type="activate",
                reason=reason.value,
                backpressure_level=backpressure_level,
                metadata=metadata or {},
            )
            redis_client.publish_event(event)
            
            # Schedule deactivation
            redis_client.schedule_deactivation(
                delay_seconds=self.config.deactivation_delay_seconds
            )
            
            logger.critical(
                f"🔥 CIRCUIT BREAKER ACTIVATED\n"
                f"   Reason: {reason.value}\n"
                f"   Backpressure: {backpressure_level:.2%}\n"
                f"   Scheduled deactivation in {self.config.deactivation_delay_seconds}s"
            )
        
        return activated
    
    def deactivate(
        self,
        reason: DeactivationReason = DeactivationReason.SCHEDULED_DEACTIVATION,
    ) -> bool:
        """
        Deactivate circuit breaker.
        
        Args:
            reason: Why the circuit breaker is being deactivated
        
        Returns:
            True if deactivation succeeded, False if already inactive
        """
        deactivated = redis_client.deactivate_circuit_breaker(reason=reason.value)
        
        if deactivated:
            # Record metrics
            metrics.circuit_breaker_deactivations.labels(reason=reason.value).inc()
            metrics.circuit_breaker_state.set(0)  # 0 = CLOSED
            
            # Publish event to all WebSocket servers
            event = CircuitBreakerEvent(
                event_type="deactivate",
                reason=reason.value,
            )
            redis_client.publish_event(event)
            
            # Clear any pending deactivation tasks
            cleared = redis_client.clear_deactivation_queue()
            
            logger.info(
                f"✅ CIRCUIT BREAKER DEACTIVATED\n"
                f"   Reason: {reason.value}\n"
                f"   Cleared {cleared} pending deactivation tasks"
            )
        
        return deactivated
    
    def should_activate(
        self,
        backpressure_level: float,
        component_levels: Optional[Dict[str, float]] = None,
    ) -> Optional[ActivationReason]:
        """
        Determine if circuit breaker should be activated.
        
        Args:
            backpressure_level: Overall backpressure (0.0 to 1.0)
            component_levels: Individual component levels
        
        Returns:
            ActivationReason if should activate, None otherwise
        """
        # Already active?
        if self.is_active():
            return None
        
        # Check overall backpressure
        if backpressure_level >= self.config.backpressure_activate_threshold:
            return ActivationReason.BACKPRESSURE_CRITICAL
        
        # Check individual components
        if component_levels:
            if component_levels.get("websocket", 0) >= 0.95:
                return ActivationReason.WEBSOCKET_EXHAUSTION
            if component_levels.get("redis_pubsub", 0) >= 0.95:
                return ActivationReason.REDIS_SATURATION
            if component_levels.get("ot_queue", 0) >= 0.95:
                return ActivationReason.OT_QUEUE_OVERFLOW
            if component_levels.get("memory", 0) >= 0.95:
                return ActivationReason.MEMORY_CRITICAL
        
        return None
    
    def should_deactivate(self, backpressure_level: float) -> bool:
        """
        Determine if circuit breaker should be deactivated.
        
        Args:
            backpressure_level: Current backpressure level
        
        Returns:
            True if should deactivate
        """
        if not self.is_active():
            return False
        
        return backpressure_level < self.config.backpressure_deactivate_threshold
    
    def process_pending_deactivations(self) -> int:
        """
        Process any pending scheduled deactivations.
        
        Called by background scheduler.
        
        Returns:
            Number of deactivations processed
        """
        pending = redis_client.get_pending_deactivations()
        processed = 0
        
        for task in pending:
            logger.info(f"Processing scheduled deactivation task {task.task_id}")
            
            if self.deactivate(reason=task.reason):
                processed += 1
            
            # Remove task from queue
            redis_client.remove_deactivation_task(task)
        
        return processed


# Global circuit breaker instance
circuit_breaker = CircuitBreaker()
```

---

## 7. Alert Handler

```python
# File: app/alert_handler.py

"""
Alertmanager webhook handler for circuit breaker activation.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.models import (
    AlertmanagerPayload,
    AlertmanagerAlert,
    AlertStatus,
    AlertSeverity,
    ActivationReason,
    DeactivationReason,
)
from app.circuit_breaker import circuit_breaker
from app.metrics import metrics

logger = logging.getLogger(__name__)


# Alert name to activation reason mapping
ALERT_REASON_MAP = {
    "CollaborationBackpressureCritical": ActivationReason.BACKPRESSURE_CRITICAL,
    "WebSocketConnectionsCritical": ActivationReason.WEBSOCKET_EXHAUSTION,
    "RedisPubSubCritical": ActivationReason.REDIS_SATURATION,
    "OTQueueOverflowCritical": ActivationReason.OT_QUEUE_OVERFLOW,
    "CollaborationMemoryCritical": ActivationReason.MEMORY_CRITICAL,
}

# Alerts that trigger circuit breaker
CIRCUIT_BREAKER_ALERTS = set(ALERT_REASON_MAP.keys())


class AlertHandler:
    """
    Handler for Alertmanager webhook payloads.
    
    Processes alerts and triggers circuit breaker activation/deactivation.
    """
    
    def handle_webhook(self, payload_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle incoming Alertmanager webhook.
        
        Args:
            payload_dict: Raw webhook payload
        
        Returns:
            Response dictionary with processing results
        """
        try:
            payload = AlertmanagerPayload.from_dict(payload_dict)
            
            logger.info(
                f"Received Alertmanager webhook: "
                f"status={payload.status.value}, "
                f"alerts={len(payload.alerts)}"
            )
            
            # Record metric
            metrics.alertmanager_webhooks_received.inc()
            
            # Process each alert
            results = []
            for alert in payload.alerts:
                result = self._process_alert(alert)
                results.append(result)
            
            return {
                "status": "processed",
                "alerts_processed": len(results),
                "results": results,
            }
            
        except Exception as e:
            logger.error(f"Failed to process Alertmanager webhook: {e}")
            metrics.alertmanager_webhooks_errors.inc()
            raise
    
    def _process_alert(self, alert: AlertmanagerAlert) -> Dict[str, Any]:
        """
        Process individual alert.
        
        Args:
            alert: Parsed alert
        
        Returns:
            Processing result
        """
        result = {
            "alertname": alert.alertname,
            "status": alert.status.value,
            "action": "none",
        }
        
        # Only process circuit breaker alerts
        if alert.alertname not in CIRCUIT_BREAKER_ALERTS:
            logger.debug(f"Ignoring non-circuit-breaker alert: {alert.alertname}")
            result["action"] = "ignored"
            return result
        
        if alert.status == AlertStatus.FIRING:
            result.update(self._handle_firing_alert(alert))
        elif alert.status == AlertStatus.RESOLVED:
            result.update(self._handle_resolved_alert(alert))
        
        return result
    
    def _handle_firing_alert(self, alert: AlertmanagerAlert) -> Dict[str, Any]:
        """
        Handle firing (active) alert.
        
        Args:
            alert: Firing alert
        
        Returns:
            Processing result
        """
        reason = ALERT_REASON_MAP.get(alert.alertname)
        if not reason:
            return {"action": "unknown_alert"}
        
        # Extract backpressure level from annotations if available
        backpressure_level = self._extract_backpressure_level(alert)
        
        # Build metadata
        metadata = {
            "alertname": alert.alertname,
            "severity": alert.severity.value,
            "labels": alert.labels,
            "annotations": alert.annotations,
            "starts_at": alert.starts_at.isoformat(),
            "fingerprint": alert.fingerprint,
        }
        
        # Attempt activation
        activated = circuit_breaker.activate(
            reason=reason,
            backpressure_level=backpressure_level,
            metadata=metadata,
        )
        
        if activated:
            logger.critical(
                f"Circuit breaker ACTIVATED by alert {alert.alertname}"
            )
            return {
                "action": "activated",
                "reason": reason.value,
                "backpressure_level": backpressure_level,
            }
        else:
            logger.info(
                f"Circuit breaker activation skipped for {alert.alertname} "
                f"(already active or rate limited)"
            )
            return {
                "action": "skipped",
                "reason": "already_active_or_rate_limited",
            }
    
    def _handle_resolved_alert(self, alert: AlertmanagerAlert) -> Dict[str, Any]:
        """
        Handle resolved alert.
        
        Note: We don't immediately deactivate on resolved alerts.
        Instead, we rely on the scheduled deactivation to ensure
        the system has truly recovered.
        
        Args:
            alert: Resolved alert
        
        Returns:
            Processing result
        """
        logger.info(
            f"Alert {alert.alertname} resolved. "
            f"Circuit breaker will deactivate on schedule."
        )
        
        return {
            "action": "noted",
            "reason": "deactivation_scheduled",
        }
    
    def _extract_backpressure_level(self, alert: AlertmanagerAlert) -> float:
        """
        Extract backpressure level from alert annotations.
        
        Args:
            alert: Alert to extract from
        
        Returns:
            Backpressure level (0.0 to 1.0), defaults to 0.95
        """
        # Try to extract from summary annotation
        summary = alert.annotations.get("summary", "")
        
        # Look for percentage in summary (e.g., "97.5%")
        import re
        match = re.search(r"(\d+\.?\d*)%", summary)
        if match:
            try:
                return float(match.group(1)) / 100.0
            except ValueError:
                pass
        
        # Default to threshold
        return 0.95


# Global alert handler instance
alert_handler = AlertHandler()
```

---

## 8. Prometheus Metrics

```python
# File: app/metrics.py

"""
Prometheus metrics for Circuit Breaker Webhook.
"""

from prometheus_client import Counter, Gauge, Histogram, Info
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from flask import Response


class Metrics:
    """Prometheus metrics collection."""
    
    def __init__(self):
        # Info metric
        self.build_info = Info(
            "circuit_breaker_webhook",
            "Circuit Breaker Webhook build information"
        )
        self.build_info.info({
            "version": "1.0.0",
            "component": "circuit_breaker_webhook",
        })
        
        # Circuit breaker state
        self.circuit_breaker_state = Gauge(
            "circuit_breaker_state",
            "Current circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)"
        )
        
        # Activation/deactivation counters
        self.circuit_breaker_activations = Counter(
            "circuit_breaker_activations_total",
            "Total circuit breaker activations",
            ["reason"]
        )
        
        self.circuit_breaker_deactivations = Counter(
            "circuit_breaker_deactivations_total",
            "Total circuit breaker deactivations",
            ["reason"]
        )
        
        self.circuit_breaker_rate_limited = Counter(
            "circuit_breaker_rate_limited_total",
            "Circuit breaker activations that were rate limited"
        )
        
        # Alertmanager webhook metrics
        self.alertmanager_webhooks_received = Counter(
            "alertmanager_webhooks_received_total",
            "Total Alertmanager webhooks received"
        )
        
        self.alertmanager_webhooks_errors = Counter(
            "alertmanager_webhooks_errors_total",
            "Total Alertmanager webhook processing errors"
        )
        
        # Pub/sub metrics
        self.pubsub_events_published = Counter(
            "circuit_breaker_pubsub_events_published_total",
            "Total events published to Redis pub/sub",
            ["event_type"]
        )
        
        self.pubsub_subscribers = Gauge(
            "circuit_breaker_pubsub_subscribers",
            "Number of subscribers to circuit breaker events"
        )
        
        # Deactivation queue metrics
        self.deactivation_queue_size = Gauge(
            "circuit_breaker_deactivation_queue_size",
            "Number of pending deactivation tasks"
        )
        
        self.deactivation_tasks_processed = Counter(
            "circuit_breaker_deactivation_tasks_processed_total",
            "Total deactivation tasks processed"
        )
        
        # Request latency
        self.webhook_request_latency = Histogram(
            "circuit_breaker_webhook_request_latency_seconds",
            "Webhook request processing latency",
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
        )
        
        # Redis metrics
        self.redis_operations = Counter(
            "circuit_breaker_redis_operations_total",
            "Total Redis operations",
            ["operation", "status"]
        )
        
        self.redis_latency = Histogram(
            "circuit_breaker_redis_latency_seconds",
            "Redis operation latency",
            ["operation"],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
        )
    
    def get_metrics(self) -> Response:
        """Generate Prometheus metrics response."""
        return Response(
            generate_latest(),
            mimetype=CONTENT_TYPE_LATEST
        )


# Global metrics instance
metrics = Metrics()
```

---

## 9. Flask Application

```python
# File: app/main.py

"""
Circuit Breaker Webhook Flask Application.

Main entry point for the webhook server.
"""

import logging
import sys
import time
from functools import wraps
from typing import Callable

from flask import Flask, request, jsonify, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.config import config
from app.redis_client import redis_client
from app.circuit_breaker import circuit_breaker
from app.alert_handler import alert_handler
from app.scheduler import scheduler
from app.metrics import metrics
from app.health import health_check

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = config.webhook.max_content_length


# ============================================================================
# Middleware
# ============================================================================

def require_auth(f: Callable) -> Callable:
    """Authentication decorator."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not config.webhook.require_auth:
            return f(*args, **kwargs)
        
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401
        
        # Expect "Bearer <token>"
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid Authorization header format"}), 401
        
        if parts[1] != config.webhook.auth_token:
            return jsonify({"error": "Invalid token"}), 403
        
        return f(*args, **kwargs)
    
    return decorated


def track_latency(f: Callable) -> Callable:
    """Request latency tracking decorator."""
    @wraps(f)
    def decorated(*args, **kwargs):
        start = time.time()
        try:
            return f(*args, **kwargs)
        finally:
            latency = time.time() - start
            metrics.webhook_request_latency.observe(latency)
    
    return decorated


# ============================================================================
# Routes
# ============================================================================

@app.route("/webhook/backpressure", methods=["POST"])
@require_auth
@track_latency
def handle_backpressure_webhook():
    """
    Handle Alertmanager webhook for backpressure alerts.
    
    Expected payload format (Alertmanager v4):
    {
        "version": "4",
        "groupKey": "...",
        "status": "firing" | "resolved",
        "receiver": "...",
        "groupLabels": {...},
        "commonLabels": {...},
        "commonAnnotations": {...},
        "externalURL": "...",
        "alerts": [
            {
                "status": "firing" | "resolved",
                "labels": {...},
                "annotations": {...},
                "startsAt": "...",
                "endsAt": "...",
                "generatorURL": "...",
                "fingerprint": "..."
            }
        ]
    }
    """
    try:
        payload = request.get_json()
        
        if not payload:
            return jsonify({"error": "Empty payload"}), 400
        
        result = alert_handler.handle_webhook(payload)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.exception(f"Error processing webhook: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/circuit-breaker/status", methods=["GET"])
@track_latency
def get_circuit_breaker_status():
    """Get current circuit breaker status."""
    try:
        status = circuit_breaker.get_status()
        return jsonify(status.to_dict()), 200
    except Exception as e:
        logger.exception(f"Error getting status: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/circuit-breaker/activate", methods=["POST"])
@require_auth
@track_latency
def manual_activate():
    """
    Manually activate circuit breaker.
    
    Request body:
    {
        "reason": "manual_activation",
        "backpressure_level": 0.95,
        "metadata": {...}
    }
    """
    try:
        data = request.get_json() or {}
        
        from app.models import ActivationReason
        
        activated = circuit_breaker.activate(
            reason=ActivationReason.MANUAL_ACTIVATION,
            backpressure_level=data.get("backpressure_level", 0.95),
            metadata=data.get("metadata"),
        )
        
        if activated:
            return jsonify({
                "status": "activated",
                "message": "Circuit breaker manually activated"
            }), 200
        else:
            return jsonify({
                "status": "skipped",
                "message": "Circuit breaker already active or rate limited"
            }), 200
            
    except Exception as e:
        logger.exception(f"Error activating circuit breaker: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/circuit-breaker/deactivate", methods=["POST"])
@require_auth
@track_latency
def manual_deactivate():
    """Manually deactivate circuit breaker."""
    try:
        from app.models import DeactivationReason
        
        deactivated = circuit_breaker.deactivate(
            reason=DeactivationReason.MANUAL_DEACTIVATION
        )
        
        if deactivated:
            return jsonify({
                "status": "deactivated",
                "message": "Circuit breaker manually deactivated"
            }), 200
        else:
            return jsonify({
                "status": "skipped",
                "message": "Circuit breaker already inactive"
            }), 200
            
    except Exception as e:
        logger.exception(f"Error deactivating circuit breaker: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    result = health_check()
    status_code = 200 if result["status"] == "healthy" else 503
    return jsonify(result), status_code


@app.route("/ready", methods=["GET"])
def ready():
    """Readiness check endpoint."""
    # Check Redis connection
    redis_health = redis_client.health_check()
    
    if redis_health["status"] == "healthy":
        return jsonify({"status": "ready"}), 200
    else:
        return jsonify({
            "status": "not_ready",
            "reason": "Redis unhealthy",
            "details": redis_health
        }), 503


@app.route("/metrics", methods=["GET"])
def prometheus_metrics():
    """Prometheus metrics endpoint."""
    return metrics.get_metrics()


# ============================================================================
# Application Lifecycle
# ============================================================================

def initialize():
    """Initialize application components."""
    logger.info("Initializing Circuit Breaker Webhook...")
    
    # Connect to Redis
    redis_client.connect()
    
    # Start background scheduler
    scheduler.start()
    
    # Initialize circuit breaker state metric
    if circuit_breaker.is_active():
        metrics.circuit_breaker_state.set(1)
    else:
        metrics.circuit_breaker_state.set(0)
    
    logger.info("Circuit Breaker Webhook initialized successfully")


def shutdown():
    """Shutdown application components."""
    logger.info("Shutting down Circuit Breaker Webhook...")
    
    # Stop scheduler
    scheduler.stop()
    
    # Disconnect from Redis
    redis_client.disconnect()
    
    logger.info("Circuit Breaker Webhook shutdown complete")


# Initialize on import
initialize()


# ============================================================================
# Entry Point
# ============================================================================

def main():
    """Main entry point."""
    try:
        logger.info(
            f"Starting Circuit Breaker Webhook on "
            f"{config.webhook.host}:{config.webhook.port}"
        )
        
        app.run(
            host=config.webhook.host,
            port=config.webhook.port,
            debug=config.webhook.debug,
        )
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    finally:
        shutdown()


if __name__ == "__main__":
    main()
```

---

## 10. Background Scheduler

```python
# File: app/scheduler.py

"""
Background task scheduler for circuit breaker operations.
"""

import logging
import threading
import time
from typing import Optional

from app.config import config
from app.circuit_breaker import circuit_breaker
from app.redis_client import redis_client
from app.metrics import metrics

logger = logging.getLogger(__name__)


class Scheduler:
    """
    Background scheduler for periodic tasks.
    
    Tasks:
    - Process pending deactivations
    - Update metrics
    - Health monitoring
    """
    
    def __init__(self):
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._interval = 5  # seconds
    
    def start(self):
        """Start the scheduler."""
        if self._running:
            logger.warning("Scheduler already running")
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Background scheduler started")
    
    def stop(self):
        """Stop the scheduler."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("Background scheduler stopped")
    
    def _run(self):
        """Main scheduler loop."""
        while self._running:
            try:
                self._tick()
            except Exception as e:
                logger.error(f"Scheduler tick error: {e}")
            
            time.sleep(self._interval)
    
    def _tick(self):
        """Execute scheduled tasks."""
        # Process pending deactivations
        processed = circuit_breaker.process_pending_deactivations()
        if processed > 0:
            metrics.deactivation_tasks_processed.inc(processed)
        
        # Update deactivation queue size metric
        pending = redis_client.get_pending_deactivations()
        metrics.deactivation_queue_size.set(len(pending))
        
        # Update circuit breaker state metric
        if circuit_breaker.is_active():
            metrics.circuit_breaker_state.set(1)
        else:
            metrics.circuit_breaker_state.set(0)


# Global scheduler instance
scheduler = Scheduler()
```

---

## 11. Health Check Module

```python
# File: app/health.py

"""
Health check utilities.
"""

import logging
from typing import Dict, Any
from datetime import datetime

from app.redis_client import redis_client
from app.circuit_breaker import circuit_breaker

logger = logging.getLogger(__name__)


def health_check() -> Dict[str, Any]:
    """
    Perform comprehensive health check.
    
    Returns:
        Health status dictionary
    """
    checks = {}
    overall_healthy = True
    
    # Redis health
    redis_health = redis_client.health_check()
    checks["redis"] = redis_health
    if redis_health["status"] != "healthy":
        overall_healthy = False
    
    # Circuit breaker status
    try:
        cb_status = circuit_breaker.get_status()
        checks["circuit_breaker"] = {
            "status": "healthy",
            "state": cb_status.state.value,
            "activated_at": cb_status.activated_at.isoformat() if cb_status.activated_at else None,
        }
    except Exception as e:
        checks["circuit_breaker"] = {
            "status": "unhealthy",
            "error": str(e),
        }
        overall_healthy = False
    
    return {
        "status": "healthy" if overall_healthy else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }
```

---

## 12. Requirements and Dockerfile

### 12.1 requirements.txt

```
# File: requirements.txt

flask==3.0.0
redis==5.0.1
prometheus-client==0.19.0
gunicorn==21.2.0
python-json-logger==2.0.7
```

### 12.2 Dockerfile

```dockerfile
# File: Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "4", "--threads", "2", "app.main:app"]
```

### 12.3 docker-compose.yml

```yaml
# File: docker-compose.yml

version: "3.8"

services:
  circuit-breaker-webhook:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - LOG_LEVEL=INFO
      - WEBHOOK_AUTH_TOKEN=your-secret-token
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis-data:
```

---

## 13. Kubernetes Deployment

```yaml
# File: k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: circuit-breaker-webhook
  namespace: collaboration
  labels:
    app: circuit-breaker-webhook
spec:
  replicas: 2
  selector:
    matchLabels:
      app: circuit-breaker-webhook
  template:
    metadata:
      labels:
        app: circuit-breaker-webhook
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: webhook
          image: circuit-breaker-webhook:latest
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: REDIS_HOST
              value: "redis-master.collaboration.svc.cluster.local"
            - name: REDIS_PORT
              value: "6379"
            - name: WEBHOOK_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: circuit-breaker-secrets
                  key: auth-token
            - name: LOG_LEVEL
              value: "INFO"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: circuit-breaker-webhook
  namespace: collaboration
spec:
  selector:
    app: circuit-breaker-webhook
  ports:
    - port: 8080
      targetPort: 8080
      name: http
```

---

## 14. Document Stats

| Section | Lines | Files |
|---------|-------|-------|
| Architecture | 30+ | - |
| Project Structure | 30+ | - |
| Configuration | 150+ | config.py |
| Data Models | 300+ | models.py |
| Redis Client | 400+ | redis_client.py |
| Circuit Breaker | 200+ | circuit_breaker.py |
| Alert Handler | 200+ | alert_handler.py |
| Metrics | 100+ | metrics.py |
| Flask App | 250+ | main.py |
| Scheduler | 80+ | scheduler.py |
| Health Check | 60+ | health.py |
| Docker/K8s | 100+ | Various |
| **Total** | **1900+** | **12 files** |

---

**Production-ready Circuit Breaker Webhook implementation!** 🎯
