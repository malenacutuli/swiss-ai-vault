"""
Billing Module for Token Counting and Credit Management

Implements:
- Multi-provider token counting (tiktoken, Google, etc.)
- Token caching (Memory → Redis → DB)
- Billing ledger with idempotent record_token_call()
- Credit deduction with rollback support
- Billing failure → read-only mode
"""

from app.billing.types import (
    TokenCount,
    TokenRecord,
    BillingResult,
    CreditBalance,
    ModelPricing,
    BillingError,
    InsufficientCreditsError,
    RateLimitError,
)
from app.billing.tokenizer import MultiProviderTokenizer
from app.billing.token_counter import TokenCounter
from app.billing.ledger import BillingLedger
from app.billing.billing import BillingService

__all__ = [
    # Types
    "TokenCount",
    "TokenRecord",
    "BillingResult",
    "CreditBalance",
    "ModelPricing",
    "BillingError",
    "InsufficientCreditsError",
    "RateLimitError",
    # Services
    "MultiProviderTokenizer",
    "TokenCounter",
    "BillingLedger",
    "BillingService",
]
