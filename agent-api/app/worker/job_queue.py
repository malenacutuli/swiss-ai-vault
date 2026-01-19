"""Redis-based job queue with retry and dead letter queue logic"""
import json
import logging
import time
from datetime import datetime
from typing import Optional, Dict, Any
from redis import Redis, ConnectionError, TimeoutError
from redis.retry import Retry
from redis.backoff import NoBackoff
from app.config import get_settings

logger = logging.getLogger(__name__)

# Queue names
QUEUE_PENDING = "jobs:pending"
QUEUE_HIGH_PRIORITY = "jobs:high_priority"
QUEUE_PROCESSING = "jobs:processing"
QUEUE_RETRY = "jobs:retry"
QUEUE_FAILED = "jobs:failed"


class JobQueue:
    """
    Redis-based job queue with priority, retry, and dead letter queue support.

    Queue flow:
    1. Jobs enqueued to jobs:pending or jobs:high_priority
    2. Worker dequeues and moves to jobs:processing
    3. On success: remove from jobs:processing
    4. On failure: move to jobs:retry (up to MAX_RETRIES) or jobs:failed (DLQ)
    """

    def __init__(self):
        # Use synchronous Redis for worker (BRPOP is blocking)
        settings = get_settings()

        # Convert redis:// to rediss:// for Upstash TLS
        redis_url = settings.redis_url
        if redis_url.startswith('redis://') and 'upstash.io' in redis_url:
            redis_url = redis_url.replace('redis://', 'rediss://')
            logger.info(f"Converted to TLS: {redis_url[:30]}...")
        else:
            logger.info(f"Initializing Redis connection to: {redis_url[:30]}...")

        # Retry connection with backoff (for DNS resolution issues)
        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                # Create synchronous Redis client for blocking operations
                import ssl

                # Build connection kwargs
                connection_kwargs = {
                    'decode_responses': True,
                    'socket_connect_timeout': 10,
                    'socket_keepalive': True,
                    'socket_keepalive_options': {},
                    'retry_on_timeout': True,
                    'retry_on_error': [ConnectionError, TimeoutError],
                    'retry': Retry(NoBackoff(), 3)
                }

                # Add SSL config for TLS connections
                if redis_url.startswith('rediss://'):
                    connection_kwargs['ssl_cert_reqs'] = 'none'  # String value, not ssl.CERT_NONE

                self.redis = Redis.from_url(redis_url, **connection_kwargs)

                # Test connection
                self.redis.ping()
                logger.info(f"Redis connection established successfully (attempt {attempt + 1})")
                break
            except Exception as e:
                if attempt < max_attempts - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s, 8s
                    logger.warning(f"Redis connection failed (attempt {attempt + 1}/{max_attempts}): {e}")
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.exception(f"Failed to connect to Redis after {max_attempts} attempts: {e}")
                    raise

        self.max_retries = settings.worker_max_retries

    def enqueue(self, run_id: str, priority: int = 0, retry_count: int = 0) -> bool:
        """
        Enqueue a job for processing.

        Args:
            run_id: Agent run ID to process
            priority: Priority level (> 0 for high priority)
            retry_count: Current retry attempt number

        Returns:
            True if successfully enqueued
        """
        job_data = {
            "run_id": run_id,
            "enqueued_at": datetime.utcnow().isoformat(),
            "priority": priority,
            "retry_count": retry_count
        }

        queue = QUEUE_HIGH_PRIORITY if priority > 0 else QUEUE_PENDING
        job_json = json.dumps(job_data)

        try:
            self.redis.lpush(queue, job_json)
            logger.info(f"Enqueued job {run_id} to {queue} (retry={retry_count})")
            return True
        except Exception as e:
            logger.error(f"Failed to enqueue job {run_id}: {e}")
            return False

    def dequeue(self, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """
        Dequeue the next job from priority queues.

        Checks queues in order: high_priority → retry → pending

        Args:
            timeout: Blocking timeout in seconds

        Returns:
            Job data dictionary or None if timeout
        """
        try:
            # BRPOP blocks until a job is available or timeout
            result = self.redis.brpop(
                [QUEUE_HIGH_PRIORITY, QUEUE_RETRY, QUEUE_PENDING],
                timeout=timeout
            )

            if result:
                queue_name, job_json = result
                job_data = json.loads(job_json)

                # Move to processing queue for crash recovery
                self.redis.lpush(QUEUE_PROCESSING, job_json)

                logger.info(f"Dequeued job {job_data['run_id']} from {queue_name}")
                return job_data

            return None

        except Exception as e:
            logger.error(f"Error dequeuing job: {e}")
            return None

    def mark_complete(self, run_id: str):
        """
        Mark job as successfully completed.

        Removes job from processing queue.

        Args:
            run_id: Agent run ID
        """
        try:
            # Find and remove job from processing queue
            jobs = self.redis.lrange(QUEUE_PROCESSING, 0, -1)
            for job_json in jobs:
                job = json.loads(job_json)
                if job["run_id"] == run_id:
                    self.redis.lrem(QUEUE_PROCESSING, 1, job_json)
                    logger.info(f"Marked job {run_id} as complete")
                    break
        except Exception as e:
            logger.error(f"Error marking job {run_id} as complete: {e}")

    def mark_failed(self, run_id: str, error: str, retry_count: int):
        """
        Mark job as failed.

        If retryable and under max retries, moves to retry queue.
        Otherwise, moves to dead letter queue.

        Args:
            run_id: Agent run ID
            error: Error message
            retry_count: Current retry attempt number
        """
        try:
            # Find job in processing queue
            jobs = self.redis.lrange(QUEUE_PROCESSING, 0, -1)
            for job_json in jobs:
                job = json.loads(job_json)
                if job["run_id"] == run_id:
                    # Remove from processing
                    self.redis.lrem(QUEUE_PROCESSING, 1, job_json)

                    # Determine if retryable
                    if retry_count < self.max_retries and self._is_transient_error(error):
                        # Retry with backoff
                        job["retry_count"] = retry_count + 1
                        job["last_error"] = error
                        job["retry_at"] = datetime.utcnow().isoformat()
                        self.redis.lpush(QUEUE_RETRY, json.dumps(job))
                        logger.warning(
                            f"Job {run_id} failed, retrying (attempt {retry_count + 1}/{self.max_retries}): {error}"
                        )
                    else:
                        # Move to DLQ
                        job["failed_at"] = datetime.utcnow().isoformat()
                        job["error"] = error
                        job["retry_count"] = retry_count
                        self.redis.lpush(QUEUE_FAILED, json.dumps(job))
                        logger.error(f"Job {run_id} moved to DLQ after {retry_count} retries: {error}")

                    break
        except Exception as e:
            logger.error(f"Error marking job {run_id} as failed: {e}")

    def get_queue_stats(self) -> Dict[str, int]:
        """
        Get queue depth statistics.

        Returns:
            Dictionary with queue lengths
        """
        try:
            return {
                "pending": self.redis.llen(QUEUE_PENDING),
                "high_priority": self.redis.llen(QUEUE_HIGH_PRIORITY),
                "processing": self.redis.llen(QUEUE_PROCESSING),
                "retry": self.redis.llen(QUEUE_RETRY),
                "failed": self.redis.llen(QUEUE_FAILED)
            }
        except Exception as e:
            logger.error(f"Error getting queue stats: {e}")
            return {}

    def _is_transient_error(self, error: str) -> bool:
        """
        Determine if an error is transient and should be retried.

        Args:
            error: Error message

        Returns:
            True if error appears transient
        """
        transient_keywords = [
            "timeout",
            "connection",
            "unavailable",
            "rate limit",
            "temporarily",
            "502",
            "503",
            "504"
        ]
        error_lower = error.lower()
        return any(keyword in error_lower for keyword in transient_keywords)
