"""
Permission Types and Checks for Collaboration

Defines:
- Permission levels (read, write, admin, owner)
- Permission checking logic
- Role-based access control
- Permission inheritance

Integrates with document access control for fine-grained permissions.
"""

from __future__ import annotations

import asyncio
from typing import Optional, Any, Callable, Awaitable, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, IntFlag
from functools import wraps

import logging

logger = logging.getLogger(__name__)


class Permission(IntFlag):
    """Document permission flags.

    Uses IntFlag for combining permissions:
    - NONE: No access
    - READ: Can view document
    - COMMENT: Can add comments
    - WRITE: Can edit document
    - SHARE: Can share with others
    - ADMIN: Can manage permissions
    - OWNER: Full control including delete
    """
    NONE = 0
    READ = 1
    COMMENT = 2
    WRITE = 4
    SHARE = 8
    ADMIN = 16
    OWNER = 32

    # Common combinations
    VIEWER = READ
    COMMENTER = READ | COMMENT
    EDITOR = READ | COMMENT | WRITE
    MANAGER = READ | COMMENT | WRITE | SHARE | ADMIN
    FULL = READ | COMMENT | WRITE | SHARE | ADMIN | OWNER


class Role(Enum):
    """Pre-defined roles with associated permissions."""
    VIEWER = "viewer"
    COMMENTER = "commenter"
    EDITOR = "editor"
    MANAGER = "manager"
    OWNER = "owner"

    def get_permissions(self) -> Permission:
        """Get permissions for this role."""
        return ROLE_PERMISSIONS[self]


# Role to permission mapping
ROLE_PERMISSIONS: dict[Role, Permission] = {
    Role.VIEWER: Permission.VIEWER,
    Role.COMMENTER: Permission.COMMENTER,
    Role.EDITOR: Permission.EDITOR,
    Role.MANAGER: Permission.MANAGER,
    Role.OWNER: Permission.FULL,
}


class PermissionDeniedError(Exception):
    """Raised when a permission check fails."""

    def __init__(
        self,
        message: str,
        user_id: str,
        document_id: str,
        required: Permission,
        actual: Permission
    ):
        super().__init__(message)
        self.user_id = user_id
        self.document_id = document_id
        self.required = required
        self.actual = actual


