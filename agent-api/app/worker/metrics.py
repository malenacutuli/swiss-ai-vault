"""
Prometheus Metrics Server for Agent Worker

Provides /metrics endpoint for Prometheus scraping.
Enterprise-grade metrics matching Manus.im BullMQ Worker specification.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Optional, Dict, Any
from aiohttp import web

logger = logging.getLogger(__name__)

# Try to import prometheus_client, gracefully degrade if not available
try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Info,
        generate_latest,
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        REGISTRY,
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed, metrics will be disabled")


class MetricsServer:
    """
    HTTP server for Prometheus metrics endpoint.

    Exposes metrics at /metrics for Prometheus to scrape.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 9090,
        redis_client=None,
        job_queue=None,
    ):
        self.host = host
        self.port = port
        self.redis_client = redis_client
        self.job_queue = job_queue

        self._app: Optional[web.Application] = None
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None

        # Initialize metrics if prometheus_client is available
        if PROMETHEUS_AVAILABLE:
            self._init_metrics()

    def _init_metrics(self):
        """Initialize Prometheus metrics."""
        # Worker info
        self.worker_info = Info(
            "agent_worker",
            "Agent worker information",
        )
        self.worker_info.info({
            "version": "1.0.0",
            "component": "worker",
        })

        # =================================================================
        # Job Metrics
        # =================================================================

        # Jobs processed counter
        self.jobs_processed_total = Counter(
            "agent_jobs_processed_total",
            "Total number of jobs processed",
            ["status"],  # success, failed
        )

        # Jobs completed counter (alias for compatibility)
        self.jobs_completed_total = Counter(
            "agent_jobs_completed_total",
            "Total number of jobs completed successfully",
        )

        # Jobs failed counter (alias for compatibility)
        self.jobs_failed_total = Counter(
            "agent_jobs_failed_total",
            "Total number of jobs that failed",
        )

        # Job duration histogram
        self.job_duration_seconds = Histogram(
            "agent_job_duration_seconds",
            "Job processing duration in seconds",
            buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
        )

        # Jobs in progress gauge
        self.jobs_in_progress = Gauge(
            "agent_jobs_in_progress",
            "Number of jobs currently being processed",
        )

        # =================================================================
        # Queue Metrics
        # =================================================================

        # Queue depth gauge
        self.queue_depth = Gauge(
            "agent_queue_depth",
            "Current depth of job queues",
            ["queue"],  # pending, high_priority, processing, retry, failed
        )

        # =================================================================
        # Sandbox Metrics
        # =================================================================

        # Active sandboxes gauge
        self.active_sandboxes = Gauge(
            "agent_active_sandboxes",
            "Number of active E2B sandboxes",
        )

        # Sandbox creation counter
        self.sandbox_created_total = Counter(
            "agent_sandbox_created_total",
            "Total number of sandboxes created",
        )

        # Sandbox errors counter
        self.sandbox_errors_total = Counter(
            "agent_sandbox_errors_total",
            "Total number of sandbox errors",
        )

        # =================================================================
        # Redis Metrics
        # =================================================================

        # Redis connection errors counter
        self.redis_connection_errors_total = Counter(
            "agent_redis_connection_errors_total",
            "Total number of Redis connection errors",
        )

        # Redis operation latency histogram
        self.redis_operation_seconds = Histogram(
            "agent_redis_operation_seconds",
            "Redis operation latency in seconds",
            ["operation"],  # get, set, lpush, brpop, etc.
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
        )

        # =================================================================
        # LLM Metrics
        # =================================================================

        # LLM requests counter
        self.llm_requests_total = Counter(
            "agent_llm_requests_total",
            "Total number of LLM API requests",
            ["provider", "model", "status"],
        )

        # LLM tokens counter
        self.llm_tokens_total = Counter(
            "agent_llm_tokens_total",
            "Total number of LLM tokens used",
            ["provider", "type"],  # type: input, output
        )

        # LLM latency histogram
        self.llm_request_seconds = Histogram(
            "agent_llm_request_seconds",
            "LLM request latency in seconds",
            ["provider", "model"],
            buckets=[0.5, 1, 2, 5, 10, 20, 30, 60],
        )

        # =================================================================
        # Tool Metrics
        # =================================================================

        # Tool execution counter
        self.tool_executions_total = Counter(
            "agent_tool_executions_total",
            "Total number of tool executions",
            ["tool", "status"],  # status: success, failed
        )

        # Tool execution duration histogram
        self.tool_duration_seconds = Histogram(
            "agent_tool_duration_seconds",
            "Tool execution duration in seconds",
            ["tool"],
            buckets=[0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
        )

        logger.info("Prometheus metrics initialized")

    async def start(self):
        """Start the metrics HTTP server."""
        self._app = web.Application()
        self._app.router.add_get("/metrics", self._metrics_handler)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        self._site = web.TCPSite(self._runner, self.host, self.port)
        await self._site.start()

        logger.info(f"Metrics server started on {self.host}:{self.port}")

    async def stop(self):
        """Stop the metrics HTTP server."""
        if self._runner:
            await self._runner.cleanup()
            logger.info("Metrics server stopped")

    async def _metrics_handler(self, request: web.Request) -> web.Response:
        """Handle /metrics endpoint requests."""
        if not PROMETHEUS_AVAILABLE:
            return web.Response(
                text="# prometheus_client not installed\n",
                content_type="text/plain",
            )

        # Update queue metrics before generating output
        await self._update_queue_metrics()

        # Generate Prometheus metrics output
        output = generate_latest(REGISTRY)
        return web.Response(
            body=output,
            content_type=CONTENT_TYPE_LATEST,
        )

    async def _update_queue_metrics(self):
        """Update queue depth metrics from Redis."""
        if not self.job_queue:
            return

        try:
            stats = self.job_queue.get_queue_stats()
            for queue_name, depth in stats.items():
                self.queue_depth.labels(queue=f"jobs:{queue_name}").set(depth)
        except Exception as e:
            logger.warning(f"Failed to update queue metrics: {e}")

    # =================================================================
    # Convenience methods for recording metrics
    # =================================================================

    def record_job_started(self):
        """Record that a job has started processing."""
        if PROMETHEUS_AVAILABLE:
            self.jobs_in_progress.inc()

    def record_job_completed(self, duration_seconds: float):
        """Record that a job completed successfully."""
        if PROMETHEUS_AVAILABLE:
            self.jobs_in_progress.dec()
            self.jobs_processed_total.labels(status="success").inc()
            self.jobs_completed_total.inc()
            self.job_duration_seconds.observe(duration_seconds)

    def record_job_failed(self, duration_seconds: float):
        """Record that a job failed."""
        if PROMETHEUS_AVAILABLE:
            self.jobs_in_progress.dec()
            self.jobs_processed_total.labels(status="failed").inc()
            self.jobs_failed_total.inc()
            self.job_duration_seconds.observe(duration_seconds)

    def record_sandbox_created(self):
        """Record that a sandbox was created."""
        if PROMETHEUS_AVAILABLE:
            self.sandbox_created_total.inc()

    def record_sandbox_error(self):
        """Record a sandbox error."""
        if PROMETHEUS_AVAILABLE:
            self.sandbox_errors_total.inc()

    def set_active_sandboxes(self, count: int):
        """Set the current number of active sandboxes."""
        if PROMETHEUS_AVAILABLE:
            self.active_sandboxes.set(count)

    def record_redis_error(self):
        """Record a Redis connection error."""
        if PROMETHEUS_AVAILABLE:
            self.redis_connection_errors_total.inc()

    def record_redis_operation(self, operation: str, duration_seconds: float):
        """Record a Redis operation duration."""
        if PROMETHEUS_AVAILABLE:
            self.redis_operation_seconds.labels(operation=operation).observe(duration_seconds)

    def record_llm_request(
        self,
        provider: str,
        model: str,
        success: bool,
        duration_seconds: float,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ):
        """Record an LLM API request."""
        if PROMETHEUS_AVAILABLE:
            status = "success" if success else "failed"
            self.llm_requests_total.labels(
                provider=provider, model=model, status=status
            ).inc()
            self.llm_request_seconds.labels(
                provider=provider, model=model
            ).observe(duration_seconds)
            if input_tokens > 0:
                self.llm_tokens_total.labels(
                    provider=provider, type="input"
                ).inc(input_tokens)
            if output_tokens > 0:
                self.llm_tokens_total.labels(
                    provider=provider, type="output"
                ).inc(output_tokens)

    def record_tool_execution(
        self,
        tool: str,
        success: bool,
        duration_seconds: float,
    ):
        """Record a tool execution."""
        if PROMETHEUS_AVAILABLE:
            status = "success" if success else "failed"
            self.tool_executions_total.labels(tool=tool, status=status).inc()
            self.tool_duration_seconds.labels(tool=tool).observe(duration_seconds)


# Singleton instance
_metrics_server: Optional[MetricsServer] = None


def get_metrics_server() -> Optional[MetricsServer]:
    """Get the singleton metrics server instance."""
    return _metrics_server


def create_metrics_server(
    host: str = "0.0.0.0",
    port: int = 9090,
    redis_client=None,
    job_queue=None,
) -> MetricsServer:
    """Create and return the singleton metrics server instance."""
    global _metrics_server
    if _metrics_server is None:
        _metrics_server = MetricsServer(
            host=host,
            port=port,
            redis_client=redis_client,
            job_queue=job_queue,
        )
    return _metrics_server
