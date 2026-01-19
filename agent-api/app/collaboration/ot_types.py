"""
OT Types and Data Structures

Core data structures for Operational Transformation:
- Operation: Single INSERT, DELETE, or RETAIN operation
- OperationBatch: Atomic unit of change with version tracking
- Document: Content with version and history
- Cursor: User cursor position with selection support
"""

from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class OperationType(str, Enum):
    """Types of OT operations."""
    INSERT = "insert"   # Insert characters at position
    DELETE = "delete"   # Delete characters at position
    RETAIN = "retain"   # Skip/retain characters (no-op, used for composition)


@dataclass
class Operation:
    """
    Single OT operation.

    An operation is one of:
      - INSERT: Insert `text` at `position`
      - DELETE: Delete `count` characters starting at `position`
      - RETAIN: Skip `count` characters (used in composed operations)

    Invariants:
      - position >= 0
      - For INSERT: text is non-empty string
      - For DELETE: count > 0
      - For RETAIN: count > 0
    """

    type: OperationType
    position: int

    # For INSERT
    text: Optional[str] = None

    # For DELETE and RETAIN
    count: Optional[int] = None

    def __post_init__(self):
        """Validate operation invariants."""
        if self.position < 0:
            raise ValueError(f"Position must be >= 0, got {self.position}")

        if self.type == OperationType.INSERT:
            if not self.text:
                raise ValueError("INSERT operation requires non-empty text")
        elif self.type == OperationType.DELETE:
            if not self.count or self.count <= 0:
                raise ValueError("DELETE operation requires count > 0")
        elif self.type == OperationType.RETAIN:
            if not self.count or self.count <= 0:
                raise ValueError("RETAIN operation requires count > 0")

    @property
    def length(self) -> int:
        """Length of this operation's effect on document."""
        if self.type == OperationType.INSERT:
            return len(self.text)
        elif self.type == OperationType.DELETE:
            return -self.count  # Negative because it removes characters
        else:  # RETAIN
            return 0

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        d = {
            "type": self.type.value,
            "position": self.position
        }
        if self.text is not None:
            d["text"] = self.text
        if self.count is not None:
            d["count"] = self.count
        return d

    @classmethod
    def from_dict(cls, d: dict) -> Operation:
        """Deserialize from dictionary."""
        return cls(
            type=OperationType(d["type"]),
            position=d["position"],
            text=d.get("text"),
            count=d.get("count")
        )


@dataclass
class OperationBatch:
    """
    A batch of operations from a single user action.

    A batch represents an atomic unit of change that should be
    applied together. For example, a paste operation might contain
    multiple INSERT operations.

    Invariants:
      - Operations are ordered by position (ascending)
      - Operations do not overlap
      - version is the document version this batch was created against
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    document_id: str = ""
    version: int = 0  # Document version this batch was created against
    operations: list[Operation] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)

    # Metadata
    source: str = "user"  # "user", "undo", "redo", "server"
    cursor_before: Optional[int] = None
    cursor_after: Optional[int] = None
    selection_before: Optional[tuple[int, int]] = None
    selection_after: Optional[tuple[int, int]] = None

    def __post_init__(self):
        """Validate batch invariants."""
        self._validate_operations()

    def _validate_operations(self):
        """Ensure operations are valid and non-overlapping."""
        if not self.operations:
            return

        # Sort by position
        self.operations.sort(key=lambda op: op.position)

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "document_id": self.document_id,
            "version": self.version,
            "operations": [op.to_dict() for op in self.operations],
            "timestamp": self.timestamp,
            "source": self.source,
            "cursor_before": self.cursor_before,
            "cursor_after": self.cursor_after,
            "selection_before": self.selection_before,
            "selection_after": self.selection_after
        }

    @classmethod
    def from_dict(cls, d: dict) -> OperationBatch:
        """Deserialize from dictionary."""
        return cls(
            id=d["id"],
            user_id=d["user_id"],
            document_id=d["document_id"],
            version=d["version"],
            operations=[Operation.from_dict(op) for op in d["operations"]],
            timestamp=d["timestamp"],
            source=d.get("source", "user"),
            cursor_before=d.get("cursor_before"),
            cursor_after=d.get("cursor_after"),
            selection_before=tuple(d["selection_before"]) if d.get("selection_before") else None,
            selection_after=tuple(d["selection_after"]) if d.get("selection_after") else None
        )


@dataclass
class Document:
    """
    Document state with version tracking.

    The document maintains:
      - Current content as a string
      - Version number (incremented on each change)
      - History of applied operation batches

    Invariants:
      - version >= 0
      - version == len(history)
      - Applying history[0:n] to empty string yields content at version n
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    version: int = 0
    history: list[OperationBatch] = field(default_factory=list)

    # Checkpoints for efficient history replay
    checkpoints: dict[int, str] = field(default_factory=dict)  # version -> content
    checkpoint_interval: int = 100

    def apply_batch(self, batch: OperationBatch) -> str:
        """
        Apply an operation batch to the document.

        Returns:
            The new document content

        Raises:
            ValueError: If batch version doesn't match document version
        """
        if batch.version != self.version:
            raise ValueError(
                f"Version mismatch: batch version {batch.version} != "
                f"document version {self.version}"
            )

        # Apply operations in reverse order to maintain positions
        new_content = self.content
        for op in reversed(batch.operations):
            new_content = self._apply_operation(new_content, op)

        # Update state
        self.content = new_content
        self.version += 1
        self.history.append(batch)

        # Create checkpoint if needed
        if self.version % self.checkpoint_interval == 0:
            self.checkpoints[self.version] = self.content

        return self.content

    def _apply_operation(self, content: str, op: Operation) -> str:
        """Apply a single operation to content."""
        if op.type == OperationType.INSERT:
            return content[:op.position] + op.text + content[op.position:]
        elif op.type == OperationType.DELETE:
            return content[:op.position] + content[op.position + op.count:]
        else:  # RETAIN
            return content  # No change

    def get_content_at_version(self, version: int) -> str:
        """Get document content at a specific version."""
        if version < 0 or version > self.version:
            raise ValueError(f"Invalid version: {version}")

        if version == self.version:
            return self.content

        # Find nearest checkpoint
        checkpoint_version = 0
        checkpoint_content = ""
        for v in sorted(self.checkpoints.keys()):
            if v <= version:
                checkpoint_version = v
                checkpoint_content = self.checkpoints[v]
            else:
                break

        # Replay from checkpoint
        content = checkpoint_content
        for batch in self.history[checkpoint_version:version]:
            for op in reversed(batch.operations):
                content = self._apply_operation(content, op)

        return content

    def compute_hash(self) -> str:
        """Compute content hash for verification."""
        return hashlib.sha256(self.content.encode()).hexdigest()[:16]


