"""
Rate Limiter for Collaboration Gateway

Implements multiple rate limiting algorithms:
- Token Bucket: Smooth rate limiting with burst allowance
- Sliding Window: Accurate request counting over time windows
- Fixed Window: Simple counter-based limiting

Supports per-user, per-document, and global rate limits.
"""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class RateLimitScope(Enum):
    """Scope for rate limiting."""
    GLOBAL = "global"
    USER = "user"
    DOCUMENT = "document"
    CLIENT = "client"
    IP = "ip"


class RateLimitResult(Enum):
    """Result of a rate limit check."""
    ALLOWED = "allowed"
    LIMITED = "limited"
    BLOCKED = "blocked"  # Hard block (e.g., abuse)


@dataclass
class RateLimitInfo:
    """Information about a rate limit check."""
    result: RateLimitResult
    limit: int
    remaining: int
    reset_at: float  # Unix timestamp
    retry_after: Optional[float] = None  # Seconds until retry

    def to_headers(self) -> dict[str, str]:
        """Convert to HTTP headers."""
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(max(0, self.remaining)),
            "X-RateLimit-Reset": str(int(self.reset_at)),
        }
        if self.retry_after is not None:
            headers["Retry-After"] = str(int(self.retry_after))
        return headers


@dataclass
class RateLimitConfig:
    """Configuration for a rate limit."""
    requests: int  # Number of requests allowed
    window: float  # Time window in seconds
    scope: RateLimitScope = RateLimitScope.USER
    burst: Optional[int] = None  # For token bucket: max burst size


class RateLimiter(ABC):
    """Abstract base class for rate limiters."""

    @abstractmethod
    async def check(self, key: str) -> RateLimitInfo:
        """
        Check if a request should be allowed.

        Args:
            key: Identifier for the rate limit (e.g., user_id)

        Returns:
            RateLimitInfo with result and metadata
        """
        pass

    @abstractmethod
    async def reset(self, key: str) -> None:
        """Reset rate limit for a key."""
        pass

    @abstractmethod
    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        pass


class TokenBucketLimiter(RateLimiter):
    """
    Token bucket rate limiter.

    Allows smooth rate limiting with burst capacity.
    Tokens are added at a fixed rate and consumed per request.

    Good for: APIs that need to allow occasional bursts
    """

    def __init__(
        self,
        rate: float,  # Tokens per second
        capacity: int,  # Max bucket size (burst capacity)
    ):
        """
        Initialize token bucket.

        Args:
            rate: Rate at which tokens are added (per second)
            capacity: Maximum tokens in bucket
        """
        self.rate = rate
        self.capacity = capacity

        # Per-key state: (tokens, last_update)
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = asyncio.Lock()

        # Statistics
        self._total_checks = 0
        self._total_allowed = 0
        self._total_limited = 0

    async def check(self, key: str) -> RateLimitInfo:
        """Check and consume a token."""
        async with self._lock:
            self._total_checks += 1
            now = time.monotonic()

            # Get or create bucket
            if key in self._buckets:
                tokens, last_update = self._buckets[key]
                # Add tokens based on elapsed time
                elapsed = now - last_update
                tokens = min(self.capacity, tokens + elapsed * self.rate)
            else:
                tokens = self.capacity
                last_update = now

            # Try to consume a token
            if tokens >= 1:
                tokens -= 1
                self._buckets[key] = (tokens, now)
                self._total_allowed += 1

                return RateLimitInfo(
                    result=RateLimitResult.ALLOWED,
                    limit=self.capacity,
                    remaining=int(tokens),
                    reset_at=now + (self.capacity - tokens) / self.rate,
                )
            else:
                self._buckets[key] = (tokens, now)
                self._total_limited += 1

                # Calculate retry time
                retry_after = (1 - tokens) / self.rate

                return RateLimitInfo(
                    result=RateLimitResult.LIMITED,
                    limit=self.capacity,
                    remaining=0,
                    reset_at=now + retry_after,
                    retry_after=retry_after,
                )

    async def reset(self, key: str) -> None:
        """Reset bucket to full capacity."""
        async with self._lock:
            self._buckets[key] = (self.capacity, time.monotonic())

    async def clear(self) -> None:
        """Clear all buckets."""
        async with self._lock:
            self._buckets.clear()

    def get_stats(self) -> dict:
        return {
            "type": "token_bucket",
            "rate": self.rate,
            "capacity": self.capacity,
            "active_buckets": len(self._buckets),
            "total_checks": self._total_checks,
            "total_allowed": self._total_allowed,
            "total_limited": self._total_limited,
            "limit_rate": (
                round(self._total_limited / self._total_checks, 4)
                if self._total_checks > 0 else 0.0
            ),
        }


