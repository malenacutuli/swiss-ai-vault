"""
Token encryption for secure storage of OAuth tokens
"""

import base64
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings

logger = logging.getLogger(__name__)


class TokenEncryption:
    """
    Encrypt and decrypt OAuth tokens for secure storage.

    Uses Fernet symmetric encryption with a key derived from the
    configured encryption key.
    """

    _instance: Optional["TokenEncryption"] = None
    _fernet: Optional[Fernet] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize encryption with key from settings"""
        settings = get_settings()

        if settings.connector_encryption_key:
            # Use provided key
            key = self._derive_key(settings.connector_encryption_key)
            self._fernet = Fernet(key)
            logger.info("Token encryption initialized with configured key")
        else:
            # Generate a warning - tokens will be stored unencrypted
            logger.warning(
                "CONNECTOR_ENCRYPTION_KEY not configured! "
                "Tokens will be stored WITHOUT encryption. "
                "Set this in production!"
            )
            self._fernet = None

    def _derive_key(self, secret: str) -> bytes:
        """Derive a Fernet-compatible key from the secret"""
        # Use PBKDF2 to derive a proper key
        salt = b"swissvault_connector_tokens"  # Fixed salt for consistency
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
        return key

    @property
    def is_enabled(self) -> bool:
        """Check if encryption is enabled"""
        return self._fernet is not None

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a token.

        Args:
            plaintext: The token to encrypt

        Returns:
            Encrypted token as base64 string, or plaintext if encryption disabled
        """
        if not self._fernet:
            # Return as-is if encryption not configured
            return plaintext

        try:
            encrypted = self._fernet.encrypt(plaintext.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError("Failed to encrypt token")

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt a token.

        Args:
            ciphertext: The encrypted token

        Returns:
            Decrypted token, or ciphertext as-is if encryption disabled
        """
        if not self._fernet:
            # Return as-is if encryption not configured
            return ciphertext

        try:
            # Decode from base64
            encrypted = base64.urlsafe_b64decode(ciphertext.encode())
            decrypted = self._fernet.decrypt(encrypted)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            # This might be a plaintext token from before encryption was enabled
            # Try returning as-is
            logger.warning("Decryption failed, returning as plaintext")
            return ciphertext


def encrypt_token(token: str) -> str:
    """Convenience function to encrypt a token"""
    return TokenEncryption().encrypt(token)


def decrypt_token(token: str) -> str:
    """Convenience function to decrypt a token"""
    return TokenEncryption().decrypt(token)
