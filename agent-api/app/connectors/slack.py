"""
Slack Connector - Full Slack API integration

Operations:
- Messages: send, update, delete, search
- Channels: list, create, join, archive
- Users: list, get info
- Files: upload, share
- Reactions: add, remove
"""

import logging
from typing import Any, Dict, List, Optional

from app.connectors.base import BaseConnector, ConnectorResult, ConnectorCredentials

logger = logging.getLogger(__name__)


class SlackConnector(BaseConnector):
    """Slack API connector"""

    PROVIDER = "slack"
    BASE_URL = "https://slack.com/api"

    def _get_auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.credentials.access_token}",
            "Content-Type": "application/json; charset=utf-8",
        }

    async def test_connection(self) -> ConnectorResult:
        """Test Slack connection by checking auth"""
        result = await self._request("POST", "/auth.test")
        if result.success:
            await self._update_last_used()
        return result

    def _check_slack_response(self, result: ConnectorResult) -> ConnectorResult:
        """Check Slack API response for ok field"""
        if result.success and result.data:
            if not result.data.get("ok", False):
                return ConnectorResult(
                    success=False,
                    error=result.data.get("error", "Unknown Slack error"),
                    data=result.data,
                )
        return result

    async def _slack_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> ConnectorResult:
        """Make Slack request with ok field checking"""
        result = await self._request(method, endpoint, **kwargs)
        return self._check_slack_response(result)

    # =========================================================================
    # AUTH/USER OPERATIONS
    # =========================================================================

    async def auth_test(self) -> ConnectorResult:
        """Test authentication and get user info"""
        return await self._slack_request("POST", "/auth.test")

    async def get_user_info(self, user_id: str) -> ConnectorResult:
        """Get info about a user"""
        return await self._slack_request(
            "GET",
            "/users.info",
            params={"user": user_id},
        )

    async def list_users(
        self,
        cursor: Optional[str] = None,
        limit: int = 100,
    ) -> ConnectorResult:
        """List all users in workspace"""
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor

        return await self._slack_request("GET", "/users.list", params=params)

    async def get_user_presence(self, user_id: str) -> ConnectorResult:
        """Get user presence status"""
        return await self._slack_request(
            "GET",
            "/users.getPresence",
            params={"user": user_id},
        )

    # =========================================================================
    # CHANNEL OPERATIONS
    # =========================================================================

    async def list_channels(
        self,
        types: str = "public_channel,private_channel",
        exclude_archived: bool = True,
        cursor: Optional[str] = None,
        limit: int = 100,
    ) -> ConnectorResult:
        """List channels"""
        params = {
            "types": types,
            "exclude_archived": exclude_archived,
            "limit": limit,
        }
        if cursor:
            params["cursor"] = cursor

        return await self._slack_request("GET", "/conversations.list", params=params)

    async def get_channel_info(self, channel_id: str) -> ConnectorResult:
        """Get channel info"""
        return await self._slack_request(
            "GET",
            "/conversations.info",
            params={"channel": channel_id},
        )

    async def create_channel(
        self,
        name: str,
        is_private: bool = False,
    ) -> ConnectorResult:
        """Create a new channel"""
        return await self._slack_request(
            "POST",
            "/conversations.create",
            json={
                "name": name,
                "is_private": is_private,
            },
        )

    async def join_channel(self, channel_id: str) -> ConnectorResult:
        """Join a channel"""
        return await self._slack_request(
            "POST",
            "/conversations.join",
            json={"channel": channel_id},
        )

    async def leave_channel(self, channel_id: str) -> ConnectorResult:
        """Leave a channel"""
        return await self._slack_request(
            "POST",
            "/conversations.leave",
            json={"channel": channel_id},
        )

    async def archive_channel(self, channel_id: str) -> ConnectorResult:
        """Archive a channel"""
        return await self._slack_request(
            "POST",
            "/conversations.archive",
            json={"channel": channel_id},
        )

    async def invite_to_channel(
        self,
        channel_id: str,
        user_ids: List[str],
    ) -> ConnectorResult:
        """Invite users to a channel"""
        return await self._slack_request(
            "POST",
            "/conversations.invite",
            json={
                "channel": channel_id,
                "users": ",".join(user_ids),
            },
        )

    async def set_channel_topic(
        self,
        channel_id: str,
        topic: str,
    ) -> ConnectorResult:
        """Set channel topic"""
        return await self._slack_request(
            "POST",
            "/conversations.setTopic",
            json={
                "channel": channel_id,
                "topic": topic,
            },
        )

    # =========================================================================
    # MESSAGE OPERATIONS
    # =========================================================================

    async def send_message(
        self,
        channel: str,
        text: str,
        blocks: Optional[List[Dict]] = None,
        thread_ts: Optional[str] = None,
        unfurl_links: bool = True,
        unfurl_media: bool = True,
    ) -> ConnectorResult:
        """Send a message to a channel"""
        data = {
            "channel": channel,
            "text": text,
            "unfurl_links": unfurl_links,
            "unfurl_media": unfurl_media,
        }
        if blocks:
            data["blocks"] = blocks
        if thread_ts:
            data["thread_ts"] = thread_ts

        return await self._slack_request("POST", "/chat.postMessage", json=data)

    async def update_message(
        self,
        channel: str,
        ts: str,
        text: str,
        blocks: Optional[List[Dict]] = None,
    ) -> ConnectorResult:
        """Update a message"""
        data = {
            "channel": channel,
            "ts": ts,
            "text": text,
        }
        if blocks:
            data["blocks"] = blocks

        return await self._slack_request("POST", "/chat.update", json=data)

    async def delete_message(
        self,
        channel: str,
        ts: str,
    ) -> ConnectorResult:
        """Delete a message"""
        return await self._slack_request(
            "POST",
            "/chat.delete",
            json={
                "channel": channel,
                "ts": ts,
            },
        )

    async def get_message_permalink(
        self,
        channel: str,
        message_ts: str,
    ) -> ConnectorResult:
        """Get permalink to a message"""
        return await self._slack_request(
            "GET",
            "/chat.getPermalink",
            params={
                "channel": channel,
                "message_ts": message_ts,
            },
        )

    async def get_channel_history(
        self,
        channel: str,
        cursor: Optional[str] = None,
        limit: int = 100,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
    ) -> ConnectorResult:
        """Get message history for a channel"""
        params = {
            "channel": channel,
            "limit": limit,
        }
        if cursor:
            params["cursor"] = cursor
        if oldest:
            params["oldest"] = oldest
        if latest:
            params["latest"] = latest

        return await self._slack_request("GET", "/conversations.history", params=params)

    async def get_thread_replies(
        self,
        channel: str,
        ts: str,
        cursor: Optional[str] = None,
        limit: int = 100,
    ) -> ConnectorResult:
        """Get replies to a thread"""
        params = {
            "channel": channel,
            "ts": ts,
            "limit": limit,
        }
        if cursor:
            params["cursor"] = cursor

        return await self._slack_request("GET", "/conversations.replies", params=params)

    async def search_messages(
        self,
        query: str,
        sort: str = "timestamp",
        sort_dir: str = "desc",
        count: int = 20,
        page: int = 1,
    ) -> ConnectorResult:
        """Search messages"""
        return await self._slack_request(
            "GET",
            "/search.messages",
            params={
                "query": query,
                "sort": sort,
                "sort_dir": sort_dir,
                "count": count,
                "page": page,
            },
        )

    # =========================================================================
    # REACTION OPERATIONS
    # =========================================================================

    async def add_reaction(
        self,
        channel: str,
        timestamp: str,
        name: str,
    ) -> ConnectorResult:
        """Add a reaction to a message"""
        return await self._slack_request(
            "POST",
            "/reactions.add",
            json={
                "channel": channel,
                "timestamp": timestamp,
                "name": name,
            },
        )

    async def remove_reaction(
        self,
        channel: str,
        timestamp: str,
        name: str,
    ) -> ConnectorResult:
        """Remove a reaction from a message"""
        return await self._slack_request(
            "POST",
            "/reactions.remove",
            json={
                "channel": channel,
                "timestamp": timestamp,
                "name": name,
            },
        )

    async def get_reactions(
        self,
        channel: str,
        timestamp: str,
    ) -> ConnectorResult:
        """Get reactions for a message"""
        return await self._slack_request(
            "GET",
            "/reactions.get",
            params={
                "channel": channel,
                "timestamp": timestamp,
            },
        )

    # =========================================================================
    # FILE OPERATIONS
    # =========================================================================

    async def upload_file(
        self,
        channels: List[str],
        content: Optional[str] = None,
        filename: Optional[str] = None,
        filetype: Optional[str] = None,
        initial_comment: Optional[str] = None,
        title: Optional[str] = None,
        thread_ts: Optional[str] = None,
    ) -> ConnectorResult:
        """Upload a file to Slack"""
        data = {
            "channels": ",".join(channels),
        }
        if content:
            data["content"] = content
        if filename:
            data["filename"] = filename
        if filetype:
            data["filetype"] = filetype
        if initial_comment:
            data["initial_comment"] = initial_comment
        if title:
            data["title"] = title
        if thread_ts:
            data["thread_ts"] = thread_ts

        return await self._slack_request("POST", "/files.upload", json=data)

    async def list_files(
        self,
        channel: Optional[str] = None,
        user: Optional[str] = None,
        types: Optional[str] = None,
        count: int = 100,
        page: int = 1,
    ) -> ConnectorResult:
        """List files"""
        params = {"count": count, "page": page}
        if channel:
            params["channel"] = channel
        if user:
            params["user"] = user
        if types:
            params["types"] = types

        return await self._slack_request("GET", "/files.list", params=params)

    async def delete_file(self, file_id: str) -> ConnectorResult:
        """Delete a file"""
        return await self._slack_request(
            "POST",
            "/files.delete",
            json={"file": file_id},
        )

    async def get_file_info(self, file_id: str) -> ConnectorResult:
        """Get file info"""
        return await self._slack_request(
            "GET",
            "/files.info",
            params={"file": file_id},
        )

    # =========================================================================
    # REMINDER OPERATIONS
    # =========================================================================

    async def add_reminder(
        self,
        text: str,
        time: str,
        user: Optional[str] = None,
    ) -> ConnectorResult:
        """Add a reminder"""
        data = {
            "text": text,
            "time": time,
        }
        if user:
            data["user"] = user

        return await self._slack_request("POST", "/reminders.add", json=data)

    async def list_reminders(self) -> ConnectorResult:
        """List reminders"""
        return await self._slack_request("GET", "/reminders.list")

    async def delete_reminder(self, reminder_id: str) -> ConnectorResult:
        """Delete a reminder"""
        return await self._slack_request(
            "POST",
            "/reminders.delete",
            json={"reminder": reminder_id},
        )
