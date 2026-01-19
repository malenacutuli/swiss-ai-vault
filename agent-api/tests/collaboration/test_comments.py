"""Tests for Comments System."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.comments import (
    CommentManager,
    CommentConfig,
    Comment,
    CommentState,
    CommentType,
    CommentAnchor,
    CommentThread,
    Mention,
    Reaction,
    MentionParser,
    get_comment_manager,
    set_comment_manager,
    reset_comment_manager,
)


class TestCommentState:
    """Tests for CommentState enum."""

    def test_state_values(self):
        """State values are correct."""
        assert CommentState.ACTIVE.value == "active"
        assert CommentState.RESOLVED.value == "resolved"
        assert CommentState.ARCHIVED.value == "archived"
        assert CommentState.DELETED.value == "deleted"


class TestCommentType:
    """Tests for CommentType enum."""

    def test_type_values(self):
        """Type values are correct."""
        assert CommentType.COMMENT.value == "comment"
        assert CommentType.SUGGESTION.value == "suggestion"
        assert CommentType.QUESTION.value == "question"
        assert CommentType.TASK.value == "task"


class TestCommentConfig:
    """Tests for CommentConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = CommentConfig()

        assert config.max_comment_length == 10000
        assert config.max_replies_per_thread == 100
        assert config.enable_mentions is True

    def test_custom_config(self):
        """Custom configuration."""
        config = CommentConfig(
            max_comment_length=5000,
            enable_reactions=False,
        )

        assert config.max_comment_length == 5000
        assert config.enable_reactions is False


class TestCommentAnchor:
    """Tests for CommentAnchor."""

    def test_create_anchor(self):
        """Create an anchor."""
        anchor = CommentAnchor(start=10, end=50, text="selected text")

        assert anchor.start == 10
        assert anchor.end == 50
        assert anchor.text == "selected text"

    def test_to_dict(self):
        """Convert to dictionary."""
        anchor = CommentAnchor(start=10, end=50)
        d = anchor.to_dict()

        assert d["start"] == 10
        assert d["end"] == 50

    def test_from_dict(self):
        """Create from dictionary."""
        anchor = CommentAnchor.from_dict({"start": 20, "end": 60, "text": "test"})

        assert anchor.start == 20
        assert anchor.text == "test"


class TestMention:
    """Tests for Mention."""

    def test_create_mention(self):
        """Create a mention."""
        mention = Mention(
            user_id="user123",
            username="john",
            start=5,
            end=10,
        )

        assert mention.user_id == "user123"
        assert mention.username == "john"

    def test_to_dict(self):
        """Convert to dictionary."""
        mention = Mention(user_id="user1", username="alice", start=0, end=6)
        d = mention.to_dict()

        assert d["user_id"] == "user1"
        assert d["username"] == "alice"


class TestReaction:
    """Tests for Reaction."""

    def test_create_reaction(self):
        """Create a reaction."""
        reaction = Reaction(
            emoji="thumbs_up",
            user_id="user1",
            created_at=datetime.utcnow(),
        )

        assert reaction.emoji == "thumbs_up"

    def test_to_dict(self):
        """Convert to dictionary."""
        reaction = Reaction(emoji="heart", user_id="user1", created_at=datetime.utcnow())
        d = reaction.to_dict()

        assert d["emoji"] == "heart"


class TestMentionParser:
    """Tests for MentionParser."""

    @pytest.fixture
    def parser(self):
        """Create a parser."""
        return MentionParser()

    def test_parse_single_mention(self, parser):
        """Parse a single mention."""
        mentions = parser.parse("Hello @alice!")

        assert len(mentions) == 1
        assert mentions[0].username == "alice"

    def test_parse_multiple_mentions(self, parser):
        """Parse multiple mentions."""
        mentions = parser.parse("Hey @alice and @bob!")

        assert len(mentions) == 2
        assert mentions[0].username == "alice"
        assert mentions[1].username == "bob"

    def test_parse_no_mentions(self, parser):
        """Parse text without mentions."""
        mentions = parser.parse("Hello world!")

        assert len(mentions) == 0

    def test_parse_with_resolver(self):
        """Parse with user resolver."""
        def resolver(username):
            return f"id_{username}"

        parser = MentionParser(resolver)
        mentions = parser.parse("Hi @john")

        assert mentions[0].user_id == "id_john"

    def test_parse_position(self, parser):
        """Parse captures correct positions."""
        mentions = parser.parse("Hello @alice!")

        assert mentions[0].start == 6
        assert mentions[0].end == 12


