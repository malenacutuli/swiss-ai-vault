"""
Reconnection Handling for Collaboration Gateway

Provides:
- Graceful reconnection after disconnection
- State recovery and synchronization
- Missed operation replay
- Reconnection tokens for authentication
- Backoff strategies for reconnection attempts

Integrates with session management for seamless reconnection.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from typing import Optional, Any, Callable, Awaitable, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

import logging

logger = logging.getLogger(__name__)


class ReconnectionState(Enum):
    """Reconnection states."""
    PENDING = "pending"
    VALIDATING = "validating"
    RECOVERING = "recovering"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ReconnectionConfig:
    """Reconnection configuration."""
    token_ttl: timedelta = timedelta(hours=1)
    max_reconnect_attempts: int = 5
    base_backoff: float = 1.0
    max_backoff: float = 60.0
    backoff_multiplier: float = 2.0
    sync_batch_size: int = 100
    max_pending_operations: int = 1000
    recovery_timeout: float = 30.0


@dataclass
class ReconnectionToken:
    """Token for reconnection authentication."""
    token: str
    session_id: str
    user_id: str
    created_at: datetime
    expires_at: datetime
    metadata: dict = field(default_factory=dict)

    def is_valid(self) -> bool:
        """Check if token is valid."""
        return datetime.utcnow() < self.expires_at

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "token": self.token,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ReconnectionToken":
        """Create from dictionary."""
        return cls(
            token=data["token"],
            session_id=data["session_id"],
            user_id=data["user_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"]),
            metadata=data.get("metadata", {}),
        )


@dataclass
class PendingOperation:
    """An operation pending sync after reconnection."""
    id: str
    document_id: str
    operation: dict
    version: int
    timestamp: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "operation": self.operation,
            "version": self.version,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class RecoveryState:
    """State needed for recovery after reconnection."""
    session_id: str
    documents: dict[str, int]  # document_id -> last_known_version
    cursor_positions: dict[str, dict]  # document_id -> cursor
    pending_operations: list[PendingOperation]
    timestamp: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "session_id": self.session_id,
            "documents": self.documents,
            "cursor_positions": self.cursor_positions,
            "pending_operations": [op.to_dict() for op in self.pending_operations],
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RecoveryState":
        """Create from dictionary."""
        return cls(
            session_id=data["session_id"],
            documents=data["documents"],
            cursor_positions=data["cursor_positions"],
            pending_operations=[
                PendingOperation(
                    id=op["id"],
                    document_id=op["document_id"],
                    operation=op["operation"],
                    version=op["version"],
                    timestamp=datetime.fromisoformat(op["timestamp"]),
                )
                for op in data.get("pending_operations", [])
            ],
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


@dataclass
class ReconnectionResult:
    """Result of a reconnection attempt."""
    success: bool
    session_id: Optional[str]
    state: ReconnectionState
    message: str
    missed_operations: int = 0
    recovery_data: Optional[dict] = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "session_id": self.session_id,
            "state": self.state.value,
            "message": self.message,
            "missed_operations": self.missed_operations,
            "recovery_data": self.recovery_data,
        }


class BackoffStrategy:
    """Exponential backoff strategy for reconnection."""

    def __init__(self, config: ReconnectionConfig):
        self.config = config
        self._attempts: dict[str, int] = {}  # session_id -> attempt count
        self._last_attempt: dict[str, float] = {}  # session_id -> timestamp

    def get_delay(self, session_id: str) -> float:
        """Get delay before next reconnection attempt."""
        attempts = self._attempts.get(session_id, 0)
        delay = min(
            self.config.base_backoff * (self.config.backoff_multiplier ** attempts),
            self.config.max_backoff
        )
        return delay

    def record_attempt(self, session_id: str) -> None:
        """Record a reconnection attempt."""
        self._attempts[session_id] = self._attempts.get(session_id, 0) + 1
        self._last_attempt[session_id] = time.monotonic()

    def reset(self, session_id: str) -> None:
        """Reset backoff for a session."""
        self._attempts.pop(session_id, None)
        self._last_attempt.pop(session_id, None)

    def can_attempt(self, session_id: str) -> bool:
        """Check if another attempt is allowed."""
        attempts = self._attempts.get(session_id, 0)
        if attempts >= self.config.max_reconnect_attempts:
            return False

        last = self._last_attempt.get(session_id)
        if last is not None:
            delay = self.get_delay(session_id)
            if time.monotonic() - last < delay:
                return False

        return True

    def get_attempt_count(self, session_id: str) -> int:
        """Get number of attempts for a session."""
        return self._attempts.get(session_id, 0)


class ReconnectionManager:
    """Manages reconnection handling."""

    def __init__(self, config: Optional[ReconnectionConfig] = None):
        self.config = config or ReconnectionConfig()
        self._tokens: dict[str, ReconnectionToken] = {}  # token -> ReconnectionToken
        self._session_tokens: dict[str, str] = {}  # session_id -> token
        self._recovery_states: dict[str, RecoveryState] = {}  # session_id -> state
        self._backoff = BackoffStrategy(self.config)
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_reconnection_started: Optional[
            Callable[[str], Awaitable[None]]
        ] = None
        self.on_reconnection_completed: Optional[
            Callable[[str, ReconnectionResult], Awaitable[None]]
        ] = None
        self.get_document_operations: Optional[
            Callable[[str, int, int], Awaitable[list[dict]]]
        ] = None  # doc_id, from_version, to_version -> operations

        # Stats
        self._tokens_issued = 0
        self._reconnections_attempted = 0
        self._reconnections_successful = 0
        self._reconnections_failed = 0

    async def create_token(
        self,
        session_id: str,
        user_id: str,
        metadata: Optional[dict] = None
    ) -> ReconnectionToken:
        """Create a reconnection token."""
        now = datetime.utcnow()
        token_str = secrets.token_urlsafe(32)

        token = ReconnectionToken(
            token=token_str,
            session_id=session_id,
            user_id=user_id,
            created_at=now,
            expires_at=now + self.config.token_ttl,
            metadata=metadata or {},
        )

        async with self._lock:
            # Revoke any existing token for this session
            old_token = self._session_tokens.get(session_id)
            if old_token:
                self._tokens.pop(old_token, None)

            self._tokens[token_str] = token
            self._session_tokens[session_id] = token_str
            self._tokens_issued += 1

        return token

    def validate_token(self, token: str) -> Optional[ReconnectionToken]:
        """Validate a reconnection token."""
        token_obj = self._tokens.get(token)
        if token_obj and token_obj.is_valid():
            return token_obj
        return None

    async def revoke_token(self, session_id: str) -> bool:
        """Revoke reconnection token for a session."""
        async with self._lock:
            token = self._session_tokens.pop(session_id, None)
            if token:
                self._tokens.pop(token, None)
                return True
        return False

    async def save_recovery_state(
        self,
        session_id: str,
        documents: dict[str, int],
        cursor_positions: dict[str, dict],
        pending_operations: Optional[list[PendingOperation]] = None
    ) -> None:
        """Save state for recovery after disconnection."""
        state = RecoveryState(
            session_id=session_id,
            documents=documents,
            cursor_positions=cursor_positions,
            pending_operations=pending_operations or [],
            timestamp=datetime.utcnow(),
        )

        async with self._lock:
            self._recovery_states[session_id] = state

    def get_recovery_state(self, session_id: str) -> Optional[RecoveryState]:
        """Get recovery state for a session."""
        return self._recovery_states.get(session_id)

    async def clear_recovery_state(self, session_id: str) -> None:
        """Clear recovery state after successful reconnection."""
        async with self._lock:
            self._recovery_states.pop(session_id, None)

    async def attempt_reconnection(
        self,
        token: str,
        new_client_id: str,
        client_state: Optional[dict] = None
    ) -> ReconnectionResult:
        """Attempt to reconnect with a token."""
        self._reconnections_attempted += 1

        # Validate token
        token_obj = self.validate_token(token)
        if not token_obj:
            self._reconnections_failed += 1
            return ReconnectionResult(
                success=False,
                session_id=None,
                state=ReconnectionState.FAILED,
                message="Invalid or expired reconnection token",
            )

        session_id = token_obj.session_id

        # Check backoff
        if not self._backoff.can_attempt(session_id):
            delay = self._backoff.get_delay(session_id)
            return ReconnectionResult(
                success=False,
                session_id=session_id,
                state=ReconnectionState.PENDING,
                message=f"Too many attempts. Retry after {delay:.1f} seconds",
            )

        self._backoff.record_attempt(session_id)

        if self.on_reconnection_started:
            try:
                await self.on_reconnection_started(session_id)
            except Exception as e:
                logger.error(f"Reconnection started callback error: {e}")

        # Get recovery state
        recovery_state = self.get_recovery_state(session_id)
        missed_operations = 0
        recovery_data = None

        if recovery_state:
            # Calculate missed operations
            if self.get_document_operations:
                try:
                    recovery_data = await self._recover_state(
                        recovery_state, client_state
                    )
                    missed_operations = recovery_data.get("missed_operations", 0)
                except Exception as e:
                    logger.error(f"State recovery error: {e}")
                    self._reconnections_failed += 1
                    return ReconnectionResult(
                        success=False,
                        session_id=session_id,
                        state=ReconnectionState.FAILED,
                        message=f"State recovery failed: {str(e)}",
                    )

        # Success
        self._backoff.reset(session_id)
        self._reconnections_successful += 1

        result = ReconnectionResult(
            success=True,
            session_id=session_id,
            state=ReconnectionState.COMPLETED,
            message="Reconnection successful",
            missed_operations=missed_operations,
            recovery_data=recovery_data,
        )

        if self.on_reconnection_completed:
            try:
                await self.on_reconnection_completed(session_id, result)
            except Exception as e:
                logger.error(f"Reconnection completed callback error: {e}")

        return result

    async def _recover_state(
        self,
        recovery_state: RecoveryState,
        client_state: Optional[dict]
    ) -> dict:
        """Recover state and calculate missed operations."""
        missed_ops = {}
        total_missed = 0

        for doc_id, last_version in recovery_state.documents.items():
            client_version = last_version
            if client_state and doc_id in client_state:
                client_version = client_state[doc_id].get("version", last_version)

            # Get operations since client's version
            if self.get_document_operations:
                try:
                    ops = await asyncio.wait_for(
                        self.get_document_operations(doc_id, client_version, -1),
                        timeout=self.config.recovery_timeout
                    )
                    if ops:
                        missed_ops[doc_id] = ops
                        total_missed += len(ops)
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout getting operations for {doc_id}")
                except Exception as e:
                    logger.error(f"Error getting operations for {doc_id}: {e}")

        return {
            "missed_operations": total_missed,
            "operations_by_document": missed_ops,
            "cursor_positions": recovery_state.cursor_positions,
            "pending_operations": [
                op.to_dict() for op in recovery_state.pending_operations
            ],
        }

    def can_reconnect(self, session_id: str) -> bool:
        """Check if session can attempt reconnection."""
        return self._backoff.can_attempt(session_id)

    def get_reconnect_delay(self, session_id: str) -> float:
        """Get delay before next reconnection attempt."""
        return self._backoff.get_delay(session_id)

    async def cleanup_expired(self) -> int:
        """Clean up expired tokens and states."""
        now = datetime.utcnow()
        removed = 0

        async with self._lock:
            # Clean expired tokens
            expired_tokens = [
                token for token, obj in self._tokens.items()
                if not obj.is_valid()
            ]
            for token in expired_tokens:
                obj = self._tokens.pop(token)
                self._session_tokens.pop(obj.session_id, None)
                removed += 1

            # Clean old recovery states (older than token TTL * 2)
            cutoff = now - (self.config.token_ttl * 2)
            expired_states = [
                sid for sid, state in self._recovery_states.items()
                if state.timestamp < cutoff
            ]
            for sid in expired_states:
                self._recovery_states.pop(sid)
                removed += 1

        return removed

    def get_stats(self) -> dict:
        """Get reconnection manager statistics."""
        return {
            "tokens_issued": self._tokens_issued,
            "active_tokens": len(self._tokens),
            "recovery_states": len(self._recovery_states),
            "reconnections_attempted": self._reconnections_attempted,
            "reconnections_successful": self._reconnections_successful,
            "reconnections_failed": self._reconnections_failed,
            "success_rate": (
                self._reconnections_successful / self._reconnections_attempted
                if self._reconnections_attempted > 0 else 0
            ),
        }


# Global reconnection manager
_reconnection_manager: Optional[ReconnectionManager] = None


def get_reconnection_manager() -> ReconnectionManager:
    """Get global reconnection manager."""
    global _reconnection_manager
    if _reconnection_manager is None:
        _reconnection_manager = ReconnectionManager()
    return _reconnection_manager


def set_reconnection_manager(manager: ReconnectionManager) -> None:
    """Set global reconnection manager."""
    global _reconnection_manager
    _reconnection_manager = manager


def reset_reconnection_manager() -> None:
    """Reset global reconnection manager."""
    global _reconnection_manager
    _reconnection_manager = None
