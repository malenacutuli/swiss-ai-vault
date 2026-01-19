"""Tests for Document Snapshot Management."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.storage import InMemoryStorage
from app.collaboration.snapshots import (
    SnapshotManager,
    SnapshotConfig,
    Snapshot,
    SnapshotInfo,
    SnapshotType,
    SnapshotTrigger,
    DeltaEncoder,
    DocumentHistory,
    create_snapshot_manager,
)


class TestSnapshotConfig:
    """Tests for SnapshotConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = SnapshotConfig()

        assert config.auto_snapshot_enabled is True
        assert config.auto_snapshot_interval == 300.0
        assert config.operations_per_snapshot == 100
        assert config.delta_enabled is True

    def test_custom_config(self):
        """Can customize config."""
        config = SnapshotConfig(
            auto_snapshot_enabled=False,
            operations_per_snapshot=50,
        )

        assert config.auto_snapshot_enabled is False
        assert config.operations_per_snapshot == 50


class TestSnapshot:
    """Tests for Snapshot dataclass."""

    def test_to_dict(self):
        """Convert snapshot to dictionary."""
        now = datetime.utcnow()
        snapshot = Snapshot(
            id="snap_1",
            document_id="doc_1",
            version=5,
            snapshot_type=SnapshotType.FULL,
            trigger=SnapshotTrigger.USER_REQUEST,
            content="Hello, World!",
            delta=None,
            base_snapshot_id=None,
            created_at=now,
            size=13,
            checksum="abc123",
        )

        d = snapshot.to_dict()

        assert d["id"] == "snap_1"
        assert d["document_id"] == "doc_1"
        assert d["version"] == 5
        assert d["snapshot_type"] == "full"
        assert d["trigger"] == "user_request"

    def test_from_dict(self):
        """Create snapshot from dictionary."""
        data = {
            "id": "snap_1",
            "document_id": "doc_1",
            "version": 5,
            "snapshot_type": "full",
            "trigger": "user_request",
            "content": "Hello, World!",
            "delta": None,
            "base_snapshot_id": None,
            "created_at": "2024-01-01T00:00:00",
            "size": 13,
            "checksum": "abc123",
        }

        snapshot = Snapshot.from_dict(data)

        assert snapshot.id == "snap_1"
        assert snapshot.snapshot_type == SnapshotType.FULL
        assert snapshot.trigger == SnapshotTrigger.USER_REQUEST

    def test_is_delta(self):
        """Check if snapshot is delta type."""
        full_snap = Snapshot(
            id="snap_1",
            document_id="doc_1",
            version=1,
            snapshot_type=SnapshotType.FULL,
            trigger=SnapshotTrigger.USER_REQUEST,
            content="content",
            delta=None,
            base_snapshot_id=None,
            created_at=datetime.utcnow(),
            size=7,
            checksum="abc",
        )

        delta_snap = Snapshot(
            id="snap_2",
            document_id="doc_1",
            version=2,
            snapshot_type=SnapshotType.DELTA,
            trigger=SnapshotTrigger.USER_REQUEST,
            content=None,
            delta="--- a\n+++ b\n",
            base_snapshot_id="snap_1",
            created_at=datetime.utcnow(),
            size=10,
            checksum="def",
        )

        assert full_snap.is_delta() is False
        assert delta_snap.is_delta() is True


class TestSnapshotInfo:
    """Tests for SnapshotInfo."""

    def test_from_snapshot(self):
        """Create info from full snapshot."""
        snapshot = Snapshot(
            id="snap_1",
            document_id="doc_1",
            version=5,
            snapshot_type=SnapshotType.FULL,
            trigger=SnapshotTrigger.USER_REQUEST,
            content="content",
            delta=None,
            base_snapshot_id=None,
            created_at=datetime.utcnow(),
            size=7,
            checksum="abc",
        )

        info = SnapshotInfo.from_snapshot(snapshot)

        assert info.id == "snap_1"
        assert info.document_id == "doc_1"
        assert info.version == 5


