"""
OAuth Provider configurations for external services
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib.parse import urlencode

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class OAuthTokenResponse:
    """Response from OAuth token exchange"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "Bearer"
    scope: Optional[str] = None
    # Provider-specific fields
    extra: Optional[Dict] = None


@dataclass
class OAuthUserInfo:
    """User info from OAuth provider"""
    provider_account_id: str
    provider_account_name: Optional[str] = None
    provider_account_email: Optional[str] = None
    avatar_url: Optional[str] = None
    extra: Optional[Dict] = None


class OAuthProvider(ABC):
    """Base OAuth provider"""

    PROVIDER_NAME: str = ""
    AUTHORIZATION_URL: str = ""
    TOKEN_URL: str = ""
    USER_INFO_URL: str = ""
    DEFAULT_SCOPES: List[str] = []

    def __init__(self):
        settings = get_settings()
        self.client_id = self._get_client_id(settings)
        self.client_secret = self._get_client_secret(settings)
        self.redirect_base_url = settings.oauth_redirect_base_url

    @abstractmethod
    def _get_client_id(self, settings) -> Optional[str]:
        pass

    @abstractmethod
    def _get_client_secret(self, settings) -> Optional[str]:
        pass

    @property
    def redirect_uri(self) -> str:
        return f"{self.redirect_base_url}/api/connectors/oauth/{self.PROVIDER_NAME}/callback"

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_authorization_url(
        self,
        state: str,
        scopes: Optional[List[str]] = None,
    ) -> str:
        """Generate OAuth authorization URL"""
        if not self.is_configured:
            raise ValueError(f"{self.PROVIDER_NAME} OAuth is not configured")

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "response_type": "code",
        }

        # Add scopes
        scope_list = scopes or self.DEFAULT_SCOPES
        if scope_list:
            params["scope"] = self._format_scopes(scope_list)

        # Add provider-specific params
        params.update(self._get_extra_auth_params())

        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"

    def _format_scopes(self, scopes: List[str]) -> str:
        """Format scopes for URL (default: space-separated)"""
        return " ".join(scopes)

    def _get_extra_auth_params(self) -> Dict:
        """Override to add provider-specific auth params"""
        return {}

    async def exchange_code(self, code: str) -> OAuthTokenResponse:
        """Exchange authorization code for tokens"""
        if not self.is_configured:
            raise ValueError(f"{self.PROVIDER_NAME} OAuth is not configured")

        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }

        headers = self._get_token_headers()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data=data,
                headers=headers,
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.text}")
                raise ValueError(f"Token exchange failed: {response.text}")

            return self._parse_token_response(response)

    def _get_token_headers(self) -> Dict[str, str]:
        """Headers for token exchange request"""
        return {"Accept": "application/json"}

    @abstractmethod
    def _parse_token_response(self, response: httpx.Response) -> OAuthTokenResponse:
        """Parse token response from provider"""
        pass

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Fetch user info from provider"""
        if not self.USER_INFO_URL:
            raise NotImplementedError(f"User info not implemented for {self.PROVIDER_NAME}")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(self.USER_INFO_URL, headers=headers)

            if response.status_code != 200:
                logger.error(f"User info fetch failed: {response.text}")
                raise ValueError(f"Failed to fetch user info: {response.text}")

            return self._parse_user_info(response.json())

    @abstractmethod
    def _parse_user_info(self, data: Dict) -> OAuthUserInfo:
        """Parse user info response"""
        pass

    async def refresh_token(self, refresh_token: str) -> OAuthTokenResponse:
        """Refresh access token"""
        if not self.is_configured:
            raise ValueError(f"{self.PROVIDER_NAME} OAuth is not configured")

        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        headers = self._get_token_headers()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data=data,
                headers=headers,
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.text}")
                raise ValueError(f"Token refresh failed: {response.text}")

            return self._parse_token_response(response)


class GitHubOAuthProvider(OAuthProvider):
    """GitHub OAuth provider"""

    PROVIDER_NAME = "github"
    AUTHORIZATION_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USER_INFO_URL = "https://api.github.com/user"
    DEFAULT_SCOPES = ["repo", "read:user", "user:email"]

    def _get_client_id(self, settings) -> Optional[str]:
        return settings.github_client_id

    def _get_client_secret(self, settings) -> Optional[str]:
        return settings.github_client_secret

    def _parse_token_response(self, response: httpx.Response) -> OAuthTokenResponse:
        data = response.json()
        return OAuthTokenResponse(
            access_token=data["access_token"],
            token_type=data.get("token_type", "Bearer"),
            scope=data.get("scope"),
            # GitHub tokens don't expire by default
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expires_in"),
        )

    def _parse_user_info(self, data: Dict) -> OAuthUserInfo:
        return OAuthUserInfo(
            provider_account_id=str(data["id"]),
            provider_account_name=data.get("login"),
            provider_account_email=data.get("email"),
            avatar_url=data.get("avatar_url"),
            extra={"name": data.get("name"), "company": data.get("company")},
        )


class SlackOAuthProvider(OAuthProvider):
    """Slack OAuth provider"""

    PROVIDER_NAME = "slack"
    AUTHORIZATION_URL = "https://slack.com/oauth/v2/authorize"
    TOKEN_URL = "https://slack.com/api/oauth.v2.access"
    USER_INFO_URL = "https://slack.com/api/auth.test"
    DEFAULT_SCOPES = [
        "channels:read",
        "channels:write",
        "chat:write",
        "files:read",
        "files:write",
        "users:read",
        "search:read",
    ]

    def _get_client_id(self, settings) -> Optional[str]:
        return settings.slack_client_id

    def _get_client_secret(self, settings) -> Optional[str]:
        return settings.slack_client_secret

    def _format_scopes(self, scopes: List[str]) -> str:
        """Slack uses comma-separated scopes"""
        return ",".join(scopes)

    def _parse_token_response(self, response: httpx.Response) -> OAuthTokenResponse:
        data = response.json()

        if not data.get("ok"):
            raise ValueError(f"Slack OAuth error: {data.get('error')}")

        return OAuthTokenResponse(
            access_token=data["access_token"],
            token_type="Bearer",
            scope=data.get("scope"),
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expires_in"),
            extra={
                "team_id": data.get("team", {}).get("id"),
                "team_name": data.get("team", {}).get("name"),
                "bot_user_id": data.get("bot_user_id"),
            },
        )

    def _parse_user_info(self, data: Dict) -> OAuthUserInfo:
        if not data.get("ok"):
            raise ValueError(f"Slack user info error: {data.get('error')}")

        return OAuthUserInfo(
            provider_account_id=data.get("user_id", ""),
            provider_account_name=data.get("user"),
            provider_account_email=None,  # Need separate API call for email
            extra={
                "team_id": data.get("team_id"),
                "team": data.get("team"),
                "url": data.get("url"),
            },
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Slack needs POST for auth.test"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.USER_INFO_URL, headers=headers)

            if response.status_code != 200:
                logger.error(f"Slack user info failed: {response.text}")
                raise ValueError(f"Failed to fetch Slack user info: {response.text}")

            return self._parse_user_info(response.json())


class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth provider for Google Drive"""

    PROVIDER_NAME = "google_drive"
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    DEFAULT_SCOPES = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    def _get_client_id(self, settings) -> Optional[str]:
        return settings.google_client_id

    def _get_client_secret(self, settings) -> Optional[str]:
        return settings.google_client_secret

    def _get_extra_auth_params(self) -> Dict:
        return {
            "access_type": "offline",  # Get refresh token
            "prompt": "consent",  # Always show consent screen to get refresh token
        }

    def _parse_token_response(self, response: httpx.Response) -> OAuthTokenResponse:
        data = response.json()

        if "error" in data:
            raise ValueError(f"Google OAuth error: {data.get('error_description', data['error'])}")

        return OAuthTokenResponse(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expires_in"),
            token_type=data.get("token_type", "Bearer"),
            scope=data.get("scope"),
        )

    def _parse_user_info(self, data: Dict) -> OAuthUserInfo:
        return OAuthUserInfo(
            provider_account_id=data["id"],
            provider_account_name=data.get("name"),
            provider_account_email=data.get("email"),
            avatar_url=data.get("picture"),
            extra={"verified_email": data.get("verified_email")},
        )


# Registry of providers
PROVIDERS: Dict[str, type] = {
    "github": GitHubOAuthProvider,
    "slack": SlackOAuthProvider,
    "google_drive": GoogleOAuthProvider,
    "google-drive": GoogleOAuthProvider,  # Alias
}

SUPPORTED_PROVIDERS = list(set(["github", "slack", "google_drive"]))


def get_oauth_provider(provider: str) -> OAuthProvider:
    """Get OAuth provider instance by name"""
    provider_lower = provider.lower()

    if provider_lower not in PROVIDERS:
        raise ValueError(f"Unknown OAuth provider: {provider}. Supported: {SUPPORTED_PROVIDERS}")

    return PROVIDERS[provider_lower]()
