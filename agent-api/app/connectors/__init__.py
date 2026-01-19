"""
Connectors Module - External service integrations

Supports:
- GitHub: Repos, issues, PRs, code search
- Slack: Messages, channels, users
- Google Drive: Files, folders, sharing
- Linear: Issues, projects
- Notion: Pages, databases
"""

from app.connectors.base import (
    BaseConnector,
    ConnectorCredentials,
    ConnectorResult,
    ConnectorError,
    TokenExpiredError,
    RateLimitError,
)
from app.connectors.github import GitHubConnector
from app.connectors.slack import SlackConnector
from app.connectors.google_drive import GoogleDriveConnector
from app.connectors.manager import ConnectorManager, create_connector

__all__ = [
    "BaseConnector",
    "ConnectorCredentials",
    "ConnectorResult",
    "ConnectorError",
    "TokenExpiredError",
    "RateLimitError",
    "GitHubConnector",
    "SlackConnector",
    "GoogleDriveConnector",
    "ConnectorManager",
    "create_connector",
]
