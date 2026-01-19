"""
Billing Types and Data Classes

Defines all types used in the billing system including:
- Token counts and records
- Billing results and errors
- Credit balance structures
- Model pricing information
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, Any
from uuid import UUID


class Provider(str, Enum):
    """LLM Provider identifiers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AZURE = "azure"
    LOCAL = "local"


class TransactionType(str, Enum):
    """Billing transaction types."""
    CREDIT_PURCHASE = "credit_purchase"
    CHARGE = "charge"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"
    PROMO = "promo"
    TRIAL = "trial"


class TransactionDirection(str, Enum):
    """Transaction direction (debit or credit)."""
    DEBIT = "debit"
    CREDIT = "credit"


class ReconciliationStatus(str, Enum):
    """Token reconciliation status."""
    PENDING = "PENDING"
    RECONCILED = "RECONCILED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    CRITICAL = "CRITICAL"
    DISPUTED = "DISPUTED"


# =============================================================================
# Token Types
# =============================================================================

@dataclass
class TokenCount:
    """Token count for a single LLM call."""
    input_tokens: int
    output_tokens: int
    model: str
    provider: Provider = Provider.OPENAI
    is_estimated: bool = False
    estimation_method: Optional[str] = None

    @property
    def total_tokens(self) -> int:
        """Total tokens (input + output)."""
        return self.input_tokens + self.output_tokens

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "model": self.model,
            "provider": self.provider.value,
            "is_estimated": self.is_estimated,
            "estimation_method": self.estimation_method,
        }


@dataclass
class TokenRecord:
    """Full token record as stored in database."""
    id: UUID
    org_id: UUID
    run_id: Optional[UUID]
    agent_id: Optional[UUID]
    task_id: Optional[UUID]
    step_id: Optional[UUID]
    idempotency_key: Optional[str]
    input_tokens: int
    output_tokens: int
    model: str
    provider: Provider
    cost_usd: Decimal
    input_cost_usd: Decimal
    output_cost_usd: Decimal
    is_estimated: bool
    estimation_method: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    created_at: datetime

    @property
    def total_tokens(self) -> int:
        """Total tokens."""
        return self.input_tokens + self.output_tokens

    @classmethod
    def from_db_row(cls, row: dict) -> TokenRecord:
        """Create from database row."""
        return cls(
            id=UUID(row["id"]) if isinstance(row["id"], str) else row["id"],
            org_id=UUID(row["org_id"]) if isinstance(row["org_id"], str) else row["org_id"],
            run_id=UUID(row["run_id"]) if row.get("run_id") else None,
            agent_id=UUID(row["agent_id"]) if row.get("agent_id") else None,
            task_id=UUID(row["task_id"]) if row.get("task_id") else None,
            step_id=UUID(row["step_id"]) if row.get("step_id") else None,
            idempotency_key=row.get("idempotency_key"),
            input_tokens=row["input_tokens"],
            output_tokens=row["output_tokens"],
            model=row["model"],
            provider=Provider(row.get("provider", "openai")),
            cost_usd=Decimal(str(row["cost_usd"])),
            input_cost_usd=Decimal(str(row.get("input_cost_usd", 0))),
            output_cost_usd=Decimal(str(row.get("output_cost_usd", 0))),
            is_estimated=row.get("is_estimated", False),
            estimation_method=row.get("estimation_method"),
            error_code=row.get("error_code"),
            error_message=row.get("error_message"),
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.fromisoformat(row["created_at"]),
        )


# =============================================================================
# Billing Types
# =============================================================================

@dataclass
class ModelPricing:
    """Pricing information for a model."""
    model: str
    provider: Provider
    input_price_per_million: Decimal
    output_price_per_million: Decimal
    effective_from: datetime
    effective_until: Optional[datetime] = None

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> tuple[Decimal, Decimal, Decimal]:
        """
        Calculate cost for given token counts.

        Returns:
            Tuple of (input_cost, output_cost, total_cost)
        """
        input_cost = (Decimal(input_tokens) / Decimal(1_000_000)) * self.input_price_per_million
        output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * self.output_price_per_million
        return input_cost, output_cost, input_cost + output_cost

    @classmethod
    def from_db_row(cls, row: dict) -> ModelPricing:
        """Create from database row."""
        return cls(
            model=row["model"],
            provider=Provider(row["provider"]),
            input_price_per_million=Decimal(str(row["input_price_per_million"])),
            output_price_per_million=Decimal(str(row["output_price_per_million"])),
            effective_from=row["effective_from"] if isinstance(row["effective_from"], datetime) else datetime.fromisoformat(row["effective_from"]),
            effective_until=row.get("effective_until"),
        )


