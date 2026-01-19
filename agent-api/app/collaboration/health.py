"""
Health Check System for Collaboration Gateway

Provides:
- Liveness and readiness probes for K8s
- Component health monitoring
- Dependency health checks (Redis, storage)
- Aggregated health status
- Health check registry

Designed for production deployments with configurable checks.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from abc import ABC, abstractmethod

import logging

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class HealthCheckResult:
    """Result of a health check."""
    name: str
    status: HealthStatus
    message: Optional[str] = None
    latency_ms: Optional[float] = None
    details: dict = field(default_factory=dict)
    checked_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "status": self.status.value,
            "message": self.message,
            "latency_ms": self.latency_ms,
            "details": self.details,
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class AggregatedHealth:
    """Aggregated health status from multiple checks."""
    status: HealthStatus
    checks: list[HealthCheckResult]
    summary: str
    checked_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "status": self.status.value,
            "summary": self.summary,
            "checks": [c.to_dict() for c in self.checks],
            "checked_at": self.checked_at.isoformat(),
        }

    def is_healthy(self) -> bool:
        """Check if overall status is healthy."""
        return self.status == HealthStatus.HEALTHY

    def is_ready(self) -> bool:
        """Check if system is ready (healthy or degraded)."""
        return self.status in (HealthStatus.HEALTHY, HealthStatus.DEGRADED)


class HealthCheck(ABC):
    """Abstract base class for health checks."""

    def __init__(self, name: str, critical: bool = True, timeout: float = 5.0):
        self.name = name
        self.critical = critical  # If critical, unhealthy = system unhealthy
        self.timeout = timeout

    @abstractmethod
    async def check(self) -> HealthCheckResult:
        """Perform health check."""
        pass

    async def execute(self) -> HealthCheckResult:
        """Execute check with timeout and error handling."""
        start = time.monotonic()

        try:
            result = await asyncio.wait_for(self.check(), timeout=self.timeout)
            result.latency_ms = (time.monotonic() - start) * 1000
            return result
        except asyncio.TimeoutError:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                message=f"Health check timed out after {self.timeout}s",
                latency_ms=(time.monotonic() - start) * 1000,
            )
        except Exception as e:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
                latency_ms=(time.monotonic() - start) * 1000,
            )


class CallableHealthCheck(HealthCheck):
    """Health check from a callable function."""

    def __init__(
        self,
        name: str,
        check_func: Callable[[], Awaitable[HealthCheckResult]],
        critical: bool = True,
        timeout: float = 5.0
    ):
        super().__init__(name, critical, timeout)
        self._check_func = check_func

    async def check(self) -> HealthCheckResult:
        """Execute the callable."""
        return await self._check_func()


class PingHealthCheck(HealthCheck):
    """Simple ping health check."""

    async def check(self) -> HealthCheckResult:
        """Always returns healthy."""
        return HealthCheckResult(
            name=self.name,
            status=HealthStatus.HEALTHY,
            message="Ping successful",
        )


class MemoryHealthCheck(HealthCheck):
    """Check system memory usage."""

    def __init__(
        self,
        name: str = "memory",
        warning_threshold: float = 0.8,
        critical_threshold: float = 0.95,
        **kwargs
    ):
        super().__init__(name, **kwargs)
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold

    async def check(self) -> HealthCheckResult:
        """Check memory usage."""
        try:
            import psutil
            memory = psutil.virtual_memory()
            usage = memory.percent / 100

            if usage >= self.critical_threshold:
                status = HealthStatus.UNHEALTHY
                message = f"Critical memory usage: {usage:.1%}"
            elif usage >= self.warning_threshold:
                status = HealthStatus.DEGRADED
                message = f"High memory usage: {usage:.1%}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Memory usage: {usage:.1%}"

            return HealthCheckResult(
                name=self.name,
                status=status,
                message=message,
                details={
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "percent": memory.percent,
                },
            )
        except ImportError:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNKNOWN,
                message="psutil not available",
            )


class DiskHealthCheck(HealthCheck):
    """Check disk space usage."""

    def __init__(
        self,
        name: str = "disk",
        path: str = "/",
        warning_threshold: float = 0.8,
        critical_threshold: float = 0.95,
        **kwargs
    ):
        super().__init__(name, **kwargs)
        self.path = path
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold

    async def check(self) -> HealthCheckResult:
        """Check disk usage."""
        try:
            import psutil
            disk = psutil.disk_usage(self.path)
            usage = disk.percent / 100

            if usage >= self.critical_threshold:
                status = HealthStatus.UNHEALTHY
                message = f"Critical disk usage: {usage:.1%}"
            elif usage >= self.warning_threshold:
                status = HealthStatus.DEGRADED
                message = f"High disk usage: {usage:.1%}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Disk usage: {usage:.1%}"

            return HealthCheckResult(
                name=self.name,
                status=status,
                message=message,
                details={
                    "path": self.path,
                    "total_gb": round(disk.total / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "percent": disk.percent,
                },
            )
        except ImportError:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNKNOWN,
                message="psutil not available",
            )


class ComponentHealthCheck(HealthCheck):
    """Health check for a component with a health method."""

    def __init__(
        self,
        name: str,
        component: Any,
        health_method: str = "is_healthy",
        **kwargs
    ):
        super().__init__(name, **kwargs)
        self.component = component
        self.health_method = health_method

    async def check(self) -> HealthCheckResult:
        """Check component health."""
        method = getattr(self.component, self.health_method, None)

        if method is None:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNKNOWN,
                message=f"Component has no {self.health_method} method",
            )

        try:
            if asyncio.iscoroutinefunction(method):
                is_healthy = await method()
            else:
                is_healthy = method()

            if is_healthy:
                return HealthCheckResult(
                    name=self.name,
                    status=HealthStatus.HEALTHY,
                    message="Component is healthy",
                )
            else:
                return HealthCheckResult(
                    name=self.name,
                    status=HealthStatus.UNHEALTHY,
                    message="Component is unhealthy",
                )
        except Exception as e:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
            )


class RedisHealthCheck(HealthCheck):
    """Health check for Redis connection."""

    def __init__(self, name: str = "redis", redis_client: Any = None, **kwargs):
        super().__init__(name, **kwargs)
        self.redis_client = redis_client

    async def check(self) -> HealthCheckResult:
        """Check Redis connectivity."""
        if self.redis_client is None:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNKNOWN,
                message="Redis client not configured",
            )

        try:
            # Try PING command
            if hasattr(self.redis_client, 'ping'):
                if asyncio.iscoroutinefunction(self.redis_client.ping):
                    await self.redis_client.ping()
                else:
                    self.redis_client.ping()

            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.HEALTHY,
                message="Redis connection healthy",
            )
        except Exception as e:
            return HealthCheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                message=f"Redis connection failed: {str(e)}",
            )


class HealthCheckRegistry:
    """Registry for health checks."""

    def __init__(self):
        self._checks: dict[str, HealthCheck] = {}
        self._cache: dict[str, tuple[HealthCheckResult, datetime]] = {}
        self._cache_ttl = timedelta(seconds=5)
        self._lock = asyncio.Lock()

    def register(self, check: HealthCheck) -> None:
        """Register a health check."""
        self._checks[check.name] = check

    def unregister(self, name: str) -> bool:
        """Unregister a health check."""
        if name in self._checks:
            del self._checks[name]
            return True
        return False

    def get_check(self, name: str) -> Optional[HealthCheck]:
        """Get a health check by name."""
        return self._checks.get(name)

    def list_checks(self) -> list[str]:
        """List all registered check names."""
        return list(self._checks.keys())

    async def run_check(
        self,
        name: str,
        use_cache: bool = True
    ) -> Optional[HealthCheckResult]:
        """Run a single health check."""
        check = self._checks.get(name)
        if not check:
            return None

        # Check cache
        if use_cache and name in self._cache:
            result, cached_at = self._cache[name]
            if datetime.utcnow() - cached_at < self._cache_ttl:
                return result

        # Execute check
        result = await check.execute()

        # Update cache
        async with self._lock:
            self._cache[name] = (result, datetime.utcnow())

        return result

    async def run_all(
        self,
        use_cache: bool = True,
        parallel: bool = True
    ) -> list[HealthCheckResult]:
        """Run all health checks."""
        if parallel:
            tasks = [
                self.run_check(name, use_cache)
                for name in self._checks
            ]
            results = await asyncio.gather(*tasks)
            return [r for r in results if r is not None]
        else:
            results = []
            for name in self._checks:
                result = await self.run_check(name, use_cache)
                if result:
                    results.append(result)
            return results

    async def get_aggregated_health(
        self,
        use_cache: bool = True
    ) -> AggregatedHealth:
        """Get aggregated health status."""
        results = await self.run_all(use_cache)

        if not results:
            return AggregatedHealth(
                status=HealthStatus.UNKNOWN,
                checks=[],
                summary="No health checks registered",
            )

        # Determine overall status
        has_unhealthy_critical = False
        has_degraded = False
        has_unhealthy_non_critical = False

        for result in results:
            check = self._checks.get(result.name)
            is_critical = check.critical if check else True

            if result.status == HealthStatus.UNHEALTHY:
                if is_critical:
                    has_unhealthy_critical = True
                else:
                    has_unhealthy_non_critical = True
            elif result.status == HealthStatus.DEGRADED:
                has_degraded = True

        if has_unhealthy_critical:
            status = HealthStatus.UNHEALTHY
            summary = "System is unhealthy - critical component failure"
        elif has_degraded or has_unhealthy_non_critical:
            status = HealthStatus.DEGRADED
            summary = "System is degraded - some components have issues"
        else:
            status = HealthStatus.HEALTHY
            summary = "All systems operational"

        return AggregatedHealth(
            status=status,
            checks=results,
            summary=summary,
        )

    def clear_cache(self) -> None:
        """Clear the results cache."""
        self._cache.clear()


class HealthManager:
    """Manages health checks with liveness/readiness support."""

    def __init__(self, registry: Optional[HealthCheckRegistry] = None):
        self.registry = registry or HealthCheckRegistry()
        self._started_at = datetime.utcnow()
        self._ready = False
        self._live = True

        # Register default checks
        self.registry.register(PingHealthCheck("ping", critical=False))

    def set_ready(self, ready: bool) -> None:
        """Set readiness state."""
        self._ready = ready

    def set_live(self, live: bool) -> None:
        """Set liveness state."""
        self._live = live

    async def liveness(self) -> HealthCheckResult:
        """K8s liveness probe - is the application alive?"""
        if not self._live:
            return HealthCheckResult(
                name="liveness",
                status=HealthStatus.UNHEALTHY,
                message="Application marked as not live",
            )

        # Check critical components only
        results = await self.registry.run_all(use_cache=True)

        for result in results:
            check = self.registry.get_check(result.name)
            if check and check.critical and result.status == HealthStatus.UNHEALTHY:
                return HealthCheckResult(
                    name="liveness",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Critical component {result.name} is unhealthy",
                    details={"failed_check": result.to_dict()},
                )

        return HealthCheckResult(
            name="liveness",
            status=HealthStatus.HEALTHY,
            message="Application is alive",
            details={"uptime_seconds": (datetime.utcnow() - self._started_at).total_seconds()},
        )

    async def readiness(self) -> HealthCheckResult:
        """K8s readiness probe - is the application ready to serve traffic?"""
        if not self._ready:
            return HealthCheckResult(
                name="readiness",
                status=HealthStatus.UNHEALTHY,
                message="Application not ready",
            )

        aggregated = await self.registry.get_aggregated_health()

        if aggregated.is_ready():
            return HealthCheckResult(
                name="readiness",
                status=HealthStatus.HEALTHY,
                message="Application is ready",
            )
        else:
            return HealthCheckResult(
                name="readiness",
                status=HealthStatus.UNHEALTHY,
                message="Application not ready - health checks failing",
                details={"health": aggregated.to_dict()},
            )

    async def health(self) -> AggregatedHealth:
        """Get full health status."""
        return await self.registry.get_aggregated_health()

    def get_uptime(self) -> timedelta:
        """Get application uptime."""
        return datetime.utcnow() - self._started_at

    def get_info(self) -> dict:
        """Get health manager info."""
        return {
            "started_at": self._started_at.isoformat(),
            "uptime_seconds": self.get_uptime().total_seconds(),
            "ready": self._ready,
            "live": self._live,
            "registered_checks": self.registry.list_checks(),
        }


# Global health manager
_health_manager: Optional[HealthManager] = None


def get_health_manager() -> HealthManager:
    """Get global health manager."""
    global _health_manager
    if _health_manager is None:
        _health_manager = HealthManager()
    return _health_manager


def set_health_manager(manager: HealthManager) -> None:
    """Set global health manager."""
    global _health_manager
    _health_manager = manager


def reset_health_manager() -> None:
    """Reset global health manager."""
    global _health_manager
    _health_manager = None
