"""Tests for Document Locking."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.locking import (
    LockManager,
    LockConfig,
    Lock,
    LockType,
    LockScope,
    LockState,
    LockRange,
    LockRequest,
    LockResult,
    LockQueue,
    get_lock_manager,
    set_lock_manager,
    reset_lock_manager,
)


class TestLockType:
    """Tests for LockType enum."""

    def test_type_values(self):
        """Type values are correct."""
        assert LockType.EXCLUSIVE.value == "exclusive"
        assert LockType.SHARED.value == "shared"
        assert LockType.INTENT_EXCLUSIVE.value == "intent_exclusive"
        assert LockType.INTENT_SHARED.value == "intent_shared"


class TestLockScope:
    """Tests for LockScope enum."""

    def test_scope_values(self):
        """Scope values are correct."""
        assert LockScope.DOCUMENT.value == "document"
        assert LockScope.SECTION.value == "section"
        assert LockScope.FIELD.value == "field"


class TestLockState:
    """Tests for LockState enum."""

    def test_state_values(self):
        """State values are correct."""
        assert LockState.PENDING.value == "pending"
        assert LockState.ACQUIRED.value == "acquired"
        assert LockState.RELEASED.value == "released"
        assert LockState.EXPIRED.value == "expired"


class TestLockConfig:
    """Tests for LockConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = LockConfig()

        assert config.default_timeout == timedelta(minutes=5)
        assert config.max_locks_per_user == 50
        assert config.enable_queuing is True

    def test_custom_config(self):
        """Custom configuration."""
        config = LockConfig(
            default_timeout=timedelta(minutes=10),
            max_locks_per_user=20,
        )

        assert config.default_timeout == timedelta(minutes=10)
        assert config.max_locks_per_user == 20


class TestLockRange:
    """Tests for LockRange."""

    def test_create_range(self):
        """Create a lock range."""
        r = LockRange(start=10, end=50)

        assert r.start == 10
        assert r.end == 50

    def test_overlaps(self):
        """Check range overlap."""
        r1 = LockRange(start=10, end=50)
        r2 = LockRange(start=40, end=80)
        r3 = LockRange(start=60, end=100)

        assert r1.overlaps(r2) is True
        assert r1.overlaps(r3) is False

    def test_contains(self):
        """Check position containment."""
        r = LockRange(start=10, end=50)

        assert r.contains(10) is True
        assert r.contains(30) is True
        assert r.contains(50) is False
        assert r.contains(5) is False

    def test_to_dict(self):
        """Convert to dictionary."""
        r = LockRange(start=10, end=50)
        d = r.to_dict()

        assert d["start"] == 10
        assert d["end"] == 50

    def test_from_dict(self):
        """Create from dictionary."""
        r = LockRange.from_dict({"start": 20, "end": 60})

        assert r.start == 20
        assert r.end == 60


