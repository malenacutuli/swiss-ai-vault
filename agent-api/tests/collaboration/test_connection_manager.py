"""Tests for WebSocket Connection Manager."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from app.collaboration.connection_manager import ConnectionManager, Connection


class MockWebSocket:
    """Mock WebSocket for testing."""

    def __init__(self):
        self.accepted = False
        self.sent_messages = []
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_json(self, data: dict):
        if self.closed:
            raise RuntimeError("WebSocket closed")
        self.sent_messages.append(data)

    async def close(self):
        self.closed = True


class TestConnectionManager:
    """Tests for ConnectionManager."""

    @pytest.fixture
    def manager(self):
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        return MockWebSocket()

    @pytest.mark.asyncio
    async def test_connect_creates_connection(self, manager, mock_websocket):
        """Connect creates a new connection."""
        connection = await manager.connect(
            mock_websocket, "client_1", "user_1"
        )

        assert mock_websocket.accepted
        assert connection.client_id == "client_1"
        assert connection.user_id == "user_1"
        assert manager.connection_count == 1

    @pytest.mark.asyncio
    async def test_connect_tracks_by_user(self, manager, mock_websocket):
        """Connections are tracked by user."""
        await manager.connect(mock_websocket, "client_1", "user_1")

        # Same user, different client
        ws2 = MockWebSocket()
        await manager.connect(ws2, "client_2", "user_1")

        assert manager.user_count == 1
        assert manager.connection_count == 2

    @pytest.mark.asyncio
    async def test_disconnect_removes_connection(self, manager, mock_websocket):
        """Disconnect removes the connection."""
        await manager.connect(mock_websocket, "client_1", "user_1")
        connection = await manager.disconnect("client_1")

        assert connection is not None
        assert connection.client_id == "client_1"
        assert manager.connection_count == 0

    @pytest.mark.asyncio
    async def test_disconnect_unknown_client(self, manager):
        """Disconnect unknown client returns None."""
        result = await manager.disconnect("unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_join_document(self, manager, mock_websocket):
        """Client can join a document."""
        await manager.connect(mock_websocket, "client_1", "user_1")
        result = await manager.join_document("client_1", "doc_1")

        assert result is True
        assert manager.document_count == 1
        assert "client_1" in manager.get_document_clients("doc_1")

    @pytest.mark.asyncio
    async def test_join_document_unknown_client(self, manager):
        """Join document with unknown client fails."""
        result = await manager.join_document("unknown", "doc_1")
        assert result is False

    @pytest.mark.asyncio
    async def test_leave_document(self, manager, mock_websocket):
        """Client can leave a document."""
        await manager.connect(mock_websocket, "client_1", "user_1")
        await manager.join_document("client_1", "doc_1")
        result = await manager.leave_document("client_1")

        assert result is True
        assert manager.document_count == 0

    @pytest.mark.asyncio
    async def test_send_to_client(self, manager, mock_websocket):
        """Send message to specific client."""
        await manager.connect(mock_websocket, "client_1", "user_1")

        result = await manager.send_to_client(
            "client_1", {"type": "test"}
        )

        assert result is True
        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0] == {"type": "test"}

    @pytest.mark.asyncio
    async def test_send_to_unknown_client(self, manager):
        """Send to unknown client returns False."""
        result = await manager.send_to_client(
            "unknown", {"type": "test"}
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_broadcast_to_document(self, manager):
        """Broadcast message to all clients in document."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws3 = MockWebSocket()

        await manager.connect(ws1, "client_1", "user_1")
        await manager.connect(ws2, "client_2", "user_2")
        await manager.connect(ws3, "client_3", "user_3")

        await manager.join_document("client_1", "doc_1")
        await manager.join_document("client_2", "doc_1")
        await manager.join_document("client_3", "doc_2")

        sent = await manager.broadcast_to_document(
            "doc_1", {"type": "broadcast"}
        )

        assert sent == 2
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        assert len(ws3.sent_messages) == 0

    @pytest.mark.asyncio
    async def test_broadcast_excludes_client(self, manager):
        """Broadcast can exclude specific client."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        await manager.connect(ws1, "client_1", "user_1")
        await manager.connect(ws2, "client_2", "user_2")

        await manager.join_document("client_1", "doc_1")
        await manager.join_document("client_2", "doc_1")

        sent = await manager.broadcast_to_document(
            "doc_1", {"type": "broadcast"},
            exclude_client="client_1"
        )

        assert sent == 1
        assert len(ws1.sent_messages) == 0
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_get_document_users(self, manager):
        """Get all users in a document."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        await manager.connect(ws1, "client_1", "user_1")
        await manager.connect(ws2, "client_2", "user_2")

        await manager.join_document("client_1", "doc_1")
        await manager.join_document("client_2", "doc_1")

        users = manager.get_document_users("doc_1")

        assert len(users) == 2
        assert "user_1" in users
        assert "user_2" in users

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get connection statistics."""
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        await manager.connect(ws1, "client_1", "user_1")
        await manager.connect(ws2, "client_2", "user_2")
        await manager.join_document("client_1", "doc_1")

        stats = manager.get_stats()

        assert stats["total_connections"] == 2
        assert stats["active_documents"] == 1
        assert stats["unique_users"] == 2

    @pytest.mark.asyncio
    async def test_on_connect_callback(self, manager, mock_websocket):
        """Connect callback is invoked."""
        callback_connections = []

        async def on_connect(conn):
            callback_connections.append(conn)

        manager.on_connect = on_connect

        await manager.connect(mock_websocket, "client_1", "user_1")

        assert len(callback_connections) == 1
        assert callback_connections[0].client_id == "client_1"

    @pytest.mark.asyncio
    async def test_on_disconnect_callback(self, manager, mock_websocket):
        """Disconnect callback is invoked."""
        callback_connections = []

        async def on_disconnect(conn):
            callback_connections.append(conn)

        manager.on_disconnect = on_disconnect

        await manager.connect(mock_websocket, "client_1", "user_1")
        await manager.disconnect("client_1")

        assert len(callback_connections) == 1
        assert callback_connections[0].client_id == "client_1"
