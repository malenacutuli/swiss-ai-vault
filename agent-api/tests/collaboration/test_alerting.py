"""Tests for Alert Manager."""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.collaboration.alerting import (
    AlertManager,
    AlertConfig,
    Alert,
    AlertType,
    AlertSeverity,
    AlertBuilder,
)
from app.collaboration.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
    CircuitBreakerConfig,
)
from app.collaboration.backpressure import BackpressureCalculator
from app.collaboration.webhook import WebhookClient


class TestAlertConfig:
    """Tests for AlertConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = AlertConfig()

        assert config.backpressure_warning_threshold == 0.80
        assert config.backpressure_critical_threshold == 0.90
        assert config.cooldown_seconds == 60.0
        assert AlertType.CIRCUIT_OPEN in config.enabled_alerts

    def test_custom_config(self):
        """Can customize config."""
        config = AlertConfig(
            backpressure_warning_threshold=0.70,
            cooldown_seconds=30.0,
        )

        assert config.backpressure_warning_threshold == 0.70
        assert config.cooldown_seconds == 30.0


class TestAlertManager:
    """Tests for AlertManager."""

    @pytest.fixture
    def config(self):
        return AlertConfig(cooldown_seconds=0.1)  # Short cooldown for testing

    @pytest.fixture
    def manager(self, config):
        return AlertManager(config=config)

    @pytest.mark.asyncio
    async def test_create_alert(self, manager):
        """Create alert adds to history."""
        alert = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Circuit breaker opened",
        )

        assert alert is not None
        assert alert.type == AlertType.CIRCUIT_OPEN
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.message == "Circuit breaker opened"

    @pytest.mark.asyncio
    async def test_create_alert_with_data(self, manager):
        """Create alert with additional data."""
        alert = await manager.create_alert(
            AlertType.HIGH_BACKPRESSURE,
            AlertSeverity.WARNING,
            "High backpressure detected",
            data={"backpressure": 0.85, "threshold": 0.80},
        )

        assert alert.data["backpressure"] == 0.85
        assert alert.data["threshold"] == 0.80

    @pytest.mark.asyncio
    async def test_alert_cooldown(self, manager):
        """Same alert type is rate limited."""
        # First alert succeeds
        alert1 = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "First alert",
        )
        assert alert1 is not None

        # Second alert in cooldown period is skipped
        alert2 = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Second alert",
        )
        assert alert2 is None

    @pytest.mark.asyncio
    async def test_alert_bypass_cooldown(self, manager):
        """Can bypass cooldown."""
        alert1 = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "First alert",
        )
        assert alert1 is not None

        # Bypass cooldown
        alert2 = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Second alert",
            bypass_cooldown=True,
        )
        assert alert2 is not None

    @pytest.mark.asyncio
    async def test_disabled_alert_type(self, manager):
        """Disabled alert types are not created."""
        # Remove CIRCUIT_OPEN from enabled alerts
        manager.config.enabled_alerts.discard(AlertType.CIRCUIT_OPEN)

        alert = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Should not be created",
        )

        assert alert is None

    @pytest.mark.asyncio
    async def test_get_alert(self, manager):
        """Can retrieve alert by ID."""
        alert = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Test alert",
        )

        retrieved = manager.get_alert(alert.id)
        assert retrieved is not None
        assert retrieved.id == alert.id

    @pytest.mark.asyncio
    async def test_get_alerts_all(self, manager):
        """Get all alerts."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
            bypass_cooldown=True,
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        alerts = manager.get_alerts()
        assert len(alerts) == 2

    @pytest.mark.asyncio
    async def test_get_alerts_by_type(self, manager):
        """Filter alerts by type."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        alerts = manager.get_alerts(alert_type=AlertType.CIRCUIT_OPEN)
        assert len(alerts) == 1
        assert alerts[0].type == AlertType.CIRCUIT_OPEN

    @pytest.mark.asyncio
    async def test_get_alerts_by_severity(self, manager):
        """Filter alerts by severity."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        alerts = manager.get_alerts(severity=AlertSeverity.CRITICAL)
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_acknowledge_alert(self, manager):
        """Acknowledge an alert."""
        alert = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Test alert",
        )

        result = manager.acknowledge_alert(alert.id, acknowledged_by="user_123")

        assert result is True
        assert alert.acknowledged is True
        assert alert.acknowledged_by == "user_123"
        assert alert.acknowledged_at is not None

    @pytest.mark.asyncio
    async def test_acknowledge_unknown_alert(self, manager):
        """Acknowledge unknown alert returns False."""
        result = manager.acknowledge_alert("unknown-id")
        assert result is False

    @pytest.mark.asyncio
    async def test_get_alerts_by_acknowledged(self, manager):
        """Filter alerts by acknowledged status."""
        alert1 = await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        manager.acknowledge_alert(alert1.id)

        unacked = manager.get_alerts(acknowledged=False)
        assert len(unacked) == 1
        assert unacked[0].acknowledged is False

    @pytest.mark.asyncio
    async def test_clear_alerts(self, manager):
        """Clear all alerts."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        count = manager.clear_alerts()

        assert count == 2
        assert len(manager.get_alerts()) == 0

    @pytest.mark.asyncio
    async def test_clear_alerts_by_type(self, manager):
        """Clear alerts by type."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        count = manager.clear_alerts(alert_type=AlertType.CIRCUIT_OPEN)

        assert count == 1
        alerts = manager.get_alerts()
        assert len(alerts) == 1
        assert alerts[0].type == AlertType.CIRCUIT_CLOSE

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get alert statistics."""
        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Alert 1",
        )
        await manager.create_alert(
            AlertType.CIRCUIT_CLOSE,
            AlertSeverity.INFO,
            "Alert 2",
        )

        stats = manager.get_stats()

        assert stats["total_alerts"] == 2
        assert stats["active_alerts"] == 2
        assert AlertType.CIRCUIT_OPEN.value in stats["by_type"]
        assert AlertSeverity.CRITICAL.value in stats["by_severity"]

    @pytest.mark.asyncio
    async def test_on_alert_callback(self, manager):
        """Alert callback is invoked."""
        callbacks = []

        async def on_alert(alert):
            callbacks.append(alert)

        manager.on_alert = on_alert

        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Test alert",
        )

        assert len(callbacks) == 1
        assert callbacks[0].type == AlertType.CIRCUIT_OPEN

    @pytest.mark.asyncio
    async def test_webhook_integration(self, manager):
        """Alerts are sent via webhook."""
        mock_webhook = AsyncMock(spec=WebhookClient)
        mock_webhook.send = AsyncMock(return_value=[])
        manager.webhook_client = mock_webhook

        await manager.create_alert(
            AlertType.CIRCUIT_OPEN,
            AlertSeverity.CRITICAL,
            "Test alert",
        )

        mock_webhook.send.assert_called_once()
        call_args = mock_webhook.send.call_args
        assert "alert.circuit_open" in call_args[1]["event_type"]

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Can start and stop monitoring."""
        await manager.start()
        assert manager._running is True

        await manager.stop()
        assert manager._running is False


