"""
Agent Execution Streaming API
Provides Server-Sent Events (SSE) for real-time agent execution updates
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncGenerator, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from supabase import Client

from app.auth import get_current_user, get_supabase_for_user
from app.redis.clients import get_api_redis

logger = logging.getLogger(__name__)
router = APIRouter()


class AgentEventStream:
    """
    Streams agent execution events via Server-Sent Events (SSE).
    
    Event Types:
    - status: Run status changes (queued, planning, executing, completed, failed)
    - thinking: Agent reasoning/thinking updates
    - tool_call: Tool invocation started
    - tool_result: Tool execution completed
    - message: Agent message to user
    - phase: Phase transition
    - progress: Progress percentage update
    - error: Error occurred
    - heartbeat: Keep-alive ping
    """
    
    def __init__(self, supabase: Client, run_id: str, user_id: str):
        self.supabase = supabase
        self.run_id = run_id
        self.user_id = user_id
        self.redis = get_api_redis()
        self.last_step_id = None
        self.last_message_id = None
        self.last_status = None
        
    async def stream(self, request: Request) -> AsyncGenerator[str, None]:
        """Generate SSE events for agent execution"""
        
        # Verify run exists and belongs to user
        run = await self._get_run()
        if not run:
            yield self._format_event("error", {"message": "Run not found"})
            return
            
        logger.info(f"Starting SSE stream for run {self.run_id}")
        
        # Send initial state
        yield self._format_event("status", {
            "status": run["status"],
            "current_phase": run.get("current_phase", 0),
            "total_phases": len(run.get("plan", {}).get("phases", [])) if run.get("plan") else 0,
        })
        
        # Stream events until completion or disconnect
        heartbeat_counter = 0
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                logger.info(f"Client disconnected from stream {self.run_id}")
                break
                
            # Check for new events
            events = await self._poll_events()
            
            for event in events:
                yield event
                
            # Check if run is complete
            run = await self._get_run()
            if run and run["status"] in ["completed", "failed", "cancelled", "timeout"]:
                yield self._format_event("complete", {
                    "status": run["status"],
                    "message": run.get("error_message") or "Execution finished",
                })
                break
                
            # Send heartbeat every 15 seconds
            heartbeat_counter += 1
            if heartbeat_counter >= 15:
                yield self._format_event("heartbeat", {"timestamp": datetime.utcnow().isoformat()})
                heartbeat_counter = 0
                
            # Poll interval
            await asyncio.sleep(1)
            
    async def _get_run(self) -> Optional[dict]:
        """Fetch run from database"""
        try:
            response = self.supabase.table("agent_runs").select("*").eq("id", self.run_id).eq("user_id", self.user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Failed to fetch run {self.run_id}: {e}")
            return None
            
    async def _poll_events(self) -> list[str]:
        """Poll for new events from database and Redis"""
        events = []
        
        # Check for status changes
        run = await self._get_run()
        if run and run["status"] != self.last_status:
            self.last_status = run["status"]
            events.append(self._format_event("status", {
                "status": run["status"],
                "current_phase": run.get("current_phase", 0),
            }))
            
        # Check for new steps (tool calls)
        try:
            steps_response = self.supabase.table("agent_steps").select("*").eq("run_id", self.run_id).order("created_at", desc=False).execute()
            
            for step in steps_response.data or []:
                if self.last_step_id and step["id"] <= self.last_step_id:
                    continue
                    
                self.last_step_id = step["id"]
                
                # Emit tool_call event
                events.append(self._format_event("tool_call", {
                    "step_id": step["id"],
                    "tool_name": step["tool_name"],
                    "tool_input": step.get("tool_input", {}),
                    "status": step["status"],
                }))
                
                # If step completed, emit tool_result
                if step["status"] in ["completed", "failed"]:
                    events.append(self._format_event("tool_result", {
                        "step_id": step["id"],
                        "tool_name": step["tool_name"],
                        "success": step["status"] == "completed",
                        "output": step.get("tool_output"),
                        "error": step.get("error_message"),
                        "duration_ms": step.get("duration_ms"),
                    }))
                    
        except Exception as e:
            logger.error(f"Failed to poll steps for run {self.run_id}: {e}")
            
        # Check for new messages
        try:
            messages_response = self.supabase.table("agent_messages").select("*").eq("run_id", self.run_id).order("created_at", desc=False).execute()
            
            for msg in messages_response.data or []:
                if self.last_message_id and msg["id"] <= self.last_message_id:
                    continue
                    
                self.last_message_id = msg["id"]
                
                events.append(self._format_event("message", {
                    "message_id": msg["id"],
                    "role": msg["role"],
                    "content": msg["content"],
                }))
                
        except Exception as e:
            logger.error(f"Failed to poll messages for run {self.run_id}: {e}")
            
        # Check Redis for real-time thinking updates
        try:
            thinking_key = f"run:{self.run_id}:thinking"
            thinking = self.redis.get(thinking_key)
            if thinking:
                events.append(self._format_event("thinking", {
                    "content": thinking,
                }))
                self.redis.delete(thinking_key)
        except Exception as e:
            logger.debug(f"Redis thinking poll failed: {e}")
            
        return events
        
    def _format_event(self, event_type: str, data: dict) -> str:
        """Format SSE event"""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


@router.get("/run/{run_id}/stream")
async def stream_agent_execution(
    run_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_for_user),
):
    """
    Stream agent execution events via Server-Sent Events (SSE).
    
    Connect to this endpoint to receive real-time updates about agent execution:
    - Status changes (queued → planning → executing → completed)
    - Tool calls and results
    - Agent messages
    - Progress updates
    
    Example usage (JavaScript):
    ```javascript
    const eventSource = new EventSource('/agent/run/{run_id}/stream');
    eventSource.addEventListener('status', (e) => console.log('Status:', JSON.parse(e.data)));
    eventSource.addEventListener('tool_call', (e) => console.log('Tool:', JSON.parse(e.data)));
    eventSource.addEventListener('complete', (e) => { eventSource.close(); });
    ```
    """
    user_id = user["id"]
    
    logger.info(f"SSE stream requested for run {run_id} by user {user_id}")
    
    stream = AgentEventStream(supabase, run_id, user_id)
    
    return StreamingResponse(
        stream.stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/run/{run_id}/events")
async def get_agent_events(
    run_id: str,
    since: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_for_user),
):
    """
    Get agent execution events (non-streaming fallback).
    
    Use this endpoint for polling if SSE is not available.
    
    Args:
        run_id: Agent run ID
        since: ISO timestamp to fetch events after
        limit: Maximum number of events to return
    """
    user_id = user["id"]
    
    # Verify run belongs to user
    run_response = supabase.table("agent_runs").select("*").eq("id", run_id).eq("user_id", user_id).execute()
    
    if not run_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )
        
    run = run_response.data[0]
    
    # Fetch steps
    steps_query = supabase.table("agent_steps").select("*").eq("run_id", run_id).order("created_at", desc=False).limit(limit)
    if since:
        steps_query = steps_query.gt("created_at", since)
    steps_response = steps_query.execute()
    
    # Fetch messages
    messages_query = supabase.table("agent_messages").select("*").eq("run_id", run_id).order("created_at", desc=False).limit(limit)
    if since:
        messages_query = messages_query.gt("created_at", since)
    messages_response = messages_query.execute()
    
    return {
        "run": {
            "id": run["id"],
            "status": run["status"],
            "current_phase": run.get("current_phase", 0),
            "plan": run.get("plan"),
            "error_message": run.get("error_message"),
        },
        "steps": steps_response.data or [],
        "messages": messages_response.data or [],
    }


@router.post("/run/{run_id}/thinking")
async def publish_thinking(
    run_id: str,
    content: str,
    user: dict = Depends(get_current_user),
):
    """
    Publish agent thinking update (internal use).
    
    Called by the agent supervisor to broadcast thinking updates.
    """
    try:
        redis = get_api_redis()
        redis.set(f"run:{run_id}:thinking", content, ex=30)  # Expire after 30s
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to publish thinking for run {run_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish thinking update"
        )
