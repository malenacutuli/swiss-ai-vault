"""
Document Access Control for Collaboration

Provides:
- Document ownership and sharing
- Share links with configurable permissions
- Access invitations
- Group-based access
- Access policies and inheritance

Builds on top of the permissions module for fine-grained control.
"""

from __future__ import annotations

import asyncio
import secrets
import hashlib
from typing import Optional, Any, Callable, Awaitable, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

import logging

from app.collaboration.permissions import (
    Permission,
    Role,
    PermissionGrant,
    PermissionChecker,
    PermissionDeniedError,
    ROLE_PERMISSIONS,
)

logger = logging.getLogger(__name__)


class ShareLinkType(Enum):
    """Types of share links."""
    VIEW = "view"  # Read-only access
    COMMENT = "comment"  # Can add comments
    EDIT = "edit"  # Can edit document
    FULL = "full"  # Full access except ownership


class InvitationStatus(Enum):
    """Status of an invitation."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


@dataclass
class ShareLink:
    """A shareable link for document access."""
    id: str
    document_id: str
    link_type: ShareLinkType
    token: str  # The actual share token
    created_by: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    use_count: int = 0
    password_hash: Optional[str] = None
    allowed_domains: list[str] = field(default_factory=list)
    disabled: bool = False
    metadata: dict = field(default_factory=dict)

    def get_permission(self) -> Permission:
        """Get permission level for this link type."""
        return LINK_PERMISSIONS[self.link_type]

    def is_valid(self) -> bool:
        """Check if link is still valid."""
        if self.disabled:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        if self.max_uses and self.use_count >= self.max_uses:
            return False
        return True

    def verify_password(self, password: str) -> bool:
        """Verify link password."""
        if not self.password_hash:
            return True
        return hashlib.sha256(password.encode()).hexdigest() == self.password_hash

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "link_type": self.link_type.value,
            "token": self.token,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "max_uses": self.max_uses,
            "use_count": self.use_count,
            "password_hash": self.password_hash,
            "allowed_domains": self.allowed_domains,
            "disabled": self.disabled,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ShareLink":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            link_type=ShareLinkType(data["link_type"]),
            token=data["token"],
            created_by=data["created_by"],
            created_at=datetime.fromisoformat(data["created_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at") else None,
            max_uses=data.get("max_uses"),
            use_count=data.get("use_count", 0),
            password_hash=data.get("password_hash"),
            allowed_domains=data.get("allowed_domains", []),
            disabled=data.get("disabled", False),
            metadata=data.get("metadata", {}),
        )


# Link type to permission mapping
LINK_PERMISSIONS: dict[ShareLinkType, Permission] = {
    ShareLinkType.VIEW: Permission.READ,
    ShareLinkType.COMMENT: Permission.READ | Permission.COMMENT,
    ShareLinkType.EDIT: Permission.READ | Permission.COMMENT | Permission.WRITE,
    ShareLinkType.FULL: Permission.READ | Permission.COMMENT | Permission.WRITE | Permission.SHARE,
}


@dataclass
class Invitation:
    """An invitation to access a document."""
    id: str
    document_id: str
    inviter_id: str
    invitee_email: str
    invitee_id: Optional[str]  # Set when user accepts
    role: Role
    status: InvitationStatus
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    message: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if invitation has expired."""
        return datetime.utcnow() > self.expires_at

    def can_accept(self) -> bool:
        """Check if invitation can be accepted."""
        return (
            self.status == InvitationStatus.PENDING and
            not self.is_expired()
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "inviter_id": self.inviter_id,
            "invitee_email": self.invitee_email,
            "invitee_id": self.invitee_id,
            "role": self.role.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "message": self.message,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Invitation":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            inviter_id=data["inviter_id"],
            invitee_email=data["invitee_email"],
            invitee_id=data.get("invitee_id"),
            role=Role(data["role"]),
            status=InvitationStatus(data["status"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"]),
            accepted_at=datetime.fromisoformat(data["accepted_at"])
            if data.get("accepted_at") else None,
            message=data.get("message"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class AccessPolicy:
    """Access policy for a document."""
    document_id: str
    owner_id: str
    public_access: Permission = Permission.NONE
    default_role: Role = Role.VIEWER
    require_authentication: bool = True
    allow_anonymous: bool = False
    allowed_domains: list[str] = field(default_factory=list)
    blocked_users: set[str] = field(default_factory=set)
    inherit_from: Optional[str] = None  # Parent folder/document
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "document_id": self.document_id,
            "owner_id": self.owner_id,
            "public_access": int(self.public_access),
            "default_role": self.default_role.value,
            "require_authentication": self.require_authentication,
            "allow_anonymous": self.allow_anonymous,
            "allowed_domains": self.allowed_domains,
            "blocked_users": list(self.blocked_users),
            "inherit_from": self.inherit_from,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AccessPolicy":
        """Create from dictionary."""
        return cls(
            document_id=data["document_id"],
            owner_id=data["owner_id"],
            public_access=Permission(data.get("public_access", 0)),
            default_role=Role(data.get("default_role", "viewer")),
            require_authentication=data.get("require_authentication", True),
            allow_anonymous=data.get("allow_anonymous", False),
            allowed_domains=data.get("allowed_domains", []),
            blocked_users=set(data.get("blocked_users", [])),
            inherit_from=data.get("inherit_from"),
            created_at=datetime.fromisoformat(data["created_at"])
            if "created_at" in data else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data["updated_at"])
            if "updated_at" in data else datetime.utcnow(),
        )


class AccessController:
    """Controls access to documents with sharing and invitations."""

    def __init__(self, permission_checker: Optional[PermissionChecker] = None):
        self.permission_checker = permission_checker or PermissionChecker()
        self._lock = asyncio.Lock()

        # Storage
        self._policies: dict[str, AccessPolicy] = {}
        self._share_links: dict[str, ShareLink] = {}  # token -> link
        self._doc_links: dict[str, list[str]] = {}  # doc_id -> [tokens]
        self._invitations: dict[str, Invitation] = {}  # id -> invitation
        self._doc_invitations: dict[str, list[str]] = {}  # doc_id -> [ids]
        self._email_invitations: dict[str, list[str]] = {}  # email -> [ids]

        # Callbacks
        self.on_access_granted: Optional[
            Callable[[str, str, Permission], Awaitable[None]]
        ] = None
        self.on_invitation_sent: Optional[
            Callable[[Invitation], Awaitable[None]]
        ] = None

        # Stats
        self._links_created = 0
        self._links_used = 0
        self._invitations_sent = 0
        self._invitations_accepted = 0

    async def create_document(
        self,
        document_id: str,
        owner_id: str,
        public_access: Permission = Permission.NONE
    ) -> AccessPolicy:
        """Create access policy for a new document."""
        policy = AccessPolicy(
            document_id=document_id,
            owner_id=owner_id,
            public_access=public_access,
        )

        async with self._lock:
            self._policies[document_id] = policy

        # Grant owner full permissions
        await self.permission_checker.grant(
            user_id=owner_id,
            document_id=document_id,
            permissions=Permission.FULL,
            granted_by=owner_id,
        )

        return policy

    def get_policy(self, document_id: str) -> Optional[AccessPolicy]:
        """Get access policy for a document."""
        return self._policies.get(document_id)

    async def update_policy(
        self,
        document_id: str,
        updater_id: str,
        **updates
    ) -> Optional[AccessPolicy]:
        """Update access policy."""
        # Check permission
        await self.permission_checker.require(
            updater_id, document_id, Permission.ADMIN
        )

        async with self._lock:
            policy = self._policies.get(document_id)
            if not policy:
                return None

            for key, value in updates.items():
                if hasattr(policy, key):
                    setattr(policy, key, value)

            policy.updated_at = datetime.utcnow()

        return policy

    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete document and all access."""
        # Check ownership
        await self.permission_checker.require(
            user_id, document_id, Permission.OWNER
        )

        async with self._lock:
            # Remove policy
            if document_id in self._policies:
                del self._policies[document_id]

            # Remove share links
            if document_id in self._doc_links:
                for token in self._doc_links[document_id]:
                    if token in self._share_links:
                        del self._share_links[token]
                del self._doc_links[document_id]

            # Remove invitations
            if document_id in self._doc_invitations:
                for inv_id in self._doc_invitations[document_id]:
                    if inv_id in self._invitations:
                        del self._invitations[inv_id]
                del self._doc_invitations[document_id]

        return True

    # Share Links

    async def create_share_link(
        self,
        document_id: str,
        creator_id: str,
        link_type: ShareLinkType = ShareLinkType.VIEW,
        expires_in: Optional[timedelta] = None,
        max_uses: Optional[int] = None,
        password: Optional[str] = None,
        allowed_domains: Optional[list[str]] = None
    ) -> ShareLink:
        """Create a share link for a document."""
        # Check permission to share
        await self.permission_checker.require(
            creator_id, document_id, Permission.SHARE
        )

        link_id = secrets.token_hex(8)
        token = secrets.token_urlsafe(32)

        link = ShareLink(
            id=link_id,
            document_id=document_id,
            link_type=link_type,
            token=token,
            created_by=creator_id,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + expires_in if expires_in else None,
            max_uses=max_uses,
            password_hash=hashlib.sha256(password.encode()).hexdigest()
            if password else None,
            allowed_domains=allowed_domains or [],
        )

        async with self._lock:
            self._share_links[token] = link

            if document_id not in self._doc_links:
                self._doc_links[document_id] = []
            self._doc_links[document_id].append(token)

            self._links_created += 1

        return link

    async def use_share_link(
        self,
        token: str,
        user_id: str,
        password: Optional[str] = None,
        user_email: Optional[str] = None
    ) -> Optional[Permission]:
        """Use a share link to gain access."""
        link = self._share_links.get(token)
        if not link:
            return None

        if not link.is_valid():
            return None

        # Verify password if required
        if link.password_hash and not link.verify_password(password or ""):
            return None

        # Check domain restriction
        if link.allowed_domains and user_email:
            domain = user_email.split("@")[-1] if "@" in user_email else ""
            if domain not in link.allowed_domains:
                return None

        # Grant permission
        permission = link.get_permission()

        await self.permission_checker.grant(
            user_id=user_id,
            document_id=link.document_id,
            permissions=permission,
            granted_by=link.created_by,
        )

        async with self._lock:
            link.use_count += 1
            self._links_used += 1

        if self.on_access_granted:
            try:
                await self.on_access_granted(user_id, link.document_id, permission)
            except Exception as e:
                logger.error(f"Access granted callback error: {e}")

        return permission

    def get_share_link(self, token: str) -> Optional[ShareLink]:
        """Get share link by token."""
        return self._share_links.get(token)

    def get_document_links(self, document_id: str) -> list[ShareLink]:
        """Get all share links for a document."""
        tokens = self._doc_links.get(document_id, [])
        return [self._share_links[t] for t in tokens if t in self._share_links]

    async def revoke_share_link(
        self,
        token: str,
        user_id: str
    ) -> bool:
        """Revoke a share link."""
        link = self._share_links.get(token)
        if not link:
            return False

        # Check permission
        await self.permission_checker.require(
            user_id, link.document_id, Permission.SHARE
        )

        async with self._lock:
            link.disabled = True

        return True

    # Invitations

    async def create_invitation(
        self,
        document_id: str,
        inviter_id: str,
        invitee_email: str,
        role: Role = Role.VIEWER,
        expires_in: timedelta = timedelta(days=7),
        message: Optional[str] = None
    ) -> Invitation:
        """Create an invitation to access a document."""
        # Check permission to share
        await self.permission_checker.require(
            inviter_id, document_id, Permission.SHARE
        )

        inv_id = secrets.token_hex(8)

        invitation = Invitation(
            id=inv_id,
            document_id=document_id,
            inviter_id=inviter_id,
            invitee_email=invitee_email,
            invitee_id=None,
            role=role,
            status=InvitationStatus.PENDING,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + expires_in,
            message=message,
        )

        async with self._lock:
            self._invitations[inv_id] = invitation

            if document_id not in self._doc_invitations:
                self._doc_invitations[document_id] = []
            self._doc_invitations[document_id].append(inv_id)

            if invitee_email not in self._email_invitations:
                self._email_invitations[invitee_email] = []
            self._email_invitations[invitee_email].append(inv_id)

            self._invitations_sent += 1

        if self.on_invitation_sent:
            try:
                await self.on_invitation_sent(invitation)
            except Exception as e:
                logger.error(f"Invitation sent callback error: {e}")

        return invitation

    async def accept_invitation(
        self,
        invitation_id: str,
        user_id: str
    ) -> Optional[PermissionGrant]:
        """Accept an invitation."""
        invitation = self._invitations.get(invitation_id)
        if not invitation:
            return None

        if not invitation.can_accept():
            return None

        # Grant permissions based on role
        permission = invitation.role.get_permissions()

        grant = await self.permission_checker.grant(
            user_id=user_id,
            document_id=invitation.document_id,
            permissions=permission,
            granted_by=invitation.inviter_id,
        )

        async with self._lock:
            invitation.status = InvitationStatus.ACCEPTED
            invitation.invitee_id = user_id
            invitation.accepted_at = datetime.utcnow()
            self._invitations_accepted += 1

        if self.on_access_granted:
            try:
                await self.on_access_granted(
                    user_id, invitation.document_id, permission
                )
            except Exception as e:
                logger.error(f"Access granted callback error: {e}")

        return grant

    async def decline_invitation(self, invitation_id: str) -> bool:
        """Decline an invitation."""
        invitation = self._invitations.get(invitation_id)
        if not invitation:
            return False

        if invitation.status != InvitationStatus.PENDING:
            return False

        async with self._lock:
            invitation.status = InvitationStatus.DECLINED

        return True

    async def revoke_invitation(
        self,
        invitation_id: str,
        user_id: str
    ) -> bool:
        """Revoke an invitation."""
        invitation = self._invitations.get(invitation_id)
        if not invitation:
            return False

        # Check permission
        await self.permission_checker.require(
            user_id, invitation.document_id, Permission.SHARE
        )

        async with self._lock:
            invitation.status = InvitationStatus.REVOKED

        return True

    def get_invitation(self, invitation_id: str) -> Optional[Invitation]:
        """Get invitation by ID."""
        return self._invitations.get(invitation_id)

    def get_document_invitations(self, document_id: str) -> list[Invitation]:
        """Get all invitations for a document."""
        ids = self._doc_invitations.get(document_id, [])
        return [self._invitations[i] for i in ids if i in self._invitations]

    def get_user_invitations(self, email: str) -> list[Invitation]:
        """Get all invitations for an email."""
        ids = self._email_invitations.get(email, [])
        return [self._invitations[i] for i in ids if i in self._invitations]

    # Access Checks

    async def can_access(
        self,
        user_id: str,
        document_id: str,
        required: Permission
    ) -> bool:
        """Check if user can access document with required permission."""
        policy = self._policies.get(document_id)

        # Check if blocked
        if policy and user_id in policy.blocked_users:
            return False

        # Check public access
        if policy and (policy.public_access & required) == required:
            return True

        # Check permission grants
        result = await self.permission_checker.check(user_id, document_id, required)
        return result.allowed

    async def get_access_list(self, document_id: str) -> list[dict]:
        """Get list of users with access to a document."""
        grants = self.permission_checker.get_document_grants(document_id)
        policy = self._policies.get(document_id)

        result = []
        for grant in grants:
            is_owner = policy and grant.user_id == policy.owner_id
            result.append({
                "user_id": grant.user_id,
                "permissions": int(grant.permissions),
                "is_owner": is_owner,
                "granted_at": grant.granted_at.isoformat(),
                "granted_by": grant.granted_by,
            })

        return result

    async def block_user(
        self,
        document_id: str,
        blocker_id: str,
        user_id: str
    ) -> bool:
        """Block a user from accessing a document."""
        await self.permission_checker.require(
            blocker_id, document_id, Permission.ADMIN
        )

        async with self._lock:
            policy = self._policies.get(document_id)
            if not policy:
                return False

            policy.blocked_users.add(user_id)

        # Revoke existing permissions
        await self.permission_checker.revoke(user_id, document_id)

        return True

    async def unblock_user(
        self,
        document_id: str,
        unblocker_id: str,
        user_id: str
    ) -> bool:
        """Unblock a user from accessing a document."""
        await self.permission_checker.require(
            unblocker_id, document_id, Permission.ADMIN
        )

        async with self._lock:
            policy = self._policies.get(document_id)
            if not policy:
                return False

            policy.blocked_users.discard(user_id)

        return True

    def get_stats(self) -> dict:
        """Get controller statistics."""
        return {
            "documents": len(self._policies),
            "share_links_created": self._links_created,
            "share_links_used": self._links_used,
            "active_share_links": len(self._share_links),
            "invitations_sent": self._invitations_sent,
            "invitations_accepted": self._invitations_accepted,
            "pending_invitations": sum(
                1 for inv in self._invitations.values()
                if inv.status == InvitationStatus.PENDING
            ),
            "permission_stats": self.permission_checker.get_stats(),
        }


# Factory function
def create_access_controller(
    permission_checker: Optional[PermissionChecker] = None
) -> AccessController:
    """Create an access controller with optional permission checker."""
    return AccessController(permission_checker)
