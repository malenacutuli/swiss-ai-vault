"""Tests for Presence Manager."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

from app.collaboration.presence import PresenceManager, UserPresence, DEFAULT_COLORS


class TestPresenceManager:
    """Tests for PresenceManager."""

    @pytest.fixture
    def manager(self):
        return PresenceManager(idle_timeout=300, stale_timeout=60)

    @pytest.mark.asyncio
    async def test_join_creates_presence(self, manager):
        """Join creates presence entry."""
        presence = await manager.join(
            document_id="doc_1",
            user_id="user_1",
            client_id="client_1",
            user_name="Alice"
        )

        assert presence.user_id == "user_1"
        assert presence.document_id == "doc_1"
        assert presence.user_name == "Alice"
        assert presence.user_color in DEFAULT_COLORS
        assert presence.is_active is True

    @pytest.mark.asyncio
    async def test_join_assigns_unique_colors(self, manager):
        """Each user gets a unique color."""
        p1 = await manager.join("doc_1", "user_1", "client_1")
        p2 = await manager.join("doc_1", "user_2", "client_2")
        p3 = await manager.join("doc_1", "user_3", "client_3")

        colors = {p1.user_color, p2.user_color, p3.user_color}
        assert len(colors) == 3  # All different

    @pytest.mark.asyncio
    async def test_leave_removes_presence(self, manager):
        """Leave removes presence entry."""
        await manager.join("doc_1", "user_1", "client_1")
        removed = await manager.leave("doc_1", "client_1")

        assert removed is not None
        assert removed.user_id == "user_1"
        assert manager.get_user_presence("doc_1", "client_1") is None

    @pytest.mark.asyncio
    async def test_leave_unknown_returns_none(self, manager):
        """Leave unknown client returns None."""
        result = await manager.leave("doc_1", "unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_cursor(self, manager):
        """Update cursor position."""
        await manager.join("doc_1", "user_1", "client_1")
        presence = await manager.update_cursor(
            "doc_1", "client_1", position=10, selection_start=5, selection_end=10
        )

        assert presence.cursor_position == 10
        assert presence.selection_start == 5
        assert presence.selection_end == 10
        assert presence.is_active is True

    @pytest.mark.asyncio
    async def test_update_cursor_unknown_returns_none(self, manager):
        """Update cursor for unknown client returns None."""
        result = await manager.update_cursor("doc_1", "unknown", position=10)
        assert result is None

    @pytest.mark.asyncio
    async def test_set_typing(self, manager):
        """Set typing status."""
        await manager.join("doc_1", "user_1", "client_1")

        presence = await manager.set_typing("doc_1", "client_1", is_typing=True)
        assert presence.is_typing is True

        presence = await manager.set_typing("doc_1", "client_1", is_typing=False)
        assert presence.is_typing is False

    @pytest.mark.asyncio
    async def test_mark_activity(self, manager):
        """Mark activity updates last_activity."""
        await manager.join("doc_1", "user_1", "client_1")
        presence = manager.get_user_presence("doc_1", "client_1")
        old_activity = presence.last_activity

        # Small delay
        import asyncio
        await asyncio.sleep(0.01)

        result = await manager.mark_activity("doc_1", "client_1")
        assert result is True
        assert presence.last_activity > old_activity

    @pytest.mark.asyncio
    async def test_get_document_presence(self, manager):
        """Get all presence in a document."""
        await manager.join("doc_1", "user_1", "client_1")
        await manager.join("doc_1", "user_2", "client_2")
        await manager.join("doc_2", "user_3", "client_3")

        presence_list = manager.get_document_presence("doc_1")

        assert len(presence_list) == 2
        user_ids = {p.user_id for p in presence_list}
        assert "user_1" in user_ids
        assert "user_2" in user_ids

    @pytest.mark.asyncio
    async def test_get_document_users(self, manager):
        """Get all user IDs in a document."""
        await manager.join("doc_1", "user_1", "client_1")
        await manager.join("doc_1", "user_2", "client_2")

        users = manager.get_document_users("doc_1")

        assert len(users) == 2
        assert "user_1" in users
        assert "user_2" in users

    @pytest.mark.asyncio
    async def test_get_active_documents(self, manager):
        """Get all documents with active users."""
        await manager.join("doc_1", "user_1", "client_1")
        await manager.join("doc_2", "user_2", "client_2")

        docs = manager.get_active_documents()

        assert len(docs) == 2
        assert "doc_1" in docs
        assert "doc_2" in docs

    @pytest.mark.asyncio
    async def test_cleanup_stale(self, manager):
        """Cleanup removes stale presence entries."""
        # Create manager with short stale timeout
        manager = PresenceManager(stale_timeout=0)

        await manager.join("doc_1", "user_1", "client_1")

        # Force presence to be stale
        presence = manager.get_user_presence("doc_1", "client_1")
        presence.last_activity = datetime.utcnow() - timedelta(seconds=1)

        removed = await manager.cleanup_stale()

        assert len(removed) == 1
        assert removed[0][0] == "doc_1"
        assert removed[0][1].user_id == "user_1"
        assert manager.get_document_presence("doc_1") == []

    @pytest.mark.asyncio
    async def test_mark_idle_users(self, manager):
        """Mark users as idle after timeout."""
        # Create manager with short idle timeout
        manager = PresenceManager(idle_timeout=0)

        await manager.join("doc_1", "user_1", "client_1")

        # Force presence to be old
        presence = manager.get_user_presence("doc_1", "client_1")
        presence.last_activity = datetime.utcnow() - timedelta(seconds=1)

        marked = await manager.mark_idle_users()

        assert len(marked) == 1
        assert presence.is_active is False

    @pytest.mark.asyncio
    async def test_on_presence_change_callback_join(self, manager):
        """Presence change callback on join."""
        events = []

        async def callback(doc_id, presence, event_type):
            events.append((doc_id, presence.user_id, event_type))

        manager.on_presence_change = callback

        await manager.join("doc_1", "user_1", "client_1")

        assert len(events) == 1
        assert events[0] == ("doc_1", "user_1", "join")

    @pytest.mark.asyncio
    async def test_on_presence_change_callback_leave(self, manager):
        """Presence change callback on leave."""
        events = []

        async def callback(doc_id, presence, event_type):
            events.append((doc_id, presence.user_id, event_type))

        manager.on_presence_change = callback

        await manager.join("doc_1", "user_1", "client_1")
        await manager.leave("doc_1", "client_1")

        assert len(events) == 2
        assert events[1] == ("doc_1", "user_1", "leave")

    @pytest.mark.asyncio
    async def test_on_presence_change_callback_cursor(self, manager):
        """Presence change callback on cursor update."""
        events = []

        async def callback(doc_id, presence, event_type):
            events.append((doc_id, presence.user_id, event_type))

        manager.on_presence_change = callback

        await manager.join("doc_1", "user_1", "client_1")
        await manager.update_cursor("doc_1", "client_1", position=10)

        assert len(events) == 2
        assert events[1] == ("doc_1", "user_1", "cursor")

    @pytest.mark.asyncio
    async def test_get_stats(self, manager):
        """Get presence statistics."""
        await manager.join("doc_1", "user_1", "client_1")
        await manager.join("doc_1", "user_2", "client_2")
        await manager.join("doc_2", "user_3", "client_3")

        # Mark one as idle
        presence = manager.get_user_presence("doc_1", "client_1")
        presence.is_active = False

        stats = manager.get_stats()

        assert stats["active_documents"] == 2
        assert stats["total_users"] == 3
        assert stats["active_users"] == 2
        assert stats["idle_users"] == 1

    @pytest.mark.asyncio
    async def test_presence_to_dict(self, manager):
        """Presence can be serialized to dict."""
        presence = await manager.join("doc_1", "user_1", "client_1", user_name="Alice")

        d = presence.to_dict()

        assert d["user_id"] == "user_1"
        assert d["client_id"] == "client_1"
        assert d["user_name"] == "Alice"
        assert "cursor_position" in d
        assert "is_active" in d

    @pytest.mark.asyncio
    async def test_empty_document_cleanup(self, manager):
        """Empty document is cleaned up after last user leaves."""
        await manager.join("doc_1", "user_1", "client_1")
        await manager.leave("doc_1", "client_1")

        assert "doc_1" not in manager.get_active_documents()
