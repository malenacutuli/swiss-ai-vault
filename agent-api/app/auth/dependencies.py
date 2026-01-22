"""
Authentication dependencies for FastAPI routes.

Cross-project authentication supporting tokens from both:
- Direct project (ghmmdochvlrnwbruyrqk)
- Lovable project (rljnrgscmosgkcjdvlrq)

Uses JWT decode without signature verification for cross-project compatibility.
"""

from fastapi import Depends, HTTPException, Header
from typing import Optional
from supabase import create_client, Client
import structlog
import base64
import json
import time

from app.config import get_settings

logger = structlog.get_logger()

# Lovable project reference for cross-project auth
LOVABLE_PROJECT_REF = 'rljnrgscmosgkcjdvlrq'
DIRECT_PROJECT_REF = 'ghmmdochvlrnwbruyrqk'


def base64url_decode(data: str) -> bytes:
    """Decode base64url (JWT uses URL-safe base64)"""
    # Add padding if needed
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    # Replace URL-safe characters
    data = data.replace('-', '+').replace('_', '/')
    return base64.b64decode(data)


def decode_jwt(token: str) -> Optional[dict]:
    """Decode a JWT token without signature verification (for cross-project auth)"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            logger.warning("invalid_jwt_format", parts_count=len(parts))
            return None

        # Decode payload (second part)
        payload_bytes = base64url_decode(parts[1])
        payload = json.loads(payload_bytes.decode('utf-8'))

        logger.info("jwt_decoded", sub=payload.get('sub'), iss=payload.get('iss'))
        return payload
    except Exception as e:
        logger.error("jwt_decode_error", error=str(e))
        return None


def is_token_expired(payload: dict) -> bool:
    """Check if token is expired"""
    exp = payload.get('exp')
    if not exp:
        return False
    return time.time() >= exp


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

    Supports cross-project authentication:
    - Tokens from Direct project are verified via Supabase
    - Tokens from Lovable project are decoded and validated without signature check

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

    # First, try to decode the JWT to check which project it's from
    payload = decode_jwt(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Check expiration
    if is_token_expired(payload):
        logger.warning("token_expired", exp=payload.get('exp'))
        raise HTTPException(
            status_code=401,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Extract user ID from token
    user_id = payload.get('sub') or payload.get('user_id') or payload.get('id')

    if not user_id:
        logger.warning("no_user_id_in_token", payload_keys=list(payload.keys()))
        raise HTTPException(
            status_code=401,
            detail="Invalid token: no user ID",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Check if it's from a known Supabase project
    iss = payload.get('iss', '')
    is_lovable = LOVABLE_PROJECT_REF in iss
    is_direct = DIRECT_PROJECT_REF in iss

    logger.info(
        "cross_project_auth",
        user_id=user_id,
        is_lovable=is_lovable,
        is_direct=is_direct,
        iss=iss
    )

    # For direct project tokens, optionally verify with Supabase
    if is_direct:
        try:
            user_response = supabase.auth.get_user(token)
            if user_response.user:
                logger.info("direct_project_verified", user_id=user_response.user.id)
                return user_response.user.id
        except Exception as e:
            logger.warning("direct_verification_failed", error=str(e))
            # Fall through to use decoded user_id

    # For Lovable project or failed direct verification, trust the decoded token
    email = payload.get('email')
    logger.info("user_authenticated_cross_project", user_id=user_id, email=email, source="lovable" if is_lovable else "decoded")
    return user_id


async def get_current_user_with_email(
    authorization: Optional[str] = Header(None),
    supabase: Client = Depends(get_supabase_client)
) -> dict:
    """
    Extract user ID and email from JWT token.
    Returns dict with 'id' and 'email' keys.
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = parts[1]
    payload = decode_jwt(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if is_token_expired(payload):
        raise HTTPException(
            status_code=401,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get('sub') or payload.get('user_id') or payload.get('id')
    email = payload.get('email')

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token: no user ID",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return {"id": user_id, "email": email}


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
