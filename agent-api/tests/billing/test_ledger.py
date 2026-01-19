"""Tests for billing ledger."""

import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import Mock, AsyncMock
from uuid import uuid4

from app.billing.ledger import BillingLedger
from app.billing.types import (
    Provider,
    TransactionType,
    BillingResult,
    CreditBalance,
)


class TestBillingLedger:
    """Tests for BillingLedger."""

    @pytest.fixture
    def mock_supabase(self):
        """Create mock Supabase client."""
        mock = Mock()
        return mock

    @pytest.fixture
    def ledger(self, mock_supabase):
        """Create billing ledger with mock."""
        return BillingLedger(mock_supabase)

    @pytest.mark.asyncio
    async def test_record_token_call_success(self, ledger, mock_supabase):
        """record_token_call returns success result."""
        org_id = uuid4()
        token_record_id = uuid4()

        mock_supabase.rpc.return_value.execute.return_value = Mock(
            data=[{
                "success": True,
                "token_record_id": str(token_record_id),
                "cost_usd": "0.01",
                "new_balance_usd": "99.99",
            }]
        )

        result = await ledger.record_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
            provider=Provider.OPENAI,
        )

        assert result.success is True
        assert result.token_record_id == token_record_id
        assert result.cost_usd == Decimal("0.01")

    @pytest.mark.asyncio
    async def test_record_token_call_with_idempotency(self, ledger, mock_supabase):
        """record_token_call passes idempotency key."""
        org_id = uuid4()

        mock_supabase.rpc.return_value.execute.return_value = Mock(
            data=[{"success": True}]
        )

        await ledger.record_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
            idempotency_key="test-key-123",
        )

        # Verify idempotency key was passed
        call_args = mock_supabase.rpc.call_args
        assert call_args[0][1]["p_idempotency_key"] == "test-key-123"

    @pytest.mark.asyncio
    async def test_record_token_call_error(self, ledger, mock_supabase):
        """record_token_call handles errors."""
        org_id = uuid4()
        mock_supabase.rpc.return_value.execute.side_effect = Exception("DB error")

        result = await ledger.record_token_call(
            org_id=org_id,
            input_tokens=100,
            output_tokens=50,
            model="gpt-4o",
        )

        assert result.success is False
        assert result.error_code == "DATABASE_ERROR"

    @pytest.mark.asyncio
    async def test_add_credits_success(self, ledger, mock_supabase):
        """add_credits returns success result."""
        org_id = uuid4()
        ledger_id = uuid4()

        mock_supabase.rpc.return_value.execute.return_value = Mock(
            data=[{
                "success": True,
                "ledger_id": str(ledger_id),
                "new_balance_usd": "150.00",
            }]
        )

        result = await ledger.add_credits(
            org_id=org_id,
            amount_usd=Decimal("50.00"),
            transaction_type=TransactionType.CREDIT_PURCHASE,
            reason="Test purchase",
        )

        assert result.success is True
        assert result.new_balance_usd == Decimal("150.00")

    @pytest.mark.asyncio
    async def test_add_credits_invalid_type(self, ledger, mock_supabase):
        """add_credits rejects invalid transaction type."""
        org_id = uuid4()

        result = await ledger.add_credits(
            org_id=org_id,
            amount_usd=Decimal("50.00"),
            transaction_type=TransactionType.CHARGE,  # Invalid for credits
            reason="Test",
        )

        assert result.success is False
        assert result.error_code == "INVALID_TRANSACTION_TYPE"

    @pytest.mark.asyncio
    async def test_get_balance(self, ledger, mock_supabase):
        """get_balance returns CreditBalance."""
        org_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data={
                "org_id": str(org_id),
                "balance_usd": "100.00",
                "reserved_usd": "10.00",
                "low_balance_threshold_usd": "10.00",
                "auto_recharge_enabled": False,
            }
        )

        balance = await ledger.get_balance(org_id)

        assert balance is not None
        assert balance.balance_usd == Decimal("100.00")
        assert balance.reserved_usd == Decimal("10.00")
        assert balance.available_usd == Decimal("90.00")

    @pytest.mark.asyncio
    async def test_get_balance_not_found(self, ledger, mock_supabase):
        """get_balance returns None when not found."""
        org_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data=None
        )

        balance = await ledger.get_balance(org_id)

        assert balance is None

    @pytest.mark.asyncio
    async def test_check_sufficient_balance_true(self, ledger, mock_supabase):
        """check_sufficient_balance returns True when sufficient."""
        org_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data={
                "org_id": str(org_id),
                "balance_usd": "100.00",
                "reserved_usd": "0",
            }
        )

        has_sufficient, balance = await ledger.check_sufficient_balance(
            org_id=org_id,
            required_amount=Decimal("50.00"),
        )

        assert has_sufficient is True
        assert balance.available_usd >= Decimal("50.00")

    @pytest.mark.asyncio
    async def test_check_sufficient_balance_false(self, ledger, mock_supabase):
        """check_sufficient_balance returns False when insufficient."""
        org_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data={
                "org_id": str(org_id),
                "balance_usd": "10.00",
                "reserved_usd": "0",
            }
        )

        has_sufficient, balance = await ledger.check_sufficient_balance(
            org_id=org_id,
            required_amount=Decimal("50.00"),
        )

        assert has_sufficient is False

    @pytest.mark.asyncio
    async def test_get_run_cost(self, ledger, mock_supabase):
        """get_run_cost returns total cost for run."""
        run_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
            data=[
                {"cost_usd": "0.01"},
                {"cost_usd": "0.02"},
                {"cost_usd": "0.005"},
            ]
        )

        cost = await ledger.get_run_cost(run_id)

        assert cost == Decimal("0.035")

    @pytest.mark.asyncio
    async def test_get_run_cost_empty(self, ledger, mock_supabase):
        """get_run_cost returns 0 for run with no records."""
        run_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
            data=[]
        )

        cost = await ledger.get_run_cost(run_id)

        assert cost == Decimal("0")


