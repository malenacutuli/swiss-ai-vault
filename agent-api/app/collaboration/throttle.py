"""
Request Throttling for Collaboration Gateway

Provides throttling decorators and middleware for:
- WebSocket message throttling
- API endpoint throttling
- Operation batch throttling

Integrates with rate limiters and circuit breaker.
"""

from __future__ import annotations

import asyncio
import functools
import logging
from typing import Optional, Any, Callable, TypeVar, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

from app.collaboration.rate_limiter import (
    RateLimiter,
    RateLimitInfo,
    RateLimitResult,
    RateLimitScope,
    CompositeRateLimiter,
    TokenBucketLimiter,
    SlidingWindowLimiter,
)

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Awaitable[Any]])


@dataclass
class ThrottleConfig:
    """Configuration for throttling."""
    # Operation limits (per user)
    operations_per_second: float = 10.0
    operations_burst: int = 50

    # Connection limits (per user)
    connections_per_minute: int = 10

    # Message limits (per user)
    messages_per_second: float = 20.0
    messages_burst: int = 100

    # Cursor update limits (per user)
    cursor_updates_per_second: float = 30.0

    # Enable graceful degradation
    enable_degradation: bool = True
    degradation_delay: float = 0.1  # Delay instead of reject


@dataclass
class ThrottleResult:
    """Result of a throttle check."""
    allowed: bool
    delayed: bool = False
    delay_seconds: float = 0.0
    info: Optional[RateLimitInfo] = None


class MessageThrottler:
    """
    Throttles WebSocket messages by type.

    Applies different limits for different message types:
    - Operations: Lower limit, high impact
    - Cursors: Higher limit, low impact
    - Heartbeats: Very high limit
    """

    def __init__(self, config: Optional[ThrottleConfig] = None):
        """
        Initialize message throttler.

        Args:
            config: Throttle configuration
        """
        self.config = config or ThrottleConfig()

        # Create per-type limiters
        self._operation_limiter = TokenBucketLimiter(
            rate=self.config.operations_per_second,
            capacity=self.config.operations_burst,
        )
        self._cursor_limiter = TokenBucketLimiter(
            rate=self.config.cursor_updates_per_second,
            capacity=int(self.config.cursor_updates_per_second * 2),
        )
        self._message_limiter = TokenBucketLimiter(
            rate=self.config.messages_per_second,
            capacity=self.config.messages_burst,
        )

        # Statistics
        self._total_messages = 0
        self._throttled_messages = 0
        self._delayed_messages = 0

    async def check_message(
        self,
        user_id: str,
        message_type: str,
    ) -> ThrottleResult:
        """
        Check if a message should be throttled.

        Args:
            user_id: User identifier
            message_type: Type of message (operation, cursor, etc.)

        Returns:
            ThrottleResult indicating if message is allowed
        """
        self._total_messages += 1

        # Select limiter based on message type
        if message_type == "operation":
            limiter = self._operation_limiter
        elif message_type == "cursor":
            limiter = self._cursor_limiter
        else:
            limiter = self._message_limiter

        info = await limiter.check(user_id)

        if info.result == RateLimitResult.ALLOWED:
            return ThrottleResult(allowed=True, info=info)

        # Handle throttling
        self._throttled_messages += 1

        if self.config.enable_degradation and info.retry_after:
            # Delay instead of reject
            if info.retry_after <= self.config.degradation_delay:
                self._delayed_messages += 1
                return ThrottleResult(
                    allowed=True,
                    delayed=True,
                    delay_seconds=info.retry_after,
                    info=info,
                )

        return ThrottleResult(allowed=False, info=info)

    async def reset_user(self, user_id: str) -> None:
        """Reset all limits for a user."""
        await self._operation_limiter.reset(user_id)
        await self._cursor_limiter.reset(user_id)
        await self._message_limiter.reset(user_id)

    def get_stats(self) -> dict:
        """Get throttler statistics."""
        return {
            "total_messages": self._total_messages,
            "throttled_messages": self._throttled_messages,
            "delayed_messages": self._delayed_messages,
            "throttle_rate": (
                round(self._throttled_messages / self._total_messages, 4)
                if self._total_messages > 0 else 0.0
            ),
            "limiters": {
                "operations": self._operation_limiter.get_stats(),
                "cursors": self._cursor_limiter.get_stats(),
                "messages": self._message_limiter.get_stats(),
            },
        }


