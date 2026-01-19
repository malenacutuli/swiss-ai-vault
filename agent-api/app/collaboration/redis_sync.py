"""
Redis Sync for Multi-Pod Collaboration

Enables collaboration across multiple server pods using Redis pub/sub.
Operations, presence updates, and cursor changes are broadcast via Redis
so all pods can synchronize.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Optional, Callable, Awaitable, Any
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """Types of sync messages."""
    OPERATION = "operation"
    CURSOR = "cursor"
    PRESENCE_JOIN = "presence_join"
    PRESENCE_LEAVE = "presence_leave"
    PRESENCE_UPDATE = "presence_update"
    DOCUMENT_SYNC = "document_sync"


@dataclass
class SyncMessage:
    """A message to be broadcast via Redis."""
    type: MessageType
    document_id: str
    payload: dict
    source_pod: str
    message_id: str

    def to_json(self) -> str:
        """Serialize to JSON."""
        return json.dumps({
            "type": self.type.value,
            "document_id": self.document_id,
            "payload": self.payload,
            "source_pod": self.source_pod,
            "message_id": self.message_id,
        })

    @classmethod
    def from_json(cls, data: str) -> "SyncMessage":
        """Deserialize from JSON."""
        d = json.loads(data)
        return cls(
            type=MessageType(d["type"]),
            document_id=d["document_id"],
            payload=d["payload"],
            source_pod=d["source_pod"],
            message_id=d["message_id"],
        )


class RedisSync:
    """
    Redis pub/sub synchronization for multi-pod collaboration.

    Responsibilities:
        - Publish operations and presence to Redis
        - Subscribe to updates from other pods
        - Route received messages to appropriate handlers
        - Handle reconnection and message deduplication
    """

    # Redis channel prefix
    CHANNEL_PREFIX = "collab:sync:"

    def __init__(
        self,
        redis_client: Any,
        pod_id: Optional[str] = None,
    ):
        """
        Initialize Redis sync.

        Args:
            redis_client: Redis client instance (standard or async)
            pod_id: Unique identifier for this pod
        """
        self.redis = redis_client
        self.pod_id = pod_id or str(uuid.uuid4())[:8]

        # Track seen message IDs to prevent duplicates
        self._seen_messages: set[str] = set()
        self._max_seen_messages = 10000

        # Pubsub instance
        self._pubsub = None
        self._listener_task: Optional[asyncio.Task] = None
        self._running = False

        # Message handlers by type
        self._handlers: dict[MessageType, list[Callable]] = {
            msg_type: [] for msg_type in MessageType
        }

        # Subscribed documents
        self._subscribed_documents: set[str] = set()

    def _get_channel(self, document_id: str) -> str:
        """Get the Redis channel for a document."""
        return f"{self.CHANNEL_PREFIX}{document_id}"

    def _get_global_channel(self) -> str:
        """Get the global broadcast channel."""
        return f"{self.CHANNEL_PREFIX}global"

    def on_message(
        self,
        message_type: MessageType
    ) -> Callable[[Callable], Callable]:
        """
        Decorator to register a message handler.

        Usage:
            @sync.on_message(MessageType.OPERATION)
            async def handle_operation(message: SyncMessage):
                ...
        """
        def decorator(func: Callable) -> Callable:
            self._handlers[message_type].append(func)
            return func
        return decorator

    def add_handler(
        self,
        message_type: MessageType,
        handler: Callable[[SyncMessage], Awaitable[None]]
    ) -> None:
        """Add a message handler."""
        self._handlers[message_type].append(handler)

    async def start(self) -> None:
        """Start listening for messages."""
        if self._running:
            return

        self._running = True
        self._pubsub = self.redis.pubsub()

        # Subscribe to global channel
        await self._pubsub.subscribe(self._get_global_channel())

        # Start listener task
        self._listener_task = asyncio.create_task(self._listen())

        logger.info(f"Redis sync started for pod {self.pod_id}")

    async def stop(self) -> None:
        """Stop listening for messages."""
        self._running = False

        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()

        logger.info(f"Redis sync stopped for pod {self.pod_id}")

    async def subscribe_document(self, document_id: str) -> None:
        """Subscribe to updates for a document."""
        if document_id in self._subscribed_documents:
            return

        if self._pubsub:
            await self._pubsub.subscribe(self._get_channel(document_id))
            self._subscribed_documents.add(document_id)
            logger.debug(f"Subscribed to document {document_id}")

    async def unsubscribe_document(self, document_id: str) -> None:
        """Unsubscribe from a document's updates."""
        if document_id not in self._subscribed_documents:
            return

        if self._pubsub:
            await self._pubsub.unsubscribe(self._get_channel(document_id))
            self._subscribed_documents.discard(document_id)
            logger.debug(f"Unsubscribed from document {document_id}")

    async def publish(self, message: SyncMessage) -> bool:
        """
        Publish a message to Redis.

        Args:
            message: Message to publish

        Returns:
            True if published successfully
        """
        try:
            channel = self._get_channel(message.document_id)
            await self.redis.publish(channel, message.to_json())

            logger.debug(
                f"Published {message.type.value} to {message.document_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return False

    async def publish_operation(
        self,
        document_id: str,
        batch: dict,
    ) -> bool:
        """
        Publish an operation batch.

        Args:
            document_id: Target document
            batch: Operation batch as dict

        Returns:
            True if published successfully
        """
        message = SyncMessage(
            type=MessageType.OPERATION,
            document_id=document_id,
            payload={"batch": batch},
            source_pod=self.pod_id,
            message_id=str(uuid.uuid4()),
        )
        return await self.publish(message)

    async def publish_cursor(
        self,
        document_id: str,
        user_id: str,
        position: int,
        selection_start: Optional[int] = None,
        selection_end: Optional[int] = None,
    ) -> bool:
        """
        Publish a cursor update.

        Args:
            document_id: Target document
            user_id: User updating cursor
            position: Cursor position
            selection_start: Selection start
            selection_end: Selection end

        Returns:
            True if published successfully
        """
        message = SyncMessage(
            type=MessageType.CURSOR,
            document_id=document_id,
            payload={
                "user_id": user_id,
                "position": position,
                "selection_start": selection_start,
                "selection_end": selection_end,
            },
            source_pod=self.pod_id,
            message_id=str(uuid.uuid4()),
        )
        return await self.publish(message)

    async def publish_presence_join(
        self,
        document_id: str,
        presence: dict,
    ) -> bool:
        """
        Publish a user joining a document.

        Args:
            document_id: Target document
            presence: Presence data as dict

        Returns:
            True if published successfully
        """
        message = SyncMessage(
            type=MessageType.PRESENCE_JOIN,
            document_id=document_id,
            payload={"presence": presence},
            source_pod=self.pod_id,
            message_id=str(uuid.uuid4()),
        )
        return await self.publish(message)

    async def publish_presence_leave(
        self,
        document_id: str,
        user_id: str,
        client_id: str,
    ) -> bool:
        """
        Publish a user leaving a document.

        Args:
            document_id: Target document
            user_id: User leaving
            client_id: Client leaving

        Returns:
            True if published successfully
        """
        message = SyncMessage(
            type=MessageType.PRESENCE_LEAVE,
            document_id=document_id,
            payload={"user_id": user_id, "client_id": client_id},
            source_pod=self.pod_id,
            message_id=str(uuid.uuid4()),
        )
        return await self.publish(message)

    async def _listen(self) -> None:
        """Listen for messages from Redis."""
        try:
            while self._running:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )

                if message and message["type"] == "message":
                    await self._handle_message(message["data"])

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Redis listener error: {e}")
            if self._running:
                # Reconnect after delay
                await asyncio.sleep(1)
                self._listener_task = asyncio.create_task(self._listen())

    async def _handle_message(self, data: bytes) -> None:
        """Handle a received message."""
        try:
            message = SyncMessage.from_json(data.decode("utf-8"))

            # Skip messages from this pod
            if message.source_pod == self.pod_id:
                return

            # Skip duplicate messages
            if message.message_id in self._seen_messages:
                return

            # Track seen message
            self._seen_messages.add(message.message_id)
            if len(self._seen_messages) > self._max_seen_messages:
                # Remove oldest half
                to_remove = list(self._seen_messages)[:self._max_seen_messages // 2]
                for msg_id in to_remove:
                    self._seen_messages.discard(msg_id)

            # Dispatch to handlers
            handlers = self._handlers.get(message.type, [])
            for handler in handlers:
                try:
                    await handler(message)
                except Exception as e:
                    logger.error(f"Handler error for {message.type}: {e}")

        except Exception as e:
            logger.error(f"Failed to handle message: {e}")

    def get_stats(self) -> dict:
        """Get sync statistics."""
        return {
            "pod_id": self.pod_id,
            "running": self._running,
            "subscribed_documents": len(self._subscribed_documents),
            "seen_messages": len(self._seen_messages),
        }
