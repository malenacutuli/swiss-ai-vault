"""
Database to Redis sync service
Finds jobs with status="queued" in database and enqueues them to Redis
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional
from supabase import create_client, Client
import redis
import json

from app.config import get_settings

logger = logging.getLogger(__name__)


class DBToRedisSync:
    """Syncs queued jobs from database to Redis"""

    def __init__(self, supabase: Client, redis_client: redis.Redis):
        self.supabase = supabase
        self.redis = redis_client
        self.running = True

    async def start(self):
        """Start the sync loop"""
        logger.info("Starting DB to Redis sync service")

        while self.running:
            try:
                # Find jobs with status="queued" that are not in Redis
                synced = await self.sync_queued_jobs()
                if synced > 0:
                    logger.info(f"Synced {synced} queued jobs to Redis")

                # Sleep for 5 seconds before next sync
                await asyncio.sleep(5)

            except Exception as e:
                logger.exception(f"Sync loop error: {e}")
                await asyncio.sleep(10)  # Wait longer on error

    async def sync_queued_jobs(self) -> int:
        """Find queued jobs and enqueue them to Redis"""
        try:
            # Get jobs with status="queued" ordered by created_at
            result = self.supabase.table("agent_runs")\
                .select("id, created_at")\
                .eq("status", "queued")\
                .order("created_at")\
                .limit(100)\
                .execute()

            jobs = result.data or []

            synced_count = 0
            for job in jobs:
                run_id = job["id"]

                # Check if already in Redis
                if self.is_job_in_redis(run_id):
                    continue

                # Enqueue to Redis
                job_data = {
                    "run_id": run_id,
                    "enqueued_at": datetime.utcnow().isoformat(),
                    "priority": 0,
                    "retry_count": 0
                }

                try:
                    self.redis.lpush("jobs:pending", json.dumps(job_data))
                    synced_count += 1
                    logger.info(f"Synced job {run_id} to Redis")
                except Exception as e:
                    logger.error(f"Failed to enqueue job {run_id}: {e}")

            return synced_count

        except Exception as e:
            logger.exception(f"Failed to sync queued jobs: {e}")
            return 0

    def is_job_in_redis(self, run_id: str) -> bool:
        """Check if job is already in any Redis queue"""
        try:
            # Check pending queue
            pending_jobs = self.redis.lrange("jobs:pending", 0, -1)
            for job_json in pending_jobs:
                job = json.loads(job_json)
                if job.get("run_id") == run_id:
                    return True

            # Check processing queue
            processing_jobs = self.redis.lrange("jobs:processing", 0, -1)
            for job_json in processing_jobs:
                job = json.loads(job_json)
                if job.get("run_id") == run_id:
                    return True

            return False

        except Exception as e:
            logger.warning(f"Failed to check Redis for job {run_id}: {e}")
            return False  # Assume not in Redis if check fails

    def stop(self):
        """Stop the sync service"""
        logger.info("Stopping DB to Redis sync service")
        self.running = False
