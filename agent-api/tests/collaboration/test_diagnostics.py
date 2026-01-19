"""Tests for System Diagnostics."""

import pytest
import asyncio
import os
from datetime import datetime, timedelta

from app.collaboration.diagnostics import (
    DiagnosticsManager,
    DiagnosticCollector,
    DiagnosticReport,
    SystemInfo,
    MemoryInfo,
    ProcessInfo,
    ComponentStatus,
    PerformanceMonitor,
    DebugContext,
    get_diagnostics,
    set_diagnostics,
    reset_diagnostics,
)


class TestSystemInfo:
    """Tests for SystemInfo."""

    def test_create_system_info(self):
        """Create system info."""
        info = SystemInfo(
            hostname="testhost",
            platform="Linux",
            platform_version="5.4.0",
            python_version="3.11.0",
            python_implementation="CPython",
            cpu_count=4,
            pid=1234,
            cwd="/home/test",
        )

        assert info.hostname == "testhost"
        assert info.cpu_count == 4

    def test_to_dict(self):
        """Convert to dictionary."""
        info = SystemInfo(
            hostname="testhost",
            platform="Linux",
            platform_version="5.4.0",
            python_version="3.11.0",
            python_implementation="CPython",
            cpu_count=4,
            pid=1234,
            cwd="/home/test",
        )

        d = info.to_dict()

        assert d["hostname"] == "testhost"
        assert d["cpu_count"] == 4


class TestMemoryInfo:
    """Tests for MemoryInfo."""

    def test_create_memory_info(self):
        """Create memory info."""
        info = MemoryInfo(
            total_mb=16384,
            available_mb=8192,
            used_mb=8192,
            percent=50.0,
        )

        assert info.total_mb == 16384
        assert info.percent == 50.0

    def test_to_dict(self):
        """Convert to dictionary."""
        info = MemoryInfo(
            total_mb=16384,
            available_mb=8192,
            used_mb=8192,
            percent=50.0,
        )

        d = info.to_dict()

        assert d["total_mb"] == 16384
        assert d["percent"] == 50.0


class TestProcessInfo:
    """Tests for ProcessInfo."""

    def test_create_process_info(self):
        """Create process info."""
        info = ProcessInfo(
            pid=1234,
            memory_mb=256,
            memory_percent=1.5,
            cpu_percent=5.0,
            threads=10,
            open_files=50,
            connections=5,
        )

        assert info.pid == 1234
        assert info.threads == 10

    def test_to_dict(self):
        """Convert to dictionary."""
        info = ProcessInfo(
            pid=1234,
            memory_mb=256,
            memory_percent=1.5,
            cpu_percent=5.0,
            threads=10,
            open_files=50,
            connections=5,
        )

        d = info.to_dict()

        assert d["pid"] == 1234
        assert d["threads"] == 10


class TestComponentStatus:
    """Tests for ComponentStatus."""

    def test_create_component_status(self):
        """Create component status."""
        status = ComponentStatus(
            name="database",
            status="healthy",
            message="Connection OK",
            stats={"connections": 5},
        )

        assert status.name == "database"
        assert status.status == "healthy"

    def test_to_dict(self):
        """Convert to dictionary."""
        status = ComponentStatus(
            name="database",
            status="healthy",
            message="Connection OK",
        )

        d = status.to_dict()

        assert d["name"] == "database"
        assert d["status"] == "healthy"


