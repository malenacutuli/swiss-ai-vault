"""Tests for Permissions Module."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.permissions import (
    Permission,
    Role,
    PermissionGrant,
    PermissionCheck,
    PermissionChecker,
    PermissionDeniedError,
    ROLE_PERMISSIONS,
    requires_permission,
    get_permission_checker,
    set_permission_checker,
    reset_permission_checker,
)


class TestPermission:
    """Tests for Permission flags."""

    def test_permission_values(self):
        """Permission values are correct."""
        assert Permission.NONE == 0
        assert Permission.READ == 1
        assert Permission.COMMENT == 2
        assert Permission.WRITE == 4
        assert Permission.SHARE == 8
        assert Permission.ADMIN == 16
        assert Permission.OWNER == 32

    def test_permission_combinations(self):
        """Permission combinations work correctly."""
        assert Permission.VIEWER == Permission.READ
        assert Permission.COMMENTER == (Permission.READ | Permission.COMMENT)
        assert Permission.EDITOR == (Permission.READ | Permission.COMMENT | Permission.WRITE)

    def test_permission_check(self):
        """Check if permission includes another."""
        editor = Permission.EDITOR

        assert (editor & Permission.READ) == Permission.READ
        assert (editor & Permission.WRITE) == Permission.WRITE
        assert (editor & Permission.ADMIN) != Permission.ADMIN

    def test_permission_combination_with_or(self):
        """Combine permissions with OR."""
        combined = Permission.READ | Permission.WRITE

        assert (combined & Permission.READ) == Permission.READ
        assert (combined & Permission.WRITE) == Permission.WRITE


class TestRole:
    """Tests for Role enum."""

    def test_role_values(self):
        """Role values are correct."""
        assert Role.VIEWER.value == "viewer"
        assert Role.COMMENTER.value == "commenter"
        assert Role.EDITOR.value == "editor"
        assert Role.MANAGER.value == "manager"
        assert Role.OWNER.value == "owner"

    def test_role_permissions(self):
        """Roles have correct permissions."""
        assert Role.VIEWER.get_permissions() == Permission.VIEWER
        assert Role.EDITOR.get_permissions() == Permission.EDITOR
        assert Role.OWNER.get_permissions() == Permission.FULL

    def test_role_permission_mapping(self):
        """ROLE_PERMISSIONS mapping is correct."""
        assert ROLE_PERMISSIONS[Role.VIEWER] == Permission.VIEWER
        assert ROLE_PERMISSIONS[Role.MANAGER] == Permission.MANAGER


class TestPermissionGrant:
    """Tests for PermissionGrant."""

    def test_grant_creation(self):
        """Create a permission grant."""
        grant = PermissionGrant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            granted_at=datetime.utcnow(),
        )

        assert grant.user_id == "user_1"
        assert grant.permissions == Permission.EDITOR

    def test_has_permission(self):
        """Check if grant has permission."""
        grant = PermissionGrant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            granted_at=datetime.utcnow(),
        )

        assert grant.has_permission(Permission.READ) is True
        assert grant.has_permission(Permission.WRITE) is True
        assert grant.has_permission(Permission.ADMIN) is False

    def test_expired_grant(self):
        """Expired grant has no permissions."""
        grant = PermissionGrant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            granted_at=datetime.utcnow() - timedelta(hours=2),
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )

        assert grant.is_expired() is True
        assert grant.has_permission(Permission.READ) is False

    def test_non_expired_grant(self):
        """Non-expired grant has permissions."""
        grant = PermissionGrant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            granted_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )

        assert grant.is_expired() is False
        assert grant.has_permission(Permission.READ) is True

    def test_to_dict(self):
        """Convert grant to dictionary."""
        grant = PermissionGrant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            granted_at=datetime.utcnow(),
        )

        d = grant.to_dict()

        assert d["user_id"] == "user_1"
        assert d["document_id"] == "doc_1"
        assert d["permissions"] == int(Permission.EDITOR)

    def test_from_dict(self):
        """Create grant from dictionary."""
        data = {
            "user_id": "user_1",
            "document_id": "doc_1",
            "permissions": int(Permission.EDITOR),
            "granted_by": "admin",
            "granted_at": "2024-01-01T00:00:00",
        }

        grant = PermissionGrant.from_dict(data)

        assert grant.user_id == "user_1"
        assert grant.permissions == Permission.EDITOR


class TestPermissionCheck:
    """Tests for PermissionCheck."""

    def test_allowed_check(self):
        """Allowed permission check."""
        check = PermissionCheck(
            allowed=True,
            user_id="user_1",
            document_id="doc_1",
            required=Permission.READ,
            actual=Permission.EDITOR,
        )

        assert check.allowed is True

    def test_denied_check(self):
        """Denied permission check."""
        check = PermissionCheck(
            allowed=False,
            user_id="user_1",
            document_id="doc_1",
            required=Permission.ADMIN,
            actual=Permission.EDITOR,
            reason="Insufficient permissions",
        )

        assert check.allowed is False
        assert check.reason == "Insufficient permissions"

    def test_raise_if_denied_allowed(self):
        """raise_if_denied does nothing when allowed."""
        check = PermissionCheck(
            allowed=True,
            user_id="user_1",
            document_id="doc_1",
            required=Permission.READ,
            actual=Permission.EDITOR,
        )

        # Should not raise
        check.raise_if_denied()

    def test_raise_if_denied_denied(self):
        """raise_if_denied raises when denied."""
        check = PermissionCheck(
            allowed=False,
            user_id="user_1",
            document_id="doc_1",
            required=Permission.ADMIN,
            actual=Permission.EDITOR,
            reason="Permission denied",
        )

        with pytest.raises(PermissionDeniedError) as exc_info:
            check.raise_if_denied()

        assert exc_info.value.user_id == "user_1"
        assert exc_info.value.required == Permission.ADMIN


class TestPermissionChecker:
    """Tests for PermissionChecker."""

    @pytest.fixture
    def checker(self):
        return PermissionChecker()

    @pytest.mark.asyncio
    async def test_grant_permission(self, checker):
        """Grant permission to user."""
        grant = await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        assert grant.user_id == "user_1"
        assert grant.permissions == Permission.EDITOR

    @pytest.mark.asyncio
    async def test_check_permission_allowed(self, checker):
        """Check allowed permission."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        result = await checker.check("user_1", "doc_1", Permission.READ)

        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_check_permission_denied(self, checker):
        """Check denied permission."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.VIEWER,
            granted_by="admin",
        )

        result = await checker.check("user_1", "doc_1", Permission.WRITE)

        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_check_no_grant(self, checker):
        """Check permission with no grant."""
        result = await checker.check("user_1", "doc_1", Permission.READ)

        assert result.allowed is False
        assert result.actual == Permission.NONE

    @pytest.mark.asyncio
    async def test_require_permission_success(self, checker):
        """Require permission succeeds with grant."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        grant = await checker.require("user_1", "doc_1", Permission.READ)

        assert grant is not None

    @pytest.mark.asyncio
    async def test_require_permission_failure(self, checker):
        """Require permission fails without grant."""
        with pytest.raises(PermissionDeniedError):
            await checker.require("user_1", "doc_1", Permission.READ)

    @pytest.mark.asyncio
    async def test_revoke_permission(self, checker):
        """Revoke permission from user."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        result = await checker.revoke("user_1", "doc_1")
        assert result is True

        check = await checker.check("user_1", "doc_1", Permission.READ)
        assert check.allowed is False

    @pytest.mark.asyncio
    async def test_revoke_nonexistent(self, checker):
        """Revoke nonexistent permission returns False."""
        result = await checker.revoke("user_1", "doc_1")
        assert result is False

    @pytest.mark.asyncio
    async def test_update_permission(self, checker):
        """Update user permissions."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.VIEWER,
            granted_by="admin",
        )

        grant = await checker.update(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            updated_by="admin",
        )

        assert grant.permissions == Permission.EDITOR

    @pytest.mark.asyncio
    async def test_get_grant(self, checker):
        """Get permission grant."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        grant = checker.get_grant("user_1", "doc_1")

        assert grant is not None
        assert grant.permissions == Permission.EDITOR

    @pytest.mark.asyncio
    async def test_get_permissions(self, checker):
        """Get effective permissions."""
        await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
        )

        permissions = checker.get_permissions("user_1", "doc_1")

        assert permissions == Permission.EDITOR

    @pytest.mark.asyncio
    async def test_get_permissions_none(self, checker):
        """Get permissions returns NONE without grant."""
        permissions = checker.get_permissions("user_1", "doc_1")

        assert permissions == Permission.NONE

    @pytest.mark.asyncio
    async def test_get_document_grants(self, checker):
        """Get all grants for a document."""
        await checker.grant("user_1", "doc_1", Permission.EDITOR, "admin")
        await checker.grant("user_2", "doc_1", Permission.VIEWER, "admin")

        grants = checker.get_document_grants("doc_1")

        assert len(grants) == 2

    @pytest.mark.asyncio
    async def test_get_user_grants(self, checker):
        """Get all grants for a user."""
        await checker.grant("user_1", "doc_1", Permission.EDITOR, "admin")
        await checker.grant("user_1", "doc_2", Permission.VIEWER, "admin")

        grants = checker.get_user_grants("user_1")

        assert len(grants) == 2

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, checker):
        """Cleanup expired grants."""
        # Create expired grant
        grant = await checker.grant(
            user_id="user_1",
            document_id="doc_1",
            permissions=Permission.EDITOR,
            granted_by="admin",
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )

        # Create valid grant
        await checker.grant(
            user_id="user_2",
            document_id="doc_1",
            permissions=Permission.VIEWER,
            granted_by="admin",
        )

        removed = await checker.cleanup_expired()

        assert removed == 1

        # Check user_1 no longer has access
        assert checker.get_grant("user_1", "doc_1") is None

        # Check user_2 still has access
        assert checker.get_grant("user_2", "doc_1") is not None

    @pytest.mark.asyncio
    async def test_permission_denied_callback(self, checker):
        """Permission denied callback is invoked."""
        denied_checks = []

        async def on_denied(check):
            denied_checks.append(check)

        checker.on_permission_denied = on_denied

        await checker.check("user_1", "doc_1", Permission.READ)

        assert len(denied_checks) == 1
        assert denied_checks[0].user_id == "user_1"

    @pytest.mark.asyncio
    async def test_get_stats(self, checker):
        """Get checker statistics."""
        await checker.grant("user_1", "doc_1", Permission.EDITOR, "admin")
        await checker.check("user_1", "doc_1", Permission.READ)
        await checker.check("user_1", "doc_1", Permission.ADMIN)

        stats = checker.get_stats()

        assert stats["checks_performed"] == 2
        assert stats["checks_allowed"] == 1
        assert stats["checks_denied"] == 1
        assert stats["total_grants"] == 1


class TestPermissionDeniedError:
    """Tests for PermissionDeniedError."""

    def test_error_attributes(self):
        """Error has correct attributes."""
        error = PermissionDeniedError(
            message="Access denied",
            user_id="user_1",
            document_id="doc_1",
            required=Permission.ADMIN,
            actual=Permission.EDITOR,
        )

        assert error.user_id == "user_1"
        assert error.document_id == "doc_1"
        assert error.required == Permission.ADMIN
        assert error.actual == Permission.EDITOR
        assert str(error) == "Access denied"


class TestGlobalPermissionChecker:
    """Tests for global permission checker functions."""

    def test_get_checker_none(self):
        """Get checker returns None initially."""
        reset_permission_checker()
        assert get_permission_checker() is None

    def test_set_and_get_checker(self):
        """Set and get global checker."""
        reset_permission_checker()

        checker = PermissionChecker()
        set_permission_checker(checker)

        assert get_permission_checker() is checker

    def test_reset_checker(self):
        """Reset global checker."""
        checker = PermissionChecker()
        set_permission_checker(checker)

        reset_permission_checker()

        assert get_permission_checker() is None
