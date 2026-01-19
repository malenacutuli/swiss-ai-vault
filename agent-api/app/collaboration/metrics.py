"""
Metrics Collection for Collaboration Gateway

Collects and exposes metrics for:
- Connection statistics
- Operation throughput
- Latency measurements
- Error rates
- Resource utilization

Compatible with Prometheus-style metrics export.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import deque

import logging

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricLabels:
    """Labels for a metric."""
    labels: dict[str, str] = field(default_factory=dict)

    def __hash__(self):
        return hash(tuple(sorted(self.labels.items())))

    def __eq__(self, other):
        if not isinstance(other, MetricLabels):
            return False
        return self.labels == other.labels

    def to_prometheus(self) -> str:
        """Convert to Prometheus label format."""
        if not self.labels:
            return ""
        pairs = [f'{k}="{v}"' for k, v in sorted(self.labels.items())]
        return "{" + ",".join(pairs) + "}"


class Counter:
    """A monotonically increasing counter."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self._values: dict[MetricLabels, float] = {}
        self._lock = asyncio.Lock()

    async def inc(self, value: float = 1.0, **labels) -> None:
        """Increment counter."""
        label_key = MetricLabels(labels)
        async with self._lock:
            current = self._values.get(label_key, 0.0)
            self._values[label_key] = current + value

    def get(self, **labels) -> float:
        """Get current value."""
        label_key = MetricLabels(labels)
        return self._values.get(label_key, 0.0)

    def get_all(self) -> dict[MetricLabels, float]:
        """Get all values with labels."""
        return self._values.copy()

    async def reset(self) -> None:
        """Reset all values."""
        async with self._lock:
            self._values.clear()


