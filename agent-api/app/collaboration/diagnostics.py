"""
System Diagnostics for Collaboration Gateway

Provides:
- System information collection
- Performance metrics
- Debug information
- Configuration inspection
- Troubleshooting helpers

Designed for operational debugging and support.
"""

from __future__ import annotations

import asyncio
import sys
import os
import platform
from typing import Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import deque

import logging

logger = logging.getLogger(__name__)


@dataclass
class SystemInfo:
    """System information."""
    hostname: str
    platform: str
    platform_version: str
    python_version: str
    python_implementation: str
    cpu_count: int
    pid: int
    cwd: str
    collected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "hostname": self.hostname,
            "platform": self.platform,
            "platform_version": self.platform_version,
            "python_version": self.python_version,
            "python_implementation": self.python_implementation,
            "cpu_count": self.cpu_count,
            "pid": self.pid,
            "cwd": self.cwd,
            "collected_at": self.collected_at.isoformat(),
        }


@dataclass
class MemoryInfo:
    """Memory information."""
    total_mb: float
    available_mb: float
    used_mb: float
    percent: float
    collected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_mb": round(self.total_mb, 2),
            "available_mb": round(self.available_mb, 2),
            "used_mb": round(self.used_mb, 2),
            "percent": round(self.percent, 2),
            "collected_at": self.collected_at.isoformat(),
        }


@dataclass
class ProcessInfo:
    """Process information."""
    pid: int
    memory_mb: float
    memory_percent: float
    cpu_percent: float
    threads: int
    open_files: int
    connections: int
    collected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "pid": self.pid,
            "memory_mb": round(self.memory_mb, 2),
            "memory_percent": round(self.memory_percent, 2),
            "cpu_percent": round(self.cpu_percent, 2),
            "threads": self.threads,
            "open_files": self.open_files,
            "connections": self.connections,
            "collected_at": self.collected_at.isoformat(),
        }


@dataclass
class ComponentStatus:
    """Status of a system component."""
    name: str
    status: str
    message: Optional[str] = None
    stats: dict = field(default_factory=dict)
    collected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
            "stats": self.stats,
            "collected_at": self.collected_at.isoformat(),
        }


@dataclass
class DiagnosticReport:
    """Complete diagnostic report."""
    system: SystemInfo
    memory: Optional[MemoryInfo]
    process: Optional[ProcessInfo]
    components: list[ComponentStatus]
    environment: dict
    configuration: dict
    generated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "system": self.system.to_dict(),
            "memory": self.memory.to_dict() if self.memory else None,
            "process": self.process.to_dict() if self.process else None,
            "components": [c.to_dict() for c in self.components],
            "environment": self.environment,
            "configuration": self.configuration,
            "generated_at": self.generated_at.isoformat(),
        }


