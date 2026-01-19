"""Redis pub/sub log publisher for real-time streaming"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from app.redis.clients import get_worker_redis

logger = logging.getLogger(__name__)


class LogPublisher:
    """Publishes agent logs to Redis pub/sub channels"""

    def __init__(self):
        self.redis = get_worker_redis()

    async def publish_log(
        self,
        run_id: str,
        log_type: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Publish log message to Redis pub/sub channel.

        Args:
            run_id: Agent run ID
            log_type: Type of log (info, success, error, etc.)
            message: Log message
            metadata: Optional metadata dictionary
        """
        channel = f"agent:logs:{run_id}"

        log_data = {
            "type": "log",
            "run_id": run_id,
            "log_type": log_type,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            await self.redis.publish(channel, json.dumps(log_data))
            logger.debug(f"Published log to {channel}: {log_type}")
        except Exception as e:
            logger.error(f"Failed to publish log to Redis: {e}")

    async def publish_completion(self, run_id: str, status: str):
        """
        Publish completion event to Redis pub/sub channel.

        Args:
            run_id: Agent run ID
            status: Final status (completed, failed, etc.)
        """
        channel = f"agent:logs:{run_id}"

        completion_data = {
            "type": "complete",
            "run_id": run_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            await self.redis.publish(channel, json.dumps(completion_data))
            logger.info(f"Published completion to {channel}: {status}")
        except Exception as e:
            logger.error(f"Failed to publish completion to Redis: {e}")
