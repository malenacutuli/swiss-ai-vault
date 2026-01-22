"""
Health Check HTTP Server for Agent Worker

Provides /health/live, /health/ready, and /health/startup endpoints
for Kubernetes liveness, readiness, and startup probes.

Enterprise-grade health checking matching Manus.im BullMQ Worker specification.
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from aiohttp import web

logger = logging.getLogger(__name__)


class HealthCheckServer:
    """
    HTTP server for health check endpoints.

    Endpoints:
    - GET /health/live    - Liveness probe (is the process alive?)
    - GET /health/ready   - Readiness probe (can accept traffic?)
    - GET /health/startup - Startup probe (has initialization completed?)
    - GET /health         - Combined health status
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8080,
        redis_client=None,
        job_queue=None,
    ):
        self.host = host
        self.port = port
        self.redis_client = redis_client
        self.job_queue = job_queue

        # Health state
        self._startup_complete = False
        self._shutting_down = False
        self._last_job_processed: Optional[datetime] = None
        self._jobs_in_progress = 0

        # Thresholds
        self._max_idle_time = timedelta(minutes=30)  # Max time without processing
        self._redis_timeout = 5  # Redis check timeout in seconds

        self._app: Optional[web.Application] = None
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None

    async def start(self):
        """Start the health check HTTP server."""
        self._app = web.Application()
        self._app.router.add_get("/health", self._health_handler)
        self._app.router.add_get("/health/live", self._liveness_handler)
        self._app.router.add_get("/health/ready", self._readiness_handler)
        self._app.router.add_get("/health/startup", self._startup_handler)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        self._site = web.TCPSite(self._runner, self.host, self.port)
        await self._site.start()

        logger.info(f"Health check server started on {self.host}:{self.port}")

    async def stop(self):
        """Stop the health check HTTP server."""
        if self._runner:
            await self._runner.cleanup()
            logger.info("Health check server stopped")

    def mark_startup_complete(self):
        """Mark that startup/initialization is complete."""
        self._startup_complete = True
        logger.info("Health check: startup marked complete")

    def mark_shutting_down(self):
        """Mark that the worker is shutting down."""
        self._shutting_down = True
        logger.info("Health check: marked shutting down")

    def job_started(self):
        """Called when a job starts processing."""
        self._jobs_in_progress += 1

    def job_completed(self):
        """Called when a job completes processing."""
        self._jobs_in_progress = max(0, self._jobs_in_progress - 1)
        self._last_job_processed = datetime.utcnow()

    def get_jobs_in_progress(self) -> int:
        """Get current number of jobs in progress."""
        return self._jobs_in_progress

    async def _health_handler(self, request: web.Request) -> web.Response:
        """Combined health status endpoint."""
        live = await self._check_liveness()
        ready = await self._check_readiness()
        startup = self._check_startup()

        status = {
            "status": "healthy" if (live and ready and startup) else "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "liveness": live,
                "readiness": ready,
                "startup": startup,
            },
            "details": {
                "startup_complete": self._startup_complete,
                "shutting_down": self._shutting_down,
                "jobs_in_progress": self._jobs_in_progress,
                "last_job_processed": (
                    self._last_job_processed.isoformat()
                    if self._last_job_processed
                    else None
                ),
            },
        }

        http_status = 200 if status["status"] == "healthy" else 503
        return web.json_response(status, status=http_status)

    async def _liveness_handler(self, request: web.Request) -> web.Response:
        """
        Liveness probe endpoint.

        Returns 200 if the process is alive and functioning.
        Returns 503 if the process should be restarted.
        """
        is_alive = await self._check_liveness()

        if is_alive:
            return web.json_response(
                {"status": "alive", "timestamp": datetime.utcnow().isoformat()},
                status=200,
            )
        else:
            return web.json_response(
                {"status": "dead", "timestamp": datetime.utcnow().isoformat()},
                status=503,
            )

    async def _readiness_handler(self, request: web.Request) -> web.Response:
        """
        Readiness probe endpoint.

        Returns 200 if the worker can accept new jobs.
        Returns 503 if the worker should not receive traffic.
        """
        is_ready = await self._check_readiness()

        if is_ready:
            return web.json_response(
                {"status": "ready", "timestamp": datetime.utcnow().isoformat()},
                status=200,
            )
        else:
            return web.json_response(
                {
                    "status": "not_ready",
                    "timestamp": datetime.utcnow().isoformat(),
                    "reason": "shutting_down" if self._shutting_down else "not_initialized",
                },
                status=503,
            )

    async def _startup_handler(self, request: web.Request) -> web.Response:
        """
        Startup probe endpoint.

        Returns 200 if initialization is complete.
        Returns 503 if still initializing.
        """
        is_started = self._check_startup()

        if is_started:
            return web.json_response(
                {"status": "started", "timestamp": datetime.utcnow().isoformat()},
                status=200,
            )
        else:
            return web.json_response(
                {"status": "starting", "timestamp": datetime.utcnow().isoformat()},
                status=503,
            )

    async def _check_liveness(self) -> bool:
        """
        Check if the worker is alive.

        A worker is considered alive if:
        1. The process is running (implicit)
        2. Redis is reachable (if configured)
        """
        # Check Redis connectivity if available
        if self.redis_client:
            try:
                # Use ping with timeout
                self.redis_client.ping()
            except Exception as e:
                logger.warning(f"Liveness check failed - Redis unreachable: {e}")
                return False

        return True

    async def _check_readiness(self) -> bool:
        """
        Check if the worker is ready to accept jobs.

        A worker is ready if:
        1. Startup is complete
        2. Not shutting down
        3. Redis is reachable
        """
        if not self._startup_complete:
            return False

        if self._shutting_down:
            return False

        # Check Redis
        if self.redis_client:
            try:
                self.redis_client.ping()
            except Exception as e:
                logger.warning(f"Readiness check failed - Redis unreachable: {e}")
                return False

        return True

    def _check_startup(self) -> bool:
        """Check if startup/initialization is complete."""
        return self._startup_complete


# Singleton instance
_health_server: Optional[HealthCheckServer] = None


def get_health_server() -> Optional[HealthCheckServer]:
    """Get the singleton health server instance."""
    return _health_server


def create_health_server(
    host: str = "0.0.0.0",
    port: int = 8080,
    redis_client=None,
    job_queue=None,
) -> HealthCheckServer:
    """Create and return the singleton health server instance."""
    global _health_server
    if _health_server is None:
        _health_server = HealthCheckServer(
            host=host,
            port=port,
            redis_client=redis_client,
            job_queue=job_queue,
        )
    return _health_server