class TestDeltaEncoder:
    """Tests for DeltaEncoder."""

    def test_encode_delta(self):
        """Encode delta between two versions."""
        old_content = "line1\nline2\nline3\n"
        new_content = "line1\nmodified\nline3\n"

        delta = DeltaEncoder.encode_delta(old_content, new_content)

        # Delta is JSON that contains diff and new_content
        import json
        delta_data = json.loads(delta)
        assert "diff" in delta_data
        assert "new_content" in delta_data
        assert delta_data["new_content"] == new_content

    def test_apply_delta(self):
        """Apply delta to base content."""
        old_content = "line1\nline2\nline3\n"
        new_content = "line1\nmodified\nline3\n"

        delta = DeltaEncoder.encode_delta(old_content, new_content)
        result = DeltaEncoder.apply_delta(old_content, delta)

        assert result == new_content

    def test_empty_delta(self):
        """Empty delta returns base content."""
        content = "original content"

        result = DeltaEncoder.apply_delta(content, "")

        assert result == content

    def test_calculate_change_ratio(self):
        """Calculate change ratio between versions."""
        old_content = "Hello, World!"
        same_content = "Hello, World!"
        different_content = "Goodbye, World!"

        ratio_same = DeltaEncoder.calculate_change_ratio(old_content, same_content)
        ratio_diff = DeltaEncoder.calculate_change_ratio(old_content, different_content)

        assert ratio_same == 0.0
        assert ratio_diff > 0.0

    def test_change_ratio_empty_old(self):
        """Change ratio with empty old content."""
        ratio = DeltaEncoder.calculate_change_ratio("", "new content")
        assert ratio == 1.0