class TestCircuitBreakerIntegration:
    """Tests for AlertManager integration with CircuitBreaker."""

    @pytest.fixture
    def circuit_breaker(self):
        config = CircuitBreakerConfig(
            activation_threshold=0.95,
            open_duration=0.1,
        )
        return CircuitBreaker(config=config)

    @pytest.fixture
    def manager_with_breaker(self, circuit_breaker):
        config = AlertConfig(cooldown_seconds=0)
        return AlertManager(
            config=config,
            circuit_breaker=circuit_breaker,
        )

    @pytest.mark.asyncio
    async def test_alert_on_circuit_open(self, manager_with_breaker, circuit_breaker):
        """Alert is created when circuit opens."""
        await circuit_breaker.force_open()

        alerts = manager_with_breaker.get_alerts(alert_type=AlertType.CIRCUIT_OPEN)
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_alert_on_circuit_close(self, manager_with_breaker, circuit_breaker):
        """Alert is created when circuit closes."""
        await circuit_breaker.force_open()
        await circuit_breaker.force_close()

        alerts = manager_with_breaker.get_alerts(alert_type=AlertType.CIRCUIT_CLOSE)
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.INFO


class TestAlertBuilder:
    """Tests for AlertBuilder."""

    @pytest.fixture
    def manager(self):
        config = AlertConfig(cooldown_seconds=0)
        return AlertManager(config=config)

    @pytest.fixture
    def builder(self, manager):
        return AlertBuilder(manager)

    @pytest.mark.asyncio
    async def test_build_and_send(self, builder):
        """Build and send alert."""
        alert = await (
            builder
            .type(AlertType.CIRCUIT_OPEN)
            .severity(AlertSeverity.CRITICAL)
            .message("Test alert")
            .data(key="value")
            .send()
        )

        assert alert is not None
        assert alert.type == AlertType.CIRCUIT_OPEN
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.data["key"] == "value"

    @pytest.mark.asyncio
    async def test_builder_bypass_cooldown(self, builder):
        """Builder can bypass cooldown."""
        await (
            builder
            .type(AlertType.CIRCUIT_OPEN)
            .severity(AlertSeverity.CRITICAL)
            .message("First alert")
            .send()
        )

        builder2 = AlertBuilder(builder._manager)
        alert = await (
            builder2
            .type(AlertType.CIRCUIT_OPEN)
            .severity(AlertSeverity.CRITICAL)
            .message("Second alert")
            .bypass_cooldown()
            .send()
        )

        assert alert is not None

    @pytest.mark.asyncio
    async def test_builder_missing_type(self, builder):
        """Builder raises if type missing."""
        with pytest.raises(ValueError, match="type is required"):
            await builder.message("Test").send()

    @pytest.mark.asyncio
    async def test_builder_missing_message(self, builder):
        """Builder raises if message missing."""
        with pytest.raises(ValueError, match="message is required"):
            await builder.type(AlertType.CIRCUIT_OPEN).send()


class TestAlertType:
    """Tests for AlertType enum."""

    def test_alert_types(self):
        """All alert types exist."""
        assert AlertType.CIRCUIT_OPEN.value == "circuit_open"
        assert AlertType.CIRCUIT_CLOSE.value == "circuit_close"
        assert AlertType.HIGH_BACKPRESSURE.value == "high_backpressure"
        assert AlertType.SYSTEM_RECOVERED.value == "system_recovered"


class TestAlertSeverity:
    """Tests for AlertSeverity enum."""

    def test_severity_levels(self):
        """All severity levels exist."""
        assert AlertSeverity.INFO.value == "info"
        assert AlertSeverity.WARNING.value == "warning"
        assert AlertSeverity.ERROR.value == "error"
        assert AlertSeverity.CRITICAL.value == "critical"


class TestAlert:
    """Tests for Alert dataclass."""

    def test_default_values(self):
        """Alert has sensible defaults."""
        alert = Alert(
            id="test-123",
            type=AlertType.CIRCUIT_OPEN,
            severity=AlertSeverity.CRITICAL,
            message="Test alert",
        )

        assert alert.data == {}
        assert alert.acknowledged is False
        assert alert.acknowledged_at is None
        assert alert.created_at is not None
