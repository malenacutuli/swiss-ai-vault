"""Tests for billing service."""

import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, MagicMock
from uuid import uuid4

from app.billing.billing import (
    BillingService,
    BillingConfig,
    BillingMode,
    BillingContext,
)
from app.billing.types import (
    Provider,
    TransactionType,
    CreditBalance,
    BillingResult,
    InsufficientCreditsError,
    RateLimitError,
)


class TestBillingConfig:
    """Tests for BillingConfig."""

    def test_default_values(self):
        """Default configuration values are set."""
        config = BillingConfig()
        assert config.max_cost_per_call == Decimal("10.00")
        assert config.max_cost_per_run == Decimal("100.00")
        assert config.rate_limit_requests_per_minute == 100
        assert config.failure_threshold == 3

    def test_custom_values(self):
        """Custom configuration values are respected."""
        config = BillingConfig(
            max_cost_per_call=Decimal("5.00"),
            rate_limit_requests_per_minute=50,
        )
        assert config.max_cost_per_call == Decimal("5.00")
        assert config.rate_limit_requests_per_minute == 50


class TestBillingService:
    """Tests for BillingService."""

    @pytest.fixture
    def mock_supabase(self):
        """Create mock Supabase client."""
        mock = Mock()
        # Mock table queries
        mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data=None
        )
        # Mock RPC calls
        mock.rpc.return_value.execute.return_value = Mock(
            data=[{
                "success": True,
                "token_record_id": str(uuid4()),
                "cost_usd": "0.01",
                "new_balance_usd": "99.99",
            }]
        )
        return mock

    @pytest.fixture
    def billing_service(self, mock_supabase):
        """Create billing service with mocks."""
        return BillingService(mock_supabase)

    def test_initial_mode_is_normal(self, billing_service):
        """Initial billing mode is NORMAL."""
        assert billing_service.mode == BillingMode.NORMAL
        assert billing_service.is_operational is True

    def test_force_read_only(self, billing_service):
        """force_read_only switches mode."""
        billing_service.force_read_only("Test reason")
        assert billing_service.mode == BillingMode.READ_ONLY
        assert billing_service.is_operational is False

    def test_force_normal(self, billing_service):
        """force_normal switches back to normal."""
        billing_service.force_read_only("Test")
        billing_service.force_normal()
        assert billing_service.mode == BillingMode.NORMAL

    def test_disable_and_enable(self, billing_service):
        """disable and enable work correctly."""
        billing_service.disable()
        assert billing_service.mode == BillingMode.DISABLED
        billing_service.enable()
        assert billing_service.mode == BillingMode.NORMAL

    @pytest.mark.asyncio
    async def test_check_rate_limit_passes(self, billing_service):
        """check_rate_limit passes when under limit."""
        org_id = uuid4()
        result = await billing_service.check_rate_limit(org_id)
        assert result is True

    @pytest.mark.asyncio
    async def test_check_rate_limit_fails(self, billing_service):
        """check_rate_limit raises when over limit."""
        org_id = uuid4()
        billing_service.config.rate_limit_requests_per_minute = 2

        # Make requests to exceed limit
        await billing_service._increment_rate_limit(org_id, 100)
        await billing_service._increment_rate_limit(org_id, 100)

        with pytest.raises(RateLimitError):
            await billing_service.check_rate_limit(org_id)

    @pytest.mark.asyncio
    async def test_estimate_call_cost(self, billing_service):
        """estimate_call_cost returns estimate with buffer."""
        org_id = uuid4()
        token_count, cost = await billing_service.estimate_call_cost(
            org_id=org_id,
            input_text="Hello, how are you?",
            model="gpt-4o",
        )

        assert token_count.input_tokens > 0
        assert cost > Decimal("0")
        # Cost should include buffer
        assert token_count.is_estimated is True

    @pytest.mark.asyncio
    async def test_bill_token_call_success(self, billing_service):
        """bill_token_call returns success result."""
        org_id = uuid4()
        result = await billing_service.bill_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )

        assert result.success is True
        assert result.token_record_id is not None

    @pytest.mark.asyncio
    async def test_bill_token_call_read_only_mode(self, billing_service):
        """bill_token_call skips in read-only mode."""
        billing_service.force_read_only("Test")
        org_id = uuid4()

        result = await billing_service.bill_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )

        assert result.success is True
        assert result.error_code == "BILLING_DISABLED"


