"""
Connector API Routes - OAuth flow and connector management

Endpoints:
- GET  /api/connectors - List user's connected services
- GET  /api/connectors/available - List available connectors
- POST /api/connectors/oauth/{provider}/initiate - Start OAuth flow
- GET  /api/connectors/oauth/{provider}/callback - OAuth callback
- DELETE /api/connectors/{provider} - Disconnect a service
- POST /api/connectors/{provider}/test - Test connection
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from supabase import Client

from app.auth.dependencies import get_current_user, get_supabase_client
from app.config import get_settings
from app.connectors.oauth import (
    get_oauth_provider,
    OAuthStateManager,
    TokenEncryption,
    SUPPORTED_PROVIDERS,
)
from app.connectors import ConnectorManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connectors", tags=["connectors"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ConnectorInfo(BaseModel):
    """Connected service info"""
    provider: str
    provider_account_name: Optional[str]
    provider_account_email: Optional[str]
    scopes: Optional[List[str]]
    connected_at: str
    last_used_at: Optional[str]
    is_active: bool


class AvailableConnector(BaseModel):
    """Available connector info"""
    provider: str
    display_name: str
    description: str
    is_configured: bool
    scopes: List[str]


class OAuthInitiateRequest(BaseModel):
    """OAuth initiation request"""
    scopes: Optional[List[str]] = None
    redirect_url: Optional[str] = None


class OAuthInitiateResponse(BaseModel):
    """OAuth initiation response"""
    authorization_url: str
    provider: str


class ConnectionTestResponse(BaseModel):
    """Connection test response"""
    success: bool
    provider: str
    message: str
    user_info: Optional[dict] = None


# ============================================================================
# List Connectors
# ============================================================================

@router.get("", response_model=List[ConnectorInfo])
async def list_user_connectors(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """List all connected services for the current user"""
    try:
        result = supabase.table("connector_credentials").select(
            "provider, provider_account_name, provider_account_email, scopes, created_at, last_used_at, is_active"
        ).eq("user_id", user_id).eq("is_active", True).execute()

        connectors = []
        for row in result.data or []:
            connectors.append(ConnectorInfo(
                provider=row["provider"],
                provider_account_name=row.get("provider_account_name"),
                provider_account_email=row.get("provider_account_email"),
                scopes=row.get("scopes"),
                connected_at=row["created_at"],
                last_used_at=row.get("last_used_at"),
                is_active=row["is_active"],
            ))

        return connectors

    except Exception as e:
        logger.error(f"Failed to list connectors: {e}")
        raise HTTPException(status_code=500, detail="Failed to list connectors")


@router.get("/available", response_model=List[AvailableConnector])
async def list_available_connectors():
    """List all available connectors and their configuration status"""
    connectors = []

    connector_info = {
        "github": {
            "display_name": "GitHub",
            "description": "Access repositories, issues, pull requests, and code",
        },
        "slack": {
            "display_name": "Slack",
            "description": "Send messages, manage channels, and search conversations",
        },
        "google_drive": {
            "display_name": "Google Drive",
            "description": "Access files, folders, and documents in Google Drive",
        },
    }

    for provider in SUPPORTED_PROVIDERS:
        try:
            oauth_provider = get_oauth_provider(provider)
            info = connector_info.get(provider, {})

            connectors.append(AvailableConnector(
                provider=provider,
                display_name=info.get("display_name", provider.title()),
                description=info.get("description", ""),
                is_configured=oauth_provider.is_configured,
                scopes=oauth_provider.DEFAULT_SCOPES,
            ))
        except Exception as e:
            logger.warning(f"Error getting provider {provider}: {e}")

    return connectors


# ============================================================================
# OAuth Flow
# ============================================================================

@router.post("/oauth/{provider}/initiate", response_model=OAuthInitiateResponse)
async def initiate_oauth(
    provider: str,
    request: OAuthInitiateRequest = None,
    user_id: str = Depends(get_current_user),
):
    """
    Initiate OAuth flow for a provider.

    Returns the authorization URL to redirect the user to.
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider: {provider}. Supported: {SUPPORTED_PROVIDERS}"
        )

    try:
        oauth_provider = get_oauth_provider(provider)

        if not oauth_provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail=f"{provider} OAuth is not configured on this server"
            )

        # Create state token
        state_manager = OAuthStateManager()
        state = state_manager.create_state(
            user_id=user_id,
            provider=provider,
            redirect_url=request.redirect_url if request else None,
        )

        # Get authorization URL
        auth_url = oauth_provider.get_authorization_url(
            state=state,
            scopes=request.scopes if request else None,
        )

        logger.info(f"OAuth initiated for {provider} by user {user_id[:8]}...")

        return OAuthInitiateResponse(
            authorization_url=auth_url,
            provider=provider,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth initiation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate OAuth")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Handle OAuth callback from provider.

    This endpoint is called by the OAuth provider after user authorizes.
    """
    settings = get_settings()
    frontend_callback = settings.oauth_frontend_callback_url

    # Handle OAuth errors
    if error:
        logger.warning(f"OAuth error for {provider}: {error} - {error_description}")
        return RedirectResponse(
            url=f"{frontend_callback}?error={error}&provider={provider}"
        )

    try:
        # Validate state
        state_manager = OAuthStateManager()
        oauth_state = state_manager.validate_state(state)

        if oauth_state.provider != provider:
            raise ValueError("Provider mismatch in state")

        user_id = oauth_state.user_id

        # Get OAuth provider
        oauth_provider = get_oauth_provider(provider)

        # Exchange code for tokens
        token_response = await oauth_provider.exchange_code(code)

        # Get user info from provider
        user_info = await oauth_provider.get_user_info(token_response.access_token)

        # Encrypt tokens
        encryption = TokenEncryption()
        encrypted_access_token = encryption.encrypt(token_response.access_token)
        encrypted_refresh_token = None
        if token_response.refresh_token:
            encrypted_refresh_token = encryption.encrypt(token_response.refresh_token)

        # Calculate expiration
        expires_at = None
        if token_response.expires_in:
            expires_at = (datetime.utcnow() + timedelta(seconds=token_response.expires_in)).isoformat()

        # Store credentials
        credential_data = {
            "user_id": user_id,
            "provider": provider,
            "access_token_encrypted": encrypted_access_token,
            "refresh_token_encrypted": encrypted_refresh_token,
            "expires_at": expires_at,
            "scopes": token_response.scope.split() if token_response.scope else None,
            "provider_account_id": user_info.provider_account_id,
            "provider_account_name": user_info.provider_account_name,
            "provider_account_email": user_info.provider_account_email,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Upsert - update if exists, insert if not
        # First try to find existing
        existing = supabase.table("connector_credentials").select("id").eq(
            "user_id", user_id
        ).eq("provider", provider).execute()

        if existing.data:
            # Update existing
            supabase.table("connector_credentials").update(
                credential_data
            ).eq("id", existing.data[0]["id"]).execute()
            logger.info(f"Updated {provider} credentials for user {user_id[:8]}...")
        else:
            # Insert new
            supabase.table("connector_credentials").insert(credential_data).execute()
            logger.info(f"Created {provider} credentials for user {user_id[:8]}...")

        # Redirect back to frontend
        redirect_url = oauth_state.redirect_url or frontend_callback
        return RedirectResponse(
            url=f"{redirect_url}?success=true&provider={provider}"
        )

    except ValueError as e:
        logger.error(f"OAuth callback validation failed: {e}")
        return RedirectResponse(
            url=f"{frontend_callback}?error=invalid_state&provider={provider}"
        )
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return RedirectResponse(
            url=f"{frontend_callback}?error=callback_failed&provider={provider}"
        )


# ============================================================================
# Connector Management
# ============================================================================

@router.delete("/{provider}")
async def disconnect_connector(
    provider: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Disconnect (deactivate) a connector"""
    try:
        # Soft delete - just mark as inactive
        result = supabase.table("connector_credentials").update({
            "is_active": False,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("user_id", user_id).eq("provider", provider).execute()

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=f"No {provider} connection found"
            )

        logger.info(f"Disconnected {provider} for user {user_id[:8]}...")

        return {"success": True, "provider": provider}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disconnect {provider}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect")


@router.post("/{provider}/test", response_model=ConnectionTestResponse)
async def test_connector(
    provider: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Test a connector connection"""
    try:
        manager = ConnectorManager(supabase)
        result = await manager.test_connection(provider, user_id)

        return ConnectionTestResponse(
            success=result["success"],
            provider=provider,
            message="Connection successful" if result["success"] else result.get("error", "Connection failed"),
            user_info=result.get("data") if result["success"] else None,
        )

    except Exception as e:
        logger.error(f"Connection test failed for {provider}: {e}")
        return ConnectionTestResponse(
            success=False,
            provider=provider,
            message=str(e),
        )
