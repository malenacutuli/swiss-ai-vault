"""
Sandbox Management API Endpoints with SwissBrain Standard.

Provides REST API for:
- Creating sandboxes with custom configuration
- Executing commands and code
- Retrieving metrics and health status
- Managing sandbox lifecycle
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
import logging

from app.auth import get_current_user
from app.sandbox.manager_enhanced import get_enhanced_sandbox_manager
from app.sandbox.config import (
    SandboxConfig,
    NetworkConfig,
    StorageConfig,
    SecurityConfig,
    DEFAULT_CONFIG
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models

class CreateSandboxRequest(BaseModel):
    """Request to create a new sandbox"""
    run_id: str = Field(..., description="Agent run ID")
    cpu_count: Optional[int] = Field(2, ge=1, le=8, description="CPU cores")
    memory_mb: Optional[int] = Field(512, ge=128, le=8192, description="Memory in MB")
    disk_gb: Optional[int] = Field(10, ge=1, le=100, description="Disk space in GB")
    enable_networking: Optional[bool] = Field(True, description="Enable network access")
    execution_timeout: Optional[int] = Field(300, ge=10, le=3600, description="Execution timeout")
    pre_install_packages: Optional[List[str]] = Field(default_factory=list, description="Packages to pre-install")
    environment_variables: Optional[Dict[str, str]] = Field(default_factory=dict, description="Environment variables")


class ExecuteCommandRequest(BaseModel):
    """Request to execute shell command"""
    command: str = Field(..., description="Shell command to execute")
    timeout: Optional[int] = Field(30, ge=1, le=600, description="Execution timeout in seconds")


class ExecuteCodeRequest(BaseModel):
    """Request to execute code"""
    language: str = Field(..., description="Programming language (python, javascript, bash)")
    code: str = Field(..., description="Code to execute")
    timeout: Optional[int] = Field(30, ge=1, le=600, description="Execution timeout in seconds")


class SandboxResponse(BaseModel):
    """Response with sandbox information"""
    sandbox_id: str
    run_id: str
    status: str
    created_at: Optional[str] = None


class ExecutionResponse(BaseModel):
    """Response from code/command execution"""
    success: bool
    stdout: str
    stderr: str
    exit_code: Optional[int] = None
    error: Optional[str] = None
    execution_time: float
    metrics: Optional[Dict[str, Any]] = None


class MetricsResponse(BaseModel):
    """Response with sandbox metrics"""
    sandbox_id: str
    run_id: str
    cpu: Dict[str, Any]
    memory: Dict[str, Any]
    disk: Dict[str, Any]
    network: Dict[str, Any]
    execution: Dict[str, Any]
    health: Dict[str, Any]


# API Endpoints

@router.post("/sandboxes/create", response_model=SandboxResponse)
async def create_sandbox(
    request: CreateSandboxRequest,
    user: dict = Depends(get_current_user)
):
    """
    Create a new E2B sandbox with custom configuration.

    Args:
        request: Sandbox configuration
        user: Authenticated user

    Returns:
        Sandbox information including ID and status
    """
    user_id = user["id"]
    manager = get_enhanced_sandbox_manager()

    try:
        # Build sandbox config
        config = SandboxConfig(
            cpu_count=request.cpu_count,
            memory_mb=request.memory_mb,
            disk_gb=request.disk_gb,
            execution_timeout=request.execution_timeout,
            environment_variables=request.environment_variables or {},
            pre_install_packages=request.pre_install_packages or []
        )

        if not request.enable_networking:
            config.network.enable_networking = False

        # Create sandbox
        sandbox_id = await manager.create_sandbox(
            run_id=request.run_id,
            config=config
        )

        logger.info(f"Created sandbox {sandbox_id} for user {user_id}, run {request.run_id}")

        return SandboxResponse(
            sandbox_id=sandbox_id,
            run_id=request.run_id,
            status="running",
            created_at=None  # Will be in metrics
        )

    except Exception as e:
        logger.error(f"Failed to create sandbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sandboxes/{run_id}/execute/command", response_model=ExecutionResponse)
async def execute_command(
    run_id: str,
    request: ExecuteCommandRequest,
    user: dict = Depends(get_current_user)
):
    """
    Execute shell command in sandbox.

    Args:
        run_id: Agent run ID
        request: Command execution request
        user_id: Authenticated user ID

    Returns:
        Execution result with stdout, stderr, and metrics
    """
    manager = get_enhanced_sandbox_manager()

    try:
        result = await manager.execute_shell(
            run_id=run_id,
            command=request.command,
            timeout=request.timeout
        )

        # Get updated metrics
        metrics = await manager.get_metrics(run_id)

        return ExecutionResponse(
            success=result.get("success", False),
            stdout=result.get("stdout", ""),
            stderr=result.get("stderr", ""),
            exit_code=result.get("exit_code"),
            error=result.get("error"),
            execution_time=result.get("execution_time", 0.0),
            metrics=metrics
        )

    except Exception as e:
        logger.error(f"Failed to execute command: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sandboxes/{run_id}/execute/code", response_model=ExecutionResponse)
async def execute_code(
    run_id: str,
    request: ExecuteCodeRequest,
    user: dict = Depends(get_current_user)
):
    """
    Execute code in sandbox.

    Args:
        run_id: Agent run ID
        request: Code execution request
        user_id: Authenticated user ID

    Returns:
        Execution result with output and metrics
    """
    manager = get_enhanced_sandbox_manager()

    try:
        result = await manager.execute_code(
            run_id=run_id,
            language=request.language,
            code=request.code,
            timeout=request.timeout
        )

        # Get updated metrics
        metrics = await manager.get_metrics(run_id)

        return ExecutionResponse(
            success=result.get("success", False),
            stdout=result.get("stdout", ""),
            stderr=result.get("stderr", ""),
            exit_code=0 if result.get("success") else 1,
            error=result.get("error"),
            execution_time=result.get("execution_time", 0.0),
            metrics=metrics
        )

    except Exception as e:
        logger.error(f"Failed to execute code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sandboxes/{run_id}/metrics", response_model=MetricsResponse)
async def get_metrics(
    run_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Get real-time metrics for sandbox.

    Args:
        run_id: Agent run ID
        user_id: Authenticated user ID

    Returns:
        Comprehensive sandbox metrics
    """
    manager = get_enhanced_sandbox_manager()

    try:
        metrics = await manager.get_metrics(run_id)

        if not metrics:
            raise HTTPException(status_code=404, detail="Sandbox not found")

        return MetricsResponse(**metrics)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sandboxes/{run_id}/health")