class TestLock:
    """Tests for Lock."""

    @pytest.fixture
    def lock(self):
        """Create a test lock."""
        now = datetime.utcnow()
        return Lock(
            id="lock_123",
            document_id="doc1",
            user_id="user1",
            session_id="sess_abc",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
            state=LockState.ACQUIRED,
            acquired_at=now,
            expires_at=now + timedelta(minutes=5),
        )

    def test_is_active(self, lock):
        """Check if lock is active."""
        assert lock.is_active() is True

        lock.state = LockState.RELEASED
        assert lock.is_active() is False

    def test_is_expired(self, lock):
        """Check if lock is expired."""
        assert lock.is_expired() is False

        lock.expires_at = datetime.utcnow() - timedelta(hours=1)
        assert lock.is_expired() is True

    def test_conflicts_with_exclusive(self, lock):
        """Exclusive locks conflict with other locks."""
        other = Lock(
            id="lock_456",
            document_id="doc1",
            user_id="user2",
            session_id="sess_xyz",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
            state=LockState.ACQUIRED,
        )

        assert lock.conflicts_with(other) is True

    def test_shared_locks_dont_conflict(self):
        """Shared locks don't conflict with each other."""
        lock1 = Lock(
            id="lock_1",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.SHARED,
            scope=LockScope.DOCUMENT,
            state=LockState.ACQUIRED,
        )
        lock2 = Lock(
            id="lock_2",
            document_id="doc1",
            user_id="user2",
            session_id="sess_2",
            lock_type=LockType.SHARED,
            scope=LockScope.DOCUMENT,
            state=LockState.ACQUIRED,
        )

        assert lock1.conflicts_with(lock2) is False

    def test_section_locks_overlap(self):
        """Section locks conflict when ranges overlap."""
        lock1 = Lock(
            id="lock_1",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            state=LockState.ACQUIRED,
            range=LockRange(10, 50),
        )
        lock2 = Lock(
            id="lock_2",
            document_id="doc1",
            user_id="user2",
            session_id="sess_2",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            state=LockState.ACQUIRED,
            range=LockRange(40, 80),
        )
        lock3 = Lock(
            id="lock_3",
            document_id="doc1",
            user_id="user3",
            session_id="sess_3",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            state=LockState.ACQUIRED,
            range=LockRange(60, 100),
        )

        assert lock1.conflicts_with(lock2) is True
        assert lock1.conflicts_with(lock3) is False

    def test_different_documents_no_conflict(self, lock):
        """Locks on different documents don't conflict."""
        other = Lock(
            id="lock_456",
            document_id="doc2",
            user_id="user2",
            session_id="sess_xyz",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
            state=LockState.ACQUIRED,
        )

        assert lock.conflicts_with(other) is False

    def test_to_dict(self, lock):
        """Convert to dictionary."""
        d = lock.to_dict()

        assert d["id"] == "lock_123"
        assert d["lock_type"] == "exclusive"
        assert d["scope"] == "document"

    def test_from_dict(self, lock):
        """Create from dictionary."""
        d = lock.to_dict()
        recreated = Lock.from_dict(d)

        assert recreated.id == lock.id
        assert recreated.lock_type == lock.lock_type


class TestLockResult:
    """Tests for LockResult."""

    def test_create_result(self):
        """Create a lock result."""
        result = LockResult(
            success=True,
            lock=None,
            message="Lock acquired",
        )

        assert result.success is True

    def test_to_dict(self):
        """Convert to dictionary."""
        result = LockResult(
            success=False,
            message="Conflict",
            wait_time_ms=150.5,
        )

        d = result.to_dict()

        assert d["success"] is False
        assert d["wait_time_ms"] == 150.5


class TestLockQueue:
    """Tests for LockQueue."""

    @pytest.fixture
    def queue(self):
        """Create a lock queue."""
        return LockQueue()

    def test_add_request(self, queue):
        """Add a request to the queue."""
        request = LockRequest(
            id="req_123",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
        )

        event = queue.add(request)

        assert event is not None
        assert queue.get_queue_length("doc1") == 1

    def test_remove_request(self, queue):
        """Remove a request from the queue."""
        request = LockRequest(
            id="req_123",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
        )
        queue.add(request)

        removed = queue.remove("req_123", "doc1")

        assert removed is not None
        assert queue.get_queue_length("doc1") == 0

    def test_get_next(self, queue):
        """Get next request in queue."""
        request = LockRequest(
            id="req_123",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
        )
        queue.add(request)

        next_req = queue.get_next("doc1")

        assert next_req is not None
        assert next_req.id == "req_123"

    def test_cleanup_expired(self, queue):
        """Clean up expired requests."""
        queue = LockQueue(timeout=timedelta(seconds=0))
        request = LockRequest(
            id="req_123",
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.DOCUMENT,
            created_at=datetime.utcnow() - timedelta(seconds=1),
        )
        queue.add(request)

        removed = queue.cleanup_expired()

        assert removed == 1