@dataclass
class BillingResult:
    """Result of a billing operation."""
    success: bool
    token_record_id: Optional[UUID] = None
    cost_usd: Optional[Decimal] = None
    new_balance_usd: Optional[Decimal] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    is_idempotent_replay: bool = False

    @classmethod
    def from_db_result(cls, row: dict) -> BillingResult:
        """Create from database function result."""
        return cls(
            success=row.get("success", False),
            token_record_id=UUID(row["token_record_id"]) if row.get("token_record_id") else None,
            cost_usd=Decimal(str(row["cost_usd"])) if row.get("cost_usd") else None,
            new_balance_usd=Decimal(str(row["new_balance_usd"])) if row.get("new_balance_usd") else None,
            error_code=row.get("error_code"),
            error_message=row.get("error_message"),
        )


@dataclass
class CreditBalance:
    """Organization credit balance."""
    org_id: UUID
    balance_usd: Decimal
    reserved_usd: Decimal
    low_balance_threshold_usd: Decimal = Decimal("10.00")
    auto_recharge_enabled: bool = False
    auto_recharge_amount_usd: Optional[Decimal] = None
    auto_recharge_threshold_usd: Optional[Decimal] = None
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def available_usd(self) -> Decimal:
        """Available balance (balance - reserved)."""
        return self.balance_usd - self.reserved_usd

    @property
    def is_low_balance(self) -> bool:
        """Check if balance is below warning threshold."""
        return self.available_usd < self.low_balance_threshold_usd

    @classmethod
    def from_db_row(cls, row: dict) -> CreditBalance:
        """Create from database row."""
        return cls(
            org_id=UUID(row["org_id"]) if isinstance(row["org_id"], str) else row["org_id"],
            balance_usd=Decimal(str(row["balance_usd"])),
            reserved_usd=Decimal(str(row.get("reserved_usd", 0))),
            low_balance_threshold_usd=Decimal(str(row.get("low_balance_threshold_usd", 10))),
            auto_recharge_enabled=row.get("auto_recharge_enabled", False),
            auto_recharge_amount_usd=Decimal(str(row["auto_recharge_amount_usd"])) if row.get("auto_recharge_amount_usd") else None,
            auto_recharge_threshold_usd=Decimal(str(row["auto_recharge_threshold_usd"])) if row.get("auto_recharge_threshold_usd") else None,
            updated_at=row.get("updated_at", datetime.utcnow()),
        )


@dataclass
class LedgerEntry:
    """Billing ledger entry."""
    id: UUID
    org_id: UUID
    transaction_type: TransactionType
    amount_usd: Decimal
    direction: TransactionDirection
    run_id: Optional[UUID]
    agent_id: Optional[UUID]
    task_id: Optional[UUID]
    token_record_id: Optional[UUID]
    reason: str
    idempotency_key: Optional[str]
    created_by: Optional[str]
    created_at: datetime

    @classmethod
    def from_db_row(cls, row: dict) -> LedgerEntry:
        """Create from database row."""
        return cls(
            id=UUID(row["id"]) if isinstance(row["id"], str) else row["id"],
            org_id=UUID(row["org_id"]) if isinstance(row["org_id"], str) else row["org_id"],
            transaction_type=TransactionType(row["transaction_type"]),
            amount_usd=Decimal(str(row["amount_usd"])),
            direction=TransactionDirection(row["direction"]),
            run_id=UUID(row["run_id"]) if row.get("run_id") else None,
            agent_id=UUID(row["agent_id"]) if row.get("agent_id") else None,
            task_id=UUID(row["task_id"]) if row.get("task_id") else None,
            token_record_id=UUID(row["token_record_id"]) if row.get("token_record_id") else None,
            reason=row["reason"],
            idempotency_key=row.get("idempotency_key"),
            created_by=row.get("created_by"),
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.fromisoformat(row["created_at"]),
        )


