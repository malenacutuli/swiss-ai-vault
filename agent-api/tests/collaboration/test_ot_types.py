"""Tests for OT types and data structures."""

import pytest
from app.collaboration.ot_types import (
    OperationType,
    Operation,
    OperationBatch,
    Document,
    Cursor,
    create_insert,
    create_delete,
    create_retain,
    insert_effect_on_position,
    delete_effect_on_position,
)


class TestOperation:
    """Tests for Operation dataclass."""

    def test_create_insert_operation(self):
        """INSERT operation is created correctly."""
        op = Operation(
            type=OperationType.INSERT,
            position=5,
            text="Hello"
        )
        assert op.type == OperationType.INSERT
        assert op.position == 5
        assert op.text == "Hello"
        assert op.length == 5

    def test_create_delete_operation(self):
        """DELETE operation is created correctly."""
        op = Operation(
            type=OperationType.DELETE,
            position=5,
            count=10
        )
        assert op.type == OperationType.DELETE
        assert op.position == 5
        assert op.count == 10
        assert op.length == -10

    def test_create_retain_operation(self):
        """RETAIN operation is created correctly."""
        op = Operation(
            type=OperationType.RETAIN,
            position=0,
            count=5
        )
        assert op.type == OperationType.RETAIN
        assert op.count == 5
        assert op.length == 0

    def test_invalid_insert_empty_text(self):
        """INSERT with empty text raises error."""
        with pytest.raises(ValueError):
            Operation(
                type=OperationType.INSERT,
                position=0,
                text=""
            )

    def test_invalid_delete_zero_count(self):
        """DELETE with zero count raises error."""
        with pytest.raises(ValueError):
            Operation(
                type=OperationType.DELETE,
                position=0,
                count=0
            )

    def test_invalid_negative_position(self):
        """Negative position raises error."""
        with pytest.raises(ValueError):
            Operation(
                type=OperationType.INSERT,
                position=-1,
                text="Hello"
            )

    def test_operation_to_dict(self):
        """to_dict serializes operation."""
        op = create_insert(5, "Hello")
        d = op.to_dict()
        assert d["type"] == "insert"
        assert d["position"] == 5
        assert d["text"] == "Hello"

    def test_operation_from_dict(self):
        """from_dict deserializes operation."""
        d = {"type": "delete", "position": 5, "count": 10}
        op = Operation.from_dict(d)
        assert op.type == OperationType.DELETE
        assert op.position == 5
        assert op.count == 10