async def health_check(
    run_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Check sandbox health status.

    Args:
        run_id: Agent run ID
        user_id: Authenticated user ID

    Returns:
        Health status and diagnostics
    """
    manager = get_enhanced_sandbox_manager()

    try:
        is_healthy = await manager._health_check_sandbox(run_id)

        if not is_healthy:
            return {
                "status": "unhealthy",
                "run_id": run_id,
                "message": "Sandbox failed health check"
            }

        metrics = await manager.get_metrics(run_id)

        return {
            "status": "healthy",
            "run_id": run_id,
            "last_activity": metrics.get("timestamps", {}).get("last_activity_at") if metrics else None,
            "execution_count": metrics.get("execution", {}).get("count") if metrics else 0
        }

    except Exception as e:
        logger.error(f"Failed to check health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sandboxes/{run_id}")
async def destroy_sandbox(
    run_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Destroy sandbox and free resources.

    Args:
        run_id: Agent run ID
        user_id: Authenticated user ID

    Returns:
        Destruction status and final metrics
    """
    manager = get_enhanced_sandbox_manager()

    try:
        # Get final metrics before destruction
        metrics = await manager.get_metrics(run_id)

        # Cleanup sandbox
        await manager.cleanup_sandbox(run_id)

        logger.info(f"Destroyed sandbox for run {run_id}")

        return {
            "status": "destroyed",
            "run_id": run_id,
            "final_metrics": metrics
        }

    except Exception as e:
        logger.error(f"Failed to destroy sandbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sandboxes")
async def list_sandboxes(
    user: dict = Depends(get_current_user)
):
    """
    List all active sandboxes.

    Args:
        user_id: Authenticated user ID

    Returns:
        List of active sandboxes with summary info
    """
    manager = get_enhanced_sandbox_manager()

    try:
        active_count = manager.get_active_sandbox_count()

        # Get all sandbox info
        sandboxes = []
        for run_id in list(manager.active_sandboxes.keys()):
            info = manager.get_sandbox_info(run_id)
            if info:
                sandboxes.append(info)

        return {
            "total": active_count,
            "sandboxes": sandboxes
        }

    except Exception as e:
        logger.error(f"Failed to list sandboxes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