@dataclass
class TokenReconciliation:
    """Token reconciliation record."""
    id: UUID
    run_id: UUID
    org_id: UUID
    estimated_input_tokens: int
    estimated_output_tokens: int
    actual_input_tokens: int
    actual_output_tokens: int
    variance_pct: Decimal
    estimated_cost_usd: Decimal
    actual_cost_usd: Decimal
    status: ReconciliationStatus
    refund_amount_usd: Decimal = Decimal("0")
    charge_amount_usd: Decimal = Decimal("0")
    resolution_notes: Optional[str] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def estimated_total_tokens(self) -> int:
        """Total estimated tokens."""
        return self.estimated_input_tokens + self.estimated_output_tokens

    @property
    def actual_total_tokens(self) -> int:
        """Total actual tokens."""
        return self.actual_input_tokens + self.actual_output_tokens

    @property
    def variance_tokens(self) -> int:
        """Token variance (actual - estimated)."""
        return self.actual_total_tokens - self.estimated_total_tokens

    @classmethod
    def from_db_row(cls, row: dict) -> TokenReconciliation:
        """Create from database row."""
        return cls(
            id=UUID(row["id"]) if isinstance(row["id"], str) else row["id"],
            run_id=UUID(row["run_id"]) if isinstance(row["run_id"], str) else row["run_id"],
            org_id=UUID(row["org_id"]) if isinstance(row["org_id"], str) else row["org_id"],
            estimated_input_tokens=row["estimated_input_tokens"],
            estimated_output_tokens=row["estimated_output_tokens"],
            actual_input_tokens=row["actual_input_tokens"],
            actual_output_tokens=row["actual_output_tokens"],
            variance_pct=Decimal(str(row["variance_pct"])),
            estimated_cost_usd=Decimal(str(row["estimated_cost_usd"])),
            actual_cost_usd=Decimal(str(row["actual_cost_usd"])),
            status=ReconciliationStatus(row["status"]),
            refund_amount_usd=Decimal(str(row.get("refund_amount_usd", 0))),
            charge_amount_usd=Decimal(str(row.get("charge_amount_usd", 0))),
            resolution_notes=row.get("resolution_notes"),
            resolved_by=UUID(row["resolved_by"]) if row.get("resolved_by") else None,
            resolved_at=row.get("resolved_at"),
            created_at=row.get("created_at", datetime.utcnow()),
        )


# =============================================================================
# Exceptions
# =============================================================================

class BillingError(Exception):
    """Base billing exception."""
    def __init__(self, message: str, code: str = "BILLING_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class InsufficientCreditsError(BillingError):
    """Raised when organization has insufficient credits."""
    def __init__(
        self,
        required: Decimal,
        available: Decimal,
        org_id: Optional[UUID] = None
    ):
        self.required = required
        self.available = available
        self.org_id = org_id
        message = f"Insufficient credits: required ${required:.6f}, available ${available:.6f}"
        super().__init__(message, "INSUFFICIENT_CREDITS")


class RateLimitError(BillingError):
    """Raised when rate limit is exceeded."""
    def __init__(
        self,
        limit_type: str,
        current: int,
        limit: int,
        reset_at: Optional[datetime] = None
    ):
        self.limit_type = limit_type
        self.current = current
        self.limit = limit
        self.reset_at = reset_at
        message = f"Rate limit exceeded: {limit_type} {current}/{limit}"
        super().__init__(message, "RATE_LIMIT_EXCEEDED")


class TokenizationError(BillingError):
    """Raised when tokenization fails."""
    def __init__(self, message: str, model: Optional[str] = None):
        self.model = model
        super().__init__(message, "TOKENIZATION_ERROR")


class PricingNotFoundError(BillingError):
    """Raised when pricing for a model is not found."""
    def __init__(self, model: str, provider: str):
        self.model = model
        self.provider = provider
        message = f"Pricing not found for model {model} from provider {provider}"
        super().__init__(message, "PRICING_NOT_FOUND")


class IdempotencyViolationError(BillingError):
    """Raised when idempotency key is already used with different parameters."""
    def __init__(self, idempotency_key: str):
        self.idempotency_key = idempotency_key
        message = f"Idempotency key already used: {idempotency_key}"
        super().__init__(message, "IDEMPOTENCY_VIOLATION")
