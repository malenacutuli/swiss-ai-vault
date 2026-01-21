"""
Multi-Provider LLM Interface

Supports:
- Anthropic Claude (primary)
- OpenAI GPT-4 (fallback)
- Automatic retry with exponential backoff
- Token counting and cost tracking
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

from anthropic import Anthropic, APIError as AnthropicAPIError
from openai import AsyncOpenAI, APIError as OpenAIAPIError

from app.llm.models import (
    ModelInfo,
    get_model_info,
    get_fallback_model,
    calculate_cost,
    ANTHROPIC_MODELS,
    OPENAI_MODELS,
    MANUS_MODELS,
)
import httpx

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """Unified message format for all providers"""
    role: str  # "user", "assistant", "system"
    content: str
    name: Optional[str] = None


@dataclass
class ToolCall:
    """Tool call from LLM"""
    id: str
    name: str
    arguments: Dict[str, Any]


@dataclass
class LLMResponse:
    """Unified response format"""
    content: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: int
    stop_reason: Optional[str] = None
    tool_calls: List[ToolCall] = field(default_factory=list)
    raw_response: Optional[Any] = None


class LLMProvider:
    """
    Multi-provider LLM interface with automatic fallback.

    Features:
    - Primary/fallback provider support
    - Retry with exponential backoff
    - Unified message format
    - Token counting and cost tracking
    - Tool/function calling support
    """

    def __init__(
        self,
        anthropic_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        manus_api_key: Optional[str] = None,
        manus_api_url: Optional[str] = None,
        primary_provider: str = "anthropic",
        default_model: Optional[str] = None,
        fallback_enabled: bool = True,
        max_retries: int = 3,
        retry_base_delay: float = 1.0,
    ):
        self.primary_provider = primary_provider
        self.fallback_enabled = fallback_enabled
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay

        # Initialize Anthropic client
        self.anthropic = None
        if anthropic_api_key:
            self.anthropic = Anthropic(api_key=anthropic_api_key)
            logger.info("✓ Anthropic provider initialized")

        # Initialize OpenAI client
        self.openai = None
        if openai_api_key:
            self.openai = AsyncOpenAI(api_key=openai_api_key)
            logger.info("✓ OpenAI provider initialized")

        # Initialize Manus API client (fallback orchestrator)
        self.manus_api_key = manus_api_key
        self.manus_api_url = manus_api_url or "https://api.manus.im/v1"
        if manus_api_key:
            logger.info("✓ Manus API provider initialized (fallback orchestrator)")

        # Set default model
        if default_model:
            self.default_model = default_model
        elif primary_provider == "anthropic":
            self.default_model = "claude-sonnet-4-20250514"
        else:
            self.default_model = "gpt-4o"

        # Validate at least one provider is available
        if not self.anthropic and not self.openai:
            raise ValueError("At least one LLM provider must be configured")

    async def complete(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        system: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate a completion with automatic fallback.

        Args:
            messages: Conversation messages
            model: Model ID (uses default if not specified)
            system: System prompt
            max_tokens: Maximum output tokens
            temperature: Sampling temperature
            tools: Tool definitions for function calling
            tool_choice: Tool selection strategy

        Returns:
            LLMResponse with content and usage metrics
        """
        model = model or self.default_model
        model_info = get_model_info(model)

        if not model_info:
            logger.warning(f"Unknown model {model}, using default")
            model = self.default_model
            model_info = get_model_info(model)

        provider = model_info.provider

        # Try primary provider
        try:
            return await self._complete_with_retries(
                messages=messages,
                model=model,
                provider=provider,
                system=system,
                max_tokens=max_tokens,
                temperature=temperature,
                tools=tools,
                tool_choice=tool_choice,
            )
        except Exception as e:
            logger.warning(f"Primary provider {provider} failed: {e}")

            # Try fallback if enabled
            if self.fallback_enabled:
                fallback_model = get_fallback_model(model)
                if fallback_model:
                    fallback_info = get_model_info(fallback_model)
                    logger.info(f"Falling back to {fallback_model} ({fallback_info.provider})")

                    try:
                        return await self._complete_with_retries(
                            messages=messages,
                            model=fallback_model,
                            provider=fallback_info.provider,
                            system=system,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            tools=tools,
                            tool_choice=tool_choice,
                        )
                    except Exception as fallback_error:
                        logger.error(f"Fallback provider also failed: {fallback_error}")
                        raise

            raise

    async def _complete_with_retries(
        self,
        messages: List[LLMMessage],
        model: str,
        provider: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
        tools: Optional[List[Dict]],
        tool_choice: Optional[str],
    ) -> LLMResponse:
        """Execute completion with retry logic"""
        last_error = None

        for attempt in range(self.max_retries):
            try:
                if provider == "anthropic":
                    return await self._complete_anthropic(
                        messages, model, system, max_tokens, temperature, tools, tool_choice
                    )
                elif provider == "manus":
                    return await self._complete_manus(
                        messages, model, system, max_tokens, temperature, tools, tool_choice
                    )
                else:
                    return await self._complete_openai(
                        messages, model, system, max_tokens, temperature, tools, tool_choice
                    )

            except (AnthropicAPIError, OpenAIAPIError) as e:
                last_error = e

                # Check if retryable
                if hasattr(e, 'status_code'):
                    if e.status_code in [429, 500, 502, 503, 504]:
                        delay = self.retry_base_delay * (2 ** attempt)
                        logger.warning(f"Retry {attempt + 1}/{self.max_retries} after {delay}s: {e}")
                        await asyncio.sleep(delay)
                        continue

                # Non-retryable error
                raise

            except Exception as e:
                last_error = e
                delay = self.retry_base_delay * (2 ** attempt)
                logger.warning(f"Retry {attempt + 1}/{self.max_retries} after {delay}s: {e}")
                await asyncio.sleep(delay)

        raise last_error or Exception("Max retries exceeded")

    async def _complete_anthropic(
        self,
        messages: List[LLMMessage],
        model: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
        tools: Optional[List[Dict]],
        tool_choice: Optional[str],
    ) -> LLMResponse:
        """Execute Anthropic completion"""
        if not self.anthropic:
            raise ValueError("Anthropic client not initialized")

        start_time = time.time()

        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        # Build request kwargs
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": anthropic_messages,
        }

        if system:
            kwargs["system"] = system

        if tools:
            # Convert to Anthropic tool format
            kwargs["tools"] = self._convert_tools_to_anthropic(tools)
            if tool_choice:
                kwargs["tool_choice"] = {"type": tool_choice}

        # Execute request
        response = self.anthropic.messages.create(**kwargs)

        latency_ms = int((time.time() - start_time) * 1000)

        # Extract content
        content = ""
        tool_calls = []

        for block in response.content:
            if hasattr(block, 'text'):
                content = block.text
            elif hasattr(block, 'type') and block.type == "tool_use":
                tool_calls.append(ToolCall(
                    id=block.id,
                    name=block.name,
                    arguments=block.input,
                ))

        # Calculate cost
        cost = calculate_cost(
            model,
            response.usage.input_tokens,
            response.usage.output_tokens
        )

        return LLMResponse(
            content=content,
            model=model,
            provider="anthropic",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            stop_reason=response.stop_reason,
            tool_calls=tool_calls,
            raw_response=response,
        )

    async def _complete_openai(
        self,
        messages: List[LLMMessage],
        model: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
        tools: Optional[List[Dict]],
        tool_choice: Optional[str],
    ) -> LLMResponse:
        """Execute OpenAI completion"""
        if not self.openai:
            raise ValueError("OpenAI client not initialized")

        start_time = time.time()

        # Convert messages to OpenAI format
        openai_messages = []

        if system:
            openai_messages.append({"role": "system", "content": system})

        for msg in messages:
            openai_messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        # Build request kwargs
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": openai_messages,
        }

        if tools:
            kwargs["tools"] = self._convert_tools_to_openai(tools)
            if tool_choice:
                kwargs["tool_choice"] = tool_choice

        # Execute request
        response = await self.openai.chat.completions.create(**kwargs)

        latency_ms = int((time.time() - start_time) * 1000)

        # Extract content
        message = response.choices[0].message
        content = message.content or ""
        tool_calls = []

        if message.tool_calls:
            for tc in message.tool_calls:
                import json
                tool_calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                ))

        # Calculate cost
        cost = calculate_cost(
            model,
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        )

        return LLMResponse(
            content=content,
            model=model,
            provider="openai",
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            stop_reason=response.choices[0].finish_reason,
            tool_calls=tool_calls,
            raw_response=response,
        )

    def _convert_tools_to_anthropic(self, tools: List[Dict]) -> List[Dict]:
        """Convert generic tool definitions to Anthropic format"""
        anthropic_tools = []
        for tool in tools:
            anthropic_tools.append({
                "name": tool.get("name"),
                "description": tool.get("description"),
                "input_schema": tool.get("parameters", tool.get("input_schema", {})),
            })
        return anthropic_tools

    def _convert_tools_to_openai(self, tools: List[Dict]) -> List[Dict]:
        """Convert generic tool definitions to OpenAI format"""
        openai_tools = []
        for tool in tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name"),
                    "description": tool.get("description"),
                    "parameters": tool.get("parameters", tool.get("input_schema", {})),
                },
            })
        return openai_tools

    async def _complete_manus(
        self,
        messages: List[LLMMessage],
        model: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
        tools: Optional[List[Dict]],
        tool_choice: Optional[str],
    ) -> LLMResponse:
        """
        Execute Manus API completion (fallback orchestrator).
        
        Manus API uses OpenAI-compatible format.
        """
        if not self.manus_api_key:
            raise ValueError("Manus API key not configured")

        start_time = time.time()

        # Convert messages to OpenAI-compatible format
        manus_messages = []
        if system:
            manus_messages.append({"role": "system", "content": system})
        for msg in messages:
            manus_messages.append({"role": msg.role, "content": msg.content})

        # Build request payload
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": manus_messages,
        }

        if tools:
            payload["tools"] = self._convert_tools_to_openai(tools)
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Execute request to Manus API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.manus_api_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.manus_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()

        latency_ms = int((time.time() - start_time) * 1000)

        # Extract content
        message = data["choices"][0]["message"]
        content = message.get("content", "")
        tool_calls = []

        if message.get("tool_calls"):
            import json
            for tc in message["tool_calls"]:
                tool_calls.append(ToolCall(
                    id=tc["id"],
                    name=tc["function"]["name"],
                    arguments=json.loads(tc["function"]["arguments"]),
                ))

        # Calculate cost
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        cost = calculate_cost(model, input_tokens, output_tokens)

        return LLMResponse(
            content=content,
            model=model,
            provider="manus",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            stop_reason=data["choices"][0].get("finish_reason"),
            tool_calls=tool_calls,
            raw_response=data,
        )

    async def stream_complete(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        system: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion token by token.

        Yields:
            Individual tokens as they're generated
        """
        model = model or self.default_model
        model_info = get_model_info(model)

        if not model_info:
            model = self.default_model
            model_info = get_model_info(model)

        if model_info.provider == "anthropic":
            async for token in self._stream_anthropic(messages, model, system, max_tokens, temperature):
                yield token
        else:
            async for token in self._stream_openai(messages, model, system, max_tokens, temperature):
                yield token

    async def _stream_anthropic(
        self,
        messages: List[LLMMessage],
        model: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
    ) -> AsyncGenerator[str, None]:
        """Stream from Anthropic"""
        if not self.anthropic:
            raise ValueError("Anthropic client not initialized")

        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": anthropic_messages,
        }

        if system:
            kwargs["system"] = system

        with self.anthropic.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text

    async def _stream_openai(
        self,
        messages: List[LLMMessage],
        model: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
    ) -> AsyncGenerator[str, None]:
        """Stream from OpenAI"""
        if not self.openai:
            raise ValueError("OpenAI client not initialized")

        openai_messages = []

        if system:
            openai_messages.append({"role": "system", "content": system})

        for msg in messages:
            openai_messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        stream = await self.openai.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=openai_messages,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


def create_llm_provider(
    anthropic_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    manus_api_key: Optional[str] = None,
    manus_api_url: Optional[str] = None,
    primary_provider: str = "anthropic",
    default_model: Optional[str] = None,
    fallback_enabled: bool = True,
) -> LLMProvider:
    """Factory function to create LLM provider with settings"""
    return LLMProvider(
        anthropic_api_key=anthropic_api_key,
        openai_api_key=openai_api_key,
        manus_api_key=manus_api_key,
        manus_api_url=manus_api_url,
        primary_provider=primary_provider,
        default_model=default_model,
        fallback_enabled=fallback_enabled,
    )
