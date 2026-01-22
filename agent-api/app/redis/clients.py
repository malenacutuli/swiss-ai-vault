"""Redis client setup for API and worker"""
import logging
import redis
from redis.asyncio import Redis as AsyncRedis
from app.config import get_settings

logger = logging.getLogger(__name__)

_worker_redis = None  # Long-lived async connection for worker process
_api_redis = None     # Sync Redis client for API


def get_worker_redis() -> AsyncRedis:
    """
    Get async Redis client for worker process.

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


def get_api_redis() -> redis.Redis:
    """
    Get sync Redis client for API endpoints.

    Standard Redis client with SSL support for Upstash.
    """
    global _api_redis
    if _api_redis is None:
        settings = get_settings()
        redis_url = settings.redis_url

        # Build connection kwargs
        connection_kwargs = {
            'decode_responses': True,
            'socket_connect_timeout': 10,
        }

        # Add SSL config for TLS connections (rediss://)
        if redis_url.startswith('rediss://'):
            connection_kwargs['ssl_cert_reqs'] = 'none'
            logger.info("API Redis: Using TLS connection")

        _api_redis = redis.from_url(redis_url, **connection_kwargs)
        logger.info("Initialized API Redis client")
    return _api_redis


async def close_worker_redis():
    """Close worker Redis connection"""
    global _worker_redis
    if _worker_redis:
        await _worker_redis.close()
        _worker_redis = None
        logger.info("Closed worker Redis client")
