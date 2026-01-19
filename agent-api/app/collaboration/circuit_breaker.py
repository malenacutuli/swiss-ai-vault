"""
Circuit Breaker for Collaboration Gateway

Implements a 3-state Finite State Machine (FSM) to protect the system
from overload conditions:
- CLOSED: Normal operation, requests flow through
- OPEN: System overloaded, reject new connections
- HALF_OPEN: Testing if system has recovered

The circuit breaker monitors backpressure metrics and transitions
between states based on configurable thresholds.
"""

from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Rejecting requests
    HALF_OPEN = "half_open"  # Testing recovery


class ActivationReason(Enum):
    """Reasons for circuit breaker activation."""
    BACKPRESSURE = "backpressure"
    MANUAL = "manual"
    ERROR_RATE = "error_rate"
    LATENCY = "latency"


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    # Thresholds
    activation_threshold: float = 0.95  # Open when backpressure >= this
    deactivation_threshold: float = 0.85  # Close when backpressure < this

    # Timing
    open_duration: float = 30.0  # Seconds to stay open before half-open
    half_open_max_requests: int = 5  # Max requests to test in half-open
    half_open_timeout: float = 10.0  # Seconds before deciding half-open result

    # Error tracking
    error_threshold: float = 0.5  # Error rate threshold
    error_window: float = 60.0  # Window for error rate calculation

    # Monitoring
    sample_interval: float = 1.0  # Seconds between backpressure samples

    # Recovery
    recovery_rate: float = 0.1  # Rate of gradual recovery (0-1)


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker."""
    state: CircuitState = CircuitState.CLOSED
    backpressure: float = 0.0

    # Counters
    total_requests: int = 0
    accepted_requests: int = 0
    rejected_requests: int = 0

    # Timing
    last_state_change: Optional[datetime] = None
    time_in_current_state: float = 0.0

    # State history
    open_count: int = 0
    last_open_reason: Optional[ActivationReason] = None

    # Half-open testing
    half_open_successes: int = 0
    half_open_failures: int = 0


class CircuitBreaker:
    """
    Circuit breaker for protecting collaboration gateway from overload.

    The circuit breaker uses a 3-state FSM:

    CLOSED (Normal):
        - All requests pass through
        - Monitor backpressure continuously
        - Transition to OPEN if backpressure >= activation_threshold

    OPEN (Protecting):
        - Reject all new connection requests
        - Wait for open_duration seconds
        - Transition to HALF_OPEN after timeout

    HALF_OPEN (Testing):
        - Allow limited requests through
        - Track success/failure rate
        - Transition to CLOSED if successful
        - Transition to OPEN if failures detected
    """

    def __init__(
        self,
        config: Optional[CircuitBreakerConfig] = None,
        backpressure_calculator: Optional[Callable[[], float]] = None,
    ):
        """
        Initialize circuit breaker.

        Args:
            config: Circuit breaker configuration
            backpressure_calculator: Callback to get current backpressure (0.0-1.0)
        """
        self.config = config or CircuitBreakerConfig()
        self._backpressure_calculator = backpressure_calculator

        # State
        self._state = CircuitState.CLOSED
        self._state_entered_at = time.monotonic()
        self._last_state_change = datetime.utcnow()

        # Counters
        self._total_requests = 0
        self._accepted_requests = 0
        self._rejected_requests = 0
        self._open_count = 0
        self._last_open_reason: Optional[ActivationReason] = None

        # Half-open state
        self._half_open_requests = 0
        self._half_open_successes = 0
        self._half_open_failures = 0

        # Current backpressure
        self._current_backpressure = 0.0

        # Error tracking
        self._recent_errors: list[float] = []

        # Background monitoring
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False

        # Callbacks
        self.on_state_change: Optional[Callable[[CircuitState, CircuitState], Any]] = None
        self.on_rejection: Optional[Callable[[str], Any]] = None

    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        return self._state

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (rejecting requests)."""
        return self._state == CircuitState.OPEN

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (allowing requests)."""
        return self._state == CircuitState.CLOSED

    @property
    def is_half_open(self) -> bool:
        """Check if circuit is in half-open testing state."""
        return self._state == CircuitState.HALF_OPEN

    @property
    def backpressure(self) -> float:
        """Get current backpressure level."""
        return self._current_backpressure

    def set_backpressure_calculator(
        self,
        calculator: Callable[[], float]
    ) -> None:
        """Set the backpressure calculator callback."""
        self._backpressure_calculator = calculator

    async def start(self) -> None:
        """Start background monitoring."""
        if self._running:
            return

        self._running = True
        self._monitoring_task = asyncio.create_task(self._monitor_loop())
        logger.info("Circuit breaker monitoring started")

    async def stop(self) -> None:
        """Stop background monitoring."""
        self._running = False

        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        logger.info("Circuit breaker monitoring stopped")

    async def _monitor_loop(self) -> None:
        """Background loop to monitor backpressure and manage state."""
        try:
            while self._running:
                await asyncio.sleep(self.config.sample_interval)
                await self._check_and_transition()
        except asyncio.CancelledError:
            pass

    async def _check_and_transition(self) -> None:
        """Check conditions and transition state if needed."""
        # Update backpressure
        if self._backpressure_calculator:
            self._current_backpressure = self._backpressure_calculator()

        now = time.monotonic()
        time_in_state = now - self._state_entered_at

        if self._state == CircuitState.CLOSED:
            # Check if we should open
            if self._current_backpressure >= self.config.activation_threshold:
                await self._transition_to(
                    CircuitState.OPEN,
                    ActivationReason.BACKPRESSURE
                )

        elif self._state == CircuitState.OPEN:
            # Check if we should try half-open
            if time_in_state >= self.config.open_duration:
                await self._transition_to(CircuitState.HALF_OPEN)

        elif self._state == CircuitState.HALF_OPEN:
            # Check half-open results
            if time_in_state >= self.config.half_open_timeout:
                await self._evaluate_half_open()
            elif self._half_open_requests >= self.config.half_open_max_requests:
                await self._evaluate_half_open()

    async def _transition_to(
        self,
        new_state: CircuitState,
        reason: Optional[ActivationReason] = None
    ) -> None:
        """Transition to a new state."""
        old_state = self._state

        if old_state == new_state:
            return

        self._state = new_state
        self._state_entered_at = time.monotonic()
        self._last_state_change = datetime.utcnow()

        if new_state == CircuitState.OPEN:
            self._open_count += 1
            self._last_open_reason = reason

        if new_state == CircuitState.HALF_OPEN:
            self._half_open_requests = 0
            self._half_open_successes = 0
            self._half_open_failures = 0

        logger.info(
            f"Circuit breaker: {old_state.value} -> {new_state.value}"
            f"{f' (reason: {reason.value})' if reason else ''}"
        )

        # Invoke callback
        if self.on_state_change:
            try:
                result = self.on_state_change(old_state, new_state)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"State change callback error: {e}")

    async def _evaluate_half_open(self) -> None:
        """Evaluate half-open test results and decide next state."""
        if self._half_open_failures > 0:
            # Any failure means system not ready
            await self._transition_to(CircuitState.OPEN)
        elif self._current_backpressure < self.config.deactivation_threshold:
            # Backpressure is low enough, close the circuit
            await self._transition_to(CircuitState.CLOSED)
        else:
            # Backpressure still high, stay open
            await self._transition_to(CircuitState.OPEN)

    def allow_request(self) -> bool:
        """
        Check if a request should be allowed through.

        Returns:
            True if request is allowed, False if rejected
        """
        self._total_requests += 1

        if self._state == CircuitState.CLOSED:
            self._accepted_requests += 1
            return True

        elif self._state == CircuitState.OPEN:
            self._rejected_requests += 1
            if self.on_rejection:
                try:
                    self.on_rejection("circuit_open")
                except Exception:
                    pass
            return False

        elif self._state == CircuitState.HALF_OPEN:
            # Allow limited requests for testing
            if self._half_open_requests < self.config.half_open_max_requests:
                self._half_open_requests += 1
                self._accepted_requests += 1
                return True
            else:
                self._rejected_requests += 1
                if self.on_rejection:
                    try:
                        self.on_rejection("half_open_limit")
                    except Exception:
                        pass
                return False

        return False

    def record_success(self) -> None:
        """Record a successful request (for half-open evaluation)."""
        if self._state == CircuitState.HALF_OPEN:
            self._half_open_successes += 1

    def record_failure(self) -> None:
        """Record a failed request (for half-open evaluation)."""
        self._recent_errors.append(time.monotonic())

        if self._state == CircuitState.HALF_OPEN:
            self._half_open_failures += 1

    async def force_open(self, reason: ActivationReason = ActivationReason.MANUAL) -> None:
        """Manually force the circuit open."""
        await self._transition_to(CircuitState.OPEN, reason)

    async def force_close(self) -> None:
        """Manually force the circuit closed."""
        await self._transition_to(CircuitState.CLOSED)

    async def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        self._state = CircuitState.CLOSED
        self._state_entered_at = time.monotonic()
        self._last_state_change = datetime.utcnow()

        self._total_requests = 0
        self._accepted_requests = 0
        self._rejected_requests = 0
        self._open_count = 0
        self._last_open_reason = None

        self._half_open_requests = 0
        self._half_open_successes = 0
        self._half_open_failures = 0

        self._current_backpressure = 0.0
        self._recent_errors.clear()

        logger.info("Circuit breaker reset")

    def get_stats(self) -> CircuitBreakerStats:
        """Get current circuit breaker statistics."""
        now = time.monotonic()

        return CircuitBreakerStats(
            state=self._state,
            backpressure=self._current_backpressure,
            total_requests=self._total_requests,
            accepted_requests=self._accepted_requests,
            rejected_requests=self._rejected_requests,
            last_state_change=self._last_state_change,
            time_in_current_state=now - self._state_entered_at,
            open_count=self._open_count,
            last_open_reason=self._last_open_reason,
            half_open_successes=self._half_open_successes,
            half_open_failures=self._half_open_failures,
        )

    def get_stats_dict(self) -> dict:
        """Get statistics as a dictionary."""
        stats = self.get_stats()
        return {
            "state": stats.state.value,
            "backpressure": round(stats.backpressure, 4),
            "total_requests": stats.total_requests,
            "accepted_requests": stats.accepted_requests,
            "rejected_requests": stats.rejected_requests,
            "rejection_rate": (
                round(stats.rejected_requests / stats.total_requests, 4)
                if stats.total_requests > 0 else 0.0
            ),
            "last_state_change": (
                stats.last_state_change.isoformat()
                if stats.last_state_change else None
            ),
            "time_in_current_state": round(stats.time_in_current_state, 2),
            "open_count": stats.open_count,
            "last_open_reason": (
                stats.last_open_reason.value
                if stats.last_open_reason else None
            ),
            "half_open_successes": stats.half_open_successes,
            "half_open_failures": stats.half_open_failures,
        }
