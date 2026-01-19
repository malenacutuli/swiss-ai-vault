"""
Base Connector - Abstract base class for all connectors
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from supabase import Client

logger = logging.getLogger(__name__)


class ConnectorError(Exception):
    """Base exception for connector errors"""
    pass


class TokenExpiredError(ConnectorError):
    """Token has expired and needs refresh"""
    pass


class RateLimitError(ConnectorError):
    """Rate limit exceeded"""
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after


@dataclass
class ConnectorCredentials:
    """OAuth credentials for a connector"""
    id: str
    user_id: str
    provider: str
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None
    provider_account_id: Optional[str] = None
    provider_account_name: Optional[str] = None
    provider_account_email: Optional[str] = None

    @classmethod
    def from_db_row(cls, row: Dict[str, Any], decrypt: bool = True) -> "ConnectorCredentials":
        """Create from database row with optional token decryption"""
        access_token = row.get("access_token_encrypted", "")
        refresh_token = row.get("refresh_token_encrypted")

        # Decrypt tokens if requested and encryption module is available
        if decrypt:
            try:
                from app.connectors.oauth.encryption import decrypt_token
                if access_token:
                    access_token = decrypt_token(access_token)
                if refresh_token:
                    refresh_token = decrypt_token(refresh_token)
            except ImportError:
                # Encryption module not available, use tokens as-is
                pass
            except Exception as e:
                # Decryption failed, log but continue
                import logging
                logging.getLogger(__name__).warning(f"Token decryption failed: {e}")

        return cls(
            id=row["id"],
            user_id=row["user_id"],
            provider=row["provider"],
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=row.get("expires_at"),
            scopes=row.get("scopes"),
            provider_account_id=row.get("provider_account_id"),
            provider_account_name=row.get("provider_account_name"),
            provider_account_email=row.get("provider_account_email"),
        )

    def is_expired(self) -> bool:
        """Check if token is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at


@dataclass
class ConnectorResult:
    """Result from a connector operation"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[datetime] = None


class BaseConnector(ABC):
    """
    Abstract base class for external service connectors.

    Provides common functionality:
    - HTTP client management
    - Token refresh handling
    - Rate limit tracking
    - Error handling
    """

    PROVIDER: str = ""
    BASE_URL: str = ""

    def __init__(self, supabase: Client, credentials: ConnectorCredentials):
        self.supabase = supabase
        self.credentials = credentials
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers=self._get_auth_headers(),
                timeout=30.0,
            )
        return self._client

    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {self.credentials.access_token}",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> ConnectorResult:
        """Make authenticated request with error handling"""
        try:
            # Check token expiration
            if self.credentials.is_expired():
                await self._refresh_token()

            client = await self._get_client()
            response = await client.request(method, endpoint, **kwargs)

            # Track rate limits
            rate_limit_remaining = response.headers.get("X-RateLimit-Remaining")
            rate_limit_reset = response.headers.get("X-RateLimit-Reset")

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "60")
                raise RateLimitError(
                    f"Rate limit exceeded for {self.PROVIDER}",
                    retry_after=int(retry_after)
                )

            # Handle auth errors
            if response.status_code == 401:
                # Try token refresh
                await self._refresh_token()
                # Retry request
                client = await self._get_client()
                response = await client.request(method, endpoint, **kwargs)

            response.raise_for_status()

            return ConnectorResult(
                success=True,
                data=response.json() if response.content else None,
                rate_limit_remaining=int(rate_limit_remaining) if rate_limit_remaining else None,
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"{self.PROVIDER} HTTP error: {e}")
            return ConnectorResult(
                success=False,
                error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            )
        except Exception as e:
            logger.error(f"{self.PROVIDER} error: {e}")
            return ConnectorResult(
                success=False,
                error=str(e),
            )

    async def _refresh_token(self):
        """Refresh OAuth token - to be implemented by subclasses if needed"""
        raise TokenExpiredError(f"{self.PROVIDER} token expired and refresh not implemented")

    async def _update_credentials(self, new_access_token: str, new_refresh_token: Optional[str] = None, expires_at: Optional[datetime] = None):
        """Update credentials in database"""
        update_data = {
            "access_token_encrypted": new_access_token,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if new_refresh_token:
            update_data["refresh_token_encrypted"] = new_refresh_token
        if expires_at:
            update_data["expires_at"] = expires_at.isoformat()

        self.supabase.table("connector_credentials").update(update_data).eq("id", self.credentials.id).execute()

        # Update local credentials
        self.credentials.access_token = new_access_token
        if new_refresh_token:
            self.credentials.refresh_token = new_refresh_token
        if expires_at:
            self.credentials.expires_at = expires_at

        # Recreate client with new token
        self._client = None

    async def _update_last_used(self):
        """Update last_used_at timestamp"""
        self.supabase.table("connector_credentials").update({
            "last_used_at": datetime.utcnow().isoformat(),
        }).eq("id", self.credentials.id).execute()

    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    @abstractmethod
    async def test_connection(self) -> ConnectorResult:
        """Test the connection is valid"""
        pass
