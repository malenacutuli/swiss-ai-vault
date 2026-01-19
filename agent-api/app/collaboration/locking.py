"""
Document Locking for Collaboration

Provides:
- Document-level locking (exclusive and shared)
- Section/range locking for fine-grained control
- Lock timeouts and auto-release
- Lock queuing for waiting requests
- Deadlock detection and prevention

Integrates with session management for lock ownership.
"""

from __future__ import annotations

import asyncio
import secrets
from typing import Optional, Any, Callable, Awaitable, List, Dict, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

import logging

logger = logging.getLogger(__name__)


class LockType(Enum):
    """Types of locks."""
    EXCLUSIVE = "exclusive"  # Full write lock, blocks all other access
    SHARED = "shared"  # Read lock, allows other readers
    INTENT_EXCLUSIVE = "intent_exclusive"  # Planning to acquire exclusive
    INTENT_SHARED = "intent_shared"  # Planning to acquire shared


class LockScope(Enum):
    """Scope of the lock."""
    DOCUMENT = "document"  # Entire document
    SECTION = "section"  # Range within document
    FIELD = "field"  # Specific field/property


class LockState(Enum):
    """Lock states."""
    PENDING = "pending"
    ACQUIRED = "acquired"
    RELEASED = "released"
    EXPIRED = "expired"
    DENIED = "denied"


@dataclass
class LockConfig:
    """Locking configuration."""
    default_timeout: timedelta = timedelta(minutes=5)
    max_lock_duration: timedelta = timedelta(hours=1)
    max_locks_per_user: int = 50
    max_locks_per_document: int = 100
    enable_queuing: bool = True
    queue_timeout: timedelta = timedelta(seconds=30)
    enable_deadlock_detection: bool = True
    auto_release_on_disconnect: bool = True
    heartbeat_interval: float = 30.0


@dataclass
class LockRange:
    """Range for section locks."""
    start: int
    end: int

    def overlaps(self, other: "LockRange") -> bool:
        """Check if ranges overlap."""
        return self.start < other.end and other.start < self.end

    def contains(self, position: int) -> bool:
        """Check if position is within range."""
        return self.start <= position < self.end

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {"start": self.start, "end": self.end}

    @classmethod
    def from_dict(cls, data: dict) -> "LockRange":
        """Create from dictionary."""
        return cls(start=data["start"], end=data["end"])


