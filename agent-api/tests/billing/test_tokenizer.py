"""Tests for multi-provider tokenizer."""

import pytest
from app.billing.tokenizer import (
    MultiProviderTokenizer,
    get_tokenizer,
    count_tokens,
    count_messages,
    TIKTOKEN_AVAILABLE,
)
from app.billing.types import Provider, TokenCount


class TestMultiProviderTokenizer:
    """Tests for MultiProviderTokenizer."""

    @pytest.fixture
    def tokenizer(self):
        """Create tokenizer instance."""
        return MultiProviderTokenizer()

    def test_count_tokens_empty_string(self, tokenizer):
        """Empty string returns 0 tokens."""
        assert tokenizer.count_tokens("", "gpt-4o") == 0

    def test_count_tokens_simple_text(self, tokenizer):
        """Simple text is tokenized."""
        tokens = tokenizer.count_tokens("Hello, world!", "gpt-4o")
        assert tokens > 0
        assert tokens < 10  # Reasonable for short text

    def test_count_tokens_different_models(self, tokenizer):
        """Different models may have different token counts."""
        text = "The quick brown fox jumps over the lazy dog."
        gpt4_tokens = tokenizer.count_tokens(text, "gpt-4o", Provider.OPENAI)
        claude_tokens = tokenizer.count_tokens(text, "claude-3-5-sonnet-20241022", Provider.ANTHROPIC)
        # Both should tokenize successfully
        assert gpt4_tokens > 0
        assert claude_tokens > 0

    def test_count_tokens_long_text(self, tokenizer):
        """Long text is tokenized correctly."""
        text = "This is a test. " * 100
        tokens = tokenizer.count_tokens(text, "gpt-4o")
        assert tokens > 100  # Should be many tokens

    def test_count_messages_empty_list(self, tokenizer):
        """Empty message list returns 0 tokens."""
        assert tokenizer.count_messages([], "gpt-4o") == 0

    def test_count_messages_single_message(self, tokenizer):
        """Single message is tokenized with overhead."""
        messages = [{"role": "user", "content": "Hello"}]
        tokens = tokenizer.count_messages(messages, "gpt-4o")
        # Should include message overhead
        assert tokens > tokenizer.count_tokens("Hello", "gpt-4o")

    def test_count_messages_conversation(self, tokenizer):
        """Conversation is tokenized."""
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is the capital of France?"},
            {"role": "assistant", "content": "Paris"},
            {"role": "user", "content": "Thanks!"},
        ]
        tokens = tokenizer.count_messages(messages, "gpt-4o")
        assert tokens > 20  # Should be reasonable for this conversation

    def test_estimate_output_tokens_no_max(self, tokenizer):
        """Output estimation without max_tokens."""
        estimated = tokenizer.estimate_output_tokens(100)
        assert estimated == 50  # Default 0.5 ratio

    def test_estimate_output_tokens_with_max(self, tokenizer):
        """Output estimation respects max_tokens."""
        estimated = tokenizer.estimate_output_tokens(100, max_tokens=20)
        assert estimated == 20  # Capped at max_tokens

    def test_estimate_output_tokens_custom_ratio(self, tokenizer):
        """Output estimation with custom ratio."""
        estimated = tokenizer.estimate_output_tokens(100, typical_ratio=1.0)
        assert estimated == 100

    def test_create_token_count_from_text(self, tokenizer):
        """Create TokenCount from text."""
        token_count = tokenizer.create_token_count(
            input_text="Hello, how are you?",
            output_text="I'm doing well, thank you!",
            model="gpt-4o",
            provider=Provider.OPENAI,
        )
        assert isinstance(token_count, TokenCount)
        assert token_count.input_tokens > 0
        assert token_count.output_tokens > 0
        assert token_count.total_tokens == token_count.input_tokens + token_count.output_tokens
        assert token_count.model == "gpt-4o"
        assert token_count.provider == Provider.OPENAI

    def test_create_token_count_from_messages(self, tokenizer):
        """Create TokenCount from messages."""
        messages = [
            {"role": "user", "content": "Hello"},
        ]
        token_count = tokenizer.create_token_count(
            input_text=messages,
            output_text="Hi there!",
            model="gpt-4o",
        )
        assert token_count.input_tokens > 0
        assert token_count.output_tokens > 0

    def test_estimate_call(self, tokenizer):
        """Estimate call returns estimated TokenCount."""
        token_count = tokenizer.estimate_call(
            input_text="What is machine learning?",
            model="gpt-4o",
            max_tokens=100,
        )
        assert token_count.is_estimated is True
        assert token_count.estimation_method == "pre_call_estimate"
        assert token_count.output_tokens <= 100  # Respects max_tokens


class TestTokenizerSingleton:
    """Tests for tokenizer singleton."""

    def test_get_tokenizer_returns_instance(self):
        """get_tokenizer returns MultiProviderTokenizer."""
        tokenizer = get_tokenizer()
        assert isinstance(tokenizer, MultiProviderTokenizer)

    def test_get_tokenizer_returns_same_instance(self):
        """get_tokenizer returns same instance."""
        t1 = get_tokenizer()
        t2 = get_tokenizer()
        assert t1 is t2


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_count_tokens_function(self):
        """count_tokens convenience function works."""
        tokens = count_tokens("Hello, world!")
        assert tokens > 0

    def test_count_messages_function(self):
        """count_messages convenience function works."""
        messages = [{"role": "user", "content": "Hello"}]
        tokens = count_messages(messages)
        assert tokens > 0
