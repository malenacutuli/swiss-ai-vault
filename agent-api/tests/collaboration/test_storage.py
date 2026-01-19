"""Tests for Storage Backends."""

import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta

from app.collaboration.storage import (
    StorageBackend,
    StorageConfig,
    StorageMetadata,
    StoredDocument,
    InMemoryStorage,
    FileStorage,
    StorageManager,
    StorageError,
    DocumentNotFoundError,
    StorageFullError,
    StorageCorruptionError,
    get_storage,
    set_storage,
    reset_storage,
)


class TestStorageConfig:
    """Tests for StorageConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = StorageConfig()

        assert config.max_document_size == 10 * 1024 * 1024
        assert config.compression_enabled is True
        assert config.checksum_enabled is True

    def test_custom_config(self):
        """Can customize config."""
        config = StorageConfig(
            max_document_size=1024,
            compression_enabled=False,
        )

        assert config.max_document_size == 1024
        assert config.compression_enabled is False


class TestStorageMetadata:
    """Tests for StorageMetadata."""

    def test_to_dict(self):
        """Convert metadata to dictionary."""
        now = datetime.utcnow()
        meta = StorageMetadata(
            document_id="doc_1",
            version=5,
            content_hash="abc123",
            size=1024,
            compressed=True,
            encrypted=False,
            created_at=now,
            updated_at=now,
        )

        d = meta.to_dict()

        assert d["document_id"] == "doc_1"
        assert d["version"] == 5
        assert d["compressed"] is True

    def test_from_dict(self):
        """Create metadata from dictionary."""
        data = {
            "document_id": "doc_1",
            "version": 5,
            "content_hash": "abc123",
            "size": 1024,
            "compressed": True,
            "encrypted": False,
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00",
        }

        meta = StorageMetadata.from_dict(data)

        assert meta.document_id == "doc_1"
        assert meta.version == 5


class TestInMemoryStorage:
    """Tests for InMemoryStorage."""

    @pytest.fixture
    def storage(self):
        return InMemoryStorage()

    @pytest.mark.asyncio
    async def test_save_and_load(self, storage):
        """Save and load document."""
        meta = await storage.save("doc_1", "Hello, World!", 1)

        assert meta.document_id == "doc_1"
        assert meta.version == 1

        doc = await storage.load("doc_1")

        assert doc.content == "Hello, World!"
        assert doc.metadata.document_id == "doc_1"

    @pytest.mark.asyncio
    async def test_load_not_found(self, storage):
        """Load non-existent document raises error."""
        with pytest.raises(DocumentNotFoundError):
            await storage.load("nonexistent")

    @pytest.mark.asyncio
    async def test_delete(self, storage):
        """Delete document."""
        await storage.save("doc_1", "content", 1)

        result = await storage.delete("doc_1")
        assert result is True

        with pytest.raises(DocumentNotFoundError):
            await storage.load("doc_1")

    @pytest.mark.asyncio
    async def test_delete_not_found(self, storage):
        """Delete non-existent document returns False."""
        result = await storage.delete("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_exists(self, storage):
        """Check document existence."""
        assert await storage.exists("doc_1") is False

        await storage.save("doc_1", "content", 1)

        assert await storage.exists("doc_1") is True

    @pytest.mark.asyncio
    async def test_list_documents(self, storage):
        """List stored documents."""
        await storage.save("doc_a", "content", 1)
        await storage.save("doc_b", "content", 1)
        await storage.save("doc_c", "content", 1)

        docs = await storage.list_documents()

        assert len(docs) == 3
        assert "doc_a" in docs

    @pytest.mark.asyncio
    async def test_list_documents_with_prefix(self, storage):
        """List documents with prefix filter."""
        await storage.save("project_1_doc", "content", 1)
        await storage.save("project_1_other", "content", 1)
        await storage.save("project_2_doc", "content", 1)

        docs = await storage.list_documents(prefix="project_1")

        assert len(docs) == 2

    @pytest.mark.asyncio
    async def test_list_documents_with_limit(self, storage):
        """List documents with limit."""
        for i in range(10):
            await storage.save(f"doc_{i}", "content", 1)

        docs = await storage.list_documents(limit=5)

        assert len(docs) == 5

    @pytest.mark.asyncio
    async def test_get_metadata(self, storage):
        """Get document metadata without content."""
        await storage.save("doc_1", "content", 1)

        meta = await storage.get_metadata("doc_1")

        assert meta.document_id == "doc_1"

    @pytest.mark.asyncio
    async def test_compression(self):
        """Large content is compressed."""
        config = StorageConfig(
            compression_enabled=True,
            compression_threshold=100,
        )
        storage = InMemoryStorage(config)

        large_content = "x" * 1000

        meta = await storage.save("doc_1", large_content, 1)

        assert meta.compressed is True
        assert meta.size < 1000  # Compressed size

        doc = await storage.load("doc_1")
        assert doc.content == large_content

    @pytest.mark.asyncio
    async def test_checksum_verification(self):
        """Checksums are verified on load."""
        storage = InMemoryStorage()

        await storage.save("doc_1", "content", 1)

        # Corrupt the stored data
        for key in storage._documents:
            storage._documents[key] = b"corrupted"
            break

        with pytest.raises(StorageCorruptionError):
            await storage.load("doc_1")

    @pytest.mark.asyncio
    async def test_size_limit(self):
        """Document size limit is enforced."""
        config = StorageConfig(max_document_size=100)
        storage = InMemoryStorage(config)

        with pytest.raises(StorageError):
            await storage.save("doc_1", "x" * 1000, 1)

    @pytest.mark.asyncio
    async def test_total_size_limit(self):
        """Total storage size limit is enforced."""
        config = StorageConfig(
            max_total_size=500,
            compression_enabled=False,
        )
        storage = InMemoryStorage(config)

        await storage.save("doc_1", "x" * 200, 1)
        await storage.save("doc_2", "x" * 200, 1)

        with pytest.raises(StorageFullError):
            await storage.save("doc_3", "x" * 200, 1)

    @pytest.mark.asyncio
    async def test_update_preserves_created_at(self, storage):
        """Updating document preserves created_at."""
        meta1 = await storage.save("doc_1", "content v1", 1)
        created = meta1.created_at

        await asyncio.sleep(0.01)

        meta2 = await storage.save("doc_1", "content v2", 2)

        assert meta2.created_at == created
        assert meta2.updated_at > created

    @pytest.mark.asyncio
    async def test_get_stats(self, storage):
        """Get storage statistics."""
        await storage.save("doc_1", "content", 1)
        await storage.save("doc_2", "content", 1)

        stats = await storage.get_stats()

        assert stats["type"] == "memory"
        assert stats["document_count"] == 2
        assert stats["total_size"] > 0

    @pytest.mark.asyncio
    async def test_clear(self, storage):
        """Clear all documents."""
        await storage.save("doc_1", "content", 1)
        await storage.save("doc_2", "content", 1)

        count = await storage.clear()

        assert count == 2
        assert await storage.exists("doc_1") is False

    @pytest.mark.asyncio
    async def test_custom_metadata(self, storage):
        """Save document with custom metadata."""
        meta = await storage.save(
            "doc_1", "content", 1,
            metadata={"author": "alice", "tags": ["test"]}
        )

        assert meta.custom["author"] == "alice"


class TestFileStorage:
    """Tests for FileStorage."""

    @pytest.fixture
    def temp_dir(self):
        path = tempfile.mkdtemp()
        yield path
        shutil.rmtree(path)

    @pytest.fixture
    def storage(self, temp_dir):
        return FileStorage(temp_dir)

    @pytest.mark.asyncio
    async def test_save_and_load(self, storage):
        """Save and load document."""
        meta = await storage.save("doc_1", "Hello, World!", 1)

        assert meta.document_id == "doc_1"

        doc = await storage.load("doc_1")

        assert doc.content == "Hello, World!"

    @pytest.mark.asyncio
    async def test_persistence(self, temp_dir):
        """Data persists across instances."""
        storage1 = FileStorage(temp_dir)
        await storage1.save("doc_1", "persistent content", 1)

        # Create new instance
        storage2 = FileStorage(temp_dir)
        doc = await storage2.load("doc_1")

        assert doc.content == "persistent content"

    @pytest.mark.asyncio
    async def test_delete(self, storage):
        """Delete document removes files."""
        await storage.save("doc_1", "content", 1)

        result = await storage.delete("doc_1")
        assert result is True

        with pytest.raises(DocumentNotFoundError):
            await storage.load("doc_1")

    @pytest.mark.asyncio
    async def test_list_documents(self, storage):
        """List stored documents."""
        await storage.save("doc_a", "content", 1)
        await storage.save("doc_b", "content", 1)

        docs = await storage.list_documents()

        assert len(docs) == 2

    @pytest.mark.asyncio
    async def test_compression(self, temp_dir):
        """Large content is compressed."""
        config = StorageConfig(
            compression_enabled=True,
            compression_threshold=100,
        )
        storage = FileStorage(temp_dir, config)

        large_content = "x" * 1000
        meta = await storage.save("doc_1", large_content, 1)

        assert meta.compressed is True

        doc = await storage.load("doc_1")
        assert doc.content == large_content

    @pytest.mark.asyncio
    async def test_get_stats(self, storage):
        """Get storage statistics."""
        await storage.save("doc_1", "content", 1)

        stats = await storage.get_stats()

        assert stats["type"] == "file"
        assert stats["document_count"] == 1


class TestStorageManager:
    """Tests for StorageManager."""

    @pytest.fixture
    def primary(self):
        return InMemoryStorage()

    @pytest.fixture
    def secondary(self):
        return InMemoryStorage()

    @pytest.fixture
    def manager(self, primary, secondary):
        return StorageManager(primary, secondary)

    @pytest.mark.asyncio
    async def test_save_to_both(self, manager, primary, secondary):
        """Save writes to both backends."""
        await manager.save("doc_1", "content", 1)

        assert await primary.exists("doc_1")
        assert await secondary.exists("doc_1")

    @pytest.mark.asyncio
    async def test_load_from_primary(self, manager, primary):
        """Load reads from primary."""
        await manager.save("doc_1", "content", 1)

        doc = await manager.load("doc_1")

        assert doc.content == "content"

    @pytest.mark.asyncio
    async def test_fallback_to_secondary(self, manager, primary, secondary):
        """Fallback to secondary when primary fails."""
        # Save to secondary only
        await secondary.save("doc_1", "from secondary", 1)

        doc = await manager.load("doc_1")

        assert doc.content == "from secondary"
        # Should be restored to primary
        assert await primary.exists("doc_1")

    @pytest.mark.asyncio
    async def test_delete_from_both(self, manager, primary, secondary):
        """Delete removes from both backends."""
        await manager.save("doc_1", "content", 1)

        await manager.delete("doc_1")

        assert not await primary.exists("doc_1")
        assert not await secondary.exists("doc_1")

    @pytest.mark.asyncio
    async def test_exists_checks_both(self, manager, secondary):
        """Exists checks both backends."""
        # Only in secondary
        await secondary.save("doc_1", "content", 1)

        assert await manager.exists("doc_1")

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get manager statistics."""
        await manager.save("doc_1", "content", 1)
        await manager.load("doc_1")

        stats = manager.get_stats()

        assert stats["reads"] == 1
        assert stats["writes"] == 1

    @pytest.mark.asyncio
    async def test_get_full_stats(self, manager):
        """Get full statistics including backends."""
        await manager.save("doc_1", "content", 1)

        stats = await manager.get_full_stats()

        assert "primary" in stats
        assert "secondary" in stats

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Start and stop manager."""
        await manager.start()
        assert manager._running is True

        await manager.stop()
        assert manager._running is False

    @pytest.mark.asyncio
    async def test_primary_only(self, primary):
        """Manager works with primary only."""
        manager = StorageManager(primary)

        await manager.save("doc_1", "content", 1)
        doc = await manager.load("doc_1")

        assert doc.content == "content"


class TestGlobalStorage:
    """Tests for global storage functions."""

    def test_get_storage_none(self):
        """Get storage returns None initially."""
        reset_storage()
        assert get_storage() is None

    def test_set_and_get_storage(self):
        """Set and get global storage."""
        reset_storage()

        storage = InMemoryStorage()
        manager = StorageManager(storage)

        set_storage(manager)

        assert get_storage() is manager

    def test_reset_storage(self):
        """Reset global storage."""
        storage = InMemoryStorage()
        manager = StorageManager(storage)
        set_storage(manager)

        reset_storage()

        assert get_storage() is None
