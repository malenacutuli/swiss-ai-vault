"""
Agent Execute API Route
Handles create, start, stop, retry, resume actions
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from supabase import Client
from anthropic import Anthropic
import structlog
import os

from app.auth import get_current_user, get_supabase_for_user
from app.models import AgentExecuteRequest, AgentExecuteResponse, ErrorResponse
from app.agent.planner import AgentPlanner
from app.agent.supervisor import AgentSupervisor
from app.agent.models.types import ExecutionPlan

logger = structlog.get_logger()
router = APIRouter()

# Lazy initialization of Anthropic client
_anthropic_client = None

def get_anthropic_client() -> Anthropic:
    """Get or create Anthropic client (lazy initialization)"""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        _anthropic_client = Anthropic(api_key=api_key)
    return _anthropic_client


@router.post("/execute", response_model=AgentExecuteResponse)
async def agent_execute(
    request: AgentExecuteRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_for_user),
):
    """
    Execute agent action: create, start, stop, retry, or resume

    - **create**: Create a new agent run
    - **start**: Start execution of a created run
    - **stop**: Cancel a running agent
    - **retry**: Retry a failed run (creates new run with same prompt)
    - **resume**: Resume a paused agent with optional user input
    """

    logger.info(
        "agent_execute_requested",
        action=request.action,
        run_id=request.run_id,
        user_id=user_id,
    )

    try:
        # Route to appropriate action handler
        if request.action == "create":
            return await handle_create(
                supabase, user_id, request.prompt,
                request.project_id, request.connector_ids
            )

        elif request.action == "start":
            if not request.run_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="run_id is required for start action"
                )
            return await handle_start(
                supabase, user_id, request.run_id, background_tasks
            )

        elif request.action == "stop":
            if not request.run_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="run_id is required for stop action"
                )
            return await handle_stop(supabase, user_id, request.run_id)

        elif request.action == "retry":
            if not request.run_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="run_id is required for retry action"
                )
            return await handle_retry(supabase, user_id, request.run_id)

        elif request.action == "resume":
            if not request.run_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="run_id is required for resume action"
                )
            return await handle_resume(
                supabase, user_id, request.run_id,
                request.user_input, background_tasks
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown action: {request.action}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "agent_execute_failed",
            action=request.action,
            error=str(e),
            user_id=user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


async def handle_create(
    supabase: Client,
    user_id: str,
    prompt: str,
    project_id: str = None,
    connector_ids: list[str] = None,
) -> AgentExecuteResponse:
    """Create a new agent run"""

    # Validate prompt
    if not prompt or not prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt is required"
        )

    # Check credit balance
    balance_response = supabase.table("credit_balances").select("available_credits").eq("user_id", user_id).execute()

    if not balance_response.data or balance_response.data[0]["available_credits"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits"
        )

    # Create agent run record
    run_data = {
        "user_id": user_id,
        "prompt": prompt,
        "status": "created",
        "total_credits_used": 0,
    }
    # Add project_id to metadata if provided
    if project_id:
        run_data["metadata"] = {"project_id": project_id}

    run_response = supabase.table("agent_runs").insert(run_data).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create agent run"
        )

    run = run_response.data[0]
    run_id = run["id"]

    # Store initial user message
    supabase.table("agent_messages").insert({
        "run_id": run_id,
        "role": "user",
        "content": prompt,
    }).execute()

    # Link connectors if provided
    if connector_ids:
        connector_links = [
            {"run_id": run_id, "connector_id": cid}
            for cid in connector_ids
        ]
        supabase.table("agent_run_connectors").insert(connector_links).execute()

    # Update status to queued FIRST (before Redis enqueue)
    # This ensures job is marked as queued even if Redis fails
    supabase.table("agent_runs").update({
        "status": "queued"
    }).eq("id", run_id).execute()

    # Then try to enqueue to Redis (best effort)
    from app.redis.clients import get_api_redis
    from datetime import datetime
    import json

    try:
        redis = get_api_redis()
        job_data = {
            "run_id": run_id,
            "enqueued_at": datetime.utcnow().isoformat(),
            "priority": 0,
            "retry_count": 0
        }
        redis.lpush("jobs:pending", json.dumps(job_data))

        logger.info(
            "agent_run_enqueued",
            run_id=run_id,
            user_id=user_id,
        )
    except Exception as e:
        logger.warning(
            "redis_enqueue_failed",
            run_id=run_id,
            error=str(e),
            message="Job marked as queued in DB, but Redis enqueue failed"
        )

    logger.info(
        "agent_run_created",
        run_id=run_id,
        user_id=user_id,
        prompt_length=len(prompt),
    )

    return AgentExecuteResponse(
        run_id=run_id,
        status="queued",
        message="Agent run created and queued for processing"
    )


async def handle_start(
    supabase: Client,
    user_id: str,
    run_id: str,
    background_tasks: BackgroundTasks,
) -> AgentExecuteResponse:
    """Start agent execution (enqueue to Redis)"""

    # Get run
    run_response = supabase.table("agent_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    run = run_response.data[0]

    # Check if run can be started
    if run["status"] not in ["created", "queued"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start run in status: {run['status']}"
        )

    # Update status to queued
    supabase.table("agent_runs").update({
        "status": "queued",
        "started_at": "now()"
    }).eq("id", run_id).execute()

    # Enqueue to Redis for worker processing
    from app.redis.clients import get_api_redis
    from datetime import datetime
    import json

    redis = get_api_redis()
    job_data = {
        "run_id": run_id,
        "enqueued_at": datetime.utcnow().isoformat(),
        "priority": 0,
        "retry_count": 0
    }

    try:
        redis.lpush("jobs:pending", json.dumps(job_data))
        logger.info(
            "agent_execution_queued",
            run_id=run_id,
            user_id=user_id,
        )
    except Exception as e:
        logger.error("failed_to_enqueue", run_id=run_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enqueue job"
        )

    return AgentExecuteResponse(
        run_id=run_id,
        status="queued",
        message="Agent execution queued for processing",
        plan=None  # Will be generated by worker
    )


async def handle_stop(
    supabase: Client,
    user_id: str,
    run_id: str,
) -> AgentExecuteResponse:
    """Stop/cancel agent execution"""

    # Get run
    run_response = supabase.table("agent_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    run = run_response.data[0]

    # Check if can be cancelled
    cancellable_statuses = ["created", "queued", "planning", "executing", "waiting_input"]
    if run["status"] not in cancellable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel run in status: {run['status']}"
        )

    # Update to cancelled
    supabase.table("agent_runs").update({
        "status": "cancelled",
        "completed_at": "now()"
    }).eq("id", run_id).execute()

    logger.info(
        "agent_execution_stopped",
        run_id=run_id,
        user_id=user_id,
    )

    return AgentExecuteResponse(
        run_id=run_id,
        status="cancelled",
        message="Agent execution stopped"
    )


async def handle_retry(
    supabase: Client,
    user_id: str,
    run_id: str,
) -> AgentExecuteResponse:
    """Retry a failed run (creates new run with same prompt)"""

    # Get failed run
    run_response = supabase.table("agent_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    run = run_response.data[0]

    # Can only retry failed runs
    if run["status"] != "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry run in status: {run['status']}"
        )

    # Create new run with same prompt
    return await handle_create(
        supabase, user_id, run["prompt"], run.get("project_id")
    )


async def handle_resume(
    supabase: Client,
    user_id: str,
    run_id: str,
    user_input: str = None,
    background_tasks: BackgroundTasks = None,
) -> AgentExecuteResponse:
    """Resume a paused/waiting agent"""

    # Get run
    run_response = supabase.table("agent_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    run = run_response.data[0]

    # Check if can be resumed
    resumable_statuses = ["waiting_input", "paused"]
    if run["status"] not in resumable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resume run in status: {run['status']}"
        )

    # If user input provided, store it
    if user_input:
        supabase.table("agent_messages").insert({
            "run_id": run_id,
            "role": "user",
            "content": user_input,
        }).execute()

    # Resume execution
    supabase.table("agent_runs").update({
        "status": "executing"
    }).eq("id", run_id).execute()

    # Continue execution in background
    if background_tasks:
        background_tasks.add_task(execute_agent_in_background, supabase, user_id, run_id, run["prompt"])

    logger.info(
        "agent_execution_resumed",
        run_id=run_id,
        user_id=user_id,
    )

    return AgentExecuteResponse(
        run_id=run_id,
        status="executing",
        message="Agent execution resumed"
    )


async def execute_agent_in_background(
    supabase: Client,
    user_id: str,
    run_id: str,
    prompt: str,
):
    """Background task for agent execution with planning and supervision"""
    try:
        logger.info(
            "background_execution_started",
            run_id=run_id,
            user_id=user_id,
        )

        # Step 1: Planning phase
        supabase.table("agent_runs").update({
            "status": "planning"
        }).eq("id", run_id).execute()

        planner = AgentPlanner(supabase, user_id, get_anthropic_client())
        plan, error = await planner.create_plan(prompt)

        if not plan or error:
            logger.error(
                "planning_failed",
                run_id=run_id,
                error=error,
            )
            supabase.table("agent_runs").update({
                "status": "failed",
                "error_message": f"Planning failed: {error}",
                "completed_at": "now()"
            }).eq("id", run_id).execute()
            return

        # Save plan to run
        supabase.table("agent_runs").update({
            "plan": plan.dict(),
            "plan_version": 1,
        }).eq("id", run_id).execute()

        logger.info(
            "planning_completed",
            run_id=run_id,
            phases=len(plan.phases),
            estimated_credits=plan.total_estimated_credits,
        )

        # Step 2: Execution phase
        supervisor = AgentSupervisor(
            supabase=supabase,
            anthropic=get_anthropic_client(),
            run_id=run_id,
            user_id=user_id,
            plan=plan,
            current_phase_number=1,
        )

        result = await supervisor.execute()

        # Update final status based on result
        if result.status == "completed":
            supabase.table("agent_runs").update({
                "status": "completed",
                "completed_at": "now()"
            }).eq("id", run_id).execute()

            logger.info(
                "background_execution_completed",
                run_id=run_id,
                user_id=user_id,
            )

        elif result.status == "waiting_user":
            # Already updated by supervisor
            logger.info(
                "background_execution_waiting_user",
                run_id=run_id,
                message=result.final_message,
            )

        elif result.status == "paused":
            # Already updated by supervisor
            logger.info(
                "background_execution_paused",
                run_id=run_id,
            )

        else:  # failed
            # Already updated by supervisor
            logger.error(
                "background_execution_failed",
                run_id=run_id,
                error=result.error,
            )

    except Exception as e:
        logger.error(
            "background_execution_exception",
            run_id=run_id,
            error=str(e),
        )

        # Mark as failed
        supabase.table("agent_runs").update({
            "status": "failed",
            "error_message": str(e),
            "completed_at": "now()"
        }).eq("id", run_id).execute()
