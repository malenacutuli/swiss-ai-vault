"""Tests for Metrics Collection."""

import pytest
import asyncio

from app.collaboration.metrics import (
    MetricsRegistry,
    CollaborationMetrics,
    Counter,
    Gauge,
    Histogram,
    Summary,
    MetricLabels,
    get_metrics,
    reset_metrics,
)


class TestMetricLabels:
    """Tests for MetricLabels."""

    def test_empty_labels(self):
        """Empty labels produce empty string."""
        labels = MetricLabels({})
        assert labels.to_prometheus() == ""

    def test_single_label(self):
        """Single label formatting."""
        labels = MetricLabels({"user": "alice"})
        assert labels.to_prometheus() == '{user="alice"}'

    def test_multiple_labels(self):
        """Multiple labels are sorted."""
        labels = MetricLabels({"b": "2", "a": "1"})
        assert labels.to_prometheus() == '{a="1",b="2"}'

    def test_hashable(self):
        """Labels are hashable for dict keys."""
        labels1 = MetricLabels({"user": "alice"})
        labels2 = MetricLabels({"user": "alice"})

        d = {labels1: 1}
        assert d[labels2] == 1


class TestCounter:
    """Tests for Counter metric."""

    @pytest.fixture
    def counter(self):
        return Counter("test_counter", "A test counter")

    @pytest.mark.asyncio
    async def test_increment(self, counter):
        """Increment counter."""
        await counter.inc()
        await counter.inc()

        assert counter.get() == 2

    @pytest.mark.asyncio
    async def test_increment_by_value(self, counter):
        """Increment by specific value."""
        await counter.inc(5)

        assert counter.get() == 5

    @pytest.mark.asyncio
    async def test_labeled_counter(self, counter):
        """Counter with labels."""
        await counter.inc(user="alice")
        await counter.inc(user="bob")
        await counter.inc(user="alice")

        assert counter.get(user="alice") == 2
        assert counter.get(user="bob") == 1

    @pytest.mark.asyncio
    async def test_get_all(self, counter):
        """Get all counter values."""
        await counter.inc(user="alice")
        await counter.inc(user="bob")

        all_values = counter.get_all()

        assert len(all_values) == 2

    @pytest.mark.asyncio
    async def test_reset(self, counter):
        """Reset counter."""
        await counter.inc()
        await counter.reset()

        assert counter.get() == 0


class TestGauge:
    """Tests for Gauge metric."""

    @pytest.fixture
    def gauge(self):
        return Gauge("test_gauge", "A test gauge")

    @pytest.mark.asyncio
    async def test_set(self, gauge):
        """Set gauge value."""
        await gauge.set(42)

        assert gauge.get() == 42

    @pytest.mark.asyncio
    async def test_increment(self, gauge):
        """Increment gauge."""
        await gauge.set(10)
        await gauge.inc(5)

        assert gauge.get() == 15

    @pytest.mark.asyncio
    async def test_decrement(self, gauge):
        """Decrement gauge."""
        await gauge.set(10)
        await gauge.dec(3)

        assert gauge.get() == 7

    @pytest.mark.asyncio
    async def test_labeled_gauge(self, gauge):
        """Gauge with labels."""
        await gauge.set(100, server="a")
        await gauge.set(200, server="b")

        assert gauge.get(server="a") == 100
        assert gauge.get(server="b") == 200


class TestHistogram:
    """Tests for Histogram metric."""

    @pytest.fixture
    def histogram(self):
        return Histogram(
            "test_histogram",
            "A test histogram",
            buckets=(0.1, 0.5, 1.0, 5.0, float("inf"))
        )

    @pytest.mark.asyncio
    async def test_observe(self, histogram):
        """Record observations."""
        await histogram.observe(0.3)
        await histogram.observe(0.7)
        await histogram.observe(2.0)

        assert histogram.get_count() == 3
        assert histogram.get_sum() == pytest.approx(3.0)

    @pytest.mark.asyncio
    async def test_buckets(self, histogram):
        """Observations fall into correct buckets."""
        await histogram.observe(0.05)  # <= 0.1
        await histogram.observe(0.3)   # <= 0.5
        await histogram.observe(0.8)   # <= 1.0
        await histogram.observe(3.0)   # <= 5.0

        buckets = histogram.get_buckets()

        assert buckets[0.1] == 1
        assert buckets[0.5] == 2
        assert buckets[1.0] == 3
        assert buckets[5.0] == 4
        assert buckets[float("inf")] == 4

    @pytest.mark.asyncio
    async def test_mean(self, histogram):
        """Calculate mean."""
        await histogram.observe(1.0)
        await histogram.observe(2.0)
        await histogram.observe(3.0)

        assert histogram.get_mean() == pytest.approx(2.0)

    @pytest.mark.asyncio
    async def test_labeled_histogram(self, histogram):
        """Histogram with labels."""
        await histogram.observe(0.1, endpoint="/api")
        await histogram.observe(0.2, endpoint="/api")
        await histogram.observe(1.0, endpoint="/web")

        assert histogram.get_count(endpoint="/api") == 2
        assert histogram.get_count(endpoint="/web") == 1


