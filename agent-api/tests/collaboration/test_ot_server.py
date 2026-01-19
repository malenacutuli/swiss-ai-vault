"""Tests for OT Server."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock

from app.collaboration.ot_types import (
    Operation,
    OperationBatch,
    Document,
    Cursor,
    create_insert,
    create_delete,
)
from app.collaboration.ot_server import OTServer, ClientState, OTInvariantChecker


class TestClientRegistration:
    """Tests for client registration."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_register_new_client(self, server):
        """Register a new client for a new document."""
        result = await server.register_client(
            client_id="client_1",
            user_id="user_1",
            document_id="doc_1"
        )

        assert result["registered"] is True
        assert result["document_id"] == "doc_1"
        assert result["version"] == 0
        assert result["content"] == ""
        assert "hash" in result

    @pytest.mark.asyncio
    async def test_register_multiple_clients_same_document(self, server):
        """Multiple clients can register for the same document."""
        await server.register_client("client_1", "user_1", "doc_1")
        result = await server.register_client("client_2", "user_2", "doc_1")

        assert result["registered"] is True
        clients = await server.get_document_clients("doc_1")
        assert len(clients) == 2
        assert "client_1" in clients
        assert "client_2" in clients

    @pytest.mark.asyncio
    async def test_unregister_client(self, server):
        """Unregistering removes client from document."""
        await server.register_client("client_1", "user_1", "doc_1")
        await server.unregister_client("client_1")

        clients = await server.get_document_clients("doc_1")
        assert "client_1" not in clients


class TestOperationHandling:
    """Tests for operation handling."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_handle_simple_insert(self, server):
        """Handle a simple insert operation."""
        await server.register_client("client_1", "user_1", "doc_1")

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        result = await server.handle_operation("client_1", batch)

        assert result["ack"] is True
        assert result["version"] == 1

        doc = await server.get_document("doc_1")
        assert doc.content == "Hello"

    @pytest.mark.asyncio
    async def test_handle_insert_delete_sequence(self, server):
        """Handle insert followed by delete."""
        await server.register_client("client_1", "user_1", "doc_1")

        # Insert
        insert_batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello World")]
        )
        await server.handle_operation("client_1", insert_batch)

        # Delete " World"
        delete_batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=1,
            operations=[create_delete(5, 6)]
        )
        result = await server.handle_operation("client_1", delete_batch)

        assert result["ack"] is True
        doc = await server.get_document("doc_1")
        assert doc.content == "Hello"

    @pytest.mark.asyncio
    async def test_handle_unregistered_client(self, server):
        """Unregistered client receives error."""
        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        result = await server.handle_operation("unknown_client", batch)

        assert "error" in result
        assert result["code"] == "CLIENT_NOT_REGISTERED"

    @pytest.mark.asyncio
    async def test_handle_unknown_document(self, server):
        """Operation on unknown document returns error."""
        await server.register_client("client_1", "user_1", "doc_1")

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_unknown",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        result = await server.handle_operation("client_1", batch)

        assert "error" in result
        assert result["code"] == "DOCUMENT_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_handle_version_ahead(self, server):
        """Operation with version ahead of server fails."""
        await server.register_client("client_1", "user_1", "doc_1")

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=5,  # Document is at version 0
            operations=[create_insert(0, "Hello")]
        )

        result = await server.handle_operation("client_1", batch)

        assert "error" in result
        assert result["code"] == "VERSION_AHEAD"


class TestConcurrentOperations:
    """Tests for concurrent operation handling."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_concurrent_inserts_different_positions(self, server):
        """Two clients inserting at different positions."""
        await server.register_client("client_1", "user_1", "doc_1")
        await server.register_client("client_2", "user_2", "doc_1")

        # Set up initial content
        init_batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello World")]
        )
        await server.handle_operation("client_1", init_batch)

        # Client 1 inserts at start
        batch_1 = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=1,
            operations=[create_insert(0, "A")]
        )

        # Client 2 inserts at end (based on version 1)
        batch_2 = OperationBatch(
            user_id="user_2",
            document_id="doc_1",
            version=1,
            operations=[create_insert(11, "B")]
        )

        await server.handle_operation("client_1", batch_1)
        result = await server.handle_operation("client_2", batch_2)

        # Batch 2 should be transformed (position shifted by 1)
        assert result["ack"] is True

        doc = await server.get_document("doc_1")
        # "A" + "Hello World" + "B" = "AHello WorldB"
        assert doc.content == "AHello WorldB"

    @pytest.mark.asyncio
    async def test_concurrent_inserts_same_position(self, server):
        """Two clients inserting at the same position."""
        await server.register_client("client_1", "user_1", "doc_1")
        await server.register_client("client_2", "user_2", "doc_1")

        # Both insert at position 0
        batch_1 = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "AAA")]
        )

        batch_2 = OperationBatch(
            user_id="user_2",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "BBB")]
        )

        await server.handle_operation("client_1", batch_1)
        await server.handle_operation("client_2", batch_2)

        doc = await server.get_document("doc_1")
        # First batch wins, second is transformed
        # Result should be "AAABBB" (server priority for first op)
        assert doc.content == "AAABBB"


