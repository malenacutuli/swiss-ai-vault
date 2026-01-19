"""
OAuth Module - OAuth2 flow implementation for external service connectors
"""

from app.connectors.oauth.providers import (
    OAuthProvider,
    GitHubOAuthProvider,
    SlackOAuthProvider,
    GoogleOAuthProvider,
    get_oauth_provider,
    SUPPORTED_PROVIDERS,
)
from app.connectors.oauth.encryption import TokenEncryption
from app.connectors.oauth.state import OAuthStateManager

__all__ = [
    "OAuthProvider",
    "GitHubOAuthProvider",
    "SlackOAuthProvider",
    "GoogleOAuthProvider",
    "get_oauth_provider",
    "SUPPORTED_PROVIDERS",
    "TokenEncryption",
    "OAuthStateManager",
]
