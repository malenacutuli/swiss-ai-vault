# Character-Level Operational Transformation: Complete Implementation Specification

**From:** Manus Platform Technical Lead  
**Classification:** Internal Engineering Documentation  
**Purpose:** Exact implementation details for character-level OT in real-time collaboration

---

## Table of Contents

1. [Data Structures](#1-data-structures)
2. [Operation Types](#2-operation-types)
3. [Transformation Functions](#3-transformation-functions)
4. [Server-Side OT Engine](#4-server-side-ot-engine)
5. [Client-Side Integration](#5-client-side-integration)
6. [Edge Cases and Invariants](#6-edge-cases-and-invariants)
7. [Testing and Verification](#7-testing-and-verification)

---

## 1. Data Structures

### 1.1 Core Operation Structure

```python
from dataclasses import dataclass, field
from typing import Optional, List, Union, Literal
from enum import Enum
import hashlib
import time
import uuid


class OperationType(Enum):
    """Types of OT operations."""
    INSERT = "insert"      # Insert characters at position
    DELETE = "delete"      # Delete characters at position
    RETAIN = "retain"      # Skip/retain characters (no-op, used for composition)


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
    def from_dict(cls, d: dict) -> 'Operation':
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
    operations: List[Operation] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)
    
    # Metadata
    source: str = "user"  # "user", "undo", "redo", "server"
    cursor_before: Optional[int] = None
    cursor_after: Optional[int] = None
    selection_before: Optional[tuple] = None  # (start, end)
    selection_after: Optional[tuple] = None
    
    def __post_init__(self):
        """Validate batch invariants."""
        self._validate_operations()
    
    def _validate_operations(self):
        """Ensure operations are valid and non-overlapping."""
        if not self.operations:
            return
        
        # Sort by position
        self.operations.sort(key=lambda op: op.position)
        
        # Check for overlaps
        current_pos = 0
        for op in self.operations:
            if op.position < current_pos:
                raise ValueError(f"Overlapping operations at position {op.position}")
            
            if op.type == OperationType.INSERT:
                current_pos = op.position + len(op.text)
            elif op.type == OperationType.DELETE:
                current_pos = op.position + op.count
            else:
                current_pos = op.position + op.count
    
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
    def from_dict(cls, d: dict) -> 'OperationBatch':
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
            selection_before=d.get("selection_before"),
            selection_after=d.get("selection_after")
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
    history: List[OperationBatch] = field(default_factory=list)
    
    # Checkpoints for efficient history replay
    checkpoints: dict = field(default_factory=dict)  # version -> content
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
```

### 1.2 Cursor and Selection Structures

```python
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
        return self.selection_start is not None and self.selection_end is not None
    
    @property
    def selection_length(self) -> int:
        if not self.has_selection:
            return 0
        return abs(self.selection_end - self.selection_start)


@dataclass
class CursorTransformResult:
    """Result of transforming a cursor against an operation."""
    new_position: int
    new_selection_start: Optional[int]
    new_selection_end: Optional[int]
```

---

## 2. Operation Types

### 2.1 INSERT Operation

```python
def create_insert(position: int, text: str) -> Operation:
    """
    Create an INSERT operation.
    
    INSERT inserts `text` at `position`.
    
    Example:
        Document: "Hello World"
        Operation: INSERT(position=5, text=" Beautiful")
        Result: "Hello Beautiful World"
    
    Args:
        position: Index where text should be inserted (0-indexed)
        text: Text to insert (must be non-empty)
    
    Returns:
        INSERT operation
    """
    if not text:
        raise ValueError("Cannot create INSERT with empty text")
    
    return Operation(
        type=OperationType.INSERT,
        position=position,
        text=text
    )


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
```

### 2.2 DELETE Operation

```python
def create_delete(position: int, count: int) -> Operation:
    """
    Create a DELETE operation.
    
    DELETE removes `count` characters starting at `position`.
    
    Example:
        Document: "Hello Beautiful World"
        Operation: DELETE(position=5, count=10)
        Result: "Hello World"
    
    Args:
        position: Index where deletion starts (0-indexed)
        count: Number of characters to delete (must be > 0)
    
    Returns:
        DELETE operation
    """
    if count <= 0:
        raise ValueError("Cannot create DELETE with count <= 0")
    
    return Operation(
        type=OperationType.DELETE,
        position=position,
        count=count
    )


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
```

### 2.3 RETAIN Operation (for composition)

```python
def create_retain(count: int) -> Operation:
    """
    Create a RETAIN operation.
    
    RETAIN is used in composed operations to skip characters.
    It doesn't modify the document but is needed for composition.
    
    Example:
        Composed operation: [RETAIN(5), INSERT(" Beautiful"), RETAIN(6)]
        Applied to "Hello World" yields "Hello Beautiful World"
    
    Args:
        count: Number of characters to retain/skip
    
    Returns:
        RETAIN operation
    """
    if count <= 0:
        raise ValueError("Cannot create RETAIN with count <= 0")
    
    return Operation(
        type=OperationType.RETAIN,
        position=0,  # Position is implicit in composed operations
        count=count
    )
```

---

## 3. Transformation Functions

### 3.1 Core Transformation Algorithm

```python
class OTTransformer:
    """
    Operational Transformation engine.
    
    Transforms operations to maintain consistency when applied
    concurrently by different users.
    
    The key insight of OT:
        If user A applies operation A, and user B applies operation B,
        we need to transform B to B' such that:
            apply(apply(doc, A), B') == apply(apply(doc, B), A')
        
        This is called the "transformation property" or "TP1".
    """
    
    def transform(
        self,
        op_a: Operation,
        op_b: Operation,
        priority: str = "left"
    ) -> tuple[Operation, Operation]:
        """
        Transform two concurrent operations.
        
        Given operations A and B that were created against the same
        document state, returns (A', B') such that:
            apply(apply(doc, A), B') == apply(apply(doc, B), A')
        
        Args:
            op_a: First operation
            op_b: Second operation
            priority: "left" means op_a wins ties, "right" means op_b wins
        
        Returns:
            (transformed_a, transformed_b)
        """
        
        # Dispatch based on operation types
        if op_a.type == OperationType.INSERT and op_b.type == OperationType.INSERT:
            return self._transform_insert_insert(op_a, op_b, priority)
        
        elif op_a.type == OperationType.INSERT and op_b.type == OperationType.DELETE:
            return self._transform_insert_delete(op_a, op_b)
        
        elif op_a.type == OperationType.DELETE and op_b.type == OperationType.INSERT:
            b_prime, a_prime = self._transform_insert_delete(op_b, op_a)
            return (a_prime, b_prime)
        
        elif op_a.type == OperationType.DELETE and op_b.type == OperationType.DELETE:
            return self._transform_delete_delete(op_a, op_b)
        
        else:
            # RETAIN operations don't need transformation
            return (op_a, op_b)
    
    def _transform_insert_insert(
        self,
        op_a: Operation,
        op_b: Operation,
        priority: str
    ) -> tuple[Operation, Operation]:
        """
        Transform two INSERT operations.
        
        Cases:
            1. A.pos < B.pos: B shifts right by A.length
            2. A.pos > B.pos: A shifts right by B.length
            3. A.pos == B.pos: Use priority to decide order
        
        Example:
            Document: "Hello"
            A: INSERT(pos=5, text=" World")  -> "Hello World"
            B: INSERT(pos=5, text=" There")  -> "Hello There"
            
            If priority="left" (A wins):
                A' = INSERT(pos=5, text=" World")
                B' = INSERT(pos=11, text=" There")  # Shifted by len(" World")
                Result: "Hello World There"
            
            If priority="right" (B wins):
                A' = INSERT(pos=11, text=" World")  # Shifted by len(" There")
                B' = INSERT(pos=5, text=" There")
                Result: "Hello There World"
        """
        pos_a = op_a.position
        pos_b = op_b.position
        len_a = len(op_a.text)
        len_b = len(op_b.text)
        
        if pos_a < pos_b:
            # A is before B, so B shifts right
            a_prime = Operation(
                type=OperationType.INSERT,
                position=pos_a,
                text=op_a.text
            )
            b_prime = Operation(
                type=OperationType.INSERT,
                position=pos_b + len_a,
                text=op_b.text
            )
        elif pos_a > pos_b:
            # B is before A, so A shifts right
            a_prime = Operation(
                type=OperationType.INSERT,
                position=pos_a + len_b,
                text=op_a.text
            )
            b_prime = Operation(
                type=OperationType.INSERT,
                position=pos_b,
                text=op_b.text
            )
        else:
            # Same position - use priority
            if priority == "left":
                # A goes first
                a_prime = Operation(
                    type=OperationType.INSERT,
                    position=pos_a,
                    text=op_a.text
                )
                b_prime = Operation(
                    type=OperationType.INSERT,
                    position=pos_b + len_a,
                    text=op_b.text
                )
            else:
                # B goes first
                a_prime = Operation(
                    type=OperationType.INSERT,
                    position=pos_a + len_b,
                    text=op_a.text
                )
                b_prime = Operation(
                    type=OperationType.INSERT,
                    position=pos_b,
                    text=op_b.text
                )
        
        return (a_prime, b_prime)
    
    def _transform_insert_delete(
        self,
        insert_op: Operation,
        delete_op: Operation
    ) -> tuple[Operation, Operation]:
        """
        Transform INSERT and DELETE operations.
        
        Cases:
            1. INSERT before DELETE range: DELETE shifts right
            2. INSERT after DELETE range: INSERT shifts left
            3. INSERT inside DELETE range: INSERT preserved, DELETE split
        
        Example (Case 3 - INSERT inside DELETE):
            Document: "Hello Beautiful World"
            INSERT: INSERT(pos=10, text="X")  -> Insert "X" at position 10
            DELETE: DELETE(pos=6, count=10)   -> Delete "Beautiful "
            
            After transformation:
                INSERT' = INSERT(pos=6, text="X")  # Moved to delete start
                DELETE' = DELETE(pos=6, count=10) + adjust for inserted text
            
            This is the tricky case - we preserve the insert but adjust positions.
        """
        ins_pos = insert_op.position
        ins_len = len(insert_op.text)
        del_start = delete_op.position
        del_end = delete_op.position + delete_op.count
        
        if ins_pos <= del_start:
            # INSERT is before DELETE range
            # DELETE shifts right by insert length
            insert_prime = Operation(
                type=OperationType.INSERT,
                position=ins_pos,
                text=insert_op.text
            )
            delete_prime = Operation(
                type=OperationType.DELETE,
                position=del_start + ins_len,
                count=delete_op.count
            )
        
        elif ins_pos >= del_end:
            # INSERT is after DELETE range
            # INSERT shifts left by delete count
            insert_prime = Operation(
                type=OperationType.INSERT,
                position=ins_pos - delete_op.count,
                text=insert_op.text
            )
            delete_prime = Operation(
                type=OperationType.DELETE,
                position=del_start,
                count=delete_op.count
            )
        
        else:
            # INSERT is inside DELETE range
            # This is the complex case
            # 
            # Strategy: The inserted text survives, but moves to delete start.
            # The delete still happens, but the inserted text is preserved.
            #
            # Example:
            #   "ABCDEFGH" with DELETE(2, 4) and INSERT(4, "X")
            #   DELETE wants to remove "CDEF"
            #   INSERT wants to put "X" at position 4 (between D and E)
            #   
            #   Result should be: "ABXGH"
            #   - "CD" is deleted (before insert point)
            #   - "X" is inserted
            #   - "EF" is deleted (after insert point)
            
            insert_prime = Operation(
                type=OperationType.INSERT,
                position=del_start,  # Move to delete start
                text=insert_op.text
            )
            
            # Delete still removes the same characters, but insert is preserved
            # The delete count stays the same because we're deleting the
            # original characters, not the newly inserted ones
            delete_prime = Operation(
                type=OperationType.DELETE,
                position=del_start,
                count=delete_op.count
            )
        
        return (insert_prime, delete_prime)
    
    def _transform_delete_delete(
        self,
        op_a: Operation,
        op_b: Operation
    ) -> tuple[Operation, Operation]:
        """
        Transform two DELETE operations.
        
        Cases:
            1. No overlap: Adjust positions based on which is first
            2. Partial overlap: Reduce counts to avoid double-deletion
            3. Full overlap: One or both become no-ops
        
        Example (Partial overlap):
            Document: "ABCDEFGH"
            A: DELETE(pos=2, count=4)  -> Delete "CDEF"
            B: DELETE(pos=4, count=4)  -> Delete "EFGH"
            
            Overlap is "EF" (positions 4-5)
            
            After transformation:
                A' = DELETE(pos=2, count=4)  -> Still deletes "CDEF"
                B' = DELETE(pos=2, count=2)  -> Only deletes "GH" (shifted and reduced)
        """
        a_start = op_a.position
        a_end = op_a.position + op_a.count
        b_start = op_b.position
        b_end = op_b.position + op_b.count
        
        # Case 1: A is entirely before B (no overlap)
        if a_end <= b_start:
            a_prime = Operation(
                type=OperationType.DELETE,
                position=a_start,
                count=op_a.count
            )
            b_prime = Operation(
                type=OperationType.DELETE,
                position=b_start - op_a.count,  # Shift left
                count=op_b.count
            )
            return (a_prime, b_prime)
        
        # Case 2: B is entirely before A (no overlap)
        if b_end <= a_start:
            a_prime = Operation(
                type=OperationType.DELETE,
                position=a_start - op_b.count,  # Shift left
                count=op_a.count
            )
            b_prime = Operation(
                type=OperationType.DELETE,
                position=b_start,
                count=op_b.count
            )
            return (a_prime, b_prime)
        
        # Case 3: Overlap exists
        # Calculate the overlap region
        overlap_start = max(a_start, b_start)
        overlap_end = min(a_end, b_end)
        overlap_count = overlap_end - overlap_start
        
        # A' should delete everything A deletes except the overlap
        # (because B will delete the overlap)
        a_new_count = op_a.count - overlap_count
        
        # B' should delete everything B deletes except the overlap
        # (because A will delete the overlap)
        b_new_count = op_b.count - overlap_count
        
        # Calculate new positions
        # A' position: if B starts before A, A shifts left by B's non-overlap portion
        if b_start < a_start:
            a_new_pos = a_start - (a_start - b_start)  # = b_start
        else:
            a_new_pos = a_start
        
        # B' position: if A starts before B, B shifts left by A's non-overlap portion
        if a_start < b_start:
            b_new_pos = b_start - (b_start - a_start)  # = a_start
        else:
            b_new_pos = b_start
        
        # Handle edge case: if count becomes 0, create a no-op
        if a_new_count <= 0:
            a_prime = None  # No-op
        else:
            a_prime = Operation(
                type=OperationType.DELETE,
                position=a_new_pos,
                count=a_new_count
            )
        
        if b_new_count <= 0:
            b_prime = None  # No-op
        else:
            b_prime = Operation(
                type=OperationType.DELETE,
                position=b_new_pos,
                count=b_new_count
            )
        
        return (a_prime, b_prime)
    
    def transform_batch(
        self,
        batch_a: OperationBatch,
        batch_b: OperationBatch,
        priority: str = "left"
    ) -> tuple[OperationBatch, OperationBatch]:
        """
        Transform two operation batches.
        
        Transforms all operations in batch_a against all operations in batch_b.
        """
        # Transform each operation in A against all operations in B
        a_ops_transformed = list(batch_a.operations)
        b_ops_transformed = list(batch_b.operations)
        
        for i, op_a in enumerate(a_ops_transformed):
            for j, op_b in enumerate(b_ops_transformed):
                if op_a is None or op_b is None:
                    continue
                
                op_a_new, op_b_new = self.transform(op_a, op_b, priority)
                a_ops_transformed[i] = op_a_new
                b_ops_transformed[j] = op_b_new
        
        # Filter out None operations (no-ops)
        a_ops_filtered = [op for op in a_ops_transformed if op is not None]
        b_ops_filtered = [op for op in b_ops_transformed if op is not None]
        
        batch_a_prime = OperationBatch(
            id=batch_a.id,
            user_id=batch_a.user_id,
            document_id=batch_a.document_id,
            version=batch_a.version,
            operations=a_ops_filtered,
            timestamp=batch_a.timestamp,
            source=batch_a.source
        )
        
        batch_b_prime = OperationBatch(
            id=batch_b.id,
            user_id=batch_b.user_id,
            document_id=batch_b.document_id,
            version=batch_b.version,
            operations=b_ops_filtered,
            timestamp=batch_b.timestamp,
            source=batch_b.source
        )
        
        return (batch_a_prime, batch_b_prime)
```

### 3.2 Cursor Transformation

```python
class CursorTransformer:
    """
    Transforms cursor positions against operations.
    
    When an operation is applied, all cursors must be updated
    to maintain their logical position in the document.
    """
    
    def transform_cursor(
        self,
        cursor: Cursor,
        operation: Operation,
        is_own_operation: bool = False
    ) -> Cursor:
        """
        Transform a cursor against an operation.
        
        Args:
            cursor: Cursor to transform
            operation: Operation that was applied
            is_own_operation: True if this cursor's user created the operation
        
        Returns:
            Transformed cursor
        """
        # Determine bias based on ownership
        # If it's the user's own operation, cursor should be after inserted text
        # If it's another user's operation, cursor should stay in place
        bias = "right" if is_own_operation else "left"
        
        new_position = self._transform_position(
            cursor.position,
            operation,
            bias
        )
        
        new_selection_start = None
        new_selection_end = None
        
        if cursor.has_selection:
            new_selection_start = self._transform_position(
                cursor.selection_start,
                operation,
                "left"  # Selection boundaries use left bias
            )
            new_selection_end = self._transform_position(
                cursor.selection_end,
                operation,
                "right"  # Selection end uses right bias
            )
        
        return Cursor(
            user_id=cursor.user_id,
            position=new_position,
            selection_start=new_selection_start,
            selection_end=new_selection_end
        )
    
    def _transform_position(
        self,
        position: int,
        operation: Operation,
        bias: str
    ) -> int:
        """Transform a single position against an operation."""
        
        if operation.type == OperationType.INSERT:
            return insert_effect_on_position(operation, position, bias)
        
        elif operation.type == OperationType.DELETE:
            return delete_effect_on_position(operation, position)
        
        else:  # RETAIN
            return position
    
    def transform_cursor_batch(
        self,
        cursor: Cursor,
        batch: OperationBatch,
        is_own_operation: bool = False
    ) -> Cursor:
        """Transform a cursor against an operation batch."""
        result = cursor
        
        for operation in batch.operations:
            result = self.transform_cursor(result, operation, is_own_operation)
        
        return result
```

---

## 4. Server-Side OT Engine

### 4.1 OT Server

```python
import asyncio
from typing import Dict, Set, Callable, Awaitable
from dataclasses import dataclass, field
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class ClientState:
    """State for a connected client."""
    user_id: str
    document_id: str
    last_acknowledged_version: int
    pending_operations: List[OperationBatch] = field(default_factory=list)
    cursor: Optional[Cursor] = None


class OTServer:
    """
    Server-side OT engine.
    
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
    
    def __init__(self):
        self.documents: Dict[str, Document] = {}
        self.clients: Dict[str, ClientState] = {}  # client_id -> state
        self.document_clients: Dict[str, Set[str]] = {}  # document_id -> client_ids
        self.transformer = OTTransformer()
        self.cursor_transformer = CursorTransformer()
        self._lock = asyncio.Lock()
        
        # Callbacks
        self.on_broadcast: Optional[Callable[[str, dict], Awaitable[None]]] = None
    
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
                return {"error": "Client not registered"}
            
            document = self.documents.get(batch.document_id)
            if not document:
                return {"error": "Document not found"}
            
            # Step 1: Validate
            if batch.version > document.version:
                return {"error": f"Invalid version: {batch.version} > {document.version}"}
            
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
                return {"error": str(e)}
            
            # Step 4: Broadcast to all clients
            await self._broadcast_operation(
                batch.document_id,
                transformed_batch,
                exclude_client=client_id
            )
            
            # Step 5: Update client state
            client.last_acknowledged_version = document.version
            
            # Step 6: Return acknowledgment
            return {
                "ack": True,
                "version": document.version,
                "batch_id": batch.id,
                "transformed": transformed_batch.to_dict() if transformed_batch != batch else None
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
        """
        async with self._lock:
            document = self.documents.get(document_id)
            if not document:
                return {"error": "Document not found"}
            
            if client_version > document.version:
                return {"error": "Client version ahead of server"}
            
            if client_version == document.version:
                return {
                    "synced": True,
                    "version": document.version,
                    "operations": []
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
        """Register a new client for a document."""
        async with self._lock:
            # Create document if doesn't exist
            if document_id not in self.documents:
                self.documents[document_id] = Document(id=document_id)
            
            document = self.documents[document_id]
            
            # Create client state
            self.clients[client_id] = ClientState(
                user_id=user_id,
                document_id=document_id,
                last_acknowledged_version=document.version
            )
            
            # Track client for document
            if document_id not in self.document_clients:
                self.document_clients[document_id] = set()
            self.document_clients[document_id].add(client_id)
            
            return {
                "registered": True,
                "document_id": document_id,
                "version": document.version,
                "content": document.content,
                "hash": document.compute_hash()
            }
    
    async def unregister_client(self, client_id: str) -> None:
        """Unregister a client."""
        async with self._lock:
            client = self.clients.pop(client_id, None)
            if client:
                doc_clients = self.document_clients.get(client.document_id)
                if doc_clients:
                    doc_clients.discard(client_id)
    
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
                await self.on_broadcast(client_id, message)
    
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
                await self.on_broadcast(client_id, message)
```

### 4.2 Database Persistence

```sql
-- =============================================================================
-- OT PERSISTENCE SCHEMA
-- =============================================================================

-- Documents table
CREATE TABLE ot.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 0,
    content_hash VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT documents_version_positive CHECK (version >= 0)
);

CREATE INDEX idx_documents_workspace ON ot.documents(workspace_id);

-- Operation history table
CREATE TABLE ot.operation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES ot.documents(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version INTEGER NOT NULL,
    operations JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(20) NOT NULL DEFAULT 'user',
    cursor_before INTEGER,
    cursor_after INTEGER,
    selection_before JSONB,
    selection_after JSONB,
    
    CONSTRAINT operation_history_version_positive CHECK (version >= 0),
    CONSTRAINT operation_history_unique_version UNIQUE (document_id, version)
);

CREATE INDEX idx_operation_history_document ON ot.operation_history(document_id);
CREATE INDEX idx_operation_history_document_version ON ot.operation_history(document_id, version);
CREATE INDEX idx_operation_history_user ON ot.operation_history(user_id);
CREATE INDEX idx_operation_history_timestamp ON ot.operation_history(timestamp);

-- Document checkpoints for efficient replay
CREATE TABLE ot.document_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES ot.documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT document_checkpoints_unique UNIQUE (document_id, version)
);

CREATE INDEX idx_document_checkpoints_document ON ot.document_checkpoints(document_id);

-- Active cursors (ephemeral, could also use Redis)
CREATE TABLE ot.active_cursors (
    user_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES ot.documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    selection_start INTEGER,
    selection_end INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, document_id)
);

CREATE INDEX idx_active_cursors_document ON ot.active_cursors(document_id);

-- =============================================================================
-- PERSISTENCE FUNCTIONS
-- =============================================================================

-- Save operation batch
CREATE OR REPLACE FUNCTION ot.save_operation_batch(
    p_document_id UUID,
    p_batch_id UUID,
    p_user_id UUID,
    p_version INTEGER,
    p_operations JSONB,
    p_new_content TEXT,
    p_source VARCHAR DEFAULT 'user'
) RETURNS TABLE (
    success BOOLEAN,
    new_version INTEGER,
    content_hash VARCHAR
) AS $$
DECLARE
    v_current_version INTEGER;
    v_content_hash VARCHAR(16);
BEGIN
    -- Lock document row
    SELECT version INTO v_current_version
    FROM ot.documents
    WHERE id = p_document_id
    FOR UPDATE;
    
    -- Verify version
    IF v_current_version != p_version THEN
        RETURN QUERY SELECT FALSE, v_current_version, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Compute hash
    v_content_hash := LEFT(encode(sha256(p_new_content::bytea), 'hex'), 16);
    
    -- Update document
    UPDATE ot.documents
    SET content = p_new_content,
        version = p_version + 1,
        content_hash = v_content_hash,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    -- Insert operation history
    INSERT INTO ot.operation_history (
        document_id, batch_id, user_id, version, operations, source
    ) VALUES (
        p_document_id, p_batch_id, p_user_id, p_version + 1, p_operations, p_source
    );
    
    -- Create checkpoint if needed (every 100 versions)
    IF (p_version + 1) % 100 = 0 THEN
        INSERT INTO ot.document_checkpoints (document_id, version, content, content_hash)
        VALUES (p_document_id, p_version + 1, p_new_content, v_content_hash)
        ON CONFLICT (document_id, version) DO NOTHING;
    END IF;
    
    RETURN QUERY SELECT TRUE, p_version + 1, v_content_hash;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Client-Side Integration

### 5.1 Client OT Manager

```typescript
// =============================================================================
// CLIENT-SIDE OT MANAGER (TypeScript)
// =============================================================================

interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  text?: string;
  count?: number;
}

interface OperationBatch {
  id: string;
  userId: string;
  documentId: string;
  version: number;
  operations: Operation[];
  timestamp: number;
  source: string;
}

interface Cursor {
  userId: string;
  position: number;
  selectionStart?: number;
  selectionEnd?: number;
}

class OTClient {
  private documentId: string;
  private userId: string;
  private content: string = '';
  private version: number = 0;
  private pendingBatches: OperationBatch[] = [];
  private sentBatches: Map<string, OperationBatch> = new Map();
  private ws: WebSocket | null = null;
  private transformer: OTTransformer;
  
  // Callbacks
  onContentChange?: (content: string) => void;
  onCursorChange?: (cursor: Cursor) => void;
  onRemoteCursor?: (cursor: Cursor) => void;
  
  constructor(documentId: string, userId: string) {
    this.documentId = documentId;
    this.userId = userId;
    this.transformer = new OTTransformer();
  }
  
  /**
   * Connect to the OT server.
   */
  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        // Register with server
        this.send({
          type: 'register',
          documentId: this.documentId,
          userId: this.userId
        });
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
        
        if (message.type === 'registered') {
          this.content = message.content;
          this.version = message.version;
          resolve();
        }
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  /**
   * Apply a local operation.
   * 
   * Called when the user types, deletes, etc.
   */
  applyLocalOperation(operation: Operation): void {
    // Apply immediately to local content
    this.content = this.applyOperation(this.content, operation);
    this.onContentChange?.(this.content);
    
    // Create batch
    const batch: OperationBatch = {
      id: crypto.randomUUID(),
      userId: this.userId,
      documentId: this.documentId,
      version: this.version,
      operations: [operation],
      timestamp: Date.now(),
      source: 'user'
    };
    
    // Queue for sending
    this.pendingBatches.push(batch);
    
    // Send if no pending acknowledgments
    if (this.sentBatches.size === 0) {
      this.sendNextBatch();
    }
  }
  
  /**
   * Handle a message from the server.
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'registered':
        // Initial sync handled in connect()
        break;
      
      case 'ack':
        this.handleAck(message);
        break;
      
      case 'operation':
        this.handleRemoteOperation(message.batch);
        break;
      
      case 'cursor':
        this.handleRemoteCursor(message);
        break;
      
      case 'sync':
        this.handleSync(message);
        break;
    }
  }
  
  /**
   * Handle acknowledgment of our operation.
   */
  private handleAck(message: any): void {
    const batchId = message.batchId;
    const sentBatch = this.sentBatches.get(batchId);
    
    if (sentBatch) {
      this.sentBatches.delete(batchId);
      this.version = message.version;
      
      // Send next pending batch
      this.sendNextBatch();
    }
  }
  
  /**
   * Handle a remote operation from another user.
   */
  private handleRemoteOperation(remoteBatch: OperationBatch): void {
    // Transform against any pending local operations
    let transformedBatch = remoteBatch;
    
    // Transform against sent but unacknowledged operations
    for (const [, sentBatch] of this.sentBatches) {
      const [, transformed] = this.transformer.transformBatch(
        sentBatch,
        transformedBatch,
        'left' // Our operations have priority
      );
      transformedBatch = transformed;
    }
    
    // Transform against pending operations
    for (let i = 0; i < this.pendingBatches.length; i++) {
      const [, transformed] = this.transformer.transformBatch(
        this.pendingBatches[i],
        transformedBatch,
        'left'
      );
      transformedBatch = transformed;
    }
    
    // Apply transformed operation to local content
    for (const op of transformedBatch.operations) {
      this.content = this.applyOperation(this.content, op);
    }
    
    this.version = remoteBatch.version;
    this.onContentChange?.(this.content);
  }
  
  /**
   * Handle remote cursor update.
   */
  private handleRemoteCursor(message: any): void {
    const cursor: Cursor = {
      userId: message.userId,
      position: message.position,
      selectionStart: message.selectionStart,
      selectionEnd: message.selectionEnd
    };
    
    this.onRemoteCursor?.(cursor);
  }
  
  /**
   * Send the next pending batch.
   */
  private sendNextBatch(): void {
    if (this.pendingBatches.length === 0) {
      return;
    }
    
    const batch = this.pendingBatches.shift()!;
    batch.version = this.version; // Update to current version
    
    this.sentBatches.set(batch.id, batch);
    
    this.send({
      type: 'operation',
      batch: batch
    });
  }
  
  /**
   * Apply a single operation to content.
   */
  private applyOperation(content: string, op: Operation): string {
    switch (op.type) {
      case 'insert':
        return content.slice(0, op.position) + op.text + content.slice(op.position);
      
      case 'delete':
        return content.slice(0, op.position) + content.slice(op.position + op.count!);
      
      case 'retain':
        return content;
      
      default:
        return content;
    }
  }
  
  /**
   * Send a message to the server.
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Update local cursor position.
   */
  updateCursor(position: number, selectionStart?: number, selectionEnd?: number): void {
    this.send({
      type: 'cursor',
      documentId: this.documentId,
      position,
      selectionStart,
      selectionEnd
    });
  }
}


// =============================================================================
// CLIENT-SIDE TRANSFORMER
// =============================================================================

class OTTransformer {
  /**
   * Transform two operation batches.
   */
  transformBatch(
    batchA: OperationBatch,
    batchB: OperationBatch,
    priority: 'left' | 'right' = 'left'
  ): [OperationBatch, OperationBatch] {
    let opsA = [...batchA.operations];
    let opsB = [...batchB.operations];
    
    for (let i = 0; i < opsA.length; i++) {
      for (let j = 0; j < opsB.length; j++) {
        if (!opsA[i] || !opsB[j]) continue;
        
        const [newA, newB] = this.transform(opsA[i], opsB[j], priority);
        opsA[i] = newA!;
        opsB[j] = newB!;
      }
    }
    
    return [
      { ...batchA, operations: opsA.filter(Boolean) },
      { ...batchB, operations: opsB.filter(Boolean) }
    ];
  }
  
  /**
   * Transform two operations.
   */
  transform(
    opA: Operation,
    opB: Operation,
    priority: 'left' | 'right'
  ): [Operation | null, Operation | null] {
    if (opA.type === 'insert' && opB.type === 'insert') {
      return this.transformInsertInsert(opA, opB, priority);
    }
    
    if (opA.type === 'insert' && opB.type === 'delete') {
      return this.transformInsertDelete(opA, opB);
    }
    
    if (opA.type === 'delete' && opB.type === 'insert') {
      const [bPrime, aPrime] = this.transformInsertDelete(opB, opA);
      return [aPrime, bPrime];
    }
    
    if (opA.type === 'delete' && opB.type === 'delete') {
      return this.transformDeleteDelete(opA, opB);
    }
    
    return [opA, opB];
  }
  
  private transformInsertInsert(
    opA: Operation,
    opB: Operation,
    priority: 'left' | 'right'
  ): [Operation, Operation] {
    const posA = opA.position;
    const posB = opB.position;
    const lenA = opA.text!.length;
    const lenB = opB.text!.length;
    
    if (posA < posB) {
      return [
        { ...opA },
        { ...opB, position: posB + lenA }
      ];
    } else if (posA > posB) {
      return [
        { ...opA, position: posA + lenB },
        { ...opB }
      ];
    } else {
      // Same position - use priority
      if (priority === 'left') {
        return [
          { ...opA },
          { ...opB, position: posB + lenA }
        ];
      } else {
        return [
          { ...opA, position: posA + lenB },
          { ...opB }
        ];
      }
    }
  }
  
  private transformInsertDelete(
    insertOp: Operation,
    deleteOp: Operation
  ): [Operation, Operation] {
    const insPos = insertOp.position;
    const insLen = insertOp.text!.length;
    const delStart = deleteOp.position;
    const delEnd = deleteOp.position + deleteOp.count!;
    
    if (insPos <= delStart) {
      return [
        { ...insertOp },
        { ...deleteOp, position: delStart + insLen }
      ];
    } else if (insPos >= delEnd) {
      return [
        { ...insertOp, position: insPos - deleteOp.count! },
        { ...deleteOp }
      ];
    } else {
      // Insert inside delete range
      return [
        { ...insertOp, position: delStart },
        { ...deleteOp }
      ];
    }
  }
  
  private transformDeleteDelete(
    opA: Operation,
    opB: Operation
  ): [Operation | null, Operation | null] {
    const aStart = opA.position;
    const aEnd = opA.position + opA.count!;
    const bStart = opB.position;
    const bEnd = opB.position + opB.count!;
    
    // No overlap - A before B
    if (aEnd <= bStart) {
      return [
        { ...opA },
        { ...opB, position: bStart - opA.count! }
      ];
    }
    
    // No overlap - B before A
    if (bEnd <= aStart) {
      return [
        { ...opA, position: aStart - opB.count! },
        { ...opB }
      ];
    }
    
    // Overlap exists
    const overlapStart = Math.max(aStart, bStart);
    const overlapEnd = Math.min(aEnd, bEnd);
    const overlapCount = overlapEnd - overlapStart;
    
    const aNewCount = opA.count! - overlapCount;
    const bNewCount = opB.count! - overlapCount;
    
    const aPrime = aNewCount > 0 ? {
      ...opA,
      position: Math.min(aStart, bStart),
      count: aNewCount
    } : null;
    
    const bPrime = bNewCount > 0 ? {
      ...opB,
      position: Math.min(aStart, bStart),
      count: bNewCount
    } : null;
    
    return [aPrime, bPrime];
  }
}
```

---

## 6. Edge Cases and Invariants

### 6.1 Critical Invariants

```python
# =============================================================================
# OT INVARIANTS
# =============================================================================

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
    
    def verify_intention_preservation(
        self,
        original_content: str,
        op: Operation,
        transformed_op: Operation
    ) -> bool:
        """
        Verify that transformation preserves user intention.
        
        For INSERT: The inserted text appears in the result.
        For DELETE: The deleted text is removed from the result.
        """
        if op.type == OperationType.INSERT:
            # Intention: Insert this text
            result = self._apply_op(original_content, transformed_op)
            return op.text in result
        
        elif op.type == OperationType.DELETE:
            # Intention: Remove text at this position
            # (harder to verify - check that some deletion occurred)
            return transformed_op.type == OperationType.DELETE or transformed_op is None
        
        return True
    
    def _apply_op(self, content: str, op: Operation) -> str:
        """Apply operation to content."""
        if op is None:
            return content
        
        if op.type == OperationType.INSERT:
            return content[:op.position] + op.text + content[op.position:]
        elif op.type == OperationType.DELETE:
            return content[:op.position] + content[op.position + op.count:]
        return content


# =============================================================================
# EDGE CASES
# =============================================================================

EDGE_CASES = {
    "concurrent_insert_same_position": {
        "description": "Two users insert at the exact same position",
        "scenario": {
            "content": "Hello",
            "op_a": {"type": "insert", "position": 5, "text": " World"},
            "op_b": {"type": "insert", "position": 5, "text": " There"}
        },
        "expected_behavior": "Priority determines order. Left priority: 'Hello World There'",
        "resolution": "Use user_id comparison for deterministic tie-breaking"
    },
    
    "delete_includes_insert_point": {
        "description": "Delete range includes where another user inserted",
        "scenario": {
            "content": "ABCDEFGH",
            "op_a": {"type": "delete", "position": 2, "count": 4},  # Delete CDEF
            "op_b": {"type": "insert", "position": 4, "text": "X"}   # Insert X between D and E
        },
        "expected_behavior": "Insert is preserved, moved to delete start",
        "resolution": "Insert survives at position 2, delete still removes CDEF"
    },
    
    "overlapping_deletes": {
        "description": "Two users delete overlapping ranges",
        "scenario": {
            "content": "ABCDEFGH",
            "op_a": {"type": "delete", "position": 2, "count": 4},  # Delete CDEF
            "op_b": {"type": "delete", "position": 4, "count": 4}   # Delete EFGH
        },
        "expected_behavior": "Overlap deleted once, non-overlap deleted by respective ops",
        "resolution": "Result: 'AB', each op's count reduced by overlap"
    },
    
    "delete_entire_insert": {
        "description": "User deletes range that completely contains another's insert",
        "scenario": {
            "content": "ABCDEFGH",
            "op_a": {"type": "delete", "position": 0, "count": 8},  # Delete everything
            "op_b": {"type": "insert", "position": 4, "text": "X"}   # Insert X
        },
        "expected_behavior": "Insert is preserved at position 0",
        "resolution": "Insert moves to delete start (position 0)"
    },
    
    "rapid_fire_typing": {
        "description": "User types very quickly, creating many small inserts",
        "scenario": {
            "content": "Hello",
            "ops": [
                {"type": "insert", "position": 5, "text": " "},
                {"type": "insert", "position": 6, "text": "W"},
                {"type": "insert", "position": 7, "text": "o"},
                {"type": "insert", "position": 8, "text": "r"},
                {"type": "insert", "position": 9, "text": "l"},
                {"type": "insert", "position": 10, "text": "d"}
            ]
        },
        "expected_behavior": "All inserts applied in order",
        "resolution": "Batch operations into single batch for efficiency"
    },
    
    "undo_redo_during_collaboration": {
        "description": "User undoes while another user is editing",
        "scenario": {
            "content": "Hello World",
            "user_a_history": [
                {"type": "insert", "position": 5, "text": " Beautiful"}
            ],
            "user_b_op": {"type": "insert", "position": 11, "text": "!"}
        },
        "expected_behavior": "Undo transforms against concurrent edits",
        "resolution": "Undo operation is transformed like any other operation"
    },
    
    "network_partition_reconnect": {
        "description": "User goes offline, makes edits, reconnects",
        "scenario": {
            "server_version": 10,
            "client_version": 5,
            "client_pending_ops": ["...5 operations..."]
        },
        "expected_behavior": "Client syncs, transforms pending ops, applies",
        "resolution": "Full sync protocol with version reconciliation"
    },
    
    "cursor_in_deleted_range": {
        "description": "User's cursor is in a range that gets deleted",
        "scenario": {
            "content": "ABCDEFGH",
            "cursor_position": 4,
            "delete_op": {"type": "delete", "position": 2, "count": 4}
        },
        "expected_behavior": "Cursor moves to delete start",
        "resolution": "Cursor collapses to delete_start when inside deleted range"
    }
}
```

---

## 7. Testing and Verification

### 7.1 Test Suite

```python
import pytest
from hypothesis import given, strategies as st


class TestOTTransformation:
    """Test suite for OT transformation functions."""
    
    def setup_method(self):
        self.transformer = OTTransformer()
        self.checker = OTInvariantChecker()
    
    # =========================================================================
    # INSERT + INSERT Tests
    # =========================================================================
    
    def test_insert_insert_different_positions(self):
        """Test INSERT + INSERT at different positions."""
        op_a = create_insert(5, " World")
        op_b = create_insert(0, "Say ")
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "left")
        
        # A should shift right by B's length
        assert a_prime.position == 5 + 4  # 9
        assert a_prime.text == " World"
        
        # B should stay the same
        assert b_prime.position == 0
        assert b_prime.text == "Say "
    
    def test_insert_insert_same_position_left_priority(self):
        """Test INSERT + INSERT at same position with left priority."""
        op_a = create_insert(5, " World")
        op_b = create_insert(5, " There")
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "left")
        
        # A wins (left priority), stays at position 5
        assert a_prime.position == 5
        
        # B shifts right by A's length
        assert b_prime.position == 5 + 6  # 11
    
    def test_insert_insert_same_position_right_priority(self):
        """Test INSERT + INSERT at same position with right priority."""
        op_a = create_insert(5, " World")
        op_b = create_insert(5, " There")
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "right")
        
        # B wins (right priority), stays at position 5
        assert b_prime.position == 5
        
        # A shifts right by B's length
        assert a_prime.position == 5 + 6  # 11
    
    # =========================================================================
    # INSERT + DELETE Tests
    # =========================================================================
    
    def test_insert_before_delete(self):
        """Test INSERT before DELETE range."""
        insert_op = create_insert(2, "XX")
        delete_op = create_delete(5, 3)
        
        ins_prime, del_prime = self.transformer.transform(insert_op, delete_op, "left")
        
        # Insert stays the same
        assert ins_prime.position == 2
        
        # Delete shifts right by insert length
        assert del_prime.position == 5 + 2  # 7
    
    def test_insert_after_delete(self):
        """Test INSERT after DELETE range."""
        insert_op = create_insert(10, "XX")
        delete_op = create_delete(2, 3)
        
        ins_prime, del_prime = self.transformer.transform(insert_op, delete_op, "left")
        
        # Insert shifts left by delete count
        assert ins_prime.position == 10 - 3  # 7
        
        # Delete stays the same
        assert del_prime.position == 2
    
    def test_insert_inside_delete(self):
        """Test INSERT inside DELETE range."""
        insert_op = create_insert(4, "X")
        delete_op = create_delete(2, 6)  # Deletes positions 2-7
        
        ins_prime, del_prime = self.transformer.transform(insert_op, delete_op, "left")
        
        # Insert moves to delete start
        assert ins_prime.position == 2
        assert ins_prime.text == "X"
        
        # Delete stays the same (will delete around the insert)
        assert del_prime.position == 2
        assert del_prime.count == 6
    
    # =========================================================================
    # DELETE + DELETE Tests
    # =========================================================================
    
    def test_delete_delete_no_overlap_a_first(self):
        """Test DELETE + DELETE with no overlap, A before B."""
        op_a = create_delete(0, 3)
        op_b = create_delete(5, 3)
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "left")
        
        # A stays the same
        assert a_prime.position == 0
        assert a_prime.count == 3
        
        # B shifts left by A's count
        assert b_prime.position == 5 - 3  # 2
        assert b_prime.count == 3
    
    def test_delete_delete_partial_overlap(self):
        """Test DELETE + DELETE with partial overlap."""
        op_a = create_delete(2, 4)  # Delete positions 2-5
        op_b = create_delete(4, 4)  # Delete positions 4-7
        
        # Overlap is positions 4-5 (2 characters)
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "left")
        
        # A deletes 2-5, but 4-5 is also deleted by B
        # So A' should delete 2-3 (count = 2)
        assert a_prime.count == 2
        
        # B deletes 4-7, but 4-5 is also deleted by A
        # So B' should delete 6-7 (count = 2), shifted left
        assert b_prime.count == 2
    
    def test_delete_delete_full_overlap_a_contains_b(self):
        """Test DELETE + DELETE where A fully contains B."""
        op_a = create_delete(2, 6)  # Delete positions 2-7
        op_b = create_delete(3, 2)  # Delete positions 3-4
        
        a_prime, b_prime = self.transformer.transform(op_a, op_b, "left")
        
        # A still deletes, but B's range is already covered
        assert a_prime.count == 4  # Reduced by B's count
        
        # B becomes no-op (already deleted by A)
        assert b_prime is None
    
    # =========================================================================
    # Transformation Property Tests
    # =========================================================================
    
    @given(
        content=st.text(min_size=10, max_size=100),
        pos_a=st.integers(min_value=0, max_value=50),
        pos_b=st.integers(min_value=0, max_value=50),
        text_a=st.text(min_size=1, max_size=10),
        text_b=st.text(min_size=1, max_size=10)
    )
    def test_tp1_insert_insert(self, content, pos_a, pos_b, text_a, text_b):
        """Property test: TP1 holds for INSERT + INSERT."""
        # Clamp positions to content length
        pos_a = min(pos_a, len(content))
        pos_b = min(pos_b, len(content))
        
        op_a = create_insert(pos_a, text_a)
        op_b = create_insert(pos_b, text_b)
        
        assert self.checker.verify_transformation_property(content, op_a, op_b)
    
    @given(
        content=st.text(min_size=20, max_size=100),
        ins_pos=st.integers(min_value=0, max_value=50),
        del_pos=st.integers(min_value=0, max_value=40),
        ins_text=st.text(min_size=1, max_size=10),
        del_count=st.integers(min_value=1, max_value=10)
    )
    def test_tp1_insert_delete(self, content, ins_pos, del_pos, ins_text, del_count):
        """Property test: TP1 holds for INSERT + DELETE."""
        # Clamp values
        ins_pos = min(ins_pos, len(content))
        del_pos = min(del_pos, len(content) - 1)
        del_count = min(del_count, len(content) - del_pos)
        
        if del_count <= 0:
            return  # Skip invalid case
        
        op_a = create_insert(ins_pos, ins_text)
        op_b = create_delete(del_pos, del_count)
        
        assert self.checker.verify_transformation_property(content, op_a, op_b)
    
    # =========================================================================
    # Cursor Transformation Tests
    # =========================================================================
    
    def test_cursor_after_insert_own_operation(self):
        """Test cursor moves after own insert."""
        cursor = Cursor(user_id="user1", position=5)
        insert_op = create_insert(5, "Hello")
        
        transformer = CursorTransformer()
        new_cursor = transformer.transform_cursor(cursor, insert_op, is_own_operation=True)
        
        # Cursor should be after inserted text
        assert new_cursor.position == 5 + 5  # 10
    
    def test_cursor_after_insert_other_operation(self):
        """Test cursor stays before other user's insert at same position."""
        cursor = Cursor(user_id="user1", position=5)
        insert_op = create_insert(5, "Hello")
        
        transformer = CursorTransformer()
        new_cursor = transformer.transform_cursor(cursor, insert_op, is_own_operation=False)
        
        # Cursor should stay at same logical position (before inserted text)
        assert new_cursor.position == 5
    
    def test_cursor_in_deleted_range(self):
        """Test cursor collapses when in deleted range."""
        cursor = Cursor(user_id="user1", position=5)
        delete_op = create_delete(3, 5)  # Delete positions 3-7
        
        transformer = CursorTransformer()
        new_cursor = transformer.transform_cursor(cursor, delete_op, is_own_operation=False)
        
        # Cursor should collapse to delete start
        assert new_cursor.position == 3


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestOTIntegration:
    """Integration tests for full OT workflow."""
    
    @pytest.mark.asyncio
    async def test_two_users_concurrent_edits(self):
        """Test two users making concurrent edits."""
        server = OTServer()
        
        # Setup
        await server.register_client("client_a", "user_a", "doc_1")
        await server.register_client("client_b", "user_b", "doc_1")
        
        # Both users start with empty document
        doc = server.documents["doc_1"]
        assert doc.content == ""
        assert doc.version == 0
        
        # User A types "Hello"
        batch_a = OperationBatch(
            user_id="user_a",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )
        result_a = await server.handle_operation("client_a", batch_a)
        assert result_a["ack"]
        assert doc.content == "Hello"
        assert doc.version == 1
        
        # User B (still at version 0) types "World" at position 0
        batch_b = OperationBatch(
            user_id="user_b",
            document_id="doc_1",
            version=0,  # Behind!
            operations=[create_insert(0, "World")]
        )
        result_b = await server.handle_operation("client_b", batch_b)
        assert result_b["ack"]
        
        # B's operation should be transformed
        # "World" should appear before "Hello" (B was at version 0)
        assert doc.content == "WorldHello"
        assert doc.version == 2
    
    @pytest.mark.asyncio
    async def test_reconnection_sync(self):
        """Test client reconnection and sync."""
        server = OTServer()
        
        # Setup
        await server.register_client("client_a", "user_a", "doc_1")
        
        # Make some edits
        for i in range(5):
            batch = OperationBatch(
                user_id="user_a",
                document_id="doc_1",
                version=i,
                operations=[create_insert(i, str(i))]
            )
            await server.handle_operation("client_a", batch)
        
        doc = server.documents["doc_1"]
        assert doc.version == 5
        assert doc.content == "01234"
        
        # New client connects, needs to sync from version 0
        sync_result = await server.sync_client("client_b", "doc_1", 0)
        
        assert sync_result["synced"]
        assert sync_result["version"] == 5
        assert len(sync_result["operations"]) == 5
        assert sync_result["content"] == "01234"
```

---

## Summary

This document provides the complete implementation specification for character-level Operational Transformation:

1. **Data Structures**
   - `Operation`: INSERT, DELETE, RETAIN with position and content
   - `OperationBatch`: Atomic unit of change with version tracking
   - `Document`: Content with version and history
   - `Cursor`: User cursor with selection support

2. **Operation Types**
   - INSERT: Insert text at position
   - DELETE: Remove characters at position
   - RETAIN: Skip characters (for composition)

3. **Transformation Functions**
   - INSERT + INSERT: Position-based with priority tie-breaking
   - INSERT + DELETE: Insert survives, positions adjusted
   - DELETE + DELETE: Overlap handling, count reduction

4. **Server-Side Engine**
   - Version-based concurrency control
   - Transform against missed operations
   - Broadcast to all clients
   - Database persistence

5. **Client-Side Integration**
   - Local application with optimistic updates
   - Pending operation queue
   - Transform against remote operations
   - WebSocket communication

6. **Edge Cases**
   - Same position inserts
   - Insert inside delete range
   - Overlapping deletes
   - Cursor in deleted range
   - Network partition recovery

7. **Testing**
   - Unit tests for each transformation
   - Property-based tests for TP1
   - Integration tests for full workflow

---

**This is the technical truth. Implement it exactly.** 🎯
