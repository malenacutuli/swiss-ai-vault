"""Tests for Conflict Detection and Resolution."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.conflict import (
    ConflictManager,
    ConflictConfig,
    Conflict,
    ConflictType,
    ConflictSeverity,
    ConflictState,
    ConflictingOperation,
    ResolutionStrategy,
    ResolutionResult,
    ConflictDetector,
    LastWriterWinsHandler,
    FirstWriterWinsHandler,
    MergeHandler,
    RejectHandler,
    get_conflict_manager,
    set_conflict_manager,
    reset_conflict_manager,
)


class TestConflictType:
    """Tests for ConflictType enum."""

    def test_type_values(self):
        """Type values are correct."""
        assert ConflictType.CONCURRENT_EDIT.value == "concurrent_edit"
        assert ConflictType.VERSION_MISMATCH.value == "version_mismatch"
        assert ConflictType.DELETE_UPDATE.value == "delete_update"


class TestConflictSeverity:
    """Tests for ConflictSeverity enum."""

    def test_severity_values(self):
        """Severity values are correct."""
        assert ConflictSeverity.LOW.value == "low"
        assert ConflictSeverity.MEDIUM.value == "medium"
        assert ConflictSeverity.HIGH.value == "high"
        assert ConflictSeverity.CRITICAL.value == "critical"


class TestResolutionStrategy:
    """Tests for ResolutionStrategy enum."""

    def test_strategy_values(self):
        """Strategy values are correct."""
        assert ResolutionStrategy.LAST_WRITER_WINS.value == "last_writer_wins"
        assert ResolutionStrategy.FIRST_WRITER_WINS.value == "first_writer_wins"
        assert ResolutionStrategy.MERGE.value == "merge"
        assert ResolutionStrategy.MANUAL.value == "manual"


class TestConflictConfig:
    """Tests for ConflictConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = ConflictConfig()

        assert config.default_strategy == ResolutionStrategy.LAST_WRITER_WINS
        assert config.max_conflicts_per_document == 100
        assert config.enable_notifications is True

    def test_custom_config(self):
        """Custom configuration."""
        config = ConflictConfig(
            default_strategy=ResolutionStrategy.MERGE,
            max_conflicts_per_document=50,
        )

        assert config.default_strategy == ResolutionStrategy.MERGE
        assert config.max_conflicts_per_document == 50


class TestConflictingOperation:
    """Tests for ConflictingOperation."""

    @pytest.fixture
    def operation(self):
        """Create a test operation."""
        return ConflictingOperation(
            id="op_123",
            user_id="user1",
            client_id="client1",
            operation={"type": "insert", "pos": 0, "text": "hello"},
            version=5,
            timestamp=datetime.utcnow(),
        )

    def test_create_operation(self, operation):
        """Create an operation."""
        assert operation.id == "op_123"
        assert operation.user_id == "user1"
        assert operation.version == 5

    def test_to_dict(self, operation):
        """Convert to dictionary."""
        d = operation.to_dict()

        assert d["id"] == "op_123"
        assert d["user_id"] == "user1"
        assert d["operation"]["type"] == "insert"

    def test_from_dict(self):
        """Create from dictionary."""
        now = datetime.utcnow()
        d = {
            "id": "op_abc",
            "user_id": "user2",
            "client_id": "client2",
            "operation": {"type": "delete", "pos": 5, "count": 3},
            "version": 10,
            "timestamp": now.isoformat(),
        }

        op = ConflictingOperation.from_dict(d)

        assert op.id == "op_abc"
        assert op.version == 10


