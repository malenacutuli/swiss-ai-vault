"""
Main FastAPI application for Swiss Agent API
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
import time
import asyncio
from typing import Optional

from app.config import get_settings
from app.routes import execute, status, logs, debug, sandbox, documents, prompts, connectors
from app.healthcare import healthcare_router

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()
settings = get_settings()

# Background task tracking
cleanup_task: Optional[asyncio.Task] = None

# Create FastAPI app
app = FastAPI(
    title="Swiss Agent API",
    description="Agent execution system on Swiss K8s infrastructure",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing"""
    start_time = time.time()

    # Log request
    logger.info(
        "request_started",
        method=request.method,
        path=request.url.path,
        client=request.client.host if request.client else None,
    )

    # Process request
    try:
        response = await call_next(request)
        duration = time.time() - start_time

        # Log response
        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
        )

        return response

    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            "request_failed",
            method=request.method,
            path=request.url.path,
            error=str(e),
            duration_ms=round(duration * 1000, 2),
        )
        raise


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for K8s probes"""
    return {
        "status": "healthy",
        "version": settings.version,
        "service": "agent-api",
    }


# Ready check endpoint
@app.get("/ready")
async def ready_check():
    """Readiness check - verify dependencies"""
    # TODO: Check Supabase connection
    # TODO: Check Redis connection
    return {
        "status": "ready",
        "checks": {
            "supabase": "ok",
            "redis": "ok",
            "anthropic": "ok",
        }
    }


# Include routers
app.include_router(execute.router, prefix="/agent", tags=["Agent Execution"])
app.include_router(status.router, prefix="/agent", tags=["Agent Status"])
app.include_router(logs.router, prefix="/agent", tags=["Agent Logs"])
app.include_router(sandbox.router, prefix="/api", tags=["Sandbox Management"])
app.include_router(documents.router, tags=["Document Generation"])
app.include_router(prompts.router, tags=["Prompt Management"])
app.include_router(debug.router, tags=["Debug"])
app.include_router(connectors.router, tags=["Connectors"])
app.include_router(healthcare_router, tags=["Healthcare"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error=str(exc),
        exc_type=type(exc).__name__,
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.debug else "An unexpected error occurred",
        }
    )


async def cleanup_expired_sandboxes_task():
    """Background task to cleanup expired E2B sandboxes"""
    from app.sandbox import get_sandbox_manager, get_enhanced_sandbox_manager

    sandbox_manager = get_sandbox_manager()
    enhanced_manager = get_enhanced_sandbox_manager()
    logger.info("sandbox_cleanup_task_started")

    while True:
        try:
            await asyncio.sleep(300)  # Run every 5 minutes
            logger.info("sandbox_cleanup_running")

            # Cleanup both managers
            await sandbox_manager.cleanup_expired_sandboxes()
            await enhanced_manager.cleanup_expired_sandboxes()

            # Log stats for both
            basic_count = sandbox_manager.get_active_sandbox_count()
            enhanced_count = enhanced_manager.get_active_sandbox_count()
            total_count = basic_count + enhanced_count

            logger.info(
                "sandbox_cleanup_completed",
                basic_sandboxes=basic_count,
                enhanced_sandboxes=enhanced_count,
                total_sandboxes=total_count
            )

        except asyncio.CancelledError:
            logger.info("sandbox_cleanup_task_cancelled")
            break
        except Exception as e:
            logger.error("sandbox_cleanup_error", error=str(e))
            # Continue running despite errors


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global cleanup_task

    logger.info("agent_api_starting", version=settings.version)

    # Initialize Redis clients
    try:
        from app.redis.clients import get_worker_redis, get_api_redis
        worker_redis = get_worker_redis()
        api_redis = get_api_redis()
        await worker_redis.ping()  # Health check
        logger.info("redis_connected")
    except Exception as e:
        logger.error("redis_connection_failed", error=str(e))
        # Non-fatal: API can start without Redis, just won't process jobs

    # Start sandbox cleanup background task
    cleanup_task = asyncio.create_task(cleanup_expired_sandboxes_task())
    logger.info("sandbox_cleanup_task_created")

    logger.info("agent_api_started")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global cleanup_task

    logger.info("agent_api_shutting_down")

    # Cancel sandbox cleanup task
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        logger.info("sandbox_cleanup_task_stopped")

    # Cleanup all active sandboxes
    try:
        from app.sandbox import get_sandbox_manager, get_enhanced_sandbox_manager
        sandbox_manager = get_sandbox_manager()
        enhanced_manager = get_enhanced_sandbox_manager()

        # Cleanup basic manager sandboxes
        basic_runs = list(sandbox_manager.active_sandboxes.keys())
        logger.info("cleaning_up_basic_sandboxes", count=len(basic_runs))

        for run_id in basic_runs:
            await sandbox_manager.cleanup_sandbox(run_id)

        # Cleanup enhanced manager sandboxes
        enhanced_runs = list(enhanced_manager.active_sandboxes.keys())
        logger.info("cleaning_up_enhanced_sandboxes", count=len(enhanced_runs))

        for run_id in enhanced_runs:
            await enhanced_manager.cleanup_sandbox(run_id)

        total_cleaned = len(basic_runs) + len(enhanced_runs)
        logger.info("all_sandboxes_cleaned", total=total_cleaned)
    except Exception as e:
        logger.error("sandbox_cleanup_failed", error=str(e))

    # Close Redis connections
    try:
        from app.redis.clients import close_worker_redis
        await close_worker_redis()
        logger.info("redis_closed")
    except Exception as e:
        logger.error("redis_close_failed", error=str(e))

    logger.info("agent_api_stopped")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info",
    )
