"""Tests for Health Check System."""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock

from app.collaboration.health import (
    HealthStatus,
    HealthCheck,
    HealthCheckResult,
    HealthCheckRegistry,
    HealthManager,
    AggregatedHealth,
    PingHealthCheck,
    MemoryHealthCheck,
    DiskHealthCheck,
    ComponentHealthCheck,
    RedisHealthCheck,
    CallableHealthCheck,
    get_health_manager,
    set_health_manager,
    reset_health_manager,
)


class TestHealthStatus:
    """Tests for HealthStatus enum."""

    def test_status_values(self):
        """Status values are correct."""
        assert HealthStatus.HEALTHY.value == "healthy"
        assert HealthStatus.DEGRADED.value == "degraded"
        assert HealthStatus.UNHEALTHY.value == "unhealthy"
        assert HealthStatus.UNKNOWN.value == "unknown"


class TestHealthCheckResult:
    """Tests for HealthCheckResult."""

    def test_create_result(self):
        """Create a health check result."""
        result = HealthCheckResult(
            name="test",
            status=HealthStatus.HEALTHY,
            message="All good",
        )

        assert result.name == "test"
        assert result.status == HealthStatus.HEALTHY

    def test_to_dict(self):
        """Convert result to dictionary."""
        result = HealthCheckResult(
            name="test",
            status=HealthStatus.HEALTHY,
            message="All good",
            latency_ms=5.5,
        )

        d = result.to_dict()

        assert d["name"] == "test"
        assert d["status"] == "healthy"
        assert d["latency_ms"] == 5.5


class TestAggregatedHealth:
    """Tests for AggregatedHealth."""

    def test_create_aggregated(self):
        """Create aggregated health."""
        checks = [
            HealthCheckResult(name="a", status=HealthStatus.HEALTHY),
            HealthCheckResult(name="b", status=HealthStatus.HEALTHY),
        ]

        aggregated = AggregatedHealth(
            status=HealthStatus.HEALTHY,
            checks=checks,
            summary="All systems operational",
        )

        assert aggregated.status == HealthStatus.HEALTHY
        assert len(aggregated.checks) == 2

    def test_is_healthy(self):
        """Check is_healthy method."""
        healthy = AggregatedHealth(
            status=HealthStatus.HEALTHY,
            checks=[],
            summary="",
        )
        degraded = AggregatedHealth(
            status=HealthStatus.DEGRADED,
            checks=[],
            summary="",
        )
        unhealthy = AggregatedHealth(
            status=HealthStatus.UNHEALTHY,
            checks=[],
            summary="",
        )

        assert healthy.is_healthy() is True
        assert degraded.is_healthy() is False
        assert unhealthy.is_healthy() is False

    def test_is_ready(self):
        """Check is_ready method."""
        healthy = AggregatedHealth(
            status=HealthStatus.HEALTHY,
            checks=[],
            summary="",
        )
        degraded = AggregatedHealth(
            status=HealthStatus.DEGRADED,
            checks=[],
            summary="",
        )
        unhealthy = AggregatedHealth(
            status=HealthStatus.UNHEALTHY,
            checks=[],
            summary="",
        )

        assert healthy.is_ready() is True
        assert degraded.is_ready() is True
        assert unhealthy.is_ready() is False

    def test_to_dict(self):
        """Convert to dictionary."""
        aggregated = AggregatedHealth(
            status=HealthStatus.HEALTHY,
            checks=[
                HealthCheckResult(name="a", status=HealthStatus.HEALTHY),
            ],
            summary="All good",
        )

        d = aggregated.to_dict()

        assert d["status"] == "healthy"
        assert len(d["checks"]) == 1


class TestPingHealthCheck:
    """Tests for PingHealthCheck."""

    @pytest.mark.asyncio
    async def test_ping_check(self):
        """Ping check always returns healthy."""
        check = PingHealthCheck("ping")
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY


