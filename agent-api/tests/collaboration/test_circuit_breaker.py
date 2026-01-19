"""Tests for Circuit Breaker."""

import pytest
import asyncio
from datetime import datetime

from app.collaboration.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
    CircuitBreakerConfig,
    ActivationReason,
)


class TestCircuitBreaker:
    """Tests for CircuitBreaker."""

    @pytest.fixture
    def breaker(self):
        config = CircuitBreakerConfig(
            activation_threshold=0.95,
            deactivation_threshold=0.85,
            open_duration=0.1,  # Fast for testing
            half_open_max_requests=3,
            half_open_timeout=0.1,
        )
        return CircuitBreaker(config=config)

    def test_initial_state_is_closed(self, breaker):
        """Circuit starts in closed state."""
        assert breaker.state == CircuitState.CLOSED
        assert breaker.is_closed
        assert not breaker.is_open
        assert not breaker.is_half_open

    def test_allow_request_when_closed(self, breaker):
        """Requests are allowed when closed."""
        assert breaker.allow_request() is True
        assert breaker.allow_request() is True
        assert breaker.allow_request() is True

    @pytest.mark.asyncio
    async def test_transition_to_open_on_high_backpressure(self, breaker):
        """Circuit opens when backpressure exceeds threshold."""
        # Set backpressure above threshold
        breaker.set_backpressure_calculator(lambda: 0.96)

        # Manually trigger check
        await breaker._check_and_transition()

        assert breaker.state == CircuitState.OPEN
        assert breaker.is_open

    @pytest.mark.asyncio
    async def test_reject_requests_when_open(self, breaker):
        """Requests are rejected when circuit is open."""
        await breaker.force_open()

        assert breaker.allow_request() is False
        assert breaker.allow_request() is False

    @pytest.mark.asyncio
    async def test_transition_to_half_open_after_timeout(self, breaker):
        """Circuit transitions to half-open after open_duration."""
        await breaker.force_open()
        assert breaker.state == CircuitState.OPEN

        # Wait for open_duration
        await asyncio.sleep(0.15)
        await breaker._check_and_transition()

        assert breaker.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_limited_requests_in_half_open(self, breaker):
        """Half-open allows limited requests."""
        breaker.set_backpressure_calculator(lambda: 0.5)  # Low backpressure
        await breaker.force_open()

        # Transition to half-open
        await asyncio.sleep(0.15)
        await breaker._check_and_transition()
        assert breaker.state == CircuitState.HALF_OPEN

        # Should allow half_open_max_requests
        for _ in range(3):
            assert breaker.allow_request() is True

        # Should reject additional requests
        assert breaker.allow_request() is False

    @pytest.mark.asyncio
    async def test_transition_to_closed_on_success(self, breaker):
        """Circuit closes after successful half-open period."""
        breaker.set_backpressure_calculator(lambda: 0.5)  # Below deactivation threshold

        await breaker.force_open()

        # Transition to half-open
        await asyncio.sleep(0.15)
        await breaker._check_and_transition()
        assert breaker.state == CircuitState.HALF_OPEN

        # Make some successful requests
        for _ in range(3):
            breaker.allow_request()
            breaker.record_success()

        # Evaluate should close the circuit
        await breaker._evaluate_half_open()
        assert breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_transition_to_open_on_failure(self, breaker):
        """Circuit reopens after failures in half-open."""
        breaker.set_backpressure_calculator(lambda: 0.5)

        await breaker.force_open()

        # Transition to half-open
        await asyncio.sleep(0.15)
        await breaker._check_and_transition()
        assert breaker.state == CircuitState.HALF_OPEN

        # Record a failure
        breaker.allow_request()
        breaker.record_failure()

        # Evaluate should reopen
        await breaker._evaluate_half_open()
        assert breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_force_open(self, breaker):
        """Can manually force circuit open."""
        await breaker.force_open(ActivationReason.MANUAL)

        assert breaker.state == CircuitState.OPEN
        stats = breaker.get_stats()
        assert stats.last_open_reason == ActivationReason.MANUAL

    @pytest.mark.asyncio
    async def test_force_close(self, breaker):
        """Can manually force circuit closed."""
        await breaker.force_open()
        await breaker.force_close()

        assert breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_reset(self, breaker):
        """Reset clears all state."""
        # Build up some state
        breaker.allow_request()
        breaker.allow_request()
        await breaker.force_open()

        await breaker.reset()

        assert breaker.state == CircuitState.CLOSED
        stats = breaker.get_stats()
        assert stats.total_requests == 0
        assert stats.open_count == 0

    def test_get_stats(self, breaker):
        """Get circuit breaker statistics."""
        breaker.allow_request()
        breaker.allow_request()

        stats = breaker.get_stats()

        assert stats.state == CircuitState.CLOSED
        assert stats.total_requests == 2
        assert stats.accepted_requests == 2
        assert stats.rejected_requests == 0

    def test_get_stats_dict(self, breaker):
        """Get statistics as dictionary."""
        breaker.allow_request()

        stats_dict = breaker.get_stats_dict()

        assert stats_dict["state"] == "closed"
        assert stats_dict["total_requests"] == 1
        assert "backpressure" in stats_dict
        assert "rejection_rate" in stats_dict

    @pytest.mark.asyncio
    async def test_state_change_callback(self, breaker):
        """State change callback is invoked."""
        state_changes = []

        async def on_change(old_state, new_state):
            state_changes.append((old_state, new_state))

        breaker.on_state_change = on_change

        await breaker.force_open()

        assert len(state_changes) == 1
        assert state_changes[0] == (CircuitState.CLOSED, CircuitState.OPEN)

    @pytest.mark.asyncio
    async def test_rejection_callback(self, breaker):
        """Rejection callback is invoked."""
        rejections = []

        def on_reject(reason):
            rejections.append(reason)

        breaker.on_rejection = on_reject

        await breaker.force_open()
        breaker.allow_request()

        assert len(rejections) == 1
        assert rejections[0] == "circuit_open"

    def test_backpressure_property(self, breaker):
        """Can get current backpressure."""
        breaker.set_backpressure_calculator(lambda: 0.75)
        breaker._current_backpressure = 0.75

        assert breaker.backpressure == 0.75

    @pytest.mark.asyncio
    async def test_open_count_increments(self, breaker):
        """Open count increments each time circuit opens."""
        assert breaker.get_stats().open_count == 0

        await breaker.force_open()
        assert breaker.get_stats().open_count == 1

        await breaker.force_close()
        await breaker.force_open()
        assert breaker.get_stats().open_count == 2

    @pytest.mark.asyncio
    async def test_start_stop_monitoring(self, breaker):
        """Can start and stop background monitoring."""
        await breaker.start()
        assert breaker._running is True

        await breaker.stop()
        assert breaker._running is False


class TestCircuitBreakerConfig:
    """Tests for CircuitBreakerConfig."""

    def test_default_values(self):
        """Config has sensible defaults."""
        config = CircuitBreakerConfig()

        assert config.activation_threshold == 0.95
        assert config.deactivation_threshold == 0.85
        assert config.open_duration == 30.0
        assert config.half_open_max_requests == 5

    def test_custom_values(self):
        """Can customize config values."""
        config = CircuitBreakerConfig(
            activation_threshold=0.90,
            deactivation_threshold=0.80,
            open_duration=60.0,
        )

        assert config.activation_threshold == 0.90
        assert config.deactivation_threshold == 0.80
        assert config.open_duration == 60.0


class TestActivationReason:
    """Tests for ActivationReason enum."""

    def test_activation_reasons(self):
        """All activation reasons exist."""
        assert ActivationReason.BACKPRESSURE.value == "backpressure"
        assert ActivationReason.MANUAL.value == "manual"
        assert ActivationReason.ERROR_RATE.value == "error_rate"
        assert ActivationReason.LATENCY.value == "latency"
