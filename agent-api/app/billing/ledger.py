"""
Billing Ledger

Implements the append-only billing ledger with:
- Idempotent record_token_call() for safe retries
- Credit balance management
- Transaction history
- Reconciliation support

Key Invariants:
1. Ledger is append-only (never UPDATE or DELETE)
2. All amounts are positive (direction indicates debit/credit)
3. Idempotency keys prevent double-billing on retries
4. Balance updates are atomic with ledger inserts
"""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from app.billing.types import (
    Provider,
    TransactionType,
    TransactionDirection,
    BillingResult,
    CreditBalance,
    LedgerEntry,
    TokenRecord,
    TokenReconciliation,
    BillingError,
    InsufficientCreditsError,
    IdempotencyViolationError,
)

logger = logging.getLogger(__name__)


class BillingLedger:
    """
    Billing ledger for managing token records and credit transactions.

    All billing operations go through this class to ensure:
    - Idempotency
    - Atomic balance updates
    - Audit trail
    """

    def __init__(self, supabase: Any):
        """
        Initialize billing ledger.

        Args:
            supabase: Supabase client for DB operations
        """
        self.supabase = supabase

    async def record_token_call(
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
        is_estimated: bool = False,
    ) -> BillingResult:
        """
        Record a token call and charge the organization.

        This is the main billing entry point. It:
        1. Checks idempotency key
        2. Looks up pricing
        3. Calculates cost
        4. Checks balance
        5. Inserts token record
        6. Inserts ledger entry
        7. Updates balance

        All steps are atomic via database function.

        Args:
            org_id: Organization ID
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            model: Model name
            provider: LLM provider
            run_id: Optional run ID
            agent_id: Optional agent ID
            task_id: Optional task ID
            step_id: Optional step ID
            idempotency_key: Unique key for idempotency
            is_estimated: Whether tokens are estimated (pre-call)

        Returns:
            BillingResult with success/failure info
        """
        try:
            # Call database function for atomic operation
            result = self.supabase.rpc(
                "record_token_call",
                {
                    "p_org_id": str(org_id),
                    "p_run_id": str(run_id) if run_id else None,
                    "p_agent_id": str(agent_id) if agent_id else None,
                    "p_task_id": str(task_id) if task_id else None,
                    "p_step_id": str(step_id) if step_id else None,
                    "p_idempotency_key": idempotency_key,
                    "p_input_tokens": input_tokens,
                    "p_output_tokens": output_tokens,
                    "p_model": model,
                    "p_provider": provider.value,
                    "p_is_estimated": is_estimated,
                }
            ).execute()

            if result.data:
                row = result.data[0] if isinstance(result.data, list) else result.data
                return BillingResult.from_db_result(row)

            return BillingResult(
                success=False,
                error_code="NO_RESULT",
                error_message="Database function returned no result",
            )

        except Exception as e:
            logger.error(f"record_token_call failed: {e}")
            return BillingResult(
                success=False,
                error_code="DATABASE_ERROR",
                error_message=str(e),
            )

    async def add_credits(
        self,
        org_id: UUID,
        amount_usd: Decimal,
        transaction_type: TransactionType,
        reason: str,
        idempotency_key: Optional[str] = None,
        created_by: str = "system",
    ) -> BillingResult:
        """
        Add credits to an organization's balance.

        Args:
            org_id: Organization ID
            amount_usd: Amount to add (always positive)
            transaction_type: Type of credit (purchase, refund, promo, etc.)
            reason: Description of why credits are being added
            idempotency_key: Unique key for idempotency
            created_by: Who initiated the credit

        Returns:
            BillingResult with new balance
        """
        if transaction_type not in (
            TransactionType.CREDIT_PURCHASE,
            TransactionType.REFUND,
            TransactionType.PROMO,
            TransactionType.TRIAL,
            TransactionType.ADJUSTMENT,
        ):
            return BillingResult(
                success=False,
                error_code="INVALID_TRANSACTION_TYPE",
                error_message=f"Transaction type {transaction_type} cannot add credits",
            )

        try:
            result = self.supabase.rpc(
                "add_credits",
                {
                    "p_org_id": str(org_id),
                    "p_amount_usd": str(amount_usd),
                    "p_transaction_type": transaction_type.value,
                    "p_reason": reason,
                    "p_idempotency_key": idempotency_key,
                    "p_created_by": created_by,
                }
            ).execute()

            if result.data:
                row = result.data[0] if isinstance(result.data, list) else result.data
                return BillingResult(
                    success=row.get("success", False),
                    token_record_id=UUID(row["ledger_id"]) if row.get("ledger_id") else None,
                    new_balance_usd=Decimal(str(row["new_balance_usd"])) if row.get("new_balance_usd") else None,
                    error_message=row.get("error_message"),
                )

            return BillingResult(
                success=False,
                error_code="NO_RESULT",
                error_message="Database function returned no result",
            )

        except Exception as e:
            logger.error(f"add_credits failed: {e}")
            return BillingResult(
                success=False,
                error_code="DATABASE_ERROR",
                error_message=str(e),
            )

    async def get_balance(self, org_id: UUID) -> Optional[CreditBalance]:
        """
        Get current credit balance for an organization.

        Args:
            org_id: Organization ID

        Returns:
            CreditBalance or None if not found
        """
        try:
            result = self.supabase.table("credit_balances").select(
                "*"
            ).eq(
                "org_id", str(org_id)
            ).single().execute()

            if result.data:
                return CreditBalance.from_db_row(result.data)
            return None

        except Exception as e:
            logger.error(f"get_balance failed: {e}")
            return None

    async def get_or_create_balance(self, org_id: UUID) -> CreditBalance:
        """
        Get or create credit balance for an organization.

        Args:
            org_id: Organization ID

        Returns:
            CreditBalance (created with 0 balance if not exists)
        """
        balance = await self.get_balance(org_id)
        if balance:
            return balance

        # Create new balance
        try:
            result = self.supabase.table("credit_balances").insert({
                "org_id": str(org_id),
                "balance_usd": "0",
                "reserved_usd": "0",
            }).execute()

            if result.data:
                return CreditBalance.from_db_row(result.data[0])

            # Race condition: another process created it
            return await self.get_balance(org_id)

        except Exception as e:
            logger.error(f"get_or_create_balance failed: {e}")
            # Try to get again (race condition)
            balance = await self.get_balance(org_id)
            if balance:
                return balance
            raise BillingError(f"Failed to create balance: {e}")

    async def check_sufficient_balance(
        self,
        org_id: UUID,
        required_amount: Decimal,
    ) -> tuple[bool, CreditBalance]:
        """
        Check if organization has sufficient balance.

        Args:
            org_id: Organization ID
            required_amount: Amount needed

        Returns:
            Tuple of (has_sufficient, CreditBalance)
        """
        balance = await self.get_or_create_balance(org_id)
        has_sufficient = balance.available_usd >= required_amount
        return has_sufficient, balance

    async def reserve_credits(
        self,
        org_id: UUID,
        amount_usd: Decimal,
        run_id: UUID,
    ) -> bool:
        """
        Reserve credits for an in-progress run.

        Reserved credits cannot be used by other operations.

        Args:
            org_id: Organization ID
            amount_usd: Amount to reserve
            run_id: Run that is reserving credits

        Returns:
            True if reserved successfully
        """
        try:
            # Atomic update with balance check
            result = self.supabase.table("credit_balances").update({
                "reserved_usd": self.supabase.sql(f"reserved_usd + {amount_usd}"),
            }).eq(
                "org_id", str(org_id)
            ).gte(
                "balance_usd - reserved_usd", str(amount_usd)
            ).execute()

            return len(result.data) > 0

        except Exception as e:
            logger.error(f"reserve_credits failed: {e}")
            return False

    async def release_reserved_credits(
        self,
        org_id: UUID,
        amount_usd: Decimal,
        run_id: UUID,
    ) -> bool:
        """
        Release reserved credits after run completes.

        Args:
            org_id: Organization ID
            amount_usd: Amount to release
            run_id: Run that reserved the credits

        Returns:
            True if released successfully
        """
        try:
            result = self.supabase.table("credit_balances").update({
                "reserved_usd": self.supabase.sql(f"GREATEST(0, reserved_usd - {amount_usd})"),
            }).eq(
                "org_id", str(org_id)
            ).execute()

            return len(result.data) > 0

        except Exception as e:
            logger.error(f"release_reserved_credits failed: {e}")
            return False

    async def get_transaction_history(
        self,
        org_id: UUID,
        limit: int = 100,
        offset: int = 0,
        transaction_type: Optional[TransactionType] = None,
    ) -> list[LedgerEntry]:
        """
        Get transaction history for an organization.

        Args:
            org_id: Organization ID
            limit: Max number of entries
            offset: Pagination offset
            transaction_type: Filter by type (optional)

        Returns:
            List of LedgerEntry
        """
        try:
            query = self.supabase.table("billing_ledger").select(
                "*"
            ).eq(
                "org_id", str(org_id)
            )

            if transaction_type:
                query = query.eq("transaction_type", transaction_type.value)

            result = query.order(
                "created_at", desc=True
            ).range(
                offset, offset + limit - 1
            ).execute()

            return [LedgerEntry.from_db_row(row) for row in result.data]

        except Exception as e:
            logger.error(f"get_transaction_history failed: {e}")
            return []

    async def get_token_records(
        self,
        run_id: UUID,
        include_estimated: bool = False,
    ) -> list[TokenRecord]:
        """
        Get token records for a run.

        Args:
            run_id: Run ID
            include_estimated: Whether to include estimated records

        Returns:
            List of TokenRecord
        """
        try:
            query = self.supabase.table("token_records").select(
                "*"
            ).eq(
                "run_id", str(run_id)
            )

            if not include_estimated:
                query = query.eq("is_estimated", False)

            result = query.order("created_at").execute()

            return [TokenRecord.from_db_row(row) for row in result.data]

        except Exception as e:
            logger.error(f"get_token_records failed: {e}")
            return []

    async def reconcile_run(self, run_id: UUID) -> Optional[TokenReconciliation]:
        """
        Reconcile estimated vs actual tokens for a run.

        Args:
            run_id: Run ID

        Returns:
            TokenReconciliation result
        """
        try:
            result = self.supabase.rpc(
                "reconcile_run",
                {"p_run_id": str(run_id)}
            ).execute()

            if result.data:
                reconciliation_id = result.data
                # Fetch the full reconciliation record
                rec_result = self.supabase.table("token_reconciliations").select(
                    "*"
                ).eq(
                    "id", reconciliation_id
                ).single().execute()

                if rec_result.data:
                    return TokenReconciliation.from_db_row(rec_result.data)

            return None

        except Exception as e:
            logger.error(f"reconcile_run failed: {e}")
            return None

    async def get_run_cost(self, run_id: UUID) -> Decimal:
        """
        Get total cost for a run.

        Args:
            run_id: Run ID

        Returns:
            Total cost in USD
        """
        try:
            result = self.supabase.table("token_records").select(
                "cost_usd"
            ).eq(
                "run_id", str(run_id)
            ).eq(
                "is_estimated", False
            ).execute()

            return sum(Decimal(str(row["cost_usd"])) for row in result.data)

        except Exception as e:
            logger.error(f"get_run_cost failed: {e}")
            return Decimal("0")

    async def get_org_usage_summary(
        self,
        org_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        """
        Get usage summary for an organization.

        Args:
            org_id: Organization ID
            start_date: Start of period (optional)
            end_date: End of period (optional)

        Returns:
            Usage summary dict
        """
        try:
            query = self.supabase.table("token_records").select(
                "input_tokens, output_tokens, cost_usd, model, created_at"
            ).eq(
                "org_id", str(org_id)
            ).eq(
                "is_estimated", False
            )

            if start_date:
                query = query.gte("created_at", start_date.isoformat())
            if end_date:
                query = query.lte("created_at", end_date.isoformat())

            result = query.execute()

            total_input = sum(row["input_tokens"] for row in result.data)
            total_output = sum(row["output_tokens"] for row in result.data)
            total_cost = sum(Decimal(str(row["cost_usd"])) for row in result.data)

            # Group by model
            by_model = {}
            for row in result.data:
                model = row["model"]
                if model not in by_model:
                    by_model[model] = {
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "cost_usd": Decimal("0"),
                        "call_count": 0,
                    }
                by_model[model]["input_tokens"] += row["input_tokens"]
                by_model[model]["output_tokens"] += row["output_tokens"]
                by_model[model]["cost_usd"] += Decimal(str(row["cost_usd"]))
                by_model[model]["call_count"] += 1

            return {
                "total_input_tokens": total_input,
                "total_output_tokens": total_output,
                "total_tokens": total_input + total_output,
                "total_cost_usd": total_cost,
                "call_count": len(result.data),
                "by_model": by_model,
            }

        except Exception as e:
            logger.error(f"get_org_usage_summary failed: {e}")
            return {
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost_usd": Decimal("0"),
                "call_count": 0,
                "by_model": {},
            }