class DiagnosticCollector:
    """Collects diagnostic information."""

    def __init__(self):
        self._components: dict[str, Callable[[], ComponentStatus]] = {}
        self._config_providers: dict[str, Callable[[], dict]] = {}
        self._env_allowlist: set[str] = {
            "PYTHONPATH", "PYTHONHASHSEED", "LANG", "LC_ALL",
            "TZ", "HOME", "USER", "PATH",
        }
        self._env_prefix_allowlist: set[str] = {
            "COLLAB_", "APP_", "LOG_", "DEBUG",
        }

    def register_component(
        self,
        name: str,
        status_func: Callable[[], ComponentStatus]
    ) -> None:
        """Register a component for status collection."""
        self._components[name] = status_func

    def register_config_provider(
        self,
        name: str,
        config_func: Callable[[], dict]
    ) -> None:
        """Register a configuration provider."""
        self._config_providers[name] = config_func

    def allow_env_var(self, name: str) -> None:
        """Add environment variable to allowlist."""
        self._env_allowlist.add(name)

    def allow_env_prefix(self, prefix: str) -> None:
        """Add environment variable prefix to allowlist."""
        self._env_prefix_allowlist.add(prefix)

    def collect_system_info(self) -> SystemInfo:
        """Collect system information."""
        return SystemInfo(
            hostname=platform.node(),
            platform=platform.system(),
            platform_version=platform.version(),
            python_version=platform.python_version(),
            python_implementation=platform.python_implementation(),
            cpu_count=os.cpu_count() or 0,
            pid=os.getpid(),
            cwd=os.getcwd(),
        )

    def collect_memory_info(self) -> Optional[MemoryInfo]:
        """Collect memory information."""
        try:
            import psutil
            mem = psutil.virtual_memory()
            return MemoryInfo(
                total_mb=mem.total / (1024 * 1024),
                available_mb=mem.available / (1024 * 1024),
                used_mb=mem.used / (1024 * 1024),
                percent=mem.percent,
            )
        except ImportError:
            return None

    def collect_process_info(self) -> Optional[ProcessInfo]:
        """Collect process information."""
        try:
            import psutil
            proc = psutil.Process()

            with proc.oneshot():
                mem_info = proc.memory_info()
                return ProcessInfo(
                    pid=proc.pid,
                    memory_mb=mem_info.rss / (1024 * 1024),
                    memory_percent=proc.memory_percent(),
                    cpu_percent=proc.cpu_percent(),
                    threads=proc.num_threads(),
                    open_files=len(proc.open_files()),
                    connections=len(proc.connections()),
                )
        except ImportError:
            return None
        except Exception as e:
            logger.warning(f"Failed to collect process info: {e}")
            return None

    def collect_component_status(self) -> list[ComponentStatus]:
        """Collect status from all registered components."""
        statuses = []

        for name, func in self._components.items():
            try:
                status = func()
                statuses.append(status)
            except Exception as e:
                statuses.append(ComponentStatus(
                    name=name,
                    status="error",
                    message=f"Failed to collect status: {str(e)}",
                ))

        return statuses

    def collect_environment(self) -> dict:
        """Collect filtered environment variables."""
        env = {}

        for key, value in os.environ.items():
            # Check exact match
            if key in self._env_allowlist:
                env[key] = value
                continue

            # Check prefix match
            for prefix in self._env_prefix_allowlist:
                if key.startswith(prefix):
                    env[key] = value
                    break

        return env

    def collect_configuration(self) -> dict:
        """Collect configuration from providers."""
        config = {}

        for name, func in self._config_providers.items():
            try:
                config[name] = func()
            except Exception as e:
                config[name] = {"error": str(e)}

        return config

    def generate_report(self) -> DiagnosticReport:
        """Generate a complete diagnostic report."""
        return DiagnosticReport(
            system=self.collect_system_info(),
            memory=self.collect_memory_info(),
            process=self.collect_process_info(),
            components=self.collect_component_status(),
            environment=self.collect_environment(),
            configuration=self.collect_configuration(),
        )


