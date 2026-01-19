"""Tests for Session Management."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.session import (
    SessionManager,
    SessionConfig,
    Session,
    SessionState,
    SessionData,
    SessionInfo,
    get_session_manager,
    set_session_manager,
    reset_session_manager,
)


class TestSessionState:
    """Tests for SessionState enum."""

    def test_state_values(self):
        """State values are correct."""
        assert SessionState.ACTIVE.value == "active"
        assert SessionState.IDLE.value == "idle"
        assert SessionState.DISCONNECTED.value == "disconnected"
        assert SessionState.EXPIRED.value == "expired"
        assert SessionState.TERMINATED.value == "terminated"


class TestSessionConfig:
    """Tests for SessionConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = SessionConfig()

        assert config.session_timeout == timedelta(hours=24)
        assert config.idle_timeout == timedelta(minutes=30)
        assert config.max_sessions_per_user == 10
        assert config.max_documents_per_session == 50

    def test_custom_config(self):
        """Custom configuration."""
        config = SessionConfig(
            session_timeout=timedelta(hours=1),
            max_sessions_per_user=5,
        )

        assert config.session_timeout == timedelta(hours=1)
        assert config.max_sessions_per_user == 5


class TestSessionData:
    """Tests for SessionData."""

    def test_create_session_data(self):
        """Create session data."""
        data = SessionData()

        assert data.cursor_positions == {}
        assert data.pending_operations == {}
        assert data.view_state == {}
        assert data.custom == {}

    def test_to_dict(self):
        """Convert to dictionary."""
        data = SessionData(
            cursor_positions={"doc1": {"line": 10}},
            custom={"key": "value"},
        )

        d = data.to_dict()

        assert d["cursor_positions"] == {"doc1": {"line": 10}}
        assert d["custom"] == {"key": "value"}

    def test_from_dict(self):
        """Create from dictionary."""
        d = {
            "cursor_positions": {"doc1": {"line": 5}},
            "pending_operations": {},
            "view_state": {},
            "custom": {"setting": True},
        }

        data = SessionData.from_dict(d)

        assert data.cursor_positions == {"doc1": {"line": 5}}
        assert data.custom == {"setting": True}


class TestSession:
    """Tests for Session."""

    @pytest.fixture
    def session(self):
        """Create a test session."""
        now = datetime.utcnow()
        return Session(
            id="sess_test123",
            user_id="user1",
            client_id="client1",
            state=SessionState.ACTIVE,
            created_at=now,
            last_activity=now,
            expires_at=now + timedelta(hours=24),
        )

    def test_is_active(self, session):
        """Check if session is active."""
        assert session.is_active() is True

        session.state = SessionState.IDLE
        assert session.is_active() is False

    def test_is_expired(self, session):
        """Check if session is expired."""
        assert session.is_expired() is False

        session.expires_at = datetime.utcnow() - timedelta(hours=1)
        assert session.is_expired() is True

    def test_is_idle(self, session):
        """Check if session is idle."""
        session.last_activity = datetime.utcnow()
        assert session.is_idle(timedelta(minutes=30)) is False

        session.last_activity = datetime.utcnow() - timedelta(hours=1)
        assert session.is_idle(timedelta(minutes=30)) is True

    def test_touch(self, session):
        """Update last activity."""
        old_activity = session.last_activity
        session.touch()

        assert session.last_activity >= old_activity

    def test_join_document(self, session):
        """Join a document."""
        session.join_document("doc1")

        assert "doc1" in session.documents

    def test_leave_document(self, session):
        """Leave a document."""
        session.join_document("doc1")
        session.data.cursor_positions["doc1"] = {"line": 10}

        session.leave_document("doc1")

        assert "doc1" not in session.documents
        assert "doc1" not in session.data.cursor_positions

    def test_to_dict(self, session):
        """Convert to dictionary."""
        session.join_document("doc1")

        d = session.to_dict()

        assert d["id"] == "sess_test123"
        assert d["user_id"] == "user1"
        assert d["state"] == "active"
        assert "doc1" in d["documents"]

    def test_from_dict(self):
        """Create from dictionary."""
        now = datetime.utcnow()
        d = {
            "id": "sess_abc",
            "user_id": "user2",
            "client_id": "client2",
            "state": "idle",
            "created_at": now.isoformat(),
            "last_activity": now.isoformat(),
            "expires_at": (now + timedelta(hours=1)).isoformat(),
            "documents": ["doc1", "doc2"],
            "data": {},
            "device_info": {"browser": "Chrome"},
        }

        session = Session.from_dict(d)

        assert session.id == "sess_abc"
        assert session.state == SessionState.IDLE
        assert "doc1" in session.documents


