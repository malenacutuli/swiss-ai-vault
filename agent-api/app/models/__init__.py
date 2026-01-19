"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class AgentExecuteRequest(BaseModel):
    """Request to execute agent action"""
    action: str = Field(..., description="Action to perform: create, start, stop, retry, resume")
    run_id: Optional[str] = Field(None, description="Run ID (required for start/stop/retry/resume)")
    prompt: Optional[str] = Field(None, description="User prompt (required for create)")
    project_id: Optional[str] = Field(None, description="Project ID to link run to")
    connector_ids: Optional[List[str]] = Field(None, description="Data connectors to use")
    user_input: Optional[str] = Field(None, description="User input for resume action")


class AgentExecuteResponse(BaseModel):
    """Response from agent execute endpoint"""
    run_id: str
    status: str
    message: str
    plan: Optional[Dict[str, Any]] = None


class AgentStatusRequest(BaseModel):
    """Request to get agent status"""
    run_id: str
    include_steps: bool = False
    include_messages: bool = False
    include_artifacts: bool = False
    include_logs: bool = False
    steps_limit: int = 50
    messages_limit: int = 100
    artifacts_limit: int = 50
    logs_limit: int = 100


class AgentStatusResponse(BaseModel):
    """Response from agent status endpoint"""
    run: Dict[str, Any]
    progress: Dict[str, Any]
    steps: Optional[List[Dict[str, Any]]] = None
    messages: Optional[List[Dict[str, Any]]] = None
    artifacts: Optional[List[Dict[str, Any]]] = None
    logs: Optional[List[Dict[str, Any]]] = None


class AgentLogsRequest(BaseModel):
    """Request to get agent logs"""
    run_id: str
    mode: str = "polling"  # polling or stream
    since: Optional[str] = None
    limit: int = 100


class AgentLogsResponse(BaseModel):
    """Response from agent logs endpoint (polling mode)"""
    logs: List[Dict[str, Any]]
    has_more: bool
    next_cursor: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
