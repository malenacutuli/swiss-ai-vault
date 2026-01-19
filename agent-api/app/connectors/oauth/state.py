"""
OAuth State Management - Secure state token handling for OAuth flows
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# State token expiration (10 minutes)
STATE_EXPIRATION_SECONDS = 600


@dataclass
class OAuthState:
    """OAuth state data"""
    user_id: str
    provider: str
    timestamp: float
    nonce: str
    redirect_url: Optional[str] = None


class OAuthStateManager:
    """
    Manages OAuth state tokens for CSRF protection.

    State tokens are signed and include:
    - User ID
    - Provider
    - Timestamp (for expiration)
    - Nonce (for uniqueness)
    - Optional redirect URL
    """

    def __init__(self):
        settings = get_settings()
        # Use encryption key as signing key, or fall back to a hash of service role key
        if settings.connector_encryption_key:
            self._secret = settings.connector_encryption_key
        else:
            # Derive from service role key as fallback
            self._secret = hashlib.sha256(
                settings.supabase_service_role_key.encode()
            ).hexdigest()

    def create_state(
        self,
        user_id: str,
        provider: str,
        redirect_url: Optional[str] = None,
    ) -> str:
        """
        Create a signed state token.

        Args:
            user_id: The user initiating OAuth
            provider: OAuth provider name
            redirect_url: Optional URL to redirect after OAuth

        Returns:
            Signed state token string
        """
        state = OAuthState(
            user_id=user_id,
            provider=provider,
            timestamp=time.time(),
            nonce=secrets.token_urlsafe(16),
            redirect_url=redirect_url,
        )

        # Serialize state data
        state_data = json.dumps({
            "user_id": state.user_id,
            "provider": state.provider,
            "timestamp": state.timestamp,
            "nonce": state.nonce,
            "redirect_url": state.redirect_url,
        })

        # Sign the state
        signature = self._sign(state_data)

        # Combine data and signature
        combined = f"{state_data}|{signature}"

        # Base64 encode for URL safety
        return base64.urlsafe_b64encode(combined.encode()).decode()

    def validate_state(self, state_token: str) -> OAuthState:
        """
        Validate and decode a state token.

        Args:
            state_token: The state token to validate

        Returns:
            OAuthState if valid

        Raises:
            ValueError: If state is invalid or expired
        """
        try:
            # Decode from base64
            decoded = base64.urlsafe_b64decode(state_token.encode()).decode()

            # Split data and signature
            parts = decoded.rsplit("|", 1)
            if len(parts) != 2:
                raise ValueError("Invalid state format")

            state_data, signature = parts

            # Verify signature
            expected_signature = self._sign(state_data)
            if not hmac.compare_digest(signature, expected_signature):
                raise ValueError("Invalid state signature")

            # Parse state data
            data = json.loads(state_data)

            # Check expiration
            age = time.time() - data["timestamp"]
            if age > STATE_EXPIRATION_SECONDS:
                raise ValueError(f"State expired ({age:.0f}s old)")

            return OAuthState(
                user_id=data["user_id"],
                provider=data["provider"],
                timestamp=data["timestamp"],
                nonce=data["nonce"],
                redirect_url=data.get("redirect_url"),
            )

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"State validation failed: {e}")
            raise ValueError("Invalid state token")

    def _sign(self, data: str) -> str:
        """Create HMAC signature for data"""
        return hmac.new(
            self._secret.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