class TestBillingLedgerTransactions:
    """Tests for transaction history."""

    @pytest.fixture
    def mock_supabase(self):
        """Create mock Supabase client."""
        return Mock()

    @pytest.fixture
    def ledger(self, mock_supabase):
        """Create billing ledger with mock."""
        return BillingLedger(mock_supabase)

    @pytest.mark.asyncio
    async def test_get_transaction_history(self, ledger, mock_supabase):
        """get_transaction_history returns list of entries."""
        org_id = uuid4()

        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = Mock(
            data=[
                {
                    "id": str(uuid4()),
                    "org_id": str(org_id),
                    "transaction_type": "charge",
                    "amount_usd": "0.01",
                    "direction": "debit",
                    "reason": "API call",
                    "created_at": datetime.utcnow().isoformat(),
                },
            ]
        )

        entries = await ledger.get_transaction_history(org_id)

        assert len(entries) == 1
        assert entries[0].transaction_type.value == "charge"

    @pytest.mark.asyncio
    async def test_get_transaction_history_with_filter(self, ledger, mock_supabase):
        """get_transaction_history filters by type."""
        org_id = uuid4()

        mock_query = Mock()
        mock_supabase.table.return_value.select.return_value.eq.return_value = mock_query
        mock_query.eq.return_value.order.return_value.range.return_value.execute.return_value = Mock(
            data=[]
        )

        await ledger.get_transaction_history(
            org_id=org_id,
            transaction_type=TransactionType.REFUND,
        )

        # Verify type filter was applied
        mock_query.eq.assert_called_with("transaction_type", "refund")


class TestBillingLedgerReconciliation:
    """Tests for reconciliation."""

    @pytest.fixture
    def mock_supabase(self):
        """Create mock Supabase client."""
        return Mock()

    @pytest.fixture
    def ledger(self, mock_supabase):
        """Create billing ledger with mock."""
        return BillingLedger(mock_supabase)

    @pytest.mark.asyncio
    async def test_reconcile_run(self, ledger, mock_supabase):
        """reconcile_run creates reconciliation record."""
        run_id = uuid4()
        rec_id = uuid4()

        mock_supabase.rpc.return_value.execute.return_value = Mock(data=str(rec_id))
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = Mock(
            data={
                "id": str(rec_id),
                "run_id": str(run_id),
                "org_id": str(uuid4()),
                "estimated_input_tokens": 100,
                "estimated_output_tokens": 50,
                "actual_input_tokens": 110,
                "actual_output_tokens": 55,
                "variance_pct": "10.00",
                "estimated_cost_usd": "0.01",
                "actual_cost_usd": "0.011",
                "status": "RECONCILED",
            }
        )

        reconciliation = await ledger.reconcile_run(run_id)

        assert reconciliation is not None
        assert reconciliation.run_id == run_id
        assert reconciliation.status.value == "RECONCILED"