class PerformanceMonitor:
    """Monitors performance metrics over time."""

    def __init__(self, history_size: int = 60):
        self._history_size = history_size
        self._request_times: deque = deque(maxlen=history_size)
        self._error_counts: deque = deque(maxlen=history_size)
        self._active_connections: deque = deque(maxlen=history_size)
        self._lock = asyncio.Lock()

        # Current counters
        self._total_requests = 0
        self._total_errors = 0
        self._current_connections = 0

    async def record_request(self, duration_ms: float) -> None:
        """Record a request duration."""
        async with self._lock:
            self._request_times.append((datetime.utcnow(), duration_ms))
            self._total_requests += 1

    async def record_error(self) -> None:
        """Record an error."""
        async with self._lock:
            self._error_counts.append(datetime.utcnow())
            self._total_errors += 1

    async def set_connections(self, count: int) -> None:
        """Set current connection count."""
        async with self._lock:
            self._current_connections = count
            self._active_connections.append((datetime.utcnow(), count))

    def get_request_stats(self, window_seconds: int = 60) -> dict:
        """Get request statistics for time window."""
        cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
        recent = [(t, d) for t, d in self._request_times if t > cutoff]

        if not recent:
            return {
                "count": 0,
                "avg_ms": 0,
                "min_ms": 0,
                "max_ms": 0,
                "p50_ms": 0,
                "p95_ms": 0,
                "p99_ms": 0,
            }

        durations = sorted([d for _, d in recent])
        count = len(durations)

        return {
            "count": count,
            "avg_ms": sum(durations) / count,
            "min_ms": durations[0],
            "max_ms": durations[-1],
            "p50_ms": durations[count // 2],
            "p95_ms": durations[int(count * 0.95)] if count > 20 else durations[-1],
            "p99_ms": durations[int(count * 0.99)] if count > 100 else durations[-1],
        }

    def get_error_rate(self, window_seconds: int = 60) -> float:
        """Get error rate for time window."""
        cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
        recent_errors = sum(1 for t in self._error_counts if t > cutoff)
        recent_requests = sum(1 for t, _ in self._request_times if t > cutoff)

        if recent_requests == 0:
            return 0.0

        return recent_errors / recent_requests

    def get_summary(self) -> dict:
        """Get performance summary."""
        return {
            "total_requests": self._total_requests,
            "total_errors": self._total_errors,
            "current_connections": self._current_connections,
            "request_stats": self.get_request_stats(),
            "error_rate": self.get_error_rate(),
        }


class DebugContext:
    """Context for debugging operations."""

    def __init__(self, max_entries: int = 1000):
        self._max_entries = max_entries
        self._log_entries: deque = deque(maxlen=max_entries)
        self._trace_enabled = False
        self._lock = asyncio.Lock()

    def enable_trace(self) -> None:
        """Enable trace logging."""
        self._trace_enabled = True

    def disable_trace(self) -> None:
        """Disable trace logging."""
        self._trace_enabled = False

    @property
    def trace_enabled(self) -> bool:
        """Check if trace is enabled."""
        return self._trace_enabled

    async def log(
        self,
        level: str,
        message: str,
        context: Optional[dict] = None
    ) -> None:
        """Log a debug entry."""
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "context": context or {},
        }

        async with self._lock:
            self._log_entries.append(entry)

    async def trace(self, message: str, context: Optional[dict] = None) -> None:
        """Log a trace entry (only if tracing enabled)."""
        if self._trace_enabled:
            await self.log("trace", message, context)

    def get_recent_logs(self, count: int = 100) -> list[dict]:
        """Get recent log entries."""
        entries = list(self._log_entries)
        return entries[-count:]

    def clear_logs(self) -> int:
        """Clear all log entries."""
        count = len(self._log_entries)
        self._log_entries.clear()
        return count

    def get_stats(self) -> dict:
        """Get debug context stats."""
        return {
            "trace_enabled": self._trace_enabled,
            "log_entries": len(self._log_entries),
            "max_entries": self._max_entries,
        }


class DiagnosticsManager:
    """Manages all diagnostic capabilities."""

    def __init__(self):
        self.collector = DiagnosticCollector()
        self.performance = PerformanceMonitor()
        self.debug = DebugContext()
        self._started_at = datetime.utcnow()

    def get_uptime(self) -> timedelta:
        """Get manager uptime."""
        return datetime.utcnow() - self._started_at

    def get_quick_status(self) -> dict:
        """Get a quick status overview."""
        return {
            "uptime_seconds": self.get_uptime().total_seconds(),
            "performance": self.performance.get_summary(),
            "debug": self.debug.get_stats(),
        }

    def get_full_report(self) -> DiagnosticReport:
        """Get full diagnostic report."""
        return self.collector.generate_report()

    def to_dict(self) -> dict:
        """Get complete diagnostics as dictionary."""
        return {
            "uptime_seconds": self.get_uptime().total_seconds(),
            "started_at": self._started_at.isoformat(),
            "report": self.get_full_report().to_dict(),
            "performance": self.performance.get_summary(),
            "debug": self.debug.get_stats(),
        }


# Global diagnostics manager
_diagnostics: Optional[DiagnosticsManager] = None


def get_diagnostics() -> DiagnosticsManager:
    """Get global diagnostics manager."""
    global _diagnostics
    if _diagnostics is None:
        _diagnostics = DiagnosticsManager()
    return _diagnostics


def set_diagnostics(manager: DiagnosticsManager) -> None:
    """Set global diagnostics manager."""
    global _diagnostics
    _diagnostics = manager


def reset_diagnostics() -> None:
    """Reset global diagnostics manager."""
    global _diagnostics
    _diagnostics = None