class TestClientSync:
    """Tests for client synchronization."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_sync_up_to_date_client(self, server):
        """Client already up to date."""
        await server.register_client("client_1", "user_1", "doc_1")

        result = await server.sync_client("client_1", "doc_1", 0)

        assert result["synced"] is True
        assert result["version"] == 0
        assert result["operations"] == []

    @pytest.mark.asyncio
    async def test_sync_behind_client(self, server):
        """Client behind server receives missed operations."""
        await server.register_client("client_1", "user_1", "doc_1")

        # Apply some operations
        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )
        await server.handle_operation("client_1", batch)

        # Sync client that's at version 0
        result = await server.sync_client("client_1", "doc_1", 0)

        assert result["synced"] is True
        assert result["version"] == 1
        assert len(result["operations"]) == 1
        assert result["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_sync_unknown_document(self, server):
        """Sync with unknown document returns error."""
        result = await server.sync_client("client_1", "unknown_doc", 0)

        assert "error" in result
        assert result["code"] == "DOCUMENT_NOT_FOUND"


class TestCursorHandling:
    """Tests for cursor position handling."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_cursor_update(self, server):
        """Cursor position is tracked."""
        await server.register_client("client_1", "user_1", "doc_1")

        cursor = Cursor(user_id="user_1", position=5)
        await server.handle_cursor_update("client_1", "doc_1", cursor)

        client = server.clients["client_1"]
        assert client.cursor.position == 5

    @pytest.mark.asyncio
    async def test_cursor_broadcast(self, server):
        """Cursor updates are broadcast to other clients."""
        broadcast_calls = []

        async def mock_broadcast(client_id: str, message: dict):
            broadcast_calls.append((client_id, message))

        server.on_broadcast = mock_broadcast

        await server.register_client("client_1", "user_1", "doc_1")
        await server.register_client("client_2", "user_2", "doc_1")

        cursor = Cursor(user_id="user_1", position=5)
        await server.handle_cursor_update("client_1", "doc_1", cursor)

        # Should broadcast to client_2 only
        assert len(broadcast_calls) == 1
        assert broadcast_calls[0][0] == "client_2"
        assert broadcast_calls[0][1]["type"] == "cursor"


class TestBroadcasting:
    """Tests for operation broadcasting."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_operation_broadcast(self, server):
        """Operations are broadcast to other clients."""
        broadcast_calls = []

        async def mock_broadcast(client_id: str, message: dict):
            broadcast_calls.append((client_id, message))

        server.on_broadcast = mock_broadcast

        await server.register_client("client_1", "user_1", "doc_1")
        await server.register_client("client_2", "user_2", "doc_1")

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        await server.handle_operation("client_1", batch)

        # Should broadcast to client_2 only
        assert len(broadcast_calls) == 1
        assert broadcast_calls[0][0] == "client_2"
        assert broadcast_calls[0][1]["type"] == "operation"

    @pytest.mark.asyncio
    async def test_cursor_removed_on_unregister(self, server):
        """Cursor removal is broadcast when client unregisters."""
        broadcast_calls = []

        async def mock_broadcast(client_id: str, message: dict):
            broadcast_calls.append((client_id, message))

        server.on_broadcast = mock_broadcast

        await server.register_client("client_1", "user_1", "doc_1")
        await server.register_client("client_2", "user_2", "doc_1")

        await server.unregister_client("client_1")

        # Should broadcast cursor_removed to client_2
        cursor_removed = [c for c in broadcast_calls if c[1]["type"] == "cursor_removed"]
        assert len(cursor_removed) == 1
        assert cursor_removed[0][1]["user_id"] == "user_1"


class TestInvariantChecker:
    """Tests for OT invariant checker."""

    @pytest.fixture
    def checker(self):
        return OTInvariantChecker()

    def test_verify_convergence_same_content(self, checker):
        """Documents with same content converge."""
        doc_a = Document(content="Hello", version=1)
        doc_b = Document(content="Hello", version=1)

        assert checker.verify_convergence(doc_a, doc_b) is True

    def test_verify_convergence_different_content(self, checker):
        """Documents with different content don't converge."""
        doc_a = Document(content="Hello", version=1)
        doc_b = Document(content="World", version=1)

        assert checker.verify_convergence(doc_a, doc_b) is False

    def test_verify_convergence_different_version(self, checker):
        """Documents with different versions don't converge."""
        doc_a = Document(content="Hello", version=1)
        doc_b = Document(content="Hello", version=2)

        assert checker.verify_convergence(doc_a, doc_b) is False

    def test_tp1_insert_insert(self, checker):
        """TP1 holds for INSERT + INSERT."""
        assert checker.verify_transformation_property(
            "Hello",
            create_insert(0, "A"),
            create_insert(5, "B")
        )

    def test_tp1_insert_delete(self, checker):
        """TP1 holds for INSERT + DELETE."""
        assert checker.verify_transformation_property(
            "Hello World",
            create_insert(5, "X"),
            create_delete(6, 5)
        )

    def test_tp1_delete_delete(self, checker):
        """TP1 holds for DELETE + DELETE."""
        assert checker.verify_transformation_property(
            "Hello World",
            create_delete(0, 5),
            create_delete(6, 5)
        )


class TestDocumentCallbacks:
    """Tests for document change callbacks."""

    @pytest.fixture
    def server(self):
        return OTServer()

    @pytest.mark.asyncio
    async def test_document_change_callback(self, server):
        """Document change callback is invoked."""
        callback_calls = []

        async def mock_callback(doc_id: str, doc: Document):
            callback_calls.append((doc_id, doc.content))

        server.on_document_change = mock_callback

        await server.register_client("client_1", "user_1", "doc_1")

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        await server.handle_operation("client_1", batch)

        assert len(callback_calls) == 1
        assert callback_calls[0][0] == "doc_1"
        assert callback_calls[0][1] == "Hello"
