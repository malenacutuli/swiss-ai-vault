"""
Document Snapshot Management

Provides snapshot capabilities for document recovery:
- Manual and automatic snapshot creation
- Version history with rollback
- Delta-based incremental snapshots
- Snapshot retention policies
- Recovery from crashes

Integrates with OT server for seamless document versioning.
"""

from __future__ import annotations

import asyncio
import difflib
import json
import uuid
from typing import Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import deque

import logging

from app.collaboration.storage import (
    StorageBackend,
    StorageManager,
    StorageMetadata,
    StoredDocument,
    InMemoryStorage,
    StorageConfig,
    DocumentNotFoundError,
)

logger = logging.getLogger(__name__)


class SnapshotType(Enum):
    """Types of snapshots."""
    FULL = "full"  # Complete document content
    DELTA = "delta"  # Changes from previous snapshot
    AUTO = "auto"  # Automatic periodic snapshot
    MANUAL = "manual"  # User-requested snapshot
    CHECKPOINT = "checkpoint"  # System checkpoint


class SnapshotTrigger(Enum):
    """What triggered the snapshot."""
    PERIODIC = "periodic"
    OPERATION_COUNT = "operation_count"
    TIME_ELAPSED = "time_elapsed"
    USER_REQUEST = "user_request"
    SYSTEM_EVENT = "system_event"
    PRE_SHUTDOWN = "pre_shutdown"


@dataclass
class SnapshotConfig:
    """Snapshot configuration."""
    # Auto-snapshot settings
    auto_snapshot_enabled: bool = True
    auto_snapshot_interval: float = 300.0  # 5 minutes
    operations_per_snapshot: int = 100  # Snapshot every N operations

    # Delta settings
    delta_enabled: bool = True
    delta_threshold: float = 0.3  # Use delta if < 30% changed

    # Retention settings
    max_snapshots_per_document: int = 50
    max_snapshot_age: timedelta = timedelta(days=7)
    keep_hourly: int = 24  # Keep last 24 hourly snapshots
    keep_daily: int = 7  # Keep last 7 daily snapshots

    # Storage
    compress_snapshots: bool = True


@dataclass
class Snapshot:
    """A document snapshot."""
    id: str
    document_id: str
    version: int
    snapshot_type: SnapshotType
    trigger: SnapshotTrigger
    content: Optional[str]  # Full content (None for delta)
    delta: Optional[str]  # Delta from base (None for full)
    base_snapshot_id: Optional[str]  # For delta snapshots
    created_at: datetime
    size: int
    checksum: str
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "version": self.version,
            "snapshot_type": self.snapshot_type.value,
            "trigger": self.trigger.value,
            "content": self.content,
            "delta": self.delta,
            "base_snapshot_id": self.base_snapshot_id,
            "created_at": self.created_at.isoformat(),
            "size": self.size,
            "checksum": self.checksum,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Snapshot":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            version=data["version"],
            snapshot_type=SnapshotType(data["snapshot_type"]),
            trigger=SnapshotTrigger(data["trigger"]),
            content=data.get("content"),
            delta=data.get("delta"),
            base_snapshot_id=data.get("base_snapshot_id"),
            created_at=datetime.fromisoformat(data["created_at"]),
            size=data["size"],
            checksum=data["checksum"],
            metadata=data.get("metadata", {}),
        )

    def is_delta(self) -> bool:
        """Check if this is a delta snapshot."""
        return self.snapshot_type == SnapshotType.DELTA or self.delta is not None


@dataclass
class SnapshotInfo:
    """Lightweight snapshot info without content."""
    id: str
    document_id: str
    version: int
    snapshot_type: SnapshotType
    trigger: SnapshotTrigger
    created_at: datetime
    size: int

    @classmethod
    def from_snapshot(cls, snapshot: Snapshot) -> "SnapshotInfo":
        """Create info from full snapshot."""
        return cls(
            id=snapshot.id,
            document_id=snapshot.document_id,
            version=snapshot.version,
            snapshot_type=snapshot.snapshot_type,
            trigger=snapshot.trigger,
            created_at=snapshot.created_at,
            size=snapshot.size,
        )


