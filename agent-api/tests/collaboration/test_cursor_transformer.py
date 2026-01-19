"""Tests for Cursor Transformer."""

import pytest
from app.collaboration.ot_types import (
    Cursor,
    OperationBatch,
    create_insert,
    create_delete,
)
from app.collaboration.cursor_transformer import CursorTransformer


class TestCursorTransformInsert:
    """Tests for cursor transformation against INSERT operations."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_cursor_before_insert(self, transformer):
        """Cursor before insert stays in place."""
        cursor = Cursor(user_id="user_1", position=5)
        op = create_insert(10, "XXX")

        result = transformer.transform_cursor(cursor, op)

        assert result.position == 5

    def test_cursor_after_insert(self, transformer):
        """Cursor after insert shifts right."""
        cursor = Cursor(user_id="user_1", position=10)
        op = create_insert(5, "XXX")

        result = transformer.transform_cursor(cursor, op)

        assert result.position == 13  # Shifted by 3

    def test_cursor_at_insert_same_user(self, transformer):
        """Cursor at insert position (same user) moves after insert."""
        cursor = Cursor(user_id="user_1", position=5)
        op = create_insert(5, "XXX")

        result = transformer.transform_cursor(cursor, op, is_own_operation=True)

        # Same user - cursor moves after inserted text (right bias)
        assert result.position == 8

    def test_cursor_at_insert_different_user(self, transformer):
        """Cursor at insert position (different user) stays in place."""
        cursor = Cursor(user_id="user_1", position=5)
        op = create_insert(5, "XXX")

        result = transformer.transform_cursor(cursor, op, is_own_operation=False)

        # Different user - cursor stays in place (left bias)
        assert result.position == 5


class TestCursorTransformDelete:
    """Tests for cursor transformation against DELETE operations."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_cursor_before_delete(self, transformer):
        """Cursor before delete stays in place."""
        cursor = Cursor(user_id="user_1", position=2)
        op = create_delete(5, 3)

        result = transformer.transform_cursor(cursor, op)

        assert result.position == 2

    def test_cursor_after_delete(self, transformer):
        """Cursor after delete shifts left."""
        cursor = Cursor(user_id="user_1", position=10)
        op = create_delete(5, 3)

        result = transformer.transform_cursor(cursor, op)

        assert result.position == 7  # Shifted left by 3

    def test_cursor_inside_delete(self, transformer):
        """Cursor inside delete range collapses to start."""
        cursor = Cursor(user_id="user_1", position=7)
        op = create_delete(5, 5)  # Deletes positions 5-9

        result = transformer.transform_cursor(cursor, op)

        assert result.position == 5  # Collapsed to delete start


class TestCursorSelectionTransform:
    """Tests for cursor selection transformation."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_selection_before_insert(self, transformer):
        """Selection before insert stays in place."""
        cursor = Cursor(
            user_id="user_1",
            position=5,
            selection_start=2,
            selection_end=5
        )
        op = create_insert(10, "XXX")

        result = transformer.transform_cursor(cursor, op)

        assert result.selection_start == 2
        assert result.selection_end == 5

    def test_selection_after_insert(self, transformer):
        """Selection after insert shifts right."""
        cursor = Cursor(
            user_id="user_1",
            position=15,
            selection_start=10,
            selection_end=15
        )
        op = create_insert(5, "XXX")

        result = transformer.transform_cursor(cursor, op)

        assert result.selection_start == 13
        assert result.selection_end == 18
        assert result.position == 18

    def test_selection_spanning_insert(self, transformer):
        """Selection spanning insert point expands."""
        cursor = Cursor(
            user_id="user_1",
            position=10,
            selection_start=3,
            selection_end=10
        )
        op = create_insert(5, "XXX")

        result = transformer.transform_cursor(cursor, op, is_own_operation=False)

        # Selection start stays (left bias), end shifts by insert length (right bias)
        assert result.selection_start == 3
        assert result.selection_end == 13

    def test_selection_inside_delete(self, transformer):
        """Selection fully inside delete range collapses."""
        cursor = Cursor(
            user_id="user_1",
            position=7,
            selection_start=5,
            selection_end=7
        )
        op = create_delete(3, 10)  # Deletes positions 3-12

        result = transformer.transform_cursor(cursor, op)

        # Both positions collapse to delete start
        assert result.selection_start == 3
        assert result.selection_end == 3
        assert result.position == 3


class TestCursorBatchTransform:
    """Tests for cursor transformation against operation batches."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_transform_against_single_op_batch(self, transformer):
        """Transform cursor against single-operation batch."""
        cursor = Cursor(user_id="user_1", position=5)
        batch = OperationBatch(
            user_id="user_2",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )

        result = transformer.transform_cursor_batch(cursor, batch)

        assert result.position == 10  # Shifted by 5

    def test_transform_against_multi_op_batch(self, transformer):
        """Transform cursor against multi-operation batch."""
        cursor = Cursor(user_id="user_1", position=10)
        batch = OperationBatch(
            user_id="user_2",
            document_id="doc_1",
            version=0,
            operations=[
                create_insert(0, "AAA"),  # +3
                create_insert(5, "BBB")   # +3 (at original 5, now 8)
            ]
        )

        result = transformer.transform_cursor_batch(cursor, batch)

        # Position 10 -> 13 (after first insert) -> 16 (after second insert)
        assert result.position == 16


class TestMultiCursorTransform:
    """Tests for transforming multiple cursors."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_transform_all_cursors(self, transformer):
        """Transform multiple cursors against a batch."""
        cursors = {
            "user_1": Cursor(user_id="user_1", position=0),
            "user_2": Cursor(user_id="user_2", position=5),
            "user_3": Cursor(user_id="user_3", position=10)
        }

        batch = OperationBatch(
            user_id="user_1",
            document_id="doc_1",
            version=0,
            operations=[create_insert(3, "XXX")]
        )

        results = transformer.transform_all_cursors(cursors, batch)

        # user_1 (owner, at 0) - stays at 0 (before insert)
        assert results["user_1"].position == 0
        # user_2 (at 5) - shifts to 8
        assert results["user_2"].position == 8
        # user_3 (at 10) - shifts to 13
        assert results["user_3"].position == 13


class TestCursorEdgeCases:
    """Tests for edge cases in cursor transformation."""

    @pytest.fixture
    def transformer(self):
        return CursorTransformer()

    def test_cursor_at_zero(self, transformer):
        """Cursor at position 0 handles insertions correctly."""
        cursor = Cursor(user_id="user_1", position=0)
        op = create_insert(0, "Start")

        # Different user's operation - cursor stays in place (left bias)
        result = transformer.transform_cursor(cursor, op, is_own_operation=False)
        assert result.position == 0

        # Own operation - cursor moves after insert (right bias)
        result2 = transformer.transform_cursor(cursor, op, is_own_operation=True)
        assert result2.position == 5

    def test_cursor_preserves_user_id(self, transformer):
        """Transformed cursor preserves user_id."""
        cursor = Cursor(user_id="user_123", position=5)
        op = create_insert(0, "XXX")

        result = transformer.transform_cursor(cursor, op)

        assert result.user_id == "user_123"

    def test_empty_batch_no_change(self, transformer):
        """Empty batch doesn't change cursor."""
        cursor = Cursor(user_id="user_1", position=5)
        batch = OperationBatch(
            user_id="user_2",
            document_id="doc_1",
            version=0,
            operations=[]
        )

        result = transformer.transform_cursor_batch(cursor, batch)

        assert result.position == 5