class TestOperationBatch:
    """Tests for OperationBatch."""

    def test_create_batch(self):
        """Batch is created correctly."""
        ops = [
            create_insert(0, "Hello"),
            create_insert(5, " World")
        ]
        batch = OperationBatch(
            user_id="user1",
            document_id="doc1",
            version=0,
            operations=ops
        )
        assert batch.user_id == "user1"
        assert len(batch.operations) == 2

    def test_batch_to_dict(self):
        """to_dict serializes batch."""
        batch = OperationBatch(
            user_id="user1",
            document_id="doc1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )
        d = batch.to_dict()
        assert d["user_id"] == "user1"
        assert len(d["operations"]) == 1

    def test_batch_from_dict(self):
        """from_dict deserializes batch."""
        d = {
            "id": "batch-123",
            "user_id": "user1",
            "document_id": "doc1",
            "version": 5,
            "operations": [{"type": "insert", "position": 0, "text": "Hi"}],
            "timestamp": 1234567890.0,
            "source": "user"
        }
        batch = OperationBatch.from_dict(d)
        assert batch.user_id == "user1"
        assert batch.version == 5
        assert len(batch.operations) == 1


class TestDocument:
    """Tests for Document."""

    def test_empty_document(self):
        """Empty document has version 0."""
        doc = Document()
        assert doc.content == ""
        assert doc.version == 0
        assert len(doc.history) == 0

    def test_apply_insert(self):
        """Apply INSERT operation."""
        doc = Document()
        batch = OperationBatch(
            version=0,
            operations=[create_insert(0, "Hello")]
        )
        doc.apply_batch(batch)
        assert doc.content == "Hello"
        assert doc.version == 1

    def test_apply_delete(self):
        """Apply DELETE operation."""
        doc = Document(content="Hello World", version=0)
        # Reset history to empty
        doc.history = []
        batch = OperationBatch(
            version=0,
            operations=[create_delete(5, 6)]  # Delete " World"
        )
        doc.apply_batch(batch)
        assert doc.content == "Hello"
        assert doc.version == 1

    def test_version_mismatch_raises(self):
        """Version mismatch raises error."""
        doc = Document()
        batch = OperationBatch(
            version=5,  # Wrong version
            operations=[create_insert(0, "Hello")]
        )
        with pytest.raises(ValueError, match="Version mismatch"):
            doc.apply_batch(batch)

    def test_compute_hash(self):
        """compute_hash returns consistent hash."""
        doc = Document(content="Hello World")
        hash1 = doc.compute_hash()
        hash2 = doc.compute_hash()
        assert hash1 == hash2
        assert len(hash1) == 16


class TestCursor:
    """Tests for Cursor."""

    def test_cursor_without_selection(self):
        """Cursor without selection."""
        cursor = Cursor(user_id="user1", position=5)
        assert cursor.position == 5
        assert cursor.has_selection is False
        assert cursor.selection_length == 0

    def test_cursor_with_selection(self):
        """Cursor with selection."""
        cursor = Cursor(
            user_id="user1",
            position=10,
            selection_start=5,
            selection_end=10
        )
        assert cursor.has_selection is True
        assert cursor.selection_length == 5

    def test_cursor_to_dict(self):
        """to_dict serializes cursor."""
        cursor = Cursor(
            user_id="user1",
            position=5,
            selection_start=5,
            selection_end=10
        )
        d = cursor.to_dict()
        assert d["user_id"] == "user1"
        assert d["position"] == 5
        assert d["selection_start"] == 5
        assert d["selection_end"] == 10


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_insert(self):
        """create_insert creates INSERT operation."""
        op = create_insert(5, "Hello")
        assert op.type == OperationType.INSERT
        assert op.position == 5
        assert op.text == "Hello"

    def test_create_insert_empty_raises(self):
        """create_insert with empty text raises."""
        with pytest.raises(ValueError):
            create_insert(0, "")

    def test_create_delete(self):
        """create_delete creates DELETE operation."""
        op = create_delete(5, 10)
        assert op.type == OperationType.DELETE
        assert op.position == 5
        assert op.count == 10

    def test_create_delete_zero_raises(self):
        """create_delete with zero count raises."""
        with pytest.raises(ValueError):
            create_delete(0, 0)

    def test_create_retain(self):
        """create_retain creates RETAIN operation."""
        op = create_retain(5)
        assert op.type == OperationType.RETAIN
        assert op.count == 5


class TestPositionEffects:
    """Tests for position effect functions."""

    def test_insert_effect_before_position(self):
        """INSERT before position has no effect."""
        op = create_insert(0, "XXX")
        assert insert_effect_on_position(op, 10, "right") == 13

    def test_insert_effect_after_position(self):
        """INSERT after position has no effect."""
        op = create_insert(10, "XXX")
        assert insert_effect_on_position(op, 5, "right") == 5

    def test_insert_effect_at_position_right_bias(self):
        """INSERT at position with right bias shifts."""
        op = create_insert(5, "XXX")
        assert insert_effect_on_position(op, 5, "right") == 8

    def test_insert_effect_at_position_left_bias(self):
        """INSERT at position with left bias stays."""
        op = create_insert(5, "XXX")
        assert insert_effect_on_position(op, 5, "left") == 5

    def test_delete_effect_before_position(self):
        """DELETE before position shifts left."""
        op = create_delete(0, 3)
        assert delete_effect_on_position(op, 10) == 7

    def test_delete_effect_after_position(self):
        """DELETE after position has no effect."""
        op = create_delete(10, 3)
        assert delete_effect_on_position(op, 5) == 5

    def test_delete_effect_at_position(self):
        """DELETE containing position collapses to start."""
        op = create_delete(3, 5)  # Delete positions 3-7
        assert delete_effect_on_position(op, 5) == 3