class DeltaEncoder:
    """Encodes and decodes document deltas.

    Uses a JSON-based delta format for reliable reconstruction.
    """

    @staticmethod
    def encode_delta(old_content: str, new_content: str) -> str:
        """Create a delta from old to new content.

        Uses a simple JSON format that stores:
        - The new content directly (for small deltas)
        - Or operation-based diff for visualization
        """
        # For simplicity and reliability, store both diff for display
        # and the new content for reconstruction
        diff = difflib.unified_diff(
            old_content.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            lineterm=""
        )

        delta_data = {
            "diff": "".join(diff),
            "new_content": new_content,
        }
        return json.dumps(delta_data)

    @staticmethod
    def apply_delta(base_content: str, delta: str) -> str:
        """Apply a delta to base content."""
        if not delta:
            return base_content

        try:
            # Try JSON format first
            delta_data = json.loads(delta)
            if "new_content" in delta_data:
                return delta_data["new_content"]
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback: return base content if delta can't be applied
        return base_content

    @staticmethod
    def calculate_change_ratio(old_content: str, new_content: str) -> float:
        """Calculate what percentage of content changed."""
        if not old_content:
            return 1.0

        matcher = difflib.SequenceMatcher(None, old_content, new_content)
        return 1.0 - matcher.ratio()


