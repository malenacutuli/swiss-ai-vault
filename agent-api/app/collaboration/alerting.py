"""
Alert Manager for Collaboration System

Manages alerts for circuit breaker events and system health:
- Circuit breaker state changes
- High backpressure warnings
- Connection threshold alerts
- Error rate alerts

Integrates with WebhookClient for external notifications.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from app.collaboration.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
    ActivationReason,
)
from app.collaboration.backpressure import BackpressureCalculator
from app.collaboration.webhook import WebhookClient, WebhookEndpoint

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(Enum):
    """Types of alerts."""
    CIRCUIT_OPEN = "circuit_open"
    CIRCUIT_CLOSE = "circuit_close"
    CIRCUIT_HALF_OPEN = "circuit_half_open"
    HIGH_BACKPRESSURE = "high_backpressure"
    BACKPRESSURE_NORMAL = "backpressure_normal"
    CONNECTION_THRESHOLD = "connection_threshold"
    ERROR_RATE_HIGH = "error_rate_high"
    SYSTEM_RECOVERED = "system_recovered"


@dataclass
class Alert:
    """An alert record."""
    id: str
    type: AlertType
    severity: AlertSeverity
    message: str
    data: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None


@dataclass
class AlertConfig:
    """Configuration for alert manager."""
    # Backpressure thresholds
    backpressure_warning_threshold: float = 0.80
    backpressure_critical_threshold: float = 0.90

    # Connection thresholds
    connection_warning_threshold: int = 8000
    connection_critical_threshold: int = 9500

    # Alert cooldown (prevent alert spam)
    cooldown_seconds: float = 60.0

    # Enable/disable alert types
    enabled_alerts: set = field(default_factory=lambda: {
        AlertType.CIRCUIT_OPEN,
        AlertType.CIRCUIT_CLOSE,
        AlertType.HIGH_BACKPRESSURE,
        AlertType.CONNECTION_THRESHOLD,
    })


class AlertManager:
    """
    Manages system alerts and notifications.

    Monitors:
    - Circuit breaker state changes
    - Backpressure levels
    - Connection counts
    - Error rates

    Sends alerts via:
    - Webhook notifications
    - Internal callbacks
    """

    def __init__(
        self,
        config: Optional[AlertConfig] = None,
        webhook_client: Optional[WebhookClient] = None,
        circuit_breaker: Optional[CircuitBreaker] = None,
        backpressure_calculator: Optional[BackpressureCalculator] = None,
    ):
        """
        Initialize alert manager.

        Args:
            config: Alert configuration
            webhook_client: Optional webhook client for notifications
            circuit_breaker: Optional circuit breaker to monitor
            backpressure_calculator: Optional backpressure calculator to monitor
        """
        self.config = config or AlertConfig()
        self.webhook_client = webhook_client
        self.circuit_breaker = circuit_breaker
        self.backpressure_calculator = backpressure_calculator

        # Alert history
        self._alerts: dict[str, Alert] = {}
        self._alert_counter = 0
        self._max_alert_history = 1000

        # Cooldown tracking
        self._last_alert_time: dict[AlertType, datetime] = {}

        # Statistics
        self._total_alerts = 0
        self._alerts_by_type: dict[AlertType, int] = {}
        self._alerts_by_severity: dict[AlertSeverity, int] = {}

        # Callbacks
        self.on_alert: Optional[Callable[[Alert], Any]] = None

        # Background monitoring
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False

        # Wire up circuit breaker callbacks
        if self.circuit_breaker:
            self._setup_circuit_breaker_hooks()

    def _setup_circuit_breaker_hooks(self) -> None:
        """Set up circuit breaker state change hooks."""
        if not self.circuit_breaker:
            return

        original_callback = self.circuit_breaker.on_state_change

        async def on_state_change(old_state: CircuitState, new_state: CircuitState):
            # Call original callback if exists
            if original_callback:
                result = original_callback(old_state, new_state)
                if asyncio.iscoroutine(result):
                    await result

            # Create alert based on new state
            await self._handle_circuit_state_change(old_state, new_state)

        self.circuit_breaker.on_state_change = on_state_change

    async def _handle_circuit_state_change(
        self,
        old_state: CircuitState,
        new_state: CircuitState
    ) -> None:
        """Handle circuit breaker state change."""
        if new_state == CircuitState.OPEN:
            stats = self.circuit_breaker.get_stats_dict()
            await self.create_alert(
                AlertType.CIRCUIT_OPEN,
                AlertSeverity.CRITICAL,
                f"Circuit breaker opened (backpressure: {stats['backpressure']:.2%})",
                data={
                    "previous_state": old_state.value,
                    "backpressure": stats["backpressure"],
                    "reason": stats.get("last_open_reason"),
                    "open_count": stats["open_count"],
                }
            )

        elif new_state == CircuitState.HALF_OPEN:
            await self.create_alert(
                AlertType.CIRCUIT_HALF_OPEN,
                AlertSeverity.WARNING,
                "Circuit breaker entering half-open state (testing recovery)",
                data={"previous_state": old_state.value}
            )

        elif new_state == CircuitState.CLOSED and old_state != CircuitState.CLOSED:
            await self.create_alert(
                AlertType.CIRCUIT_CLOSE,
                AlertSeverity.INFO,
                "Circuit breaker closed (system recovered)",
                data={"previous_state": old_state.value}
            )

    async def start(self) -> None:
        """Start background monitoring."""
        if self._running:
            return

        self._running = True
        self._monitoring_task = asyncio.create_task(self._monitor_loop())
        logger.info("Alert manager started")

    async def stop(self) -> None:
        """Stop background monitoring."""
        self._running = False

        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        logger.info("Alert manager stopped")

    async def _monitor_loop(self) -> None:
        """Background loop to monitor metrics."""
        try:
            while self._running:
                await asyncio.sleep(5)  # Check every 5 seconds
                await self._check_metrics()
        except asyncio.CancelledError:
            pass

    async def _check_metrics(self) -> None:
        """Check metrics and create alerts if needed."""
        # Check backpressure
        if self.backpressure_calculator:
            bp = self.backpressure_calculator.calculate()

            if bp >= self.config.backpressure_critical_threshold:
                await self.create_alert(
                    AlertType.HIGH_BACKPRESSURE,
                    AlertSeverity.CRITICAL,
                    f"Critical backpressure level: {bp:.2%}",
                    data={
                        "backpressure": bp,
                        "threshold": self.config.backpressure_critical_threshold,
                        "metrics": self.backpressure_calculator.get_metrics_dict(),
                    }
                )
            elif bp >= self.config.backpressure_warning_threshold:
                await self.create_alert(
                    AlertType.HIGH_BACKPRESSURE,
                    AlertSeverity.WARNING,
                    f"High backpressure level: {bp:.2%}",
                    data={
                        "backpressure": bp,
                        "threshold": self.config.backpressure_warning_threshold,
                    }
                )

    def _is_alert_enabled(self, alert_type: AlertType) -> bool:
        """Check if an alert type is enabled."""
        return alert_type in self.config.enabled_alerts

    def _is_in_cooldown(self, alert_type: AlertType) -> bool:
        """Check if an alert type is in cooldown period."""
        last_time = self._last_alert_time.get(alert_type)
        if not last_time:
            return False

        cooldown = timedelta(seconds=self.config.cooldown_seconds)
        return datetime.utcnow() - last_time < cooldown

    async def create_alert(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        message: str,
        data: Optional[dict] = None,
        bypass_cooldown: bool = False,
    ) -> Optional[Alert]:
        """
        Create and dispatch an alert.

        Args:
            alert_type: Type of alert
            severity: Alert severity
            message: Human-readable message
            data: Optional additional data
            bypass_cooldown: If True, ignore cooldown period

        Returns:
            The created alert, or None if filtered
        """
        # Check if enabled
        if not self._is_alert_enabled(alert_type):
            return None

        # Check cooldown
        if not bypass_cooldown and self._is_in_cooldown(alert_type):
            logger.debug(f"Alert {alert_type.value} in cooldown, skipping")
            return None

        # Create alert
        self._alert_counter += 1
        alert_id = f"alert_{self._alert_counter}_{int(datetime.utcnow().timestamp())}"

        alert = Alert(
            id=alert_id,
            type=alert_type,
            severity=severity,
            message=message,
            data=data or {},
        )

        # Store alert
        self._store_alert(alert)

        # Update cooldown
        self._last_alert_time[alert_type] = datetime.utcnow()

        # Update statistics
        self._total_alerts += 1
        self._alerts_by_type[alert_type] = self._alerts_by_type.get(alert_type, 0) + 1
        self._alerts_by_severity[severity] = self._alerts_by_severity.get(severity, 0) + 1

        logger.info(f"Alert created: [{severity.value}] {alert_type.value}: {message}")

        # Invoke callback
        if self.on_alert:
            try:
                result = self.on_alert(alert)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"Alert callback error: {e}")

        # Send webhook
        if self.webhook_client:
            try:
                await self.webhook_client.send(
                    event_type=f"alert.{alert_type.value}",
                    payload={
                        "alert_id": alert.id,
                        "type": alert_type.value,
                        "severity": severity.value,
                        "message": message,
                        "data": data or {},
                        "timestamp": alert.created_at.isoformat(),
                    }
                )
            except Exception as e:
                logger.error(f"Webhook send error: {e}")

        return alert

    def _store_alert(self, alert: Alert) -> None:
        """Store alert with cleanup of old alerts."""
        self._alerts[alert.id] = alert

        # Cleanup old alerts
        if len(self._alerts) > self._max_alert_history:
            sorted_alerts = sorted(
                self._alerts.items(),
                key=lambda x: x[1].created_at
            )
            for key, _ in sorted_alerts[:100]:
                del self._alerts[key]

    def get_alert(self, alert_id: str) -> Optional[Alert]:
        """Get an alert by ID."""
        return self._alerts.get(alert_id)

    def get_alerts(
        self,
        alert_type: Optional[AlertType] = None,
        severity: Optional[AlertSeverity] = None,
        acknowledged: Optional[bool] = None,
        limit: int = 100,
    ) -> list[Alert]:
        """
        Get alerts with optional filtering.

        Args:
            alert_type: Filter by type
            severity: Filter by severity
            acknowledged: Filter by acknowledgment status
            limit: Maximum alerts to return

        Returns:
            List of matching alerts
        """
        alerts = list(self._alerts.values())

        if alert_type:
            alerts = [a for a in alerts if a.type == alert_type]

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        if acknowledged is not None:
            alerts = [a for a in alerts if a.acknowledged == acknowledged]

        # Sort by creation time (newest first)
        alerts.sort(key=lambda x: x.created_at, reverse=True)

        return alerts[:limit]

    def acknowledge_alert(
        self,
        alert_id: str,
        acknowledged_by: Optional[str] = None
    ) -> bool:
        """
        Acknowledge an alert.

        Args:
            alert_id: Alert ID
            acknowledged_by: Who acknowledged (user ID)

        Returns:
            True if alert was acknowledged
        """
        alert = self._alerts.get(alert_id)
        if not alert:
            return False

        alert.acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = acknowledged_by

        return True

    def clear_alerts(self, alert_type: Optional[AlertType] = None) -> int:
        """
        Clear alerts from history.

        Args:
            alert_type: Optional type to clear (clears all if None)

        Returns:
            Number of alerts cleared
        """
        if alert_type is None:
            count = len(self._alerts)
            self._alerts.clear()
            return count

        to_remove = [
            key for key, alert in self._alerts.items()
            if alert.type == alert_type
        ]
        for key in to_remove:
            del self._alerts[key]

        return len(to_remove)

    def get_stats(self) -> dict:
        """Get alert manager statistics."""
        return {
            "total_alerts": self._total_alerts,
            "active_alerts": len([
                a for a in self._alerts.values()
                if not a.acknowledged
            ]),
            "by_type": {
                t.value: count
                for t, count in self._alerts_by_type.items()
            },
            "by_severity": {
                s.value: count
                for s, count in self._alerts_by_severity.items()
            },
            "monitoring_active": self._running,
        }


class AlertBuilder:
    """Fluent builder for creating alerts."""

    def __init__(self, manager: AlertManager):
        self._manager = manager
        self._type: Optional[AlertType] = None
        self._severity: AlertSeverity = AlertSeverity.INFO
        self._message: str = ""
        self._data: dict = {}
        self._bypass_cooldown: bool = False

    def type(self, alert_type: AlertType) -> AlertBuilder:
        self._type = alert_type
        return self

    def severity(self, severity: AlertSeverity) -> AlertBuilder:
        self._severity = severity
        return self

    def message(self, message: str) -> AlertBuilder:
        self._message = message
        return self

    def data(self, **kwargs) -> AlertBuilder:
        self._data.update(kwargs)
        return self

    def bypass_cooldown(self) -> AlertBuilder:
        self._bypass_cooldown = True
        return self

    async def send(self) -> Optional[Alert]:
        if not self._type:
            raise ValueError("Alert type is required")
        if not self._message:
            raise ValueError("Alert message is required")

        return await self._manager.create_alert(
            alert_type=self._type,
            severity=self._severity,
            message=self._message,
            data=self._data,
            bypass_cooldown=self._bypass_cooldown,
        )
