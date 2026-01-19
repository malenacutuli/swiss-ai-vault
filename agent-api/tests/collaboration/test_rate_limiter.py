"""Tests for Rate Limiter."""

import pytest
import asyncio
import time

from app.collaboration.rate_limiter import (
    TokenBucketLimiter,
    SlidingWindowLimiter,
    FixedWindowLimiter,
    CompositeRateLimiter,
    RateLimitResult,
    RateLimitScope,
    RateLimitInfo,
    create_operations_limiter,
    create_connection_limiter,
    create_api_limiter,
)


class TestTokenBucketLimiter:
    """Tests for TokenBucketLimiter."""

    @pytest.fixture
    def limiter(self):
        return TokenBucketLimiter(rate=10.0, capacity=5)

    @pytest.mark.asyncio
    async def test_allows_initial_burst(self, limiter):
        """Allows requests up to capacity."""
        for _ in range(5):
            info = await limiter.check("user_1")
            assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_limits_after_burst(self, limiter):
        """Limits after burst exhausted."""
        # Exhaust burst
        for _ in range(5):
            await limiter.check("user_1")

        # Next should be limited
        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.LIMITED
        assert info.retry_after is not None
        assert info.retry_after > 0

    @pytest.mark.asyncio
    async def test_refills_over_time(self, limiter):
        """Tokens refill over time."""
        # Exhaust bucket
        for _ in range(5):
            await limiter.check("user_1")

        # Wait for refill (1 token = 0.1s at 10/s rate)
        await asyncio.sleep(0.15)

        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_separate_buckets_per_key(self, limiter):
        """Each key has its own bucket."""
        # Exhaust user_1
        for _ in range(5):
            await limiter.check("user_1")

        # user_2 should still have tokens
        info = await limiter.check("user_2")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_reset_restores_capacity(self, limiter):
        """Reset restores full capacity."""
        # Exhaust bucket
        for _ in range(5):
            await limiter.check("user_1")

        # Reset
        await limiter.reset("user_1")

        # Should have full capacity again
        for _ in range(5):
            info = await limiter.check("user_1")
            assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_clear_removes_all(self, limiter):
        """Clear removes all buckets."""
        await limiter.check("user_1")
        await limiter.check("user_2")

        await limiter.clear()

        stats = limiter.get_stats()
        assert stats["active_buckets"] == 0

    @pytest.mark.asyncio
    async def test_get_stats(self, limiter):
        """Get statistics."""
        await limiter.check("user_1")
        await limiter.check("user_1")

        stats = limiter.get_stats()

        assert stats["type"] == "token_bucket"
        assert stats["rate"] == 10.0
        assert stats["capacity"] == 5
        assert stats["total_checks"] == 2
        assert stats["total_allowed"] == 2

    @pytest.mark.asyncio
    async def test_remaining_decreases(self, limiter):
        """Remaining count decreases with each request."""
        info1 = await limiter.check("user_1")
        info2 = await limiter.check("user_1")

        assert info1.remaining > info2.remaining


class TestSlidingWindowLimiter:
    """Tests for SlidingWindowLimiter."""

    @pytest.fixture
    def limiter(self):
        return SlidingWindowLimiter(limit=5, window=1.0)

    @pytest.mark.asyncio
    async def test_allows_up_to_limit(self, limiter):
        """Allows requests up to limit."""
        for _ in range(5):
            info = await limiter.check("user_1")
            assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_limits_over_limit(self, limiter):
        """Limits requests over limit."""
        for _ in range(5):
            await limiter.check("user_1")

        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.LIMITED

    @pytest.mark.asyncio
    async def test_window_slides(self, limiter):
        """Window slides over time."""
        # Use all requests
        for _ in range(5):
            await limiter.check("user_1")

        # Wait for window to pass
        await asyncio.sleep(1.1)

        # Should be allowed again
        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_accurate_counting(self, limiter):
        """Counts are accurate within window."""
        # Make 3 requests
        for _ in range(3):
            await limiter.check("user_1")

        info = await limiter.check("user_1")
        assert info.remaining == 1  # 5 - 4 = 1

    @pytest.mark.asyncio
    async def test_reset(self, limiter):
        """Reset clears window."""
        for _ in range(5):
            await limiter.check("user_1")

        await limiter.reset("user_1")

        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.ALLOWED
        assert info.remaining == 4

    @pytest.mark.asyncio
    async def test_get_stats(self, limiter):
        """Get statistics."""
        await limiter.check("user_1")

        stats = limiter.get_stats()

        assert stats["type"] == "sliding_window"
        assert stats["limit"] == 5
        assert stats["window"] == 1.0


