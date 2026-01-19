"""
Session Management for Collaboration Gateway

Provides:
- User session lifecycle management
- Session state persistence
- Multi-device session support
- Session timeouts and cleanup
- Session metadata tracking

Integrates with WebSocket connections for real-time collaboration.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from typing import Optional, Any, Callable, Awaitable, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

import logging

logger = logging.getLogger(__name__)


class SessionState(Enum):
    """Session states."""
    ACTIVE = "active"
    IDLE = "idle"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    TERMINATED = "terminated"


@dataclass
class SessionConfig:
    """Session configuration."""
    session_timeout: timedelta = timedelta(hours=24)
    idle_timeout: timedelta = timedelta(minutes=30)
    max_sessions_per_user: int = 10
    max_documents_per_session: int = 50
    heartbeat_interval: float = 30.0
    cleanup_interval: float = 60.0
    enable_multi_device: bool = True
    persist_state: bool = True


@dataclass
class SessionData:
    """Data associated with a session."""
    cursor_positions: dict[str, dict] = field(default_factory=dict)  # doc_id -> cursor
    pending_operations: dict[str, list] = field(default_factory=dict)  # doc_id -> ops
    view_state: dict[str, dict] = field(default_factory=dict)  # doc_id -> view state
    custom: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "cursor_positions": self.cursor_positions,
            "pending_operations": self.pending_operations,
            "view_state": self.view_state,
            "custom": self.custom,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SessionData":
        """Create from dictionary."""
        return cls(
            cursor_positions=data.get("cursor_positions", {}),
            pending_operations=data.get("pending_operations", {}),
            view_state=data.get("view_state", {}),
            custom=data.get("custom", {}),
        )


@dataclass
class Session:
    """A user session."""
    id: str
    user_id: str
    client_id: str
    state: SessionState
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    documents: set[str] = field(default_factory=set)
    data: SessionData = field(default_factory=SessionData)
    device_info: dict = field(default_factory=dict)
    ip_address: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def is_active(self) -> bool:
        """Check if session is active."""
        return self.state == SessionState.ACTIVE

    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.utcnow() > self.expires_at

    def is_idle(self, idle_timeout: timedelta) -> bool:
        """Check if session is idle."""
        return datetime.utcnow() - self.last_activity > idle_timeout

    def touch(self) -> None:
        """Update last activity timestamp."""
        self.last_activity = datetime.utcnow()

    def join_document(self, document_id: str) -> None:
        """Join a document."""
        self.documents.add(document_id)
        self.touch()

    def leave_document(self, document_id: str) -> None:
        """Leave a document."""
        self.documents.discard(document_id)
        # Clean up document-specific data
        self.data.cursor_positions.pop(document_id, None)
        self.data.pending_operations.pop(document_id, None)
        self.data.view_state.pop(document_id, None)
        self.touch()

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "state": self.state.value,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "documents": list(self.documents),
            "data": self.data.to_dict(),
            "device_info": self.device_info,
            "ip_address": self.ip_address,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Session":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            user_id=data["user_id"],
            client_id=data["client_id"],
            state=SessionState(data["state"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            last_activity=datetime.fromisoformat(data["last_activity"]),
            expires_at=datetime.fromisoformat(data["expires_at"]),
            documents=set(data.get("documents", [])),
            data=SessionData.from_dict(data.get("data", {})),
            device_info=data.get("device_info", {}),
            ip_address=data.get("ip_address"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class SessionInfo:
    """Lightweight session info without full data."""
    id: str
    user_id: str
    client_id: str
    state: SessionState
    created_at: datetime
    last_activity: datetime
    document_count: int

    @classmethod
    def from_session(cls, session: Session) -> "SessionInfo":
        """Create from full session."""
        return cls(
            id=session.id,
            user_id=session.user_id,
            client_id=session.client_id,
            state=session.state,
            created_at=session.created_at,
            last_activity=session.last_activity,
            document_count=len(session.documents),
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "state": self.state.value,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "document_count": self.document_count,
        }


class SessionManager:
    """Manages user sessions."""

    def __init__(self, config: Optional[SessionConfig] = None):
        self.config = config or SessionConfig()
        self._sessions: dict[str, Session] = {}  # session_id -> session
        self._user_sessions: dict[str, set[str]] = defaultdict(set)  # user_id -> session_ids
        self._client_sessions: dict[str, str] = {}  # client_id -> session_id
        self._document_sessions: dict[str, set[str]] = defaultdict(set)  # doc_id -> session_ids
        self._lock = asyncio.Lock()
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None

        # Callbacks
        self.on_session_created: Optional[
            Callable[[Session], Awaitable[None]]
        ] = None
        self.on_session_expired: Optional[
            Callable[[Session], Awaitable[None]]
        ] = None
        self.on_session_terminated: Optional[
            Callable[[Session], Awaitable[None]]
        ] = None

        # Stats
        self._sessions_created = 0
        self._sessions_expired = 0
        self._sessions_terminated = 0

    async def start(self) -> None:
        """Start session manager."""
        if self._running:
            return

        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        """Stop session manager."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self) -> None:
        """Periodic cleanup of expired sessions."""
        while self._running:
            try:
                await asyncio.sleep(self.config.cleanup_interval)
                await self._cleanup_expired()
                await self._cleanup_idle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Session cleanup error: {e}")

    async def _cleanup_expired(self) -> int:
        """Clean up expired sessions."""
        now = datetime.utcnow()
        expired = []

        async with self._lock:
            for session_id, session in list(self._sessions.items()):
                if session.is_expired():
                    expired.append(session)

        for session in expired:
            await self._expire_session(session)

        return len(expired)

    async def _cleanup_idle(self) -> int:
        """Clean up idle sessions."""
        idle = []

        async with self._lock:
            for session in self._sessions.values():
                if (session.state == SessionState.ACTIVE and
                        session.is_idle(self.config.idle_timeout)):
                    idle.append(session)

        for session in idle:
            async with self._lock:
                session.state = SessionState.IDLE

        return len(idle)

    async def _expire_session(self, session: Session) -> None:
        """Expire a session."""
        async with self._lock:
            session.state = SessionState.EXPIRED
            self._sessions_expired += 1

        if self.on_session_expired:
            try:
                await self.on_session_expired(session)
            except Exception as e:
                logger.error(f"Session expired callback error: {e}")

        await self._remove_session(session.id)

    async def _remove_session(self, session_id: str) -> None:
        """Remove a session from all indexes."""
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if not session:
                return

            self._user_sessions[session.user_id].discard(session_id)
            self._client_sessions.pop(session.client_id, None)

            for doc_id in session.documents:
                self._document_sessions[doc_id].discard(session_id)

    async def create_session(
        self,
        user_id: str,
        client_id: str,
        device_info: Optional[dict] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> Session:
        """Create a new session."""
        # Check max sessions per user (outside lock to avoid deadlock)
        oldest_to_remove = None
        async with self._lock:
            user_session_count = len(self._user_sessions[user_id])
            if user_session_count >= self.config.max_sessions_per_user:
                # Find oldest session to remove
                oldest_to_remove = await self._get_oldest_user_session(user_id)

        # Terminate oldest session outside lock to avoid deadlock
        if oldest_to_remove:
            await self.terminate_session(oldest_to_remove.id, "max_sessions_exceeded")

        now = datetime.utcnow()
        session_id = f"sess_{secrets.token_hex(16)}"

        session = Session(
            id=session_id,
            user_id=user_id,
            client_id=client_id,
            state=SessionState.ACTIVE,
            created_at=now,
            last_activity=now,
            expires_at=now + self.config.session_timeout,
            device_info=device_info or {},
            ip_address=ip_address,
            metadata=metadata or {},
        )

        async with self._lock:
            self._sessions[session_id] = session
            self._user_sessions[user_id].add(session_id)
            self._client_sessions[client_id] = session_id
            self._sessions_created += 1

        if self.on_session_created:
            try:
                await self.on_session_created(session)
            except Exception as e:
                logger.error(f"Session created callback error: {e}")

        return session

    async def _get_oldest_user_session(self, user_id: str) -> Optional[Session]:
        """Get the oldest session for a user."""
        session_ids = self._user_sessions.get(user_id, set())
        oldest = None

        for sid in session_ids:
            session = self._sessions.get(sid)
            if session and (oldest is None or session.created_at < oldest.created_at):
                oldest = session

        return oldest

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get session by ID."""
        return self._sessions.get(session_id)

    def get_session_by_client(self, client_id: str) -> Optional[Session]:
        """Get session by client ID."""
        session_id = self._client_sessions.get(client_id)
        if session_id:
            return self._sessions.get(session_id)
        return None

    def get_user_sessions(self, user_id: str) -> list[Session]:
        """Get all sessions for a user."""
        session_ids = self._user_sessions.get(user_id, set())
        return [
            self._sessions[sid]
            for sid in session_ids
            if sid in self._sessions
        ]

    def get_document_sessions(self, document_id: str) -> list[Session]:
        """Get all sessions in a document."""
        session_ids = self._document_sessions.get(document_id, set())
        return [
            self._sessions[sid]
            for sid in session_ids
            if sid in self._sessions
        ]

    async def update_activity(self, session_id: str) -> bool:
        """Update session activity timestamp."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        async with self._lock:
            session.touch()
            if session.state == SessionState.IDLE:
                session.state = SessionState.ACTIVE

        return True

    async def join_document(
        self,
        session_id: str,
        document_id: str
    ) -> bool:
        """Add document to session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        if len(session.documents) >= self.config.max_documents_per_session:
            return False

        async with self._lock:
            session.join_document(document_id)
            self._document_sessions[document_id].add(session_id)

        return True

    async def leave_document(
        self,
        session_id: str,
        document_id: str
    ) -> bool:
        """Remove document from session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        async with self._lock:
            session.leave_document(document_id)
            self._document_sessions[document_id].discard(session_id)

        return True

    async def disconnect_session(self, session_id: str) -> bool:
        """Mark session as disconnected (for reconnection)."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        async with self._lock:
            session.state = SessionState.DISCONNECTED
            self._client_sessions.pop(session.client_id, None)

        return True

    async def reconnect_session(
        self,
        session_id: str,
        new_client_id: str
    ) -> Optional[Session]:
        """Reconnect to a disconnected session."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        if session.state not in (SessionState.DISCONNECTED, SessionState.IDLE):
            return None

        if session.is_expired():
            await self._expire_session(session)
            return None

        async with self._lock:
            session.client_id = new_client_id
            session.state = SessionState.ACTIVE
            session.touch()
            self._client_sessions[new_client_id] = session_id

        return session

    async def terminate_session(
        self,
        session_id: str,
        reason: str = "user_request"
    ) -> bool:
        """Terminate a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        async with self._lock:
            session.state = SessionState.TERMINATED
            session.metadata["termination_reason"] = reason
            self._sessions_terminated += 1

        if self.on_session_terminated:
            try:
                await self.on_session_terminated(session)
            except Exception as e:
                logger.error(f"Session terminated callback error: {e}")

        await self._remove_session(session_id)

        return True

    async def terminate_user_sessions(
        self,
        user_id: str,
        reason: str = "user_request"
    ) -> int:
        """Terminate all sessions for a user."""
        sessions = self.get_user_sessions(user_id)
        count = 0

        for session in sessions:
            if await self.terminate_session(session.id, reason):
                count += 1

        return count

    async def save_session_data(
        self,
        session_id: str,
        document_id: str,
        data_type: str,
        data: Any
    ) -> bool:
        """Save session data for a document."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        async with self._lock:
            if data_type == "cursor":
                session.data.cursor_positions[document_id] = data
            elif data_type == "pending_ops":
                session.data.pending_operations[document_id] = data
            elif data_type == "view_state":
                session.data.view_state[document_id] = data
            else:
                if document_id not in session.data.custom:
                    session.data.custom[document_id] = {}
                session.data.custom[document_id][data_type] = data

            session.touch()

        return True

    def get_session_data(
        self,
        session_id: str,
        document_id: str,
        data_type: str
    ) -> Optional[Any]:
        """Get session data for a document."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        if data_type == "cursor":
            return session.data.cursor_positions.get(document_id)
        elif data_type == "pending_ops":
            return session.data.pending_operations.get(document_id)
        elif data_type == "view_state":
            return session.data.view_state.get(document_id)
        else:
            custom = session.data.custom.get(document_id, {})
            return custom.get(data_type)

    def get_stats(self) -> dict:
        """Get session manager statistics."""
        active = sum(1 for s in self._sessions.values() if s.state == SessionState.ACTIVE)
        idle = sum(1 for s in self._sessions.values() if s.state == SessionState.IDLE)
        disconnected = sum(1 for s in self._sessions.values() if s.state == SessionState.DISCONNECTED)

        return {
            "total_sessions": len(self._sessions),
            "active_sessions": active,
            "idle_sessions": idle,
            "disconnected_sessions": disconnected,
            "unique_users": len(self._user_sessions),
            "sessions_created": self._sessions_created,
            "sessions_expired": self._sessions_expired,
            "sessions_terminated": self._sessions_terminated,
            "running": self._running,
        }


# Global session manager
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get global session manager."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager


def set_session_manager(manager: SessionManager) -> None:
    """Set global session manager."""
    global _session_manager
    _session_manager = manager


def reset_session_manager() -> None:
    """Reset global session manager."""
    global _session_manager
    _session_manager = None