class TestCallableHealthCheck:
    """Tests for CallableHealthCheck."""

    @pytest.mark.asyncio
    async def test_callable_check(self):
        """Execute callable health check."""
        async def my_check():
            return HealthCheckResult(
                name="custom",
                status=HealthStatus.HEALTHY,
                message="Custom check passed",
            )

        check = CallableHealthCheck("custom", my_check)
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_callable_check_failure(self):
        """Callable check handles exceptions."""
        async def failing_check():
            raise ValueError("Something went wrong")

        check = CallableHealthCheck("failing", failing_check)
        result = await check.execute()

        assert result.status == HealthStatus.UNHEALTHY
        assert "Something went wrong" in result.message


class TestComponentHealthCheck:
    """Tests for ComponentHealthCheck."""

    @pytest.mark.asyncio
    async def test_healthy_component(self):
        """Check healthy component."""
        component = Mock()
        component.is_healthy = Mock(return_value=True)

        check = ComponentHealthCheck("component", component)
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_unhealthy_component(self):
        """Check unhealthy component."""
        component = Mock()
        component.is_healthy = Mock(return_value=False)

        check = ComponentHealthCheck("component", component)
        result = await check.execute()

        assert result.status == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_async_health_method(self):
        """Check component with async health method."""
        component = Mock()
        component.is_healthy = AsyncMock(return_value=True)

        check = ComponentHealthCheck("component", component)
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_missing_health_method(self):
        """Check component without health method."""
        component = Mock(spec=[])  # No methods

        check = ComponentHealthCheck("component", component)
        result = await check.execute()

        assert result.status == HealthStatus.UNKNOWN


class TestRedisHealthCheck:
    """Tests for RedisHealthCheck."""

    @pytest.mark.asyncio
    async def test_redis_healthy(self):
        """Check healthy Redis connection."""
        redis = Mock()
        redis.ping = Mock(return_value=True)

        check = RedisHealthCheck("redis", redis)
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_redis_async_ping(self):
        """Check Redis with async ping."""
        redis = Mock()
        redis.ping = AsyncMock(return_value=True)

        check = RedisHealthCheck("redis", redis)
        result = await check.execute()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_redis_not_configured(self):
        """Check Redis not configured."""
        check = RedisHealthCheck("redis", None)
        result = await check.execute()

        assert result.status == HealthStatus.UNKNOWN

    @pytest.mark.asyncio
    async def test_redis_connection_failed(self):
        """Check Redis connection failure."""
        redis = Mock()
        redis.ping = Mock(side_effect=ConnectionError("Connection refused"))

        check = RedisHealthCheck("redis", redis)
        result = await check.execute()

        assert result.status == HealthStatus.UNHEALTHY


