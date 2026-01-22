"""Debug endpoints for monitoring worker status"""

from fastapi import APIRouter, Depends
import json
from app.redis.clients import get_api_redis
from app.config import get_settings

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/worker-status")
async def worker_status():
    """
    Check worker status via Redis heartbeat and debug logs.

    Returns information about worker health and activity.
    """
    try:
        redis = get_api_redis()

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

        # Get recent failed jobs with errors
        failed_jobs = []
        failed_raw = redis.lrange("jobs:failed", 0, 5)
        for f in failed_raw:
            try:
                job = json.loads(f)
                failed_jobs.append({
                    "run_id": job.get("run_id"),
                    "error": job.get("error", "N/A")[:500],
                    "failed_at": job.get("failed_at"),
                })
            except:
                pass

        return {
            "worker_heartbeat": heartbeat,
            "debug_logs": debug_logs,
            "queue_stats": queue_stats,
            "failed_jobs": failed_jobs,
            "redis_connected": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "redis_connected": False
        }