class TestFixedWindowLimiter:
    """Tests for FixedWindowLimiter."""

    @pytest.fixture
    def limiter(self):
        return FixedWindowLimiter(limit=5, window=1.0)

    @pytest.mark.asyncio
    async def test_allows_up_to_limit(self, limiter):
        """Allows requests up to limit."""
        for _ in range(5):
            info = await limiter.check("user_1")
            assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_limits_over_limit(self, limiter):
        """Limits requests over limit."""
        for _ in range(5):
            await limiter.check("user_1")

        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.LIMITED

    @pytest.mark.asyncio
    async def test_resets_on_new_window(self, limiter):
        """Counter resets in new window."""
        for _ in range(5):
            await limiter.check("user_1")

        # Wait for new window
        await asyncio.sleep(1.1)

        info = await limiter.check("user_1")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_get_stats(self, limiter):
        """Get statistics."""
        await limiter.check("user_1")

        stats = limiter.get_stats()

        assert stats["type"] == "fixed_window"
        assert stats["limit"] == 5
        assert stats["window"] == 1.0


class TestCompositeRateLimiter:
    """Tests for CompositeRateLimiter."""

    @pytest.fixture
    def composite(self):
        limiter = CompositeRateLimiter()
        limiter.add_limiter(
            "user_limit",
            TokenBucketLimiter(rate=10.0, capacity=5),
            RateLimitScope.USER,
        )
        limiter.add_limiter(
            "global_limit",
            TokenBucketLimiter(rate=100.0, capacity=50),
            RateLimitScope.GLOBAL,
        )
        return limiter

    @pytest.mark.asyncio
    async def test_checks_all_limiters(self, composite):
        """Checks all applicable limiters."""
        info = await composite.check(user_id="user_1")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_user_limit_applies(self, composite):
        """User limit is applied."""
        # Exhaust user limit
        for _ in range(5):
            await composite.check(user_id="user_1")

        info = await composite.check(user_id="user_1")
        assert info.result == RateLimitResult.LIMITED

    @pytest.mark.asyncio
    async def test_blocked_key(self, composite):
        """Blocked keys are rejected."""
        composite.block_key("bad_user")

        info = await composite.check(user_id="bad_user")
        assert info.result == RateLimitResult.BLOCKED

    @pytest.mark.asyncio
    async def test_unblock_key(self, composite):
        """Can unblock keys."""
        composite.block_key("user_1")
        result = composite.unblock_key("user_1")

        assert result is True

        info = await composite.check(user_id="user_1")
        assert info.result == RateLimitResult.ALLOWED

    @pytest.mark.asyncio
    async def test_remove_limiter(self, composite):
        """Can remove limiters."""
        result = composite.remove_limiter("user_limit")
        assert result is True

        # Should only have global limit now
        stats = composite.get_stats()
        assert "user_limit" not in stats

    @pytest.mark.asyncio
    async def test_get_stats(self, composite):
        """Get statistics from all limiters."""
        await composite.check(user_id="user_1")

        stats = composite.get_stats()

        assert "user_limit" in stats
        assert "global_limit" in stats


class TestRateLimitInfo:
    """Tests for RateLimitInfo."""

    def test_to_headers(self):
        """Convert to HTTP headers."""
        info = RateLimitInfo(
            result=RateLimitResult.LIMITED,
            limit=100,
            remaining=0,
            reset_at=time.time() + 60,
            retry_after=60,
        )

        headers = info.to_headers()

        assert "X-RateLimit-Limit" in headers
        assert "X-RateLimit-Remaining" in headers
        assert "X-RateLimit-Reset" in headers
        assert "Retry-After" in headers

    def test_remaining_clamped_to_zero(self):
        """Remaining is clamped to 0 in headers."""
        info = RateLimitInfo(
            result=RateLimitResult.LIMITED,
            limit=100,
            remaining=-5,
            reset_at=time.time(),
        )

        headers = info.to_headers()
        assert headers["X-RateLimit-Remaining"] == "0"


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_operations_limiter(self):
        """Create operations limiter."""
        limiter = create_operations_limiter(ops_per_second=5.0, burst=20)

        assert isinstance(limiter, TokenBucketLimiter)
        assert limiter.rate == 5.0
        assert limiter.capacity == 20

    def test_create_connection_limiter(self):
        """Create connection limiter."""
        limiter = create_connection_limiter(connections_per_minute=5)

        assert isinstance(limiter, SlidingWindowLimiter)
        assert limiter.limit == 5
        assert limiter.window == 60.0

    def test_create_api_limiter(self):
        """Create API limiter."""
        limiter = create_api_limiter(requests_per_minute=50)

        assert isinstance(limiter, FixedWindowLimiter)
        assert limiter.limit == 50
        assert limiter.window == 60.0
