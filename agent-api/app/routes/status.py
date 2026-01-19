"""
Agent Status API Route
Get detailed status and progress of agent runs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
import structlog

from app.auth import get_current_user, get_supabase_for_user
from app.models import AgentStatusRequest, AgentStatusResponse

logger = structlog.get_logger()
router = APIRouter()


@router.post("/status", response_model=AgentStatusResponse)
async def agent_status(
    request: AgentStatusRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_for_user),
):
    """
    Get detailed status of an agent run

    Options to include:
    - **steps**: Execution steps with phase information
    - **messages**: Conversation history (user + assistant messages)
    - **artifacts**: Generated files and outputs
    - **logs**: Execution logs
    """
    user_id = user["id"]

    logger.info(
        "agent_status_requested",
        run_id=request.run_id,
        user_id=user_id,
    )

    try:
        # Get run
        run_response = supabase.table("agent_runs").select("*").eq("id", request.run_id).eq("user_id", user_id).execute()

        if not run_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Run not found"
            )

        run = run_response.data[0]

        # Calculate progress
        total_phases = 0
        current_phase = run.get("current_phase", 0)

        if run.get("execution_plan"):
            plan = run["execution_plan"]
            if isinstance(plan, dict) and "phases" in plan:
                total_phases = len(plan["phases"])

        progress = {
            "percentage": (current_phase / total_phases * 100) if total_phases > 0 else 0,
            "current_phase": current_phase,
            "total_phases": total_phases,
            "status": run["status"],
        }

        # Build response
        response = {
            "run": run,
            "progress": progress,
        }

        # Include steps if requested
        if request.include_steps:
            steps_response = supabase.table("agent_steps")\
                .select("*")\
                .eq("run_id", request.run_id)\
                .order("phase_number", desc=False)\
                .limit(request.steps_limit)\
                .execute()

            response["steps"] = steps_response.data or []

        # Include messages if requested
        if request.include_messages:
            messages_response = supabase.table("agent_messages")\
                .select("*")\
                .eq("run_id", request.run_id)\
                .order("created_at", desc=False)\
                .limit(request.messages_limit)\
                .execute()

            response["messages"] = messages_response.data or []

        # Include artifacts if requested
        if request.include_artifacts:
            artifacts_response = supabase.table("agent_artifacts")\
                .select("*")\
                .eq("run_id", request.run_id)\
                .order("created_at", desc=True)\
                .limit(request.artifacts_limit)\
                .execute()

            response["artifacts"] = artifacts_response.data or []

        # Include logs if requested
        if request.include_logs:
            logs_response = supabase.table("agent_task_logs")\
                .select("*")\
                .eq("run_id", request.run_id)\
                .order("created_at", desc=True)\
                .limit(request.logs_limit)\
                .execute()

            response["logs"] = logs_response.data or []

        logger.info(
            "agent_status_retrieved",
            run_id=request.run_id,
            status=run["status"],
            progress_pct=progress["percentage"],
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "agent_status_failed",
            run_id=request.run_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
