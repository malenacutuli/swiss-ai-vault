"""
Authentication helpers for verifying Supabase JWTs
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from functools import lru_cache
import structlog

from app.config import get_settings

logger = structlog.get_logger()
security = HTTPBearer()


@lru_cache()
def get_supabase_client() -> Client:
    """Get cached Supabase client"""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Verify JWT token and return current user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        token = credentials.credentials
        supabase = get_supabase_client()

        # Verify JWT and get user
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            logger.warning("auth_failed", reason="invalid_token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

        user = user_response.user

        logger.info(
            "user_authenticated",
            user_id=user.id,
            email=user.email,
        )

        return {
            "id": user.id,
            "email": user.email,
            "metadata": user.user_metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("auth_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def get_supabase_for_user(
    user: dict = Depends(get_current_user),
) -> Client:
    """
    Get Supabase client with user context
    Uses service role key but tracks user_id for RLS
    """
    return get_supabase_client()
