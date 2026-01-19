"""
OT Server - Server-Side Operational Transformation Engine

Responsibilities:
    1. Receive operations from clients
    2. Transform operations against concurrent edits
    3. Apply operations to document
    4. Broadcast transformed operations to all clients
    5. Handle client reconnection and sync

Consistency guarantees:
    - All clients eventually see the same document state
    - Operations are applied in a consistent order
    - No operations are lost
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable, Any

from app.collaboration.ot_types import (
    Operation,
    OperationBatch,
    OperationType,
    Document,
    Cursor,
)
from app.collaboration.ot_transformer import OTTransformer
from app.collaboration.cursor_transformer import CursorTransformer

logger = logging.getLogger(__name__)


@dataclass
class ClientState:
    """State for a connected client."""
    client_id: str
    user_id: str
    document_id: str
    last_acknowledged_version: int
    pending_operations: list[OperationBatch] = field(default_factory=list)
    cursor: Optional[Cursor] = None


class OTServer:
    """
    Server-side OT engine.

    Handles concurrent document editing with operational transformation.
    """

    def __init__(self, supabase: Optional[Any] = None):
        """
        Initialize OT server.

        Args:
            supabase: Optional Supabase client for persistence
        """
        self.supabase = supabase
        self.documents: dict[str, Document] = {}
        self.clients: dict[str, ClientState] = {}  # client_id -> state
        self.document_clients: dict[str, set[str]] = {}  # document_id -> client_ids
        self.transformer = OTTransformer()
        self.cursor_transformer = CursorTransformer()
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_broadcast: Optional[Callable[[str, dict], Awaitable[None]]] = None
        self.on_document_change: Optional[Callable[[str, Document], Awaitable[None]]] = None

    async def handle_operation(
        self,
        client_id: str,
        batch: OperationBatch
    ) -> dict:
        """
        Handle an operation batch from a client.

        Algorithm:
            1. Validate the operation
            2. Transform against any operations the client hasn't seen
            3. Apply to document
            4. Broadcast to all clients
            5. Return acknowledgment

        Args:
            client_id: ID of the client sending the operation
            batch: Operation batch to apply

        Returns:
            Acknowledgment with new version
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if not client:
                return {"error": "Client not registered", "code": "CLIENT_NOT_REGISTERED"}

            document = self.documents.get(batch.document_id)
            if not document:
                return {"error": "Document not found", "code": "DOCUMENT_NOT_FOUND"}

            # Step 1: Validate
            if batch.version > document.version:
                return {
                    "error": f"Invalid version: {batch.version} > {document.version}",
                    "code": "VERSION_AHEAD"
                }

            # Step 2: Transform against operations client hasn't seen
            transformed_batch = batch

            if batch.version < document.version:
                # Client is behind - transform against missed operations
                missed_operations = document.history[batch.version:]

                for missed_batch in missed_operations:
                    if missed_batch.user_id == client.user_id:
                        # Skip own operations
                        continue

                    # Transform our batch against the missed batch
                    _, transformed_batch = self.transformer.transform_batch(
                        missed_batch,
                        transformed_batch,
                        priority="left"  # Server operations have priority
                    )

            # Update version to current
            transformed_batch.version = document.version

            # Step 3: Apply to document
            try:
                document.apply_batch(transformed_batch)
            except Exception as e:
                logger.error(f"Failed to apply batch: {e}")
                return {"error": str(e), "code": "APPLY_FAILED"}

            # Step 4: Persist to database (if configured)
            if self.supabase:
                await self._persist_operation(document, transformed_batch)

            # Step 5: Broadcast to all clients
            await self._broadcast_operation(
                batch.document_id,
                transformed_batch,
                exclude_client=client_id
            )

            # Notify document change
            if self.on_document_change:
                await self.on_document_change(batch.document_id, document)

            # Step 6: Update client state
            client.last_acknowledged_version = document.version

            # Step 7: Return acknowledgment
            return {
                "ack": True,
                "version": document.version,
                "batch_id": batch.id,
                "transformed": transformed_batch.to_dict() if transformed_batch != batch else None,
                "hash": document.compute_hash()
            }

    async def handle_cursor_update(
        self,
        client_id: str,
        document_id: str,
        cursor: Cursor
    ) -> None:
        """Handle cursor position update from a client."""
        async with self._lock:
            client = self.clients.get(client_id)
            if not client:
                return

            client.cursor = cursor

            # Broadcast cursor to other clients
            await self._broadcast_cursor(document_id, cursor, exclude_client=client_id)

    async def sync_client(
        self,
        client_id: str,
        document_id: str,
        client_version: int
    ) -> dict:
        """
        Sync a client that may be behind.

        Returns operations the client needs to catch up.

        Args:
            client_id: Client requesting sync
            document_id: Document to sync
            client_version: Client's current version

        Returns:
            Sync response with missed operations
        """
        async with self._lock:
            document = self.documents.get(document_id)
            if not document:
                return {"error": "Document not found", "code": "DOCUMENT_NOT_FOUND"}

            if client_version > document.version:
                return {"error": "Client version ahead of server", "code": "VERSION_AHEAD"}

            if client_version == document.version:
                return {
                    "synced": True,
                    "version": document.version,
                    "operations": [],
                    "hash": document.compute_hash()
                }

            # Get operations client needs
            missed_operations = document.history[client_version:]

            return {
                "synced": True,
                "version": document.version,
                "operations": [batch.to_dict() for batch in missed_operations],
                "content": document.content,  # Full content for verification
                "hash": document.compute_hash()
            }

    async def register_client(
        self,
        client_id: str,
        user_id: str,
        document_id: str
    ) -> dict:
        """
        Register a new client for a document.

        Args:
            client_id: Unique client identifier
            user_id: User identifier
            document_id: Document to join

        Returns:
            Registration response with initial document state
        """
        async with self._lock:
            # Create document if doesn't exist
            if document_id not in self.documents:
                # Try to load from database
                if self.supabase:
                    document = await self._load_document(document_id)
                else:
                    document = None

                if document:
                    self.documents[document_id] = document
                else:
                    self.documents[document_id] = Document(id=document_id)

            document = self.documents[document_id]

            # Create client state
            self.clients[client_id] = ClientState(
                client_id=client_id,
                user_id=user_id,
                document_id=document_id,
                last_acknowledged_version=document.version
            )

            # Track client for document
            if document_id not in self.document_clients:
                self.document_clients[document_id] = set()
            self.document_clients[document_id].add(client_id)

            # Get other users' cursors
            other_cursors = []
            for cid in self.document_clients[document_id]:
                if cid != client_id:
                    other_client = self.clients.get(cid)
                    if other_client and other_client.cursor:
                        other_cursors.append(other_client.cursor.to_dict())

            logger.info(f"Client {client_id} (user {user_id}) registered for document {document_id}")

            return {
                "registered": True,
                "document_id": document_id,
                "version": document.version,
                "content": document.content,
                "hash": document.compute_hash(),
                "cursors": other_cursors
            }

    async def unregister_client(self, client_id: str) -> None:
        """
        Unregister a client.

        Args:
            client_id: Client to unregister
        """
        async with self._lock:
            client = self.clients.pop(client_id, None)
            if client:
                doc_clients = self.document_clients.get(client.document_id)
                if doc_clients:
                    doc_clients.discard(client_id)

                # Broadcast cursor removal
                await self._broadcast_cursor_removed(
                    client.document_id,
                    client.user_id
                )

                logger.info(f"Client {client_id} unregistered from document {client.document_id}")

    async def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID."""
        async with self._lock:
            return self.documents.get(document_id)

    async def get_document_clients(self, document_id: str) -> list[str]:
        """Get all client IDs for a document."""
        async with self._lock:
            return list(self.document_clients.get(document_id, set()))

    async def _broadcast_operation(
        self,
        document_id: str,
        batch: OperationBatch,
        exclude_client: Optional[str] = None
    ) -> None:
        """Broadcast an operation to all clients of a document."""
        if not self.on_broadcast:
            return

        client_ids = self.document_clients.get(document_id, set())

        message = {
            "type": "operation",
            "batch": batch.to_dict()
        }

        for client_id in client_ids:
            if client_id != exclude_client:
                try:
                    await self.on_broadcast(client_id, message)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {client_id}: {e}")

    async def _broadcast_cursor(
        self,
        document_id: str,
        cursor: Cursor,
        exclude_client: Optional[str] = None
    ) -> None:
        """Broadcast cursor position to all clients."""
        if not self.on_broadcast:
            return

        client_ids = self.document_clients.get(document_id, set())

        message = {
            "type": "cursor",
            "user_id": cursor.user_id,
            "position": cursor.position,
            "selection_start": cursor.selection_start,
            "selection_end": cursor.selection_end
        }

        for client_id in client_ids:
            if client_id != exclude_client:
                try:
                    await self.on_broadcast(client_id, message)
                except Exception as e:
                    logger.error(f"Failed to broadcast cursor to {client_id}: {e}")

    async def _broadcast_cursor_removed(
        self,
        document_id: str,
        user_id: str
    ) -> None:
        """Broadcast cursor removal to all clients."""
        if not self.on_broadcast:
            return

        client_ids = self.document_clients.get(document_id, set())

        message = {
            "type": "cursor_removed",
            "user_id": user_id
        }

        for client_id in client_ids:
            try:
                await self.on_broadcast(client_id, message)
            except Exception as e:
                logger.error(f"Failed to broadcast cursor removal to {client_id}: {e}")

    async def _persist_operation(
        self,
        document: Document,
        batch: OperationBatch
    ) -> None:
        """Persist an operation to the database."""
        if not self.supabase:
            return

        try:
            self.supabase.rpc(
                "save_operation_batch",
                {
                    "p_document_id": document.id,
                    "p_batch_id": batch.id,
                    "p_user_id": batch.user_id,
                    "p_version": document.version,
                    "p_operations": [op.to_dict() for op in batch.operations],
                    "p_new_content": document.content,
                    "p_source": batch.source
                }
            ).execute()
        except Exception as e:
            logger.error(f"Failed to persist operation: {e}")

    async def _load_document(self, document_id: str) -> Optional[Document]:
        """Load a document from the database."""
        if not self.supabase:
            return None

        try:
            result = self.supabase.table("ot_documents").select(
                "*"
            ).eq(
                "id", document_id
            ).single().execute()

            if result.data:
                doc = Document(
                    id=result.data["id"],
                    content=result.data["content"],
                    version=result.data["version"]
                )

                # Load history
                history_result = self.supabase.table("ot_operation_history").select(
                    "*"
                ).eq(
                    "document_id", document_id
                ).order(
                    "version"
                ).execute()

                for row in history_result.data:
                    batch = OperationBatch(
                        id=row["batch_id"],
                        user_id=row["user_id"],
                        document_id=document_id,
                        version=row["version"],
                        operations=[Operation.from_dict(op) for op in row["operations"]],
                        timestamp=row["timestamp"],
                        source=row.get("source", "user")
                    )
                    doc.history.append(batch)

                return doc

            return None

        except Exception as e:
            logger.error(f"Failed to load document: {e}")
            return None


class OTInvariantChecker:
    """
    Verifies OT invariants are maintained.

    Critical invariants:
        1. Convergence: All clients reach the same state
        2. Intention preservation: User intent is preserved after transformation
        3. Causality: Operations respect causal ordering
    """

    def verify_convergence(
        self,
        doc_a: Document,
        doc_b: Document
    ) -> bool:
        """
        Verify two documents have converged to the same state.

        Invariant: After applying all operations, content must be identical.
        """
        return doc_a.content == doc_b.content and doc_a.version == doc_b.version

    def verify_transformation_property(
        self,
        original_content: str,
        op_a: Operation,
        op_b: Operation
    ) -> bool:
        """
        Verify TP1 (Transformation Property 1).

        Invariant:
            apply(apply(doc, A), transform(B, A)) ==
            apply(apply(doc, B), transform(A, B))
        """
        transformer = OTTransformer()

        # Transform operations
        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        # Path 1: Apply A, then B'
        content_1 = self._apply_op(original_content, op_a)
        if b_prime:
            content_1 = self._apply_op(content_1, b_prime)

        # Path 2: Apply B, then A'
        content_2 = self._apply_op(original_content, op_b)
        if a_prime:
            content_2 = self._apply_op(content_2, a_prime)

        return content_1 == content_2

    def _apply_op(self, content: str, op: Operation) -> str:
        """Apply operation to content."""
        if op is None:
            return content

        if op.type == OperationType.INSERT:
            return content[:op.position] + op.text + content[op.position:]
        elif op.type == OperationType.DELETE:
            return content[:op.position] + content[op.position + op.count:]
        return content
