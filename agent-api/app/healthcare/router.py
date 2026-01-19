"""FastAPI router for Healthcare API"""

import os
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import StreamingResponse
from typing import Optional
import json

from .models import (
    HealthcareQueryRequest,
    HealthcareQueryResponse,
    ToolCallRequest
)
from .orchestrator import HealthcareOrchestrator
from .tools import get_tool, HEALTHCARE_TOOLS

router = APIRouter(prefix="/healthcare", tags=["healthcare"])

# Initialize orchestrator
orchestrator = HealthcareOrchestrator()


# ============================================
# AUTH DEPENDENCY
# ============================================

async def verify_auth(authorization: Optional[str] = Header(None)):
    """Verify authentication token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    # Extract token
    token = authorization.replace("Bearer ", "")

    # TODO: Integrate with Supabase JWT verification
    # For now, just validate token exists
    if not token or len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {"user_id": "temp-user-id", "token": token}


# ============================================
# ENDPOINTS
# ============================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "swissvault-healthcare",
        "version": "1.0.0",
        "models": {
            "complex": "claude-opus-4-20250514",
            "fast": "claude-sonnet-4-20250514"
        }
    }


@router.post("/query", response_model=HealthcareQueryResponse)
async def healthcare_query(
    request: HealthcareQueryRequest,
    req: Request,
    auth: dict = Depends(verify_auth)
):
    """
    Main healthcare query endpoint.

    Supports:
    - Prior authorization review
    - Claims appeals analysis
    - ICD-10 code lookup
    - Drug interaction checks
    - Literature search
    - Clinical documentation
    - Care coordination
    """
    try:
        response = await orchestrator.execute(request)

        # TODO: Log to audit table (metadata only)
        # await log_healthcare_action(
        #     user_id=auth["user_id"],
        #     action="query",
        #     task_type=request.task_type,
        #     tools_used=[t.tool for t in response.tool_results],
        #     ip_address=req.client.host,
        #     user_agent=req.headers.get("user-agent")
        # )

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/stream")
async def healthcare_query_stream(
    request: HealthcareQueryRequest,
    auth: dict = Depends(verify_auth)
):
    """
    Streaming healthcare query endpoint.
    Returns Server-Sent Events.
    """
    async def generate():
        try:
            async for chunk in orchestrator.stream(request):
                yield f"data: {chunk.model_dump_json()}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@router.post("/tools/{tool_name}")
async def direct_tool_call(
    tool_name: str,
    request: dict,
    auth: dict = Depends(verify_auth)
):
    """
    Direct tool call endpoint.
    Useful for quick lookups without full orchestration.
    """
    tool = get_tool(tool_name)
    if not tool:
        raise HTTPException(
            status_code=404,
            detail=f"Tool not found: {tool_name}. Available: {list(HEALTHCARE_TOOLS.keys())}"
        )

    try:
        result = await tool.execute(**request)
        return {
            "tool": tool_name,
            "input": request,
            "output": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools():
    """List available healthcare tools"""
    return {
        "tools": [
            {
                "name": name,
                "description": tool.description,
                "schema": tool.input_schema
            }
            for name, tool in HEALTHCARE_TOOLS.items()
        ]
    }


@router.get("/task-types")
async def list_task_types():
    """List available healthcare task types"""
    return {
        "task_types": [
            {
                "value": "prior_auth_review",
                "label": "Prior Authorization",
                "description": "Review requests against coverage criteria",
                "model": "complex"
            },
            {
                "value": "claims_appeal",
                "label": "Claims Appeal",
                "description": "Analyze denials and build appeals",
                "model": "complex"
            },
            {
                "value": "icd10_lookup",
                "label": "ICD-10 Lookup",
                "description": "Search diagnosis and procedure codes",
                "model": "fast"
            },
            {
                "value": "drug_interaction",
                "label": "Drug Interaction",
                "description": "Check medication interactions",
                "model": "fast"
            },
            {
                "value": "literature_search",
                "label": "Literature Search",
                "description": "Search PubMed medical research",
                "model": "fast"
            },
            {
                "value": "clinical_documentation",
                "label": "Clinical Documentation",
                "description": "Help with clinical notes",
                "model": "complex"
            },
            {
                "value": "care_coordination",
                "label": "Care Coordination",
                "description": "Message triage and tracking",
                "model": "complex"
            },
            {
                "value": "general_query",
                "label": "General Query",
                "description": "Ask any healthcare question",
                "model": "fast"
            }
        ]
    }