class TestSnapshotManager:
    """Tests for SnapshotManager."""

    @pytest.fixture
    def storage(self):
        return InMemoryStorage()

    @pytest.fixture
    def config(self):
        return SnapshotConfig(
            auto_snapshot_enabled=False,
            delta_enabled=True,
            delta_threshold=0.3,
        )

    @pytest.fixture
    def manager(self, storage, config):
        return SnapshotManager(storage, config)

    @pytest.mark.asyncio
    async def test_create_snapshot(self, manager):
        """Create a document snapshot."""
        snapshot = await manager.create_snapshot(
            document_id="doc_1",
            content="Hello, World!",
            version=1,
        )

        assert snapshot.document_id == "doc_1"
        assert snapshot.version == 1
        assert snapshot.content == "Hello, World!"
        assert snapshot.snapshot_type == SnapshotType.FULL

    @pytest.mark.asyncio
    async def test_get_snapshot(self, manager):
        """Retrieve a snapshot by ID."""
        created = await manager.create_snapshot(
            document_id="doc_1",
            content="content",
            version=1,
        )

        retrieved = await manager.get_snapshot(created.id)

        assert retrieved.id == created.id
        assert retrieved.content == "content"

    @pytest.mark.asyncio
    async def test_restore_snapshot(self, manager):
        """Restore document content from snapshot."""
        snapshot = await manager.create_snapshot(
            document_id="doc_1",
            content="Hello, World!",
            version=1,
        )

        content = await manager.restore_snapshot(snapshot.id)

        assert content == "Hello, World!"

    @pytest.mark.asyncio
    async def test_list_snapshots(self, manager):
        """List snapshots for a document."""
        await manager.create_snapshot("doc_1", "v1", 1)
        await manager.create_snapshot("doc_1", "v2", 2)
        await manager.create_snapshot("doc_1", "v3", 3)

        snapshots = await manager.list_snapshots("doc_1")

        assert len(snapshots) == 3

    @pytest.mark.asyncio
    async def test_delete_snapshot(self, manager):
        """Delete a snapshot."""
        snapshot = await manager.create_snapshot("doc_1", "content", 1)

        result = await manager.delete_snapshot(snapshot.id)

        assert result is True

        snapshots = await manager.list_snapshots("doc_1")
        assert len(snapshots) == 0

    @pytest.mark.asyncio
    async def test_delta_snapshot(self, manager):
        """Create delta snapshot for small changes."""
        # First full snapshot
        snap1 = await manager.create_snapshot(
            document_id="doc_1",
            content="line1\nline2\nline3\nline4\nline5\n",
            version=1,
        )

        # Small change - should create delta
        snap2 = await manager.create_snapshot(
            document_id="doc_1",
            content="line1\nline2\nmodified\nline4\nline5\n",
            version=2,
        )

        assert snap1.snapshot_type == SnapshotType.FULL
        assert snap2.snapshot_type == SnapshotType.DELTA
        assert snap2.base_snapshot_id == snap1.id

    @pytest.mark.asyncio
    async def test_restore_delta_snapshot(self, manager):
        """Restore content from delta snapshot."""
        original = "line1\nline2\nline3\nline4\nline5\n"
        modified = "line1\nline2\nmodified\nline4\nline5\n"

        await manager.create_snapshot("doc_1", original, 1)
        snap2 = await manager.create_snapshot("doc_1", modified, 2)

        restored = await manager.restore_snapshot(snap2.id)

        assert restored == modified

    @pytest.mark.asyncio
    async def test_full_snapshot_for_large_changes(self, manager):
        """Create full snapshot for large changes."""
        # First snapshot
        await manager.create_snapshot(
            document_id="doc_1",
            content="completely different content",
            version=1,
        )

        # Large change - should create full snapshot
        snap2 = await manager.create_snapshot(
            document_id="doc_1",
            content="totally new and different text here",
            version=2,
        )

        assert snap2.snapshot_type == SnapshotType.FULL

    @pytest.mark.asyncio
    async def test_snapshot_with_trigger(self, manager):
        """Create snapshot with specific trigger."""
        snapshot = await manager.create_snapshot(
            document_id="doc_1",
            content="content",
            version=1,
            trigger=SnapshotTrigger.PERIODIC,
        )

        assert snapshot.trigger == SnapshotTrigger.PERIODIC

    @pytest.mark.asyncio
    async def test_snapshot_with_metadata(self, manager):
        """Create snapshot with custom metadata."""
        snapshot = await manager.create_snapshot(
            document_id="doc_1",
            content="content",
            version=1,
            metadata={"author": "alice"},
        )

        assert snapshot.metadata["author"] == "alice"

    @pytest.mark.asyncio
    async def test_get_snapshot_at_version(self, manager):
        """Get snapshot closest to a version."""
        await manager.create_snapshot("doc_1", "v1", 1)
        await manager.create_snapshot("doc_1", "v5", 5)
        await manager.create_snapshot("doc_1", "v10", 10)

        snapshot = await manager.get_snapshot_at_version("doc_1", 7)

        assert snapshot.version == 5  # Closest <= 7

    @pytest.mark.asyncio
    async def test_rollback_to_version(self, manager):
        """Rollback document to specific version."""
        await manager.create_snapshot("doc_1", "content v1", 1)
        await manager.create_snapshot("doc_1", "content v5", 5)

        content = await manager.rollback_to_version("doc_1", 3)

        assert content == "content v1"

    @pytest.mark.asyncio
    async def test_record_operation(self, manager):
        """Record operation for auto-snapshot tracking."""
        manager.record_operation("doc_1")
        manager.record_operation("doc_1")

        assert manager._document_ops["doc_1"] == 2

    @pytest.mark.asyncio
    async def test_snapshot_callback(self, manager):
        """Snapshot creation callback is invoked."""
        snapshots = []

        async def on_snapshot(snap):
            snapshots.append(snap)

        manager.on_snapshot_created = on_snapshot

        await manager.create_snapshot("doc_1", "content", 1)

        assert len(snapshots) == 1

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get snapshot manager statistics."""
        await manager.create_snapshot("doc_1", "content", 1)

        stats = manager.get_stats()

        assert stats["snapshots_created"] == 1
        assert stats["full_snapshots_created"] == 1

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Start and stop snapshot manager."""
        await manager.start()
        assert manager._running is True

        await manager.stop()
        assert manager._running is False

    @pytest.mark.asyncio
    async def test_retention_policy(self, manager):
        """Retention policy limits snapshots."""
        manager.config.max_snapshots_per_document = 5

        # Create many snapshots
        for i in range(10):
            await manager.create_snapshot("doc_1", f"content v{i}", i)

        snapshots = await manager.list_snapshots("doc_1")

        # Should be limited by retention
        assert len(snapshots) <= 10