class TestLockManager:
    """Tests for LockManager."""

    @pytest.fixture
    def manager(self):
        """Create a lock manager."""
        return LockManager()

    @pytest.mark.asyncio
    async def test_acquire_exclusive_lock(self, manager):
        """Acquire an exclusive lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
        )

        assert result.success is True
        assert result.lock is not None
        assert result.lock.lock_type == LockType.EXCLUSIVE

    @pytest.mark.asyncio
    async def test_acquire_shared_lock(self, manager):
        """Acquire a shared lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.SHARED,
        )

        assert result.success is True
        assert result.lock.lock_type == LockType.SHARED

    @pytest.mark.asyncio
    async def test_acquire_section_lock(self, manager):
        """Acquire a section lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            range=LockRange(10, 50),
        )

        assert result.success is True
        assert result.lock.scope == LockScope.SECTION

    @pytest.mark.asyncio
    async def test_conflict_blocks_acquisition(self, manager):
        """Conflicting lock blocks acquisition."""
        manager = LockManager(LockConfig(enable_queuing=False))

        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
        )

        result = await manager.acquire(
            document_id="doc1",
            user_id="user2",
            session_id="sess_2",
            lock_type=LockType.EXCLUSIVE,
        )

        assert result.success is False
        assert len(result.conflict_locks) > 0

    @pytest.mark.asyncio
    async def test_same_user_no_conflict(self, manager):
        """Same user can acquire overlapping locks."""
        manager = LockManager(LockConfig(enable_queuing=False))

        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            range=LockRange(10, 50),
        )

        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.EXCLUSIVE,
            scope=LockScope.SECTION,
            range=LockRange(40, 80),
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_multiple_shared_locks(self, manager):
        """Multiple shared locks can coexist."""
        result1 = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.SHARED,
        )
        result2 = await manager.acquire(
            document_id="doc1",
            user_id="user2",
            session_id="sess_2",
            lock_type=LockType.SHARED,
        )

        assert result1.success is True
        assert result2.success is True

    @pytest.mark.asyncio
    async def test_release_lock(self, manager):
        """Release a lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )
        lock_id = result.lock.id

        released = await manager.release(lock_id, "user1")

        assert released is True
        assert manager.get_lock(lock_id) is None

    @pytest.mark.asyncio
    async def test_release_wrong_user(self, manager):
        """Cannot release another user's lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )

        released = await manager.release(result.lock.id, "user2")

        assert released is False

    @pytest.mark.asyncio
    async def test_release_session_locks(self, manager):
        """Release all locks for a session."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )
        await manager.acquire(
            document_id="doc2",
            user_id="user1",
            session_id="sess_1",
        )
        await manager.acquire(
            document_id="doc3",
            user_id="user1",
            session_id="sess_2",
        )

        released = await manager.release_session_locks("sess_1")

        assert released == 2

    @pytest.mark.asyncio
    async def test_release_user_locks(self, manager):
        """Release all locks for a user."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )
        await manager.acquire(
            document_id="doc2",
            user_id="user1",
            session_id="sess_2",
        )

        released = await manager.release_user_locks("user1")

        assert released == 2

    @pytest.mark.asyncio
    async def test_extend_lock(self, manager):
        """Extend a lock's timeout."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )
        original_expiry = result.lock.expires_at

        await asyncio.sleep(0.01)
        extended = await manager.extend(result.lock.id, "user1")

        assert extended is True
        assert result.lock.expires_at > original_expiry

    @pytest.mark.asyncio
    async def test_extend_wrong_user(self, manager):
        """Cannot extend another user's lock."""
        result = await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )

        extended = await manager.extend(result.lock.id, "user2")

        assert extended is False

    @pytest.mark.asyncio
    async def test_get_document_locks(self, manager):
        """Get all locks for a document."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.SHARED,
        )
        await manager.acquire(
            document_id="doc1",
            user_id="user2",
            session_id="sess_2",
            lock_type=LockType.SHARED,
        )

        locks = manager.get_document_locks("doc1")

        assert len(locks) == 2

    @pytest.mark.asyncio
    async def test_get_user_locks(self, manager):
        """Get all locks for a user."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )
        await manager.acquire(
            document_id="doc2",
            user_id="user1",
            session_id="sess_1",
        )

        locks = manager.get_user_locks("user1")

        assert len(locks) == 2

    @pytest.mark.asyncio
    async def test_is_locked(self, manager):
        """Check if document is locked."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )

        assert manager.is_locked("doc1") is True
        assert manager.is_locked("doc2") is False

    @pytest.mark.asyncio
    async def test_is_locked_position(self, manager):
        """Check if position is locked."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            scope=LockScope.SECTION,
            range=LockRange(10, 50),
        )

        assert manager.is_locked("doc1", position=30) is True
        assert manager.is_locked("doc1", position=60) is False

    @pytest.mark.asyncio
    async def test_can_edit(self, manager):
        """Check if user can edit."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
        )

        assert manager.can_edit("doc1", "user1") is True
        assert manager.can_edit("doc1", "user2") is False

    @pytest.mark.asyncio
    async def test_can_edit_shared_lock(self, manager):
        """Shared locks allow reading but block writing."""
        await manager.acquire(
            document_id="doc1",
            user_id="user1",
            session_id="sess_1",
            lock_type=LockType.SHARED,
        )

        # Shared locks don't block others
        assert manager.can_edit("doc1", "user2") is True

    @pytest.mark.asyncio
    async def test_max_locks_per_user(self, manager):
        """User cannot exceed max locks."""
        config = LockConfig(max_locks_per_user=2)
        manager = LockManager(config)

        await manager.acquire("doc1", "user1", "sess_1")
        await manager.acquire("doc2", "user1", "sess_1")
        result = await manager.acquire("doc3", "user1", "sess_1")

        assert result.success is False
        assert "Max locks" in result.message

    @pytest.mark.asyncio
    async def test_max_locks_per_document(self, manager):
        """Document cannot exceed max locks."""
        config = LockConfig(max_locks_per_document=2)
        manager = LockManager(config)

        await manager.acquire("doc1", "user1", "sess_1", lock_type=LockType.SHARED)
        await manager.acquire("doc1", "user2", "sess_2", lock_type=LockType.SHARED)
        result = await manager.acquire("doc1", "user3", "sess_3", lock_type=LockType.SHARED)

        assert result.success is False
        assert "Max locks" in result.message

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Start and stop manager."""
        await manager.start()
        assert manager._running is True

        await manager.stop()
        assert manager._running is False

    @pytest.mark.asyncio
    async def test_lock_callbacks(self, manager):
        """Lock callbacks are invoked."""
        acquired_locks = []
        released_locks = []

        async def on_acquired(lock):
            acquired_locks.append(lock)

        async def on_released(lock):
            released_locks.append(lock)

        manager.on_lock_acquired = on_acquired
        manager.on_lock_released = on_released

        result = await manager.acquire("doc1", "user1", "sess_1")
        await manager.release(result.lock.id, "user1")

        assert len(acquired_locks) == 1
        assert len(released_locks) == 1

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "total_locks" in stats
        assert "active_locks" in stats
        assert "locks_acquired" in stats


