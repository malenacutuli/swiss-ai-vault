"""
Connector Manager - Factory and management for external service connectors

Provides:
- Factory method to create connectors by provider type
- Credential management with encryption/decryption
- Connection pooling and lifecycle management
"""

import logging
from typing import Dict, Optional, Type

from supabase import Client

from app.connectors.base import (
    BaseConnector,
    ConnectorCredentials,
    ConnectorError,
)
from app.connectors.github import GitHubConnector
from app.connectors.slack import SlackConnector
from app.connectors.google_drive import GoogleDriveConnector

logger = logging.getLogger(__name__)


# Registry of supported connectors
CONNECTOR_REGISTRY: Dict[str, Type[BaseConnector]] = {
    "github": GitHubConnector,
    "slack": SlackConnector,
    "google_drive": GoogleDriveConnector,
    "google-drive": GoogleDriveConnector,  # Alias
}


class ConnectorManager:
    """
    Manages connector instances and credentials.

    Usage:
        manager = ConnectorManager(supabase_client)

        # Get connector for a user's credentials
        github = await manager.get_connector("github", user_id)

        # Or create with existing credentials
        github = manager.create_connector("github", credentials)
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._connector_cache: Dict[str, BaseConnector] = {}

    @staticmethod
    def get_supported_providers() -> list[str]:
        """Get list of supported provider types"""
        return list(set(CONNECTOR_REGISTRY.keys()))

    @staticmethod
    def is_supported(provider: str) -> bool:
        """Check if a provider is supported"""
        return provider.lower() in CONNECTOR_REGISTRY

    def create_connector(
        self,
        provider: str,
        credentials: ConnectorCredentials,
    ) -> BaseConnector:
        """
        Create a connector instance for the given provider and credentials.

        Args:
            provider: Provider type (github, slack, google_drive)
            credentials: OAuth credentials

        Returns:
            Configured connector instance

        Raises:
            ConnectorError: If provider is not supported
        """
        provider_lower = provider.lower()

        if provider_lower not in CONNECTOR_REGISTRY:
            raise ConnectorError(f"Unsupported provider: {provider}")

        connector_class = CONNECTOR_REGISTRY[provider_lower]
        return connector_class(self.supabase, credentials)

    async def get_credentials(
        self,
        provider: str,
        user_id: str,
    ) -> Optional[ConnectorCredentials]:
        """
        Get credentials for a user and provider from database.

        Args:
            provider: Provider type
            user_id: User ID

        Returns:
            ConnectorCredentials if found, None otherwise
        """
        try:
            result = self.supabase.table("connector_credentials").select("*").eq(
                "user_id", user_id
            ).eq("provider", provider).eq("is_active", True).single().execute()

            if result.data:
                return ConnectorCredentials.from_db_row(result.data)
            return None

        except Exception as e:
            logger.error(f"Failed to get credentials for {provider}/{user_id}: {e}")
            return None

    async def get_connector(
        self,
        provider: str,
        user_id: str,
        use_cache: bool = True,
    ) -> Optional[BaseConnector]:
        """
        Get a connector instance for a user.

        Fetches credentials from database and creates connector.

        Args:
            provider: Provider type
            user_id: User ID
            use_cache: Whether to cache/reuse connector instances

        Returns:
            Configured connector or None if no credentials found
        """
        cache_key = f"{provider}:{user_id}"

        if use_cache and cache_key in self._connector_cache:
            return self._connector_cache[cache_key]

        credentials = await self.get_credentials(provider, user_id)
        if not credentials:
            return None

        connector = self.create_connector(provider, credentials)

        if use_cache:
            self._connector_cache[cache_key] = connector

        return connector

    async def list_user_connections(
        self,
        user_id: str,
    ) -> list[Dict]:
        """
        List all active connections for a user.

        Args:
            user_id: User ID

        Returns:
            List of connection info dictionaries
        """
        try:
            result = self.supabase.table("connector_credentials").select(
                "id, provider, provider_account_name, provider_account_email, scopes, created_at, last_used_at"
            ).eq("user_id", user_id).eq("is_active", True).execute()

            return result.data or []

        except Exception as e:
            logger.error(f"Failed to list connections for user {user_id}: {e}")
            return []

    async def disconnect(
        self,
        provider: str,
        user_id: str,
    ) -> bool:
        """
        Disconnect (deactivate) a user's connection.

        Args:
            provider: Provider type
            user_id: User ID

        Returns:
            True if disconnected, False otherwise
        """
        try:
            # Remove from cache
            cache_key = f"{provider}:{user_id}"
            if cache_key in self._connector_cache:
                await self._connector_cache[cache_key].close()
                del self._connector_cache[cache_key]

            # Deactivate in database
            self.supabase.table("connector_credentials").update({
                "is_active": False
            }).eq("user_id", user_id).eq("provider", provider).execute()

            return True

        except Exception as e:
            logger.error(f"Failed to disconnect {provider} for user {user_id}: {e}")
            return False

    async def test_connection(
        self,
        provider: str,
        user_id: str,
    ) -> Dict:
        """
        Test a user's connection.

        Args:
            provider: Provider type
            user_id: User ID

        Returns:
            Dict with success status and details
        """
        connector = await self.get_connector(provider, user_id)

        if not connector:
            return {
                "success": False,
                "error": f"No {provider} connection found for user",
            }

        try:
            result = await connector.test_connection()
            return {
                "success": result.success,
                "data": result.data,
                "error": result.error,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    async def close_all(self):
        """Close all cached connector instances"""
        for connector in self._connector_cache.values():
            try:
                await connector.close()
            except Exception as e:
                logger.warning(f"Error closing connector: {e}")

        self._connector_cache.clear()


# Convenience function for creating connectors
def create_connector(
    supabase: Client,
    provider: str,
    credentials: ConnectorCredentials,
) -> BaseConnector:
    """
    Create a connector instance.

    This is a convenience function that creates a connector without
    needing to instantiate a ConnectorManager.
    """
    manager = ConnectorManager(supabase)
    return manager.create_connector(provider, credentials)