class TestDiagnosticCollector:
    """Tests for DiagnosticCollector."""

    @pytest.fixture
    def collector(self):
        return DiagnosticCollector()

    def test_collect_system_info(self, collector):
        """Collect system information."""
        info = collector.collect_system_info()

        assert info.hostname is not None
        assert info.platform is not None
        assert info.python_version is not None
        assert info.pid > 0

    def test_collect_memory_info(self, collector):
        """Collect memory information."""
        info = collector.collect_memory_info()

        # May be None if psutil not available
        if info is not None:
            assert info.total_mb > 0
            assert 0 <= info.percent <= 100

    def test_collect_process_info(self, collector):
        """Collect process information."""
        info = collector.collect_process_info()

        # May be None if psutil not available
        if info is not None:
            assert info.pid > 0
            assert info.threads > 0

    def test_register_component(self, collector):
        """Register a component for status collection."""
        def get_status():
            return ComponentStatus(
                name="test",
                status="healthy",
            )

        collector.register_component("test", get_status)
        statuses = collector.collect_component_status()

        assert len(statuses) == 1
        assert statuses[0].name == "test"

    def test_register_config_provider(self, collector):
        """Register a config provider."""
        def get_config():
            return {"setting": "value"}

        collector.register_config_provider("app", get_config)
        config = collector.collect_configuration()

        assert "app" in config
        assert config["app"]["setting"] == "value"

    def test_collect_environment(self, collector):
        """Collect filtered environment variables."""
        # Set a test env var that matches the allowlist
        os.environ["COLLAB_TEST_VAR"] = "test_value"

        env = collector.collect_environment()

        assert "COLLAB_TEST_VAR" in env
        assert env["COLLAB_TEST_VAR"] == "test_value"

        # Cleanup
        del os.environ["COLLAB_TEST_VAR"]

    def test_allow_env_var(self, collector):
        """Add env var to allowlist."""
        os.environ["MY_CUSTOM_VAR"] = "custom"
        collector.allow_env_var("MY_CUSTOM_VAR")

        env = collector.collect_environment()

        assert "MY_CUSTOM_VAR" in env

        del os.environ["MY_CUSTOM_VAR"]

    def test_generate_report(self, collector):
        """Generate complete diagnostic report."""
        report = collector.generate_report()

        assert isinstance(report, DiagnosticReport)
        assert report.system is not None

    def test_component_error_handling(self, collector):
        """Handle errors in component status collection."""
        def failing_status():
            raise ValueError("Component error")

        collector.register_component("failing", failing_status)
        statuses = collector.collect_component_status()

        assert len(statuses) == 1
        assert statuses[0].status == "error"


class TestPerformanceMonitor:
    """Tests for PerformanceMonitor."""

    @pytest.fixture
    def monitor(self):
        return PerformanceMonitor()

    @pytest.mark.asyncio
    async def test_record_request(self, monitor):
        """Record request duration."""
        await monitor.record_request(10.5)
        await monitor.record_request(15.0)

        stats = monitor.get_request_stats()

        assert stats["count"] == 2
        assert stats["avg_ms"] > 0

    @pytest.mark.asyncio
    async def test_record_error(self, monitor):
        """Record an error."""
        await monitor.record_error()
        await monitor.record_error()

        assert monitor._total_errors == 2

    @pytest.mark.asyncio
    async def test_set_connections(self, monitor):
        """Set connection count."""
        await monitor.set_connections(10)

        assert monitor._current_connections == 10

    def test_get_request_stats_empty(self, monitor):
        """Get request stats when empty."""
        stats = monitor.get_request_stats()

        assert stats["count"] == 0
        assert stats["avg_ms"] == 0

    @pytest.mark.asyncio
    async def test_get_request_stats_with_data(self, monitor):
        """Get request stats with data."""
        for i in range(10):
            await monitor.record_request(float(i * 10))

        stats = monitor.get_request_stats()

        assert stats["count"] == 10
        assert stats["min_ms"] == 0
        assert stats["max_ms"] == 90

    @pytest.mark.asyncio
    async def test_get_error_rate(self, monitor):
        """Calculate error rate."""
        for _ in range(10):
            await monitor.record_request(1.0)
        await monitor.record_error()

        error_rate = monitor.get_error_rate()

        assert 0 < error_rate < 1

    def test_get_error_rate_no_requests(self, monitor):
        """Error rate with no requests."""
        error_rate = monitor.get_error_rate()

        assert error_rate == 0.0

    @pytest.mark.asyncio
    async def test_get_summary(self, monitor):
        """Get performance summary."""
        await monitor.record_request(10.0)
        await monitor.set_connections(5)

        summary = monitor.get_summary()

        assert summary["total_requests"] == 1
        assert summary["current_connections"] == 5


