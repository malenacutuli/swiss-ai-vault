"""Redis pub/sub log subscriber for SSE streaming"""
import json
import logging
from typing import AsyncIterator, Dict, Any
from app.redis.clients import get_worker_redis

logger = logging.getLogger(__name__)


class LogSubscriber:
    """Subscribes to agent logs via Redis pub/sub for real-time streaming"""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.channel = f"agent:logs:{run_id}"
        self.redis = get_worker_redis()
        self.pubsub = None

    async def subscribe(self):
        """Subscribe to the log channel"""
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe(self.channel)
        logger.info(f"Subscribed to {self.channel}")

    async def listen(self) -> AsyncIterator[Dict[str, Any]]:
        """
        Listen for log messages on the subscribed channel.

        Yields:
            Parsed log data dictionaries
        """
        if not self.pubsub:
            await self.subscribe()

        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        yield data

                        # Stop listening after completion event
                        if data.get("type") == "complete":
                            logger.info(f"Received completion event for {self.run_id}")
                            break
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse log message: {e}")
                        continue
        finally:
            await self.cleanup()

    async def cleanup(self):
        """Unsubscribe and cleanup resources"""
        if self.pubsub:
            await self.pubsub.unsubscribe(self.channel)
            await self.pubsub.close()
            logger.info(f"Unsubscribed from {self.channel}")
            self.pubsub = None
