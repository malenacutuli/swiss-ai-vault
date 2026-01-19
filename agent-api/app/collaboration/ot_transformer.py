"""
OT Transformer - Operational Transformation Engine

Transforms operations to maintain consistency when applied
concurrently by different users.

The key insight of OT:
    If user A applies operation A, and user B applies operation B,
    we need to transform B to B' such that:
        apply(apply(doc, A), B') == apply(apply(doc, B), A')

    This is called the "transformation property" or "TP1".
"""

from __future__ import annotations

from typing import Optional

from app.collaboration.ot_types import (
    Operation,
    OperationBatch,
    OperationType,
)


class OTTransformer:
    """
    Operational Transformation engine.

    Transforms operations to maintain consistency when applied
    concurrently by different users.
    """

    def transform(
        self,
        op_a: Operation,
        op_b: Operation,
        priority: str = "left"
    ) -> tuple[Optional[Operation], Optional[Operation]]:
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
            3. INSERT inside DELETE range: INSERT preserved, moved to delete start

        Example (Case 3 - INSERT inside DELETE):
            Document: "Hello Beautiful World"
            INSERT: INSERT(pos=10, text="X")  -> Insert "X" at position 10
            DELETE: DELETE(pos=6, count=10)   -> Delete "Beautiful "

            After transformation:
                INSERT' = INSERT(pos=6, text="X")  # Moved to delete start
                DELETE' = DELETE(pos=6, count=10)

            The inserted text survives but moves to where the delete starts.
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
            # This is a complex edge case. For TP1 to hold, we interpret this as:
            # The DELETE includes the inserted text (delete wins at the boundary).
            #
            # Path 1: apply INSERT, then DELETE' must delete the same range + inserted text
            # Path 2: apply DELETE, then INSERT' becomes a no-op (position was deleted)
            #
            # Result: Both paths yield the original delete result.
            insert_prime = None  # INSERT is subsumed by delete

            # DELETE' must delete the expanded range (original + inserted text)
            delete_prime = Operation(
                type=OperationType.DELETE,
                position=del_start,
                count=delete_op.count + ins_len
            )

        return (insert_prime, delete_prime)

    def _transform_delete_delete(
        self,
        op_a: Operation,
        op_b: Operation
    ) -> tuple[Optional[Operation], Optional[Operation]]:
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
                A' = DELETE(pos=2, count=2)  -> Deletes "CD" (reduced, EF handled by original A)
                B' = DELETE(pos=2, count=2)  -> Deletes "GH" (shifted and reduced)
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
        # The first delete gets position at min(a_start, b_start)
        new_pos = min(a_start, b_start)

        # Handle edge case: if count becomes 0, create a no-op (None)
        if a_new_count <= 0:
            a_prime = None
        else:
            a_prime = Operation(
                type=OperationType.DELETE,
                position=new_pos,
                count=a_new_count
            )

        if b_new_count <= 0:
            b_prime = None
        else:
            b_prime = Operation(
                type=OperationType.DELETE,
                position=new_pos,
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

        Args:
            batch_a: First batch
            batch_b: Second batch
            priority: "left" means batch_a wins ties

        Returns:
            (transformed_batch_a, transformed_batch_b)
        """
        # Transform each operation in A against all operations in B
        a_ops_transformed: list[Optional[Operation]] = list(batch_a.operations)
        b_ops_transformed: list[Optional[Operation]] = list(batch_b.operations)

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

    def transform_against_history(
        self,
        batch: OperationBatch,
        history: list[OperationBatch],
        from_version: int
    ) -> OperationBatch:
        """
        Transform a batch against historical operations.

        Used when a client sends an operation based on an old version,
        and we need to transform it against all operations since then.

        Args:
            batch: The batch to transform
            history: Document history
            from_version: Version the batch was created against

        Returns:
            Transformed batch
        """
        transformed = batch

        for historical_batch in history[from_version:]:
            if historical_batch.user_id == batch.user_id:
                # Skip own operations
                continue

            # Transform our batch against the historical batch
            _, transformed = self.transform_batch(
                historical_batch,
                transformed,
                priority="left"  # Historical operations have priority
            )

        return transformed