class SlidingWindowLimiter(RateLimiter):
    """
    Sliding window rate limiter.

    Counts requests in a rolling time window.
    More accurate than fixed window but uses more memory.

    Good for: Precise rate limiting, API quotas
    """

    def __init__(
        self,
        limit: int,  # Max requests per window
        window: float,  # Window size in seconds
    ):
        """
        Initialize sliding window limiter.

        Args:
            limit: Maximum requests in window
            window: Window duration in seconds
        """
        self.limit = limit
        self.window = window

        # Per-key request timestamps
        self._windows: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

        # Statistics
        self._total_checks = 0
        self._total_allowed = 0
        self._total_limited = 0

    async def check(self, key: str) -> RateLimitInfo:
        """Check request against sliding window."""
        async with self._lock:
            self._total_checks += 1
            now = time.monotonic()
            window_start = now - self.window

            # Get or create window
            if key not in self._windows:
                self._windows[key] = []

            # Remove expired timestamps
            self._windows[key] = [
                t for t in self._windows[key] if t > window_start
            ]

            current_count = len(self._windows[key])

            if current_count < self.limit:
                # Allow and record
                self._windows[key].append(now)
                self._total_allowed += 1

                return RateLimitInfo(
                    result=RateLimitResult.ALLOWED,
                    limit=self.limit,
                    remaining=self.limit - current_count - 1,
                    reset_at=now + self.window,
                )
            else:
                self._total_limited += 1

                # Find oldest timestamp to calculate retry
                oldest = min(self._windows[key]) if self._windows[key] else now
                retry_after = oldest + self.window - now

                return RateLimitInfo(
                    result=RateLimitResult.LIMITED,
                    limit=self.limit,
                    remaining=0,
                    reset_at=oldest + self.window,
                    retry_after=max(0, retry_after),
                )

    async def reset(self, key: str) -> None:
        """Clear window for key."""
        async with self._lock:
            self._windows.pop(key, None)

    async def clear(self) -> None:
        """Clear all windows."""
        async with self._lock:
            self._windows.clear()

    def get_stats(self) -> dict:
        return {
            "type": "sliding_window",
            "limit": self.limit,
            "window": self.window,
            "active_windows": len(self._windows),
            "total_checks": self._total_checks,
            "total_allowed": self._total_allowed,
            "total_limited": self._total_limited,
            "limit_rate": (
                round(self._total_limited / self._total_checks, 4)
                if self._total_checks > 0 else 0.0
            ),
        }


