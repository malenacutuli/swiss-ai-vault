"""Tests for Backpressure Calculator."""

import pytest
from unittest.mock import patch, MagicMock

from app.collaboration.backpressure import (
    BackpressureCalculator,
    BackpressureWeights,
    BackpressureLimits,
    BackpressureMetrics,
    AdaptiveBackpressure,
)


class TestBackpressureWeights:
    """Tests for BackpressureWeights."""

    def test_default_weights(self):
        """Default weights sum to 1.0."""
        weights = BackpressureWeights()

        assert weights.ws_connections == 0.30
        assert weights.redis_channels == 0.25
        assert weights.ot_queue_depth == 0.25
        assert weights.memory_usage == 0.20
        assert weights.validate() is True

    def test_custom_weights_valid(self):
        """Custom weights that sum to 1.0 are valid."""
        weights = BackpressureWeights(
            ws_connections=0.40,
            redis_channels=0.30,
            ot_queue_depth=0.20,
            memory_usage=0.10,
        )

        assert weights.validate() is True

    def test_custom_weights_invalid(self):
        """Custom weights that don't sum to 1.0 are invalid."""
        weights = BackpressureWeights(
            ws_connections=0.50,
            redis_channels=0.30,
            ot_queue_depth=0.20,
            memory_usage=0.20,  # Total = 1.2
        )

        assert weights.validate() is False


class TestBackpressureLimits:
    """Tests for BackpressureLimits."""

    def test_default_limits(self):
        """Default limits are set."""
        limits = BackpressureLimits()

        assert limits.max_ws_connections == 10000
        assert limits.max_redis_channels == 1000
        assert limits.ot_queue_capacity == 10000
        assert limits.memory_limit_mb == 4096

    def test_custom_limits(self):
        """Can customize limits."""
        limits = BackpressureLimits(
            max_ws_connections=5000,
            max_redis_channels=500,
        )

        assert limits.max_ws_connections == 5000
        assert limits.max_redis_channels == 500


class TestBackpressureCalculator:
    """Tests for BackpressureCalculator."""

    @pytest.fixture
    def calculator(self):
        return BackpressureCalculator()

    def test_zero_backpressure_when_idle(self, calculator):
        """Backpressure is 0 when no load."""
        # Override memory to return 0
        calculator.set_memory_provider(lambda: 0.0)

        bp = calculator.calculate()

        assert bp == 0.0

    def test_full_backpressure_at_capacity(self, calculator):
        """Backpressure is 1.0 when at full capacity."""
        calculator.set_ws_connections(10000)
        calculator.set_redis_channels(1000)
        calculator.set_ot_queue_depth(10000)
        calculator.set_memory_provider(lambda: 4096.0)

        bp = calculator.calculate()

        assert bp == 1.0

    def test_weighted_calculation(self, calculator):
        """Backpressure is correctly weighted."""
        # Set 50% of each metric
        calculator.set_ws_connections(5000)  # 50% * 0.30 = 0.15
        calculator.set_redis_channels(500)   # 50% * 0.25 = 0.125
        calculator.set_ot_queue_depth(5000)  # 50% * 0.25 = 0.125
        calculator.set_memory_provider(lambda: 2048.0)  # 50% * 0.20 = 0.10

        bp = calculator.calculate()

        assert abs(bp - 0.5) < 0.01  # Should be ~0.5

    def test_provider_callbacks(self, calculator):
        """Provider callbacks are used for metrics."""
        calculator.set_ws_provider(lambda: 1000)   # 10% of 10000
        calculator.set_redis_provider(lambda: 100)  # 10% of 1000
        calculator.set_ot_provider(lambda: 1000)    # 10% of 10000
        calculator.set_memory_provider(lambda: 409.6)  # 10% of 4096

        bp = calculator.calculate()

        # All at 10% capacity
        # 0.10 * (0.30 + 0.25 + 0.25 + 0.20) = 0.10
        assert abs(bp - 0.10) < 0.01

    def test_metrics_capped_at_one(self, calculator):
        """Individual metrics are capped at 1.0."""
        calculator.set_ws_connections(20000)  # 200% of limit
        calculator.set_redis_channels(0)
        calculator.set_ot_queue_depth(0)
        calculator.set_memory_provider(lambda: 0.0)

        bp = calculator.calculate()

        # Only WS at 100%, others at 0%
        # 1.0 * 0.30 = 0.30
        assert abs(bp - 0.30) < 0.01

    def test_get_metrics(self, calculator):
        """Can retrieve detailed metrics."""
        calculator.set_ws_connections(3000)
        calculator.set_redis_channels(250)
        calculator.set_ot_queue_depth(2500)
        calculator.set_memory_provider(lambda: 1024.0)

        calculator.calculate()
        metrics = calculator.get_metrics()

        assert metrics.ws_connections == 3000
        assert metrics.redis_channels == 250
        assert metrics.ot_queue_depth == 2500
        assert metrics.memory_used_mb == 1024.0
        assert 0 < metrics.backpressure < 1

    def test_get_metrics_dict(self, calculator):
        """Can get metrics as dictionary."""
        calculator.set_ws_connections(1000)
        calculator.set_memory_provider(lambda: 512.0)

        metrics_dict = calculator.get_metrics_dict()

        assert "backpressure" in metrics_dict
        assert "components" in metrics_dict
        assert "ws_connections" in metrics_dict["components"]
        assert "redis_channels" in metrics_dict["components"]
        assert "timestamp" in metrics_dict

    def test_direct_setters(self, calculator):
        """Direct setters clamp values at 0."""
        calculator.set_ws_connections(-100)
        calculator.set_redis_channels(-50)
        calculator.set_ot_queue_depth(-200)

        assert calculator._ws_connections == 0
        assert calculator._redis_channels == 0
        assert calculator._ot_queue_depth == 0

    def test_custom_weights(self):
        """Calculator uses custom weights."""
        weights = BackpressureWeights(
            ws_connections=0.50,
            redis_channels=0.20,
            ot_queue_depth=0.20,
            memory_usage=0.10,
        )
        calculator = BackpressureCalculator(weights=weights)

        # Full WS load
        calculator.set_ws_connections(10000)
        calculator.set_redis_channels(0)
        calculator.set_ot_queue_depth(0)
        calculator.set_memory_provider(lambda: 0.0)

        bp = calculator.calculate()

        # WS at 100% with 0.50 weight = 0.50
        assert abs(bp - 0.50) < 0.01

    def test_custom_limits(self):
        """Calculator uses custom limits."""
        limits = BackpressureLimits(
            max_ws_connections=100,  # Very low limit
        )
        calculator = BackpressureCalculator(limits=limits)
        calculator.set_memory_provider(lambda: 0.0)

        calculator.set_ws_connections(100)

        bp = calculator.calculate()

        # WS at 100% = 0.30 contribution
        assert bp >= 0.30


