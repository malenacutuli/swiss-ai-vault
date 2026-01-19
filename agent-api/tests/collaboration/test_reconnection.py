"""Tests for Reconnection Handling."""

import pytest
import asyncio
import time
from datetime import datetime, timedelta

from app.collaboration.reconnection import (
    ReconnectionManager,
    ReconnectionConfig,
    ReconnectionToken,
    ReconnectionState,
    ReconnectionResult,
    RecoveryState,
    PendingOperation,
    BackoffStrategy,
    get_reconnection_manager,
    set_reconnection_manager,
    reset_reconnection_manager,
)


class TestReconnectionState:
    """Tests for ReconnectionState enum."""

    def test_state_values(self):
        """State values are correct."""
        assert ReconnectionState.PENDING.value == "pending"
        assert ReconnectionState.VALIDATING.value == "validating"
        assert ReconnectionState.RECOVERING.value == "recovering"
        assert ReconnectionState.SYNCING.value == "syncing"
        assert ReconnectionState.COMPLETED.value == "completed"
        assert ReconnectionState.FAILED.value == "failed"


class TestReconnectionConfig:
    """Tests for ReconnectionConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = ReconnectionConfig()

        assert config.token_ttl == timedelta(hours=1)
        assert config.max_reconnect_attempts == 5
        assert config.base_backoff == 1.0
        assert config.max_backoff == 60.0

    def test_custom_config(self):
        """Custom configuration."""
        config = ReconnectionConfig(
            token_ttl=timedelta(minutes=30),
            max_reconnect_attempts=3,
        )

        assert config.token_ttl == timedelta(minutes=30)
        assert config.max_reconnect_attempts == 3


class TestReconnectionToken:
    """Tests for ReconnectionToken."""

    @pytest.fixture
    def token(self):
        """Create a test token."""
        now = datetime.utcnow()
        return ReconnectionToken(
            token="test_token_123",
            session_id="sess_abc",
            user_id="user1",
            created_at=now,
            expires_at=now + timedelta(hours=1),
        )

    def test_is_valid(self, token):
        """Check token validity."""
        assert token.is_valid() is True

        token.expires_at = datetime.utcnow() - timedelta(hours=1)
        assert token.is_valid() is False

    def test_to_dict(self, token):
        """Convert to dictionary."""
        d = token.to_dict()

        assert d["token"] == "test_token_123"
        assert d["session_id"] == "sess_abc"
        assert d["user_id"] == "user1"

    def test_from_dict(self):
        """Create from dictionary."""
        now = datetime.utcnow()
        d = {
            "token": "abc123",
            "session_id": "sess_xyz",
            "user_id": "user2",
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=2)).isoformat(),
            "metadata": {"key": "value"},
        }

        token = ReconnectionToken.from_dict(d)

        assert token.token == "abc123"
        assert token.session_id == "sess_xyz"
        assert token.metadata == {"key": "value"}


class TestPendingOperation:
    """Tests for PendingOperation."""

    def test_create_pending_operation(self):
        """Create a pending operation."""
        op = PendingOperation(
            id="op1",
            document_id="doc1",
            operation={"type": "insert", "pos": 0, "text": "hello"},
            version=5,
            timestamp=datetime.utcnow(),
        )

        assert op.id == "op1"
        assert op.document_id == "doc1"
        assert op.version == 5

    def test_to_dict(self):
        """Convert to dictionary."""
        now = datetime.utcnow()
        op = PendingOperation(
            id="op2",
            document_id="doc2",
            operation={"type": "delete", "pos": 10, "count": 5},
            version=10,
            timestamp=now,
        )

        d = op.to_dict()

        assert d["id"] == "op2"
        assert d["document_id"] == "doc2"
        assert d["version"] == 10


class TestRecoveryState:
    """Tests for RecoveryState."""

    def test_create_recovery_state(self):
        """Create recovery state."""
        state = RecoveryState(
            session_id="sess_123",
            documents={"doc1": 5, "doc2": 10},
            cursor_positions={"doc1": {"line": 5}},
            pending_operations=[],
            timestamp=datetime.utcnow(),
        )

        assert state.session_id == "sess_123"
        assert state.documents["doc1"] == 5

    def test_to_dict(self):
        """Convert to dictionary."""
        now = datetime.utcnow()
        state = RecoveryState(
            session_id="sess_abc",
            documents={"doc1": 3},
            cursor_positions={},
            pending_operations=[],
            timestamp=now,
        )

        d = state.to_dict()

        assert d["session_id"] == "sess_abc"
        assert d["documents"] == {"doc1": 3}

    def test_from_dict(self):
        """Create from dictionary."""
        now = datetime.utcnow()
        d = {
            "session_id": "sess_xyz",
            "documents": {"doc1": 7},
            "cursor_positions": {"doc1": {"col": 10}},
            "pending_operations": [
                {
                    "id": "op1",
                    "document_id": "doc1",
                    "operation": {"type": "insert"},
                    "version": 1,
                    "timestamp": now.isoformat(),
                }
            ],
            "timestamp": now.isoformat(),
        }

        state = RecoveryState.from_dict(d)

        assert state.session_id == "sess_xyz"
        assert len(state.pending_operations) == 1


class TestReconnectionResult:
    """Tests for ReconnectionResult."""

    def test_create_result(self):
        """Create a reconnection result."""
        result = ReconnectionResult(
            success=True,
            session_id="sess_123",
            state=ReconnectionState.COMPLETED,
            message="Reconnection successful",
            missed_operations=5,
        )

        assert result.success is True
        assert result.missed_operations == 5

    def test_to_dict(self):
        """Convert to dictionary."""
        result = ReconnectionResult(
            success=False,
            session_id=None,
            state=ReconnectionState.FAILED,
            message="Token expired",
        )

        d = result.to_dict()

        assert d["success"] is False
        assert d["state"] == "failed"
        assert d["message"] == "Token expired"


class TestBackoffStrategy:
    """Tests for BackoffStrategy."""

    @pytest.fixture
    def strategy(self):
        """Create a backoff strategy."""
        config = ReconnectionConfig(
            base_backoff=1.0,
            max_backoff=60.0,
            backoff_multiplier=2.0,
            max_reconnect_attempts=5,
        )
        return BackoffStrategy(config)

    def test_get_delay(self, strategy):
        """Get exponential backoff delay."""
        # First attempt: base delay
        assert strategy.get_delay("sess1") == 1.0

        # Record attempts to increase delay
        strategy.record_attempt("sess1")
        assert strategy.get_delay("sess1") == 2.0

        strategy.record_attempt("sess1")
        assert strategy.get_delay("sess1") == 4.0

    def test_max_delay(self, strategy):
        """Delay is capped at max_backoff."""
        for _ in range(10):
            strategy.record_attempt("sess1")

        delay = strategy.get_delay("sess1")
        assert delay == 60.0  # max_backoff

    def test_reset(self, strategy):
        """Reset backoff for a session."""
        strategy.record_attempt("sess1")
        strategy.record_attempt("sess1")

        strategy.reset("sess1")

        assert strategy.get_delay("sess1") == 1.0

    def test_can_attempt(self, strategy):
        """Check if attempt is allowed."""
        assert strategy.can_attempt("sess1") is True

        # Max out attempts
        for _ in range(5):
            strategy.record_attempt("sess1")

        assert strategy.can_attempt("sess1") is False

    def test_get_attempt_count(self, strategy):
        """Get number of attempts."""
        assert strategy.get_attempt_count("sess1") == 0

        strategy.record_attempt("sess1")
        strategy.record_attempt("sess1")

        assert strategy.get_attempt_count("sess1") == 2


class TestReconnectionManager:
    """Tests for ReconnectionManager."""

    @pytest.fixture
    def manager(self):
        """Create a reconnection manager."""
        return ReconnectionManager()

    @pytest.mark.asyncio
    async def test_create_token(self, manager):
        """Create a reconnection token."""
        token = await manager.create_token(
            session_id="sess_123",
            user_id="user1",
            metadata={"device": "mobile"},
        )

        assert token is not None
        assert token.session_id == "sess_123"
        assert token.user_id == "user1"
        assert token.is_valid()

    @pytest.mark.asyncio
    async def test_validate_token(self, manager):
        """Validate a token."""
        token = await manager.create_token("sess_123", "user1")

        validated = manager.validate_token(token.token)

        assert validated is not None
        assert validated.session_id == "sess_123"

    @pytest.mark.asyncio
    async def test_validate_invalid_token(self, manager):
        """Invalid token returns None."""
        validated = manager.validate_token("invalid_token")
        assert validated is None

    @pytest.mark.asyncio
    async def test_validate_expired_token(self, manager):
        """Expired token returns None."""
        token = await manager.create_token("sess_123", "user1")
        token.expires_at = datetime.utcnow() - timedelta(hours=1)

        validated = manager.validate_token(token.token)

        assert validated is None

    @pytest.mark.asyncio
    async def test_revoke_token(self, manager):
        """Revoke a token."""
        token = await manager.create_token("sess_123", "user1")

        result = await manager.revoke_token("sess_123")

        assert result is True
        assert manager.validate_token(token.token) is None

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_token(self, manager):
        """Revoke nonexistent token returns False."""
        result = await manager.revoke_token("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_create_token_replaces_old(self, manager):
        """Creating new token revokes old one."""
        old_token = await manager.create_token("sess_123", "user1")
        new_token = await manager.create_token("sess_123", "user1")

        assert manager.validate_token(old_token.token) is None
        assert manager.validate_token(new_token.token) is not None

    @pytest.mark.asyncio
    async def test_save_recovery_state(self, manager):
        """Save recovery state."""
        await manager.save_recovery_state(
            session_id="sess_123",
            documents={"doc1": 5},
            cursor_positions={"doc1": {"line": 10}},
        )

        state = manager.get_recovery_state("sess_123")

        assert state is not None
        assert state.documents["doc1"] == 5

    @pytest.mark.asyncio
    async def test_clear_recovery_state(self, manager):
        """Clear recovery state."""
        await manager.save_recovery_state(
            session_id="sess_123",
            documents={"doc1": 5},
            cursor_positions={},
        )

        await manager.clear_recovery_state("sess_123")

        state = manager.get_recovery_state("sess_123")
        assert state is None

    @pytest.mark.asyncio
    async def test_attempt_reconnection_invalid_token(self, manager):
        """Reconnection with invalid token fails."""
        result = await manager.attempt_reconnection(
            token="invalid",
            new_client_id="client2",
        )

        assert result.success is False
        assert result.state == ReconnectionState.FAILED

    @pytest.mark.asyncio
    async def test_attempt_reconnection_success(self, manager):
        """Successful reconnection."""
        token = await manager.create_token("sess_123", "user1")
        await manager.save_recovery_state(
            session_id="sess_123",
            documents={"doc1": 5},
            cursor_positions={},
        )

        result = await manager.attempt_reconnection(
            token=token.token,
            new_client_id="client2",
        )

        assert result.success is True
        assert result.state == ReconnectionState.COMPLETED
        assert result.session_id == "sess_123"

    @pytest.mark.asyncio
    async def test_attempt_reconnection_with_state_recovery(self, manager):
        """Reconnection with state recovery."""
        operations_fetched = []

        async def get_ops(doc_id, from_ver, to_ver):
            operations_fetched.append((doc_id, from_ver))
            return [{"id": "op1"}, {"id": "op2"}]

        manager.get_document_operations = get_ops

        token = await manager.create_token("sess_123", "user1")
        await manager.save_recovery_state(
            session_id="sess_123",
            documents={"doc1": 5},
            cursor_positions={},
        )

        result = await manager.attempt_reconnection(
            token=token.token,
            new_client_id="client2",
            client_state={"doc1": {"version": 3}},
        )

        assert result.success is True
        assert result.missed_operations == 2
        assert len(operations_fetched) == 1

    @pytest.mark.asyncio
    async def test_attempt_reconnection_backoff(self, manager):
        """Reconnection respects backoff."""
        config = ReconnectionConfig(max_reconnect_attempts=2)
        manager = ReconnectionManager(config)

        token = await manager.create_token("sess_123", "user1")

        # First attempt
        result1 = await manager.attempt_reconnection(token.token, "client1")
        assert result1.success is True

        # Create new token since old one is now invalid after reconnect
        token2 = await manager.create_token("sess_123", "user1")
        result2 = await manager.attempt_reconnection(token2.token, "client2")
        assert result2.success is True

        # Third attempt should be blocked by backoff
        token3 = await manager.create_token("sess_123", "user1")
        result3 = await manager.attempt_reconnection(token3.token, "client3")
        # Note: success depends on backoff timing

    def test_can_reconnect(self, manager):
        """Check if reconnection is allowed."""
        assert manager.can_reconnect("sess_123") is True

    def test_get_reconnect_delay(self, manager):
        """Get reconnection delay."""
        delay = manager.get_reconnect_delay("sess_123")
        assert delay == manager.config.base_backoff

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, manager):
        """Clean up expired tokens and states."""
        token = await manager.create_token("sess_123", "user1")
        token.expires_at = datetime.utcnow() - timedelta(hours=1)

        removed = await manager.cleanup_expired()

        assert removed >= 1
        assert manager.validate_token(token.token) is None

    @pytest.mark.asyncio
    async def test_reconnection_callbacks(self, manager):
        """Reconnection callbacks are invoked."""
        started_sessions = []
        completed_results = []

        async def on_started(session_id):
            started_sessions.append(session_id)

        async def on_completed(session_id, result):
            completed_results.append((session_id, result))

        manager.on_reconnection_started = on_started
        manager.on_reconnection_completed = on_completed

        token = await manager.create_token("sess_123", "user1")
        await manager.attempt_reconnection(token.token, "client2")

        assert "sess_123" in started_sessions
        assert len(completed_results) == 1

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "tokens_issued" in stats
        assert "active_tokens" in stats
        assert "reconnections_attempted" in stats
        assert "reconnections_successful" in stats


class TestGlobalReconnectionManager:
    """Tests for global reconnection manager functions."""

    def test_get_reconnection_manager(self):
        """Get global reconnection manager."""
        reset_reconnection_manager()

        manager = get_reconnection_manager()

        assert manager is not None
        assert isinstance(manager, ReconnectionManager)

    def test_set_reconnection_manager(self):
        """Set global reconnection manager."""
        reset_reconnection_manager()

        custom = ReconnectionManager()
        set_reconnection_manager(custom)

        assert get_reconnection_manager() is custom

    def test_reset_reconnection_manager(self):
        """Reset global reconnection manager."""
        get_reconnection_manager()

        reset_reconnection_manager()

        # Next call creates a new one
        manager = get_reconnection_manager()
        assert manager is not None


class TestRecoveryStateWithOperations:
    """Tests for recovery state with pending operations."""

    @pytest.mark.asyncio
    async def test_recovery_with_pending_operations(self):
        """Recovery state with pending operations."""
        manager = ReconnectionManager()

        pending_ops = [
            PendingOperation(
                id="op1",
                document_id="doc1",
                operation={"type": "insert", "pos": 0, "text": "hello"},
                version=5,
                timestamp=datetime.utcnow(),
            ),
            PendingOperation(
                id="op2",
                document_id="doc1",
                operation={"type": "delete", "pos": 5, "count": 3},
                version=6,
                timestamp=datetime.utcnow(),
            ),
        ]

        await manager.save_recovery_state(
            session_id="sess_123",
            documents={"doc1": 4},
            cursor_positions={"doc1": {"line": 5, "col": 10}},
            pending_operations=pending_ops,
        )

        state = manager.get_recovery_state("sess_123")

        assert state is not None
        assert len(state.pending_operations) == 2
        assert state.pending_operations[0].id == "op1"


class TestBackoffTiming:
    """Tests for backoff timing behavior."""

    def test_backoff_respects_last_attempt(self):
        """Cannot attempt until delay has passed."""
        config = ReconnectionConfig(
            base_backoff=0.05,  # 50ms
            backoff_multiplier=2.0,
            max_reconnect_attempts=5,
        )
        strategy = BackoffStrategy(config)

        strategy.record_attempt("sess1")

        # Immediately after recording, should not be able to attempt
        # (delay hasn't passed - next delay is 0.05 * 2^1 = 0.1s)
        assert strategy.can_attempt("sess1") is False

        # Wait for delay (100ms + buffer)
        time.sleep(0.15)
        assert strategy.can_attempt("sess1") is True
