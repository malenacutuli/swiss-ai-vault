"""
Billing Service

Main entry point for all billing operations. Integrates:
- Token counting (MultiProviderTokenizer)
- Token caching (TokenCounter)
- Billing ledger (BillingLedger)

Implements:
- Pre-call budget estimation
- Post-call billing with idempotency
- Credit management
- Billing failure → read-only mode
- Rate limiting
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, Any, Callable, Awaitable
from uuid import UUID

from app.billing.types import (
    Provider,
    TokenCount,
    BillingResult,
    CreditBalance,
    TransactionType,
    BillingError,
    InsufficientCreditsError,
    RateLimitError,
)
from app.billing.tokenizer import get_tokenizer
from app.billing.token_counter import TokenCounter
from app.billing.ledger import BillingLedger

logger = logging.getLogger(__name__)


class BillingMode(str, Enum):
    """Billing system operation mode."""
    NORMAL = "normal"          # Full billing enabled
    READ_ONLY = "read_only"    # Billing failed, no new charges
    DEGRADED = "degraded"      # Partial functionality
    DISABLED = "disabled"      # Billing completely off


@dataclass
class BillingConfig:
    """Billing service configuration."""
    # Budget limits
    max_cost_per_call: Decimal = Decimal("10.00")
    max_cost_per_run: Decimal = Decimal("100.00")
    default_budget_per_run: Decimal = Decimal("50.00")

    # Rate limits
    rate_limit_requests_per_minute: int = 100
    rate_limit_tokens_per_minute: int = 1_000_000

    # Failure handling
    failure_threshold: int = 3  # Consecutive failures before read-only
    failure_window_seconds: int = 60
    recovery_check_interval_seconds: int = 300

    # Retry settings
    max_retries: int = 3
    retry_delay_seconds: float = 1.0

    # Estimation buffer (add % to estimates for safety)
    estimation_buffer_pct: Decimal = Decimal("0.20")


@dataclass
class BillingState:
    """Runtime state for billing service."""
    mode: BillingMode = BillingMode.NORMAL
    consecutive_failures: int = 0
    last_failure_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    read_only_reason: Optional[str] = None
    rate_limit_counters: dict = field(default_factory=dict)


class BillingService:
    """
    Main billing service for token counting and credit management.

    Features:
    - Pre-call estimation with budget checks
    - Post-call billing with idempotency
    - Automatic fallback to read-only mode on failures
    - Rate limiting per organization
    - Credit reservation for runs
    """

    def __init__(
        self,
        supabase: Any,
        redis_client: Optional[Any] = None,
        config: Optional[BillingConfig] = None,
    ):
        """
        Initialize billing service.

        Args:
            supabase: Supabase client
            redis_client: Optional Redis client for distributed state
            config: Billing configuration
        """
        self.supabase = supabase
        self.redis = redis_client
        self.config = config or BillingConfig()

        # Initialize components
        self.token_counter = TokenCounter(supabase, redis_client)
        self.ledger = BillingLedger(supabase)
        self.tokenizer = get_tokenizer()

        # Runtime state
        self._state = BillingState()
        self._lock = asyncio.Lock()

    @property
    def mode(self) -> BillingMode:
        """Current billing mode."""
        return self._state.mode

    @property
    def is_operational(self) -> bool:
        """Whether billing is accepting new charges."""
        return self._state.mode in (BillingMode.NORMAL, BillingMode.DEGRADED)

    async def _record_failure(self, error: str):
        """Record a billing failure and potentially switch to read-only."""
        async with self._lock:
            self._state.consecutive_failures += 1
            self._state.last_failure_at = datetime.utcnow()

            if self._state.consecutive_failures >= self.config.failure_threshold:
                self._state.mode = BillingMode.READ_ONLY
                self._state.read_only_reason = f"Too many failures: {error}"
                logger.error(
                    f"Billing switched to read-only mode: {error}"
                )

    async def _record_success(self):
        """Record a successful operation and potentially recover from read-only."""
        async with self._lock:
            self._state.consecutive_failures = 0
            self._state.last_success_at = datetime.utcnow()

            if self._state.mode == BillingMode.READ_ONLY:
                # Check if we should attempt recovery
                if self._state.last_failure_at:
                    time_since_failure = (
                        datetime.utcnow() - self._state.last_failure_at
                    ).total_seconds()
                    if time_since_failure > self.config.recovery_check_interval_seconds:
                        self._state.mode = BillingMode.NORMAL
                        self._state.read_only_reason = None
                        logger.info("Billing recovered from read-only mode")

    async def check_rate_limit(self, org_id: UUID) -> bool:
        """
        Check if organization is within rate limits.

        Args:
            org_id: Organization ID

        Returns:
            True if within limits

        Raises:
            RateLimitError: If rate limit exceeded
        """
        now = datetime.utcnow()
        window_start = now.replace(second=0, microsecond=0)
        cache_key = f"{org_id}:{window_start.isoformat()}"

        # Check memory cache first
        if cache_key in self._state.rate_limit_counters:
            counter = self._state.rate_limit_counters[cache_key]
            if counter["requests"] >= self.config.rate_limit_requests_per_minute:
                raise RateLimitError(
                    "requests",
                    counter["requests"],
                    self.config.rate_limit_requests_per_minute,
                    window_start + timedelta(minutes=1),
                )
            if counter["tokens"] >= self.config.rate_limit_tokens_per_minute:
                raise RateLimitError(
                    "tokens",
                    counter["tokens"],
                    self.config.rate_limit_tokens_per_minute,
                    window_start + timedelta(minutes=1),
                )
        else:
            self._state.rate_limit_counters[cache_key] = {
                "requests": 0,
                "tokens": 0,
            }

        # Clean old entries
        old_keys = [
            k for k in self._state.rate_limit_counters
            if not k.endswith(window_start.isoformat())
        ]
        for k in old_keys:
            del self._state.rate_limit_counters[k]

        return True

    async def _increment_rate_limit(
        self,
        org_id: UUID,
        tokens: int,
    ):
        """Increment rate limit counters."""
        now = datetime.utcnow()
        window_start = now.replace(second=0, microsecond=0)
        cache_key = f"{org_id}:{window_start.isoformat()}"

        if cache_key not in self._state.rate_limit_counters:
            self._state.rate_limit_counters[cache_key] = {
                "requests": 0,
                "tokens": 0,
            }

        self._state.rate_limit_counters[cache_key]["requests"] += 1
        self._state.rate_limit_counters[cache_key]["tokens"] += tokens

    async def estimate_call_cost(
        self,
        org_id: UUID,
        input_text: str | list[dict],
        model: str,
        provider: Provider = Provider.OPENAI,
        max_tokens: Optional[int] = None,
    ) -> tuple[TokenCount, Decimal]:
        """
        Estimate cost for a planned API call.

        Used for pre-call budget checks.

        Args:
            org_id: Organization ID
            input_text: Input text or messages
            model: Model name
            provider: LLM provider
            max_tokens: Max tokens limit

        Returns:
            Tuple of (estimated TokenCount, estimated cost with buffer)
        """
        token_count, base_cost = await self.token_counter.estimate_cost(
            input_text=input_text,
            model=model,
            provider=provider,
            max_tokens=max_tokens,
        )

        # Add safety buffer to estimate
        buffered_cost = base_cost * (1 + self.config.estimation_buffer_pct)

        return token_count, buffered_cost

    async def check_budget(
        self,
        org_id: UUID,
        estimated_cost: Decimal,
        run_budget: Optional[Decimal] = None,
    ) -> tuple[bool, CreditBalance]:
        """
        Check if organization has budget for an operation.

        Args:
            org_id: Organization ID
            estimated_cost: Estimated cost of operation
            run_budget: Optional run-specific budget limit

        Returns:
            Tuple of (has_budget, CreditBalance)

        Raises:
            InsufficientCreditsError: If insufficient credits
        """
        balance = await self.ledger.get_or_create_balance(org_id)

        # Check per-call limit
        if estimated_cost > self.config.max_cost_per_call:
            raise BillingError(
                f"Estimated cost ${estimated_cost:.4f} exceeds per-call limit "
                f"${self.config.max_cost_per_call:.4f}"
            )

        # Check available balance
        if balance.available_usd < estimated_cost:
            raise InsufficientCreditsError(
                required=estimated_cost,
                available=balance.available_usd,
                org_id=org_id,
            )

        # Check run budget if specified
        if run_budget and estimated_cost > run_budget:
            raise BillingError(
                f"Estimated cost ${estimated_cost:.4f} exceeds run budget "
                f"${run_budget:.4f}"
            )

        return True, balance

    async def bill_token_call(
        self,
        org_id: UUID,
        input_tokens: int,
        output_tokens: int,
        model: str,
        provider: Provider = Provider.OPENAI,
        run_id: Optional[UUID] = None,
        agent_id: Optional[UUID] = None,
        task_id: Optional[UUID] = None,
        step_id: Optional[UUID] = None,
        idempotency_key: Optional[str] = None,
    ) -> BillingResult:
        """
        Bill an organization for a completed API call.

        This is the main post-call billing entry point.

        Args:
            org_id: Organization ID
            input_tokens: Actual input tokens from API response
            output_tokens: Actual output tokens from API response
            model: Model name
            provider: LLM provider
            run_id: Optional run ID
            agent_id: Optional agent ID
            task_id: Optional task ID
            step_id: Optional step ID
            idempotency_key: Unique key for idempotency

        Returns:
            BillingResult
        """
        # Check if billing is operational
        if not self.is_operational:
            logger.warning(
                f"Billing in {self.mode.value} mode, skipping charge"
            )
            return BillingResult(
                success=True,
                error_code="BILLING_DISABLED",
                error_message=f"Billing in {self.mode.value} mode",
            )

        # Check rate limits
        try:
            await self.check_rate_limit(org_id)
        except RateLimitError as e:
            return BillingResult(
                success=False,
                error_code=e.code,
                error_message=e.message,
            )

        # Attempt billing with retries
        last_error = None
        for attempt in range(self.config.max_retries):
            try:
                result = await self.ledger.record_token_call(
                    org_id=org_id,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    model=model,
                    provider=provider,
                    run_id=run_id,
                    agent_id=agent_id,
                    task_id=task_id,
                    step_id=step_id,
                    idempotency_key=idempotency_key,
                    is_estimated=False,
                )

                if result.success:
                    await self._record_success()
                    await self._increment_rate_limit(
                        org_id, input_tokens + output_tokens
                    )
                    return result
                else:
                    last_error = result.error_message

            except Exception as e:
                last_error = str(e)
                logger.warning(
                    f"Billing attempt {attempt + 1} failed: {e}"
                )

            # Wait before retry
            if attempt < self.config.max_retries - 1:
                await asyncio.sleep(
                    self.config.retry_delay_seconds * (2 ** attempt)
                )

        # All retries failed
        await self._record_failure(last_error or "Unknown error")
        return BillingResult(
            success=False,
            error_code="BILLING_FAILED",
            error_message=f"Billing failed after {self.config.max_retries} attempts: {last_error}",
        )

    @asynccontextmanager
    async def billing_context(
        self,
        org_id: UUID,
        input_text: str | list[dict],
        model: str,
        provider: Provider = Provider.OPENAI,
        max_tokens: Optional[int] = None,
        run_id: Optional[UUID] = None,
        agent_id: Optional[UUID] = None,
        task_id: Optional[UUID] = None,
        step_id: Optional[UUID] = None,
        idempotency_key: Optional[str] = None,
    ):
        """
        Context manager for billing an LLM call.

        Handles pre-call estimation and post-call billing.

        Usage:
            async with billing.billing_context(
                org_id=org_id,
                input_text=messages,
                model="gpt-4o",
            ) as ctx:
                response = await llm.chat(messages)
                ctx.set_output(response.content, response.usage)

        Args:
            org_id: Organization ID
            input_text: Input text or messages
            model: Model name
            provider: LLM provider
            max_tokens: Max tokens limit
            run_id: Optional run ID
            agent_id: Optional agent ID
            task_id: Optional task ID
            step_id: Optional step ID
            idempotency_key: Unique key for idempotency

        Yields:
            BillingContext object
        """
        ctx = BillingContext(
            billing_service=self,
            org_id=org_id,
            input_text=input_text,
            model=model,
            provider=provider,
            max_tokens=max_tokens,
            run_id=run_id,
            agent_id=agent_id,
            task_id=task_id,
            step_id=step_id,
            idempotency_key=idempotency_key,
        )

        try:
            # Pre-call: estimate and check budget
            await ctx.pre_call()
            yield ctx
        finally:
            # Post-call: bill actual usage
            await ctx.post_call()

    async def get_balance(self, org_id: UUID) -> Optional[CreditBalance]:
        """Get organization balance."""
        return await self.ledger.get_balance(org_id)

    async def add_credits(
        self,
        org_id: UUID,
        amount_usd: Decimal,
        transaction_type: TransactionType,
        reason: str,
        idempotency_key: Optional[str] = None,
        created_by: str = "system",
    ) -> BillingResult:
        """Add credits to organization."""
        return await self.ledger.add_credits(
            org_id=org_id,
            amount_usd=amount_usd,
            transaction_type=transaction_type,
            reason=reason,
            idempotency_key=idempotency_key,
            created_by=created_by,
        )

    async def get_usage_summary(
        self,
        org_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        """Get usage summary for organization."""
        return await self.ledger.get_org_usage_summary(
            org_id=org_id,
            start_date=start_date,
            end_date=end_date,
        )

    async def reconcile_run(self, run_id: UUID):
        """Reconcile estimated vs actual tokens for a run."""
        return await self.ledger.reconcile_run(run_id)

    def force_read_only(self, reason: str):
        """Force billing into read-only mode."""
        self._state.mode = BillingMode.READ_ONLY
        self._state.read_only_reason = reason
        logger.warning(f"Billing forced to read-only: {reason}")

    def force_normal(self):
        """Force billing back to normal mode."""
        self._state.mode = BillingMode.NORMAL
        self._state.read_only_reason = None
        self._state.consecutive_failures = 0
        logger.info("Billing forced to normal mode")

    def disable(self):
        """Completely disable billing."""
        self._state.mode = BillingMode.DISABLED
        logger.warning("Billing disabled")

    def enable(self):
        """Re-enable billing."""
        self._state.mode = BillingMode.NORMAL
        self._state.read_only_reason = None
        logger.info("Billing enabled")


@dataclass
class BillingContext:
    """
    Context for a single billable LLM call.

    Handles pre-call estimation and post-call billing.
    """
    billing_service: BillingService
    org_id: UUID
    input_text: str | list[dict]
    model: str
    provider: Provider
    max_tokens: Optional[int]
    run_id: Optional[UUID]
    agent_id: Optional[UUID]
    task_id: Optional[UUID]
    step_id: Optional[UUID]
    idempotency_key: Optional[str]

    # Set after estimation
    estimated_tokens: Optional[TokenCount] = None
    estimated_cost: Optional[Decimal] = None

    # Set by caller after LLM call
    actual_input_tokens: Optional[int] = None
    actual_output_tokens: Optional[int] = None
    output_text: Optional[str] = None

    # Set after billing
    result: Optional[BillingResult] = None

    async def pre_call(self):
        """Pre-call: estimate cost and check budget."""
        self.estimated_tokens, self.estimated_cost = await self.billing_service.estimate_call_cost(
            org_id=self.org_id,
            input_text=self.input_text,
            model=self.model,
            provider=self.provider,
            max_tokens=self.max_tokens,
        )

        # Check budget (raises if insufficient)
        await self.billing_service.check_budget(
            org_id=self.org_id,
            estimated_cost=self.estimated_cost,
        )

    def set_output(
        self,
        output_text: str,
        usage: Optional[dict] = None,
    ):
        """
        Set output from LLM call.

        Args:
            output_text: Response text
            usage: Optional usage dict from API response
                  (e.g., {"prompt_tokens": 100, "completion_tokens": 50})
        """
        self.output_text = output_text

        if usage:
            self.actual_input_tokens = usage.get(
                "prompt_tokens",
                usage.get("input_tokens")
            )
            self.actual_output_tokens = usage.get(
                "completion_tokens",
                usage.get("output_tokens")
            )

    def set_tokens(self, input_tokens: int, output_tokens: int):
        """Set token counts directly."""
        self.actual_input_tokens = input_tokens
        self.actual_output_tokens = output_tokens

    async def post_call(self):
        """Post-call: bill actual usage."""
        # Use actual tokens if available, otherwise estimate from output
        if self.actual_input_tokens is None or self.actual_output_tokens is None:
            if self.output_text:
                # Estimate from text
                token_count = self.billing_service.tokenizer.create_token_count(
                    input_text=self.input_text,
                    output_text=self.output_text,
                    model=self.model,
                    provider=self.provider,
                    is_estimated=True,
                )
                self.actual_input_tokens = token_count.input_tokens
                self.actual_output_tokens = token_count.output_tokens
            else:
                # No output, use estimated
                if self.estimated_tokens:
                    self.actual_input_tokens = self.estimated_tokens.input_tokens
                    self.actual_output_tokens = self.estimated_tokens.output_tokens
                else:
                    return  # Nothing to bill

        # Bill actual usage
        self.result = await self.billing_service.bill_token_call(
            org_id=self.org_id,
            input_tokens=self.actual_input_tokens,
            output_tokens=self.actual_output_tokens,
            model=self.model,
            provider=self.provider,
            run_id=self.run_id,
            agent_id=self.agent_id,
            task_id=self.task_id,
            step_id=self.step_id,
            idempotency_key=self.idempotency_key,
        )