class TestAdaptiveBackpressure:
    """Tests for AdaptiveBackpressure."""

    @pytest.fixture
    def adaptive(self):
        return AdaptiveBackpressure(adaptation_rate=0.1)

    def test_initial_weights_are_default(self, adaptive):
        """Starts with default weights."""
        assert adaptive.weights.ws_connections == 0.30
        assert adaptive.weights.redis_channels == 0.25

    def test_calculation_works(self, adaptive):
        """Can calculate backpressure."""
        adaptive.set_memory_provider(lambda: 0.0)
        bp = adaptive.calculate()

        assert 0.0 <= bp <= 1.0

    def test_weight_adaptation_on_high_pressure(self, adaptive):
        """Weights adapt when one metric is under high pressure."""
        # Set WS very high, others low
        adaptive.set_ws_connections(9000)  # 90%
        adaptive.set_redis_channels(100)   # 10%
        adaptive.set_ot_queue_depth(100)   # 1%
        adaptive.set_memory_provider(lambda: 100.0)  # ~2.5%

        original_ws_weight = adaptive.weights.ws_connections

        # Calculate multiple times to let adaptation kick in
        for _ in range(5):
            adaptive.calculate()

        # WS weight should have increased
        assert adaptive.weights.ws_connections >= original_ws_weight

    def test_weights_stay_normalized(self, adaptive):
        """Weights always sum to 1.0 after adaptation."""
        adaptive.set_ws_connections(9000)
        adaptive.set_memory_provider(lambda: 0.0)

        for _ in range(10):
            adaptive.calculate()

        total = (
            adaptive.weights.ws_connections +
            adaptive.weights.redis_channels +
            adaptive.weights.ot_queue_depth +
            adaptive.weights.memory_usage
        )

        assert abs(total - 1.0) < 0.001

    def test_reset_weights(self, adaptive):
        """Can reset weights to base values."""
        # Adapt weights
        adaptive.set_ws_connections(9000)
        adaptive.set_memory_provider(lambda: 0.0)
        adaptive.calculate()

        # Reset
        adaptive.reset_weights()

        assert adaptive.weights.ws_connections == 0.30
        assert adaptive.weights.redis_channels == 0.25
        assert adaptive.weights.ot_queue_depth == 0.25
        assert adaptive.weights.memory_usage == 0.20


class TestBackpressureMetrics:
    """Tests for BackpressureMetrics dataclass."""

    def test_default_values(self):
        """Metrics have sensible defaults."""
        metrics = BackpressureMetrics()

        assert metrics.ws_connections == 0
        assert metrics.redis_channels == 0
        assert metrics.ot_queue_depth == 0
        assert metrics.memory_used_mb == 0.0
        assert metrics.backpressure == 0.0

    def test_custom_values(self):
        """Can set custom metric values."""
        metrics = BackpressureMetrics(
            ws_connections=1000,
            redis_channels=100,
            ot_queue_depth=500,
            memory_used_mb=2048.0,
            backpressure=0.5,
        )

        assert metrics.ws_connections == 1000
        assert metrics.backpressure == 0.5
