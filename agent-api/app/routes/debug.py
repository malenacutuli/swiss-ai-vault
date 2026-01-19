"""Debug endpoints for monitoring worker status"""

from fastapi import APIRouter, Depends
from redis import Redis
from app.config import get_settings

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/worker-status")
async def worker_status():
    """
    Check worker status via Redis heartbeat and debug logs.

    Returns information about worker health and activity.
    """
    settings = get_settings()

    # Use standard Redis for reading (same as worker uses)
    redis = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        ssl_cert_reqs=None
    )

    try:
        # Get heartbeat
        heartbeat = redis.get("worker:heartbeat")

        # Get debug logs
        debug_logs = redis.lrange("worker:debug", 0, 20)

        # Get queue stats
        queue_stats = {
            "pending": redis.llen("jobs:pending"),
            "processing": redis.llen("jobs:processing"),
            "high_priority": redis.llen("jobs:high_priority"),
            "retry": redis.llen("jobs:retry"),
            "failed": redis.llen("jobs:failed"),
        }

        return {
            "worker_heartbeat": heartbeat,
            "debug_logs": debug_logs,
            "queue_stats": queue_stats,
            "redis_connected": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "redis_connected": False
        }