class TestGlobalLockManager:
    """Tests for global lock manager functions."""

    def test_get_lock_manager(self):
        """Get global lock manager."""
        reset_lock_manager()

        manager = get_lock_manager()

        assert manager is not None
        assert isinstance(manager, LockManager)

    def test_set_lock_manager(self):
        """Set global lock manager."""
        reset_lock_manager()

        custom = LockManager()
        set_lock_manager(custom)

        assert get_lock_manager() is custom

    def test_reset_lock_manager(self):
        """Reset global lock manager."""
        get_lock_manager()

        reset_lock_manager()

        manager = get_lock_manager()
        assert manager is not None


class TestLockExpiration:
    """Tests for lock expiration."""

    @pytest.mark.asyncio
    async def test_expired_lock_cleanup(self):
        """Expired locks are cleaned up."""
        config = LockConfig(default_timeout=timedelta(seconds=0))
        manager = LockManager(config)

        result = await manager.acquire("doc1", "user1", "sess_1")
        result.lock.expires_at = datetime.utcnow() - timedelta(seconds=1)

        expired_count = await manager._cleanup_expired_locks()

        assert expired_count == 1
        assert manager.get_lock(result.lock.id) is None

    @pytest.mark.asyncio
    async def test_expired_callback(self):
        """Expired callback is invoked."""
        expired_locks = []

        async def on_expired(lock):
            expired_locks.append(lock)

        config = LockConfig(default_timeout=timedelta(seconds=0))
        manager = LockManager(config)
        manager.on_lock_expired = on_expired

        result = await manager.acquire("doc1", "user1", "sess_1")
        result.lock.expires_at = datetime.utcnow() - timedelta(seconds=1)

        await manager._cleanup_expired_locks()

        assert len(expired_locks) == 1