class TestConflict:
    """Tests for Conflict."""

    @pytest.fixture
    def conflict(self):
        """Create a test conflict."""
        now = datetime.utcnow()
        return Conflict(
            id="conflict_abc123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={"type": "insert"},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={"type": "insert"},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )

    def test_create_conflict(self, conflict):
        """Create a conflict."""
        assert conflict.id == "conflict_abc123"
        assert conflict.document_id == "doc1"
        assert len(conflict.operations) == 2

    def test_to_dict(self, conflict):
        """Convert to dictionary."""
        d = conflict.to_dict()

        assert d["id"] == "conflict_abc123"
        assert d["conflict_type"] == "concurrent_edit"
        assert len(d["operations"]) == 2

    def test_from_dict(self, conflict):
        """Create from dictionary."""
        d = conflict.to_dict()
        recreated = Conflict.from_dict(d)

        assert recreated.id == conflict.id
        assert recreated.conflict_type == conflict.conflict_type


class TestResolutionResult:
    """Tests for ResolutionResult."""

    def test_create_result(self):
        """Create a resolution result."""
        result = ResolutionResult(
            success=True,
            conflict_id="conflict_123",
            strategy_used=ResolutionStrategy.LAST_WRITER_WINS,
            message="Resolved successfully",
        )

        assert result.success is True
        assert result.conflict_id == "conflict_123"

    def test_to_dict(self):
        """Convert to dictionary."""
        result = ResolutionResult(
            success=False,
            conflict_id="conflict_456",
            strategy_used=ResolutionStrategy.MERGE,
            message="Merge failed",
        )

        d = result.to_dict()

        assert d["success"] is False
        assert d["strategy_used"] == "merge"


class TestConflictDetector:
    """Tests for ConflictDetector."""

    @pytest.fixture
    def detector(self):
        """Create a conflict detector."""
        return ConflictDetector()

    def test_detect_concurrent_edit(self, detector):
        """Detect concurrent edit conflict."""
        now = datetime.utcnow()
        op1 = ConflictingOperation(
            id="op1",
            user_id="user1",
            client_id="client1",
            operation={"type": "insert", "position": 0, "text": "hello"},
            version=5,
            timestamp=now,
        )
        op2 = ConflictingOperation(
            id="op2",
            user_id="user2",
            client_id="client2",
            operation={"type": "insert", "position": 0, "text": "world"},
            version=5,
            timestamp=now + timedelta(milliseconds=100),
        )

        conflict = detector.detect_concurrent_edit(op1, op2)

        assert conflict is not None
        assert conflict.conflict_type == ConflictType.CONCURRENT_EDIT

    def test_no_concurrent_edit_different_versions(self, detector):
        """No conflict for different versions."""
        now = datetime.utcnow()
        op1 = ConflictingOperation(
            id="op1",
            user_id="user1",
            client_id="client1",
            operation={"type": "insert", "position": 0},
            version=5,
            timestamp=now,
        )
        op2 = ConflictingOperation(
            id="op2",
            user_id="user2",
            client_id="client2",
            operation={"type": "insert", "position": 0},
            version=6,
            timestamp=now,
        )

        conflict = detector.detect_concurrent_edit(op1, op2)

        assert conflict is None

    def test_detect_version_mismatch(self, detector):
        """Detect version mismatch conflict."""
        op = ConflictingOperation(
            id="op1",
            user_id="user1",
            client_id="client1",
            operation={"type": "insert"},
            version=5,
            timestamp=datetime.utcnow(),
        )

        conflict = detector.detect_version_mismatch(op, expected_version=6, current_version=7)

        assert conflict is not None
        assert conflict.conflict_type == ConflictType.VERSION_MISMATCH

    def test_no_version_mismatch(self, detector):
        """No conflict when versions match."""
        op = ConflictingOperation(
            id="op1",
            user_id="user1",
            client_id="client1",
            operation={"type": "insert"},
            version=5,
            timestamp=datetime.utcnow(),
        )

        conflict = detector.detect_version_mismatch(op, expected_version=5, current_version=5)

        assert conflict is None

    def test_detect_delete_update(self, detector):
        """Detect delete-update conflict."""
        now = datetime.utcnow()
        delete_op = ConflictingOperation(
            id="op1",
            user_id="user1",
            client_id="client1",
            operation={"type": "delete", "position": 5, "count": 10},
            version=5,
            timestamp=now,
        )
        update_op = ConflictingOperation(
            id="op2",
            user_id="user2",
            client_id="client2",
            operation={"type": "insert", "position": 8, "text": "test"},
            version=5,
            timestamp=now,
        )

        conflict = detector.detect_delete_update(delete_op, update_op)

        assert conflict is not None
        assert conflict.conflict_type == ConflictType.DELETE_UPDATE


class TestLastWriterWinsHandler:
    """Tests for LastWriterWinsHandler."""

    @pytest.fixture
    def handler(self):
        """Create a handler."""
        return LastWriterWinsHandler()

    @pytest.mark.asyncio
    async def test_resolve_picks_latest(self, handler):
        """Resolve picks the latest operation."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={},
                    version=5,
                    timestamp=now + timedelta(seconds=1),
                ),
            ],
            detected_at=now,
        )

        result = await handler.resolve(conflict)

        assert result.success is True
        assert result.winning_operation.id == "op2"

    @pytest.mark.asyncio
    async def test_resolve_empty_operations(self, handler):
        """Resolve fails with no operations."""
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[],
            detected_at=datetime.utcnow(),
        )

        result = await handler.resolve(conflict)

        assert result.success is False


class TestFirstWriterWinsHandler:
    """Tests for FirstWriterWinsHandler."""

    @pytest.fixture
    def handler(self):
        """Create a handler."""
        return FirstWriterWinsHandler()

    @pytest.mark.asyncio
    async def test_resolve_picks_earliest(self, handler):
        """Resolve picks the earliest operation."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={},
                    version=5,
                    timestamp=now + timedelta(seconds=1),
                ),
            ],
            detected_at=now,
        )

        result = await handler.resolve(conflict)

        assert result.success is True
        assert result.winning_operation.id == "op1"


