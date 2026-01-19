"""Tests for Throttle Manager."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock

from app.collaboration.throttle import (
    ThrottleManager,
    ThrottleConfig,
    ThrottleResult,
    MessageThrottler,
    ConnectionThrottler,
    ThrottledException,
    throttle,
    create_collaboration_throttle_manager,
    create_strict_throttle_manager,
)
from app.collaboration.rate_limiter import (
    TokenBucketLimiter,
    RateLimitInfo,
    RateLimitResult,
)


class TestThrottleConfig:
    """Tests for ThrottleConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = ThrottleConfig()

        assert config.operations_per_second == 10.0
        assert config.operations_burst == 50
        assert config.connections_per_minute == 10
        assert config.enable_degradation is True

    def test_custom_config(self):
        """Can customize config."""
        config = ThrottleConfig(
            operations_per_second=5.0,
            enable_degradation=False,
        )

        assert config.operations_per_second == 5.0
        assert config.enable_degradation is False


class TestMessageThrottler:
    """Tests for MessageThrottler."""

    @pytest.fixture
    def config(self):
        return ThrottleConfig(
            operations_per_second=10.0,
            operations_burst=5,
            messages_per_second=20.0,
            messages_burst=10,
            cursor_updates_per_second=30.0,
            enable_degradation=False,
        )

    @pytest.fixture
    def throttler(self, config):
        return MessageThrottler(config)

    @pytest.mark.asyncio
    async def test_allows_messages(self, throttler):
        """Allows messages under limit."""
        result = await throttler.check_message("user_1", "operation")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_operation_throttling(self, throttler):
        """Operations are throttled after burst."""
        # Exhaust burst
        for _ in range(5):
            await throttler.check_message("user_1", "operation")

        result = await throttler.check_message("user_1", "operation")
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_cursor_has_higher_limit(self, throttler):
        """Cursor updates have higher limit than operations."""
        # Exhaust operation burst
        for _ in range(5):
            await throttler.check_message("user_1", "operation")

        # Cursor should still be allowed (different limiter)
        result = await throttler.check_message("user_1", "cursor")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_reset_user(self, throttler):
        """Reset clears all limits for user."""
        # Exhaust limits
        for _ in range(5):
            await throttler.check_message("user_1", "operation")

        await throttler.reset_user("user_1")

        result = await throttler.check_message("user_1", "operation")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_get_stats(self, throttler):
        """Get throttler statistics."""
        await throttler.check_message("user_1", "operation")

        stats = throttler.get_stats()

        assert stats["total_messages"] == 1
        assert "limiters" in stats
        assert "operations" in stats["limiters"]

    @pytest.mark.asyncio
    async def test_degradation_delays(self):
        """Degradation mode delays instead of rejecting."""
        config = ThrottleConfig(
            operations_per_second=100.0,
            operations_burst=2,
            enable_degradation=True,
            degradation_delay=0.5,
        )
        throttler = MessageThrottler(config)

        # Use up burst
        await throttler.check_message("user_1", "operation")
        await throttler.check_message("user_1", "operation")

        # Wait a tiny bit for a small refill
        await asyncio.sleep(0.02)

        result = await throttler.check_message("user_1", "operation")
        # Should be allowed with delay since degradation is enabled
        # and retry_after should be very small after refill
        assert result.allowed is True


class TestConnectionThrottler:
    """Tests for ConnectionThrottler."""

    @pytest.fixture
    def config(self):
        return ThrottleConfig(connections_per_minute=5)

    @pytest.fixture
    def throttler(self, config):
        return ConnectionThrottler(config)

    @pytest.mark.asyncio
    async def test_allows_connections(self, throttler):
        """Allows connections under limit."""
        result = await throttler.check_connection(user_id="user_1")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_user_limit(self, throttler):
        """Limits connections per user."""
        for _ in range(5):
            await throttler.check_connection(user_id="user_1")

        result = await throttler.check_connection(user_id="user_1")
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_ip_limit(self, throttler):
        """Limits connections per IP."""
        # IP limit is 2x user limit
        for _ in range(10):
            await throttler.check_connection(ip_address="192.168.1.1")

        result = await throttler.check_connection(ip_address="192.168.1.1")
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_reset_user(self, throttler):
        """Reset clears user limit."""
        for _ in range(5):
            await throttler.check_connection(user_id="user_1")

        await throttler.reset_user("user_1")

        result = await throttler.check_connection(user_id="user_1")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_reset_ip(self, throttler):
        """Reset clears IP limit."""
        for _ in range(10):
            await throttler.check_connection(ip_address="192.168.1.1")

        await throttler.reset_ip("192.168.1.1")

        result = await throttler.check_connection(ip_address="192.168.1.1")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_get_stats(self, throttler):
        """Get throttler statistics."""
        await throttler.check_connection(user_id="user_1")

        stats = throttler.get_stats()

        assert stats["total_connections"] == 1
        assert "user_limiter" in stats
        assert "ip_limiter" in stats


