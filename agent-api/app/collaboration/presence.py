"""
Presence Tracking System

Tracks which users are active on which documents, their cursor positions,
and provides awareness of other collaborators.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


# Default colors for user cursors (will cycle through these)
DEFAULT_COLORS = [
    "#FF6B6B",  # Red
    "#4ECDC4",  # Teal
    "#45B7D1",  # Blue
    "#96CEB4",  # Green
    "#FFEAA7",  # Yellow
    "#DDA0DD",  # Plum
    "#98D8C8",  # Mint
    "#F7DC6F",  # Gold
    "#BB8FCE",  # Purple
    "#85C1E9",  # Light Blue
]


@dataclass
class UserPresence:
    """Represents a user's presence in a document."""
    user_id: str
    document_id: str
    client_id: str

    # User display info
    user_name: str = ""
    user_color: str = ""
    user_avatar: Optional[str] = None

    # Cursor state
    cursor_position: int = 0
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None

    # Activity tracking
    joined_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    is_typing: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "user_id": self.user_id,
            "client_id": self.client_id,
            "user_name": self.user_name,
            "user_color": self.user_color,
            "user_avatar": self.user_avatar,
            "cursor_position": self.cursor_position,
            "selection_start": self.selection_start,
            "selection_end": self.selection_end,
            "is_active": self.is_active,
            "is_typing": self.is_typing,
            "joined_at": self.joined_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict, document_id: str) -> "UserPresence":
        """Create from dictionary."""
        return cls(
            user_id=data["user_id"],
            document_id=document_id,
            client_id=data["client_id"],
            user_name=data.get("user_name", ""),
            user_color=data.get("user_color", ""),
            user_avatar=data.get("user_avatar"),
            cursor_position=data.get("cursor_position", 0),
            selection_start=data.get("selection_start"),
            selection_end=data.get("selection_end"),
            is_active=data.get("is_active", True),
            is_typing=data.get("is_typing", False),
        )


