"""Tests for WebSocket Gateway."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.collaboration.websocket_gateway import (
    CollaborationGateway,
    WebSocketMessage,
)
from app.collaboration.ot_types import create_insert


class MockWebSocket:
    """Mock WebSocket for testing."""

    def __init__(self):
        self.accepted = False
        self.sent_messages = []
        self.received_messages = []
        self.closed = False
        self._receive_queue = asyncio.Queue()

    async def accept(self):
        self.accepted = True

    async def send_json(self, data: dict):
        if self.closed:
            raise RuntimeError("WebSocket closed")
        self.sent_messages.append(data)

    async def receive_json(self):
        if self.closed:
            raise RuntimeError("WebSocket closed")
        return await self._receive_queue.get()

    def queue_message(self, message: dict):
        """Queue a message to be received."""
        self._receive_queue.put_nowait(message)

    async def close(self):
        self.closed = True


class TestCollaborationGateway:
    """Tests for CollaborationGateway."""

    @pytest.fixture
    def gateway(self):
        return CollaborationGateway()

    @pytest.fixture
    def mock_websocket(self):
        return MockWebSocket()

    @pytest.mark.asyncio
    async def test_gateway_initialization(self, gateway):
        """Gateway initializes with all components."""
        assert gateway.ot_server is not None
        assert gateway.connections is not None
        assert gateway.presence is not None
        assert gateway.redis_sync is None  # No Redis provided

    @pytest.mark.asyncio
    async def test_gateway_with_redis(self):
        """Gateway can be initialized with Redis."""
        mock_redis = MagicMock()
        mock_redis.pubsub = MagicMock(return_value=AsyncMock())

        gateway = CollaborationGateway(redis_client=mock_redis)

        assert gateway.redis_sync is not None

    @pytest.mark.asyncio
    async def test_handle_register(self, gateway, mock_websocket):
        """Register joins a document and returns initial state."""
        # Connect first
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        # Simulate registration
        message = WebSocketMessage(
            type="register",
            document_id="doc_1",
            user_name="Alice"
        )

        await gateway._handle_register(connection, message)

        # Check response
        assert len(mock_websocket.sent_messages) == 1
        response = mock_websocket.sent_messages[0]

        assert response["type"] == "registered"
        assert response["document_id"] == "doc_1"
        assert response["version"] == 0
        assert response["content"] == ""
        assert "your_presence" in response

    @pytest.mark.asyncio
    async def test_handle_register_missing_document(self, gateway, mock_websocket):
        """Register without document_id returns error."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        message = WebSocketMessage(type="register")

        await gateway._handle_register(connection, message)

        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0]["type"] == "error"

    @pytest.mark.asyncio
    async def test_handle_operation(self, gateway, mock_websocket):
        """Operation is processed and acknowledged."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        # Register first
        reg_message = WebSocketMessage(
            type="register", document_id="doc_1"
        )
        await gateway._handle_register(connection, reg_message)
        mock_websocket.sent_messages.clear()

        # Send operation
        op_message = WebSocketMessage(
            type="operation",
            batch={
                "id": "batch_1",
                "user_id": "user_1",
                "document_id": "doc_1",
                "version": 0,
                "operations": [
                    {"type": "insert", "position": 0, "text": "Hello"}
                ],
                "timestamp": 12345.0,
            }
        )

        await gateway._handle_operation(connection, op_message)

        # Check acknowledgment
        assert len(mock_websocket.sent_messages) == 1
        response = mock_websocket.sent_messages[0]

        assert response["type"] == "ack"
        assert response["version"] == 1
        assert "batch_id" in response

    @pytest.mark.asyncio
    async def test_handle_cursor(self, gateway, mock_websocket):
        """Cursor update is processed."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        # Register first
        reg_message = WebSocketMessage(
            type="register", document_id="doc_1"
        )
        await gateway._handle_register(connection, reg_message)

        # Update cursor
        cursor_message = WebSocketMessage(
            type="cursor",
            position=5,
            selection_start=3,
            selection_end=5
        )

        await gateway._handle_cursor(connection, cursor_message)

        # Check presence was updated
        presence = gateway.presence.get_user_presence("doc_1", "client_1")
        assert presence.cursor_position == 5
        assert presence.selection_start == 3
        assert presence.selection_end == 5

    @pytest.mark.asyncio
    async def test_handle_sync(self, gateway, mock_websocket):
        """Sync returns current document state."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        # Register first
        reg_message = WebSocketMessage(
            type="register", document_id="doc_1"
        )
        await gateway._handle_register(connection, reg_message)
        mock_websocket.sent_messages.clear()

        # Request sync
        sync_message = WebSocketMessage(
            type="sync",
            version=0
        )

        await gateway._handle_sync(connection, sync_message)

        assert len(mock_websocket.sent_messages) == 1
        response = mock_websocket.sent_messages[0]

        assert response["type"] == "sync"
        assert response["synced"] is True

    @pytest.mark.asyncio
    async def test_handle_heartbeat(self, gateway, mock_websocket):
        """Heartbeat is acknowledged."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        message = WebSocketMessage(type="heartbeat")

        await gateway._handle_heartbeat(connection, message)

        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0]["type"] == "heartbeat_ack"

    @pytest.mark.asyncio
    async def test_cleanup_client(self, gateway, mock_websocket):
        """Cleanup properly removes client."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        # Register
        reg_message = WebSocketMessage(
            type="register", document_id="doc_1"
        )
        await gateway._handle_register(connection, reg_message)

        # Cleanup
        await gateway._cleanup_client("client_1")

        assert gateway.connections.connection_count == 0
        assert gateway.presence.get_document_presence("doc_1") == []

    @pytest.mark.asyncio
    async def test_broadcast_operation_to_other_clients(self, gateway):
        """Operations are broadcast to other clients."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        conn1 = await gateway.connections.connect(ws1, "client_1", "user_1")
        conn2 = await gateway.connections.connect(ws2, "client_2", "user_2")

        # Both register for same document
        for conn, ws in [(conn1, ws1), (conn2, ws2)]:
            reg = WebSocketMessage(type="register", document_id="doc_1")
            await gateway._handle_register(conn, reg)
            ws.sent_messages.clear()

        # Client 1 sends operation
        op_message = WebSocketMessage(
            type="operation",
            batch={
                "id": "batch_1",
                "user_id": "user_1",
                "document_id": "doc_1",
                "version": 0,
                "operations": [
                    {"type": "insert", "position": 0, "text": "Hello"}
                ],
                "timestamp": 12345.0,
            }
        )
        await gateway._handle_operation(conn1, op_message)

        # Client 1 gets ack
        assert any(m["type"] == "ack" for m in ws1.sent_messages)

        # Client 2 gets broadcast
        broadcast_msgs = [m for m in ws2.sent_messages if m["type"] == "operation"]
        assert len(broadcast_msgs) == 1

    @pytest.mark.asyncio
    async def test_presence_broadcast_on_join(self, gateway):
        """Presence join is broadcast to other clients."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        conn1 = await gateway.connections.connect(ws1, "client_1", "user_1")
        await gateway.connections.connect(ws2, "client_2", "user_2")

        # Client 1 registers first
        reg1 = WebSocketMessage(
            type="register", document_id="doc_1", user_name="Alice"
        )
        await gateway._handle_register(conn1, reg1)

        # Client 2 joins same document
        conn2 = gateway.connections.get_connection("client_2")
        reg2 = WebSocketMessage(
            type="register", document_id="doc_1", user_name="Bob"
        )
        await gateway._handle_register(conn2, reg2)

        # Client 1 should receive presence_join for Bob
        presence_msgs = [m for m in ws1.sent_messages if m["type"] == "presence_join"]
        assert len(presence_msgs) >= 1

    @pytest.mark.asyncio
    async def test_get_stats(self, gateway, mock_websocket):
        """Get gateway statistics."""
        connection = await gateway.connections.connect(
            mock_websocket, "client_1", "user_1"
        )

        reg_message = WebSocketMessage(
            type="register", document_id="doc_1"
        )
        await gateway._handle_register(connection, reg_message)

        stats = gateway.get_stats()

        assert "connections" in stats
        assert "presence" in stats
        assert stats["connections"]["total_connections"] == 1


class TestWebSocketMessage:
    """Tests for WebSocketMessage."""

    def test_minimal_message(self):
        """Create message with just type."""
        msg = WebSocketMessage(type="heartbeat")
        assert msg.type == "heartbeat"

    def test_full_message(self):
        """Create message with all fields."""
        msg = WebSocketMessage(
            type="operation",
            document_id="doc_1",
            batch={"id": "batch_1"},
            position=10,
            selection_start=5,
            selection_end=10,
            version=5,
            user_name="Alice"
        )

        assert msg.type == "operation"
        assert msg.document_id == "doc_1"
        assert msg.batch == {"id": "batch_1"}
        assert msg.position == 10