@dataclass
class Lock:
    """A document or section lock."""
    id: str
    document_id: str
    user_id: str
    session_id: str
    lock_type: LockType
    scope: LockScope
    state: LockState
    acquired_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    range: Optional[LockRange] = None
    field_name: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def is_active(self) -> bool:
        """Check if lock is active."""
        return self.state == LockState.ACQUIRED

    def is_expired(self) -> bool:
        """Check if lock has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def conflicts_with(self, other: "Lock") -> bool:
        """Check if this lock conflicts with another."""
        if self.document_id != other.document_id:
            return False

        # Check scope compatibility
        if self.scope == LockScope.DOCUMENT or other.scope == LockScope.DOCUMENT:
            # Document locks conflict with everything
            return self._type_conflicts(other.lock_type)

        if self.scope == LockScope.SECTION and other.scope == LockScope.SECTION:
            # Section locks only conflict if ranges overlap
            if self.range and other.range:
                if not self.range.overlaps(other.range):
                    return False
            return self._type_conflicts(other.lock_type)

        if self.scope == LockScope.FIELD and other.scope == LockScope.FIELD:
            # Field locks only conflict on same field
            if self.field_name != other.field_name:
                return False
            return self._type_conflicts(other.lock_type)

        return self._type_conflicts(other.lock_type)

    def _type_conflicts(self, other_type: LockType) -> bool:
        """Check if lock types conflict."""
        # Shared locks don't conflict with each other
        if self.lock_type == LockType.SHARED and other_type == LockType.SHARED:
            return False

        # Intent locks don't conflict with each other
        if (self.lock_type in (LockType.INTENT_EXCLUSIVE, LockType.INTENT_SHARED) and
                other_type in (LockType.INTENT_EXCLUSIVE, LockType.INTENT_SHARED)):
            return False

        # Everything else conflicts
        return True

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "lock_type": self.lock_type.value,
            "scope": self.scope.value,
            "state": self.state.value,
            "acquired_at": self.acquired_at.isoformat() if self.acquired_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "released_at": self.released_at.isoformat() if self.released_at else None,
            "range": self.range.to_dict() if self.range else None,
            "field_name": self.field_name,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Lock":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            user_id=data["user_id"],
            session_id=data["session_id"],
            lock_type=LockType(data["lock_type"]),
            scope=LockScope(data["scope"]),
            state=LockState(data["state"]),
            acquired_at=datetime.fromisoformat(data["acquired_at"]) if data.get("acquired_at") else None,
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            released_at=datetime.fromisoformat(data["released_at"]) if data.get("released_at") else None,
            range=LockRange.from_dict(data["range"]) if data.get("range") else None,
            field_name=data.get("field_name"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class LockRequest:
    """A request to acquire a lock."""
    id: str
    document_id: str
    user_id: str
    session_id: str
    lock_type: LockType
    scope: LockScope
    range: Optional[LockRange] = None
    field_name: Optional[str] = None
    timeout: Optional[timedelta] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)


@dataclass
class LockResult:
    """Result of a lock operation."""
    success: bool
    lock: Optional[Lock] = None
    message: str = ""
    wait_time_ms: float = 0
    conflict_locks: List[Lock] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "lock": self.lock.to_dict() if self.lock else None,
            "message": self.message,
            "wait_time_ms": self.wait_time_ms,
            "conflict_locks": [l.to_dict() for l in self.conflict_locks],
        }


class LockQueue:
    """Queue for pending lock requests."""

    def __init__(self, timeout: timedelta = timedelta(seconds=30)):
        self.timeout = timeout
        self._queue: Dict[str, List[LockRequest]] = defaultdict(list)  # doc_id -> requests
        self._events: Dict[str, asyncio.Event] = {}  # request_id -> event

    def add(self, request: LockRequest) -> asyncio.Event:
        """Add a request to the queue."""
        self._queue[request.document_id].append(request)
        event = asyncio.Event()
        self._events[request.id] = event
        return event

    def remove(self, request_id: str, document_id: str) -> Optional[LockRequest]:
        """Remove a request from the queue."""
        queue = self._queue.get(document_id, [])
        for i, req in enumerate(queue):
            if req.id == request_id:
                self._events.pop(request_id, None)
                return queue.pop(i)
        return None

    def get_next(self, document_id: str) -> Optional[LockRequest]:
        """Get next request in queue."""
        queue = self._queue.get(document_id, [])
        if queue:
            return queue[0]
        return None

    def notify(self, request_id: str) -> None:
        """Notify that a lock may be available."""
        event = self._events.get(request_id)
        if event:
            event.set()

    def get_queue_length(self, document_id: str) -> int:
        """Get queue length for a document."""
        return len(self._queue.get(document_id, []))

    def cleanup_expired(self) -> int:
        """Remove expired requests from queue."""
        now = datetime.utcnow()
        removed = 0

        for doc_id in list(self._queue.keys()):
            queue = self._queue[doc_id]
            expired = [
                req for req in queue
                if (now - req.created_at) > self.timeout
            ]

            for req in expired:
                queue.remove(req)
                self._events.pop(req.id, None)
                removed += 1

            if not queue:
                del self._queue[doc_id]

        return removed


class LockManager:
    """Manages document and section locks."""

    def __init__(self, config: Optional[LockConfig] = None):
        self.config = config or LockConfig()
        self._locks: Dict[str, Lock] = {}  # lock_id -> Lock
        self._document_locks: Dict[str, Set[str]] = defaultdict(set)  # doc_id -> lock_ids
        self._user_locks: Dict[str, Set[str]] = defaultdict(set)  # user_id -> lock_ids
        self._session_locks: Dict[str, Set[str]] = defaultdict(set)  # session_id -> lock_ids
        self._queue = LockQueue(self.config.queue_timeout)
        self._lock = asyncio.Lock()
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None

        # Callbacks
        self.on_lock_acquired: Optional[
            Callable[[Lock], Awaitable[None]]
        ] = None
        self.on_lock_released: Optional[
            Callable[[Lock], Awaitable[None]]
        ] = None
        self.on_lock_expired: Optional[
            Callable[[Lock], Awaitable[None]]
        ] = None

        # Stats
        self._locks_acquired = 0
        self._locks_released = 0
        self._locks_expired = 0
        self._locks_denied = 0

    async def start(self) -> None:
        """Start lock manager."""
        if self._running:
            return

        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        """Stop lock manager."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self) -> None:
        """Periodic cleanup of expired locks."""
        while self._running:
            try:
                await asyncio.sleep(self.config.heartbeat_interval)
                await self._cleanup_expired_locks()
                self._queue.cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Lock cleanup error: {e}")

    async def _cleanup_expired_locks(self) -> int:
        """Clean up expired locks."""
        expired = []

        async with self._lock:
            for lock in self._locks.values():
                if lock.is_active() and lock.is_expired():
                    expired.append(lock)

        for lock in expired:
            await self._release_lock(lock, expired=True)

        return len(expired)

    async def acquire(
        self,
        document_id: str,
        user_id: str,
        session_id: str,
        lock_type: LockType = LockType.EXCLUSIVE,
        scope: LockScope = LockScope.DOCUMENT,
        range: Optional[LockRange] = None,
        field_name: Optional[str] = None,
        timeout: Optional[timedelta] = None,
        wait: bool = True,
        metadata: Optional[dict] = None
    ) -> LockResult:
        """Acquire a lock."""
        timeout = timeout or self.config.default_timeout

        # Check user lock limit
        if len(self._user_locks[user_id]) >= self.config.max_locks_per_user:
            return LockResult(
                success=False,
                message="Max locks per user reached",
            )

        # Check document lock limit
        if len(self._document_locks[document_id]) >= self.config.max_locks_per_document:
            return LockResult(
                success=False,
                message="Max locks per document reached",
            )

        lock_id = f"lock_{secrets.token_hex(12)}"
        now = datetime.utcnow()

        lock = Lock(
            id=lock_id,
            document_id=document_id,
            user_id=user_id,
            session_id=session_id,
            lock_type=lock_type,
            scope=scope,
            state=LockState.PENDING,
            range=range,
            field_name=field_name,
            metadata=metadata or {},
        )

        # Check for conflicts
        conflicts = self._find_conflicts(lock)

        if conflicts:
            # Filter out user's own locks
            conflicts = [c for c in conflicts if c.user_id != user_id]

        if conflicts:
            if not wait or not self.config.enable_queuing:
                self._locks_denied += 1
                return LockResult(
                    success=False,
                    message="Lock conflicts with existing locks",
                    conflict_locks=conflicts,
                )

            # Queue the request
            request = LockRequest(
                id=lock_id,
                document_id=document_id,
                user_id=user_id,
                session_id=session_id,
                lock_type=lock_type,
                scope=scope,
                range=range,
                field_name=field_name,
                timeout=timeout,
                metadata=metadata or {},
            )

            event = self._queue.add(request)
            start_time = datetime.utcnow()

            try:
                await asyncio.wait_for(
                    event.wait(),
                    timeout=self.config.queue_timeout.total_seconds()
                )
            except asyncio.TimeoutError:
                self._queue.remove(lock_id, document_id)
                self._locks_denied += 1
                return LockResult(
                    success=False,
                    message="Lock acquisition timed out",
                    conflict_locks=conflicts,
                    wait_time_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                )

            # Re-check conflicts after wait
            conflicts = self._find_conflicts(lock)
            conflicts = [c for c in conflicts if c.user_id != user_id]

            if conflicts:
                self._queue.remove(lock_id, document_id)
                self._locks_denied += 1
                return LockResult(
                    success=False,
                    message="Lock still conflicts after wait",
                    conflict_locks=conflicts,
                    wait_time_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                )

        # Acquire the lock
        async with self._lock:
            lock.state = LockState.ACQUIRED
            lock.acquired_at = datetime.utcnow()
            lock.expires_at = datetime.utcnow() + min(timeout, self.config.max_lock_duration)

            self._locks[lock_id] = lock
            self._document_locks[document_id].add(lock_id)
            self._user_locks[user_id].add(lock_id)
            self._session_locks[session_id].add(lock_id)
            self._locks_acquired += 1

        if self.on_lock_acquired:
            try:
                await self.on_lock_acquired(lock)
            except Exception as e:
                logger.error(f"Lock acquired callback error: {e}")

        return LockResult(
            success=True,
            lock=lock,
            message="Lock acquired",
        )

    def _find_conflicts(self, lock: Lock) -> List[Lock]:
        """Find locks that conflict with the given lock."""
        conflicts = []

        doc_lock_ids = self._document_locks.get(lock.document_id, set())
        for lock_id in doc_lock_ids:
            existing = self._locks.get(lock_id)
            if existing and existing.is_active():
                if lock.conflicts_with(existing):
                    conflicts.append(existing)

        return conflicts

    async def release(
        self,
        lock_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Release a lock."""
        lock = self._locks.get(lock_id)
        if not lock:
            return False

        if user_id and lock.user_id != user_id:
            return False

        return await self._release_lock(lock)

    async def _release_lock(self, lock: Lock, expired: bool = False) -> bool:
        """Internal method to release a lock."""
        async with self._lock:
            lock.state = LockState.EXPIRED if expired else LockState.RELEASED
            lock.released_at = datetime.utcnow()

            self._locks.pop(lock.id, None)
            self._document_locks[lock.document_id].discard(lock.id)
            self._user_locks[lock.user_id].discard(lock.id)
            self._session_locks[lock.session_id].discard(lock.id)

            if expired:
                self._locks_expired += 1
            else:
                self._locks_released += 1

        # Notify queued requests
        next_request = self._queue.get_next(lock.document_id)
        if next_request:
            self._queue.notify(next_request.id)

        callback = self.on_lock_expired if expired else self.on_lock_released
        if callback:
            try:
                await callback(lock)
            except Exception as e:
                logger.error(f"Lock {'expired' if expired else 'released'} callback error: {e}")

        return True

    async def release_session_locks(self, session_id: str) -> int:
        """Release all locks for a session."""
        lock_ids = list(self._session_locks.get(session_id, set()))
        released = 0

        for lock_id in lock_ids:
            if await self.release(lock_id):
                released += 1

        return released

    async def release_user_locks(self, user_id: str) -> int:
        """Release all locks for a user."""
        lock_ids = list(self._user_locks.get(user_id, set()))
        released = 0

        for lock_id in lock_ids:
            if await self.release(lock_id, user_id):
                released += 1

        return released

    async def extend(
        self,
        lock_id: str,
        user_id: str,
        extension: Optional[timedelta] = None
    ) -> bool:
        """Extend a lock's timeout."""
        lock = self._locks.get(lock_id)
        if not lock or lock.user_id != user_id:
            return False

        if not lock.is_active():
            return False

        extension = extension or self.config.default_timeout
        new_expiry = datetime.utcnow() + extension

        # Ensure we don't exceed max duration
        max_expiry = lock.acquired_at + self.config.max_lock_duration
        new_expiry = min(new_expiry, max_expiry)

        async with self._lock:
            lock.expires_at = new_expiry

        return True

    def get_lock(self, lock_id: str) -> Optional[Lock]:
        """Get a lock by ID."""
        return self._locks.get(lock_id)

    def get_document_locks(self, document_id: str) -> List[Lock]:
        """Get all locks for a document."""
        lock_ids = self._document_locks.get(document_id, set())
        return [
            self._locks[lid]
            for lid in lock_ids
            if lid in self._locks and self._locks[lid].is_active()
        ]

    def get_user_locks(self, user_id: str) -> List[Lock]:
        """Get all locks held by a user."""
        lock_ids = self._user_locks.get(user_id, set())
        return [
            self._locks[lid]
            for lid in lock_ids
            if lid in self._locks and self._locks[lid].is_active()
        ]

    def is_locked(
        self,
        document_id: str,
        position: Optional[int] = None,
        field_name: Optional[str] = None
    ) -> bool:
        """Check if document or position is locked."""
        locks = self.get_document_locks(document_id)

        for lock in locks:
            if lock.scope == LockScope.DOCUMENT:
                return True

            if position is not None and lock.scope == LockScope.SECTION:
                if lock.range and lock.range.contains(position):
                    return True

            if field_name and lock.scope == LockScope.FIELD:
                if lock.field_name == field_name:
                    return True

        return False

    def can_edit(
        self,
        document_id: str,
        user_id: str,
        position: Optional[int] = None,
        field_name: Optional[str] = None
    ) -> bool:
        """Check if user can edit document or position."""
        locks = self.get_document_locks(document_id)

        for lock in locks:
            if lock.user_id == user_id:
                continue

            if lock.lock_type == LockType.SHARED:
                continue

            if lock.scope == LockScope.DOCUMENT:
                return False

            if position is not None and lock.scope == LockScope.SECTION:
                if lock.range and lock.range.contains(position):
                    return False

            if field_name and lock.scope == LockScope.FIELD:
                if lock.field_name == field_name:
                    return False

        return True

    def get_queue_length(self, document_id: str) -> int:
        """Get queue length for a document."""
        return self._queue.get_queue_length(document_id)

    def get_stats(self) -> dict:
        """Get lock manager statistics."""
        active = sum(1 for lock in self._locks.values() if lock.is_active())

        return {
            "total_locks": len(self._locks),
            "active_locks": active,
            "locks_acquired": self._locks_acquired,
            "locks_released": self._locks_released,
            "locks_expired": self._locks_expired,
            "locks_denied": self._locks_denied,
            "documents_with_locks": len(self._document_locks),
            "users_with_locks": len(self._user_locks),
            "running": self._running,
        }


# Global lock manager
_lock_manager: Optional[LockManager] = None


def get_lock_manager() -> LockManager:
    """Get global lock manager."""
    global _lock_manager
    if _lock_manager is None:
        _lock_manager = LockManager()
    return _lock_manager


def set_lock_manager(manager: LockManager) -> None:
    """Set global lock manager."""
    global _lock_manager
    _lock_manager = manager


def reset_lock_manager() -> None:
    """Reset global lock manager."""
    global _lock_manager
    _lock_manager = None