class TestDebugContext:
    """Tests for DebugContext."""

    @pytest.fixture
    def debug(self):
        return DebugContext()

    def test_enable_trace(self, debug):
        """Enable trace logging."""
        debug.enable_trace()
        assert debug.trace_enabled is True

    def test_disable_trace(self, debug):
        """Disable trace logging."""
        debug.enable_trace()
        debug.disable_trace()
        assert debug.trace_enabled is False

    @pytest.mark.asyncio
    async def test_log_entry(self, debug):
        """Log a debug entry."""
        await debug.log("info", "Test message", {"key": "value"})

        logs = debug.get_recent_logs()

        assert len(logs) == 1
        assert logs[0]["message"] == "Test message"
        assert logs[0]["level"] == "info"

    @pytest.mark.asyncio
    async def test_trace_when_enabled(self, debug):
        """Trace logs when enabled."""
        debug.enable_trace()
        await debug.trace("Trace message")

        logs = debug.get_recent_logs()

        assert len(logs) == 1
        assert logs[0]["level"] == "trace"

    @pytest.mark.asyncio
    async def test_trace_when_disabled(self, debug):
        """Trace does nothing when disabled."""
        await debug.trace("Trace message")

        logs = debug.get_recent_logs()

        assert len(logs) == 0

    @pytest.mark.asyncio
    async def test_get_recent_logs(self, debug):
        """Get recent log entries."""
        for i in range(10):
            await debug.log("info", f"Message {i}")

        logs = debug.get_recent_logs(5)

        assert len(logs) == 5

    @pytest.mark.asyncio
    async def test_clear_logs(self, debug):
        """Clear all log entries."""
        await debug.log("info", "Test")
        await debug.log("info", "Test 2")

        count = debug.clear_logs()

        assert count == 2
        assert len(debug.get_recent_logs()) == 0

    def test_get_stats(self, debug):
        """Get debug context stats."""
        debug.enable_trace()

        stats = debug.get_stats()

        assert stats["trace_enabled"] is True
        assert "log_entries" in stats


class TestDiagnosticsManager:
    """Tests for DiagnosticsManager."""

    @pytest.fixture
    def manager(self):
        return DiagnosticsManager()

    def test_get_uptime(self, manager):
        """Get manager uptime."""
        uptime = manager.get_uptime()

        assert isinstance(uptime, timedelta)
        assert uptime.total_seconds() >= 0

    def test_get_quick_status(self, manager):
        """Get quick status overview."""
        status = manager.get_quick_status()

        assert "uptime_seconds" in status
        assert "performance" in status
        assert "debug" in status

    def test_get_full_report(self, manager):
        """Get full diagnostic report."""
        report = manager.get_full_report()

        assert isinstance(report, DiagnosticReport)

    def test_to_dict(self, manager):
        """Get complete diagnostics as dictionary."""
        d = manager.to_dict()

        assert "uptime_seconds" in d
        assert "report" in d
        assert "performance" in d


class TestDiagnosticReport:
    """Tests for DiagnosticReport."""

    def test_to_dict(self):
        """Convert report to dictionary."""
        report = DiagnosticReport(
            system=SystemInfo(
                hostname="test",
                platform="Linux",
                platform_version="5.4",
                python_version="3.11",
                python_implementation="CPython",
                cpu_count=4,
                pid=1234,
                cwd="/home",
            ),
            memory=None,
            process=None,
            components=[],
            environment={},
            configuration={},
        )

        d = report.to_dict()

        assert "system" in d
        assert d["system"]["hostname"] == "test"


class TestGlobalDiagnostics:
    """Tests for global diagnostics functions."""

    def test_get_diagnostics(self):
        """Get global diagnostics manager."""
        reset_diagnostics()

        manager = get_diagnostics()

        assert manager is not None
        assert isinstance(manager, DiagnosticsManager)

    def test_set_diagnostics(self):
        """Set global diagnostics manager."""
        reset_diagnostics()

        custom = DiagnosticsManager()
        set_diagnostics(custom)

        assert get_diagnostics() is custom

    def test_reset_diagnostics(self):
        """Reset global diagnostics manager."""
        get_diagnostics()

        reset_diagnostics()

        # Next call creates a new one
        manager = get_diagnostics()
        assert manager is not None