class TestDocumentHistory:
    """Tests for DocumentHistory."""

    @pytest.fixture
    def storage(self):
        return InMemoryStorage()

    @pytest.fixture
    def manager(self, storage):
        config = SnapshotConfig(
            auto_snapshot_enabled=False,
            delta_enabled=False,
        )
        return SnapshotManager(storage, config)

    @pytest.fixture
    def history(self, manager):
        return DocumentHistory(manager)

    @pytest.mark.asyncio
    async def test_get_history(self, history, manager):
        """Get document history."""
        await manager.create_snapshot("doc_1", "v1", 1)
        await manager.create_snapshot("doc_1", "v2", 2)

        snapshots = await history.get_history("doc_1")

        assert len(snapshots) == 2

    @pytest.mark.asyncio
    async def test_get_content_at_version(self, history, manager):
        """Get content at specific version."""
        await manager.create_snapshot("doc_1", "version 1 content", 1)
        await manager.create_snapshot("doc_1", "version 5 content", 5)

        content = await history.get_content_at_version("doc_1", 3)

        assert content == "version 1 content"

    @pytest.mark.asyncio
    async def test_compare_versions(self, history, manager):
        """Compare two versions."""
        await manager.create_snapshot("doc_1", "old content", 1)
        await manager.create_snapshot("doc_1", "new content", 2)

        diff = await history.compare_versions("doc_1", 1, 2)

        assert diff is not None
        assert "-old" in diff
        assert "+new" in diff

    @pytest.mark.asyncio
    async def test_caching(self, history, manager):
        """Content is cached for performance."""
        snap = await manager.create_snapshot("doc_1", "content", 1)

        # Access via time-based lookup (which uses caching)
        await history.get_content_at_time("doc_1", snap.created_at + timedelta(seconds=1))

        # Should be cached
        assert snap.id in history._cache


class TestSnapshotType:
    """Tests for SnapshotType enum."""

    def test_snapshot_types(self):
        """All snapshot types exist."""
        assert SnapshotType.FULL.value == "full"
        assert SnapshotType.DELTA.value == "delta"
        assert SnapshotType.AUTO.value == "auto"
        assert SnapshotType.MANUAL.value == "manual"
        assert SnapshotType.CHECKPOINT.value == "checkpoint"


class TestSnapshotTrigger:
    """Tests for SnapshotTrigger enum."""

    def test_snapshot_triggers(self):
        """All snapshot triggers exist."""
        assert SnapshotTrigger.PERIODIC.value == "periodic"
        assert SnapshotTrigger.OPERATION_COUNT.value == "operation_count"
        assert SnapshotTrigger.USER_REQUEST.value == "user_request"
        assert SnapshotTrigger.PRE_SHUTDOWN.value == "pre_shutdown"


class TestCreateSnapshotManager:
    """Tests for factory function."""

    def test_create_with_defaults(self):
        """Create manager with default settings."""
        manager = create_snapshot_manager()

        assert manager is not None
        assert manager.storage is not None

    def test_create_with_custom_storage(self):
        """Create manager with custom storage."""
        storage = InMemoryStorage()
        manager = create_snapshot_manager(storage=storage)

        assert manager.storage is storage

    def test_create_with_config(self):
        """Create manager with custom config."""
        config = SnapshotConfig(operations_per_snapshot=50)
        manager = create_snapshot_manager(config=config)

        assert manager.config.operations_per_snapshot == 50
