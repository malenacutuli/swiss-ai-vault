"""
Authentication dependencies for FastAPI routes.

Production-grade authentication using Supabase JWT tokens.
"""

from fastapi import Depends, HTTPException, Header
from typing import Optional
from supabase import create_client, Client
import structlog

from app.config import get_settings

logger = structlog.get_logger()


def get_supabase_client() -> Client:
    """
    Get Supabase client instance.

    Returns:
        Supabase client
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )


async def get_current_user(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase_client)
) -> str:
    """
    Extract and validate current user from JWT token.

    Args:
        authorization: Authorization header with Bearer token
        supabase: Supabase client

    Returns:
        User ID

    Raises:
        HTTPException: If authentication fails
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = parts[1]

    try:
        # Verify token with Supabase
        user_response = supabase.auth.get_user(token)

        if not user_response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )

        user_id = user_response.user.id

        logger.info("user_authenticated", user_id=user_id)

        return user_id

    except HTTPException:
        raise
    except Exception as e:
        logger.error("authentication_failed", error=str(e))
        raise HTTPException(
            status_code=401,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase_client)
) -> Optional[str]:
    """
    Extract user if authenticated, return None if not.

    For endpoints that support optional authentication.

    Args:
        authorization: Authorization header with Bearer token
        supabase: Supabase client

    Returns:
        User ID or None
    """
    if not authorization:
        return None

    try:
        return await get_current_user(authorization, supabase)
    except HTTPException:
        return None


async def get_supabase_for_user(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
) -> Client:
    """
    Get Supabase client for authenticated user.

    This dependency ensures authentication and returns a Supabase client.
    The user_id is verified before returning the client.

    Args:
        user_id: Authenticated user ID from get_current_user
        supabase: Supabase client

    Returns:
        Supabase client
    """
    # User is already authenticated via get_current_user dependency
    return supabase
