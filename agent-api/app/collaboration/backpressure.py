"""
Backpressure Calculator for Collaboration Gateway

Calculates system backpressure using weighted metrics:
- WebSocket connections (30%)
- Redis channels (25%)
- OT queue depth (25%)
- Memory usage (20%)

The resulting backpressure value (0.0-1.0) is used by the circuit
breaker to decide when to activate/deactivate protection.
"""

from __future__ import annotations

import asyncio
import logging
import os
import psutil
from typing import Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class BackpressureWeights:
    """Weights for backpressure calculation."""
    ws_connections: float = 0.30
    redis_channels: float = 0.25
    ot_queue_depth: float = 0.25
    memory_usage: float = 0.20

    def validate(self) -> bool:
        """Validate that weights sum to 1.0."""
        total = (
            self.ws_connections +
            self.redis_channels +
            self.ot_queue_depth +
            self.memory_usage
        )
        return abs(total - 1.0) < 0.001


@dataclass
class BackpressureLimits:
    """Capacity limits for backpressure calculation."""
    max_ws_connections: int = 10000
    max_redis_channels: int = 1000
    ot_queue_capacity: int = 10000
    memory_limit_mb: int = 4096


@dataclass
class BackpressureMetrics:
    """Current metrics for backpressure calculation."""
    ws_connections: int = 0
    redis_channels: int = 0
    ot_queue_depth: int = 0
    memory_used_mb: float = 0.0

    # Component ratios (calculated)
    ws_ratio: float = 0.0
    redis_ratio: float = 0.0
    ot_ratio: float = 0.0
    memory_ratio: float = 0.0

    # Final backpressure
    backpressure: float = 0.0

    # Timestamp
    timestamp: Optional[datetime] = None