class TestSummary:
    """Tests for Summary metric."""

    @pytest.fixture
    def summary(self):
        return Summary(
            "test_summary",
            "A test summary",
            max_age=10.0,
            quantiles=(0.5, 0.9, 0.99)
        )

    @pytest.mark.asyncio
    async def test_observe(self, summary):
        """Record observations."""
        for i in range(100):
            await summary.observe(i)

        assert summary.get_count() == 100

    @pytest.mark.asyncio
    async def test_quantiles(self, summary):
        """Calculate quantiles."""
        for i in range(100):
            await summary.observe(i)

        quantiles = summary.get_quantiles()

        assert quantiles[0.5] == pytest.approx(50, abs=5)
        assert quantiles[0.9] == pytest.approx(90, abs=5)

    @pytest.mark.asyncio
    async def test_single_quantile(self, summary):
        """Get single quantile."""
        for i in range(100):
            await summary.observe(i)

        p50 = summary.get_quantile(0.5)

        assert p50 == pytest.approx(50, abs=5)


class TestMetricsRegistry:
    """Tests for MetricsRegistry."""

    @pytest.fixture
    def registry(self):
        return MetricsRegistry()

    def test_counter(self, registry):
        """Create and retrieve counter."""
        c1 = registry.counter("requests", "Total requests")
        c2 = registry.counter("requests", "Total requests")

        assert c1 is c2

    def test_gauge(self, registry):
        """Create and retrieve gauge."""
        g1 = registry.gauge("connections", "Active connections")
        g2 = registry.gauge("connections", "Active connections")

        assert g1 is g2

    def test_histogram(self, registry):
        """Create and retrieve histogram."""
        h1 = registry.histogram("latency", "Request latency")
        h2 = registry.histogram("latency", "Request latency")

        assert h1 is h2

    def test_summary(self, registry):
        """Create and retrieve summary."""
        s1 = registry.summary("response_time", "Response time")
        s2 = registry.summary("response_time", "Response time")

        assert s1 is s2

    @pytest.mark.asyncio
    async def test_to_prometheus(self, registry):
        """Export to Prometheus format."""
        counter = registry.counter("requests_total", "Total requests")
        gauge = registry.gauge("connections_active", "Active connections")

        await counter.inc(method="GET")
        await gauge.set(10)

        output = registry.to_prometheus()

        assert "# HELP requests_total" in output
        assert "# TYPE requests_total counter" in output
        assert "requests_total" in output
        assert "connections_active" in output


class TestCollaborationMetrics:
    """Tests for CollaborationMetrics."""

    @pytest.fixture
    def metrics(self):
        return CollaborationMetrics()

    @pytest.mark.asyncio
    async def test_record_connection(self, metrics):
        """Record connection."""
        await metrics.record_connection("user_1")

        assert metrics.connections_total.get(user_id="user_1") == 1
        assert metrics.connections_active.get(user_id="user_1") == 1

    @pytest.mark.asyncio
    async def test_record_disconnection(self, metrics):
        """Record disconnection."""
        await metrics.record_connection("user_1")
        await metrics.record_disconnection("user_1")

        assert metrics.connections_active.get(user_id="user_1") == 0

    @pytest.mark.asyncio
    async def test_record_operation(self, metrics):
        """Record operation."""
        await metrics.record_operation("doc_1", 0.05, "insert")

        assert metrics.operations_total.get(
            document_id="doc_1",
            operation_type="insert"
        ) == 1

    @pytest.mark.asyncio
    async def test_record_error(self, metrics):
        """Record error."""
        await metrics.record_error("validation")

        assert metrics.errors_total.get(error_type="validation") == 1

    @pytest.mark.asyncio
    async def test_record_rate_limit(self, metrics):
        """Record rate limit."""
        await metrics.record_rate_limit("user_1", "operations")

        assert metrics.rate_limits_total.get(
            user_id="user_1",
            limit_type="operations"
        ) == 1

    @pytest.mark.asyncio
    async def test_set_circuit_breaker_state(self, metrics):
        """Set circuit breaker state."""
        await metrics.set_circuit_breaker_state(2)  # open

        assert metrics.circuit_breaker_state.get() == 2

    @pytest.mark.asyncio
    async def test_set_backpressure(self, metrics):
        """Set backpressure level."""
        await metrics.set_backpressure(0.85)

        assert metrics.backpressure.get() == 0.85

    @pytest.mark.asyncio
    async def test_export_prometheus(self, metrics):
        """Export to Prometheus format."""
        await metrics.record_connection("user_1")
        await metrics.record_operation("doc_1", 0.1)

        output = metrics.export_prometheus()

        assert "collab_connections_total" in output
        assert "collab_operations_total" in output

    @pytest.mark.asyncio
    async def test_get_summary(self, metrics):
        """Get metrics summary."""
        await metrics.record_connection("user_1")
        await metrics.record_error("test")

        summary = metrics.get_summary()

        assert "connections" in summary
        assert "errors" in summary
        assert "system" in summary


class TestGlobalMetrics:
    """Tests for global metrics functions."""

    def test_get_metrics(self):
        """Get global metrics instance."""
        reset_metrics()
        m1 = get_metrics()
        m2 = get_metrics()

        assert m1 is m2

    def test_reset_metrics(self):
        """Reset global metrics."""
        m1 = get_metrics()
        reset_metrics()
        m2 = get_metrics()

        assert m1 is not m2