class TestComment:
    """Tests for Comment."""

    @pytest.fixture
    def comment(self):
        """Create a test comment."""
        now = datetime.utcnow()
        return Comment(
            id="comment_123",
            document_id="doc1",
            author_id="user1",
            content="This is a comment",
            state=CommentState.ACTIVE,
            comment_type=CommentType.COMMENT,
            created_at=now,
            updated_at=now,
        )

    def test_is_reply(self, comment):
        """Check if comment is a reply."""
        assert comment.is_reply() is False

        comment.parent_id = "comment_parent"
        assert comment.is_reply() is True

    def test_is_resolved(self, comment):
        """Check if comment is resolved."""
        assert comment.is_resolved() is False

        comment.state = CommentState.RESOLVED
        assert comment.is_resolved() is True

    def test_can_edit_author(self, comment):
        """Author can edit within window."""
        assert comment.can_edit("user1", timedelta(minutes=15)) is True

    def test_can_edit_other_user(self, comment):
        """Other users cannot edit."""
        assert comment.can_edit("user2", timedelta(minutes=15)) is False

    def test_can_edit_expired_window(self, comment):
        """Cannot edit after window expires."""
        comment.created_at = datetime.utcnow() - timedelta(hours=1)
        assert comment.can_edit("user1", timedelta(minutes=15)) is False

    def test_to_dict(self, comment):
        """Convert to dictionary."""
        d = comment.to_dict()

        assert d["id"] == "comment_123"
        assert d["content"] == "This is a comment"

    def test_from_dict(self, comment):
        """Create from dictionary."""
        d = comment.to_dict()
        recreated = Comment.from_dict(d)

        assert recreated.id == comment.id
        assert recreated.content == comment.content


