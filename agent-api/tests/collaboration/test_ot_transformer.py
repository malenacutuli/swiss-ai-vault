"""Tests for OT Transformer."""

import pytest
from app.collaboration.ot_types import (
    Operation,
    OperationBatch,
    OperationType,
    Document,
    create_insert,
    create_delete,
)
from app.collaboration.ot_transformer import OTTransformer
from app.collaboration.ot_server import OTInvariantChecker


class TestInsertInsertTransformation:
    """Tests for INSERT + INSERT transformation."""

    @pytest.fixture
    def transformer(self):
        return OTTransformer()

    def test_insert_before_insert(self, transformer):
        """A before B: B shifts right."""
        op_a = create_insert(0, "AAA")
        op_b = create_insert(5, "BBB")

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime.position == 0
        assert b_prime.position == 8  # Shifted by len("AAA")

    def test_insert_after_insert(self, transformer):
        """A after B: A shifts right."""
        op_a = create_insert(10, "AAA")
        op_b = create_insert(5, "BBB")

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime.position == 13  # Shifted by len("BBB")
        assert b_prime.position == 5

    def test_insert_same_position_left_priority(self, transformer):
        """Same position with left priority: A wins."""
        op_a = create_insert(5, "AAA")
        op_b = create_insert(5, "BBB")

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime.position == 5  # A stays
        assert b_prime.position == 8  # B shifts by len("AAA")

    def test_insert_same_position_right_priority(self, transformer):
        """Same position with right priority: B wins."""
        op_a = create_insert(5, "AAA")
        op_b = create_insert(5, "BBB")

        a_prime, b_prime = transformer.transform(op_a, op_b, "right")

        assert a_prime.position == 8  # A shifts by len("BBB")
        assert b_prime.position == 5  # B stays


class TestInsertDeleteTransformation:
    """Tests for INSERT + DELETE transformation."""

    @pytest.fixture
    def transformer(self):
        return OTTransformer()

    def test_insert_before_delete(self, transformer):
        """INSERT before DELETE range: DELETE shifts."""
        insert_op = create_insert(2, "XX")
        delete_op = create_delete(5, 3)

        ins_prime, del_prime = transformer.transform(insert_op, delete_op, "left")

        assert ins_prime.position == 2
        assert del_prime.position == 7  # Shifted by 2

    def test_insert_after_delete(self, transformer):
        """INSERT after DELETE range: INSERT shifts."""
        insert_op = create_insert(10, "XX")
        delete_op = create_delete(2, 3)

        ins_prime, del_prime = transformer.transform(insert_op, delete_op, "left")

        assert ins_prime.position == 7  # Shifted left by 3
        assert del_prime.position == 2

    def test_insert_inside_delete(self, transformer):
        """INSERT inside DELETE range: DELETE wins, INSERT is discarded."""
        insert_op = create_insert(5, "X")
        delete_op = create_delete(2, 6)  # Deletes positions 2-7

        ins_prime, del_prime = transformer.transform(insert_op, delete_op, "left")

        # INSERT is subsumed by delete (returns None)
        assert ins_prime is None
        # DELETE expands to cover original range + inserted text
        assert del_prime.position == 2
        assert del_prime.count == 7  # Original 6 + insert length 1


class TestDeleteDeleteTransformation:
    """Tests for DELETE + DELETE transformation."""

    @pytest.fixture
    def transformer(self):
        return OTTransformer()

    def test_delete_no_overlap_a_first(self, transformer):
        """A before B (no overlap): B shifts left."""
        op_a = create_delete(0, 3)
        op_b = create_delete(5, 3)

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime.position == 0
        assert a_prime.count == 3
        assert b_prime.position == 2  # Shifted left by 3
        assert b_prime.count == 3

    def test_delete_no_overlap_b_first(self, transformer):
        """B before A (no overlap): A shifts left."""
        op_a = create_delete(10, 3)
        op_b = create_delete(5, 3)

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime.position == 7  # Shifted left by 3
        assert a_prime.count == 3
        assert b_prime.position == 5
        assert b_prime.count == 3

    def test_delete_partial_overlap(self, transformer):
        """Partial overlap: Counts reduced by overlap."""
        op_a = create_delete(2, 4)  # Delete positions 2-5
        op_b = create_delete(4, 4)  # Delete positions 4-7

        # Overlap is positions 4-5 (2 characters)

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        # A' should have reduced count (4 - 2 = 2)
        assert a_prime.count == 2
        # B' should have reduced count (4 - 2 = 2)
        assert b_prime.count == 2

    def test_delete_full_overlap_a_contains_b(self, transformer):
        """A fully contains B: B becomes no-op."""
        op_a = create_delete(2, 6)  # Delete positions 2-7
        op_b = create_delete(3, 2)  # Delete positions 3-4

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        # A' has reduced count
        assert a_prime.count == 4  # 6 - 2 = 4
        # B' becomes None (no-op)
        assert b_prime is None

    def test_delete_full_overlap_b_contains_a(self, transformer):
        """B fully contains A: A becomes no-op."""
        op_a = create_delete(3, 2)  # Delete positions 3-4
        op_b = create_delete(2, 6)  # Delete positions 2-7

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        # A' becomes None (no-op)
        assert a_prime is None
        # B' has reduced count
        assert b_prime.count == 4  # 6 - 2 = 4

    def test_delete_identical(self, transformer):
        """Identical deletes: Both become no-op."""
        op_a = create_delete(5, 3)
        op_b = create_delete(5, 3)

        a_prime, b_prime = transformer.transform(op_a, op_b, "left")

        assert a_prime is None
        assert b_prime is None


