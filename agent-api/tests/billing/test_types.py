"""Tests for billing types."""

import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from app.billing.types import (
    Provider,
    TransactionType,
    TransactionDirection,
    ReconciliationStatus,
    TokenCount,
    TokenRecord,
    ModelPricing,
    BillingResult,
    CreditBalance,
    LedgerEntry,
    TokenReconciliation,
    BillingError,
    InsufficientCreditsError,
    RateLimitError,
    TokenizationError,
    PricingNotFoundError,
)


class TestEnums:
    """Tests for enum types."""

    def test_provider_values(self):
        """Provider enum has expected values."""
        assert Provider.OPENAI.value == "openai"
        assert Provider.ANTHROPIC.value == "anthropic"
        assert Provider.GOOGLE.value == "google"

    def test_transaction_type_values(self):
        """TransactionType enum has expected values."""
        assert TransactionType.CHARGE.value == "charge"
        assert TransactionType.REFUND.value == "refund"
        assert TransactionType.CREDIT_PURCHASE.value == "credit_purchase"

    def test_transaction_direction_values(self):
        """TransactionDirection enum has expected values."""
        assert TransactionDirection.DEBIT.value == "debit"
        assert TransactionDirection.CREDIT.value == "credit"

    def test_reconciliation_status_values(self):
        """ReconciliationStatus enum has expected values."""
        assert ReconciliationStatus.PENDING.value == "PENDING"
        assert ReconciliationStatus.RECONCILED.value == "RECONCILED"
        assert ReconciliationStatus.CRITICAL.value == "CRITICAL"


class TestTokenCount:
    """Tests for TokenCount dataclass."""

    def test_total_tokens(self):
        """total_tokens is sum of input and output."""
        tc = TokenCount(
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )
        assert tc.total_tokens == 150

    def test_to_dict(self):
        """to_dict returns correct dictionary."""
        tc = TokenCount(
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
            provider=Provider.OPENAI,
            is_estimated=True,
        )
        d = tc.to_dict()
        assert d["input_tokens"] == 100
        assert d["output_tokens"] == 50
        assert d["total_tokens"] == 150
        assert d["model"] == "gpt-4o"
        assert d["provider"] == "openai"
        assert d["is_estimated"] is True


class TestModelPricing:
    """Tests for ModelPricing dataclass."""

    @pytest.fixture
    def pricing(self):
        """Create sample pricing."""
        return ModelPricing(
            model="gpt-4o",
            provider=Provider.OPENAI,
            input_price_per_million=Decimal("2.50"),
            output_price_per_million=Decimal("10.00"),
            effective_from=datetime(2024, 1, 1),
        )

    def test_calculate_cost_basic(self, pricing):
        """calculate_cost returns correct costs."""
        input_cost, output_cost, total = pricing.calculate_cost(1000, 500)
        # 1000 tokens at $2.50/million = $0.0025
        assert input_cost == Decimal("0.0025")
        # 500 tokens at $10.00/million = $0.005
        assert output_cost == Decimal("0.005")
        assert total == Decimal("0.0075")

    def test_calculate_cost_large(self, pricing):
        """calculate_cost works for large token counts."""
        input_cost, output_cost, total = pricing.calculate_cost(1_000_000, 500_000)
        assert input_cost == Decimal("2.50")
        assert output_cost == Decimal("5.00")
        assert total == Decimal("7.50")

    def test_calculate_cost_zero(self, pricing):
        """calculate_cost handles zero tokens."""
        input_cost, output_cost, total = pricing.calculate_cost(0, 0)
        assert total == Decimal("0")


class TestBillingResult:
    """Tests for BillingResult dataclass."""

    def test_success_result(self):
        """Successful result has correct fields."""
        result = BillingResult(
            success=True,
            token_record_id=uuid4(),
            cost_usd=Decimal("0.01"),
            new_balance_usd=Decimal("99.99"),
        )
        assert result.success is True
        assert result.error_code is None

    def test_failure_result(self):
        """Failed result has error info."""
        result = BillingResult(
            success=False,
            error_code="INSUFFICIENT_CREDITS",
            error_message="Not enough credits",
        )
        assert result.success is False
        assert result.error_code == "INSUFFICIENT_CREDITS"


class TestCreditBalance:
    """Tests for CreditBalance dataclass."""

    def test_available_usd(self):
        """available_usd is balance minus reserved."""
        balance = CreditBalance(
            org_id=uuid4(),
            balance_usd=Decimal("100.00"),
            reserved_usd=Decimal("25.00"),
        )
        assert balance.available_usd == Decimal("75.00")

    def test_is_low_balance_true(self):
        """is_low_balance is True when below threshold."""
        balance = CreditBalance(
            org_id=uuid4(),
            balance_usd=Decimal("5.00"),
            reserved_usd=Decimal("0"),
            low_balance_threshold_usd=Decimal("10.00"),
        )
        assert balance.is_low_balance is True

    def test_is_low_balance_false(self):
        """is_low_balance is False when above threshold."""
        balance = CreditBalance(
            org_id=uuid4(),
            balance_usd=Decimal("50.00"),
            reserved_usd=Decimal("0"),
            low_balance_threshold_usd=Decimal("10.00"),
        )
        assert balance.is_low_balance is False


class TestExceptions:
    """Tests for billing exceptions."""

    def test_billing_error(self):
        """BillingError has message and code."""
        error = BillingError("Something went wrong", "SOME_ERROR")
        assert str(error) == "Something went wrong"
        assert error.code == "SOME_ERROR"

    def test_insufficient_credits_error(self):
        """InsufficientCreditsError has required and available amounts."""
        error = InsufficientCreditsError(
            required=Decimal("10.00"),
            available=Decimal("5.00"),
        )
        assert error.required == Decimal("10.00")
        assert error.available == Decimal("5.00")
        assert "10.00" in str(error)
        assert "5.00" in str(error)

    def test_rate_limit_error(self):
        """RateLimitError has limit info."""
        error = RateLimitError(
            limit_type="requests",
            current=100,
            limit=60,
        )
        assert error.limit_type == "requests"
        assert error.current == 100
        assert error.limit == 60

    def test_pricing_not_found_error(self):
        """PricingNotFoundError has model and provider."""
        error = PricingNotFoundError("gpt-5", "openai")
        assert error.model == "gpt-5"
        assert error.provider == "openai"
        assert "gpt-5" in str(error)