class BackpressureCalculator:
    """
    Calculator for system backpressure.

    Uses weighted combination of multiple metrics to determine
    overall system load. The result is a value between 0.0 and 1.0
    where higher values indicate more stress on the system.

    Formula:
        backpressure = (
            0.30 * (ws_connections / max_ws_connections) +
            0.25 * (redis_channels / max_redis_channels) +
            0.25 * (ot_queue_depth / ot_queue_capacity) +
            0.20 * (memory_used / memory_limit)
        )
    """

    def __init__(
        self,
        weights: Optional[BackpressureWeights] = None,
        limits: Optional[BackpressureLimits] = None,
    ):
        """
        Initialize backpressure calculator.

        Args:
            weights: Custom weights for each metric
            limits: Custom capacity limits
        """
        self.weights = weights or BackpressureWeights()
        self.limits = limits or BackpressureLimits()

        # Validate weights
        if not self.weights.validate():
            logger.warning("Backpressure weights do not sum to 1.0")

        # Current metric values
        self._ws_connections = 0
        self._redis_channels = 0
        self._ot_queue_depth = 0

        # Metric providers (optional callbacks)
        self._ws_provider: Optional[Callable[[], int]] = None
        self._redis_provider: Optional[Callable[[], int]] = None
        self._ot_provider: Optional[Callable[[], int]] = None
        self._memory_provider: Optional[Callable[[], float]] = None

        # Caching
        self._last_metrics: Optional[BackpressureMetrics] = None
        self._cache_ttl = 0.5  # seconds
        self._last_calculation = 0.0

    def set_ws_provider(self, provider: Callable[[], int]) -> None:
        """Set WebSocket connection count provider."""
        self._ws_provider = provider

    def set_redis_provider(self, provider: Callable[[], int]) -> None:
        """Set Redis channel count provider."""
        self._redis_provider = provider

    def set_ot_provider(self, provider: Callable[[], int]) -> None:
        """Set OT queue depth provider."""
        self._ot_provider = provider

    def set_memory_provider(self, provider: Callable[[], float]) -> None:
        """Set memory usage provider (returns MB)."""
        self._memory_provider = provider

    def set_ws_connections(self, count: int) -> None:
        """Directly set WebSocket connection count."""
        self._ws_connections = max(0, count)

    def set_redis_channels(self, count: int) -> None:
        """Directly set Redis channel count."""
        self._redis_channels = max(0, count)

    def set_ot_queue_depth(self, depth: int) -> None:
        """Directly set OT queue depth."""
        self._ot_queue_depth = max(0, depth)

    def _get_ws_connections(self) -> int:
        """Get current WebSocket connection count."""
        if self._ws_provider:
            return self._ws_provider()
        return self._ws_connections

    def _get_redis_channels(self) -> int:
        """Get current Redis channel count."""
        if self._redis_provider:
            return self._redis_provider()
        return self._redis_channels

    def _get_ot_queue_depth(self) -> int:
        """Get current OT queue depth."""
        if self._ot_provider:
            return self._ot_provider()
        return self._ot_queue_depth

    def _get_memory_mb(self) -> float:
        """Get current memory usage in MB."""
        if self._memory_provider:
            return self._memory_provider()

        # Default: use process memory
        try:
            process = psutil.Process(os.getpid())
            return process.memory_info().rss / (1024 * 1024)
        except Exception:
            return 0.0

    def calculate(self) -> float:
        """
        Calculate current backpressure.

        Returns:
            Backpressure value between 0.0 and 1.0
        """
        # Get current metrics
        ws_count = self._get_ws_connections()
        redis_count = self._get_redis_channels()
        ot_depth = self._get_ot_queue_depth()
        memory_mb = self._get_memory_mb()

        # Calculate ratios (capped at 1.0)
        ws_ratio = min(1.0, ws_count / max(1, self.limits.max_ws_connections))
        redis_ratio = min(1.0, redis_count / max(1, self.limits.max_redis_channels))
        ot_ratio = min(1.0, ot_depth / max(1, self.limits.ot_queue_capacity))
        memory_ratio = min(1.0, memory_mb / max(1, self.limits.memory_limit_mb))

        # Calculate weighted backpressure
        backpressure = (
            self.weights.ws_connections * ws_ratio +
            self.weights.redis_channels * redis_ratio +
            self.weights.ot_queue_depth * ot_ratio +
            self.weights.memory_usage * memory_ratio
        )

        # Store metrics
        self._last_metrics = BackpressureMetrics(
            ws_connections=ws_count,
            redis_channels=redis_count,
            ot_queue_depth=ot_depth,
            memory_used_mb=memory_mb,
            ws_ratio=ws_ratio,
            redis_ratio=redis_ratio,
            ot_ratio=ot_ratio,
            memory_ratio=memory_ratio,
            backpressure=backpressure,
            timestamp=datetime.utcnow(),
        )

        return backpressure

    def get_metrics(self) -> BackpressureMetrics:
        """
        Get detailed backpressure metrics.

        Returns:
            BackpressureMetrics with all component values
        """
        # Ensure we have recent metrics
        if self._last_metrics is None:
            self.calculate()

        return self._last_metrics

    def get_metrics_dict(self) -> dict:
        """Get metrics as a dictionary."""
        metrics = self.get_metrics()
        return {
            "backpressure": round(metrics.backpressure, 4),
            "components": {
                "ws_connections": {
                    "current": metrics.ws_connections,
                    "limit": self.limits.max_ws_connections,
                    "ratio": round(metrics.ws_ratio, 4),
                    "weight": self.weights.ws_connections,
                    "contribution": round(
                        metrics.ws_ratio * self.weights.ws_connections, 4
                    ),
                },
                "redis_channels": {
                    "current": metrics.redis_channels,
                    "limit": self.limits.max_redis_channels,
                    "ratio": round(metrics.redis_ratio, 4),
                    "weight": self.weights.redis_channels,
                    "contribution": round(
                        metrics.redis_ratio * self.weights.redis_channels, 4
                    ),
                },
                "ot_queue_depth": {
                    "current": metrics.ot_queue_depth,
                    "limit": self.limits.ot_queue_capacity,
                    "ratio": round(metrics.ot_ratio, 4),
                    "weight": self.weights.ot_queue_depth,
                    "contribution": round(
                        metrics.ot_ratio * self.weights.ot_queue_depth, 4
                    ),
                },
                "memory_usage": {
                    "current_mb": round(metrics.memory_used_mb, 2),
                    "limit_mb": self.limits.memory_limit_mb,
                    "ratio": round(metrics.memory_ratio, 4),
                    "weight": self.weights.memory_usage,
                    "contribution": round(
                        metrics.memory_ratio * self.weights.memory_usage, 4
                    ),
                },
            },
            "timestamp": (
                metrics.timestamp.isoformat()
                if metrics.timestamp else None
            ),
        }


