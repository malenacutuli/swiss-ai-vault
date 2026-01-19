"""
Comments System for Collaboration

Provides:
- Threaded comments on documents
- Comment replies and nesting
- User mentions with notifications
- Comment resolution/archiving
- Emoji reactions
- Comment permissions

Integrates with presence for real-time comment updates.
"""

from __future__ import annotations

import asyncio
import re
import secrets
from typing import Optional, Any, Callable, Awaitable, List, Dict, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

import logging

logger = logging.getLogger(__name__)


class CommentState(Enum):
    """Comment states."""
    ACTIVE = "active"
    RESOLVED = "resolved"
    ARCHIVED = "archived"
    DELETED = "deleted"


class CommentType(Enum):
    """Types of comments."""
    COMMENT = "comment"
    SUGGESTION = "suggestion"
    QUESTION = "question"
    TASK = "task"


@dataclass
class CommentConfig:
    """Comment system configuration."""
    max_comment_length: int = 10000
    max_replies_per_thread: int = 100
    max_mentions_per_comment: int = 20
    max_reactions_per_comment: int = 50
    allow_edit_window: timedelta = timedelta(minutes=15)
    enable_mentions: bool = True
    enable_reactions: bool = True
    enable_suggestions: bool = True


@dataclass
class CommentAnchor:
    """Anchor point for a comment in a document."""
    start: int
    end: int
    text: Optional[str] = None  # Original text at anchor

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "start": self.start,
            "end": self.end,
            "text": self.text,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CommentAnchor":
        """Create from dictionary."""
        return cls(
            start=data["start"],
            end=data["end"],
            text=data.get("text"),
        )


@dataclass
class Mention:
    """A user mention in a comment."""
    user_id: str
    username: str
    start: int  # Position in comment text
    end: int

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "start": self.start,
            "end": self.end,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Mention":
        """Create from dictionary."""
        return cls(
            user_id=data["user_id"],
            username=data["username"],
            start=data["start"],
            end=data["end"],
        )


