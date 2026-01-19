"""
Conflict Detection and Resolution for Collaboration

Provides:
- Conflict detection for concurrent operations
- Multiple resolution strategies (last-writer-wins, merge, manual)
- Conflict history tracking
- Automatic and manual conflict resolution
- Conflict notifications

Integrates with OT engine for enhanced conflict handling.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Optional, Any, Callable, Awaitable, List, Dict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from abc import ABC, abstractmethod

import logging

logger = logging.getLogger(__name__)


class ConflictType(Enum):
    """Types of conflicts."""
    CONCURRENT_EDIT = "concurrent_edit"
    VERSION_MISMATCH = "version_mismatch"
    DELETE_UPDATE = "delete_update"
    STRUCTURE_CHANGE = "structure_change"
    PERMISSION_CHANGE = "permission_change"
    LOCK_VIOLATION = "lock_violation"


class ConflictSeverity(Enum):
    """Conflict severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ResolutionStrategy(Enum):
    """Conflict resolution strategies."""
    LAST_WRITER_WINS = "last_writer_wins"
    FIRST_WRITER_WINS = "first_writer_wins"
    MERGE = "merge"
    MANUAL = "manual"
    REJECT = "reject"
    CUSTOM = "custom"


class ConflictState(Enum):
    """Conflict states."""
    DETECTED = "detected"
    RESOLVING = "resolving"
    RESOLVED = "resolved"
    FAILED = "failed"


@dataclass
class ConflictConfig:
    """Conflict handling configuration."""
    default_strategy: ResolutionStrategy = ResolutionStrategy.LAST_WRITER_WINS
    auto_resolve_timeout: float = 30.0
    max_conflicts_per_document: int = 100
    conflict_history_ttl: timedelta = timedelta(hours=24)
    enable_notifications: bool = True
    merge_timeout: float = 5.0


@dataclass
class ConflictingOperation:
    """An operation involved in a conflict."""
    id: str
    user_id: str
    client_id: str
    operation: dict
    version: int
    timestamp: datetime
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "operation": self.operation,
            "version": self.version,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ConflictingOperation":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            user_id=data["user_id"],
            client_id=data["client_id"],
            operation=data["operation"],
            version=data["version"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata", {}),
        )


@dataclass
class Conflict:
    """A detected conflict."""
    id: str
    document_id: str
    conflict_type: ConflictType
    severity: ConflictSeverity
    state: ConflictState
    operations: List[ConflictingOperation]
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_strategy: Optional[ResolutionStrategy] = None
    resolution_result: Optional[dict] = None
    resolver_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "conflict_type": self.conflict_type.value,
            "severity": self.severity.value,
            "state": self.state.value,
            "operations": [op.to_dict() for op in self.operations],
            "detected_at": self.detected_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_strategy": self.resolution_strategy.value if self.resolution_strategy else None,
            "resolution_result": self.resolution_result,
            "resolver_id": self.resolver_id,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Conflict":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            conflict_type=ConflictType(data["conflict_type"]),
            severity=ConflictSeverity(data["severity"]),
            state=ConflictState(data["state"]),
            operations=[ConflictingOperation.from_dict(op) for op in data["operations"]],
            detected_at=datetime.fromisoformat(data["detected_at"]),
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None,
            resolution_strategy=ResolutionStrategy(data["resolution_strategy"]) if data.get("resolution_strategy") else None,
            resolution_result=data.get("resolution_result"),
            resolver_id=data.get("resolver_id"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class ResolutionResult:
    """Result of conflict resolution."""
    success: bool
    conflict_id: str
    strategy_used: ResolutionStrategy
    winning_operation: Optional[ConflictingOperation] = None
    merged_operation: Optional[dict] = None
    message: str = ""
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "conflict_id": self.conflict_id,
            "strategy_used": self.strategy_used.value,
            "winning_operation": self.winning_operation.to_dict() if self.winning_operation else None,
            "merged_operation": self.merged_operation,
            "message": self.message,
            "metadata": self.metadata,
        }


