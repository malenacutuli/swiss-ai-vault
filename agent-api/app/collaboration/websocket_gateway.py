"""
WebSocket Gateway for Real-Time Collaboration

Main entry point for WebSocket connections. Integrates:
- OT Server for operational transformation
- Connection Manager for WebSocket lifecycle
- Presence Manager for user awareness
- Redis Sync for multi-pod synchronization
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional, Any
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.collaboration.ot_types import OperationBatch, Cursor
from app.collaboration.ot_server import OTServer
from app.collaboration.connection_manager import ConnectionManager, Connection
from app.collaboration.presence import PresenceManager, UserPresence
from app.collaboration.redis_sync import RedisSync, MessageType, SyncMessage

logger = logging.getLogger(__name__)


class WebSocketMessage(BaseModel):
    """Incoming WebSocket message structure."""
    type: str
    document_id: Optional[str] = None
    batch: Optional[dict] = None
    position: Optional[int] = None
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    version: Optional[int] = None
    user_name: Optional[str] = None


class CollaborationGateway:
    """
    WebSocket gateway for real-time collaboration.

    Orchestrates all collaboration components:
        - OTServer: Operational transformation
        - ConnectionManager: WebSocket connections
        - PresenceManager: User presence tracking
        - RedisSync: Multi-pod synchronization

    Message Types (Client -> Server):
        - register: Join a document
        - operation: Apply an operation batch
        - cursor: Update cursor position
        - sync: Request sync with server
        - heartbeat: Keep connection alive

    Message Types (Server -> Client):
        - registered: Confirm registration with initial state
        - ack: Acknowledge operation
        - operation: Broadcast operation from another user
        - cursor: Broadcast cursor from another user
        - presence_join: User joined the document
        - presence_leave: User left the document
        - sync: Full document sync response
        - error: Error message
    """

    def __init__(
        self,
        supabase: Optional[Any] = None,
        redis_client: Optional[Any] = None,
    ):
        """
        Initialize the collaboration gateway.

        Args:
            supabase: Optional Supabase client for persistence
            redis_client: Optional Redis client for multi-pod sync
        """
        # Core components
        self.ot_server = OTServer(supabase)
        self.connections = ConnectionManager()
        self.presence = PresenceManager()
        self.redis_sync: Optional[RedisSync] = None

        if redis_client:
            self.redis_sync = RedisSync(redis_client)

        # Wire up callbacks
        self._setup_callbacks()

        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

    def _setup_callbacks(self) -> None:
        """Set up inter-component callbacks."""

        # OT Server broadcasts go to WebSocket clients
        async def broadcast_operation(client_id: str, message: dict) -> None:
            await self.connections.send_to_client(client_id, message)

        self.ot_server.on_broadcast = broadcast_operation

        # Presence changes broadcast to document participants
        async def on_presence_change(
            document_id: str,
            presence: UserPresence,
            event_type: str
        ) -> None:
            if event_type == "join":
                message = {
                    "type": "presence_join",
                    "presence": presence.to_dict()
                }
            elif event_type == "leave" or event_type == "stale":
                message = {
                    "type": "presence_leave",
                    "user_id": presence.user_id,
                    "client_id": presence.client_id
                }
            elif event_type == "cursor":
                message = {
                    "type": "cursor",
                    "user_id": presence.user_id,
                    "position": presence.cursor_position,
                    "selection_start": presence.selection_start,
                    "selection_end": presence.selection_end
                }
            else:
                return

            # Broadcast to local connections
            await self.connections.broadcast_to_document(
                document_id,
                message,
                exclude_client=presence.client_id
            )

            # Publish to Redis for other pods
            if self.redis_sync and event_type == "join":
                await self.redis_sync.publish_presence_join(
                    document_id, presence.to_dict()
                )
            elif self.redis_sync and event_type in ("leave", "stale"):
                await self.redis_sync.publish_presence_leave(
                    document_id, presence.user_id, presence.client_id
                )

        self.presence.on_presence_change = on_presence_change

        # Redis sync handlers
        if self.redis_sync:
            self._setup_redis_handlers()

    def _setup_redis_handlers(self) -> None:
        """Set up Redis sync message handlers."""
        if not self.redis_sync:
            return

        @self.redis_sync.on_message(MessageType.OPERATION)
        async def handle_remote_operation(message: SyncMessage) -> None:
            """Handle operation from another pod."""
            batch_data = message.payload.get("batch")
            if batch_data:
                await self.connections.broadcast_to_document(
                    message.document_id,
                    {"type": "operation", "batch": batch_data}
                )

        @self.redis_sync.on_message(MessageType.CURSOR)
        async def handle_remote_cursor(message: SyncMessage) -> None:
            """Handle cursor update from another pod."""
            await self.connections.broadcast_to_document(
                message.document_id,
                {
                    "type": "cursor",
                    "user_id": message.payload["user_id"],
                    "position": message.payload["position"],
                    "selection_start": message.payload.get("selection_start"),
                    "selection_end": message.payload.get("selection_end"),
                }
            )

        @self.redis_sync.on_message(MessageType.PRESENCE_JOIN)
        async def handle_remote_presence_join(message: SyncMessage) -> None:
            """Handle user join from another pod."""
            await self.connections.broadcast_to_document(
                message.document_id,
                {
                    "type": "presence_join",
                    "presence": message.payload["presence"]
                }
            )

        @self.redis_sync.on_message(MessageType.PRESENCE_LEAVE)
        async def handle_remote_presence_leave(message: SyncMessage) -> None:
            """Handle user leave from another pod."""
            await self.connections.broadcast_to_document(
                message.document_id,
                {
                    "type": "presence_leave",
                    "user_id": message.payload["user_id"],
                    "client_id": message.payload["client_id"]
                }
            )

    async def start(self) -> None:
        """Start the gateway and background tasks."""
        if self._running:
            return

        self._running = True

        # Start Redis sync
        if self.redis_sync:
            await self.redis_sync.start()

        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info("Collaboration gateway started")

    async def stop(self) -> None:
        """Stop the gateway and cleanup."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        if self.redis_sync:
            await self.redis_sync.stop()

        logger.info("Collaboration gateway stopped")

    async def _cleanup_loop(self) -> None:
        """Periodic cleanup of stale connections and presence."""
        try:
            while self._running:
                await asyncio.sleep(30)  # Run every 30 seconds

                # Clean up stale presence
                await self.presence.cleanup_stale()

                # Mark idle users
                await self.presence.mark_idle_users()

        except asyncio.CancelledError:
            pass

    async def handle_websocket(
        self,
        websocket: WebSocket,
        user_id: str,
        client_id: Optional[str] = None
    ) -> None:
        """
        Main WebSocket handler.

        Args:
            websocket: The WebSocket connection
            user_id: Authenticated user ID
            client_id: Optional client ID (generated if not provided)
        """
        client_id = client_id or str(uuid.uuid4())

        # Accept connection
        connection = await self.connections.connect(
            websocket, client_id, user_id
        )

        try:
            await self._handle_messages(connection)

        except WebSocketDisconnect:
            logger.info(f"Client {client_id} disconnected")

        except Exception as e:
            logger.error(f"WebSocket error for {client_id}: {e}")

        finally:
            await self._cleanup_client(client_id)

    async def _handle_messages(self, connection: Connection) -> None:
        """Handle incoming WebSocket messages."""
        while True:
            data = await connection.websocket.receive_json()

            try:
                message = WebSocketMessage(**data)
                await self._route_message(connection, message)

            except Exception as e:
                logger.error(f"Message handling error: {e}")
                await connection.send_json({
                    "type": "error",
                    "message": str(e)
                })

    async def _route_message(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Route a message to the appropriate handler."""
        handlers = {
            "register": self._handle_register,
            "operation": self._handle_operation,
            "cursor": self._handle_cursor,
            "sync": self._handle_sync,
            "heartbeat": self._handle_heartbeat,
        }

        handler = handlers.get(message.type)
        if handler:
            await handler(connection, message)
        else:
            logger.warning(f"Unknown message type: {message.type}")

    async def _handle_register(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Handle document registration."""
        if not message.document_id:
            await connection.send_json({
                "type": "error",
                "message": "document_id required"
            })
            return

        # Register with OT server
        result = await self.ot_server.register_client(
            connection.client_id,
            connection.user_id,
            message.document_id
        )

        # Join document in connection manager
        await self.connections.join_document(
            connection.client_id,
            message.document_id
        )

        # Add presence
        presence = await self.presence.join(
            message.document_id,
            connection.user_id,
            connection.client_id,
            user_name=message.user_name or "",
        )

        # Subscribe to Redis channel
        if self.redis_sync:
            await self.redis_sync.subscribe_document(message.document_id)

        # Get other users' presence
        other_presence = [
            p.to_dict() for p in self.presence.get_document_presence(message.document_id)
            if p.client_id != connection.client_id
        ]

        # Send registration confirmation
        await connection.send_json({
            "type": "registered",
            "document_id": message.document_id,
            "version": result["version"],
            "content": result["content"],
            "hash": result["hash"],
            "presence": other_presence,
            "your_presence": presence.to_dict(),
        })

    async def _handle_operation(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Handle an operation batch."""
        if not message.batch or not connection.document_id:
            await connection.send_json({
                "type": "error",
                "message": "batch and document_id required"
            })
            return

        # Create operation batch
        batch = OperationBatch.from_dict({
            **message.batch,
            "user_id": connection.user_id,
            "document_id": connection.document_id,
        })

        # Process through OT server
        result = await self.ot_server.handle_operation(
            connection.client_id,
            batch
        )

        if "error" in result:
            await connection.send_json({
                "type": "error",
                "message": result["error"],
                "code": result.get("code")
            })
            return

        # Send acknowledgment
        await connection.send_json({
            "type": "ack",
            "batch_id": result["batch_id"],
            "version": result["version"],
            "hash": result["hash"],
        })

        # Publish to Redis for other pods
        if self.redis_sync and result.get("transformed"):
            await self.redis_sync.publish_operation(
                connection.document_id,
                result["transformed"]
            )

    async def _handle_cursor(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Handle cursor position update."""
        if message.position is None or not connection.document_id:
            return

        # Update presence
        await self.presence.update_cursor(
            connection.document_id,
            connection.client_id,
            message.position,
            message.selection_start,
            message.selection_end
        )

        # Create cursor object for OT server
        cursor = Cursor(
            user_id=connection.user_id,
            position=message.position,
            selection_start=message.selection_start,
            selection_end=message.selection_end
        )

        # Update OT server
        await self.ot_server.handle_cursor_update(
            connection.client_id,
            connection.document_id,
            cursor
        )

        # Publish to Redis for other pods
        if self.redis_sync:
            await self.redis_sync.publish_cursor(
                connection.document_id,
                connection.user_id,
                message.position,
                message.selection_start,
                message.selection_end
            )

    async def _handle_sync(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Handle sync request."""
        if not connection.document_id or message.version is None:
            await connection.send_json({
                "type": "error",
                "message": "document_id and version required"
            })
            return

        result = await self.ot_server.sync_client(
            connection.client_id,
            connection.document_id,
            message.version
        )

        if "error" in result:
            await connection.send_json({
                "type": "error",
                "message": result["error"],
                "code": result.get("code")
            })
            return

        await connection.send_json({
            "type": "sync",
            **result
        })

    async def _handle_heartbeat(
        self,
        connection: Connection,
        message: WebSocketMessage
    ) -> None:
        """Handle heartbeat/keepalive."""
        if connection.document_id:
            await self.presence.mark_activity(
                connection.document_id,
                connection.client_id
            )

        await connection.send_json({"type": "heartbeat_ack"})

    async def _cleanup_client(self, client_id: str) -> None:
        """Clean up after a client disconnects."""
        connection = self.connections.get_connection(client_id)

        if connection and connection.document_id:
            # Remove from OT server
            await self.ot_server.unregister_client(client_id)

            # Remove presence
            await self.presence.leave(
                connection.document_id,
                client_id
            )

            # Unsubscribe from Redis if no more clients on this document
            if self.redis_sync:
                remaining = self.connections.get_document_clients(
                    connection.document_id
                )
                if len(remaining) <= 1:  # Only this client left
                    await self.redis_sync.unsubscribe_document(
                        connection.document_id
                    )

        # Remove connection
        await self.connections.disconnect(client_id)

    def get_stats(self) -> dict:
        """Get gateway statistics."""
        return {
            "connections": self.connections.get_stats(),
            "presence": self.presence.get_stats(),
            "redis_sync": self.redis_sync.get_stats() if self.redis_sync else None,
        }


# Global gateway instance (initialized in app startup)
gateway: Optional[CollaborationGateway] = None


def get_gateway() -> CollaborationGateway:
    """Get the global gateway instance."""
    if gateway is None:
        raise RuntimeError("Collaboration gateway not initialized")
    return gateway