class FixedWindowLimiter(RateLimiter):
    """
    Fixed window rate limiter.

    Simple counter-based limiting with fixed time windows.
    Less accurate but more memory efficient.

    Good for: High-volume, less precise limiting
    """

    def __init__(
        self,
        limit: int,  # Max requests per window
        window: float,  # Window size in seconds
    ):
        """
        Initialize fixed window limiter.

        Args:
            limit: Maximum requests in window
            window: Window duration in seconds
        """
        self.limit = limit
        self.window = window

        # Per-key state: (count, window_start)
        self._counters: dict[str, tuple[int, float]] = {}
        self._lock = asyncio.Lock()

        # Statistics
        self._total_checks = 0
        self._total_allowed = 0
        self._total_limited = 0

    def _get_window_start(self, now: float) -> float:
        """Get the start of the current window."""
        return (now // self.window) * self.window

    async def check(self, key: str) -> RateLimitInfo:
        """Check request against fixed window."""
        async with self._lock:
            self._total_checks += 1
            now = time.monotonic()
            window_start = self._get_window_start(now)
            window_end = window_start + self.window

            # Get or create counter
            if key in self._counters:
                count, key_window_start = self._counters[key]
                # Reset if in new window
                if key_window_start != window_start:
                    count = 0
            else:
                count = 0

            if count < self.limit:
                # Allow and increment
                count += 1
                self._counters[key] = (count, window_start)
                self._total_allowed += 1

                return RateLimitInfo(
                    result=RateLimitResult.ALLOWED,
                    limit=self.limit,
                    remaining=self.limit - count,
                    reset_at=window_end,
                )
            else:
                self._total_limited += 1

                return RateLimitInfo(
                    result=RateLimitResult.LIMITED,
                    limit=self.limit,
                    remaining=0,
                    reset_at=window_end,
                    retry_after=window_end - now,
                )

    async def reset(self, key: str) -> None:
        """Reset counter for key."""
        async with self._lock:
            self._counters.pop(key, None)

    async def clear(self) -> None:
        """Clear all counters."""
        async with self._lock:
            self._counters.clear()

    def get_stats(self) -> dict:
        return {
            "type": "fixed_window",
            "limit": self.limit,
            "window": self.window,
            "active_counters": len(self._counters),
            "total_checks": self._total_checks,
            "total_allowed": self._total_allowed,
            "total_limited": self._total_limited,
            "limit_rate": (
                round(self._total_limited / self._total_checks, 4)
                if self._total_checks > 0 else 0.0
            ),
        }


class CompositeRateLimiter:
    """
    Composite rate limiter that applies multiple limits.

    Useful for applying different limits at different scopes:
    - Global limit for all requests
    - Per-user limit
    - Per-document limit
    """

    def __init__(self):
        """Initialize composite limiter."""
        self._limiters: dict[str, tuple[RateLimiter, RateLimitScope]] = {}
        self._blocked_keys: set[str] = set()

    def add_limiter(
        self,
        name: str,
        limiter: RateLimiter,
        scope: RateLimitScope
    ) -> None:
        """
        Add a rate limiter.

        Args:
            name: Limiter name
            limiter: The rate limiter
            scope: What the limiter applies to
        """
        self._limiters[name] = (limiter, scope)

    def remove_limiter(self, name: str) -> bool:
        """Remove a rate limiter by name."""
        if name in self._limiters:
            del self._limiters[name]
            return True
        return False

    def block_key(self, key: str) -> None:
        """Hard block a key (e.g., for abuse)."""
        self._blocked_keys.add(key)

    def unblock_key(self, key: str) -> bool:
        """Unblock a key."""
        if key in self._blocked_keys:
            self._blocked_keys.remove(key)
            return True
        return False

    async def check(
        self,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        client_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RateLimitInfo:
        """
        Check all applicable rate limits.

        Args:
            user_id: User identifier
            document_id: Document identifier
            client_id: Client identifier
            ip_address: IP address

        Returns:
            RateLimitInfo with most restrictive result
        """
        # Check blocked keys first
        for key in [user_id, client_id, ip_address]:
            if key and key in self._blocked_keys:
                return RateLimitInfo(
                    result=RateLimitResult.BLOCKED,
                    limit=0,
                    remaining=0,
                    reset_at=0,
                )

        # Map scopes to keys
        scope_keys = {
            RateLimitScope.GLOBAL: "global",
            RateLimitScope.USER: user_id,
            RateLimitScope.DOCUMENT: document_id,
            RateLimitScope.CLIENT: client_id,
            RateLimitScope.IP: ip_address,
        }

        # Check all applicable limiters
        results: list[RateLimitInfo] = []

        for name, (limiter, scope) in self._limiters.items():
            key = scope_keys.get(scope)
            if key:
                result = await limiter.check(key)
                results.append(result)

                # Short-circuit on limit
                if result.result != RateLimitResult.ALLOWED:
                    return result

        # All passed - return most restrictive (lowest remaining)
        if results:
            return min(results, key=lambda r: r.remaining)

        # No limiters configured
        return RateLimitInfo(
            result=RateLimitResult.ALLOWED,
            limit=0,
            remaining=0,
            reset_at=0,
        )

    async def reset_user(self, user_id: str) -> None:
        """Reset all limits for a user."""
        for limiter, scope in self._limiters.values():
            if scope == RateLimitScope.USER:
                await limiter.reset(user_id)

    def get_stats(self) -> dict:
        """Get statistics from all limiters."""
        return {
            name: limiter.get_stats()
            for name, (limiter, _) in self._limiters.items()
        }


# Convenience factory functions

def create_operations_limiter(
    ops_per_second: float = 10.0,
    burst: int = 50,
) -> TokenBucketLimiter:
    """Create a rate limiter for OT operations."""
    return TokenBucketLimiter(rate=ops_per_second, capacity=burst)


def create_connection_limiter(
    connections_per_minute: int = 10,
) -> SlidingWindowLimiter:
    """Create a rate limiter for new connections."""
    return SlidingWindowLimiter(limit=connections_per_minute, window=60.0)


def create_api_limiter(
    requests_per_minute: int = 100,
) -> FixedWindowLimiter:
    """Create a rate limiter for API requests."""
    return FixedWindowLimiter(limit=requests_per_minute, window=60.0)