@dataclass
class PermissionGrant:
    """A permission grant for a user on a document."""
    user_id: str
    document_id: str
    permissions: Permission
    granted_by: str
    granted_at: datetime
    expires_at: Optional[datetime] = None
    inherited_from: Optional[str] = None  # Parent document/folder
    metadata: dict = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if grant has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def has_permission(self, permission: Permission) -> bool:
        """Check if grant includes permission."""
        if self.is_expired():
            return False
        return (self.permissions & permission) == permission

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "document_id": self.document_id,
            "permissions": int(self.permissions),
            "granted_by": self.granted_by,
            "granted_at": self.granted_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "inherited_from": self.inherited_from,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PermissionGrant":
        """Create from dictionary."""
        return cls(
            user_id=data["user_id"],
            document_id=data["document_id"],
            permissions=Permission(data["permissions"]),
            granted_by=data["granted_by"],
            granted_at=datetime.fromisoformat(data["granted_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at") else None,
            inherited_from=data.get("inherited_from"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class PermissionCheck:
    """Result of a permission check."""
    allowed: bool
    user_id: str
    document_id: str
    required: Permission
    actual: Permission
    grant: Optional[PermissionGrant] = None
    reason: Optional[str] = None

    def raise_if_denied(self) -> None:
        """Raise PermissionDeniedError if check failed."""
        if not self.allowed:
            raise PermissionDeniedError(
                self.reason or "Permission denied",
                self.user_id,
                self.document_id,
                self.required,
                self.actual,
            )


class PermissionChecker:
    """Checks permissions for users on documents."""

    def __init__(self):
        self._grants: dict[str, dict[str, PermissionGrant]] = {}  # doc_id -> user_id -> grant
        self._user_grants: dict[str, set[str]] = {}  # user_id -> set of doc_ids
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_permission_denied: Optional[
            Callable[[PermissionCheck], Awaitable[None]]
        ] = None

        # Stats
        self._checks_performed = 0
        self._checks_allowed = 0
        self._checks_denied = 0

    async def grant(
        self,
        user_id: str,
        document_id: str,
        permissions: Permission,
        granted_by: str,
        expires_at: Optional[datetime] = None,
        inherited_from: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> PermissionGrant:
        """Grant permissions to a user."""
        grant = PermissionGrant(
            user_id=user_id,
            document_id=document_id,
            permissions=permissions,
            granted_by=granted_by,
            granted_at=datetime.utcnow(),
            expires_at=expires_at,
            inherited_from=inherited_from,
            metadata=metadata or {},
        )

        async with self._lock:
            if document_id not in self._grants:
                self._grants[document_id] = {}
            self._grants[document_id][user_id] = grant

            if user_id not in self._user_grants:
                self._user_grants[user_id] = set()
            self._user_grants[user_id].add(document_id)

        return grant

    async def revoke(self, user_id: str, document_id: str) -> bool:
        """Revoke all permissions for a user on a document."""
        async with self._lock:
            if document_id not in self._grants:
                return False
            if user_id not in self._grants[document_id]:
                return False

            del self._grants[document_id][user_id]

            if user_id in self._user_grants:
                self._user_grants[user_id].discard(document_id)

        return True

    async def update(
        self,
        user_id: str,
        document_id: str,
        permissions: Permission,
        updated_by: str
    ) -> Optional[PermissionGrant]:
        """Update permissions for a user."""
        async with self._lock:
            if document_id not in self._grants:
                return None
            if user_id not in self._grants[document_id]:
                return None

            grant = self._grants[document_id][user_id]
            grant.permissions = permissions
            grant.granted_by = updated_by
            grant.granted_at = datetime.utcnow()

            return grant

    def get_grant(
        self,
        user_id: str,
        document_id: str
    ) -> Optional[PermissionGrant]:
        """Get permission grant for a user on a document."""
        if document_id not in self._grants:
            return None
        return self._grants[document_id].get(user_id)

    def get_permissions(self, user_id: str, document_id: str) -> Permission:
        """Get effective permissions for a user on a document."""
        grant = self.get_grant(user_id, document_id)
        if grant is None or grant.is_expired():
            return Permission.NONE
        return grant.permissions

    async def check(
        self,
        user_id: str,
        document_id: str,
        required: Permission
    ) -> PermissionCheck:
        """Check if user has required permission."""
        self._checks_performed += 1

        grant = self.get_grant(user_id, document_id)
        actual = Permission.NONE

        if grant and not grant.is_expired():
            actual = grant.permissions

        allowed = (actual & required) == required

        if allowed:
            self._checks_allowed += 1
            reason = None
        else:
            self._checks_denied += 1
            reason = f"User {user_id} lacks {required.name} permission on {document_id}"

        result = PermissionCheck(
            allowed=allowed,
            user_id=user_id,
            document_id=document_id,
            required=required,
            actual=actual,
            grant=grant,
            reason=reason,
        )

        if not allowed and self.on_permission_denied:
            try:
                await self.on_permission_denied(result)
            except Exception as e:
                logger.error(f"Permission denied callback error: {e}")

        return result

    async def require(
        self,
        user_id: str,
        document_id: str,
        required: Permission
    ) -> PermissionGrant:
        """Check permission and raise if denied."""
        result = await self.check(user_id, document_id, required)
        result.raise_if_denied()
        return result.grant

    def get_document_grants(self, document_id: str) -> list[PermissionGrant]:
        """Get all grants for a document."""
        if document_id not in self._grants:
            return []
        return list(self._grants[document_id].values())

    def get_user_grants(self, user_id: str) -> list[PermissionGrant]:
        """Get all grants for a user."""
        grants = []
        doc_ids = self._user_grants.get(user_id, set())

        for doc_id in doc_ids:
            grant = self.get_grant(user_id, doc_id)
            if grant:
                grants.append(grant)

        return grants

    async def cleanup_expired(self) -> int:
        """Remove expired grants."""
        removed = 0

        async with self._lock:
            for doc_id in list(self._grants.keys()):
                for user_id in list(self._grants[doc_id].keys()):
                    grant = self._grants[doc_id][user_id]
                    if grant.is_expired():
                        del self._grants[doc_id][user_id]
                        if user_id in self._user_grants:
                            self._user_grants[user_id].discard(doc_id)
                        removed += 1

        return removed

    def get_stats(self) -> dict:
        """Get checker statistics."""
        total_grants = sum(len(grants) for grants in self._grants.values())

        return {
            "checks_performed": self._checks_performed,
            "checks_allowed": self._checks_allowed,
            "checks_denied": self._checks_denied,
            "total_grants": total_grants,
            "documents_with_grants": len(self._grants),
            "users_with_grants": len(self._user_grants),
        }


def requires_permission(permission: Permission):
    """Decorator to check permission before function execution.

    Usage:
        @requires_permission(Permission.WRITE)
        async def edit_document(user_id, document_id, content):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user_id and document_id from kwargs or args
            user_id = kwargs.get("user_id")
            document_id = kwargs.get("document_id")

            if user_id is None and len(args) > 0:
                user_id = args[0]
            if document_id is None and len(args) > 1:
                document_id = args[1]

            if user_id is None or document_id is None:
                raise ValueError(
                    "requires_permission decorator needs user_id and document_id"
                )

            # Get global checker
            checker = get_permission_checker()
            if checker is None:
                raise RuntimeError("Permission checker not configured")

            await checker.require(user_id, document_id, permission)

            return await func(*args, **kwargs)

        return wrapper
    return decorator


# Global permission checker
_checker: Optional[PermissionChecker] = None


def get_permission_checker() -> Optional[PermissionChecker]:
    """Get global permission checker."""
    return _checker


def set_permission_checker(checker: PermissionChecker) -> None:
    """Set global permission checker."""
    global _checker
    _checker = checker


def reset_permission_checker() -> None:
    """Reset global permission checker."""
    global _checker
    _checker = None