class ResolutionHandler(ABC):
    """Abstract base for resolution handlers."""

    @abstractmethod
    async def resolve(
        self,
        conflict: Conflict,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve a conflict."""
        pass


class LastWriterWinsHandler(ResolutionHandler):
    """Resolution handler that picks the latest operation."""

    async def resolve(
        self,
        conflict: Conflict,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve by selecting the latest operation."""
        if not conflict.operations:
            return ResolutionResult(
                success=False,
                conflict_id=conflict.id,
                strategy_used=ResolutionStrategy.LAST_WRITER_WINS,
                message="No operations to resolve",
            )

        # Find operation with latest timestamp
        winner = max(conflict.operations, key=lambda op: op.timestamp)

        return ResolutionResult(
            success=True,
            conflict_id=conflict.id,
            strategy_used=ResolutionStrategy.LAST_WRITER_WINS,
            winning_operation=winner,
            message=f"Selected operation from user {winner.user_id}",
        )


class FirstWriterWinsHandler(ResolutionHandler):
    """Resolution handler that picks the earliest operation."""

    async def resolve(
        self,
        conflict: Conflict,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve by selecting the earliest operation."""
        if not conflict.operations:
            return ResolutionResult(
                success=False,
                conflict_id=conflict.id,
                strategy_used=ResolutionStrategy.FIRST_WRITER_WINS,
                message="No operations to resolve",
            )

        # Find operation with earliest timestamp
        winner = min(conflict.operations, key=lambda op: op.timestamp)

        return ResolutionResult(
            success=True,
            conflict_id=conflict.id,
            strategy_used=ResolutionStrategy.FIRST_WRITER_WINS,
            winning_operation=winner,
            message=f"Selected operation from user {winner.user_id}",
        )


class MergeHandler(ResolutionHandler):
    """Resolution handler that attempts to merge operations."""

    def __init__(self, merge_fn: Optional[Callable[[List[dict]], dict]] = None):
        self.merge_fn = merge_fn or self._default_merge

    def _default_merge(self, operations: List[dict]) -> dict:
        """Default merge strategy - combine non-overlapping changes."""
        if not operations:
            return {}

        # Simple merge: take all operations and combine
        merged = {
            "type": "batch",
            "operations": operations,
            "merged": True,
        }
        return merged

    async def resolve(
        self,
        conflict: Conflict,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve by merging operations."""
        if not conflict.operations:
            return ResolutionResult(
                success=False,
                conflict_id=conflict.id,
                strategy_used=ResolutionStrategy.MERGE,
                message="No operations to merge",
            )

        try:
            operations = [op.operation for op in conflict.operations]
            merged = self.merge_fn(operations)

            return ResolutionResult(
                success=True,
                conflict_id=conflict.id,
                strategy_used=ResolutionStrategy.MERGE,
                merged_operation=merged,
                message=f"Merged {len(operations)} operations",
            )
        except Exception as e:
            return ResolutionResult(
                success=False,
                conflict_id=conflict.id,
                strategy_used=ResolutionStrategy.MERGE,
                message=f"Merge failed: {str(e)}",
            )


class RejectHandler(ResolutionHandler):
    """Resolution handler that rejects all conflicting operations."""

    async def resolve(
        self,
        conflict: Conflict,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve by rejecting all operations."""
        return ResolutionResult(
            success=True,
            conflict_id=conflict.id,
            strategy_used=ResolutionStrategy.REJECT,
            message=f"Rejected {len(conflict.operations)} conflicting operations",
            metadata={"rejected_count": len(conflict.operations)},
        )


class ConflictDetector:
    """Detects conflicts between operations."""

    def __init__(self, config: Optional[ConflictConfig] = None):
        self.config = config or ConflictConfig()

    def detect_concurrent_edit(
        self,
        op1: ConflictingOperation,
        op2: ConflictingOperation,
        threshold_ms: float = 1000
    ) -> Optional[Conflict]:
        """Detect concurrent edit conflict."""
        time_diff = abs((op1.timestamp - op2.timestamp).total_seconds() * 1000)

        if time_diff <= threshold_ms and op1.version == op2.version:
            # Check if operations overlap
            if self._operations_overlap(op1.operation, op2.operation):
                return self._create_conflict(
                    document_id=op1.operation.get("document_id", "unknown"),
                    conflict_type=ConflictType.CONCURRENT_EDIT,
                    operations=[op1, op2],
                    severity=ConflictSeverity.MEDIUM,
                )
        return None

    def detect_version_mismatch(
        self,
        operation: ConflictingOperation,
        expected_version: int,
        current_version: int
    ) -> Optional[Conflict]:
        """Detect version mismatch conflict."""
        if operation.version != expected_version:
            return self._create_conflict(
                document_id=operation.operation.get("document_id", "unknown"),
                conflict_type=ConflictType.VERSION_MISMATCH,
                operations=[operation],
                severity=ConflictSeverity.HIGH,
                metadata={
                    "expected_version": expected_version,
                    "actual_version": operation.version,
                    "current_version": current_version,
                },
            )
        return None

    def detect_delete_update(
        self,
        delete_op: ConflictingOperation,
        update_op: ConflictingOperation
    ) -> Optional[Conflict]:
        """Detect delete-update conflict."""
        # One operation deletes content another is modifying
        delete_type = delete_op.operation.get("type")
        update_type = update_op.operation.get("type")

        if delete_type == "delete" and update_type in ("insert", "replace", "retain"):
            delete_range = self._get_range(delete_op.operation)
            update_range = self._get_range(update_op.operation)

            if self._ranges_overlap(delete_range, update_range):
                return self._create_conflict(
                    document_id=delete_op.operation.get("document_id", "unknown"),
                    conflict_type=ConflictType.DELETE_UPDATE,
                    operations=[delete_op, update_op],
                    severity=ConflictSeverity.HIGH,
                )
        return None

    def _operations_overlap(self, op1: dict, op2: dict) -> bool:
        """Check if two operations affect overlapping regions."""
        range1 = self._get_range(op1)
        range2 = self._get_range(op2)
        return self._ranges_overlap(range1, range2)

    def _get_range(self, operation: dict) -> tuple:
        """Get the affected range of an operation."""
        pos = operation.get("position", operation.get("pos", 0))
        length = operation.get("length", operation.get("count", len(operation.get("text", ""))))
        return (pos, pos + length)

    def _ranges_overlap(self, range1: tuple, range2: tuple) -> bool:
        """Check if two ranges overlap."""
        return range1[0] < range2[1] and range2[0] < range1[1]

    def _create_conflict(
        self,
        document_id: str,
        conflict_type: ConflictType,
        operations: List[ConflictingOperation],
        severity: ConflictSeverity,
        metadata: Optional[dict] = None
    ) -> Conflict:
        """Create a new conflict."""
        conflict_id = self._generate_conflict_id(document_id, operations)

        return Conflict(
            id=conflict_id,
            document_id=document_id,
            conflict_type=conflict_type,
            severity=severity,
            state=ConflictState.DETECTED,
            operations=operations,
            detected_at=datetime.utcnow(),
            metadata=metadata or {},
        )

    def _generate_conflict_id(
        self,
        document_id: str,
        operations: List[ConflictingOperation]
    ) -> str:
        """Generate a unique conflict ID."""
        content = f"{document_id}:{':'.join(op.id for op in operations)}"
        hash_val = hashlib.sha256(content.encode()).hexdigest()[:12]
        return f"conflict_{hash_val}"


class ConflictManager:
    """Manages conflict detection and resolution."""

    def __init__(self, config: Optional[ConflictConfig] = None):
        self.config = config or ConflictConfig()
        self._conflicts: Dict[str, Conflict] = {}
        self._document_conflicts: Dict[str, List[str]] = {}  # doc_id -> conflict_ids
        self._handlers: Dict[ResolutionStrategy, ResolutionHandler] = {
            ResolutionStrategy.LAST_WRITER_WINS: LastWriterWinsHandler(),
            ResolutionStrategy.FIRST_WRITER_WINS: FirstWriterWinsHandler(),
            ResolutionStrategy.MERGE: MergeHandler(),
            ResolutionStrategy.REJECT: RejectHandler(),
        }
        self._detector = ConflictDetector(config)
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_conflict_detected: Optional[
            Callable[[Conflict], Awaitable[None]]
        ] = None
        self.on_conflict_resolved: Optional[
            Callable[[Conflict, ResolutionResult], Awaitable[None]]
        ] = None

        # Stats
        self._conflicts_detected = 0
        self._conflicts_resolved = 0
        self._conflicts_failed = 0

    def register_handler(
        self,
        strategy: ResolutionStrategy,
        handler: ResolutionHandler
    ) -> None:
        """Register a custom resolution handler."""
        self._handlers[strategy] = handler

    async def detect_and_record(
        self,
        op1: ConflictingOperation,
        op2: ConflictingOperation
    ) -> Optional[Conflict]:
        """Detect conflict and record it if found."""
        conflict = self._detector.detect_concurrent_edit(op1, op2)

        if conflict:
            await self._record_conflict(conflict)

        return conflict

    async def record_conflict(self, conflict: Conflict) -> None:
        """Record a detected conflict."""
        await self._record_conflict(conflict)

    async def _record_conflict(self, conflict: Conflict) -> None:
        """Internal method to record a conflict."""
        async with self._lock:
            # Check document conflict limit
            doc_conflicts = self._document_conflicts.get(conflict.document_id, [])
            if len(doc_conflicts) >= self.config.max_conflicts_per_document:
                # Remove oldest conflict
                oldest_id = doc_conflicts[0]
                self._conflicts.pop(oldest_id, None)
                doc_conflicts.pop(0)

            self._conflicts[conflict.id] = conflict

            if conflict.document_id not in self._document_conflicts:
                self._document_conflicts[conflict.document_id] = []
            self._document_conflicts[conflict.document_id].append(conflict.id)

            self._conflicts_detected += 1

        if self.on_conflict_detected:
            try:
                await self.on_conflict_detected(conflict)
            except Exception as e:
                logger.error(f"Conflict detected callback error: {e}")

    def get_conflict(self, conflict_id: str) -> Optional[Conflict]:
        """Get a conflict by ID."""
        return self._conflicts.get(conflict_id)

    def get_document_conflicts(
        self,
        document_id: str,
        state: Optional[ConflictState] = None
    ) -> List[Conflict]:
        """Get all conflicts for a document."""
        conflict_ids = self._document_conflicts.get(document_id, [])
        conflicts = [
            self._conflicts[cid]
            for cid in conflict_ids
            if cid in self._conflicts
        ]

        if state:
            conflicts = [c for c in conflicts if c.state == state]

        return conflicts

    def get_unresolved_conflicts(self, document_id: str) -> List[Conflict]:
        """Get unresolved conflicts for a document."""
        return self.get_document_conflicts(
            document_id,
            state=ConflictState.DETECTED
        )

    async def resolve(
        self,
        conflict_id: str,
        strategy: Optional[ResolutionStrategy] = None,
        resolver_id: Optional[str] = None,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Resolve a conflict."""
        conflict = self._conflicts.get(conflict_id)
        if not conflict:
            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=strategy or self.config.default_strategy,
                message="Conflict not found",
            )

        if conflict.state == ConflictState.RESOLVED:
            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=strategy or self.config.default_strategy,
                message="Conflict already resolved",
            )

        strategy = strategy or self.config.default_strategy
        handler = self._handlers.get(strategy)

        if not handler:
            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=strategy,
                message=f"No handler for strategy: {strategy.value}",
            )

        async with self._lock:
            conflict.state = ConflictState.RESOLVING

        try:
            result = await asyncio.wait_for(
                handler.resolve(conflict, context),
                timeout=self.config.auto_resolve_timeout
            )

            async with self._lock:
                if result.success:
                    conflict.state = ConflictState.RESOLVED
                    conflict.resolved_at = datetime.utcnow()
                    conflict.resolution_strategy = strategy
                    conflict.resolution_result = result.to_dict()
                    conflict.resolver_id = resolver_id
                    self._conflicts_resolved += 1
                else:
                    conflict.state = ConflictState.FAILED
                    self._conflicts_failed += 1

            if self.on_conflict_resolved:
                try:
                    await self.on_conflict_resolved(conflict, result)
                except Exception as e:
                    logger.error(f"Conflict resolved callback error: {e}")

            return result

        except asyncio.TimeoutError:
            async with self._lock:
                conflict.state = ConflictState.FAILED
                self._conflicts_failed += 1

            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=strategy,
                message="Resolution timed out",
            )

    async def auto_resolve(
        self,
        conflict_id: str,
        context: Optional[dict] = None
    ) -> ResolutionResult:
        """Auto-resolve using default strategy."""
        return await self.resolve(
            conflict_id,
            strategy=self.config.default_strategy,
            resolver_id="system",
            context=context,
        )

    async def manual_resolve(
        self,
        conflict_id: str,
        winner_operation_id: str,
        resolver_id: str
    ) -> ResolutionResult:
        """Manually resolve by selecting winning operation."""
        conflict = self._conflicts.get(conflict_id)
        if not conflict:
            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=ResolutionStrategy.MANUAL,
                message="Conflict not found",
            )

        # Find the winning operation
        winner = None
        for op in conflict.operations:
            if op.id == winner_operation_id:
                winner = op
                break

        if not winner:
            return ResolutionResult(
                success=False,
                conflict_id=conflict_id,
                strategy_used=ResolutionStrategy.MANUAL,
                message="Winning operation not found",
            )

        async with self._lock:
            conflict.state = ConflictState.RESOLVED
            conflict.resolved_at = datetime.utcnow()
            conflict.resolution_strategy = ResolutionStrategy.MANUAL
            conflict.resolver_id = resolver_id
            self._conflicts_resolved += 1

        result = ResolutionResult(
            success=True,
            conflict_id=conflict_id,
            strategy_used=ResolutionStrategy.MANUAL,
            winning_operation=winner,
            message=f"Manually selected operation {winner_operation_id}",
        )

        conflict.resolution_result = result.to_dict()

        if self.on_conflict_resolved:
            try:
                await self.on_conflict_resolved(conflict, result)
            except Exception as e:
                logger.error(f"Conflict resolved callback error: {e}")

        return result

    async def cleanup_old_conflicts(self) -> int:
        """Clean up old resolved conflicts."""
        cutoff = datetime.utcnow() - self.config.conflict_history_ttl
        removed = 0

        async with self._lock:
            to_remove = []
            for conflict_id, conflict in self._conflicts.items():
                if conflict.state == ConflictState.RESOLVED:
                    if conflict.resolved_at and conflict.resolved_at < cutoff:
                        to_remove.append(conflict_id)

            for conflict_id in to_remove:
                conflict = self._conflicts.pop(conflict_id)
                doc_conflicts = self._document_conflicts.get(conflict.document_id, [])
                if conflict_id in doc_conflicts:
                    doc_conflicts.remove(conflict_id)
                removed += 1

        return removed

    def get_stats(self) -> dict:
        """Get conflict manager statistics."""
        active = sum(
            1 for c in self._conflicts.values()
            if c.state in (ConflictState.DETECTED, ConflictState.RESOLVING)
        )

        return {
            "total_conflicts": len(self._conflicts),
            "active_conflicts": active,
            "conflicts_detected": self._conflicts_detected,
            "conflicts_resolved": self._conflicts_resolved,
            "conflicts_failed": self._conflicts_failed,
            "documents_with_conflicts": len(self._document_conflicts),
            "resolution_rate": (
                self._conflicts_resolved / self._conflicts_detected
                if self._conflicts_detected > 0 else 0
            ),
        }


# Global conflict manager
_conflict_manager: Optional[ConflictManager] = None


def get_conflict_manager() -> ConflictManager:
    """Get global conflict manager."""
    global _conflict_manager
    if _conflict_manager is None:
        _conflict_manager = ConflictManager()
    return _conflict_manager


def set_conflict_manager(manager: ConflictManager) -> None:
    """Set global conflict manager."""
    global _conflict_manager
    _conflict_manager = manager


def reset_conflict_manager() -> None:
    """Reset global conflict manager."""
    global _conflict_manager
    _conflict_manager = None