@dataclass
class Reaction:
    """A reaction to a comment."""
    emoji: str
    user_id: str
    created_at: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "emoji": self.emoji,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Reaction":
        """Create from dictionary."""
        return cls(
            emoji=data["emoji"],
            user_id=data["user_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
        )


@dataclass
class Comment:
    """A comment on a document."""
    id: str
    document_id: str
    author_id: str
    content: str
    state: CommentState
    comment_type: CommentType
    created_at: datetime
    updated_at: datetime
    anchor: Optional[CommentAnchor] = None
    parent_id: Optional[str] = None  # For replies
    thread_id: Optional[str] = None  # Root comment ID
    mentions: List[Mention] = field(default_factory=list)
    reactions: List[Reaction] = field(default_factory=list)
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    metadata: dict = field(default_factory=dict)

    def is_reply(self) -> bool:
        """Check if this is a reply."""
        return self.parent_id is not None

    def is_resolved(self) -> bool:
        """Check if comment is resolved."""
        return self.state == CommentState.RESOLVED

    def can_edit(self, user_id: str, edit_window: timedelta) -> bool:
        """Check if user can edit this comment."""
        if self.author_id != user_id:
            return False
        if self.state != CommentState.ACTIVE:
            return False
        return datetime.utcnow() - self.created_at <= edit_window

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "author_id": self.author_id,
            "content": self.content,
            "state": self.state.value,
            "comment_type": self.comment_type.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "anchor": self.anchor.to_dict() if self.anchor else None,
            "parent_id": self.parent_id,
            "thread_id": self.thread_id,
            "mentions": [m.to_dict() for m in self.mentions],
            "reactions": [r.to_dict() for r in self.reactions],
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Comment":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            author_id=data["author_id"],
            content=data["content"],
            state=CommentState(data["state"]),
            comment_type=CommentType(data["comment_type"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            anchor=CommentAnchor.from_dict(data["anchor"]) if data.get("anchor") else None,
            parent_id=data.get("parent_id"),
            thread_id=data.get("thread_id"),
            mentions=[Mention.from_dict(m) for m in data.get("mentions", [])],
            reactions=[Reaction.from_dict(r) for r in data.get("reactions", [])],
            resolved_by=data.get("resolved_by"),
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None,
            metadata=data.get("metadata", {}),
        )


@dataclass
class CommentThread:
    """A thread of comments."""
    id: str
    document_id: str
    root_comment: Comment
    replies: List[Comment]
    reply_count: int
    participant_ids: Set[str]
    last_activity: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "root_comment": self.root_comment.to_dict(),
            "replies": [r.to_dict() for r in self.replies],
            "reply_count": self.reply_count,
            "participant_ids": list(self.participant_ids),
            "last_activity": self.last_activity.isoformat(),
        }


class MentionParser:
    """Parses mentions from comment text."""

    MENTION_PATTERN = re.compile(r"@(\w+)")

    def __init__(self, user_resolver: Optional[Callable[[str], Optional[str]]] = None):
        """
        Initialize parser.

        Args:
            user_resolver: Function to resolve username to user_id
        """
        self.user_resolver = user_resolver

    def parse(self, text: str) -> List[Mention]:
        """Parse mentions from text."""
        mentions = []

        for match in self.MENTION_PATTERN.finditer(text):
            username = match.group(1)
            user_id = None

            if self.user_resolver:
                user_id = self.user_resolver(username)

            if user_id is None:
                user_id = username  # Fallback to username as ID

            mentions.append(Mention(
                user_id=user_id,
                username=username,
                start=match.start(),
                end=match.end(),
            ))

        return mentions


class CommentManager:
    """Manages comments on documents."""

    def __init__(self, config: Optional[CommentConfig] = None):
        self.config = config or CommentConfig()
        self._comments: Dict[str, Comment] = {}  # comment_id -> Comment
        self._document_comments: Dict[str, Set[str]] = defaultdict(set)  # doc_id -> comment_ids
        self._threads: Dict[str, Set[str]] = defaultdict(set)  # thread_id -> reply_ids
        self._user_mentions: Dict[str, Set[str]] = defaultdict(set)  # user_id -> comment_ids mentioning them
        self._mention_parser = MentionParser()
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_comment_created: Optional[
            Callable[[Comment], Awaitable[None]]
        ] = None
        self.on_comment_updated: Optional[
            Callable[[Comment], Awaitable[None]]
        ] = None
        self.on_comment_resolved: Optional[
            Callable[[Comment], Awaitable[None]]
        ] = None
        self.on_mention: Optional[
            Callable[[Comment, Mention], Awaitable[None]]
        ] = None
        self.on_reaction: Optional[
            Callable[[Comment, Reaction], Awaitable[None]]
        ] = None

        # Stats
        self._comments_created = 0
        self._comments_resolved = 0
        self._mentions_sent = 0
        self._reactions_added = 0

    def set_user_resolver(self, resolver: Callable[[str], Optional[str]]) -> None:
        """Set the user resolver for mentions."""
        self._mention_parser = MentionParser(resolver)

    async def create_comment(
        self,
        document_id: str,
        author_id: str,
        content: str,
        comment_type: CommentType = CommentType.COMMENT,
        anchor: Optional[CommentAnchor] = None,
        parent_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> Comment:
        """Create a new comment."""
        # Validate content length
        if len(content) > self.config.max_comment_length:
            raise ValueError(f"Comment exceeds max length of {self.config.max_comment_length}")

        # Validate parent exists for replies
        thread_id = None
        if parent_id:
            parent = self._comments.get(parent_id)
            if not parent:
                raise ValueError("Parent comment not found")

            # Get thread root
            thread_id = parent.thread_id or parent.id

            # Check reply limit
            if len(self._threads.get(thread_id, set())) >= self.config.max_replies_per_thread:
                raise ValueError("Thread has reached max replies")

        now = datetime.utcnow()
        comment_id = f"comment_{secrets.token_hex(12)}"

        # Parse mentions
        mentions = []
        if self.config.enable_mentions:
            mentions = self._mention_parser.parse(content)
            if len(mentions) > self.config.max_mentions_per_comment:
                mentions = mentions[:self.config.max_mentions_per_comment]

        comment = Comment(
            id=comment_id,
            document_id=document_id,
            author_id=author_id,
            content=content,
            state=CommentState.ACTIVE,
            comment_type=comment_type,
            created_at=now,
            updated_at=now,
            anchor=anchor,
            parent_id=parent_id,
            thread_id=thread_id,
            mentions=mentions,
            metadata=metadata or {},
        )

        async with self._lock:
            self._comments[comment_id] = comment
            self._document_comments[document_id].add(comment_id)

            if thread_id:
                self._threads[thread_id].add(comment_id)

            # Track mentions
            for mention in mentions:
                self._user_mentions[mention.user_id].add(comment_id)

            self._comments_created += 1

        # Notify callbacks
        if self.on_comment_created:
            try:
                await self.on_comment_created(comment)
            except Exception as e:
                logger.error(f"Comment created callback error: {e}")

        # Notify mentions
        if self.on_mention:
            for mention in mentions:
                self._mentions_sent += 1
                try:
                    await self.on_mention(comment, mention)
                except Exception as e:
                    logger.error(f"Mention callback error: {e}")

        return comment

    async def update_comment(
        self,
        comment_id: str,
        user_id: str,
        content: str
    ) -> Optional[Comment]:
        """Update a comment's content."""
        comment = self._comments.get(comment_id)
        if not comment:
            return None

        if not comment.can_edit(user_id, self.config.allow_edit_window):
            return None

        if len(content) > self.config.max_comment_length:
            raise ValueError(f"Comment exceeds max length of {self.config.max_comment_length}")

        # Re-parse mentions
        old_mentions = {m.user_id for m in comment.mentions}
        new_mentions = []
        if self.config.enable_mentions:
            new_mentions = self._mention_parser.parse(content)

        async with self._lock:
            # Update mention tracking
            for mention in comment.mentions:
                self._user_mentions[mention.user_id].discard(comment_id)

            comment.content = content
            comment.mentions = new_mentions
            comment.updated_at = datetime.utcnow()

            for mention in new_mentions:
                self._user_mentions[mention.user_id].add(comment_id)

        if self.on_comment_updated:
            try:
                await self.on_comment_updated(comment)
            except Exception as e:
                logger.error(f"Comment updated callback error: {e}")

        # Notify new mentions
        if self.on_mention:
            for mention in new_mentions:
                if mention.user_id not in old_mentions:
                    self._mentions_sent += 1
                    try:
                        await self.on_mention(comment, mention)
                    except Exception as e:
                        logger.error(f"Mention callback error: {e}")

        return comment

    async def delete_comment(self, comment_id: str, user_id: str) -> bool:
        """Delete a comment (soft delete)."""
        comment = self._comments.get(comment_id)
        if not comment:
            return False

        # Only author can delete
        if comment.author_id != user_id:
            return False

        async with self._lock:
            comment.state = CommentState.DELETED
            comment.content = "[deleted]"
            comment.updated_at = datetime.utcnow()

        return True

    async def resolve_comment(
        self,
        comment_id: str,
        resolver_id: str
    ) -> Optional[Comment]:
        """Resolve a comment thread."""
        comment = self._comments.get(comment_id)
        if not comment:
            return None

        if comment.is_reply():
            # Get root comment to resolve
            root_id = comment.thread_id
            comment = self._comments.get(root_id)
            if not comment:
                return None

        async with self._lock:
            comment.state = CommentState.RESOLVED
            comment.resolved_by = resolver_id
            comment.resolved_at = datetime.utcnow()
            comment.updated_at = datetime.utcnow()
            self._comments_resolved += 1

        if self.on_comment_resolved:
            try:
                await self.on_comment_resolved(comment)
            except Exception as e:
                logger.error(f"Comment resolved callback error: {e}")

        return comment

    async def unresolve_comment(self, comment_id: str) -> Optional[Comment]:
        """Unresolve a previously resolved comment."""
        comment = self._comments.get(comment_id)
        if not comment:
            return None

        if comment.state != CommentState.RESOLVED:
            return None

        async with self._lock:
            comment.state = CommentState.ACTIVE
            comment.resolved_by = None
            comment.resolved_at = None
            comment.updated_at = datetime.utcnow()

        return comment

    async def add_reaction(
        self,
        comment_id: str,
        user_id: str,
        emoji: str
    ) -> Optional[Reaction]:
        """Add a reaction to a comment."""
        if not self.config.enable_reactions:
            return None

        comment = self._comments.get(comment_id)
        if not comment:
            return None

        # Check if user already reacted with this emoji
        for reaction in comment.reactions:
            if reaction.user_id == user_id and reaction.emoji == emoji:
                return None  # Already reacted

        if len(comment.reactions) >= self.config.max_reactions_per_comment:
            return None

        reaction = Reaction(
            emoji=emoji,
            user_id=user_id,
            created_at=datetime.utcnow(),
        )

        async with self._lock:
            comment.reactions.append(reaction)
            self._reactions_added += 1

        if self.on_reaction:
            try:
                await self.on_reaction(comment, reaction)
            except Exception as e:
                logger.error(f"Reaction callback error: {e}")

        return reaction

    async def remove_reaction(
        self,
        comment_id: str,
        user_id: str,
        emoji: str
    ) -> bool:
        """Remove a reaction from a comment."""
        comment = self._comments.get(comment_id)
        if not comment:
            return False

        async with self._lock:
            for i, reaction in enumerate(comment.reactions):
                if reaction.user_id == user_id and reaction.emoji == emoji:
                    comment.reactions.pop(i)
                    return True

        return False

    def get_comment(self, comment_id: str) -> Optional[Comment]:
        """Get a comment by ID."""
        return self._comments.get(comment_id)

    def get_document_comments(
        self,
        document_id: str,
        state: Optional[CommentState] = None,
        include_deleted: bool = False
    ) -> List[Comment]:
        """Get all comments for a document."""
        comment_ids = self._document_comments.get(document_id, set())
        comments = []

        for cid in comment_ids:
            comment = self._comments.get(cid)
            if not comment:
                continue

            if not include_deleted and comment.state == CommentState.DELETED:
                continue

            if state and comment.state != state:
                continue

            comments.append(comment)

        # Sort by created_at
        comments.sort(key=lambda c: c.created_at)
        return comments

    def get_thread(self, thread_id: str) -> Optional[CommentThread]:
        """Get a comment thread with all replies."""
        root = self._comments.get(thread_id)
        if not root:
            return None

        reply_ids = self._threads.get(thread_id, set())
        replies = []
        participants = {root.author_id}
        last_activity = root.created_at

        for rid in reply_ids:
            reply = self._comments.get(rid)
            if reply and reply.state != CommentState.DELETED:
                replies.append(reply)
                participants.add(reply.author_id)
                if reply.created_at > last_activity:
                    last_activity = reply.created_at

        # Sort replies by creation time
        replies.sort(key=lambda r: r.created_at)

        return CommentThread(
            id=thread_id,
            document_id=root.document_id,
            root_comment=root,
            replies=replies,
            reply_count=len(replies),
            participant_ids=participants,
            last_activity=last_activity,
        )

    def get_user_mentions(self, user_id: str) -> List[Comment]:
        """Get comments mentioning a user."""
        comment_ids = self._user_mentions.get(user_id, set())
        comments = []

        for cid in comment_ids:
            comment = self._comments.get(cid)
            if comment and comment.state == CommentState.ACTIVE:
                comments.append(comment)

        comments.sort(key=lambda c: c.created_at, reverse=True)
        return comments

    def get_comments_at_position(
        self,
        document_id: str,
        position: int
    ) -> List[Comment]:
        """Get comments anchored at a position."""
        comments = self.get_document_comments(document_id)
        result = []

        for comment in comments:
            if comment.anchor:
                if comment.anchor.start <= position < comment.anchor.end:
                    result.append(comment)

        return result

    def get_unresolved_count(self, document_id: str) -> int:
        """Get count of unresolved root comments."""
        comments = self.get_document_comments(document_id)
        count = 0

        for comment in comments:
            if not comment.is_reply() and comment.state == CommentState.ACTIVE:
                count += 1

        return count

    def get_reaction_summary(self, comment_id: str) -> Dict[str, int]:
        """Get reaction counts by emoji."""
        comment = self._comments.get(comment_id)
        if not comment:
            return {}

        summary = defaultdict(int)
        for reaction in comment.reactions:
            summary[reaction.emoji] += 1

        return dict(summary)

    def get_stats(self) -> dict:
        """Get comment manager statistics."""
        active = sum(
            1 for c in self._comments.values()
            if c.state == CommentState.ACTIVE
        )
        resolved = sum(
            1 for c in self._comments.values()
            if c.state == CommentState.RESOLVED
        )

        return {
            "total_comments": len(self._comments),
            "active_comments": active,
            "resolved_comments": resolved,
            "comments_created": self._comments_created,
            "comments_resolved": self._comments_resolved,
            "mentions_sent": self._mentions_sent,
            "reactions_added": self._reactions_added,
            "documents_with_comments": len(self._document_comments),
            "threads": len(self._threads),
        }


# Global comment manager
_comment_manager: Optional[CommentManager] = None


def get_comment_manager() -> CommentManager:
    """Get global comment manager."""
    global _comment_manager
    if _comment_manager is None:
        _comment_manager = CommentManager()
    return _comment_manager


def set_comment_manager(manager: CommentManager) -> None:
    """Set global comment manager."""
    global _comment_manager
    _comment_manager = manager


def reset_comment_manager() -> None:
    """Reset global comment manager."""
    global _comment_manager
    _comment_manager = None
