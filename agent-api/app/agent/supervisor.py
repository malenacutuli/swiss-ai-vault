"""Agent Supervisor - Main execution orchestrator"""
import json
import logging
import asyncio
from typing import List, Optional, Union
from supabase import Client

from app.agent.models.types import (
    ExecutionPlan,
    PlanPhase,
    AgentAction,
    ExecutionResult,
    LLMMessage,
    ToolContext,
)
from app.agent.tools.router import ToolRouter
from app.llm import LLMProvider, LLMMessage as ProviderLLMMessage, create_llm_provider
from app.config import get_settings

logger = logging.getLogger(__name__)


class AgentSupervisor:
    """Main execution orchestrator that runs the agent loop"""

    def __init__(
        self,
        supabase: Client,
        llm_provider: Optional[LLMProvider] = None,
        run_id: str = "",
        user_id: str = "",
        plan: Optional[ExecutionPlan] = None,
        current_phase_number: int = 1,
    ):
        self.supabase = supabase
        self.run_id = run_id
        self.user_id = user_id
        self.plan = plan
        self.current_phase_number = current_phase_number
        self.conversation_history: List[LLMMessage] = []
        self.tool_router = ToolRouter(supabase)
        self.max_iterations = 50
        self.max_context_tokens = 100000

        # Initialize multi-provider LLM
        if llm_provider:
            self.llm = llm_provider
        else:
            settings = get_settings()
            self.llm = create_llm_provider(
                anthropic_api_key=settings.anthropic_api_key,
                openai_api_key=settings.openai_api_key,
                primary_provider=settings.llm_primary_provider,
                default_model=settings.llm_default_model,
                fallback_enabled=settings.llm_fallback_enabled,
            )
            logger.info("✓ Multi-provider LLM initialized")

    async def execute(self) -> ExecutionResult:
        """Main execution loop"""
        try:
            # Transition to executing state
            await self._update_run_status("executing")

            # Load conversation history
            await self._load_conversation_history()

            iterations = 0

            while iterations < self.max_iterations:
                iterations += 1

                # Check if run has been cancelled or paused
                run_status = await self._get_run_status()
                if run_status in ["cancelled", "paused"]:
                    return ExecutionResult(status="paused")

                # Check credit availability
                if not await self._check_credits():
                    await self._log_error("Insufficient credits to continue")
                    await self._update_run_status("failed", error_message="Insufficient credits")
                    return ExecutionResult(status="failed", error="Insufficient credits")

                # Get current phase
                current_phase = next(
                    (p for p in self.plan.phases if p.phase_number == self.current_phase_number),
                    None,
                )

                if not current_phase:
                    await self._log_error(f"Phase {self.current_phase_number} not found in plan")
                    await self._update_run_status("failed", error_message="Invalid phase number")
                    return ExecutionResult(status="failed", error="Invalid phase number")

                # Decide next action using LLM
                action = await self._decide_next_action(current_phase)

                if not action:
                    await self._log_error("Failed to determine next action")
                    await self._update_run_status("failed", error_message="Failed to determine next action")
                    return ExecutionResult(status="failed", error="Failed to determine next action")

                # Log action reasoning
                if action.reasoning:
                    await self._log_info(f"Agent reasoning: {action.reasoning}")

                # Execute action
                success, error = await self._execute_action(action, current_phase)

                if not success:
                    await self._log_error(f"Action failed: {error}")
                    await self._update_run_status("failed", error_message=error or "Action execution failed")
                    return ExecutionResult(status="failed", error=error)

                # Handle action result
                if action.type == "task_complete":
                    await self._log_success("Task completed successfully")
                    await self._update_run_status("completed")
                    return ExecutionResult(
                        status="completed",
                        final_message=action.message or "Task completed",
                    )

                if action.type == "request_input":
                    await self._log_info(f"Waiting for user input: {action.message}")
                    await self._update_run_status("waiting_user", message=action.message)
                    return ExecutionResult(
                        status="waiting_user",
                        final_message=action.message,
                    )

                if action.type == "phase_complete":
                    await self._log_phase_advance(self.current_phase_number, self.current_phase_number + 1)
                    self.current_phase_number += 1

                    # Update run with new phase
                    self.supabase.table("agent_runs").update({
                        "current_phase": self.current_phase_number
                    }).eq("id", self.run_id).execute()

                    # Check if all phases complete
                    if self.current_phase_number > len(self.plan.phases):
                        await self._log_success("All phases completed")
                        await self._update_run_status("completed")
                        return ExecutionResult(status="completed", final_message="All phases completed")

                # Trim context if needed
                await self._trim_context_if_needed()

                # Small delay to prevent tight loops
                await asyncio.sleep(0.1)

            # Max iterations reached
            await self._log_error("Maximum iterations reached")
            await self._update_run_status("timeout", error_message="Maximum iterations reached")
            return ExecutionResult(status="failed", error="Maximum iterations reached")

        except Exception as e:
            logger.error(f"Supervisor execution error: {e}")
            await self._update_run_status("failed", error_message=str(e))
            return ExecutionResult(status="failed", error=str(e))

    async def _decide_next_action(self, current_phase: PlanPhase) -> Optional[AgentAction]:
        """Decide next action using multi-provider LLM"""
        try:
            system_prompt = self._build_decision_system_prompt(current_phase)

            # Convert conversation history to LLM provider format
            messages = [
                ProviderLLMMessage(role=msg.role, content=msg.content)
                for msg in self.conversation_history
            ]

            # Call LLM with automatic fallback
            response = await self.llm.complete(
                messages=messages,
                system=system_prompt,
                max_tokens=2048,
                temperature=0.7,
            )

            # Track token usage
            await self._track_token_usage(
                model=response.model,
                input_tokens=response.input_tokens,
                output_tokens=response.output_tokens,
                cost_usd=response.cost_usd,
            )

            content = response.content
            if not content:
                return None

            # Parse action from JSON
            action_data = self._extract_json(content)
            if not action_data:
                return None

            return AgentAction(**action_data)

        except Exception as e:
            logger.error(f"Decision error: {e}")
            return None

    async def _track_token_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
    ):
        """Track token usage for billing using token_records table"""
        import uuid

        # Determine provider from model
        provider = "anthropic" if "claude" in model.lower() else "openai"

        # Calculate input/output costs (rough split)
        input_cost = cost_usd * 0.3  # ~30% of cost is input
        output_cost = cost_usd * 0.7  # ~70% of cost is output

        try:
            self.supabase.table("token_records").insert({
                "run_id": self.run_id,
                "idempotency_key": f"{self.run_id}:{uuid.uuid4()}",
                "model": model,
                "provider": provider,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": cost_usd,
                "input_cost_usd": input_cost,
                "output_cost_usd": output_cost,
                "is_estimated": False,
            }).execute()
            logger.debug(f"Tracked {input_tokens}+{output_tokens} tokens ({model})")
        except Exception as e:
            logger.warning(f"Failed to track token usage: {e}")

    async def _execute_action(self, action: AgentAction, current_phase: PlanPhase) -> tuple[bool, Optional[str]]:
        """Execute an action"""
        try:
            if action.type == "tool":
                if not action.tool_name or not action.tool_input:
                    return False, "Tool action missing name or input"

                # Create step in database
                result = self.supabase.table("agent_steps").insert({
                    "run_id": self.run_id,
                    "step_number": self.current_phase_number,
                    "tool_type": action.tool_name,
                    "tool_name": action.tool_name,
                    "tool_input": action.tool_input,
                    "status": "pending",
                }).select().execute()

                if not result.data:
                    return False, "Failed to create step"
                step = result.data[0]

                # Mark step as running
                self.supabase.table("agent_steps").update({
                    "status": "running",
                    "started_at": "now()",
                }).eq("id", step["id"]).execute()

                # Execute tool
                tool_context = ToolContext(
                    run_id=self.run_id,
                    user_id=self.user_id,
                    step_id=step["id"],
                )

                tool_result = await self.tool_router.execute(
                    action.tool_name,
                    action.tool_input,
                    tool_context,
                )

                # Deduct credits
                if tool_result.credits_used > 0:
                    await self._deduct_credits(tool_result.credits_used)

                # Update step with result
                self.supabase.table("agent_steps").update({
                    "status": "completed" if tool_result.success else "failed",
                    "tool_output": tool_result.output,
                    "error_message": tool_result.error,
                    "credits_used": tool_result.credits_used,
                    "completed_at": "now()",
                }).eq("id", step["id"]).execute()

                # Add tool result to conversation
                self.conversation_history.append(LLMMessage(
                    role="tool",
                    content=json.dumps(tool_result.output),
                    tool_call_id=step["id"],
                    tool_name=action.tool_name,
                ))

                # Log tool execution
                if tool_result.success:
                    await self._log_tool_success(action.tool_name, tool_result.credits_used)
                else:
                    await self._log_tool_error(action.tool_name, tool_result.error or "Unknown error")

                return tool_result.success, tool_result.error

            if action.type == "message":
                if not action.message:
                    return False, "Message action missing message"

                self.supabase.table("agent_messages").insert({
                    "run_id": self.run_id,
                    "role": "assistant",
                    "content": action.message,
                }).execute()

                # Add to conversation
                self.conversation_history.append(LLMMessage(
                    role="assistant",
                    content=action.message,
                ))

                return True, None

            if action.type in ["phase_complete", "task_complete", "request_input"]:
                # These are handled in main loop
                return True, None

            return False, f"Unknown action type: {action.type}"

        except Exception as e:
            logger.error(f"Action execution error: {e}")
            return False, str(e)

    def _build_decision_system_prompt(self, current_phase: PlanPhase) -> str:
        """Build system prompt for decision-making"""
        capabilities_str = ", ".join(current_phase.required_capabilities)
        outputs_str = ", ".join(current_phase.expected_outputs)

        return f"""You are an AI agent executor. You are currently executing a multi-phase plan.

OVERALL GOAL: {self.plan.goal}

CURRENT PHASE: Phase {current_phase.phase_number} - {current_phase.name}
DESCRIPTION: {current_phase.description}
EXPECTED OUTPUTS: {outputs_str}
AVAILABLE CAPABILITIES: {capabilities_str}

YOUR TASK:
Analyze the conversation history and decide what action to take next to advance this phase.

AVAILABLE ACTIONS:
1. "tool" - Execute a tool (shell, code, browser, search, file operation, etc.)
2. "message" - Send a message to the user
3. "phase_complete" - Mark current phase as complete and move to next phase
4. "task_complete" - Mark entire task as complete (all phases done)
5. "request_input" - Ask user for input/clarification

DECISION RULES:
- Focus on completing the current phase's expected outputs
- Use tools to gather information, execute code, or interact with systems
- Send messages to keep user informed of progress
- Only mark phase_complete when all expected outputs are achieved
- Only mark task_complete when ALL phases are done
- Request input if you need clarification or encounter ambiguity

OUTPUT FORMAT:
Return a JSON object with this structure:
{{
  "type": "tool" | "message" | "phase_complete" | "task_complete" | "request_input",
  "tool_name": "name_of_tool",
  "tool_input": {{}},
  "message": "message to user",
  "reasoning": "why you chose this action"
}}

IMPORTANT:
- Be concise but thorough in your reasoning
- Don't repeat actions that have already failed
- Learn from previous tool outputs
- Stay focused on the current phase goal"""

    async def _load_conversation_history(self):
        """Load conversation history from database"""
        # Load messages
        result = self.supabase.table("agent_messages").select("role, content, created_at").eq("run_id", self.run_id).order("created_at").execute()
        messages = result.data or []

        # Load steps
        result = self.supabase.table("agent_steps").select("id, tool_name, tool_output, created_at").eq("run_id", self.run_id).eq("status", "completed").order("created_at").execute()
        steps = result.data or []

        # Merge into history
        for msg in messages:
            self.conversation_history.append(LLMMessage(
                role=msg["role"],
                content=msg["content"],
            ))

        for step in steps:
            self.conversation_history.append(LLMMessage(
                role="tool",
                content=json.dumps(step["tool_output"]),
                tool_call_id=step["id"],
                tool_name=step["tool_name"],
            ))

    async def _trim_context_if_needed(self):
        """Trim context if it exceeds token limit"""
        # Simple heuristic: 1 token ≈ 4 characters
        estimated_tokens = sum(len(msg.content) // 4 for msg in self.conversation_history)

        if estimated_tokens > self.max_context_tokens:
            # Keep last 50% of messages
            keep_count = len(self.conversation_history) // 2
            self.conversation_history = self.conversation_history[-keep_count:]
            await self._log_info("Context trimmed due to size")

    async def _check_credits(self) -> bool:
        """Check if user has available credits, auto-create balance if missing."""
        result = self.supabase.table("credit_balances").select("available_credits").eq("user_id", self.user_id).execute()

        if not result.data:
            # Auto-create credit balance for new users
            logger.info(f"Creating credit balance for new user {self.user_id}")
            try:
                self.supabase.table("credit_balances").insert({
                    "user_id": self.user_id,
                    "available_credits": 10000
                }).execute()
            except Exception as e:
                logger.warning(f"Failed to create credit balance: {e}")
            return True

        return result.data[0].get("available_credits", 0) > 0

    async def _deduct_credits(self, amount: float):
        """Deduct credits from user balance"""
        self.supabase.rpc("consume_credits", {
            "p_user_id": self.user_id,
            "p_amount": amount,
            "p_run_id": self.run_id,
        }).execute()

        # Update run total
        result = self.supabase.table("agent_runs").select("total_credits_used").eq("id", self.run_id).execute()
        if not result.data:
            logger.warning(f"Run {self.run_id} not found when updating credits used")
            return
        current_total = result.data[0].get("total_credits_used", 0)

        self.supabase.table("agent_runs").update({
            "total_credits_used": current_total + amount
        }).eq("id", self.run_id).execute()

    async def _get_run_status(self) -> Optional[str]:
        """Get current run status"""
        result = self.supabase.table("agent_runs").select("status").eq("id", self.run_id).execute()
        if not result.data:
            logger.error(f"Run {self.run_id} not found when checking status")
            return "failed"
        return result.data[0].get("status")

    async def _update_run_status(self, status: str, **kwargs):
        """Update run status"""
        update_data = {"status": status}
        if "error_message" in kwargs:
            update_data["error_message"] = kwargs["error_message"]
        if status == "completed":
            update_data["completed_at"] = "now()"

        self.supabase.table("agent_runs").update(update_data).eq("id", self.run_id).execute()

    async def _log_info(self, message: str):
        """Log info message"""
        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "info",
            "message": message,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "info", message)

    async def _log_success(self, message: str):
        """Log success message"""
        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "success",
            "message": message,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "success", message)

    async def _log_error(self, message: str):
        """Log error message"""
        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "error",
            "message": message,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "error", message)

    async def _log_tool_success(self, tool_name: str, credits_used: float):
        """Log tool success"""
        metadata = {"tool_name": tool_name, "credits_used": credits_used}
        message = f"{tool_name} executed successfully"

        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "tool_success",
            "message": message,
            "metadata": metadata,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "tool_success", message, metadata)

    async def _log_tool_error(self, tool_name: str, error: str):
        """Log tool error"""
        metadata = {"tool_name": tool_name, "error": error}
        message = f"{tool_name} failed: {error}"

        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "tool_error",
            "message": message,
            "metadata": metadata,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "tool_error", message, metadata)

    async def _log_phase_advance(self, from_phase: int, to_phase: int):
        """Log phase advancement"""
        metadata = {"from_phase": from_phase, "to_phase": to_phase}
        message = f"Advanced from phase {from_phase} to phase {to_phase}"

        # Write to DB (persistence)
        self.supabase.table("agent_task_logs").insert({
            "run_id": self.run_id,
            "log_type": "phase_advance",
            "message": message,
            "metadata": metadata,
        }).execute()

        # Publish to Redis (real-time)
        from app.redis.publisher import LogPublisher
        publisher = LogPublisher()
        await publisher.publish_log(self.run_id, "phase_advance", message, metadata)

    def _extract_json(self, content: str) -> Optional[dict]:
        """Extract JSON from LLM response"""
        import re

        # Try parsing directly first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block with language specifier
        match = re.search(r"```json\s*([\s\S]*?)\s*```", content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try extracting from code block without language specifier
        match = re.search(r"```\s*([\s\S]*?)\s*```", content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding JSON object in the text
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return None