class AdaptiveBackpressure(BackpressureCalculator):
    """
    Adaptive backpressure calculator with dynamic weight adjustment.

    Automatically adjusts weights based on which metrics are
    causing the most pressure, allowing the system to be more
    responsive to specific bottlenecks.
    """

    def __init__(
        self,
        weights: Optional[BackpressureWeights] = None,
        limits: Optional[BackpressureLimits] = None,
        adaptation_rate: float = 0.1,
    ):
        """
        Initialize adaptive backpressure calculator.

        Args:
            weights: Initial weights
            limits: Capacity limits
            adaptation_rate: How quickly to adapt weights (0.0-1.0)
        """
        super().__init__(weights, limits)
        self.adaptation_rate = adaptation_rate
        self._base_weights = BackpressureWeights(
            ws_connections=self.weights.ws_connections,
            redis_channels=self.weights.redis_channels,
            ot_queue_depth=self.weights.ot_queue_depth,
            memory_usage=self.weights.memory_usage,
        )

    def calculate(self) -> float:
        """Calculate backpressure with adaptive weights."""
        # First calculate with current weights
        backpressure = super().calculate()

        # Adapt weights based on which metrics are high
        if self._last_metrics:
            self._adapt_weights()

        return backpressure

    def _adapt_weights(self) -> None:
        """Adapt weights based on current metric ratios."""
        metrics = self._last_metrics
        if not metrics:
            return

        # Find the dominant metric
        ratios = [
            ("ws", metrics.ws_ratio),
            ("redis", metrics.redis_ratio),
            ("ot", metrics.ot_ratio),
            ("memory", metrics.memory_ratio),
        ]

        # Sort by ratio to find highest pressure points
        ratios.sort(key=lambda x: x[1], reverse=True)

        # Only adapt if there's significant difference
        if ratios[0][1] - ratios[-1][1] < 0.2:
            return

        # Increase weight for high-pressure metrics
        for name, ratio in ratios:
            if ratio > 0.8:  # High pressure
                self._adjust_weight(name, self.adaptation_rate)
            elif ratio < 0.3:  # Low pressure
                self._adjust_weight(name, -self.adaptation_rate / 2)

        # Normalize weights to sum to 1.0
        self._normalize_weights()

    def _adjust_weight(self, metric: str, delta: float) -> None:
        """Adjust a specific weight."""
        if metric == "ws":
            self.weights.ws_connections = max(0.1, min(0.5,
                self.weights.ws_connections + delta
            ))
        elif metric == "redis":
            self.weights.redis_channels = max(0.1, min(0.5,
                self.weights.redis_channels + delta
            ))
        elif metric == "ot":
            self.weights.ot_queue_depth = max(0.1, min(0.5,
                self.weights.ot_queue_depth + delta
            ))
        elif metric == "memory":
            self.weights.memory_usage = max(0.1, min(0.5,
                self.weights.memory_usage + delta
            ))

    def _normalize_weights(self) -> None:
        """Normalize weights to sum to 1.0."""
        total = (
            self.weights.ws_connections +
            self.weights.redis_channels +
            self.weights.ot_queue_depth +
            self.weights.memory_usage
        )

        if total > 0:
            self.weights.ws_connections /= total
            self.weights.redis_channels /= total
            self.weights.ot_queue_depth /= total
            self.weights.memory_usage /= total

    def reset_weights(self) -> None:
        """Reset weights to base values."""
        self.weights = BackpressureWeights(
            ws_connections=self._base_weights.ws_connections,
            redis_channels=self._base_weights.redis_channels,
            ot_queue_depth=self._base_weights.ot_queue_depth,
            memory_usage=self._base_weights.memory_usage,
        )
