"""
Agent Logs API Route
Get execution logs with polling or SSE streaming
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import Client
import structlog
import json
import asyncio
from datetime import datetime

from app.auth import get_current_user, get_supabase_for_user
from app.models import AgentLogsRequest, AgentLogsResponse

logger = structlog.get_logger()
router = APIRouter()


@router.get("/logs")
async def agent_logs(
    run_id: str,
    mode: str = "polling",
    since: str = None,
    limit: int = 100,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_for_user),
):
    """
    Get agent execution logs

    Modes:
    - **polling**: Get logs since timestamp (cursor-based pagination)
    - **stream**: Server-Sent Events stream for real-time logs
    """
    user_id = user["id"]

    logger.info(
        "agent_logs_requested",
        run_id=run_id,
        mode=mode,
        user_id=user_id,
    )

    # Verify run belongs to user
    run_response = supabase.table("agent_runs").select("id").eq("id", run_id).eq("user_id", user_id).execute()

    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    if mode == "polling":
        return await handle_polling(supabase, run_id, since, limit)
    elif mode == "stream":
        return await handle_streaming(supabase, run_id, since)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mode: {mode}. Use 'polling' or 'stream'"
        )


async def handle_polling(
    supabase: Client,
    run_id: str,
    since: str = None,
    limit: int = 100,
) -> AgentLogsResponse:
    """Handle polling mode - return logs since timestamp"""

    query = supabase.table("agent_task_logs")\
        .select("*")\
        .eq("run_id", run_id)\
        .order("created_at", desc=False)\
        .limit(limit)

    if since:
        query = query.gt("created_at", since)

    logs_response = query.execute()
    logs = logs_response.data or []

    # Check if there are more logs
    has_more = len(logs) == limit

    # Get cursor for next page (timestamp of last log)
    next_cursor = None
    if logs and has_more:
        next_cursor = logs[-1]["created_at"]

    logger.info(
        "agent_logs_polling",
        run_id=run_id,
        log_count=len(logs),
        has_more=has_more,
    )

    return {
        "logs": logs,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


async def handle_streaming(
    supabase: Client,
    run_id: str,
    since: str = None,
):
    """Handle streaming mode - SSE stream via Redis pub/sub"""

    async def event_stream():
        """Generate SSE events from Redis pub/sub"""
        from app.redis.subscriber import LogSubscriber

        subscriber = LogSubscriber(run_id)

        try:
            # Send initial connection event
            yield f"data: {json.dumps({'type': 'connected', 'run_id': run_id})}\n\n"

            # Send historical logs from DB if `since` provided
            if since:
                logs_response = supabase.table("agent_task_logs")\
                    .select("*")\
                    .eq("run_id", run_id)\
                    .gt("created_at", since)\
                    .order("created_at", desc=False)\
                    .limit(100)\
                    .execute()

                for log in (logs_response.data or []):
                    event_data = {
                        "type": "log",
                        "data": log
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"

            # Stream real-time logs from Redis pub/sub
            async for log_data in subscriber.listen():
                yield f"data: {json.dumps(log_data)}\n\n"

                # Stop listening after completion event
                if log_data.get("type") == "complete":
                    logger.info("agent_logs_stream_complete", run_id=run_id)
                    break

        except asyncio.CancelledError:
            logger.info("agent_logs_stream_cancelled", run_id=run_id)
            yield f"data: {json.dumps({'type': 'disconnected'})}\n\n"
        except Exception as e:
            logger.error("agent_logs_stream_error", run_id=run_id, error=str(e))
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            await subscriber.cleanup()

    logger.info("agent_logs_streaming_started", run_id=run_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