class TestBillingServiceFailures:
    """Tests for billing failure handling."""

    @pytest.fixture
    def failing_supabase(self):
        """Create Supabase mock that fails."""
        mock = Mock()
        mock.rpc.return_value.execute.side_effect = Exception("Database error")
        mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data=None
        )
        return mock

    @pytest.fixture
    def billing_service(self, failing_supabase):
        """Create billing service with failing DB."""
        config = BillingConfig(
            failure_threshold=2,
            max_retries=1,
        )
        return BillingService(failing_supabase, config=config)

    @pytest.mark.asyncio
    async def test_consecutive_failures_trigger_read_only(self, billing_service):
        """Multiple failures trigger read-only mode."""
        org_id = uuid4()

        # First failure
        result1 = await billing_service.bill_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )
        assert result1.success is False
        assert billing_service.mode == BillingMode.NORMAL

        # Second failure should trigger read-only
        result2 = await billing_service.bill_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )
        assert result2.success is False
        assert billing_service.mode == BillingMode.READ_ONLY


class TestBillingContext:
    """Tests for BillingContext."""

    @pytest.fixture
    def mock_billing_service(self):
        """Create mock billing service."""
        service = Mock(spec=BillingService)
        service.tokenizer = Mock()
        service.tokenizer.create_token_count.return_value = Mock(
            input_tokens=100,
            output_tokens=50,
        )
        service.estimate_call_cost = AsyncMock(return_value=(
            Mock(input_tokens=100, output_tokens=50),
            Decimal("0.01"),
        ))
        service.check_budget = AsyncMock(return_value=(True, Mock()))
        service.bill_token_call = AsyncMock(return_value=BillingResult(
            success=True,
            token_record_id=uuid4(),
            cost_usd=Decimal("0.01"),
        ))
        return service

    @pytest.mark.asyncio
    async def test_billing_context_pre_call(self, mock_billing_service):
        """pre_call estimates and checks budget."""
        ctx = BillingContext(
            billing_service=mock_billing_service,
            org_id=uuid4(),
            input_text="Hello",
            model="gpt-4o",
            provider=Provider.OPENAI,
            max_tokens=100,
            run_id=None,
            agent_id=None,
            task_id=None,
            step_id=None,
            idempotency_key=None,
        )

        await ctx.pre_call()

        assert ctx.estimated_tokens is not None
        assert ctx.estimated_cost is not None
        mock_billing_service.estimate_call_cost.assert_called_once()
        mock_billing_service.check_budget.assert_called_once()

    @pytest.mark.asyncio
    async def test_billing_context_post_call_with_usage(self, mock_billing_service):
        """post_call bills actual usage."""
        ctx = BillingContext(
            billing_service=mock_billing_service,
            org_id=uuid4(),
            input_text="Hello",
            model="gpt-4o",
            provider=Provider.OPENAI,
            max_tokens=None,
            run_id=None,
            agent_id=None,
            task_id=None,
            step_id=None,
            idempotency_key="test-key",
        )

        ctx.set_output("Hi there!", {"prompt_tokens": 5, "completion_tokens": 3})
        await ctx.post_call()

        assert ctx.actual_input_tokens == 5
        assert ctx.actual_output_tokens == 3
        mock_billing_service.bill_token_call.assert_called_once()

    def test_set_tokens_directly(self, mock_billing_service):
        """set_tokens sets token counts directly."""
        ctx = BillingContext(
            billing_service=mock_billing_service,
            org_id=uuid4(),
            input_text="Hello",
            model="gpt-4o",
            provider=Provider.OPENAI,
            max_tokens=None,
            run_id=None,
            agent_id=None,
            task_id=None,
            step_id=None,
            idempotency_key=None,
        )

        ctx.set_tokens(200, 100)

        assert ctx.actual_input_tokens == 200
        assert ctx.actual_output_tokens == 100
