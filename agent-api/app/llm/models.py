"""LLM Model definitions and pricing information"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class ModelInfo:
    """Model configuration and pricing"""
    id: str
    provider: str
    context_window: int
    max_output_tokens: int
    input_price_per_1k: float  # USD per 1000 tokens
    output_price_per_1k: float  # USD per 1000 tokens
    supports_vision: bool = False
    supports_tools: bool = True
    supports_streaming: bool = True


# Anthropic Models (as of Jan 2026)
ANTHROPIC_MODELS: Dict[str, ModelInfo] = {
    "claude-sonnet-4-20250514": ModelInfo(
        id="claude-sonnet-4-20250514",
        provider="anthropic",
        context_window=200000,
        max_output_tokens=8192,
        input_price_per_1k=0.003,
        output_price_per_1k=0.015,
        supports_vision=True,
        supports_tools=True,
    ),
    "claude-opus-4-20250514": ModelInfo(
        id="claude-opus-4-20250514",
        provider="anthropic",
        context_window=200000,
        max_output_tokens=8192,
        input_price_per_1k=0.015,
        output_price_per_1k=0.075,
        supports_vision=True,
        supports_tools=True,
    ),
    "claude-3-5-sonnet-20241022": ModelInfo(
        id="claude-3-5-sonnet-20241022",
        provider="anthropic",
        context_window=200000,
        max_output_tokens=8192,
        input_price_per_1k=0.003,
        output_price_per_1k=0.015,
        supports_vision=True,
        supports_tools=True,
    ),
    "claude-3-haiku-20240307": ModelInfo(
        id="claude-3-haiku-20240307",
        provider="anthropic",
        context_window=200000,
        max_output_tokens=4096,
        input_price_per_1k=0.00025,
        output_price_per_1k=0.00125,
        supports_vision=True,
        supports_tools=True,
    ),
}

# OpenAI Models (as of Jan 2026)
OPENAI_MODELS: Dict[str, ModelInfo] = {
    "gpt-4-turbo": ModelInfo(
        id="gpt-4-turbo",
        provider="openai",
        context_window=128000,
        max_output_tokens=4096,
        input_price_per_1k=0.01,
        output_price_per_1k=0.03,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-4o": ModelInfo(
        id="gpt-4o",
        provider="openai",
        context_window=128000,
        max_output_tokens=4096,
        input_price_per_1k=0.005,
        output_price_per_1k=0.015,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-4o-mini": ModelInfo(
        id="gpt-4o-mini",
        provider="openai",
        context_window=128000,
        max_output_tokens=16384,
        input_price_per_1k=0.00015,
        output_price_per_1k=0.0006,
        supports_vision=True,
        supports_tools=True,
    ),
    "gpt-3.5-turbo": ModelInfo(
        id="gpt-3.5-turbo",
        provider="openai",
        context_window=16385,
        max_output_tokens=4096,
        input_price_per_1k=0.0005,
        output_price_per_1k=0.0015,
        supports_vision=False,
        supports_tools=True,
    ),
}

# Combined model registry
ALL_MODELS: Dict[str, ModelInfo] = {**ANTHROPIC_MODELS, **OPENAI_MODELS}


def get_model_info(model_id: str) -> Optional[ModelInfo]:
    """Get model info by ID"""
    return ALL_MODELS.get(model_id)


def calculate_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD for a completion"""
    model = get_model_info(model_id)
    if not model:
        return 0.0

    input_cost = (input_tokens / 1000) * model.input_price_per_1k
    output_cost = (output_tokens / 1000) * model.output_price_per_1k
    return input_cost + output_cost


def get_fallback_model(model_id: str) -> Optional[str]:
    """Get fallback model for a given model"""
    # Anthropic to OpenAI fallbacks
    anthropic_to_openai = {
        "claude-sonnet-4-20250514": "gpt-4o",
        "claude-opus-4-20250514": "gpt-4-turbo",
        "claude-3-5-sonnet-20241022": "gpt-4o",
        "claude-3-haiku-20240307": "gpt-4o-mini",
    }

    # OpenAI to Anthropic fallbacks
    openai_to_anthropic = {
        "gpt-4-turbo": "claude-sonnet-4-20250514",
        "gpt-4o": "claude-sonnet-4-20250514",
        "gpt-4o-mini": "claude-3-haiku-20240307",
        "gpt-3.5-turbo": "claude-3-haiku-20240307",
    }

    model = get_model_info(model_id)
    if not model:
        return None

    if model.provider == "anthropic":
        return anthropic_to_openai.get(model_id)
    else:
        return openai_to_anthropic.get(model_id)
