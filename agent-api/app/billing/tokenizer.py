"""
Multi-Provider Tokenizer

Implements token counting for different LLM providers:
- OpenAI/GPT models: tiktoken
- Anthropic/Claude models: tiktoken (cl100k_base approximation)
- Google/Gemini models: Character-based estimation

Token counts are used for:
1. Pre-call estimation (for budget checks)
2. Post-call verification (from API response)
3. Cost calculation
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional, Union

from app.billing.types import Provider, TokenCount, TokenizationError

logger = logging.getLogger(__name__)

# Attempt to import tiktoken (optional dependency)
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not installed, falling back to character-based estimation")


# Model to encoding mapping
MODEL_ENCODINGS = {
    # OpenAI GPT-4 series
    "gpt-4o": "o200k_base",
    "gpt-4o-mini": "o200k_base",
    "gpt-4-turbo": "cl100k_base",
    "gpt-4-turbo-preview": "cl100k_base",
    "gpt-4": "cl100k_base",
    "gpt-4-32k": "cl100k_base",

    # OpenAI GPT-3.5 series
    "gpt-3.5-turbo": "cl100k_base",
    "gpt-3.5-turbo-16k": "cl100k_base",

    # Anthropic Claude series (use cl100k_base as approximation)
    "claude-3-5-sonnet-20241022": "cl100k_base",
    "claude-3-5-haiku-20241022": "cl100k_base",
    "claude-3-opus-20240229": "cl100k_base",
    "claude-3-sonnet-20240229": "cl100k_base",
    "claude-3-haiku-20240307": "cl100k_base",
    "claude-opus-4-5-20251101": "cl100k_base",

    # Default fallback
    "default": "cl100k_base",
}

# Characters per token ratio for estimation fallback
CHARS_PER_TOKEN = {
    Provider.OPENAI: 4.0,
    Provider.ANTHROPIC: 3.5,  # Claude tends to be slightly more efficient
    Provider.GOOGLE: 4.0,
    Provider.AZURE: 4.0,
    Provider.LOCAL: 4.0,
}


class MultiProviderTokenizer:
    """
    Multi-provider tokenizer for accurate token counting.

    Supports:
    - OpenAI models via tiktoken
    - Anthropic models via tiktoken (cl100k_base approximation)
    - Google models via character estimation
    - Fallback character-based estimation when tiktoken unavailable
    """

    def __init__(self):
        self._encodings: dict[str, any] = {}

    @lru_cache(maxsize=16)
    def _get_encoding(self, model: str) -> Optional[any]:
        """Get tiktoken encoding for a model."""
        if not TIKTOKEN_AVAILABLE:
            return None

        encoding_name = MODEL_ENCODINGS.get(model, MODEL_ENCODINGS["default"])

        try:
            return tiktoken.get_encoding(encoding_name)
        except Exception as e:
            logger.warning(f"Failed to get encoding {encoding_name} for {model}: {e}")
            try:
                return tiktoken.get_encoding("cl100k_base")
            except Exception:
                return None

    def count_tokens(
        self,
        text: str,
        model: str,
        provider: Provider = Provider.OPENAI,
    ) -> int:
        """
        Count tokens in text.

        Args:
            text: Text to tokenize
            model: Model name
            provider: LLM provider

        Returns:
            Token count
        """
        if not text:
            return 0

        # Try tiktoken first
        encoding = self._get_encoding(model)
        if encoding is not None:
            try:
                return len(encoding.encode(text))
            except Exception as e:
                logger.warning(f"tiktoken encoding failed for {model}: {e}")

        # Fallback to character-based estimation
        chars_per_token = CHARS_PER_TOKEN.get(provider, 4.0)
        return max(1, int(len(text) / chars_per_token))

    def count_messages(
        self,
        messages: list[dict],
        model: str,
        provider: Provider = Provider.OPENAI,
    ) -> int:
        """
        Count tokens in a list of chat messages.

        Accounts for message overhead (role tokens, separators).

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name
            provider: LLM provider

        Returns:
            Total token count including overhead
        """
        if not messages:
            return 0

        total_tokens = 0

        # Per-message overhead varies by model
        # GPT-4: ~4 tokens per message (role, separators)
        # Claude: ~3 tokens per message
        if provider == Provider.ANTHROPIC:
            tokens_per_message = 3
        else:
            tokens_per_message = 4

        for message in messages:
            total_tokens += tokens_per_message

            # Count role
            role = message.get("role", "")
            total_tokens += self.count_tokens(role, model, provider)

            # Count content
            content = message.get("content", "")
            if isinstance(content, str):
                total_tokens += self.count_tokens(content, model, provider)
            elif isinstance(content, list):
                # Multi-modal content (text + images)
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        total_tokens += self.count_tokens(
                            part.get("text", ""), model, provider
                        )
                    elif isinstance(part, dict) and part.get("type") == "image_url":
                        # Image tokens vary by size, use estimate
                        total_tokens += 85  # Base image token cost

            # Count name if present
            if "name" in message:
                total_tokens += self.count_tokens(message["name"], model, provider)
                total_tokens += 1  # Separator

        # Add reply priming tokens
        total_tokens += 3

        return total_tokens

    def estimate_output_tokens(
        self,
        input_tokens: int,
        max_tokens: Optional[int] = None,
        typical_ratio: float = 0.5,
    ) -> int:
        """
        Estimate output tokens based on input.

        Used for pre-call budget estimation.

        Args:
            input_tokens: Number of input tokens
            max_tokens: Max tokens limit (if set)
            typical_ratio: Typical output/input ratio

        Returns:
            Estimated output tokens
        """
        # If max_tokens is set, use that as upper bound
        if max_tokens is not None:
            return min(max_tokens, int(input_tokens * typical_ratio))

        # Default estimation based on typical response patterns
        return int(input_tokens * typical_ratio)

    def create_token_count(
        self,
        input_text: Union[str, list[dict]],
        output_text: str,
        model: str,
        provider: Provider = Provider.OPENAI,
        is_estimated: bool = False,
    ) -> TokenCount:
        """
        Create a TokenCount from input and output text.

        Args:
            input_text: Input text or messages
            output_text: Output text
            model: Model name
            provider: LLM provider
            is_estimated: Whether counts are estimated

        Returns:
            TokenCount object
        """
        # Count input tokens
        if isinstance(input_text, list):
            input_tokens = self.count_messages(input_text, model, provider)
        else:
            input_tokens = self.count_tokens(input_text, model, provider)

        # Count output tokens
        output_tokens = self.count_tokens(output_text, model, provider)

        return TokenCount(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            provider=provider,
            is_estimated=is_estimated,
            estimation_method="tiktoken" if TIKTOKEN_AVAILABLE else "character_ratio",
        )

    def estimate_call(
        self,
        input_text: Union[str, list[dict]],
        model: str,
        provider: Provider = Provider.OPENAI,
        max_tokens: Optional[int] = None,
    ) -> TokenCount:
        """
        Estimate tokens for a planned API call.

        Used for pre-call budget checks.

        Args:
            input_text: Input text or messages
            model: Model name
            provider: LLM provider
            max_tokens: Max tokens limit

        Returns:
            Estimated TokenCount
        """
        # Count input tokens
        if isinstance(input_text, list):
            input_tokens = self.count_messages(input_text, model, provider)
        else:
            input_tokens = self.count_tokens(input_text, model, provider)

        # Estimate output tokens
        output_tokens = self.estimate_output_tokens(input_tokens, max_tokens)

        return TokenCount(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            provider=provider,
            is_estimated=True,
            estimation_method="pre_call_estimate",
        )


# Singleton instance
_tokenizer: Optional[MultiProviderTokenizer] = None


def get_tokenizer() -> MultiProviderTokenizer:
    """Get singleton tokenizer instance."""
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = MultiProviderTokenizer()
    return _tokenizer


def count_tokens(
    text: str,
    model: str = "gpt-4o",
    provider: Provider = Provider.OPENAI,
) -> int:
    """Convenience function to count tokens."""
    return get_tokenizer().count_tokens(text, model, provider)


def count_messages(
    messages: list[dict],
    model: str = "gpt-4o",
    provider: Provider = Provider.OPENAI,
) -> int:
    """Convenience function to count message tokens."""
    return get_tokenizer().count_messages(messages, model, provider)