class TestBatchTransformation:
    """Tests for batch transformation."""

    @pytest.fixture
    def transformer(self):
        return OTTransformer()

    def test_transform_batch_single_ops(self, transformer):
        """Transform batches with single operations."""
        batch_a = OperationBatch(
            user_id="user_a",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "Hello")]
        )
        batch_b = OperationBatch(
            user_id="user_b",
            document_id="doc_1",
            version=0,
            operations=[create_insert(0, "World")]
        )

        a_prime, b_prime = transformer.transform_batch(batch_a, batch_b, "left")

        # A wins (left priority)
        assert a_prime.operations[0].position == 0
        assert b_prime.operations[0].position == 5  # Shifted by "Hello"

    def test_transform_batch_multiple_ops(self, transformer):
        """Transform batches with multiple operations."""
        batch_a = OperationBatch(
            user_id="user_a",
            document_id="doc_1",
            version=0,
            operations=[
                create_insert(0, "A"),
                create_insert(5, "B")
            ]
        )
        batch_b = OperationBatch(
            user_id="user_b",
            document_id="doc_1",
            version=0,
            operations=[create_insert(3, "X")]
        )

        a_prime, b_prime = transformer.transform_batch(batch_a, batch_b, "left")

        assert len(a_prime.operations) == 2
        assert len(b_prime.operations) == 1


class TestTransformationProperty:
    """Tests for TP1 (Transformation Property 1)."""

    @pytest.fixture
    def checker(self):
        return OTInvariantChecker()

    def test_tp1_insert_insert_different_positions(self, checker):
        """TP1 holds for INSERT + INSERT at different positions."""
        op_a = create_insert(0, "Hello")
        op_b = create_insert(10, "World")
        assert checker.verify_transformation_property("0123456789", op_a, op_b)

    def test_tp1_insert_insert_same_position(self, checker):
        """TP1 holds for INSERT + INSERT at same position."""
        op_a = create_insert(5, "Hello")
        op_b = create_insert(5, "World")
        assert checker.verify_transformation_property("0123456789", op_a, op_b)

    def test_tp1_insert_delete(self, checker):
        """TP1 holds for INSERT + DELETE."""
        op_a = create_insert(5, "XX")
        op_b = create_delete(3, 4)
        assert checker.verify_transformation_property("0123456789", op_a, op_b)

    def test_tp1_delete_delete_no_overlap(self, checker):
        """TP1 holds for DELETE + DELETE (no overlap)."""
        op_a = create_delete(0, 2)
        op_b = create_delete(5, 2)
        assert checker.verify_transformation_property("0123456789", op_a, op_b)


class TestConvergence:
    """Tests for document convergence."""

    @pytest.fixture
    def transformer(self):
        return OTTransformer()

    def test_concurrent_inserts_converge(self, transformer):
        """Two users making concurrent inserts converge."""
        # Start with same document
        doc_a = Document(content="Hello")
        doc_b = Document(content="Hello")

        # User A inserts " World" at position 5
        batch_a = OperationBatch(
            user_id="user_a",
            document_id="doc_1",
            version=0,
            operations=[create_insert(5, " World")]
        )

        # User B inserts " There" at position 5
        batch_b = OperationBatch(
            user_id="user_b",
            document_id="doc_1",
            version=0,
            operations=[create_insert(5, " There")]
        )

        # Transform B against A
        _, batch_b_transformed = transformer.transform_batch(batch_a, batch_b, "left")

        # Apply A to doc_a, then transformed B
        doc_a.apply_batch(batch_a)
        batch_b_for_a = OperationBatch(
            user_id=batch_b_transformed.user_id,
            document_id=batch_b_transformed.document_id,
            version=1,  # Update version
            operations=batch_b_transformed.operations,
            timestamp=batch_b_transformed.timestamp
        )
        doc_a.apply_batch(batch_b_for_a)

        # Apply B to doc_b, then transformed A
        batch_a_transformed, _ = transformer.transform_batch(batch_a, batch_b, "left")
        doc_b.apply_batch(batch_b)
        batch_a_for_b = OperationBatch(
            user_id=batch_a_transformed.user_id,
            document_id=batch_a_transformed.document_id,
            version=1,  # Update version
            operations=batch_a_transformed.operations,
            timestamp=batch_a_transformed.timestamp
        )
        doc_b.apply_batch(batch_a_for_b)

        # Both documents should have same content
        assert doc_a.content == doc_b.content
        assert doc_a.version == doc_b.version == 2