class ConnectionThrottler:
    """
    Throttles new WebSocket connections.

    Prevents connection floods and DoS attacks.
    """

    def __init__(self, config: Optional[ThrottleConfig] = None):
        """
        Initialize connection throttler.

        Args:
            config: Throttle configuration
        """
        self.config = config or ThrottleConfig()

        self._limiter = SlidingWindowLimiter(
            limit=self.config.connections_per_minute,
            window=60.0,
        )

        # IP-based limiting for additional protection
        self._ip_limiter = SlidingWindowLimiter(
            limit=self.config.connections_per_minute * 2,  # More lenient for IPs
            window=60.0,
        )

        # Statistics
        self._total_connections = 0
        self._throttled_connections = 0

    async def check_connection(
        self,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> ThrottleResult:
        """
        Check if a new connection should be allowed.

        Args:
            user_id: User identifier (if authenticated)
            ip_address: Client IP address

        Returns:
            ThrottleResult indicating if connection is allowed
        """
        self._total_connections += 1

        # Check user limit if authenticated
        if user_id:
            info = await self._limiter.check(user_id)
            if info.result != RateLimitResult.ALLOWED:
                self._throttled_connections += 1
                return ThrottleResult(allowed=False, info=info)

        # Check IP limit
        if ip_address:
            info = await self._ip_limiter.check(ip_address)
            if info.result != RateLimitResult.ALLOWED:
                self._throttled_connections += 1
                return ThrottleResult(allowed=False, info=info)

        return ThrottleResult(allowed=True)

    async def reset_user(self, user_id: str) -> None:
        """Reset connection limit for user."""
        await self._limiter.reset(user_id)

    async def reset_ip(self, ip_address: str) -> None:
        """Reset connection limit for IP."""
        await self._ip_limiter.reset(ip_address)

    def get_stats(self) -> dict:
        """Get throttler statistics."""
        return {
            "total_connections": self._total_connections,
            "throttled_connections": self._throttled_connections,
            "throttle_rate": (
                round(self._throttled_connections / self._total_connections, 4)
                if self._total_connections > 0 else 0.0
            ),
            "user_limiter": self._limiter.get_stats(),
            "ip_limiter": self._ip_limiter.get_stats(),
        }


class ThrottleManager:
    """
    Central manager for all throttling.

    Coordinates message and connection throttling.
    """

    def __init__(self, config: Optional[ThrottleConfig] = None):
        """
        Initialize throttle manager.

        Args:
            config: Throttle configuration
        """
        self.config = config or ThrottleConfig()
        self.message_throttler = MessageThrottler(config)
        self.connection_throttler = ConnectionThrottler(config)

        # Callbacks
        self.on_throttle: Optional[Callable[[str, str, RateLimitInfo], Any]] = None

    async def check_connection(
        self,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> ThrottleResult:
        """Check if connection is allowed."""
        result = await self.connection_throttler.check_connection(
            user_id=user_id,
            ip_address=ip_address,
        )

        if not result.allowed and self.on_throttle:
            try:
                await self._invoke_callback(
                    user_id or ip_address or "unknown",
                    "connection",
                    result.info,
                )
            except Exception:
                pass

        return result

    async def check_message(
        self,
        user_id: str,
        message_type: str,
    ) -> ThrottleResult:
        """Check if message is allowed."""
        result = await self.message_throttler.check_message(
            user_id=user_id,
            message_type=message_type,
        )

        if not result.allowed and self.on_throttle:
            try:
                await self._invoke_callback(user_id, message_type, result.info)
            except Exception:
                pass

        # Apply delay if needed
        if result.delayed and result.delay_seconds > 0:
            await asyncio.sleep(result.delay_seconds)

        return result

    async def _invoke_callback(
        self,
        identifier: str,
        throttle_type: str,
        info: Optional[RateLimitInfo],
    ) -> None:
        """Invoke throttle callback."""
        if self.on_throttle:
            result = self.on_throttle(identifier, throttle_type, info)
            if asyncio.iscoroutine(result):
                await result

    async def reset_user(self, user_id: str) -> None:
        """Reset all limits for a user."""
        await self.message_throttler.reset_user(user_id)
        await self.connection_throttler.reset_user(user_id)

    def get_stats(self) -> dict:
        """Get all throttling statistics."""
        return {
            "messages": self.message_throttler.get_stats(),
            "connections": self.connection_throttler.get_stats(),
        }


def throttle(
    limiter: RateLimiter,
    key_func: Optional[Callable[..., str]] = None,
    on_limited: Optional[Callable[[RateLimitInfo], Any]] = None,
) -> Callable[[F], F]:
    """
    Decorator for throttling async functions.

    Args:
        limiter: Rate limiter to use
        key_func: Function to extract rate limit key from args
        on_limited: Callback when rate limited

    Returns:
        Decorator function

    Example:
        @throttle(
            limiter=TokenBucketLimiter(rate=10, capacity=50),
            key_func=lambda user_id, *args: user_id,
        )
        async def process_operation(user_id: str, operation: dict):
            ...
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract key
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = "default"

            # Check rate limit
            info = await limiter.check(key)

            if info.result != RateLimitResult.ALLOWED:
                if on_limited:
                    result = on_limited(info)
                    if asyncio.iscoroutine(result):
                        await result
                raise ThrottledException(info)

            return await func(*args, **kwargs)

        return wrapper  # type: ignore
    return decorator


class ThrottledException(Exception):
    """Exception raised when request is throttled."""

    def __init__(self, info: RateLimitInfo):
        self.info = info
        super().__init__(
            f"Rate limited: retry after {info.retry_after:.1f}s"
            if info.retry_after else "Rate limited"
        )


# Pre-configured throttle managers for common use cases

def create_collaboration_throttle_manager() -> ThrottleManager:
    """Create a throttle manager configured for collaboration."""
    config = ThrottleConfig(
        operations_per_second=10.0,
        operations_burst=50,
        connections_per_minute=10,
        messages_per_second=20.0,
        messages_burst=100,
        cursor_updates_per_second=30.0,
        enable_degradation=True,
        degradation_delay=0.1,
    )
    return ThrottleManager(config)


def create_strict_throttle_manager() -> ThrottleManager:
    """Create a strict throttle manager for high-load scenarios."""
    config = ThrottleConfig(
        operations_per_second=5.0,
        operations_burst=20,
        connections_per_minute=5,
        messages_per_second=10.0,
        messages_burst=50,
        cursor_updates_per_second=15.0,
        enable_degradation=False,
    )
    return ThrottleManager(config)