class PresenceManager:
    """
    Manages user presence across documents.

    Responsibilities:
        - Track which users are in which documents
        - Track cursor positions and selections
        - Detect idle/inactive users
        - Broadcast presence updates
    """

    def __init__(
        self,
        idle_timeout: int = 300,  # 5 minutes
        stale_timeout: int = 60,  # 1 minute without activity = idle
    ):
        """
        Initialize presence manager.

        Args:
            idle_timeout: Seconds before user is considered idle
            stale_timeout: Seconds without activity before presence is stale
        """
        self.idle_timeout = idle_timeout
        self.stale_timeout = stale_timeout

        # document_id -> client_id -> UserPresence
        self.presence: dict[str, dict[str, UserPresence]] = {}

        # Track color assignments per document
        self._color_index: dict[str, int] = {}

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_presence_change: Optional[
            Callable[[str, UserPresence, str], Awaitable[None]]
        ] = None  # (document_id, presence, event_type)

    async def join(
        self,
        document_id: str,
        user_id: str,
        client_id: str,
        user_name: str = "",
        user_avatar: Optional[str] = None,
    ) -> UserPresence:
        """
        Register a user joining a document.

        Args:
            document_id: Document being joined
            user_id: User identifier
            client_id: Client identifier
            user_name: Display name
            user_avatar: Avatar URL

        Returns:
            The created UserPresence
        """
        async with self._lock:
            if document_id not in self.presence:
                self.presence[document_id] = {}
                self._color_index[document_id] = 0

            # Assign color
            color = DEFAULT_COLORS[self._color_index[document_id] % len(DEFAULT_COLORS)]
            self._color_index[document_id] += 1

            presence = UserPresence(
                user_id=user_id,
                document_id=document_id,
                client_id=client_id,
                user_name=user_name or f"User {user_id[:8]}",
                user_color=color,
                user_avatar=user_avatar,
            )

            self.presence[document_id][client_id] = presence

            logger.info(f"User {user_id} joined document {document_id}")

        if self.on_presence_change:
            await self.on_presence_change(document_id, presence, "join")

        return presence

    async def leave(self, document_id: str, client_id: str) -> Optional[UserPresence]:
        """
        Remove a user from a document.

        Args:
            document_id: Document being left
            client_id: Client leaving

        Returns:
            The removed UserPresence, or None if not found
        """
        async with self._lock:
            doc_presence = self.presence.get(document_id)
            if not doc_presence:
                return None

            presence = doc_presence.pop(client_id, None)

            # Clean up empty documents
            if not doc_presence:
                del self.presence[document_id]
                self._color_index.pop(document_id, None)

            if presence:
                logger.info(f"User {presence.user_id} left document {document_id}")

        if presence and self.on_presence_change:
            await self.on_presence_change(document_id, presence, "leave")

        return presence

    async def update_cursor(
        self,
        document_id: str,
        client_id: str,
        position: int,
        selection_start: Optional[int] = None,
        selection_end: Optional[int] = None,
    ) -> Optional[UserPresence]:
        """
        Update a user's cursor position.

        Args:
            document_id: Target document
            client_id: Client updating
            position: New cursor position
            selection_start: Selection start (optional)
            selection_end: Selection end (optional)

        Returns:
            Updated UserPresence, or None if not found
        """
        async with self._lock:
            doc_presence = self.presence.get(document_id)
            if not doc_presence:
                return None

            presence = doc_presence.get(client_id)
            if not presence:
                return None

            presence.cursor_position = position
            presence.selection_start = selection_start
            presence.selection_end = selection_end
            presence.last_activity = datetime.utcnow()
            presence.is_active = True

        if self.on_presence_change:
            await self.on_presence_change(document_id, presence, "cursor")

        return presence

    async def set_typing(
        self,
        document_id: str,
        client_id: str,
        is_typing: bool
    ) -> Optional[UserPresence]:
        """
        Update a user's typing status.

        Args:
            document_id: Target document
            client_id: Client updating
            is_typing: Whether user is typing

        Returns:
            Updated UserPresence, or None if not found
        """
        async with self._lock:
            doc_presence = self.presence.get(document_id)
            if not doc_presence:
                return None

            presence = doc_presence.get(client_id)
            if not presence:
                return None

            presence.is_typing = is_typing
            presence.last_activity = datetime.utcnow()
            presence.is_active = True

        if self.on_presence_change:
            await self.on_presence_change(document_id, presence, "typing")

        return presence

    async def mark_activity(self, document_id: str, client_id: str) -> bool:
        """
        Mark a client as active (heartbeat).

        Args:
            document_id: Target document
            client_id: Client sending heartbeat

        Returns:
            True if updated successfully
        """
        async with self._lock:
            doc_presence = self.presence.get(document_id)
            if not doc_presence:
                return False

            presence = doc_presence.get(client_id)
            if not presence:
                return False

            presence.last_activity = datetime.utcnow()
            presence.is_active = True

            return True

    def get_document_presence(self, document_id: str) -> list[UserPresence]:
        """Get all users present in a document."""
        doc_presence = self.presence.get(document_id, {})
        return list(doc_presence.values())

    def get_user_presence(
        self,
        document_id: str,
        client_id: str
    ) -> Optional[UserPresence]:
        """Get a specific user's presence."""
        doc_presence = self.presence.get(document_id, {})
        return doc_presence.get(client_id)

    def get_document_users(self, document_id: str) -> list[str]:
        """Get all user IDs in a document."""
        doc_presence = self.presence.get(document_id, {})
        return [p.user_id for p in doc_presence.values()]

    def get_active_documents(self) -> list[str]:
        """Get all documents with active users."""
        return list(self.presence.keys())

    async def cleanup_stale(self) -> list[tuple[str, UserPresence]]:
        """
        Remove stale presence entries.

        Returns:
            List of (document_id, presence) tuples that were removed
        """
        removed = []
        now = datetime.utcnow()
        stale_threshold = now - timedelta(seconds=self.stale_timeout)

        async with self._lock:
            for document_id in list(self.presence.keys()):
                doc_presence = self.presence[document_id]

                for client_id in list(doc_presence.keys()):
                    presence = doc_presence[client_id]

                    if presence.last_activity < stale_threshold:
                        removed_presence = doc_presence.pop(client_id)
                        removed.append((document_id, removed_presence))

                        logger.info(
                            f"Removed stale presence: {presence.user_id} "
                            f"from {document_id}"
                        )

                # Clean up empty documents
                if not doc_presence:
                    del self.presence[document_id]
                    self._color_index.pop(document_id, None)

        # Notify about removals
        if self.on_presence_change:
            for document_id, presence in removed:
                await self.on_presence_change(document_id, presence, "stale")

        return removed

    async def mark_idle_users(self) -> list[tuple[str, UserPresence]]:
        """
        Mark users as idle based on inactivity.

        Returns:
            List of (document_id, presence) tuples that were marked idle
        """
        marked_idle = []
        now = datetime.utcnow()
        idle_threshold = now - timedelta(seconds=self.idle_timeout)

        async with self._lock:
            for document_id, doc_presence in self.presence.items():
                for client_id, presence in doc_presence.items():
                    if presence.is_active and presence.last_activity < idle_threshold:
                        presence.is_active = False
                        marked_idle.append((document_id, presence))

        # Notify about idle users
        if self.on_presence_change:
            for document_id, presence in marked_idle:
                await self.on_presence_change(document_id, presence, "idle")

        return marked_idle

    def get_stats(self) -> dict:
        """Get presence statistics."""
        total_users = 0
        active_users = 0

        for doc_presence in self.presence.values():
            total_users += len(doc_presence)
            active_users += sum(1 for p in doc_presence.values() if p.is_active)

        return {
            "active_documents": len(self.presence),
            "total_users": total_users,
            "active_users": active_users,
            "idle_users": total_users - active_users,
        }