class TestCommentManager:
    """Tests for CommentManager."""

    @pytest.fixture
    def manager(self):
        """Create a comment manager."""
        return CommentManager()

    @pytest.mark.asyncio
    async def test_create_comment(self, manager):
        """Create a new comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Test comment",
        )

        assert comment is not None
        assert comment.content == "Test comment"
        assert comment.state == CommentState.ACTIVE

    @pytest.mark.asyncio
    async def test_create_comment_with_anchor(self, manager):
        """Create comment with anchor."""
        anchor = CommentAnchor(start=10, end=50, text="selected")
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Comment on selection",
            anchor=anchor,
        )

        assert comment.anchor is not None
        assert comment.anchor.start == 10

    @pytest.mark.asyncio
    async def test_create_reply(self, manager):
        """Create a reply to a comment."""
        parent = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Parent comment",
        )
        reply = await manager.create_comment(
            document_id="doc1",
            author_id="user2",
            content="Reply comment",
            parent_id=parent.id,
        )

        assert reply.parent_id == parent.id
        assert reply.thread_id == parent.id
        assert reply.is_reply() is True

    @pytest.mark.asyncio
    async def test_create_comment_parses_mentions(self, manager):
        """Comments with mentions are parsed."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Hey @alice check this out",
        )

        assert len(comment.mentions) == 1
        assert comment.mentions[0].username == "alice"

    @pytest.mark.asyncio
    async def test_create_comment_max_length(self, manager):
        """Comment exceeding max length raises error."""
        config = CommentConfig(max_comment_length=100)
        manager = CommentManager(config)

        with pytest.raises(ValueError, match="max length"):
            await manager.create_comment(
                document_id="doc1",
                author_id="user1",
                content="x" * 200,
            )

    @pytest.mark.asyncio
    async def test_update_comment(self, manager):
        """Update a comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Original",
        )

        updated = await manager.update_comment(
            comment.id,
            user_id="user1",
            content="Updated content",
        )

        assert updated is not None
        assert updated.content == "Updated content"

    @pytest.mark.asyncio
    async def test_update_comment_wrong_user(self, manager):
        """Other users cannot update comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Original",
        )

        updated = await manager.update_comment(
            comment.id,
            user_id="user2",
            content="Updated",
        )

        assert updated is None

    @pytest.mark.asyncio
    async def test_delete_comment(self, manager):
        """Delete a comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="To delete",
        )

        deleted = await manager.delete_comment(comment.id, "user1")

        assert deleted is True
        assert comment.state == CommentState.DELETED
        assert comment.content == "[deleted]"

    @pytest.mark.asyncio
    async def test_resolve_comment(self, manager):
        """Resolve a comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Issue to resolve",
        )

        resolved = await manager.resolve_comment(comment.id, "user2")

        assert resolved is not None
        assert resolved.state == CommentState.RESOLVED
        assert resolved.resolved_by == "user2"

    @pytest.mark.asyncio
    async def test_resolve_reply_resolves_thread(self, manager):
        """Resolving a reply resolves the thread root."""
        parent = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Parent",
        )
        reply = await manager.create_comment(
            document_id="doc1",
            author_id="user2",
            content="Reply",
            parent_id=parent.id,
        )

        resolved = await manager.resolve_comment(reply.id, "user3")

        assert resolved.id == parent.id
        assert parent.state == CommentState.RESOLVED

    @pytest.mark.asyncio
    async def test_unresolve_comment(self, manager):
        """Unresolve a comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Issue",
        )
        await manager.resolve_comment(comment.id, "user2")

        unresolved = await manager.unresolve_comment(comment.id)

        assert unresolved is not None
        assert unresolved.state == CommentState.ACTIVE

    @pytest.mark.asyncio
    async def test_add_reaction(self, manager):
        """Add a reaction to a comment."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Nice work!",
        )

        reaction = await manager.add_reaction(comment.id, "user2", "thumbs_up")

        assert reaction is not None
        assert len(comment.reactions) == 1

    @pytest.mark.asyncio
    async def test_add_duplicate_reaction(self, manager):
        """Cannot add duplicate reaction."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Nice!",
        )

        await manager.add_reaction(comment.id, "user2", "thumbs_up")
        duplicate = await manager.add_reaction(comment.id, "user2", "thumbs_up")

        assert duplicate is None

    @pytest.mark.asyncio
    async def test_remove_reaction(self, manager):
        """Remove a reaction."""
        comment = await manager.create_comment(
            document_id="doc1",
            author_id="user1",
            content="Nice!",
        )
        await manager.add_reaction(comment.id, "user2", "thumbs_up")

        removed = await manager.remove_reaction(comment.id, "user2", "thumbs_up")

        assert removed is True
        assert len(comment.reactions) == 0

    @pytest.mark.asyncio
    async def test_get_document_comments(self, manager):
        """Get comments for a document."""
        await manager.create_comment("doc1", "user1", "Comment 1")
        await manager.create_comment("doc1", "user2", "Comment 2")
        await manager.create_comment("doc2", "user1", "Other doc")

        comments = manager.get_document_comments("doc1")

        assert len(comments) == 2

    @pytest.mark.asyncio
    async def test_get_document_comments_excludes_deleted(self, manager):
        """Deleted comments are excluded by default."""
        c1 = await manager.create_comment("doc1", "user1", "Comment 1")
        await manager.create_comment("doc1", "user2", "Comment 2")
        await manager.delete_comment(c1.id, "user1")

        comments = manager.get_document_comments("doc1")

        assert len(comments) == 1

    @pytest.mark.asyncio
    async def test_get_thread(self, manager):
        """Get a comment thread."""
        parent = await manager.create_comment("doc1", "user1", "Parent")
        await manager.create_comment("doc1", "user2", "Reply 1", parent_id=parent.id)
        await manager.create_comment("doc1", "user3", "Reply 2", parent_id=parent.id)

        thread = manager.get_thread(parent.id)

        assert thread is not None
        assert thread.reply_count == 2
        assert len(thread.participant_ids) == 3

    @pytest.mark.asyncio
    async def test_get_user_mentions(self, manager):
        """Get comments mentioning a user."""
        def resolver(username):
            return f"id_{username}"

        manager.set_user_resolver(resolver)

        await manager.create_comment("doc1", "user1", "Hey @alice check this")
        await manager.create_comment("doc1", "user2", "Also @alice please review")
        await manager.create_comment("doc1", "user3", "Just a comment")

        mentions = manager.get_user_mentions("id_alice")

        assert len(mentions) == 2

    @pytest.mark.asyncio
    async def test_get_comments_at_position(self, manager):
        """Get comments at a position."""
        anchor1 = CommentAnchor(start=10, end=50)
        anchor2 = CommentAnchor(start=40, end=80)
        anchor3 = CommentAnchor(start=100, end=150)

        await manager.create_comment("doc1", "user1", "Comment 1", anchor=anchor1)
        await manager.create_comment("doc1", "user2", "Comment 2", anchor=anchor2)
        await manager.create_comment("doc1", "user3", "Comment 3", anchor=anchor3)

        comments = manager.get_comments_at_position("doc1", 45)

        assert len(comments) == 2

    @pytest.mark.asyncio
    async def test_get_unresolved_count(self, manager):
        """Get count of unresolved comments."""
        c1 = await manager.create_comment("doc1", "user1", "Issue 1")
        await manager.create_comment("doc1", "user2", "Issue 2")
        await manager.create_comment("doc1", "user3", "Reply", parent_id=c1.id)
        await manager.resolve_comment(c1.id, "user4")

        count = manager.get_unresolved_count("doc1")

        assert count == 1  # Only Issue 2

    @pytest.mark.asyncio
    async def test_get_reaction_summary(self, manager):
        """Get reaction summary."""
        comment = await manager.create_comment("doc1", "user1", "Nice!")
        await manager.add_reaction(comment.id, "user2", "thumbs_up")
        await manager.add_reaction(comment.id, "user3", "thumbs_up")
        await manager.add_reaction(comment.id, "user4", "heart")

        summary = manager.get_reaction_summary(comment.id)

        assert summary["thumbs_up"] == 2
        assert summary["heart"] == 1

    @pytest.mark.asyncio
    async def test_callbacks(self, manager):
        """Callbacks are invoked."""
        created_comments = []
        resolved_comments = []
        mentions = []

        async def on_created(comment):
            created_comments.append(comment)

        async def on_resolved(comment):
            resolved_comments.append(comment)

        async def on_mention(comment, mention):
            mentions.append((comment, mention))

        manager.on_comment_created = on_created
        manager.on_comment_resolved = on_resolved
        manager.on_mention = on_mention

        comment = await manager.create_comment(
            "doc1", "user1", "Hey @alice!"
        )
        await manager.resolve_comment(comment.id, "user2")

        assert len(created_comments) == 1
        assert len(resolved_comments) == 1
        assert len(mentions) == 1

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "total_comments" in stats
        assert "active_comments" in stats
        assert "mentions_sent" in stats


class TestGlobalCommentManager:
    """Tests for global comment manager functions."""

    def test_get_comment_manager(self):
        """Get global comment manager."""
        reset_comment_manager()

        manager = get_comment_manager()

        assert manager is not None
        assert isinstance(manager, CommentManager)

    def test_set_comment_manager(self):
        """Set global comment manager."""
        reset_comment_manager()

        custom = CommentManager()
        set_comment_manager(custom)

        assert get_comment_manager() is custom

    def test_reset_comment_manager(self):
        """Reset global comment manager."""
        get_comment_manager()

        reset_comment_manager()

        manager = get_comment_manager()
        assert manager is not None