class TestThrottleManager:
    """Tests for ThrottleManager."""

    @pytest.fixture
    def config(self):
        return ThrottleConfig(
            operations_per_second=10.0,
            operations_burst=5,
            connections_per_minute=5,
        )

    @pytest.fixture
    def manager(self, config):
        return ThrottleManager(config)

    @pytest.mark.asyncio
    async def test_check_connection(self, manager):
        """Check connection through manager."""
        result = await manager.check_connection(user_id="user_1")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_check_message(self, manager):
        """Check message through manager."""
        result = await manager.check_message("user_1", "operation")
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_throttle_callback(self):
        """Throttle callback is invoked."""
        # Create manager with degradation disabled
        config = ThrottleConfig(
            operations_per_second=10.0,
            operations_burst=5,
            enable_degradation=False,
        )
        manager = ThrottleManager(config)

        callbacks = []

        async def on_throttle(identifier, throttle_type, info):
            callbacks.append((identifier, throttle_type))

        manager.on_throttle = on_throttle

        # Exhaust limit
        for _ in range(5):
            await manager.check_message("user_1", "operation")

        await manager.check_message("user_1", "operation")

        assert len(callbacks) == 1
        assert callbacks[0][0] == "user_1"
        assert callbacks[0][1] == "operation"

    @pytest.mark.asyncio
    async def test_reset_user(self, manager):
        """Reset all limits for user."""
        # Exhaust limits
        for _ in range(5):
            await manager.check_connection(user_id="user_1")
            await manager.check_message("user_1", "operation")

        await manager.reset_user("user_1")

        conn_result = await manager.check_connection(user_id="user_1")
        msg_result = await manager.check_message("user_1", "operation")

        assert conn_result.allowed is True
        assert msg_result.allowed is True

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get all statistics."""
        await manager.check_connection(user_id="user_1")
        await manager.check_message("user_1", "operation")

        stats = manager.get_stats()

        assert "messages" in stats
        assert "connections" in stats


class TestThrottleDecorator:
    """Tests for throttle decorator."""

    @pytest.mark.asyncio
    async def test_decorator_allows(self):
        """Decorator allows requests under limit."""
        limiter = TokenBucketLimiter(rate=10.0, capacity=5)

        @throttle(limiter, key_func=lambda user_id: user_id)
        async def my_function(user_id: str) -> str:
            return f"hello {user_id}"

        result = await my_function("user_1")
        assert result == "hello user_1"

    @pytest.mark.asyncio
    async def test_decorator_limits(self):
        """Decorator raises exception when limited."""
        limiter = TokenBucketLimiter(rate=10.0, capacity=2)

        @throttle(limiter, key_func=lambda user_id: user_id)
        async def my_function(user_id: str) -> str:
            return f"hello {user_id}"

        # Use up tokens
        await my_function("user_1")
        await my_function("user_1")

        with pytest.raises(ThrottledException):
            await my_function("user_1")

    @pytest.mark.asyncio
    async def test_decorator_on_limited_callback(self):
        """Decorator calls on_limited callback."""
        limiter = TokenBucketLimiter(rate=10.0, capacity=1)
        limited_calls = []

        def on_limited(info):
            limited_calls.append(info)

        @throttle(limiter, key_func=lambda x: x, on_limited=on_limited)
        async def my_function(user_id: str) -> str:
            return f"hello {user_id}"

        await my_function("user_1")

        with pytest.raises(ThrottledException):
            await my_function("user_1")

        assert len(limited_calls) == 1


class TestThrottledException:
    """Tests for ThrottledException."""

    def test_exception_message(self):
        """Exception has informative message."""
        info = RateLimitInfo(
            result=RateLimitResult.LIMITED,
            limit=100,
            remaining=0,
            reset_at=0,
            retry_after=5.0,
        )

        exc = ThrottledException(info)

        assert "5.0s" in str(exc)
        assert exc.info == info


class TestThrottleResult:
    """Tests for ThrottleResult."""

    def test_allowed_result(self):
        """Allowed result."""
        result = ThrottleResult(allowed=True)
        assert result.allowed is True
        assert result.delayed is False

    def test_delayed_result(self):
        """Delayed result."""
        result = ThrottleResult(
            allowed=True,
            delayed=True,
            delay_seconds=0.5,
        )
        assert result.allowed is True
        assert result.delayed is True
        assert result.delay_seconds == 0.5


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_collaboration_throttle_manager(self):
        """Create collaboration throttle manager."""
        manager = create_collaboration_throttle_manager()

        assert isinstance(manager, ThrottleManager)
        assert manager.config.operations_per_second == 10.0
        assert manager.config.enable_degradation is True

    def test_create_strict_throttle_manager(self):
        """Create strict throttle manager."""
        manager = create_strict_throttle_manager()

        assert isinstance(manager, ThrottleManager)
        assert manager.config.operations_per_second == 5.0
        assert manager.config.enable_degradation is False