class SnapshotManager:
    """Manages document snapshots."""

    def __init__(
        self,
        storage: StorageBackend,
        config: Optional[SnapshotConfig] = None
    ):
        self.storage = storage
        self.config = config or SnapshotConfig()
        self._lock = asyncio.Lock()
        self._running = False
        self._auto_snapshot_task: Optional[asyncio.Task] = None

        # Track documents for auto-snapshot
        self._document_ops: dict[str, int] = {}  # document_id -> operation count
        self._document_last_snapshot: dict[str, datetime] = {}

        # Snapshot index (document_id -> list of snapshot IDs)
        self._snapshot_index: dict[str, list[str]] = {}

        # Callbacks
        self.on_snapshot_created: Optional[
            Callable[[Snapshot], Awaitable[None]]
        ] = None

        # Stats
        self._snapshots_created = 0
        self._snapshots_restored = 0
        self._deltas_created = 0
        self._full_snapshots_created = 0

    async def start(self) -> None:
        """Start snapshot manager."""
        if self._running:
            return

        self._running = True

        # Load existing snapshot index
        await self._load_index()

        if self.config.auto_snapshot_enabled:
            self._auto_snapshot_task = asyncio.create_task(
                self._auto_snapshot_loop()
            )

    async def stop(self) -> None:
        """Stop snapshot manager."""
        self._running = False

        if self._auto_snapshot_task:
            self._auto_snapshot_task.cancel()
            try:
                await self._auto_snapshot_task
            except asyncio.CancelledError:
                pass

    async def _load_index(self) -> None:
        """Load snapshot index from storage."""
        try:
            doc = await self.storage.load("__snapshot_index__")
            self._snapshot_index = json.loads(doc.content)
        except DocumentNotFoundError:
            self._snapshot_index = {}
        except Exception as e:
            logger.warning(f"Failed to load snapshot index: {e}")
            self._snapshot_index = {}

    async def _save_index(self) -> None:
        """Save snapshot index to storage."""
        try:
            content = json.dumps(self._snapshot_index)
            await self.storage.save("__snapshot_index__", content, 0)
        except Exception as e:
            logger.error(f"Failed to save snapshot index: {e}")

    async def _auto_snapshot_loop(self) -> None:
        """Background task for automatic snapshots."""
        while self._running:
            try:
                await asyncio.sleep(self.config.auto_snapshot_interval)
                await self._check_auto_snapshots()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Auto-snapshot error: {e}")

    async def _check_auto_snapshots(self) -> None:
        """Check which documents need auto-snapshots."""
        now = datetime.utcnow()

        for doc_id, last_snapshot in list(self._document_last_snapshot.items()):
            elapsed = (now - last_snapshot).total_seconds()

            if elapsed >= self.config.auto_snapshot_interval:
                # Time-based trigger
                ops = self._document_ops.get(doc_id, 0)
                if ops > 0:
                    # Document has changes, would need to get content
                    # In practice, this would integrate with OT server
                    pass

    async def create_snapshot(
        self,
        document_id: str,
        content: str,
        version: int,
        trigger: SnapshotTrigger = SnapshotTrigger.USER_REQUEST,
        metadata: Optional[dict] = None
    ) -> Snapshot:
        """Create a snapshot of a document."""
        import hashlib

        async with self._lock:
            # Determine snapshot type
            snapshot_type = SnapshotType.FULL
            delta = None
            base_snapshot_id = None

            # Check if we can use delta encoding
            if self.config.delta_enabled:
                latest = await self._get_latest_full_snapshot(document_id)
                if latest and latest.content:
                    change_ratio = DeltaEncoder.calculate_change_ratio(
                        latest.content, content
                    )

                    if change_ratio < self.config.delta_threshold:
                        # Use delta encoding
                        snapshot_type = SnapshotType.DELTA
                        delta = DeltaEncoder.encode_delta(latest.content, content)
                        base_snapshot_id = latest.id
                        self._deltas_created += 1
                    else:
                        self._full_snapshots_created += 1
                else:
                    self._full_snapshots_created += 1
            else:
                self._full_snapshots_created += 1

            # Create snapshot
            snapshot_id = f"snap_{document_id}_{version}_{uuid.uuid4().hex[:8]}"
            now = datetime.utcnow()

            # Calculate size and checksum
            snapshot_content = content if snapshot_type == SnapshotType.FULL else None
            size = len(content.encode("utf-8")) if content else 0
            checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()

            snapshot = Snapshot(
                id=snapshot_id,
                document_id=document_id,
                version=version,
                snapshot_type=snapshot_type,
                trigger=trigger,
                content=snapshot_content,
                delta=delta,
                base_snapshot_id=base_snapshot_id,
                created_at=now,
                size=size,
                checksum=checksum,
                metadata=metadata or {},
            )

            # Store snapshot
            storage_key = f"snapshot:{snapshot_id}"
            await self.storage.save(
                storage_key,
                json.dumps(snapshot.to_dict()),
                version
            )

            # Update index
            if document_id not in self._snapshot_index:
                self._snapshot_index[document_id] = []
            self._snapshot_index[document_id].append(snapshot_id)

            # Enforce retention
            await self._enforce_retention(document_id)

            # Save index
            await self._save_index()

            # Update tracking
            self._document_last_snapshot[document_id] = now
            self._document_ops[document_id] = 0
            self._snapshots_created += 1

            # Callback
            if self.on_snapshot_created:
                try:
                    await self.on_snapshot_created(snapshot)
                except Exception as e:
                    logger.error(f"Snapshot callback error: {e}")

            return snapshot

    async def _get_latest_full_snapshot(
        self,
        document_id: str
    ) -> Optional[Snapshot]:
        """Get the most recent full snapshot for a document."""
        snapshot_ids = self._snapshot_index.get(document_id, [])

        for snapshot_id in reversed(snapshot_ids):
            try:
                snapshot = await self.get_snapshot(snapshot_id)
                if snapshot.snapshot_type == SnapshotType.FULL:
                    return snapshot
            except Exception:
                continue

        return None

    async def get_snapshot(self, snapshot_id: str) -> Snapshot:
        """Get a snapshot by ID."""
        storage_key = f"snapshot:{snapshot_id}"
        doc = await self.storage.load(storage_key)
        return Snapshot.from_dict(json.loads(doc.content))

    async def restore_snapshot(self, snapshot_id: str) -> str:
        """Restore document content from a snapshot."""
        snapshot = await self.get_snapshot(snapshot_id)
        self._snapshots_restored += 1

        if snapshot.content is not None:
            return snapshot.content

        # Delta snapshot - need to reconstruct
        if snapshot.delta and snapshot.base_snapshot_id:
            base_content = await self.restore_snapshot(snapshot.base_snapshot_id)
            return DeltaEncoder.apply_delta(base_content, snapshot.delta)

        raise ValueError(f"Cannot restore snapshot {snapshot_id}: no content or delta")

    async def list_snapshots(
        self,
        document_id: str,
        limit: int = 50
    ) -> list[SnapshotInfo]:
        """List snapshots for a document."""
        snapshot_ids = self._snapshot_index.get(document_id, [])
        results = []

        for snapshot_id in reversed(snapshot_ids[-limit:]):
            try:
                snapshot = await self.get_snapshot(snapshot_id)
                results.append(SnapshotInfo.from_snapshot(snapshot))
            except Exception as e:
                logger.warning(f"Failed to load snapshot {snapshot_id}: {e}")

        return results

    async def delete_snapshot(self, snapshot_id: str) -> bool:
        """Delete a snapshot."""
        storage_key = f"snapshot:{snapshot_id}"

        try:
            snapshot = await self.get_snapshot(snapshot_id)
            document_id = snapshot.document_id

            # Remove from storage
            await self.storage.delete(storage_key)

            # Remove from index
            if document_id in self._snapshot_index:
                if snapshot_id in self._snapshot_index[document_id]:
                    self._snapshot_index[document_id].remove(snapshot_id)
                await self._save_index()

            return True
        except DocumentNotFoundError:
            return False

    async def _enforce_retention(self, document_id: str) -> None:
        """Enforce snapshot retention policy."""
        snapshot_ids = self._snapshot_index.get(document_id, [])

        if len(snapshot_ids) <= self.config.max_snapshots_per_document:
            return

        # Load snapshot info
        snapshots: list[tuple[str, Snapshot]] = []
        for sid in snapshot_ids:
            try:
                snap = await self.get_snapshot(sid)
                snapshots.append((sid, snap))
            except Exception:
                continue

        # Sort by creation time
        snapshots.sort(key=lambda x: x[1].created_at, reverse=True)

        # Determine which to keep
        keep = set()
        now = datetime.utcnow()

        # Always keep the most recent
        if snapshots:
            keep.add(snapshots[0][0])

        # Keep hourly snapshots
        hourly_kept = 0
        last_hour = None
        for sid, snap in snapshots:
            snap_hour = snap.created_at.replace(minute=0, second=0, microsecond=0)
            if snap_hour != last_hour:
                if hourly_kept < self.config.keep_hourly:
                    keep.add(sid)
                    hourly_kept += 1
                    last_hour = snap_hour

        # Keep daily snapshots
        daily_kept = 0
        last_day = None
        for sid, snap in snapshots:
            snap_day = snap.created_at.date()
            if snap_day != last_day:
                if daily_kept < self.config.keep_daily:
                    keep.add(sid)
                    daily_kept += 1
                    last_day = snap_day

        # Keep snapshots within max age
        cutoff = now - self.config.max_snapshot_age
        for sid, snap in snapshots:
            if snap.created_at >= cutoff:
                keep.add(sid)

        # Keep full snapshots that deltas depend on
        for sid, snap in snapshots:
            if snap.base_snapshot_id and snap.base_snapshot_id in [s[0] for s in snapshots]:
                keep.add(snap.base_snapshot_id)

        # Delete excess snapshots
        for sid, snap in snapshots:
            if sid not in keep:
                if len(keep) >= self.config.max_snapshots_per_document:
                    try:
                        await self.delete_snapshot(sid)
                    except Exception as e:
                        logger.warning(f"Failed to delete snapshot {sid}: {e}")

    async def get_snapshot_at_version(
        self,
        document_id: str,
        version: int
    ) -> Optional[Snapshot]:
        """Get snapshot closest to a specific version."""
        snapshot_ids = self._snapshot_index.get(document_id, [])

        best = None
        best_diff = float("inf")

        for snapshot_id in snapshot_ids:
            try:
                snapshot = await self.get_snapshot(snapshot_id)
                diff = abs(snapshot.version - version)

                if diff < best_diff and snapshot.version <= version:
                    best = snapshot
                    best_diff = diff
            except Exception:
                continue

        return best

    async def rollback_to_version(
        self,
        document_id: str,
        version: int
    ) -> Optional[str]:
        """Rollback document to a specific version."""
        snapshot = await self.get_snapshot_at_version(document_id, version)

        if snapshot:
            return await self.restore_snapshot(snapshot.id)

        return None

    def record_operation(self, document_id: str) -> None:
        """Record that an operation was applied to a document."""
        self._document_ops[document_id] = self._document_ops.get(document_id, 0) + 1

        # Check if we should trigger a snapshot
        if self._document_ops[document_id] >= self.config.operations_per_snapshot:
            # In practice, would need to get current content and create snapshot
            pass

    def get_stats(self) -> dict:
        """Get snapshot manager statistics."""
        return {
            "snapshots_created": self._snapshots_created,
            "snapshots_restored": self._snapshots_restored,
            "deltas_created": self._deltas_created,
            "full_snapshots_created": self._full_snapshots_created,
            "tracked_documents": len(self._document_ops),
            "indexed_documents": len(self._snapshot_index),
            "total_snapshots": sum(
                len(sids) for sids in self._snapshot_index.values()
            ),
            "running": self._running,
        }


