"""
Token Counter with Multi-Level Caching

Implements token counting with a hierarchical cache:
1. Memory (LRU) - Fastest, per-process
2. Redis - Shared across processes
3. Database - Persistent, source of truth

Cache Strategy:
- Pricing: Cache for 1 hour (rarely changes)
- Token counts: Cache for 5 minutes (for repeated similar requests)
- Balances: Always fresh from DB (critical for billing)
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from functools import lru_cache
from typing import Optional, Any
from uuid import UUID

from app.billing.types import (
    TokenCount,
    ModelPricing,
    Provider,
    PricingNotFoundError,
)
from app.billing.tokenizer import MultiProviderTokenizer, get_tokenizer

logger = logging.getLogger(__name__)


# Default pricing when DB lookup fails
DEFAULT_PRICING = {
    ("gpt-4o", "openai"): ModelPricing(
        model="gpt-4o",
        provider=Provider.OPENAI,
        input_price_per_million=Decimal("2.50"),
        output_price_per_million=Decimal("10.00"),
        effective_from=datetime(2024, 1, 1),
    ),
    ("gpt-4o-mini", "openai"): ModelPricing(
        model="gpt-4o-mini",
        provider=Provider.OPENAI,
        input_price_per_million=Decimal("0.15"),
        output_price_per_million=Decimal("0.60"),
        effective_from=datetime(2024, 1, 1),
    ),
    ("claude-3-5-sonnet-20241022", "anthropic"): ModelPricing(
        model="claude-3-5-sonnet-20241022",
        provider=Provider.ANTHROPIC,
        input_price_per_million=Decimal("3.00"),
        output_price_per_million=Decimal("15.00"),
        effective_from=datetime(2024, 1, 1),
    ),
    ("claude-3-5-haiku-20241022", "anthropic"): ModelPricing(
        model="claude-3-5-haiku-20241022",
        provider=Provider.ANTHROPIC,
        input_price_per_million=Decimal("0.80"),
        output_price_per_million=Decimal("4.00"),
        effective_from=datetime(2024, 1, 1),
    ),
}

# Fallback pricing for unknown models
FALLBACK_PRICING = ModelPricing(
    model="unknown",
    provider=Provider.OPENAI,
    input_price_per_million=Decimal("5.00"),
    output_price_per_million=Decimal("15.00"),
    effective_from=datetime(2024, 1, 1),
)


class TokenCounter:
    """
    Token counter with multi-level caching.

    Handles:
    - Token counting via MultiProviderTokenizer
    - Cost calculation via cached pricing
    - Pre-call estimation for budget checks
    - Post-call recording with actual counts
    """

    def __init__(
        self,
        supabase: Any,
        redis_client: Optional[Any] = None,
        pricing_cache_ttl: int = 3600,  # 1 hour
    ):
        """
        Initialize token counter.

        Args:
            supabase: Supabase client for DB operations
            redis_client: Optional Redis client for distributed cache
            pricing_cache_ttl: Pricing cache TTL in seconds
        """
        self.supabase = supabase
        self.redis = redis_client
        self.pricing_cache_ttl = pricing_cache_ttl
        self.tokenizer = get_tokenizer()

        # In-memory caches
        self._pricing_cache: dict[tuple[str, str], tuple[ModelPricing, datetime]] = {}
        self._token_cache: dict[str, tuple[int, datetime]] = {}

    def _cache_key(self, text: str, model: str) -> str:
        """Generate cache key for token count."""
        # Hash long text to keep keys reasonable
        text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        return f"tokens:{model}:{text_hash}"

    async def get_pricing(
        self,
        model: str,
        provider: Provider = Provider.OPENAI,
        use_fallback: bool = True,
    ) -> ModelPricing:
        """
        Get pricing for a model with caching.

        Cache hierarchy:
        1. Memory cache (check TTL)
        2. Redis cache (if available)
        3. Database lookup
        4. Default/fallback pricing

        Args:
            model: Model name
            provider: LLM provider
            use_fallback: Whether to use fallback pricing if not found

        Returns:
            ModelPricing object

        Raises:
            PricingNotFoundError: If pricing not found and use_fallback=False
        """
        cache_key = (model, provider.value)

        # Check memory cache
        if cache_key in self._pricing_cache:
            pricing, cached_at = self._pricing_cache[cache_key]
            if datetime.utcnow() - cached_at < timedelta(seconds=self.pricing_cache_ttl):
                return pricing

        # Check Redis cache
        if self.redis:
            try:
                redis_key = f"pricing:{model}:{provider.value}"
                cached = await self.redis.get(redis_key)
                if cached:
                    data = json.loads(cached)
                    pricing = ModelPricing(
                        model=data["model"],
                        provider=Provider(data["provider"]),
                        input_price_per_million=Decimal(data["input_price_per_million"]),
                        output_price_per_million=Decimal(data["output_price_per_million"]),
                        effective_from=datetime.fromisoformat(data["effective_from"]),
                    )
                    self._pricing_cache[cache_key] = (pricing, datetime.utcnow())
                    return pricing
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")

        # Database lookup
        try:
            result = self.supabase.table("model_pricing").select("*").eq(
                "model", model
            ).eq(
                "provider", provider.value
            ).lte(
                "effective_from", datetime.utcnow().isoformat()
            ).or_(
                "effective_until.is.null,effective_until.gt." + datetime.utcnow().isoformat()
            ).order(
                "effective_from", desc=True
            ).limit(1).execute()

            if result.data:
                pricing = ModelPricing.from_db_row(result.data[0])

                # Cache in memory
                self._pricing_cache[cache_key] = (pricing, datetime.utcnow())

                # Cache in Redis
                if self.redis:
                    try:
                        redis_key = f"pricing:{model}:{provider.value}"
                        await self.redis.setex(
                            redis_key,
                            self.pricing_cache_ttl,
                            json.dumps({
                                "model": pricing.model,
                                "provider": pricing.provider.value,
                                "input_price_per_million": str(pricing.input_price_per_million),
                                "output_price_per_million": str(pricing.output_price_per_million),
                                "effective_from": pricing.effective_from.isoformat(),
                            })
                        )
                    except Exception as e:
                        logger.warning(f"Redis cache write error: {e}")

                return pricing
        except Exception as e:
            logger.warning(f"Database pricing lookup failed: {e}")

        # Try default pricing
        if cache_key in DEFAULT_PRICING:
            pricing = DEFAULT_PRICING[cache_key]
            self._pricing_cache[cache_key] = (pricing, datetime.utcnow())
            return pricing

        # Use fallback or raise
        if use_fallback:
            logger.warning(f"Using fallback pricing for {model}/{provider.value}")
            return FALLBACK_PRICING

        raise PricingNotFoundError(model, provider.value)

    async def count_and_cost(
        self,
        input_text: str | list[dict],
        output_text: str,
        model: str,
        provider: Provider = Provider.OPENAI,
        is_estimated: bool = False,
    ) -> tuple[TokenCount, Decimal]:
        """
        Count tokens and calculate cost.

        Args:
            input_text: Input text or messages
            output_text: Output text
            model: Model name
            provider: LLM provider
            is_estimated: Whether counts are estimated

        Returns:
            Tuple of (TokenCount, cost_usd)
        """
        # Count tokens
        token_count = self.tokenizer.create_token_count(
            input_text=input_text,
            output_text=output_text,
            model=model,
            provider=provider,
            is_estimated=is_estimated,
        )

        # Get pricing
        pricing = await self.get_pricing(model, provider)

        # Calculate cost
        _, _, total_cost = pricing.calculate_cost(
            token_count.input_tokens,
            token_count.output_tokens,
        )

        return token_count, total_cost

    async def estimate_cost(
        self,
        input_text: str | list[dict],
        model: str,
        provider: Provider = Provider.OPENAI,
        max_tokens: Optional[int] = None,
    ) -> tuple[TokenCount, Decimal]:
        """
        Estimate cost for a planned API call.

        Used for pre-call budget checks.

        Args:
            input_text: Input text or messages
            model: Model name
            provider: LLM provider
            max_tokens: Max tokens limit

        Returns:
            Tuple of (estimated TokenCount, estimated cost_usd)
        """
        # Estimate tokens
        token_count = self.tokenizer.estimate_call(
            input_text=input_text,
            model=model,
            provider=provider,
            max_tokens=max_tokens,
        )

        # Get pricing
        pricing = await self.get_pricing(model, provider)

        # Calculate cost
        _, _, total_cost = pricing.calculate_cost(
            token_count.input_tokens,
            token_count.output_tokens,
        )

        return token_count, total_cost

    async def calculate_cost_from_counts(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
        provider: Provider = Provider.OPENAI,
    ) -> tuple[Decimal, Decimal, Decimal]:
        """
        Calculate cost from known token counts.

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            model: Model name
            provider: LLM provider

        Returns:
            Tuple of (input_cost, output_cost, total_cost)
        """
        pricing = await self.get_pricing(model, provider)
        return pricing.calculate_cost(input_tokens, output_tokens)

    def count_tokens_sync(
        self,
        text: str,
        model: str,
        provider: Provider = Provider.OPENAI,
    ) -> int:
        """
        Synchronously count tokens (for non-async contexts).

        Uses only memory cache (no Redis/DB).
        """
        cache_key = self._cache_key(text, model)

        # Check memory cache
        if cache_key in self._token_cache:
            count, cached_at = self._token_cache[cache_key]
            if datetime.utcnow() - cached_at < timedelta(minutes=5):
                return count

        # Count tokens
        count = self.tokenizer.count_tokens(text, model, provider)

        # Cache result (limit cache size)
        if len(self._token_cache) > 10000:
            # Evict oldest entries
            oldest = sorted(self._token_cache.items(), key=lambda x: x[1][1])[:5000]
            for key, _ in oldest:
                del self._token_cache[key]

        self._token_cache[cache_key] = (count, datetime.utcnow())

        return count

    def clear_cache(self):
        """Clear all caches."""
        self._pricing_cache.clear()
        self._token_cache.clear()
        logger.info("Token counter caches cleared")

    async def refresh_pricing_cache(self):
        """Refresh pricing cache from database."""
        try:
            result = self.supabase.table("model_pricing").select("*").or_(
                "effective_until.is.null,effective_until.gt." + datetime.utcnow().isoformat()
            ).execute()

            for row in result.data:
                pricing = ModelPricing.from_db_row(row)
                cache_key = (pricing.model, pricing.provider.value)
                self._pricing_cache[cache_key] = (pricing, datetime.utcnow())

            logger.info(f"Refreshed pricing cache with {len(result.data)} entries")
        except Exception as e:
            logger.error(f"Failed to refresh pricing cache: {e}")
