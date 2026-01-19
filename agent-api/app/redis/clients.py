"""Dual Redis client setup: standard for worker, upstash for API"""
import logging
from redis.asyncio import Redis as AsyncRedis
from upstash_redis import Redis as UpstashRedis
from app.config import get_settings

logger = logging.getLogger(__name__)

_worker_redis = None  # Long-lived connection for worker process
_api_redis = None     # Serverless-optimized client for API


def get_worker_redis() -> AsyncRedis:
    """
    Get standard Redis client for worker process.

    Uses persistent connection pool, suitable for long-running processes.
    """
    global _worker_redis
    if _worker_redis is None:
        settings = get_settings()
        _worker_redis = AsyncRedis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            health_check_interval=30,
            max_connections=10
        )
        logger.info("Initialized worker Redis client")
    return _worker_redis


def get_api_redis() -> UpstashRedis:
    """
    Get Upstash Redis client for API endpoints.

    HTTP-based client optimized for serverless environments.
    """
    global _api_redis
    if _api_redis is None:
        settings = get_settings()
        _api_redis = UpstashRedis.from_url(settings.redis_url)
        logger.info("Initialized API Redis client (Upstash)")
    return _api_redis


async def close_worker_redis():
    """Close worker Redis connection"""
    global _worker_redis
    if _worker_redis:
        await _worker_redis.close()
        _worker_redis = None
        logger.info("Closed worker Redis client")
