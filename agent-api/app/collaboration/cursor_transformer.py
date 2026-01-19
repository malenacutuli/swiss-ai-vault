"""
Cursor Transformer

Transforms cursor positions against operations.
When an operation is applied, all cursors must be updated
to maintain their logical position in the document.
"""

from __future__ import annotations

from app.collaboration.ot_types import (
    Operation,
    OperationBatch,
    OperationType,
    Cursor,
    insert_effect_on_position,
    delete_effect_on_position,
)


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

        Behavior:
            - If it's the user's own operation, cursor should be after inserted text
            - If it's another user's operation, cursor should stay in place (left bias)
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
                "left"  # Selection start uses left bias
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
        """
        Transform a cursor against an operation batch.

        Args:
            cursor: Cursor to transform
            batch: Operation batch that was applied
            is_own_operation: True if this cursor's user created the batch

        Returns:
            Transformed cursor
        """
        result = cursor

        for operation in batch.operations:
            result = self.transform_cursor(result, operation, is_own_operation)

        return result

    def transform_all_cursors(
        self,
        cursors: dict[str, Cursor],
        batch: OperationBatch
    ) -> dict[str, Cursor]:
        """
        Transform all cursors against an operation batch.

        Args:
            cursors: Dictionary of user_id -> Cursor
            batch: Operation batch that was applied

        Returns:
            Dictionary of transformed cursors
        """
        result = {}

        for user_id, cursor in cursors.items():
            is_own = user_id == batch.user_id
            result[user_id] = self.transform_cursor_batch(
                cursor, batch, is_own_operation=is_own
            )

        return result
