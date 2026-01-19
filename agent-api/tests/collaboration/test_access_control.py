"""Tests for Access Control Module."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.permissions import (
    Permission,
    Role,
    PermissionChecker,
    PermissionDeniedError,
)
from app.collaboration.access_control import (
    AccessController,
    AccessPolicy,
    ShareLink,
    ShareLinkType,
    Invitation,
    InvitationStatus,
    LINK_PERMISSIONS,
    create_access_controller,
)


class TestShareLinkType:
    """Tests for ShareLinkType enum."""

    def test_link_type_values(self):
        """Link type values are correct."""
        assert ShareLinkType.VIEW.value == "view"
        assert ShareLinkType.COMMENT.value == "comment"
        assert ShareLinkType.EDIT.value == "edit"
        assert ShareLinkType.FULL.value == "full"

    def test_link_permissions(self):
        """Link types have correct permissions."""
        assert LINK_PERMISSIONS[ShareLinkType.VIEW] == Permission.READ
        assert LINK_PERMISSIONS[ShareLinkType.EDIT] == (
            Permission.READ | Permission.COMMENT | Permission.WRITE
        )


class TestShareLink:
    """Tests for ShareLink."""

    def test_create_link(self):
        """Create a share link."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.EDIT,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
        )

        assert link.document_id == "doc_1"
        assert link.link_type == ShareLinkType.EDIT

    def test_get_permission(self):
        """Get permission for link type."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.EDIT,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
        )

        perm = link.get_permission()

        assert (perm & Permission.READ) == Permission.READ
        assert (perm & Permission.WRITE) == Permission.WRITE

    def test_is_valid(self):
        """Check if link is valid."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.VIEW,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
        )

        assert link.is_valid() is True

    def test_is_valid_disabled(self):
        """Disabled link is not valid."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.VIEW,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
            disabled=True,
        )

        assert link.is_valid() is False

    def test_is_valid_expired(self):
        """Expired link is not valid."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.VIEW,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow() - timedelta(hours=2),
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )

        assert link.is_valid() is False

    def test_is_valid_max_uses(self):
        """Link exceeding max uses is not valid."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.VIEW,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
            max_uses=5,
            use_count=5,
        )

        assert link.is_valid() is False

    def test_verify_password(self):
        """Verify link password."""
        import hashlib
        password = "secret123"
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.VIEW,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
            password_hash=password_hash,
        )

        assert link.verify_password("secret123") is True
        assert link.verify_password("wrong") is False

    def test_to_dict(self):
        """Convert link to dictionary."""
        link = ShareLink(
            id="link_1",
            document_id="doc_1",
            link_type=ShareLinkType.EDIT,
            token="abc123",
            created_by="user_1",
            created_at=datetime.utcnow(),
        )

        d = link.to_dict()

        assert d["id"] == "link_1"
        assert d["link_type"] == "edit"

    def test_from_dict(self):
        """Create link from dictionary."""
        data = {
            "id": "link_1",
            "document_id": "doc_1",
            "link_type": "edit",
            "token": "abc123",
            "created_by": "user_1",
            "created_at": "2024-01-01T00:00:00",
        }

        link = ShareLink.from_dict(data)

        assert link.id == "link_1"
        assert link.link_type == ShareLinkType.EDIT


class TestInvitationStatus:
    """Tests for InvitationStatus enum."""

    def test_status_values(self):
        """Status values are correct."""
        assert InvitationStatus.PENDING.value == "pending"
        assert InvitationStatus.ACCEPTED.value == "accepted"
        assert InvitationStatus.DECLINED.value == "declined"
        assert InvitationStatus.EXPIRED.value == "expired"
        assert InvitationStatus.REVOKED.value == "revoked"


class TestInvitation:
    """Tests for Invitation."""

    def test_create_invitation(self):
        """Create an invitation."""
        inv = Invitation(
            id="inv_1",
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            invitee_id=None,
            role=Role.EDITOR,
            status=InvitationStatus.PENDING,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
        )

        assert inv.invitee_email == "alice@example.com"
        assert inv.role == Role.EDITOR

    def test_is_expired(self):
        """Check if invitation is expired."""
        inv = Invitation(
            id="inv_1",
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            invitee_id=None,
            role=Role.EDITOR,
            status=InvitationStatus.PENDING,
            created_at=datetime.utcnow() - timedelta(days=10),
            expires_at=datetime.utcnow() - timedelta(days=3),
        )

        assert inv.is_expired() is True

    def test_can_accept(self):
        """Check if invitation can be accepted."""
        inv = Invitation(
            id="inv_1",
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            invitee_id=None,
            role=Role.EDITOR,
            status=InvitationStatus.PENDING,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
        )

        assert inv.can_accept() is True

    def test_can_accept_already_accepted(self):
        """Cannot accept already accepted invitation."""
        inv = Invitation(
            id="inv_1",
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            invitee_id="alice_id",
            role=Role.EDITOR,
            status=InvitationStatus.ACCEPTED,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
        )

        assert inv.can_accept() is False

    def test_to_dict(self):
        """Convert invitation to dictionary."""
        inv = Invitation(
            id="inv_1",
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            invitee_id=None,
            role=Role.EDITOR,
            status=InvitationStatus.PENDING,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
        )

        d = inv.to_dict()

        assert d["id"] == "inv_1"
        assert d["role"] == "editor"
        assert d["status"] == "pending"

    def test_from_dict(self):
        """Create invitation from dictionary."""
        data = {
            "id": "inv_1",
            "document_id": "doc_1",
            "inviter_id": "user_1",
            "invitee_email": "alice@example.com",
            "role": "editor",
            "status": "pending",
            "created_at": "2024-01-01T00:00:00",
            "expires_at": "2024-01-08T00:00:00",
        }

        inv = Invitation.from_dict(data)

        assert inv.id == "inv_1"
        assert inv.role == Role.EDITOR


class TestAccessPolicy:
    """Tests for AccessPolicy."""

    def test_create_policy(self):
        """Create an access policy."""
        policy = AccessPolicy(
            document_id="doc_1",
            owner_id="user_1",
        )

        assert policy.document_id == "doc_1"
        assert policy.owner_id == "user_1"
        assert policy.public_access == Permission.NONE

    def test_to_dict(self):
        """Convert policy to dictionary."""
        policy = AccessPolicy(
            document_id="doc_1",
            owner_id="user_1",
            public_access=Permission.READ,
        )

        d = policy.to_dict()

        assert d["document_id"] == "doc_1"
        assert d["public_access"] == int(Permission.READ)

    def test_from_dict(self):
        """Create policy from dictionary."""
        data = {
            "document_id": "doc_1",
            "owner_id": "user_1",
            "public_access": 1,
            "default_role": "viewer",
        }

        policy = AccessPolicy.from_dict(data)

        assert policy.document_id == "doc_1"
        assert policy.public_access == Permission.READ


class TestAccessController:
    """Tests for AccessController."""

    @pytest.fixture
    def checker(self):
        return PermissionChecker()

    @pytest.fixture
    def controller(self, checker):
        return AccessController(checker)

    @pytest.mark.asyncio
    async def test_create_document(self, controller):
        """Create document with access policy."""
        policy = await controller.create_document("doc_1", "user_1")

        assert policy.document_id == "doc_1"
        assert policy.owner_id == "user_1"

        # Owner has full permissions
        perm = controller.permission_checker.get_permissions("user_1", "doc_1")
        assert perm == Permission.FULL

    @pytest.mark.asyncio
    async def test_get_policy(self, controller):
        """Get document access policy."""
        await controller.create_document("doc_1", "user_1")

        policy = controller.get_policy("doc_1")

        assert policy is not None
        assert policy.owner_id == "user_1"

    @pytest.mark.asyncio
    async def test_update_policy(self, controller):
        """Update access policy."""
        await controller.create_document("doc_1", "user_1")

        policy = await controller.update_policy(
            "doc_1", "user_1",
            public_access=Permission.READ
        )

        assert policy.public_access == Permission.READ

    @pytest.mark.asyncio
    async def test_delete_document(self, controller):
        """Delete document and access."""
        await controller.create_document("doc_1", "user_1")

        result = await controller.delete_document("doc_1", "user_1")

        assert result is True
        assert controller.get_policy("doc_1") is None

    # Share Links

    @pytest.mark.asyncio
    async def test_create_share_link(self, controller):
        """Create share link."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link(
            document_id="doc_1",
            creator_id="user_1",
            link_type=ShareLinkType.EDIT,
        )

        assert link.document_id == "doc_1"
        assert link.link_type == ShareLinkType.EDIT

    @pytest.mark.asyncio
    async def test_create_share_link_with_expiry(self, controller):
        """Create share link with expiry."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link(
            document_id="doc_1",
            creator_id="user_1",
            expires_in=timedelta(hours=24),
        )

        assert link.expires_at is not None

    @pytest.mark.asyncio
    async def test_create_share_link_with_password(self, controller):
        """Create share link with password."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link(
            document_id="doc_1",
            creator_id="user_1",
            password="secret",
        )

        assert link.password_hash is not None

    @pytest.mark.asyncio
    async def test_use_share_link(self, controller):
        """Use share link to gain access."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link(
            document_id="doc_1",
            creator_id="user_1",
            link_type=ShareLinkType.EDIT,
        )

        perm = await controller.use_share_link(link.token, "user_2")

        assert perm is not None
        assert (perm & Permission.WRITE) == Permission.WRITE

    @pytest.mark.asyncio
    async def test_use_share_link_with_password(self, controller):
        """Use share link with password."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link(
            document_id="doc_1",
            creator_id="user_1",
            password="secret",
        )

        # Wrong password
        perm = await controller.use_share_link(link.token, "user_2", password="wrong")
        assert perm is None

        # Correct password
        perm = await controller.use_share_link(link.token, "user_2", password="secret")
        assert perm is not None

    @pytest.mark.asyncio
    async def test_use_invalid_share_link(self, controller):
        """Use invalid share link returns None."""
        perm = await controller.use_share_link("invalid_token", "user_2")
        assert perm is None

    @pytest.mark.asyncio
    async def test_get_document_links(self, controller):
        """Get all share links for document."""
        await controller.create_document("doc_1", "user_1")

        await controller.create_share_link("doc_1", "user_1")
        await controller.create_share_link("doc_1", "user_1")

        links = controller.get_document_links("doc_1")

        assert len(links) == 2

    @pytest.mark.asyncio
    async def test_revoke_share_link(self, controller):
        """Revoke share link."""
        await controller.create_document("doc_1", "user_1")

        link = await controller.create_share_link("doc_1", "user_1")

        result = await controller.revoke_share_link(link.token, "user_1")
        assert result is True

        # Link is now disabled
        assert link.disabled is True

    # Invitations

    @pytest.mark.asyncio
    async def test_create_invitation(self, controller):
        """Create invitation."""
        await controller.create_document("doc_1", "user_1")

        inv = await controller.create_invitation(
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            role=Role.EDITOR,
        )

        assert inv.invitee_email == "alice@example.com"
        assert inv.role == Role.EDITOR

    @pytest.mark.asyncio
    async def test_accept_invitation(self, controller):
        """Accept invitation."""
        await controller.create_document("doc_1", "user_1")

        inv = await controller.create_invitation(
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
            role=Role.EDITOR,
        )

        grant = await controller.accept_invitation(inv.id, "alice_id")

        assert grant is not None
        assert grant.permissions == Role.EDITOR.get_permissions()
        assert inv.status == InvitationStatus.ACCEPTED

    @pytest.mark.asyncio
    async def test_decline_invitation(self, controller):
        """Decline invitation."""
        await controller.create_document("doc_1", "user_1")

        inv = await controller.create_invitation(
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
        )

        result = await controller.decline_invitation(inv.id)

        assert result is True
        assert inv.status == InvitationStatus.DECLINED

    @pytest.mark.asyncio
    async def test_revoke_invitation(self, controller):
        """Revoke invitation."""
        await controller.create_document("doc_1", "user_1")

        inv = await controller.create_invitation(
            document_id="doc_1",
            inviter_id="user_1",
            invitee_email="alice@example.com",
        )

        result = await controller.revoke_invitation(inv.id, "user_1")

        assert result is True
        assert inv.status == InvitationStatus.REVOKED

    @pytest.mark.asyncio
    async def test_get_document_invitations(self, controller):
        """Get all invitations for document."""
        await controller.create_document("doc_1", "user_1")

        await controller.create_invitation("doc_1", "user_1", "alice@example.com")
        await controller.create_invitation("doc_1", "user_1", "bob@example.com")

        invitations = controller.get_document_invitations("doc_1")

        assert len(invitations) == 2

    @pytest.mark.asyncio
    async def test_get_user_invitations(self, controller):
        """Get all invitations for email."""
        await controller.create_document("doc_1", "user_1")
        await controller.create_document("doc_2", "user_1")

        await controller.create_invitation("doc_1", "user_1", "alice@example.com")
        await controller.create_invitation("doc_2", "user_1", "alice@example.com")

        invitations = controller.get_user_invitations("alice@example.com")

        assert len(invitations) == 2

    # Access Checks

    @pytest.mark.asyncio
    async def test_can_access(self, controller):
        """Check if user can access document."""
        await controller.create_document("doc_1", "user_1")

        can_access = await controller.can_access("user_1", "doc_1", Permission.READ)

        assert can_access is True

    @pytest.mark.asyncio
    async def test_can_access_blocked_user(self, controller):
        """Blocked user cannot access document."""
        await controller.create_document("doc_1", "user_1")

        # Grant and then block
        await controller.permission_checker.grant(
            "user_2", "doc_1", Permission.EDITOR, "user_1"
        )
        await controller.block_user("doc_1", "user_1", "user_2")

        can_access = await controller.can_access("user_2", "doc_1", Permission.READ)

        assert can_access is False

    @pytest.mark.asyncio
    async def test_get_access_list(self, controller):
        """Get list of users with access."""
        await controller.create_document("doc_1", "user_1")

        await controller.permission_checker.grant(
            "user_2", "doc_1", Permission.EDITOR, "user_1"
        )

        access_list = await controller.get_access_list("doc_1")

        assert len(access_list) == 2

    @pytest.mark.asyncio
    async def test_block_user(self, controller):
        """Block user from document."""
        await controller.create_document("doc_1", "user_1")

        result = await controller.block_user("doc_1", "user_1", "user_2")

        assert result is True

        policy = controller.get_policy("doc_1")
        assert "user_2" in policy.blocked_users

    @pytest.mark.asyncio
    async def test_unblock_user(self, controller):
        """Unblock user from document."""
        await controller.create_document("doc_1", "user_1")
        await controller.block_user("doc_1", "user_1", "user_2")

        result = await controller.unblock_user("doc_1", "user_1", "user_2")

        assert result is True

        policy = controller.get_policy("doc_1")
        assert "user_2" not in policy.blocked_users

    @pytest.mark.asyncio
    async def test_get_stats(self, controller):
        """Get controller statistics."""
        await controller.create_document("doc_1", "user_1")
        await controller.create_share_link("doc_1", "user_1")
        await controller.create_invitation("doc_1", "user_1", "alice@example.com")

        stats = controller.get_stats()

        assert stats["documents"] == 1
        assert stats["share_links_created"] == 1
        assert stats["invitations_sent"] == 1

    @pytest.mark.asyncio
    async def test_access_granted_callback(self, controller):
        """Access granted callback is invoked."""
        grants = []

        async def on_granted(user_id, doc_id, perm):
            grants.append((user_id, doc_id, perm))

        controller.on_access_granted = on_granted

        await controller.create_document("doc_1", "user_1")
        link = await controller.create_share_link("doc_1", "user_1")
        await controller.use_share_link(link.token, "user_2")

        assert len(grants) == 1
        assert grants[0][0] == "user_2"


class TestCreateAccessController:
    """Tests for factory function."""

    def test_create_with_defaults(self):
        """Create controller with default settings."""
        controller = create_access_controller()

        assert controller is not None
        assert controller.permission_checker is not None

    def test_create_with_checker(self):
        """Create controller with custom permission checker."""
        checker = PermissionChecker()
        controller = create_access_controller(checker)

        assert controller.permission_checker is checker