class DocumentHistory:
    """Provides document history and time-travel capabilities."""

    def __init__(self, snapshot_manager: SnapshotManager):
        self.snapshot_manager = snapshot_manager
        self._cache: dict[str, str] = {}  # snapshot_id -> content
        self._cache_max_size = 100

    async def get_history(
        self,
        document_id: str,
        limit: int = 50
    ) -> list[SnapshotInfo]:
        """Get document history."""
        return await self.snapshot_manager.list_snapshots(document_id, limit)

    async def get_content_at_time(
        self,
        document_id: str,
        timestamp: datetime
    ) -> Optional[str]:
        """Get document content at a specific time."""
        snapshots = await self.snapshot_manager.list_snapshots(document_id, 1000)

        # Find snapshot closest to but not after timestamp
        best = None
        for info in snapshots:
            if info.created_at <= timestamp:
                if best is None or info.created_at > best.created_at:
                    best = info

        if best:
            # Check cache
            if best.id in self._cache:
                return self._cache[best.id]

            # Restore and cache
            content = await self.snapshot_manager.restore_snapshot(best.id)
            self._cache_content(best.id, content)
            return content

        return None

    async def get_content_at_version(
        self,
        document_id: str,
        version: int
    ) -> Optional[str]:
        """Get document content at a specific version."""
        return await self.snapshot_manager.rollback_to_version(document_id, version)

    def _cache_content(self, snapshot_id: str, content: str) -> None:
        """Cache snapshot content."""
        if len(self._cache) >= self._cache_max_size:
            # Remove oldest entry
            oldest = next(iter(self._cache))
            del self._cache[oldest]

        self._cache[snapshot_id] = content

    async def compare_versions(
        self,
        document_id: str,
        version1: int,
        version2: int
    ) -> Optional[str]:
        """Get diff between two versions."""
        content1 = await self.get_content_at_version(document_id, version1)
        content2 = await self.get_content_at_version(document_id, version2)

        if content1 is None or content2 is None:
            return None

        return DeltaEncoder.encode_delta(content1, content2)


# Factory function
def create_snapshot_manager(
    storage: Optional[StorageBackend] = None,
    config: Optional[SnapshotConfig] = None
) -> SnapshotManager:
    """Create a snapshot manager with defaults."""
    if storage is None:
        storage = InMemoryStorage()

    return SnapshotManager(storage, config)