class TestHealthCheckRegistry:
    """Tests for HealthCheckRegistry."""

    @pytest.fixture
    def registry(self):
        return HealthCheckRegistry()

    def test_register_check(self, registry):
        """Register a health check."""
        check = PingHealthCheck("ping")
        registry.register(check)

        assert "ping" in registry.list_checks()

    def test_unregister_check(self, registry):
        """Unregister a health check."""
        check = PingHealthCheck("ping")
        registry.register(check)

        result = registry.unregister("ping")

        assert result is True
        assert "ping" not in registry.list_checks()

    def test_unregister_nonexistent(self, registry):
        """Unregister nonexistent check returns False."""
        result = registry.unregister("nonexistent")
        assert result is False

    def test_get_check(self, registry):
        """Get a health check by name."""
        check = PingHealthCheck("ping")
        registry.register(check)

        retrieved = registry.get_check("ping")

        assert retrieved is check

    @pytest.mark.asyncio
    async def test_run_check(self, registry):
        """Run a single health check."""
        check = PingHealthCheck("ping")
        registry.register(check)

        result = await registry.run_check("ping")

        assert result is not None
        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_run_check_nonexistent(self, registry):
        """Run nonexistent check returns None."""
        result = await registry.run_check("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_run_all(self, registry):
        """Run all health checks."""
        registry.register(PingHealthCheck("ping1"))
        registry.register(PingHealthCheck("ping2"))

        results = await registry.run_all()

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_aggregated_health_all_healthy(self, registry):
        """Get aggregated health with all healthy."""
        registry.register(PingHealthCheck("ping1"))
        registry.register(PingHealthCheck("ping2"))

        aggregated = await registry.get_aggregated_health()

        assert aggregated.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_get_aggregated_health_no_checks(self, registry):
        """Get aggregated health with no checks."""
        aggregated = await registry.get_aggregated_health()

        assert aggregated.status == HealthStatus.UNKNOWN

    @pytest.mark.asyncio
    async def test_caching(self, registry):
        """Results are cached."""
        call_count = 0

        async def counting_check():
            nonlocal call_count
            call_count += 1
            return HealthCheckResult(
                name="counter",
                status=HealthStatus.HEALTHY,
            )

        registry.register(CallableHealthCheck("counter", counting_check))

        await registry.run_check("counter", use_cache=True)
        await registry.run_check("counter", use_cache=True)

        assert call_count == 1  # Only called once due to caching

    @pytest.mark.asyncio
    async def test_clear_cache(self, registry):
        """Clear the results cache."""
        registry.register(PingHealthCheck("ping"))
        await registry.run_check("ping")

        registry.clear_cache()

        # Cache should be empty now
        assert len(registry._cache) == 0


class TestHealthManager:
    """Tests for HealthManager."""

    @pytest.fixture
    def manager(self):
        return HealthManager()

    def test_default_checks(self, manager):
        """Manager has default checks."""
        checks = manager.registry.list_checks()
        assert "ping" in checks

    def test_set_ready(self, manager):
        """Set readiness state."""
        manager.set_ready(True)
        assert manager._ready is True

        manager.set_ready(False)
        assert manager._ready is False

    def test_set_live(self, manager):
        """Set liveness state."""
        manager.set_live(True)
        assert manager._live is True

        manager.set_live(False)
        assert manager._live is False

    @pytest.mark.asyncio
    async def test_liveness_alive(self, manager):
        """Liveness returns healthy when alive."""
        result = await manager.liveness()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_liveness_not_live(self, manager):
        """Liveness returns unhealthy when not live."""
        manager.set_live(False)

        result = await manager.liveness()

        assert result.status == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_readiness_not_ready(self, manager):
        """Readiness returns unhealthy when not ready."""
        manager.set_ready(False)

        result = await manager.readiness()

        assert result.status == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_readiness_ready(self, manager):
        """Readiness returns healthy when ready."""
        manager.set_ready(True)

        result = await manager.readiness()

        assert result.status == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_health(self, manager):
        """Get full health status."""
        health = await manager.health()

        assert isinstance(health, AggregatedHealth)

    def test_get_uptime(self, manager):
        """Get application uptime."""
        uptime = manager.get_uptime()

        assert isinstance(uptime, timedelta)
        assert uptime.total_seconds() >= 0

    def test_get_info(self, manager):
        """Get health manager info."""
        info = manager.get_info()

        assert "started_at" in info
        assert "uptime_seconds" in info
        assert "ready" in info
        assert "registered_checks" in info


class TestGlobalHealthManager:
    """Tests for global health manager functions."""

    def test_get_health_manager(self):
        """Get global health manager."""
        reset_health_manager()

        manager = get_health_manager()

        assert manager is not None
        assert isinstance(manager, HealthManager)

    def test_set_health_manager(self):
        """Set global health manager."""
        reset_health_manager()

        custom = HealthManager()
        set_health_manager(custom)

        assert get_health_manager() is custom

    def test_reset_health_manager(self):
        """Reset global health manager."""
        get_health_manager()  # Ensure one exists

        reset_health_manager()

        # Next call should create a new one
        manager = get_health_manager()
        assert manager is not None


class TestHealthCheckTimeout:
    """Tests for health check timeout handling."""

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Check that timeouts are handled."""
        async def slow_check():
            await asyncio.sleep(10)
            return HealthCheckResult(
                name="slow",
                status=HealthStatus.HEALTHY,
            )

        check = CallableHealthCheck("slow", slow_check, timeout=0.1)
        result = await check.execute()

        assert result.status == HealthStatus.UNHEALTHY
        assert "timed out" in result.message.lower()