class Gauge:
    """A value that can go up and down."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self._values: dict[MetricLabels, float] = {}
        self._lock = asyncio.Lock()

    async def set(self, value: float, **labels) -> None:
        """Set gauge value."""
        label_key = MetricLabels(labels)
        async with self._lock:
            self._values[label_key] = value

    async def inc(self, value: float = 1.0, **labels) -> None:
        """Increment gauge."""
        label_key = MetricLabels(labels)
        async with self._lock:
            current = self._values.get(label_key, 0.0)
            self._values[label_key] = current + value

    async def dec(self, value: float = 1.0, **labels) -> None:
        """Decrement gauge."""
        await self.inc(-value, **labels)

    def get(self, **labels) -> float:
        """Get current value."""
        label_key = MetricLabels(labels)
        return self._values.get(label_key, 0.0)

    def get_all(self) -> dict[MetricLabels, float]:
        """Get all values with labels."""
        return self._values.copy()


class Histogram:
    """Samples observations and counts them in buckets."""

    DEFAULT_BUCKETS = (
        0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5,
        0.75, 1.0, 2.5, 5.0, 7.5, 10.0, float("inf")
    )

    def __init__(
        self,
        name: str,
        description: str,
        buckets: tuple[float, ...] = None
    ):
        self.name = name
        self.description = description
        self.buckets = buckets or self.DEFAULT_BUCKETS

        self._counts: dict[MetricLabels, dict[float, int]] = {}
        self._sums: dict[MetricLabels, float] = {}
        self._totals: dict[MetricLabels, int] = {}
        self._lock = asyncio.Lock()

    async def observe(self, value: float, **labels) -> None:
        """Record an observation."""
        label_key = MetricLabels(labels)

        async with self._lock:
            # Initialize if needed
            if label_key not in self._counts:
                self._counts[label_key] = {b: 0 for b in self.buckets}
                self._sums[label_key] = 0.0
                self._totals[label_key] = 0

            # Update buckets
            for bucket in self.buckets:
                if value <= bucket:
                    self._counts[label_key][bucket] += 1

            self._sums[label_key] += value
            self._totals[label_key] += 1

    def get_buckets(self, **labels) -> dict[float, int]:
        """Get bucket counts."""
        label_key = MetricLabels(labels)
        return self._counts.get(label_key, {}).copy()

    def get_sum(self, **labels) -> float:
        """Get sum of observations."""
        label_key = MetricLabels(labels)
        return self._sums.get(label_key, 0.0)

    def get_count(self, **labels) -> int:
        """Get count of observations."""
        label_key = MetricLabels(labels)
        return self._totals.get(label_key, 0)

    def get_mean(self, **labels) -> float:
        """Get mean of observations."""
        count = self.get_count(**labels)
        if count == 0:
            return 0.0
        return self.get_sum(**labels) / count


class Summary:
    """Samples observations for calculating quantiles."""

    def __init__(
        self,
        name: str,
        description: str,
        max_age: float = 60.0,
        quantiles: tuple[float, ...] = (0.5, 0.9, 0.99)
    ):
        self.name = name
        self.description = description
        self.max_age = max_age
        self.quantiles = quantiles

        self._observations: dict[MetricLabels, deque] = {}
        self._lock = asyncio.Lock()

    async def observe(self, value: float, **labels) -> None:
        """Record an observation."""
        label_key = MetricLabels(labels)
        now = time.monotonic()

        async with self._lock:
            if label_key not in self._observations:
                self._observations[label_key] = deque()

            self._observations[label_key].append((now, value))

            # Remove old observations
            cutoff = now - self.max_age
            while (self._observations[label_key] and
                   self._observations[label_key][0][0] < cutoff):
                self._observations[label_key].popleft()

    def get_quantile(self, quantile: float, **labels) -> float:
        """Get a specific quantile."""
        label_key = MetricLabels(labels)
        obs = self._observations.get(label_key, deque())

        if not obs:
            return 0.0

        values = sorted([v for _, v in obs])
        idx = int(len(values) * quantile)
        idx = min(idx, len(values) - 1)
        return values[idx]

    def get_quantiles(self, **labels) -> dict[float, float]:
        """Get all configured quantiles."""
        return {q: self.get_quantile(q, **labels) for q in self.quantiles}

    def get_count(self, **labels) -> int:
        """Get count of recent observations."""
        label_key = MetricLabels(labels)
        return len(self._observations.get(label_key, deque()))


class MetricsRegistry:
    """Registry for all metrics."""

    def __init__(self):
        self._counters: dict[str, Counter] = {}
        self._gauges: dict[str, Gauge] = {}
        self._histograms: dict[str, Histogram] = {}
        self._summaries: dict[str, Summary] = {}

    def counter(self, name: str, description: str) -> Counter:
        """Get or create a counter."""
        if name not in self._counters:
            self._counters[name] = Counter(name, description)
        return self._counters[name]

    def gauge(self, name: str, description: str) -> Gauge:
        """Get or create a gauge."""
        if name not in self._gauges:
            self._gauges[name] = Gauge(name, description)
        return self._gauges[name]

    def histogram(
        self,
        name: str,
        description: str,
        buckets: tuple[float, ...] = None
    ) -> Histogram:
        """Get or create a histogram."""
        if name not in self._histograms:
            self._histograms[name] = Histogram(name, description, buckets)
        return self._histograms[name]

    def summary(
        self,
        name: str,
        description: str,
        max_age: float = 60.0,
        quantiles: tuple[float, ...] = (0.5, 0.9, 0.99)
    ) -> Summary:
        """Get or create a summary."""
        if name not in self._summaries:
            self._summaries[name] = Summary(name, description, max_age, quantiles)
        return self._summaries[name]

    def to_prometheus(self) -> str:
        """Export all metrics in Prometheus format."""
        lines = []

        # Counters
        for name, counter in self._counters.items():
            lines.append(f"# HELP {name} {counter.description}")
            lines.append(f"# TYPE {name} counter")
            for labels, value in counter.get_all().items():
                lines.append(f"{name}{labels.to_prometheus()} {value}")

        # Gauges
        for name, gauge in self._gauges.items():
            lines.append(f"# HELP {name} {gauge.description}")
            lines.append(f"# TYPE {name} gauge")
            for labels, value in gauge.get_all().items():
                lines.append(f"{name}{labels.to_prometheus()} {value}")

        # Histograms
        for name, histogram in self._histograms.items():
            lines.append(f"# HELP {name} {histogram.description}")
            lines.append(f"# TYPE {name} histogram")
            for labels, buckets in histogram._counts.items():
                label_str = labels.to_prometheus()
                for bucket, count in buckets.items():
                    le = "+Inf" if bucket == float("inf") else bucket
                    if label_str:
                        bucket_labels = label_str[:-1] + f',le="{le}"' + "}"
                    else:
                        bucket_labels = f'{{le="{le}"}}'
                    lines.append(f"{name}_bucket{bucket_labels} {count}")
                lines.append(f"{name}_sum{label_str} {histogram._sums.get(labels, 0)}")
                lines.append(f"{name}_count{label_str} {histogram._totals.get(labels, 0)}")

        return "\n".join(lines)


class CollaborationMetrics:
    """Pre-defined metrics for collaboration gateway."""

    def __init__(self, registry: Optional[MetricsRegistry] = None):
        self.registry = registry or MetricsRegistry()

        # Connection metrics
        self.connections_total = self.registry.counter(
            "collab_connections_total",
            "Total number of WebSocket connections"
        )
        self.connections_active = self.registry.gauge(
            "collab_connections_active",
            "Currently active WebSocket connections"
        )

        # Operation metrics
        self.operations_total = self.registry.counter(
            "collab_operations_total",
            "Total number of OT operations processed"
        )
        self.operations_latency = self.registry.histogram(
            "collab_operations_latency_seconds",
            "Operation processing latency in seconds",
            buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
        )

        # Document metrics
        self.documents_active = self.registry.gauge(
            "collab_documents_active",
            "Number of documents with active editors"
        )
        self.document_versions = self.registry.gauge(
            "collab_document_versions",
            "Current version number of documents"
        )

        # Error metrics
        self.errors_total = self.registry.counter(
            "collab_errors_total",
            "Total number of errors"
        )

        # Rate limiting metrics
        self.rate_limits_total = self.registry.counter(
            "collab_rate_limits_total",
            "Total number of rate limit hits"
        )

        # Circuit breaker metrics
        self.circuit_breaker_state = self.registry.gauge(
            "collab_circuit_breaker_state",
            "Circuit breaker state (0=closed, 1=half_open, 2=open)"
        )
        self.backpressure = self.registry.gauge(
            "collab_backpressure",
            "Current backpressure level"
        )

        # Message metrics
        self.messages_received = self.registry.counter(
            "collab_messages_received_total",
            "Total WebSocket messages received"
        )
        self.messages_sent = self.registry.counter(
            "collab_messages_sent_total",
            "Total WebSocket messages sent"
        )

    async def record_connection(self, user_id: str) -> None:
        """Record new connection."""
        await self.connections_total.inc(user_id=user_id)
        await self.connections_active.inc(user_id=user_id)

    async def record_disconnection(self, user_id: str) -> None:
        """Record disconnection."""
        await self.connections_active.dec(user_id=user_id)

    async def record_operation(
        self,
        document_id: str,
        latency_seconds: float,
        operation_type: str = "unknown"
    ) -> None:
        """Record operation processed."""
        await self.operations_total.inc(
            document_id=document_id,
            operation_type=operation_type
        )
        await self.operations_latency.observe(
            latency_seconds,
            document_id=document_id
        )

    async def record_error(self, error_type: str) -> None:
        """Record an error."""
        await self.errors_total.inc(error_type=error_type)

    async def record_rate_limit(self, user_id: str, limit_type: str) -> None:
        """Record rate limit hit."""
        await self.rate_limits_total.inc(user_id=user_id, limit_type=limit_type)

    async def set_circuit_breaker_state(self, state: int) -> None:
        """Set circuit breaker state (0=closed, 1=half_open, 2=open)."""
        await self.circuit_breaker_state.set(state)

    async def set_backpressure(self, value: float) -> None:
        """Set current backpressure level."""
        await self.backpressure.set(value)

    async def set_active_documents(self, count: int) -> None:
        """Set number of active documents."""
        await self.documents_active.set(count)

    async def set_active_connections(self, count: int) -> None:
        """Set number of active connections."""
        await self.connections_active.set(count)

    def export_prometheus(self) -> str:
        """Export metrics in Prometheus format."""
        return self.registry.to_prometheus()

    def get_summary(self) -> dict:
        """Get a summary of key metrics."""
        return {
            "connections": {
                "total": self.connections_total.get(),
                "active": self.connections_active.get(),
            },
            "operations": {
                "total": self.operations_total.get(),
                "mean_latency": self.operations_latency.get_mean(),
            },
            "documents": {
                "active": self.documents_active.get(),
            },
            "errors": {
                "total": self.errors_total.get(),
            },
            "rate_limits": {
                "total": self.rate_limits_total.get(),
            },
            "system": {
                "circuit_breaker_state": self.circuit_breaker_state.get(),
                "backpressure": self.backpressure.get(),
            },
        }


# Global metrics instance
_metrics: Optional[CollaborationMetrics] = None


def get_metrics() -> CollaborationMetrics:
    """Get global metrics instance."""
    global _metrics
    if _metrics is None:
        _metrics = CollaborationMetrics()
    return _metrics


def reset_metrics() -> None:
    """Reset global metrics instance."""
    global _metrics
    _metrics = None