class TestMergeHandler:
    """Tests for MergeHandler."""

    @pytest.fixture
    def handler(self):
        """Create a handler."""
        return MergeHandler()

    @pytest.mark.asyncio
    async def test_resolve_merges_operations(self, handler):
        """Resolve merges operations."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={"type": "insert", "pos": 0},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={"type": "insert", "pos": 10},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )

        result = await handler.resolve(conflict)

        assert result.success is True
        assert result.merged_operation is not None
        assert result.merged_operation["merged"] is True

    @pytest.mark.asyncio
    async def test_custom_merge_function(self):
        """Use custom merge function."""
        def custom_merge(ops):
            return {"custom": True, "count": len(ops)}

        handler = MergeHandler(merge_fn=custom_merge)
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )

        result = await handler.resolve(conflict)

        assert result.success is True
        assert result.merged_operation["custom"] is True


class TestRejectHandler:
    """Tests for RejectHandler."""

    @pytest.fixture
    def handler(self):
        """Create a handler."""
        return RejectHandler()

    @pytest.mark.asyncio
    async def test_resolve_rejects_all(self, handler):
        """Resolve rejects all operations."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )

        result = await handler.resolve(conflict)

        assert result.success is True
        assert result.metadata["rejected_count"] == 2


class TestConflictManager:
    """Tests for ConflictManager."""

    @pytest.fixture
    def manager(self):
        """Create a conflict manager."""
        return ConflictManager()

    @pytest.mark.asyncio
    async def test_record_conflict(self, manager):
        """Record a conflict."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[],
            detected_at=now,
        )

        await manager.record_conflict(conflict)

        assert manager.get_conflict("conflict_123") is not None

    @pytest.mark.asyncio
    async def test_get_document_conflicts(self, manager):
        """Get conflicts for a document."""
        now = datetime.utcnow()
        for i in range(3):
            conflict = Conflict(
                id=f"conflict_{i}",
                document_id="doc1",
                conflict_type=ConflictType.CONCURRENT_EDIT,
                severity=ConflictSeverity.MEDIUM,
                state=ConflictState.DETECTED,
                operations=[],
                detected_at=now,
            )
            await manager.record_conflict(conflict)

        conflicts = manager.get_document_conflicts("doc1")

        assert len(conflicts) == 3

    @pytest.mark.asyncio
    async def test_get_unresolved_conflicts(self, manager):
        """Get unresolved conflicts."""
        now = datetime.utcnow()
        conflict1 = Conflict(
            id="conflict_1",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[],
            detected_at=now,
        )
        conflict2 = Conflict(
            id="conflict_2",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.RESOLVED,
            operations=[],
            detected_at=now,
        )
        await manager.record_conflict(conflict1)
        await manager.record_conflict(conflict2)

        unresolved = manager.get_unresolved_conflicts("doc1")

        assert len(unresolved) == 1
        assert unresolved[0].id == "conflict_1"

    @pytest.mark.asyncio
    async def test_resolve_conflict(self, manager):
        """Resolve a conflict."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.resolve("conflict_123")

        assert result.success is True
        assert conflict.state == ConflictState.RESOLVED

    @pytest.mark.asyncio
    async def test_resolve_nonexistent(self, manager):
        """Resolve nonexistent conflict fails."""
        result = await manager.resolve("nonexistent")

        assert result.success is False

    @pytest.mark.asyncio
    async def test_resolve_already_resolved(self, manager):
        """Resolve already resolved conflict fails."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.RESOLVED,
            operations=[],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.resolve("conflict_123")

        assert result.success is False

    @pytest.mark.asyncio
    async def test_auto_resolve(self, manager):
        """Auto-resolve uses default strategy."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.auto_resolve("conflict_123")

        assert result.success is True
        assert result.strategy_used == ResolutionStrategy.LAST_WRITER_WINS

    @pytest.mark.asyncio
    async def test_manual_resolve(self, manager):
        """Manual resolve selects winner."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
                ConflictingOperation(
                    id="op2",
                    user_id="user2",
                    client_id="client2",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.manual_resolve(
            "conflict_123",
            winner_operation_id="op2",
            resolver_id="admin1",
        )

        assert result.success is True
        assert result.winning_operation.id == "op2"

    @pytest.mark.asyncio
    async def test_manual_resolve_invalid_winner(self, manager):
        """Manual resolve with invalid winner fails."""
        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.manual_resolve(
            "conflict_123",
            winner_operation_id="invalid_op",
            resolver_id="admin1",
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_register_custom_handler(self, manager):
        """Register a custom resolution handler."""
        class CustomHandler:
            async def resolve(self, conflict, context=None):
                return ResolutionResult(
                    success=True,
                    conflict_id=conflict.id,
                    strategy_used=ResolutionStrategy.CUSTOM,
                    message="Custom resolution",
                )

        manager.register_handler(ResolutionStrategy.CUSTOM, CustomHandler())

        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[],
            detected_at=now,
        )
        await manager.record_conflict(conflict)

        result = await manager.resolve("conflict_123", strategy=ResolutionStrategy.CUSTOM)

        assert result.success is True
        assert result.strategy_used == ResolutionStrategy.CUSTOM

    @pytest.mark.asyncio
    async def test_max_conflicts_per_document(self, manager):
        """Oldest conflict removed when max reached."""
        config = ConflictConfig(max_conflicts_per_document=2)
        manager = ConflictManager(config)

        now = datetime.utcnow()
        for i in range(3):
            conflict = Conflict(
                id=f"conflict_{i}",
                document_id="doc1",
                conflict_type=ConflictType.CONCURRENT_EDIT,
                severity=ConflictSeverity.MEDIUM,
                state=ConflictState.DETECTED,
                operations=[],
                detected_at=now,
            )
            await manager.record_conflict(conflict)

        conflicts = manager.get_document_conflicts("doc1")

        assert len(conflicts) == 2
        assert manager.get_conflict("conflict_0") is None

    @pytest.mark.asyncio
    async def test_callbacks(self, manager):
        """Callbacks are invoked."""
        detected_conflicts = []
        resolved_results = []

        async def on_detected(conflict):
            detected_conflicts.append(conflict)

        async def on_resolved(conflict, result):
            resolved_results.append((conflict, result))

        manager.on_conflict_detected = on_detected
        manager.on_conflict_resolved = on_resolved

        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.DETECTED,
            operations=[
                ConflictingOperation(
                    id="op1",
                    user_id="user1",
                    client_id="client1",
                    operation={},
                    version=5,
                    timestamp=now,
                ),
            ],
            detected_at=now,
        )
        await manager.record_conflict(conflict)
        await manager.resolve("conflict_123")

        assert len(detected_conflicts) == 1
        assert len(resolved_results) == 1

    @pytest.mark.asyncio
    async def test_cleanup_old_conflicts(self, manager):
        """Clean up old resolved conflicts."""
        config = ConflictConfig(conflict_history_ttl=timedelta(seconds=0))
        manager = ConflictManager(config)

        now = datetime.utcnow()
        conflict = Conflict(
            id="conflict_123",
            document_id="doc1",
            conflict_type=ConflictType.CONCURRENT_EDIT,
            severity=ConflictSeverity.MEDIUM,
            state=ConflictState.RESOLVED,
            operations=[],
            detected_at=now,
            resolved_at=now - timedelta(seconds=1),
        )
        await manager.record_conflict(conflict)

        removed = await manager.cleanup_old_conflicts()

        assert removed == 1
        assert manager.get_conflict("conflict_123") is None

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "total_conflicts" in stats
        assert "active_conflicts" in stats
        assert "resolution_rate" in stats


class TestGlobalConflictManager:
    """Tests for global conflict manager functions."""

    def test_get_conflict_manager(self):
        """Get global conflict manager."""
        reset_conflict_manager()

        manager = get_conflict_manager()

        assert manager is not None
        assert isinstance(manager, ConflictManager)

    def test_set_conflict_manager(self):
        """Set global conflict manager."""
        reset_conflict_manager()

        custom = ConflictManager()
        set_conflict_manager(custom)

        assert get_conflict_manager() is custom

    def test_reset_conflict_manager(self):
        """Reset global conflict manager."""
        get_conflict_manager()

        reset_conflict_manager()

        manager = get_conflict_manager()
        assert manager is not None
