"""
WebSocket Connection Manager

Manages active WebSocket connections for real-time collaboration.
Handles client registration, message routing, and connection lifecycle.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable, Any
from datetime import datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class Connection:
    """Represents an active WebSocket connection."""
    websocket: WebSocket
    client_id: str
    user_id: str
    document_id: Optional[str] = None
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)

    async def send_json(self, data: dict) -> bool:
        """Send JSON data to this connection."""
        try:
            await self.websocket.send_json(data)
            self.last_activity = datetime.utcnow()
            return True
        except Exception as e:
            logger.error(f"Failed to send to {self.client_id}: {e}")
            return False


class ConnectionManager:
    """
    Manages WebSocket connections for collaboration.

    Responsibilities:
        - Track active connections by client_id and document_id
        - Broadcast messages to document participants
        - Handle connection lifecycle (connect, disconnect)
        - Provide connection statistics
    """

    def __init__(self):
        # client_id -> Connection
        self.connections: dict[str, Connection] = {}

        # document_id -> set of client_ids
        self.document_connections: dict[str, set[str]] = {}

        # user_id -> set of client_ids (a user may have multiple tabs)
        self.user_connections: dict[str, set[str]] = {}

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_connect: Optional[Callable[[Connection], Awaitable[None]]] = None
        self.on_disconnect: Optional[Callable[[Connection], Awaitable[None]]] = None

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        user_id: str
    ) -> Connection:
        """
        Register a new WebSocket connection.

        Args:
            websocket: The WebSocket instance
            client_id: Unique client identifier
            user_id: User identifier

        Returns:
            The created Connection object
        """
        await websocket.accept()

        async with self._lock:
            connection = Connection(
                websocket=websocket,
                client_id=client_id,
                user_id=user_id
            )

            self.connections[client_id] = connection

            # Track by user
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(client_id)

            logger.info(f"Client {client_id} connected (user: {user_id})")

        if self.on_connect:
            await self.on_connect(connection)

        return connection

    async def disconnect(self, client_id: str) -> Optional[Connection]:
        """
        Remove a WebSocket connection.

        Args:
            client_id: The client to disconnect

        Returns:
            The disconnected Connection, or None if not found
        """
        async with self._lock:
            connection = self.connections.pop(client_id, None)

            if connection:
                # Remove from user tracking
                user_conns = self.user_connections.get(connection.user_id)
                if user_conns:
                    user_conns.discard(client_id)
                    if not user_conns:
                        del self.user_connections[connection.user_id]

                # Remove from document tracking
                if connection.document_id:
                    doc_conns = self.document_connections.get(connection.document_id)
                    if doc_conns:
                        doc_conns.discard(client_id)
                        if not doc_conns:
                            del self.document_connections[connection.document_id]

                logger.info(f"Client {client_id} disconnected")

        if connection and self.on_disconnect:
            await self.on_disconnect(connection)

        return connection

    async def join_document(self, client_id: str, document_id: str) -> bool:
        """
        Associate a connection with a document.

        Args:
            client_id: The client joining
            document_id: The document to join

        Returns:
            True if successful
        """
        async with self._lock:
            connection = self.connections.get(client_id)
            if not connection:
                return False

            # Leave previous document if any
            if connection.document_id:
                old_doc_conns = self.document_connections.get(connection.document_id)
                if old_doc_conns:
                    old_doc_conns.discard(client_id)

            # Join new document
            connection.document_id = document_id

            if document_id not in self.document_connections:
                self.document_connections[document_id] = set()
            self.document_connections[document_id].add(client_id)

            logger.info(f"Client {client_id} joined document {document_id}")
            return True

    async def leave_document(self, client_id: str) -> bool:
        """
        Remove a connection from its current document.

        Args:
            client_id: The client leaving

        Returns:
            True if successful
        """
        async with self._lock:
            connection = self.connections.get(client_id)
            if not connection or not connection.document_id:
                return False

            doc_conns = self.document_connections.get(connection.document_id)
            if doc_conns:
                doc_conns.discard(client_id)
                if not doc_conns:
                    del self.document_connections[connection.document_id]

            old_doc = connection.document_id
            connection.document_id = None

            logger.info(f"Client {client_id} left document {old_doc}")
            return True

    async def send_to_client(self, client_id: str, message: dict) -> bool:
        """
        Send a message to a specific client.

        Args:
            client_id: Target client
            message: Message to send

        Returns:
            True if sent successfully
        """
        connection = self.connections.get(client_id)
        if not connection:
            return False

        return await connection.send_json(message)

    async def broadcast_to_document(
        self,
        document_id: str,
        message: dict,
        exclude_client: Optional[str] = None
    ) -> int:
        """
        Broadcast a message to all clients in a document.

        Args:
            document_id: Target document
            message: Message to broadcast
            exclude_client: Optional client to exclude

        Returns:
            Number of clients message was sent to
        """
        client_ids = self.document_connections.get(document_id, set()).copy()

        if exclude_client:
            client_ids.discard(exclude_client)

        sent_count = 0
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                sent_count += 1

        return sent_count

    async def broadcast_to_user(
        self,
        user_id: str,
        message: dict,
        exclude_client: Optional[str] = None
    ) -> int:
        """
        Broadcast a message to all connections of a user.

        Args:
            user_id: Target user
            message: Message to broadcast
            exclude_client: Optional client to exclude

        Returns:
            Number of clients message was sent to
        """
        client_ids = self.user_connections.get(user_id, set()).copy()

        if exclude_client:
            client_ids.discard(exclude_client)

        sent_count = 0
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                sent_count += 1

        return sent_count

    def get_connection(self, client_id: str) -> Optional[Connection]:
        """Get a connection by client ID."""
        return self.connections.get(client_id)

    def get_document_clients(self, document_id: str) -> list[str]:
        """Get all client IDs for a document."""
        return list(self.document_connections.get(document_id, set()))

    def get_document_users(self, document_id: str) -> list[str]:
        """Get all user IDs for a document."""
        client_ids = self.document_connections.get(document_id, set())
        user_ids = set()

        for client_id in client_ids:
            connection = self.connections.get(client_id)
            if connection:
                user_ids.add(connection.user_id)

        return list(user_ids)

    @property
    def connection_count(self) -> int:
        """Total number of active connections."""
        return len(self.connections)

    @property
    def document_count(self) -> int:
        """Number of documents with active connections."""
        return len(self.document_connections)

    @property
    def user_count(self) -> int:
        """Number of unique users connected."""
        return len(self.user_connections)

    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "total_connections": self.connection_count,
            "active_documents": self.document_count,
            "unique_users": self.user_count,
            "connections_per_document": {
                doc_id: len(clients)
                for doc_id, clients in self.document_connections.items()
            }
        }