class TestSessionInfo:
    """Tests for SessionInfo."""

    def test_from_session(self):
        """Create from full session."""
        now = datetime.utcnow()
        session = Session(
            id="sess_test",
            user_id="user1",
            client_id="client1",
            state=SessionState.ACTIVE,
            created_at=now,
            last_activity=now,
            expires_at=now + timedelta(hours=24),
            documents={"doc1", "doc2"},
        )

        info = SessionInfo.from_session(session)

        assert info.id == "sess_test"
        assert info.document_count == 2

    def test_to_dict(self):
        """Convert to dictionary."""
        now = datetime.utcnow()
        info = SessionInfo(
            id="sess_test",
            user_id="user1",
            client_id="client1",
            state=SessionState.ACTIVE,
            created_at=now,
            last_activity=now,
            document_count=3,
        )

        d = info.to_dict()

        assert d["id"] == "sess_test"
        assert d["document_count"] == 3


class TestSessionManager:
    """Tests for SessionManager."""

    @pytest.fixture
    def manager(self):
        """Create a session manager."""
        return SessionManager()

    @pytest.mark.asyncio
    async def test_create_session(self, manager):
        """Create a new session."""
        session = await manager.create_session(
            user_id="user1",
            client_id="client1",
            device_info={"browser": "Chrome"},
        )

        assert session is not None
        assert session.user_id == "user1"
        assert session.client_id == "client1"
        assert session.state == SessionState.ACTIVE

    @pytest.mark.asyncio
    async def test_get_session(self, manager):
        """Get session by ID."""
        session = await manager.create_session("user1", "client1")

        retrieved = manager.get_session(session.id)

        assert retrieved is not None
        assert retrieved.id == session.id

    @pytest.mark.asyncio
    async def test_get_session_nonexistent(self, manager):
        """Get nonexistent session returns None."""
        retrieved = manager.get_session("nonexistent")
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_get_session_by_client(self, manager):
        """Get session by client ID."""
        session = await manager.create_session("user1", "client1")

        retrieved = manager.get_session_by_client("client1")

        assert retrieved is not None
        assert retrieved.id == session.id

    @pytest.mark.asyncio
    async def test_get_user_sessions(self, manager):
        """Get all sessions for a user."""
        await manager.create_session("user1", "client1")
        await manager.create_session("user1", "client2")
        await manager.create_session("user2", "client3")

        sessions = manager.get_user_sessions("user1")

        assert len(sessions) == 2

    @pytest.mark.asyncio
    async def test_update_activity(self, manager):
        """Update session activity."""
        session = await manager.create_session("user1", "client1")
        old_activity = session.last_activity

        await asyncio.sleep(0.01)
        result = await manager.update_activity(session.id)

        assert result is True
        assert session.last_activity > old_activity

    @pytest.mark.asyncio
    async def test_update_activity_reactivates_idle(self, manager):
        """Update activity reactivates idle session."""
        session = await manager.create_session("user1", "client1")
        session.state = SessionState.IDLE

        await manager.update_activity(session.id)

        assert session.state == SessionState.ACTIVE

    @pytest.mark.asyncio
    async def test_join_document(self, manager):
        """Join a document."""
        session = await manager.create_session("user1", "client1")

        result = await manager.join_document(session.id, "doc1")

        assert result is True
        assert "doc1" in session.documents

    @pytest.mark.asyncio
    async def test_join_document_max_limit(self, manager):
        """Cannot join more than max documents."""
        config = SessionConfig(max_documents_per_session=2)
        manager = SessionManager(config)
        session = await manager.create_session("user1", "client1")

        await manager.join_document(session.id, "doc1")
        await manager.join_document(session.id, "doc2")
        result = await manager.join_document(session.id, "doc3")

        assert result is False
        assert len(session.documents) == 2

    @pytest.mark.asyncio
    async def test_leave_document(self, manager):
        """Leave a document."""
        session = await manager.create_session("user1", "client1")
        await manager.join_document(session.id, "doc1")

        result = await manager.leave_document(session.id, "doc1")

        assert result is True
        assert "doc1" not in session.documents

    @pytest.mark.asyncio
    async def test_get_document_sessions(self, manager):
        """Get all sessions in a document."""
        s1 = await manager.create_session("user1", "client1")
        s2 = await manager.create_session("user2", "client2")
        await manager.join_document(s1.id, "doc1")
        await manager.join_document(s2.id, "doc1")

        sessions = manager.get_document_sessions("doc1")

        assert len(sessions) == 2

    @pytest.mark.asyncio
    async def test_disconnect_session(self, manager):
        """Disconnect a session."""
        session = await manager.create_session("user1", "client1")

        result = await manager.disconnect_session(session.id)

        assert result is True
        assert session.state == SessionState.DISCONNECTED

    @pytest.mark.asyncio
    async def test_reconnect_session(self, manager):
        """Reconnect a disconnected session."""
        session = await manager.create_session("user1", "client1")
        await manager.disconnect_session(session.id)

        reconnected = await manager.reconnect_session(session.id, "new_client")

        assert reconnected is not None
        assert reconnected.client_id == "new_client"
        assert reconnected.state == SessionState.ACTIVE

    @pytest.mark.asyncio
    async def test_reconnect_session_not_disconnected(self, manager):
        """Cannot reconnect active session."""
        session = await manager.create_session("user1", "client1")

        reconnected = await manager.reconnect_session(session.id, "new_client")

        assert reconnected is None

    @pytest.mark.asyncio
    async def test_reconnect_expired_session(self, manager):
        """Cannot reconnect expired session."""
        session = await manager.create_session("user1", "client1")
        session.expires_at = datetime.utcnow() - timedelta(hours=1)
        await manager.disconnect_session(session.id)

        reconnected = await manager.reconnect_session(session.id, "new_client")

        assert reconnected is None

    @pytest.mark.asyncio
    async def test_terminate_session(self, manager):
        """Terminate a session."""
        session = await manager.create_session("user1", "client1")

        result = await manager.terminate_session(session.id, "test_reason")

        assert result is True
        assert manager.get_session(session.id) is None

    @pytest.mark.asyncio
    async def test_terminate_user_sessions(self, manager):
        """Terminate all sessions for a user."""
        await manager.create_session("user1", "client1")
        await manager.create_session("user1", "client2")
        await manager.create_session("user2", "client3")

        count = await manager.terminate_user_sessions("user1", "logout")

        assert count == 2
        assert len(manager.get_user_sessions("user1")) == 0

    @pytest.mark.asyncio
    async def test_max_sessions_per_user(self, manager):
        """Oldest session terminated when max reached."""
        config = SessionConfig(max_sessions_per_user=2)
        manager = SessionManager(config)

        s1 = await manager.create_session("user1", "client1")
        await asyncio.sleep(0.01)
        s2 = await manager.create_session("user1", "client2")
        await asyncio.sleep(0.01)
        s3 = await manager.create_session("user1", "client3")

        sessions = manager.get_user_sessions("user1")
        session_ids = [s.id for s in sessions]

        assert len(sessions) == 2
        assert s1.id not in session_ids  # Oldest should be removed
        assert s3.id in session_ids

    @pytest.mark.asyncio
    async def test_save_session_data_cursor(self, manager):
        """Save cursor data."""
        session = await manager.create_session("user1", "client1")
        cursor = {"line": 10, "col": 5}

        result = await manager.save_session_data(
            session.id, "doc1", "cursor", cursor
        )

        assert result is True
        assert session.data.cursor_positions["doc1"] == cursor

    @pytest.mark.asyncio
    async def test_save_session_data_pending_ops(self, manager):
        """Save pending operations data."""
        session = await manager.create_session("user1", "client1")
        ops = [{"type": "insert", "pos": 0}]

        result = await manager.save_session_data(
            session.id, "doc1", "pending_ops", ops
        )

        assert result is True
        assert session.data.pending_operations["doc1"] == ops

    @pytest.mark.asyncio
    async def test_save_session_data_custom(self, manager):
        """Save custom data."""
        session = await manager.create_session("user1", "client1")

        result = await manager.save_session_data(
            session.id, "doc1", "custom_key", {"value": 123}
        )

        assert result is True
        assert session.data.custom["doc1"]["custom_key"] == {"value": 123}

    @pytest.mark.asyncio
    async def test_get_session_data(self, manager):
        """Get session data."""
        session = await manager.create_session("user1", "client1")
        await manager.save_session_data(
            session.id, "doc1", "cursor", {"line": 5}
        )

        cursor = manager.get_session_data(session.id, "doc1", "cursor")

        assert cursor == {"line": 5}

    @pytest.mark.asyncio
    async def test_get_session_data_nonexistent(self, manager):
        """Get nonexistent data returns None."""
        session = await manager.create_session("user1", "client1")

        data = manager.get_session_data(session.id, "doc1", "cursor")

        assert data is None

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Start and stop manager."""
        await manager.start()
        assert manager._running is True

        await manager.stop()
        assert manager._running is False

    @pytest.mark.asyncio
    async def test_session_callbacks(self, manager):
        """Session callbacks are invoked."""
        created_sessions = []
        terminated_sessions = []

        async def on_created(session):
            created_sessions.append(session)

        async def on_terminated(session):
            terminated_sessions.append(session)

        manager.on_session_created = on_created
        manager.on_session_terminated = on_terminated

        session = await manager.create_session("user1", "client1")
        await manager.terminate_session(session.id)

        assert len(created_sessions) == 1
        assert len(terminated_sessions) == 1

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "total_sessions" in stats
        assert "active_sessions" in stats
        assert "sessions_created" in stats


class TestGlobalSessionManager:
    """Tests for global session manager functions."""

    def test_get_session_manager(self):
        """Get global session manager."""
        reset_session_manager()

        manager = get_session_manager()

        assert manager is not None
        assert isinstance(manager, SessionManager)

    def test_set_session_manager(self):
        """Set global session manager."""
        reset_session_manager()

        custom = SessionManager()
        set_session_manager(custom)

        assert get_session_manager() is custom

    def test_reset_session_manager(self):
        """Reset global session manager."""
        get_session_manager()

        reset_session_manager()

        # Next call creates a new one
        manager = get_session_manager()
        assert manager is not None


class TestSessionCleanup:
    """Tests for session cleanup."""

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions(self):
        """Expired sessions are cleaned up."""
        manager = SessionManager()
        session = await manager.create_session("user1", "client1")
        session.expires_at = datetime.utcnow() - timedelta(hours=1)

        count = await manager._cleanup_expired()

        assert count == 1
        assert manager.get_session(session.id) is None

    @pytest.mark.asyncio
    async def test_cleanup_idle_sessions(self):
        """Idle sessions are marked as idle."""
        config = SessionConfig(idle_timeout=timedelta(seconds=0))
        manager = SessionManager(config)
        session = await manager.create_session("user1", "client1")
        session.last_activity = datetime.utcnow() - timedelta(minutes=1)

        count = await manager._cleanup_idle()

        assert count == 1
        assert session.state == SessionState.IDLE