@dataclass
class Cursor:
    """
    User cursor position.

    Tracks a user's cursor position in the document.
    Cursors are transformed along with operations.
    """

    user_id: str
    position: int

    # Selection (if any)
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None

    @property
    def has_selection(self) -> bool:
        """Whether cursor has a selection."""
        return self.selection_start is not None and self.selection_end is not None

    @property
    def selection_length(self) -> int:
        """Length of selection."""
        if not self.has_selection:
            return 0
        return abs(self.selection_end - self.selection_start)

    def to_dict(self) -> dict:
        """Serialize to dictionary."""
        return {
            "user_id": self.user_id,
            "position": self.position,
            "selection_start": self.selection_start,
            "selection_end": self.selection_end
        }

    @classmethod
    def from_dict(cls, d: dict) -> Cursor:
        """Deserialize from dictionary."""
        return cls(
            user_id=d["user_id"],
            position=d["position"],
            selection_start=d.get("selection_start"),
            selection_end=d.get("selection_end")
        )


@dataclass
class CursorTransformResult:
    """Result of transforming a cursor against an operation."""
    new_position: int
    new_selection_start: Optional[int]
    new_selection_end: Optional[int]


# =============================================================================
# Factory Functions
# =============================================================================

def create_insert(position: int, text: str) -> Operation:
    """
    Create an INSERT operation.

    INSERT inserts `text` at `position`.

    Example:
        Document: "Hello World"
        Operation: INSERT(position=5, text=" Beautiful")
        Result: "Hello Beautiful World"
    """
    if not text:
        raise ValueError("Cannot create INSERT with empty text")

    return Operation(
        type=OperationType.INSERT,
        position=position,
        text=text
    )


def create_delete(position: int, count: int) -> Operation:
    """
    Create a DELETE operation.

    DELETE removes `count` characters starting at `position`.

    Example:
        Document: "Hello Beautiful World"
        Operation: DELETE(position=5, count=10)
        Result: "Hello World"
    """
    if count <= 0:
        raise ValueError("Cannot create DELETE with count <= 0")

    return Operation(
        type=OperationType.DELETE,
        position=position,
        count=count
    )


def create_retain(count: int) -> Operation:
    """
    Create a RETAIN operation.

    RETAIN is used in composed operations to skip characters.
    It doesn't modify the document but is needed for composition.
    """
    if count <= 0:
        raise ValueError("Cannot create RETAIN with count <= 0")

    return Operation(
        type=OperationType.RETAIN,
        position=0,  # Position is implicit in composed operations
        count=count
    )


# =============================================================================
# Position Effect Functions
# =============================================================================

def insert_effect_on_position(op: Operation, pos: int, bias: str = "right") -> int:
    """
    Calculate how an INSERT affects a position.

    Args:
        op: INSERT operation
        pos: Position to transform
        bias: "left" or "right" - where cursor goes if at insert point

    Returns:
        New position after INSERT

    Rules:
        - If pos < insert_pos: no change
        - If pos > insert_pos: shift right by insert length
        - If pos == insert_pos: depends on bias
          - "right" bias: shift right (cursor after inserted text)
          - "left" bias: no change (cursor before inserted text)
    """
    insert_pos = op.position
    insert_len = len(op.text)

    if pos < insert_pos:
        return pos
    elif pos > insert_pos:
        return pos + insert_len
    else:  # pos == insert_pos
        if bias == "right":
            return pos + insert_len
        else:
            return pos


def delete_effect_on_position(op: Operation, pos: int) -> int:
    """
    Calculate how a DELETE affects a position.

    Args:
        op: DELETE operation
        pos: Position to transform

    Returns:
        New position after DELETE

    Rules:
        - If pos < delete_start: no change
        - If pos >= delete_end: shift left by delete count
        - If delete_start <= pos < delete_end: collapse to delete_start
    """
    delete_start = op.position
    delete_end = op.position + op.count

    if pos < delete_start:
        return pos
    elif pos >= delete_end:
        return pos - op.count
    else:  # delete_start <= pos < delete_end
        return delete_start  # Position was in deleted range
